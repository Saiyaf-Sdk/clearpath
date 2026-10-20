import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const api = axios.create({ baseURL: `${API_URL}/api` });

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  // "Keep me signed in" stores the token in localStorage, otherwise only for this browser session
  const token = localStorage.getItem('cp_token') || sessionStorage.getItem('cp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token expired, log out
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && (localStorage.getItem('cp_token') || sessionStorage.getItem('cp_token'))) {
      [localStorage, sessionStorage].forEach((s) => { s.removeItem('cp_token'); s.removeItem('cp_user'); });
      // Session expired: go back to the home page
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

// Turn any axios error into a readable message
export const errMsg = (err) => err.response?.data?.message || err.message || 'Something went wrong';

export const fileUrl = (path) => (path ? `${API_URL}${path}` : '#');

export default api;
