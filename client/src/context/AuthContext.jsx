import { createContext, useContext, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem('cp_user') || sessionStorage.getItem('cp_user'));
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  // remember = true → stay signed in after closing the browser; false → this session only
  const save = ({ token, user: u }, remember = true) => {
    const store = remember ? localStorage : sessionStorage;
    [localStorage, sessionStorage].forEach((s) => { s.removeItem('cp_token'); s.removeItem('cp_user'); });
    store.setItem('cp_token', token);
    store.setItem('cp_user', JSON.stringify(u));
    setUser(u);
    return u;
  };

  const login = async (email, password, remember = true) => save((await api.post('/auth/login', { email, password })).data, remember);
  const register = async (form) => save((await api.post('/auth/register', form)).data);
  const logout = () => {
    [localStorage, sessionStorage].forEach((s) => { s.removeItem('cp_token'); s.removeItem('cp_user'); });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ student: '/student', officer: '/officer', admin: '/admin' }[role] || '/');
