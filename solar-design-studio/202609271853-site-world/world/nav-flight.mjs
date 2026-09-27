// Flying about the plant: the start view that frames it all, the camera for each level, which block a tap is on,
// whether a flight may glide instead of the far-place origin jump, and a descent that eases through log(height).
// Pure: no imports, no DOM. Local metres (x east, y north), yaw 0 looks north (+y), pitch negative looks down;
// the same conventions as substrate.mjs flyTo and arrival.mjs.

const DEG = Math.PI / 180;
export const DOWN = -(Math.PI / 2 - 0.01); // arrival.mjs: straight down, as far as the look controls hold
export const JUMP_M = 3000;                // substrate.mjs: further than this, Find moves the origin and drops in

const ease = u => u * u * u * (u * (u * 6 - 15) + 10); // arrival.mjs: zero speed and acceleration at both ends
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const turn = (from, to) => { const d = (to - from) % (2 * Math.PI); return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d; };

// ---- boxes ----
// box: [minX, minY, maxX, maxY]
export const boxCentre = b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
export const boxGrow = (b, m) => [b[0] - m, b[1] - m, b[2] + m, b[3] + m];
export const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
export function boxOfPoints(pts) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
}

// Blocks are contiguous in the layout's tables (plant-layout.mjs: filled in station order), so block k (from 1) is the
// slice starting at the sum of the earlier stations' table counts. Returns [{ block, id, start, count }].
export function blockSlices(stations) {
  let at = 0;
  return stations.map((s, i) => { const r = { block: i + 1, id: s.id, start: at, count: s.tables }; at += s.tables; return r; });
}

// The local box round one block's tables. tables: Float64 x6 per table (ua, va, 4 corner heights);
// toLocal(u, v) -> [x, y]; lenU, depth: the table's size along u and v.
export function blockBox(tables, slice, toLocal, lenU, depth) {
  const pts = [];
  for (let q = slice.start; q < slice.start + slice.count; q++) {
    const u = tables[q * 6], v = tables[q * 6 + 1];
    pts.push(toLocal(u, v), toLocal(u + lenU, v), toLocal(u + lenU, v + depth), toLocal(u, v + depth));
  }
  return boxOfPoints(pts);
}

// Which block a ground point is on. blocks: [{ block, box }]. Inside a box wins (the smallest box where they overlap);
// otherwise the nearest box edge within tolM (a finger's width on the ground); else null (the tap was not on a block).
export function pickBlock(blocks, x, y, tolM = 0) {
  let best = null, bestArea = Infinity, near = null, nearD = Infinity;
  for (const b of blocks) {
    const [x0, y0, x1, y1] = b.box;
    if (inBox(b.box, x, y)) { const a = (x1 - x0) * (y1 - y0); if (a < bestArea) { bestArea = a; best = b.block; } continue; }
    const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
    if (d <= tolM && d < nearD) { nearD = d; near = b.block; }
  }
  return best ?? near;
}

// ---- framing ----
// Where a ground point lands on screen (-1..1 each way) from a camera 'distance' out along the view line through the
// box centre (flat ground at the centre's height). Perspective is exact: the near edge of a plant seen at 45 degrees
// is wider on screen than the far edge, and that is what decides the fit.
function screenOf(px, py, cx, cy, yaw, pitch, distance, tv, th) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), sy = Math.sin(yaw), cyw = Math.cos(yaw);
  const f = [sy * cp, cyw * cp, sp], r = [cyw, -sy, 0], u = [-sy * sp, -cyw * sp, cp]; // forward, right, up
  const eye = [cx - f[0] * distance, cy - f[1] * distance, -f[2] * distance];
  const d = [px - eye[0], py - eye[1], -eye[2]], z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  if (z <= 0) return [Infinity, Infinity];
  return [(d[0] * r[0] + d[1] * r[1]) / z / th, (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z / tv];
}

// The stand-off that fits a ground box on screen, looking down at pitch, from yaw 0 or 90 degrees (whichever fits closer:
// on a portrait phone the long side of the plant runs away from the viewer). fovy: vertical field of view (radians);
// aspect: width / height; margin 1.1 leaves a tenth of the screen round the box. Returns flyTo opts plus the centre:
// { x, y, yaw, pitch, back, height, distance }, with height = back * tan(-pitch) as flyTo computes it.
export function fitView(box, { fovy = 70 * DEG, aspect = 16 / 9, pitch = -45 * DEG, margin = 1.1, minDistance = 50, yaw = null } = {}) {
  const [cx, cy] = boxCentre(box), tv = Math.tan(fovy / 2), th = tv * aspect, lim = 1 / margin;
  const corners = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]];
  const fits = (a, D) => corners.every(([x, y]) => { const [sx, sy] = screenOf(x, y, cx, cy, a, pitch, D, tv, th); return Math.abs(sx) <= lim && Math.abs(sy) <= lim; });
  const need = a => { // the corners only get closer to the middle as the camera backs off: bisect for the nearest fit
    let hi = Math.max(minDistance, 1);
    while (!fits(a, hi) && hi < 1e7) hi *= 2;
    let lo = hi / 2;
    if (fits(a, lo) && lo < minDistance) return minDistance;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (fits(a, mid)) hi = mid; else lo = mid; }
    return Math.max(minDistance, hi);
  };
  let pick = yaw, distance;
  if (pick == null) { const n = need(0), e = need(Math.PI / 2); pick = e < n * 0.98 ? Math.PI / 2 : 0; distance = pick ? e : n; }
  else distance = need(pick);
  const back = distance * Math.cos(-pitch);
  return { x: cx, y: cy, yaw: pick, pitch, back, height: back * Math.tan(-pitch), distance };
}

// The start view: the whole plant, 45 degrees down (500 MW: about 3.2 km out on a desktop, about 5 km on a portrait phone).
export const plantView = (plantBox, screen = {}) => fitView(plantBox, { ...screen, pitch: -45 * DEG, margin: 1.1 });

// A block: 50 degrees down, framed with room round it, never closer than 150 m out.
export const blockView = (box, screen = {}) => {
  const v = fitView(box, { ...screen, pitch: -50 * DEG, margin: 1.25, minDistance: 150 / Math.cos(50 * DEG) });
  return v;
};

// A row: from its first table, looking along it, 35 degrees down from 40 m up. start, end: local [x, y].
export function rowView(start, end) {
  const yaw = Math.atan2(end[0] - start[0], end[1] - start[1]), pitch = -35 * DEG, height = 40;
  const back = height / Math.tan(-pitch);
  // stand off behind the start, so flyTo's 'at' is the start and the row runs away up the screen
  return { x: start[0], y: start[1], yaw, pitch, back, height };
}

// A table: in front of it, 8 m up, 12 m back, facing it. centre: [x, y]; facing: the yaw that looks at the table's face.
export function tableView(centre, facing) {
  const back = 12, height = 8;
  return { x: centre[0], y: centre[1], yaw: facing, pitch: -Math.atan2(height, back), back, height };
}

// A string: stand in the aisle 1.5 m in front of the table and face it (Walk). blocked(x, y) -> true inside a solid;
// the spot is nudged away from the table 0.5 m at a time (up to 6 m) until it is clear. Returns { walk, x, y, yaw } or null.
export function stringStand(centre, facing, blocked = () => false) {
  const dx = -Math.sin(facing), dy = -Math.cos(facing);
  for (let d = 1.5; d <= 6 + 1e-9; d += 0.5) {
    const x = centre[0] + dx * d, y = centre[1] + dy * d;
    if (!blocked(x, y)) return { walk: true, x, y, yaw: facing };
  }
  return null;
}

// ---- the jump ----
// substrate.mjs flyTo moves the origin and drops in from above when a target is more than JUMP_M away. Across one plant
// that is wrong: block to block should glide. A flight glides when the target is on the plant (with toM round it) and
// the camera is within reachM of the plant (the start view stands up to about 5-6 km out). Otherwise the jump rule stands.
export function glides(from, to, plantBox, { jumpM = JUMP_M, toM = 500, reachM = 7000 } = {}) {
  if (Math.hypot(to[0] - from[0], to[1] - from[1]) <= jumpM) return true;
  if (!plantBox) return false;
  return inBox(boxGrow(plantBox, toM), to[0], to[1]) && inBox(boxGrow(plantBox, reachM), from[0], from[1]);
}

// ---- the descent ----
// How long a flight takes: 2 s, plus half a second per halving (or doubling) of the height, plus a little for distance;
// never more than 5 s. h0, h1: heights above the ground (m); d: ground distance (m).
export const flightSeconds = (h0, h1, d = 0) =>
  clamp(2 + 0.5 * Math.abs(Math.log2(Math.max(h0, 0.5) / Math.max(h1, 0.5))) + 0.25 * Math.log2(1 + d / 1000), 2, 5);

// A flight that eases through log(height above the ground), so a drop from 2 km to 8 m spends its time evenly per
// halving instead of 99 % of it high up with a snap at the end. The ground position arrives a little ahead of the height
// (80 % of the time), so the last part is a straight settle. A long flight at the same height rises in a gentle arc
// (peak about 40 % of the distance) so the plant stays in view.
// state: { pos: [x, y, z], yaw, pitch }; target: [x, y, groundZ]; opts: flyTo opts { back, pitch, yaw, height }
// plus groundFrom (the ground under the camera now; default the target's) and seconds (default flightSeconds).
// Returns pose(t) -> { pos, yaw, pitch }, with pose.done(t), pose.end and pose.seconds, as arrival.mjs arrive does.
export function descend(state, target, opts = {}) {
  const yaw = opts.yaw ?? state.yaw, pitch = opts.pitch ?? DOWN, back = opts.back ?? 0;
  const g1 = target[2] ?? 0, g0 = opts.groundFrom ?? g1;
  const height = back && opts.pitch ? back * Math.tan(-pitch) : (opts.height ?? 80);
  const end = Object.freeze({
    pos: Object.freeze([target[0] - back * Math.sin(yaw), target[1] - back * Math.cos(yaw), g1 + height]), yaw, pitch });
  const from = { pos: [...state.pos], yaw: state.yaw, pitch: state.pitch };
  const h0 = Math.max(0.5, from.pos[2] - g0), h1 = Math.max(0.5, height);
  const d = Math.hypot(end.pos[0] - from.pos[0], end.pos[1] - from.pos[1]);
  const seconds = opts.seconds ?? flightSeconds(h0, h1, d);
  const l0 = Math.log(h0), l1 = Math.log(h1), hi = Math.max(h0, h1);
  const bump = 0.4 * d > hi ? Math.log(0.4 * d) - (l0 + l1) / 2 : 0; // an arc only when the flight is long for its height
  const dyaw = turn(from.yaw, yaw);
  const finished = t => !(seconds > 0) || t >= seconds;
  const pose = t => {
    if (finished(t)) return { pos: [...end.pos], yaw: end.yaw, pitch: end.pitch };
    const u = Math.max(0, t) / seconds, k = ease(u), kx = ease(Math.min(1, u / 0.8));
    const lh = l0 + (l1 - l0) * k + bump * Math.sin(Math.PI * k);
    const g = g0 + (g1 - g0) * kx;
    return {
      pos: [from.pos[0] + (end.pos[0] - from.pos[0]) * kx, from.pos[1] + (end.pos[1] - from.pos[1]) * kx, g + Math.exp(lh)],
      yaw: from.yaw + dyaw * kx,
      pitch: from.pitch + (end.pitch - from.pitch) * k
    };
  };
  pose.done = finished;
  pose.end = end;
  pose.seconds = seconds;
  return pose;
}
