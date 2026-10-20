// Fills the database with demo data. Run: npm run seed
// WARNING: deletes the whole ClearPath database first.
//
// Demo accounts use "demo." addresses at real university domains so the right portal opens.
// Keep SMTP empty while using them, so no email is ever sent to those addresses.
require('dotenv').config();
const mongoose = require('mongoose');
const University = require('./models/University');
const User = require('./models/User');
const Department = require('./models/Department');
const Due = require('./models/Due');
const EnrolledStudent = require('./models/EnrolledStudent');
const UNIVERSITIES = require('./data/universities');

const PASSWORD = 'password123';

const DEPARTMENTS = [
  { name: 'Library', code: 'LIB', description: 'Books and library fines', order: 1 },
  { name: 'Hostel', code: 'HOS', description: 'Room keys, damages, hostel fees', order: 2 },
  { name: 'Finance Division', code: 'FIN', description: 'Tuition and other fees', order: 3 },
  { name: 'Faculty Laboratories', code: 'LAB', description: 'Lab equipment and tools', order: 4 },
  { name: 'Sports Division', code: 'SPO', description: 'Sports equipment and kits', order: 5 },
  { name: 'Student Affairs', code: 'SAF', description: 'ID card return and disciplinary clearance', order: 6 },
];

// Sets up one demo university: departments, admin, officers, students and its official student list
async function demoUniversity(code, domain, { skipDepts = [], students, pending }) {
  const uni = await University.findOne({ code });
  const depts = await Department.insertMany(
    DEPARTMENTS.filter((d) => !skipDepts.includes(d.code)).map((d) => ({ ...d, university: uni._id }))
  );
  const byCode = Object.fromEntries(depts.map((d) => [d.code, d]));

  await User.create({ name: `${uni.shortName} Admin`, email: `demo.admin@${domain}`, password: PASSWORD, role: 'admin', university: uni._id });
  for (const d of depts) {
    await User.create({
      name: `${d.name} Officer`, email: `demo.${d.code.toLowerCase()}@${domain}`, password: PASSWORD,
      role: 'officer', university: uni._id, department: d._id,
    });
  }

  const created = [];
  for (const s of students) {
    await EnrolledStudent.create({ ...s, university: uni._id, status: 'activated', activatedAt: new Date() });
    created.push(await User.create({ ...s, password: PASSWORD, role: 'student', university: uni._id }));
  }
  await EnrolledStudent.insertMany(pending.map((p) => ({ ...p, university: uni._id })));
  return { uni, byCode, created };
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Resetting the database...');
  await mongoose.connection.dropDatabase(); // also removes old indexes
  await Promise.all([University, User, Department, Due, EnrolledStudent].map((m) => m.syncIndexes()));

  await University.insertMany(UNIVERSITIES);
  console.log(`Added ${UNIVERSITIES.length} universities.`);

  // Platform admin (manages universities, logos and university admins)
  await User.create({ name: 'ClearPath Platform Admin', email: 'platform@clearpath.lk', password: PASSWORD, role: 'superadmin' });

  // University of Ruhuna demo
  const ruh = await demoUniversity('UOR', 'ruh.ac.lk', {
    students: [
      { name: 'Kasun Perera', email: 'demo.kasun@ruh.ac.lk', regNo: 'EG/2021/4501', faculty: 'Engineering' },
      { name: 'Nimali Fernando', email: 'demo.nimali@ruh.ac.lk', regNo: 'EG/2021/4502', faculty: 'Engineering' },
    ],
    pending: [
      { name: 'Amal Silva', email: 'demo.amal@ruh.ac.lk', regNo: 'EG/2021/4519', faculty: 'Engineering' },
      { name: 'Dilini Jayasinghe', email: 'demo.dilini@ruh.ac.lk', regNo: 'SC/2021/1033', faculty: 'Science' },
    ],
  });
  await Due.create({
    student: ruh.created[0]._id, department: ruh.byCode.LIB._id, university: ruh.uni._id, amount: 450,
    description: 'Overdue book: Digital Signal Processing (12 days)',
  });

  // University of Colombo demo (no hostel department – each university sets up its own offices).
  // Saman has the SAME registration number as Kasun: numbers only need to be unique inside one university.
  await demoUniversity('UOC', 'cmb.ac.lk', {
    skipDepts: ['HOS'],
    students: [{ name: 'Saman Kumara', email: 'demo.saman@cmb.ac.lk', regNo: 'EG/2021/4501', faculty: 'Science' }],
    pending: [{ name: 'Ruwan Wijesinghe', email: 'demo.ruwan@cmb.ac.lk', regNo: 'SC/2021/2001', faculty: 'Science' }],
  });

  console.log('\nSeed complete. All passwords:', PASSWORD);
  console.log('Platform admin: platform@clearpath.lk');
  console.log('Ruhuna  – admin demo.admin@ruh.ac.lk · officers demo.lib@ / demo.hos@ / demo.fin@ / demo.lab@ / demo.spo@ / demo.saf@ruh.ac.lk');
  console.log('          students demo.kasun@ruh.ac.lk (library due), demo.nimali@ruh.ac.lk');
  console.log('          not registered yet: EG/2021/4519 demo.amal@ruh.ac.lk');
  console.log('Colombo – admin demo.admin@cmb.ac.lk · officers demo.lib@cmb.ac.lk … · student demo.saman@cmb.ac.lk');
  console.log('          not registered yet: SC/2021/2001 demo.ruwan@cmb.ac.lk');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
