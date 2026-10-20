import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider } from './context/DialogContext';
import './styles.css';
import './app.css';

// Opening the site address shows the home page ("/"). Any other address – for example after
// pressing refresh on /officer/requests – opens that same page again, as users expect.
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
