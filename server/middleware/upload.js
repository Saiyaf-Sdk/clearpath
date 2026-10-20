const path = require('path');
const multer = require('multer');
const { ApiError } = require('./error');

// Files are kept in memory and then saved to MongoDB (see utils/files.js), so uploads
// survive restarts on hosting platforms with a temporary disk.
const storage = multer.memoryStorage();

const RECEIPT_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
const LOGO_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

const filter = (types, message) => (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!types[ext]) return cb(new ApiError(400, message));
  // Trust the extension check, not the browser's claimed type
  file.mimetype = types[ext];
  cb(null, true);
};

// Payment receipts: JPG, PNG or PDF, max 3 MB
const upload = multer({
  storage,
  defParamCharset: 'utf8', // keep Sinhala / Tamil file names readable
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: filter(RECEIPT_TYPES, 'Only JPG, PNG or PDF files are allowed'),
});

module.exports = upload;

// University logos (platform admin): PNG or JPG, max 1 MB – these formats also work in the PDF certificate
module.exports.logoUpload = multer({
  storage,
  defParamCharset: 'utf8',
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: filter(LOGO_TYPES, 'Logo must be a PNG or JPG file'),
});
