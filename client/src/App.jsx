import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import AnimatedBackground from './components/AnimatedBackground';
import Splash, { markSplashSeen, shouldShowSplash } from './components/Splash';
import ProtectedRoute from './components/ProtectedRoute';
import Page from './components/Page';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Verify from './pages/Verify';
import Help from './pages/Help';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import StudentDashboard from './pages/student/StudentDashboard';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

export default function App() {
  const location = useLocation();
  const [booting, setBooting] = useState(shouldShowSplash);

  // The static boot screen in index.html has done its job once React has painted
  useEffect(() => {
    document.getElementById('boot')?.remove();
  }, []);

  const finishBoot = () => {
    markSplashSeen();
    setBooting(false);
  };

  // Group /verify/:no under one key so checking another number doesn't replay the page transition
  const key = location.pathname.startsWith('/verify') ? '/verify' : location.pathname;

  // After the old page has faded out, start the new page at the top (unless we're jumping to a #section)
  const onExitComplete = () => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <>
      <AnimatedBackground path={location.pathname} paused={booting} />

      {/* First-visit loading screen; the page mounts underneath as the curtain lifts */}
      <AnimatePresence>{booting && <Splash key="splash" onDone={finishBoot} />}</AnimatePresence>

      {!booting && (
        <>
          <Navbar />
          <main>
            <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
              <Routes location={location} key={key}>
                <Route path="/" element={<Page wide><Landing /></Page>} />
                <Route path="/login" element={<Page><Login /></Page>} />
                <Route path="/register" element={<Page><Register /></Page>} />
                <Route path="/forgot-password" element={<Page><ForgotPassword /></Page>} />
                <Route path="/reset-password/:token" element={<Page><ResetPassword /></Page>} />
                <Route path="/verify" element={<Page><Verify /></Page>} />
                <Route path="/verify/:certificateNo" element={<Page><Verify /></Page>} />
                <Route path="/help" element={<Page><Help /></Page>} />
                <Route path="/profile" element={<ProtectedRoute><Page><Profile /></Page></ProtectedRoute>} />
                <Route path="/student" element={<ProtectedRoute role="student"><Page><StudentDashboard /></Page></ProtectedRoute>} />
                <Route path="/officer" element={<ProtectedRoute role="officer"><Page><OfficerDashboard /></Page></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute role="admin"><Page><AdminDashboard /></Page></ProtectedRoute>} />
                <Route path="*" element={<Page><NotFound /></Page>} />
              </Routes>
            </AnimatePresence>
          </main>
        </>
      )}
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          className: 'cp-toast',
          duration: 3500,
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error: { iconTheme: { primary: '#e11d48', secondary: '#fff' } },
        }}
      />
    </>
  );
}
