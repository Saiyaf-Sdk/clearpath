const ClearanceRequest = require('../models/ClearanceRequest');
const Department = require('../models/Department');
const Due = require('../models/Due');
const Certificate = require('../models/Certificate');
const { asyncHandler, ApiError } = require('../middleware/error');
const { audit, notify, notifyOfficers, issueCertificate } = require('../utils/helpers');
const { uniOf, facOf, facultyScope } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const OPEN_DUE = ['unpaid', 'receipt-submitted'];
const REASONS = ['graduation', 'transfer', 'withdrawal', 'other'];

const populateRequest = (q) =>
  q.populate('student', 'name email regNo faculty avatarUrl').populate('items.department', 'name code order faculty').populate('items.actionedBy', 'name');

const progressOf = (items = []) => ({
  total: items.length,
  cleared: items.filter((i) => i.status === 'cleared').length,
  dues: items.filter((i) => i.status === 'dues').length,
});

// POST /api/clearances  (student)
exports.createRequest = asyncHandler(async (req, res) => {
  const { reason, note } = req.body;
  if (!REASONS.includes(reason)) throw new ApiError(400, 'Please choose a valid reason');
  if (note && String(note).length > 500) throw new ApiError(400, 'The note can be at most 500 characters');

  const open = await ClearanceRequest.findOne({ student: req.user._id, status: { $in: ['pending', 'in-progress'] } });
  if (open) throw new ApiError(400, 'You already have an active clearance request');

  // The university's central offices plus the offices of the student's own faculty take part
  const faculty = facOf(req);
  const departments = await Department.find({
    isActive: true,
    university: uniOf(req),
    $or: [{ faculty: null }, ...(faculty ? [{ faculty }] : [])],
  })
    .populate('faculty', 'name')
    .sort('order name');
  // faculty offices first, then the central offices, each in their display order
  departments.sort((a, b) => (a.faculty ? 0 : 1) - (b.faculty ? 0 : 1) || a.order - b.order);
  if (departments.length === 0) throw new ApiError(400, 'No offices are set up for your faculty yet. Contact your faculty admin.');

  // Departments where the student already owes something start as "dues"
  const owing = (await Due.distinct('department', { student: req.user._id, status: { $in: OPEN_DUE } })).map(String);

  const request = new ClearanceRequest({
    student: req.user._id,
    university: uniOf(req),
    faculty: faculty || undefined,
    reason,
    note,
    items: departments.map((d) => ({
      department: d._id,
      status: owing.includes(String(d._id)) ? 'dues' : 'pending',
      remark: owing.includes(String(d._id)) ? 'Outstanding dues found' : undefined,
    })),
  });
  request.refreshStatus();
  await request.save();

  await audit(req.user, 'CLEARANCE_SUBMITTED', request._id, `${req.user.regNo || req.user.name} · ${reason}`);
  await notifyOfficers(departments.map((d) => d._id), {
    title: 'New clearance request',
    body: `${req.user.name} (${req.user.regNo || 'student'}) asked for ${reason} clearance.`,
    link: `/officer/requests?open=${request._id}`,
    university: uniOf(req),
  });
  await notify(req.user, {
    title: 'Request submitted',
    body: `Your ${reason} clearance request was sent to ${departments.length} offices.`,
    link: '/student/clearance',
    kind: 'success',
    university: uniOf(req),
  });

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
    return { ...r, progress: progressOf(r.items), certificate: cert ? { certificateNo: cert.certificateNo, issuedAt: cert.issuedAt } : null };
  });
  res.json(result);
});

// PATCH /api/clearances/:id  body: { reason, note }  (student – only before any department has decided)
exports.updateRequest = asyncHandler(async (req, res) => {
  const request = await ClearanceRequest.findOne({ _id: req.params.id, student: req.user._id });
  if (!request) throw new ApiError(404, 'Request not found');
  if (['completed', 'cancelled'].includes(request.status)) throw new ApiError(400, `A ${request.status} request cannot be edited`);
  if (request.items.some((i) => i.actionedBy)) {
    throw new ApiError(400, 'A department has already reviewed this request, so it can no longer be edited');
  }
  if (req.body.reason !== undefined) {
    if (!REASONS.includes(req.body.reason)) throw new ApiError(400, 'Please choose a valid reason');
    request.reason = req.body.reason;
  }
  if (req.body.note !== undefined) {
    const note = String(req.body.note || '').trim();
    if (note.length > 500) throw new ApiError(400, 'The note can be at most 500 characters');
    request.note = note || undefined;
  }
  await request.save();
  await audit(req.user, 'CLEARANCE_UPDATED', request._id, `${req.user.regNo || req.user.name} · ${request.reason}`);
  res.json(await populateRequest(ClearanceRequest.findById(request._id)));
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
  await audit(req.user, 'CLEARANCE_CANCELLED', request._id, req.user.regNo || req.user.name);
  res.json({ message: 'Request cancelled' });
});

// GET /api/clearances/department?status=pending&search=abc  (officer: own dept, admin: ?department=<id>)
exports.getDepartmentRequests = asyncHandler(async (req, res) => {
  const deptId = ['admin', 'facultyadmin'].includes(req.user.role) ? req.query.department : req.user.department?._id;
  if (!deptId) throw new ApiError(400, 'No department assigned to this account');
  if (!(await Department.exists({ _id: deptId, university: uniOf(req) }))) throw new ApiError(404, 'Department not found');

  const itemFilter = { department: deptId };
  if (req.query.status) itemFilter.status = req.query.status;

  const requests = await ClearanceRequest.find({
    university: uniOf(req),
    status: { $ne: 'cancelled' },
    items: { $elemMatch: itemFilter },
  })
    .populate('student', 'name email regNo faculty phone avatarUrl')
    .populate('items.department', 'name code order faculty')
    .sort('-createdAt')
    .limit(500)
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
    completedAt: r.completedAt,
    progress: progressOf(r.items),
    otherDepartments: r.items
      .filter((i) => String(i.department?._id) !== String(deptId))
      .sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0))
      .map((i) => ({ name: i.department?.name, code: i.department?.code, status: i.status })),
    item: (() => {
      const it = r.items.find((i) => String(i.department?._id) === String(deptId));
      return it ? { ...it, department: it.department?._id } : null;
    })(),
    dues: dues.filter((d) => String(d.student) === String(r.student?._id)),
  }));
  res.json(result);
});

// PATCH /api/clearances/:id/items/:deptId  body: { action: 'clear' | 'flag', remark }
exports.actionItem = asyncHandler(async (req, res) => {
  const { id, deptId } = req.params;
  const { action } = req.body;
  const remark = String(req.body.remark || '').trim().slice(0, 300);
  if (!['clear', 'flag'].includes(action)) throw new ApiError(400, 'Action must be "clear" or "flag"');

  if (req.user.role === 'officer' && String(req.user.department?._id) !== String(deptId)) {
    throw new ApiError(403, 'You can only act on your own department');
  }

  const request = await ClearanceRequest.findOne({ _id: id, university: uniOf(req), ...facultyScope(req, 'faculty') }).populate('student', 'name email regNo avatarUrl');
  if (!request) throw new ApiError(404, 'Request not found');
  if (request.status === 'cancelled') throw new ApiError(400, 'This request was cancelled');
  if (request.status === 'completed') throw new ApiError(400, 'This request is already completed and its certificate issued');

  const item = request.items.find((i) => String(i.department) === String(deptId));
  if (!item) throw new ApiError(404, 'Department item not found on this request');
  if (action === 'flag' && !remark) throw new ApiError(400, 'Please tell the student what is outstanding');

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

  // Two officers may clear the last two departments at the same moment. Each save only
  // writes its own department's item, so re-read the request and work out the final status
  // from what is really stored now.
  const fresh = await ClearanceRequest.findById(request._id);
  fresh.refreshStatus();
  if (fresh.isModified()) await fresh.save();
  request.status = fresh.status;

  const dept = await Department.findById(deptId);
  const student = request.student;
  await audit(req.user, action === 'clear' ? 'CLEARANCE_CLEARED' : 'CLEARANCE_FLAGGED', request._id, `${student.regNo} · ${dept?.name}: ${item.remark}`);
  await notify(student, {
    title: action === 'clear' ? `${dept?.name} cleared you` : `${dept?.name} flagged an issue`,
    body: item.remark,
    link: action === 'clear' ? '/student/clearance' : '/student/dues',
    kind: action === 'clear' ? 'success' : 'warning',
    university: request.university,
  });
  await sendMail(
    student.email,
    `ClearPath: ${dept?.name} ${action === 'clear' ? 'cleared you' : 'flagged dues'}`,
    `Hi ${student.name},\n\n${dept?.name} has ${action === 'clear' ? 'cleared' : 'flagged'} your clearance request.\nRemark: ${item.remark}\n\nLog in to ClearPath to see details.`
  );

  let certificate = null;
  if (request.status === 'completed') {
    certificate = await issueCertificate(request, req.user.university?.code);
    await audit(req.user, 'CERTIFICATE_ISSUED', certificate._id, `${student.regNo} · ${certificate.certificateNo}`);
    await notify(student, {
      title: 'Clearance complete – certificate issued',
      body: `Certificate ${certificate.certificateNo} is ready to download.`,
      link: '/student/certificate',
      kind: 'success',
      university: request.university,
    });
    await sendMail(
      student.email,
      'ClearPath: Your clearance is complete',
      `Congratulations ${student.name}! All departments have cleared you. Certificate No: ${certificate.certificateNo}. Download it from your dashboard.`
    );
  }

  res.json({
    message: `Item ${action === 'clear' ? 'cleared' : 'flagged'}`,
    status: request.status,
    certificateNo: certificate?.certificateNo,
  });
});
