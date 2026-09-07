import { useEffect, useRef, useState } from 'react';
import {
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Search,
  Square,
  X,
} from 'lucide-react';
import OnyxCodeLogo from './OnyxCodeLogo';
import { appWindow } from '../platform/window';

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
  workspaceName?: string | null;
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
  onOpenCompilerConfig?: () => void;
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
  workspaceName = null,
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
  onOpenCompilerConfig,
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
  const isMacOS = appWindow.isMac();

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'New File', shortcut: 'Ctrl+N', action: onNewFile },
        { label: 'New Window', shortcut: 'Ctrl+Shift+N', action: () => appWindow.newWindow() },
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
        { label: 'Exit', action: () => appWindow.close() },
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
        { label: 'Build Active File', shortcut: 'Ctrl+Shift+B', action: onBuildCpp ?? onRunCode },
        { label: 'Compiler & Build Settings...', action: onOpenCompilerConfig },
        { separator: true, label: '' },
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
    <div className="workbench-titlebar drag-region relative z-50 flex h-[35px] w-full shrink-0 items-center justify-between border-b border-[var(--border-color,#2b2b36)] bg-[var(--titlebar-bg,#18181b)] px-2 text-[var(--text-primary,#cccccc)] font-sans text-xs select-none">
      {/* Left section: Logo & Menus */}
      <div
        ref={menuBarRef}
        className="no-drag flex h-full items-center gap-1"
      >
        <div className="flex h-full items-center px-1.5 cursor-pointer">
          <OnyxCodeLogo size={18} />
        </div>

        <div className="flex h-full items-center">
          {menus.map((menu) => (
            <div key={menu.label} className="relative flex items-center h-full">
              <button
                className={`flex h-[24px] items-center px-2 text-[12px] transition-colors rounded-sm ${
                  openMenu === menu.label
                    ? 'bg-[#2a2d2e] text-white'
                    : 'text-[#a1a1aa] hover:bg-[#2a2d2e] hover:text-white'
                }`}
                onClick={() => setOpenMenu((curr) => (curr === menu.label ? null : menu.label))}
                onMouseEnter={() => openMenu && setOpenMenu(menu.label)}
              >
                {menu.label}
              </button>

              {openMenu === menu.label && (
                <div className="absolute left-0 top-[31px] z-[300] min-w-[230px] rounded-md border border-[var(--border-color,#27272a)] bg-[var(--bg-secondary,#1f1f23)] py-1 shadow-2xl">
                  {menu.items.map((item, index) =>
                    item.separator ? (
                      <div key={`${menu.label}-sep-${index}`} className="my-1 border-t border-[var(--border-color,#27272a)]" />
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

      {/* Center Search / Navigation Pill matching VS Code */}
      <div className="no-drag absolute left-1/2 -translate-x-1/2 flex items-center">
        <button
          onClick={onCommandPalette}
          className="group flex h-[24px] w-[360px] max-w-[40vw] items-center gap-2 rounded-md border border-[#3c3c3c] bg-[#252526] px-3 text-xs text-[#a1a1aa] transition-all hover:border-[var(--accent-blue,#007acc)] hover:text-white shadow-sm"
          title="Search files, commands (Ctrl+P)"
        >
          <Search size={12} className="text-[#858585] group-hover:text-[#38bdf8] shrink-0 transition-colors" />
          <span className="text-[11px] text-[#cccccc] font-medium truncate">
            {workspaceName || 'Onyx Code'}
          </span>
          <div className="flex-1" />
          <span className="text-[10px] text-[#6e6e6e] font-sans shrink-0">Ctrl+P</span>
        </button>
      </div>

      {/* Right Layout & Window Controls */}
      <div className="no-drag flex h-full items-center gap-1">
        {/* Layout Controls */}
        <button
          onClick={onToggleSidebar}
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-sm transition-colors ${
            showSidebar ? 'text-white bg-[#2a2d2e]' : 'text-[#858585] hover:bg-[#2a2d2e] hover:text-white'
          }`}
          title="Toggle Primary Side Bar (Ctrl+B)"
        >
          <PanelLeft size={14} />
        </button>

        <button
          onClick={onToggleBottomPanel}
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-sm transition-colors ${
            showBottomPanel ? 'text-white bg-[#2a2d2e]' : 'text-[#858585] hover:bg-[#2a2d2e] hover:text-white'
          }`}
          title="Toggle Panel (Ctrl+`)"
        >
          <PanelBottom size={14} />
        </button>

        <button
          onClick={onToggleAIPanel}
          className={`flex h-[26px] w-[26px] items-center justify-center rounded-sm transition-colors ${
            showAIPanel ? 'text-white bg-[#2a2d2e]' : 'text-[#858585] hover:bg-[#2a2d2e] hover:text-white'
          }`}
          title="Toggle Local AI Assistant"
        >
          <PanelRight size={14} />
        </button>

        {/* If in web browser preview, show a helpful badge */}
        {!appWindow.isAvailable() && (
          <span
            className="px-2 py-0.5 ml-2 mr-3 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25 select-none"
            title="Running in Web Preview. For full desktop terminal, GCC/G++ compilers, and native dialogs, launch with 'npm run dev' or 'npm run electron:dev'."
          >
            Web Preview
          </span>
        )}

        {/* Electron desktop window controls (Windows / Linux) */}
        {appWindow.isAvailable() && !isMacOS && (
          <div className="flex items-center ml-1.5 h-full">
            <button
              onClick={() => appWindow.minimize()}
              className="flex h-[35px] w-[46px] items-center justify-center text-[#a1a1aa] transition-colors hover:bg-[#2a2d2e] hover:text-white"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => appWindow.maximize()}
              className="flex h-[35px] w-[46px] items-center justify-center text-[#a1a1aa] transition-colors hover:bg-[#2a2d2e] hover:text-white"
              title="Maximize"
            >
              <Square size={12} />
            </button>
            <button
              onClick={() => appWindow.close()}
              className="flex h-[35px] w-[46px] items-center justify-center text-[#a1a1aa] transition-colors hover:bg-[#e81123] hover:text-white"
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
