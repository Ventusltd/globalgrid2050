// Layer: water. Watercourse centrelines from OS Open Rivers (rivers.json, cut per site by
// tools/features/cut_rivers.py), draped 5 cm above the ground, in a quiet blue. Each line's points run
// downstream: OS digitise links in the direction of water flow, and the cutter reverses the few marked
// otherwise. Lines with "flow": "unknown" are drawn but carry no flow ticks.
//
// Flow ticks: short marks that creep downstream along a line. They are shown only while the Water layer is
// switched on (setEnabled(true) or api.config.enabled), or while the viewer is moving within 300 m of the
// line. The layer never asks for a frame to animate: the ticks advance only on frames the world draws
// anyway, and their clock runs only while the viewer moves, so standing still costs 0 fps and nothing jumps.
//
// rivers.json: { licence, attribution, source: { sha256 }, lines: [{ name?, form, flow?, points: [[e, n], ...] }] }
// Points are British National Grid metres; they become local metres from the live site origin here.
// Loaded through the substrate's hash check (api.fetchJSON with api.config.sha256). No imports.

const INDEX_PATH = 'water/rivers.json';
let INDEX_SHA256 = '__WATER_RIVERS_SHA256__';
export function setIndexSha(sha) { INDEX_SHA256 = sha; }

export const LIFT_M = 0.05, TICK_LIFT_M = 0.07;  // line 5 cm above ground; ticks just above the line
export const STEP_M = 2;                          // no draped segment longer than 2 m
export const NEAR_M = 300;                        // ticks within 300 m of the viewer
export const SPACING_M = 12, TICK_M = 1.5, SPEED_MS = 0.6; // one tick per 12 m, 1.5 m long, 0.6 m/s
export const MAX_DT = 0.1;                        // a long pause between frames never jumps the ticks
export const MOVE_EPS = 1e-3;                     // the viewer moved if the position changed by 1 mm or more
// Quiet blue on the dark background; ticks a little lighter.
export const LINE_COLOR = [0.34, 0.56, 0.80, 0.55];
export const TICK_COLOR = [0.62, 0.80, 0.96, 0.70];

const finite = h => (Number.isFinite(h) ? h : 0);

// Pure: split a polyline so no segment is longer than step. Keeps order and every original vertex.
export function densify(pts, step = STEP_M) {
  if (pts.length < 2) return pts.map(p => [p[0], p[1]]);
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  return out;
}

// Pure: cumulative distance along a polyline; cum[0] = 0, cum[last] = length.
export function cumulative(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

// Pure: the point at distance s along the polyline (clamped to its ends).
export function pointAt(pts, cum, s) {
  const L = cum[cum.length - 1];
  if (s <= 0) return [pts[0][0], pts[0][1]];
  if (s >= L) return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
}

// Pure: shortest 2D distance from (x, y) to a polyline.
export function distToLine(pts, x, y) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, d2 = dx * dx + dy * dy;
    const t = d2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / d2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return pts.length === 1 ? Math.hypot(x - pts[0][0], y - pts[0][1]) : best;
}

// Pure: draped line segments (pairs of xyz) relative to origin o, lift metres above heightAt. known(x, y) says
// whether there is surveyed ground there; a segment with an end off it is left out rather than drawn at a
// guessed height (tester 7: off the LiDAR the ground is the viewer's own height, up to the site's relief out).
export function drapeSegments(pts, heightAt, lift, o = [0, 0, 0], known = () => true) {
  const out = [];
  let prev = null;
  for (let i = 0; i < pts.length; i++) {
    const on = known(pts[i][0], pts[i][1]);
    const p = on ? [pts[i][0] - o[0], pts[i][1] - o[1], finite(heightAt(pts[i][0], pts[i][1])) + lift - o[2]] : null;
    if (prev && p) out.push(...prev, ...p);
    prev = p;
  }
  return new Float32Array(out);
}

// Pure: flow tick segments for one line at clock t (seconds). Tick k starts at s = phase + k * spacing,
// phase = (t * speed) mod spacing, so ticks move downstream (towards the last point) as t grows.
// Only ticks whose start lies within near metres of pos are made. Returns a Float32Array of xyz pairs.
export function flowTicks(pts, cum, t, heightAt, { pos = null, near = NEAR_M, spacing = SPACING_M, tick = TICK_M,
  speed = SPEED_MS, lift = TICK_LIFT_M, origin = [0, 0, 0], known = () => true } = {}) {
  const L = cum[cum.length - 1], out = [];
  if (!(L > 0)) return new Float32Array(0);
  const phase = ((t * speed) % spacing + spacing) % spacing;
  for (let s = phase; s < L; s += spacing) {
    const a = pointAt(pts, cum, s), b = pointAt(pts, cum, Math.min(L, s + tick));
    if (pos && Math.hypot(a[0] - pos[0], a[1] - pos[1]) > near) continue;
    // a tick bends with the line: split at the vertices it passes
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

export function createWater({ now = () => (globalThis.performance ? performance.now() : Date.now()) } = {}) {
  let api = null, enabled = false, data = null, state = 'idle'; // idle | loading | ready | failed
  let lines = null, linesOrigin = null;   // local lines, built for one origin id
  let cache = { version: null, batches: [] };
  let lastPos = null, lastWall = null, flowClock = 0, moving = false;
  const origin = () => (api && typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 });

  function load() {
    if (state !== 'idle' || !api) return;
    const sha = api.config?.sha256 || INDEX_SHA256, path = api.config?.index || INDEX_PATH;
    if (!sha || sha.startsWith('__')) { state = 'failed'; layer.status = 'no rivers.json hash configured'; return; }
    state = 'loading';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.lines)) throw Error('rivers.json has no lines list');
      data = j.lines.filter(l => Array.isArray(l.points) && l.points.length >= 2);
      state = 'ready';
      layer.status = `${data.length} watercourses`;
      api.invalidate({ ground: false });
    }).catch(e => { state = 'failed'; layer.status = 'rivers.json failed: ' + e.message; });
  }

  // Local, densified lines for the current origin; rebuilt only when the origin moves.
  function localLines() {
    const o = origin(), id = `${o.e},${o.n},${o.id}`;
    if (lines && linesOrigin === id) return lines;
    lines = data.map((l, i) => {
      const pts = densify(l.points.map(([e, n]) => [e - o.e, n - o.n]));
      return { i, name: l.name || null, form: l.form, flows: l.flow !== 'unknown', pts, cum: cumulative(pts) };
    });
    linesOrigin = id;
    cache = { version: null, batches: [] };
    return lines;
  }

  const layer = {
    id: 'water',
    status: 'waiting for init',
    init(a) {
      api = a;
      if (a.config?.enabled) enabled = true;
      layer.status = 'ready to load';
      load();
    },
    setEnabled(on) { enabled = !!on; api?.invalidate({ ground: false }); return enabled; },
    get enabled() { return enabled; },
    // ctx: { pos, heightAt, groundVersion, known? }
    lines(ctx) {
      if (!api) return [];
      const known = typeof ctx.known === 'function' ? ctx.known : () => true;
      if (state === 'idle') load();
      // moving: the viewer's position changed since the last frame; only then does the flow clock run
      const wall = now();
      moving = !!lastPos && Math.hypot(ctx.pos[0] - lastPos[0], ctx.pos[1] - lastPos[1], (ctx.pos[2] || 0) - (lastPos[2] || 0)) >= MOVE_EPS;
      if (moving && lastWall !== null) flowClock += Math.min(MAX_DT, Math.max(0, (wall - lastWall) / 1000));
      lastPos = [ctx.pos[0], ctx.pos[1], ctx.pos[2] || 0]; lastWall = wall;
      if (state !== 'ready') return [];
      const ls = localLines(), gv = ctx.groundVersion || 0, version = `water@${gv}@${linesOrigin}`;
      if (cache.version !== version || cache.heightAt !== ctx.heightAt) {
        cache = { version, heightAt: ctx.heightAt, batches: ls.map(l => {
          const o = [l.pts[0][0], l.pts[0][1], finite(ctx.heightAt(l.pts[0][0], l.pts[0][1]))];
          return { key: `water/line/${l.i}`, version, origin: o, color: LINE_COLOR, positions: drapeSegments(l.pts, ctx.heightAt, LIFT_M, o, known) };
        }) };
      }
      const out = cache.batches.slice();
      for (const l of ls) {
        if (!l.flows) continue;
        const near = distToLine(l.pts, ctx.pos[0], ctx.pos[1]) <= NEAR_M;
        if (!(enabled || (moving && near))) continue;
        if (!near) continue; // ticks are a near-field cue; the far line alone says where the water is
        const o = [ctx.pos[0], ctx.pos[1], finite(ctx.heightAt(ctx.pos[0], ctx.pos[1]))];
        const positions = flowTicks(l.pts, l.cum, flowClock, ctx.heightAt, { pos: ctx.pos, origin: o, known });
        if (positions.length) out.push({ key: `water/ticks/${l.i}`, version: `${version}@${flowClock.toFixed(3)}@${o[0].toFixed(2)},${o[1].toFixed(2)}`, origin: o, color: TICK_COLOR, positions });
      }
      return out;
    },
    // For tests and the console.
    debug: () => ({ state, enabled, moving, flowClock, lines: data ? data.length : 0 })
  };
  return layer;
}

export default createWater();
