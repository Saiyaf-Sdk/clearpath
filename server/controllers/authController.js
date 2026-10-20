const crypto = require('crypto');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/error');
const { signToken, audit } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();

const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  regNo: u.regNo,
  faculty: u.faculty,
  phone: u.phone,
  department: u.department,
});

// POST /api/auth/register  (students only - officers/admins are created by admin)
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, regNo, faculty, phone } = req.body;
  if (!name || !email || !password || !regNo || !faculty) {
    throw new ApiError(400, 'Name, email, password, registration number and faculty are required');
  }
  if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

  const user = await User.create({ name, email, password, regNo, faculty, phone, role: 'student' });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password')
    .populate('department', 'name code');
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled');

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PATCH /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(currentPassword || ''))) throw new ApiError(400, 'Current password is incorrect');
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
});

// POST /api/auth/forgot-password  body: { email }
// Always answers the same way, so nobody can find out which emails have accounts.
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, 'Email is required');

  const response = { message: 'If an account exists for this email, we have sent a password reset link.' };
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });

  if (user && user.isActive) {
    const raw = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = sha256(raw);
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    const url = `${clientUrl()}/reset-password/${raw}`;
    await sendMail(
      user.email,
      'ClearPath: Reset your password',
      `Hi ${user.name},\n\nWe received a request to reset your ClearPath password.\nUse this link within 15 minutes to choose a new one:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`
    );
    await audit(user, 'PASSWORD_RESET_REQUESTED', user._id);

    // Without email set up (local demo), return the link so the flow can still be shown
    if (process.env.NODE_ENV !== 'production' && !process.env.SMTP_HOST) response.devResetUrl = url;
  }
  res.json(response);
});

// GET /api/auth/reset-password/:token  -> is the link still valid?
exports.checkResetToken = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetPasswordToken: sha256(req.params.token), resetPasswordExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired.');
  res.json({ valid: true, email: user.email });
});

// POST /api/auth/reset-password/:token  body: { password }
exports.resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

  const user = await User.findOne({ resetPasswordToken: sha256(req.params.token), resetPasswordExpires: { $gt: new Date() } });
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired. Please request a new one.');

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  await audit(user, 'PASSWORD_RESET_COMPLETED', user._id);
  await sendMail(user.email, 'ClearPath: Your password was changed', `Hi ${user.name},\n\nYour ClearPath password was just changed. If this wasn't you, contact the administrator immediately.`);
  res.json({ message: 'Your password has been updated. You can now log in.' });
});
