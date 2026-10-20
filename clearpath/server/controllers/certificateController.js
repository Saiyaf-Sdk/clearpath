const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Certificate = require('../models/Certificate');
const ClearanceRequest = require('../models/ClearanceRequest');
const { asyncHandler, ApiError } = require('../middleware/error');

const verifyUrl = (no) => `${(process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()}/verify/${no}`;

// GET /api/certificates/:requestId/pdf  (student who owns it, or admin)
exports.downloadPdf = asyncHandler(async (req, res) => {
  const cert = await Certificate.findOne({ request: req.params.requestId }).populate('student', 'name regNo faculty email');
  if (!cert) throw new ApiError(404, 'Certificate not issued yet');
  if (req.user.role === 'student' && String(cert.student._id) !== String(req.user._id)) {
    throw new ApiError(403, 'Not your certificate');
  }
  const request = await ClearanceRequest.findById(cert.request).populate('items.department', 'name order');
  const qrPng = await QRCode.toBuffer(verifyUrl(cert.certificateNo), { width: 300, margin: 1 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="ClearPath-${cert.certificateNo}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  const navy = '#1e3a8a';
  const W = doc.page.width;

  // Border + header
  doc.rect(25, 25, W - 50, doc.page.height - 50).lineWidth(2).stroke(navy);
  doc.fillColor(navy).fontSize(26).font('Helvetica-Bold').text('ClearPath', 50, 60, { align: 'center' });
  doc.fillColor('#475569').fontSize(11).font('Helvetica').text('University Digital Clearance & No-Dues Management System', { align: 'center' });
  doc.moveDown(2);
  doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('CLEARANCE CERTIFICATE', { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(12).font('Helvetica').fillColor('#0f172a')
    .text('This is to certify that', { align: 'center' })
    .moveDown(0.5)
    .font('Helvetica-Bold').fontSize(16).text(cert.student.name, { align: 'center' })
    .font('Helvetica').fontSize(12)
    .text(`Registration No: ${cert.student.regNo || '-'}   |   Faculty: ${cert.student.faculty || '-'}`, { align: 'center' })
    .moveDown(0.8)
    .text(
      `has been cleared by all university departments and has no outstanding dues for the purpose of ${request?.reason || 'clearance'}.`,
      70, doc.y, { align: 'center', width: W - 140 }
    );

  // Department table
  doc.moveDown(1.5);
  let y = doc.y;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(navy);
  doc.text('Department', 90, y).text('Status', 300, y).text('Cleared on', 400, y);
  y += 18;
  doc.moveTo(90, y - 4).lineTo(W - 90, y - 4).lineWidth(0.5).stroke('#94a3b8');
  doc.font('Helvetica').fillColor('#0f172a');
  const items = (request?.items || []).slice().sort((a, b) => (a.department?.order || 0) - (b.department?.order || 0));
  items.forEach((it) => {
    doc.text(it.department?.name || '-', 90, y)
      .text('Cleared', 300, y)
      .text(it.actionedAt ? new Date(it.actionedAt).toLocaleDateString('en-GB') : '-', 400, y);
    y += 18;
  });

  // QR + certificate details
  const qrY = Math.max(y + 30, 560);
  doc.image(qrPng, W / 2 - 60, qrY, { width: 120 });
  doc.fontSize(10).fillColor('#475569')
    .text(`Certificate No: ${cert.certificateNo}`, 50, qrY + 130, { align: 'center', width: W - 100 })
    .text(`Issued on: ${new Date(cert.issuedAt).toLocaleDateString('en-GB')}`, { align: 'center', width: W - 100 })
    .text(`Verify at: ${verifyUrl(cert.certificateNo)}`, { align: 'center', width: W - 100 });

  doc.end();
});

// GET /api/verify/:certificateNo  (public)
exports.verify = asyncHandler(async (req, res) => {
  const cert = await Certificate.findOne({ certificateNo: req.params.certificateNo.toUpperCase() }).populate('student', 'name regNo faculty');
  if (!cert) return res.status(404).json({ valid: false, message: 'No certificate found with this number' });
  const request = await ClearanceRequest.findById(cert.request).select('reason completedAt');
  res.json({
    valid: !cert.isRevoked,
    certificateNo: cert.certificateNo,
    issuedAt: cert.issuedAt,
    reason: request?.reason,
    student: { name: cert.student.name, regNo: cert.student.regNo, faculty: cert.student.faculty },
    message: cert.isRevoked ? 'This certificate has been revoked' : 'Certificate is valid',
  });
});
