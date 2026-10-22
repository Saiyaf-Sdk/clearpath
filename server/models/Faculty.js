const mongoose = require('mongoose');

// A faculty of a university (e.g. Faculty of Engineering, University of Ruhuna – Hapugala, Galle).
// Students, faculty admins and faculty offices belong to one faculty. Offices with no faculty are
// the university's central offices (main library, bursar, student affairs …).
const facultySchema = new mongoose.Schema(
  {
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', required: true, index: true },
    name: { type: String, required: [true, 'Faculty name is required'], trim: true },
    code: { type: String, required: [true, 'Code is required'], uppercase: true, trim: true, maxlength: 6 },
    // The faculty's part of the portal address, e.g. /portal/ruhuna/engineering
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens only'],
    },
    location: { type: String, trim: true }, // town or campus, e.g. "Hapugala, Galle"
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

facultySchema.index({ university: 1, slug: 1 }, { unique: true });
facultySchema.index({ university: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Faculty', facultySchema);
