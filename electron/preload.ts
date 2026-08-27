import { contextBridge, ipcRenderer } from 'electron';

interface DialogFileResult {
  path: string;
  name: string;
  content: string;
}

interface SavedFileResult {
  path: string;
  name: string;
}

interface RunOutputEvent {
  type: 'stdout' | 'stderr' | 'system';
  message: string;
}

interface RunStatusEvent {
  state: 'idle' | 'running' | 'stopped' | 'error';
  filePath?: string;
  code?: number | null;
  signal?: NodeJS.Signals | null;
  message?: string;
}

interface QuestionPaperSearchFilters {
  board?: 'CBSE' | 'Karnataka SSLC' | 'Karnataka PUC';
  examClass?: 10 | 11 | 12;
  year?: number;
  subjectQuery?: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternalLink: (url: string) => ipcRenderer.invoke('open-external-link', url),
  openLocalFile: (filePath: string) => ipcRenderer.invoke('open-local-file', filePath),
  newWindow: () => ipcRenderer.invoke('new-window'),
});

contextBridge.exposeInMainWorld('fileSystem', {
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog') as Promise<DialogFileResult | null>,
  pickFileDialog: () => ipcRenderer.invoke('pick-file-dialog') as Promise<{ path: string; name: string } | null>,
  authorizePickedFile: (targetPath: string) => ipcRenderer.invoke('authorize-picked-file', targetPath),
  discardPickedFile: (targetPath: string) => ipcRenderer.invoke('discard-picked-file', targetPath),
  saveFileDialog: (payload: { defaultPath?: string; content: string }) => ipcRenderer.invoke('save-file-dialog', payload) as Promise<SavedFileResult | null>,
  readDirectory: (targetPath: string) => ipcRenderer.invoke('read-directory', targetPath),
  readFile: (targetPath: string) => ipcRenderer.invoke('read-file', targetPath),
  writeFile: (targetPath: string, content: string) => ipcRenderer.invoke('write-file', targetPath, content),
  createFile: (targetPath: string) => ipcRenderer.invoke('create-file', targetPath),
  createFolder: (targetPath: string) => ipcRenderer.invoke('create-folder', targetPath),
  deleteFile: (targetPath: string) => ipcRenderer.invoke('delete-file', targetPath),
  deleteFolder: (targetPath: string) => ipcRenderer.invoke('delete-folder', targetPath),
  editFile: (targetPath: string, oldText: string, newText: string) => ipcRenderer.invoke('edit-file', targetPath, oldText, newText),
  searchFiles: (query: string) => ipcRenderer.invoke('search-files', query),
  getRecentWorkspaces: () => ipcRenderer.invoke('get-recent-workspaces'),
  addRecentWorkspace: (workspacePath: string) => ipcRenderer.invoke('add-recent-workspace', workspacePath),
  setWorkspaceRoot: (workspacePath: string) => ipcRenderer.invoke('set-workspace-root', workspacePath),
});

contextBridge.exposeInMainWorld('auth', {
  register: (data: { username: string; email: string; password: string }) => ipcRenderer.invoke('auth-register', data),
  login: (data: { email: string; password: string }) => ipcRenderer.invoke('auth-login', data),
  logout: () => ipcRenderer.invoke('auth-logout'),
  checkSession: () => ipcRenderer.invoke('auth-check-session'),
});

contextBridge.exposeInMainWorld('feedback', {
  send: (data: { name?: string; email?: string; message: string }) => ipcRenderer.invoke('send-feedback', data),
});

contextBridge.exposeInMainWorld('runtime', {
  runCurrentFile: (filePath: string) => ipcRenderer.invoke('run-current-file', filePath),
  compileCppFile: (filePath: string, runAfter = false) => ipcRenderer.invoke('compile-cpp-file', filePath, runAfter),
  detectCppCompilers: () => ipcRenderer.invoke('detect-cpp-compilers'),
  stopRun: () => ipcRenderer.invoke('stop-run'),
  restartRun: () => ipcRenderer.invoke('restart-run'),
  onRunOutput: (callback: (payload: RunOutputEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: RunOutputEvent) => callback(payload);
    ipcRenderer.on('run-output', listener);
    return () => ipcRenderer.removeListener('run-output', listener);
  },
  onRunStatus: (callback: (payload: RunStatusEvent) => void) => {
    const listener = (_event: unknown, payload: RunStatusEvent) => callback(payload);
    ipcRenderer.on('run-status', listener);
    return () => ipcRenderer.removeListener('run-status', listener);
  },
  onDiagnostics: (callback: (diagnostics: any[]) => void) => {
    const listener = (_event: unknown, payload: any[]) => callback(payload);
    ipcRenderer.on('diagnostics', listener);
    return () => ipcRenderer.removeListener('diagnostics', listener);
  },
  runTerminalCommand: (command: string) => ipcRenderer.invoke('run-terminal-command', command),
  getTerminalProfiles: () => ipcRenderer.invoke('terminal-profiles'),
  createTerminal: (payload: { id: string; profile: string; cols?: number; rows?: number }) => ipcRenderer.send('terminal-create', payload),
  onTerminalData: (callback: (payload: { id: string; data: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) => callback(payload);
    ipcRenderer.on('terminal-data', listener);
    return () => ipcRenderer.removeListener('terminal-data', listener);
  },
  onTerminalExit: (callback: (payload: { id: string; exitCode: number }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { id: string; exitCode: number }) => callback(payload);
    ipcRenderer.on('terminal-exit', listener);
    return () => ipcRenderer.removeListener('terminal-exit', listener);
  },
  sendTerminalInput: (id: string, data: string) => ipcRenderer.send('terminal-input', { id, data }),
  resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.send('terminal-resize', { id, cols, rows }),
  killTerminal: (id: string) => ipcRenderer.send('terminal-kill', id),
});

contextBridge.exposeInMainWorld('git', {
  status: () => ipcRenderer.invoke('git-status'),
  branch: () => ipcRenderer.invoke('git-branch'),
  add: (file: string) => ipcRenderer.invoke('git-add', file),
  commit: (message: string) => ipcRenderer.invoke('git-commit', message),
});

contextBridge.exposeInMainWorld('appConfig', {
  setOllamaHost: (url: string) => ipcRenderer.invoke('set-ollama-host', url),
  getOllamaHost: () => ipcRenderer.invoke('get-ollama-host'),
});

contextBridge.exposeInMainWorld('ollama', {
  request: (payload: { endpoint: string; method?: string; body?: unknown }) =>
    ipcRenderer.invoke('ollama-request', payload),
  startStream: (payload: { requestId: string; endpoint: string; method?: string; body?: unknown }) =>
    ipcRenderer.send('ollama-stream-start', payload),
  abortStream: (requestId: string) => ipcRenderer.send('ollama-stream-abort', requestId),
  onStreamEvent: (callback: (payload: { requestId: string; type: 'data' | 'end' | 'error'; chunk?: string; error?: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { requestId: string; type: 'data' | 'end' | 'error'; chunk?: string; error?: string }) => callback(payload);
    ipcRenderer.on('ollama-stream-event', listener);
    return () => ipcRenderer.removeListener('ollama-stream-event', listener);
  },
});

contextBridge.exposeInMainWorld('plugins', {
  inspect: () => ipcRenderer.invoke('plugins-inspect'),
  install: (payload: { sourcePath: string; approvedPermissions: string[] }) => ipcRenderer.invoke('plugins-install', payload),
  list: () => ipcRenderer.invoke('plugins-list'),
  setEnabled: (pluginId: string, enabled: boolean) => ipcRenderer.invoke('plugins-set-enabled', pluginId, enabled),
  uninstall: (pluginId: string) => ipcRenderer.invoke('plugins-uninstall', pluginId),
  commands: () => ipcRenderer.invoke('plugins-commands'),
  invokeCommand: (commandId: string, args?: unknown) => ipcRenderer.invoke('plugins-invoke-command', commandId, args),
  setWorkspaceTrusted: (trusted: boolean) => ipcRenderer.invoke('plugins-set-workspace-trusted', trusted),
  onMessage: (callback: (payload: { pluginId: string; message: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { pluginId: string; message: string }) => callback(payload);
    ipcRenderer.on('plugin-message', listener);
    return () => ipcRenderer.removeListener('plugin-message', listener);
  },
});
