import { AuthResponse, SessionResponse } from '../types';

function bridge() {
  return window.auth;
}

export const auth = {
  isAvailable(): boolean {
    return Boolean(bridge());
  },
  async register(data: { username: string; email: string; password: string }): Promise<AuthResponse | undefined> {
    return bridge()?.register(data);
  },
  async login(data: { email: string; password: string }): Promise<AuthResponse | undefined> {
    return bridge()?.login(data);
  },
  async logout(): Promise<void> {
    await bridge()?.logout();
  },
  async checkSession(): Promise<SessionResponse | undefined> {
    return bridge()?.checkSession();
  },
};
