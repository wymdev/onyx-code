function bridge() {
  return window.electronAPI;
}

export const appWindow = {
  isAvailable(): boolean {
    return Boolean(bridge());
  },
  isMac(): boolean {
    return bridge()?.platform === 'darwin';
  },
  onMenuCommand(callback: (command: string) => void): () => void {
    return bridge()?.onMenuCommand(callback) ?? (() => {});
  },
  minimize(): void {
    bridge()?.minimize();
  },
  maximize(): void {
    bridge()?.maximize();
  },
  close(): void {
    bridge()?.close();
  },
  async openExternalLink(url: string): Promise<boolean | undefined> {
    return bridge()?.openExternalLink(url);
  },
  async openLocalFile(filePath: string): Promise<boolean | undefined> {
    return bridge()?.openLocalFile(filePath);
  },
  async newWindow(): Promise<void> {
    await bridge()?.newWindow();
  },
};
