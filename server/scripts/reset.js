// Clears ALL data from the ClearPath database for a real, fresh start.
//
//   npm run reset -- --yes                         wipe everything, keep the 17 universities + a platform admin
//   npm run reset -- --yes --email you@gmail.com --password "MyStrongPass1"
//   npm run reset -- --yes --empty                 wipe everything, leave the database completely empty
//
// Without --password a strong random password is generated and printed once.
// To get the demo data back later, run: npm run seed
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const University = require('../models/University');
const User = require('../models/User');
const Department = require('../models/Department');
const Due = require('../models/Due');
const EnrolledStudent = require('../models/EnrolledStudent');
const ClearanceRequest = require('../models/ClearanceRequest');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const StoredFile = require('../models/StoredFile');
const Faculty = require('../models/Faculty');
const FACULTIES = require('../data/faculties');
const UNIVERSITIES = require('../data/universities');
const { applyBundledLogos } = require('../utils/logos');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

(async () => {
  if (!flag('yes')) {
    console.log('This permanently deletes ALL ClearPath data (users, requests, dues, certificates, uploads).');
    console.log('Run it again with --yes to confirm:   npm run reset -- --yes');
    process.exit(1);
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in server/.env');

  const email = (value('email') || process.env.PLATFORM_ADMIN_EMAIL || 'platform@clearpath.lk').toLowerCase().trim();
  const password = value('password') || process.env.PLATFORM_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  if (password.length < 8) throw new Error('Use a password of at least 8 characters');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`Connected to database "${db.databaseName}". Deleting all data…`);

  const models = [University, Faculty, User, Department, Due, EnrolledStudent, ClearanceRequest, Certificate, AuditLog, Notification, StoredFile];
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  for (const name of existing) await db.collection(name).drop().catch(() => {}); // eslint-disable-line no-await-in-loop
  console.log(`Removed ${existing.length} collection(s).`);

  if (flag('empty')) {
    console.log('\nThe database is now completely empty. Nobody can log in until you run "npm run seed" or "npm run reset -- --yes".');
  } else {
    await Promise.all(models.map((m) => m.syncIndexes()));
    const unis = await University.insertMany(UNIVERSITIES);
    // every university starts with its faculties (no offices or people yet)
    await Faculty.insertMany(unis.flatMap((u) => (FACULTIES[u.slug] || []).map((f, i) => ({ ...f, order: i, university: u._id }))));
    await applyBundledLogos();
    await User.create({ name: 'ClearPath Platform Admin', email, password, role: 'superadmin' });
    console.log(`\nFresh start ready: ${UNIVERSITIES.length} universities with their faculties, no users except the platform admin.`);
    console.log('──────────────────────────────────────────────');
    console.log(` Platform admin email:    ${email}`);
    console.log(` Platform admin password: ${password}`);
    console.log('──────────────────────────────────────────────');
    console.log('Save this password now. Next steps:');
    console.log(' 1. Log in as the platform admin → Universities → open your university → add a university admin.');
    console.log(' 2. Log in as that admin → Departments (add offices) → Users & staff (add officers) → Official student list (import students).');
    console.log(' 3. Students create their own accounts with their registration number + university email.');
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(`Reset failed: ${err.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
