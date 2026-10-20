const mongoose = require('mongoose');

const dueSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    university: { type: mongoose.Schema.Types.ObjectId, ref: 'University', index: true },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0, 'Amount cannot be negative'] },
    description: { type: String, required: [true, 'Description is required'], trim: true },
    status: {
      type: String,
      enum: ['unpaid', 'receipt-submitted', 'paid', 'waived'],
      default: 'unpaid',
    },
    receiptUrl: String,
    officerNote: { type: String, trim: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Due', dueSchema);
