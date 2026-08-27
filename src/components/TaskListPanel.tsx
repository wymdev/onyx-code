import { CheckCircle2, Circle } from 'lucide-react';
import { TaskItem } from '../services/agentLoop';

interface TaskListPanelProps {
  tasks: TaskItem[];
}

export default function TaskListPanel({ tasks }: TaskListPanelProps) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="py-1 text-xs">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[#71717a]">
        Tasks
      </div>
      <div className="space-y-1.5">
        {tasks.map((task, idx) => (
          <div key={idx} className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              {task.status === 'pending' && <Circle size={13} className="text-[#626269]" />}
              {task.status === 'in_progress' && <Circle size={13} className="text-[#a1a1aa]" />}
              {task.status === 'done' && <CheckCircle2 size={13} className="text-emerald-400" />}
            </div>
            <div className={`flex-1 leading-relaxed ${task.status === 'done' ? 'text-[#77777f] line-through' : 'text-[#c7c7ce]'}`}>
              {task.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
