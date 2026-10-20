const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const ClearanceRequest = require('../models/ClearanceRequest');
const Due = require('../models/Due');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const EnrolledStudent = require('../models/EnrolledStudent');
const { emailBelongsTo } = require('../utils/policy');
const { asyncHandler, ApiError } = require('../middleware/error');
const { uniOf } = require('../middleware/auth');
const { audit, escapeRx } = require('../utils/helpers');

const TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';
const DAY = 864e5;
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const dayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

// Every query in this file is limited to the signed-in admin's university.

/* ---------- Departments ---------- */

// GET /api/departments  (any logged-in user – only their own university)
exports.listDepartments = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req) };
  if (req.user.role !== 'admin') filter.isActive = true;
  res.json(await Department.find(filter).sort('order name'));
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, order, isActive } = req.body;
  const dept = await Department.create({ name, code, description, order, isActive, university: uniOf(req) });
  await audit(req.user, 'DEPARTMENT_CREATED', dept._id, dept.name);
  res.status(201).json(dept);
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, order, isActive } = req.body;
  const dept = await Department.findOneAndUpdate(
    { _id: req.params.id, university: uniOf(req) },
    { name, code, description, order, isActive },
    { new: true, runValidators: true }
  );
  if (!dept) throw new ApiError(404, 'Department not found');
  await audit(req.user, 'DEPARTMENT_UPDATED', dept._id, dept.name);
  res.json(dept);
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!dept) throw new ApiError(404, 'Department not found');
  const used = (await ClearanceRequest.exists({ 'items.department': dept._id })) || (await Due.exists({ department: dept._id })) || (await User.exists({ department: dept._id }));
  if (used) throw new ApiError(400, 'This department has requests, dues or officers. Deactivate it instead, so the history is kept.');
  await dept.deleteOne();
  await audit(req.user, 'DEPARTMENT_DELETED', dept._id, dept.name);
  res.json({ message: 'Department deleted' });
});

/* ---------- Users ---------- */

// GET /api/admin/users?role=student&search=abc
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req) };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const rx = new RegExp(escapeRx(req.query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { regNo: rx }];
  }
  if (req.query.department) filter.department = req.query.department;
  const users = await User.find(filter).populate('department', 'name code').sort('role name').limit(1000);
  res.json(users);
});

// POST /api/admin/users  (create officer / admin / student in this university)
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, regNo, faculty } = req.body;
  if (!name || !email || !password || !role) throw new ApiError(400, 'Name, email, password and role are required');
  if (!['student', 'officer', 'admin'].includes(role)) throw new ApiError(400, 'Invalid role');
  if (!emailBelongsTo(email, req.user.university)) {
    throw new ApiError(400, `Use a ${req.user.university.name} email (${req.user.university.domains.map((d) => '@' + d).join(' or ')}).`);
  }
  if (role === 'officer') {
    if (!department) throw new ApiError(400, 'Officers must be assigned a department');
    if (!(await Department.exists({ _id: department, university: uniOf(req) }))) throw new ApiError(400, 'Invalid department');
  }
  const user = await User.create({
    name, email, password, role,
    university: uniOf(req),
    department: role === 'officer' ? department : undefined,
    regNo: role === 'student' ? regNo : undefined,
    faculty: role === 'student' ? faculty : undefined,
  });
  await audit(req.user, 'USER_CREATED', user._id, `${role}: ${email}`);
  res.status(201).json(await user.populate('department', 'name code'));
});

// PATCH /api/admin/users/:id
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!user) throw new ApiError(404, 'User not found');
  if (req.body.role && !['student', 'officer', 'admin'].includes(req.body.role)) throw new ApiError(400, 'Invalid role');
  if (req.body.role && req.body.role !== user.role && (user.role === 'student' || req.body.role === 'student')) {
    throw new ApiError(400, 'Student accounts cannot be changed into staff accounts (or the other way round). Create a new account instead.');
  }
  ['name', 'role', 'department', 'regNo', 'faculty', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f] === '' ? undefined : req.body[f];
  });
  // Officers must belong to a department of THIS university; nobody else has a department
  if (user.role === 'officer') {
    if (!user.department) throw new ApiError(400, 'Officers must be assigned a department');
    if (!(await Department.exists({ _id: user.department, university: uniOf(req) }))) throw new ApiError(400, 'Invalid department');
  } else {
    user.department = undefined;
  }
  if (req.body.email !== undefined) {
    if (!emailBelongsTo(req.body.email, req.user.university)) throw new ApiError(400, 'Email must belong to your university');
    user.email = req.body.email;
  }
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
  const user = await User.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!user) throw new ApiError(404, 'User not found');
  if ((await ClearanceRequest.exists({ student: user._id })) || (await Due.exists({ student: user._id }))) {
    throw new ApiError(400, 'This account has clearance records. Disable it instead, so the history is kept.');
  }
  await user.deleteOne();
  // Let the student register again later if they are still on the official list
  if (user.role === 'student') await EnrolledStudent.updateOne({ university: uniOf(req), regNo: user.regNo }, { status: 'pending', $unset: { user: 1, activatedAt: 1 } });
  await audit(req.user, 'USER_DELETED', user._id, user.email);
  res.json({ message: 'User deleted' });
});

/* ---------- Requests overview ---------- */

// GET /api/admin/requests?status=in-progress&search=kasun&department=<id>&deptStatus=pending
exports.listRequests = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.reason) filter.reason = req.query.reason;
  if (req.query.department) {
    filter.items = { $elemMatch: { department: req.query.department, ...(req.query.deptStatus ? { status: req.query.deptStatus } : {}) } };
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRx(req.query.search), 'i');
    const students = await User.find({ university: uniOf(req), role: 'student', $or: [{ name: rx }, { regNo: rx }, { email: rx }] }).select('_id');
    filter.student = { $in: students.map((u) => u._id) };
  }
  const requests = await ClearanceRequest.find(filter)
    .populate('student', 'name regNo email faculty')
    .populate('items.department', 'name code order')
    .sort('-createdAt')
    .limit(500)
    .lean();
  requests.forEach((r) => r.items.sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0)));
  res.json(requests);
});

// GET /api/admin/requests/:id  – full detail: items, dues, certificate and history
exports.getRequest = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findOne({ _id: req.params.id, university: uniOf(req) })
    .populate('student', 'name regNo email faculty phone')
    .populate('items.department', 'name code order')
    .populate('items.actionedBy', 'name')
    .lean();
  if (!request) throw new ApiError(404, 'Request not found');
  request.items.sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0));
  const [dues, certificate, history] = await Promise.all([
    Due.find({ student: request.student._id }).populate('department', 'name code').sort('-createdAt').lean(),
    Certificate.findOne({ request: request._id }).lean(),
    AuditLog.find({ university: uniOf(req), target: String(request._id) }).populate('actor', 'name role').sort('createdAt').lean(),
  ]);
  res.json({ ...request, dues, certificate, history });
});

// GET /api/admin/users/:id/summary  – a student's requests and dues
exports.userSummary = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, university: uniOf(req) }).populate('department', 'name code').lean();
  if (!user) throw new ApiError(404, 'User not found');
  const [requests, dues, actions] = await Promise.all([
    ClearanceRequest.find({ student: user._id }).populate('items.department', 'name code order').sort('-createdAt').lean(),
    Due.find({ student: user._id }).populate('department', 'name code').sort('-createdAt').lean(),
    AuditLog.find({ actor: user._id }).sort('-createdAt').limit(15).lean(),
  ]);
  res.json({ user, requests, dues, actions });
});

/* ---------- Reports ---------- */

// GET /api/admin/reports
exports.reports = asyncHandler(async (req, res) => {
  const uni = new mongoose.Types.ObjectId(String(uniOf(req)));
  const [byStatus, students, officers, certificates, dueAgg, departments, completed] = await Promise.all([
    ClearanceRequest.aggregate([{ $match: { university: uni } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'student', university: uni }),
    User.countDocuments({ role: 'officer', university: uni }),
    Certificate.countDocuments({ university: uni }),
    Due.aggregate([{ $match: { university: uni } }, { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Department.find({ isActive: true, university: uni }).sort('order name').lean(),
    ClearanceRequest.find({ university: uni, status: 'completed', completedAt: { $exists: true } }).select('createdAt completedAt').lean(),
  ]);

  // Pending / dues items per department (shows bottlenecks)
  const perDept = await ClearanceRequest.aggregate([
    { $match: { university: uni, status: { $in: ['pending', 'in-progress'] } } },
    { $unwind: '$items' },
    { $group: { _id: { dept: '$items.department', status: '$items.status' }, count: { $sum: 1 } } },
  ]);
  const departmentLoad = departments.map((d) => {
    const get = (st) => perDept.find((p) => String(p._id.dept) === String(d._id) && p._id.status === st)?.count || 0;
    return { department: d.name, pending: get('pending'), dues: get('dues'), cleared: get('cleared') };
  });

  const since30 = new Date(Date.now() - 30 * DAY);
  const [submittedSeries, completedSeries, byReason, byFaculty, duesByDept, recent] = await Promise.all([
    ClearanceRequest.aggregate([{ $match: { university: uni, createdAt: { $gte: since30 } } }, { $group: { _id: dayExpr('$createdAt'), n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([{ $match: { university: uni, completedAt: { $gte: since30 } } }, { $group: { _id: dayExpr('$completedAt'), n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([{ $match: { university: uni } }, { $group: { _id: '$reason', n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([
      { $match: { university: uni } },
      { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 's' } },
      { $unwind: '$s' },
      { $group: { _id: { $ifNull: ['$s.faculty', 'Other'] }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
    Due.aggregate([{ $match: { university: uni } }, { $group: { _id: { d: '$department', st: '$status' }, total: { $sum: '$amount' } } }]),
    ClearanceRequest.find({ university: uni }).sort('-createdAt').limit(6).populate('student', 'name regNo faculty').lean(),
  ]);
  const sub = Object.fromEntries(submittedSeries.map((x) => [x._id, x.n]));
  const comp = Object.fromEntries(completedSeries.map((x) => [x._id, x.n]));
  const series = Array.from({ length: 30 }, (_, i) => dayKey(new Date(Date.now() - (29 - i) * DAY))).map((k) => ({ date: k, submitted: sub[k] || 0, completed: comp[k] || 0 }));
  const sumDue = (deptId, sts) => duesByDept.filter((x) => String(x._id.d) === String(deptId) && sts.includes(x._id.st)).reduce((a, x) => a + x.total, 0);
  const duesPerDepartment = departments.map((d) => ({ department: d.name, code: d.code, outstanding: sumDue(d._id, ['unpaid', 'receipt-submitted']), collected: sumDue(d._id, ['paid']) }));

  const avgDays = completed.length
    ? completed.reduce((sum, r) => sum + (new Date(r.completedAt) - new Date(r.createdAt)) / 864e5, 0) / completed.length
    : 0;

  const statusCounts = { pending: 0, 'in-progress': 0, completed: 0, cancelled: 0 };
  byStatus.forEach((st) => { statusCounts[st._id] = st.count; });
  const dueTotals = {};
  dueAgg.forEach((d) => { dueTotals[d._id] = { total: d.total, count: d.count }; });

  res.json({
    totals: { students, officers, certificates, requests: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
    statusCounts,
    dueTotals,
    departmentLoad,
    avgClearanceDays: Math.round(avgDays * 10) / 10,
    completionRate: Object.values(statusCounts).reduce((a, b) => a + b, 0) ? Math.round((statusCounts.completed / Object.values(statusCounts).reduce((a, b) => a + b, 0)) * 100) : 0,
    series,
    byReason: byReason.map((r) => ({ reason: r._id, count: r.n })),
    byFaculty: byFaculty.map((f) => ({ faculty: f._id, total: f.total, completed: f.completed })),
    duesPerDepartment,
    recent,
  });
});

// GET /api/admin/audit?page=1&action=DUE&search=abc
exports.auditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 30;
  const filter = { university: uniOf(req) };
  if (req.query.action) filter.action = new RegExp(`^${String(req.query.action).replace(/[^A-Z_]/g, '')}`);
  if (req.query.search) filter.details = new RegExp(escapeRx(req.query.search), 'i');
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name role').populate('department', 'name').sort('-createdAt').skip((page - 1) * size).limit(size).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / size)) });
});

/* ---------- Official student list ("roster") ---------- */
const cleanRow = (r = {}) => ({
  regNo: String(r.regNo || '').toUpperCase().trim(),
  email: String(r.email || '').toLowerCase().trim(),
  name: String(r.name || '').trim(),
  faculty: String(r.faculty || '').trim(),
});
const rowProblem = (r) => {
  if (!r.regNo || !r.email || !r.name) return 'Registration number, email and name are required';
  if (!/^\S+@\S+\.\S+$/.test(r.email)) return 'Invalid email';
  return null;
};
const notOurEmail = (req, email) =>
  !emailBelongsTo(email, req.user.university) &&
  `Email must be a ${req.user.university.name} email (${req.user.university.domains.map((d) => '@' + d).join(' or ')})`;

// GET /api/admin/roster?status=pending&search=abc
exports.listRoster = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(escapeRx(req.query.search), 'i');
    filter.$or = [{ regNo: rx }, { email: rx }, { name: rx }];
  }
  const [rows, total, activated] = await Promise.all([
    EnrolledStudent.find(filter).sort('-createdAt').limit(500),
    EnrolledStudent.countDocuments({ university: uniOf(req) }),
    EnrolledStudent.countDocuments({ university: uniOf(req), status: 'activated' }),
  ]);
  res.json({ rows, total, activated });
});

// POST /api/admin/roster  body: { regNo, email, name, faculty }
exports.addRosterEntry = asyncHandler(async (req, res) => {
  const row = cleanRow(req.body);
  const problem = rowProblem(row) || notOurEmail(req, row.email);
  if (problem) throw new ApiError(400, problem);
  const entry = await EnrolledStudent.create({ ...row, university: uniOf(req) });
  await audit(req.user, 'ROSTER_ADDED', entry._id, `${row.regNo} ${row.email}`);
  res.status(201).json(entry);
});

// POST /api/admin/roster/import  body: { rows: [{ regNo, email, name, faculty }] }
exports.importRoster = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw new ApiError(400, 'No rows to import');
  if (rows.length > 5000) throw new ApiError(400, 'Import at most 5000 students at a time');

  const result = { added: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = cleanRow(rows[i]);
    const problem = rowProblem(row) || notOurEmail(req, row.email);
    if (problem) { result.errors.push({ row: i + 2, regNo: row.regNo, reason: problem }); continue; }
    // eslint-disable-next-line no-await-in-loop
    const existing = await EnrolledStudent.findOne({ university: uniOf(req), regNo: row.regNo });
    if (existing && existing.status === 'activated') { result.skipped += 1; continue; }
    try {
      if (existing) {
        Object.assign(existing, row);
        await existing.save(); // eslint-disable-line no-await-in-loop
        result.updated += 1;
      } else {
        await EnrolledStudent.create({ ...row, university: uniOf(req) }); // eslint-disable-line no-await-in-loop
        result.added += 1;
      }
    } catch (err) {
      result.errors.push({ row: i + 2, regNo: row.regNo, reason: err.message });
    }
  }
  await audit(req.user, 'ROSTER_IMPORTED', '', `added ${result.added}, updated ${result.updated}, skipped ${result.skipped}, errors ${result.errors.length}`);
  res.json(result);
});

// DELETE /api/admin/roster/:id  (only students who haven't created an account yet)
exports.deleteRosterEntry = asyncHandler(async (req, res) => {
  const entry = await EnrolledStudent.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!entry) throw new ApiError(404, 'Student not found on the list');
  if (entry.status === 'activated') throw new ApiError(400, 'This student already has an account. Disable the account under Users instead.');
  await entry.deleteOne();
  await audit(req.user, 'ROSTER_REMOVED', entry._id, entry.regNo);
  res.json({ message: 'Removed from the student list' });
});
