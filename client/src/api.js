import axios from 'axios';

// In production the API usually serves the web app itself, so "same origin" ('') is the default.
// For a separate API host (e.g. Vercel + Render) set VITE_API_URL to the API address.
const fallback = import.meta.env.DEV ? 'http://localhost:5000' : '';
export const API_URL = (import.meta.env.VITE_API_URL ?? fallback).replace(/\/$/, '');

const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 30000 });

export const getToken = () => {
  try {
    return localStorage.getItem('cp_token') || sessionStorage.getItem('cp_token');
  } catch {
    return null;
  }
};

export const clearSession = () => {
  try {
    [localStorage, sessionStorage].forEach((s) => {
      s.removeItem('cp_token');
      s.removeItem('cp_user');
    });
  } catch {
    /* storage blocked */
  }
};

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or invalid session: clear it and let the app send the user to the login page
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const isLogin = err.config?.url?.startsWith('/auth/login');
    if (status === 401 && !isLogin && getToken()) {
      clearSession();
      window.dispatchEvent(new CustomEvent('cp:session-expired'));
    }
    return Promise.reject(err);
  }
);

// Turn any axios error into a readable message
export const errMsg = (err) => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.';
  if (err?.message === 'Network Error') return 'Cannot reach the server. Check your connection and that the API is running.';
  return err?.message || 'Something went wrong';
};

// Uploaded files (receipts, logos) are served by the API
export const fileUrl = (path) => (!path ? '#' : /^https?:/.test(path) ? path : `${API_URL}${path}`);

export default api;
