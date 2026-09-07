import { auth as authBridge } from '../platform/auth';
import { AuthResponse, SessionResponse } from '../types';

export const authService = {
  register(data: { username: string; email: string; password: string }): Promise<AuthResponse> {
    if (!authBridge.isAvailable()) {
      return Promise.resolve({ success: false, error: 'Auth bridge is unavailable' });
    }

    return authBridge.register(data) as Promise<AuthResponse>;
  },

  login(data: { email: string; password: string }): Promise<AuthResponse> {
    if (!authBridge.isAvailable()) {
      return Promise.resolve({ success: false, error: 'Auth bridge is unavailable' });
    }

    return authBridge.login(data) as Promise<AuthResponse>;
  },

  logout(): Promise<{ success: boolean }> {
    if (!authBridge.isAvailable()) {
      return Promise.resolve({ success: false });
    }

    return authBridge.logout().then(() => ({ success: true }));
  },

  checkSession(): Promise<SessionResponse> {
    if (!authBridge.isAvailable()) {
      return Promise.resolve({ success: false });
    }

    return authBridge.checkSession() as Promise<SessionResponse>;
  },
};
