// Layer: ground. A desktop study of what lies under the site, from a per-site file (ground.json) written by the
// lidar pipeline from public geological, mining and groundwater sources. Self-contained: no imports (it runs from a
// blob URL). Off by default: it is switched on in the Layers panel (Planning group, "Ground").
//
// Config (manifest): { path, sha256 } of the site file, fetched through the substrate's hash check. File shape
// (British National Grid metres; a polygon is a list of [e, n] rings, or a list of such polygons):
//   { sources: [{ id, title, licence, attribution, limitations?, scans?: { link_only } }] (or { <key>: {...} }),
//     bedrock: [{ polygon, code, name, status }], superficial: [same],
//     boreholes: [{ e, n, id, drilled_length_m?, log_url? }], mining: [{ polygon, type }], mine_entries: [{ e, n, type }],
//     aquifers: [{ polygon, name|type|designation }], spz: [{ polygon, zone|name|type }],
//     thermal?: [{ polygon? | e, n, conductivity, conductivity_unit, status, source, ... }] (soil repo contract) }
// null means not imported and stays missing: the layer says "not in this file", never "none". [] means queried, none.
// Items may name their source (item.source = a source id); otherwise the source is matched by its id.
//
// Drawn quietly on the ground: superficial and bedrock boundaries as faint lines, boreholes as short sticks, mining
// areas as dashed outlines, mine entries as small rings. It measures nothing; the readout is a desktop study only.

export const COLORS = {
  superficial: [0.86, 0.76, 0.52, 0.34],
  bedrock: [0.66, 0.60, 0.92, 0.30],
  borehole: [0.88, 0.90, 0.82, 0.70],
  mining: [1.00, 0.58, 0.36, 0.55],
  entry: [1.00, 0.46, 0.36, 0.70],
};
export const STICK_M = 3, RING_M = 4, DRAPE_M = 8, LIFT_M = 0.15, DASH = [6, 4];
export const KEYS = ['bedrock', 'superficial', 'boreholes', 'mining', 'mine_entries', 'aquifers', 'spz', 'thermal'];

const isPt = p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// Pure: any polygon shape (one ring, rings, or a multipolygon) -> flat list of rings of at least 3 points.
export function ringsOf(poly) {
  if (!Array.isArray(poly) || !poly.length) return [];
  if (isPt(poly[0])) { const r = poly.filter(isPt); return r.length >= 3 ? [r] : []; }
  return poly.flatMap(ringsOf);
}

// Pure: even-odd point in polygon over all rings (holes and multipolygons both come out right).
export function inside(rings, e, n) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if ((yi > n) !== (yj > n) && e < (xj - xi) * (n - yi) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

const bbox = rings => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};
const areaItem = (it, label) => { const rings = ringsOf(it?.polygon); return rings.length ? { ...it, rings, box: bbox(rings), label: label(it) } : null; };
const text = (...v) => v.find(s => typeof s === 'string' && s.trim()) || '';

// Which source ids feed which list, when the items do not say: matched on the source id.
const MATCH = { bedrock: /bedrock/, superficial: /superficial/, boreholes: /borehole|sobi/, mining: /coal|mining|high-risk/,
  mine_entries: /entr/, aquifers: /aquifer/, spz: /spz|source-protection/, thermal: /thermal/ };

// Pure: the sources block as { <list key>: source } (bedrock, superficial, boreholes, mining, ...).
export function sourcesOf(j) {
  const s = j?.sources, byId = {}, out = {};
  if (Array.isArray(s)) { for (const x of s) if (x && (x.id || x.key)) byId[x.id || x.key] = x; }
  else if (s && typeof s === 'object') Object.assign(byId, s);
  for (const k of KEYS) {
    const named = Array.isArray(j?.[k]) ? j[k].find(it => it && byId[it.source])?.source : null;
    const id = named || (k in byId ? k : Object.keys(byId).find(i => MATCH[k].test(i) && !(k === 'mining' && /entr/.test(i))));
    if (id && byId[id]) out[k] = byId[id];
  }
  return out;
}

// Pure: the file -> model. Each list is null when the file does not carry it (missing stays missing).
export function parseGroundFile(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) throw Error('ground file is not an object');
  if (!KEYS.some(k => Array.isArray(j[k]))) throw Error('ground file has none of ' + KEYS.join(', '));
  const list = (k, f) => (Array.isArray(j[k]) ? j[k].map(f).filter(Boolean) : null);
  const unit = it => text(it.name, it.code, 'unnamed unit');
  const point = it => (it && Number.isFinite(it.e) && Number.isFinite(it.n) ? it : null);
  return {
    sources: sourcesOf(j),
    bedrock: list('bedrock', it => areaItem(it, unit)),
    superficial: list('superficial', it => areaItem(it, unit)),
    boreholes: list('boreholes', point),
    mining: list('mining', it => areaItem(it, x => text(x.type, x.name, 'mining area'))),
    mine_entries: list('mine_entries', point),
    aquifers: list('aquifers', it => areaItem(it, x => text(x.designation, x.name, x.type, 'aquifer'))),
    spz: list('spz', it => areaItem(it, x => text(x.zone != null ? `SPZ ${x.zone}` : '', x.name, x.type, 'source protection zone'))),
    thermal: list('thermal', it => (it && (ringsOf(it.polygon).length || point(it)) ? { ...it, rings: ringsOf(it.polygon) } : null)),
  };
}

const hit = (a, e, n) => e >= a.box[0] && e <= a.box[2] && n >= a.box[1] && n <= a.box[3] && inside(a.rings, e, n);

// Pure: what is mapped at (e, n). Each entry is null when the file has no such list, [] when nothing is mapped there.
export function at(model, e, n) {
  const pick = k => (model[k] ? model[k].filter(a => hit(a, e, n)) : null);
  return { superficial: pick('superficial'), bedrock: pick('bedrock'), mining: pick('mining'), aquifers: pick('aquifers'), spz: pick('spz') };
}

// Pure: distance from (e, n) to a polyline [[e, n], ...].
export function distToLine(path, e, n) {
  if (path.length === 1) return Math.hypot(e - path[0][0], n - path[0][1]);
  let best = Infinity;
  for (let k = 0; k + 1 < path.length; k++) {
    const [ax, ay] = path[k], [bx, by] = path[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const f = L2 ? Math.min(1, Math.max(0, ((e - ax) * dx + (n - ay) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * f - e, ay + dy * f - n));
  }
  return best;
}

// Pure: parameters (0..1) where segment a->b crosses the edges of the rings.
function cuts(rings, a, b) {
  const out = [], rx = b[0] - a[0], ry = b[1] - a[1];
  for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [px, py] = r[j], sx = r[i][0] - px, sy = r[i][1] - py, den = rx * sy - ry * sx;
    if (!den) continue;
    const t = ((px - a[0]) * sy - (py - a[1]) * sx) / den, u = ((px - a[0]) * ry - (py - a[1]) * rx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) out.push(t);
  }
  return out;
}

// Pure: lengths of the route (plan metres) within each area of a list, keyed by label, in route order.
// Where no area of the list covers a stretch, its length goes to `gap` (e.g. "not mapped"). null if the list is missing.
export function crossings(areas, path, gap = 'not mapped') {
  if (!areas) return null;
  if (!areas.length) return []; // queried, none mapped
  const out = new Map();
  const add = (k, d) => out.set(k, (out.get(k) || 0) + d);
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k], b = path[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!L) continue;
    const ts = [0, 1, ...areas.flatMap(x => cuts(x.rings, a, b))].sort((p, q) => p - q);
    for (let i = 0; i + 1 < ts.length; i++) {
      const d = (ts[i + 1] - ts[i]) * L;
      if (d < 1e-9) continue;
      const m = (ts[i] + ts[i + 1]) / 2, e = a[0] + (b[0] - a[0]) * m, n = a[1] + (b[1] - a[1]) * m;
      const found = areas.filter(x => hit(x, e, n));
      if (!found.length) add(gap, d); else for (const x of found) add(x.label, d);
    }
  }
  return [...out].map(([label, length]) => ({ label, length }));
}

// Pure: everything the route readout needs, for a route in national-grid metres. near: search radius, metres.
export function alongRoute(model, path, near = 250) {
  const pts = path.filter(isPt);
  if (!pts.length) return null;
  const within = list => (list ? list.map(p => ({ ...p, distance: distToLine(pts, p.e, p.n) })).filter(p => p.distance <= near)
    .sort((a, b) => a.distance - b.distance) : null);
  const thermal = model.thermal ? model.thermal.filter(t => (t.rings.length ? pts.some(([e, n]) => inside(t.rings, e, n))
    : distToLine(pts, t.e, t.n) <= near)) : null;
  return {
    superficial: crossings(model.superficial, pts, 'no superficial deposit mapped'),
    bedrock: crossings(model.bedrock, pts),
    mining: crossings(model.mining, pts)?.filter(c => c.label !== 'not mapped') ?? null,
    aquifers: crossings(model.aquifers, pts)?.filter(c => c.label !== 'not mapped') ?? null,
    spz: crossings(model.spz, pts)?.filter(c => c.label !== 'not mapped') ?? null,
    boreholes: within(model.boreholes), mine_entries: within(model.mine_entries), thermal, near,
  };
}

// ---- drawing ------------------------------------------------------------------------------------------
// Pure: line pairs for every ring, draped on heightAt every DRAPE_M or less, relative to o; dash: [on, off] or null.
export function drapeRings(rings, local, heightAt, o, dash = null) {
  const out = [];
  const P = (x, y) => [x - o[0], y - o[1], heightAt(x, y) + LIFT_M - o[2]];
  for (const r of rings) for (let i = 0; i < r.length; i++) {
    const [ax, ay] = local(r[i][0], r[i][1]), [bx, by] = local(r[(i + 1) % r.length][0], r[(i + 1) % r.length][1]);
    const L = Math.hypot(bx - ax, by - ay);
    if (!L) continue;
    const marks = [];
    if (dash) { for (let s = 0; s < L; s += dash[0] + dash[1]) marks.push([s, Math.min(L, s + dash[0])]); }
    else marks.push([0, L]);
    for (const [s0, s1] of marks) {
      const m = Math.max(1, Math.ceil((s1 - s0) / DRAPE_M));
      for (let k = 0; k < m; k++) {
        const f0 = (s0 + (s1 - s0) * k / m) / L, f1 = (s0 + (s1 - s0) * (k + 1) / m) / L;
        out.push(...P(ax + (bx - ax) * f0, ay + (by - ay) * f0), ...P(ax + (bx - ax) * f1, ay + (by - ay) * f1));
      }
    }
  }
  return out;
}

// Pure: every batch for the model at the given origin and ground.
export function buildGround(model, origin, heightAt) {
  const local = (e, n) => [e - origin.e, n - origin.n], batches = [];
  const o = [0, 0, Number.isFinite(heightAt(0, 0)) ? heightAt(0, 0) : 0];
  const push = (key, color, pos) => { if (pos.length >= 6) batches.push({ key: `ground/${key}`, origin: o, color, positions: new Float32Array(pos) }); };
  for (const k of ['bedrock', 'superficial']) push(k, COLORS[k], (model[k] || []).flatMap(a => drapeRings(a.rings, local, heightAt, o)));
  push('mining', COLORS.mining, (model.mining || []).flatMap(a => drapeRings(a.rings, local, heightAt, o, DASH)));
  const sticks = [];
  for (const b of model.boreholes || []) {
    const [x, y] = local(b.e, b.n), z = heightAt(x, y) - o[2];
    sticks.push(x - o[0], y - o[1], z, x - o[0], y - o[1], z + STICK_M);
  }
  push('boreholes', COLORS.borehole, sticks);
  const rings = [];
  for (const m of model.mine_entries || []) {
    const ring = [];
    for (let k = 0; k < 16; k++) { const a = k / 16 * 2 * Math.PI; ring.push([m.e + RING_M * Math.cos(a), m.n + RING_M * Math.sin(a)]); }
    rings.push(...drapeRings([ring], local, heightAt, o));
  }
  push('entries', COLORS.entry, rings);
  return batches;
}

// Pure: the status line.
export function groundStatus(model) {
  const n = k => (model[k] ? String(model[k].length) : 'not in file');
  return `ground: ${n('superficial')} superficial, ${n('bedrock')} bedrock, ${n('boreholes')} boreholes, ` +
    `${n('mining')} mining areas, ${n('mine_entries')} mine entries; desktop study only`;
}

export function createGround() {
  let api = null, model = null, state = 'idle'; // idle | loading | ready | failed
  let built = { version: null, batches: [] };

  function load() {
    if (state !== 'idle' || !api) return;
    const path = api.config?.path, sha = api.config?.sha256;
    if (!path || !sha) { state = 'failed'; layer.status = 'no ground file configured (config.path and config.sha256)'; return; }
    state = 'loading'; layer.status = 'loading ' + path;
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      model = parseGroundFile(j); state = 'ready'; layer.status = groundStatus(model);
      api.invalidate({ ground: false });
    }).catch(e => { state = 'failed'; layer.status = 'ground file failed: ' + e.message; });
  }
  const origin = () => (api && typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 });

  const layer = {
    id: 'ground',
    status: 'off until switched on',
    // Nothing is fetched at start: the file loads the first time the layer is drawn (switched on).
    init(a) { api = a; },
    lines(ctx) {
      if (!api) return [];
      if (state === 'idle') load();
      if (state !== 'ready') return [];
      const o = origin(), heightAt = typeof ctx.heightAt === 'function' ? ctx.heightAt : () => 0;
      const version = `${o.e},${o.n},${o.id}@${ctx.groundVersion ?? 0}`;
      if (built.version === version) return built.batches;
      try { built = { version, batches: buildGround(model, o, heightAt).map(b => ({ ...b, version })) }; }
      catch (e) { built = { version, batches: [] }; layer.status = 'ground build failed: ' + e.message; }
      return built.batches;
    },
    ready: () => state === 'ready',
    // National-grid (e, n) -> what is mapped there, with the sources; null until the file has loaded.
    underfoot: (e, n) => (model ? { ...at(model, e, n), sources: model.sources } : null),
    // Route [[e, n], ...] in national-grid metres -> crossings, boreholes, mining; null until loaded.
    alongRoute: (path, near) => (model ? { ...alongRoute(model, path, near), sources: model.sources } : null),
    debug: () => ({ state, model, version: built.version })
  };
  return layer;
}

export default createGround();
