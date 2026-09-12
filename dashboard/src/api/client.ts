/**
 * Intellifusion API Client
 * Axios instance with JWT interceptor – auto-attaches Bearer token from localStorage.
 */
import axios from 'axios';

export const API_BASE = 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage before every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('intellifusion_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Surface backend error messages cleanly
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg =
      error?.response?.data?.detail ??
      error?.message ??
      'Unknown API error';
    return Promise.reject(new Error(String(msg)));
  }
);

export default apiClient;
