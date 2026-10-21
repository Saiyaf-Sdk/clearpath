const University = require('../models/University');
const UNIVERSITIES = require('../data/universities');
const { applyBundledLogos } = require('./logos');

// Small, safe fixes run every time the server starts (idempotent).
// - Gives every university a portal address (slug), e.g. databases seeded before portals existed.
// - Gives universities without an uploaded logo their bundled logo (server/data/logos).
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
    const logos = await applyBundledLogos();
    if (logos) console.log(`Applied bundled logos to ${logos} universities.`);
  } catch (err) {
    console.error('Startup check failed:', err.message);
  }
};

module.exports = bootstrap;
