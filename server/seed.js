// Fills the database with demo data. Run: npm run seed
// WARNING: deletes all existing ClearPath data first.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Department = require('./models/Department');
const ClearanceRequest = require('./models/ClearanceRequest');
const Due = require('./models/Due');
const Certificate = require('./models/Certificate');
const AuditLog = require('./models/AuditLog');

const PASSWORD = 'password123';

const departments = [
  { name: 'Library', code: 'LIB', description: 'Books and library fines', order: 1 },
  { name: 'Hostel', code: 'HOS', description: 'Room keys, damages, hostel fees', order: 2 },
  { name: 'Finance Division', code: 'FIN', description: 'Tuition and other fees', order: 3 },
  { name: 'Faculty Laboratories', code: 'LAB', description: 'Lab equipment and tools', order: 4 },
  { name: 'Sports Division', code: 'SPO', description: 'Sports equipment and kits', order: 5 },
  { name: 'Student Affairs', code: 'SAF', description: 'ID card return and disciplinary clearance', order: 6 },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Clearing old data...');
  await Promise.all([User, Department, ClearanceRequest, Due, Certificate, AuditLog].map((m) => m.deleteMany({})));

  const depts = await Department.insertMany(departments);
  const byCode = Object.fromEntries(depts.map((d) => [d.code, d]));

  // .create() (not insertMany) so the password hashing hook runs
  await User.create({ name: 'System Admin', email: 'admin@clearpath.lk', password: PASSWORD, role: 'admin' });

  const officerData = [
    ['Library Officer', 'library@clearpath.lk', 'LIB'],
    ['Hostel Warden', 'hostel@clearpath.lk', 'HOS'],
    ['Finance Officer', 'finance@clearpath.lk', 'FIN'],
    ['Lab In-charge', 'lab@clearpath.lk', 'LAB'],
    ['Sports Officer', 'sports@clearpath.lk', 'SPO'],
    ['Student Affairs Officer', 'affairs@clearpath.lk', 'SAF'],
  ];
  for (const [name, email, code] of officerData) {
    await User.create({ name, email, password: PASSWORD, role: 'officer', department: byCode[code]._id });
  }

  const s1 = await User.create({
    name: 'Kasun Perera', email: 'kasun@student.lk', password: PASSWORD, role: 'student',
    regNo: 'EG/2021/4501', faculty: 'Engineering',
  });
  await User.create({
    name: 'Nimali Fernando', email: 'nimali@student.lk', password: PASSWORD, role: 'student',
    regNo: 'EG/2021/4502', faculty: 'Engineering',
  });

  // Kasun owes the library money, so his Library item will start as "dues"
  await Due.create({
    student: s1._id, department: byCode.LIB._id, amount: 450,
    description: 'Overdue book: Digital Signal Processing (12 days)',
  });

  console.log('\nSeed complete. All passwords:', PASSWORD);
  console.log('Admin:    admin@clearpath.lk');
  console.log('Officers: library@ / hostel@ / finance@ / lab@ / sports@ / affairs@clearpath.lk');
  console.log('Students: kasun@student.lk (has a library due), nimali@student.lk (no dues)');
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
