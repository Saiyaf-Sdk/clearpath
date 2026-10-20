import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './context/DialogContext';
import './styles.css';

/*
  Every fresh visit opens on the HOME page.
  Whatever address the browser opens or auto-completes (e.g. /login or /register), the
  address is switched to "/" before anything is shown. From the home page people click
  "Log in" or "Start my clearance" to continue.
  Only two kinds of links keep their own page, because they are sent to people:
  password-reset links (/reset-password/...) and certificate QR codes (/verify/...).
*/
(() => {
  const path = window.location.pathname;
  const keep = path === '/' || path.startsWith('/reset-password/') || path.startsWith('/verify');
  if (!keep) window.history.replaceState(null, '', '/');
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* reducedMotion="user" turns animations off for people who ask their OS for less motion */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </MotionConfig>
  </React.StrictMode>
);
