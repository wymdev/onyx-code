import { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Code2,
  File,
  FileCode,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  History,
  MinusSquare,
  RefreshCw,
  Search,
  Zap,
  X,
  Circle,
} from 'lucide-react';
import { Menu, Item, Separator, useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';
import GitView from './GitView';
import RunDebugView from './RunDebugView';
import ExtensionsView from './ExtensionsView';
import { ViewType } from './ActivityBar';
import { FileNode, OpenFile } from '../types';

const MENU_ID = 'sidebar-context-menu';

interface SidebarProps {
  activeView: ViewType;
  width: number;
  onWidthChange: (width: number) => void;
  onFileOpen?: (filePath: string) => void;
  rootPath: string | null;
  fileTree: FileNode[];
  openFiles?: OpenFile[];
  activeFileIndex?: number;
  onFileSelect?: (index: number) => void;
  onFileClose?: (index: number) => void;
  onOpenFolder: () => void;
  onRefresh?: () => void;
  onCreateFile?: (relativePath?: string) => Promise<boolean> | boolean;
  onCreateFolder?: (relativePath?: string) => Promise<boolean> | boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onRunCode?: () => void;
  onStopCode?: () => void;
  runState?: 'idle' | 'running' | 'stopped' | 'error';
  activeFile?: OpenFile;
}

export default function Sidebar({
  activeView,
  width,
  onWidthChange,
  onFileOpen,
  rootPath,
  fileTree,
  openFiles = [],
  activeFileIndex = 0,
  onFileSelect,
  onFileClose,
  onOpenFolder,
  onRefresh,
  onCreateFile,
  onCreateFolder,
  searchQuery,
  onSearchQueryChange,
  onRunCode,
  onStopCode,
  runState = 'idle',
  activeFile,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creation, setCreation] = useState<{ type: 'file' | 'folder'; value: string; error: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { show } = useContextMenu({ id: MENU_ID });

  const [expandedAccordions, setExpandedAccordions] = useState({
    openEditors: true,
    explorer: true,
    outline: false,
    timeline: false,
  });

  const toggleAccordion = (key: keyof typeof expandedAccordions) => {
    setExpandedAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleContextMenu = (event: React.MouseEvent, node: FileNode) => {
    event.stopPropagation();
    show({ event, props: { node } });
  };

  const [searchResults, setSearchResults] = useState<{ path: string; name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = (await window.fileSystem?.searchFiles?.(searchQuery)) || [];
        setSearchResults(results);
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
  };

  const submitCreation = async () => {
    if (!creation) return;
    const value = creation.value.trim().replace(/^[/\\]+/, '');
    if (!value) {
      setCreation({ ...creation, error: 'Enter a name or relative path.' });
      return;
    }
    if (value.split(/[\\/]/).some((part) => part === '..')) {
      setCreation({ ...creation, error: 'The path cannot leave the workspace.' });
      return;
    }
    const success = creation.type === 'file'
      ? await onCreateFile?.(value)
      : await onCreateFolder?.(value);
    if (success !== false) setCreation(null);
  };

  const refreshExplorer = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const startResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (moveEvent: MouseEvent) => {
      onWidthChange(Math.max(190, Math.min(480, startWidth + moveEvent.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleFileClick = (node: FileNode) => {
    if (node.type === 'directory') {
      toggleFolder(node.path);
      return;
    }
    onFileOpen?.(node.path);
  };

  const getFileIconData = (extension?: string, name?: string) => {
    const ext = (extension || name?.split('.').pop() || '').toLowerCase();
    const fileName = (name || '').toLowerCase();

    if (fileName === 'dockerfile' || fileName.includes('docker-compose')) {
      return { icon: FileCode, color: '#38bdf8' };
    }
    if (fileName === '.gitignore') {
      return { icon: FileCode, color: '#f97316' };
    }

    switch (ext) {
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'hpp':
      case 'h':
      case 'c':
        return { icon: Zap, color: '#007acc' };
      case 'ts':
      case 'tsx':
        return { icon: FileCode, color: '#3178c6' };
      case 'js':
      case 'jsx':
      case 'mjs':
        return { icon: FileCode, color: '#f7df1e' };
      case 'py':
        return { icon: FileCode, color: '#3572a5' };
      case 'json':
        return { icon: FileCode, color: '#cbcb41' };
      case 'html':
        return { icon: FileCode, color: '#e34f26' };
      case 'css':
        return { icon: FileCode, color: '#563d7c' };
      case 'md':
        return { icon: FileText, color: '#42a5f5' };
      case 'bat':
      case 'ps1':
      case 'sh':
        return { icon: FileCode, color: '#4caf50' };
      default:
        return { icon: File, color: '#858585' };
    }
  };

  const outlineSymbols = useMemo(() => {
    if (!activeFile) return [];
    const ignored = new Set(['if', 'for', 'while', 'switch', 'catch']);
    return activeFile.content
      .split('\n')
      .flatMap((line, index) => {
        const typeMatch = line.match(/^\s*(?:export\s+)?(?:class|struct|interface|enum)\s+([A-Za-z_$][\w$]*)/);
        if (typeMatch) return [{ name: typeMatch[1], kind: 'type', line: index + 1 }];
        const functionMatch = line.match(
          /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+|def\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?:\{|:|=>)/
        );
        if (functionMatch && !ignored.has(functionMatch[1])) {
          return [{ name: `${functionMatch[1]}()`, kind: 'function', line: index + 1 }];
        }
        return [];
      })
      .slice(0, 50);
  }, [activeFile]);

  const renderTree = (nodes: FileNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const isDir = node.type === 'directory';
      const isExpanded = expandedFolders.has(node.path);
      const iconData = getFileIconData(node.extension, node.name);
      const IconComponent = iconData.icon;

      return (
        <div key={node.path}>
          <div
            className={`group flex items-center gap-1.5 px-2 py-0.5 text-xs text-[#cccccc] cursor-pointer hover:bg-[#27272a] ${
              activeFile?.path === node.path ? 'bg-[#27272a] text-white font-medium' : ''
            }`}
            style={{ paddingLeft: `${12 + depth * 14}px` }}
            onClick={() => handleFileClick(node)}
            onContextMenu={(e) => handleContextMenu(e, node)}
          >
            {isDir ? (
              <>
                {isExpanded ? (
                  <ChevronDown size={14} className="text-[#858585] shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-[#858585] shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen size={15} className="text-[#dcb67a] shrink-0" />
                ) : (
                  <Folder size={15} className="text-[#dcb67a] shrink-0" />
                )}
              </>
            ) : (
              <>
                <span className="w-3.5" />
                <IconComponent size={14} style={{ color: iconData.color }} className="shrink-0" />
              </>
            )}
            <span className="truncate text-[12px]">{node.name}</span>
          </div>
          {isDir && isExpanded && node.children && renderTree(node.children, depth + 1)}
        </div>
      );
    });

  const getFolderName = (targetPath: string | null) => {
    if (!targetPath) return 'NO FOLDER OPENED';
    return targetPath.split(/[\\/]/).pop()?.toUpperCase() || 'PROJECT';
  };

  return (
    <div className="relative flex shrink-0 flex-col overflow-hidden border-r border-[#27272a] bg-[#18181b] font-sans text-xs select-none" style={{ width }}>
      {/* View Title */}
      {activeView === 'explorer' && (
        <div className="flex h-9 items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
          <span>Explorer</span>
            <div className="flex items-center gap-1 text-[#858585]">
              <button
                type="button"
                onClick={() => rootPath ? setCreation({ type: 'file', value: '', error: '' }) : onCreateFile?.()}
                className="rounded p-1 hover:bg-[#27272a] hover:text-white"
                title="New File"
              >
                <FilePlus size={14} />
              </button>
              <button type="button" onClick={() => setCreation({ type: 'folder', value: '', error: '' })} disabled={!rootPath} className="rounded p-1 hover:bg-[#27272a] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent" title={rootPath ? 'New Folder' : 'Open a folder before creating a subfolder'}>
                <FolderPlus size={14} />
              </button>
              <button type="button" onClick={() => onOpenFolder()} className="rounded p-1 hover:bg-[#27272a] hover:text-white" title="Open Folder">
                <FolderOpen size={14} />
              </button>
              <button type="button" onClick={refreshExplorer} disabled={!rootPath || isRefreshing} className="rounded p-1 hover:bg-[#27272a] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent" title="Refresh Explorer">
                <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
              <button type="button" onClick={handleCollapseAll} disabled={!rootPath} className="rounded p-1 hover:bg-[#27272a] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent" title="Collapse Folders in Explorer">
                <MinusSquare size={13} />
              </button>
            </div>
        </div>
      )}

      {/* Explorer Content */}
      {activeView === 'explorer' && (
        <div className="flex-1 overflow-y-auto">
          {/* OPEN EDITORS Section */}
          {openFiles.length > 0 && (
            <div className="border-b border-[#27272a]">
              <div
                onClick={() => toggleAccordion('openEditors')}
                className="flex cursor-pointer items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#8b91aa] hover:bg-[#202026]"
              >
                <div className="flex items-center gap-1">
                  {expandedAccordions.openEditors ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span>OPEN EDITORS</span>
                </div>
                <span className="text-[10px] text-[#6f7192]">{openFiles.length}</span>
              </div>

              {expandedAccordions.openEditors && (
                <div className="pb-1">
                  {openFiles.map((file, idx) => {
                    const iconData = getFileIconData(undefined, file.name);
                    const IconComponent = iconData.icon;
                    return (
                      <div
                        key={file.path}
                        onClick={() => onFileSelect?.(idx)}
                        className={`group flex cursor-pointer items-center justify-between px-4 py-1 text-xs transition-colors hover:bg-[#27272a] ${
                          idx === activeFileIndex ? 'bg-[#27272a] text-white font-medium' : 'text-[#a1a1aa]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <IconComponent size={13} style={{ color: iconData.color }} className="shrink-0" />
                          <span className="truncate text-[12px]">{file.name}</span>
                          {file.isDirty && <Circle size={5} className="text-white fill-current shrink-0" />}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onFileClose?.(idx);
                          }}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-[#858585] hover:bg-[#3f3f46] hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* WORKSPACE TREE Section */}
          <div className="border-b border-[#27272a]">
            {rootPath ? (
              <div
                onClick={() => toggleAccordion('explorer')}
                className="flex cursor-pointer items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#8b91aa] hover:bg-[#202026]"
              >
                <div className="flex items-center gap-1">
                  {expandedAccordions.explorer ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="truncate">{getFolderName(rootPath)}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center">
                <p className="text-xs text-[#858585] mb-3">You have not yet opened a folder.</p>
                <button
                  onClick={() => onOpenFolder()}
                  className="flex w-full items-center justify-center gap-2 rounded bg-[#007acc] px-3 py-1.5 text-xs text-white font-medium hover:bg-[#0284c7] transition-colors"
                >
                  <FolderOpen size={14} />
                  Open Folder
                </button>
              </div>
            )}

            {rootPath && expandedAccordions.explorer && (
              <div className="py-1">
                {creation && (
                  <div className="px-2 pb-1">
                    <div className={`flex items-center gap-1.5 rounded border bg-[#0f0f12] px-1.5 py-1 ${creation.error ? 'border-red-500/70' : 'border-[#007acc]'}`}>
                      {creation.type === 'file' ? <FilePlus size={13} className="text-sky-400" /> : <FolderPlus size={13} className="text-amber-300" />}
                      <input
                        autoFocus
                        value={creation.value}
                        onChange={(event) => setCreation({ ...creation, value: event.target.value, error: '' })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') submitCreation();
                          if (event.key === 'Escape') setCreation(null);
                        }}
                        placeholder={creation.type === 'file' ? 'file.ext or path/file.ext' : 'folder or path/folder'}
                        className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-[#55555f]"
                      />
                      <button type="button" onClick={() => setCreation(null)} className="rounded p-0.5 text-[#777780] hover:bg-[#27272a] hover:text-white" title="Cancel">
                        <X size={11} />
                      </button>
                    </div>
                    {creation.error && <p className="px-1 pt-1 text-[10px] text-red-400">{creation.error}</p>}
                  </div>
                )}
                {fileTree.length > 0 ? (
                  renderTree(fileTree)
                ) : (
                  <div className="px-4 py-2 text-xs text-[#6f7192] italic">Folder is empty</div>
                )}
              </div>
            )}
          </div>

          {/* OUTLINE Section */}
          <div className="border-b border-[#27272a]">
            <div
              onClick={() => toggleAccordion('outline')}
              className="flex cursor-pointer items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#8b91aa] hover:bg-[#202026]"
            >
              <div className="flex items-center gap-1">
                {expandedAccordions.outline ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>OUTLINE</span>
              </div>
            </div>

            {expandedAccordions.outline && (
              <div className="p-2 space-y-1">
                {outlineSymbols.length === 0 ? (
                  <p className="px-2 py-1 text-[11px] text-[#6f7192]">No symbols found in the active file.</p>
                ) : outlineSymbols.map((sym, i) => (
                  <button
                    type="button"
                    key={`${sym.name}-${sym.line}-${i}`}
                    onClick={() => window.dispatchEvent(new CustomEvent('go-to-line', { detail: { line: sym.line } }))}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-[11px] text-[#a1a1aa] hover:bg-[#27272a] hover:text-white"
                  >
                    <Code2 size={12} className="text-[#38bdf8]" />
                    <span className="font-mono">{sym.name}</span>
                    <span className="ml-auto text-[10px] text-[#6f7192]">:{sym.line}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TIMELINE Section */}
          <div>
            <div
              onClick={() => toggleAccordion('timeline')}
              className="flex cursor-pointer items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#8b91aa] hover:bg-[#202026]"
            >
              <div className="flex items-center gap-1">
                {expandedAccordions.timeline ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>TIMELINE</span>
              </div>
            </div>

            {expandedAccordions.timeline && (
              <div className="p-2 text-xs text-[#6f7192] space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  <History size={12} className="text-[#38bdf8]" />
                  <span>{activeFile ? `${activeFile.name}${activeFile.isDirty ? ' has unsaved changes' : ' is saved'}` : 'Open a file to view its state'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search View */}
      {activeView === 'search' && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">Search</span>
            <div className="mt-2 flex items-center gap-2 rounded border border-[#27272a] bg-[#0e0e11] px-2.5 py-1.5">
              <Search size={13} className="text-[#6f7192]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search across files (Ctrl+Shift+F)..."
                className="w-full bg-transparent text-xs text-[#cccccc] outline-none placeholder:text-[#555577]"
              />
            </div>
          </div>

          {searchQuery.trim() === '' ? (
            <p className="text-xs text-[#6f7192]">Type a query to search across the workspace.</p>
          ) : isSearching ? (
            <p className="text-xs text-[#38bdf8] animate-pulse">Searching workspace...</p>
          ) : searchResults.length === 0 ? (
            <p className="text-xs text-[#6f7192]">No results found.</p>
          ) : (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase text-[#858585] mb-2">
                {searchResults.length} results found
              </div>
              {searchResults.map((res) => (
                <button
                  key={res.path}
                  onClick={() => onFileOpen?.(res.path)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[#27272a]"
                >
                  <FileCode size={13} className="text-[#38bdf8] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-white">{res.name}</div>
                    <div className="truncate text-[10px] text-[#6f7192]">{res.path}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Source Control View */}
      {activeView === 'git' && <GitView />}

      {/* Run & Debug View */}
      {activeView === 'debug' && (
        <RunDebugView
          activeFile={activeFile}
          onRunCode={onRunCode || (() => {})}
          onStopCode={onStopCode || (() => {})}
          runState={runState}
        />
      )}

      {/* Extensions View */}
      {activeView === 'extensions' && <ExtensionsView />}

      {/* AI View Placeholder */}
      {activeView === 'ai' && (
        <div className="p-4 text-xs text-[#858585]">
          <p className="mb-1 text-white font-semibold">Local AI Assistant</p>
          <p className="text-[11px] text-[#71717a]">
            Local AI Assistant & Autonomous Agent are docked in the right panel. Click the AI processor icon to open it.
          </p>
        </div>
      )}

      {/* Context Menu */}
      <Menu id={MENU_ID} theme="dark" className="text-xs text-[#cccccc] bg-[#1f1f23] border border-[#27272a] rounded shadow-2xl">
        <Item onClick={({ props }) => onFileOpen?.(props.node.path)}>
          Open
        </Item>
        <Item onClick={({ props }) => navigator.clipboard.writeText(props.node.path)}>
          Copy Path
        </Item>
        <Item onClick={({ props }) => navigator.clipboard.writeText(props.node.name)}>
          Copy Relative Path
        </Item>
        <Separator />
        <Item
          onClick={({ props }) => {
            if (confirm(`Delete ${props.node.name}?`)) {
              if (props.node.type === 'directory') {
                window.fileSystem?.deleteFolder(props.node.path).then(onRefresh);
              } else {
                window.fileSystem?.deleteFile(props.node.path).then(onRefresh);
              }
            }
          }}
          className="text-red-400 hover:text-red-300"
        >
          Delete
        </Item>
      </Menu>
      <div
        className="absolute inset-y-0 right-0 z-20 w-1 cursor-col-resize transition-colors hover:bg-[#007acc]"
        onMouseDown={startResize}
      />
    </div>
  );
}
