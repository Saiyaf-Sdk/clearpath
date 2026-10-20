const crypto = require('crypto');
const User = require('../models/User');
const EnrolledStudent = require('../models/EnrolledStudent');
const { universityForEmail, publicUniversity, devMode, maskEmail } = require('../utils/policy');
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
  // The university portal this account belongs to (logo + name shown in the app)
  university: u.university && u.university.name ? publicUniversity(u.university) : undefined,
});

/* ---------------- Student registration (verified) ----------------
   1. /register/start    regNo + university email must match the official student list → emails a 6-digit code
   2. /register/verify   checks the code, returns the student's official name/faculty to confirm identity
   3. /register/complete code + password → creates the account (name/faculty come from the official list)
------------------------------------------------------------------- */
// The university is decided by the email domain, then the student must be on THAT university's list
const findEnrolled = async (regNo, email, withOtp = false) => {
  const university = await universityForEmail(email);
  if (!university) return { university: null, entry: null };
  const q = EnrolledStudent.findOne({ university: university._id, regNo: String(regNo || '').toUpperCase().trim() });
  if (withOtp) q.select('+otpHash');
  const entry = await q;
  if (!entry || entry.email !== String(email || '').toLowerCase().trim()) return { university, entry: null };
  return { university, entry };
};

const accountExists = (entry) =>
  User.exists({ $or: [{ email: entry.email }, { university: entry.university, regNo: entry.regNo }] });

const NOT_A_UNIVERSITY = "This email doesn't belong to a university on ClearPath. Please use your university email (for example name@ruh.ac.lk).";

const checkCode = async (regNo, email, code) => {
  const { university, entry } = await findEnrolled(regNo, email, true);
  if (!entry || !entry.otpHash) throw new ApiError(400, 'Please request a new verification code.');
  if (!entry.otpExpires || entry.otpExpires < new Date()) throw new ApiError(400, 'This code has expired. Please request a new one.');
  if (entry.otpAttempts >= 5) throw new ApiError(429, 'Too many incorrect attempts. Please request a new code.');
  if (sha256(String(code || '').trim()) !== entry.otpHash) {
    entry.otpAttempts += 1;
    await entry.save();
    throw new ApiError(400, `That code is not correct. ${Math.max(0, 5 - entry.otpAttempts)} attempt(s) left.`);
  }
  return { university, entry };
};

// POST /api/auth/register/start  body: { regNo, email }
exports.registerStart = asyncHandler(async (req, res) => {
  const { regNo, email } = req.body;
  if (!regNo || !email) throw new ApiError(400, 'Registration number and university email are required');
  const { university, entry } = await findEnrolled(regNo, email);
  if (!university) throw new ApiError(400, NOT_A_UNIVERSITY);
  if (!entry) {
    throw new ApiError(404, `We couldn't find this registration number with this email on the ${university.name} student list. Check both, or contact your Student Affairs office.`);
  }
  if (entry.status === 'activated' || (await accountExists(entry))) {
    throw new ApiError(409, 'An account already exists for this student. Please log in, or use Forgot password.');
  }
  if (entry.otpSentAt && Date.now() - entry.otpSentAt.getTime() < 30 * 1000) {
    throw new ApiError(429, 'Please wait 30 seconds before requesting another code.');
  }

  const code = String(crypto.randomInt(100000, 1000000));
  entry.otpHash = sha256(code);
  entry.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  entry.otpSentAt = new Date();
  entry.otpAttempts = 0;
  await entry.save();

  await sendMail(
    entry.email,
    `ClearPath: your verification code is ${code}`,
    `Hi ${entry.name},\n\nYour ClearPath verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't try to create an account, you can ignore this email.`
  );

  const out = {
    message: `We sent a 6-digit code to ${maskEmail(entry.email)}.`,
    maskedEmail: maskEmail(entry.email),
    university: publicUniversity(university),
  };
  if (devMode()) out.devCode = code; // local demo without email only
  res.json(out);
});

// POST /api/auth/register/verify  body: { regNo, email, code }
exports.registerVerify = asyncHandler(async (req, res) => {
  const { regNo, email, code } = req.body;
  const { university, entry } = await checkCode(regNo, email, code);
  res.json({ name: entry.name, faculty: entry.faculty, regNo: entry.regNo, university: publicUniversity(university) });
});

// POST /api/auth/register/complete  body: { regNo, email, code, password, phone }
exports.registerComplete = asyncHandler(async (req, res) => {
  const { regNo, email, code, password, phone } = req.body;
  if (!password || password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
  const { university, entry } = await checkCode(regNo, email, code);
  if (await accountExists(entry)) throw new ApiError(409, 'An account already exists for this student. Please log in.');

  const user = await User.create({
    name: entry.name,
    email: entry.email,
    password,
    regNo: entry.regNo,
    faculty: entry.faculty,
    phone,
    role: 'student',
    university: university._id,
  });
  user.university = university; // so the response carries the logo and name

  entry.status = 'activated';
  entry.activatedAt = new Date();
  entry.user = user._id;
  entry.otpHash = undefined;
  entry.otpExpires = undefined;
  await entry.save();
  await audit(user, 'STUDENT_REGISTERED', user._id, entry.regNo);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+password')
    .populate('department', 'name code')
    .populate('university');
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled');
  if (user.role !== 'superadmin' && user.university && !user.university.isActive) {
    throw new ApiError(403, 'Your university is not active on ClearPath yet');
  }

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
    if (devMode()) response.devResetUrl = url;
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
