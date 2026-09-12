/**
 * client.ts
 * Axios HTTP client that auto-attaches JWT from SecureStore.
 */

import axios, { AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const BACKEND_URL =
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ??
  "http://localhost:8000";

export const TOKEN_KEY = "intellifusion_jwt";

let _client: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: BACKEND_URL,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Attach JWT before every request
    _client.interceptors.request.use(async (config) => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          config.headers = config.headers ?? {};
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // SecureStore unavailable — proceed without token
      }
      return config;
    });
  }
  return _client;
}

export function resetApiClient(): void {
  _client = null;
}
