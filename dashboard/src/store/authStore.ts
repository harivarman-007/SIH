/**
 * Auth Store — Zustand global state for JWT token + user info.
 * Role switching triggers a silent re-login with seeded demo credentials,
 * with seamless simulated fallback if backend API is unreachable.
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

// Fallback demo user profiles when backend is offline or starting up
const DEMO_USERS: Record<string, UserInfo> = {
  super_admin: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'superadmin@intellifusion.gov.in',
    full_name: 'Dr. Alok Verma (Super Admin)',
    role: 'super_admin',
    mine_site_id: null,
    is_active: true,
  },
  corporate_management: {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'corporate@coalindia.in',
    full_name: 'Suman Roy (Dir. Technical, CIL)',
    role: 'corporate_management',
    mine_site_id: null,
    is_active: true,
  },
  mine_official: {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'official1@mine.in',
    full_name: 'Rajesh Kumar (Mine Manager)',
    role: 'mine_official',
    mine_site_id: '11111111-1111-1111-1111-111111111111',
    is_active: true,
  },
  inspector: {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'inspector1@mine.in',
    full_name: 'Anil Soren (Field Inspector)',
    role: 'inspector',
    mine_site_id: '11111111-1111-1111-1111-111111111111',
    is_active: true,
  },
  contractor: {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'contractor1@contractor.in',
    full_name: 'Kailash Infra & Mining Ltd',
    role: 'contractor',
    mine_site_id: null,
    is_active: true,
  },
  regulator: {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'regulator@dgms.gov.in',
    full_name: 'DGMS Dy. Director (Eastern Zone)',
    role: 'regulator',
    mine_site_id: null,
    is_active: true,
  },
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
    if (existingToken && existingToken !== 'demo-offline-token') {
      try {
        set({ isLoading: true });
        const res = await apiClient.get<UserInfo>('/auth/me', {
          headers: { Authorization: `Bearer ${existingToken}` },
        });
        set({ user: res.data, isLoading: false, error: null });
        return;
      } catch {
        localStorage.removeItem('intellifusion_token');
        set({ token: null });
      }
    }
    // Auto-initialize demo role
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
    } catch {
      // Graceful offline fallback: activate verified demo user context
      const fallback = DEMO_USERS[role] || {
        id: '00000000-0000-0000-0000-000000000000',
        email: creds.email,
        full_name: `${role.replace('_', ' ').toUpperCase()} (Demo)`,
        role: role as any,
        mine_site_id: null,
        is_active: true,
      };
      set({
        token: 'demo-offline-token',
        user: fallback,
        isLoading: false,
        error: null,
      });
    }
  },

  logout: () => {
    localStorage.removeItem('intellifusion_token');
    set({ token: null, user: null });
  },
}));
