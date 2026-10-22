const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Faculty = require('../models/Faculty');
const ClearanceRequest = require('../models/ClearanceRequest');
const Due = require('../models/Due');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const EnrolledStudent = require('../models/EnrolledStudent');
const { emailBelongsTo, FACULTY_RESERVED } = require('../utils/policy');
const { asyncHandler, ApiError } = require('../middleware/error');
const { removeByUrl } = require('../utils/files');
const { uniOf, facOf } = require('../middleware/auth');
const { audit, escapeRx } = require('../utils/helpers');

const TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';
const DAY = 864e5;
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const dayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

/*
  Every query in this file is limited to the signed-in admin's university.
  A university admin (role "admin") sees the whole university and can narrow lists with ?faculty=<id>
  (or ?faculty=central for university-level staff and offices).
  A faculty admin (role "facultyadmin") only ever sees and changes their own faculty.
*/
const isFacultyAdmin = (req) => req.user.role === 'facultyadmin';
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const validId = (v) => mongoose.isValidObjectId(v);

// Faculty filter for a collection. field = 'faculty' (requests, dues, offices, audit) or 'facultyId' (users, student list)
const facultyFilter = (req, field = 'faculty') => {
  if (isFacultyAdmin(req)) return { [field]: facOf(req) };
  const f = req.query.faculty;
  if (f === 'central') return { [field]: null };
  if (f && validId(f)) return { [field]: oid(f) };
  return {};
};

// Loads a faculty of this university (throws a friendly error otherwise)
const facultyOfUniversity = async (req, id) => {
  if (!id || !validId(id)) throw new ApiError(400, 'Please choose a valid faculty');
  const faculty = await Faculty.findOne({ _id: id, university: uniOf(req) });
  if (!faculty) throw new ApiError(400, 'That faculty does not belong to your university');
  return faculty;
};

/* ---------- Faculties (university admin manages, faculty admins can read their own) ---------- */

const slugify = (s) => String(s || '').toLowerCase().replace(/^faculty of\s+/, '').replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const pickFaculty = (b) => {
  const out = {};
  ['name', 'code', 'location'].forEach((k) => { if (b[k] !== undefined) out[k] = String(b[k]).trim(); });
  if (b.slug !== undefined) out.slug = slugify(b.slug);
  if (b.order !== undefined) out.order = Number(b.order) || 0;
  if (b.isActive !== undefined) out.isActive = !!b.isActive;
  if (out.slug && FACULTY_RESERVED.includes(out.slug)) throw new ApiError(400, `"${out.slug}" is reserved. Choose another portal address.`);
  return out;
};

// GET /api/admin/faculties  – faculties with their admins and counts
exports.listFaculties = asyncHandler(async (req, res) => {
  const uni = oid(uniOf(req));
  const filter = { university: uni, ...(isFacultyAdmin(req) ? { _id: facOf(req) } : {}) };
  const faculties = await Faculty.find(filter).sort('order name').lean();
  const ids = faculties.map((f) => f._id);
  const count = (Model, match, key) => Model.aggregate([{ $match: { ...match, [key]: { $in: ids } } }, { $group: { _id: `$${key}`, n: { $sum: 1 } } }]);
  const [students, officers, offices, active, listed, admins] = await Promise.all([
    count(User, { university: uni, role: 'student' }, 'facultyId'),
    count(User, { university: uni, role: 'officer' }, 'facultyId'),
    count(Department, { university: uni, isActive: true }, 'faculty'),
    count(ClearanceRequest, { university: uni, status: { $in: ['pending', 'in-progress'] } }, 'faculty'),
    count(EnrolledStudent, { university: uni }, 'facultyId'),
    User.find({ university: uni, role: 'facultyadmin', facultyId: { $in: ids } }).select('name email isActive facultyId avatarUrl').lean(),
  ]);
  const n = (list, id) => list.find((x) => String(x._id) === String(id))?.n || 0;
  res.json(faculties.map((f) => ({
    ...f,
    stats: { students: n(students, f._id), officers: n(officers, f._id), offices: n(offices, f._id), activeRequests: n(active, f._id), onList: n(listed, f._id) },
    admins: admins.filter((a) => String(a.facultyId) === String(f._id)),
  })));
});

// POST /api/admin/faculties
exports.createFaculty = asyncHandler(async (req, res) => {
  const data = pickFaculty(req.body);
  if (!data.name || !data.code) throw new ApiError(400, 'Faculty name and code are required');
  if (!data.slug) data.slug = slugify(data.name);
  if (FACULTY_RESERVED.includes(data.slug)) throw new ApiError(400, 'Choose another portal address for this faculty');
  const faculty = await Faculty.create({ ...data, university: uniOf(req) });
  await audit(req.user, 'FACULTY_CREATED', faculty._id, faculty.name);
  res.status(201).json(faculty);
});

// PATCH /api/admin/faculties/:id
exports.updateFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!faculty) throw new ApiError(404, 'Faculty not found');
  Object.assign(faculty, pickFaculty(req.body));
  await faculty.save();
  // keep the faculty name stored on students and the student list in step
  await Promise.all([
    User.updateMany({ facultyId: faculty._id, role: 'student' }, { faculty: faculty.name }),
    EnrolledStudent.updateMany({ facultyId: faculty._id }, { faculty: faculty.name }),
  ]);
  await audit(req.user, 'FACULTY_UPDATED', faculty._id, faculty.name);
  res.json(faculty);
});

// DELETE /api/admin/faculties/:id  – only a faculty that has nothing in it yet
exports.deleteFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!faculty) throw new ApiError(404, 'Faculty not found');
  const used = (await Department.exists({ faculty: faculty._id })) || (await User.exists({ facultyId: faculty._id })) ||
    (await EnrolledStudent.exists({ facultyId: faculty._id })) || (await ClearanceRequest.exists({ faculty: faculty._id }));
  if (used) throw new ApiError(400, 'This faculty already has offices, staff, students or requests. Deactivate it instead, so the history is kept.');
  await faculty.deleteOne();
  await audit(req.user, 'FACULTY_DELETED', faculty._id, faculty.name);
  res.json({ message: 'Faculty deleted' });
});

/* ---------- Departments (offices) ---------- */

// GET /api/departments
//   university admin: every office (?faculty=<id>|central to narrow)
//   faculty admin: their faculty's offices plus the central offices (central ones are read-only for them)
//   students and officers: the active offices that clear them (central + their faculty)
exports.listDepartments = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req) };
  if (req.user.role === 'admin') {
    Object.assign(filter, facultyFilter(req, 'faculty'));
  } else {
    filter.$or = [{ faculty: null }, ...(facOf(req) ? [{ faculty: facOf(req) }] : [])];
    if (req.user.role !== 'facultyadmin') filter.isActive = true;
  }
  res.json(await Department.find(filter).populate('faculty', 'name code slug').sort('order name'));
});

// Which faculty a new / edited office belongs to (null = central)
const officeFaculty = async (req, value) => {
  if (isFacultyAdmin(req)) return facOf(req);
  if (value === undefined) return undefined;
  if (!value || value === 'central') return null;
  return (await facultyOfUniversity(req, value))._id;
};

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, code, description, order, isActive } = req.body;
  const faculty = await officeFaculty(req, req.body.faculty ?? null);
  const dept = await Department.create({ name, code, description, order, isActive, university: uniOf(req), faculty });
  await audit(req.user, 'DEPARTMENT_CREATED', dept._id, dept.name);
  res.status(201).json(await dept.populate('faculty', 'name code slug'));
});

const editableOffice = async (req, id) => {
  const dept = await Department.findOne({ _id: id, university: uniOf(req) });
  if (!dept) throw new ApiError(404, 'Department not found');
  if (isFacultyAdmin(req) && String(dept.faculty) !== String(facOf(req))) {
    throw new ApiError(403, 'Central offices and other faculties are managed by the university admin');
  }
  return dept;
};

exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await editableOffice(req, req.params.id);
  ['name', 'code', 'description', 'order', 'isActive'].forEach((k) => { if (req.body[k] !== undefined) dept[k] = req.body[k]; });
  if (req.body.faculty !== undefined && !isFacultyAdmin(req)) {
    const next = await officeFaculty(req, req.body.faculty);
    if (String(next) !== String(dept.faculty)) {
      const used = (await ClearanceRequest.exists({ 'items.department': dept._id })) || (await Due.exists({ department: dept._id })) || (await User.exists({ department: dept._id }));
      if (used) throw new ApiError(400, 'This office already has requests, dues or officers, so it cannot move to another faculty. Create a new office instead.');
      dept.faculty = next;
    }
  }
  await dept.save();
  await audit(req.user, 'DEPARTMENT_UPDATED', dept._id, dept.name);
  res.json(await dept.populate('faculty', 'name code slug'));
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await editableOffice(req, req.params.id);
  const used = (await ClearanceRequest.exists({ 'items.department': dept._id })) || (await Due.exists({ department: dept._id })) || (await User.exists({ department: dept._id }));
  if (used) throw new ApiError(400, 'This department has requests, dues or officers. Deactivate it instead, so the history is kept.');
  await dept.deleteOne();
  await audit(req.user, 'DEPARTMENT_DELETED', dept._id, dept.name);
  res.json({ message: 'Department deleted' });
});

/* ---------- Users ---------- */

const ROLES_UNI_ADMIN = ['student', 'officer', 'facultyadmin', 'admin'];
const ROLES_FAC_ADMIN = ['student', 'officer'];
const allowedRoles = (req) => (isFacultyAdmin(req) ? ROLES_FAC_ADMIN : ROLES_UNI_ADMIN);
const USER_POP = [{ path: 'department', select: 'name code faculty' }, { path: 'facultyId', select: 'name code slug' }];

// GET /api/admin/users?role=student&search=abc&faculty=<id>|central
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req), ...facultyFilter(req, 'facultyId') };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const rx = new RegExp(escapeRx(req.query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { regNo: rx }];
  }
  if (req.query.department) filter.department = req.query.department;
  const users = await User.find(filter).populate(USER_POP).sort('role name').limit(1000);
  res.json(users);
});

// Works out department / faculty for a staff or student account and checks the admin may do this
const placeUser = async (req, user, body) => {
  if (user.role === 'officer') {
    if (!user.department) throw new ApiError(400, 'Officers must be assigned a department');
    const dept = await Department.findOne({ _id: user.department, university: uniOf(req) });
    if (!dept) throw new ApiError(400, 'Invalid department');
    if (isFacultyAdmin(req) && String(dept.faculty) !== String(facOf(req))) throw new ApiError(403, 'You can only add officers to your own faculty\'s offices');
    user.facultyId = dept.faculty || undefined; // central office -> central officer
  } else {
    user.department = undefined;
    if (user.role === 'admin') user.facultyId = undefined;
    else {
      const wanted = isFacultyAdmin(req) ? facOf(req) : (body.facultyId !== undefined ? body.facultyId : user.facultyId);
      const faculty = await facultyOfUniversity(req, wanted);
      user.facultyId = faculty._id;
      if (user.role === 'student') user.faculty = faculty.name;
    }
  }
};

// POST /api/admin/users  (create officer / faculty admin / university admin / student in this university)
exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, department, regNo } = req.body;
  if (!name || !email || !password || !role) throw new ApiError(400, 'Name, email, password and role are required');
  if (!allowedRoles(req).includes(role)) throw new ApiError(403, 'You cannot create this kind of account');
  if (!emailBelongsTo(email, req.user.university)) {
    throw new ApiError(400, `Use a ${req.user.university.name} email (${req.user.university.domains.map((d) => '@' + d).join(' or ')}).`);
  }
  const user = new User({ name, email, password, role, university: uniOf(req), department: role === 'officer' ? department : undefined, regNo: role === 'student' ? regNo : undefined });
  await placeUser(req, user, req.body);
  await user.save();
  await audit(req.user, 'USER_CREATED', user._id, `${role}: ${email}`);
  res.status(201).json(await user.populate(USER_POP));
});

const scopedUser = async (req, id) => {
  const user = await User.findOne({ _id: id, university: uniOf(req), ...facultyFilter(req, 'facultyId') });
  if (!user) throw new ApiError(404, 'User not found');
  if (isFacultyAdmin(req) && !ROLES_FAC_ADMIN.includes(user.role) && String(user._id) !== String(req.user._id)) {
    throw new ApiError(403, 'Only the university admin can change this account');
  }
  return user;
};

// PATCH /api/admin/users/:id
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await scopedUser(req, req.params.id);
  if (req.body.role && !allowedRoles(req).includes(req.body.role)) throw new ApiError(403, 'You cannot give this role');
  if (req.body.role && req.body.role !== user.role && (user.role === 'student' || req.body.role === 'student')) {
    throw new ApiError(400, 'Student accounts cannot be changed into staff accounts (or the other way round). Create a new account instead.');
  }
  ['name', 'role', 'department', 'regNo', 'isActive'].forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f] === '' ? undefined : req.body[f];
  });
  await placeUser(req, user, req.body);
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
  res.json(await user.populate(USER_POP));
});

// DELETE /api/admin/users/:id
exports.deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete yourself');
  const user = await scopedUser(req, req.params.id);
  if ((await ClearanceRequest.exists({ student: user._id })) || (await Due.exists({ student: user._id }))) {
    throw new ApiError(400, 'This account has clearance records. Disable it instead, so the history is kept.');
  }
  await removeByUrl(user.avatarUrl);
  await user.deleteOne();
  // Let the student register again later if they are still on the official list
  if (user.role === 'student') await EnrolledStudent.updateOne({ university: uniOf(req), regNo: user.regNo }, { status: 'pending', $unset: { user: 1, activatedAt: 1 } });
  await audit(req.user, 'USER_DELETED', user._id, user.email);
  res.json({ message: 'User deleted' });
});

/* ---------- Requests overview ---------- */

// GET /api/admin/requests?status=in-progress&search=kasun&department=<id>&deptStatus=pending
exports.listRequests = asyncHandler(async (req, res) => {
  const filter = { university: uniOf(req), ...facultyFilter(req, 'faculty') };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.reason) filter.reason = req.query.reason;
  if (req.query.department) {
    filter.items = { $elemMatch: { department: req.query.department, ...(req.query.deptStatus ? { status: req.query.deptStatus } : {}) } };
  }
  if (req.query.search) {
    const rx = new RegExp(escapeRx(req.query.search), 'i');
    const students = await User.find({ university: uniOf(req), role: 'student', ...facultyFilter(req, 'facultyId'), $or: [{ name: rx }, { regNo: rx }, { email: rx }] }).select('_id');
    filter.student = { $in: students.map((u) => u._id) };
  }
  const requests = await ClearanceRequest.find(filter)
    .populate('student', 'name regNo email faculty avatarUrl')
    .populate('faculty', 'name code')
    .populate('items.department', 'name code order faculty')
    .sort('-createdAt')
    .limit(500)
    .lean();
  requests.forEach((r) => r.items.sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0)));
  res.json(requests);
});

// GET /api/admin/requests/:id  – full detail: items, dues, certificate and history
exports.getRequest = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findOne({ _id: req.params.id, university: uniOf(req), ...facultyFilter(req, 'faculty') })
    .populate('student', 'name regNo email faculty phone avatarUrl')
    .populate('faculty', 'name code location')
    .populate('items.department', 'name code order faculty')
    .populate('items.actionedBy', 'name')
    .lean();
  if (!request) throw new ApiError(404, 'Request not found');
  request.items.sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0));
  const [dues, certificate, history] = await Promise.all([
    Due.find({ student: request.student._id }).populate('department', 'name code').sort('-createdAt').lean(),
    Certificate.findOne({ request: request._id }).lean(),
    AuditLog.find({ university: uniOf(req), target: String(request._id) }).populate('actor', 'name role avatarUrl').sort('createdAt').lean(),
  ]);
  res.json({ ...request, dues, certificate, history });
});

// GET /api/admin/users/:id/summary  – a student's requests and dues
exports.userSummary = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, university: uniOf(req), ...facultyFilter(req, 'facultyId') }).populate(USER_POP).lean();
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
  const uni = oid(uniOf(req));
  // m = requests / dues of the faculty in view (whole university for a university admin without a filter)
  const scope = facultyFilter(req, 'faculty');
  const m = { university: uni, ...scope };
  const userScope = facultyFilter(req, 'facultyId');
  const deptFilter = { isActive: true, university: uni };
  if ('faculty' in scope) deptFilter.$or = [{ faculty: null }, ...(scope.faculty ? [{ faculty: scope.faculty }] : [])];
  const certScope = 'faculty' in scope ? { request: { $in: (await ClearanceRequest.find(m).select('_id').lean()).map((r) => r._id) } } : {};
  const [byStatus, students, officers, certificates, dueAgg, departments, completed] = await Promise.all([
    ClearanceRequest.aggregate([{ $match: m }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'student', university: uni, ...userScope }),
    User.countDocuments({ role: 'officer', university: uni, ...userScope }),
    Certificate.countDocuments({ university: uni, ...certScope }),
    Due.aggregate([{ $match: m }, { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Department.find(deptFilter).populate('faculty', 'code').sort('order name').lean(),
    ClearanceRequest.find({ ...m, status: 'completed', completedAt: { $exists: true } }).select('createdAt completedAt').lean(),
  ]);

  // Pending / dues items per department (shows bottlenecks)
  const perDept = await ClearanceRequest.aggregate([
    { $match: { ...m, status: { $in: ['pending', 'in-progress'] } } },
    { $unwind: '$items' },
    { $group: { _id: { dept: '$items.department', status: '$items.status' }, count: { $sum: 1 } } },
  ]);
  const departmentLoad = departments.map((d) => {
    const get = (st) => perDept.find((p) => String(p._id.dept) === String(d._id) && p._id.status === st)?.count || 0;
    return { department: d.faculty ? `${d.name} (${d.faculty.code})` : d.name, pending: get('pending'), dues: get('dues'), cleared: get('cleared') };
  });

  const since30 = new Date(Date.now() - 30 * DAY);
  const [submittedSeries, completedSeries, byReason, byFaculty, duesByDept, recent] = await Promise.all([
    ClearanceRequest.aggregate([{ $match: { ...m, createdAt: { $gte: since30 } } }, { $group: { _id: dayExpr('$createdAt'), n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([{ $match: { ...m, completedAt: { $gte: since30 } } }, { $group: { _id: dayExpr('$completedAt'), n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([{ $match: m }, { $group: { _id: '$reason', n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([
      { $match: m },
      { $lookup: { from: 'faculties', localField: 'faculty', foreignField: '_id', as: 'f' } },
      { $group: { _id: { $ifNull: [{ $arrayElemAt: ['$f.name', 0] }, 'Other'] }, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
    Due.aggregate([{ $match: m }, { $group: { _id: { d: '$department', st: '$status' }, total: { $sum: '$amount' } } }]),
    ClearanceRequest.find(m).sort('-createdAt').limit(6).populate('student', 'name regNo faculty avatarUrl').lean(),
  ]);
  const sub = Object.fromEntries(submittedSeries.map((x) => [x._id, x.n]));
  const comp = Object.fromEntries(completedSeries.map((x) => [x._id, x.n]));
  const series = Array.from({ length: 30 }, (_, i) => dayKey(new Date(Date.now() - (29 - i) * DAY))).map((k) => ({ date: k, submitted: sub[k] || 0, completed: comp[k] || 0 }));
  const sumDue = (deptId, sts) => duesByDept.filter((x) => String(x._id.d) === String(deptId) && sts.includes(x._id.st)).reduce((a, x) => a + x.total, 0);
  const duesPerDepartment = departments.map((d) => ({ department: d.faculty ? `${d.name} (${d.faculty.code})` : d.name, code: d.code, outstanding: sumDue(d._id, ['unpaid', 'receipt-submitted']), collected: sumDue(d._id, ['paid']) }));

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
  const filter = { university: uniOf(req), ...facultyFilter(req, 'faculty') };
  if (req.query.action) filter.action = new RegExp(`^${String(req.query.action).replace(/[^A-Z_]/g, '')}`);
  if (req.query.search) filter.details = new RegExp(escapeRx(req.query.search), 'i');
  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('actor', 'name role avatarUrl').populate('department', 'name').populate('faculty', 'code').sort('-createdAt').skip((page - 1) * size).limit(size).lean(),
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
  facultyId: r.facultyId ? String(r.facultyId) : '',
});
const rowProblem = (r) => {
  if (!r.regNo || !r.email || !r.name) return 'Registration number, email and name are required';
  if (!/^\S+@\S+\.\S+$/.test(r.email)) return 'Invalid email';
  return null;
};
const notOurEmail = (req, email) =>
  !emailBelongsTo(email, req.user.university) &&
  `Email must be a ${req.user.university.name} email (${req.user.university.domains.map((d) => '@' + d).join(' or ')})`;

// Every student on the list belongs to a faculty: given by id (forms) or by name / code (CSV import).
// A faculty admin can only add students to their own faculty.
const resolveFaculty = (req, faculties, row) => {
  if (isFacultyAdmin(req)) {
    const own = faculties.find((f) => String(f._id) === String(facOf(req)));
    if (row.facultyId && String(row.facultyId) !== String(own._id)) return { problem: 'You can only add students to your own faculty' };
    if (!row.facultyId && row.faculty && ![own.name, own.code].map((x) => x.toLowerCase()).includes(row.faculty.toLowerCase())) {
      return { problem: `This student is listed under "${row.faculty}". You can only add students to the ${own.name}` };
    }
    return { faculty: own };
  }
  if (row.facultyId) {
    const f = faculties.find((x) => String(x._id) === String(row.facultyId));
    return f ? { faculty: f } : { problem: 'Please choose a faculty of your university' };
  }
  if (!row.faculty) return { problem: 'Faculty is required (faculty name or code)' };
  const v = row.faculty.toLowerCase();
  const f = faculties.find((x) => [x.name.toLowerCase(), x.code.toLowerCase(), x.name.toLowerCase().replace(/^faculty of\s+/, '')].includes(v));
  return f ? { faculty: f } : { problem: `Unknown faculty "${row.faculty}". Use a faculty name or code from the Faculties page` };
};
const universityFaculties = (req) => Faculty.find({ university: uniOf(req) }).lean();
const rowData = (row, faculty) => ({ regNo: row.regNo, email: row.email, name: row.name, faculty: faculty.name, facultyId: faculty._id });

// GET /api/admin/roster?status=pending&search=abc&faculty=<id>
exports.listRoster = asyncHandler(async (req, res) => {
  const scope = { university: uniOf(req), ...facultyFilter(req, 'facultyId') };
  const filter = { ...scope };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(escapeRx(req.query.search), 'i');
    filter.$or = [{ regNo: rx }, { email: rx }, { name: rx }];
  }
  const [rows, total, activated] = await Promise.all([
    EnrolledStudent.find(filter).sort('-createdAt').limit(500),
    EnrolledStudent.countDocuments(scope),
    EnrolledStudent.countDocuments({ ...scope, status: 'activated' }),
  ]);
  res.json({ rows, total, activated });
});

// POST /api/admin/roster  body: { regNo, email, name, facultyId | faculty }
exports.addRosterEntry = asyncHandler(async (req, res) => {
  const row = cleanRow(req.body);
  const problem = rowProblem(row) || notOurEmail(req, row.email);
  if (problem) throw new ApiError(400, problem);
  const { faculty, problem: fp } = resolveFaculty(req, await universityFaculties(req), row);
  if (fp) throw new ApiError(400, fp);
  const entry = await EnrolledStudent.create({ ...rowData(row, faculty), university: uniOf(req) });
  await audit(req.user, 'ROSTER_ADDED', entry._id, `${row.regNo} ${row.email} · ${faculty.code}`);
  res.status(201).json(entry);
});

// POST /api/admin/roster/import  body: { rows: [{ regNo, email, name, faculty }] }
exports.importRoster = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw new ApiError(400, 'No rows to import');
  if (rows.length > 5000) throw new ApiError(400, 'Import at most 5000 students at a time');
  const faculties = await universityFaculties(req);

  const result = { added: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i += 1) {
    const row = cleanRow(rows[i]);
    const problem = rowProblem(row) || notOurEmail(req, row.email);
    if (problem) { result.errors.push({ row: i + 2, regNo: row.regNo, reason: problem }); continue; }
    const { faculty, problem: fp } = resolveFaculty(req, faculties, row);
    if (fp) { result.errors.push({ row: i + 2, regNo: row.regNo, reason: fp }); continue; }
    // eslint-disable-next-line no-await-in-loop
    const existing = await EnrolledStudent.findOne({ university: uniOf(req), regNo: row.regNo });
    if (existing && existing.status === 'activated') { result.skipped += 1; continue; }
    if (existing && isFacultyAdmin(req) && String(existing.facultyId) !== String(facOf(req))) {
      result.errors.push({ row: i + 2, regNo: row.regNo, reason: 'This registration number is listed under another faculty' });
      continue;
    }
    try {
      if (existing) {
        Object.assign(existing, rowData(row, faculty));
        await existing.save(); // eslint-disable-line no-await-in-loop
        result.updated += 1;
      } else {
        await EnrolledStudent.create({ ...rowData(row, faculty), university: uniOf(req) }); // eslint-disable-line no-await-in-loop
        result.added += 1;
      }
    } catch (err) {
      result.errors.push({ row: i + 2, regNo: row.regNo, reason: err.code === 11000 ? 'Duplicate registration number' : err.message });
    }
  }
  await audit(req.user, 'ROSTER_IMPORTED', '', `added ${result.added}, updated ${result.updated}, skipped ${result.skipped}, errors ${result.errors.length}`);
  res.json(result);
});

const scopedEntry = async (req, id) => {
  const entry = await EnrolledStudent.findOne({ _id: id, university: uniOf(req), ...facultyFilter(req, 'facultyId') });
  if (!entry) throw new ApiError(404, 'Student not found on the list');
  return entry;
};

// PATCH /api/admin/roster/:id  body: { regNo, email, name, facultyId }
// Students who already created an account: only name and faculty can change (their login stays the same).
exports.updateRosterEntry = asyncHandler(async (req, res) => {
  const entry = await scopedEntry(req, req.params.id);
  const next = cleanRow({ regNo: entry.regNo, email: entry.email, name: entry.name, facultyId: entry.facultyId, ...req.body });
  const problem = rowProblem(next) || notOurEmail(req, next.email);
  if (problem) throw new ApiError(400, problem);
  const { faculty, problem: fp } = resolveFaculty(req, await universityFaculties(req), next);
  if (fp) throw new ApiError(400, fp);
  if (entry.status === 'activated' && (next.regNo !== entry.regNo || next.email !== entry.email)) {
    throw new ApiError(400, 'This student already has an account, so the registration number and email can no longer change. You can still edit the name and faculty.');
  }
  const before = `${entry.regNo} ${entry.name}`;
  Object.assign(entry, rowData(next, faculty));
  await entry.save();
  // Keep the student's account in step with the official record
  if (entry.status === 'activated' && entry.user) {
    await User.updateOne({ _id: entry.user, university: uniOf(req) }, { name: entry.name, faculty: entry.faculty, facultyId: entry.facultyId });
  }
  await audit(req.user, 'ROSTER_UPDATED', entry._id, `${before} → ${entry.regNo} ${entry.name}`);
  res.json(entry);
});

// DELETE /api/admin/roster/:id  (only students who haven't created an account yet)
exports.deleteRosterEntry = asyncHandler(async (req, res) => {
  const entry = await scopedEntry(req, req.params.id);
  if (entry.status === 'activated') throw new ApiError(400, 'This student already has an account. Disable the account under Users instead.');
  await entry.deleteOne();
  await audit(req.user, 'ROSTER_REMOVED', entry._id, entry.regNo);
  res.json({ message: 'Removed from the student list' });
});
