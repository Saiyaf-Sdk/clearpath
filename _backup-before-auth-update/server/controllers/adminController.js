const User = require('../models/User');
const Department = require('../models/Department');
const ClearanceRequest = require('../models/ClearanceRequest');
const Due = require('../models/Due');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const { asyncHandler, ApiError } = require('../middleware/error');
const { audit } = require('../utils/helpers');

/* ---------- Departments ---------- */

// GET /api/departments  (any logged-in user)
exports.listDepartments = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { isActive: true };
  res.json(await Department.find(filter).sort('order name'));
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  await audit(req.user, 'DEPARTMENT_CREATED', dept._id, dept.name);
  res.status(201).json(dept);
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!dept) throw new ApiError(404, 'Department not found');
  await audit(req.user, 'DEPARTMENT_UPDATED', dept._id, dept.name);
  res.json(dept);
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const used = await ClearanceRequest.exists({ 'items.department': req.params.id });
  if (used) throw new ApiError(400, 'Department is used in clearance requests. Deactivate it instead.');
  const dept = await Department.findByIdAndDelete(req.params.id);
  if (!dept) throw new ApiError(404, 'Department not found');
  await audit(req.user, 'DEPARTMENT_DELETED', dept._id, dept.name);
  res.json({ message: 'Department deleted' });
});

/* ---------- Users ---------- */

// GET /api/admin/users?role=student&search=abc
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { regNo: rx }];
  }
  const users = await User.find(filter).populate('department', 'name code').sort('role name');
  res.json(users);
});

// POST /api/admin/users  (create officer / admin / student)
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, regNo, faculty } = req.body;
  if (!name || !email || !password || !role) throw new ApiError(400, 'Name, email, password and role are required');
  if (role === 'officer' && !department) throw new ApiError(400, 'Officers must be assigned a department');
  const user = await User.create({
    name, email, password, role,
    department: role === 'officer' ? department : undefined,
    regNo: role === 'student' ? regNo : undefined,
    faculty: role === 'student' ? faculty : undefined,
  });
  await audit(req.user, 'USER_CREATED', user._id, `${role}: ${email}`);
  res.status(201).json(await user.populate('department', 'name code'));
});

// PATCH /api/admin/users/:id
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  ['name', 'email', 'role', 'department', 'regNo', 'faculty', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f] === '' ? undefined : req.body[f];
  });
  if (req.body.password) user.password = req.body.password;
  if (String(user._id) === String(req.user._id) && user.isActive === false) {
    throw new ApiError(400, 'You cannot disable your own account');
  }
  await user.save();
  await audit(req.user, 'USER_UPDATED', user._id, user.email);
  res.json(await user.populate('department', 'name code'));
});

// DELETE /api/admin/users/:id
exports.deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete yourself');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await audit(req.user, 'USER_DELETED', user._id, user.email);
  res.json({ message: 'User deleted' });
});

/* ---------- Requests overview ---------- */

// GET /api/admin/requests?status=in-progress
exports.listRequests = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const requests = await ClearanceRequest.find(filter)
    .populate('student', 'name regNo email faculty')
    .populate('items.department', 'name code order')
    .sort('-createdAt')
    .limit(200);
  res.json(requests);
});

// PATCH /api/admin/requests/:id/items/:deptId  -> admin override handled by clearance controller

/* ---------- Reports ---------- */

// GET /api/admin/reports
exports.reports = asyncHandler(async (req, res) => {
  const [byStatus, students, officers, certificates, dueAgg, departments, completed] = await Promise.all([
    ClearanceRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'officer' }),
    Certificate.countDocuments(),
    Due.aggregate([{ $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Department.find({ isActive: true }).sort('order name').lean(),
    ClearanceRequest.find({ status: 'completed', completedAt: { $exists: true } }).select('createdAt completedAt').lean(),
  ]);

  // Pending / dues items per department (shows bottlenecks)
  const perDept = await ClearanceRequest.aggregate([
    { $match: { status: { $in: ['pending', 'in-progress'] } } },
    { $unwind: '$items' },
    { $group: { _id: { dept: '$items.department', status: '$items.status' }, count: { $sum: 1 } } },
  ]);
  const departmentLoad = departments.map((d) => {
    const get = (s) => perDept.find((p) => String(p._id.dept) === String(d._id) && p._id.status === s)?.count || 0;
    return { department: d.name, pending: get('pending'), dues: get('dues'), cleared: get('cleared') };
  });

  const avgDays = completed.length
    ? completed.reduce((sum, r) => sum + (new Date(r.completedAt) - new Date(r.createdAt)) / 864e5, 0) / completed.length
    : 0;

  const statusCounts = { pending: 0, 'in-progress': 0, completed: 0, cancelled: 0 };
  byStatus.forEach((s) => { statusCounts[s._id] = s.count; });
  const dueTotals = {};
  dueAgg.forEach((d) => { dueTotals[d._id] = { total: d.total, count: d.count }; });

  res.json({
    totals: { students, officers, certificates, requests: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
    statusCounts,
    dueTotals,
    departmentLoad,
    avgClearanceDays: Math.round(avgDays * 10) / 10,
  });
});

// GET /api/admin/audit
exports.auditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find().populate('actor', 'name role').sort('-createdAt').limit(100);
  res.json(logs);
});
