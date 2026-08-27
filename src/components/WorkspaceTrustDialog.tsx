import { FolderOpen, Lock, ShieldCheck, X } from 'lucide-react';

export type WorkspaceTrustDecision = 'trusted' | 'restricted' | 'cancel';

interface WorkspaceTrustDialogProps {
  path: string;
  kind: 'file' | 'folder';
  onDecision: (decision: WorkspaceTrustDecision) => void;
}

export default function WorkspaceTrustDialog({ path, kind, onDecision }: WorkspaceTrustDialogProps) {
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[#34343a] bg-[#202023] shadow-2xl">
        <div className="flex items-start gap-3 border-b border-[#34343a] p-5">
          <div className="rounded-lg bg-amber-400/10 p-2 text-amber-300"><Lock size={20} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white">Do you trust the author of this {kind}?</h2>
            <p className="mt-1 text-xs leading-5 text-[#9b9ba3]">
              Trusted workspaces can run code, open terminals, activate plugins, and let the local agent request changes.
            </p>
          </div>
          <button type="button" onClick={() => onDecision('cancel')} className="rounded p-1 text-[#85858d] hover:bg-[#303035] hover:text-white"><X size={15} /></button>
        </div>
        <div className="m-4 flex items-center gap-2 rounded-lg border border-[#34343a] bg-[#171719] px-3 py-2 font-mono text-[11px] text-[#d1d1d6]">
          <FolderOpen size={14} className="shrink-0 text-sky-400" />
          <span className="truncate">{path}</span>
        </div>
        <div className="px-5 pb-3 text-[11px] leading-4 text-[#85858d]">
          Restricted mode still lets you inspect and edit text, but blocks execution, terminals, Agent tools, and plugin activation.
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#34343a] bg-[#1b1b1e] px-4 py-3">
          <button type="button" onClick={() => onDecision('cancel')} className="rounded px-3 py-1.5 text-xs text-[#b8b8c0] hover:bg-[#303035] hover:text-white">Cancel</button>
          <button type="button" onClick={() => onDecision('restricted')} className="rounded border border-[#3b3b42] bg-[#28282c] px-3 py-1.5 text-xs text-white hover:bg-[#323238]">Open Restricted</button>
          <button type="button" onClick={() => onDecision('trusted')} className="flex items-center gap-1.5 rounded bg-[#007acc] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1686c9]">
            <ShieldCheck size={13} /> Trust and Open
          </button>
        </div>
      </div>
    </div>
  );
}
