import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, GraduationCap, Info, LayoutDashboard, LifeBuoy, Mail, Rocket, ShieldCheck, TriangleAlert,
  Wrench,
} from 'lucide-react';
import { Reveal } from '../components/Page';

const NAV = [
  { id: 'start', label: 'Getting started', icon: Rocket },
  { id: 'students', label: 'For students', icon: GraduationCap },
  { id: 'officers', label: 'For officers', icon: ClipboardCheck },
  { id: 'admins', label: 'For admins', icon: LayoutDashboard },
  { id: 'verify-help', label: 'Verifying certificates', icon: ShieldCheck },
  { id: 'trouble', label: 'Troubleshooting', icon: Wrench },
  { id: 'contact', label: 'Contact', icon: Mail },
];

export default function Help() {
  const [active, setActive] = useState('start');

  // Highlight the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-30% 0px -60% 0px' }
    );
    const t = setTimeout(() => NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) observer.observe(el);
    }), 300);
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, []);

  const go = (id) => (e) => {
    e.preventDefault();
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div>
      <Reveal className="help-hero">
        <span className="eyebrow"><LifeBuoy size={13} /> Help centre</span>
        <h1>How can we help?</h1>
        <p>Step-by-step guides for students, department officers and administrators.</p>
      </Reveal>

      <div className="help-layout">
        <nav className="help-nav" aria-label="Help sections">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={go(n.id)} className={active === n.id ? 'active' : ''}>
              {active === n.id && <motion.span layoutId="help-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <n.icon size={16} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>

        <div>
          <Reveal className="card help-section" amount={0.1}>
            <section id="start">
              <h2><Rocket size={20} className="text-brand" /> Getting started</h2>
              <p className="muted">ClearPath has three types of accounts. Everyone logs in on the same page.</p>
              <ol className="guide-steps">
                <li><div><strong>Students</strong>Create your own account from <Link to="/register">Register</Link> using your university email and registration number.</div></li>
                <li><div><strong>Department officers</strong>Your account is created by the administrator and linked to your department (e.g. Library).</div></li>
                <li><div><strong>Administrators</strong>Manage departments, staff accounts and the overall process from the admin console.</div></li>
              </ol>
              <div className="callout"><Info size={18} /><span>For the demo, every seeded account uses the password <code>password123</code>. Use the quick-fill buttons on the login page.</span></div>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="students">
              <h2><GraduationCap size={20} className="text-brand" /> For students</h2>
              <p className="muted">Getting cleared from start to finish.</p>
              <ol className="guide-steps">
                <li><div><strong>Submit a request</strong>On your dashboard, pick the reason (graduation, transfer, withdrawal or other) and press <em>Submit request</em>. It goes to every department at once.</div></li>
                <li><div><strong>Watch the tracker</strong>The progress ring and timeline show each department as Pending, Cleared or Dues found, with the officer's remark.</div></li>
                <li><div><strong>Settle any dues</strong>Under <em>My dues</em> you'll see the reason and amount. Pay at the counter or by bank transfer, then drag your receipt (JPG, PNG or PDF up to 3 MB) onto the upload box.</div></li>
                <li><div><strong>Wait for verification</strong>The officer checks the receipt. If it's rejected you'll see why and can upload a new one.</div></li>
                <li><div><strong>Download your certificate</strong>When every department has cleared you, press <em>Download PDF</em>. Share the certificate number or QR code with anyone who needs proof.</div></li>
              </ol>
              <div className="callout warn"><TriangleAlert size={18} /><span>You can cancel a request only until the first department clears you.</span></div>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="officers">
              <h2><ClipboardCheck size={20} className="text-brand" /> For department officers</h2>
              <p className="muted">Reviewing students for your department.</p>
              <ol className="guide-steps">
                <li><div><strong>Find the student</strong>Your desk lists every request that needs your department. Use the filter chips (Pending, Dues found, Cleared) or search by name or registration number.</div></li>
                <li><div><strong>Open the side panel</strong>Click a student to see their details, the dues recorded in your department and any uploaded receipt.</div></li>
                <li><div><strong>Add a due if needed</strong>Enter the amount and reason. The student's request is flagged automatically and they get an email.</div></li>
                <li><div><strong>Verify receipts</strong>Under <em>Dues &amp; receipts</em>, approve a valid receipt, reject an unclear one with a reason, mark a counter payment as paid, or waive a due.</div></li>
                <li><div><strong>Clear the student</strong>Press <em>Clear student</em>. ClearPath blocks this while any due in your department is still unpaid.</div></li>
              </ol>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="admins">
              <h2><LayoutDashboard size={20} className="text-brand" /> For administrators</h2>
              <p className="muted">Running the clearance process.</p>
              <ol className="guide-steps">
                <li><div><strong>Overview</strong>See students, active requests, certificates issued, average days to clear and dues outstanding, plus a chart of where students are waiting.</div></li>
                <li><div><strong>Departments</strong>Add departments and set their display order. Deactivate a department to stop adding it to new requests.</div></li>
                <li><div><strong>Users</strong>Create officer accounts (linked to a department), other admins or students. Disable an account instead of deleting it to keep history.</div></li>
                <li><div><strong>Requests</strong>Filter all requests by status. Click a department chip to override a decision when an office is unavailable.</div></li>
                <li><div><strong>Audit log</strong>Review the last 100 actions — who did what, and when.</div></li>
              </ol>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="verify-help">
              <h2><ShieldCheck size={20} className="text-brand" /> Verifying a certificate</h2>
              <p className="muted">For employers, other universities and anyone checking a certificate.</p>
              <ol className="guide-steps">
                <li><div><strong>Scan the QR code</strong>It opens the verification page for that certificate automatically.</div></li>
                <li><div><strong>Or type the number</strong>Go to <Link to="/verify">Verify certificate</Link> and enter the number printed on it (e.g. CP-2026-8F3A21C9).</div></li>
                <li><div><strong>Check the details</strong>A valid certificate shows the student's name, registration number, faculty, purpose and issue date.</div></li>
              </ol>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="trouble">
              <h2><Wrench size={20} className="text-brand" /> Troubleshooting</h2>
              <div className="trouble">
                <div><strong>“Invalid email or password”</strong><p>Check for typos and that Caps Lock is off. Staff should confirm with the admin that their account is active.</p></div>
                <div><strong>“You already have an active request”</strong><p>Only one request can be open at a time. Track the existing one on your dashboard.</p></div>
                <div><strong>Officer can't press Clear</strong><p>The student still has an unpaid due in that department. Verify the receipt or mark it paid first.</p></div>
                <div><strong>Receipt upload fails</strong><p>Use a JPG, PNG or PDF smaller than 3 MB. Take a clearer photo if the officer rejected it.</p></div>
                <div><strong>“Session expired”</strong><p>For security, logins expire after 7 days. Simply log in again.</p></div>
                <div><strong>Certificate not found</strong><p>Make sure the number is typed exactly, including the CP- prefix and dashes.</p></div>
              </div>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="contact">
              <h2><Mail size={20} className="text-brand" /> Still need help?</h2>
              <p className="muted">Contact the Student Affairs office or your faculty registrar. Include your registration number and a short description of the problem.</p>
              <div className="row-gap" style={{ marginTop: 16 }}>
                <Link to="/login" className="btn btn-primary">Log in to ClearPath</Link>
                <Link to="/" className="btn btn-ghost">Back to home</Link>
              </div>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
