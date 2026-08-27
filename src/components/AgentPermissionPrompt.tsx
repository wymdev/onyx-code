import { AlertTriangle, Check, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { AgentPermissionDecision, AgentPermissionRequest } from '../services/agentLoop';

interface AgentPermissionPromptProps {
  request: AgentPermissionRequest;
  onDecision: (decision: AgentPermissionDecision) => void;
}

export default function AgentPermissionPrompt({ request, onDecision }: AgentPermissionPromptProps) {
  const destructive = request.scope === 'workspace_delete' || request.scope === 'terminal_command';
  return (
    <div className="mx-3 mb-2 rounded-lg border border-amber-400/30 bg-[#23211b] p-3 text-xs shadow-xl">
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 rounded-md p-1.5 ${destructive ? 'bg-amber-400/15 text-amber-300' : 'bg-sky-400/15 text-sky-300'}`}>
          {destructive ? <AlertTriangle size={15} /> : <ShieldAlert size={15} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white">{request.title}</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-[#9b9ba3]">{request.description}</p>
          <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded border border-[#34343a] bg-[#161618] px-2 py-1.5 font-mono text-[11px] text-[#d7d7dc]">
            {request.detail}
          </pre>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={() => onDecision('deny')} className="flex items-center gap-1 rounded px-2.5 py-1.5 text-[#b8b8c0] hover:bg-[#34343a] hover:text-white">
          <X size={12} /> Deny
        </button>
        <button type="button" onClick={() => onDecision('allow_once')} className="flex items-center gap-1 rounded border border-[#3b3b42] bg-[#2a2a2f] px-2.5 py-1.5 text-white hover:bg-[#34343a]">
          <Check size={12} /> Allow once
        </button>
        <button type="button" onClick={() => onDecision('allow_session')} className="flex items-center gap-1 rounded bg-[#007acc] px-2.5 py-1.5 text-white hover:bg-[#1686c9]">
          <ShieldCheck size={12} /> Allow for session
        </button>
      </div>
    </div>
  );
}
