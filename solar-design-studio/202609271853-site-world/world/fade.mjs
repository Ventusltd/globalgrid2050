// How far the world is drawn before it fades out, and the far plane that follows it. Pure.
export const FADE_M = 450, FAR_M = 5000, MILE_M = 1609.344;

// view: 'standing' | 'aerial'; above: eye height above the ground (m); rangeM: the wider-area roads and rail range
// when that layer is on, else 0. The fade grows 2.5 m per metre up, to 4 km (phone review: a high drone still sees the
// ground below). With the wider area on, a drone sees 30 m per metre up, never past the chosen range.
// plantM: the diagonal of a laid-out plant (0 without one). A drone framing a large plant sees all of it: past 4 km the
// fade keeps growing with height, up to 1.2 times the plant's diagonal (and never past PLANT_FADE_MAX_M).
export const PLANT_FADE_MAX_M = 12000;
export function fadeFor(view, above, rangeM = 0, plantM = 0) {
  const h = Math.max(0, Number.isFinite(above) ? above : 0), base = Math.min(4000, FADE_M + h * 2.5);
  let f = view === 'aerial' && rangeM > 0 ? Math.max(base, Math.min(Math.max(FADE_M, 30 * h), rangeM)) : base;
  if (view === 'aerial' && plantM > 0) f = Math.max(f, Math.min(FADE_M + h * 2.5, 1.2 * plantM, PLANT_FADE_MAX_M));
  return f;
}

export const farPlane = fade => Math.max(FAR_M, fade * 1.1);
