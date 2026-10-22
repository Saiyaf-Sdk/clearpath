// Fills the database with realistic demo data. Run: npm run seed
// WARNING: deletes the whole ClearPath database first.
//
// Demo accounts use "demo." addresses at real university domains so the right portal opens.
// Keep SMTP empty while using them, so no email is ever sent to those addresses.
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');
const University = require('./models/University');
const User = require('./models/User');
const Department = require('./models/Department');
const Due = require('./models/Due');
const EnrolledStudent = require('./models/EnrolledStudent');
const ClearanceRequest = require('./models/ClearanceRequest');
const Certificate = require('./models/Certificate');
const AuditLog = require('./models/AuditLog');
const Notification = require('./models/Notification');
const StoredFile = require('./models/StoredFile');
const Faculty = require('./models/Faculty');
const UNIVERSITIES = require('./data/universities');
const FACULTIES = require('./data/faculties');
const { applyBundledLogos } = require('./utils/logos');

const PASSWORD = 'password123';
const HOUR = 36e5;
const DAY = 24 * HOUR;
const NOW = Date.now();

/* ---------- deterministic random numbers (same data every run) ---------- */
let seed = 20261028;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const oid = () => new mongoose.Types.ObjectId();
const ago = (ms) => new Date(NOW - ms);

/* ---------- reference data ---------- */
// Central offices: one set per university, they clear every student
const CENTRAL_OFFICES = [
  { name: 'Main Library', code: 'LIB', description: 'Books, journals and library fines', order: 10 },
  { name: 'Hostels & Accommodation', code: 'HOS', description: 'Room keys, damages and hostel fees', order: 11 },
  { name: 'Finance Division', code: 'FIN', description: 'Tuition, exam and other fees (Bursar)', order: 12 },
  { name: 'Sports Division', code: 'SPO', description: 'Sports equipment, kits and gym', order: 13 },
  { name: 'Student Affairs', code: 'SAF', description: 'ID card return and disciplinary clearance', order: 14 },
];
// Faculty offices: each faculty has its own (labs only where the faculty has labs, a library only on a separate campus)
const FACULTY_OFFICES = {
  OFF: { name: 'Faculty Office', code: 'OFF', description: "Dean's office: examinations, transcripts and records", order: 1 },
  HOD: { name: 'Head of Department', code: 'HOD', description: 'Department clearance: projects, equipment and fees', order: 2 },
  LAB: { name: 'Faculty Laboratories', code: 'LAB', description: 'Lab equipment, tools and breakages', order: 3 },
  FLIB: { name: 'Faculty Library', code: 'FLIB', description: "The faculty's own library on its campus", order: 4 },
};
const LAB_FACULTY = /engineering|science|medic|agri|technolog|dental|veterinary|computing|health|siddha|architecture|livestock|animal|geomatics|nursing|bioresources|fisheries|information/i;

const CENTRAL_OFFICERS = {
  LIB: 'Chamari Wickramasinghe',
  HOS: 'Nuwan Rathnayake',
  FIN: 'Sanduni Herath',
  SPO: 'Ruwan Dissanayake',
  SAF: 'Malkanthi Gunawardena',
};

const DUE_TEXT = {
  LIB: [['Overdue book: Engineering Mathematics (9 days)', 270], ['Lost book: Data Structures in C', 3850], ['Overdue journal (5 days)', 150], ['Damaged book cover replacement', 600]],
  FLIB: [['Overdue book: Digital Signal Processing (12 days)', 450], ['Lost reference book', 2900], ['Overdue thesis copy (4 days)', 120]],
  HOS: [['Room key not returned', 1500], ['Broken window – Room B214', 4200], ['Hostel fee balance (2nd semester)', 7500], ['Mattress damage', 2500]],
  FIN: [['Final-year examination fee', 2500], ['Convocation fee', 5000], ['Late registration fee', 750]],
  LAB: [['Broken multimeter', 3200], ['Lost Arduino kit', 6800], ['Damaged oscilloscope probe', 1800], ['Glassware breakage', 950]],
  SPO: [['Cricket kit not returned', 2200], ['Gym membership balance', 1200], ['Lost badminton racket', 1600]],
  SAF: [['Student ID card not returned', 500], ['Replacement ID card fee', 750]],
  HOD: [['Field visit fee balance', 2000], ['Department equipment not returned', 1500], ['Final project report binding fee', 800]],
  OFF: [['Transcript fee', 600], ['Repeat examination fee', 1000], ['Academic record copy fee', 400]],
};

const FIRST_M = ['Kasun', 'Tharindu', 'Chathura', 'Dilshan', 'Isuru', 'Lahiru', 'Pasindu', 'Sahan', 'Nadeesha', 'Ravindu', 'Hasitha', 'Janith', 'Kavindu', 'Supun', 'Thilina', 'Arjun', 'Karthik', 'Rizwan', 'Imran', 'Yasiru', 'Dinuka', 'Sandun', 'Akila', 'Vihanga', 'Mahesh', 'Asanka', 'Prasad', 'Niroshan', 'Gayan', 'Ruwan', 'Sajith', 'Lakshan'];
const FIRST_F = ['Nimali', 'Dilini', 'Sachini', 'Hiruni', 'Kavindya', 'Tharushi', 'Ishani', 'Nethmi', 'Piumi', 'Sewwandi', 'Anjali', 'Fathima', 'Priya', 'Oshadi', 'Dulani', 'Madushi', 'Rashmi', 'Yasodha', 'Gayani', 'Thisuri', 'Chamodi', 'Hansika', 'Lakmini', 'Samanthi'];
const LAST = ['Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Wijesinghe', 'Bandara', 'Rajapaksha', 'Gunasekara', 'Karunaratne', 'Dissanayake', 'Wickramasinghe', 'Herath', 'Ekanayake', 'Senanayake', 'Kumara', 'Weerasinghe', 'Abeysekara', 'Ranasinghe', 'Liyanage', 'Samarasinghe', 'Thevarajah', 'Mohamed', 'Nadarajah', 'Amarasinghe', 'Pathirana', 'Jayawardena', 'Kodikara', 'Sivakumar', 'Rathnayake', 'Munasinghe'];

// Registration number prefix per faculty code (e.g. EG/2021/4501)
const PREFIX = { ENG: 'EG', SCI: 'SC', MED: 'MD', AGR: 'AG', MGT: 'MF', HSS: 'HS', AHS: 'AH', TEC: 'TE', FMST: 'FS', ART: 'AR', LAW: 'LW', EDU: 'ED' };

const REASONS = ['graduation', 'graduation', 'graduation', 'graduation', 'transfer', 'withdrawal', 'other'];
const CLEAR_REMARKS = ['All items returned', 'No dues', 'Cleared', 'Verified – nothing outstanding', 'Nothing outstanding'];

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
const usedNames = new Set();
const randomPerson = () => {
  for (let tries = 0; ; tries += 1) {
    const female = chance(0.5);
    const name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
    if (!usedNames.has(name) || tries > 50) {
      usedNames.add(name);
      return name;
    }
  }
};

/* ---------- a small PDF "bank receipt" for receipts students uploaded ---------- */
const receiptPdf = (student, due, paidOn) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A6', margin: 24 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(13).font('Helvetica-Bold').text('Peoples Bank – Deposit Slip', { align: 'center' });
    doc.moveDown(0.6).fontSize(8.5).font('Helvetica').fillColor('#475569').text('Demo receipt generated by the ClearPath seed script', { align: 'center' });
    doc.moveDown(1).fillColor('#0f172a').fontSize(10);
    [
      ['Paid by', student.name],
      ['Reg. no.', student.regNo],
      ['Purpose', due.description],
      ['Amount', `LKR ${due.amount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`],
      ['Date', paidOn.toLocaleDateString('en-GB')],
      ['Reference', crypto.randomBytes(4).toString('hex').toUpperCase()],
    ].forEach(([k, v]) => doc.font('Helvetica-Bold').text(`${k}: `, { continued: true }).font('Helvetica').text(v));
    doc.end();
  });

/* ---------- builds one university's demo world ---------- */
// fixedStudents: [{ name, email, regNo, facultyCode, special }]
async function buildUniversity({ slug: uniSlug, skipCentral = [], fixedStudents = [], randomStudents, mainFacultyCode, pendingOnList = [], extraPending = 4, mix, specials = async () => {} }) {
  const uni = await University.findOne({ slug: uniSlug });
  const domain = uni.domains[0];
  const hash = await bcrypt.hash(PASSWORD, 10);
  const created = (days) => ago(days * DAY);

  // Faculties (from data/faculties.js)
  const faculties = (FACULTIES[uniSlug] || []).map((f, i) => ({ _id: oid(), ...f, order: i, university: uni._id }));
  await Faculty.insertMany(faculties);
  const facByCode = Object.fromEntries(faculties.map((f) => [f.code, f]));
  // The "main campus" = where most faculties are; faculties elsewhere get their own library
  const tally = {};
  faculties.forEach((f) => { tally[f.location] = (tally[f.location] || 0) + 1; });
  const mainLocation = Object.entries(tally).sort((x, y) => y[1] - x[1])[0]?.[0];

  // Offices
  const central = CENTRAL_OFFICES.filter((d) => !skipCentral.includes(d.code)).map((d) => ({ _id: oid(), ...d, university: uni._id, faculty: null }));
  const facultyOffices = [];
  faculties.forEach((f) => {
    const kinds = /graduate/i.test(f.name) ? ['OFF'] : ['OFF', 'HOD', ...(LAB_FACULTY.test(f.name) ? ['LAB'] : []), ...(f.location !== mainLocation ? ['FLIB'] : [])];
    kinds.forEach((k) => facultyOffices.push({ _id: oid(), ...FACULTY_OFFICES[k], university: uni._id, faculty: f._id }));
  });
  const depts = [...central, ...facultyOffices];
  await Department.insertMany(depts);
  // The offices that clear a student of faculty f (faculty offices first, then central)
  const officesFor = (facultyId) => [...facultyOffices.filter((d) => String(d.faculty) === String(facultyId)).sort((x, y) => x.order - y.order), ...central];

  // People: university admin, central officers, a faculty admin and officers for every faculty
  const users = [];
  const admin = { _id: oid(), name: `${uni.shortName} Administrator`, email: `demo.admin@${domain}`, password: hash, role: 'admin', university: uni._id, createdAt: created(120), updatedAt: created(120) };
  users.push(admin);
  const officerOf = {}; // department id -> officer
  central.forEach((d) => {
    const o = { _id: oid(), name: CENTRAL_OFFICERS[d.code], email: `demo.${d.code.toLowerCase()}@${domain}`, password: hash, role: 'officer', university: uni._id, department: d._id, phone: `07${int(10000000, 99999999)}`, createdAt: created(110), updatedAt: created(110) };
    officerOf[String(d._id)] = o;
    users.push(o);
  });
  const facultyAdmins = {};
  faculties.forEach((f) => {
    const fc = f.code.toLowerCase();
    const fa = { _id: oid(), name: randomPerson(), email: `demo.${fc}.admin@${domain}`, password: hash, role: 'facultyadmin', university: uni._id, facultyId: f._id, createdAt: created(115), updatedAt: created(115) };
    facultyAdmins[f.code] = fa;
    users.push(fa);
    facultyOffices.filter((d) => String(d.faculty) === String(f._id)).forEach((d) => {
      const local = d.code === 'OFF' ? 'office' : d.code.toLowerCase();
      const o = { _id: oid(), name: randomPerson(), email: `demo.${fc}.${local}@${domain}`, password: hash, role: 'officer', university: uni._id, department: d._id, facultyId: f._id, phone: `07${int(10000000, 99999999)}`, createdAt: created(110), updatedAt: created(110) };
      officerOf[String(d._id)] = o;
      users.push(o);
    });
  });

  // Students: fixed demo students first, then generated ones spread over the faculties
  const teaching = faculties.filter((f) => !/graduate/i.test(f.name));
  const counters = {};
  const nextRegNo = (f) => {
    const p = PREFIX[f.code] || f.code.slice(0, 3);
    counters[p] = (counters[p] || 4600) + int(1, 7);
    return `${p}/2021/${counters[p]}`;
  };
  const students = fixedStudents.map((s) => {
    const f = facByCode[s.facultyCode];
    return { _id: oid(), name: s.name, email: s.email, regNo: s.regNo, special: s.special, faculty: f.name, facultyId: f._id, password: hash, role: 'student', university: uni._id, phone: `07${int(10000000, 99999999)}` };
  });
  for (let i = 0; i < randomStudents; i += 1) {
    const name = randomPerson();
    const f = mainFacultyCode && i % 3 === 0 && facByCode[mainFacultyCode] ? facByCode[mainFacultyCode] : teaching[i % teaching.length];
    students.push({
      _id: oid(),
      name,
      email: `demo.${slug(name.split(' ')[0])}.${slug(name.split(' ')[1]).slice(0, 4)}${i}@${domain}`,
      regNo: nextRegNo(f),
      faculty: f.name,
      facultyId: f._id,
      password: hash,
      role: 'student',
      university: uni._id,
      phone: `07${int(10000000, 99999999)}`,
    });
  }
  students.forEach((st) => {
    const joined = created(int(40, 100));
    st.createdAt = joined;
    st.updatedAt = joined;
    users.push(st);
  });
  await User.insertMany(users.map(({ special, ...u }) => u), { timestamps: false });

  // Official student list: every student with an account, plus some who haven't registered yet
  const pending = pendingOnList.map((p) => {
    const f = facByCode[p.facultyCode];
    return { name: p.name, email: p.email, regNo: p.regNo, faculty: f.name, facultyId: f._id, university: uni._id, status: 'pending' };
  });
  for (let i = 0; i < extraPending; i += 1) {
    const name = randomPerson();
    const f = teaching[(i * 3 + 1) % teaching.length];
    pending.push({ name, email: `demo.${slug(name.split(' ')[0])}${i}@${domain}`, regNo: nextRegNo(f), faculty: f.name, facultyId: f._id, university: uni._id, status: 'pending' });
  }
  await EnrolledStudent.insertMany([
    ...students.map((st) => ({ university: uni._id, regNo: st.regNo, email: st.email, name: st.name, faculty: st.faculty, facultyId: st.facultyId, status: 'activated', activatedAt: st.createdAt, user: st._id })),
    ...pending,
  ]);

  const requests = [];
  const dues = [];
  const certificates = [];
  const files = [];
  const logs = [];
  const notes = [];

  const log = (actor, action, target, details, at, faculty) =>
    logs.push({ actor: actor._id, university: uni._id, department: actor.department, faculty: actor.facultyId || faculty, action, target: String(target), details, createdAt: at, updatedAt: at });
  const note = (user, title, body, link, kind, at) =>
    notes.push({ user: user._id, university: uni._id, title, body, link, kind, read: NOW - at.getTime() > 2 * DAY, createdAt: at, updatedAt: at });

  const addReceipt = async (student, due, at) => {
    const key = crypto.randomBytes(18).toString('hex');
    const data = await receiptPdf(student, due, at);
    files.push({ key, kind: 'receipt', name: `receipt-${student.regNo.replace(/\//g, '-')}.pdf`, contentType: 'application/pdf', size: data.length, data, owner: student._id, university: uni._id, createdAt: at, updatedAt: at });
    due.receiptUrl = `/api/files/${key}`;
    due.receiptName = `receipt-${student.regNo.replace(/\//g, '-')}.pdf`;
    due.receiptAt = at;
  };

  const makeDue = (student, dept, at, [description, amount] = pick(DUE_TEXT[dept.code])) => {
    const officer = officerOf[String(dept._id)];
    const due = { _id: oid(), student: student._id, department: dept._id, university: uni._id, faculty: student.facultyId, amount, description, status: 'unpaid', addedBy: officer._id, createdAt: at, updatedAt: at };
    dues.push(due);
    log(officer, 'DUE_ADDED', due._id, `${student.regNo}: ${description} (LKR ${amount})`, at);
    note(student, `New due from ${dept.name}`, `LKR ${amount.toLocaleString('en-LK')} – ${description}`, '/student/dues', 'warning', at);
    return due;
  };

  // Builds one request following a scenario. opts.items / opts.dues are keyed by office code (LIB, FLIB, LAB …)
  const makeRequest = async (student, scenario, opts = {}) => {
    const offices = officesFor(student.facultyId);
    const start = opts.start || created(scenario === 'completed' ? int(8, 55) : scenario === 'pending' ? int(0, 2) + rnd() : int(2, 18));
    const reason = opts.reason || pick(REASONS);
    const req = { _id: oid(), student: student._id, university: uni._id, faculty: student.facultyId, reason, status: 'pending', items: [], createdAt: start, updatedAt: start };
    if (chance(0.25)) req.note = pick(['Need clearance before the convocation.', 'Applying for a job that needs the certificate.', 'Moving to another university next semester.', 'Please process soon, thank you.']);
    log(student, 'CLEARANCE_SUBMITTED', req._id, `${student.regNo} · ${reason}`, start);
    note(student, 'Request submitted', `Your ${reason} clearance request was sent to ${offices.length} offices.`, '/student/clearance', 'success', start);
    offices.forEach((d) => {
      if (NOW - start.getTime() < 6 * DAY) note(officerOf[String(d._id)], 'New clearance request', `${student.name} (${student.regNo}) asked for ${reason} clearance.`, `/officer/requests?open=${req._id}`, 'info', start);
    });

    let last = start.getTime();
    for (const d of offices) {
      const officer = officerOf[String(d._id)];
      const forced = opts.items?.[d.code];
      let status;
      if (scenario === 'completed') status = 'cleared';
      else if (scenario === 'pending' || scenario === 'cancelled') status = 'pending';
      else status = chance(0.5) ? 'cleared' : chance(0.7) ? 'pending' : 'dues';
      if (forced) status = forced;

      const item = { department: d._id, status };
      const maxAt = Math.min(NOW - HOUR, start.getTime() + int(3, 140) * HOUR);
      let at = new Date(Math.max(start.getTime() + HOUR, maxAt));

      if (status === 'cleared') {
        // Some completed students had a due that they paid before being cleared
        if (scenario === 'completed' && chance(0.18) && DUE_TEXT[d.code]) {
          const dueAt = new Date(start.getTime() + int(1, 6) * HOUR);
          const due = makeDue(student, d, dueAt);
          const paidAt = new Date(Math.min(NOW - 3 * HOUR, dueAt.getTime() + int(6, 48) * HOUR));
          at = new Date(Math.min(NOW - HOUR, Math.max(at.getTime(), paidAt.getTime() + HOUR)));
          due.status = 'paid';
          due.paidAt = paidAt;
          due.verifiedBy = officer._id;
          due.updatedAt = paidAt;
          if (chance(0.6)) await addReceipt(student, due, new Date(paidAt.getTime() - 3 * HOUR));
          log(officer, 'DUE_PAID', due._id, `${student.regNo}: ${due.description}`, paidAt);
        }
        item.remark = pick(CLEAR_REMARKS);
        item.actionedBy = officer._id;
        item.actionedAt = at;
        log(officer, 'CLEARANCE_CLEARED', req._id, `${student.regNo} · ${d.name}: ${item.remark}`, at);
        note(student, `${d.name} cleared you`, item.remark, '/student/clearance', 'success', at);
        last = Math.max(last, at.getTime());
      } else if (status === 'dues') {
        const preset = opts.dues?.[d.code];
        const due = makeDue(student, d, new Date(Math.min(NOW - 2 * HOUR, start.getTime() + int(1, 30) * HOUR)), preset);
        item.remark = `Due added: ${due.description}`;
        item.actionedBy = officer._id;
        item.actionedAt = due.createdAt;
        log(officer, 'CLEARANCE_FLAGGED', req._id, `${student.regNo} · ${d.name}: ${item.remark}`, due.createdAt);
        const receiptAt = new Date(Math.min(NOW - HOUR, due.createdAt.getTime() + int(4, 40) * HOUR));
        if (!preset && chance(0.45)) {
          due.status = 'receipt-submitted';
          due.updatedAt = receiptAt;
          await addReceipt(student, due, receiptAt);
          log(student, 'RECEIPT_UPLOADED', due._id, `${student.regNo}: ${due.description}`, receiptAt);
          note(officer, 'Receipt to verify', `${student.name} (${student.regNo}) uploaded a receipt for LKR ${due.amount.toLocaleString('en-LK')}.`, '/officer/receipts', 'info', receiptAt);
        }
      }
      req.items.push(item);
    }

    if (scenario === 'completed') {
      req.status = 'completed';
      req.completedAt = new Date(last);
      req.updatedAt = req.completedAt;
      const cert = { _id: oid(), request: req._id, student: student._id, university: uni._id, certificateNo: `CP-${uni.code}-${new Date(last).getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, issuedAt: req.completedAt, createdAt: req.completedAt, updatedAt: req.completedAt };
      certificates.push(cert);
      log(officerOf[String(offices[offices.length - 1]._id)], 'CERTIFICATE_ISSUED', cert._id, `${student.regNo} · ${cert.certificateNo}`, req.completedAt, student.facultyId);
      note(student, 'Clearance complete – certificate issued', `Certificate ${cert.certificateNo} is ready to download.`, '/student/certificate', 'success', req.completedAt);
    } else if (scenario === 'cancelled') {
      req.status = 'cancelled';
      req.updatedAt = new Date(start.getTime() + int(2, 30) * HOUR);
      log(student, 'CLEARANCE_CANCELLED', req._id, student.regNo, req.updatedAt);
    } else {
      if (scenario === 'in-progress' && !req.items.some((it) => it.status !== 'pending')) {
        const first = req.items[0];
        const d0 = offices[0];
        const o0 = officerOf[String(d0._id)];
        first.status = 'cleared';
        first.remark = pick(CLEAR_REMARKS);
        first.actionedBy = o0._id;
        first.actionedAt = new Date(Math.min(NOW - HOUR, start.getTime() + int(2, 30) * HOUR));
        log(o0, 'CLEARANCE_CLEARED', req._id, `${student.regNo} · ${d0.name}: ${first.remark}`, first.actionedAt);
        last = Math.max(last, first.actionedAt.getTime());
      }
      const touched = req.items.some((it) => it.status !== 'pending');
      req.status = touched ? 'in-progress' : 'pending';
      req.updatedAt = new Date(last);
    }
    requests.push(req);
    return req;
  };

  // Special demo students (their stories are written out in specials())
  await specials({ students, makeRequest, makeDue, officesFor });

  // Everyone else: a realistic mix of situations
  const rest = students.filter((st) => !st.special);
  let i = 0;
  for (const [scenario, count] of Object.entries(mix)) {
    for (let k = 0; k < count && i < rest.length; k += 1, i += 1) {
      await makeRequest(rest[i], scenario); // eslint-disable-line no-await-in-loop
    }
  }
  // A few students without a request but with an unpaid due (e.g. a library fine)
  rest.slice(i, i + 2).forEach((st) => makeDue(st, central.find((d) => d.code === 'LIB') || central[0], created(int(3, 20))));

  // Registration events for the history
  students.forEach((st) => log(st, 'STUDENT_REGISTERED', st._id, st.regNo, st.createdAt));

  await ClearanceRequest.insertMany(requests, { timestamps: false });
  await Due.insertMany(dues, { timestamps: false });
  await Certificate.insertMany(certificates, { timestamps: false });
  if (files.length) await StoredFile.insertMany(files, { timestamps: false });
  await AuditLog.insertMany(logs, { timestamps: false });
  await Notification.insertMany(notes, { timestamps: false });

  return { uni, faculties, depts, users, students, requests, dues, certificates, files };
}

(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set. Create server/.env first (see .env.example).');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Resetting the database...');
  const models = [University, Faculty, User, Department, Due, EnrolledStudent, ClearanceRequest, Certificate, AuditLog, Notification, StoredFile];
  try {
    await mongoose.connection.dropDatabase(); // also removes old indexes
  } catch (err) {
    // Some database users may not drop whole databases – empty each collection instead
    console.log(`(Could not drop the database: ${err.message}. Clearing collections instead.)`);
    await Promise.all(models.map((m) => m.collection.drop().catch(() => {})));
  }
  await Promise.all(models.map((m) => m.syncIndexes()));

  await University.insertMany(UNIVERSITIES);
  console.log(`Added ${UNIVERSITIES.length} universities.`);
  console.log(`Applied bundled logos to ${await applyBundledLogos()} universities.`);

  // Platform admin (manages universities, logos and university admins)
  await User.create({ name: 'ClearPath Platform Admin', email: 'platform@clearpath.lk', password: PASSWORD, role: 'superadmin' });

  const results = [];

  /* ---------- University of Ruhuna: the main demo (Faculty of Engineering, Galle) ---------- */
  results.push(await buildUniversity({
    slug: 'ruhuna',
    mainFacultyCode: 'ENG',
    fixedStudents: [
      { name: 'Kasun Perera', email: 'demo.kasun@ruh.ac.lk', regNo: 'EG/2021/4501', facultyCode: 'ENG', special: 'kasun' },
      { name: 'Nimali Fernando', email: 'demo.nimali@ruh.ac.lk', regNo: 'EG/2021/4502', facultyCode: 'ENG', special: 'nimali' },
      { name: 'Tharindu Senanayake', email: 'demo.tharindu@ruh.ac.lk', regNo: 'EG/2021/4510', facultyCode: 'ENG', special: 'fresh' },
      { name: 'Hiruni Jayawardena', email: 'demo.hiruni@ruh.ac.lk', regNo: 'SC/2021/1021', facultyCode: 'SCI', special: 'hiruni' },
    ],
    randomStudents: 44,
    pendingOnList: [
      { name: 'Amal Silva', email: 'demo.amal@ruh.ac.lk', regNo: 'EG/2021/4519', facultyCode: 'ENG' },
      { name: 'Dilini Jayasinghe', email: 'demo.dilini@ruh.ac.lk', regNo: 'SC/2021/1033', facultyCode: 'SCI' },
    ],
    extraPending: 8,
    mix: { completed: 13, 'in-progress': 15, pending: 7, cancelled: 3 },
    specials: async ({ students, makeRequest }) => {
      const find = (sp) => students.find((st) => st.special === sp);
      // Kasun (Engineering, Galle): halfway through, with an unpaid fine at the Engineering Faculty Library – the live demo
      await makeRequest(find('kasun'), 'in-progress', {
        start: ago(6 * DAY),
        reason: 'graduation',
        items: { OFF: 'cleared', HOD: 'cleared', LAB: 'pending', FLIB: 'dues', LIB: 'cleared', HOS: 'cleared', FIN: 'cleared', SPO: 'pending', SAF: 'pending' },
        dues: { FLIB: ['Overdue book: Digital Signal Processing (12 days)', 450] },
      });
      // Nimali (Engineering): fully cleared, certificate issued
      await makeRequest(find('nimali'), 'completed', { start: ago(16 * DAY), reason: 'graduation' });
      // Hiruni (Science, Matara): a different faculty – different offices on her tracker
      await makeRequest(find('hiruni'), 'in-progress', { start: ago(4 * DAY), reason: 'graduation', items: { OFF: 'cleared', HOD: 'pending', LAB: 'cleared', LIB: 'pending', HOS: 'cleared', FIN: 'pending', SPO: 'cleared', SAF: 'pending' } });
    },
  }));

  /* ---------- University of Colombo (no hostel office) ----------
     Saman has the SAME registration number as Kasun: numbers only need to be unique inside one university. */
  results.push(await buildUniversity({
    slug: 'colombo',
    skipCentral: ['HOS'],
    mainFacultyCode: 'SCI',
    fixedStudents: [{ name: 'Saman Kumara', email: 'demo.saman@cmb.ac.lk', regNo: 'EG/2021/4501', facultyCode: 'SCI', special: 'saman' }],
    randomStudents: 16,
    pendingOnList: [{ name: 'Ruwan Wijesinghe', email: 'demo.ruwan@cmb.ac.lk', regNo: 'SC/2021/2001', facultyCode: 'SCI' }],
    mix: { completed: 5, 'in-progress': 6, pending: 3, cancelled: 1 },
    specials: async ({ students, makeRequest }) => {
      const saman = students.find((st) => st.special === 'saman');
      await makeRequest(saman, 'in-progress', { start: ago(3 * DAY), reason: 'transfer', items: { OFF: 'cleared', HOD: 'pending', LAB: 'cleared', LIB: 'cleared', FIN: 'pending', SPO: 'pending', SAF: 'pending' } });
    },
  }));

  /* ---------- The other 15 universities: smaller but complete demo worlds ---------- */
  for (const u of UNIVERSITIES.filter((x) => !['ruhuna', 'colombo'].includes(x.slug))) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await buildUniversity({
      slug: u.slug,
      randomStudents: 10,
      extraPending: 4,
      mix: { completed: 3, 'in-progress': 3, pending: 2, cancelled: 1 },
    }));
  }

  const count = (k) => results.reduce((sum, r) => sum + r[k].length, 0);
  console.log(`\nAdded ${count('faculties')} faculties, ${count('depts')} offices, ${count('users')} people, ${count('requests')} requests, ${count('dues')} dues, ${count('certificates')} certificates.`);
  results.forEach((r) => console.log(`  ${r.uni.shortName.padEnd(38)} ${String(r.faculties.length).padStart(2)} faculties · ${String(r.students.length).padStart(2)} students · ${String(r.requests.length).padStart(2)} requests`));

  console.log('\nSeed complete. All passwords:', PASSWORD);
  console.log('Sign in: choose the university, then the faculty (or "Central administration").');
  console.log('Platform admin: platform@clearpath.lk (Platform administrator sign-in)');
  console.log('Every university:  university admin demo.admin@<domain> · central offices demo.lib@ / demo.hos@ / demo.fin@ / demo.spo@ / demo.saf@<domain>  → Central administration');
  console.log('Every faculty:     faculty admin demo.<faculty code>.admin@<domain> · offices demo.<code>.office@ / .hod@ / .lab@ / .flib@<domain>');
  console.log('Ruhuna, Faculty of Engineering (Galle):');
  console.log('   students demo.kasun@ruh.ac.lk (in progress, LKR 450 fine at the Engineering Faculty Library), demo.nimali@ruh.ac.lk (certificate),');
  console.log('   demo.tharindu@ruh.ac.lk (no request yet) · faculty admin demo.eng.admin@ruh.ac.lk · faculty library demo.eng.flib@ruh.ac.lk');
  console.log('   not registered yet: EG/2021/4519 + demo.amal@ruh.ac.lk');
  console.log('Ruhuna, Faculty of Science (Matara): student demo.hiruni@ruh.ac.lk · faculty admin demo.sci.admin@ruh.ac.lk');
  console.log('Colombo, Faculty of Science: student demo.saman@cmb.ac.lk · not registered yet: SC/2021/2001 + demo.ruwan@cmb.ac.lk');
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
