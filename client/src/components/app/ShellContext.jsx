import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../../api';

// Counts for the sidebar badges and the notification bell, refreshed every minute
// and whenever a page calls refresh() after an action.
const ShellContext = createContext({ badges: {}, refresh: () => {} });

export function ShellProvider({ children }) {
  const [badges, setBadges] = useState({});
  const timer = useRef(null);

  const refresh = useCallback(() => {
    api.get('/stats/badges').then((r) => setBadges(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    timer.current = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer.current);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return <ShellContext.Provider value={{ badges, refresh }}>{children}</ShellContext.Provider>;
}

export const useShell = () => useContext(ShellContext);
