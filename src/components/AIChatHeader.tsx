import { Cpu, RefreshCw, Trash2, X } from 'lucide-react';

interface AIChatHeaderProps {
  onClear: () => void;
  onClose: () => void;
  isAgentMode: boolean;
  onRefreshModels: () => void;
}

export default function AIChatHeader({
  onClear,
  onClose,
  isAgentMode,
  onRefreshModels,
}: AIChatHeaderProps) {
  return (
    <div className="flex h-9 items-center justify-between border-b border-[#27272a] bg-[#18181b] px-3 font-sans text-xs select-none">
      {/* Local AI identity */}
      <div className="flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-[#007acc]/20 text-[#38bdf8]">
          <Cpu size={13} />
        </div>
        <span className="font-semibold text-[#cccccc]">
          {isAgentMode ? 'Onyx Local Agent' : 'Onyx Local Assistant'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 text-[#858585]">
        <button
          onClick={onRefreshModels}
          className="p-1 hover:text-white rounded hover:bg-[#27272a] transition-colors"
          title="Refresh Local Models"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={onClear}
          className="p-1 hover:text-white rounded hover:bg-[#27272a] transition-colors"
          title="Clear Conversation"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:text-white rounded hover:bg-[#27272a] transition-colors"
          title="Close AI Assistant"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
