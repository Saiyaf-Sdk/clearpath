import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { AppFooter } from './Footer';
import ErrorBoundary from './ErrorBoundary';
import { Spin } from './ui';

// Public pages: home, login, register, verify, help – with the top navigation bar
export default function PublicLayout() {
  const { pathname } = useLocation();
  const wide = pathname === '/'; // the landing page manages its own width and footer
  return (
    <>
      <Navbar />
      <main>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<div className="page-loading"><Spin size={22} /></div>}>
            <div className="page-enter" key={pathname}>
              {wide ? (
                <Outlet />
              ) : (
                <>
                  <div className="container">
                    <Outlet />
                  </div>
                  <AppFooter />
                </>
              )}
            </div>
          </Suspense>
        </ErrorBoundary>
      </main>
    </>
  );
}
