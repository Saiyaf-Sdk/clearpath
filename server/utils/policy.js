// Finds which university an email belongs to, from its domain.
// e.g. someone@ruh.ac.lk or someone@stu.ruh.ac.lk -> University of Ruhuna
const University = require('../models/University');

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
const publicUniversity = (u) =>
  u && { id: u._id, name: u.name, shortName: u.shortName || u.name, code: u.code, domains: u.domains, logoUrl: u.logoUrl || null, website: u.website };

// Show codes/links on screen only when no email is configured AND we are in local development
// (or DEMO_MODE=true is set explicitly for a project demonstration)
const devMode = () => !process.env.SMTP_HOST && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true');

const maskEmail = (email) => {
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
};

module.exports = { domainOf, universityForEmail, emailBelongsTo, publicUniversity, devMode, maskEmail };
