function bridge() {
  return window.profile;
}

export const profile = {
  async local(): Promise<
    { username: string; displayName: string; email: string | null; homeDirectory: string } | undefined
  > {
    return bridge()?.local();
  },
};
