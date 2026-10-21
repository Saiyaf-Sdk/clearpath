const StoredFile = require('../models/StoredFile');
const { asyncHandler, ApiError } = require('../middleware/error');

// GET /api/files/:key  – serves an uploaded receipt or logo.
// The key is a 36-character random string, so links cannot be guessed.
exports.serve = asyncHandler(async (req, res) => {
  if (!/^[a-f0-9]{36}$/.test(req.params.key)) throw new ApiError(404, 'File not found');
  const file = await StoredFile.findOne({ key: req.params.key });
  if (!file) throw new ApiError(404, 'File not found');
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', file.size);
  res.setHeader('Cache-Control', file.kind === 'logo' ? 'public, max-age=86400' : 'private, max-age=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // An uploaded SVG opened directly must never run scripts
  if (file.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  const safeName = (file.name || 'file').replace(/[^\w.\- ]/g, '_');
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.end(file.data);
});
