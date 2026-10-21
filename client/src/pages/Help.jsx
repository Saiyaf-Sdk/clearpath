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
              <p className="muted">ClearPath serves all state universities. Each university has its own portal: choose your university first, then log in or create your account there with your university email.</p>
              <ol className="guide-steps">
                <li><div><strong>Choose your university first</strong>Press <Link to="/portal">Log in</Link> and pick your university. Each university has its own portal with its own log-in and create-account pages.</div></li>
                <li><div><strong>Students</strong>On your university's portal open <em>Create account</em>. Enter your registration number, university email and a password, then type the 6-digit code we email you. Only students on the university's official list can register.</div></li>
                <li><div><strong>Department officers</strong>Your account is created by the administrator and linked to your department (e.g. Library).</div></li>
                <li><div><strong>Administrators</strong>Manage departments, staff accounts and the overall process from the admin console.</div></li>
              </ol>
              <div className="callout"><Info size={18} /><span>Forgot your password? Use <Link to="/forgot-password">Forgot password</Link> on the login page to get a reset link by email. For the demo, seeded accounts use the password <code>password123</code>.</span></div>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="students">
              <h2><GraduationCap size={20} className="text-brand" /> For students</h2>
              <p className="muted">Getting cleared from start to finish.</p>
              <ol className="guide-steps">
                <li><div><strong>Submit a request</strong>Open <em>Clearance request</em> in the menu, pick the reason (graduation, transfer, withdrawal or other) and press <em>Submit request</em>. It goes to every department at once.</div></li>
                <li><div><strong>Watch the tracker</strong>Your <em>Overview</em> shows what to do next. The tracker shows each department as Pending, Cleared or Dues found, with the officer's remark. The bell in the top bar tells you when anything changes.</div></li>
                <li><div><strong>Settle any dues</strong>Under <em>Dues &amp; payments</em> you'll see the reason and amount. Pay at the counter or by bank deposit, then drag your receipt (JPG, PNG or PDF up to 3 MB) onto the upload box.</div></li>
                <li><div><strong>Wait for verification</strong>The officer checks the receipt. If it's rejected you'll see why and can upload a new one.</div></li>
                <li><div><strong>Download your certificate</strong>When every department has cleared you, open <em>Certificate</em> and press <em>Download PDF</em>. Share the verification link or QR code with anyone who needs proof.</div></li>
              </ol>
              <div className="callout warn"><TriangleAlert size={18} /><span>You can cancel a request only until the first department clears you.</span></div>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="officers">
              <h2><ClipboardCheck size={20} className="text-brand" /> For department officers</h2>
              <p className="muted">Reviewing students for your department.</p>
              <ol className="guide-steps">
                <li><div><strong>Start at the Overview</strong>See what is waiting, the oldest requests and your department's recent activity. The menu badges show how many requests and receipts need you.</div></li><li><div><strong>Find the student</strong><em>Clearance requests</em> lists every request for your department. Filter (Pending, Dues found, Cleared), search by name or registration number, or sort by who has waited longest.</div></li>
                <li><div><strong>Open the side panel</strong>Click a student to see their details, the dues recorded in your department and any uploaded receipt.</div></li>
                <li><div><strong>Add a due if needed</strong>Enter the amount and reason. The student's request is flagged automatically and they get an email.</div></li>
                <li><div><strong>Verify receipts</strong>Under <em>Receipts to verify</em>, approve a valid receipt or reject an unclear one with a reason. In the <em>Dues register</em> you can mark a counter payment as paid, waive a due or export the list.</div></li>
                <li><div><strong>Clear the student</strong>Press <em>Clear</em> on the row or <em>Clear student</em> in the side panel – or tick several students and use <em>Clear selected</em>. ClearPath blocks this while any due in your department is still unpaid. When the last due is paid, the student returns to your Pending list for the final check.</div></li>
              </ol>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="admins">
              <h2><LayoutDashboard size={20} className="text-brand" /> For administrators</h2>
              <p className="muted">Running the clearance process.</p>
              <ol className="guide-steps">
                <li><div><strong>Overview &amp; reports</strong>See students, active requests, certificates issued, average days to clear and dues outstanding, with charts of activity and where students are waiting. <em>Reports</em> breaks this down by faculty, reason and department and exports to CSV.</div></li>
                <li><div><strong>Departments</strong>Add departments and set their display order. Deactivate a department to stop adding it to new requests.</div></li>
                <li><div><strong>Official student list</strong>Import the registrar's student list (CSV: regNo, name, email, faculty). Only students on this list can create an account.</div></li>
                <li><div><strong>Users</strong>Create officer accounts (linked to a department), other admins or students. Disable an account instead of deleting it to keep history.</div></li>
                <li><div><strong>All requests</strong>Filter by status or by the department a student is waiting at. Click a row for the full history, or a department chip to override a decision when an office is unavailable.</div></li>
                <li><div><strong>Audit log</strong>Every action is recorded – who did what, and when. Filter by type, search by registration number and export.</div></li>
              </ol>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="verify-help">
              <h2><ShieldCheck size={20} className="text-brand" /> Verifying a certificate</h2>
              <p className="muted">For employers, other universities and anyone checking a certificate.</p>
              <ol className="guide-steps">
                <li><div><strong>Scan the QR code</strong>It opens the verification page for that certificate automatically.</div></li>
                <li><div><strong>Or type the number</strong>Go to <Link to="/verify">Verify certificate</Link> and enter the number printed on it (e.g. CP-UOR-2026-8F3A21C9).</div></li>
                <li><div><strong>Check the details</strong>A valid certificate shows the student's name, registration number, faculty, purpose and issue date.</div></li>
              </ol>
            </section>
          </Reveal>

          <Reveal className="card help-section" amount={0.1}>
            <section id="trouble">
              <h2><Wrench size={20} className="text-brand" /> Troubleshooting</h2>
              <div className="trouble">
                <div><strong>“Invalid email or password”</strong><p>Check for typos and that Caps Lock is off. Staff should confirm with the admin that their account is active.</p></div>
                <div><strong>“You already have an active request”</strong><p>Only one request can be open at a time. Track the existing one under <em>Clearance request</em>.</p></div>
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
                <Link to="/portal" className="btn btn-primary">Choose your university</Link>
                <Link to="/" className="btn btn-ghost">Back to home</Link>
              </div>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
