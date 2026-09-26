// Snapping a cable route to grid equipment, and what the readout says about where the route meets the grid.
// Pure: no imports, no DOM. Assets are in British National Grid metres:
//   { kind: 'substation' | 'tower', e, n, kv?, tier?, id? }   (any operator field is ignored: never shown)
// Route points are local metres [x, y, z] from origin { e, n }.
//
// A route point within SNAP_M (plan) of a substation or pylon moves onto it; the nearest wins. A route whose last
// point sits on a substation ends there. Distances are plan (horizontal) metres; bearings are from grid north,
// clockwise, in whole degrees.

export const SNAP_M = 25;

const dist = (a, b) => Math.hypot(a.e - b.e, a.n - b.n);

// The asset a local point snaps to, or null: { asset, x, y } with the asset's own position in local metres.
export function snapPoint(p, assets, origin, radius = SNAP_M) {
  const at = { e: origin.e + p[0], n: origin.n + p[1] };
  let best = null, bd = Infinity;
  for (const a of assets || []) {
    if (a.kind !== 'substation' && a.kind !== 'tower') continue;
    const d = dist(a, at);
    if (d <= radius && d < bd) { best = a; bd = d; }
  }
  return best ? { asset: best, x: best.e - origin.e, y: best.n - origin.n, d: bd } : null;
}

// Grid bearing from a to b, degrees 0-359 (0 = grid north, 90 = east).
export function bearingDeg(a, b) {
  const deg = Math.atan2(b.e - a.e, b.n - a.n) * 180 / Math.PI;
  return (Math.round(deg) + 360) % 360;
}

// The nearest substation to a point in national-grid metres: { asset, d, bearing } or null.
export function nearestSubstation(at, assets) {
  let best = null, bd = Infinity;
  for (const a of assets || []) if (a.kind === 'substation') { const d = dist(a, at); if (d < bd) { best = a; bd = d; } }
  return best ? { asset: best, d: bd, bearing: bearingDeg(at, best) } : null;
}

// The network tier, never an operator's name or a voltage (owner's rule: the readout shows the tier only). The
// national index gives it; otherwise it follows the voltage: 200 kV and above is transmission (275 and 400 kV in
// England and Wales), below is distribution.
export function tierOf(a) {
  if (a?.tier === 'transmission' || a?.tier === 'distribution') return a.tier;
  const kv = Number(a?.kv);
  return kv >= 200 ? 'transmission' : kv > 0 ? 'distribution' : null;
}
export const tierText = a => tierOf(a) || 'tier not recorded';
const km = d => (d / 1000).toFixed(d < 10000 ? 2 : 1);

// The readout's 'Grid connection' line for a route whose last point is `end`. near is the nearest substation to the
// end ({ asset, d, bearing } from nearestSubstation), 'pending' while the national index is being read, or null
// when there is none. endAsset is the asset the last point snapped to, if any.
export function connectionText(near, endAsset = null) {
  if (endAsset?.kind === 'substation') return `ends at substation, ${tierText(endAsset)}`;
  const sub = near === 'pending' ? 'finding the nearest substation…'
    : near ? `nearest substation ${tierText(near.asset)}, ${km(near.d)} km, bearing ${near.bearing}°`
      : 'no substation found in the national index';
  return endAsset?.kind === 'tower' ? `ends at pylon, ${tierText(endAsset)} · ${sub}` : sub;
}

// The first draft of 'Route to nearest substation': the point to add after `last` (local [x, y]) for the substation
// `asset` (national-grid metres), or null. A straight line, nothing more: the user edits it.
export function draftToNearest(last, asset, origin) {
  if (!asset) return null;
  const at = { e: origin.e + last[0], n: origin.n + last[1] };
  return { asset, x: asset.e - origin.e, y: asset.n - origin.n, d: dist(asset, at), bearing: bearingDeg(at, asset) };
}

// How much of a plan polyline (local [x, y]) stands on measured ground, sampled every `step` metres.
export function measuredShare(pts, measuredAt, step = 5) {
  let total = 0, known = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      if (Number.isFinite(measuredAt(ax + (bx - ax) * f, ay + (by - ay) * f))) known += L / n;
    }
    total += L;
  }
  return { total, known };
}

// A snap ring: an octagon on the ground with a short post, as line pairs in local metres.
export function snapRing([x, y, z], r = 3, h = 4) {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const a0 = k * Math.PI / 4, a1 = (k + 1) * Math.PI / 4;
    out.push(x + r * Math.cos(a0), y + r * Math.sin(a0), z + 0.3, x + r * Math.cos(a1), y + r * Math.sin(a1), z + 0.3);
  }
  out.push(x, y, z, x, y, z + h);
  return out;
}
