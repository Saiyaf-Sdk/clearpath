const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { asyncHandler, ApiError } = require('./error');

// Requires a valid "Authorization: Bearer <token>" header
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new ApiError(401, 'Not logged in');

  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Session expired, please log in again');
  }

  const user = await User.findById(decoded.id).populate('department', 'name code faculty').populate('university').populate('facultyId', 'name code slug location isActive');
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled');
  if (user.role !== 'superadmin' && user.university && !user.university.isActive) {
    throw new ApiError(403, 'Your university is not active on ClearPath');
  }
  req.user = user;
  next();
});

// Restricts a route to the given roles, e.g. authorize('admin')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission for this action'));
  }
  next();
};

module.exports = { protect, authorize };

// The university id of the signed-in user – every query is limited to it
const uniOf = (req) => req.user.university?._id || req.user.university;

module.exports.uniOf = uniOf;

// The faculty id of the signed-in user (students, faculty admins, faculty officers); null for university-level staff
const facOf = (req) => req.user.facultyId?._id || req.user.facultyId || null;
module.exports.facOf = facOf;

// Extra filter that limits a faculty admin to their own faculty; university admins see the whole university.
// field: the faculty field of the collection being queried ('faculty' or 'facultyId')
const facultyScope = (req, field = 'faculty') => (req.user.role === 'facultyadmin' ? { [field]: facOf(req) } : {});
module.exports.facultyScope = facultyScope;
