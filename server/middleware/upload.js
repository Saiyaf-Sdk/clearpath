const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { ApiError } = require('./error');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `receipt-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new ApiError(400, 'Only JPG, PNG or PDF files are allowed'));
    cb(null, true);
  },
});

module.exports = upload;

// University logos (platform admin): PNG or JPG, max 1 MB – these formats also work in the PDF certificate
const logoDir = path.join(__dirname, '..', 'uploads', 'logos');
const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      require('fs').mkdirSync(logoDir, { recursive: true });
      cb(null, logoDir);
    },
    filename: (req, file, cb) => cb(null, `logo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) return cb(new ApiError(400, 'Logo must be a PNG or JPG file'));
    cb(null, true);
  },
});

module.exports.logoUpload = logoUpload;
