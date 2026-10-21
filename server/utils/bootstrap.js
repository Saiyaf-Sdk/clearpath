const University = require('../models/University');
const UNIVERSITIES = require('../data/universities');

// Small, safe fixes run every time the server starts (idempotent).
// - Gives every university a portal address (slug), e.g. databases seeded before portals existed.
const bootstrap = async () => {
  try {
    const missing = await University.find({ $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }] });
    for (const u of missing) {
      const known = UNIVERSITIES.find((x) => x.code === u.code);
      u.slug = known?.slug || u.code.toLowerCase();
      await u.save(); // eslint-disable-line no-await-in-loop
    }
    if (missing.length) console.log(`Added portal addresses for ${missing.length} universities.`);
    await University.syncIndexes();
  } catch (err) {
    console.error('Startup check failed:', err.message);
  }
};

module.exports = bootstrap;
