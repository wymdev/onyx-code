import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vm from 'vm';

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

interface PluginState {
  enabled: Record<string, boolean>;
}

interface RegisteredCommand {
  id: string;
  title: string;
  pluginId: string;
  handler: (args?: unknown) => unknown | Promise<unknown>;
}

interface SetupPluginOptions {
  userDataPath: string;
  getWorkspaceRoot: () => string | null;
  getMainWindow: () => BrowserWindow | null;
}

const ALLOWED_PERMISSIONS = new Set<PluginPermission>(['commands', 'workspace.read', 'workspace.write']);
const commands = new Map<string, RegisteredCommand>();
const activationErrors = new Map<string, string>();
let workspaceTrusted = false;

function validateManifest(raw: unknown): OnyxPluginManifest {
  const manifest = raw as OnyxPluginManifest;
  if (!manifest || typeof manifest !== 'object') throw new Error('onyx-plugin.json must contain an object');
  if (!/^[a-z0-9][a-z0-9._-]+$/i.test(manifest.id || '')) throw new Error('Plugin id is invalid');
  if (!manifest.name?.trim()) throw new Error('Plugin name is required');
  if (!manifest.version?.trim()) throw new Error('Plugin version is required');
  const permissions = manifest.permissions || [];
  for (const permission of permissions) {
    if (!ALLOWED_PERMISSIONS.has(permission)) throw new Error(`Unsupported plugin permission: ${permission}`);
  }
  if (manifest.main && (path.isAbsolute(manifest.main) || manifest.main.split(/[\\/]/).includes('..'))) {
    throw new Error('Plugin main must be a path inside the plugin folder');
  }
  return { ...manifest, permissions };
}

async function readManifest(pluginDir: string) {
  const manifestPath = path.join(pluginDir, 'onyx-plugin.json');
  const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return validateManifest(raw);
}

export function setupPluginHandlers(options: SetupPluginOptions) {
  const pluginsRoot = path.join(options.userDataPath, 'plugins');
  const statePath = path.join(pluginsRoot, 'state.json');

  const readState = async (): Promise<PluginState> => {
    try {
      return JSON.parse(await fs.readFile(statePath, 'utf8'));
    } catch {
      return { enabled: {} };
    }
  };

  const writeState = async (state: PluginState) => {
    await fs.mkdir(pluginsRoot, { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
  };

  const clearPluginCommands = (pluginId: string) => {
    for (const [id, command] of commands) {
      if (command.pluginId === pluginId) commands.delete(id);
    }
  };

  const resolveWorkspacePath = (relativePath: string) => {
    if (!workspaceTrusted) throw new Error('Plugin workspace access is blocked in Restricted Mode');
    const root = options.getWorkspaceRoot();
    if (!root) throw new Error('Open a workspace folder first');
    const resolved = path.resolve(root, relativePath || '.');
    const normalizedRoot = path.resolve(root).toLowerCase();
    const normalizedTarget = resolved.toLowerCase();
    if (normalizedTarget !== normalizedRoot && !normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error('Plugin path is outside the open workspace');
    }
    return resolved;
  };

  const activatePlugin = async (pluginDir: string, manifest: OnyxPluginManifest) => {
    clearPluginCommands(manifest.id);
    activationErrors.delete(manifest.id);
    if (!manifest.main) return;
    const permissions = new Set(manifest.permissions || []);
    if (!workspaceTrusted && (permissions.has('workspace.read') || permissions.has('workspace.write'))) {
      activationErrors.set(manifest.id, 'Waiting for a trusted workspace');
      return;
    }

    try {
      const entryPath = path.resolve(pluginDir, manifest.main);
      if (!entryPath.startsWith(`${path.resolve(pluginDir)}${path.sep}`)) throw new Error('Plugin entry is outside its folder');
      const source = await fs.readFile(entryPath, 'utf8');
      const moduleRecord: { exports: any } = { exports: {} };
      const sandbox = vm.createContext({
        module: moduleRecord,
        exports: moduleRecord.exports,
        console: Object.freeze({ log: console.log, warn: console.warn, error: console.error }),
        setTimeout,
        clearTimeout,
      });
      const script = new vm.Script(`"use strict";\n${source}`, { filename: entryPath });
      script.runInContext(sandbox, { timeout: 1000 });
      const activate = moduleRecord.exports?.activate;
      if (typeof activate !== 'function') throw new Error('Plugin main must export activate(api)');

      const api = Object.freeze({
        registerCommand: (id: string, title: string, handler: RegisteredCommand['handler']) => {
          if (!permissions.has('commands')) throw new Error('Plugin did not request the commands permission');
          if (typeof handler !== 'function') throw new Error('Command handler must be a function');
          const commandId = id.startsWith(`${manifest.id}.`) ? id : `${manifest.id}.${id}`;
          commands.set(commandId, { id: commandId, title: title || commandId, pluginId: manifest.id, handler });
        },
        showMessage: (message: string) => {
          options.getMainWindow()?.webContents.send('plugin-message', { pluginId: manifest.id, message: String(message) });
        },
        workspace: Object.freeze({
          readText: async (relativePath: string) => {
            if (!permissions.has('workspace.read')) throw new Error('Plugin did not request workspace.read');
            return fs.readFile(resolveWorkspacePath(relativePath), 'utf8');
          },
          writeText: async (relativePath: string, content: string) => {
            if (!permissions.has('workspace.write')) throw new Error('Plugin did not request workspace.write');
            const target = resolveWorkspacePath(relativePath);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, String(content), 'utf8');
            return true;
          },
        }),
      });
      await Promise.resolve(activate(api));
    } catch (error) {
      activationErrors.set(manifest.id, error instanceof Error ? error.message : 'Plugin activation failed');
      clearPluginCommands(manifest.id);
    }
  };

  const listPlugins = async () => {
    await fs.mkdir(pluginsRoot, { recursive: true });
    const state = await readState();
    const entries = await fs.readdir(pluginsRoot, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const pluginDir = path.join(pluginsRoot, entry.name);
        const manifest = await readManifest(pluginDir);
        const enabled = state.enabled[manifest.id] !== false;
        if (enabled) await activatePlugin(pluginDir, manifest);
        else clearPluginCommands(manifest.id);
        result.push({
          manifest,
          enabled,
          active: enabled && !activationErrors.has(manifest.id),
          error: activationErrors.get(manifest.id),
          commandCount: [...commands.values()].filter((command) => command.pluginId === manifest.id).length,
        });
      } catch (error) {
        console.error(`Failed to load plugin ${entry.name}:`, error);
      }
    }
    return result;
  };

  ipcMain.handle('plugins-inspect', async () => {
    const browserWindow = options.getMainWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title: 'Select an Onyx plugin folder',
      properties: ['openDirectory'],
    };
    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || !result.filePaths[0]) return null;
    const sourcePath = path.resolve(result.filePaths[0]);
    return { sourcePath, manifest: await readManifest(sourcePath) };
  });

  ipcMain.handle('plugins-install', async (_, payload: { sourcePath: string; approvedPermissions: PluginPermission[] }) => {
    const sourcePath = path.resolve(payload.sourcePath);
    const manifest = await readManifest(sourcePath);
    const approved = new Set(payload.approvedPermissions || []);
    for (const permission of manifest.permissions || []) {
      if (!approved.has(permission)) throw new Error(`Permission was not approved: ${permission}`);
    }
    const target = path.join(pluginsRoot, manifest.id);
    if (path.resolve(target) === sourcePath) throw new Error('This plugin is already installed');
    await fs.mkdir(pluginsRoot, { recursive: true });
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(sourcePath, target, { recursive: true });
    const state = await readState();
    state.enabled[manifest.id] = true;
    await writeState(state);
    await activatePlugin(target, manifest);
    return { success: true, manifest, error: activationErrors.get(manifest.id) };
  });

  ipcMain.handle('plugins-list', listPlugins);
  ipcMain.handle('plugins-set-enabled', async (_, pluginId: string, enabled: boolean) => {
    const state = await readState();
    state.enabled[pluginId] = enabled;
    await writeState(state);
    if (!enabled) clearPluginCommands(pluginId);
    return listPlugins();
  });
  ipcMain.handle('plugins-uninstall', async (_, pluginId: string) => {
    if (!/^[a-z0-9][a-z0-9._-]+$/i.test(pluginId)) throw new Error('Invalid plugin id');
    clearPluginCommands(pluginId);
    activationErrors.delete(pluginId);
    await fs.rm(path.join(pluginsRoot, pluginId), { recursive: true, force: true });
    const state = await readState();
    delete state.enabled[pluginId];
    await writeState(state);
    return true;
  });
  ipcMain.handle('plugins-commands', async () => [...commands.values()].map(({ id, title, pluginId }) => ({ id, title, pluginId })));
  ipcMain.handle('plugins-invoke-command', async (_, commandId: string, args?: unknown) => {
    const command = commands.get(commandId);
    if (!command) throw new Error(`Plugin command is not registered: ${commandId}`);
    return command.handler(args);
  });
  ipcMain.handle('plugins-set-workspace-trusted', async (_, trusted: boolean) => {
    workspaceTrusted = Boolean(trusted);
    return listPlugins();
  });
}
