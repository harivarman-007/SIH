/**
 * Auth Store — Zustand global state for JWT token + user info.
 * Real authentication against backend /auth/login.
 * Fails honestly if backend is offline or credentials fail.
 */
import { create } from 'zustand';
import { login, UserInfo, AuthRole } from '../api/auth';
import apiClient from '../api/client';

export interface DemoCredential {
  role: AuthRole;
  title: string;
  subtitle: string;
  email: string;
  password: string;
}

// Seeded demo credentials from generate_mock_data.py for evaluation
export const DEMO_CREDENTIALS: Record<string, DemoCredential> = {
  super_admin: {
    role: 'super_admin',
    title: 'Super Admin',
    subtitle: 'Platform-wide oversight & user provisioning',
    email: 'superadmin@intellifusion.gov.in',
    password: 'password123',
  },
  corporate_management: {
    role: 'corporate_management',
    title: 'Corporate Management',
    subtitle: 'Multi-mine compliance & fleet analytics',
    email: 'corporate@coalindia.in',
    password: 'password123',
  },
  mine_official: {
    role: 'mine_official',
    title: 'Mine Official',
    subtitle: 'Site operations & hazard closure authority',
    email: 'official1@mine.in',
    password: 'password123',
  },
  inspector: {
    role: 'inspector',
    title: 'Field Safety Inspector',
    subtitle: 'Underground hazard logging & mobile sync',
    email: 'inspector1@mine.in',
    password: 'password123',
  },
  contractor: {
    role: 'contractor',
    title: 'Contractor',
    subtitle: 'Assigned remediation & task tracking',
    email: 'contractor1@contractor.in',
    password: 'password123',
  },
  regulator: {
    role: 'regulator',
    title: 'Statutory Regulator (DGMS)',
    subtitle: 'Audit log verification & statutory review',
    email: 'regulator@dgms.gov.in',
    password: 'password123',
  },
};

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('intellifusion_token'),
  user: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    const existingToken = get().token;
    if (!existingToken) {
      set({ user: null, isLoading: false, error: null });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      const res = await apiClient.get<UserInfo>('/auth/me', {
        headers: { Authorization: `Bearer ${existingToken}` },
      });
      set({ user: res.data, isLoading: false, error: null });
    } catch {
      localStorage.removeItem('intellifusion_token');
      set({ token: null, user: null, isLoading: false, error: null });
    }
  },

  loginWithCredentials: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await login(email, password);
      localStorage.setItem('intellifusion_token', token);
      set({ token, user, isLoading: false, error: null });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = detail || (err instanceof Error ? err.message : 'Authentication failed');
      localStorage.removeItem('intellifusion_token');
      set({ token: null, user: null, isLoading: false, error: msg });
      throw new Error(msg);
    }
  },

  switchRole: async (role: string) => {
    const creds = DEMO_CREDENTIALS[role];
    if (!creds) {
      set({ error: `Unknown role: ${role}` });
      return;
    }
    await get().loginWithCredentials(creds.email, creds.password);
  },

  logout: () => {
    localStorage.removeItem('intellifusion_token');
    set({ token: null, user: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
