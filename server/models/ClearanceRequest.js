const mongoose = require('mongoose');

// One item per department inside a clearance request
const itemSchema = new mongoose.Schema(
  {
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    status: { type: String, enum: ['pending', 'cleared', 'dues'], default: 'pending' },
    remark: { type: String, trim: true },
    actionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actionedAt: Date,
  },
  { _id: false }
);

const clearanceRequestSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', index: true },
    reason: {
      type: String,
      enum: ['graduation', 'transfer', 'withdrawal', 'other'],
      required: [true, 'Reason is required'],
    },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    items: [itemSchema],
    completedAt: Date,
  },
  { timestamps: true }
);

clearanceRequestSchema.index({ 'items.department': 1, 'items.status': 1 });

// Recalculate overall status from the department items
clearanceRequestSchema.methods.refreshStatus = function refreshStatus() {
  if (this.status === 'cancelled') return;
  const total = this.items.length;
  const cleared = this.items.filter((i) => i.status === 'cleared').length;
  const touched = this.items.some((i) => i.status !== 'pending');

  if (total > 0 && cleared === total) {
    this.status = 'completed';
    if (!this.completedAt) this.completedAt = new Date();
  } else {
    this.status = touched ? 'in-progress' : 'pending';
    this.completedAt = undefined;
  }
};

module.exports = mongoose.model('ClearanceRequest', clearanceRequestSchema);
