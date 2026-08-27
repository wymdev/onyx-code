import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Search,
  Square,
  X,
} from 'lucide-react';
import OnyxCodeLogo from './OnyxCodeLogo';

interface MenuItemDef {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItemDef[];
}

interface TitleBarProps {
  workspaceName?: string;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onSave?: () => void;
  onSaveAll?: () => void;
  onSaveAs?: () => void;
  onCloseFile?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onGoToFile?: () => void;
  onGoToLine?: () => void;
  onSearchInProject?: () => void;
  onRunCode?: () => void;
  onBuildCpp?: () => void;
  onStopExecution?: () => void;
  onRestartExecution?: () => void;
  onViewOutput?: () => void;
  onViewProblems?: () => void;
  onViewTerminal?: () => void;
  onSplitTerminal?: () => void;
  onOpenDocumentation?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  onReportIssue?: () => void;
  onShowAbout?: () => void;
  onOpenSettings?: () => void;
  onCommandPalette?: () => void;
  showSidebar?: boolean;
  onToggleSidebar?: () => void;
  showBottomPanel?: boolean;
  onToggleBottomPanel?: () => void;
  showAIPanel?: boolean;
  onToggleAIPanel?: () => void;
}

export default function TitleBar({
  workspaceName = 'virgoai',
  onNewFile,
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAll,
  onSaveAs,
  onCloseFile,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
  onFind,
  onReplace,
  onGoToFile,
  onGoToLine,
  onSearchInProject,
  onRunCode,
  onBuildCpp,
  onStopExecution,
  onRestartExecution,
  onViewOutput,
  onViewProblems,
  onViewTerminal,
  onSplitTerminal,
  onOpenDocumentation,
  onOpenKeyboardShortcuts,
  onReportIssue,
  onShowAbout,
  onOpenSettings,
  onCommandPalette,
  showSidebar = true,
  onToggleSidebar,
  showBottomPanel = true,
  onToggleBottomPanel,
  showAIPanel = true,
  onToggleAIPanel,
}: TitleBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const isMacOS = window.electronAPI?.platform === 'darwin';

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New File', shortcut: 'Ctrl+N', action: onNewFile },
        { label: 'New Window', shortcut: 'Ctrl+Shift+N', action: () => window.electronAPI?.newWindow() },
        { separator: true, label: '' },
        { label: 'Open File...', shortcut: 'Ctrl+O', action: onOpenFile },
        { label: 'Open Folder...', shortcut: 'Ctrl+Shift+O', action: onOpenFolder },
        { separator: true, label: '' },
        { label: 'Save', shortcut: 'Ctrl+S', action: onSave },
        { label: 'Save As...', shortcut: 'Ctrl+Shift+S', action: onSaveAs },
        { label: 'Save All', shortcut: 'Ctrl+K S', action: onSaveAll },
        { separator: true, label: '' },
        { label: 'Close File', shortcut: 'Ctrl+W', action: onCloseFile },
        { separator: true, label: '' },
        { label: 'Exit', action: () => window.electronAPI?.close() },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: onUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: onRedo },
        { separator: true, label: '' },
        { label: 'Cut', shortcut: 'Ctrl+X', action: onCut },
        { label: 'Copy', shortcut: 'Ctrl+C', action: onCopy },
        { label: 'Paste', shortcut: 'Ctrl+V', action: onPaste },
        { label: 'Select All', shortcut: 'Ctrl+A', action: onSelectAll },
        { separator: true, label: '' },
        { label: 'Find', shortcut: 'Ctrl+F', action: onFind },
        { label: 'Replace', shortcut: 'Ctrl+H', action: onReplace },
      ],
    },
    {
      label: 'Selection',
      items: [
        { label: 'Select All', shortcut: 'Ctrl+A', action: onSelectAll },
        { label: 'Expand Selection', shortcut: 'Shift+Alt+Right' },
        { label: 'Shrink Selection', shortcut: 'Shift+Alt+Left' },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette...', shortcut: 'Ctrl+Shift+P', action: onCommandPalette },
        { separator: true, label: '' },
        { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: onToggleSidebar },
        { label: 'Search', shortcut: 'Ctrl+Shift+F', action: onSearchInProject },
        { label: 'Source Control', shortcut: 'Ctrl+Shift+G' },
        { label: 'Problems', shortcut: 'Ctrl+Shift+M', action: onViewProblems },
        { label: 'Output', shortcut: 'Ctrl+K Ctrl+H', action: onViewOutput },
        { label: 'Terminal', shortcut: 'Ctrl+`', action: onViewTerminal },
        { label: 'AI Codex Panel', shortcut: 'Ctrl+Shift+A', action: onToggleAIPanel },
      ],
    },
    {
      label: 'Go',
      items: [
        { label: 'Go to File...', shortcut: 'Ctrl+P', action: onGoToFile ?? onCommandPalette },
        { label: 'Go to Line...', shortcut: 'Ctrl+G', action: onGoToLine },
        { label: 'Go to Definition', shortcut: 'F12' },
      ],
    },
    {
      label: 'Run',
      items: [
        { label: 'Start Debugging / Run', shortcut: 'F5', action: onRunCode },
        { label: 'Build C++ File (g++)', shortcut: 'Ctrl+Shift+B', action: onBuildCpp ?? onRunCode },
        { label: 'Stop Execution', shortcut: 'Shift+F5', action: onStopExecution },
        { label: 'Restart Debugging', shortcut: 'Ctrl+Shift+F5', action: onRestartExecution },
      ],
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal', shortcut: 'Ctrl+`', action: onViewTerminal },
        { label: 'Split Terminal', shortcut: 'Ctrl+Shift+5', action: onSplitTerminal },
        { label: 'New Terminal Window', shortcut: 'Ctrl+Shift+Alt+`' },
        { separator: true, label: '' },
        { label: 'Run Task...' },
        { label: 'Run Build Task...', shortcut: 'Ctrl+Shift+B', action: onBuildCpp ?? onRunCode },
        { label: 'Run Active File', shortcut: 'F5', action: onRunCode },
        { label: 'Run Selected Text' },
        { separator: true, label: '' },
        { label: 'Restart Running Task...', action: onRestartExecution },
        { label: 'Terminate Task...', shortcut: 'Shift+F5', action: onStopExecution },
        { separator: true, label: '' },
        { label: 'Configure Tasks...' },
        { label: 'Configure Default Build Task...' },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'Documentation', action: onOpenDocumentation },
        { label: 'Keyboard Shortcuts', shortcut: 'Ctrl+K Ctrl+S', action: onOpenKeyboardShortcuts ?? onCommandPalette },
        { separator: true, label: '' },
        { label: 'Report Issue', action: onReportIssue },
        { label: 'About Onyx Code', action: onShowAbout },
      ],
    },
    {
      label: '...',
      items: [{ label: 'Settings', shortcut: 'Ctrl+,', action: onOpenSettings }],
    },
  ];

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleItemClick = (item: MenuItemDef) => {
    if (item.disabled || item.separator || !item.action) return;
    item.action?.();
    setOpenMenu(null);
  };

  // macOS renders these commands in the system menu bar and uses a native
  // window title strip. Rendering this row as well creates a nested toolbar.
  if (isMacOS) return null;

  return (
    <div className="workbench-titlebar drag-region relative z-50 flex h-[35px] w-full shrink-0 items-center justify-between border-b border-[#2b2b36] bg-[#18181b] px-2 text-[#cccccc] font-sans text-xs select-none">
      {/* Left section: Logo & Menus */}
      <div
        ref={menuBarRef}
        className="no-drag flex h-full items-center"
      >
        <div className="flex h-full items-center px-1.5 cursor-pointer">
          <OnyxCodeLogo size={19} />
        </div>

        <div className="flex h-full items-center ml-1">
          {menus.map((menu) => (
            <div key={menu.label} className="relative h-full">
              <button
                className={`flex h-full items-center px-2 text-[12px] transition-colors rounded-sm my-1 ${
                  openMenu === menu.label
                    ? 'bg-[#27272a] text-white'
                    : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-white'
                }`}
                onClick={() => setOpenMenu((curr) => (curr === menu.label ? null : menu.label))}
                onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
              >
                {menu.label}
              </button>

              {openMenu === menu.label && (
                <div className="absolute left-0 top-full z-[300] min-w-[230px] rounded-md border border-[#27272a] bg-[#1f1f23] py-1 shadow-2xl">
                  {menu.items.map((item, index) =>
                    item.separator ? (
                      <div key={`${menu.label}-sep-${index}`} className="my-1 border-t border-[#27272a]" />
                    ) : (
                      <button
                        key={`${menu.label}-${item.label}-${index}`}
                        onClick={() => handleItemClick(item)}
                        disabled={item.disabled || !item.action}
                        className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors ${
                          item.disabled || !item.action
                            ? 'cursor-not-allowed text-[#555577]'
                            : 'text-[#cccccc] hover:bg-[#007acc] hover:text-white'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span className="ml-6 text-[10px] text-[#858585]">{item.shortcut}</span>}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Center Search / Navigation Pill matching screenshot */}
      <div className="no-drag absolute left-1/2 -translate-x-1/2 flex items-center">
        <button
          onClick={onCommandPalette}
          className="group flex h-[24px] w-[340px] items-center justify-center gap-2 rounded-md border border-[#27272a] bg-[#27272a]/60 px-3 text-xs text-[#a1a1aa] transition-all hover:border-[#38bdf8]/50 hover:bg-[#27272a] hover:text-white"
        >
          <ArrowRight size={13} className="text-[#38bdf8] opacity-80" />
          <span className="font-mono text-[11px] text-[#cccccc]">{workspaceName}</span>
          <div className="flex-1" />
          <Search size={12} className="text-[#71717a] group-hover:text-[#38bdf8]" />
        </button>
      </div>

      {/* Right Layout & Window Controls */}
      <div className="no-drag flex h-full items-center gap-0.5">
        {/* Layout Controls */}
        <button
          onClick={onToggleSidebar}
          className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors ${
            showSidebar ? 'text-white hover:bg-[#333333]' : 'text-[#858585] hover:bg-[#333333]'
          }`}
          title="Toggle Primary Side Bar (Ctrl+B)"
        >
          <PanelLeft size={14} />
        </button>

        <button
          onClick={onToggleBottomPanel}
          className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors ${
            showBottomPanel ? 'text-white hover:bg-[#333333]' : 'text-[#858585] hover:bg-[#333333]'
          }`}
          title="Toggle Panel (Ctrl+`)"
        >
          <PanelBottom size={14} />
        </button>

        <button
          onClick={onToggleAIPanel}
          className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors ${
            showAIPanel ? 'text-white hover:bg-[#333333]' : 'text-[#858585] hover:bg-[#333333]'
          }`}
          title="Toggle Local AI Assistant"
        >
          <PanelRight size={14} />
        </button>

        {/* macOS supplies native traffic lights on the left. */}
        {!isMacOS && (
          <div className="flex items-center ml-2">
            <button
              onClick={() => window.electronAPI?.minimize()}
              className="flex h-[35px] w-[42px] items-center justify-center text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-white"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => window.electronAPI?.maximize()}
              className="flex h-[35px] w-[42px] items-center justify-center text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-white"
              title="Maximize"
            >
              <Square size={12} />
            </button>
            <button
              onClick={() => window.electronAPI?.close()}
              className="flex h-[35px] w-[42px] items-center justify-center text-[#a1a1aa] transition-colors hover:bg-[#e81123] hover:text-white"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
