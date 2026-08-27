import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileCode, Filter, Trash2 } from 'lucide-react';
import { DiagnosticItem } from '../types';

interface ProblemsPanelProps {
  diagnostics: DiagnosticItem[];
  onSelectProblem?: (diagnostic: DiagnosticItem) => void;
  onClear?: () => void;
}

export default function ProblemsPanel({ diagnostics, onSelectProblem, onClear }: ProblemsPanelProps) {
  const [filterText, setFilterText] = useState('');
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  const filtered = diagnostics.filter((d) =>
    d.message.toLowerCase().includes(filterText.toLowerCase()) ||
    d.fileName.toLowerCase().includes(filterText.toLowerCase()) ||
    d.source.toLowerCase().includes(filterText.toLowerCase())
  );

  // Group by file
  const grouped = filtered.reduce<Record<string, DiagnosticItem[]>>((acc, item) => {
    if (!acc[item.filePath]) {
      acc[item.filePath] = [];
    }
    acc[item.filePath].push(item);
    return acc;
  }, {});

  const toggleFile = (path: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#111318] text-[#cccccc] font-sans text-xs select-none">
      {/* Header bar */}
      <div className="flex h-8 items-center justify-between border-b border-[#2a2a32] bg-[#1a1a1f] px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-[#8b91aa]">PROBLEMS</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${errorCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-[#2a2a32] text-[#8b91aa]'}`}>
              {diagnostics.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle size={12} /> {errorCount}
            </span>
            <span className="flex items-center gap-1 text-yellow-400">
              <AlertTriangle size={12} /> {warningCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded border border-[#2a2a32] bg-[#0e0e11] px-2 py-0.5">
            <Filter size={11} className="text-[#6f7192]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter errors (e.g. text, file)..."
              className="w-36 bg-transparent text-[11px] text-[#cccccc] outline-none placeholder:text-[#555577]"
            />
          </div>
          {diagnostics.length > 0 && onClear && (
            <button
              onClick={onClear}
              className="rounded p-1 text-[#8b91aa] hover:bg-[#2a2a32] hover:text-white"
              title="Clear Diagnostics"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Problems list */}
      <div className="flex-1 overflow-y-auto p-2">
        {diagnostics.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-[#555577] gap-2">
            <CheckCircle2 size={24} className="text-green-500/60" />
            <p className="text-xs">No problems have been detected in the workspace.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(grouped).map(([filePath, items]) => {
              const fileName = items[0]?.fileName || filePath.split(/[\\/]/).pop() || 'file';
              const isCollapsed = collapsedFiles.has(filePath);

              return (
                <div key={filePath} className="rounded border border-[#1f2029] bg-[#14161d]">
                  <div
                    onClick={() => toggleFile(filePath)}
                    className="flex cursor-pointer items-center justify-between px-2.5 py-1.5 hover:bg-[#1c1e28]"
                  >
                    <div className="flex items-center gap-2 font-medium text-white">
                      {isCollapsed ? <ChevronRight size={13} className="text-[#858585]" /> : <ChevronDown size={13} className="text-[#858585]" />}
                      <FileCode size={13} className="text-[#38bdf8]" />
                      <span>{fileName}</span>
                      <span className="text-[10px] text-[#6f7192] font-mono">{filePath}</span>
                    </div>
                    <span className="rounded bg-[#2a2a32] px-1.5 py-0.5 text-[10px] text-[#8b91aa]">
                      {items.length}
                    </span>
                  </div>

                  {!isCollapsed && (
                    <div className="divide-y divide-[#1c1e28] border-t border-[#1f2029]">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onSelectProblem?.(item)}
                          className="flex cursor-pointer items-start justify-between px-4 py-1.5 transition-colors hover:bg-[#202330]"
                        >
                          <div className="flex items-start gap-2 pr-4">
                            {item.severity === 'error' ? (
                              <AlertCircle size={13} className="shrink-0 text-red-400 mt-0.5" />
                            ) : (
                              <AlertTriangle size={13} className="shrink-0 text-yellow-400 mt-0.5" />
                            )}
                            <div>
                              <p className="text-xs text-[#dddddd] leading-tight">{item.message}</p>
                              <span className="text-[10px] text-[#6f7192]">Source: {item.source}</span>
                            </div>
                          </div>

                          <span className="shrink-0 font-mono text-[11px] text-[#8b91aa]">
                            [{item.line}, {item.column}]
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
