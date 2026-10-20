const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');
const Certificate = require('../models/Certificate');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Never let logging failures break a request
const audit = async (actor, action, target, details) => {
  try {
    await AuditLog.create({ actor: actor?._id || actor, action, target: String(target || ''), details });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
};

// Create the certificate for a completed request (only once)
const issueCertificate = async (request) => {
  const existing = await Certificate.findOne({ request: request._id });
  if (existing) return existing;
  const year = new Date().getFullYear();
  const certificateNo = `CP-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  return Certificate.create({ request: request._id, student: request.student._id || request.student, certificateNo });
};

module.exports = { signToken, audit, issueCertificate };
