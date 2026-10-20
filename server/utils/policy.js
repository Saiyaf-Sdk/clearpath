// University-specific rules, configured in server/.env

const universityName = () => process.env.UNIVERSITY_NAME || 'ClearPath University';

// e.g. ALLOWED_EMAIL_DOMAINS=student.fortuna.ac.lk,fortuna.ac.lk  (empty = any domain, the student list still applies)
const allowedDomains = () =>
  (process.env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

const emailAllowed = (email) => {
  const list = allowedDomains();
  if (!list.length) return true;
  const domain = String(email || '').toLowerCase().split('@')[1];
  return !!domain && list.some((d) => domain === d || domain.endsWith(`.${d}`));
};

const domainHint = () => allowedDomains().map((d) => `@${d}`).join(' or ');

// Show codes/links on screen only in local development without email configured
const devMode = () => process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST;

const maskEmail = (email) => {
  const [user, domain] = String(email).split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`;
};

module.exports = { universityName, allowedDomains, emailAllowed, domainHint, devMode, maskEmail };
