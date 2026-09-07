import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Circle,
  Code2,
  Columns,
  FileCode,
  FileText,
  GitCompare,
  Play,
  Settings2,
  Cpu,
  X,
  Zap,
} from 'lucide-react';
import Editor, { DiffEditor, useMonaco } from '@monaco-editor/react';
import { DiagnosticItem, OpenFile } from '../types';
import { AppSettings, settingsService } from '../services/settingsService';
import { registerCppMonacoSnippets } from '../services/cppService';
import WelcomeTab from './WelcomeTab';
import InlineAIWidget from './InlineAIWidget';

interface EditorAreaProps {
  openFiles: OpenFile[];
  activeFileIndex: number;
  onFileSelect: (index: number) => void;
  onFileClose: (index: number) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  settings: AppSettings;
  isWelcomeOpen: boolean;
  onCloseWelcome: () => void;
  onSelectWelcome: () => void;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onOpenRecentFolder: (path: string) => void;
  onStartCppProject: (templateId?: string) => void;
  onStartPythonProject: () => void;
  onOpenAIWorkspace: () => void;
  onBuildCpp?: () => void;
  onRunCode?: () => void;
  onOpenCompilerConfig?: () => void;
  onToggleSplit?: () => void;
  isSplit?: boolean;
  diagnostics?: DiagnosticItem[];
  targetNavigation?: { filePath: string; line: number; column: number; timestamp: number } | null;
  selectedAiModel?: string;
}

export default function EditorArea({
  openFiles,
  activeFileIndex,
  onFileSelect,
  onFileClose,
  onContentChange,
  onSave,
  settings,
  isWelcomeOpen,
  onCloseWelcome,
  onSelectWelcome,
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFolder,
  onStartCppProject,
  onStartPythonProject,
  onOpenAIWorkspace,
  onBuildCpp,
  onRunCode,
  onOpenCompilerConfig,
  onToggleSplit,
  isSplit = false,
  diagnostics = [],
  targetNavigation,
  selectedAiModel,
}: EditorAreaProps) {
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  const activeFile = openFiles[activeFileIndex];
  const [showInlineAi, setShowInlineAi] = useState(false);
  const [inlineAiSelection, setInlineAiSelection] = useState<{ text: string; range: any } | null>(null);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        onBuildCpp?.();
      }
      if (event.key === 'F5') {
        event.preventDefault();
        onRunCode?.();
      }
    };

    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [onSave, onBuildCpp, onRunCode]);

  // Setup Monaco theme and C++ snippets
  useEffect(() => {
    if (monaco) {
      settingsService.defineMonacoThemes(monaco);
      settingsService.applyTheme(settings?.theme || 'dark', monaco);
      registerCppMonacoSnippets(monaco);
    }
  }, [monaco]);

  useEffect(() => {
    if (monaco && settings?.theme) {
      settingsService.applyTheme(settings.theme, monaco);
    }
  }, [monaco, settings?.theme]);

  // Update Monaco squiggly error markers from diagnostics
  useEffect(() => {
    if (!monaco || !editorRef.current || !activeFile || activeFile.isDiff) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    const normActive = activeFile.path.replace(/\\/g, '/').toLowerCase();
    const fileDiagnostics = diagnostics.filter((d) => {
      const normDiag = d.filePath.replace(/\\/g, '/').toLowerCase();
      return normDiag === normActive || normActive.endsWith(normDiag) || normDiag.endsWith(normActive);
    });

    const markers = fileDiagnostics.map((d) => ({
      severity:
        d.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : d.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
      message: d.message,
      startLineNumber: Math.max(1, d.line),
      startColumn: Math.max(1, d.column),
      endLineNumber: Math.max(1, d.line),
      endColumn: Math.max(1, d.column + 8),
      source: d.source || 'Compiler',
    }));

    monaco.editor.setModelMarkers(model, 'compiler-diagnostics', markers);
  }, [monaco, diagnostics, activeFile]);

  // Jump to specific problem line/col when user clicks in Problems panel
  useEffect(() => {
    if (!targetNavigation || !editorRef.current || !activeFile || activeFile.isDiff) return;
    const normTarget = targetNavigation.filePath.replace(/\\/g, '/').toLowerCase();
    const normActive = activeFile.path.replace(/\\/g, '/').toLowerCase();

    if (normTarget === normActive || normActive.endsWith(normTarget) || normTarget.endsWith(normActive)) {
      const { line, column } = targetNavigation;
      editorRef.current.revealPositionInCenter({ lineNumber: line, column });
      editorRef.current.setPosition({ lineNumber: line, column });
      editorRef.current.focus();
    }
  }, [targetNavigation, activeFile]);

  const handleAcceptInlineAi = (replacementCode: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = inlineAiSelection?.range || editor.getSelection();
    if (selection && !selection.isEmpty()) {
      editor.executeEdits('inline-ai', [{
        range: selection,
        text: replacementCode,
        forceMoveMarkers: true,
      }]);
    } else {
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits('inline-ai', [{
          range: new monaco.Range(position.lineNumber, 1, position.lineNumber, editor.getModel()?.getLineMaxColumn(position.lineNumber) || 1),
          text: replacementCode,
          forceMoveMarkers: true,
        }]);
      }
    }
    setShowInlineAi(false);
    setInlineAiSelection(null);
    onContentChange(editor.getValue());
  };

  const handleTabClick = (index: number) => {
    onFileSelect(index);
  };

  const handleTabClose = (event: React.MouseEvent, index: number) => {
    event.stopPropagation();
    onFileClose(index);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.includes('(Working Tree)') || fileName.startsWith('git-diff://')) {
      return <GitCompare size={13} className="text-amber-400 shrink-0" />;
    }
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'hpp':
      case 'h':
      case 'c':
        return <Zap size={13} className="text-[#007acc] shrink-0" />;
      case 'py':
        return <FileCode size={13} className="text-[#3572a5] shrink-0" />;
      case 'ts':
      case 'tsx':
        return <FileCode size={13} className="text-[#3178c6] shrink-0" />;
      case 'js':
      case 'jsx':
        return <FileCode size={13} className="text-[#f7df1e] shrink-0" />;
      case 'json':
        return <FileCode size={13} className="text-[#cbcb41] shrink-0" />;
      case 'html':
        return <FileCode size={13} className="text-[#e34f26] shrink-0" />;
      case 'css':
        return <FileCode size={13} className="text-[#563d7c] shrink-0" />;
      case 'md':
        return <FileText size={13} className="text-[#42a5f5] shrink-0" />;
      default:
        return <FileText size={13} className="text-[#858585] shrink-0" />;
    }
  };

  const getMonacoLanguage = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'hpp':
      case 'h':
      case 'c':
        return 'cpp';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      default:
        return 'plaintext';
    }
  };

  const getBreadcrumbs = (targetPath: string) =>
    targetPath.split(/[\\/]/).slice(Math.max(0, targetPath.split(/[\\/]/).length - 3));

  // Should we show Welcome tab?
  const showWelcome = isWelcomeOpen;
  const hasTabs = isWelcomeOpen || openFiles.length > 0;

  return (
    <div className="workbench-editor flex flex-1 flex-col overflow-hidden bg-[var(--editor-bg,#1e1e1e)] font-sans">
      {/* VS Code Tab Bar - strict 35px */}
      {hasTabs && (
        <div className="flex h-[35px] items-center justify-between border-b border-[var(--border-color,#252526)] bg-[var(--bg-secondary,#252526)] select-none">
          <div className="flex h-full items-center overflow-x-auto">
            {/* Welcome Tab (if open) */}
            {isWelcomeOpen && (
              <div
                className={`flex h-full items-center gap-2 px-3 border-r border-[var(--border-color,#1e1e1e)] text-xs cursor-pointer transition-colors ${
                  showWelcome
                    ? 'bg-[var(--editor-bg,#1e1e1e)] text-white border-t-2 border-t-[var(--accent-blue,#007acc)]'
                    : 'bg-[var(--bg-tertiary,#2d2d2d)] text-[#858585] hover:text-white'
                }`}
                onClick={onSelectWelcome}
              >
                <Code2 size={13} className="text-[#38bdf8]" />
                <span>Welcome</span>
                <button
                  className="rounded p-0.5 hover:bg-[#404040] text-[#858585] hover:text-white"
                  title="Close Welcome Tab (Ctrl+W)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseWelcome();
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Open Files Tabs */}
            {openFiles.map((file, index) => {
              const isTabActive = !isWelcomeOpen && index === activeFileIndex;
              return (
                <div
                  key={file.path}
                  className={`flex h-full items-center gap-2 px-3 border-r border-[var(--border-color,#1e1e1e)] text-xs cursor-pointer transition-colors ${
                    isTabActive
                      ? 'bg-[var(--editor-bg,#1e1e1e)] text-white border-t-2 border-t-[var(--accent-blue,#007acc)] font-medium'
                      : 'bg-[var(--bg-tertiary,#2d2d2d)] text-[#858585] hover:text-white'
                  }`}
                  onClick={() => handleTabClick(index)}
                >
                  {getFileIcon(file.name)}
                  <span className="truncate max-w-[140px]">{file.name}</span>
                  {file.isDirty && (
                    <Circle size={5} className="text-white fill-current opacity-80 shrink-0" />
                  )}
                  <button
                    className="rounded p-0.5 hover:bg-[#404040] text-[#858585] hover:text-white"
                    onClick={(event) => handleTabClose(event, index)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Tab Right Actions */}
          <div className="flex items-center gap-1 px-2 text-[#858585]">
            {activeFile && !activeFile.isDiff && (
              <button
                onClick={() => {
                  const editor = editorRef.current;
                  let text = '';
                  let selection = null;
                  if (editor) {
                    selection = editor.getSelection();
                    if (selection && !selection.isEmpty()) {
                      text = editor.getModel()?.getValueInRange(selection) || '';
                    }
                  }
                  setInlineAiSelection({ text, range: selection });
                  setShowInlineAi(true);
                }}
                className="flex h-6 items-center gap-1 px-1.5 rounded-sm hover:bg-[#333333] hover:text-sky-400 text-[#858585] transition-colors text-[11px]"
                title="Inline AI Composer (Ctrl+K)"
              >
                <Cpu size={13} className="text-sky-400" />
                <span className="hidden xl:inline text-[10px] font-medium">Ctrl+K</span>
              </button>
            )}
            {onBuildCpp && activeFile && (
              <button
                onClick={onBuildCpp}
                className="flex h-6 items-center gap-1 px-1.5 rounded-sm hover:bg-[#333333] hover:text-[#38bdf8] text-[#858585] transition-colors text-[11px]"
                title="Build / Compile File (Ctrl+Shift+B)"
              >
                <Zap size={13} className="text-[#38bdf8]" />
                <span className="hidden xl:inline text-[10px] font-medium">Build</span>
              </button>
            )}

            {onRunCode && activeFile && (
              <button
                onClick={onRunCode}
                className="flex h-6 items-center gap-1 px-1.5 rounded-sm hover:bg-[#333333] hover:text-emerald-400 text-[#858585] transition-colors text-[11px]"
                title="Run / Compile & Run (F5)"
              >
                <Play size={12} className="text-emerald-400 fill-current" />
                <span className="hidden xl:inline text-[10px] font-medium">Run</span>
              </button>
            )}

            {onOpenCompilerConfig && (
              <button
                onClick={onOpenCompilerConfig}
                className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#333333] hover:text-white transition-colors"
                title="Compiler & Build Settings"
              >
                <Settings2 size={13} />
              </button>
            )}

            <button
              onClick={onToggleSplit}
              className={`flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#333333] hover:text-white transition-colors ${
                isSplit ? 'text-[var(--accent-blue,#007acc)]' : 'text-[#858585]'
              }`}
              title="Split Editor Right"
            >
              <Columns size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      {showWelcome ? (
        <WelcomeTab
          onNewFile={onNewFile}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onOpenRecentFolder={onOpenRecentFolder}
          onStartCppProject={onStartCppProject}
          onStartPythonProject={onStartPythonProject}
          onOpenAIWorkspace={onOpenAIWorkspace}
        />
      ) : activeFile ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Breadcrumbs */}
          <div className="flex h-6 items-center px-3 text-[11px] text-[#858585] border-b border-[#252526] bg-[#1e1e1e] select-none">
            {getBreadcrumbs(activeFile.path).map((part, index, array) => (
              <span key={index} className="flex items-center">
                <span
                  className={
                    index === array.length - 1 ? 'text-[#cccccc] font-medium' : 'hover:text-[#cccccc]'
                  }
                >
                  {part}
                </span>
                {index < array.length - 1 && <ChevronRight size={11} className="mx-1 text-[#555555]" />}
              </span>
            ))}
          </div>

          {/* Monaco Editor / Diff Editor */}
          <div className="flex-1 overflow-hidden relative">
            {showInlineAi && activeFile && !activeFile.isDiff && (
              <InlineAIWidget
                selectedText={inlineAiSelection?.text || ''}
                language={getMonacoLanguage(activeFile.name)}
                fileName={activeFile.name}
                model={selectedAiModel || localStorage.getItem('onyx_selected_model') || 'qwen2.5-coder:7b'}
                onAccept={handleAcceptInlineAi}
                onClose={() => {
                  setShowInlineAi(false);
                  setInlineAiSelection(null);
                }}
              />
            )}

            {activeFile.isDiff ? (
              <DiffEditor
                height="100%"
                original={activeFile.originalContent || ''}
                modified={activeFile.content}
                language={getMonacoLanguage(activeFile.name)}
                theme={`onyx-${settings?.theme || 'dark'}`}
                options={{
                  fontFamily: settings?.fontFamily || "'Fira Code', 'Consolas', 'Courier New', monospace",
                  fontSize: settings?.fontSize ?? 14,
                  readOnly: true,
                  renderSideBySide: true,
                  automaticLayout: true,
                  minimap: { enabled: false },
                  smoothScrolling: true,
                  scrollBeyondLastLine: false,
                }}
              />
            ) : (
              <Editor
                height="100%"
                path={activeFile.path}
                defaultLanguage={getMonacoLanguage(activeFile.name)}
                language={getMonacoLanguage(activeFile.name)}
                value={activeFile.content}
                theme={`onyx-${settings?.theme || 'dark'}`}
                onChange={(value) => onContentChange(value ?? '')}
                onMount={(editor, m) => {
                  editorRef.current = editor;
                  editor.addAction({
                    id: 'onyx-inline-ai',
                    label: 'Inline AI Composer (Ctrl+K)',
                    keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.KeyK],
                    run: (ed: any) => {
                      const selection = ed.getSelection();
                      let text = '';
                      if (selection && !selection.isEmpty()) {
                        text = ed.getModel()?.getValueInRange(selection) || '';
                      }
                      setInlineAiSelection({ text, range: selection });
                      setShowInlineAi(true);
                    },
                  });
                }}
                options={{
                  fontFamily: settings?.fontFamily || "'Fira Code', 'Consolas', 'Courier New', monospace",
                  fontSize: settings?.fontSize ?? 14,
                  tabSize: settings?.tabSize ?? 4,
                  minimap: { enabled: true },
                  wordWrap: settings?.wordWrap ? 'on' : 'off',
                  automaticLayout: true,
                  renderWhitespace: 'selection',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  lineNumbers: settings?.lineNumbers ? 'on' : 'off',
                  renderLineHighlight: 'all',
                  scrollBeyondLastLine: false,
                  padding: { top: 6 },
                }}
              />
            )}
          </div>
        </div>
      ) : (
        /* Clean Blank VS Code Empty State */
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-xs text-[#858585] select-none bg-[#1e1e1e]">
          <div className="flex flex-col items-center max-w-sm space-y-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#252526] text-[#007acc] border border-[#333333]">
              <Code2 size={24} />
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white">Onyx Code IDE</h2>
              <p className="text-xs text-[#6e6e6e]">No editors are currently open</p>
            </div>

            {/* Quick Keyboard Shortcuts */}
            <div className="w-full space-y-2 text-left bg-[#252526] p-3 rounded border border-[#2d2d2d]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#cccccc]">Open File</span>
                <kbd className="rounded bg-[#1e1e1e] border border-[#333333] px-1.5 py-0.5 text-[10px] text-[#858585]">Ctrl+O</kbd>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#cccccc]">Open Folder</span>
                <kbd className="rounded bg-[#1e1e1e] border border-[#333333] px-1.5 py-0.5 text-[10px] text-[#858585]">Ctrl+Shift+O</kbd>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#cccccc]">New File</span>
                <kbd className="rounded bg-[#1e1e1e] border border-[#333333] px-1.5 py-0.5 text-[10px] text-[#858585]">Ctrl+N</kbd>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#cccccc]">Command Palette</span>
                <kbd className="rounded bg-[#1e1e1e] border border-[#333333] px-1.5 py-0.5 text-[10px] text-[#858585]">Ctrl+Shift+P</kbd>
              </div>
            </div>

            <button
              onClick={onSelectWelcome}
              className="text-xs text-[#007acc] hover:underline hover:text-[#38bdf8] transition-colors"
            >
              Open Welcome Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
