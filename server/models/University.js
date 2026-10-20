const mongoose = require('mongoose');

// One record per university on the platform. Everything else (users, departments,
// requests, dues, certificates, the student list) belongs to exactly one university.
const universitySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'University name is required'], unique: true, trim: true },
    shortName: { type: String, trim: true }, // shown in the top bar, e.g. "University of Ruhuna"
    code: { type: String, required: [true, 'Code is required'], unique: true, uppercase: true, trim: true }, // e.g. UOR
    // Email domains that belong to this university. Sub-domains match too
    // (ruh.ac.lk also covers stu.ruh.ac.lk, eng.ruh.ac.lk …)
    domains: { type: [String], default: [], set: (v) => (v || []).map((d) => String(d).toLowerCase().trim().replace(/^@/, '')).filter(Boolean) },
    website: { type: String, trim: true },
    logoUrl: { type: String }, // uploaded by the platform admin (official logo file from the university)
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

universitySchema.index({ domains: 1 });

module.exports = mongoose.model('University', universitySchema);
