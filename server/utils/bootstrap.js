const University = require('../models/University');
const Faculty = require('../models/Faculty');
const Department = require('../models/Department');
const User = require('../models/User');
const EnrolledStudent = require('../models/EnrolledStudent');
const ClearanceRequest = require('../models/ClearanceRequest');
const Due = require('../models/Due');
const UNIVERSITIES = require('../data/universities');
const FACULTIES = require('../data/faculties');
const { applyBundledLogos } = require('./logos');

// Links students / list entries that only have a faculty name (older data) to the matching faculty
const linkByName = async (Model, filter, faculties) => {
  const rows = await Model.find({ ...filter, facultyId: { $exists: false }, faculty: { $nin: [null, ''] } }).select('faculty university').lean();
  let n = 0;
  for (const r of rows) {
    const v = String(r.faculty).toLowerCase().replace(/^faculty of\s+/, '');
    const f = faculties.find((x) => String(x.university) === String(r.university) && x.name.toLowerCase().replace(/^faculty of\s+/, '').startsWith(v));
    if (f) {
      await Model.updateOne({ _id: r._id }, { facultyId: f._id, faculty: f.name }); // eslint-disable-line no-await-in-loop
      n += 1;
    }
  }
  return n;
};

// Small, safe fixes run every time the server starts (idempotent).
// - Gives every university a portal address (slug), e.g. databases seeded before portals existed.
// - Gives universities without an uploaded logo their bundled logo (server/data/logos).
// - Adds the faculties of universities that have none yet, and updates indexes (offices are unique per faculty).
const bootstrap = async () => {
  try {
    const missing = await University.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
    for (const u of missing) {
      const known = UNIVERSITIES.find((x) => x.code === u.code);
      u.slug = known?.slug || u.code.toLowerCase();
      await u.save(); // eslint-disable-line no-await-in-loop
    }
    if (missing.length) console.log(`Added portal addresses for ${missing.length} universities.`);
    await Promise.all([University.syncIndexes(), Faculty.syncIndexes(), Department.syncIndexes()]);

    // Faculties for universities that have none (databases from before faculty portals)
    const unis = await University.find().select('slug').lean();
    let added = 0;
    for (const u of unis) {
      if (!FACULTIES[u.slug] || (await Faculty.exists({ university: u._id }))) continue; // eslint-disable-line no-await-in-loop
      await Faculty.insertMany(FACULTIES[u.slug].map((f, i) => ({ ...f, order: i, university: u._id }))); // eslint-disable-line no-await-in-loop
      added += 1;
    }
    if (added) {
      const faculties = await Faculty.find().lean();
      const linked = (await linkByName(User, { role: 'student' }, faculties)) + (await linkByName(EnrolledStudent, {}, faculties));
      console.log(`Added faculties for ${added} universities${linked ? ` and linked ${linked} students to their faculty` : ''}. Run "npm run seed" for the full faculty demo data.`);
    }

    // Requests and dues from before faculties take the student's faculty (so faculty admins see them)
    for (const Model of [ClearanceRequest, Due]) {
      const rows = await Model.find({ faculty: { $exists: false } }).select('student').populate('student', 'facultyId').lean(); // eslint-disable-line no-await-in-loop
      const ops = rows.filter((r) => r.student?.facultyId).map((r) => ({ updateOne: { filter: { _id: r._id }, update: { faculty: r.student.facultyId } } }));
      if (ops.length) await Model.bulkWrite(ops); // eslint-disable-line no-await-in-loop
    }

    const logos = await applyBundledLogos();
    if (logos) console.log(`Applied bundled logos to ${logos} universities.`);
  } catch (err) {
    console.error('Startup check failed:', err.message);
  }
};

module.exports = bootstrap;
