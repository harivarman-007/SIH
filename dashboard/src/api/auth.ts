/**
 * Auth API — login, logout
 * Backend /auth/login accepts JSON {email, password} and returns {access_token, token_type, user}.
 */
import apiClient from './client';

export type AuthRole = 'inspector' | 'mine_official' | 'regulator' | 'super_admin' | 'corporate_management' | 'contractor';

export interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: AuthRole;
  mine_site_id: string | null;
  is_active: boolean;
  permissions?: string[];
  scope?: Record<string, any>;
}

interface LoginApiResponse {
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export async function login(email: string, password: string): Promise<{ token: string; user: UserInfo }> {
  const res = await apiClient.post<LoginApiResponse>('/auth/login', { email, password });
  return { token: res.data.access_token, user: res.data.user };
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Best-effort logout
  }
}

export async function fetchCurrentUser(token: string): Promise<UserInfo> {
  const res = await apiClient.get<UserInfo>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function reportAccessDenied(path: string): Promise<void> {
  try {
    await apiClient.post('/auth/access-denied', { path: path.slice(0, 255) });
  } catch {
    // Best-effort report; ignore failures
  }
}

export async function fetchUsers(params?: { role?: AuthRole; mine_site_id?: string }): Promise<UserInfo[]> {
  const res = await apiClient.get<UserInfo[]>('/auth/users', { params });
  return res.data;
}

export interface AdminUserCreatePayload {
  email: string;
  password: string;
  full_name: string;
  role: AuthRole;
  mine_site_id?: string;
  corporate_mine_ids?: string[];
}

export async function adminCreateUser(payload: AdminUserCreatePayload): Promise<UserInfo> {
  const res = await apiClient.post<UserInfo>('/auth/admin/users', payload);
  return res.data;
}

export interface MineSiteOption {
  id: string;
  name: string;
  location_name: string;
}

export async function fetchMineSites(): Promise<MineSiteOption[]> {
  const res = await apiClient.get<MineSiteOption[]>('/auth/mine-sites');
  return res.data;
}


