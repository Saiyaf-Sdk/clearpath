const Due = require('../models/Due');
const User = require('../models/User');
const ClearanceRequest = require('../models/ClearanceRequest');
const Department = require('../models/Department');
const { asyncHandler, ApiError } = require('../middleware/error');
const { audit, notify, notifyOfficers } = require('../utils/helpers');
const { uniOf } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const { saveUpload, removeByUrl } = require('../utils/files');

const OPEN_DUE = ['unpaid', 'receipt-submitted'];

const activeRequestOf = (studentId) => ClearanceRequest.findOne({ student: studentId, status: { $in: ['pending', 'in-progress'] } });

// When a due is added, mark the department item on any active request as "dues"
const flagActiveRequest = async (studentId, deptId, remark) => {
  const request = await activeRequestOf(studentId);
  if (!request) return;
  const item = request.items.find((i) => String(i.department) === String(deptId));
  if (item && item.status !== 'dues') {
    item.status = 'dues';
    item.remark = remark;
    item.actionedAt = new Date();
    request.refreshStatus();
    await request.save();
  }
};

// When the last open due of a department is settled, send the item back to the officer's
// "pending" queue so they can do the final check and clear the student.
const reopenIfSettled = async (studentId, deptId) => {
  const open = await Due.countDocuments({ student: studentId, department: deptId, status: { $in: OPEN_DUE } });
  if (open > 0) return false;
  const request = await activeRequestOf(studentId);
  if (!request) return false;
  const item = request.items.find((i) => String(i.department) === String(deptId));
  if (item && item.status === 'dues') {
    item.status = 'pending';
    item.remark = 'Dues settled – waiting for final check';
    item.actionedAt = new Date();
    request.refreshStatus();
    await request.save();
    return true;
  }
  return false;
};

const deptOf = (req) => (req.user.role === 'admin' ? req.body.department || req.query.department : req.user.department?._id);

// GET /api/dues/my  (student)
exports.getMyDues = asyncHandler(async (req, res) => {
  const dues = await Due.find({ student: req.user._id }).populate('department', 'name code').sort('-createdAt');
  res.json(dues);
});

// GET /api/dues/department?status=unpaid  (officer)
exports.getDepartmentDues = asyncHandler(async (req, res) => {
  const deptId = deptOf(req);
  if (!deptId) throw new ApiError(400, 'No department assigned');
  const filter = { department: deptId, university: uniOf(req) };
  if (req.query.status) filter.status = req.query.status;
  const dues = await Due.find(filter)
    .populate('student', 'name regNo email faculty')
    .populate('addedBy', 'name')
    .populate('verifiedBy', 'name')
    .sort('-updatedAt')
    .limit(1000);
  res.json(dues);
});

// GET /api/dues/lookup?regNo=EG/2021/4501  (officer) – confirms who a registration number belongs to
exports.lookupStudent = asyncHandler(async (req, res) => {
  const regNo = String(req.query.regNo || '').toUpperCase().trim();
  if (!regNo) throw new ApiError(400, 'Registration number is required');
  const student = await User.findOne({ regNo, role: 'student', university: uniOf(req) }).select('name regNo faculty email').lean();
  if (!student) throw new ApiError(404, `No student with registration number ${regNo}`);
  const deptId = deptOf(req);
  const [openDues, active] = await Promise.all([
    deptId ? Due.countDocuments({ student: student._id, department: deptId, status: { $in: OPEN_DUE } }) : 0,
    ClearanceRequest.findOne({ student: student._id, status: { $in: ['pending', 'in-progress'] } }).select('status reason createdAt').lean(),
  ]);
  res.json({ ...student, openDues, activeRequest: active });
});

// POST /api/dues  body: { regNo, amount, description }  (officer)
exports.addDue = asyncHandler(async (req, res) => {
  const deptId = deptOf(req);
  if (!deptId) throw new ApiError(400, 'No department assigned');
  const { regNo } = req.body;
  const amount = Number(req.body.amount);
  const description = String(req.body.description || '').trim();
  if (!regNo || !description) throw new ApiError(400, 'Registration number, amount and description are required');
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'Amount must be more than zero');
  if (amount > 10000000) throw new ApiError(400, 'Amount looks too large');

  const dept = await Department.findOne({ _id: deptId, university: uniOf(req) });
  if (!dept) throw new ApiError(404, 'Department not found');
  // Look the student up inside this university only
  const student = await User.findOne({ regNo: String(regNo).toUpperCase().trim(), role: 'student', university: uniOf(req) });
  if (!student) throw new ApiError(404, `No student found with registration number ${String(regNo).toUpperCase()}`);

  const due = await Due.create({
    student: student._id,
    department: deptId,
    university: uniOf(req),
    amount: Math.round(amount * 100) / 100,
    description,
    addedBy: req.user._id,
  });
  await flagActiveRequest(student._id, deptId, `Due added: ${description}`);
  await audit(req.user, 'DUE_ADDED', due._id, `${student.regNo}: ${description} (LKR ${due.amount})`);
  await notify(student, {
    title: `New due from ${dept.name}`,
    body: `LKR ${due.amount.toLocaleString('en-LK')} – ${description}`,
    link: '/student/dues',
    kind: 'warning',
    university: uniOf(req),
  });
  await sendMail(student.email, 'ClearPath: New due added', `A due of LKR ${due.amount} was added by ${dept.name}: ${description}. Log in to ClearPath to pay and upload your receipt.`);

  res.status(201).json(await due.populate('student', 'name regNo email faculty'));
});

// POST /api/dues/:id/receipt  (student, multipart field "receipt")
exports.uploadReceipt = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Please attach a receipt file');
  const due = await Due.findOne({ _id: req.params.id, student: req.user._id }).populate('department', 'name');
  if (!due) throw new ApiError(404, 'Due not found');
  if (due.status === 'paid' || due.status === 'waived') throw new ApiError(400, 'This due is already settled');

  const url = await saveUpload(req.file, { kind: 'receipt', owner: req.user._id, university: uniOf(req) });
  // Replace an older receipt if one exists
  await removeByUrl(due.receiptUrl);

  due.receiptUrl = url;
  due.receiptName = req.file.originalname;
  due.receiptAt = new Date();
  due.status = 'receipt-submitted';
  due.officerNote = undefined;
  await due.save();

  await audit(req.user, 'RECEIPT_UPLOADED', due._id, `${req.user.regNo}: ${due.description}`);
  await notifyOfficers(due.department._id, {
    title: 'Receipt to verify',
    body: `${req.user.name} (${req.user.regNo}) uploaded a receipt for LKR ${due.amount.toLocaleString('en-LK')}.`,
    link: '/officer/receipts',
    university: uniOf(req),
  });
  res.json(due);
});

// PATCH /api/dues/:id/verify  body: { approve: true|false, waive, note }  (officer)
exports.verifyDue = asyncHandler(async (req, res) => {
  const due = await Due.findOne({ _id: req.params.id, university: uniOf(req) }).populate('student', 'name email regNo').populate('department', 'name');
  if (!due) throw new ApiError(404, 'Due not found');
  if (req.user.role === 'officer' && String(due.department._id) !== String(req.user.department?._id)) {
    throw new ApiError(403, 'This due belongs to another department');
  }
  if (!OPEN_DUE.includes(due.status)) throw new ApiError(400, `This due is already ${due.status}`);
  const { approve, waive } = req.body;
  const note = String(req.body.note || '').trim().slice(0, 300) || undefined;

  if (waive) {
    due.status = 'waived';
    due.paidAt = new Date();
  } else if (approve) {
    due.status = 'paid';
    due.paidAt = new Date();
  } else {
    if (due.status !== 'receipt-submitted') throw new ApiError(400, 'There is no receipt to reject');
    due.status = 'unpaid';
  }
  due.officerNote = note;
  due.verifiedBy = req.user._id;
  await due.save();

  const reopened = due.status === 'unpaid' ? false : await reopenIfSettled(due.student._id, due.department._id);

  await audit(req.user, `DUE_${due.status.toUpperCase()}`, due._id, `${due.student.regNo}: ${due.description}${note ? ` – ${note}` : ''}`);
  const label = { paid: 'marked as paid', waived: 'waived', unpaid: 'receipt rejected' }[due.status];
  await notify(due.student, {
    title: due.status === 'unpaid' ? 'Receipt rejected' : `Due ${label}`,
    body: `${due.department.name}: ${due.description}${note ? ` – ${note}` : ''}`,
    link: '/student/dues',
    kind: due.status === 'unpaid' ? 'warning' : 'success',
    university: due.university,
  });
  await sendMail(
    due.student.email,
    `ClearPath: Due ${due.status === 'unpaid' ? 'receipt rejected' : 'settled'}`,
    `Your due "${due.description}" is now ${due.status}.${note ? ` Note: ${note}` : ''}`
  );
  res.json({ due, reopened });
});

// PATCH /api/dues/:id  body: { amount, description }  (officer – correct a due that isn't settled yet)
exports.updateDue = asyncHandler(async (req, res) => {
  const due = await Due.findOne({ _id: req.params.id, university: uniOf(req) }).populate('student', 'name email regNo').populate('department', 'name');
  if (!due) throw new ApiError(404, 'Due not found');
  if (req.user.role === 'officer' && String(due.department._id) !== String(req.user.department?._id)) {
    throw new ApiError(403, 'This due belongs to another department');
  }
  if (!OPEN_DUE.includes(due.status)) throw new ApiError(400, 'Settled dues are kept for the record and cannot be edited');

  const before = `${due.description} (LKR ${due.amount})`;
  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, 'Amount must be more than zero');
    if (amount > 10000000) throw new ApiError(400, 'Amount looks too large');
    due.amount = Math.round(amount * 100) / 100;
  }
  if (req.body.description !== undefined) {
    const description = String(req.body.description).trim();
    if (!description) throw new ApiError(400, 'Description is required');
    if (description.length > 200) throw new ApiError(400, 'Description can be at most 200 characters');
    due.description = description;
  }
  if (!due.isModified()) throw new ApiError(400, 'Nothing to change');
  await due.save();

  await audit(req.user, 'DUE_UPDATED', due._id, `${due.student.regNo}: ${before} → ${due.description} (LKR ${due.amount})`);
  await notify(due.student, {
    title: `${due.department.name} updated a due`,
    body: `${due.description} – now LKR ${due.amount.toLocaleString('en-LK')}`,
    link: '/student/dues',
    kind: 'warning',
    university: due.university,
  });
  res.json(due);
});

// DELETE /api/dues/:id  (officer - remove a due added by mistake)
exports.deleteDue = asyncHandler(async (req, res) => {
  const due = await Due.findOne({ _id: req.params.id, university: uniOf(req) }).populate('student', 'regNo');
  if (!due) throw new ApiError(404, 'Due not found');
  if (req.user.role === 'officer' && String(due.department) !== String(req.user.department?._id)) {
    throw new ApiError(403, 'This due belongs to another department');
  }
  if (!OPEN_DUE.includes(due.status)) throw new ApiError(400, 'Settled dues are kept for the record and cannot be deleted');
  await due.deleteOne();
  await removeByUrl(due.receiptUrl);
  await reopenIfSettled(due.student._id, due.department);
  await audit(req.user, 'DUE_DELETED', due._id, `${due.student?.regNo}: ${due.description}`);
  res.json({ message: 'Due deleted' });
});
