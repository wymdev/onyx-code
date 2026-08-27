import { useState } from 'react';
import { TerminalSquare, Trash2, X } from 'lucide-react';
import AIChatPanel from './AIChatPanel';
import EditorArea from './EditorArea';
import ProblemsPanel from './ProblemsPanel';
import TerminalPanel from './TerminalPanel';
import {
  DiagnosticItem,
  FileNode,
  OpenFile,
  RunOutputEvent,
  RunStatusEvent,
} from '../types';
import { AppSettings } from '../services/settingsService';

interface EditorLayoutProps {
  openFiles: OpenFile[];
  activeFileIndex: number;
  onFileSelect: (index: number) => void;
  onFileClose: (index: number) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  settings: AppSettings;
  showAIPanel: boolean;
  aiPanelWidth: number;
  onStartResize: (e: React.MouseEvent) => void;
  onCloseAIPanel: () => void;
  rootPath: string | null;
  fileTree: FileNode[];
  onApplyCode: (path: string, content: string) => Promise<void> | void;
  onLivePreview: (path: string, content: string) => void;
  activeFile?: OpenFile;
  outputLines: RunOutputEvent[];
  outputVisible: boolean;
  runState: RunStatusEvent['state'];
  onToggleOutput: () => void;
  onClearOutput: () => void;
  diagnostics?: DiagnosticItem[];
  onSelectProblem?: (diagnostic: DiagnosticItem) => void;
  onClearDiagnostics?: () => void;
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
  activeBottomTab?: 'problems' | 'output' | 'debug' | 'terminal';
  onSelectBottomTab?: (tab: 'problems' | 'output' | 'debug' | 'terminal') => void;
  isWorkspaceTrusted: boolean;
  onRequestWorkspaceTrust: () => Promise<boolean>;
}

export default function EditorLayout({
  openFiles,
  activeFileIndex,
  onFileSelect,
  onFileClose,
  onContentChange,
  onSave,
  settings,
  showAIPanel,
  aiPanelWidth,
  onStartResize,
  onCloseAIPanel,
  rootPath,
  fileTree,
  onApplyCode,
  onLivePreview,
  activeFile,
  outputLines,
  outputVisible,
  runState,
  onToggleOutput,
  onClearOutput,
  diagnostics = [],
  onSelectProblem,
  onClearDiagnostics,
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
  activeBottomTab: externalBottomTab,
  onSelectBottomTab,
  isWorkspaceTrusted,
  onRequestWorkspaceTrust,
}: EditorLayoutProps) {
  const [internalBottomTab, setInternalBottomTab] = useState<'problems' | 'output' | 'debug' | 'terminal'>('terminal');
  const activeBottomTab = externalBottomTab || internalBottomTab;
  const setActiveBottomTab = onSelectBottomTab || setInternalBottomTab;

  const [bottomPanelHeight, setBottomPanelHeight] = useState(256);
  const [isSplit, setIsSplit] = useState(false);
  const [splitFileIndex, setSplitFileIndex] = useState(Math.min(1, Math.max(0, openFiles.length - 1)));

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;

  const startBottomResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = bottomPanelHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newHeight = Math.max(100, Math.min(startHeight + delta, window.innerHeight - 150));
      setBottomPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex flex-1 overflow-hidden font-sans">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Editor Area (and optional split editor) */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
            <EditorArea
              openFiles={openFiles}
              activeFileIndex={activeFileIndex}
              onFileSelect={onFileSelect}
              onFileClose={onFileClose}
              onContentChange={onContentChange}
              onSave={onSave}
              settings={settings}
              isWelcomeOpen={isWelcomeOpen}
              onCloseWelcome={onCloseWelcome}
              onSelectWelcome={onSelectWelcome}
              onNewFile={onNewFile}
              onOpenFile={onOpenFile}
              onOpenFolder={onOpenFolder}
              onOpenRecentFolder={onOpenRecentFolder}
              onStartCppProject={onStartCppProject}
              onStartPythonProject={onStartPythonProject}
              onOpenAIWorkspace={onOpenAIWorkspace}
              onBuildCpp={onBuildCpp}
              onToggleSplit={() => setIsSplit(!isSplit)}
              isSplit={isSplit}
            />
          </div>

          {isSplit && openFiles.length > 1 && (
            <div className="flex flex-1 border-l border-[#27272a] overflow-hidden">
              <EditorArea
                openFiles={openFiles}
                activeFileIndex={splitFileIndex}
                onFileSelect={setSplitFileIndex}
                onFileClose={onFileClose}
                onContentChange={onContentChange}
                onSave={onSave}
                settings={settings}
                isWelcomeOpen={false}
                onCloseWelcome={onCloseWelcome}
                onSelectWelcome={onSelectWelcome}
                onNewFile={onNewFile}
                onOpenFile={onOpenFile}
                onOpenFolder={onOpenFolder}
                onOpenRecentFolder={onOpenRecentFolder}
                onStartCppProject={onStartCppProject}
                onStartPythonProject={onStartPythonProject}
                onOpenAIWorkspace={onOpenAIWorkspace}
                onBuildCpp={onBuildCpp}
                onToggleSplit={() => setIsSplit(false)}
                isSplit={isSplit}
              />
            </div>
          )}
        </div>

        {/* Bottom Dock (Problems, Output, Debug Console, Terminal) */}
        {outputVisible && (
          <div className="flex flex-col shrink-0">
            <div
              className="h-1 cursor-row-resize transition-colors hover:bg-[#007acc] active:bg-[#007acc] z-20"
              onMouseDown={startBottomResize}
            />

            <div
              className="border-t border-[#27272a] bg-[#18181b] flex flex-col"
              style={{ height: bottomPanelHeight }}
            >
              {/* Bottom Dock Header Tabs */}
              <div className="flex h-9 items-center justify-between px-3 text-xs text-[#cccccc] border-b border-[#27272a] bg-[#18181b] select-none">
                <div className="flex items-center h-full">
                  {/* PROBLEMS Tab */}
                  <button
                    onClick={() => setActiveBottomTab('problems')}
                    className={`h-full px-3 flex items-center gap-1.5 border-b-2 text-xs font-medium transition-colors ${
                      activeBottomTab === 'problems'
                        ? 'border-[#007acc] text-white'
                        : 'border-transparent text-[#8b91aa] hover:text-[#cccccc]'
                    }`}
                  >
                    <span>PROBLEMS</span>
                    {diagnostics.length > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          errorCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-[#2a2a32] text-[#8b91aa]'
                        }`}
                      >
                        {diagnostics.length}
                      </span>
                    )}
                  </button>

                  {/* OUTPUT Tab */}
                  <button
                    onClick={() => setActiveBottomTab('output')}
                    className={`h-full px-3 flex items-center gap-1.5 border-b-2 text-xs font-medium transition-colors ${
                      activeBottomTab === 'output'
                        ? 'border-[#007acc] text-white'
                        : 'border-transparent text-[#8b91aa] hover:text-[#cccccc]'
                    }`}
                  >
                    <span>OUTPUT</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        runState === 'running' ? 'bg-green-500/20 text-green-300' : 'bg-[#27272a] text-[#858585]'
                      }`}
                    >
                      {runState}
                    </span>
                  </button>

                  {/* DEBUG CONSOLE Tab */}
                  <button
                    onClick={() => setActiveBottomTab('debug')}
                    className={`h-full px-3 flex items-center gap-1.5 border-b-2 text-xs font-medium transition-colors ${
                      activeBottomTab === 'debug'
                        ? 'border-[#007acc] text-white'
                        : 'border-transparent text-[#8b91aa] hover:text-[#cccccc]'
                    }`}
                  >
                    <span>DEBUG CONSOLE</span>
                  </button>

                  {/* TERMINAL Tab */}
                  <button
                    onClick={() => setActiveBottomTab('terminal')}
                    className={`h-full px-3 flex items-center gap-1.5 border-b-2 text-xs font-medium transition-colors ${
                      activeBottomTab === 'terminal'
                        ? 'border-[#007acc] text-white'
                        : 'border-transparent text-[#8b91aa] hover:text-[#cccccc]'
                    }`}
                  >
                    <TerminalSquare size={13} />
                    <span>TERMINAL</span>
                  </button>
                </div>

                {/* Right Panel Actions */}
                <div className="flex items-center gap-2 text-[#858585]">
                  {activeBottomTab === 'output' && (
                    <button onClick={onClearOutput} className="p-1 hover:text-white rounded hover:bg-[#27272a]" title="Clear Output">
                      <Trash2 size={13} />
                    </button>
                  )}
                  {activeBottomTab === 'problems' && diagnostics.length > 0 && onClearDiagnostics && (
                    <button onClick={onClearDiagnostics} className="p-1 hover:text-white rounded hover:bg-[#27272a]" title="Clear Problems">
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button onClick={onToggleOutput} className="p-1 hover:text-white rounded hover:bg-[#27272a]" title={outputVisible ? 'Hide Panel' : 'Show Panel'}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-hidden">
                {activeBottomTab === 'problems' && (
                  <ProblemsPanel
                    diagnostics={diagnostics}
                    onSelectProblem={onSelectProblem}
                    onClear={onClearDiagnostics}
                  />
                )}

                {activeBottomTab === 'output' && (
                  <div className="h-full overflow-auto p-3 font-mono text-xs bg-[#111318]">
                    {outputLines.length === 0 ? (
                      <div className="flex h-full items-center justify-center text-[#555577]">
                        Run or build a file to see compile output logs here.
                      </div>
                    ) : (
                      outputLines.map((line, index) => (
                        <div
                          key={`${line.type}-${index}`}
                          className={`whitespace-pre-wrap py-0.5 leading-snug ${
                            line.type === 'stderr'
                              ? 'text-red-400 font-medium'
                              : line.type === 'system'
                              ? 'text-[#38bdf8]'
                              : 'text-[#cccccc]'
                          }`}
                        >
                          {line.message}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeBottomTab === 'debug' && (
                  <div className="h-full overflow-auto p-3 font-mono text-xs text-[#858585] bg-[#111318]">
                    <p className="text-[#38bdf8]">=== Onyx Code Debug Console Ready ===</p>
                    <p className="mt-1 text-[#6f7192]">Type expressions or evaluate C++ / Python variables during debugging.</p>
                  </div>
                )}

                {activeBottomTab === 'terminal' && (
                  <div className="flex-1 h-full overflow-hidden">
                    <TerminalPanel />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right AI Panel */}
      {showAIPanel && (
        <>
          <div
            className="w-1 cursor-col-resize transition-colors hover:bg-[#007acc] active:bg-[#007acc] z-20"
            onMouseDown={onStartResize}
          />
          <div className="relative h-full shrink-0" style={{ width: aiPanelWidth }}>
            <AIChatPanel
              onClose={onCloseAIPanel}
              onApplyCode={onApplyCode}
              onLivePreview={onLivePreview}
              rootPath={rootPath}
              fileTree={fileTree}
              activeFile={activeFile}
              isWorkspaceTrusted={isWorkspaceTrusted}
              onRequestWorkspaceTrust={onRequestWorkspaceTrust}
            />
          </div>
        </>
      )}
    </div>
  );
}
