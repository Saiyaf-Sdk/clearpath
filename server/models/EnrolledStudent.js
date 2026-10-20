const mongoose = require('mongoose');

// The university's official student list (imported by the admin from the registrar's records).
// A student can only create a ClearPath account if their registration number + university email are on this list.
const enrolledStudentSchema = new mongoose.Schema(
  {
    regNo: { type: String, required: [true, 'Registration number is required'], unique: true, uppercase: true, trim: true },
    email: { type: String, required: [true, 'Email is required'], lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    faculty: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'activated'], default: 'pending' },
    activatedAt: Date,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // One-time email verification code (only a hash is stored)
    otpHash: { type: String, select: false },
    otpExpires: Date,
    otpSentAt: Date,
    otpAttempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

enrolledStudentSchema.index({ email: 1 });

module.exports = mongoose.model('EnrolledStudent', enrolledStudentSchema);
