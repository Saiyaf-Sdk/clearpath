const fs = require('fs');
const path = require('path');
const University = require('../models/University');

// Official university logos shipped with the project: server/data/logos/<portal>.<ext>
// e.g. data/logos/ruhuna.png. They are served at /api/logos/<file> and applied to every
// university that has no uploaded logo, so a fresh install (or a reseed) shows them straight away.
const LOGO_DIR = path.join(__dirname, '..', 'data', 'logos');
const LOGO_PREFIX = '/api/logos/';
const EXT_ORDER = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

// The bundled file for a portal slug, or null
const bundledFor = (slug) => {
  if (!slug) return null;
  for (const ext of EXT_ORDER) {
    const file = `${slug}${ext}`;
    if (fs.existsSync(path.join(LOGO_DIR, file))) return file;
  }
  return null;
};

const isBundled = (url) => typeof url === 'string' && url.startsWith(LOGO_PREFIX);

// Reads a bundled logo by URL (used for the PDF certificate)
const readBundled = (url) => {
  if (!isBundled(url)) return null;
  const name = path.basename(url.slice(LOGO_PREFIX.length));
  const file = path.join(LOGO_DIR, name);
  if (!fs.existsSync(file)) return null;
  return { buffer: fs.readFileSync(file), contentType: TYPES[path.extname(name).toLowerCase()] || '' };
};

// Gives every university without an uploaded logo its bundled logo (idempotent).
// Uploaded logos (/api/files/...) are never replaced.
const applyBundledLogos = async () => {
  if (!fs.existsSync(LOGO_DIR)) return 0;
  const unis = await University.find({}, 'slug logoUrl');
  let changed = 0;
  for (const u of unis) {
    if (u.logoUrl && !isBundled(u.logoUrl)) continue; // keep an uploaded logo
    const file = bundledFor(u.slug);
    const want = file ? `${LOGO_PREFIX}${file}` : undefined;
    if ((u.logoUrl || undefined) !== want) {
      await University.updateOne({ _id: u._id }, want ? { $set: { logoUrl: want } } : { $unset: { logoUrl: 1 } }); // eslint-disable-line no-await-in-loop
      changed += 1;
    }
  }
  return changed;
};

module.exports = { LOGO_DIR, LOGO_PREFIX, TYPES, bundledFor, isBundled, readBundled, applyBundledLogos };
