// plant-ground.mjs: the measured ground under a whole plant boundary, and the mapped water beside it.
//
// The terrain layer keeps only the LiDAR tiles near the viewer. A plant boundary is far bigger, so this reads the
// same tiles for the boundary's extent, through the same hash checks (the manifest pins tiles.json, tiles.json
// pins every tile), and answers heights in national-grid metres. Where no tile covers a point the answer is NaN,
// never a guess; the page falls back to the world's own measuredAt there. Water comes from the manifest's water
// layer file when it has one (OS Open Rivers), else there is none and the layout says so.

import { makeApi } from './layers.mjs';
import { decodeTile, sampleTile } from './layers/terrain.mjs';

export function createSiteGround({ manifestUrl = './world/manifest.json', fetchImpl } = {}) {
  let manifest = null, api = null, index = null, dir = '', size = 256;
  const tiles = new Map(); // key -> decoded tile
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
      size = j.tile_m || 256; index = j.tiles || [];
    }
    return manifest;
  }
  const site = () => manifest?.site || null;
  // The tiles' outer extent in national-grid metres, or null with no terrain.
  const extent = () => (index && index.length ? { e0: Math.min(...index.map(t => t.e0)), n0: Math.min(...index.map(t => t.n0)),
    e1: Math.max(...index.map(t => t.e0)) + size, n1: Math.max(...index.map(t => t.n0)) + size } : null);

  /** Loads (verified) every tile touching the box; returns how many cover it and how many failed. */
  async function loadFor({ e0, n0, e1, n1 }, onTile = () => {}) {
    await start();
    if (!index) return { tiles: 0, failed: 0 };
    const want = index.filter(t => t.e0 < e1 && t.e0 + size > e0 && t.n0 < n1 && t.n0 + size > n0);
    let failed = 0;
    for (const t of want) {
      if (tiles.has(t.key)) continue;
      try { tiles.set(t.key, decodeTile(await api.fetchVerified(dir + t.file, t.sha256))); } catch { failed++; }
      onTile(tiles.size);
    }
    return { tiles: want.length, failed };
  }
  function heightAt(e, n) {
    for (const t of tiles.values()) {
      const s = (t.samples - 1) * t.spacing;
      if (e >= t.e0 && n >= t.n0 && e <= t.e0 + s && n <= t.n0 + s) return sampleTile(t, e - t.e0, n - t.n0);
    }
    return NaN;
  }
  // A faster lookup for the tight loop: tiles on a map keyed by their south-west corner.
  function sampler() {
    const byCorner = new Map([...tiles.values()].map(t => [t.e0 + ',' + t.n0, t]));
    return (e, n) => {
      const t = byCorner.get(Math.floor(e / size) * size + ',' + Math.floor(n / size) * size);
      return t ? sampleTile(t, e - t.e0, n - t.n0) : heightAt(e, n);
    };
  }
  /** Mapped watercourse lines ([[e, n]...]) from the manifest's water layer, or [] when there is none. */
  async function water() {
    await start();
    const cfg = (manifest.layers || []).find(l => l.id === 'water')?.config;
    if (!cfg?.index || !cfg?.sha256) return [];
    try { return ((await api.fetchJSON(cfg.index, cfg.sha256)).lines || []).map(l => l.points).filter(p => p && p.length > 1); }
    catch { return []; }
  }
  return { start, site, extent, loadFor, heightAt, sampler, water, loaded: () => tiles.size };
}
