import { DialogFileResult, FileNode, RecentWorkspace, SavedFileResult } from '../types';

function bridge() {
  return window.fileSystem;
}

let webDirectoryHandle: any = null;
const webFileHandles = new Map<string, any>();

async function traverseDirectory(handle: any, currentPath: string): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  try {
    for await (const entry of handle.values()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'directory') {
        const children = await traverseDirectory(entry, entryPath);
        nodes.push({
          name: entry.name,
          path: entryPath,
          type: 'directory',
          children,
        });
      } else {
        webFileHandles.set(entryPath, entry);
        webFileHandles.set(entryPath.toLowerCase(), entry);
        const ext = entry.name.split('.').pop();
        nodes.push({
          name: entry.name,
          path: entryPath,
          type: 'file',
          extension: ext,
        });
      }
    }
  } catch (err) {
    console.error('Error traversing directory handle', err);
  }
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

export const fs = {
  isAvailable(): boolean {
    return Boolean(bridge()) || (typeof window !== 'undefined' && 'showDirectoryPicker' in window);
  },
  isElectron(): boolean {
    return Boolean(bridge());
  },
  hasPickFileDialog(): boolean {
    return Boolean(bridge()?.pickFileDialog);
  },
  hasAuthorizePickedFile(): boolean {
    return Boolean(bridge()?.authorizePickedFile);
  },
  async openFolderDialog(): Promise<string | null | undefined> {
    if (bridge()) {
      return bridge()?.openFolderDialog();
    }
    // Web fallback for modern browsers (Chrome, Edge):
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        webDirectoryHandle = handle;
        webFileHandles.clear();
        return handle.name;
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        console.warn('showDirectoryPicker failed', err);
        return null;
      }
    }
    alert('Opening local folders directly requires running Onyx Code as an Electron desktop app ("npm run dev"). Web browser security blocks direct filesystem dialogs.');
    return null;
  },
  async openFileDialog(): Promise<DialogFileResult | null | undefined> {
    if (bridge()) {
      return bridge()?.openFileDialog();
    }
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker();
        const file = await handle.getFile();
        const content = await file.text();
        return {
          path: file.name,
          name: file.name,
          content,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        return null;
      }
    }
    return null;
  },
  async pickFileDialog(): Promise<{ path: string; name: string } | null | undefined> {
    if (bridge()) {
      return bridge()?.pickFileDialog?.();
    }
    const res = await this.openFileDialog();
    if (!res) return null;
    return { path: res.path, name: res.name };
  },
  async authorizePickedFile(targetPath: string): Promise<boolean | undefined> {
    return bridge() ? bridge()?.authorizePickedFile?.(targetPath) : true;
  },
  async discardPickedFile(targetPath: string): Promise<boolean | undefined> {
    return bridge() ? bridge()?.discardPickedFile?.(targetPath) : true;
  },
  async saveFileDialog(payload: { defaultPath?: string; content: string }): Promise<SavedFileResult | null | undefined> {
    if (bridge()) {
      return bridge()?.saveFileDialog(payload);
    }
    // Web browser download fallback
    const blob = new Blob([payload.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload.defaultPath?.split(/[/\\]/).pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
    return { path: a.download, name: a.download };
  },
  async readDirectory(targetPath: string): Promise<FileNode[] | undefined> {
    if (bridge()) {
      return bridge()?.readDirectory(targetPath);
    }
    if (webDirectoryHandle) {
      return traverseDirectory(webDirectoryHandle, '');
    }
    return [];
  },
  async readFile(targetPath: string): Promise<string | undefined> {
    if (bridge()) {
      return bridge()?.readFile(targetPath);
    }
    const cleanPath = targetPath.replace(/^[/\\]+/, '');
    const handle = webFileHandles.get(cleanPath) || webFileHandles.get(cleanPath.toLowerCase());
    if (handle) {
      const file = await handle.getFile();
      return await file.text();
    }
    return undefined;
  },
  async writeFile(targetPath: string, content: string): Promise<boolean | undefined> {
    if (bridge()) {
      return bridge()?.writeFile(targetPath, content);
    }
    const cleanPath = targetPath.replace(/^[/\\]+/, '');
    let handle = webFileHandles.get(cleanPath) || webFileHandles.get(cleanPath.toLowerCase());
    if (!handle && webDirectoryHandle) {
      try {
        const parts = cleanPath.split('/');
        let currentDir = webDirectoryHandle;
        for (let i = 0; i < parts.length - 1; i++) {
          currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
        }
        handle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true });
        webFileHandles.set(cleanPath, handle);
      } catch (e) {
        console.error(e);
      }
    }
    if (handle && 'createWritable' in handle) {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    }
    return false;
  },
  async createFile(targetPath: string): Promise<boolean | undefined> {
    if (bridge()) {
      return bridge()?.createFile(targetPath);
    }
    return this.writeFile(targetPath, '');
  },
  async createFolder(targetPath: string): Promise<void> {
    if (bridge()) {
      await bridge()?.createFolder(targetPath);
      return;
    }
    if (webDirectoryHandle) {
      const cleanPath = targetPath.replace(/^[/\\]+/, '');
      const parts = cleanPath.split('/');
      let currentDir = webDirectoryHandle;
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
    }
  },
  async deleteFile(targetPath: string): Promise<void> {
    if (bridge()) {
      await bridge()?.deleteFile(targetPath);
      return;
    }
    if (webDirectoryHandle) {
      const cleanPath = targetPath.replace(/^[/\\]+/, '');
      const parts = cleanPath.split('/');
      const fileName = parts.pop()!;
      let currentDir = webDirectoryHandle;
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: false });
      }
      await currentDir.removeEntry(fileName);
      webFileHandles.delete(cleanPath);
    }
  },
  async deleteFolder(targetPath: string): Promise<void> {
    if (bridge()) {
      await bridge()?.deleteFolder(targetPath);
      return;
    }
    if (webDirectoryHandle) {
      const cleanPath = targetPath.replace(/^[/\\]+/, '');
      const parts = cleanPath.split('/');
      const folderName = parts.pop()!;
      let currentDir = webDirectoryHandle;
      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: false });
      }
      await currentDir.removeEntry(folderName, { recursive: true });
    }
  },
  async editFile(targetPath: string, oldText: string, newText: string): Promise<{ success: boolean } | undefined> {
    if (bridge()) {
      return bridge()?.editFile?.(targetPath, oldText, newText);
    }
    const current = await this.readFile(targetPath);
    if (typeof current !== 'string') return { success: false };
    if (!current.includes(oldText)) return { success: false };
    const updated = current.replace(oldText, newText);
    const ok = await this.writeFile(targetPath, updated);
    return { success: Boolean(ok) };
  },
  async searchFiles(query: string): Promise<{ path: string; name: string }[] | undefined> {
    if (bridge()) {
      return bridge()?.searchFiles?.(query);
    }
    const results: { path: string; name: string }[] = [];
    const lowerQuery = query.toLowerCase();
    for (const [path, handle] of webFileHandles.entries()) {
      try {
        const file = await handle.getFile();
        const text = await file.text();
        if (text.toLowerCase().includes(lowerQuery)) {
          results.push({ path, name: file.name });
        }
      } catch {
        // ignore
      }
    }
    return results;
  },
  async getRecentWorkspaces(): Promise<RecentWorkspace[] | undefined> {
    if (bridge()) {
      return bridge()?.getRecentWorkspaces?.();
    }
    try {
      const raw = localStorage.getItem('onyx_web_recents');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },
  async addRecentWorkspace(workspacePath: string): Promise<void> {
    if (bridge()) {
      await bridge()?.addRecentWorkspace?.(workspacePath);
      return;
    }
    try {
      const current = (await this.getRecentWorkspaces()) || [];
      const filtered = current.filter((r) => r.path !== workspacePath);
      filtered.unshift({ name: workspacePath.split(/[/\\]/).pop() || workspacePath, path: workspacePath, lastOpened: Date.now() });
      localStorage.setItem('onyx_web_recents', JSON.stringify(filtered.slice(0, 10)));
    } catch {
      // ignore
    }
  },
  async setWorkspaceRoot(workspacePath: string): Promise<string | undefined> {
    return bridge() ? bridge()?.setWorkspaceRoot?.(workspacePath) : workspacePath;
  },
};
