// Layer loader. The manifest lists layers in order; each layer file is fetched, its SHA-256 compared
// with the manifest, and only then imported. A layer whose hash differs is refused and named, never run.
// A layer is a module whose default export may offer:
//   init(api)        -> called once after the layer is verified and imported (may return a promise)
//   lines(ctx)       -> [{ key, version, positions: Float32Array, color: [r,g,b,a], origin?: [x,y,z] }]
//   heightAt(x, y)   -> ground height in metres (the first layer offering a finite height is the ground)
//   solids(ctx)      -> [{ min: [x,y,z], max: [x,y,z] }] boxes nobody can walk or fly through
// Layers are self-contained: no imports (they run from a blob URL). Positions are in local metres
// from the site origin, never national-grid coordinates: the GPU pair (tools/gpu/world_pair.py) measured
// 32-bit drawing error passing 0.1 px about 200 m from the origin and 0.5 px about 1 km out.
// A batch may carry an origin (local metres) with its positions relative to it, so it stays sharp far out.
//
// The api handed to init(api):
//   base                         absolute URL of the manifest's folder
//   fetchVerified(path, sha256)  -> Promise<ArrayBuffer>; the raw bytes are hashed as sent, nothing normalised
//   fetchJSON(path, sha256)      -> Promise<any>; the same check, then the text is decoded and parsed
//   invalidate({ ground })       asks for a redraw; ground (default true) says new ground has arrived
//   origin()                     -> { e, n, id }: the site origin in national-grid metres and its change count
//   lib                          pure helpers a self-contained layer may call: lib.overhead (buildOverhead, catenarySpan...),
//                                lib.trench (createTrench, composeGround), lib.cableRoute (routeCable)

import * as overhead from './overhead.mjs';
import { createTrench, composeGround } from './trench.mjs';
import { routeCable } from './cable-route.mjs';

const LIB = Object.freeze({ overhead, trench: Object.freeze({ createTrench, composeGround }), cableRoute: Object.freeze({ routeCable }) });

// hooks.site: a staged site chosen on the page ({ name, centre_e, centre_n, tiles, sha256 } from data/sites.json);
// its tile index replaces the manifest's for the terrain layer, and it becomes the site the world centres on.
export async function loadLayers(manifestUrl, hooks = {}) {
  const base = new URL(manifestUrl, location.href);
  const res = await fetch(base, { cache: 'no-cache' });
  if (!res.ok) throw Error(`manifest HTTP ${res.status}`);
  const manifest = await res.json();
  const api = makeApi(new URL('./', base).href, hooks);
  const out = [];
  for (const entry of manifest.layers || []) {
    const url = new URL(entry.path, base);
    try {
      if (!entry.sha256) { out.push({ id: entry.id, status: 'refused: the manifest gives no hash' }); continue; }
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw Error(`HTTP ${res.status}`);
      const text = normalise(await res.text());
      const hash = await sha256(text);
      if (!hash) { out.push({ id: entry.id, status: 'refused: this browser cannot check hashes here (needs https)' }); continue; }
      if (hash !== entry.sha256) {
        out.push({ id: entry.id, status: `refused: file hash ${hash.slice(0, 12)} is not the manifest's ${entry.sha256.slice(0, 12)}` });
        continue;
      }
      const blob = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
      const mod = await import(blob);
      URL.revokeObjectURL(blob);
      const item = { id: entry.id, status: 'loaded, hash matches', layer: mod.default };
      out.push(item);
      const pick = entry.id === 'terrain' && hooks.site ? { index: hooks.site.tiles, sha256: hooks.site.sha256 } : null;
      startLayer(item, Object.freeze({ ...api, config: pick ? { ...entry.config, ...pick } : entry.config || null })); // per-layer settings
    } catch (e) {
      out.push({ id: entry.id, status: 'failed: ' + e.message });
    }
  }
  const s = hooks.site, site = s ? { ...manifest.site, name: s.name, centre_e: s.centre_e, centre_n: s.centre_n } : manifest.site || null;
  return { generation: manifest.generation, site, layers: out };
}

// Runs a layer's init. A layer whose init throws, or whose promise rejects, is switched off and named.
export function startLayer(item, api) {
  const off = e => {
    item.layer = null; item.status = 'failed to start and switched off: ' + (e?.message || e);
    api.invalidate({ ground: false });
  };
  try {
    const r = item.layer?.init?.(api);
    if (r && typeof r.then === 'function') r.then(null, off);
  } catch (e) { off(e); }
}

// base: absolute URL of a folder. hooks: { invalidate(opts), origin() }; fetchImpl is for tests.
export function makeApi(base, { invalidate = () => {}, origin = () => ({ e: 0, n: 0, id: 0 }), fetchImpl } = {}) {
  const get = fetchImpl || ((u, o) => fetch(u, o));
  async function fetchVerified(path, sha) {
    if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/i.test(sha)) throw Error(`${path}: no valid SHA-256 given`);
    const res = await get(new URL(path, base).href, { cache: 'no-cache' });
    if (!res.ok) throw Error(`${path}: HTTP ${res.status}`);
    const bytes = await res.arrayBuffer();
    const hash = await sha256Bytes(bytes);
    if (!hash) throw Error(`${path}: this browser cannot check hashes here (needs https)`);
    if (hash !== sha.toLowerCase()) throw Error(`${path}: hash ${hash.slice(0, 12)} is not the expected ${sha.slice(0, 12)}`);
    return bytes;
  }
  async function fetchJSON(path, sha) {
    return JSON.parse(new TextDecoder().decode(await fetchVerified(path, sha)));
  }
  return Object.freeze({
    base,
    fetchVerified,
    fetchJSON,
    invalidate: (opts = {}) => invalidate({ ground: opts.ground !== false }),
    origin: () => { const o = origin(); return { e: o.e, n: o.n, id: o.id }; },
    lib: LIB
  });
}

// Line endings and a byte-order mark are normalised so a Windows checkout and the published file hash the same.
// This applies to layer code only; data files are hashed exactly as sent (see fetchVerified).
export const normalise = text => text.replace(/^﻿/, '').replace(/\r\n/g, '\n');

export async function sha256(text) {
  return sha256Bytes(new TextEncoder().encode(text));
}

export async function sha256Bytes(bytes) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
