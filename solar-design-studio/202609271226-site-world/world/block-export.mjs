// block-export.mjs: Design > Solar block > Export route (GPU-checked, illustrative). The GPU study's 33 kV export route
// (gpu-night agent A, round 11 item 3): from the prototype station pad over the EA LiDAR ground to the nearest 33 kV
// substation in GridAtlas, found both ways on a 2 m grid (GPU and a CPU Dijkstra witness agree on its cost), with the
// study's HDD candidates where it crosses a road or a watercourse and the trench spoil it works out.
// ILLUSTRATIVE: nearest by distance, not a connection offer, capacity or consent; every weight, width, depth and HDD rule
// is the study's assumption. Files are staged by tools/stage-gpu-export.mjs into sites/<site>/gpu-export/ (local,
// git-ignored) with an index naming each file's SHA-256; each is checked before use. National-grid metres, heights ODN.

export const EXPORT_LABEL = 'Export route (GPU-checked, illustrative): nearest 33 kV substation by distance, not a connection offer; ' +
  'route weights, trench and HDD rules assumed.';
export const EXPORT_DIR = 'gpu-export';
export const ROUTE_LIFT_M = 0.3, HDD_POST_M = 4, TARGET_MAST_M = 15; // drawing only
export const COLORS = Object.freeze({ route: [1, 0.55, 0.25, 1], floor: [0.7, 0.6, 0.5, 0.7], hdd: [1, 0.9, 0.3, 1], bore: [1, 0.9, 0.3, 0.8], target: [0.95, 0.97, 1, 1] });

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async bytes => hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));

// Reads sites/<site>/gpu-export/index.json and each file it names, checked against its SHA-256. -> { route, witness? }
export async function loadExport(site, { get = (u, o) => fetch(u, o), base = './world/sites/', digest = sha256 } = {}) {
  const dir = `${base}${site}/${EXPORT_DIR}/`, r = await get(dir + 'index.json', { cache: 'no-cache' });
  if (!r.ok) throw Error(`no GPU-checked export route staged for ${site}`);
  const index = await r.json(), out = {};
  for (const f of index.files || []) {
    const res = await get(dir + f.file, { cache: 'no-cache' });
    if (!res.ok) throw Error(`${f.file}: HTTP ${res.status}`);
    const bytes = await res.arrayBuffer(), h = await digest(bytes);
    if (h !== f.sha256) throw Error(`${f.file}: hash ${h.slice(0, 12)} is not the index's ${String(f.sha256).slice(0, 12)}`);
    out[f.role] = JSON.parse(new TextDecoder().decode(bytes));
  }
  if (!out.route) throw Error('the export route index names no route');
  return out;
}

// Pure: the study's file -> what the page draws and says.
export function parseExport(j, witness = null) {
  if (j?.schema !== 'gpu-night-a.export-route/1' || !Array.isArray(j.route?.route_bng)) throw Error('not a GPU export route');
  const pts = j.route.route_bng.filter(q => Array.isArray(q) && q.length >= 3 && q.every(Number.isFinite));
  if (pts.length < 2) throw Error('the export route has fewer than two points');
  const a = j.assumed || {}, depth = Number.isFinite(a.floor_m) ? a.floor_m : 1.1;
  const hdd = (j.hdd_candidates || []).filter(h => [...(h.entry_bng || []), ...(h.exit_bng || [])].length === 4)
    .map(h => ({ entry: h.entry_bng, exit: h.exit_bng, level: h.bore_level_under_feature_m, crosses: h.crosses, drill: h.drill_length_m, chainage: h.chainage_m }));
  return { pts, depth, hdd, lengthM: j.route.length_m, straightM: j.straight_line_m, spoil: j.route.spoil_m3 || {}, gradient: j.route.max_floor_gradient_pct || {},
    crossings: j.crossings || {}, target: j.target || null, photons: j.photons || [], widthM: a.trench_width_m,
    witness: witness ? { match: !!witness.match, rel: witness.rel } : null, receipt: j.body_sha256 || null };
}

// Pure: line groups { key, base, v } relative to each base. ground(e, n): measured height or NaN (for HDD ends and the
// substation, which the route file does not give heights for; off measured ground the nearest route point's is used).
export function buildExport(p, ground = () => NaN) {
  const mk = key => ({ key, base: null, v: [] });
  const seg = (G, a, b) => { G.base ||= a; for (const q of [a, b]) G.v.push(q[0] - G.base[0], q[1] - G.base[1], q[2] - G.base[2]); };
  const near = (e, n) => { let best = p.pts[0], d = Infinity; for (const q of p.pts) { const k = (q[0] - e) ** 2 + (q[1] - n) ** 2; if (k < d) { d = k; best = q; } } return best[2]; };
  const z = (e, n) => { const h = ground(e, n); return Number.isFinite(h) ? h : near(e, n); };
  const route = mk('route'), floor = mk('floor'), hdd = mk('hdd'), bore = mk('bore'), target = mk('target');
  for (let i = 1; i < p.pts.length; i++) {
    const A = p.pts[i - 1], B = p.pts[i];
    seg(route, [A[0], A[1], A[2] + ROUTE_LIFT_M], [B[0], B[1], B[2] + ROUTE_LIFT_M]);
    seg(floor, [A[0], A[1], A[2] - p.depth], [B[0], B[1], B[2] - p.depth]); // the trench floor: what the spoil comes out of
  }
  for (const h of p.hdd) {
    const ea = [h.entry[0], h.entry[1], z(...h.entry)], ex = [h.exit[0], h.exit[1], z(...h.exit)];
    for (const q of [ea, ex]) seg(hdd, q, [q[0], q[1], q[2] + HDD_POST_M]);
    const low = Number.isFinite(h.level) ? h.level : Math.min(ea[2], ex[2]) - 2, mid = [(ea[0] + ex[0]) / 2, (ea[1] + ex[1]) / 2, low];
    seg(bore, ea, mid); seg(bore, mid, ex);
  }
  if (p.target && Number.isFinite(p.target.e) && Number.isFinite(p.target.n)) {
    const g = z(p.target.e, p.target.n), s = TARGET_MAST_M / 6, t = [p.target.e, p.target.n, g];
    seg(target, t, [t[0], t[1], g + TARGET_MAST_M]);
    const P = [[t[0] + s, t[1], g + TARGET_MAST_M], [t[0], t[1] + s, g + TARGET_MAST_M + s], [t[0] - s, t[1], g + TARGET_MAST_M], [t[0], t[1] - s, g + TARGET_MAST_M - s]];
    for (let k = 0; k < 4; k++) seg(target, P[k], P[(k + 1) % 4]);
  }
  return [route, floor, hdd, bore, target].filter(G => G.base).map(G => ({ ...G, v: new Float32Array(G.v) }));
}

// Pure: the readout rows [label, text].
export function exportRows(p, fmt = { n0: x => String(Math.round(x)), len: m => `${Math.round(m)} m` }) {
  const c = p.crossings, other = o => (Number.isFinite(o.positron) && fmt.n0(o.positron) !== fmt.n0(o.electron) ? ` (checked pair ${fmt.n0(o.positron)})` : '');
  const pair = o => (o && Number.isFinite(o.electron) ? `${fmt.n0(o.electron)}${other(o)}` : 'not given');
  return [
    ['To', p.target ? `${p.target.voltage_kv ?? 33} kV substation at ${fmt.n0(p.target.e)} E, ${fmt.n0(p.target.n)} N (GridAtlas, OpenStreetMap)` : 'not given'],
    ['Route', `${fmt.len(p.lengthM)} over the ground · ${fmt.len(p.straightM)} straight line`],
    ['Trench', `floor ${p.depth} m down${p.widthM ? ` · ${p.widthM} m wide` : ''} (assumed) · steepest floor ${pair(p.gradient)} %`],
    ['Spoil', `${pair(p.spoil)} m³ (bank volume, estimate)`],
    ['Crossings', `roads ${pair(c.road)} · watercourses ${pair(c.watercourse)} · rail ${pair(c.rail)}`],
    ['HDD candidates', `${p.hdd.length} (drawn yellow: entry and exit posts, bore under the feature) · ${fmt.len(p.hdd.reduce((s, h) => s + (h.drill || 0), 0))} drilled`],
    ['Checked', p.witness ? (p.witness.match ? 'GPU route cost matches the CPU witness' : 'GPU and CPU witness disagree') +
      (p.photons.length ? ` · ${p.photons.length} counted disagreements (${p.photons.join(', ')})` : '') : 'no witness staged'],
    ['Basis', EXPORT_LABEL + (p.receipt ? ` Receipt ${p.receipt.slice(0, 12)}.` : '')]];
}
