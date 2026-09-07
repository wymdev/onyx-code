import { InstalledOnyxPlugin, OnyxPluginManifest, PluginPermission } from '../types';

function bridge() {
  return window.plugins;
}

export const plugins = {
  isAvailable(): boolean {
    return Boolean(bridge());
  },
  async inspect(): Promise<{ sourcePath: string; manifest: OnyxPluginManifest } | null | undefined> {
    return bridge()?.inspect();
  },
  async install(payload: {
    sourcePath: string;
    approvedPermissions: PluginPermission[];
  }): Promise<{ success: boolean; manifest: OnyxPluginManifest; error?: string } | undefined> {
    return bridge()?.install(payload);
  },
  async list(): Promise<InstalledOnyxPlugin[]> {
    return (await bridge()?.list()) ?? [];
  },
  async setEnabled(pluginId: string, enabled: boolean): Promise<InstalledOnyxPlugin[]> {
    return (await bridge()?.setEnabled(pluginId, enabled)) ?? [];
  },
  async uninstall(pluginId: string): Promise<boolean | undefined> {
    return bridge()?.uninstall(pluginId);
  },
  async commands(): Promise<Array<{ id: string; title: string; pluginId: string }>> {
    return (await bridge()?.commands()) ?? [];
  },
  async invokeCommand(commandId: string, args?: unknown): Promise<unknown> {
    return bridge()?.invokeCommand(commandId, args);
  },
  async setWorkspaceTrusted(trusted: boolean): Promise<InstalledOnyxPlugin[] | undefined> {
    return bridge()?.setWorkspaceTrusted(trusted);
  },
  onMessage(callback: (payload: { pluginId: string; message: string }) => void): () => void {
    return bridge()?.onMessage(callback) ?? (() => {});
  },
};
