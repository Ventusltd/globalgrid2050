// The site origin. The world is drawn in local east/north/up metres around an origin held in
// float64 British National Grid metres ({ e, n, id }). Float32 drawing error passes 0.1 px about
// 200 m from the origin and 0.5 px about 1 km out, so when the viewer strays too far we move the
// origin to them rather than let the numbers on the GPU grow. Pure: no imports, no DOM.

// Local metres from grid metres, in float64. Returns [x, y].
export function toLocal(origin, e, n) {
  return [e - origin.e, n - origin.n];
}

// Grid metres from local metres, in float64. Returns { e, n }.
export function toBng(origin, x, y) {
  return { e: origin.e + x, n: origin.n + y };
}

// If the viewer at local pos [x, y, ...] is more than `limit` metres from the origin on either
// axis, return a new origin snapped to whole `tile` metres of the national grid, nearest the
// viewer, with the local shift [dx, dy] to subtract from every local position. Otherwise null.
// Snapping to the nearest tile corner leaves the viewer at most tile / 2 from the new origin,
// so tile / 2 must be below the limit or we would rebase on every step.
export function rebaseIfNeeded(origin, pos, { limit = 600, tile = 1000 } = {}) {
  if (!(tile > 0) || !(limit > tile / 2)) throw new Error('rebase needs tile > 0 and limit > tile / 2');
  const [x, y] = pos;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null; // never rebase onto a broken position
  if (Math.abs(x) <= limit && Math.abs(y) <= limit) return null;
  const e = Math.round((origin.e + x) / tile) * tile;
  const n = Math.round((origin.n + y) / tile) * tile;
  const dx = e - origin.e, dy = n - origin.n;
  if (dx === 0 && dy === 0) return null; // already on the nearest corner; nothing to gain
  return { e, n, shift: [dx, dy] };
}
