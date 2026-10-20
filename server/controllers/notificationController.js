const Notification = require('../models/Notification');
const { asyncHandler } = require('../middleware/error');

// GET /api/notifications?limit=30  – latest notifications + unread count
exports.list = asyncHandler(async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  const [items, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort('-createdAt').limit(limit).lean(),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ items, unread });
});

// PATCH /api/notifications/read-all
exports.readAll = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'All notifications marked as read' });
});

// PATCH /api/notifications/:id/read
exports.readOne = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true });
  res.json({ message: 'Marked as read' });
});

// DELETE /api/notifications  – clear all read notifications
exports.clearRead = asyncHandler(async (req, res) => {
  await Notification.deleteMany({ user: req.user._id, read: true });
  res.json({ message: 'Cleared' });
});
