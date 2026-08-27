import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import AIChatHeader from './AIChatHeader';
import AIComposer, { AgentApprovalMode } from './AIComposer';
import AIMessageList from './AIMessageList';
import { generateResponseStream, getLocalModels, OllamaModelInfo } from '../services/ollama';
import { ChatMessage, FileNode, OpenFile } from '../types';
import {
  runAgent,
  isSerializedAgentToolCall,
  AgentStep,
  TaskItem,
  PendingFileChange,
  revertPendingChanges,
  AgentPermissionDecision,
  AgentPermissionRequest,
} from '../services/agentLoop';
import AgentStepView, { getAgentActivityLabel } from './AgentStepView';
import PendingChangesBar from './PendingChangesBar';
import TaskListPanel from './TaskListPanel';
import AgentPermissionPrompt from './AgentPermissionPrompt';

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
  const [agentSummaryMessageId, setAgentSummaryMessageId] = useState<string | null>(null);
  const [agentElapsedSeconds, setAgentElapsedSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const agentStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading || agentStartedAtRef.current === null) return;

    const updateElapsed = () => {
      const startedAt = agentStartedAtRef.current;
      if (startedAt !== null) {
        setAgentElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }
    };

    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(interval);
  }, [isLoading]);

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
    agentStartedAtRef.current = Date.now();
    setAgentElapsedSeconds(0);
    setIsLoading(true);
    setAgentSummaryMessageId(null);
    if (isAgentMode) {
      setAgentSteps([]);
      setTaskList([]);
    }

    const targetsWorkspaceRoot = /\b(?:this|current|workspace|project)\s+(?:folder|directory|root)\b/i.test(nextInput);
    const rootFileNames = targetsWorkspaceRoot
      ? [...nextInput.matchAll(/(?:^|[\s"'`])([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)(?=$|[\s,.;:!?"'`])/g)]
          .map((match) => match[1])
      : [];
    const agentPathGuidance = targetsWorkspaceRoot
      ? '\nPATH REQUIREMENT: The user explicitly means the workspace root. Keep bare filenames at the root (for example, "index.html" must be exactly "index.html"). Do not reuse a directory from an earlier request and do not create a new directory unless the newest request names one.'
      : '';

    const fullPrompt = `${buildDeveloperContext()}\nUser Query: ${nextInput}${
      commandContext
        ? `\n\nThe previously requested command has already executed. Its exact result is below:\n${commandContext}\n\nDo not request the same command again if it succeeded. Continue with the next distinct step or give the final result.`
        : ''
    }${isAgentMode
      ? `${agentPathGuidance}\nUse the available agent tools for every file or command action. The newest User Query overrides conflicting older chat context. Do not output tool JSON or code blocks as a substitute for calling a tool.`
      : "\nCRITICAL: When writing code, you MUST use '// FILE: absolute_path' as the FIRST line inside EVERY code block for creating or editing files. Do not output this tag for regular conversational text. When you want to execute a command, use '// COMMAND: command' in a bash code block."
    }`;

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
          rootFileNames,
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
        const mappedMessages: ChatMessage[] = result.messages
          .filter((message) =>
            (message.role === 'user' || message.role === 'assistant') &&
            message.content.trim().length > 0 &&
            !isSerializedAgentToolCall(message.content)
          )
          .map((message, index) => ({
            role: message.role as ChatMessage['role'],
            content: message.role === 'user' && message.content === fullPrompt
              ? visibleInput
              : message.content,
            id: `agent-msg-${index}-${Date.now()}`,
          }));
        const finalText = result.finalText.trim();
        const alreadyIncludesFinal = mappedMessages.some(
          (message) => message.role === 'assistant' && message.content.trim() === finalText
        );
        if (finalText && !alreadyIncludesFinal) {
          const finalMessage = createMessage('assistant', finalText);
          mappedMessages.push(finalMessage);
          setAgentSummaryMessageId(finalMessage.id);
        } else if (finalText) {
          const finalMessage = mappedMessages.find(
            (message) => message.role === 'assistant' && message.content.trim() === finalText
          );
          setAgentSummaryMessageId(finalMessage?.id || null);
        }
        setMessages(mappedMessages);
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          appendMessage(createMessage('assistant', `Agent error: ${e.message}`));
        }
      } finally {
        if (agentStartedAtRef.current !== null) {
          setAgentElapsedSeconds(Math.max(0, Math.floor((Date.now() - agentStartedAtRef.current) / 1000)));
        }
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
      if (agentStartedAtRef.current !== null) {
        setAgentElapsedSeconds(Math.max(0, Math.floor((Date.now() - agentStartedAtRef.current) / 1000)));
      }
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
    setAgentSummaryMessageId(null);
    setAgentElapsedSeconds(0);
    agentStartedAtRef.current = null;
  };

  const currentAgentStep = [...agentSteps].reverse().find(
    (step) => step.status === 'running' || step.status === 'awaiting_permission'
  );
  const activityLabel = permissionRequest || currentAgentStep?.status === 'awaiting_permission'
    ? 'Waiting for approval'
    : currentAgentStep?.status === 'running'
    ? getAgentActivityLabel(currentAgentStep)
    : isPlanningMode
    ? 'Planning'
    : 'Thinking';
  const completedAgentSteps = agentSteps.filter(
    (step) => step.status === 'done' || step.status === 'error'
  );
  const agentSummaryMessage = agentSummaryMessageId
    ? messages.find((message) => message.id === agentSummaryMessageId)
    : undefined;
  const conversationMessages = agentSummaryMessage
    ? messages.filter((message) => message.id !== agentSummaryMessage.id)
    : messages;
  const formatElapsed = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  return (
    <div className="workbench-panel flex h-full w-full min-w-0 flex-col border-l border-[#252526] bg-[#18181b] font-sans">
      {/* Clean AI Header */}
      <AIChatHeader
        onClear={handleClear}
        onClose={onClose}
        isAgentMode={isAgentMode}
        onRefreshModels={loadModels}
      />

      {/* Message and Step View */}
      <div ref={scrollContainerRef} className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 py-5">
        <div className="flex flex-col gap-12">
          <AIMessageList
            messages={conversationMessages}
            isAgentMode={isAgentMode}
            copied={copied}
            activeFile={activeFile}
            rootPath={rootPath}
            onApply={handleApply}
            onCopy={handleCopy}
            onCommandResult={handleCommandResult}
          />

          {(isLoading || completedAgentSteps.length > 0 || agentSummaryMessage) && (
            <section className="space-y-6">
              {(isLoading || completedAgentSteps.length > 0) && (
                <details className="group" open={isLoading}>
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 border-b border-[#2b2b2b] pb-3 text-[11.5px] text-[#7f7f84] outline-none transition-colors hover:text-[#b5b5ba] [&::-webkit-details-marker]:hidden">
                    <span>{isLoading ? 'Working' : 'Worked'} for {formatElapsed(agentElapsedSeconds)}</span>
                    <ChevronRight size={13} className="transition-transform duration-150 group-open:rotate-90" />
                  </summary>
                  <div className="space-y-3 pt-3">
                    <TaskListPanel tasks={taskList} />
                    {completedAgentSteps.length > 0 && (
                      <div className="space-y-0.5">
                        {completedAgentSteps.map((step) => (
                          <AgentStepView key={step.id} step={step} />
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )}

              {agentSummaryMessage && (
                <AIMessageList
                  messages={[agentSummaryMessage]}
                  isAgentMode
                  copied={copied}
                  activeFile={activeFile}
                  rootPath={rootPath}
                  onApply={handleApply}
                  onCopy={handleCopy}
                  onCommandResult={handleCommandResult}
                />
              )}

              {isLoading && (
                <div
                  className="min-h-8 pt-1 text-xs"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="agent-status-shimmer font-medium">{activityLabel}</span>
                </div>
              )}
            </section>
          )}

          <PendingChangesBar
            changes={pendingChanges}
            onAcceptAll={() => setPendingChanges(new Map())}
            onRejectAll={() => {
              revertPendingChanges(rootPath || '', pendingChanges).then(() => {
                setPendingChanges(new Map());
              });
            }}
          />
        </div>

        <div ref={messagesEndRef} />
      </div>

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
