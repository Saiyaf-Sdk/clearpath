const ClearanceRequest = require('../models/ClearanceRequest');
const Department = require('../models/Department');
const Due = require('../models/Due');
const Certificate = require('../models/Certificate');
const { asyncHandler, ApiError } = require('../middleware/error');
const { audit, issueCertificate } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');

const OPEN_DUE = ['unpaid', 'receipt-submitted'];

const populateRequest = (q) =>
  q.populate('student', 'name email regNo faculty').populate('items.department', 'name code order');

// POST /api/clearances  (student)
exports.createRequest = asyncHandler(async (req, res) => {
  const { reason, note } = req.body;

  const open = await ClearanceRequest.findOne({
    student: req.user._id,
    status: { $in: ['pending', 'in-progress'] },
  });
  if (open) throw new ApiError(400, 'You already have an active clearance request');

  const departments = await Department.find({ isActive: true }).sort('order name');
  if (departments.length === 0) throw new ApiError(400, 'No departments are set up yet. Contact the admin.');

  // Departments where the student already owes something start as "dues"
  const owing = await Due.distinct('department', { student: req.user._id, status: { $in: OPEN_DUE } });
  const owingIds = owing.map(String);

  const request = await ClearanceRequest.create({
    student: req.user._id,
    reason,
    note,
    items: departments.map((d) => ({
      department: d._id,
      status: owingIds.includes(String(d._id)) ? 'dues' : 'pending',
      remark: owingIds.includes(String(d._id)) ? 'Outstanding dues found' : undefined,
    })),
  });
  request.refreshStatus();
  await request.save();

  await audit(req.user, 'CLEARANCE_SUBMITTED', request._id, `Reason: ${reason}`);
  const full = await populateRequest(ClearanceRequest.findById(request._id));
  res.status(201).json(full);
});

// GET /api/clearances/my  (student)
exports.getMyRequests = asyncHandler(async (req, res) => {
  const requests = await populateRequest(ClearanceRequest.find({ student: req.user._id }).sort('-createdAt')).lean();
  const certs = await Certificate.find({ student: req.user._id }).lean();
  const result = requests.map((r) => {
    r.items.sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0));
    const cert = certs.find((c) => String(c.request) === String(r._id));
    return { ...r, certificate: cert ? { certificateNo: cert.certificateNo, issuedAt: cert.issuedAt } : null };
  });
  res.json(result);
});

// PATCH /api/clearances/:id/cancel  (student, only if nothing cleared yet)
exports.cancelRequest = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findOne({ _id: req.params.id, student: req.user._id });
  if (!request) throw new ApiError(404, 'Request not found');
  if (request.status === 'completed') throw new ApiError(400, 'A completed request cannot be cancelled');
  if (request.status === 'cancelled') throw new ApiError(400, 'Request is already cancelled');
  if (request.items.some((i) => i.status === 'cleared')) {
    throw new ApiError(400, 'Cannot cancel after a department has cleared you');
  }
  request.status = 'cancelled';
  await request.save();
  await audit(req.user, 'CLEARANCE_CANCELLED', request._id);
  res.json({ message: 'Request cancelled' });
});

// GET /api/clearances/department?status=pending  (officer: own dept, admin: ?department=<id>)
exports.getDepartmentRequests = asyncHandler(async (req, res) => {
  const deptId = req.user.role === 'admin' ? req.query.department : req.user.department?._id;
  if (!deptId) throw new ApiError(400, 'No department assigned to this account');

  const itemFilter = { department: deptId };
  if (req.query.status) itemFilter.status = req.query.status;

  const requests = await ClearanceRequest.find({
    status: { $ne: 'cancelled' },
    items: { $elemMatch: itemFilter },
  })
    .populate('student', 'name email regNo faculty')
    .sort('-createdAt')
    .lean();

  // Attach this department's item + the student's dues in this department
  const studentIds = requests.map((r) => r.student?._id).filter(Boolean);
  const dues = await Due.find({ department: deptId, student: { $in: studentIds } }).sort('-createdAt').lean();

  const result = requests.map((r) => ({
    _id: r._id,
    student: r.student,
    reason: r.reason,
    note: r.note,
    overallStatus: r.status,
    createdAt: r.createdAt,
    item: r.items.find((i) => String(i.department) === String(deptId)),
    dues: dues.filter((d) => String(d.student) === String(r.student?._id)),
  }));
  res.json(result);
});

// PATCH /api/clearances/:id/items/:deptId  body: { action: 'clear' | 'flag', remark }
exports.actionItem = asyncHandler(async (req, res) => {
  const { id, deptId } = req.params;
  const { action, remark } = req.body;
  if (!['clear', 'flag'].includes(action)) throw new ApiError(400, 'Action must be "clear" or "flag"');

  if (req.user.role === 'officer' && String(req.user.department?._id) !== String(deptId)) {
    throw new ApiError(403, 'You can only act on your own department');
  }

  const request = await ClearanceRequest.findById(id).populate('student', 'name email regNo');
  if (!request) throw new ApiError(404, 'Request not found');
  if (request.status === 'cancelled') throw new ApiError(400, 'This request was cancelled');
  if (request.status === 'completed') throw new ApiError(400, 'This request is already completed and its certificate issued');

  const item = request.items.find((i) => String(i.department) === String(deptId));
  if (!item) throw new ApiError(404, 'Department item not found on this request');

  if (action === 'clear') {
    const openDues = await Due.countDocuments({ student: request.student._id, department: deptId, status: { $in: OPEN_DUE } });
    if (openDues > 0) {
      throw new ApiError(400, `Cannot clear: the student still has ${openDues} unpaid due(s) in this department`);
    }
    item.status = 'cleared';
  } else {
    item.status = 'dues';
  }
  item.remark = remark || (action === 'clear' ? 'Cleared' : 'Dues outstanding');
  item.actionedBy = req.user._id;
  item.actionedAt = new Date();

  request.refreshStatus();
  await request.save();

  const dept = await Department.findById(deptId);
  await audit(req.user, action === 'clear' ? 'CLEARANCE_CLEARED' : 'CLEARANCE_FLAGGED', request._id, `${dept?.name}: ${item.remark}`);
  await sendMail(
    request.student.email,
    `ClearPath: ${dept?.name} ${action === 'clear' ? 'cleared you' : 'flagged dues'}`,
    `Hi ${request.student.name},\n\n${dept?.name} has ${action === 'clear' ? 'cleared' : 'flagged'} your clearance request.\nRemark: ${item.remark}\n\nLog in to ClearPath to see details.`
  );

  if (request.status === 'completed') {
    const cert = await issueCertificate(request);
    await audit(req.user, 'CERTIFICATE_ISSUED', cert._id, cert.certificateNo);
    await sendMail(
      request.student.email,
      'ClearPath: Your clearance is complete',
      `Congratulations ${request.student.name}! All departments have cleared you. Certificate No: ${cert.certificateNo}. Download it from your dashboard.`
    );
  }

  res.json({ message: `Item ${action === 'clear' ? 'cleared' : 'flagged'}`, status: request.status });
});
