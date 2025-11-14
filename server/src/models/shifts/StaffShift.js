import mongoose from 'mongoose';

const staffShiftSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    shiftTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftTemplate' },
    customStart: { type: String },
    customEnd: { type: String },
    breaks: [
      {
        start: String,
        end: String,
      },
    ],
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'swapped'],
      default: 'scheduled',
    },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    swapRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSwapRequest' },
  },
  {
    timestamps: true,
  },
);

staffShiftSchema.index({ staff: 1, date: 1 });
staffShiftSchema.index({ date: 1 });

export default mongoose.model('StaffShift', staffShiftSchema);
