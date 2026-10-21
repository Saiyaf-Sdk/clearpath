import { lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import AnimatedBackground from './components/AnimatedBackground';
import Splash, { markSplashSeen, shouldShowSplash } from './components/Splash';
import RequireAuth, { RoleGate } from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';
import AppShell from './components/app/AppShell';
import Landing from './pages/Landing';
import { LoginRedirect, RegisterRedirect } from './pages/portal/Redirects';

// Pages load on demand, so the first visit only downloads what it needs
const ChooseUniversity = lazy(() => import('./pages/portal/ChooseUniversity'));
const PortalAuth = lazy(() => import('./pages/portal/PortalAuth'));
const PlatformLogin = lazy(() => import('./pages/portal/PlatformLogin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Verify = lazy(() => import('./pages/Verify'));
const Help = lazy(() => import('./pages/Help'));
const NotFound = lazy(() => import('./pages/NotFound'));

const StudentOverview = lazy(() => import('./pages/student/Overview'));
const StudentClearance = lazy(() => import('./pages/student/Clearance'));
const StudentDues = lazy(() => import('./pages/student/Dues'));
const StudentCertificate = lazy(() => import('./pages/student/Certificate'));

const OfficerOverview = lazy(() => import('./pages/officer/Overview'));
const OfficerRequests = lazy(() => import('./pages/officer/Requests'));
const OfficerReceipts = lazy(() => import('./pages/officer/Receipts'));
const OfficerDues = lazy(() => import('./pages/officer/Dues'));
const OfficerActivity = lazy(() => import('./pages/officer/Activity'));

const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminRequests = lazy(() => import('./pages/admin/Requests'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminStudents = lazy(() => import('./pages/admin/Students'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminDepartments = lazy(() => import('./pages/admin/Departments'));
const AdminAudit = lazy(() => import('./pages/admin/Audit'));

const PlatformOverview = lazy(() => import('./pages/platform/Overview'));
const PlatformUniversities = lazy(() => import('./pages/platform/Universities'));
const PlatformAudit = lazy(() => import('./pages/platform/Audit'));

const Account = lazy(() => import('./pages/account/Account'));
const Notifications = lazy(() => import('./pages/account/Notifications'));

const isPublic = (path) => !/^\/(student|officer|admin|platform|account|notifications|profile)(\/|$)/.test(path);

export default function App() {
  const location = useLocation();
  // The short intro animation plays once per browser session, and only on the home page
  const [booting, setBooting] = useState(() => location.pathname === '/' && shouldShowSplash());
  const publicPage = isPublic(location.pathname);

  // The static boot screen in index.html has done its job once React has painted
  useEffect(() => {
    document.getElementById('boot')?.remove();
  }, []);

  useEffect(() => {
    if (publicPage) document.title = 'ClearPath – University Digital Clearance System';
  }, [publicPage, location.pathname]);

  const finishBoot = () => {
    markSplashSeen();
    setBooting(false);
  };

  return (
    <>
      {/* The live background is only used on public pages; the app itself stays calm and fast */}
      {publicPage && <AnimatedBackground path={location.pathname} paused={booting} />}

      <AnimatePresence>{booting && <Splash key="splash" onDone={finishBoot} />}</AnimatePresence>

      {!booting && (
        <Routes>
          {/* Public pages */}
          <Route element={<PublicLayout />}>
            <Route index element={<Landing />} />
            <Route path="portal" element={<ChooseUniversity />} />
            <Route path="portal/:slug" element={<PortalAuth mode="login" />} />
            <Route path="portal/:slug/register" element={<PortalAuth mode="register" />} />
            <Route path="platform-login" element={<PlatformLogin />} />
            <Route path="login" element={<LoginRedirect />} />
            <Route path="register" element={<RegisterRedirect />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password/:token" element={<ResetPassword />} />
            <Route path="verify" element={<Verify />} />
            <Route path="verify/:certificateNo" element={<Verify />} />
            <Route path="help" element={<Help />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Signed-in area: sidebar + top bar */}
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="student" element={<RoleGate role="student" />}>
              <Route index element={<StudentOverview />} />
              <Route path="clearance" element={<StudentClearance />} />
              <Route path="dues" element={<StudentDues />} />
              <Route path="certificate" element={<StudentCertificate />} />
            </Route>
            <Route path="officer" element={<RoleGate role="officer" />}>
              <Route index element={<OfficerOverview />} />
              <Route path="requests" element={<OfficerRequests />} />
              <Route path="receipts" element={<OfficerReceipts />} />
              <Route path="dues" element={<OfficerDues />} />
              <Route path="activity" element={<OfficerActivity />} />
            </Route>
            <Route path="admin" element={<RoleGate role="admin" />}>
              <Route index element={<AdminOverview />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="departments" element={<AdminDepartments />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>
            <Route path="platform" element={<RoleGate role="superadmin" />}>
              <Route index element={<PlatformOverview />} />
              <Route path="universities" element={<PlatformUniversities />} />
              <Route path="audit" element={<PlatformAudit />} />
            </Route>
            <Route path="account" element={<Account />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Navigate to="/account" replace />} />
            <Route path="student/*" element={<Navigate to="/student" replace />} />
            <Route path="officer/*" element={<Navigate to="/officer" replace />} />
            <Route path="admin/*" element={<Navigate to="/admin" replace />} />
            <Route path="platform/*" element={<Navigate to="/platform" replace />} />
          </Route>
        </Routes>
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
