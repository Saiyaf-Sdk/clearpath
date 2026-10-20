const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['student', 'officer', 'admin', 'superadmin'], default: 'student' },

    // Which university this account belongs to (empty only for the platform admin)
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', index: true },

    // Student-only fields
    regNo: { type: String, trim: true, uppercase: true },
    faculty: { type: String, trim: true },
    phone: { type: String, trim: true },

    // Officer-only field: which department they work for
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },

    isActive: { type: Boolean, default: true },

    // Password reset (only a SHA-256 hash of the emailed token is stored)
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: Date,
  },
  { timestamps: true }
);

// Hash the password whenever it changes
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// A registration number is unique inside one university (two universities may reuse the same number)
userSchema.index({ university: 1, regNo: 1 }, { unique: true, partialFilterExpression: { regNo: { $type: 'string' } } });

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
