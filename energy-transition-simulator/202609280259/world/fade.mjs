// Carried over unchanged from the site-world release solar-design-studio/202609270524-site-world/world/fade.mjs
// (published 27 Sept 2026, copied 28 Sept 2026). Do not edit here: change the release line and carry it again.
// How far the world is drawn before it fades out, and the far plane that follows it. Pure.
export const FADE_M = 450, FAR_M = 5000, MILE_M = 1609.344;

// view: 'standing' | 'aerial'; above: eye height above the ground (m); rangeM: the wider-area roads and rail range
// when that layer is on, else 0. The fade grows 2.5 m per metre up, to 4 km (phone review: a high drone still sees the
// ground below). With the wider area on, a drone sees 30 m per metre up, never past the chosen range.
export function fadeFor(view, above, rangeM = 0) {
  const h = Math.max(0, Number.isFinite(above) ? above : 0), base = Math.min(4000, FADE_M + h * 2.5);
  return view === 'aerial' && rangeM > 0 ? Math.max(base, Math.min(Math.max(FADE_M, 30 * h), rangeM)) : base;
}

export const farPlane = fade => Math.max(FAR_M, fade * 1.1);
