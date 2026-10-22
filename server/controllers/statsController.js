const mongoose = require('mongoose');
const ClearanceRequest = require('../models/ClearanceRequest');
const Department = require('../models/Department');
const Due = require('../models/Due');
const User = require('../models/User');
const University = require('../models/University');
const Certificate = require('../models/Certificate');
const AuditLog = require('../models/AuditLog');
const { asyncHandler, ApiError } = require('../middleware/error');
const { uniOf, facultyScope } = require('../middleware/auth');
const Faculty = require('../models/Faculty');

const TZ = process.env.APP_TIMEZONE || 'Asia/Colombo';
const oid = (v) => new mongoose.Types.ObjectId(String(v?._id || v));
const DAY = 864e5;

// YYYY-MM-DD in the university's time zone
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const lastDays = (n) => Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * DAY)));
const dayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });
const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

// The department an officer works for (admins may look at any department of their university)
const deptFor = async (req) => {
  const id = ['admin', 'facultyadmin'].includes(req.user.role) ? req.query.department : req.user.department?._id;
  if (!id) throw new ApiError(400, 'No department assigned to this account');
  const dept = await Department.findOne({ _id: id, university: uniOf(req) }).lean();
  if (!dept) throw new ApiError(404, 'Department not found');
  return dept;
};

/* ------------------------------------------------------------------
   GET /api/stats/officer  – everything the department overview page shows
------------------------------------------------------------------- */
exports.officerOverview = asyncHandler(async (req, res) => {
  const dept = await deptFor(req);
  const d = dept._id;
  const uni = oid(uniOf(req));
  const since14 = new Date(Date.now() - 14 * DAY);
  const since90 = new Date(Date.now() - 90 * DAY);

  const [itemAgg, receiptsToVerify, dueAgg, received, cleared, turnaround, attention, recent] = await Promise.all([
    // This department's items, split into active requests and all-time
    ClearanceRequest.aggregate([
      { $match: { university: uni, status: { $ne: 'cancelled' }, 'items.department': d } },
      { $unwind: '$items' },
      { $match: { 'items.department': d } },
      { $group: { _id: { active: { $in: ['$status', ['pending', 'in-progress']] }, st: '$items.status' }, n: { $sum: 1 } } },
    ]),
    Due.countDocuments({ department: d, status: 'receipt-submitted' }),
    Due.aggregate([{ $match: { department: d } }, { $group: { _id: '$status', total: { $sum: '$amount' }, n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([
      { $match: { university: uni, status: { $ne: 'cancelled' }, createdAt: { $gte: since14 } } },
      { $group: { _id: dayExpr('$createdAt'), n: { $sum: 1 } } },
    ]),
    ClearanceRequest.aggregate([
      { $match: { university: uni, 'items.department': d } },
      { $unwind: '$items' },
      { $match: { 'items.department': d, 'items.status': 'cleared', 'items.actionedAt': { $gte: since14 } } },
      { $group: { _id: dayExpr('$items.actionedAt'), n: { $sum: 1 } } },
    ]),
    ClearanceRequest.aggregate([
      { $match: { university: uni, 'items.department': d } },
      { $unwind: '$items' },
      { $match: { 'items.department': d, 'items.status': 'cleared', 'items.actionedAt': { $gte: since90 } } },
      { $group: { _id: null, avg: { $avg: { $subtract: ['$items.actionedAt', '$createdAt'] } }, n: { $sum: 1 } } },
    ]),
    ClearanceRequest.find({ university: uni, status: { $in: ['pending', 'in-progress'] }, items: { $elemMatch: { department: d, status: 'pending' } } })
      .sort('createdAt')
      .limit(6)
      .populate('student', 'name regNo faculty avatarUrl')
      .lean(),
    AuditLog.find({ department: d }).sort('-createdAt').limit(8).populate('actor', 'name role avatarUrl').lean(),
  ]);

  const count = (active, st) => itemAgg.filter((r) => (active === null || r._id.active === active) && r._id.st === st).reduce((s, r) => s + r.n, 0);
  const due = (st) => dueAgg.find((x) => x._id === st) || { total: 0, n: 0 };
  const recMap = toMap(received);
  const clrMap = toMap(cleared);
  const days = lastDays(14);
  const series = days.map((key) => ({ date: key, received: recMap[key] || 0, cleared: clrMap[key] || 0 }));

  res.json({
    department: { _id: dept._id, name: dept.name, code: dept.code },
    counts: {
      pending: count(true, 'pending'),
      dues: count(true, 'dues'),
      clearedActive: count(true, 'cleared'),
      clearedTotal: count(null, 'cleared'),
      clearedThisWeek: series.slice(-7).reduce((s, x) => s + x.cleared, 0),
      receiptsToVerify,
    },
    dues: {
      outstanding: due('unpaid').total + due('receipt-submitted').total,
      outstandingCount: due('unpaid').n + due('receipt-submitted').n,
      collected: due('paid').total,
      collectedCount: due('paid').n,
      waived: due('waived').total,
    },
    avgTurnaroundHours: turnaround[0] ? Math.round((turnaround[0].avg / 36e5) * 10) / 10 : null,
    series,
    attention: attention.map((r) => ({
      _id: r._id,
      student: r.student,
      reason: r.reason,
      createdAt: r.createdAt,
      waitingDays: Math.floor((Date.now() - new Date(r.createdAt)) / DAY),
    })),
    recent,
  });
});

/* ------------------------------------------------------------------
   GET /api/stats/officer/activity?page=1  – the department's history
------------------------------------------------------------------- */
exports.officerActivity = asyncHandler(async (req, res) => {
  const dept = await deptFor(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 25;
  const filter = { department: dept._id };
  if (req.query.action) filter.action = new RegExp(`^${String(req.query.action).replace(/[^A-Z_]/g, '')}`);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort('-createdAt').skip((page - 1) * size).limit(size).populate('actor', 'name role avatarUrl').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / size)) });
});

/* ------------------------------------------------------------------
   GET /api/platform/overview  – platform admin home page
------------------------------------------------------------------- */
exports.platformOverview = asyncHandler(async (req, res) => {
  const since30 = new Date(Date.now() - 30 * DAY);
  const [unis, roleAgg, reqAgg, certs, series, recent, facAgg] = await Promise.all([
    University.find().sort('name').lean(),
    User.aggregate([{ $group: { _id: { u: '$university', role: '$role' }, n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([{ $group: { _id: { u: '$university', st: '$status' }, n: { $sum: 1 } } }]),
    Certificate.aggregate([{ $group: { _id: '$university', n: { $sum: 1 } } }]),
    ClearanceRequest.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: dayExpr('$createdAt'), n: { $sum: 1 } } }]),
    AuditLog.find().sort('-createdAt').limit(10).populate('actor', 'name role avatarUrl').populate('university', 'name code').lean(),
    Faculty.aggregate([{ $group: { _id: '$university', n: { $sum: 1 } } }]),
  ]);
  const facultiesOf = (u) => facAgg.filter((f) => u === null || String(f._id) === String(u)).reduce((sum, f) => sum + f.n, 0);

  const roles = (u, role) => roleAgg.filter((r) => (u === null || String(r._id.u) === String(u)) && r._id.role === role).reduce((s, r) => s + r.n, 0);
  const reqs = (u, st) => reqAgg.filter((r) => (u === null || String(r._id.u) === String(u)) && (!st || r._id.st === st)).reduce((s, r) => s + r.n, 0);
  const sMap = toMap(series);

  res.json({
    totals: {
      universities: unis.length,
      activeUniversities: unis.filter((u) => u.isActive).length,
      students: roles(null, 'student'),
      officers: roles(null, 'officer'),
      admins: roles(null, 'admin'),
      facultyAdmins: roles(null, 'facultyadmin'),
      faculties: facultiesOf(null),
      requests: reqs(null),
      completed: reqs(null, 'completed'),
      active: reqs(null, 'pending') + reqs(null, 'in-progress'),
      certificates: certs.reduce((s, c) => s + c.n, 0),
    },
    universities: unis
      .map((u) => ({
        _id: u._id,
        name: u.name,
        code: u.code,
        shortName: u.shortName,
        logoUrl: u.logoUrl,
        isActive: u.isActive,
        students: roles(u._id, 'student'),
        staff: roles(u._id, 'officer') + roles(u._id, 'admin') + roles(u._id, 'facultyadmin'),
        faculties: facultiesOf(u._id),
        requests: reqs(u._id),
        completed: reqs(u._id, 'completed'),
      }))
      .sort((a, b) => b.requests - a.requests || b.students - a.students || a.name.localeCompare(b.name)),
    series: lastDays(30).map((key) => ({ date: key, requests: sMap[key] || 0 })),
    recent,
  });
});

/* ------------------------------------------------------------------
   GET /api/platform/audit?page=1  – everything that happened on the platform
------------------------------------------------------------------- */
exports.platformAudit = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = 30;
  const filter = {};
  if (req.query.university) filter.university = req.query.university;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort('-createdAt').skip((page - 1) * size).limit(size).populate('actor', 'name role email avatarUrl').populate('university', 'name code').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / size)) });
});

/* ------------------------------------------------------------------
   GET /api/stats/badges  – small counts for the sidebar and the bell (any signed-in user)
------------------------------------------------------------------- */
exports.badges = asyncHandler(async (req, res) => {
  const Notification = require('../models/Notification');
  const EnrolledStudent = require('../models/EnrolledStudent');
  const u = req.user;
  const out = { unread: await Notification.countDocuments({ user: u._id, read: false }) };

  if (u.role === 'student') {
    const [openDues, active] = await Promise.all([
      Due.countDocuments({ student: u._id, status: 'unpaid' }),
      ClearanceRequest.findOne({ student: u._id, status: { $in: ['pending', 'in-progress', 'completed'] } }).sort('-createdAt').select('status').lean(),
    ]);
    out.openDues = openDues;
    out.requestStatus = active?.status || null;
  } else if (u.role === 'officer' && u.department) {
    const d = u.department._id;
    const [pending, receipts] = await Promise.all([
      ClearanceRequest.countDocuments({ university: uniOf(req), status: { $in: ['pending', 'in-progress'] }, items: { $elemMatch: { department: d, status: 'pending' } } }),
      Due.countDocuments({ department: d, status: 'receipt-submitted' }),
    ]);
    out.pending = pending;
    out.receipts = receipts;
  } else if (u.role === 'admin' || u.role === 'facultyadmin') {
    const [active, notRegistered] = await Promise.all([
      ClearanceRequest.countDocuments({ university: uniOf(req), ...facultyScope(req, 'faculty'), status: { $in: ['pending', 'in-progress'] } }),
      EnrolledStudent.countDocuments({ university: uniOf(req), ...facultyScope(req, 'facultyId'), status: 'pending' }),
    ]);
    out.active = active;
    out.notRegistered = notRegistered;
  }
  res.json(out);
});
