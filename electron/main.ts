import './polyfills';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import * as path from 'path';
import { pathToFileURL } from 'url';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';
import { spawn, ChildProcess } from 'child_process';
import { initDatabase } from './database';
import { setupAuthHandlers } from './auth';
import { setupFeedbackHandlers } from './feedback';
import { setupPluginHandlers } from './plugins';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let ollamaProcess: ChildProcess | null = null;
let activeRunProcess: ChildProcess | null = null;
let currentWorkspaceRoot: string | null = null;
const userGrantedFiles = new Set<string>();
const pendingPickedFiles = new Set<string>();
let lastRunFilePath: string | null = null;
let handlersInitialized = false;
const activeOllamaStreams = new Map<string, http.ClientRequest>();
const cancelledOllamaStreams = new Set<string>();

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
  size?: number;
}

interface FileOpenResult {
  path: string;
  name: string;
  content: string;
}

function normalizePath(filePath: string) {
  return path.resolve(filePath);
}

function isPathInsideRoot(targetPath: string, rootPath: string) {
  const normalizedTarget = normalizePath(targetPath).toLowerCase();
  const normalizedRoot = normalizePath(rootPath).toLowerCase();
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
}

function assertWorkspacePath(targetPath: string) {
  if (!targetPath) {
    throw new Error('Target path is required');
  }

  const resolved = normalizePath(targetPath);

  if (userGrantedFiles.has(resolved.toLowerCase())) {
    return;
  }

  if (!currentWorkspaceRoot) {
    throw new Error('Open a workspace folder or choose the file from the file picker first.');
  }

  if (!isPathInsideRoot(resolved, currentWorkspaceRoot)) {
    throw new Error(`Access denied: "${targetPath}" is outside the open workspace.`);
  }
}

async function setWorkspaceRoot(targetPath: string) {
  if (!targetPath) {
    throw new Error('Workspace path is required');
  }

  const resolved = normalizePath(targetPath);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`"${targetPath}" is not a folder.`);
  }

  currentWorkspaceRoot = resolved;
  return resolved;
}

function sendRunEvent(channel: 'run-output' | 'run-status' | 'diagnostics', payload: unknown) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, payload);
}

function stopActiveRun() {
  if (activeRunProcess) {
    try {
      activeRunProcess.kill();
    } catch {
      // ignore
    }
    activeRunProcess = null;
    return true;
  }
  return false;
}

interface AppConfigStore {
  get(key: 'ollamaHostUrl'): string | undefined;
  set(key: 'ollamaHostUrl', value: string): void;
}

let configStorePromise: Promise<AppConfigStore> | null = null;
let resolvedOllamaHostUrl: string | null = null;

function getConfigStore(): Promise<AppConfigStore> {
  if (!configStorePromise) {
    const dynamicImport = new Function('specifier', 'return import(specifier);') as (
      specifier: string
    ) => Promise<{ default: new () => AppConfigStore }>;
    configStorePromise = dynamicImport('electron-store').then(({ default: Store }) => new Store());
  }

  return configStorePromise;
}

function checkPortOpen(hostname: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port, timeout: timeoutMs });
    const finish = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

interface OllamaProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  body: string;
}

function isLocalOllamaHost(hostname: string) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function getLocalOllamaCandidates(configuredUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    parsed = new URL('http://localhost:11434');
  }
  if (!isLocalOllamaHost(parsed.hostname)) return [configuredUrl];
  const port = parsed.port || '11434';
  return [...new Set([
    configuredUrl.replace(/\/+$/, ''),
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://[::1]:${port}`,
  ])];
}

function makeOllamaRequest(
  baseUrl: string,
  endpoint: string,
  method = 'GET',
  body?: unknown
): Promise<OllamaProxyResponse> {
  const target = new URL(endpoint, `${baseUrl.replace(/\/+$/, '')}/`);
  const transport = target.protocol === 'https:' ? https : http;
  const requestBody = body === undefined ? undefined : JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      target,
      {
        method,
        headers: requestBody
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(requestBody),
            }
          : undefined,
        timeout: 30 * 60 * 1000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          resolve({
            ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
            status: response.statusCode || 500,
            statusText: response.statusMessage || '',
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    request.on('timeout', () => request.destroy(new Error('Ollama request timed out')));
    request.on('error', reject);
    if (requestBody) request.write(requestBody);
    request.end();
  });
}

async function resolveOllamaHost(configuredUrl: string) {
  if (resolvedOllamaHostUrl) return resolvedOllamaHostUrl;
  const candidates = getLocalOllamaCandidates(configuredUrl);
  if (candidates.length === 1) {
    resolvedOllamaHostUrl = candidates[0];
    return resolvedOllamaHostUrl;
  }

  let firstHealthy: string | null = null;
  for (const candidate of candidates) {
    try {
      const response = await makeOllamaRequest(candidate, '/api/tags');
      if (!response.ok) continue;
      firstHealthy ||= candidate;
      const parsed = JSON.parse(response.body) as { models?: unknown[] };
      if ((parsed.models?.length || 0) > 0) {
        resolvedOllamaHostUrl = candidate;
        return candidate;
      }
    } catch {
      // Try the next local address family.
    }
  }

  resolvedOllamaHostUrl = firstHealthy || configuredUrl;
  return resolvedOllamaHostUrl;
}

async function startOllama() {
  let hostUrl = 'http://localhost:11434';
  try {
    const store = await getConfigStore();
    hostUrl = store.get('ollamaHostUrl') || hostUrl;
  } catch {
    // electron-store unavailable; fall back to the default local host
  }

  let parsedHost: URL;
  try {
    parsedHost = new URL(hostUrl);
  } catch {
    parsedHost = new URL('http://127.0.0.1:11434');
  }

  const isLocalHost = isLocalOllamaHost(parsedHost.hostname);
  if (!isLocalHost) {
    // The user has pointed Onyx Code at a remote Ollama instance - don't spawn a local one.
    return;
  }

  const port = parsedHost.port ? Number(parsedHost.port) : 11434;
  const localHosts = isLocalHost ? ['localhost', '127.0.0.1', '::1'] : [parsedHost.hostname];
  const alreadyRunning = (await Promise.all(localHosts.map((host) => checkPortOpen(host, port)))).some(Boolean);
  if (alreadyRunning) {
    // Something (a prior Onyx Code session, or the user's own `ollama serve`) is already
    // listening on this port - avoid spawning a redundant second instance.
    return;
  }

  try {
    ollamaProcess = spawn('ollama', ['serve'], {
      windowsHide: true,
      stdio: 'ignore',
      env: { ...process.env, OLLAMA_HOST: `${parsedHost.hostname}:${port}` },
    });
    ollamaProcess.on('error', () => {
      ollamaProcess = null;
    });
  } catch {
    ollamaProcess = null;
  }
}

function stopOllama() {
  if (ollamaProcess) {
    try {
      ollamaProcess.kill();
    } catch {
      // ignore
    }
    ollamaProcess = null;
  }
}

async function showOpenFileDialog(): Promise<FileOpenResult | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    defaultPath: currentWorkspaceRoot ?? app.getPath('documents'),
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  userGrantedFiles.add(normalizePath(filePath).toLowerCase());
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    path: filePath,
    name: path.basename(filePath),
    content,
  };
}

async function pickOpenFile(): Promise<{ path: string; name: string } | null> {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    defaultPath: currentWorkspaceRoot ?? app.getPath('documents'),
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = normalizePath(result.filePaths[0]);
  pendingPickedFiles.add(filePath.toLowerCase());
  return { path: filePath, name: path.basename(filePath) };
}

async function showSaveFileDialog(defaultPath?: string, content = ''): Promise<{ path: string; name: string } | null> {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: defaultPath ?? (currentWorkspaceRoot ? path.join(currentWorkspaceRoot, 'untitled.txt') : app.getPath('documents')),
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  await fs.mkdir(path.dirname(result.filePath), { recursive: true });
  await fs.writeFile(result.filePath, content, 'utf-8');
  userGrantedFiles.add(normalizePath(result.filePath).toLowerCase());
  return {
    path: result.filePath,
    name: path.basename(result.filePath),
  };
}

async function readDirectoryRecursive(dirPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') {
      continue;
    }
    if (['node_modules', 'dist', 'build', '.git', 'out'].includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      let children: FileNode[] = [];
      try {
        children = await readDirectoryRecursive(fullPath);
      } catch {
        // Skip subfolders we can't read (permission-denied system folders, broken
        // symlinks, etc.) instead of failing the entire workspace scan over one bad entry.
      }
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children,
      });
    } else {
      const ext = path.extname(entry.name).slice(1);
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        extension: ext,
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

function parseCppDiagnostics(output: string, defaultFilePath: string) {
  const diagnostics: Array<{
    id: string;
    filePath: string;
    fileName: string;
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    source: string;
  }> = [];

  const lines = output.split(/\r?\n/);
  // Matches GCC/Clang: file.cpp:12:5: error: message
  const gccRegex = /^(.*?):(\d+):(\d+):\s*(fatal error|error|warning|note):\s*(.*)$/i;
  // Matches MSVC: file.cpp(12,5): error C2065: message
  const msvcRegex = /^(.*?)\((\d+)(?:,(\d+))?\):\s*(fatal error|error|warning|note)\s*(?:[A-Z0-9]+)?:\s*(.*)$/i;

  lines.forEach((line, index) => {
    let match = line.match(gccRegex);
    if (match) {
      const rawFile = match[1].trim();
      const resolvedPath = path.isAbsolute(rawFile) ? rawFile : path.resolve(currentWorkspaceRoot || path.dirname(defaultFilePath), rawFile);
      const sev = match[4].toLowerCase().includes('error') ? 'error' : match[4].toLowerCase().includes('warning') ? 'warning' : 'info';
      diagnostics.push({
        id: `cpp-diag-${Date.now()}-${index}`,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: sev,
        message: match[5].trim(),
        source: 'C++ Compiler',
      });
      return;
    }

    match = line.match(msvcRegex);
    if (match) {
      const rawFile = match[1].trim();
      const resolvedPath = path.isAbsolute(rawFile) ? rawFile : path.resolve(currentWorkspaceRoot || path.dirname(defaultFilePath), rawFile);
      const sev = match[4].toLowerCase().includes('error') ? 'error' : match[4].toLowerCase().includes('warning') ? 'warning' : 'info';
      diagnostics.push({
        id: `cpp-diag-${Date.now()}-${index}`,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        line: parseInt(match[2], 10),
        column: match[3] ? parseInt(match[3], 10) : 1,
        severity: sev,
        message: match[5].trim(),
        source: 'MSVC C++',
      });
    }
  });

  return diagnostics;
}

async function detectCppCompilers() {
  const candidates = [
    { name: 'GCC (g++)', command: 'g++' },
    { name: 'Clang (clang++)', command: 'clang++' },
    { name: 'MSVC (cl.exe)', command: 'cl' },
    { name: 'GCC (gcc)', command: 'gcc' },
  ];

  const results = [];
  for (const item of candidates) {
    try {
      const testCmd = process.platform === 'win32' ? `where ${item.command}` : `which ${item.command}`;
      await execAsync(testCmd);
      results.push({ name: item.name, command: item.command, available: true });
    } catch {
      results.push({ name: item.name, command: item.command, available: false });
    }
  }

  return results;
}

async function compileAndRunCpp(filePath: string, runAfter = true) {
  assertWorkspacePath(filePath);

  if (activeRunProcess) {
    stopActiveRun();
  }

  lastRunFilePath = filePath;
  const cwd = currentWorkspaceRoot ?? path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const outExt = process.platform === 'win32' ? '.exe' : '';
  const outPath = path.join(path.dirname(filePath), `${baseName}${outExt}`);

  sendRunEvent('run-output', { type: 'system', message: `=== [C++ Build Started: ${path.basename(filePath)}] ===` });
  sendRunEvent('run-status', { state: 'running', filePath });

  // Check which compiler is available
  const compilers = await detectCppCompilers();
  const activeCompiler = compilers.find((c) => c.available)?.command || 'g++';

  const compileArgs = ['-std=c++20', '-O2', filePath, '-o', outPath];
  sendRunEvent('run-output', { type: 'system', message: `$ ${activeCompiler} ${compileArgs.join(' ')}` });

  try {
    const { stdout, stderr } = await execFileAsync(activeCompiler, compileArgs, { cwd });
    if (stdout.trim()) {
      sendRunEvent('run-output', { type: 'stdout', message: stdout });
    }
    if (stderr.trim()) {
      sendRunEvent('run-output', { type: 'stderr', message: stderr });
    }

    // Clear diagnostics or parse any warnings
    const diags = parseCppDiagnostics(stderr, filePath);
    sendRunEvent('diagnostics', diags);

    sendRunEvent('run-output', { type: 'system', message: `✓ [C++ Build Succeeded] -> ${path.basename(outPath)}` });

    if (!runAfter) {
      sendRunEvent('run-status', { state: 'idle', filePath });
      return { success: true, diagnostics: diags };
    }

    // Execute compiled binary
    sendRunEvent('run-output', { type: 'system', message: `=== [Running: ./${path.basename(outPath)}] ===\n` });

    activeRunProcess = spawn(outPath, [], {
      cwd,
      windowsHide: true,
    });

    activeRunProcess.stdout?.on('data', (chunk: Buffer) => {
      sendRunEvent('run-output', { type: 'stdout', message: chunk.toString() });
    });

    activeRunProcess.stderr?.on('data', (chunk: Buffer) => {
      sendRunEvent('run-output', { type: 'stderr', message: chunk.toString() });
    });

    activeRunProcess.on('error', (error) => {
      sendRunEvent('run-output', { type: 'stderr', message: error.message });
      sendRunEvent('run-status', { state: 'error', filePath, message: error.message });
      activeRunProcess = null;
    });

    activeRunProcess.on('exit', (code, signal) => {
      sendRunEvent('run-output', {
        type: 'system',
        message: `\n=== [Process Finished with exit code ${code ?? 0}] ===`,
      });
      sendRunEvent('run-status', { state: 'idle', filePath, code, signal });
      activeRunProcess = null;
    });

    return { success: true, diagnostics: diags };
  } catch (error: any) {
    const errorOutput = `${error.stdout || ''}\n${error.stderr || error.message || ''}`;
    sendRunEvent('run-output', { type: 'stderr', message: errorOutput });
    sendRunEvent('run-output', {
      type: 'system',
      message: `✗ [C++ Build Failed]\nTip: Ensure GCC/MinGW (g++) or Clang is installed on your PATH.\nInstall on Windows: 'winget install -e --id MSYS2.MSYS2' or download WinLibs from winlibs.com`,
    });

    const diags = parseCppDiagnostics(errorOutput, filePath);
    sendRunEvent('diagnostics', diags);
    sendRunEvent('run-status', { state: 'error', filePath, message: 'Build failed' });
    return { success: false, diagnostics: diags, output: errorOutput };
  }
}

async function getRecentWorkspaces(): Promise<Array<{ name: string; path: string; lastOpened: number }>> {
  const storePath = path.join(app.getPath('userData'), 'recent_workspaces.json');
  try {
    const raw = await fs.readFile(storePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function addRecentWorkspace(workspacePath: string) {
  const storePath = path.join(app.getPath('userData'), 'recent_workspaces.json');
  const current = await getRecentWorkspaces();
  const norm = normalizePath(workspacePath);
  const name = path.basename(norm);
  const filtered = current.filter((w) => normalizePath(w.path) !== norm);
  filtered.unshift({ name, path: norm, lastOpened: Date.now() });
  const trimmed = filtered.slice(0, 10);
  try {
    await fs.writeFile(storePath, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save recent workspaces', err);
  }
}

function resolveRunCommand(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case '.js':
    case '.cjs':
    case '.mjs':
      return { command: 'node', args: [filePath] };
    case '.ts':
    case '.tsx':
      return { command: 'npx', args: ['-y', 'tsx', filePath] };
    case '.py':
      return { command: 'python', args: ['-u', filePath] };
    case '.go':
      return { command: 'go', args: ['run', filePath] };
    case '.java':
      return { command: 'java', args: [filePath] };
    case '.ps1':
      return { command: 'powershell', args: ['-ExecutionPolicy', 'Bypass', '-File', filePath] };
    case '.sh':
      return { command: 'bash', args: [filePath] };
    case '.cmd':
    case '.bat':
      return { command: 'cmd.exe', args: ['/c', filePath] };
    default:
      throw new Error(`Running ${extension || 'this file type'} directly is not supported yet`);
  }
}

async function compileAndRunRust(filePath: string) {
  assertWorkspacePath(filePath);
  if (activeRunProcess) stopActiveRun();

  lastRunFilePath = filePath;
  const cwd = currentWorkspaceRoot ?? path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const outExt = process.platform === 'win32' ? '.exe' : '';
  const outPath = path.join(path.dirname(filePath), `${baseName}${outExt}`);

  sendRunEvent('run-output', { type: 'system', message: `=== [Rust Build: rustc "${filePath}"] ===` });
  sendRunEvent('run-status', { state: 'running', filePath });

  try {
    const { stdout, stderr } = await execAsync(`rustc -O "${filePath}" -o "${outPath}"`, { cwd });
    if (stdout.trim()) sendRunEvent('run-output', { type: 'stdout', message: stdout });
    if (stderr.trim()) sendRunEvent('run-output', { type: 'stderr', message: stderr });

    sendRunEvent('run-output', { type: 'system', message: `✓ [Rust Build Succeeded] -> ${path.basename(outPath)}\n` });

    activeRunProcess = spawn(outPath, [], { cwd, windowsHide: true });
    activeRunProcess.stdout?.on('data', (chunk: Buffer) => sendRunEvent('run-output', { type: 'stdout', message: chunk.toString() }));
    activeRunProcess.stderr?.on('data', (chunk: Buffer) => sendRunEvent('run-output', { type: 'stderr', message: chunk.toString() }));
    activeRunProcess.on('exit', (code) => {
      sendRunEvent('run-output', { type: 'system', message: `\n=== [Process Finished with exit code ${code ?? 0}] ===` });
      sendRunEvent('run-status', { state: 'idle', filePath, code });
      activeRunProcess = null;
    });
    return { success: true };
  } catch (error: any) {
    sendRunEvent('run-output', { type: 'stderr', message: error.stderr || error.message });
    sendRunEvent('run-status', { state: 'error', filePath });
    return { success: false };
  }
}

function runFile(filePath: string) {
  assertWorkspacePath(filePath);

  const ext = path.extname(filePath).toLowerCase();
  if (['.cpp', '.c', '.cc', '.cxx', '.hpp', '.h'].includes(ext)) {
    return compileAndRunCpp(filePath, true);
  }
  if (ext === '.rs') {
    return compileAndRunRust(filePath);
  }

  if (activeRunProcess) {
    stopActiveRun();
  }

  const { command, args } = resolveRunCommand(filePath);
  const cwd = currentWorkspaceRoot ?? path.dirname(filePath);
  lastRunFilePath = filePath;

  sendRunEvent('run-output', { type: 'system', message: `$ ${command} ${args.join(' ')}` });
  sendRunEvent('run-status', { state: 'running', filePath });

  activeRunProcess = spawn(command, args, {
    cwd,
    windowsHide: true,
  });

  activeRunProcess.stdout?.on('data', (chunk: Buffer) => {
    sendRunEvent('run-output', { type: 'stdout', message: chunk.toString() });
  });

  activeRunProcess.stderr?.on('data', (chunk: Buffer) => {
    sendRunEvent('run-output', { type: 'stderr', message: chunk.toString() });
  });

  activeRunProcess.on('error', (error) => {
    sendRunEvent('run-output', { type: 'stderr', message: error.message });
    sendRunEvent('run-status', { state: 'error', filePath, message: error.message });
    activeRunProcess = null;
  });

  activeRunProcess.on('exit', (code, signal) => {
    sendRunEvent('run-output', {
      type: 'system',
      message: signal ? `\nProcess stopped with signal ${signal}` : `\nProcess exited with code ${code ?? 0}`,
    });
    sendRunEvent('run-status', { state: 'idle', filePath, code, signal });
    activeRunProcess = null;
  });
}

function setupFileSystemHandlers() {
  ipcMain.handle('open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      defaultPath: currentWorkspaceRoot ?? app.getPath('documents'),
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return normalizePath(result.filePaths[0]);
  });

  ipcMain.handle('get-recent-workspaces', async () => {
    return getRecentWorkspaces();
  });

  ipcMain.handle('set-workspace-root', async (_, targetPath: string) => {
    return setWorkspaceRoot(targetPath);
  });

  ipcMain.handle('add-recent-workspace', async (_, targetPath: string) => {
    if (targetPath) {
      await addRecentWorkspace(targetPath);
    }
  });

  ipcMain.handle('open-file-dialog', async () => showOpenFileDialog());
  ipcMain.handle('pick-file-dialog', async () => pickOpenFile());
  ipcMain.handle('authorize-picked-file', async (_, filePath: string) => {
    const normalized = normalizePath(filePath).toLowerCase();
    if (!pendingPickedFiles.has(normalized)) throw new Error('This file was not selected by the file picker');
    pendingPickedFiles.delete(normalized);
    userGrantedFiles.add(normalized);
    return true;
  });
  ipcMain.handle('discard-picked-file', async (_, filePath: string) => {
    pendingPickedFiles.delete(normalizePath(filePath).toLowerCase());
    return true;
  });

  ipcMain.handle('save-file-dialog', async (_, payload: { defaultPath?: string; content: string }) => {
    if (!payload || typeof payload.content !== 'string') {
      throw new Error('Invalid save request');
    }

    return showSaveFileDialog(payload.defaultPath, payload.content);
  });

  ipcMain.handle('read-directory', async (_, dirPath: string) => {
    assertWorkspacePath(dirPath);
    return readDirectoryRecursive(dirPath);
  });

  ipcMain.handle('read-file', async (_, filePath: string) => {
    assertWorkspacePath(filePath);
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
    if (typeof content !== 'string') {
      throw new Error('Invalid file contents');
    }

    assertWorkspacePath(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('create-file', async (_, filePath: string) => {
    assertWorkspacePath(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '', 'utf-8');
    return true;
  });

  ipcMain.handle('create-folder', async (_, dirPath: string) => {
    assertWorkspacePath(dirPath);
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  });

  ipcMain.handle('delete-file', async (_, filePath: string) => {
    assertWorkspacePath(filePath);
    await fs.unlink(filePath);
    return true;
  });

  ipcMain.handle('delete-folder', async (_, dirPath: string) => {
    assertWorkspacePath(dirPath);
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  });

  ipcMain.handle('edit-file', async (_, filePath: string, oldText: string, newText: string) => {
    assertWorkspacePath(filePath);

    if (typeof oldText !== 'string' || typeof newText !== 'string') {
      throw new Error('Invalid edit payload');
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const occurrences = oldText.length === 0 ? 0 : content.split(oldText).length - 1;

    if (occurrences === 0) {
      throw new Error(`No exact match for the given text was found in ${path.basename(filePath)}`);
    }

    if (occurrences > 1) {
      throw new Error(`The given text matched ${occurrences} times in ${path.basename(filePath)}; it must be unique. Include more surrounding context.`);
    }

    const nextContent = content.replace(oldText, newText);
    await fs.writeFile(filePath, nextContent, 'utf-8');
    return { success: true };
  });
}

function setupRunHandlers() {
  ipcMain.handle('run-current-file', async (_, filePath: string) => {
    runFile(filePath);
    return { success: true };
  });

  ipcMain.handle('compile-cpp-file', async (_, filePath: string, runAfter = false) => {
    return compileAndRunCpp(filePath, runAfter);
  });

  ipcMain.handle('detect-cpp-compilers', async () => {
    return detectCppCompilers();
  });

  ipcMain.handle('stop-run', async () => ({
    success: stopActiveRun(),
  }));

  ipcMain.handle('restart-run', async () => {
    if (!lastRunFilePath) {
      throw new Error('Nothing has been run yet');
    }

    runFile(lastRunFilePath);
    return { success: true };
  });

  ipcMain.handle('run-terminal-command', async (_, command: string) => {
    if (!currentWorkspaceRoot) {
      throw new Error('Open a workspace folder first to run commands');
    }

    try {
      const { stdout, stderr } = await execAsync(command, { cwd: currentWorkspaceRoot });
      return { stdout, stderr };
    } catch (error: any) {
      return { stdout: error.stdout || '', stderr: error.stderr || error.message };
    }
  });
}

function setupShellHandlers() {
  ipcMain.handle('open-external-link', async (_, url: string) => {
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      throw new Error('Only http(s) and mailto links are allowed');
    }

    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('open-local-file', async (_, filePath: string) => {
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Intentionally exempt from workspace confinement: this only ever opens a file
    // via the OS's default handler (shell.openExternal), never reads its contents into
    // the app, and is meant for user-picked files that may live outside the workspace.
    const normalized = normalizePath(filePath);
    if (path.extname(normalized).toLowerCase() !== '.html') {
      throw new Error('Only local HTML files can be opened this way');
    }

    await shell.openExternal(pathToFileURL(normalized).toString());
    return true;
  });
}

const terminalProcesses = new Map<string, any>();

function stopAllTerminals() {
  for (const terminal of terminalProcesses.values()) {
    try {
      terminal.kill();
    } catch {
      // Process may already have exited.
    }
  }
  terminalProcesses.clear();
}

type TerminalProfile = 'powershell' | 'cmd' | 'gitbash';

function terminalKey(webContentsId: number, terminalId: string) {
  return `${webContentsId}:${terminalId}`;
}

function getTerminalProfiles(): Array<{ id: TerminalProfile; label: string; available: boolean }> {
  if (process.platform !== 'win32') {
    return [
      { id: 'powershell', label: 'PowerShell', available: true },
      { id: 'cmd', label: 'Default Shell', available: true },
      { id: 'gitbash', label: 'Bash', available: true },
    ];
  }

  const gitCandidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ];
  return [
    { id: 'powershell', label: 'PowerShell', available: true },
    { id: 'cmd', label: 'Command Prompt', available: true },
    { id: 'gitbash', label: 'Git Bash', available: gitCandidates.some((candidate) => fsSync.existsSync(candidate)) },
  ];
}

function resolveTerminalShell(profile: TerminalProfile) {
  if (process.platform !== 'win32') {
    return {
      executable: process.env.SHELL || '/bin/bash',
      args: [] as string[],
    };
  }

  if (profile === 'cmd') return { executable: process.env.COMSPEC || 'cmd.exe', args: [] as string[] };
  if (profile === 'gitbash') {
    const candidates = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
    ];
    const executable = candidates.find((candidate) => fsSync.existsSync(candidate));
    if (!executable) throw new Error('Git Bash was not found. Install Git for Windows or select another profile.');
    return { executable, args: ['--login', '-i'] };
  }

  return {
    executable: 'powershell.exe',
    args: ['-NoLogo'],
  };
}

function setupGitHandlers() {
  ipcMain.handle('git-status', async () => {
    if (!currentWorkspaceRoot) return '';
    try {
      const { stdout } = await execAsync('git status -s', { cwd: currentWorkspaceRoot });
      return stdout;
    } catch {
      return '';
    }
  });
  ipcMain.handle('git-branch', async () => {
    if (!currentWorkspaceRoot) return 'main';
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: currentWorkspaceRoot });
      return stdout.trim() || 'main';
    } catch {
      return 'main';
    }
  });
  ipcMain.handle('git-add', async (_event, file: string) => {
    if (!currentWorkspaceRoot) return;
    await execFileAsync('git', ['add', file], { cwd: currentWorkspaceRoot });
  });
  ipcMain.handle('git-commit', async (_event, message: string) => {
    if (!currentWorkspaceRoot) return;
    await execFileAsync('git', ['commit', '-m', message], { cwd: currentWorkspaceRoot });
  });
}

async function searchFilesRecursive(dir: string, query: string, results: {path: string, name: string}[]) {
  if (results.length > 50) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.next') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await searchFilesRecursive(fullPath, query, results);
    } else {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ path: fullPath, name: entry.name });
        }
      } catch (e) {
        // Ignore unreadable files
      }
    }
  }
}

function setupTerminalHandlers() {
  ipcMain.handle('terminal-profiles', async () => getTerminalProfiles());

  ipcMain.on('terminal-create', (event, payload: { id: string; profile: TerminalProfile; cols?: number; rows?: number }) => {
    const terminalId = payload?.id;
    const profile = payload?.profile || 'powershell';
    if (!terminalId) return;
    const key = terminalKey(event.sender.id, terminalId);
    try {
      const pty = require('node-pty');
      const existing = terminalProcesses.get(key);
      if (existing) existing.kill();
      const shell = resolveTerminalShell(profile);
      const currentPty = pty.spawn(shell.executable, shell.args, {
        name: 'xterm-256color',
        cols: Math.max(2, Number(payload.cols) || 80),
        rows: Math.max(1, Number(payload.rows) || 30),
        cwd: currentWorkspaceRoot || process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });

      terminalProcesses.set(key, currentPty);

      currentPty.onData((data: string) => {
        if (event.sender.isDestroyed()) return;
        event.sender.send('terminal-data', { id: terminalId, data });
      });

      currentPty.onExit(({ exitCode }: { exitCode: number }) => {
        if (terminalProcesses.get(key) === currentPty) {
          terminalProcesses.delete(key);
          if (!event.sender.isDestroyed()) {
            event.sender.send('terminal-exit', { id: terminalId, exitCode });
          }
        }
      });
    } catch (err) {
      console.error('Failed to init node-pty', err);
      if (!event.sender.isDestroyed()) {
        event.sender.send('terminal-data', {
          id: terminalId,
          data: `\x1b[31mTerminal initialization failed.\r\n${err}\x1b[0m\r\n`,
        });
      }
    }
  });

  ipcMain.on('terminal-input', (event, payload: { id: string; data: string }) => {
    terminalProcesses.get(terminalKey(event.sender.id, payload?.id))?.write(payload?.data || '');
  });

  ipcMain.on('terminal-resize', (event, payload: { id: string; cols: number; rows: number }) => {
    const terminal = terminalProcesses.get(terminalKey(event.sender.id, payload?.id));
    if (terminal) terminal.resize(Math.max(2, payload.cols), Math.max(1, payload.rows));
  });

  ipcMain.on('terminal-kill', (event, terminalId: string) => {
    const key = terminalKey(event.sender.id, terminalId);
    const terminal = terminalProcesses.get(key);
    if (terminal) terminal.kill();
    terminalProcesses.delete(key);
  });
}

function setupConfigHandlers() {
  ipcMain.handle('set-ollama-host', async (_, url: string) => {
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('A valid Ollama host URL is required');
    }

    const store = await getConfigStore();
    store.set('ollamaHostUrl', url.trim());
    resolvedOllamaHostUrl = null;
    return true;
  });

  ipcMain.handle('get-ollama-host', async () => {
    const store = await getConfigStore();
    return resolveOllamaHost(store.get('ollamaHostUrl') || 'http://localhost:11434');
  });

  ipcMain.handle(
    'ollama-request',
    async (
      _,
      payload: { endpoint: string; method?: string; body?: unknown }
    ): Promise<{ ok: boolean; status: number; statusText: string; body: string }> => {
      const endpoint = payload?.endpoint;
      const method = (payload?.method || 'GET').toUpperCase();
      if (typeof endpoint !== 'string' || !endpoint.startsWith('/api/')) {
        throw new Error('Only Ollama /api endpoints are allowed');
      }
      if (!['GET', 'POST', 'DELETE'].includes(method)) {
        throw new Error(`Unsupported Ollama request method: ${method}`);
      }

      const store = await getConfigStore();
      const configuredUrl = store.get('ollamaHostUrl') || 'http://localhost:11434';
      const baseUrl = await resolveOllamaHost(configuredUrl);
      return makeOllamaRequest(baseUrl, endpoint, method, payload.body);
    }
  );

  ipcMain.on(
    'ollama-stream-start',
    async (
      event,
      payload: { requestId: string; endpoint: string; method?: string; body?: unknown }
    ) => {
      const requestId = String(payload?.requestId || '');
      const endpoint = payload?.endpoint;
      const method = (payload?.method || 'POST').toUpperCase();
      const streamKey = `${event.sender.id}:${requestId}`;
      const send = (message: Record<string, unknown>) => {
        if (!event.sender.isDestroyed()) event.sender.send('ollama-stream-event', { requestId, ...message });
      };

      if (!requestId || typeof endpoint !== 'string' || !endpoint.startsWith('/api/') || !['GET', 'POST', 'DELETE'].includes(method)) {
        send({ type: 'error', error: 'Invalid Ollama stream request' });
        return;
      }

      try {
        const store = await getConfigStore();
        const baseUrl = await resolveOllamaHost(store.get('ollamaHostUrl') || 'http://localhost:11434');
        if (cancelledOllamaStreams.delete(streamKey)) return;
        const target = new URL(endpoint, `${baseUrl.replace(/\/+$/, '')}/`);
        const transport = target.protocol === 'https:' ? https : http;
        const requestBody = payload.body === undefined ? undefined : JSON.stringify(payload.body);
        const request = transport.request(
          target,
          {
            method,
            headers: requestBody
              ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody) }
              : undefined,
            timeout: 30 * 60 * 1000,
          },
          (response) => {
            const ok = (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300;
            let errorBody = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => {
              if (ok) send({ type: 'data', chunk });
              else errorBody += chunk;
            });
            response.on('end', () => {
              activeOllamaStreams.delete(streamKey);
              cancelledOllamaStreams.delete(streamKey);
              if (ok) send({ type: 'end' });
              else send({ type: 'error', error: errorBody || `Ollama HTTP ${response.statusCode || 500}` });
            });
          }
        );
        activeOllamaStreams.set(streamKey, request);
        request.on('timeout', () => request.destroy(new Error('Ollama request timed out')));
        request.on('error', (error) => {
          activeOllamaStreams.delete(streamKey);
          if (!cancelledOllamaStreams.delete(streamKey)) send({ type: 'error', error: error.message });
        });
        if (requestBody) request.write(requestBody);
        request.end();
      } catch (error) {
        activeOllamaStreams.delete(streamKey);
        cancelledOllamaStreams.delete(streamKey);
        send({ type: 'error', error: error instanceof Error ? error.message : 'Ollama stream failed' });
      }
    }
  );

  ipcMain.on('ollama-stream-abort', (event, requestId: string) => {
    const streamKey = `${event.sender.id}:${String(requestId || '')}`;
    cancelledOllamaStreams.add(streamKey);
    activeOllamaStreams.get(streamKey)?.destroy();
    activeOllamaStreams.delete(streamKey);
  });
}

function initializeHandlers() {
  if (handlersInitialized) {
    return;
  }

  setupFileSystemHandlers();
  setupRunHandlers();
  setupShellHandlers();
  setupTerminalHandlers();
  setupGitHandlers();
  setupConfigHandlers();
  setupPluginHandlers({
    userDataPath: app.getPath('userData'),
    getWorkspaceRoot: () => currentWorkspaceRoot,
    getMainWindow: () => mainWindow,
  });

  ipcMain.handle('search-files', async (event, query: string) => {
    if (!currentWorkspaceRoot || !query.trim()) return [];
    const results: {path: string, name: string}[] = [];
    await searchFilesRecursive(currentWorkspaceRoot, query, results);
    return results;
  });

  handlersInitialized = true;
}

function createBrowserWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0e0e11',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return win;
}

function openNewWindow() {
  // An independent window - its own workspace/editor state in the renderer,
  // not tied to the primary window's run/terminal process state in main.
  createBrowserWindow();
}

function createWindow() {
  mainWindow = createBrowserWindow();

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return;
    }

    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window-close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle('new-window', () => openNewWindow());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  initializeHandlers();
}

app.whenReady().then(() => {
  try {
    initDatabase();
  } catch (error) {
    // Non-fatal: the local auth/feedback database is optional infrastructure.
    // A failure here (e.g. a native module ABI mismatch after a Node/Electron
    // upgrade) must never prevent the actual IDE window from opening.
    console.error('Failed to initialize local database - auth/feedback features will be unavailable:', error);
  }
  setupAuthHandlers();
  setupFeedbackHandlers();
  startOllama();
  setTimeout(createWindow, 700);
});

app.on('window-all-closed', () => {
  stopActiveRun();
  stopAllTerminals();
  stopOllama();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
