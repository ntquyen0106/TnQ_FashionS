import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffShift', required: true, index: true },
    date: { type: Date, required: true }, // shift date (day granularity)
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    minutes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

attendanceSchema.index({ staff: 1, shift: 1 }, { unique: true });
attendanceSchema.index({ staff: 1, date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
