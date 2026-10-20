import { Link } from 'react-router-dom';

const year = new Date().getFullYear();

// Small footer used on app pages (dashboards, login, help…)
export function AppFooter() {
  return (
    <footer className="footer">
      <span>© {year} ClearPath</span>
      <Link to="/">Home</Link>
      <Link to="/help">Help centre</Link>
      <Link to="/verify">Verify a certificate</Link>
    </footer>
  );
}

// Full footer used at the bottom of the landing page
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="brand"><span className="brand-mark">✓</span> ClearPath</div>
          <p>The university clearance and no-dues system that replaces the paper form with one online request and a QR-verified certificate.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#roles">Who it's for</a>
          <a href="#security">Security</a>
        </div>
        <div className="footer-col">
          <h4>Get started</h4>
          <Link to="/register">Create student account</Link>
          <Link to="/login">Log in</Link>
          <Link to="/verify">Verify a certificate</Link>
          <Link to="/help">Help centre</Link>
        </div>
        <div className="footer-col">
          <h4>Project</h4>
          <a href="#faq">FAQ</a>
          <span className="muted small" style={{ display: 'block', padding: '5px 0' }}>EE4207 Web Application Development</span>
          <span className="muted small" style={{ display: 'block', padding: '5px 0' }}>Built with MongoDB, Express, React, Node.js</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {year} ClearPath. All rights reserved.</span>
        <span>Made for a paperless campus.</span>
      </div>
    </footer>
  );
}
