import {
  Cpu,
  Bug,
  Files,
  GitBranch,
  Package,
  Search,
  Settings,
} from 'lucide-react';

export type ViewType = 'explorer' | 'search' | 'git' | 'debug' | 'extensions' | 'ai';

interface ActivityBarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  onOpenSettings?: () => void;
  showAIPanel?: boolean;
  onToggleAIPanel?: () => void;
  badgeCounts?: {
    explorer?: number;
    git?: number;
    problems?: number;
  };
}

export default function ActivityBar({
  activeView,
  onViewChange,
  onOpenSettings,
  showAIPanel,
  onToggleAIPanel,
  badgeCounts = {},
}: ActivityBarProps) {
  const topIcons = [
    { id: 'explorer' as const, icon: Files, label: 'Explorer (Ctrl+Shift+E)', badge: badgeCounts.explorer },
    { id: 'search' as const, icon: Search, label: 'Search (Ctrl+Shift+F)' },
    { id: 'git' as const, icon: GitBranch, label: 'Source Control (Ctrl+Shift+G)', badge: badgeCounts.git },
    { id: 'debug' as const, icon: Bug, label: 'Run & Debug (Ctrl+Shift+D)' },
    { id: 'extensions' as const, icon: Package, label: 'Extensions (Ctrl+Shift+X)' },
    { id: 'ai' as const, icon: Cpu, label: 'Local AI Assistant & Agent (Ctrl+Shift+A)' },
  ];

  return (
    <div className="flex h-full w-12 flex-col items-center justify-between border-r border-[#252526] bg-[#18181b] py-2 text-[#858585] select-none">
      {/* Top Icons */}
      <div className="flex w-full flex-col items-center gap-1">
        {topIcons.map((item) => {
          const isActive = item.id === 'ai' ? showAIPanel : activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'ai') {
                  onToggleAIPanel?.();
                } else {
                  onViewChange(item.id);
                }
              }}
              className={`group relative flex h-10 w-full items-center justify-center transition-colors ${
                isActive ? 'text-white' : 'text-[#858585] hover:text-white'
              }`}
              title={item.label}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-[#007acc]" />
              )}
              <item.icon size={19} strokeWidth={1.5} className="transition-transform group-hover:scale-105" />

              {/* Badge if present */}
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className="absolute bottom-1 right-2 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#007acc] px-1 text-[9px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Icons: User & Settings */}
      <div className="flex w-full flex-col items-center gap-1">
        {/* User / Account Avatar */}
        <div
          className="relative flex h-10 w-full items-center justify-center text-[#858585]"
          title="Local profile"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#27272a] text-[#38bdf8] text-[11px] font-bold border border-[#3f3f46]">
            W
          </div>
        </div>

        {/* Settings Gear */}
        <button
          onClick={onOpenSettings}
          className="group relative flex h-10 w-full items-center justify-center text-[#858585] hover:text-white transition-colors"
          title="Settings (Ctrl+,)"
        >
          <Settings size={19} strokeWidth={1.5} className="transition-transform group-hover:rotate-45" />
        </button>
      </div>
    </div>
  );
}
