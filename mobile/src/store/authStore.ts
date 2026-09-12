/**
 * authStore.ts
 * Zustand store for authentication state.
 * Handles JWT + user profile persistence.
 */

import { create } from "zustand";
import { login as apiLogin, logout as apiLogout, getMe, getStoredToken, UserProfile } from "../api/auth";

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await apiLogin(email, password);
      // Backend returns user inline in TokenResponse — no second request needed
      set({
        token: resp.access_token,
        user: resp.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed. Check your credentials.";
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    await apiLogout();
    set({ token: null, user: null, isAuthenticated: false, error: null });
  },

  restoreSession: async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const user = await getMe();
        set({ token, user, isAuthenticated: true });
      }
    } catch {
      // Token expired or invalid — stay logged out
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  clearError: () => set({ error: null }),
}));
