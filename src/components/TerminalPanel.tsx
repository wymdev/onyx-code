import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ChevronDown, Columns, Plus, RotateCcw, TerminalSquare, Trash2, X } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

type ProfileId = 'powershell' | 'cmd' | 'gitbash';

interface TerminalProfile {
  id: ProfileId;
  label: string;
  available: boolean;
}

interface TerminalSession {
  id: string;
  profile: ProfileId;
  label: string;
}

const FALLBACK_PROFILES: TerminalProfile[] = [
  { id: 'powershell', label: 'PowerShell', available: true },
  { id: 'cmd', label: 'Command Prompt', available: true },
  { id: 'gitbash', label: 'Git Bash', available: false },
];

function createId() {
  return `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function TerminalInstance({ session, visible }: { session: TerminalSession; visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      theme: {
        background: '#111113',
        foreground: '#d7d7dc',
        cursor: '#e5e7eb',
        cursorAccent: '#111113',
        selectionBackground: '#264f78',
        black: '#18181b',
        red: '#f87171',
        green: '#86efac',
        yellow: '#fde047',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#67e8f9',
        white: '#e5e7eb',
      },
      fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.18,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowTransparency: false,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminalRef.current = terminal;
    fitRef.current = fit;

    const fitAndSync = () => {
      if (!container.offsetWidth || !container.offsetHeight) return;
      try {
        fit.fit();
        window.runtime?.resizeTerminal?.(session.id, terminal.cols, terminal.rows);
      } catch {
        // A panel resize can race with a hidden session; the next observer pass will fit it.
      }
    };

    const unsubscribeData = window.runtime?.onTerminalData?.((payload) => {
      if (payload.id === session.id) terminal.write(payload.data);
    });
    const unsubscribeExit = window.runtime?.onTerminalExit?.((payload) => {
      if (payload.id === session.id) {
        terminal.write(`\r\n\x1b[33mProcess exited with code ${payload.exitCode}. Use Restart to open it again.\x1b[0m\r\n`);
      }
    });
    const inputDisposable = terminal.onData((data) => window.runtime?.sendTerminalInput?.(session.id, data));
    const resizeObserver = new ResizeObserver(fitAndSync);
    resizeObserver.observe(container);

    requestAnimationFrame(() => {
      fitAndSync();
      if (window.runtime?.createTerminal) {
        window.runtime.createTerminal({
          id: session.id,
          profile: session.profile,
          cols: terminal.cols,
          rows: terminal.rows,
        });
      } else {
        terminal.writeln('\x1b[33mThe interactive terminal is available in the Onyx Code desktop app.\x1b[0m');
      }
    });

    return () => {
      resizeObserver.disconnect();
      inputDisposable.dispose();
      unsubscribeData?.();
      unsubscribeExit?.();
      window.runtime?.killTerminal?.(session.id);
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [session.id, session.profile]);

  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        const terminal = terminalRef.current;
        if (terminal) window.runtime?.resizeTerminal?.(session.id, terminal.cols, terminal.rows);
        terminal?.focus();
      } catch {
        // The session may still be mounting.
      }
    });
  }, [session.id, visible]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden px-2 py-1" />;
}

export default function TerminalPanel() {
  const [profiles, setProfiles] = useState<TerminalProfile[]>(FALLBACK_PROFILES);
  const [defaultProfile, setDefaultProfile] = useState<ProfileId>(() => {
    const saved = localStorage.getItem('onyx_terminal_profile');
    return saved === 'cmd' || saved === 'gitbash' ? saved : 'powershell';
  });
  const [sessions, setSessions] = useState<TerminalSession[]>(() => [
    { id: createId(), profile: defaultProfile, label: defaultProfile === 'cmd' ? 'Command Prompt' : defaultProfile === 'gitbash' ? 'Git Bash' : 'PowerShell' },
  ]);
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [splitId, setSplitId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.runtime?.getTerminalProfiles?.().then((availableProfiles) => {
      setProfiles(availableProfiles);
      if (!availableProfiles.some((profile) => profile.id === defaultProfile && profile.available)) {
        setDefaultProfile(availableProfiles.find((profile) => profile.available)?.id || 'powershell');
      }
    }).catch(() => setProfiles(FALLBACK_PROFILES));
  }, [defaultProfile]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const addSession = (profileId: ProfileId = defaultProfile, split = false) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (profile && !profile.available) return;
    const session = { id: createId(), profile: profileId, label: profile?.label || 'Terminal' };
    setSessions((current) => [...current, session]);
    if (split && activeId) setSplitId(session.id);
    else {
      setActiveId(session.id);
      setSplitId(null);
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    const onNewTerminal = () => addSession();
    const onSplitTerminal = () => addSession(defaultProfile, true);
    window.addEventListener('terminal-new', onNewTerminal);
    window.addEventListener('terminal-split', onSplitTerminal);
    return () => {
      window.removeEventListener('terminal-new', onNewTerminal);
      window.removeEventListener('terminal-split', onSplitTerminal);
    };
  }, [defaultProfile, profiles, activeId]);

  const removeSession = (id: string) => {
    setSessions((current) => {
      const next = current.filter((session) => session.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || '');
      return next;
    });
    if (splitId === id) setSplitId(null);
  };

  const restartActive = () => {
    const current = sessions.find((session) => session.id === activeId);
    if (!current) return;
    const replacement = { ...current, id: createId() };
    setSessions((items) => items.map((item) => item.id === current.id ? replacement : item));
    setActiveId(replacement.id);
    if (splitId === current.id) setSplitId(replacement.id);
  };

  const selectSession = (id: string) => {
    if (id === splitId) {
      setSplitId(activeId);
      setActiveId(id);
    } else {
      setActiveId(id);
    }
  };

  const activeSession = sessions.find((session) => session.id === activeId);

  return (
    <div className="flex h-full w-full flex-col bg-[#111113] text-xs text-[#b8b8c0]">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#29292d] bg-[#18181b] px-2 select-none">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {sessions.map((session, index) => (
            <button
              type="button"
              key={session.id}
              onClick={() => selectSession(session.id)}
              className={`group flex h-6 shrink-0 items-center gap-1.5 rounded px-2 transition-colors ${
                session.id === activeId || session.id === splitId ? 'bg-[#2a2a2e] text-white' : 'hover:bg-[#232326] hover:text-white'
              }`}
            >
              <TerminalSquare size={12} className="text-sky-400" />
              <span>{session.label}</span>
              <span className="text-[10px] text-[#707078]">{index + 1}</span>
              <X
                size={11}
                onClick={(event) => {
                  event.stopPropagation();
                  removeSession(session.id);
                }}
                className="ml-1 opacity-0 hover:text-red-300 group-hover:opacity-100"
              />
            </button>
          ))}
        </div>

        <div className="relative ml-2 flex shrink-0 items-center gap-0.5" ref={menuRef}>
          <button type="button" onClick={() => addSession()} className="rounded p-1 hover:bg-[#2a2a2e] hover:text-white" title={`New ${profiles.find((profile) => profile.id === defaultProfile)?.label || 'terminal'}`}>
            <Plus size={14} />
          </button>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded p-1 hover:bg-[#2a2a2e] hover:text-white" title="Terminal profiles and actions">
            <ChevronDown size={13} />
          </button>
          <button type="button" onClick={() => addSession(defaultProfile, true)} className="rounded p-1 hover:bg-[#2a2a2e] hover:text-white" title="Split Terminal">
            <Columns size={13} />
          </button>
          <button type="button" onClick={restartActive} disabled={!activeSession} className="rounded p-1 hover:bg-[#2a2a2e] hover:text-white disabled:opacity-30" title="Restart Terminal">
            <RotateCcw size={13} />
          </button>
          <button type="button" onClick={() => activeSession && removeSession(activeSession.id)} disabled={!activeSession} className="rounded p-1 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30" title="Kill Terminal">
            <Trash2 size={13} />
          </button>

          {menuOpen && (
            <div className="absolute bottom-10 right-3 z-50 w-64 overflow-hidden rounded-lg border border-[#34343a] bg-[#202023] py-1 shadow-2xl">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">New terminal with profile</div>
              {profiles.map((profile) => (
                <button
                  type="button"
                  key={profile.id}
                  disabled={!profile.available}
                  onClick={() => addSession(profile.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[#d1d1d6] hover:bg-[#007acc] hover:text-white disabled:cursor-not-allowed disabled:text-[#57575f] disabled:hover:bg-transparent"
                >
                  <TerminalSquare size={13} />
                  <span>{profile.label}</span>
                  {!profile.available && <span className="ml-auto text-[10px]">Not found</span>}
                </button>
              ))}
              <div className="my-1 border-t border-[#34343a]" />
              <button type="button" onClick={() => addSession(defaultProfile, true)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#2b2b30] hover:text-white">
                <Columns size={13} /> Split terminal
              </button>
              <div className="my-1 border-t border-[#34343a]" />
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#71717a]">Default profile</div>
              {profiles.filter((profile) => profile.available).map((profile) => (
                <button
                  type="button"
                  key={`default-${profile.id}`}
                  onClick={() => {
                    setDefaultProfile(profile.id);
                    localStorage.setItem('onyx_terminal_profile', profile.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center px-3 py-1.5 text-left hover:bg-[#2b2b30] hover:text-white"
                >
                  <span className="w-5 text-sky-400">{defaultProfile === profile.id ? '●' : ''}</span>
                  {profile.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {sessions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[#686871]">
            <TerminalSquare size={22} />
            <span>No terminal sessions are running.</span>
            <button type="button" onClick={() => addSession()} className="rounded bg-[#007acc] px-3 py-1.5 text-white hover:bg-[#1686c9]">New terminal</button>
          </div>
        ) : sessions.map((session) => {
          const isVisible = session.id === activeId || session.id === splitId;
          return (
            <div
              key={session.id}
              className={`${isVisible ? 'block' : 'hidden'} min-w-0 flex-1 ${session.id === splitId ? 'border-l border-[#34343a]' : ''}`}
            >
              <TerminalInstance session={session} visible={isVisible} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
