const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ClearanceRequest', required: true, unique: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', index: true },
    certificateNo: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: Date.now },
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certificate', certificateSchema);
