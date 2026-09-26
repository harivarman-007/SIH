/**
 * Auth Store — Zustand state management for authentication, permissions, and sessions.
 * MUST #1: Error-code driven branching (SESSION_EXPIRED, UNAUTHENTICATED, ACCOUNT_DISABLED)
 * MUST #4: Persona switcher performs POST /auth/logout, full store reset, and re-login
 * MUST #5: Loads permissions[] and scope from /auth/me
 */
import { create } from 'zustand';
import { login, logout as logoutApi, UserInfo, AuthRole, updateUserLanguage } from '../api/auth';
import apiClient, { registerAuthErrorHandler } from '../api/client';
import { DEMO_CREDENTIALS } from '../config/demoCredentials';
import backendPermissionsJson from '../config/backend_permissions.json';
import i18n from '../i18n';

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
};

const setStorageItem = (key: string, val: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, val);
    }
  } catch {}
};

const removeStorageItem = (key: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  } catch {}
};

export interface AuthState {
  token: string | null;
  user: UserInfo | null;
  permissions: string[];
  scope: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  sessionExpired: boolean;
  accountDisabled: boolean;

  // Actions
  initialize: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<UserInfo>;
  switchRole: (role: AuthRole) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearSessionExpired: () => void;
  setAccountDisabled: (val: boolean) => void;
  setSessionExpired: (val: boolean) => void;
  updateUserLanguagePreference: (language: string | null) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStorageItem('intellifusion_token'),
  user: null,
  permissions: [],
  scope: {},
  isLoading: false,
  error: null,
  sessionExpired: false,
  accountDisabled: false,

  initialize: async () => {
    const existingToken = get().token;
    if (!existingToken) {
      set({ user: null, permissions: [], scope: {}, isLoading: false, error: null });
      return;
    }

    if (existingToken.startsWith('demo_token_')) {
      const role = existingToken.replace('demo_token_', '') as AuthRole;
      const matchedDemo = DEMO_CREDENTIALS[role];
      if (matchedDemo) {
        const mockUser: UserInfo = {
          id: `demo-${matchedDemo.role}`,
          email: matchedDemo.email,
          full_name: matchedDemo.title,
          role: matchedDemo.role,
          mine_site_id: 'MS-DEMO-001',
          is_active: true,
          permissions: (backendPermissionsJson.permissions as string[]) || [],
          scope: { mine_site_id: 'MS-DEMO-001' },
          preferred_language: 'en',
          resolved_language: 'en',
        };
        set({
          token: existingToken,
          user: mockUser,
          permissions: mockUser.permissions || [],
          scope: mockUser.scope || {},
          isLoading: false,
          error: null,
          sessionExpired: false,
          accountDisabled: false,
        });
        return;
      }
    }

    try {
      set({ isLoading: true, error: null });
      const res = await apiClient.get<UserInfo>('/auth/me', {
        headers: { Authorization: `Bearer ${existingToken}` },
      });
      const userData = res.data;
      if (userData.resolved_language) {
        i18n.changeLanguage(userData.resolved_language);
      }
      set({
        user: userData,
        permissions: userData.permissions || [],
        scope: userData.scope || {},
        accountDisabled: false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const code = err?.response?.data?.code || err?.response?.data?.detail?.code;
      if (code === 'ACCOUNT_DISABLED') {
        set({ accountDisabled: true, isLoading: false });
      } else {
        removeStorageItem('intellifusion_token');
        set({
          token: null,
          user: null,
          permissions: [],
          scope: {},
          isLoading: false,
          sessionExpired: code === 'SESSION_EXPIRED',
        });
      }
    }
  },

  loginWithCredentials: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await login(email, password);
      setStorageItem('intellifusion_token', token);

      // Ensure /auth/me permissions are loaded
      let permissions = user.permissions || [];
      let scope = user.scope || {};

      try {
        const meRes = await apiClient.get<UserInfo>('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        permissions = meRes.data.permissions || permissions;
        scope = meRes.data.scope || scope;
      } catch {
        // Fallback to user object from login
      }

      const finalUser = {
        ...user,
        permissions,
        scope,
      };

      if (finalUser.resolved_language) {
        i18n.changeLanguage(finalUser.resolved_language);
      }

      set({
        token,
        user: finalUser,
        permissions,
        scope,
        isLoading: false,
        error: null,
        sessionExpired: false,
        accountDisabled: false,
      });

      return user;
    } catch (err: any) {
      // Offline fallback: If backend server is unreachable, allow demo accounts
      if (!err?.response) {
        const matchedDemo = Object.values(DEMO_CREDENTIALS).find(
          (c) => c.email.toLowerCase() === email.toLowerCase()
        );
        if (matchedDemo) {
          const mockUser: UserInfo = {
            id: `demo-${matchedDemo.role}`,
            email: matchedDemo.email,
            full_name: matchedDemo.title,
            role: matchedDemo.role,
            mine_site_id: 'MS-DEMO-001',
            is_active: true,
            permissions: (backendPermissionsJson.permissions as string[]) || [],
            scope: { mine_site_id: 'MS-DEMO-001' },
            preferred_language: 'en',
            resolved_language: 'en',
          };
          const mockToken = `demo_token_${matchedDemo.role}`;
          setStorageItem('intellifusion_token', mockToken);
          set({
            token: mockToken,
            user: mockUser,
            permissions: mockUser.permissions || [],
            scope: mockUser.scope || {},
            isLoading: false,
            error: null,
            sessionExpired: false,
            accountDisabled: false,
          });
          return mockUser;
        }
      }

      const code = err?.response?.data?.code || err?.response?.data?.detail?.code;
      const detail = err?.response?.data?.detail;
      const msg = detail || (err instanceof Error ? err.message : 'Authentication failed');

      if (code === 'ACCOUNT_DISABLED') {
        set({ accountDisabled: true, isLoading: false, error: msg });
      } else {
        removeStorageItem('intellifusion_token');
        set({
          token: null,
          user: null,
          permissions: [],
          scope: {},
          isLoading: false,
          error: msg,
        });
      }
      throw new Error(msg);
    }
  },

  switchRole: async (role: AuthRole) => {
    const creds = DEMO_CREDENTIALS[role];
    if (!creds) {
      set({ error: `Unknown role: ${role}` });
      return;
    }

    // MUST #4: 1. Server logout -> 2. Reset stores -> 3. Login as new persona
    try {
      await logoutApi();
    } catch {
      // Best-effort
    }

    // Clean reset of all state/caches
    removeStorageItem('intellifusion_token');
    set({
      token: null,
      user: null,
      permissions: [],
      scope: {},
      error: null,
      sessionExpired: false,
      accountDisabled: false,
    });

    await get().loginWithCredentials(creds.email, creds.password);
  },

  logout: async () => {
    try {
      await logoutApi();
    } catch {
      // Best-effort
    }
    removeStorageItem('intellifusion_token');
    set({
      token: null,
      user: null,
      permissions: [],
      scope: {},
      error: null,
      sessionExpired: false,
      accountDisabled: false,
    });
  },

  clearError: () => set({ error: null }),
  clearSessionExpired: () => set({ sessionExpired: false }),
  setAccountDisabled: (val: boolean) => set({ accountDisabled: val }),
  setSessionExpired: (val: boolean) => set({ sessionExpired: val }),
  updateUserLanguagePreference: async (language: string | null) => {
    if (language) {
      await i18n.changeLanguage(language);
      try {
        localStorage.setItem('i18nextLng', language);
      } catch {}
    }
    set((state) => ({
      user: state.user
        ? {
            ...state.user,
            preferred_language: language,
            resolved_language: language || state.user.resolved_language,
          }
        : null,
    }));

    try {
      const updated = await updateUserLanguage(language);
      set((state) => ({
        user: state.user ? { ...state.user, ...updated } : updated,
      }));
    } catch {
      // Best-effort backend sync; offline / demo mode continues to work smoothly
    }
  },
}));

// Register client interceptor handler
registerAuthErrorHandler((code) => {
  if (code === 'ACCOUNT_DISABLED') {
    useAuthStore.getState().setAccountDisabled(true);
  } else if (code === 'SESSION_EXPIRED') {
    removeStorageItem('intellifusion_token');
    useAuthStore.getState().setSessionExpired(true);
    useAuthStore.setState({ token: null, user: null, permissions: [], scope: {} });
  } else {
    removeStorageItem('intellifusion_token');
    useAuthStore.setState({ token: null, user: null, permissions: [], scope: {} });
  }
});
