/**
 * Intellifusion API Client
 * Axios instance with JWT interceptor and unified error handling.
 * MUST #1: Error code branching (ACCOUNT_DISABLED, SESSION_EXPIRED, UNAUTHENTICATED)
 * SHOULD #9: Triggers Section 25 Access Restricted toast on 403.
 */
import axios from 'axios';

export const API_BASE = 'http://localhost:8000';

type AuthErrorHandler = (code: string, message: string) => void;
type ForbiddenHandler = (message: string) => void;

let authErrorHandler: AuthErrorHandler | null = null;
let forbiddenHandler: ForbiddenHandler | null = null;

export function registerAuthErrorHandler(handler: AuthErrorHandler): void {
  authErrorHandler = handler;
}

export function registerForbiddenHandler(handler: ForbiddenHandler): void {
  forbiddenHandler = handler;
}

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage before every request
apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('intellifusion_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Surface backend error messages and dispatch auth events
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;

    // Extract standardized error structure {code, message, detail}
    let code: string = 'UNKNOWN';
    let message: string = error?.message || 'Unknown network error';

    if (data && typeof data === 'object') {
      code = data.code || (data.detail && typeof data.detail === 'object' ? data.detail.code : 'UNKNOWN');
      message =
        data.message ||
        (data.detail && typeof data.detail === 'object'
          ? data.detail.message || data.detail.detail
          : data.detail) ||
        message;
    }

    // 401 Unauthenticated / Expired / Disabled
    if (status === 401) {
      if (authErrorHandler) {
        authErrorHandler(code, message);
      }
    }

    // 403 Forbidden / Access Restricted (SHOULD #9)
    if (status === 403) {
      if (forbiddenHandler) {
        forbiddenHandler(message || 'Access Restricted: You do not have permission to access this resource.');
      }
    }

    return Promise.reject(new Error(String(message)));
  }
);

export default apiClient;
