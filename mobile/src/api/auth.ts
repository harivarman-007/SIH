/**
 * auth.ts
 * Login / logout helpers.
 * Phase 24: logout() calls POST /auth/logout best-effort (SHOULD #12).
 *   - Best-effort: network failure does NOT prevent local sign-out.
 *   - 401 on other requests does NOT clear the local SQLite outbox queue.
 */

import * as SecureStore from "expo-secure-store";
import { getApiClient, TOKEN_KEY, resetApiClient } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "inspector" | "contractor" | "mine_official" | "regulator" | "super_admin" | "corporate_management";
  mine_site_id: string | null;
  is_active: boolean;
  permissions?: string[];
  scope?: { mine_ids: string[] };
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const client = getApiClient();
  const response = await client.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  const token = response.data.access_token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return response.data;
}

/**
 * logout()
 * SHOULD #12: Calls POST /auth/logout best-effort to revoke server-side session.
 * Always clears local token regardless of network outcome.
 * Never touches the SQLite offline outbox queue — queued observations survive sign-out.
 */
export async function logout(): Promise<void> {
  // Best-effort server-side session revocation
  try {
    const client = getApiClient();
    await client.post("/auth/logout");
  } catch {
    // Network failure is acceptable — local sign-out still proceeds
  }
  // Clear local credentials
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  resetApiClient();
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getMe(): Promise<UserProfile> {
  const client = getApiClient();
  const response = await client.get<UserProfile>("/auth/me");
  return response.data;
}
