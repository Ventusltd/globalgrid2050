// Page wiring for the Buffers layer. While it is switched on, the zones are worked out (buffers.mjs) from the site's
// own data files, fetched through the same hash check as the layers that draw them (the manifest's configs for grid,
// water, ways and canopy hedges), and the drawn design is checked against them (clash.mjs). Zones are local metres,
// so they are rebuilt when the origin moves; clashes are rebuilt when a trench or cable is finished.
import { buildZones, checkClashes } from './buffers.mjs';
import { makeApi } from './layers.mjs';

// The world lists buildZones takes, from the files as the layers read them. Missing files give empty lists.
export function worldFrom({ grid, rivers, roads, hedges } = {}) {
  return {
    overhead: (grid?.lines || []).filter(l => Array.isArray(l.points)),
    water: (rivers?.lines || []).filter(l => Array.isArray(l.points)),
    roads: (roads?.lines || []).filter(l => Array.isArray(l.pts)),
    hedges: (hedges?.lines || []).filter(l => Array.isArray(l.pts)),
  };
}

// Drawn trenches and cables (national-grid paths [{ e, n }]) as clash items in local metres.
export function drawnItems(design, origin) {
  const local = path => (path || []).map(p => [p.e - origin.e, p.n - origin.n]);
  return [
    ...(design?.trenches || []).map((t, i) => ({ id: `trench-${i + 1}`, kind: 'trench', points: local(t.path) })),
    ...(design?.cables || []).map((c, i) => ({ id: `cable-${i + 1}`, kind: 'trench', points: local(c.path) })),
  ].filter(it => it.points.length >= 2);
}

// Fetches the site files named in the manifest; each one is checked against its SHA-256 before it is used.
export async function loadWorldFiles(manifestUrl, api = null) {
  const base = new URL(manifestUrl, location.href);
  const manifest = await (await fetch(base, { cache: 'no-cache' })).json();
  const a = api || makeApi(new URL('./', base).href);
  const cfg = id => (manifest.layers || []).find(l => l.id === id)?.config || null;
  const get = c => (c && (c.path || c.index) && c.sha256 ? a.fetchJSON(c.path || c.index, c.sha256).catch(() => null) : null);
  const canopy = cfg('canopy');
  const [grid, rivers, roads, canopyIndex] = await Promise.all([get(cfg('grid')), get(cfg('water')), get(cfg('ways')?.roads), get(canopy)]);
  let hedges = null;
  if (canopyIndex?.hedges?.file && canopyIndex.hedges.sha256) {
    const dir = canopy.index.slice(0, canopy.index.lastIndexOf('/') + 1);
    hedges = await a.fetchJSON(dir + canopyIndex.hedges.file, canopyIndex.hedges.sha256).catch(() => null);
  }
  return { grid, rivers, roads, hedges };
}

// layer: the buffers layer object. origin(): { e, n, id }. design(): the design in memory. load(): the world files.
// Returns { refresh(on) }: call it after the layer is switched and on a steady tick.
export function mountBuffers({ layer, origin, design, load = () => loadWorldFiles('./world/manifest.json') } = {}) {
  if (!layer || typeof layer.setZones !== 'function') return null;
  let files = null, loading = null, zonesKey = '', clashKey = '', zones = [];
  const refresh = on => {
    if (!on) return;
    if (!files) { loading ||= Promise.resolve().then(load).then(f => { files = f; refresh(true); }, e => console.warn('buffers: ' + e.message)); return; }
    const o = origin(), d = design(), zk = `${o.e},${o.n}`;
    if (zk !== zonesKey) { zones = buildZones(worldFrom(files), { origin: o }); layer.setZones(zones); zonesKey = zk; clashKey = ''; }
    const ck = `${zk}@${d.trenches.length}@${d.cables.length}`;
    if (ck !== clashKey) { layer.setClashes(checkClashes(drawnItems(d, o), zones)); clashKey = ck; }
  };
  return { refresh };
}
