const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], unique: true, trim: true },
    code: { type: String, required: [true, 'Code is required'], unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 }, // display order on the tracker
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
