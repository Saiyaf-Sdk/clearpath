const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], trim: true },
    code: { type: String, required: [true, 'Code is required'], uppercase: true, trim: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', index: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 }, // display order on the tracker
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Names/codes only need to be unique inside one university
departmentSchema.index({ university: 1, code: 1 }, { unique: true });
departmentSchema.index({ university: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
