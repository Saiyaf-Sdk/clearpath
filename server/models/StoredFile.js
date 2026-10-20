const mongoose = require('mongoose');

// Uploaded files (payment receipts, university logos) are kept in MongoDB, not on the server disk.
// Hosting platforms such as Render wipe the disk on every restart, so this keeps uploads safe.
// Files are served at /api/files/<key>, where key is a long random string that cannot be guessed.
const storedFileSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['receipt', 'logo', 'other'], default: 'other' },
    name: { type: String, trim: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StoredFile', storedFileSchema);
