import { useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { ChevronDown, FilePlus, FileEdit, FileMinus, FileDiff, RotateCcw } from 'lucide-react';
import { PendingFileChange } from '../services/agentLoop';

interface PendingChangesBarProps {
  changes: Map<string, PendingFileChange>;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

export default function PendingChangesBar({ changes, onAcceptAll, onRejectAll }: PendingChangesBarProps) {
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const changesList = useMemo(() => Array.from(changes.values()), [changes]);

  const calculateStats = (original: string | null, current: string | null) => {
    if (!original && !current) return { added: 0, removed: 0 };
    if (!original) return { added: (current || '').split('\n').length, removed: 0 };
    if (!current) return { added: 0, removed: (original || '').split('\n').length };

    const diff = diffLines(original, current);
    let added = 0;
    let removed = 0;
    
    diff.forEach((part) => {
      if (part.added) added += part.count || 0;
      if (part.removed) removed += part.count || 0;
    });

    return { added, removed };
  };

  const fileStats = useMemo(
    () => changesList.map((change) => ({
      change,
      stats: calculateStats(change.originalContent, change.currentContent),
    })),
    [changesList]
  );
  const totalStats = useMemo(
    () => fileStats.reduce(
      (total, entry) => ({
        added: total.added + entry.stats.added,
        removed: total.removed + entry.stats.removed,
      }),
      { added: 0, removed: 0 }
    ),
    [fileStats]
  );

  if (changesList.length === 0) return null;

  const firstChangeName = changesList[0].path.split(/[/\\]/).pop() || changesList[0].path;
  const title = changesList.length === 1
    ? `${changesList[0].type === 'create' ? 'Created' : changesList[0].type === 'delete' ? 'Deleted' : 'Edited'} ${firstChangeName}`
    : `${changesList.length} files changed`;

  return (
    <div className="overflow-hidden rounded-xl border border-[#303033] bg-[#1a1a1a] text-xs">
      <div className="flex min-h-[64px] items-center gap-3 px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#3a3a3d] text-[#a1a1a6]">
          <FileDiff size={14} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-[#d4d4d8]">{title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px]">
            {totalStats.added > 0 && <span className="text-emerald-400">+{totalStats.added}</span>}
            {totalStats.removed > 0 && <span className="text-rose-400">-{totalStats.removed}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRejectAll}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] text-[#b5b5ba] transition-colors hover:bg-[#252525] hover:text-white"
            title="Undo all pending file changes"
          >
            <span>Undo</span>
            <RotateCcw size={12} />
          </button>
          <button
            onClick={() => setIsReviewOpen((open) => !open)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-[#3a3a3d] px-3 text-[11.5px] text-[#b5b5ba] transition-colors hover:bg-[#252525] hover:text-white"
            aria-expanded={isReviewOpen}
          >
            <span>Review</span>
            <ChevronDown size={12} className={`transition-transform ${isReviewOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isReviewOpen && (
        <div className="border-t border-[#303033] px-3 py-2.5">
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {fileStats.map(({ change, stats }) => {
              const name = change.path.split(/[/\\]/).pop();

              return (
                <div key={change.path} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#252525]">
                  {change.type === 'create' && <FilePlus size={14} className="shrink-0 text-emerald-400" />}
                  {change.type === 'edit' && <FileEdit size={14} className="shrink-0 text-sky-400" />}
                  {change.type === 'delete' && <FileMinus size={14} className="shrink-0 text-rose-400" />}

                  <div className="min-w-0 flex-1 truncate">
                    <span className="mr-2 font-medium text-[#cccccc]">{name}</span>
                    <span className="text-[10px] text-[#71717a]">{change.path}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 font-mono text-[10px]">
                    {stats.added > 0 && <span className="text-emerald-400">+{stats.added}</span>}
                    {stats.removed > 0 && <span className="text-rose-400">-{stats.removed}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex justify-end border-t border-[#292929] pt-2.5">
            <button
              onClick={onAcceptAll}
              className="rounded-lg bg-[#2f2f32] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#3a3a3d]"
            >
              Keep changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
