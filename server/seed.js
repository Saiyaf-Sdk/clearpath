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
const UNIVERSITIES = require('./data/universities');
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
const DEPARTMENTS = [
  { name: 'Library', code: 'LIB', description: 'Books, journals and library fines', order: 1 },
  { name: 'Hostel', code: 'HOS', description: 'Room keys, damages and hostel fees', order: 2 },
  { name: 'Finance Division', code: 'FIN', description: 'Tuition, exam and other fees', order: 3 },
  { name: 'Faculty Laboratories', code: 'LAB', description: 'Lab equipment, tools and breakages', order: 4 },
  { name: 'Sports Division', code: 'SPO', description: 'Sports equipment, kits and gym', order: 5 },
  { name: 'Student Affairs', code: 'SAF', description: 'ID card return and disciplinary clearance', order: 6 },
];

const OFFICERS = {
  LIB: 'Chamari Wickramasinghe',
  HOS: 'Nuwan Rathnayake',
  FIN: 'Sanduni Herath',
  LAB: 'Ishara Bandara',
  SPO: 'Ruwan Dissanayake',
  SAF: 'Malkanthi Gunawardena',
};

const DUE_TEXT = {
  LIB: [['Overdue book: Engineering Mathematics (9 days)', 270], ['Lost book: Data Structures in C', 3850], ['Overdue journal (5 days)', 150], ['Damaged book cover replacement', 600]],
  HOS: [['Room key not returned', 1500], ['Broken window – Room B214', 4200], ['Hostel fee balance (2nd semester)', 7500], ['Mattress damage', 2500]],
  FIN: [['Final-year examination fee', 2500], ['Library membership fee balance', 1000], ['Convocation fee', 5000], ['Late registration fee', 750]],
  LAB: [['Broken multimeter', 3200], ['Lost Arduino kit', 6800], ['Damaged oscilloscope probe', 1800], ['Glassware breakage', 950]],
  SPO: [['Cricket kit not returned', 2200], ['Gym membership balance', 1200], ['Lost badminton racket', 1600]],
  SAF: [['Student ID card not returned', 500], ['Replacement ID card fee', 750]],
};

const FIRST_M = ['Kasun', 'Tharindu', 'Chathura', 'Dilshan', 'Isuru', 'Lahiru', 'Pasindu', 'Sahan', 'Nadeesha', 'Ravindu', 'Hasitha', 'Janith', 'Kavindu', 'Supun', 'Thilina', 'Arjun', 'Karthik', 'Rizwan', 'Imran', 'Yasiru', 'Dinuka', 'Sandun', 'Akila', 'Vihanga'];
const FIRST_F = ['Nimali', 'Dilini', 'Sachini', 'Hiruni', 'Kavindya', 'Tharushi', 'Ishani', 'Nethmi', 'Piumi', 'Sewwandi', 'Anjali', 'Fathima', 'Priya', 'Oshadi', 'Dulani', 'Madushi', 'Rashmi', 'Yasodha', 'Gayani', 'Thisuri'];
const LAST = ['Perera', 'Fernando', 'Silva', 'Jayasinghe', 'Wijesinghe', 'Bandara', 'Rajapaksha', 'Gunasekara', 'Karunaratne', 'Dissanayake', 'Wickramasinghe', 'Herath', 'Ekanayake', 'Senanayake', 'Kumara', 'Weerasinghe', 'Abeysekara', 'Ranasinghe', 'Liyanage', 'Samarasinghe', 'Thevarajah', 'Mohamed', 'Nadarajah', 'Amarasinghe'];

const FACULTIES = [
  { name: 'Engineering', prefix: 'EG' },
  { name: 'Science', prefix: 'SC' },
  { name: 'Management & Finance', prefix: 'MF' },
  { name: 'Medicine', prefix: 'MD' },
  { name: 'Agriculture', prefix: 'AG' },
  { name: 'Humanities & Social Sciences', prefix: 'HS' },
];

const REASONS = ['graduation', 'graduation', 'graduation', 'graduation', 'transfer', 'withdrawal', 'other'];
const CLEAR_REMARKS = ['All items returned', 'No dues', 'Cleared', 'Verified – nothing outstanding', 'Books returned'];

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
const usedNames = new Set();
const randomPerson = () => {
  for (;;) {
    const female = chance(0.5);
    const name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
    if (!usedNames.has(name)) {
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
async function buildUniversity({ code, domain, skipDepts = [], fixedStudents = [], randomStudents, pendingOnList, mix, specials = () => {} }) {
  const uni = await University.findOne({ code });
  const hash = await bcrypt.hash(PASSWORD, 10);
  const created = (days) => ago(days * DAY);

  const depts = DEPARTMENTS.filter((d) => !skipDepts.includes(d.code)).map((d) => ({ _id: oid(), ...d, university: uni._id }));
  await Department.insertMany(depts);
  const deptByCode = Object.fromEntries(depts.map((d) => [d.code, d]));

  const users = [];
  const admin = { _id: oid(), name: `${uni.shortName} Administrator`, email: `demo.admin@${domain}`, password: hash, role: 'admin', university: uni._id, createdAt: created(120), updatedAt: created(120) };
  users.push(admin);
  const officerOf = {};
  depts.forEach((d) => {
    const o = { _id: oid(), name: OFFICERS[d.code], email: `demo.${d.code.toLowerCase()}@${domain}`, password: hash, role: 'officer', university: uni._id, department: d._id, phone: `07${int(10000000, 99999999)}`, createdAt: created(110), updatedAt: created(110) };
    officerOf[d.code] = o;
    users.push(o);
  });

  // Students: fixed demo students first, then generated ones
  const counters = {};
  const nextRegNo = (fac) => {
    counters[fac.prefix] = (counters[fac.prefix] || 4600) + int(1, 7);
    return `${fac.prefix}/2021/${counters[fac.prefix]}`;
  };
  const students = fixedStudents.map((s) => ({ _id: oid(), ...s, password: hash, role: 'student', university: uni._id, phone: `07${int(10000000, 99999999)}` }));
  for (let i = 0; i < randomStudents; i += 1) {
    const name = randomPerson();
    const fac = i % 3 === 0 ? FACULTIES[0] : pick(FACULTIES);
    students.push({
      _id: oid(),
      name,
      email: `demo.${slug(name.split(' ')[0])}.${slug(name.split(' ')[1]).slice(0, 4)}${i}@${domain}`,
      regNo: nextRegNo(fac),
      faculty: fac.name,
      password: hash,
      role: 'student',
      university: uni._id,
      phone: `07${int(10000000, 99999999)}`,
    });
  }
  students.forEach((s) => {
    const joined = created(int(40, 100));
    s.createdAt = joined;
    s.updatedAt = joined;
    users.push(s);
  });
  await User.insertMany(users, { timestamps: false });

  // Official student list: every student with an account, plus some who haven't registered yet
  const pending = pendingOnList.map((p) => ({ ...p, university: uni._id, status: 'pending' }));
  const target = pending.length + 8;
  for (let i = pending.length; i < target; i += 1) {
    const name = randomPerson();
    const fac = pick(FACULTIES);
    pending.push({ name, email: `demo.${slug(name.split(' ')[0])}${i}@${domain}`, regNo: nextRegNo(fac), faculty: fac.name, university: uni._id, status: 'pending' });
  }
  await EnrolledStudent.insertMany([
    ...students.map((s) => ({ university: uni._id, regNo: s.regNo, email: s.email, name: s.name, faculty: s.faculty, status: 'activated', activatedAt: s.createdAt, user: s._id })),
    ...pending,
  ]);

  const requests = [];
  const dues = [];
  const certificates = [];
  const files = [];
  const logs = [];
  const notes = [];

  const log = (actor, action, target, details, at) =>
    logs.push({ actor: actor._id, university: uni._id, department: actor.department, action, target: String(target), details, createdAt: at, updatedAt: at });
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

  const makeDue = (student, deptCode, at, [description, amount] = pick(DUE_TEXT[deptCode])) => {
    const due = { _id: oid(), student: student._id, department: deptByCode[deptCode]._id, university: uni._id, amount, description, status: 'unpaid', addedBy: officerOf[deptCode]._id, createdAt: at, updatedAt: at };
    dues.push(due);
    log(officerOf[deptCode], 'DUE_ADDED', due._id, `${student.regNo}: ${description} (LKR ${amount})`, at);
    note(student, `New due from ${deptByCode[deptCode].name}`, `LKR ${amount.toLocaleString('en-LK')} – ${description}`, '/student/dues', 'warning', at);
    return due;
  };

  // Builds one request following a scenario
  const makeRequest = async (student, scenario, opts = {}) => {
    const start = opts.start || created(scenario === 'completed' ? int(8, 55) : scenario === 'pending' ? int(0, 2) + rnd() : int(2, 18));
    const reason = opts.reason || pick(REASONS);
    const req = { _id: oid(), student: student._id, university: uni._id, reason, status: 'pending', items: [], createdAt: start, updatedAt: start };
    if (chance(0.25)) req.note = pick(['Need clearance before the convocation.', 'Applying for a job that needs the certificate.', 'Moving to another university next semester.', 'Please process soon, thank you.']);
    log(student, 'CLEARANCE_SUBMITTED', req._id, `${student.regNo} · ${reason}`, start);
    note(student, 'Request submitted', `Your ${reason} clearance request was sent to ${depts.length} departments.`, '/student/clearance', 'success', start);
    depts.forEach((d) => {
      if (NOW - start.getTime() < 6 * DAY) note(officerOf[d.code], 'New clearance request', `${student.name} (${student.regNo}) asked for ${reason} clearance.`, `/officer/requests?open=${req._id}`, 'info', start);
    });

    let last = start.getTime();
    for (const d of depts) {
      const forced = opts.items?.[d.code];
      let status;
      if (scenario === 'completed') status = 'cleared';
      else if (scenario === 'pending' || scenario === 'cancelled') status = 'pending';
      else status = forced || (chance(0.5) ? 'cleared' : chance(0.68) ? 'pending' : 'dues');
      if (forced) status = forced;

      const item = { department: d._id, status };
      const maxAt = Math.min(NOW - HOUR, start.getTime() + int(3, 140) * HOUR);
      let at = new Date(Math.max(start.getTime() + HOUR, maxAt));

      if (status === 'cleared') {
        // Some completed students had a due that they paid before being cleared
        if (scenario === 'completed' && chance(0.22) && DUE_TEXT[d.code]) {
          const dueAt = new Date(start.getTime() + int(1, 6) * HOUR);
          const due = makeDue(student, d.code, dueAt);
          const paidAt = new Date(Math.min(NOW - 3 * HOUR, dueAt.getTime() + int(6, 48) * HOUR));
          at = new Date(Math.min(NOW - HOUR, Math.max(at.getTime(), paidAt.getTime() + HOUR)));
          due.status = 'paid';
          due.paidAt = paidAt;
          due.verifiedBy = officerOf[d.code]._id;
          due.updatedAt = paidAt;
          if (chance(0.7)) await addReceipt(student, due, new Date(paidAt.getTime() - 3 * HOUR));
          log(officerOf[d.code], 'DUE_PAID', due._id, `${student.regNo}: ${due.description}`, paidAt);
        }
        item.remark = pick(CLEAR_REMARKS);
        item.actionedBy = officerOf[d.code]._id;
        item.actionedAt = at;
        log(officerOf[d.code], 'CLEARANCE_CLEARED', req._id, `${student.regNo} · ${d.name}: ${item.remark}`, at);
        note(student, `${d.name} cleared you`, item.remark, '/student/clearance', 'success', at);
        last = Math.max(last, at.getTime());
      } else if (status === 'dues') {
        const preset = opts.dues?.[d.code];
        const due = makeDue(student, d.code, new Date(Math.min(NOW - 2 * HOUR, start.getTime() + int(1, 30) * HOUR)), preset);
        item.remark = `Due added: ${due.description}`;
        item.actionedBy = officerOf[d.code]._id;
        item.actionedAt = due.createdAt;
        log(officerOf[d.code], 'CLEARANCE_FLAGGED', req._id, `${student.regNo} · ${d.name}: ${item.remark}`, due.createdAt);
        const receiptAt = new Date(Math.min(NOW - HOUR, due.createdAt.getTime() + int(4, 40) * HOUR));
        if (!preset && chance(0.45)) {
          due.status = 'receipt-submitted';
          due.updatedAt = receiptAt;
          await addReceipt(student, due, receiptAt);
          log(student, 'RECEIPT_UPLOADED', due._id, `${student.regNo}: ${due.description}`, receiptAt);
          note(officerOf[d.code], 'Receipt to verify', `${student.name} (${student.regNo}) uploaded a receipt for LKR ${due.amount.toLocaleString('en-LK')}.`, '/officer/receipts', 'info', receiptAt);
        }
      }
      req.items.push(item);
    }

    if (scenario === 'completed') {
      req.status = 'completed';
      req.completedAt = new Date(last);
      req.updatedAt = req.completedAt;
      const cert = { _id: oid(), request: req._id, student: student._id, university: uni._id, certificateNo: `CP-${code}-${new Date(last).getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, issuedAt: req.completedAt, createdAt: req.completedAt, updatedAt: req.completedAt };
      certificates.push(cert);
      log(officerOf[depts[depts.length - 1].code], 'CERTIFICATE_ISSUED', cert._id, `${student.regNo} · ${cert.certificateNo}`, req.completedAt);
      note(student, 'Clearance complete – certificate issued', `Certificate ${cert.certificateNo} is ready to download.`, '/student/certificate', 'success', req.completedAt);
    } else if (scenario === 'cancelled') {
      req.status = 'cancelled';
      req.updatedAt = new Date(start.getTime() + int(2, 30) * HOUR);
      log(student, 'CLEARANCE_CANCELLED', req._id, student.regNo, req.updatedAt);
    } else {
      if (scenario === 'in-progress' && !req.items.some((i) => i.status !== 'pending')) {
        const first = req.items[0];
        const d0 = depts[0];
        first.status = 'cleared';
        first.remark = pick(CLEAR_REMARKS);
        first.actionedBy = officerOf[d0.code]._id;
        first.actionedAt = new Date(Math.min(NOW - HOUR, start.getTime() + int(2, 30) * HOUR));
        log(officerOf[d0.code], 'CLEARANCE_CLEARED', req._id, `${student.regNo} · ${d0.name}: ${first.remark}`, first.actionedAt);
        last = Math.max(last, first.actionedAt.getTime());
      }
      const touched = req.items.some((i) => i.status !== 'pending');
      req.status = touched ? 'in-progress' : 'pending';
      req.updatedAt = new Date(last);
    }
    requests.push(req);
    return req;
  };

  // Special demo students (their stories are written out in specials())
  await specials({ students, makeRequest, makeDue, deptByCode, officerOf, log, note });

  // Everyone else: a realistic mix of situations
  const rest = students.filter((s) => !s.special);
  let i = 0;
  for (const [scenario, count] of Object.entries(mix)) {
    for (let k = 0; k < count && i < rest.length; k += 1, i += 1) {
      await makeRequest(rest[i], scenario); // eslint-disable-line no-await-in-loop
    }
  }
  // A few students without a request but with an unpaid due (e.g. a library fine)
  rest.slice(i, i + 3).forEach((s) => makeDue(s, pick(['LIB', 'FIN']), created(int(3, 20))));

  // Registration events for the history
  students.forEach((s) => log(s, 'STUDENT_REGISTERED', s._id, s.regNo, s.createdAt));

  await ClearanceRequest.insertMany(requests, { timestamps: false });
  await Due.insertMany(dues, { timestamps: false });
  await Certificate.insertMany(certificates, { timestamps: false });
  if (files.length) await StoredFile.insertMany(files, { timestamps: false });
  await AuditLog.insertMany(logs, { timestamps: false });
  await Notification.insertMany(notes, { timestamps: false });

  return { uni, students, requests, dues, certificates, files };
}

(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set. Create server/.env first (see .env.example).');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Resetting the database...');
  const models = [University, User, Department, Due, EnrolledStudent, ClearanceRequest, Certificate, AuditLog, Notification, StoredFile];
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

  /* ---------- University of Ruhuna ---------- */
  const ruh = await buildUniversity({
    code: 'UOR',
    domain: 'ruh.ac.lk',
    fixedStudents: [
      { name: 'Kasun Perera', email: 'demo.kasun@ruh.ac.lk', regNo: 'EG/2021/4501', faculty: 'Engineering', special: 'kasun' },
      { name: 'Nimali Fernando', email: 'demo.nimali@ruh.ac.lk', regNo: 'EG/2021/4502', faculty: 'Engineering', special: 'nimali' },
      { name: 'Tharindu Senanayake', email: 'demo.tharindu@ruh.ac.lk', regNo: 'EG/2021/4510', faculty: 'Engineering', special: 'fresh' },
    ],
    randomStudents: 45,
    pendingOnList: [
      { name: 'Amal Silva', email: 'demo.amal@ruh.ac.lk', regNo: 'EG/2021/4519', faculty: 'Engineering' },
      { name: 'Dilini Jayasinghe', email: 'demo.dilini@ruh.ac.lk', regNo: 'SC/2021/1033', faculty: 'Science' },
    ],
    mix: { completed: 13, 'in-progress': 15, pending: 7, cancelled: 3 },
    specials: async ({ students, makeRequest }) => {
      const kasun = students.find((s) => s.special === 'kasun');
      const nimali = students.find((s) => s.special === 'nimali');
      // Kasun: halfway through, with an unpaid library fine – perfect for the live demo
      await makeRequest(kasun, 'in-progress', {
        start: ago(6 * DAY),
        reason: 'graduation',
        items: { LIB: 'dues', HOS: 'cleared', FIN: 'cleared', LAB: 'pending', SPO: 'cleared', SAF: 'pending' },
        dues: { LIB: ['Overdue book: Digital Signal Processing (12 days)', 450] },
      });
      // Nimali: fully cleared, certificate issued
      await makeRequest(nimali, 'completed', { start: ago(16 * DAY), reason: 'graduation' });
    },
  });

  /* ---------- University of Colombo (no hostel department) ----------
     Saman has the SAME registration number as Kasun: numbers only need to be unique inside one university. */
  const cmb = await buildUniversity({
    code: 'UOC',
    domain: 'cmb.ac.lk',
    skipDepts: ['HOS'],
    fixedStudents: [{ name: 'Saman Kumara', email: 'demo.saman@cmb.ac.lk', regNo: 'EG/2021/4501', faculty: 'Science', special: 'saman' }],
    randomStudents: 16,
    pendingOnList: [{ name: 'Ruwan Wijesinghe', email: 'demo.ruwan@cmb.ac.lk', regNo: 'SC/2021/2001', faculty: 'Science' }],
    mix: { completed: 5, 'in-progress': 6, pending: 3, cancelled: 1 },
    specials: async ({ students, makeRequest }) => {
      const saman = students.find((s) => s.special === 'saman');
      await makeRequest(saman, 'in-progress', { start: ago(3 * DAY), reason: 'transfer', items: { LIB: 'cleared', FIN: 'pending', LAB: 'cleared', SPO: 'pending', SAF: 'pending' } });
    },
  });

  const summary = (r) => `${r.students.length} students, ${r.requests.length} requests, ${r.dues.length} dues, ${r.certificates.length} certificates`;
  console.log(`Ruhuna:  ${summary(ruh)}`);
  console.log(`Colombo: ${summary(cmb)}`);

  console.log('\nSeed complete. All passwords:', PASSWORD);
  console.log('Platform admin: platform@clearpath.lk');
  console.log('Ruhuna  – admin demo.admin@ruh.ac.lk · officers demo.lib@ / demo.hos@ / demo.fin@ / demo.lab@ / demo.spo@ / demo.saf@ruh.ac.lk');
  console.log('          students demo.kasun@ruh.ac.lk (in progress, library fine), demo.nimali@ruh.ac.lk (certificate),');
  console.log('          demo.tharindu@ruh.ac.lk (no request yet – use him to show submitting a request)');
  console.log('          not registered yet: EG/2021/4519 + demo.amal@ruh.ac.lk');
  console.log('Colombo – admin demo.admin@cmb.ac.lk · officers demo.lib@cmb.ac.lk … · student demo.saman@cmb.ac.lk');
  console.log('          not registered yet: SC/2021/2001 + demo.ruwan@cmb.ac.lk');
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
