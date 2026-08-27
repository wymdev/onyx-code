import { useEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Cpu,
  Bug,
  Files,
  GitBranch,
  Package,
  Search,
  Settings,
  User,
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
  const [profile, setProfile] = useState<{
    username: string;
    displayName: string;
    email: string | null;
    homeDirectory: string;
  } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.profile?.local().then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [profileOpen]);

  const initials = profile?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const topIcons = [
    { id: 'explorer' as const, icon: Files, label: 'Explorer (Ctrl+Shift+E)', badge: badgeCounts.explorer },
    { id: 'search' as const, icon: Search, label: 'Search (Ctrl+Shift+F)' },
    { id: 'git' as const, icon: GitBranch, label: 'Source Control (Ctrl+Shift+G)', badge: badgeCounts.git },
    { id: 'debug' as const, icon: Bug, label: 'Run & Debug (Ctrl+Shift+D)' },
    { id: 'extensions' as const, icon: Package, label: 'Extensions (Ctrl+Shift+X)' },
    { id: 'ai' as const, icon: Cpu, label: 'Local AI Assistant & Agent (Ctrl+Shift+A)' },
  ];

  return (
    <div className="workbench-activity flex h-full w-12 flex-col items-center justify-between border-r border-[#252526] bg-[#18181b] py-2 text-[#858585] select-none">
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
        <div ref={profileMenuRef} className="relative flex h-10 w-full items-center justify-center">
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${profileOpen ? 'bg-[#37373d] text-white' : 'text-[#858585] hover:bg-[#2a2d2e] hover:text-white'}`}
            title={profile ? `Accounts · ${profile.displayName}` : 'Accounts'}
            aria-expanded={profileOpen}
          >
            {initials ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#5a5a5f] bg-[#27272a] text-[10px] font-semibold text-[#d4d4d8]">
                {initials}
              </span>
            ) : <User size={19} strokeWidth={1.5} />}
          </button>

          {profileOpen && (
            <div className="absolute bottom-0 left-11 z-[280] w-64 overflow-hidden rounded-md border border-[#454545] bg-[#252526] py-1 text-left text-xs text-[#cccccc] shadow-2xl">
              <div className="border-b border-[#3c3c3c] px-3 py-2.5">
                <div className="font-medium text-white">{profile?.displayName || 'Local account'}</div>
                <div className="mt-0.5 truncate text-[11px] text-[#969696]">{profile?.email || profile?.username || 'Profile unavailable'}</div>
                <div className="mt-1 text-[10px] text-[#737373]">Local · macOS</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onOpenSettings?.();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[#094771] hover:text-white"
              >
                <Settings size={13} /> Manage profile settings
                <ChevronRight size={12} className="ml-auto" />
              </button>
            </div>
          )}
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
