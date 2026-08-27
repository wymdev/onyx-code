import React, { useEffect, useRef } from 'react';
import {
  ChevronRight,
  Circle,
  Code2,
  Columns,
  FileCode,
  FileText,
  X,
  Zap,
} from 'lucide-react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { OpenFile } from '../types';
import { AppSettings } from '../services/settingsService';
import { registerCppMonacoSnippets } from '../services/cppService';
import WelcomeTab from './WelcomeTab';

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
  onToggleSplit?: () => void;
  isSplit?: boolean;
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
  onToggleSplit,
  isSplit = false,
}: EditorAreaProps) {
  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  const activeFile = openFiles[activeFileIndex];

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
    };

    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [onSave, onBuildCpp]);

  // Setup Monaco theme and C++ snippets
  useEffect(() => {
    if (monaco) {
      monaco.editor.defineTheme('onyx-code-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
          { token: 'keyword', foreground: '569cd6' },
          { token: 'keyword.cpp', foreground: '569cd6' },
          { token: 'type.cpp', foreground: '4ec9b0' },
          { token: 'string', foreground: 'ce9178' },
          { token: 'number', foreground: 'b5cea8' },
          { token: 'function', foreground: 'dcdcaa' },
        ],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.lineHighlightBackground': '#282828',
          'editorLineNumber.foreground': '#858585',
          'editorLineNumber.activeForeground': '#c6c6c6',
          'editorIndentGuide.background': '#404040',
          'editorIndentGuide.activeBackground': '#707070',
        },
      });
      monaco.editor.setTheme('onyx-code-dark');

      registerCppMonacoSnippets(monaco);
    }
  }, [monaco]);

  const handleTabClick = (index: number) => {
    onFileSelect(index);
  };

  const handleTabClose = (event: React.MouseEvent, index: number) => {
    event.stopPropagation();
    onFileClose(index);
  };

  const getFileIcon = (fileName: string) => {
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
    <div className="flex flex-1 flex-col overflow-hidden bg-[#1e1e1e] font-sans">
      {/* VS Code Tab Bar */}
      {hasTabs && (
        <div className="flex h-9 items-center justify-between border-b border-[#252526] bg-[#252526] select-none">
          <div className="flex h-full items-center overflow-x-auto">
            {/* Welcome Tab (if open) */}
            {isWelcomeOpen && (
              <div
                className="flex h-full items-center gap-2 px-3 border-r border-[#1e1e1e] text-xs cursor-pointer transition-colors bg-[#1e1e1e] text-white border-t border-t-[#007acc]"
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
                  className={`flex h-full items-center gap-2 px-3 border-r border-[#1e1e1e] text-xs cursor-pointer transition-colors ${
                    isTabActive
                      ? 'bg-[#1e1e1e] text-white border-t border-t-[#007acc]'
                      : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#282828]'
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
          <div className="flex items-center gap-1.5 px-3 text-[#858585]">
            <button
              onClick={onToggleSplit}
              className={`p-1 rounded hover:bg-[#333333] hover:text-white transition-colors ${
                isSplit ? 'text-[#007acc]' : 'text-[#858585]'
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

          {/* Monaco Editor */}
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              path={activeFile.path}
              defaultLanguage={getMonacoLanguage(activeFile.name)}
              language={getMonacoLanguage(activeFile.name)}
              value={activeFile.content}
              theme="onyx-code-dark"
              onChange={(value) => onContentChange(value ?? '')}
              onMount={(editor) => {
                editorRef.current = editor;
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
