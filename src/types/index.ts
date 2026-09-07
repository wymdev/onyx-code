export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
  size?: number;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  isUntitled?: boolean;
  isTrusted?: boolean;
  isDiff?: boolean;
  originalContent?: string;
  diffTitle?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface DiagnosticItem {
  id: string;
  filePath: string;
  fileName: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source: string;
}

export interface RecentWorkspace {
  name: string;
  path: string;
  lastOpened: number;
}

export interface CppCompilerInfo {
  name: string;
  command: string;
  version?: string;
  available: boolean;
}

export interface ToolchainInfo {
  id: string;
  name: string;
  command: string;
  available: boolean;
  version?: string;
  path?: string;
}

export interface CompilerConfig {
  optimization?: 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Ofast';
  cppStandard?: 'c++11' | 'c++14' | 'c++17' | 'c++20' | 'c++23';
  cStandard?: 'c99' | 'c11' | 'c17';
  warnings?: 'none' | 'all' | 'extra';
  treatWarningsAsErrors?: boolean;
  debugSymbols?: boolean;
  emitAssembly?: boolean;
  customFlags?: string;
}

export interface UserSession {
  userId: number;
  token: string;
  username: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  username?: string;
  error?: string;
}

export interface SessionResponse {
  success: boolean;
  session?: UserSession;
}

export interface FeedbackResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface DialogFileResult {
  path: string;
  name: string;
  content: string;
}

export interface SavedFileResult {
  path: string;
  name: string;
}

export interface RunOutputEvent {
  type: 'stdout' | 'stderr' | 'system';
  message: string;
}

export interface RunStatusEvent {
  state: 'idle' | 'running' | 'stopped' | 'error';
  filePath?: string;
  code?: number | null;
  signal?: NodeJS.Signals | null;
  message?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      platform: NodeJS.Platform;
      onMenuCommand: (callback: (command: string) => void) => () => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      openExternalLink: (url: string) => Promise<boolean>;
      openLocalFile: (filePath: string) => Promise<boolean>;
      newWindow: () => Promise<void>;
    };
    fileSystem?: {
      openFolderDialog: (defaultPath?: string) => Promise<string | null>;
      openFileDialog: () => Promise<DialogFileResult | null>;
      pickFileDialog?: () => Promise<{ path: string; name: string } | null>;
      authorizePickedFile?: (targetPath: string) => Promise<boolean>;
      discardPickedFile?: (targetPath: string) => Promise<boolean>;
      saveFileDialog: (payload: { defaultPath?: string; content: string }) => Promise<SavedFileResult | null>;
      readDirectory: (path: string) => Promise<FileNode[]>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      createFile: (path: string) => Promise<boolean>;
      createFolder: (targetPath: string) => Promise<void>;
      deleteFile: (targetPath: string) => Promise<void>;
      deleteFolder: (targetPath: string) => Promise<void>;
      editFile?: (targetPath: string, oldText: string, newText: string) => Promise<{ success: boolean }>;
      searchFiles?: (query: string) => Promise<{ path: string; name: string }[]>;
      getRecentWorkspaces?: () => Promise<RecentWorkspace[]>;
      addRecentWorkspace?: (workspacePath: string) => Promise<void>;
      setWorkspaceRoot?: (workspacePath: string) => Promise<string>;
    };
    auth: {
      register: (data: any) => Promise<any>;
      login: (data: any) => Promise<any>;
      logout: () => Promise<void>;
      checkSession: () => Promise<any>;
    };
    feedback: {
      send: (data: any) => Promise<void>;
    };
    runtime: {
      runCurrentFile: (filePath: string, customCommand?: string) => Promise<void>;
      compileCppFile?: (filePath: string, runAfter?: boolean) => Promise<{ success: boolean; diagnostics: DiagnosticItem[]; output?: string }>;
      compileFile?: (
        filePath: string,
        config?: CompilerConfig,
        runAfter?: boolean
      ) => Promise<{
        success: boolean;
        diagnostics?: DiagnosticItem[];
        output?: string;
        assembly?: string;
        assemblyPath?: string;
        error?: string;
      }>;
      detectCppCompilers?: () => Promise<CppCompilerInfo[]>;
      detectAllToolchains?: () => Promise<ToolchainInfo[]>;
      cleanBuildArtifacts?: (targetDir?: string) => Promise<{ success: boolean; count: number; error?: string }>;
      stopRun: () => Promise<void>;
      restartRun: () => Promise<void>;
      onRunOutput: (callback: (payload: RunOutputEvent) => void) => () => void;
      onRunStatus: (callback: (payload: RunStatusEvent) => void) => () => void;
      onDiagnostics?: (callback: (diagnostics: DiagnosticItem[]) => void) => () => void;
      runTerminalCommand: (command: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
      getTerminalProfiles?: () => Promise<Array<{ id: 'powershell' | 'cmd' | 'gitbash'; label: string; available: boolean }>>;
      createTerminal?: (payload: { id: string; profile: 'powershell' | 'cmd' | 'gitbash'; cols?: number; rows?: number }) => void;
      onTerminalData?: (callback: (payload: { id: string; data: string }) => void) => () => void;
      onTerminalExit?: (callback: (payload: { id: string; exitCode: number }) => void) => () => void;
      sendTerminalInput?: (id: string, data: string) => void;
      resizeTerminal?: (id: string, cols: number, rows: number) => void;
      killTerminal?: (id: string) => void;
    };
    git?: {
      status: () => Promise<string>;
      add: (file: string) => Promise<void>;
      commit: (message: string) => Promise<void>;
      branch?: () => Promise<string | null>;
      diff?: (file: string) => Promise<{ original: string; modified: string }>;
    };
    profile?: {
      local: () => Promise<{
        username: string;
        displayName: string;
        email: string | null;
        homeDirectory: string;
      }>;
    };
    appConfig?: {
      setOllamaHost: (url: string) => Promise<boolean>;
      getOllamaHost: () => Promise<string>;
    };
    ollama?: {
      request: (payload: { endpoint: string; method?: string; body?: unknown }) => Promise<{
        ok: boolean;
        status: number;
        statusText: string;
        body: string;
      }>;
      startStream?: (payload: { requestId: string; endpoint: string; method?: string; body?: unknown }) => void;
      abortStream?: (requestId: string) => void;
      onStreamEvent?: (callback: (payload: { requestId: string; type: 'data' | 'end' | 'error'; chunk?: string; error?: string }) => void) => () => void;
    };
    plugins?: {
      inspect: () => Promise<{ sourcePath: string; manifest: OnyxPluginManifest } | null>;
      install: (payload: { sourcePath: string; approvedPermissions: PluginPermission[] }) => Promise<{ success: boolean; manifest: OnyxPluginManifest; error?: string }>;
      list: () => Promise<InstalledOnyxPlugin[]>;
      setEnabled: (pluginId: string, enabled: boolean) => Promise<InstalledOnyxPlugin[]>;
      uninstall: (pluginId: string) => Promise<boolean>;
      commands: () => Promise<Array<{ id: string; title: string; pluginId: string }>>;
      invokeCommand: (commandId: string, args?: unknown) => Promise<unknown>;
      setWorkspaceTrusted: (trusted: boolean) => Promise<InstalledOnyxPlugin[]>;
      onMessage: (callback: (payload: { pluginId: string; message: string }) => void) => () => void;
    };
    vscode?: {
      readSettings: () => Promise<{
        success: boolean;
        path?: string;
        raw?: any;
        mapped?: Record<string, any>;
        error?: string;
      }>;
    };
  }
}

export type PluginPermission = 'commands' | 'workspace.read' | 'workspace.write';

export interface OnyxPluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  publisher?: string;
  main?: string;
  permissions?: PluginPermission[];
}

export interface InstalledOnyxPlugin {
  manifest: OnyxPluginManifest;
  enabled: boolean;
  active: boolean;
  error?: string;
  commandCount: number;
}

export {};
