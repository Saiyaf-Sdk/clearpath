const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true }, // the officer's department, if any
    action: { type: String, required: true }, // e.g. CLEARANCE_CLEARED, DUE_ADDED
    target: { type: String }, // id of the affected record
    details: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
