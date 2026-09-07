function bridge() {
  return window.git;
}

export const git = {
  isAvailable(): boolean {
    return Boolean(bridge());
  },
  async status(): Promise<string | undefined> {
    return bridge()?.status();
  },
  async add(file: string): Promise<void> {
    await bridge()?.add(file);
  },
  async commit(message: string): Promise<void> {
    await bridge()?.commit(message);
  },
  async branch(): Promise<string | null | undefined> {
    return bridge()?.branch?.();
  },
  async diff(file: string): Promise<{ original: string; modified: string } | undefined> {
    return bridge()?.diff?.(file);
  },
};
