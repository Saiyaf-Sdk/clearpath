// Finds which university an email belongs to, from its domain.
// e.g. someone@ruh.ac.lk or someone@stu.ruh.ac.lk -> University of Ruhuna
const University = require('../models/University');
const Faculty = require('../models/Faculty');
const { emailEnabled } = require('./mailer');

const domainOf = (email) => String(email || '').toLowerCase().trim().split('@')[1] || '';

// "stu.eng.ruh.ac.lk" -> ["stu.eng.ruh.ac.lk", "eng.ruh.ac.lk", "ruh.ac.lk", "ac.lk"]
const candidates = (domain) => {
  const parts = domain.split('.');
  const list = [];
  for (let i = 0; i < parts.length - 1; i += 1) list.push(parts.slice(i).join('.'));
  return list;
};

const universityForEmail = async (email) => {
  const domain = domainOf(email);
  if (!domain) return null;
  return University.findOne({ domains: { $in: candidates(domain) }, isActive: true });
};

const emailBelongsTo = (email, university) => {
  const domain = domainOf(email);
  return !!university && candidates(domain).some((d) => university.domains.includes(d));
};

// Public shape sent to the browser (logo, names) – never internal fields
const slugOf = (u) => u?.slug || String(u?.code || '').toLowerCase();
const publicUniversity = (u) =>
  u && { id: u._id, name: u.name, shortName: u.shortName || u.name, code: u.code, slug: slugOf(u), domains: u.domains, logoUrl: u.logoUrl || null, website: u.website };

// The university whose portal is open: matched by portal address (slug) or code, e.g. "ruhuna" or "UOR"
const RESERVED = ['platform', 'admin', 'login', 'register'];
const universityForPortal = async (portal) => {
  const v = String(portal || '').toLowerCase().trim();
  if (!v || RESERVED.includes(v)) return null;
  return University.findOne({ $or: [{ slug: v }, { code: v.toUpperCase() }] });
};

// Faculty portals: /portal/<university>/<faculty>. "central" is the university's central administration
// (the university admin and the central offices such as the main library and the bursar).
const CENTRAL = 'central';
const FACULTY_RESERVED = [CENTRAL, 'register', 'login'];
const publicFaculty = (f) => f && f.name && { id: f._id, name: f.name, code: f.code, slug: f.slug, location: f.location || null };
// Returns { central: true } for the central administration, { faculty } for a faculty, or null when not found
const facultyForPortal = async (universityId, slug) => {
  const v = String(slug || '').toLowerCase().trim();
  if (!v) return null;
  if (v === CENTRAL) return { central: true, faculty: null };
  const faculty = await Faculty.findOne({ university: universityId, slug: v, isActive: true });
  return faculty ? { central: false, faculty } : null;
};

// Show codes/links on screen only when no email is configured AND we are in local development
// (or DEMO_MODE=true is set explicitly for a project demonstration)
const devMode = () => !emailEnabled() && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true');

const maskEmail = (email) => {
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
};

module.exports = { domainOf, universityForEmail, universityForPortal, emailBelongsTo, publicUniversity, slugOf, devMode, maskEmail, RESERVED, CENTRAL, FACULTY_RESERVED, publicFaculty, facultyForPortal };
