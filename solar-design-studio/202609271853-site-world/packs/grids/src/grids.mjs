// Pack: grids. Grid layers for a 3D world: overhead lines with catenary sag and conductor bundles by voltage class,
// towers standing on the measured ground, substations as fenced compounds, underground cable routes, and a load-flow
// colouring hook. Contract world.pack.v1, kind "layer". Self-contained: no imports (a world loads it from a blob URL).
//
// Local east (x), north (y), up (z), in metres from the site origin. Batches carry an origin (the viewer's 250 m cell)
// so that 32-bit drawing stays sharp. Geometry is rebuilt only when the data, the ground, the origin, the flow, the
// settings or the viewer's cell change; otherwise the same batch objects come back and the world keeps its buffers.
//
// ILLUSTRATIVE. Tower shapes, heights, insulator lengths, bundle sizes, compound sizes and the sag are typical values
// proportioned by eye, not surveyed and not a design of any real line. Clearances are distances at the assumed sag,
// never a pass or fail against any rule. Loadings are whatever the flow data says; this pack does not solve a load flow.
//
// Network file (config.network: { path, sha256 }, fetched through the world's hash check, or config.inline):
//   { "format": "grids.network.v1", "crs": "local" | "national", "licence": "...", "attribution": "...",
//     "lines": [{ "id", "kv", "towers": [[x, y], ...], "circuits"?: 1 | 2, "bundle"?: 1-4, "sagPercent"?: 1-8 }],
//     "substations": [{ "id", "kv", "at": [x, y], "size"?: [w, d] }],
//     "cables": [{ "id", "kv", "points": [[x, y], ...] }] }
//   crs "national": grid metres, turned into local metres with api.origin() at each build.
// Flow file (config.flow: { path, sha256 }), the world event "world/flow" with the same payload, or the command:
//   { "format": "grids.flow.v1", "lines": [{ "id", "loading" } | { "id", "percent" } | { "id", "mw", "ratingMW" }] }
//   loading is a fraction of the rating (1 = 100 %). Ids match line and cable ids.

// ---------------------------------------------------------------- voltage classes and colours

// Seven classes, kept separate. A nominal kV maps to the class whose value is nearest on a log scale (the cut
// between two classes is their geometric mean), so 400 and 275, 132 and 66, 33 and 11 never merge.
export const NOMINAL = Object.freeze([400, 275, 220, 132, 66, 33, 11]);
export function classOf(kv) {
  const v = Number(kv);
  if (!(v > 0) || !Number.isFinite(v)) return null;
  for (let i = 0; i < NOMINAL.length - 1; i++) if (v >= Math.sqrt(NOMINAL[i] * NOMINAL[i + 1])) return NOMINAL[i];
  return 11;
}

// The grid map palette, so a line in the world has the same colour as on the map. The map has no 33 kV line colour;
// cyan is this pack's choice for 33 kV, picked to stay apart from the other six.
export const HEX = Object.freeze({ 400: '#0054ff', 275: '#ff0000', 220: '#ff9900', 132: '#00cc00', 66: '#b200ff', 33: '#00b8d4', 11: '#ff00ff' });
export const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
export const COLOURS = Object.freeze(Object.fromEntries(NOMINAL.map(kv => [kv, Object.freeze(rgb(HEX[kv]))])));
const ALPHA = { conductors: 0.9, towers: 0.55, compounds: 0.7, cables: 0.8 };
const withAlpha = (c, a) => [c[0], c[1], c[2], a];
const toward = (c, g, t) => c.map((v, i) => v + (g[i] - v) * t);
const TOWER_GREY = [0.72, 0.74, 0.78];

// Load-flow ramp: green at 0, amber at 80 %, red at 100 % and above. Ten 10 % bands plus one for 100 % and over, so
// the batch count stays small. Lines with no flow data are drawn quiet grey.
export const FLOW_NONE = Object.freeze([0.5, 0.5, 0.55, 0.45]);
export const loadingBand = l => (l >= 1 ? 10 : Math.max(0, Math.min(9, Math.floor(l * 10))));
export function loadingColour(l) {
  const g = [0.2, 0.8, 0.3], a = [1, 0.75, 0], r = [1, 0.15, 0.1];
  if (!(l >= 0)) return [...FLOW_NONE];
  const c = l >= 1 ? r : l <= 0.8 ? toward(g, a, l / 0.8) : toward(a, r, (l - 0.8) / 0.2);
  return [...c, 0.95];
}
const bandColour = b => (b >= 10 ? loadingColour(1) : loadingColour((b + 0.5) / 10));

// ---------------------------------------------------------------- structures (typical, assumed)

// Heights and widths in metres. arms: [z above the tower's ground, half-width across the line]. insulator: suspension
// string length below the arm. bundle: sub-conductors per phase; spacing: between sub-conductors. span: the demo span.
// sag: the assumed mid-span sag as a share of span on the equivalent level span, by class (3.5 % for the lattice
// transmission classes, 2.5 % for 132 kV and below). Typical values chosen by eye, not from any line's sag table.
export const TYPES = Object.freeze({
  400: { kind: 'lattice', height: 50, baseHalf: 4.5, topHalf: 1.0, insulator: 5.0, arms: [[44, 6.1], [35.5, 7.9], [27, 6.9]], bundle: 4, spacing: 0.45, circuits: 2, span: 360, sag: 0.035 },
  275: { kind: 'lattice', height: 41, baseHalf: 3.8, topHalf: 0.9, insulator: 3.5, arms: [[36, 5.2], [29, 6.4], [22, 5.6]], bundle: 2, spacing: 0.4, circuits: 2, span: 330, sag: 0.035 },
  220: { kind: 'lattice', height: 38, baseHalf: 3.5, topHalf: 0.85, insulator: 3.0, arms: [[33, 5.0], [27, 6.0], [21, 5.3]], bundle: 2, spacing: 0.4, circuits: 2, span: 320, sag: 0.035 },
  132: { kind: 'lattice', height: 27, baseHalf: 2.5, topHalf: 0.7, insulator: 1.8, arms: [[24, 3.4], [20, 3.8], [16, 3.4]], bundle: 1, spacing: 0, circuits: 2, span: 280, sag: 0.025 },
  66: { kind: 'lattice', height: 21, baseHalf: 1.8, topHalf: 0.55, insulator: 1.1, arms: [[19, 2.6], [16, 3.0], [13, 2.6]], bundle: 1, spacing: 0, circuits: 2, span: 200, sag: 0.025 },
  33: { kind: 'pole', height: 10, armZ: 9.4, armHalf: 1.2, pin: 0.3, bundle: 1, spacing: 0, circuits: 1, span: 100, sag: 0.025 },
  11: { kind: 'pole', height: 9, armZ: 8.6, armHalf: 0.9, pin: 0.25, bundle: 1, spacing: 0, circuits: 1, span: 80, sag: 0.025 }
});
// Compound footprint [east-west, north-south], fence height, gantry height and transformer box [w, d, h]. Assumed.
export const COMPOUND = Object.freeze({
  400: { size: [300, 200], gantry: 15, tx: [12, 8, 9] }, 275: { size: [220, 150], gantry: 13, tx: [11, 7, 8] },
  220: { size: [200, 140], gantry: 12, tx: [10, 7, 8] }, 132: { size: [90, 60], gantry: 10, tx: [8, 5, 6] },
  66: { size: [60, 40], gantry: 8, tx: [6, 4, 5] }, 33: { size: [30, 20], gantry: 6, tx: [4, 3, 3.5] },
  11: { size: [8, 6], gantry: 0, tx: [3, 2.5, 2.2] }
});
export const FENCE_H = 2.4;
export const DEFAULT_SAG = null;           // null: each class's own assumed sag (TYPES[kv].sag); a number overrides all
export const DEFAULT_RADIUS = 5000;        // metres around the viewer that are built and drawn
const CELL = 250;                          // the viewer's cell: geometry is rebuilt when the viewer crosses one
const DETAIL = 1500;                       // bundles and full tower lattice nearer than this; single wires beyond
const CLEAR_STEP = 2;                      // clearance sample spacing along each conductor, metres
const MARKER_STEP = 50, MARKER_H = 1.0;    // cable route marker posts
const DRAPE = 10;                          // fences and cable routes follow the ground at least every 10 m

// ---------------------------------------------------------------- catenary maths

const coshm1 = u => { const s = Math.sinh(u / 2); return 2 * s * s; }; // cosh(u) - 1 without cancellation
// Mid-span sag of a level span of horizontal length L with catenary parameter a = H / w (metres).
export const levelSag = (L, a) => a * coshm1(L / (2 * a));
// The parameter a whose level span of length L sags ratio * L. Sag falls as a grows, so bisect in log a.
export function paramFromSag(L, ratio) {
  if (!(L > 0) || !(ratio > 0)) throw Error('paramFromSag needs a span and a sag ratio above 0');
  const want = ratio * L;
  let lo = Math.log(L * 1e-3), hi = Math.log(L * 1e5);
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (levelSag(L, Math.exp(m)) > want) lo = m; else hi = m; }
  return Math.exp((lo + hi) / 2);
}
// A span from height z1 at s = 0 to z2 at s = L (horizontal), parameter a. Returns z(s) and the lowest point.
// z(s) = z1 + a (cosh((s - m) / a) - cosh(m / a)), with m = L/2 - a asinh((z2 - z1) / (2 a sinh(L / 2a))).
export function catenarySpan(L, z1, z2, a) {
  const m = L / 2 - a * Math.asinh((z2 - z1) / (2 * a * Math.sinh(L / (2 * a))));
  const z = s => z1 + a * (coshm1((s - m) / a) - coshm1(m / a));
  const low = m > 0 && m < L ? { s: m, z: z(m) } : z1 <= z2 ? { s: 0, z: z1 } : { s: L, z: z2 };
  return { z, m, low };
}
// Sub-conductor offsets in the plane across the span: [across, up] in metres.
export function bundleOffsets(n, s) {
  const h = s / 2, t = s * Math.sqrt(3) / 6;
  if (n === 2) return [[-h, 0], [h, 0]];
  if (n === 3) return [[-h, -t], [h, -t], [0, 2 * t]];
  if (n === 4) return [[-h, -h], [h, -h], [h, h], [-h, h]];
  return [[0, 0]];
}

// ---------------------------------------------------------------- data

const isPt = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const cleanId = (v, d) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : d);

// Pure: a network file -> { crs, lines, substations, cables, licence, attribution, skipped: [words] }.
// Throws on a file that is not the expected shape; skips (and names) single entries that are unusable.
export function parseNetwork(j) {
  if (!j || typeof j !== 'object') throw Error('network file is not an object');
  if (j.format !== undefined && j.format !== 'grids.network.v1') throw Error(`network format ${j.format} is not grids.network.v1`);
  const crs = j.crs === undefined ? 'local' : j.crs;
  if (crs !== 'local' && crs !== 'national') throw Error('network crs must be "local" or "national"');
  const skipped = [], lines = [], substations = [], cables = [], ids = new Set();
  const unique = (id, what) => { if (ids.has(id)) { skipped.push(`${what} ${id}: id used twice`); return false; } ids.add(id); return true; };
  (Array.isArray(j.lines) ? j.lines : []).forEach((l, i) => {
    const id = cleanId(l?.id, `line-${i + 1}`), kv = classOf(l?.kv);
    if (!kv) return skipped.push(`line ${id}: kv must be a number above 0`);
    const towers = (Array.isArray(l.towers) ? l.towers : []).filter(isPt).map(p => [p[0], p[1]]);
    if (towers.length < 2) return skipped.push(`line ${id}: needs at least two towers`);
    if (!unique(id, 'line')) return;
    const T = TYPES[kv];
    const circuits = l.circuits === 1 || T.kind === 'pole' ? 1 : 2;
    const bundle = Number.isInteger(l.bundle) && l.bundle >= 1 && l.bundle <= 4 ? l.bundle : T.bundle;
    const sag = Number.isFinite(l.sagPercent) && l.sagPercent >= 1 && l.sagPercent <= 8 ? l.sagPercent / 100 : null;
    lines.push({ id, kv, nominal: Number(l.kv), towers, circuits, bundle, sag });
  });
  (Array.isArray(j.substations) ? j.substations : []).forEach((s, i) => {
    const id = cleanId(s?.id, `substation-${i + 1}`), kv = classOf(s?.kv);
    if (!kv) return skipped.push(`substation ${id}: kv must be a number above 0`);
    if (!isPt(s.at)) return skipped.push(`substation ${id}: at must be [x, y]`);
    if (!unique(id, 'substation')) return;
    const size = Array.isArray(s.size) && s.size.length === 2 && s.size.every(v => Number.isFinite(v) && v >= 2 && v <= 2000) ? [s.size[0], s.size[1]] : [...COMPOUND[kv].size];
    substations.push({ id, kv, at: [s.at[0], s.at[1]], size });
  });
  (Array.isArray(j.cables) ? j.cables : []).forEach((c, i) => {
    const id = cleanId(c?.id, `cable-${i + 1}`), kv = classOf(c?.kv);
    if (!kv) return skipped.push(`cable ${id}: kv must be a number above 0`);
    const points = (Array.isArray(c.points) ? c.points : []).filter(isPt).map(p => [p[0], p[1]]);
    if (points.length < 2) return skipped.push(`cable ${id}: needs at least two points`);
    if (!unique(id, 'cable')) return;
    cables.push({ id, kv, points });
  });
  if (!lines.length && !substations.length && !cables.length) throw Error('network file has no usable lines, substations or cables');
  return { crs, lines, substations, cables, licence: String(j.licence || ''), attribution: String(j.attribution || ''), skipped };
}

// Pure: a flow payload -> Map(id -> loading fraction). Entries without a usable number are skipped.
export function parseFlow(j) {
  if (!j || typeof j !== 'object' || !Array.isArray(j.lines)) throw Error('flow data needs a lines list');
  if (j.format !== undefined && j.format !== 'grids.flow.v1') throw Error(`flow format ${j.format} is not grids.flow.v1`);
  const out = new Map();
  for (const f of j.lines) {
    if (!f || typeof f.id !== 'string') continue;
    let l = Number.isFinite(f.loading) ? f.loading : Number.isFinite(f.percent) ? f.percent / 100
      : Number.isFinite(f.mw) && f.ratingMW > 0 ? Math.abs(f.mw) / f.ratingMW : NaN;
    if (Number.isFinite(l) && l >= 0 && l <= 10) out.set(f.id.trim().slice(0, 40), l);
  }
  return out;
}

// An anonymous demo network on open test land near the origin, one line of each class. Illustrative only.
function run(x0, y0, x1, y1, span) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / span)), out = [];
  for (let i = 0; i <= n; i++) out.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
  return out;
}
export const DEMO = Object.freeze({
  format: 'grids.network.v1', crs: 'local', licence: 'Apache-2.0', attribution: 'anonymous demo network, illustrative',
  lines: [
    { id: 'D400', kv: 400, towers: [...run(-2520, -600, 0, -600, 360), ...run(0, -600, 2400, -300, 360).slice(1)] },
    { id: 'D275', kv: 275, towers: run(-2400, 900, 2300, 1300, 330) },
    { id: 'D220', kv: 220, towers: run(-1800, 2200, 2000, 1800, 320) },
    { id: 'D132', kv: 132, towers: run(-2450, -1720, 245, -1000, 280) },
    { id: 'D66', kv: 66, towers: run(-2400, 300, 0, 400, 200) },
    { id: 'D33', kv: 33, towers: run(650, 310, 1830, 600, 100) },
    { id: 'D11', kv: 11, towers: run(1870, 600, 2400, 100, 80) }
  ],
  substations: [
    { id: 'S400', kv: 400, at: [400, -1000] }, { id: 'S132', kv: 132, at: [-2500, -1750] },
    { id: 'S132B', kv: 132, at: [600, 300] }, { id: 'S33', kv: 33, at: [1850, 600] }, { id: 'S11', kv: 11, at: [2420, 80] }
  ],
  cables: [{ id: 'C132', kv: 132, points: [[400, -900], [420, -300], [600, 270]] }]
});
export const DEMO_FLOW = Object.freeze({ format: 'grids.flow.v1', lines: [
  { id: 'D400', loading: 0.62 }, { id: 'D275', loading: 0.48 }, { id: 'D220', loading: 0.35 }, { id: 'D132', loading: 0.91 },
  { id: 'D66', loading: 0.55 }, { id: 'D33', loading: 1.08 }, { id: 'D11', loading: 0.27 }, { id: 'C132', loading: 0.74 }] });

// ---------------------------------------------------------------- geometry

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const unit = (dx, dy) => { const l = Math.hypot(dx, dy); return l > 0 ? [dx / l, dy / l] : [1, 0]; };
function directionAt(P, k) {
  const a = k > 0 ? unit(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]) : null;
  const b = k < P.length - 1 ? unit(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]) : null;
  if (a && b) return unit(a[0] + b[0], a[1] + b[1]);
  return a || b;
}

// Pure: builds every batch and solid within `radius` of the cell centre [cx, cy].
// opts: { ground(x, y), shown: Set, flowOn, flow: Map, sagRatio, radius, cx, cy, toLocal([x, y]) }
// Returns { buffers: Map(key -> { color, a: number[] }), solids, stats }.
export function buildGeometry(net, o) {
  const { ground, shown, flowOn, flow, sagRatio, radius, cx, cy } = o;
  const L = o.toLocal || (p => p);
  const bufs = new Map(), solids = [];
  const stats = { lines: 0, spans: 0, towers: 0, substations: 0, cables: 0, clearance: null };
  const seg = (key, color, ax, ay, az, bx, by, bz) => {
    let b = bufs.get(key);
    if (!b) { b = { color, a: [] }; bufs.set(key, b); }
    b.a.push(ax - cx, ay - cy, az, bx - cx, by - cy, bz);
  };
  const flowKey = id => {
    if (!flow.has(id)) return ['flow-none', [...FLOW_NONE]];
    const b = loadingBand(flow.get(id));
    return ['flow-' + b, bandColour(b)];
  };
  const wireKey = (kind, kv, id) => (flowOn ? flowKey(id) : [`${kv}-${kind}`, withAlpha(COLOURS[kv], ALPHA[kind])]);
  const near = (x, y, r = radius) => Math.hypot(x - cx, y - cy) <= r;

  for (const line of net.lines) {
    if (!shown.has(line.kv)) continue;
    const T = TYPES[line.kv], P = line.towers.map(L), n = P.length;
    const [ck, cc] = wireKey('conductors', line.kv, line.id);
    const tk = `${line.kv}-towers`, tc = withAlpha(toward(COLOURS[line.kv], TOWER_GREY, 0.45), ALPHA.towers);
    const G = P.map(p => ground(p[0], p[1])), D = P.map((_, k) => directionAt(P, k));
    const ratio = line.sag ?? sagRatio ?? T.sag;
    let drew = false;
    // Attachment points at tower k: phases (with bundle), and the earth wire for a lattice.
    const attach = k => {
      const [x, y] = P[k], g = G[k], [dx, dy] = D[k], px = -dy, py = dx, out = [];
      if (T.kind === 'lattice') {
        const sides = line.circuits === 2 ? [-1, 1] : [1];
        for (const [z, h] of T.arms) for (const s of sides) out.push([x + s * h * px, y + s * h * py, g + z - T.insulator]);
      } else {
        for (const s of [-1, 0, 1]) out.push([x + s * T.armHalf * px, y + s * T.armHalf * py, g + T.armZ + T.pin]);
      }
      return out;
    };
    const A = P.map((_, k) => attach(k));
    for (let k = 0; k < n - 1; k++) {
      const [x0, y0] = P[k], [x1, y1] = P[k + 1];
      const dist = segDist(cx, cy, x0, y0, x1, y1);
      if (dist > radius) continue;
      drew = true;
      stats.spans++;
      const span = Math.hypot(x1 - x0, y1 - y0);
      if (!(span > 1)) continue;
      const a = paramFromSag(span, ratio), [ux, uy] = unit(x1 - x0, y1 - y0), qx = -uy, qy = ux;
      const detail = dist <= DETAIL;
      const N = detail ? Math.max(6, Math.min(48, Math.ceil(span / 10))) : Math.max(4, Math.min(16, Math.ceil(span / 30)));
      const offs = detail ? bundleOffsets(line.bundle, T.spacing || 0.4) : [[0, 0]];
      const lowOff = Math.min(...bundleOffsets(line.bundle, T.spacing || 0.4).map(q => q[1]));
      const wires = A[k].map((p, i) => [p, A[k + 1][i]]);
      const lowest = Math.min(...A[k].map(p => p[2])) + 0.01; // only the bottom phases can set the clearance
      if (T.kind === 'lattice') wires.push([[x0, y0, G[k] + T.height], [x1, y1, G[k + 1] + T.height], true]);
      for (const [p, q, earth] of wires) {
        const c = catenarySpan(span, p[2], q[2], a);
        const ox = q[0] - p[0], oy = q[1] - p[1];
        for (const [oa, oz] of earth ? [[0, 0]] : offs) {
          let px_ = p[0] + oa * qx, py_ = p[1] + oa * qy, pz = c.z(0) + oz;
          for (let j = 1; j <= N; j++) {
            const t = j / N, s = t * span;
            const nx = p[0] + ox * t + oa * qx, ny = p[1] + oy * t + oa * qy, nz = c.z(s) + oz;
            if (earth) seg(tk, tc, px_, py_, pz, nx, ny, nz); else seg(ck, cc, px_, py_, pz, nx, ny, nz);
            px_ = nx; py_ = ny; pz = nz;
          }
        }
        if (earth || p[2] > lowest) continue;
        // Clearance: the lowest sub-conductor above the measured ground, sampled every CLEAR_STEP metres.
        const m = Math.max(2, Math.ceil(span / CLEAR_STEP));
        for (let j = 0; j <= m; j++) {
          const t = j / m, x = p[0] + ox * t, y = p[1] + oy * t, h = c.z(t * span) + lowOff - ground(x, y);
          if (!stats.clearance || h < stats.clearance.m) stats.clearance = { m: h, id: line.id, span: k + 1 };
        }
      }
    }
    for (let k = 0; k < n; k++) {
      if (!near(P[k][0], P[k][1], radius)) continue;
      drew = true;
      stats.towers++;
      const full = near(P[k][0], P[k][1], DETAIL);
      drawTower(seg, tk, tc, T, P[k], G[k], D[k], ground, full, solids);
    }
    if (drew) stats.lines++;
  }

  for (const s of net.substations) {
    if (!shown.has(s.kv)) continue;
    const [x, y] = L(s.at);
    if (!near(x, y, radius + Math.hypot(...s.size) / 2)) continue;
    stats.substations++;
    drawCompound(seg, s, x, y, ground, solids);
  }

  for (const c of net.cables) {
    if (!shown.has(c.kv)) continue;
    const P = c.points.map(L);
    const [key, col] = wireKey('cables', c.kv, c.id);
    let drew = false, walked = 0;
    for (let k = 0; k < P.length - 1; k++) {
      const [x0, y0] = P[k], [x1, y1] = P[k + 1], len = Math.hypot(x1 - x0, y1 - y0);
      if (segDist(cx, cy, x0, y0, x1, y1) > radius) { walked += len; continue; }
      drew = true;
      const m = Math.max(1, Math.ceil(len / DRAPE));
      let px = x0, py = y0, pz = ground(x0, y0) + 0.1;
      for (let j = 1; j <= m; j++) {
        const nx = x0 + (x1 - x0) * j / m, ny = y0 + (y1 - y0) * j / m, nz = ground(nx, ny) + 0.1;
        seg(key, col, px, py, pz, nx, ny, nz);
        px = nx; py = ny; pz = nz;
      }
      // Marker posts every MARKER_STEP metres along the whole route.
      for (let d = Math.ceil(walked / MARKER_STEP) * MARKER_STEP - walked; d <= len; d += MARKER_STEP) {
        const mx = x0 + (x1 - x0) * d / len, my = y0 + (y1 - y0) * d / len, g = ground(mx, my);
        seg(key, col, mx, my, g, mx, my, g + MARKER_H);
      }
      walked += len;
    }
    if (drew) stats.cables++;
  }
  return { buffers: bufs, solids, stats };
}

function drawTower(seg, key, col, T, [x, y], g, [dx, dy], ground, full, solids) {
  const px = -dy, py = dx;
  const at = (a, b, z) => [x + a * dx + b * px, y + a * dy + b * py, z]; // a along the line, b across
  const S = (p, q) => seg(key, col, p[0], p[1], p[2], q[0], q[1], q[2]);
  if (T.kind === 'pole') {
    const top = g + T.height, arm = g + T.armZ;
    S([x, y, g], [x, y, top]);
    S(at(0, -T.armHalf, arm), at(0, T.armHalf, arm));
    for (const s of [-1, 0, 1]) S(at(0, s * T.armHalf, arm), at(0, s * T.armHalf, arm + T.pin));
    solids.push({ min: [x - 0.2, y - 0.2, g], max: [x + 0.2, y + 0.2, top] });
    return;
  }
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const waist = T.arms[T.arms.length - 1][0], topArm = T.arms[0][0];
  // Legs stand on the measured ground at each foot.
  const feet = C.map(([a, b]) => { const f = at(a * T.baseHalf, b * T.baseHalf, 0); f[2] = ground(f[0], f[1]); return f; });
  const levels = full ? [0.25, 0.5, 0.75, 1] : [1];
  let prev = feet;
  for (const t of levels) {
    const h = T.baseHalf + (T.topHalf - T.baseHalf) * t, z = g + waist * t;
    const ring = C.map(([a, b]) => at(a * h, b * h, z));
    for (let i = 0; i < 4; i++) {
      S(prev[i], ring[i]);
      if (full) { S(ring[i], ring[(i + 1) % 4]); S(prev[i], ring[(i + 1) % 4]); S(prev[(i + 1) % 4], ring[i]); }
    }
    prev = ring;
  }
  // Upper body, arms and insulators.
  const upper = [...T.arms].reverse();
  for (const [z] of upper) {
    const ring = C.map(([a, b]) => at(a * T.topHalf, b * T.topHalf, g + z));
    for (let i = 0; i < 4; i++) { if (ring[i][2] > prev[i][2]) S(prev[i], ring[i]); if (full) S(ring[i], ring[(i + 1) % 4]); }
    prev = ring;
  }
  const apex = [x, y, g + T.height];
  for (let i = 0; i < 4; i++) S(prev[i], apex);
  for (const [z, half] of T.arms) {
    const depth = Math.min(2, 0.06 * T.height);
    for (const s of [-1, 1]) {
      const tip = at(0, s * half, g + z);
      if (full) {
        for (const a of [-1, 1]) { S(at(a * T.topHalf, s * T.topHalf, g + z), tip); S(at(a * T.topHalf, s * T.topHalf, g + z + depth), tip); }
      } else S([x, y, g + z], tip);
      S(tip, [tip[0], tip[1], tip[2] - T.insulator]);
    }
  }
  const zMin = Math.min(g, ...feet.map(f => f[2])), r = T.baseHalf * Math.SQRT2;
  solids.push({ min: [x - r, y - r, zMin], max: [x + r, y + r, g + T.height] });
}

function drawCompound(seg, s, x, y, ground, solids) {
  const key = `${s.kv}-compounds`, col = withAlpha(COLOURS[s.kv], ALPHA.compounds), fence = withAlpha(TOWER_GREY, 0.6);
  const K = COMPOUND[s.kv], [w, d] = s.size, x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2;
  const fk = `${s.kv}-fences`;
  let zMin = Infinity, zMax = -Infinity;
  // Fence: bottom rail on the ground, top rail at FENCE_H, posts at each drape point.
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / DRAPE));
    let px = ax, py = ay, pg = ground(ax, ay);
    for (let j = 1; j <= m; j++) {
      const nx = ax + (bx - ax) * j / m, ny = ay + (by - ay) * j / m, ng = ground(nx, ny);
      seg(fk, fence, px, py, pg, nx, ny, ng);
      seg(fk, fence, px, py, pg + FENCE_H, nx, ny, ng + FENCE_H);
      seg(fk, fence, px, py, pg, px, py, pg + FENCE_H);
      zMin = Math.min(zMin, pg); zMax = Math.max(zMax, pg);
      px = nx; py = ny; pg = ng;
    }
  }
  const g = ground(x, y);
  // Gantries across the compound, joined by a busbar: bays of about 40 m.
  let top = FENCE_H;
  if (K.gantry > 0) {
    const bays = Math.max(1, Math.round(w / 40)), gy0 = y - d / 4, gy1 = y + d / 4;
    let last = null;
    for (let i = 0; i <= bays; i++) {
      const gx = x0 + w * (i + 0.5) / (bays + 1), ga = ground(gx, gy0), gb = ground(gx, gy1), zt = Math.max(ga, gb) + K.gantry;
      seg(key, col, gx, gy0, ga, gx, gy0, zt); seg(key, col, gx, gy1, gb, gx, gy1, zt); seg(key, col, gx, gy0, zt, gx, gy1, zt);
      if (last) { seg(key, col, last[0], gy0, last[1], gx, gy0, zt); seg(key, col, last[0], gy1, last[1], gx, gy1, zt); }
      last = [gx, zt];
      zMax = Math.max(zMax, zt - K.gantry);
    }
    top = Math.max(top, K.gantry);
  }
  // Transformer: a box at the centre.
  const [tw, td, th] = K.tx, bx0 = x - tw / 2, bx1 = x + tw / 2, by0 = y - td / 2, by1 = y + td / 2;
  const B = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = B[i], [cx, cy] = B[(i + 1) % 4];
    seg(key, col, ax, ay, g, cx, cy, g); seg(key, col, ax, ay, g + th, cx, cy, g + th); seg(key, col, ax, ay, g, ax, ay, g + th);
  }
  top = Math.max(top, th);
  zMin = Math.min(zMin, g); zMax = Math.max(zMax, g);
  solids.push({ min: [x0, y0, zMin], max: [x1, y1, zMax + top] });
}

// ---------------------------------------------------------------- the pack

export function createGrids() {
  let api = null, on = true, net = null, status = 'no network loaded; type grids demo';
  let dataV = 0, flowV = 0, originV = 0, buildNo = 0;
  let flow = new Map(), flowOn = false, shown = new Set(NOMINAL), sagRatio = DEFAULT_SAG, radius = DEFAULT_RADIUS;
  let cache = { sig: null, batches: [], solids: [], stats: null };
  let overloaded = new Set();

  const say = t => { try { api?.log?.('grids: ' + t); } catch { /* logging is best effort */ } };
  const emit = (topic, payload) => { try { api?.events?.emit(topic, payload); } catch (e) { say(e.message); } };
  const setNetwork = (j, from) => {
    net = parseNetwork(j); dataV++;
    status = `${from}: ${net.lines.length} lines, ${net.substations.length} compounds, ${net.cables.length} cables` +
      (net.skipped.length ? `, ${net.skipped.length} skipped` : '');
    if (net.skipped.length) say('skipped: ' + net.skipped.join('; '));
    emit('summary', { lines: net.lines.length, towers: net.lines.reduce((s, l) => s + l.towers.length, 0),
      substations: net.substations.length, cables: net.cables.length, classes: [...new Set(net.lines.map(l => l.kv))] });
  };
  const setFlow = m => {
    flow = m; flowV++;
    const over = [...flow].filter(([, l]) => l >= 1).map(([id]) => id).sort();
    for (const id of over) if (!overloaded.has(id)) emit('overload', { id, loading: flow.get(id) });
    overloaded = new Set(over);
  };
  const toLocal = () => {
    if (!net || net.crs !== 'national') return null;
    const o = api?.origin?.() || { e: 0, n: 0 };
    return p => [p[0] - o.e, p[1] - o.n];
  };

  function build(ctx = {}) {
    const pos = Array.isArray(ctx.pos) ? ctx.pos : [0, 0, 0];
    const cx = Math.round((Number(pos[0]) || 0) / CELL) * CELL, cy = Math.round((Number(pos[1]) || 0) / CELL) * CELL;
    const sig = [dataV, flowV, flowOn, [...shown].sort().join(','), sagRatio, radius, cx, cy, ctx.groundVersion, originV].join('|');
    if (sig === cache.sig) return cache;
    if (!net) { cache = { sig, batches: [], solids: [], stats: null }; return cache; }
    const h = typeof ctx.heightAt === 'function' ? ctx.heightAt : () => 0;
    const ground = (x, y) => { const z = h(x, y); return Number.isFinite(z) ? z : 0; };
    const g = buildGeometry(net, { ground, shown, flowOn, flow, sagRatio, radius, cx, cy, toLocal: toLocal() });
    buildNo++;
    const batches = [...g.buffers].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, b]) => ({ key, version: 'b' + buildNo, color: b.color, origin: [cx, cy, 0], positions: new Float32Array(b.a) }));
    cache = { sig, batches, solids: g.solids, stats: g.stats };
    return cache;
  }

  const kvList = words => {
    const out = [];
    for (const w of words) {
      const v = Number(String(w).replace(/kv$/i, ''));
      if (!NOMINAL.includes(v)) throw Error(`${w} is not a class; use ${NOMINAL.join(', ')} or all`);
      out.push(v);
    }
    if (!out.length) throw Error('name a class: ' + NOMINAL.join(', ') + ' or all');
    return out;
  };
  const summary = () => (net ? status : 'no network loaded; type grids demo');

  function command(args) {
    const w = (args[0] || 'info').toLowerCase(), rest = args.slice(1);
    if (w === 'info') return summary();
    if (w === 'demo') { setNetwork(DEMO, 'demo network'); setFlow(parseFlow(DEMO_FLOW)); return 'demo network loaded (anonymous, illustrative); grids flow on to colour by loading'; }
    if (w === 'clear') { net = null; dataV++; setFlow(new Map()); return 'grid layers cleared'; }
    if (w === 'show' || w === 'hide') {
      const all = rest.length === 1 && rest[0].toLowerCase() === 'all';
      const list = all ? [...NOMINAL] : kvList(rest);
      for (const v of list) { if (w === 'show') shown.add(v); else shown.delete(v); }
      shown = new Set(shown);
      return `showing ${[...shown].sort((a, b) => b - a).join(' ') || 'no'} kV`;
    }
    if (w === 'flow') {
      const v = (rest[0] || 'toggle').toLowerCase();
      if (v === 'on' || v === 'off' || v === 'toggle') {
        flowOn = v === 'toggle' ? !flowOn : v === 'on';
        flowV++;
        return flowOn ? `load-flow colours on (${flow.size} loadings; grey where none)` : 'load-flow colours off; lines by voltage class';
      }
      if (v === 'clear') { setFlow(new Map()); return 'loadings cleared'; }
      const pct = Number(String(rest[1] ?? '').replace(/%$/, ''));
      if (rest.length !== 2 || !Number.isFinite(pct) || pct < 0 || pct > 1000) throw Error('grids flow on | off | toggle | clear | <line id> <percent>');
      const m = new Map(flow); m.set(rest[0], pct / 100); setFlow(m);
      return `${rest[0]} at ${pct} % of rating`;
    }
    if (w === 'sag') {
      const p = Number(String(rest[0] ?? '').replace(/%$/, ''));
      if ((rest[0] || '').toLowerCase() === 'class') { sagRatio = null; return 'sag assumed by class: 3.5 % at 220 kV and above, 2.5 % below (illustrative)'; }
      if (!Number.isFinite(p) || p < 1 || p > 8) throw Error('grids sag needs a percentage of span from 1 to 8, for example grids sag 3.5, or grids sag class');
      sagRatio = p / 100; return `sag assumed ${p} % of span (illustrative)`;
    }
    if (w === 'radius') {
      const r = Number(rest[0]);
      if (!Number.isFinite(r) || r < 500 || r > 20000) throw Error('grids radius needs metres from 500 to 20000');
      radius = r; return `drawing grid layers within ${r} m`;
    }
    throw Error('grids info | demo | show <kV...|all> | hide <kV...> | flow on|off|<id> <percent> | sag <percent> | radius <m> | clear');
  }

  return {
    id: 'grids',
    async init(a) {
      api = a;
      const c = a.config || {};
      if (Array.isArray(c.show)) { const s = c.show.map(Number).filter(v => NOMINAL.includes(v)); if (s.length) shown = new Set(s); }
      if (Number.isFinite(c.sagPercent) && c.sagPercent >= 1 && c.sagPercent <= 8) sagRatio = c.sagPercent / 100;
      if (Number.isFinite(c.radius) && c.radius >= 500 && c.radius <= 20000) radius = c.radius;
      if (c.flowOn === true) flowOn = true;
      a.events.on('world/origin', () => { originV++; });
      a.events.on('world/flow', p => { try { setFlow(parseFlow(p)); } catch (e) { say('world/flow ignored: ' + e.message); } });
      try {
        if (c.network && typeof c.network.path === 'string') setNetwork(await a.fetchJSON(c.network.path, c.network.sha256), 'network');
        else if (c.inline && typeof c.inline === 'object') setNetwork(c.inline, 'network');
        else if (c.demo === true) { setNetwork(DEMO, 'demo network'); setFlow(parseFlow(DEMO_FLOW)); }
      } catch (e) { status = 'network refused: ' + e.message; say(status); }
      try { if (c.flow && typeof c.flow.path === 'string') setFlow(parseFlow(await a.fetchJSON(c.flow.path, c.flow.sha256))); }
      catch (e) { say('flow refused: ' + e.message); }
    },
    setEnabled(v) { on = !!v; },
    active() { return false; }, // static geometry: the world may stop drawing when the viewer is still
    lines(ctx) { return on ? build(ctx).batches : []; },
    solids(ctx) { return on ? build(ctx).solids : []; },
    hud(ctx) {
      const b = build(ctx), s = b.stats, out = [];
      out.push({ id: 'network', text: net ? `grids ${status.replace(/^[^:]*: /, '')}` : 'grids: ' + status });
      out.push({ id: 'classes', text: `showing ${[...shown].sort((x, y) => y - x).join(' ') || 'no'} kV` + (s ? `, ${s.towers} towers in view` : '') });
      if (flowOn) {
        let top = null; for (const [id, l] of flow) if (!top || l > top[1]) top = [id, l];
        out.push({ id: 'flow', text: top ? `load flow: highest ${Math.round(top[1] * 100)} % on ${top[0].slice(0, 16)}` : 'load flow: no loadings given' });
      } else out.push({ id: 'flow', text: 'load flow colours off' });
      if (s?.clearance) out.push({ id: 'clearance', text: `lowest wire ${s.clearance.m.toFixed(1)} m up (${s.clearance.id.slice(0, 12)}), sag ${sagRatio ? +(sagRatio * 100).toFixed(2) + ' %' : 'by class,'} assumed` });
      return out;
    },
    commands() { return [{ verb: 'grids', run: args => command(args) }]; },
    dispose() { api = null; net = null; flow = new Map(); cache = { sig: null, batches: [], solids: [], stats: null }; overloaded = new Set(); }
  };
}

export default createGrids();
