import { useCallback, useEffect, useRef, useState } from 'react';
import ActivityBar, { ViewType } from './components/ActivityBar';
import CommandPalette from './components/CommandPalette';
import EditorLayout from './components/EditorLayout';
import SettingsModal from './components/SettingsModal';
import OllamaConnectionModal from './components/OllamaConnectionModal';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import TitleBar from './components/TitleBar';
import WorkspaceTrustDialog, { WorkspaceTrustDecision } from './components/WorkspaceTrustDialog';
import { AppSettings, settingsService } from './services/settingsService';
import { CPP_TEMPLATES } from './services/cppService';
import { DiagnosticItem, FileNode, OpenFile, RunOutputEvent, RunStatusEvent } from './types';

const DEFAULT_ABOUT = 'Onyx Code v1.0.0\nAuthentic VS Code Desktop IDE with Modern C++ & AI Engine';

function getLanguageFromExtension(extension: string): string {
  const map: Record<string, string> = {
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    h: 'cpp',
    c: 'cpp',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    sh: 'shell',
    yml: 'yaml',
    yaml: 'yaml',
    ps1: 'powershell',
    rs: 'rust',
    go: 'go',
  };
  return map[extension.toLowerCase()] ?? 'plaintext';
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, '/').toLowerCase();
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('explorer');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);

  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ollamaModalOpen, setOllamaModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(settingsService.load());

  const [aiPanelWidth, setAiPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [outputVisible, setOutputVisible] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'problems' | 'output' | 'debug' | 'terminal'>('output');

  const [outputLines, setOutputLines] = useState<RunOutputEvent[]>([]);
  const [runStatus, setRunStatus] = useState<RunStatusEvent['state']>('idle');
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [gitBranch, setGitBranch] = useState('wym_dev');
  const [isWorkspaceTrusted, setIsWorkspaceTrusted] = useState(false);
  const [trustRequest, setTrustRequest] = useState<{ path: string; kind: 'file' | 'folder' } | null>(null);
  const trustResolver = useRef<((decision: WorkspaceTrustDecision) => void) | null>(null);
  const [pluginNotice, setPluginNotice] = useState<string | null>(null);

  const activeFile = openFiles[activeFileIndex];

  const getTrustedPaths = () => {
    try {
      return new Set<string>(JSON.parse(localStorage.getItem('onyx_trusted_paths') || '[]'));
    } catch {
      return new Set<string>();
    }
  };

  const rememberTrustedPath = (targetPath: string) => {
    const paths = getTrustedPaths();
    paths.add(normalizePath(targetPath));
    localStorage.setItem('onyx_trusted_paths', JSON.stringify([...paths]));
  };

  const isRememberedTrusted = (targetPath: string) => getTrustedPaths().has(normalizePath(targetPath));

  const requestTrustDecision = (targetPath: string, kind: 'file' | 'folder') => {
    if (isRememberedTrusted(targetPath)) return Promise.resolve<WorkspaceTrustDecision>('trusted');
    return new Promise<WorkspaceTrustDecision>((resolve) => {
      trustResolver.current = resolve;
      setTrustRequest({ path: targetPath, kind });
    });
  };

  const resolveTrustDecision = (decision: WorkspaceTrustDecision) => {
    if (decision === 'trusted' && trustRequest) rememberTrustedPath(trustRequest.path);
    trustResolver.current?.(decision);
    trustResolver.current = null;
    setTrustRequest(null);
  };

  const refreshGitBranch = useCallback(async () => {
    try {
      const branch = await window.git?.branch?.();
      setGitBranch(branch || 'main');
    } catch {
      setGitBranch('main');
    }
  }, []);

  // Fetch branch and listen to runtime events
  useEffect(() => {
    refreshGitBranch();

    const unsubscribeOutput = window.runtime?.onRunOutput((payload) => {
      setOutputVisible(true);
      setOutputLines((current) => [...current, payload]);
    });

    const unsubscribeStatus = window.runtime?.onRunStatus((payload) => {
      setRunStatus(payload.state);
    });

    const unsubscribeDiags = window.runtime?.onDiagnostics?.((diags) => {
      setDiagnostics(diags);
      if (diags.length > 0) {
        setOutputVisible(true);
        setActiveBottomTab('problems');
      }
    });

    return () => {
      unsubscribeOutput?.();
      unsubscribeStatus?.();
      unsubscribeDiags?.();
    };
  }, [refreshGitBranch]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  useEffect(() => {
    window.plugins?.setWorkspaceTrusted(isWorkspaceTrusted).catch(() => undefined);
  }, [isWorkspaceTrusted, rootPath]);

  useEffect(() => {
    return window.plugins?.onMessage?.(({ pluginId, message }) => {
      setPluginNotice(`${pluginId}: ${message}`);
      setTimeout(() => setPluginNotice(null), 4000);
    });
  }, []);

  // Restore the most recently opened workspace on launch, like a real IDE -
  // otherwise every restart drops you back on the Welcome tab with nothing open.
  useEffect(() => {
    const restoreLastWorkspace = async () => {
      const recents = await window.fileSystem?.getRecentWorkspaces?.();
      const lastWorkspace = recents?.[0];
      if (lastWorkspace?.path) {
        await handleOpenFolder(lastWorkspace.path, { silent: true });
      }
    };
    restoreLastWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshFileTree = useCallback(
    async (targetPath: string | null = rootPath) => {
      if (!targetPath || !window.fileSystem) {
        return;
      }

      try {
        const files = await window.fileSystem.readDirectory(targetPath);
        setFileTree(files);
      } catch (error) {
        console.error('Error refreshing file tree:', error);
      }
    },
    [rootPath]
  );

  const upsertOpenFile = useCallback((filePath: string, content: string, isUntitled = false, isDirty = false, isTrusted = true) => {
    const fileName = filePath.split(/[\\/]/).pop() ?? 'untitled';
    const extension = fileName.split('.').pop() ?? '';
    const nextFile: OpenFile = {
      path: filePath,
      name: fileName,
      content,
      language: getLanguageFromExtension(extension),
      isDirty,
      isUntitled,
      isTrusted,
    };

    setIsWelcomeOpen(false);

    setOpenFiles((current) => {
      const existingIndex = current.findIndex(
        (file) => normalizePath(file.path) === normalizePath(filePath)
      );
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = nextFile;
        setActiveFileIndex(existingIndex);
        return next;
      }

      setActiveFileIndex(current.length);
      return [...current, nextFile];
    });
  }, []);

  const handleOpenFolder = async (folderPath?: string, options?: { silent?: boolean }) => {
    let selectedPath = folderPath;
    if (!selectedPath) {
      selectedPath = (await window.fileSystem?.openFolderDialog()) || undefined;
    }
    if (!selectedPath) {
      return;
    }

    const trustDecision = await requestTrustDecision(selectedPath, 'folder');
    if (trustDecision === 'cancel') return;
    const trusted = trustDecision === 'trusted';

    setRootPath(selectedPath);
    setIsWorkspaceTrusted(trusted);
    setSearchQuery('');
    setActiveView('explorer');
    setShowSidebar(true);

    try {
      await window.fileSystem?.setWorkspaceRoot?.(selectedPath);
      const files = await window.fileSystem?.readDirectory(selectedPath);
      setFileTree(files ?? []);
    } catch (error) {
      setFileTree([]);
      if (options?.silent) {
        // Restoring the last workspace on launch shouldn't interrupt the user with
        // a popup if it's since been moved/deleted - just fall back to Welcome.
        setRootPath(null);
        setIsWorkspaceTrusted(false);
        return;
      }
      alert(
        `Could not read "${selectedPath}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    await window.fileSystem?.addRecentWorkspace?.(selectedPath);
    await refreshGitBranch();
  };

  const handleOpenFile = async () => {
    try {
      const picked = window.fileSystem?.pickFileDialog
        ? await window.fileSystem.pickFileDialog()
        : await window.fileSystem?.openFileDialog();
      if (!picked) return;

      const insideCurrentWorkspace = rootPath && normalizePath(picked.path).startsWith(`${normalizePath(rootPath)}/`);
      let trusted = insideCurrentWorkspace ? isWorkspaceTrusted : isRememberedTrusted(picked.path);
      if (!insideCurrentWorkspace && !trusted) {
        const trustDecision = await requestTrustDecision(picked.path, 'file');
        if (trustDecision === 'cancel') {
          await window.fileSystem?.discardPickedFile?.(picked.path);
          return;
        }
        trusted = trustDecision === 'trusted';
      }
      if (window.fileSystem?.authorizePickedFile) {
        await window.fileSystem.authorizePickedFile(picked.path);
      }
      const content = 'content' in picked ? picked.content : await window.fileSystem?.readFile(picked.path);
      if (typeof content !== 'string') throw new Error('Unable to read the selected file');
      upsertOpenFile(picked.path, content, false, false, trusted);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to open file');
    }
  };

  const handleCreateFile = async (requestedPath?: string): Promise<boolean> => {
    if (!rootPath || !window.fileSystem) {
      const untitledNumber = openFiles.filter((file) => file.isUntitled).length + 1;
      const defaultName = `Untitled-${untitledNumber}`;
      upsertOpenFile(`untitled://${defaultName}`, '', true, true, isWorkspaceTrusted);
      return true;
    }

    const fileName = requestedPath ?? prompt('Enter relative file path (e.g. main.cpp, src/solution.cpp)');
    if (!fileName) {
      return false;
    }

    try {
      const fullPath = `${rootPath}/${fileName.replace(/^[/\\]+/, '')}`;
      await window.fileSystem.createFile(fullPath);
      await refreshFileTree(rootPath);
      upsertOpenFile(fullPath, '', false, false, isWorkspaceTrusted);
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create file');
      return false;
    }
  };

  const handleCreateFolder = async (requestedPath?: string): Promise<boolean> => {
    if (!rootPath || !window.fileSystem) {
      alert('Open a project folder first.');
      return false;
    }

    const folderName = requestedPath ?? prompt('Enter relative folder path');
    if (!folderName) {
      return false;
    }

    try {
      await window.fileSystem.createFolder(`${rootPath}/${folderName.replace(/^[/\\]+/, '')}`);
      await refreshFileTree(rootPath);
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to create folder');
      return false;
    }
  };

  const handleFileOpen = async (filePath: string) => {
    const existingIndex = openFiles.findIndex(
      (file) => normalizePath(file.path) === normalizePath(filePath)
    );
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex);
      setIsWelcomeOpen(false);
      return;
    }

    const content = await window.fileSystem?.readFile(filePath);
    if (typeof content === 'string') {
      upsertOpenFile(filePath, content, false, false, isWorkspaceTrusted);
    }
  };

  const handleFileClose = (index: number) => {
    const target = openFiles[index];
    if (target?.isDirty && !confirm(`Close "${target.name}" without saving your changes?`)) {
      return;
    }
    const remainingCount = Math.max(0, openFiles.length - 1);
    setOpenFiles((current) => {
      const next = current.filter((_, fileIndex) => fileIndex !== index);
      if (next.length === 0) {
        setIsWelcomeOpen(true);
      }
      return next;
    });
    setActiveFileIndex((current) => {
      if (index < current) return current - 1;
      if (index === current) return Math.max(0, Math.min(current, remainingCount - 1));
      return current;
    });
  };

  const handleContentChange = (content: string) => {
    setOpenFiles((current) => {
      const next = [...current];
      if (!next[activeFileIndex]) {
        return current;
      }
      next[activeFileIndex] = { ...next[activeFileIndex], content, isDirty: true };
      return next;
    });
  };

  const handleFileSave = useCallback(async () => {
    if (!activeFile || !window.fileSystem) {
      return;
    }

    if (activeFile.isUntitled) {
      const result = await window.fileSystem.saveFileDialog({
        defaultPath: rootPath ? `${rootPath}/${activeFile.name}` : activeFile.name,
        content: activeFile.content,
      });
      if (!result) return;
      setOpenFiles((current) =>
        current.map((file, index) =>
          index === activeFileIndex
            ? {
                ...file,
                path: result.path,
                name: result.name,
                language: getLanguageFromExtension(result.name.split('.').pop() || ''),
                isDirty: false,
                isUntitled: false,
              }
            : file
        )
      );
      await refreshFileTree();
      return;
    }

    await window.fileSystem.writeFile(activeFile.path, activeFile.content);
    setOpenFiles((current) =>
      current.map((file, index) =>
        index === activeFileIndex ? { ...file, isDirty: false } : file
      )
    );
    await refreshFileTree();
  }, [activeFile, activeFileIndex, refreshFileTree, rootPath]);

  const handleSaveAll = useCallback(async () => {
    if (!window.fileSystem) {
      return;
    }

    const dirtyFiles = openFiles.filter((file) => file.isDirty);
    if (dirtyFiles.length === 0) {
      return;
    }

    const savedPaths = new Map<string, { path: string; name: string }>();
    for (const file of dirtyFiles) {
      if (file.isUntitled) {
        const result = await window.fileSystem.saveFileDialog({
          defaultPath: rootPath ? `${rootPath}/${file.name}` : file.name,
          content: file.content,
        });
        if (result) savedPaths.set(file.path, result);
      } else {
        await window.fileSystem.writeFile(file.path, file.content);
        savedPaths.set(file.path, { path: file.path, name: file.name });
      }
    }
    setOpenFiles((current) =>
      current.map((file) => {
        const saved = savedPaths.get(file.path);
        if (!saved) return file;
        return {
          ...file,
          path: saved.path,
          name: saved.name,
          language: getLanguageFromExtension(saved.name.split('.').pop() || ''),
          isDirty: false,
          isUntitled: false,
        };
      })
    );
    await refreshFileTree();
  }, [openFiles, refreshFileTree, rootPath]);

  const handleSaveAs = async () => {
    if (!activeFile || !window.fileSystem) {
      return;
    }

    const result = await window.fileSystem.saveFileDialog({
      defaultPath: activeFile.path,
      content: activeFile.content,
    });
    if (!result) {
      return;
    }

    upsertOpenFile(result.path, activeFile.content, false, false, activeFile.isTrusted !== false);
    await refreshFileTree();
  };

  const handleRunCode = async () => {
    if (!activeFile) {
      alert('Open a file first to run.');
      return;
    }

    if (!(rootPath ? isWorkspaceTrusted : activeFile.isTrusted !== false)) {
      alert('Running code is disabled in Restricted Mode. Trust this workspace or file first.');
      return;
    }

    if (activeFile.isUntitled) {
      alert('Save this file before running it.');
      await handleFileSave();
      return;
    }

    setOutputLines([]);
    setOutputVisible(true);
    setActiveBottomTab('output');

    try {
      await window.runtime?.runCurrentFile(activeFile.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run file';
      setRunStatus('error');
      setOutputLines([{ type: 'stderr', message }]);
    }
  };

  const handleBuildCpp = async () => {
    if (!activeFile) {
      alert('Open a C++ file to build.');
      return;
    }

    if (!(rootPath ? isWorkspaceTrusted : activeFile.isTrusted !== false)) {
      alert('Building code is disabled in Restricted Mode. Trust this workspace first.');
      return;
    }

    setOutputLines([]);
    setOutputVisible(true);
    setActiveBottomTab('output');

    try {
      await window.runtime?.compileCppFile?.(activeFile.path, false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build C++ file';
      setRunStatus('error');
      setOutputLines([{ type: 'stderr', message }]);
    }
  };

  const handleStopExecution = async () => {
    await window.runtime?.stopRun();
  };

  const handleRestartExecution = async () => {
    setOutputVisible(true);
    setOutputLines([]);
    try {
      await window.runtime?.restartRun();
    } catch (error) {
      setOutputLines([
        {
          type: 'stderr',
          message: error instanceof Error ? error.message : 'Failed to restart process',
        },
      ]);
    }
  };

  const dispatchEditorEvent = (name: string, detail?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  const handleNewTerminal = () => {
    if (!isWorkspaceTrusted) {
      alert('The terminal is disabled in Restricted Mode. Trust this workspace first.');
      return;
    }
    const isAlreadyOpen = outputVisible && activeBottomTab === 'terminal';
    setOutputVisible(true);
    setActiveBottomTab('terminal');
    if (isAlreadyOpen) setTimeout(() => window.dispatchEvent(new Event('terminal-new')), 0);
  };

  const handleSplitTerminal = () => {
    if (!isWorkspaceTrusted) {
      alert('The terminal is disabled in Restricted Mode. Trust this workspace first.');
      return;
    }
    const isAlreadyOpen = outputVisible && activeBottomTab === 'terminal';
    setOutputVisible(true);
    setActiveBottomTab('terminal');
    if (isAlreadyOpen) setTimeout(() => window.dispatchEvent(new Event('terminal-split')), 0);
  };

  const handleRequestWorkspaceTrust = async () => {
    const target = rootPath;
    if (!target) {
      alert('Open a folder before enabling Agent mode or terminal access.');
      return false;
    }
    const decision = await requestTrustDecision(target, 'folder');
    if (decision !== 'trusted') return false;
    setIsWorkspaceTrusted(true);
    setOpenFiles((files) => files.map((file) => ({ ...file, isTrusted: true })));
    return true;
  };

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setSettings(nextSettings);
    settingsService.save(nextSettings);
  }, []);

  const handleGoToLine = () => {
    const line = prompt('Go to line:');
    if (!line) {
      return;
    }
    const parsed = Number(line);
    if (!Number.isNaN(parsed)) {
      dispatchEditorEvent('go-to-line', { line: parsed });
    }
  };

  const handleFind = () => {
    const query = prompt('Find in file:');
    if (query) {
      dispatchEditorEvent('find-in-file', { query });
    }
  };

  const handleReplace = () => {
    const find = prompt('Replace which text?');
    if (!find) {
      return;
    }
    const replace = prompt(`Replace "${find}" with:`) ?? '';
    dispatchEditorEvent('replace-in-file', { find, replace });
  };

  const handleSearchInProject = () => {
    setActiveView('search');
    setShowSidebar(true);
    const query = prompt('Search files in project:', searchQuery);
    if (query !== null) {
      setSearchQuery(query);
    }
  };

  const handleApplyCode = async (filePath: string, content: string) => {
    if (!rootPath || !window.fileSystem) {
      upsertOpenFile(filePath, content, false, false, isWorkspaceTrusted);
      return;
    }

    await window.fileSystem.writeFile(filePath, content);
    upsertOpenFile(filePath, content, false, false, isWorkspaceTrusted);
    await refreshFileTree();
  };

  const handleLivePreview = (filePath: string, content: string) => {
    const fileName = filePath.split(/[\\/]/).pop() ?? 'untitled';
    const extension = fileName.split('.').pop() ?? '';
    setOpenFiles((current) => {
      const existingIndex = current.findIndex(
        (file) => normalizePath(file.path) === normalizePath(filePath)
      );
      const previewFile: OpenFile = {
        path: filePath,
        name: fileName,
        content,
        language: getLanguageFromExtension(extension),
        isDirty: true,
        isTrusted: isWorkspaceTrusted,
      };

      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = previewFile;
        setActiveFileIndex(existingIndex);
        return next;
      }

      setActiveFileIndex(current.length);
      return [...current, previewFile];
    });
  };

  const handleStartCppProject = async (templateId = 'cpp-hello') => {
    const tmpl = CPP_TEMPLATES.find((t) => t.id === templateId) || CPP_TEMPLATES[0];
    if (rootPath && window.fileSystem) {
      const targetPath = `${rootPath}/${tmpl.fileName}`;
      await window.fileSystem.writeFile(targetPath, tmpl.code);
      await refreshFileTree(rootPath);
      upsertOpenFile(targetPath, tmpl.code, false, false, isWorkspaceTrusted);
      return;
    }
    upsertOpenFile(`untitled://${tmpl.fileName}`, tmpl.code, true, true, isWorkspaceTrusted);
  };

  const handleStartPythonProject = async () => {
    const code = `def main():\n    print("Hello from Python 3.12!")\n    name = input("What is your name? ")\n    print(f"Welcome {name} to Onyx Code IDE.")\n\nif __name__ == "__main__":\n    main()\n`;
    if (rootPath && window.fileSystem) {
      const targetPath = `${rootPath}/main.py`;
      await window.fileSystem.writeFile(targetPath, code);
      await refreshFileTree(rootPath);
      upsertOpenFile(targetPath, code, false, false, isWorkspaceTrusted);
      return;
    }
    upsertOpenFile('untitled://main.py', code, true, true, isWorkspaceTrusted);
  };

  const handleSelectProblem = (diag: DiagnosticItem) => {
    handleFileOpen(diag.filePath);
    setTimeout(() => {
      dispatchEditorEvent('go-to-line', { line: diag.line });
    }, 100);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setShowSidebar((prev) => !prev);
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        handleBuildCpp();
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleCreateFile();
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        handleOpenFile();
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        handleOpenFolder();
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'w') {
        event.preventDefault();
        if (openFiles.length > 0) {
          handleFileClose(activeFileIndex);
        } else if (isWelcomeOpen) {
          setIsWelcomeOpen(false);
        }
      }
      if (mod && !event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        handleGoToLine();
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handleSearchInProject();
      }
      if (event.key === 'F5' && !event.shiftKey && !event.ctrlKey) {
        event.preventDefault();
        handleRunCode();
      }
      if (event.key === 'F5' && event.shiftKey) {
        event.preventDefault();
        handleStopExecution();
      }
      if (event.key === '`' && mod) {
        event.preventDefault();
        setOutputVisible((current) => !current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileIndex, openFiles.length, searchQuery, isWelcomeOpen]);

  const startResizing = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
  };

  const resize = (event: React.MouseEvent) => {
    if (!isResizing) {
      return;
    }
    const nextWidth = document.body.clientWidth - event.clientX;
    if (nextWidth > 280 && nextWidth < document.body.clientWidth - 360) {
      setAiPanelWidth(nextWidth);
    }
  };

  const currentWorkspaceName = rootPath ? rootPath.split(/[\\/]/).pop() : 'virgoai';

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#18181b] font-sans"
      onMouseMove={resize}
      onMouseUp={() => setIsResizing(false)}
    >
      {/* Title Bar matching screenshot */}
      <TitleBar
        workspaceName={currentWorkspaceName}
        onNewFile={handleCreateFile}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onSave={handleFileSave}
        onSaveAll={handleSaveAll}
        onSaveAs={handleSaveAs}
        onCloseFile={() => (openFiles.length > 0 ? handleFileClose(activeFileIndex) : setIsWelcomeOpen(false))}
        onUndo={() => dispatchEditorEvent('editor-undo')}
        onRedo={() => dispatchEditorEvent('editor-redo')}
        onCut={() => dispatchEditorEvent('editor-cut')}
        onCopy={() => dispatchEditorEvent('editor-copy')}
        onPaste={() => dispatchEditorEvent('editor-paste')}
        onSelectAll={() => dispatchEditorEvent('editor-select-all')}
        onFind={handleFind}
        onReplace={handleReplace}
        onGoToFile={() => setCommandPaletteOpen(true)}
        onGoToLine={handleGoToLine}
        onSearchInProject={handleSearchInProject}
        onRunCode={handleRunCode}
        onBuildCpp={handleBuildCpp}
        onStopExecution={handleStopExecution}
        onRestartExecution={handleRestartExecution}
        onViewOutput={() => {
          setOutputVisible(true);
          setActiveBottomTab('output');
        }}
        onViewProblems={() => {
          setOutputVisible(true);
          setActiveBottomTab('problems');
        }}
        onViewTerminal={handleNewTerminal}
        onSplitTerminal={handleSplitTerminal}
        onOpenDocumentation={() =>
          window.electronAPI?.openExternalLink('https://code.visualstudio.com/docs')
        }
        onOpenKeyboardShortcuts={() => setCommandPaletteOpen(true)}
        onReportIssue={() => setSettingsOpen(true)}
        onShowAbout={() => alert(DEFAULT_ABOUT)}
        onOpenSettings={() => setSettingsOpen(true)}
        onCommandPalette={() => setCommandPaletteOpen(true)}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        showBottomPanel={outputVisible}
        onToggleBottomPanel={() => setOutputVisible(!outputVisible)}
        showAIPanel={showAIPanel}
        onToggleAIPanel={() => setShowAIPanel(!showAIPanel)}
      />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          activeView={activeView}
          onViewChange={(view) => {
            // VS Code-style toggle: clicking the already-active view's icon while
            // the sidebar is open collapses it; clicking again (or a different
            // icon) reopens/switches it.
            if (view === activeView && showSidebar) {
              setShowSidebar(false);
              return;
            }
            setActiveView(view);
            setShowSidebar(true);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          showAIPanel={showAIPanel}
          onToggleAIPanel={() => setShowAIPanel((s) => !s)}
          badgeCounts={{
            explorer: openFiles.length,
            problems: diagnostics.length,
          }}
        />

        {showSidebar && (
          <Sidebar
            activeView={activeView}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onFileOpen={handleFileOpen}
            rootPath={rootPath}
            fileTree={fileTree}
            openFiles={openFiles}
            activeFileIndex={activeFileIndex}
            onFileSelect={(index) => {
              setActiveFileIndex(index);
              setIsWelcomeOpen(false);
            }}
            onFileClose={handleFileClose}
            onOpenFolder={handleOpenFolder}
            onRefresh={() => refreshFileTree()}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onRunCode={handleRunCode}
            onStopCode={handleStopExecution}
            runState={runStatus}
            activeFile={activeFile}
          />
        )}

        <EditorLayout
          openFiles={openFiles}
          activeFileIndex={activeFileIndex}
          onFileSelect={(index) => {
            setActiveFileIndex(index);
            setIsWelcomeOpen(false);
          }}
          onFileClose={handleFileClose}
          onContentChange={handleContentChange}
          onSave={handleFileSave}
          settings={settings}
          showAIPanel={showAIPanel}
          aiPanelWidth={aiPanelWidth}
          onStartResize={startResizing}
          onCloseAIPanel={() => setShowAIPanel(false)}
          rootPath={rootPath}
          fileTree={fileTree}
          onApplyCode={handleApplyCode}
          onLivePreview={handleLivePreview}
          activeFile={activeFile}
          outputLines={outputLines}
          outputVisible={outputVisible}
          runState={runStatus}
          onToggleOutput={() => setOutputVisible((current) => !current)}
          onClearOutput={() => setOutputLines([])}
          diagnostics={diagnostics}
          onSelectProblem={handleSelectProblem}
          onClearDiagnostics={() => setDiagnostics([])}
          isWelcomeOpen={isWelcomeOpen}
          onCloseWelcome={() => setIsWelcomeOpen(false)}
          onSelectWelcome={() => setIsWelcomeOpen(true)}
          onNewFile={handleCreateFile}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onOpenRecentFolder={handleOpenFolder}
          onStartCppProject={handleStartCppProject}
          onStartPythonProject={handleStartPythonProject}
          onOpenAIWorkspace={() => setShowAIPanel(true)}
          onBuildCpp={handleBuildCpp}
          activeBottomTab={activeBottomTab}
          onSelectBottomTab={setActiveBottomTab}
          isWorkspaceTrusted={isWorkspaceTrusted}
          onRequestWorkspaceTrust={handleRequestWorkspaceTrust}
        />
      </div>

      {/* Status Bar matching screenshot */}
      <StatusBar
        activeFile={activeFile}
        settings={settings}
        diagnostics={diagnostics}
        onToggleProblems={() => {
          setOutputVisible(true);
          setActiveBottomTab('problems');
        }}
        branchName={gitBranch}
        onRefreshGit={refreshGitBranch}
        onOpenPreview={() => {
          if (activeFile && !activeFile.isUntitled) {
            window.electronAPI?.openLocalFile(activeFile.path).catch((error) => {
              alert(error instanceof Error ? error.message : 'Unable to open preview');
            });
          }
        }}
        onOpenOllamaSettings={() => setOllamaModalOpen(true)}
        isWorkspaceTrusted={isWorkspaceTrusted}
        onRequestWorkspaceTrust={handleRequestWorkspaceTrust}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      <OllamaConnectionModal
        isOpen={ollamaModalOpen}
        onClose={() => setOllamaModalOpen(false)}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenFolder={handleOpenFolder}
        onOpenFile={handleOpenFile}
        onNewFile={handleCreateFile}
        onSave={handleFileSave}
        onToggleSettings={() => setSettingsOpen(true)}
        onRunCode={handleRunCode}
        onGoToLine={handleGoToLine}
        onSearchInProject={handleSearchInProject}
        onViewOutput={() => {
          setOutputVisible(true);
          setActiveBottomTab('output');
        }}
      />

      {trustRequest && (
        <WorkspaceTrustDialog
          path={trustRequest.path}
          kind={trustRequest.kind}
          onDecision={resolveTrustDecision}
        />
      )}

      {pluginNotice && (
        <div className="fixed bottom-9 right-4 z-[300] max-w-sm rounded-lg border border-sky-400/25 bg-[#202023] px-3 py-2 text-xs text-white shadow-2xl">
          {pluginNotice}
        </div>
      )}
    </div>
  );
}
