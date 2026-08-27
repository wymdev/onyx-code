import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Cpu,
  FilePlus,
  FolderOpen,
  Terminal,
  Zap,
} from 'lucide-react';
import { RecentWorkspace } from '../types';
import { CPP_TEMPLATES } from '../services/cppService';
import OnyxCodeLogo from './OnyxCodeLogo';

interface WelcomeTabProps {
  onNewFile: () => Promise<unknown> | void;
  onOpenFile: () => Promise<unknown> | void;
  onOpenFolder: () => Promise<unknown> | void;
  onOpenRecentFolder: (path: string) => Promise<unknown> | void;
  onStartCppProject: (templateId?: string) => Promise<unknown> | void;
  onStartPythonProject: () => Promise<unknown> | void;
  onOpenAIWorkspace: () => Promise<unknown> | void;
}

export default function WelcomeTab({
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onOpenRecentFolder,
  onStartCppProject,
  onStartPythonProject,
  onOpenAIWorkspace,
}: WelcomeTabProps) {
  const [recents, setRecents] = useState<RecentWorkspace[]>([]);
  const [openingRecentPath, setOpeningRecentPath] = useState<string | null>(null);

  useEffect(() => {
    window.fileSystem?.getRecentWorkspaces?.().then(setRecents).catch(() => setRecents([]));
  }, []);

  const actions = [
    { label: 'New file', detail: 'Create an untitled editor', icon: FilePlus, onClick: onNewFile },
    { label: 'Open file', detail: 'Edit a file from your computer', icon: Terminal, onClick: onOpenFile },
    { label: 'Open folder', detail: 'Load a complete workspace', icon: FolderOpen, onClick: onOpenFolder },
  ];

  const openRecentWorkspace = async (path: string) => {
    if (openingRecentPath) return;
    setOpeningRecentPath(path);
    try {
      await onOpenRecentFolder(path);
    } finally {
      setOpeningRecentPath(null);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-[#1e1e1e] text-[#cccccc] select-none">
      <main className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center px-6 py-10 lg:px-12">
        <section className="mb-10 flex flex-col gap-6 border-b border-[#303034] pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-400/15 bg-gradient-to-br from-sky-500/15 to-violet-500/10">
              <div className="absolute inset-2 rounded-xl bg-sky-400/10 blur-xl" />
              <OnyxCodeLogo size={50} className="relative" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white">Onyx Code</h1>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                  LOCAL FIRST
                </span>
              </div>
              <p className="max-w-xl text-sm leading-5 text-[#8f8f98]">
                A focused desktop workspace for coding, running projects, and working with private local AI.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onOpenAIWorkspace()}
            className="group flex shrink-0 items-center gap-2 self-start rounded-lg border border-violet-400/20 bg-violet-400/10 px-3.5 py-2 text-xs font-medium text-violet-200 transition-colors hover:border-violet-400/40 hover:bg-violet-400/15"
          >
            <Cpu size={14} />
            Open local AI
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.15fr]">
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#777780]">Start</h2>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {actions.map((action) => (
                <button
                  type="button"
                  key={action.label}
                  onClick={() => void action.onClick()}
                  className="group flex items-center gap-3 rounded-lg border border-[#303034] bg-[#242426] px-3.5 py-3 text-left transition-all hover:-translate-y-px hover:border-sky-400/35 hover:bg-[#29292c]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1b1b1d] text-sky-400">
                    <action.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-white">{action.label}</span>
                    <span className="block truncate text-[11px] text-[#777780]">{action.detail}</span>
                  </span>
                  <ArrowRight size={13} className="text-[#55555e] group-hover:text-sky-400" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#777780]">Recent workspaces</h2>
              {recents.length > 0 && <span className="text-[10px] text-[#606069]">{recents.length} saved</span>}
            </div>
            <div className="min-h-[156px] rounded-lg border border-[#303034] bg-[#202022] p-2">
              {recents.length === 0 ? (
                <div className="flex min-h-[138px] flex-col items-center justify-center text-center">
                  <FolderOpen size={22} className="mb-2 text-[#5f5f68]" />
                  <p className="text-xs text-[#8b8b94]">No recent workspaces yet</p>
                  <button type="button" onClick={() => void onOpenFolder()} className="mt-1 text-[11px] text-sky-400 hover:text-sky-300">
                    Open your first folder
                  </button>
                </div>
              ) : (
                recents.slice(0, 6).map((item) => (
                  <button
                    type="button"
                    key={item.path}
                    onClick={() => void openRecentWorkspace(item.path)}
                    disabled={openingRecentPath !== null}
                    aria-busy={openingRecentPath === item.path}
                    className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors disabled:cursor-wait ${
                      openingRecentPath === item.path ? 'bg-[#2a2a2d]' : 'hover:bg-[#2a2a2d]'
                    }`}
                  >
                    <FolderOpen size={14} className="shrink-0 text-sky-400/80" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[#d8d8dc] group-hover:text-white">
                        {openingRecentPath === item.path ? `Opening ${item.name}` : item.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#6f6f78]">{item.path}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#777780]">Quick starts</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {CPP_TEMPLATES.slice(0, 2).map((template) => (
              <button
                type="button"
                key={template.id}
                onClick={() => onStartCppProject(template.id)}
                className="rounded-lg border border-[#303034] bg-[#242426] p-3 text-left transition-colors hover:border-sky-400/35 hover:bg-[#29292c]"
              >
                <Zap size={15} className="mb-2 text-sky-400" />
                <span className="block text-xs font-medium text-white">{template.title}</span>
                <span className="mt-1 block text-[10px] leading-4 text-[#777780]">{template.description}</span>
              </button>
            ))}
            <button type="button" onClick={() => void onStartPythonProject()} className="rounded-lg border border-[#303034] bg-[#242426] p-3 text-left transition-colors hover:border-amber-400/35 hover:bg-[#29292c]">
              <Terminal size={15} className="mb-2 text-amber-300" />
              <span className="block text-xs font-medium text-white">Python starter</span>
              <span className="mt-1 block text-[10px] leading-4 text-[#777780]">Open a clean executable Python entry point.</span>
            </button>
            <button type="button" onClick={() => void onOpenAIWorkspace()} className="rounded-lg border border-[#303034] bg-[#242426] p-3 text-left transition-colors hover:border-violet-400/35 hover:bg-[#29292c]">
              <Cpu size={15} className="mb-2 text-violet-300" />
              <span className="block text-xs font-medium text-white">Ollama workspace</span>
              <span className="mt-1 block text-[10px] leading-4 text-[#777780]">Discover installed models and start a local chat.</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
