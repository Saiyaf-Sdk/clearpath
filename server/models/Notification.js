const mongoose = require('mongoose');

// In-app notifications (the bell in the top bar). Emails are sent as well when SMTP is configured.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    link: { type: String, trim: true }, // where clicking the notification takes you, e.g. /student/dues
    kind: { type: String, enum: ['info', 'success', 'warning'], default: 'info' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
