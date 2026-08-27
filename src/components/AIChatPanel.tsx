import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import AIChatHeader from './AIChatHeader';
import AIComposer, { AgentApprovalMode } from './AIComposer';
import AIMessageList from './AIMessageList';
import { generateResponseStream, getLocalModels, OllamaModelInfo } from '../services/ollama';
import { ChatMessage, FileNode, OpenFile } from '../types';
import {
  runAgent,
  AgentStep,
  TaskItem,
  PendingFileChange,
  revertPendingChanges,
  AgentPermissionDecision,
  AgentPermissionRequest,
} from '../services/agentLoop';
import AgentStepView from './AgentStepView';
import PendingChangesBar from './PendingChangesBar';
import TaskListPanel from './TaskListPanel';
import AgentPermissionPrompt from './AgentPermissionPrompt';
import { Loader2 } from 'lucide-react';

interface AIChatPanelProps {
  onClose: () => void;
  onApplyCode: (path: string, content: string) => Promise<void> | void;
  onLivePreview: (path: string, content: string) => void;
  rootPath: string | null;
  fileTree: FileNode[];
  activeFile?: OpenFile;
  isWorkspaceTrusted: boolean;
  onRequestWorkspaceTrust: () => Promise<boolean>;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'assistant-welcome',
    role: 'assistant',
    content:
      "Hello! I am your **Onyx Code AI Assistant**, running locally and offline via **Ollama**.\n\nKey capabilities:\n- **Fast Chat**: Write, explain, and refactor code in C++, Python, TypeScript, and Rust\n- **Plan Mode**: Structured architecture reasoning before generating code\n- **Autonomous Agent**: Edit files, inspect directory trees, run build commands, and review diffs",
  },
];

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

function previewLatestGeneratedFile(content: string, onLivePreview: (path: string, code: string) => void) {
  const regexMatches = [...content.matchAll(/```[\s\S]*?(?:\/\/ FILE: ([^\n]+)\n)([\s\S]*?)(?:```|$)/g)];
  if (regexMatches.length === 0) {
    return;
  }

  const lastMatch = regexMatches[regexMatches.length - 1];
  const targetPath = lastMatch[1].trim().replace(/[.:]$/, '');
  const codeContent = lastMatch[2];
  onLivePreview(targetPath, codeContent);
}

export default function AIChatPanel({
  onClose,
  onApplyCode,
  onLivePreview,
  rootPath,
  fileTree,
  activeFile,
  isWorkspaceTrusted,
  onRequestWorkspaceTrust,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('onyx_selected_model') || 'qwen2.5-coder:7b');
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [approvalMode, setApprovalMode] = useState<AgentApprovalMode>(() => {
    const saved = localStorage.getItem('onyx_agent_approval_mode');
    return saved === 'auto_safe' || saved === 'full' ? saved : 'ask';
  });
  const [permissionRequest, setPermissionRequest] = useState<AgentPermissionRequest | null>(null);
  const permissionResolver = useRef<((decision: AgentPermissionDecision) => void) | null>(null);
  const sessionApprovals = useRef(new Set<string>());

  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [taskList, setTaskList] = useState<TaskItem[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingFileChange>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const frame = requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isLoading ? 'auto' : 'smooth',
      });
      messagesEndRef.current?.scrollIntoView({ block: 'end' });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, agentSteps, taskList, pendingChanges, isLoading]);

  const loadModels = async () => {
    const localModels = await getLocalModels();
    setModels(localModels);
    if (localModels.length > 0 && !localModels.some((m) => m.name === selectedModel)) {
      setSelectedModel(localModels[0].name);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    if (!isWorkspaceTrusted) {
      setIsAgentMode(false);
      return;
    }
    // A trusted workspace opens ready for autonomous work. The user can still
    // switch to Plan or plain chat; those choices remain mutually exclusive.
    setIsAgentMode(true);
    setIsPlanningMode(false);
  }, [isWorkspaceTrusted]);

  const buildDeveloperContext = () => {
    let context = '';
    if (rootPath) {
      context += `\nCurrent Workspace: ${rootPath}\n`;
    }
    if (activeFile) {
      context += `\nCurrently Active File: ${activeFile.name} (${activeFile.path})\n`;
      const maxFileContext = 32000;
      const fileContent = activeFile.content.length > maxFileContext
        ? `${activeFile.content.slice(0, 24000)}\n\n... [middle omitted to keep local-model context responsive] ...\n\n${activeFile.content.slice(-8000)}`
        : activeFile.content;
      context += `File Content:\n\`\`\`${activeFile.language}\n${fileContent}\n\`\`\`\n`;
    }

    if (fileTree.length > 0) {
      const flattenTree = (nodes: FileNode[], depth = 0): string => {
        let result = '';
        for (const node of nodes) {
          result += `${'  '.repeat(depth)}- ${node.name} (${node.type})\n`;
          if (node.children) {
            result += flattenTree(node.children, depth + 1);
          }
        }
        return result;
      };
      context += `\nProject Structure:\n${flattenTree(fileTree)}\n`;
    }

    return context;
  };

  const handleApply = async (path: string, content: string) => {
    let fullPath = path;
    if (rootPath && !path.startsWith('/') && !path.match(/^[a-zA-Z]:[/\\]/)) {
      const cleanPath = path.replace(/^[/\\]+/, '');
      fullPath = `${rootPath.replace(/[/\\]$/, '')}/${cleanPath}`;
    }
    await onApplyCode(fullPath, content);
  };

  const appendMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message]);
  };

  const requestAgentPermission = (request: AgentPermissionRequest): Promise<AgentPermissionDecision> => {
    if (!isWorkspaceTrusted) return Promise.resolve('deny');
    if (approvalMode === 'full') return Promise.resolve('allow_session');
    if (approvalMode === 'auto_safe' && request.scope === 'workspace_write') {
      return Promise.resolve('allow_session');
    }
    if (sessionApprovals.current.has(request.scope)) return Promise.resolve('allow_session');
    return new Promise((resolve) => {
      permissionResolver.current = resolve;
      setPermissionRequest(request);
    });
  };

  const decidePermission = (decision: AgentPermissionDecision) => {
    if (decision === 'allow_session' && permissionRequest) {
      sessionApprovals.current.add(permissionRequest.scope);
    }
    permissionResolver.current?.(decision);
    permissionResolver.current = null;
    setPermissionRequest(null);
  };

  const changeApprovalMode = (mode: AgentApprovalMode) => {
    setApprovalMode(mode);
    localStorage.setItem('onyx_agent_approval_mode', mode);
    sessionApprovals.current.clear();
  };

  const updateMessageContent = (messageId: string, updater: (current: string) => string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content: updater(message.content) } : message
      )
    );
  };

  const handleSubmit = async (presetInput?: string, commandContext?: string) => {
    const nextInput = (presetInput ?? input).trim();
    if (!nextInput || isLoading) {
      return;
    }

    if (models.length === 0) {
      appendMessage(createMessage('user', nextInput));
      setInput('');
      appendMessage(
        createMessage(
          'assistant',
          'No local Ollama models are installed, so there\'s nothing to send this to. Pull one from the Extensions view or the Ollama status bar entry, then try again.'
        )
      );
      return;
    }

    const visibleInput = commandContext
      ? 'Command completed. Analyze its output and continue with the next necessary step.'
      : nextInput;
    const userMessage = createMessage('user', visibleInput);
    appendMessage(userMessage);
    setInput('');
    setIsLoading(true);

    const fullPrompt = `${buildDeveloperContext()}\nUser Query: ${nextInput}${
      commandContext
        ? `\n\nThe previously requested command has already executed. Its exact result is below:\n${commandContext}\n\nDo not request the same command again if it succeeded. Continue with the next distinct step or give the final result.`
        : ''
    }\nCRITICAL: When writing code, you MUST use '// FILE: absolute_path' as the FIRST line inside EVERY code block for creating or editing files. Do not output this tag for regular conversational text. When you want to execute a command, use '// COMMAND: command' in a bash code block.`;

    const controller = new AbortController();
    setAbortController(controller);

    if (isAgentMode) {
      try {
        const result = await runAgent({
          messages: [...messages, { role: 'user', content: fullPrompt }],
          model: selectedModel,
          rootPath: rootPath || '',
          signal: controller.signal,
          pendingChanges,
          onStep: (step) => {
            setAgentSteps((current) => {
              const existingIndex = current.findIndex((s) => s.id === step.id);
              if (existingIndex >= 0) {
                const newSteps = [...current];
                newSteps[existingIndex] = step;
                return newSteps;
              }
              return [...current, step];
            });
            setPendingChanges(new Map(pendingChanges));
          },
          onTaskList: (tasks) => setTaskList(tasks),
          onPermissionRequest: requestAgentPermission,
        });
        const mappedMessages: ChatMessage[] = result.messages.map((m: any, i: number) => ({
          ...m,
          content: m.role === 'user' && m.content === fullPrompt ? visibleInput : m.content,
          id: m.id || `agent-msg-${i}-${Date.now()}`,
        }));
        setMessages(mappedMessages);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          appendMessage(createMessage('assistant', `Agent error: ${e.message}`));
        }
      } finally {
        setIsLoading(false);
        setAbortController(null);
      }
      return;
    }

    try {
      const assistantMessage = createMessage('assistant', '');
      appendMessage(assistantMessage);

      const stream = generateResponseStream(
        fullPrompt,
        selectedModel,
        {
          isPlanningMode,
        },
        controller.signal
      );

      for await (const chunk of stream) {
        updateMessageContent(assistantMessage.id, (currentContent) => {
          const updatedContent = currentContent + chunk;
          previewLatestGeneratedFile(updatedContent, (rawPath, codeContent) => {
            let fullPath = rawPath;
            if (rootPath && !rawPath.startsWith('/') && !rawPath.match(/^[a-zA-Z]:[/\\]/)) {
              const cleanPath = rawPath.replace(/^[/\\]+/, '');
              fullPath = `${rootPath.replace(/[/\\]$/, '')}/${cleanPath}`;
            }

            onLivePreview(fullPath, codeContent);
          });

          return updatedContent;
        });
      }
    } catch (error: unknown) {
      const nextError = error as { name?: string; message?: string };
      if (nextError.name === 'AbortError') {
        return;
      }

      const message = nextError.message || 'Unknown error';
      // "Failed to fetch" is what the browser throws when the request never
      // reached anything (server down/wrong host) - anything else is a real
      // response from Ollama (bad model name, malformed request, etc.) and
      // showing "can't connect" for that would send users chasing the wrong fix.
      const looksLikeNoConnection = /failed to fetch|networkerror|econnrefused/i.test(message);

      appendMessage(
        createMessage(
          'assistant',
          looksLikeNoConnection
            ? 'Could not connect to Ollama. Make sure Ollama is running locally:\n\n```bash\nollama serve\nollama pull gemma3:4b\n```'
            : `Ollama request failed: ${message}\n\nIf this mentions a missing model, pull it or pick an installed one from the model dropdown above and try again.`
        )
      );
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCommandResult = (command: string, stdout: string, stderr: string) => {
    let responseText = `Executed command:\n\`\`\`text\n${command}\n\`\`\`\n`;
    if (stdout.trim()) {
      responseText += `Command stdout:\n\`\`\`text\n${stdout}\n\`\`\`\n`;
    }
    if (stderr.trim()) {
      responseText += `Command stderr:\n\`\`\`text\n${stderr}\n\`\`\`\n`;
    }
    if (!responseText) {
      responseText = 'Command executed successfully with no output.';
    }

    handleSubmit('Analyze the completed command output and proceed with the next necessary step.', responseText);
  };

  const handleClear = () => {
    permissionResolver.current?.('deny');
    permissionResolver.current = null;
    setPermissionRequest(null);
    sessionApprovals.current.clear();
    setMessages(INITIAL_MESSAGES);
    setAgentSteps([]);
    setTaskList([]);
    setPendingChanges(new Map());
  };

  const currentAgentStep = [...agentSteps].reverse().find(
    (step) => step.status === 'running' || step.status === 'awaiting_permission'
  );
  const activityLabel = permissionRequest || currentAgentStep?.status === 'awaiting_permission'
    ? 'Waiting for approval'
    : currentAgentStep?.status === 'running'
    ? `Running ${currentAgentStep.tool.replace(/_/g, ' ')}`
    : isPlanningMode
    ? 'Planning'
    : isAgentMode
    ? 'Agent is thinking'
    : 'Thinking';

  return (
    <div className="flex h-full w-full min-w-0 flex-col border-l border-[#252526] bg-[#18181b] font-sans">
      {/* Clean AI Header */}
      <AIChatHeader
        onClear={handleClear}
        onClose={onClose}
        isAgentMode={isAgentMode}
        onRefreshModels={loadModels}
      />

      {/* Message and Step View */}
      <div ref={scrollContainerRef} className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-3 relative">
        <TaskListPanel tasks={taskList} />

        <AIMessageList
          messages={messages}
          copied={copied}
          activeFile={activeFile}
          rootPath={rootPath}
          onApply={handleApply}
          onCopy={handleCopy}
          onCommandResult={handleCommandResult}
        />

        {agentSteps.map((step) => (
          <AgentStepView key={step.id} step={step} />
        ))}

        {isLoading && (
          <div className="mb-3 flex items-center gap-2.5 pl-1 text-xs text-[#a8a8b0]" role="status" aria-live="polite">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-sky-400/20 bg-sky-400/10 text-sky-400">
              <Loader2 size={14} className="animate-spin" />
            </span>
            <span>{activityLabel}</span>
            <span className="flex items-end gap-1" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="h-1 w-1 animate-bounce rounded-full bg-sky-400"
                  style={{ animationDelay: `${index * 140}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Safety Pending Changes Bar */}
      <PendingChangesBar
        changes={pendingChanges}
        onAcceptAll={() => setPendingChanges(new Map())}
        onRejectAll={() => {
          revertPendingChanges(rootPath || '', pendingChanges).then(() => {
            setPendingChanges(new Map());
          });
        }}
      />

      {permissionRequest && (
        <AgentPermissionPrompt request={permissionRequest} onDecision={decidePermission} />
      )}

      {/* Modern Compact AI Composer */}
      <AIComposer
        input={input}
        isLoading={isLoading}
        isPlanningMode={isPlanningMode}
        models={models}
        selectedModel={selectedModel}
        isAgentMode={isAgentMode}
        onAgentModeChange={async (enabled) => {
          if (enabled && !isWorkspaceTrusted) {
            const trusted = await onRequestWorkspaceTrust();
            if (!trusted) return;
          }
          setIsAgentMode(enabled);
          if (enabled) setIsPlanningMode(false);
        }}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onTogglePlanningMode={() => {
          const enabled = !isPlanningMode;
          setIsPlanningMode(enabled);
          if (enabled) setIsAgentMode(false);
        }}
        onModelChange={(model) => {
          setSelectedModel(model);
          localStorage.setItem('onyx_selected_model', model);
        }}
        onStop={() => {
          permissionResolver.current?.('deny');
          permissionResolver.current = null;
          setPermissionRequest(null);
          abortController?.abort();
        }}
        approvalMode={approvalMode}
        onApprovalModeChange={changeApprovalMode}
        isWorkspaceTrusted={isWorkspaceTrusted}
      />
    </div>
  );
}
