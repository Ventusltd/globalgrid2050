// plant-ground.mjs: the measured ground under a whole plant boundary, and the mapped water beside it.
//
// The terrain layer keeps only the LiDAR tiles near the viewer. A plant boundary is far bigger, so this reads the
// same tiles for the boundary's extent, through the same hash checks (the manifest pins tiles.json, tiles.json
// pins every tile), and answers heights in national-grid metres. Where no tile covers a point the answer is NaN,
// never a guess; the page falls back to the world's own measuredAt there. Water comes from the manifest's water
// layer file when it has one (OS Open Rivers), else there is none and the layout says so.
// A plant bigger than the 1 m tiles (500 MW needs about 3.3 km square) may also read the far ring (8 m, v06) where the
// 1 m tiles stop: loadFor(box, onTile, { ring: true }). The 1 m tile always wins where both exist, and ringShare()
// says how much of what was read came from the ring, so the layout can say so (hollows under 8 m are not seen there).

import { makeApi } from './layers.mjs';
import { decodeTile, sampleTile } from './layers/terrain.mjs';

export function createSiteGround({ manifestUrl = './world/manifest.json', fetchImpl } = {}) {
  let manifest = null, api = null, index = null, ringIndex = [], dir = '', size = 256, surveyDate = null, reads = 0, ringReads = 0;
  const tiles = new Map(), rings = new Map(); // key -> decoded tile (1 m), key -> decoded far-ring tile
  async function start() {
    if (manifest) return manifest;
    const base = new URL(manifestUrl, location.href);
    const res = await (fetchImpl || fetch)(base.href, { cache: 'no-cache' });
    if (!res.ok) throw Error(`manifest HTTP ${res.status}`);
    manifest = await res.json();
    api = makeApi(new URL('./', base).href, { fetchImpl });
    const cfg = (manifest.layers || []).find(l => l.id === 'terrain')?.config;
    if (cfg?.index && cfg?.sha256) {
      const j = await api.fetchJSON(cfg.index, cfg.sha256);
      dir = cfg.index.includes('/') ? cfg.index.slice(0, cfg.index.lastIndexOf('/') + 1) : '';
      size = j.tile_m || 256; surveyDate = j.survey_date || null; index = (j.tiles || []).filter(t => !t.ring); // the 1 m tiles: a far ring (v06) is for the view only
      ringIndex = (j.tiles || []).filter(t => t.ring);                      // unless a large plant asks for it (loadFor ring)
    }
    return manifest;
  }
  const site = () => manifest?.site || null;
  // The tiles' outer extent in national-grid metres, or null with no terrain.
  // ring: true takes in the far ring as well.
  const extent = ({ ring = false } = {}) => {
    const all = [...(index || []).map(t => [t.e0, t.n0, size]), ...(ring ? ringIndex.map(t => [t.e0, t.n0, t.tile_m || size]) : [])];
    return all.length ? { e0: Math.min(...all.map(t => t[0])), n0: Math.min(...all.map(t => t[1])),
      e1: Math.max(...all.map(t => t[0] + t[2])), n1: Math.max(...all.map(t => t[1] + t[2])) } : null;
  };

  /** Loads (verified) every tile touching the box; returns how many cover it and how many failed. */
  async function loadFor({ e0, n0, e1, n1 }, onTile = () => {}, { ring = false } = {}) {
    await start();
    if (!index) return { tiles: 0, failed: 0 };
    const hit = s => t => t.e0 < e1 && t.e0 + (s || t.tile_m) > e0 && t.n0 < n1 && t.n0 + (s || t.tile_m) > n0;
    const want = [...index.filter(hit(size)).map(t => [t, tiles]), ...(ring ? ringIndex.filter(hit(0)).map(t => [t, rings]) : [])];
    let failed = 0;
    for (const [t, into] of want) {
      if (into.has(t.key)) continue;
      try { into.set(t.key, decodeTile(await api.fetchVerified(dir + t.file, t.sha256))); } catch { failed++; }
      onTile(tiles.size + rings.size);
    }
    return { tiles: want.length, failed };
  }
  const ringAt = (e, n) => {
    for (const t of rings.values()) { const h = sampleTile(t, e - t.e0, n - t.n0); if (Number.isFinite(h)) return h; }
    return NaN;
  };
  function heightAt(e, n) {
    for (const t of tiles.values()) {
      const s = (t.samples - 1) * t.spacing;
      if (e >= t.e0 && n >= t.n0 && e <= t.e0 + s && n <= t.n0 + s) return sampleTile(t, e - t.e0, n - t.n0);
    }
    return ringAt(e, n);
  }
  // A faster lookup for the tight loop: tiles on a map keyed by their south-west corner.
  function sampler() {
    const byCorner = new Map([...tiles.values()].map(t => [t.e0 + ',' + t.n0, t]));
    reads = ringReads = 0;
    return (e, n) => {
      const t = byCorner.get(Math.floor(e / size) * size + ',' + Math.floor(n / size) * size);
      reads++;
      if (t) { const h = sampleTile(t, e - t.e0, n - t.n0); if (Number.isFinite(h)) return h; }
      const h = rings.size ? ringAt(e, n) : NaN;                      // no scan of every 1 m tile on a miss (review 3)
      if (Number.isFinite(h)) ringReads++;
      return Number.isFinite(h) || rings.size ? h : heightAt(e, n); // without the ring, as before: the edge of the last tile
    };
  }
  // The share of heights read by the last sampler that came from the far ring (8 m), 0 to 1.
  const ringShare = () => (reads ? ringReads / reads : 0);
  /** Mapped watercourse lines ([[e, n]...]) from the manifest's water layer, or [] when there is none. */
  async function water() {
    await start();
    const cfg = (manifest.layers || []).find(l => l.id === 'water')?.config;
    if (!cfg?.index || !cfg?.sha256) return [];
    try { return ((await api.fetchJSON(cfg.index, cfg.sha256)).lines || []).map(l => l.points).filter(p => p && p.length > 1); }
    catch { return []; }
  }
  // Dates for the survey check (site-checks.mjs): the terrain index's survey date, else the site's; planning and commissioning.
  const survey = () => ({ groundDate: surveyDate || manifest?.site?.lidar_date || null, planningDate: manifest?.site?.planning_date || null,
    commissionedDate: manifest?.site?.commissioned || null });
  return { start, site, extent, loadFor, heightAt, sampler, water, survey, ringShare, loaded: () => tiles.size + rings.size };
}
