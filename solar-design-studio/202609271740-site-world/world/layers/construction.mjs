// Layer: construction. How an overhead line and its connection might be built on this ground, from the GPU
// construction study (gpu-night agent A, export/<site>/construction.odbl.json): tower pads, crane pads, conductors
// at an ASSUMED sag, a HYPOTHETICAL connection compound platform, access routes at their finished levels, stringing
// sites and ranked siting candidates. ILLUSTRATIVE ONLY: towers are inferred from OpenStreetMap vertices, sizes,
// heights and sag are assumed. Nothing here is a design, a survey, or a pass or fail on any real asset, and the
// clearance figures are illustrative distances at an assumed sag, never a statement about a place.
//
// The file is ODbL (OpenStreetMap positions): it is staged as its own file and credited on its own line, never
// merged with OGL or MIT data. Heights are metres above Ordnance Datum Newlyn from the EA DTM, carried in the file,
// so every feature stands at its own level (nothing is draped on a guessed height).
// Off by default: it fetches nothing until switched on (Layers > Grid > Construction, illustrative).

export const ILLUSTRATIVE = 'illustrative only: towers inferred from OpenStreetMap, sizes, heights and sag assumed';
export const SCHEMA = 'gpu-night-a.construction/1';
// Kind in the file -> how it is drawn and named. Words only; no verdicts.
export const KINDS = Object.freeze({
  'tower-pad': { name: 'tower pads', color: [1, 0.62, 0.2, 0.9] },
  'crane-pad': { name: 'crane pads', color: [1, 0.85, 0.3, 0.8] },
  'conductor-ILLUSTRATIVE': { name: 'conductors at an assumed sag', color: [0.95, 0.55, 0.55, 0.75] },
  'compound-platform': { name: 'hypothetical compound platforms', color: [0.8, 0.6, 1, 0.9] },
  'access-route-ILLUSTRATIVE': { name: 'access routes', color: [0.92, 0.92, 0.92, 0.8] },
  'stringing-site-ILLUSTRATIVE': { name: 'stringing sites', color: [0.4, 0.9, 0.7, 0.8] },
  'siting-candidate-HYPOTHETICAL': { name: 'hypothetical siting candidates', color: [0.7, 0.72, 1, 0.7] }
});
const POST_M = 1, MARK = { arm: 4, post: 8 };

// Pure: the checked file -> { features: [{ kind, id, pts: [[e, n, z]...], closed, props }], sources, receipts }.
export function parseConstruction(j) {
  if (!j || j.schema !== SCHEMA || !Array.isArray(j.features)) throw Error(`not a ${SCHEMA} file`);
  if (!/OpenStreetMap/.test(j.attribution || '')) throw Error('the file carries no OpenStreetMap credit');
  const features = [];
  for (const f of j.features) {
    const kind = f?.properties?.kind, g = f?.geometry;
    if (!KINDS[kind] || !g) continue;
    const pts = g.type === 'Point' ? [g.coordinates] : g.type === 'LineString' ? g.coordinates : g.type === 'Polygon' ? g.coordinates[0] : null;
    if (!pts || !pts.every(p => p.length >= 3 && p.every(Number.isFinite))) continue;
    features.push({ kind, id: f.properties.id || f.properties.span || f.properties.tower || '', pts, closed: g.type === 'Polygon', props: f.properties });
  }
  return { features, attribution: j.attribution, other: j.other_sources || [], receipts: (j.receipts || []).length, site: j.site };
}

// Pure: a clearance in words. Illustrative distance at an assumed sag; never a verdict on a place.
export function clearanceWords(m) {
  return Number.isFinite(m) ? `illustrative ground clearance ${m.toFixed(1)} m at an assumed sag` : 'no illustrative clearance worked out';
}

// Pure: features -> line batches in local metres (origin { e, n }). Each batch carries its own origin (the first
// point of its first feature) so it stays sharp far from the site origin.
export function buildConstruction(model, origin) {
  const byKind = new Map();
  for (const f of model.features) {
    if (!byKind.has(f.kind)) byKind.set(f.kind, { o: [f.pts[0][0] - origin.e, f.pts[0][1] - origin.n, f.pts[0][2]], v: [] });
    const b = byKind.get(f.kind), [ox, oy, oz] = b.o, v = b.v;
    const L = p => [p[0] - origin.e - ox, p[1] - origin.n - oy, p[2] - oz];
    if (f.pts.length === 1) { // a point: a cross on the ground and a post
      const [x, y, z] = L(f.pts[0]), a = MARK.arm;
      v.push(x - a, y, z, x + a, y, z, x, y - a, z, x, y + a, z, x, y, z, x, y, z + MARK.post);
      continue;
    }
    for (let i = 1; i < f.pts.length; i++) v.push(...L(f.pts[i - 1]), ...L(f.pts[i]));
    if (f.closed) for (const p of f.pts.slice(0, -1)) { const [x, y, z] = L(p); v.push(x, y, z, x, y, z - POST_M); } // edge posts
  }
  return [...byKind].map(([kind, b]) => ({ key: `construction/${kind}`, origin: b.o, color: KINDS[kind].color,
    positions: new Float32Array(b.v), label: `${KINDS[kind].name}: ${ILLUSTRATIVE}` }));
}

// Pure: the status line: counts by kind, the lowest illustrative clearance, the credit reminder.
export function constructionStatus(model) {
  const n = {};
  for (const f of model.features) n[f.kind] = (n[f.kind] || 0) + 1;
  const parts = Object.keys(KINDS).filter(k => n[k]).map(k => `${n[k]} ${KINDS[k].name}`);
  const c = model.features.filter(f => f.kind === 'conductor-ILLUSTRATIVE').map(f => f.props.min_clearance_m_ILLUSTRATIVE).filter(Number.isFinite);
  const low = c.length ? `; lowest ${clearanceWords(Math.min(...c))}` : '';
  return `${parts.join(', ')}${low}; ${ILLUSTRATIVE}; ${model.receipts} GPU receipts`;
}

export function createConstruction() {
  let api = null, model = null, state = 'idle'; // idle | loading | ready | failed
  let built = { version: null, batches: [] };
  const origin = () => (api && typeof api.origin === 'function' ? api.origin() : { e: 0, n: 0, id: 0 });
  function load() {
    if (state !== 'idle' || !api) return;
    const path = api.config?.path, sha = api.config?.sha256;
    if (!path || !sha) { state = 'failed'; layer.status = 'no construction file configured (config.path and config.sha256)'; return; }
    state = 'loading'; layer.status = 'loading ' + path;
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      model = parseConstruction(j); state = 'ready'; layer.status = constructionStatus(model);
      api.invalidate({ ground: false });
    }).catch(e => { state = 'failed'; layer.status = 'construction file failed: ' + e.message; });
  }
  const layer = {
    id: 'construction',
    status: 'off until switched on',
    init(a) { api = a; },
    lines() {
      if (!api) return [];
      if (state === 'idle') load();
      if (state !== 'ready') return [];
      const o = origin(), version = `${o.e},${o.n},${o.id}`;
      if (built.version !== version) built = { version, batches: buildConstruction(model, o).map(b => ({ ...b, version })) };
      return built.batches;
    },
    ready: () => state === 'ready',
    debug: () => ({ state, features: model?.features.length ?? 0, version: built.version })
  };
  return layer;
}

export default createConstruction();
