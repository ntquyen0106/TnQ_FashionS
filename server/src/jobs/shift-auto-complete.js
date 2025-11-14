import { StaffShift, ShiftTemplate } from '../models/index.js';
import dayjs from 'dayjs';

// Every 5 minutes: set status=completed for shifts whose end time passed
// Applies to statuses: scheduled, confirmed, swapped
// Skips cancelled and already completed
export const startShiftAutoCompleteJob = () => {
  const INTERVAL_MS = 5 * 60 * 1000;

  const tick = async () => {
    try {
      const now = dayjs();
      // select candidate shifts (today or earlier) not completed/cancelled
      const candidates = await StaffShift.find({
        status: { $in: ['scheduled', 'confirmed', 'swapped'] },
        date: { $lte: new Date() },
      })
        .populate('shiftTemplate', 'endTime')
        .limit(1000);

      let updated = 0;

      for (const shift of candidates) {
        const endStr = shift.customEnd || shift.shiftTemplate?.endTime;
        if (!endStr) continue; // cannot determine end
        const [h, m] = endStr.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) continue;
        const endMoment = dayjs(shift.date).hour(h).minute(m).second(0).millisecond(0);
        if (now.isAfter(endMoment)) {
          shift.status = 'completed';
          await shift.save();
          updated++;
        }
      }
      if (updated) {
        console.log(`[ShiftAutoComplete] Updated ${updated} shifts to completed`);
      }
    } catch (err) {
      console.error('[ShiftAutoComplete] Error:', err.message);
    }
  };

  // initial delay slight to let app boot
  setTimeout(tick, 10 * 1000);
  setInterval(tick, INTERVAL_MS);
  console.log('[ShiftAutoComplete] Job started');
};
