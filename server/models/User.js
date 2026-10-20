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
    role: { type: String, enum: ['student', 'officer', 'admin'], default: 'student' },

    // Student-only fields
    regNo: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
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

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
