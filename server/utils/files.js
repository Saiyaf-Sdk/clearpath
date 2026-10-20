const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const StoredFile = require('../models/StoredFile');

const PREFIX = '/api/files/';

// Saves an uploaded file (from multer's memory storage) and returns its public URL
const saveUpload = async (file, { kind = 'other', owner, university } = {}) => {
  const key = crypto.randomBytes(18).toString('hex');
  await StoredFile.create({
    key,
    kind,
    name: file.originalname,
    contentType: file.mimetype,
    size: file.size,
    data: file.buffer,
    owner,
    university,
  });
  return `${PREFIX}${key}`;
};

// Deletes a stored file by its URL (silently ignores anything that isn't ours)
const removeByUrl = async (url) => {
  if (!url) return;
  try {
    if (url.startsWith(PREFIX)) await StoredFile.deleteOne({ key: url.slice(PREFIX.length) });
    else if (url.startsWith('/uploads/')) fs.unlink(path.join(__dirname, '..', url), () => {});
  } catch (err) {
    console.error('File delete failed:', err.message);
  }
};

// Reads a stored file's bytes by URL (used to put the university logo on the PDF certificate)
const readByUrl = async (url) => {
  if (!url) return null;
  if (url.startsWith(PREFIX)) {
    const f = await StoredFile.findOne({ key: url.slice(PREFIX.length) });
    return f ? { buffer: Buffer.from(f.data), contentType: f.contentType } : null;
  }
  if (url.startsWith('/uploads/')) {
    const file = path.join(__dirname, '..', url);
    return fs.existsSync(file) ? { buffer: fs.readFileSync(file), contentType: '' } : null;
  }
  return null;
};

module.exports = { saveUpload, removeByUrl, readByUrl, PREFIX };
