/**
 * Auth Store — Zustand global state for JWT token + user info.
 * Role switching triggers a silent re-login with seeded demo credentials.
 */
import { create } from 'zustand';
import { login, UserInfo } from '../api/auth';
import apiClient from '../api/client';

// Seeded demo credentials from generate_mock_data.py
const DEMO_CREDENTIALS: Record<string, { email: string; password: string }> = {
  super_admin: { email: 'superadmin@intellifusion.gov.in', password: 'password123' },
  corporate_management: { email: 'corporate@coalindia.in', password: 'password123' },
  mine_official: { email: 'official1@mine.in', password: 'password123' },
  inspector: { email: 'inspector1@mine.in', password: 'password123' },
  contractor: { email: 'contractor1@contractor.in', password: 'password123' },
  regulator: { email: 'regulator@dgms.gov.in', password: 'password123' },
};

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('intellifusion_token'),
  user: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    const existingToken = get().token;
    if (existingToken) {
      // Try to validate the existing token
      try {
        set({ isLoading: true });
        const res = await apiClient.get<UserInfo>('/auth/me', {
          headers: { Authorization: `Bearer ${existingToken}` },
        });
        set({ user: res.data, isLoading: false, error: null });
        return;
      } catch {
        // Token expired or invalid — fall through to default login
        localStorage.removeItem('intellifusion_token');
        set({ token: null });
      }
    }
    // Default: auto-login as mine_official for demo
    await get().switchRole('mine_official');
  },

  switchRole: async (role) => {
    const creds = DEMO_CREDENTIALS[role];
    if (!creds) return;

    set({ isLoading: true, error: null });
    try {
      const { token, user } = await login(creds.email, creds.password);
      localStorage.setItem('intellifusion_token', token);
      set({ token, user, isLoading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      set({ isLoading: false, error: msg });
      console.error('[AuthStore] Role switch failed:', msg);
    }
  },

  logout: () => {
    localStorage.removeItem('intellifusion_token');
    set({ token: null, user: null });
  },
}));
