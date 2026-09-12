/**
 * Auth API — login, logout
 * Backend /auth/login accepts JSON {email, password} and returns {access_token, token_type, user}.
 */
import apiClient from './client';

export interface UserInfo {
  id: string;
  email: string;
  full_name: string;
  role: 'inspector' | 'mine_official' | 'regulator' | 'contractor';
  mine_site_id: string | null;
  is_active: boolean;
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

export async function fetchCurrentUser(token: string): Promise<UserInfo> {
  const res = await apiClient.get<UserInfo>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
