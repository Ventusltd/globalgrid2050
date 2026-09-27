// Device budget: measure, never guess the device. Starts at the screen's pixel ratio (capped at 2),
// lowers the drawing resolution when frames arrive late, and raises it again when they keep up.

export const MIN_SCALE = 0.5, MAX_SCALE = 2;
export const LATE = 1.5;         // a frame is late when it arrives 1.5 x later than its target
export const LATE_RUN = 20;      // this many late frames in a row lowers resolution
export const ON_TIME_RUN = 120;  // this many on-time frames in a row raises it

export function initialBudget(devicePixelRatio = 1) {
  const cap = Math.min(Math.max(devicePixelRatio || 1, 1), MAX_SCALE);
  return { scale: cap, cap, late: 0, onTime: 0 };
}

// intervalMs: time since the previous frame while moving; targetMs: 1000 / target fps.
export function adjust(b, intervalMs, targetMs) {
  if (!(intervalMs > 0)) return b;
  if (intervalMs > targetMs * LATE) {
    const late = b.late + 1;
    if (late < LATE_RUN) return { ...b, late, onTime: 0 };
    return { ...b, scale: Math.max(MIN_SCALE, round(b.scale * 0.8)), late: 0, onTime: 0 };
  }
  const onTime = b.onTime + 1;
  if (onTime < ON_TIME_RUN || b.scale >= b.cap) return { ...b, onTime, late: 0 };
  return { ...b, scale: Math.min(b.cap, round(b.scale * 1.1)), onTime: 0, late: 0 };
}

const round = v => Math.round(v * 100) / 100;
