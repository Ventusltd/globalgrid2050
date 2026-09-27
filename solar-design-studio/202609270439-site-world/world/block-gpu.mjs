// block-gpu.mjs: Design > Solar block > GPU-checked placement. The prototype's generic station as the GPU study placed
// it on open-land-01 (gpu-night agent A, round 10: least-slope placement off the tower zones and line corridors,
// origin 399560.4, 209785.7, heading -15 degrees), with its pile reveal and table twist flags and its ordered build
// (prototype-sequence.json) as the Sequential feed that the block's Play, Pause and Step drive.
// ILLUSTRATIVE: the placement rule, the tolerances and the rates are the study's assumptions; not a design, not a
// site selection. Files are staged by tools/stage-gpu-prototype.mjs into sites/<site>/gpu-prototype/ (local, git-
// ignored) with an index that names each file's SHA-256; every file is checked against it before use.
// Pure except loadPrototype (which is given its fetch and digest). National-grid metres (e, n, height ODN).

export const GPU_LABEL = 'GPU-checked placement, illustrative: the prototype station placed by an assumed least-slope rule; ' +
  'tolerances and rates assumed. Not a design or a site selection.';
export const GPU_DIR = 'gpu-prototype';
export const TABLE_LIFT_M = 1.0, PILE_POST_M = 1.2, POST_M = 2.5, STEP_M = 2; // drawing only (assumed heights)
export const WORDS = Object.freeze({
  'station-pad-earthworks': 'Station pad levelled', piles: 'Piles driven', table: 'Tables built', 'trench-dug': 'Trenches dug',
  'inverter-set': 'Inverters set', 'dc-cables-pulled': 'DC cables pulled', 'ac-cables-pulled': 'AC cables pulled', 'station-set': 'Transformers set'
});
export const COLORS = Object.freeze({
  'station-pad-earthworks': [0.95, 0.97, 1, 0.9], piles: [0.75, 0.75, 0.78, 0.8], table: [0.62, 0.72, 0.86, 0.85],
  'table-flag': [1, 0.55, 0.25, 1], 'trench-dug': [0.7, 0.6, 0.5, 0.9], 'inverter-set': [0.95, 0.97, 1, 1],
  'dc-cables-pulled': [0.35, 0.8, 1, 0.9], 'ac-cables-pulled': [0.55, 1, 0.62, 0.9], 'station-set': [1, 0.72, 0.35, 1]
});

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async bytes => hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));

// Reads sites/<site>/gpu-prototype/index.json and each file it names, checked against its SHA-256. -> { layout, sequence }
export async function loadPrototype(site, { get = (u, o) => fetch(u, o), base = './world/sites/', digest = sha256 } = {}) {
  const dir = `${base}${site}/${GPU_DIR}/`, r = await get(dir + 'index.json', { cache: 'no-cache' });
  if (!r.ok) throw Error(`no GPU-checked placement staged for ${site}`);
  const index = await r.json(), out = {};
  for (const f of index.files || []) {
    const res = await get(dir + f.file, { cache: 'no-cache' });
    if (!res.ok) throw Error(`${f.file}: HTTP ${res.status}`);
    const bytes = await res.arrayBuffer(), h = await digest(bytes);
    if (h !== f.sha256) throw Error(`${f.file}: hash ${h.slice(0, 12)} is not the index's ${String(f.sha256).slice(0, 12)}`);
    out[f.role] = JSON.parse(new TextDecoder().decode(bytes));
  }
  if (!out.layout || !out.sequence) throw Error('the GPU placement index names no layout or sequence');
  return out;
}

// Pure: the files -> { origin, heading, slope, tol, flags, tables, steps, hours, bbox }. receipt (optional): the study's
// r10 receipt, for its pile reveal flag count and assumed tolerances.
export function parsePrototype(layout, sequence, receipt = null) {
  if (layout?.schema !== 'gpu-night-a.prototype-layout/1' || sequence?.schema !== 'gpu-night-a.prototype-sequence/1') throw Error('not a GPU prototype layout and sequence');
  const pl = layout.placement, tol = sequence.twist_tol_deg ?? layout.twist_tol_deg ?? 1;
  const tables = (layout.tables || []).map(t => ({ table: t.table, twist: t.twist_deg?.electron, twistPositron: t.twist_deg?.positron,
    reveal: t.reveal_m, embedMin: t.embed_min_m, flagged: Math.abs(t.twist_deg?.electron ?? 0) > tol }));
  const steps = sequence.steps.filter(s => WORDS[s.kind] && s.geometry).map(s => ({ kind: s.kind, id: s.id, t0: s.t_start_h, t1: s.t_end_h, geometry: s.geometry,
    flagged: s.kind === 'table' && Math.abs(s.twist_deg ?? 0) > tol }));
  const all = steps.flatMap(s => flat(s.geometry));
  const e = all.map(p => p[0]), n = all.map(p => p[1]);
  return { origin: pl.origin_bng, heading: pl.heading_deg, slope: pl.mean_slope_pct, photons: pl.photons || [], tol, tables, steps,
    flags: { twisted: tables.filter(t => t.flagged).length, reveal: receipt?.piles?.ILLUSTRATIVE_flags?.reveal_outside_adjustment ?? null,
      piles: receipt?.piles?.count ?? null, revealAdjust: receipt?.assumed?.reveal_adjust_m ?? null }, hours: Math.max(...steps.map(s => s.t1)), receipt: layout.receipt?.body_sha256,
    bbox: { e0: Math.min(...e) - 10, n0: Math.min(...n) - 10, e1: Math.max(...e) + 10, n1: Math.max(...n) + 10 } };
}
function flat(g) {
  if (g.type === 'Point') return [g.coordinates];
  if (g.type === 'MultiPoint' || g.type === 'LineString') return g.coordinates;
  if (g.type === 'Polygon' || g.type === 'MultiLineString') return g.coordinates.flat();
  return [];
}

// Pure: the steps as line groups, one a kind, in national-grid metres relative to each group's base; marks[i] is the
// vertex count once the group's i-th step is drawn and ends[i] its finish hour, so the feed draws a prefix.
// ground(e, n): measured ground or NaN. A 2D point off measured ground is left out (never a guessed height).
export function buildFeed(p, ground) {
  const groups = {};
  let unmeasured = 0;
  const z = (q, lift) => { if (q.length >= 3) return q[2] + lift; const h = ground(q[0], q[1]); if (!Number.isFinite(h)) unmeasured++; return h + lift; };
  const add = (key, t1) => (groups[key] ||= { key, base: null, v: [], marks: [], ends: [] });
  const seg = (G, a, b) => { if (![a[2], b[2]].every(Number.isFinite)) return; G.base ||= a; for (const q of [a, b]) G.v.push(q[0] - G.base[0], q[1] - G.base[1], q[2] - G.base[2]); };
  const line = (G, pts, lift) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], k = a.length >= 3 && b.length >= 3 ? 1 : Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / STEP_M));
      for (let j = 0; j < k; j++) {
        const pa = [a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k], pb = [a[0] + (b[0] - a[0]) * (j + 1) / k, a[1] + (b[1] - a[1]) * (j + 1) / k];
        if (k === 1 && a.length >= 3) seg(G, [a[0], a[1], a[2] + lift], [b[0], b[1], b[2] + lift]); else seg(G, [...pa, z(pa, lift)], [...pb, z(pb, lift)]);
      }
    }
  };
  const post = (G, q, h) => { const b = z(q, 0); seg(G, [q[0], q[1], b], [q[0], q[1], b + h]); };
  for (const s of p.steps) {
    const G = add(s.flagged ? 'table-flag' : s.kind), g = s.geometry;
    if (g.type === 'Polygon') line(G, g.coordinates[0], s.kind === 'table' ? TABLE_LIFT_M : 0);
    else if (g.type === 'LineString') line(G, g.coordinates, 0);
    else if (g.type === 'MultiLineString') for (const c of g.coordinates) line(G, c, 0);
    else if (g.type === 'MultiPoint') for (const q of g.coordinates) post(G, q, PILE_POST_M);
    else if (g.type === 'Point') post(G, g.coordinates, POST_M);
    G.marks.push(G.v.length / 3); G.ends.push(s.t1);
  }
  for (const G of Object.values(groups)) G.v = new Float32Array(G.v);
  return { groups: Object.values(groups).filter(G => G.base), unmeasured };
}

// Pure: vertices of group G drawn by hour h (every step finished by then).
export function countAt(G, h) {
  let n = 0;
  for (let i = 0; i < G.ends.length && G.ends[i] <= h + 1e-9; i++) n = G.marks[i];
  return n;
}
// Pure: the step running at hour h, in words.
export function feedStage(p, h) {
  const s = p.steps.find(x => h < x.t1) || p.steps.at(-1), done = p.steps.filter(x => x.t1 <= h + 1e-9).length;
  return `Step ${Math.min(done + 1, p.steps.length)} of ${p.steps.length}: ${WORDS[s.kind]} (${s.id}), hour ${Math.round(Math.min(h, p.hours))} of ${Math.round(p.hours)}`;
}
