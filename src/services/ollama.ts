const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

interface OllamaHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

async function requestOllama(
  endpoint: string,
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; signal?: AbortSignal } = {}
): Promise<OllamaHttpResponse> {
  if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');

  if (window.ollama?.request) {
    const response = await window.ollama.request({
      endpoint,
      method: options.method,
      body: options.body,
    });
    if (options.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
    return response;
  }

  const response = await fetch(`${getOllamaBaseUrl()}${endpoint}`, {
    method: options.method || 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
    signal: options.signal,
  });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: await response.text(),
  };
}

function parseJson<T>(response: OllamaHttpResponse): T {
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error('Ollama returned an invalid JSON response');
  }
}

export function getOllamaBaseUrl(): string {
  return localStorage.getItem('ollama_host_url') || DEFAULT_OLLAMA_URL;
}

export function setOllamaBaseUrl(url: string): void {
  let cleanUrl = url.trim().replace(/\/+$/, '');
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `http://${cleanUrl}`;
  }
  localStorage.setItem('ollama_host_url', cleanUrl);
}

const DEVELOPER_SYSTEM_PROMPT = `You are an expert AI coding assistant inside Onyx Code IDE. Your purpose is to assist developers by writing robust code, debugging issues, planning architectures, and executing terminal commands.

Context Awareness:
    - The user provides project context and file contents.
    - You have access to the file system to create and edit files.
    - Always use provided root paths or relative paths.
    - When asked to create or edit files, output the COMPLETE file content within a standard markdown code block.
    - The VERY FIRST LINE INSIDE the code block MUST be EXACTLY: "// FILE: path/to/file"
    - To execute a terminal command, output a bash code block with: "// COMMAND: command_to_execute" on the first line.`;

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
}

export interface PromptOptions {
  isPlanningMode?: boolean;
}

export async function testOllamaConnection(
  _customUrl?: string
): Promise<{ success: boolean; latencyMs: number; version?: string; error?: string }> {
  const startTime = performance.now();
  try {
    const res = await requestOllama('/api/version');
    const latencyMs = Math.round(performance.now() - startTime);
    if (res.ok) {
      const data = parseJson<{ version?: string }>(res);
      return { success: true, latencyMs, version: data.version || 'v0.x' };
    }
    // Fallback test on /api/tags
    const tagsRes = await requestOllama('/api/tags');
    const tagsLatency = Math.round(performance.now() - startTime);
    if (tagsRes.ok) {
      return { success: true, latencyMs: tagsLatency, version: 'Ollama Engine' };
    }
    return { success: false, latencyMs, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return { success: false, latencyMs, error: err.message || 'Connection refused' };
  }
}

export async function checkOllamaStatus(): Promise<boolean> {
  try {
    const res = await requestOllama('/api/tags');
    return res.ok;
  } catch {
    return false;
  }
}

export async function getLocalModels(): Promise<OllamaModelInfo[]> {
  try {
    const [tagsResponse, runningResponse] = await Promise.all([
      requestOllama('/api/tags'),
      requestOllama('/api/ps').catch(() => null),
    ]);
    if (!tagsResponse.ok) {
      throw new Error(`Failed to fetch models: ${tagsResponse.statusText}`);
    }
    const installed = parseJson<{ models?: OllamaModelInfo[] }>(tagsResponse).models || [];
    const running = runningResponse?.ok
      ? parseJson<{ models?: Array<Partial<OllamaModelInfo> & { model?: string }> }>(runningResponse).models || []
      : [];

    const models = new Map(installed.map((model) => [model.name, model]));
    for (const model of running) {
      const name = model.name || model.model;
      if (name && !models.has(name)) {
        models.set(name, {
          name,
          size: model.size || 0,
          modified_at: model.modified_at || new Date().toISOString(),
        });
      }
    }
    return [...models.values()];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}

export async function deleteOllamaModel(modelName: string): Promise<boolean> {
  try {
    const response = await requestOllama('/api/delete', {
      method: 'DELETE',
      body: { name: modelName },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pullOllamaModelStream(
  modelName: string,
  onProgress: (progress: { status: string; completed?: number; total?: number; percent?: number }) => void,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const response = await requestOllama('/api/pull', {
      method: 'POST',
      body: { name: modelName },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.statusText}`);
    }

    const lines = response.body.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const percent =
          parsed.total && parsed.completed
            ? Math.round((parsed.completed / parsed.total) * 100)
            : undefined;
        onProgress({
          status: parsed.status || 'Downloading...',
          completed: parsed.completed,
          total: parsed.total,
          percent,
        });
      } catch {
        // Ignore a malformed progress line while preserving the completed pull.
      }
    }
    return true;
  } catch (err: any) {
    onProgress({ status: `Error: ${err.message}` });
    return false;
  }
}

function buildPrompt(userPrompt: string, options: PromptOptions = {}) {
  const { isPlanningMode = false } = options;
  let finalPrompt = `${DEVELOPER_SYSTEM_PROMPT}`;

  if (isPlanningMode) {
    finalPrompt += `\n\nPLANNING MODE ACTIVE:\nDo not create, edit, or delete files and do not request terminal commands. Return a concise implementation plan with the goal, ordered steps, files likely involved, validation, and any decisions the user must make. Do not expose private chain-of-thought; provide only useful conclusions and rationale.`;
  }

  finalPrompt += `\n\nUser: ${userPrompt}\n\nAssistant:`;
  return finalPrompt;
}

async function readOllamaErrorMessage(response: OllamaHttpResponse): Promise<string> {
  try {
    const body = JSON.parse(response.body);
    if (body?.error) {
      return body.error;
    }
  } catch {
    // Response body wasn't JSON (or already consumed) - fall through to statusText.
  }
  return response.statusText || `HTTP ${response.status}`;
}

export async function generateResponse(
  prompt: string,
  model: string = 'gemma3:4b',
  options: PromptOptions = {}
): Promise<string> {
  const response = await requestOllama('/api/generate', {
    method: 'POST',
    body: {
      model: model,
      prompt: buildPrompt(prompt, options),
      stream: false,
    },
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${await readOllamaErrorMessage(response)}`);
  }

  const data = parseJson<{ response: string }>(response);
  return data.response;
}

export async function* generateResponseStream(
  prompt: string,
  model: string = 'gemma3:4b',
  options: PromptOptions = {},
  signal?: AbortSignal
): AsyncGenerator<string> {
  if (window.ollama?.startStream && window.ollama?.onStreamEvent) {
    const requestId = `generate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const chunks: string[] = [];
    let buffer = '';
    let finished = false;
    let streamError: Error | null = null;
    let wake: (() => void) | null = null;
    const notify = () => {
      const nextWake = wake;
      wake = null;
      nextWake?.();
    };
    const unsubscribe = window.ollama.onStreamEvent((event) => {
      if (event.requestId !== requestId) return;
      if (event.type === 'data' && event.chunk) chunks.push(event.chunk);
      if (event.type === 'error') {
        streamError = new Error(event.error || 'Ollama stream failed');
        finished = true;
      }
      if (event.type === 'end') finished = true;
      notify();
    });
    const abort = () => {
      window.ollama?.abortStream?.(requestId);
      streamError = new DOMException('Request aborted', 'AbortError');
      finished = true;
      notify();
    };
    signal?.addEventListener('abort', abort, { once: true });
    window.ollama.startStream({
      requestId,
      endpoint: '/api/generate',
      method: 'POST',
      body: { model, prompt: buildPrompt(prompt, options), stream: true },
    });

    try {
      while (!finished || chunks.length > 0) {
        if (chunks.length === 0) {
          await new Promise<void>((resolve) => { wake = resolve; });
          continue;
        }
        buffer += chunks.shift()!;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as OllamaResponse & { error?: string };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.response) yield parsed.response;
        }
      }
      if (buffer.trim()) {
        const parsed = JSON.parse(buffer) as OllamaResponse & { error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.response) yield parsed.response;
      }
      if (streamError) throw streamError;
    } finally {
      signal?.removeEventListener('abort', abort);
      unsubscribe();
      if (!finished) window.ollama.abortStream?.(requestId);
    }
    return;
  }

  const response = await requestOllama('/api/generate', {
    method: 'POST',
    body: {
      model: model,
      prompt: buildPrompt(prompt, options),
      stream: true,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${await readOllamaErrorMessage(response)}`);
  }

  const lines = response.body.split('\n').filter((line) => line.trim());
  for (const line of lines) {
    try {
      const parsed: OllamaResponse = JSON.parse(line);
      if (parsed.response) yield parsed.response;
    } catch {
      // Skip invalid JSON
    }
  }
}

// ---------------------------------------------------------------------------
// Autonomous Agent Mode: Tool-calling via Ollama /api/chat
// ---------------------------------------------------------------------------

export interface AgentToolCallFunction {
  name: string;
  arguments: Record<string, unknown> | string;
}

export interface AgentToolCall {
  id?: string;
  function: AgentToolCallFunction;
}

export interface AgentChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: AgentToolCall[];
}

export const AGENT_SYSTEM_PROMPT = `You are an autonomous coding agent working inside Onyx Code, a desktop IDE.

You have tools to read, search, edit, and create files in the user's project, and to run shell commands. All file paths you pass to tools MUST be relative to the workspace root (e.g. "src/App.tsx"), never absolute, never with a drive letter.

Workflow rules:
1. Before editing a file you have not seen in this conversation, use list_directory and/or read_file to understand it. Do not guess file contents or assume a file's structure.
2. Prefer edit_file for any file that already exists - it makes one precise, minimal replacement. Only use write_file for brand-new files or when a file genuinely needs a full rewrite. old_text in edit_file must match the file's current content exactly (including whitespace/indentation) and must be unique in the file - include enough surrounding lines to make it unique.
3. For multi-step tasks, call update_task_list early with your plan, then call it again to update item statuses ('pending' -> 'in_progress' -> 'done') as you progress.
4. Use run_command for installing packages, running builds/tests, or git operations. It runs in the workspace root.
5. Make ONE tool call at a time and wait for its result before deciding the next step. Do not call multiple tools in the same turn.
6. When the entire user request is fully done, call task_complete with a short summary. Do not call it early - only when nothing is left to do.
7. File writes, edits, deletions, and terminal commands require explicit user permission from Onyx Code. If permission is denied, do not repeat or disguise the same action; explain what remains blocked or choose a safe read-only alternative.
8. Never rerun an identical command after it succeeded unless a file or dependency changed and rerunning it is necessary to verify that new state. Treat a duplicate-command tool result as authoritative and move to the next distinct step or finish.

Be direct. Don't narrate steps in prose - let the tool calls do the work. Only write plain text when asking the user a clarifying question, or in your final task_complete summary.`;

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the full text content of a file in the workspace. Use this before editing a file you have not already seen.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the workspace root, e.g. src/App.tsx' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description:
        'List files and folders in the workspace (recursive, excludes node_modules/dist/.git/release). Use "." for the workspace root.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to workspace root, or "." for the root' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description:
        'Search the entire workspace for files whose contents contain the given text or code snippet. Returns matching file paths.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or code snippet to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Make a targeted edit to an EXISTING file by replacing one exact, unique block of text with new text. Prefer this over write_file for files that already exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to workspace root' },
          old_text: {
            type: 'string',
            description:
              'Exact existing text to find. Must be unique in the file - include surrounding context if needed.',
          },
          new_text: { type: 'string', description: 'Text to replace it with' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Create a new file with the given full content, or completely overwrite an existing file. Only use for new files or full rewrites - for small changes to existing files use edit_file instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to workspace root' },
          content: { type: 'string', description: 'Full file content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to workspace root' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        'Run a shell command in the workspace root directory (e.g. npm install <pkg>, npm run build, git status). Returns stdout and stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task_list',
      description:
        'Set or update the visible task list/plan shown to the user. Call at the start of a multi-step task, and again whenever item statuses change.',
      parameters: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'done'] },
              },
              required: ['text', 'status'],
            },
          },
        },
        required: ['tasks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_complete',
      description:
        'Call exactly once when the entire user request has been fully completed, to end the session. Provide a short summary of what was done.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Short summary of what was done' },
        },
        required: ['summary'],
      },
    },
  },
];

export async function chatWithTools(
  messages: AgentChatMessage[],
  model: string,
  signal?: AbortSignal
): Promise<AgentChatMessage> {
  let response = await requestOllama('/api/chat', {
    method: 'POST',
    body: {
      model,
      messages,
      tools: AGENT_TOOLS,
      stream: false,
      options: { temperature: 0.1 },
    },
    signal,
  });

  if (response.status === 400) {
    const fallbackMessages = [...messages];
    if (fallbackMessages[0]?.role === 'system') {
      fallbackMessages[0].content += `\n\nAVAILABLE TOOLS:\nYou must use tools by outputting raw JSON in this format: {"name": "tool_name", "arguments": {"arg1": "value"}}\n${JSON.stringify(
        AGENT_TOOLS,
        null,
        2
      )}`;
    }

    response = await requestOllama('/api/chat', {
      method: 'POST',
      body: {
        model,
        messages: fallbackMessages,
        stream: false,
        options: { temperature: 0.1 },
      },
      signal,
    });
  }

  if (!response.ok) {
    throw new Error(`Ollama error: ${await readOllamaErrorMessage(response)}`);
  }

  const data = parseJson<{ message: AgentChatMessage }>(response);
  return data.message as AgentChatMessage;
}
