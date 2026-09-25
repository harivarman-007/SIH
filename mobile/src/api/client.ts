/**
 * client.ts
 * Axios HTTP client with dynamic Server URL switching and JWT token management.
 * - Auto-attaches JWT from memory and cross-platform appStorage.
 * - Handles 401 Unauthorized by clearing stale tokens to prevent perpetual sync loops.
 * - Allows dynamic backend URL changes from mobile ("Change Sync Server").
 */

import axios, { AxiosInstance } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { appStorage } from "../utils/storage";

export const TOKEN_KEY = "intellifusion_jwt";
export const SERVER_URL_KEY = "intellifusion_backend_url";

export const DEFAULT_BACKEND_URL =
  Platform.OS === "web"
    ? "http://localhost:8000"
    : ((Constants.expoConfig?.extra?.backendUrl as string | undefined) ?? "http://10.178.236.88:8000");

let _currentBackendUrl: string = DEFAULT_BACKEND_URL;
let _inMemoryToken: string | null = null;
let _client: AxiosInstance | null = null;

// Listeners for 401 auth failures
type UnauthorizedListener = () => void;
const _unauthorizedListeners: Set<UnauthorizedListener> = new Set();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  _unauthorizedListeners.add(listener);
  return () => _unauthorizedListeners.delete(listener);
}

export function setAuthToken(token: string | null): void {
  _inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return _inMemoryToken;
}

export async function initBackendUrl(): Promise<string> {
  try {
    const saved = await appStorage.getItem(SERVER_URL_KEY);
    if (saved && saved.trim()) {
      _currentBackendUrl = saved.trim();
    } else {
      _currentBackendUrl = DEFAULT_BACKEND_URL;
    }
  } catch {
    _currentBackendUrl = DEFAULT_BACKEND_URL;
  }
  return _currentBackendUrl;
}

export function getActiveBackendUrl(): string {
  return _currentBackendUrl;
}

export async function setActiveBackendUrl(newUrl: string): Promise<string> {
  let cleaned = newUrl.trim();
  // Strip trailing slashes
  while (cleaned.endsWith("/")) {
    cleaned = cleaned.slice(0, -1);
  }
  _currentBackendUrl = cleaned;
  await appStorage.setItem(SERVER_URL_KEY, cleaned);
  resetApiClient();
  return cleaned;
}

export function getApiClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: _currentBackendUrl,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // 1. Request Interceptor: Attach JWT token
    _client.interceptors.request.use(async (config) => {
      let token = _inMemoryToken;
      if (!token) {
        try {
          token = await appStorage.getItem(TOKEN_KEY);
          if (token) {
            _inMemoryToken = token;
          }
        } catch {
          // Fall through
        }
      }

      if (token) {
        config.headers = config.headers ?? {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    });

    // 2. Response Interceptor: Intercept 401 Unauthenticated
    _client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.warn("[API 401] Token expired or invalid for URL:", error.config?.url);
          _inMemoryToken = null;
          await appStorage.deleteItem(TOKEN_KEY).catch(() => {});
          for (const listener of _unauthorizedListeners) {
            try {
              listener();
            } catch {
              // Ignore
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }
  return _client;
}

export function resetApiClient(): void {
  _client = null;
}
