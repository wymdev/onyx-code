import { useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  Square,
  Trash2,
  Zap,
} from 'lucide-react';
import { OpenFile, RunStatusEvent } from '../types';
import {
  Breakpoint,
  getToolchainForFile,
  SUPPORTED_TOOLCHAINS,
  WatchExpression,
} from '../services/languageService';

interface RunDebugViewProps {
  activeFile?: OpenFile;
  runState: RunStatusEvent['state'];
  onRunCode: () => void;
  onBuildCpp?: () => void;
  onStopCode: () => void;
}

export default function RunDebugView({
  activeFile,
  runState,
  onRunCode,
  onBuildCpp,
  onStopCode,
}: RunDebugViewProps) {
  const [selectedConfig, setSelectedConfig] = useState<string>('auto');

  // Collapsible panels
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    variables: true,
    watch: true,
    stack: true,
    breakpoints: true,
    toolchains: false,
  });

  // Watch expressions
  const [watchExprs, setWatchExprs] = useState<WatchExpression[]>([
    { id: '1', expression: 'argc', value: '1', type: 'int' },
    { id: '2', expression: 'n', value: '10', type: 'int' },
  ]);
  const [newWatchInput, setNewWatchInput] = useState('');
  const [isAddingWatch, setIsAddingWatch] = useState(false);

  // Breakpoints
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([
    { id: 'bp-1', filePath: activeFile?.path || 'main.cpp', fileName: activeFile?.name || 'main.cpp', line: 12, enabled: true },
  ]);

  const activeToolchain = activeFile
    ? getToolchainForFile(activeFile.name)
    : SUPPORTED_TOOLCHAINS[0];

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddWatch = () => {
    if (!newWatchInput.trim()) return;
    setWatchExprs((prev) => [
      ...prev,
      { id: `watch-${Date.now()}`, expression: newWatchInput.trim(), value: 'undefined' },
    ]);
    setNewWatchInput('');
    setIsAddingWatch(false);
  };

  const toggleBreakpoint = (id: string) => {
    setBreakpoints((prev) =>
      prev.map((bp) => (bp.id === id ? { ...bp, enabled: !bp.enabled } : bp))
    );
  };

  const deleteBreakpoint = (id: string) => {
    setBreakpoints((prev) => prev.filter((bp) => bp.id !== id));
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] text-[#cccccc] font-sans text-xs select-none">
      {/* Header */}
      <div className="flex h-9 items-center justify-between border-b border-[#252526] px-3 font-semibold uppercase tracking-wide text-[#bbbbbb] bg-[#252526]">
        <div className="flex items-center gap-1.5">
          <Bug size={14} className="text-[#38bdf8]" />
          <span>Run & Debug</span>
        </div>
        <span className="text-[10px] text-[#858585] font-mono">
          {runState === 'running' ? '● RUNNING' : '○ IDLE'}
        </span>
      </div>

      {/* Launch Configuration Bar */}
      <div className="p-2.5 border-b border-[#252526] bg-[#18181b] space-y-2">
        <div className="flex items-center gap-1.5">
          <select
            value={selectedConfig}
            onChange={(e) => setSelectedConfig(e.target.value)}
            className="flex-1 rounded border border-[#333333] bg-[#252526] px-2 py-1 text-xs text-white outline-none focus:border-[#007acc] cursor-pointer"
          >
            <option value="auto">Auto: {activeToolchain.name}</option>
            {SUPPORTED_TOOLCHAINS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center gap-1.5">
          {runState === 'running' ? (
            <button
              onClick={onStopCode}
              className="flex-1 flex items-center justify-center gap-1.5 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors shadow-sm"
              title="Stop Execution (Shift+F5)"
            >
              <Square size={11} fill="currentColor" />
              <span>Stop</span>
            </button>
          ) : (
            <>
              <button
                onClick={onRunCode}
                className="flex-1 flex items-center justify-center gap-1.5 rounded bg-[#007acc] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#0062a3] transition-colors shadow-sm"
                title="Start Debugging (F5)"
              >
                <Play size={11} fill="currentColor" />
                <span>Debug (F5)</span>
              </button>

              <button
                onClick={onRunCode}
                className="flex items-center justify-center gap-1 rounded border border-[#333333] bg-[#252526] px-2 py-1 text-xs text-[#cccccc] hover:bg-[#2d2d2d] hover:text-white"
                title="Run Without Debugging (Ctrl+F5)"
              >
                <Play size={10} />
                <span>Run</span>
              </button>
            </>
          )}

          {activeFile && (activeFile.name.endsWith('.cpp') || activeFile.name.endsWith('.c')) && onBuildCpp && (
            <button
              onClick={onBuildCpp}
              className="flex items-center gap-1 rounded border border-[#333333] bg-[#252526] px-2 py-1 text-xs text-[#38bdf8] hover:border-[#007acc] hover:bg-[#2d2d2d]"
              title="Build / Compile (Ctrl+Shift+B)"
            >
              <Zap size={11} />
              <span>Build</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Sections List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#252526]">
        {/* 1. VARIABLES */}
        <div>
          <div
            onClick={() => toggleSection('variables')}
            className="flex cursor-pointer items-center justify-between px-2.5 py-1 text-xs font-semibold uppercase text-[#858585] hover:bg-[#252526] hover:text-[#cccccc]"
          >
            <div className="flex items-center gap-1">
              {openSections.variables ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Variables</span>
            </div>
          </div>

          {openSections.variables && (
            <div className="p-2 space-y-1 bg-[#18181b]/50 text-[11px] font-mono">
              <div className="text-[#858585] font-sans font-semibold text-[10px] uppercase">Locals</div>
              {runState === 'running' ? (
                <>
                  <div className="flex items-center justify-between text-[#cccccc] pl-2">
                    <span className="text-[#38bdf8]">n:</span>
                    <span>10</span>
                  </div>
                  <div className="flex items-center justify-between text-[#cccccc] pl-2">
                    <span className="text-[#38bdf8]">total:</span>
                    <span>55</span>
                  </div>
                  <div className="flex items-center justify-between text-[#cccccc] pl-2">
                    <span className="text-[#38bdf8]">tc:</span>
                    <span>1</span>
                  </div>
                </>
              ) : (
                <div className="text-[#6e6e6e] italic pl-2">No active debug frame</div>
              )}
            </div>
          )}
        </div>

        {/* 2. WATCH */}
        <div>
          <div className="flex cursor-pointer items-center justify-between px-2.5 py-1 text-xs font-semibold uppercase text-[#858585] hover:bg-[#252526] hover:text-[#cccccc]">
            <div
              onClick={() => toggleSection('watch')}
              className="flex items-center gap-1 flex-1"
            >
              {openSections.watch ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Watch</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingWatch(true);
              }}
              className="p-0.5 hover:text-white rounded hover:bg-[#333333]"
              title="Add Expression"
            >
              <Plus size={13} />
            </button>
          </div>

          {openSections.watch && (
            <div className="p-2 space-y-1 bg-[#18181b]/50 text-[11px] font-mono">
              {isAddingWatch && (
                <div className="flex items-center gap-1 mb-1">
                  <input
                    type="text"
                    value={newWatchInput}
                    onChange={(e) => setNewWatchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                    placeholder="Expression to watch..."
                    autoFocus
                    className="w-full rounded border border-[#007acc] bg-[#1e1e1e] px-1.5 py-0.5 text-xs text-white outline-none"
                  />
                </div>
              )}

              {watchExprs.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-[#cccccc] pl-2 group">
                  <span className="text-[#38bdf8]">{w.expression}:</span>
                  <div className="flex items-center gap-1">
                    <span>{runState === 'running' ? w.value : 'undefined'}</span>
                    <button
                      onClick={() => setWatchExprs(watchExprs.filter((x) => x.id !== w.id))}
                      className="opacity-0 group-hover:opacity-100 text-[#858585] hover:text-red-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. CALL STACK */}
        <div>
          <div
            onClick={() => toggleSection('stack')}
            className="flex cursor-pointer items-center justify-between px-2.5 py-1 text-xs font-semibold uppercase text-[#858585] hover:bg-[#252526] hover:text-[#cccccc]"
          >
            <div className="flex items-center gap-1">
              {openSections.stack ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Call Stack</span>
            </div>
          </div>

          {openSections.stack && (
            <div className="p-2 space-y-1 bg-[#18181b]/50 text-[11px]">
              {runState === 'running' ? (
                <div className="space-y-1 pl-2 font-mono">
                  <div className="text-white font-medium">main() : line 15</div>
                  <div className="text-[#858585]">solve(int tc=1) : line 22</div>
                  <div className="text-[#6e6e6e]">[System Thread 0x1A4]</div>
                </div>
              ) : (
                <div className="text-[#6e6e6e] italic pl-2">Not currently paused</div>
              )}
            </div>
          )}
        </div>

        {/* 4. BREAKPOINTS */}
        <div>
          <div
            onClick={() => toggleSection('breakpoints')}
            className="flex cursor-pointer items-center justify-between px-2.5 py-1 text-xs font-semibold uppercase text-[#858585] hover:bg-[#252526] hover:text-[#cccccc]"
          >
            <div className="flex items-center gap-1">
              {openSections.breakpoints ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Breakpoints ({breakpoints.length})</span>
            </div>
          </div>

          {openSections.breakpoints && (
            <div className="p-2 space-y-1 bg-[#18181b]/50 text-[11px]">
              {breakpoints.length === 0 ? (
                <div className="text-[#6e6e6e] italic pl-2">No breakpoints set</div>
              ) : (
                breakpoints.map((bp) => (
                  <div
                    key={bp.id}
                    className="flex items-center justify-between rounded px-1.5 py-0.5 hover:bg-[#252526] group"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={bp.enabled}
                        onChange={() => toggleBreakpoint(bp.id)}
                        className="rounded border-[#444] text-[#007acc] cursor-pointer"
                      />
                      <span className="font-mono text-white">{bp.fileName}</span>
                      <span className="font-mono text-[#38bdf8]">:{bp.line}</span>
                    </div>

                    <button
                      onClick={() => deleteBreakpoint(bp.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#858585] hover:text-red-400"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 5. TOOLCHAINS / COMPILERS */}
        <div>
          <div
            onClick={() => toggleSection('toolchains')}
            className="flex cursor-pointer items-center justify-between px-2.5 py-1 text-xs font-semibold uppercase text-[#858585] hover:bg-[#252526] hover:text-[#cccccc]"
          >
            <div className="flex items-center gap-1">
              {openSections.toolchains ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>Compilers & Toolchains</span>
            </div>
          </div>

          {openSections.toolchains && (
            <div className="p-2 space-y-2 bg-[#18181b]/50 text-[11px]">
              {SUPPORTED_TOOLCHAINS.map((tc) => (
                <div key={tc.id} className="rounded border border-[#2d2d2d] bg-[#252526] p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{tc.name}</span>
                    <span className="text-[10px] text-[#38bdf8] font-mono">Ready</span>
                  </div>
                  <div className="text-[10px] text-[#858585] font-mono">
                    <div>Compiler: {tc.compiler}</div>
                    <div>Debugger: {tc.debugger}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
