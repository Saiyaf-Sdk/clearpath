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

// Small, safe fixes run when needed.
// - Gives every university a portal address (slug) if missing.
// - Adds bundled logos and default faculties if missing.
const bootstrap = async () => {
  try {
    const missing = await University.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] }).lean();
    if (missing.length) {
      for (const u of missing) {
        const known = UNIVERSITIES.find((x) => x.code === u.code);
        await University.updateOne({ _id: u._id }, { slug: known?.slug || u.code.toLowerCase() });
      }
      console.log(`Added portal addresses for ${missing.length} universities.`);
    }

    // Only rebuild indexes if explicitly requested (e.g., during seed or manual migration)
    if (process.env.SYNC_INDEXES === 'true') {
      await Promise.all([University.syncIndexes(), Faculty.syncIndexes(), Department.syncIndexes()]);
    }

    // Quick check if faculties exist for universities that have none
    const uniWithoutFaculty = await University.findOne().select('_id slug').lean();
    if (uniWithoutFaculty && !(await Faculty.exists({ university: uniWithoutFaculty._id }))) {
      const unis = await University.find().select('slug').lean();
      let added = 0;
      for (const u of unis) {
        if (!FACULTIES[u.slug] || (await Faculty.exists({ university: u._id }))) continue;
        await Faculty.insertMany(FACULTIES[u.slug].map((f, i) => ({ ...f, order: i, university: u._id })));
        added += 1;
      }
      if (added) {
        const faculties = await Faculty.find().lean();
        const linked = (await linkByName(User, { role: 'student' }, faculties)) + (await linkByName(EnrolledStudent, {}, faculties));
        console.log(`Added faculties for ${added} universities${linked ? ` and linked ${linked} students to their faculty` : ''}.`);
      }
    }

    const logos = await applyBundledLogos();
    if (logos) console.log(`Applied bundled logos to ${logos} universities.`);
  } catch (err) {
    console.error('Startup check failed:', err.message);
  }
};

module.exports = bootstrap;
