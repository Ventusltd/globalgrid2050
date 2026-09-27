// lib/drape.mjs: lines laid on the ground, shared by the water, ways and land layers (through api.lib.drape) and
// by the cartridges (by import). No imports, no DOM. Plan points are [x, y] in local metres; heights come from
// heightAt(x, y), and a height that is not a number drapes at 0. known(x, y) says whether there is surveyed
// ground there: a piece with an end off it is left out rather than drawn at a guessed height.

export const finite = h => (Number.isFinite(h) ? h : 0);
const yes = () => true;

// Split a polyline so no segment is longer than step. Keeps order and every original vertex.
export function densify(pts, step) {
  if (pts.length < 2) return pts.map(p => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}

// Cumulative distance along a polyline; cum[0] = 0, cum[last] = length.
export function cumulative(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

// The point at distance s along the polyline (clamped to its ends).
export function pointAt(pts, cum, s) {
  const L = cum[cum.length - 1];
  if (s <= 0) return [pts[0][0], pts[0][1]];
  if (s >= L) return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
}

// Shortest plan distance from (x, y) to a polyline.
export function distToLine(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
    const t = d2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / d2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return pts.length === 1 ? Math.hypot(x - pts[0][0], y - pts[0][1]) : best;
}

// Draped segments (pairs of xyz) through every point of an already densified line, relative to origin o,
// lift metres above the ground. Returns a Float32Array.
export function drapeSegments(pts, heightAt, lift, o = [0, 0, 0], known = yes) {
  const out = [];
  let prev = null;
  for (let i = 0; i < pts.length; i++) {
    const p = known(pts[i][0], pts[i][1]) ? [pts[i][0] - o[0], pts[i][1] - o[1], finite(heightAt(pts[i][0], pts[i][1])) + lift - o[2]] : null;
    if (prev && p) out.push(...prev, ...p);
    prev = p;
  }
  return new Float32Array(out);
}

// Pushes a polyline onto out as draped segments relative to origin, each input segment split into pieces no
// longer than step (at fractions j / k of it). Returns out.
export function drape(out, pts, heightAt, { step, lift, origin = [0, 0, 0], known = yes }) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    let px = ax, py = ay, pz = finite(heightAt(ax, ay)), pk = known(ax, ay);
    for (let j = 1; j <= k; j++) {
      const t = j / k, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = finite(heightAt(x, y)), qk = known(x, y);
      if (pk && qk) out.push(px - origin[0], py - origin[1], pz + lift - origin[2], x - origin[0], y - origin[1], z + lift - origin[2]);
      px = x; py = y; pz = z; pk = qk;
    }
  }
  return out;
}

// Short marks that creep along a line at clock t (seconds): tick k starts at s = phase + k * spacing, phase =
// (t * speed) mod spacing, so the ticks move towards the last point as t grows. Only ticks starting within near
// metres of pos are made; a tick bends with the line. Returns a Float32Array of xyz pairs.
export function ticksAlong(pts, cum, t, heightAt, { pos = null, near, spacing, tick, speed, lift, origin = [0, 0, 0], known = yes }) {
  const L = cum[cum.length - 1], out = [];
  if (!(L > 0)) return new Float32Array(0);
  const phase = ((t * speed) % spacing + spacing) % spacing;
  for (let s = phase; s < L; s += spacing) {
    const a = pointAt(pts, cum, s), b = pointAt(pts, cum, Math.min(L, s + tick));
    if (pos && Math.hypot(a[0] - pos[0], a[1] - pos[1]) > near) continue;
    const seq = [a];
    for (let i = 1; i < cum.length - 1; i++) if (cum[i] > s && cum[i] < s + tick) seq.push(pts[i]);
    seq.push(b);
    for (let i = 1; i < seq.length; i++) {
      const p = seq[i - 1], q = seq[i];
      if (!known(p[0], p[1]) || !known(q[0], q[1])) continue;
      out.push(p[0] - origin[0], p[1] - origin[1], finite(heightAt(p[0], p[1])) + lift - origin[2],
        q[0] - origin[0], q[1] - origin[1], finite(heightAt(q[0], q[1])) + lift - origin[2]);
    }
  }
  return new Float32Array(out);
}
