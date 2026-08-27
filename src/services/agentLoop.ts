import { AGENT_SYSTEM_PROMPT, AGENT_TOOLS, AgentChatMessage, AgentToolCall, chatWithTools } from './ollama';
import { FileNode } from '../types';

export interface AgentStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'running' | 'awaiting_permission' | 'done' | 'error';
  summary: string;
  detail?: string;
}

export type AgentPermissionScope = 'workspace_write' | 'workspace_delete' | 'terminal_command';
export type AgentPermissionDecision = 'allow_once' | 'allow_session' | 'deny';

export interface AgentPermissionRequest {
  id: string;
  scope: AgentPermissionScope;
  tool: string;
  title: string;
  description: string;
  detail: string;
}

export type PendingChangeType = 'create' | 'edit' | 'delete';

export interface PendingFileChange {
  path: string;
  type: PendingChangeType;
  originalContent: string | null;
  currentContent: string | null;
}

export interface TaskItem {
  text: string;
  status: 'pending' | 'in_progress' | 'done';
}

export interface RunAgentOptions {
  messages: AgentChatMessage[];
  model: string;
  rootPath: string;
  signal?: AbortSignal;
  pendingChanges: Map<string, PendingFileChange>;
  onStep: (step: AgentStep) => void;
  onTaskList: (tasks: TaskItem[]) => void;
  onPermissionRequest: (request: AgentPermissionRequest) => Promise<AgentPermissionDecision>;
  rootFileNames?: string[];
}

function permissionForTool(
  tool: string,
  args: Record<string, any>,
  id: string
): AgentPermissionRequest | null {
  if (tool === 'edit_file' || tool === 'write_file') {
    return {
      id,
      scope: 'workspace_write',
      tool,
      title: tool === 'write_file' ? 'Create or overwrite a file?' : 'Edit a workspace file?',
      description: 'The local agent wants to change files in the open workspace.',
      detail: String(args.path || 'Unknown path'),
    };
  }
  if (tool === 'delete_file' || tool === 'delete_directory') {
    return {
      id,
      scope: 'workspace_delete',
      tool,
      title: tool === 'delete_directory' ? 'Delete a workspace directory?' : 'Delete a workspace file?',
      description: tool === 'delete_directory'
        ? 'This recursively removes a child directory. Onyx snapshots readable files so the change can be rejected during this agent run.'
        : 'This removes a file. Onyx keeps its original content available for rejection during this agent run.',
      detail: String(args.path || 'Unknown path'),
    };
  }
  if (tool === 'run_command') {
    return {
      id,
      scope: 'terminal_command',
      tool,
      title: 'Run a terminal command?',
      description: 'The command runs locally in the currently open workspace.',
      detail: String(args.command || 'Unknown command'),
    };
  }
  return null;
}

export interface RunAgentResult {
  messages: AgentChatMessage[];
  finalText: string;
  completed: boolean;
}

const MAX_ITERATIONS = 20;
const MAX_RESULT_CHARS = 6000;

function resolvePath(rootPath: string, relativePath: string): string {
  const raw = relativePath ?? '';
  if (/^[a-zA-Z]:[/\\]/.test(raw) || raw.startsWith('/')) {
    return raw;
  }
  const cleaned = raw.replace(/^[/\\.]+/, '').replace(/\\/g, '/');
  return `${rootPath.replace(/[/\\]+$/, '')}/${cleaned}`;
}

function truncate(text: string, max = MAX_RESULT_CHARS): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n... [truncated, ${text.length - max} more characters]`;
}

function flattenFileTree(nodes: FileNode[], depth = 0): string {
  let out = '';
  for (const node of nodes) {
    out += `${'  '.repeat(depth)}${node.type === 'directory' ? '[dir] ' : '[file] '}${node.name}\n`;
    if (node.children?.length) {
      out += flattenFileTree(node.children, depth + 1);
    }
  }
  return out;
}

function parseArgs(call: AgentToolCall): Record<string, any> {
  try {
    const raw = call.function.arguments;
    if (typeof raw === 'string') {
      return raw.trim() ? JSON.parse(raw) : {};
    }
    return raw ?? {};
  } catch {
    return {};
  }
}

const AGENT_TOOL_NAMES = new Set(AGENT_TOOLS.map((tool) => tool.function.name));
const AGENT_TOOL_ALIASES: Record<string, string> = {
  create_file: 'write_file',
  create_or_update_file: 'write_file',
  save_file: 'write_file',
  delete_folder: 'delete_directory',
  remove_folder: 'delete_directory',
  remove_directory: 'delete_directory',
};

function normalizeToolName(name: string, args: Record<string, any>): string {
  const alias = AGENT_TOOL_ALIASES[name];
  if (name === 'create_file' && typeof args.path === 'string') {
    if (typeof args.content !== 'string') args.content = '';
    return 'write_file';
  }
  if (alias === 'write_file' && typeof args.path === 'string' && typeof args.content === 'string') {
    return alias;
  }
  if (alias === 'delete_directory' && typeof args.path === 'string') {
    return alias;
  }
  return name;
}

function enforceRequestedRootFile(args: Record<string, any>, rootFileNames: string[]): void {
  if (typeof args.path !== 'string' || rootFileNames.length === 0) return;
  const baseName = args.path.split(/[/\\]/).filter(Boolean).pop() || '';
  if (rootFileNames.some((name) => name.toLowerCase() === baseName.toLowerCase())) {
    args.path = baseName;
  }
}

function extractJsonObjects(content: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

function parseFallbackToolCall(content: string): AgentToolCall | null {
  const trimmed = content.trim();
  const candidates = [...new Set([
    trimmed,
    ...Array.from(trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi), (match) => match[1].trim()),
    ...Array.from(trimmed.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi), (match) => match[1].trim()),
    ...extractJsonObjects(trimmed),
  ])];

  for (const candidate of candidates) {
    if (!candidate.startsWith('{') || !candidate.endsWith('}')) continue;

    try {
      const parsed = JSON.parse(candidate);
      const wrappedTool = Array.isArray(parsed?.tool_calls) ? parsed.tool_calls[0] : parsed;
      const tool = wrappedTool?.function && typeof wrappedTool.function === 'object'
        ? wrappedTool.function
        : wrappedTool;
      const name = typeof tool?.name === 'string'
        ? tool.name
        : typeof tool?.tool === 'string'
        ? tool.tool
        : typeof tool?.tool_name === 'string'
        ? tool.tool_name
        : '';
      const toolArguments = tool?.arguments ?? tool?.args ?? tool?.parameters;
      if (!name || toolArguments === undefined) continue;

      return {
        id: typeof parsed.id === 'string' ? parsed.id : undefined,
        function: {
          name,
          arguments: typeof toolArguments === 'string'
            ? toolArguments
            : JSON.stringify(toolArguments),
        },
      };
    } catch {
      // Try the next supported wrapper.
    }
  }

  return null;
}

export function isSerializedAgentToolCall(content: string): boolean {
  if (parseFallbackToolCall(content)) return true;
  const nameMatch = content.match(/["'](?:name|tool|tool_name)["']\s*:\s*["']([^"']+)["']/i);
  return Boolean(
    nameMatch &&
    /["'](?:arguments|args|parameters)["']\s*:/i.test(content)
  );
}

function comparableText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function pathsMatch(left: string, right: string): boolean {
  const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return normalize(left) === normalize(right);
}

function relativeToWorkspace(rootPath: string, fullPath: string): string {
  const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedFull = fullPath.replace(/\\/g, '/');
  return normalizedFull.startsWith(`${normalizedRoot}/`)
    ? normalizedFull.slice(normalizedRoot.length + 1)
    : normalizedFull;
}

async function snapshotDirectoryFiles(
  nodes: FileNode[],
  rootPath: string,
  pendingChanges: Map<string, PendingFileChange>
): Promise<number> {
  let count = 0;
  for (const node of nodes) {
    if (node.type === 'directory') {
      count += await snapshotDirectoryFiles(node.children ?? [], rootPath, pendingChanges);
      continue;
    }

    const relativePath = relativeToWorkspace(rootPath, node.path);
    if (pendingChanges.has(relativePath)) continue;
    try {
      const originalContent = await window.fileSystem!.readFile(node.path);
      pendingChanges.set(relativePath, {
        path: relativePath,
        type: 'delete',
        originalContent,
        currentContent: null,
      });
      count += 1;
    } catch {
      // Keep deleting the readable part of the requested directory tree.
    }
  }
  return count;
}

async function ensureTracked(pendingChanges: Map<string, PendingFileChange>, fullPath: string, relPath: string) {
  if (pendingChanges.has(relPath)) {
    return;
  }
  try {
    const original = await window.fileSystem!.readFile(fullPath);
    pendingChanges.set(relPath, { path: relPath, type: 'edit', originalContent: original, currentContent: original });
  } catch {
    pendingChanges.set(relPath, { path: relPath, type: 'create', originalContent: null, currentContent: null });
  }
}

async function refreshCurrent(pendingChanges: Map<string, PendingFileChange>, fullPath: string, relPath: string) {
  try {
    const current = await window.fileSystem!.readFile(fullPath);
    const entry = pendingChanges.get(relPath);
    if (entry) {
      entry.currentContent = current;
    }
  } catch {
    // ignore - file may have been deleted by a later step
  }
}

async function executeTool(
  call: AgentToolCall,
  rootPath: string,
  pendingChanges: Map<string, PendingFileChange>,
  onTaskList: (tasks: TaskItem[]) => void,
  args: Record<string, any>,
): Promise<{ summary: string; detail: string; success?: boolean }> {
  const name = call.function.name;

  if (!window.fileSystem || !window.runtime) {
    throw new Error('File system bridge unavailable');
  }

  switch (name) {
    case 'read_file': {
      const full = resolvePath(rootPath, args.path);
      const content = await window.fileSystem.readFile(full);
      return { summary: `Read ${args.path}`, detail: truncate(content) };
    }

    case 'list_directory': {
      const target = !args.path || args.path === '.' ? rootPath : resolvePath(rootPath, args.path);
      const tree = await window.fileSystem.readDirectory(target);
      return { summary: `Listed ${args.path || '.'}`, detail: truncate(flattenFileTree(tree)) };
    }

    case 'search_files': {
      const results = (await window.fileSystem.searchFiles?.(args.query)) ?? [];
      const listing = results.map((r) => r.path).join('\n') || 'No matches found.';
      return { summary: `Searched for "${args.query}" (${results.length} matches)`, detail: truncate(listing) };
    }

    case 'edit_file': {
      const full = resolvePath(rootPath, args.path);
      const wasAlreadyTracked = pendingChanges.has(args.path);
      await ensureTracked(pendingChanges, full, args.path);
      try {
        await window.fileSystem.editFile!(full, args.old_text, args.new_text);
      } catch (error) {
        if (!wasAlreadyTracked) pendingChanges.delete(args.path);
        const message = error instanceof Error ? error.message : String(error);
        if (/no exact match|matched .* times|must be unique/i.test(message)) {
          let currentContent = '';
          try {
            currentContent = await window.fileSystem.readFile(full);
          } catch {
            // Preserve the original edit error when the file can no longer be read.
          }
          return {
            summary: `Edit not applied to ${args.path}`,
            detail: truncate(
              `${message}\n\nDo not retry the same old_text. Build a new exact replacement from the current file content below:\n\n${currentContent || '(current file could not be read)'}`
            ),
            success: false,
          };
        }
        throw error;
      }
      await refreshCurrent(pendingChanges, full, args.path);
      return { summary: `Edited ${args.path}`, detail: 'Edit applied successfully.' };
    }

    case 'write_file': {
      const full = resolvePath(rootPath, args.path);
      await ensureTracked(pendingChanges, full, args.path);
      await window.fileSystem.writeFile(full, args.content ?? '');
      const entry = pendingChanges.get(args.path);
      if (entry) {
        entry.currentContent = args.content ?? '';
      }
      return { summary: `Wrote ${args.path}`, detail: 'File written successfully.' };
    }

    case 'delete_file': {
      const full = resolvePath(rootPath, args.path);
      if (pathsMatch(full, rootPath)) {
        throw new Error('Cannot delete the workspace root. List "." and delete each child file or directory instead.');
      }
      const wasAlreadyTracked = pendingChanges.has(args.path);
      await ensureTracked(pendingChanges, full, args.path);
      try {
        await window.fileSystem.deleteFile(full);
      } catch (error) {
        if (!wasAlreadyTracked) pendingChanges.delete(args.path);
        const message = error instanceof Error ? error.message : String(error);
        if (/eperm|eisdir|operation not permitted|is a directory/i.test(message)) {
          throw new Error(`"${args.path}" is a directory. Use delete_directory for this path.`);
        }
        throw error;
      }
      const entry = pendingChanges.get(args.path);
      if (entry) {
        entry.type = 'delete';
        entry.currentContent = null;
      }
      return { summary: `Deleted ${args.path}`, detail: 'File deleted.' };
    }

    case 'delete_directory': {
      const full = resolvePath(rootPath, args.path);
      if (pathsMatch(full, rootPath)) {
        throw new Error('Cannot delete the workspace root. List "." and delete each child file or directory instead.');
      }
      const trackedBeforeDelete = new Set(pendingChanges.keys());
      const tree = await window.fileSystem.readDirectory(full);
      const trackedFiles = await snapshotDirectoryFiles(tree, rootPath, pendingChanges);
      try {
        await window.fileSystem.deleteFolder(full);
      } catch (error) {
        for (const path of pendingChanges.keys()) {
          if (!trackedBeforeDelete.has(path)) pendingChanges.delete(path);
        }
        throw error;
      }
      return {
        summary: `Deleted directory ${args.path}`,
        detail: `Directory removed. Snapshotted ${trackedFiles} file${trackedFiles === 1 ? '' : 's'} for Undo.`,
      };
    }

    case 'run_command': {
      const result = await window.runtime.runTerminalCommand(args.command);
      const out = `${result.stdout || ''}${result.stderr ? `\nSTDERR:\n${result.stderr}` : ''}`.trim();
      const exitCode = Number.isFinite(result.exitCode) ? result.exitCode : 1;
      return {
        summary: exitCode === 0 ? `Ran: ${args.command}` : `Command failed (${exitCode}): ${args.command}`,
        detail: truncate(`Exit code: ${exitCode}\n${out || '(no output)'}`),
        success: exitCode === 0,
      };
    }

    case 'update_task_list': {
      const tasks: TaskItem[] = Array.isArray(args.tasks) ? args.tasks : [];
      onTaskList(tasks);
      return {
        summary: `Updated task list (${tasks.length} items)`,
        detail: tasks.map((t) => `[${t.status}] ${t.text}`).join('\n'),
      };
    }

    default:
      throw new Error(
        `Unknown tool "${name}". Use one of: ${[...AGENT_TOOL_NAMES].join(', ')}`
      );
  }
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const { model, rootPath, signal, pendingChanges, onStep, onTaskList, onPermissionRequest } = opts;
  const rootFileNames = opts.rootFileNames ?? [];
  const cleanHistory = opts.messages.filter(
    (message) => message.role !== 'assistant' || !isSerializedAgentToolCall(message.content)
  );
  const messages: AgentChatMessage[] = cleanHistory[0]?.role === 'system'
    ? [...cleanHistory]
    : [{ role: 'system', content: AGENT_SYSTEM_PROMPT }, ...cleanHistory];
  const successfulCommands = new Map<string, string>();
  let workspaceRevision = 0;
  let duplicateCommandAttempts = 0;
  let continuationAttempts = 0;
  let lastToolResult = '';
  let currentTasks: TaskItem[] = [];
  let planningCallsSinceAction = 0;
  let lastTaskListSignature = '';
  const failedToolAttempts = new Map<string, number>();
  const failedTargetAttempts = new Map<string, number>();

  const failureKeyFor = (tool: string, args: Record<string, any>) =>
    `${workspaceRevision}:${tool}:${JSON.stringify(args)}`;
  const recordFailure = (tool: string, args: Record<string, any>) => {
    const key = failureKeyFor(tool, args);
    const identicalAttempts = (failedToolAttempts.get(key) ?? 0) + 1;
    failedToolAttempts.set(key, identicalAttempts);

    const target = String(args.path ?? args.command ?? args.query ?? tool);
    const targetKey = `${workspaceRevision}:${tool}:${target}`;
    const targetAttempts = (failedTargetAttempts.get(targetKey) ?? 0) + 1;
    failedTargetAttempts.set(targetKey, targetAttempts);
    return { identicalAttempts, targetAttempts };
  };
  const shouldStopAfterFailure = (tool: string, args: Record<string, any>) => {
    const attempts = recordFailure(tool, args);
    return attempts.identicalAttempts >= 2 || attempts.targetAttempts >= 3;
  };

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const reply = await chatWithTools(messages, model, signal);
    messages.push(reply);

    let parsedToolCalls = reply.tool_calls || [];

    // Some local models print a tool call as bare or fenced JSON instead of using
    // Ollama's native tool_calls field. Normalize that output into the same path.
    if (parsedToolCalls.length === 0 && reply.content) {
      const fallbackCall = parseFallbackToolCall(reply.content);
      if (fallbackCall) {
        parsedToolCalls = [fallbackCall];
        reply.tool_calls = parsedToolCalls;
        reply.content = '';
      }
    }

    if (parsedToolCalls.length === 0) {
      const responseText = reply.content || '';
      const openTasks = currentTasks.some((task) => task.status !== 'done');
      const malformedToolCall = isSerializedAgentToolCall(responseText);
      const echoedToolResult = Boolean(
        lastToolResult && comparableText(responseText) === comparableText(lastToolResult)
      );

      if ((malformedToolCall || openTasks || echoedToolResult) && continuationAttempts < 3) {
        continuationAttempts += 1;
        reply.content = '';
        messages.push({
          role: 'system',
          content: malformedToolCall
            ? 'Your previous tool JSON was incomplete or malformed. Retry the same action with exactly one complete, valid tool call. Keep arguments focused and do not use a Markdown fence.'
            : openTasks
            ? 'The task list still contains unfinished work. Continue now with the next necessary tool call. Do not repeat or summarize the previous tool result, and do not stop until every task is done.'
            : 'That response only repeated the previous tool result. Continue with the next necessary tool call, or call task_complete if the user request is genuinely finished.',
        });
        continue;
      }

      if (malformedToolCall) {
        reply.content = '';
        return {
          messages,
          finalText: 'The local model could not produce a complete tool call after several retries. Try a smaller file change or a more capable model.',
          completed: false,
        };
      }
      if (echoedToolResult) {
        reply.content = '';
        return {
          messages,
          finalText: 'The local model repeated a tool result instead of continuing. Send Continue to retry the next action.',
          completed: false,
        };
      }
      if (openTasks) {
        reply.content = '';
        return {
          messages,
          finalText: 'The local model stopped while tasks were still pending. Send Continue to retry the next action.',
          completed: false,
        };
      }
      return { messages, finalText: reply.content || '', completed: true };
    }

    continuationAttempts = 0;

    for (const call of parsedToolCalls) {
      const stepId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const args = parseArgs(call);
      enforceRequestedRootFile(args, rootFileNames);
      call.function.name = normalizeToolName(call.function.name, args);
      call.function.arguments = JSON.stringify(args);

      if (call.function.name === 'update_task_list') {
        const nextTasks = Array.isArray(args.tasks) ? args.tasks : [];
        const taskListSignature = JSON.stringify(nextTasks);
        if (
          (planningCallsSinceAction > 0 && taskListSignature === lastTaskListSignature) ||
          planningCallsSinceAction >= 2
        ) {
          const repeatedPlan = 'Skipped repeated planning. Use a read, search, file, or command tool for the next concrete action.';
          onStep({
            id: stepId,
            tool: call.function.name,
            args,
            status: 'error',
            summary: 'Skipped repeated planning',
            detail: repeatedPlan,
          });
          lastToolResult = repeatedPlan;
          messages.push({ role: 'tool', content: repeatedPlan });
          continue;
        }
        planningCallsSinceAction += 1;
        currentTasks = nextTasks;
        lastTaskListSignature = taskListSignature;
      } else {
        planningCallsSinceAction = 0;
      }

      onStep({ id: stepId, tool: call.function.name, args, status: 'running', summary: `Running ${call.function.name}` });

      if (call.function.name === 'task_complete') {
        const summary = typeof args.summary === 'string' ? args.summary : 'Task complete';
        onStep({ id: stepId, tool: call.function.name, args, status: 'done', summary });
        messages.push({ role: 'tool', content: 'Task marked complete.' });
        return { messages, finalText: summary, completed: true };
      }

      if (call.function.name === 'run_command') {
        const commandKey = `${workspaceRevision}:${String(args.command || '').trim()}`;
        const previousResult = successfulCommands.get(commandKey);
        if (previousResult !== undefined) {
          duplicateCommandAttempts += 1;
          const duplicateMessage = `Skipped duplicate command because it already succeeded and workspace files have not changed since then. Previous result:\n${previousResult}`;
          onStep({ id: stepId, tool: call.function.name, args, status: 'error', summary: 'Skipped duplicate command', detail: previousResult });
          messages.push({ role: 'tool', content: duplicateMessage });
          if (duplicateCommandAttempts >= 2) {
            return {
              messages,
              finalText: 'Stopped because the model repeatedly requested an already successful command. The earlier command result remains valid.',
              completed: false,
            };
          }
          continue;
        }
      }

      const permission = permissionForTool(call.function.name, args, stepId);
      if (permission) {
        onStep({
          id: stepId,
          tool: call.function.name,
          args,
          status: 'awaiting_permission',
          summary: `Waiting for permission: ${permission.title}`,
        });
        const decision = await onPermissionRequest(permission);
        if (decision === 'deny') {
          const denied = `Permission denied for ${call.function.name}. Do not retry the same action unless the user explicitly requests it.`;
          onStep({ id: stepId, tool: call.function.name, args, status: 'error', summary: denied });
          messages.push({ role: 'tool', content: denied });
          if (shouldStopAfterFailure(call.function.name, args)) {
            return {
              messages,
              finalText: `Stopped because the model repeated a denied ${call.function.name} action.`,
              completed: false,
            };
          }
          continue;
        }
      }

      try {
        const { summary, detail, success = true } = await executeTool(call, rootPath, pendingChanges, onTaskList, args);
        onStep({ id: stepId, tool: call.function.name, args, status: success ? 'done' : 'error', summary, detail });
        lastToolResult = `${success ? 'SUCCESS' : 'ERROR'}: ${summary}\n${detail}`;
        messages.push({ role: 'tool', content: lastToolResult });
        if (!success && shouldStopAfterFailure(call.function.name, args)) {
          return {
            messages,
            finalText: `Stopped because ${call.function.name} failed twice with identical input and no workspace change. The repeated action was not applied.`,
            completed: false,
          };
        }
        if (call.function.name === 'run_command' && success) {
          successfulCommands.set(`${workspaceRevision}:${String(args.command || '').trim()}`, `${summary}\n${detail}`);
        } else if (success && (
          call.function.name === 'write_file' ||
          call.function.name === 'edit_file' ||
          call.function.name === 'delete_file' ||
          call.function.name === 'delete_directory'
        )) {
          workspaceRevision += 1;
          duplicateCommandAttempts = 0;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed';
        onStep({ id: stepId, tool: call.function.name, args, status: 'error', summary: message });
        messages.push({ role: 'tool', content: `Error running ${call.function.name}: ${message}` });
        if (shouldStopAfterFailure(call.function.name, args)) {
          return {
            messages,
            finalText: `Stopped because ${call.function.name} failed twice with identical input and no workspace change. The repeated action was not applied.`,
            completed: false,
          };
        }
      }
    }
  }

  return {
    messages,
    finalText: `Stopped after ${MAX_ITERATIONS} steps to avoid a runaway loop. Review progress and send a follow-up message to continue.`,
    completed: false,
  };
}

export async function revertPendingChanges(rootPath: string, pendingChanges: Map<string, PendingFileChange>): Promise<void> {
  for (const [relPath, change] of pendingChanges) {
    const full = resolvePath(rootPath, relPath);
    try {
      if (change.type === 'create') {
        await window.fileSystem!.deleteFile(full);
      } else if (change.originalContent !== null) {
        // Restores edited files, and recreates files the agent deleted.
        await window.fileSystem!.writeFile(full, change.originalContent);
      }
    } catch {
      // best-effort revert; skip files that no longer make sense to touch
    }
  }
  pendingChanges.clear();
}

export function resolveWorkspacePath(rootPath: string, relativePath: string): string {
  return resolvePath(rootPath, relativePath);
}
