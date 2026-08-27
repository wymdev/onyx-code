import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { AgentStep } from '../services/agentLoop';

interface AgentStepViewProps {
  step: AgentStep;
}

function getFileName(value: unknown) {
  const path = typeof value === 'string' ? value : '';
  return path.split(/[/\\]/).filter(Boolean).pop() || '';
}

export function getAgentActivityLabel(step?: AgentStep) {
  if (!step) return 'Thinking';

  const fileName = getFileName(step.args.path);
  switch (step.tool) {
    case 'read_file': return fileName ? `Reading ${fileName}` : 'Reading';
    case 'list_directory': return 'Reading files';
    case 'search_files': return 'Searching';
    case 'edit_file': return fileName ? `Editing ${fileName}` : 'Editing';
    case 'write_file': return fileName ? `Writing ${fileName}` : 'Writing';
    case 'delete_file': return fileName ? `Deleting ${fileName}` : 'Deleting';
    case 'delete_directory': return fileName ? `Deleting ${fileName}` : 'Deleting folder';
    case 'run_command': return 'Running';
    case 'update_task_list': return 'Planning';
    case 'task_complete': return 'Finishing';
    default: return 'Working';
  }
}

function cleanSummary(summary: string) {
  return summary.replace(/\.{2,}\s*$/, '').replace(/_/g, ' ');
}

export default function AgentStepView({ step }: AgentStepViewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activityLabel = getAgentActivityLabel(step);

  const formatInput = () => {
    if (step.tool === 'run_command') return String(step.args.command || '');
    if (step.tool === 'update_task_list' && Array.isArray(step.args.tasks)) {
      return step.args.tasks
        .map((task: any) => `${task.status === 'done' ? 'Completed' : task.status === 'in_progress' ? 'In progress' : 'Pending'} — ${task.text}`)
        .join('\n');
    }
    if (typeof step.args.path === 'string') return step.args.path;
    if (typeof step.args.query === 'string') return step.args.query;
    try {
      return JSON.stringify(step.args, null, 2);
    } catch {
      return String(step.args);
    }
  };

  const inputLabel = step.tool === 'run_command'
    ? 'Command'
    : step.tool === 'update_task_list'
    ? 'Plan'
    : typeof step.args.path === 'string'
    ? 'Path'
    : 'Input';

  return (
    <div className="overflow-hidden border-l border-[#34343b] pl-3 text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-[#202025]"
      >
        <span className="mt-0.5 text-[#63636d] group-hover:text-[#a1a1aa]">
          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          {step.status === 'running' ? (
            <span className="agent-status-shimmer font-medium">{activityLabel}</span>
          ) : step.status === 'awaiting_permission' ? (
            <span className="font-medium text-amber-300">Waiting for approval</span>
          ) : (
            <span className={step.status === 'error' ? 'text-red-300' : 'text-[#c7c7ce]'}>
              {cleanSummary(step.summary)}
            </span>
          )}
        </span>
        <span className="mt-0.5 shrink-0">
          {step.status === 'awaiting_permission' && <ShieldAlert size={13} className="text-amber-300" />}
          {step.status === 'done' && <CheckCircle2 size={13} className="text-emerald-400" />}
          {step.status === 'error' && <XCircle size={13} className="text-red-400" />}
        </span>
      </button>

      {isOpen && (
        <div className="mb-2 ml-7 mr-2 rounded-md border border-[#29292f] bg-[#121216] p-3 text-[10.5px] text-[#8b91aa]">
          <div>
            <span className="font-medium uppercase tracking-wider text-[#71717a]">{inputLabel}</span>
            <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded bg-[#18181d] p-2 font-mono leading-relaxed text-[#c7c7ce]">
              {formatInput()}
            </pre>
          </div>
          {step.detail && (
            <div className="mt-3">
              <span className="font-medium uppercase tracking-wider text-[#71717a]">Result</span>
              <pre className={`mt-1.5 max-h-48 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words rounded bg-[#18181d] p-2 font-mono leading-relaxed ${step.status === 'error' ? 'text-red-300' : 'text-[#c7c7ce]'}`}>
                {step.detail}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
