/**
 * auth.ts
 * Login / logout helpers.
 */

import * as SecureStore from "expo-secure-store";
import { getApiClient, TOKEN_KEY, resetApiClient } from "./client";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "inspector" | "contractor" | "mine_official" | "regulator";
  mine_site_id: string | null;
  is_active: boolean;
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

export async function logout(): Promise<void> {
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
