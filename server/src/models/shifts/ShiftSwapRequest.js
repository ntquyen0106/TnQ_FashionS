import mongoose from 'mongoose';

const shiftSwapRequestSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromShift: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffShift', required: true },
    targetShift: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffShift' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    reason: { type: String, default: '' },
    adminNote: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

shiftSwapRequestSchema.index({ requester: 1, status: 1 });

export default mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema);
