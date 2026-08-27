import { useEffect, useMemo, useRef, useState } from 'react';
import {
  File,
  Box,
  FolderOpen,
  LucideIcon,
  Play,
  Search,
  Settings,
  TerminalSquare,
  Zap,
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  icon: LucideIcon;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onNewFile: () => void;
  onSave: () => void;
  onToggleSettings: () => void;
  onRunCode: () => void;
  onGoToLine: () => void;
  onSearchInProject: () => void;
  onViewOutput: () => void;
  onBuildCpp?: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onOpenFolder,
  onOpenFile,
  onNewFile,
  onSave,
  onToggleSettings,
  onRunCode,
  onGoToLine,
  onSearchInProject,
  onViewOutput,
  onBuildCpp,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pluginCommands, setPluginCommands] = useState<Array<{ id: string; title: string; pluginId: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'open-folder',
        label: 'File: Open Folder...',
        description: 'Open a project workspace folder',
        shortcut: 'Ctrl+Shift+O',
        icon: FolderOpen,
        action: () => {
          onOpenFolder();
          onClose();
        },
      },
      {
        id: 'open-file',
        label: 'File: Open File...',
        description: 'Open a file in current workspace',
        shortcut: 'Ctrl+O',
        icon: File,
        action: () => {
          onOpenFile();
          onClose();
        },
      },
      {
        id: 'new-file',
        label: 'File: New File...',
        description: 'Create a new file in workspace',
        shortcut: 'Ctrl+N',
        icon: File,
        action: () => {
          onNewFile();
          onClose();
        },
      },
      {
        id: 'save-file',
        label: 'File: Save',
        description: 'Save the active file to disk',
        shortcut: 'Ctrl+S',
        icon: File,
        action: () => {
          onSave();
          onClose();
        },
      },
      {
        id: 'run-code',
        label: 'Run: Start Debugging / Run',
        description: 'Compile and run active file (C++, Python, JS)',
        shortcut: 'F5',
        icon: Play,
        action: () => {
          onRunCode();
          onClose();
        },
      },
      {
        id: 'build-cpp',
        label: 'C++: Build Active File (g++)',
        description: 'Compile C++20 source with GCC without running',
        shortcut: 'Ctrl+Shift+B',
        icon: Zap,
        action: () => {
          onBuildCpp?.();
          onClose();
        },
      },
      {
        id: 'go-to-line',
        label: 'Go to Line...',
        description: 'Jump directly to line number in active file',
        shortcut: 'Ctrl+G',
        icon: Zap,
        action: () => {
          onGoToLine();
          onClose();
        },
      },
      {
        id: 'search-project',
        label: 'Search: Find in Files',
        description: 'Search text and symbols across workspace',
        shortcut: 'Ctrl+Shift+F',
        icon: Search,
        action: () => {
          onSearchInProject();
          onClose();
        },
      },
      {
        id: 'view-output',
        label: 'View: Toggle Output / Terminal',
        description: 'Open the bottom dock panel',
        shortcut: 'Ctrl+`',
        icon: TerminalSquare,
        action: () => {
          onViewOutput();
          onClose();
        },
      },
      {
        id: 'open-settings',
        label: 'Preferences: Open User Settings',
        description: 'Configure font size, tab size, themes',
        shortcut: 'Ctrl+,',
        icon: Settings,
        action: () => {
          onToggleSettings();
          onClose();
        },
      },
      ...pluginCommands.map((command) => ({
        id: `plugin-${command.id}`,
        label: command.title,
        description: `Plugin command from ${command.pluginId}`,
        icon: Box,
        action: () => {
          window.plugins?.invokeCommand(command.id).catch((error) => {
            alert(error instanceof Error ? error.message : 'Plugin command failed');
          });
          onClose();
        },
      })),
    ],
    [onClose, onGoToLine, onNewFile, onOpenFile, onOpenFolder, onRunCode, onBuildCpp, onSave, onSearchInProject, onToggleSettings, onViewOutput, pluginCommands]
  );

  const filteredCommands = query.trim()
    ? commands.filter(
        (command) =>
          command.label.toLowerCase().includes(query.toLowerCase()) ||
          command.description.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('');
    window.plugins?.commands().then(setPluginCommands).catch(() => setPluginCommands([]));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, filteredCommands.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      filteredCommands[selectedIndex]?.action();
    }
    if (event.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] font-sans" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative mx-4 w-full max-w-[620px] overflow-hidden rounded-xl border border-[#27272a] bg-[#1f1f23] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[#27272a] px-4 py-3 bg-[#18181b]">
          <Search size={16} className="text-[#858585]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or file name..."
            className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[#6f7192]"
          />
          <kbd className="rounded border border-[#27272a] bg-[#27272a] px-1.5 py-0.5 text-[10px] text-[#a1a1aa]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-1">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[#6f7192]">
              No commands found for &quot;{query}&quot;
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                onClick={command.action}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  index === selectedIndex ? 'bg-[#007acc] text-white' : 'text-[#cccccc] hover:bg-[#27272a]'
                }`}
              >
                <command.icon
                  size={15}
                  className={index === selectedIndex ? 'text-white' : 'text-[#38bdf8]'}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{command.label}</div>
                  <div className={`truncate text-[11px] ${index === selectedIndex ? 'text-white/80' : 'text-[#6f7192]'}`}>
                    {command.description}
                  </div>
                </div>
                {command.shortcut && (
                  <kbd
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      index === selectedIndex
                        ? 'bg-white/20 text-white'
                        : 'border border-[#27272a] bg-[#18181b] text-[#858585]'
                    }`}
                  >
                    {command.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
