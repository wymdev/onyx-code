import { useEffect, useRef, useState } from 'react';
import { ArrowUp, BrainCircuit, Check, ChevronDown, Cpu, ShieldAlert, ShieldCheck, ShieldOff, Square } from 'lucide-react';
import { OllamaModelInfo } from '../services/ollama';

export type AgentApprovalMode = 'ask' | 'auto_safe' | 'full';

interface AIComposerProps {
  input: string;
  isLoading: boolean;
  isPlanningMode: boolean;
  models: OllamaModelInfo[];
  selectedModel: string;
  isAgentMode: boolean;
  onAgentModeChange: (isAgent: boolean) => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onTogglePlanningMode: () => void;
  onModelChange: (model: string) => void;
  onStop: () => void;
  approvalMode: AgentApprovalMode;
  onApprovalModeChange: (mode: AgentApprovalMode) => void;
  isWorkspaceTrusted: boolean;
}

export default function AIComposer({
  input,
  isLoading,
  isPlanningMode,
  models,
  selectedModel,
  isAgentMode,
  onAgentModeChange,
  onInputChange,
  onSubmit,
  onTogglePlanningMode,
  onModelChange,
  onStop,
  approvalMode,
  onApprovalModeChange,
  isWorkspaceTrusted,
}: AIComposerProps) {
  const [approvalMenuOpen, setApprovalMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const approvalRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (approvalRef.current && !approvalRef.current.contains(event.target as Node)) setApprovalMenuOpen(false);
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const approvalLabels: Record<AgentApprovalMode, string> = {
    ask: 'Ask approval',
    auto_safe: 'Approve safe',
    full: 'Full access',
  };
  return (
    <div className="p-2.5 bg-[#18181b] border-t border-[#27272a] font-sans">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="relative flex flex-col rounded-md border border-[#27272a] bg-[#1e1e1e] p-2.5 transition-colors focus-within:border-[#007acc]"
      >
        {/* Input Textarea */}
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={
            isAgentMode
              ? 'Instruct agent to build features, refactor code, or run commands...'
              : 'Ask a question, request code, or explain concepts...'
          }
          rows={3}
          disabled={isLoading}
          className="w-full resize-none bg-transparent text-xs text-[#cccccc] outline-none placeholder:text-[#6e6e6e] font-sans leading-relaxed"
        />

        {/* Toolbar Controls */}
        <div className="mt-2 flex items-center justify-between border-t border-[#27272a] pt-2 text-xs">
          {/* Left: Model & Mode Selection */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Custom model menu avoids the native bright-blue OS select. */}
            <div ref={modelRef} className="relative">
              <button
                type="button"
                onClick={() => setModelMenuOpen((open) => !open)}
                disabled={models.length === 0}
                className="flex h-7 w-[190px] items-center gap-2 rounded-md border border-[#3a3a40] bg-[#252528] px-2.5 text-left text-[11px] font-semibold text-[#e4e4e7] shadow-sm transition-colors hover:border-[#55555d] hover:bg-[#2b2b2f] disabled:cursor-not-allowed disabled:opacity-60"
                title={models.length === 0 ? 'No local Ollama models installed' : 'Select local Ollama model'}
                aria-haspopup="listbox"
                aria-expanded={modelMenuOpen}
              >
                <Cpu size={12} className="shrink-0 text-sky-400" />
                <span className="min-w-0 flex-1 truncate">
                  {models.length === 0 ? 'No local models' : selectedModel.replace(':latest', '')}
                </span>
                <ChevronDown size={12} className={`shrink-0 text-[#85858d] transition-transform ${modelMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {modelMenuOpen && models.length > 0 && (
                <div role="listbox" className="absolute bottom-9 left-0 z-50 max-h-56 w-[250px] overflow-y-auto rounded-lg border border-[#3a3a40] bg-[#232326] p-1 shadow-2xl">
                  <div className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#777780]">Local Ollama models</div>
                  {models.map((model) => {
                    const active = model.name === selectedModel;
                    const size = model.size >= 1024 ** 3
                      ? `${(model.size / 1024 ** 3).toFixed(1)} GB`
                      : `${Math.round(model.size / 1024 ** 2)} MB`;
                    return (
                      <button
                        key={model.name}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onModelChange(model.name);
                          setModelMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${active ? 'bg-[#007acc]/20 text-white' : 'text-[#c8c8cf] hover:bg-[#303035]'}`}
                      >
                        <Cpu size={13} className={active ? 'text-sky-400' : 'text-[#777780]'} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium">{model.name.replace(':latest', '')}</span>
                          <span className="block text-[9px] text-[#777780]">Installed locally · {size}</span>
                        </span>
                        {active && <Check size={13} className="shrink-0 text-sky-400" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Plan Mode Toggle */}
            <button
              type="button"
              onClick={onTogglePlanningMode}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors border ${
                isPlanningMode
                  ? 'border-[#007acc]/40 bg-[#007acc]/20 text-[#38bdf8]'
                  : 'border-transparent text-[#858585] hover:bg-[#27272a] hover:text-[#cccccc]'
              }`}
              title={isPlanningMode ? 'Planning Mode Active (<thought> logic)' : 'Enable Planning Mode'}
            >
              <BrainCircuit size={12} />
              <span>Plan</span>
            </button>

            {/* Agent Mode Toggle */}
            <button
              type="button"
              onClick={() => onAgentModeChange(!isAgentMode)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors border ${
                isAgentMode
                  ? 'border-[#8b5cf6]/40 bg-[#8b5cf6]/20 text-[#c084fc]'
                  : 'border-transparent text-[#858585] hover:bg-[#27272a] hover:text-[#cccccc]'
              }`}
              title={isAgentMode ? 'Autonomous Agent Active (Tools & File Edits)' : 'Enable Agent Mode'}
            >
              <Cpu size={12} />
              <span>Agent</span>
            </button>

            <div ref={approvalRef} className="relative">
              <button
                type="button"
                onClick={() => setApprovalMenuOpen((open) => !open)}
                disabled={!isWorkspaceTrusted}
                className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  approvalMode === 'full'
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                    : approvalMode === 'auto_safe'
                    ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                    : 'border-[#3b3b42] text-[#a8a8b0] hover:bg-[#27272a] hover:text-white'
                }`}
                title={isWorkspaceTrusted ? 'Choose how agent actions are approved' : 'Trust this workspace to configure Agent access'}
              >
                {approvalMode === 'full' ? <ShieldOff size={12} /> : approvalMode === 'auto_safe' ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                <span className="hidden xl:inline">{approvalLabels[approvalMode]}</span>
                <ChevronDown size={11} />
              </button>

              {approvalMenuOpen && (
                <div className="absolute bottom-8 left-0 z-50 w-72 overflow-hidden rounded-lg border border-[#3a3a40] bg-[#232326] py-1 shadow-2xl">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#777780]">How should Agent actions be approved?</div>
                  <ApprovalOption
                    active={approvalMode === 'ask'}
                    icon={ShieldAlert}
                    title="Ask for approval"
                    detail="Ask before every edit, create, delete, or command"
                    onClick={() => { onApprovalModeChange('ask'); setApprovalMenuOpen(false); }}
                  />
                  <ApprovalOption
                    active={approvalMode === 'auto_safe'}
                    icon={ShieldCheck}
                    title="Approve safe changes"
                    detail="Auto-approve writes; ask for deletes and commands"
                    onClick={() => { onApprovalModeChange('auto_safe'); setApprovalMenuOpen(false); }}
                  />
                  <ApprovalOption
                    active={approvalMode === 'full'}
                    icon={ShieldOff}
                    title="Full workspace access"
                    detail="No per-action prompts inside this trusted workspace"
                    warning
                    onClick={() => { onApprovalModeChange('full'); setApprovalMenuOpen(false); }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Submit / Stop */}
          <div className="flex items-center gap-1.5">
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                title="Stop Execution"
              >
                <Square size={10} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || models.length === 0}
                className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                  input.trim() && models.length > 0
                    ? 'bg-[#007acc] text-white hover:bg-[#0062a3] cursor-pointer'
                    : 'bg-[#27272a] text-[#555555] cursor-not-allowed'
                }`}
                title={models.length === 0 ? 'Pull a model first (Extensions or Ollama status bar)' : 'Send (Enter)'}
              >
                <ArrowUp size={13} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function ApprovalOption({
  active,
  icon: Icon,
  title,
  detail,
  warning = false,
  onClick,
}: {
  active: boolean;
  icon: typeof ShieldAlert;
  title: string;
  detail: string;
  warning?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-[#303035]">
      <Icon size={15} className={`mt-0.5 shrink-0 ${warning ? 'text-amber-300' : 'text-[#a8a8b0]'}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-medium ${warning ? 'text-amber-300' : 'text-white'}`}>{title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-[#85858d]">{detail}</span>
      </span>
      {active && <span className={warning ? 'text-amber-300' : 'text-sky-400'}>✓</span>}
    </button>
  );
}
