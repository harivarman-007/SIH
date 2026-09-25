/**
 * authStore.ts
 * Zustand store for authentication state.
 * Handles JWT + user profile persistence with 401 unauthenticated listener.
 */

import { create } from "zustand";
import { login as apiLogin, logout as apiLogout, getMe, getStoredToken, UserProfile } from "../api/auth";
import { onUnauthorized, setAuthToken, initBackendUrl } from "../api/client";
import { appStorage } from "../utils/storage";
import { TOKEN_KEY } from "../api/client";

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

export const useAuthStore = create<AuthState>((set) => {
  // Listen for global 401 events from Axios
  onUnauthorized(() => {
    set({ token: null, user: null, isAuthenticated: false, error: "Session expired. Please sign in again." });
  });

  return {
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const resp = await apiLogin(email, password);
        setAuthToken(resp.access_token);
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
      setAuthToken(null);
      set({ token: null, user: null, isAuthenticated: false, error: null });
    },

    restoreSession: async () => {
      try {
        await initBackendUrl();
        const token = await getStoredToken();
        if (token) {
          setAuthToken(token);
          const user = await getMe();
          set({ token, user, isAuthenticated: true });
        }
      } catch (err) {
        // Token expired or invalid — clear stale credentials so we don't loop on 401
        console.warn("Session restore failed, clearing stale token:", err);
        setAuthToken(null);
        await appStorage.deleteItem(TOKEN_KEY).catch(() => {});
        set({ token: null, user: null, isAuthenticated: false });
      }
    },

    clearError: () => set({ error: null }),
  };
});
