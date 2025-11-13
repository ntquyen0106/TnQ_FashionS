import mongoose from 'mongoose';

const shiftTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, default: null },
    color: { type: String, default: '#6366F1' },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: '' },
  },
  {
    timestamps: true,
  },
);

shiftTemplateSchema.index({ name: 1 }, { unique: true });

export default mongoose.model('ShiftTemplate', shiftTemplateSchema);
