const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const idOf = (v) => v?._id || v;

// Never let logging failures break a request
const audit = async (actor, action, target, details) => {
  try {
    await AuditLog.create({
      actor: idOf(actor),
      university: idOf(actor?.university),
      department: idOf(actor?.department),
      action,
      target: String(target || ''),
      details,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

// In-app notification for one or more users (never throws)
const notify = async (users, { title, body, link, kind = 'info', university }) => {
  try {
    const list = (Array.isArray(users) ? users : [users]).map(idOf).filter(Boolean);
    if (!list.length) return;
    await Notification.insertMany(list.map((user) => ({ user, title, body, link, kind, university: idOf(university) })));
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
};

// Notify every active officer of the given department(s)
const notifyOfficers = async (departmentIds, payload) => {
  try {
    const ids = (Array.isArray(departmentIds) ? departmentIds : [departmentIds]).map(idOf);
    const officers = await User.find({ role: 'officer', isActive: true, department: { $in: ids } }).select('_id');
    await notify(officers, payload);
  } catch (err) {
    console.error('Notification failed:', err.message);
  }
};

// Create the certificate for a completed request (only once)
// Certificate numbers carry the university code, e.g. CP-UOR-2026-8F3A21C9
const issueCertificate = async (request, universityCode = '') => {
  const existing = await Certificate.findOne({ request: request._id });
  if (existing) return existing;
  const year = new Date().getFullYear();
  const prefix = universityCode ? `CP-${universityCode}-` : 'CP-';
  const certificateNo = `${prefix}${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  try {
    return await Certificate.create({
      request: request._id,
      student: idOf(request.student),
      university: request.university,
      certificateNo,
    });
  } catch (err) {
    // Issued at the same moment by another request – use that one
    if (err.code === 11000) return Certificate.findOne({ request: request._id });
    throw err;
  }
};

// Public address of the web app (used in emails and on the certificate QR code).
// CLIENT_URL wins; when the API also serves the React app, the request's own address is used.
const appUrl = (req) => {
  const fromEnv = (process.env.CLIENT_URL || '').split(',')[0].trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (req) return `${req.protocol}://${req.get('host')}`;
  return 'http://localhost:5173';
};

const escapeRx = (v = '') => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { signToken, audit, notify, notifyOfficers, issueCertificate, appUrl, escapeRx };
