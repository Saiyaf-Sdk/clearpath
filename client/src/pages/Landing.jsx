import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll, useSpring, useTransform } from 'framer-motion';
import {
  Activity, ArrowRight, BadgeCheck, TrendingUp, Bell, Building2, Check, CircleCheck, ClipboardCheck, Clock,
  FileUp, Fingerprint, GraduationCap, KeyRound, LayoutDashboard, Lock, Plus, QrCode, Receipt, ScrollText,
  Search, Send, ShieldCheck, Smartphone, UserPlus, Users, X,
} from 'lucide-react';
import { homeFor, useAuth } from '../context/AuthContext';
import { EASE, item, Reveal, stagger } from '../components/Page';
import ProductMock from '../components/ProductMock';
import { Magnetic } from '../components/Cursor';
import { SiteFooter } from '../components/Footer';
import { Badge, CountUp, deptIcon, ProgressRing, Tabs } from '../components/ui';

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */
const DEPARTMENTS = [
  ['LIB', 'Library'], ['HOS', 'Hostel'], ['FIN', 'Finance Division'],
  ['LAB', 'Faculty Laboratories'], ['SPO', 'Sports Division'], ['SAF', 'Student Affairs'],
];

const OLD_WAY = [
  'Print a form and walk to 6+ offices, one after another',
  'Queue at every counter, only during office hours',
  'Find out about a fine only when you reach the counter',
  'Lose the form and start all over again',
  'No idea which office is holding you up',
];
const NEW_WAY = [
  'Submit one request from your phone or laptop',
  'Every department reviews it at the same time',
  'See each due, its reason and amount upfront',
  'Everything is saved — there is nothing to lose',
  'A live tracker shows exactly who has cleared you',
];

const STEPS = [
  { icon: UserPlus, title: 'Create your account', text: 'Register with your university email and registration number. Department officers and admins receive their accounts from the registrar.' },
  { icon: Send, title: 'Submit one request', text: 'Choose why you need clearance — graduation, transfer or withdrawal. ClearPath instantly sends it to every active department.' },
  { icon: Receipt, title: 'Departments review, you settle dues', text: 'Each office clears you or flags a due with the amount and reason. Pay it, upload the receipt, and the officer verifies it online.' },
  { icon: QrCode, title: 'Download your certificate', text: 'The moment the last department clears you, a PDF certificate with a unique number and QR code is issued automatically.' },
];

const ROLES = {
  student: {
    label: 'Students', icon: GraduationCap,
    title: 'Get cleared without leaving your room',
    points: ['Submit one clearance request', 'Track every department live', 'See dues with the reason and amount', 'Upload payment receipts by drag and drop', 'Download and share your certificate'],
  },
  officer: {
    label: 'Department officers', icon: ClipboardCheck,
    title: 'Clear students in a single click',
    points: ['See every request waiting on your department', 'Clear or flag dues with a remark', 'Add dues using the registration number', 'Preview receipts, then approve or reject', 'Search and filter students instantly'],
  },
  admin: {
    label: 'Administrators', icon: LayoutDashboard,
    title: 'See the whole process at a glance',
    points: ['Manage departments and staff accounts', 'Monitor requests and override when needed', 'Spot bottleneck departments on a chart', 'Track dues outstanding vs collected', 'Review a complete audit log'],
  },
};

const SECURITY = [
  { icon: KeyRound, title: 'Signed JWT sessions', text: 'Every request to the API carries a signed, expiring token.' },
  { icon: Fingerprint, title: 'Hashed passwords', text: 'Passwords are stored with bcrypt — never as plain text.' },
  { icon: Users, title: 'Role-based access', text: 'Students, officers and admins can only reach their own data and actions.' },
  { icon: ScrollText, title: 'Full audit trail', text: 'Every approval, flag, due and account change is logged with who and when.' },
  { icon: QrCode, title: 'Tamper-proof certificates', text: 'Each certificate has a unique number that is checked against the database.' },
  { icon: FileUp, title: 'Safe uploads', text: 'Receipts are limited to JPG, PNG or PDF files up to 3 MB.' },
];

const FAQS = [
  ['Who can use ClearPath?', 'ClearPath runs for one university. Only students on that university’s official student list can create an account, using their own university email and a one-time verification code. Department officers and administrators are added by the university administrator.'],
  ['Can a student from another university sign up?', 'No. Registration checks the registration number against the university’s official list, only accepts the university’s email domain, and sends a code to that email to prove it belongs to the student.'],
  ['Do I still need to visit any offices?', 'Only if you choose to pay a due in person. Requesting clearance, tracking it, uploading receipts and downloading your certificate all happen online.'],
  ['What happens if a department finds a due?', 'Your tracker shows “Dues found” with the reason and amount. Pay it, upload the receipt, and the officer verifies it and clears you — only that department needs to act again.'],
  ['How long does clearance take?', 'It depends on how quickly each office reviews, but all departments work in parallel, so you are never waiting for one office to pass a paper form to the next.'],
  ['How can an employer check my certificate is real?', 'Every certificate has a unique number and a QR code. Scanning it opens the public verification page, which confirms the student, purpose and issue date.'],
  ['Can I cancel a request?', 'Yes — as long as no department has cleared you yet. After that the request stays active so the work already done is not lost.'],
  ['Is my data safe?', 'Passwords are hashed with bcrypt, sessions use signed JWT tokens, uploads are validated, and each role can only access the information it needs.'],
];

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function SectionHead({ eyebrow, title, sub }) {
  return (
    <Reveal className="section-head">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </Reveal>
  );
}

// A fake but stable QR pattern for illustrations
function MiniQR() {
  const cells = [];
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
      const ring = finder && !((r % 6 === 1) && (c % 6 === 1));
      const on = finder ? ring : (r * 7 + c * 13 + r * c) % 3 === 0;
      cells.push(<i key={`${r}-${c}`} className={on ? 'on' : ''} />);
    }
  }
  return <div className="qr" aria-hidden="true">{cells}</div>;
}

function StepVisual({ i }) {
  if (i === 0) {
    return (
      <div className="mini-form">
        <div className="mini-field"><small>University email</small>kasun@student.lk</div>
        <div className="mini-field"><small>Registration no.</small>EG/2021/4501</div>
        <div className="mini-btn">Create account</div>
      </div>
    );
  }
  if (i === 1) {
    return (
      <>
        <div className="mini-chips">
          <span className="mini-chip on"><GraduationCap size={14} /> Graduation</span>
          <span className="mini-chip">Transfer</span>
          <span className="mini-chip">Withdrawal</span>
          <span className="mini-chip">Other</span>
        </div>
        <div className="mini-sent"><CircleCheck size={15} /> Sent to 6 departments</div>
      </>
    );
  }
  if (i === 2) {
    const Icon = deptIcon('LIB');
    return (
      <>
        <div className="mini-due">
          <span className="stat-icon" style={{ width: 34, height: 34 }}><Icon size={16} /></span>
          <div style={{ flex: 1 }}>
            <strong>Overdue book · LKR 450.00</strong>
            <small>Library</small>
          </div>
          <Badge status="receipt-submitted" />
        </div>
        <div className="mini-actions">
          <span style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text-2)' }}>Reject</span>
          <span style={{ background: 'var(--good-solid)', color: '#fff' }}>Approve</span>
        </div>
      </>
    );
  }
  return (
    <div className="mini-cert">
      <div style={{ flex: 1 }}>
        <small>Clearance certificate</small>
        <strong>Kasun Perera</strong>
        <span className="muted small">EG/2021/4501 · Engineering</span>
        <div style={{ marginTop: 6 }}><code>CP-2026-8F3A21C9</code></div>
      </div>
      <MiniQR />
    </div>
  );
}

function BandStat({ value, label, suffix = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <div className="band-stat" ref={ref}>
      <strong>{typeof value === 'number' ? <CountUp value={inView ? value : 0} /> : value}{suffix}</strong>
      <span>{label}</span>
    </div>
  );
}

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <Plus size={20} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ overflow: 'hidden' }}>
            <p className="faq-a">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleVisual({ role }) {
  if (role === 'student') {
    return (
      <div className="mock-body" style={{ gridTemplateColumns: '130px 1fr' }}>
        <div className="mock-side"><ProgressRing value={67} size={120} stroke={10} /></div>
        <div className="mock-rows">
          {DEPARTMENTS.slice(0, 4).map(([code, name], i) => {
            const Icon = deptIcon(code);
            const status = i < 2 ? 'cleared' : i === 2 ? 'dues' : 'pending';
            return (
              <div key={code} className={`mock-row ${status === 'cleared' ? 'cleared' : ''}`}>
                <span className="ic">{status === 'cleared' ? <CircleCheck size={16} /> : <Icon size={16} />}</span>
                <span>{name}</span>
                <Badge status={status} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  if (role === 'officer') {
    const rows = [['KP', 'Kasun Perera', 'EG/2021/4501', 'dues'], ['NF', 'Nimali Fernando', 'EG/2021/4502', 'pending'], ['AS', 'Amal Silva', 'EG/2021/4519', 'pending']];
    return (
      <div className="mock-body">
        <div className="mock-rows">
          {rows.map(([ini, name, reg, status]) => (
            <div key={reg} className="officer-row">
              <span className="avatar">{ini}</span>
              <div className="grow"><strong>{name}</strong><small>{reg}</small></div>
              <Badge status={status} />
              {status === 'pending' && <span className="mini-clear">Clear</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const bars = [['LIB', 70, true], ['HOS', 35], ['FIN', 55], ['LAB', 25], ['SPO', 15], ['SAF', 40]];
  return (
    <div className="mock-body">
      <div>
        <div className="row-gap" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <strong>Where students are waiting</strong>
          <span className="badge badge-role">Live</span>
        </div>
        <div className="mini-bars" style={{ height: 150 }}>
          {bars.map(([code, h, hot]) => (
            <div key={code} className={hot ? 'hot' : ''}>
              <motion.span initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }} />
              {code}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */
function Hero() {
  const { user } = useAuth();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const mockY = useTransform(scrollYProgress, [0, 1], [0, 70]);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="hero-l" id="top" ref={ref}>
      <div className="hero-grid">
        <motion.div style={{ y: textY, opacity: textOpacity }}>
          <motion.div variants={stagger} initial="hidden" animate="show">
            <motion.div variants={item}>
              <span className="hero-pill"><span className="tag">New</span> Paperless clearance for universities</span>
            </motion.div>
            <motion.h1 variants={item} className="hero-title">
              Graduate without the{' '}
              <span className="hl">paper chase.</span>
            </motion.h1>
            <motion.p variants={item} className="hero-sub">
              ClearPath turns the university no-dues form into one online request. Every department reviews it in parallel,
              you settle dues online, and you download a QR-verified certificate the moment you are cleared.
            </motion.p>
            <motion.div variants={item} className="hero-cta">
              {user ? (
                <Magnetic><Link to={homeFor(user.role)} className="btn btn-primary btn-lg">Go to my dashboard <ArrowRight size={18} className="arrow" /></Link></Magnetic>
              ) : (
                <Magnetic><Link to="/register" className="btn btn-primary btn-lg">Start my clearance <ArrowRight size={18} className="arrow" /></Link></Magnetic>
              )}
              <Magnetic><button className="btn btn-ghost btn-lg" onClick={() => scrollTo('how')}>See how it works</button></Magnetic>
            </motion.div>
            <motion.div variants={item} className="hero-trust">
              <span><CircleCheck size={16} /> No office queues</span>
              <span><CircleCheck size={16} /> Live status from 6 departments</span>
              <span><CircleCheck size={16} /> Certificate in one click</span>
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: mockY }}>
          <motion.div initial={{ opacity: 0, y: 40, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }}>
            <ProductMock />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function DepartmentsMarquee() {
  const items = [...DEPARTMENTS, ...DEPARTMENTS];
  return (
    <div className="logos">
      <p className="marquee-label">Every office that signs your clearance — in one place</p>
      <div className="marquee">
        <div className="marquee-track">
          {items.map(([code, name], i) => {
            const Icon = deptIcon(code);
            return <span key={`${code}-${i}`} className="marquee-item"><Icon size={20} /> {name}</span>;
          })}
        </div>
      </div>
    </div>
  );
}

function WhySection() {
  return (
    <section className="section" id="why">
      <div className="section-inner">
        <SectionHead
          eyebrow="Why ClearPath"
          title="The clearance form hasn't changed in decades. Until now."
          sub="Final-year students lose days walking between offices for signatures. ClearPath moves the whole process online."
        />
        <div className="compare">
          <Reveal className="compare-card old">
            <h3><Clock size={20} className="muted" /> The paper way</h3>
            <ul className="compare-list">
              {OLD_WAY.map((t) => <li key={t}><span className="ic"><X size={14} /></span>{t}</li>)}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="compare-arrow-wrap" style={{ alignSelf: 'center', justifySelf: 'center' }}>
            <div className="compare-arrow"><ArrowRight size={22} /></div>
          </Reveal>
          <Reveal delay={0.2} className="compare-card new">
            <h3><BadgeCheck size={20} className="text-brand" /> The ClearPath way</h3>
            <ul className="compare-list">
              {NEW_WAY.map((t) => <li key={t}><span className="ic"><Check size={14} /></span>{t}</li>)}
            </ul>
          </Reveal>
        </div>
        <Reveal className="compare-summary" delay={0.1}>
          <span className="summary-chip"><s>6 office visits</s> <ArrowRight size={14} className="muted" /> <strong>1 online request</strong></span>
          <span className="summary-chip"><s>Paper form</s> <ArrowRight size={14} className="muted" /> <strong>QR-verified PDF</strong></span>
        </Reveal>
      </div>
    </section>
  );
}

function HowItWorks() {
  const ref = useRef(null);
  const stepRefs = useRef([]);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 65%', 'end 65%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  return (
    <section className="section tint" id="how">
      <div className="section-inner hiw" ref={ref}>
        <div className="hiw-sticky">
          <Reveal>
            <span className="eyebrow">How it works</span>
            <h2 className="display-h2">From request to certificate in four steps</h2>
            <p>No paper, no queues and no guessing. Scroll through what a student and the departments do.</p>
          </Reveal>
          <div className="hiw-progress">
            <div className="hiw-track"><motion.div className="hiw-fill" style={{ scaleY: fill }} /></div>
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                className={`hiw-dot-row ${i === active ? 'active' : ''} ${i < active ? 'done' : ''}`}
                onClick={() => stepRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              >
                <span className="hiw-dot">{i < active ? <Check size={14} /> : i + 1}</span>
                {s.title}
              </button>
            ))}
          </div>
        </div>

        <div className="hiw-steps">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              ref={(el) => { stepRefs.current[i] = el; }}
              className={`hiw-step ${i === active ? 'active' : ''}`}
              initial={{ opacity: 0, y: 48 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <div className="hiw-step-head">
                <span className="feat-icon" style={{ margin: 0 }}><s.icon size={20} /></span>
                <span className="num">Step {i + 1}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div className="step-visual-wrap" style={{ marginTop: 'auto', paddingTop: 22 }}>
                <div className="step-visual"><StepVisual i={i} /></div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="section" id="features">
      <div className="section-inner">
        <SectionHead
          eyebrow="Features"
          title="Everything clearance needs, nothing it doesn't"
          sub="Built around the real steps students and departments take — and designed so nobody needs training."
        />
        <motion.div className="bento" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
          <motion.div className="bento-card bento-lg" variants={item} whileHover={{ y: -4 }}>
            <span className="feat-icon"><Activity size={20} /></span>
            <h3>Live clearance tracker</h3>
            <p>A progress ring and a per-department timeline update the moment an officer acts, so students always know exactly where they stand.</p>
            <div className="bento-visual">
              <div className="mock" style={{ boxShadow: 'var(--shadow)' }}>
                <div className="mock-body" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="row-gap" style={{ justifyContent: 'space-between' }}>
                    <strong>Graduation clearance</strong>
                    <span className="muted small">4 of 6 cleared</span>
                  </div>
                  <div className="progress"><motion.div className="progress-bar" initial={{ width: 0 }} whileInView={{ width: '67%' }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }} /></div>
                  <div className="mock-rows">
                    {[['LIB', 'cleared'], ['FIN', 'dues'], ['SAF', 'pending']].map(([code, status]) => {
                      const Icon = deptIcon(code);
                      const name = DEPARTMENTS.find((d) => d[0] === code)[1];
                      return (
                        <div key={code} className={`mock-row ${status === 'cleared' ? 'cleared' : ''}`}>
                          <span className="ic">{status === 'cleared' ? <CircleCheck size={16} /> : <Icon size={16} />}</span>
                          <span>{name}</span>
                          <Badge status={status} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div className="bento-card" variants={item} whileHover={{ y: -4 }}>
            <span className="feat-icon"><Receipt size={20} /></span>
            <h3>Dues &amp; receipts online</h3>
            <p>Students see every due with its reason, upload a receipt by drag and drop, and officers approve it in one click.</p>
          </motion.div>

          <motion.div className="bento-card" variants={item} whileHover={{ y: -4 }}>
            <span className="feat-icon"><Bell size={20} /></span>
            <h3>Instant notifications</h3>
            <p>An email goes out whenever a department clears you, flags a due or verifies your payment.</p>
          </motion.div>

          <motion.div className="bento-card" variants={item} whileHover={{ y: -4 }}>
            <span className="feat-icon"><QrCode size={20} /></span>
            <h3>QR-verified certificates</h3>
            <p>A PDF certificate with a unique number and QR code that anyone can verify on the public page.</p>
          </motion.div>

          <motion.div className="bento-card" variants={item} whileHover={{ y: -4 }}>
            <span className="feat-icon"><Smartphone size={20} /></span>
            <h3>Works on any device</h3>
            <p>Fully responsive with light and dark modes, so you can check your status from your phone.</p>
          </motion.div>

          <motion.div className="bento-card" variants={item} whileHover={{ y: -4 }}>
            <span className="feat-icon"><TrendingUp size={20} /></span>
            <h3>Analytics &amp; audit log</h3>
            <p>Admins see which departments are slowest, dues collected, and a log of every action.</p>
            <div className="bento-visual">
              <div className="mini-bars" style={{ height: 70 }}>
                {[40, 75, 55, 90, 35, 60].map((h, i) => (
                  <div key={i} className={i === 3 ? 'hot' : ''}>
                    <motion.span initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Roles() {
  const [role, setRole] = useState('student');
  const r = ROLES[role];
  return (
    <section className="section tint" id="roles">
      <div className="section-inner">
        <SectionHead eyebrow="Who it's for" title="One system, three focused dashboards" sub="Each person sees only what they need — nothing more." />
        <div className="roles">
          <Reveal>
            <Tabs
              id="roles"
              value={role}
              onChange={setRole}
              tabs={Object.entries(ROLES).map(([value, v]) => ({ value, label: v.label, icon: v.icon }))}
            />
            <AnimatePresence mode="wait">
              <motion.div key={role} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}>
                <h3 style={{ fontSize: '1.45rem', marginTop: 6 }}>{r.title}</h3>
                <ul className="role-list">
                  {r.points.map((p, i) => (
                    <motion.li key={p} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i + 0.1 }}>
                      <span className="ic"><Check size={15} /></span>{p}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mock role-panel">
              <div className="mock-bar">
                <div className="mock-dots"><i /><i /><i /></div>
                <div className="mock-url"><Lock size={11} /> clearpath.app/{role}</div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={role} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3, ease: EASE }}>
                  <RoleVisual role={role} />
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section className="section" style={{ paddingBottom: 40 }}>
      <div className="section-inner">
        <Reveal className="stats-band">
          <BandStat value={6} label="University departments connected" />
          <BandStat value={1} label="Online request replaces the paper form" />
          <BandStat value={0} label="Office queues to check your status" />
          <BandStat value="24/7" label="Live access from any device" />
        </Reveal>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className="section" id="security" style={{ paddingTop: 64 }}>
      <div className="section-inner">
        <SectionHead eyebrow="Security" title="Built to be trusted with student records" sub="Industry-standard protection at every layer of the stack." />
        <motion.div className="sec-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }}>
          {SECURITY.map((s) => (
            <motion.div key={s.title} className="sec-item" variants={item} whileHover={{ y: -3 }}>
              <span className="feat-icon"><s.icon size={20} /></span>
              <div><h3>{s.title}</h3><p>{s.text}</p></div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function VerifyCTA() {
  const navigate = useNavigate();
  const [no, setNo] = useState('');
  return (
    <section className="section" id="verify" style={{ paddingTop: 24 }}>
      <div className="section-inner">
        <Reveal className="verify-cta">
          <div>
            <span className="eyebrow"><ShieldCheck size={13} /> For employers &amp; universities</span>
            <h2 className="display-h2" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2rem)' }}>Received a ClearPath certificate?</h2>
            <p className="muted" style={{ marginTop: 10 }}>Enter its number or scan the QR code to confirm it is genuine. No account needed.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (no.trim()) navigate(`/verify/${no.trim().toUpperCase()}`); }}>
            <div className="search-box">
              <Search size={16} />
              <input className="input" placeholder="CP-2026-XXXXXXXX" value={no} onChange={(e) => setNo(e.target.value)} aria-label="Certificate number" />
            </div>
            <button className="btn btn-primary">Verify <ArrowRight size={16} className="arrow" /></button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section tint" id="faq">
      <div className="section-inner">
        <SectionHead eyebrow="FAQ" title="Questions, answered" sub="Can't find what you need? Visit the help centre." />
        <motion.div className="faq" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }}>
          {FAQS.map(([q, a], i) => (
            <motion.div key={q} variants={item}>
              <FaqItem q={q} a={a} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
            </motion.div>
          ))}
        </motion.div>
        <Reveal className="center" style={{ marginTop: 26 }}>
          <Link to="/help" className="btn btn-ghost">Open the help centre <ArrowRight size={16} className="arrow" /></Link>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCTA() {
  const { user } = useAuth();
  return (
    <section className="section">
      <div className="section-inner">
        <motion.div
          className="cta-band"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <Building2 size={34} style={{ opacity: 0.85 }} />
          <h2 style={{ marginTop: 14 }}>Ready to leave the paper form behind?</h2>
          <p>Create your account in two minutes and submit one request to every department today.</p>
          <div className="hero-cta">
            {user ? (
              <Magnetic><Link to={homeFor(user.role)} className="btn btn-white btn-lg">Go to my dashboard <ArrowRight size={18} className="arrow" /></Link></Magnetic>
            ) : (
              <>
                <Magnetic><Link to="/register" className="btn btn-white btn-lg">Create student account <ArrowRight size={18} className="arrow" /></Link></Magnetic>
                <Magnetic><Link to="/login" className="btn btn-ghost btn-lg">Staff log in</Link></Magnetic>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Landing() {
  const location = useLocation();

  // Arriving from another page with /#section → scroll to it once the page has faded in
  useEffect(() => {
    if (!location.hash) return undefined;
    const t = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 450);
    return () => clearTimeout(t);
  }, [location.hash]);

  return (
    <>
      <Hero />
      <DepartmentsMarquee />
      <WhySection />
      <HowItWorks />
      <Features />
      <Roles />
      <StatsBand />
      <Security />
      <VerifyCTA />
      <Faq />
      <FinalCTA />
      <SiteFooter />
    </>
  );
}
