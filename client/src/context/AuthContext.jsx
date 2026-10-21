import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { clearSession, getToken } from '../api';
import { rememberPortal } from '../utils/portal';

const AuthContext = createContext(null);

const readUser = () => {
  try {
    if (!getToken()) return null;
    return JSON.parse(localStorage.getItem('cp_user') || sessionStorage.getItem('cp_user'));
  } catch {
    return null;
  }
};

// Which storage holds the current session ("Keep me signed in" → localStorage)
const currentStore = () => {
  try {
    return localStorage.getItem('cp_token') ? localStorage : sessionStorage;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  // remember = true → stay signed in after closing the browser; false → this session only
  const save = useCallback(({ token, user: u }, remember = true) => {
    clearSession();
    try {
      const store = remember ? localStorage : sessionStorage;
      store.setItem('cp_token', token);
      store.setItem('cp_user', JSON.stringify(u));
    } catch {
      /* storage blocked – the session lasts until the page is closed */
    }
    if (u?.university?.slug) rememberPortal(u.university.slug);
    setUser(u);
    return u;
  }, []);

  // Update the stored profile (e.g. after editing the phone number)
  const updateUser = useCallback((u) => {
    try {
      currentStore()?.setItem('cp_user', JSON.stringify(u));
    } catch {
      /* ignore */
    }
    setUser(u);
  }, []);

  // university = the portal (e.g. "ruhuna"); empty for the platform admin
  const login = async (email, password, remember = true, university) =>
    save((await api.post('/auth/login', { email, password, university: university || undefined })).data, remember);
  // Last step of the verified student registration (see pages/Register.jsx)
  const completeRegistration = async (payload) => save((await api.post('/auth/register/complete', payload)).data);
  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  // On start: refresh the cached profile from the server (department, university logo, …).
  // A 401 here means the session is no longer valid – the api interceptor ends it.
  useEffect(() => {
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((r) => updateUser(r.data.user))
      .catch(() => {});
  }, [updateUser]);

  // The session expired while using the app
  useEffect(() => {
    const onExpired = () => {
      setUser((u) => {
        if (u) toast.error('Your session has ended. Please log in again.', { id: 'session' });
        return null;
      });
    };
    // Logged out in another tab
    const onStorage = (e) => {
      if (e.key === 'cp_token' && !e.newValue && !getToken()) setUser(null);
    };
    window.addEventListener('cp:session-expired', onExpired);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('cp:session-expired', onExpired);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return <AuthContext.Provider value={{ user, login, completeRegistration, logout, updateUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ student: '/student', officer: '/officer', admin: '/admin', superadmin: '/platform' }[role] || '/');

// Only send people back to pages that belong to their role after logging in
export const canVisit = (role, path = '') => {
  if (!path || !path.startsWith('/')) return false;
  const area = path.split('/')[1];
  const own = homeFor(role).slice(1);
  if (['notifications', 'account'].includes(area)) return true;
  return area === own;
};
