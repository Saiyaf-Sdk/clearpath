import { createContext, useContext, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem('cp_user'));
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);

  const save = ({ token, user: u }) => {
    localStorage.setItem('cp_token', token);
    localStorage.setItem('cp_user', JSON.stringify(u));
    setUser(u);
    return u;
  };

  const login = async (email, password) => save((await api.post('/auth/login', { email, password })).data);
  const register = async (form) => save((await api.post('/auth/register', form)).data);
  const logout = () => {
    localStorage.removeItem('cp_token');
    localStorage.removeItem('cp_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export const homeFor = (role) => ({ student: '/student', officer: '/officer', admin: '/admin' }[role] || '/');
