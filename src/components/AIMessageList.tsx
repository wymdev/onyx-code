import { Fragment } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { isSerializedAgentToolCall } from '../services/agentLoop';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import {
  BrainCircuit,
  Check,
  Copy,
  FilePlus,
  Play,
  Terminal,
  Trash2,
} from 'lucide-react';
import { ChatMessage, OpenFile } from '../types';

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  '': 'text',
};

SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('rust', rust);
SyntaxHighlighter.registerLanguage('go', go);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('markup', markup);
SyntaxHighlighter.registerLanguage('yaml', yaml);

const REGISTERED_LANGUAGES = new Set([
  'cpp',
  'python',
  'typescript',
  'javascript',
  'jsx',
  'tsx',
  'bash',
  'rust',
  'go',
  'java',
  'json',
  'css',
  'markup',
  'yaml',
]);

function resolveHighlightLanguage(language: string): string | null {
  const normalized = LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase();
  return REGISTERED_LANGUAGES.has(normalized) ? normalized : null;
}

interface GeneratedFile {
  path: string;
  content: string;
}

interface FenceInfo {
  language: string;
  code: string;
  targetPath: string | null;
  commandToRun: string | null;
  deletePath: string | null;
  /** Offset of this fence's opening ``` within the source string, used to match
   *  this metadata up with react-markdown's AST node for the same fence (see
   *  the `pre` renderer below) without relying on render-order side effects. */
  startOffset: number;
}

/**
 * Single source of truth for parsing ``` fences out of a chat message: both the
 * inline renderer (to attach Apply/Run/Copy chrome) and getGeneratedFiles (for the
 * "Apply All" button) read from this instead of re-deriving markers independently.
 */
function extractFences(content: string): FenceInfo[] {
  const parts = content.split(/(```[\s\S]*?(?:```|$))/g);
  const fences: FenceInfo[] = [];
  let offset = 0;

  parts.forEach((part, index) => {
    const partStart = offset;
    offset += part.length;

    if (!part.startsWith('```')) {
      return;
    }

    const language = part.match(/```(\w*)/)?.[1] || '';
    const codeContent = part.replace(/```\w*\r?\n?/, '').replace(/```$/, '');

    let fileMarkerMatch = codeContent.match(/^\/\/ FILE: (.+)(\r?\n|$)/);
    let commandMarkerMatch = codeContent.match(/^\/\/ COMMAND: (.+)(\r?\n|$)/);
    const deleteMarkerMatch = codeContent.match(/^DELETE: (.+)(\r?\n|$)/);

    if (!fileMarkerMatch && !commandMarkerMatch && !deleteMarkerMatch && index > 0) {
      const prevPart = parts[index - 1];
      const fileMatches = [...prevPart.matchAll(/\/\/ FILE: ([^\n]+)/g)];
      const commandMatches = [...prevPart.matchAll(/\/\/ COMMAND: ([^\n]+)/g)];

      if (fileMatches.length > 0) {
        const lastMatch = fileMatches[fileMatches.length - 1];
        fileMarkerMatch = [lastMatch[0], lastMatch[1]] as unknown as RegExpMatchArray;
      } else if (commandMatches.length > 0) {
        const lastMatch = commandMatches[commandMatches.length - 1];
        commandMarkerMatch = [lastMatch[0], lastMatch[1]] as unknown as RegExpMatchArray;
      }
    }

    fences.push({
      language,
      code: codeContent,
      targetPath: fileMarkerMatch ? fileMarkerMatch[1].trim().replace(/[.:]$/, '') : null,
      commandToRun: commandMarkerMatch ? commandMarkerMatch[1].trim() : null,
      deletePath: deleteMarkerMatch ? deleteMarkerMatch[1].trim() : null,
      startOffset: partStart,
    });
  });

  return fences;
}

interface AIMessageListProps {
  messages: ChatMessage[];
  isAgentMode?: boolean;
  copied: string | null;
  activeFile?: OpenFile;
  rootPath?: string | null;
  onApply: (path: string, content: string) => Promise<void> | void;
  onCopy: (text: string, id: string) => void;
  onCommandResult: (command: string, stdout: string, stderr: string) => void;
}

function normalizeGeneratedPath(targetPath: string, activeFile?: OpenFile, rootPath?: string | null) {
  if (/^[a-zA-Z]:[/\\]/.test(targetPath) || targetPath.startsWith('/')) {
    return targetPath;
  }

  if (rootPath) {
    return `${rootPath.replace(/[/\\]$/, '')}/${targetPath.replace(/^[/\\]+/, '')}`;
  }

  if (activeFile?.path) {
    return activeFile.path.replace(/[\\/][^\\/]+$/, `/${targetPath.replace(/^[/\\]+/, '')}`);
  }

  return targetPath;
}

const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="whitespace-pre-wrap break-words leading-[1.65] text-[#d4d4d8] [&:not(:first-child)]:mt-2.5">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-[#e4e4e7]">{children}</em>,
  a: ({ href, children }: any) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) window.electronAPI?.openExternalLink(href);
      }}
      className="text-[#38bdf8] underline underline-offset-2 hover:text-[#7dd3fc] cursor-pointer"
    >
      {children}
    </a>
  ),
  ul: ({ children }: any) => <ul className="my-2 list-disc space-y-1.5 pl-5 text-[#d4d4d8] marker:text-[#71717a]">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-2 list-decimal space-y-1.5 pl-5 text-[#d4d4d8] marker:text-[#71717a]">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }: any) => <h1 className="mb-2 mt-4 text-base font-semibold tracking-tight text-white first:mt-0">{children}</h1>,
  h2: ({ children }: any) => <h2 className="mb-1.5 mt-4 text-[13px] font-semibold tracking-tight text-white first:mt-0">{children}</h2>,
  h3: ({ children }: any) => <h3 className="mb-1 mt-3 text-[12.5px] font-semibold text-[#f4f4f5] first:mt-0">{children}</h3>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-[#3f3f46] pl-3 text-[#a1a1aa] italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-[#27272a]" />,
  table: ({ children }: any) => (
    <div className="overflow-x-auto rounded border border-[#27272a]">
      <table className="w-full border-collapse text-left text-[11.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-[#18181f] text-[#a1a1aa]">{children}</thead>,
  tbody: ({ children }: any) => <tbody className="divide-y divide-[#27272a]">{children}</tbody>,
  tr: ({ children }: any) => <tr>{children}</tr>,
  th: ({ children }: any) => <th className="px-2.5 py-1.5 font-semibold">{children}</th>,
  td: ({ children }: any) => <td className="px-2.5 py-1.5 text-[#d4d4d8]">{children}</td>,
  code: ({ className, children }: any) => (
    <code className={`rounded bg-[#27272a] px-1 py-0.5 text-[11px] font-mono text-[#e4e4e7] ${className ?? ''}`}>
      {children}
    </code>
  ),
};

export default function AIMessageList({
  messages,
  isAgentMode = false,
  copied,
  activeFile,
  rootPath,
  onApply,
  onCopy,
  onCommandResult,
}: AIMessageListProps) {
  const formatMessage = (content: string, messageId: string) => {
    const thoughtRegex = /<thought>([\s\S]*?)(?:<\/thought>|(?=```)|$)/;
    const thoughtMatch = content.match(thoughtRegex);
    let thoughtContent = '';
    let cleanContent = content;
    const isThinking =
      content.includes('<thought>') &&
      !content.includes('</thought>') &&
      !content.includes('```');

    if (thoughtMatch) {
      thoughtContent = thoughtMatch[1].trim();
      cleanContent = content.replace(thoughtRegex, '').trim();
    }

    const fences = extractFences(cleanContent);

    // Pure lookup (no mutable render-order counter): matches a rendered fence
    // back to its parsed metadata by source position. This has to be pure
    // because React 18 (StrictMode, concurrent rendering) may invoke a given
    // component render more than once for the same node - a shared "next
    // index" counter would desync across those extra invocations.
    const findFence = (offset: number | undefined, language: string, code: string): FenceInfo => {
      if (typeof offset === 'number') {
        let best: FenceInfo | null = null;
        for (const candidate of fences) {
          if (candidate.startOffset <= offset && (!best || candidate.startOffset > best.startOffset)) {
            best = candidate;
          }
        }
        if (best) return best;
      }
      return { language, code, targetPath: null, commandToRun: null, deletePath: null, startOffset: -1 };
    };

    const renderFenceBlock = (fence: FenceInfo, code: string) => {
      const blockId = `${messageId}-${fence.startOffset}`;

      if (fence.deletePath) {
        const deleteName = fence.deletePath.split(/[\\/]/).pop() || fence.deletePath;
        return (
          <div className="my-2 flex items-center justify-between rounded border border-red-800/40 bg-red-950/20 p-2.5 text-xs">
            <span className="text-red-300">
              Delete <strong>{deleteName}</strong>?
            </span>
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete ${deleteName}?`)) {
                  await window.fileSystem?.deleteFile(fence.deletePath!);
                  alert(`Deleted ${fence.deletePath}`);
                }
              }}
              className="flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-500"
            >
              <Trash2 size={11} />
              Confirm Delete
            </button>
          </div>
        );
      }

      const targetPath = fence.targetPath;
      const displayPath = targetPath ? targetPath.split(/[\\/]/).pop() || targetPath : '';
      const commandToRun = fence.commandToRun;
      const highlightLang = resolveHighlightLanguage(fence.language);

      return (
        <div className="my-2.5 overflow-hidden rounded border border-[#27272a] bg-[#121216] text-xs shadow-sm">
          <div className="flex h-7 items-center justify-between border-b border-[#27272a] bg-[#18181f] px-2.5 text-[11px] text-[#858585] select-none">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-semibold uppercase tracking-wider text-[#71717a]">
                {fence.language || 'code'}
              </span>
              {targetPath ? (
                <span className="max-w-[220px] truncate text-[#38bdf8] font-sans" title={targetPath}>
                  {displayPath}
                </span>
              ) : commandToRun ? (
                <span
                  className="flex items-center gap-1 max-w-[220px] truncate text-[#facc15] font-sans"
                  title={commandToRun}
                >
                  <Terminal size={11} /> Terminal
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              {targetPath && (
                <button
                  onClick={() => onApply(targetPath, code)}
                  className="flex items-center gap-1 rounded bg-[#007acc] px-2 py-0.5 text-[10.5px] font-sans font-medium text-white hover:bg-[#0062a3] transition-colors"
                  title={`Apply to ${targetPath}`}
                >
                  <FilePlus size={11} />
                  <span>Apply</span>
                </button>
              )}

              {commandToRun && (
                <button
                  onClick={async () => {
                    try {
                      const result = await window.runtime?.runTerminalCommand(commandToRun);
                      if (result) {
                        onCommandResult(commandToRun, result.stdout, result.stderr);
                      }
                    } catch (error) {
                      onCommandResult(
                        commandToRun,
                        '',
                        error instanceof Error ? error.message : 'Failed to execute command'
                      );
                    }
                  }}
                  className="flex items-center gap-1 rounded bg-[#007acc] px-2 py-0.5 text-[10.5px] font-sans font-medium text-white hover:bg-[#0062a3] transition-colors"
                  title={`Run: ${commandToRun}`}
                >
                  <Play size={10} fill="currentColor" />
                  <span>Run Command</span>
                </button>
              )}

              <button
                onClick={() => onCopy(code, blockId)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-sans text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-colors"
              >
                {copied === blockId ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {highlightLang ? (
            <SyntaxHighlighter
              language={highlightLang}
              style={vscDarkPlus}
              customStyle={{ margin: 0, padding: '0.75rem', background: 'transparent', fontSize: '11.5px' }}
              codeTagProps={{ style: { fontFamily: 'inherit' } }}
            >
              {code.replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <pre className="overflow-x-auto p-3 text-[11.5px] leading-relaxed text-[#e4e4e7]">
              <code>{code}</code>
            </pre>
          )}
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-2">
        {thoughtContent && (
          <details
            open={isThinking}
            className="group cursor-pointer overflow-hidden rounded border border-[#27272a] bg-[#18181f] transition-all"
          >
            <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-[#a1a1aa] hover:text-white outline-none">
              <BrainCircuit
                size={13}
                className="text-[#38bdf8]"
              />
              {isThinking ? (
                <span className="agent-status-shimmer">Thinking</span>
              ) : (
                <span>Reasoning Steps</span>
              )}
            </summary>
            <div className="max-h-[300px] overflow-y-auto border-t border-[#27272a] bg-[#121216] p-3 text-[11px] font-mono leading-relaxed text-[#a1a1aa] whitespace-pre-wrap">
              {thoughtContent}
            </div>
          </details>
        )}
        <div className="space-y-1.5 text-[12.5px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              ...MARKDOWN_COMPONENTS,
              pre: ({ node, children }: any) => {
                const codeEl = Array.isArray(children) ? children[0] : children;
                const codeClassName: string = codeEl?.props?.className || '';
                const language = /language-(\w+)/.exec(codeClassName)?.[1] || '';
                const rawCode = String(codeEl?.props?.children ?? '').replace(/\n$/, '');
                const fence = findFence(node?.position?.start?.offset, language, rawCode);
                return <Fragment>{renderFenceBlock(fence, rawCode)}</Fragment>;
              },
            }}
          >
            {cleanContent}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  const getGeneratedFiles = (message: ChatMessage): GeneratedFile[] => {
    const fences = extractFences(message.content);
    const generatedFiles: GeneratedFile[] = [];

    fences.forEach((fence) => {
      let targetPath = fence.targetPath;
      if (!targetPath && !fence.commandToRun && !fence.deletePath && activeFile) {
        targetPath = activeFile.path;
      }

      if (targetPath) {
        generatedFiles.push({
          path: normalizeGeneratedPath(targetPath, activeFile, rootPath),
          content: fence.code,
        });
      }
    });

    return generatedFiles;
  };

  return (
    <div className="space-y-12 bg-transparent font-sans">
      {messages
        .filter((m) =>
          m.role === 'user' || (
            m.role === 'assistant' &&
            m.content.trim().length > 0 &&
            (!isAgentMode || !isSerializedAgentToolCall(m.content))
          )
        )
        .map((message) => {
          const generatedFiles = getGeneratedFiles(message);
          const isUser = message.role === 'user';

          return (
            <div
              key={message.id}
              className={isUser ? 'flex w-full justify-end' : 'w-full'}
            >
              <div
                className={`min-w-0 ${
                  isUser
                    ? 'w-fit max-w-[82%] rounded-2xl bg-[#242424] px-4 py-3 text-[12.5px] leading-relaxed text-[#e4e4e7]'
                    : 'w-full text-[12.5px] leading-relaxed text-[#d4d4d8]'
                }`}
              >
                {formatMessage(message.content, message.id)}

                {generatedFiles.length > 1 && (
                  <div className="flex justify-end pt-3">
                    <button
                      onClick={async () => {
                        for (const file of generatedFiles) {
                          await onApply(file.path, file.content);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded bg-[#007acc] px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-[#0062a3] transition-colors"
                    >
                      <FilePlus size={13} />
                      <span>Apply All {generatedFiles.length} Files</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
