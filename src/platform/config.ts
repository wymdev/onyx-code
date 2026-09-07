function bridge() {
  return window.appConfig;
}

export const appConfig = {
  async setOllamaHost(url: string): Promise<boolean | undefined> {
    return bridge()?.setOllamaHost(url);
  },
  async getOllamaHost(): Promise<string | undefined> {
    return bridge()?.getOllamaHost();
  },
};
