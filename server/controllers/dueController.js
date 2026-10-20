const fs = require('fs');
const path = require('path');
const Due = require('../models/Due');
const User = require('../models/User');
const ClearanceRequest = require('../models/ClearanceRequest');
const { asyncHandler, ApiError } = require('../middleware/error');
const { audit } = require('../utils/helpers');
const { uniOf } = require('../middleware/auth');
const Department = require('../models/Department');
const { sendMail } = require('../utils/mailer');

// When a due is added, mark the department item on any active request as "dues"
const flagActiveRequest = async (studentId, deptId, remark) => {
  const request = await ClearanceRequest.findOne({ student: studentId, status: { $in: ['pending', 'in-progress'] } });
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
  const dues = await Due.find(filter).populate('student', 'name regNo email faculty').sort('-updatedAt');
  res.json(dues);
});

// POST /api/dues  body: { regNo, amount, description }  (officer)
exports.addDue = asyncHandler(async (req, res) => {
  const deptId = deptOf(req);
  if (!deptId) throw new ApiError(400, 'No department assigned');
  const { regNo, amount, description } = req.body;
  if (!regNo || amount === undefined || !description) throw new ApiError(400, 'Registration number, amount and description are required');

  if (!(await Department.exists({ _id: deptId, university: uniOf(req) }))) throw new ApiError(404, 'Department not found');
  // Look the student up inside this university only
  const student = await User.findOne({ regNo: String(regNo).toUpperCase().trim(), role: 'student', university: uniOf(req) });
  if (!student) throw new ApiError(404, `No student found with registration number ${regNo}`);

  const due = await Due.create({ student: student._id, department: deptId, university: uniOf(req), amount: Number(amount), description, addedBy: req.user._id });
  await flagActiveRequest(student._id, deptId, `Due added: ${description}`);
  await audit(req.user, 'DUE_ADDED', due._id, `${student.regNo}: ${description} (LKR ${amount})`);
  await sendMail(student.email, 'ClearPath: New due added', `A due of LKR ${amount} was added: ${description}. Log in to ClearPath to pay and upload your receipt.`);

  res.status(201).json(await due.populate('student', 'name regNo email'));
});

// POST /api/dues/:id/receipt  (student, multipart field "receipt")
exports.uploadReceipt = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Please attach a receipt file');
  const due = await Due.findOne({ _id: req.params.id, student: req.user._id });
  if (!due) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(404, 'Due not found');
  }
  if (due.status === 'paid' || due.status === 'waived') {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, 'This due is already settled');
  }

  // Remove an older receipt file if one exists
  if (due.receiptUrl) fs.unlink(path.join(__dirname, '..', due.receiptUrl), () => {});

  due.receiptUrl = `/uploads/${req.file.filename}`;
  due.status = 'receipt-submitted';
  due.officerNote = undefined;
  await due.save();
  await audit(req.user, 'RECEIPT_UPLOADED', due._id);
  res.json(due);
});

// PATCH /api/dues/:id/verify  body: { approve: true|false, note }  (officer)
exports.verifyDue = asyncHandler(async (req, res) => {
  const due = await Due.findOne({ _id: req.params.id, university: uniOf(req) }).populate('student', 'name email regNo');
  if (!due) throw new ApiError(404, 'Due not found');
  if (req.user.role === 'officer' && String(due.department) !== String(req.user.department?._id)) {
    throw new ApiError(403, 'This due belongs to another department');
  }
  const { approve, note, waive } = req.body;

  if (waive) {
    due.status = 'waived';
    due.paidAt = new Date();
  } else if (approve) {
    due.status = 'paid';
    due.paidAt = new Date();
  } else {
    due.status = 'unpaid';
  }
  due.officerNote = note;
  due.verifiedBy = req.user._id;
  await due.save();

  await audit(req.user, `DUE_${due.status.toUpperCase()}`, due._id, note);
  await sendMail(
    due.student.email,
    `ClearPath: Due ${due.status === 'unpaid' ? 'receipt rejected' : 'settled'}`,
    `Your due "${due.description}" is now ${due.status}.${note ? ` Note: ${note}` : ''}`
  );
  res.json(due);
});

// DELETE /api/dues/:id  (officer - remove a due added by mistake)
exports.deleteDue = asyncHandler(async (req, res) => {
  const due = await Due.findOne({ _id: req.params.id, university: uniOf(req) });
  if (!due) throw new ApiError(404, 'Due not found');
  if (req.user.role === 'officer' && String(due.department) !== String(req.user.department?._id)) {
    throw new ApiError(403, 'This due belongs to another department');
  }
  await due.deleteOne();
  await audit(req.user, 'DUE_DELETED', due._id, due.description);
  res.json({ message: 'Due deleted' });
});
