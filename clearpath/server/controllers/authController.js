const User = require('../models/User');
const { asyncHandler, ApiError } = require('../middleware/error');
const { signToken } = require('../utils/helpers');

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
