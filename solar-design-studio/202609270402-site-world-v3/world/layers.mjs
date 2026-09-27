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
//                                lib.trench (createTrench, composeGround), lib.cableRoute (routeCable), and the shared
//                                world library (web/world/lib): lib.version, lib.tiles, lib.drape, lib.earthworks
// The shared library's files are in the manifest (manifest.lib: { version, files: [{ id, path, sha256 }] }) and are
// hash-checked and imported like layers before any layer starts. A layer written for it declares the version
// (export const LIB_VERSION; the manifest repeats it as the entry's lib) and is refused unless it is the one served.

import SHARED, { LIB_VERSION, LIB_FILES } from './lib/index.mjs';

// lib.overhead, lib.trench and lib.cableRoute are not needed to draw the ground, so they load after it (loadBase,
// review E): until then those three read undefined. The layers that use them start after loadBase has finished.
let BASE = null, baseP = null;
export const loadBase = () => (baseP ||= Promise.all([import('./overhead.mjs'), import('./trench.mjs'), import('./cable-route.mjs')])
  .then(([overhead, t, c]) => (BASE = Object.freeze({ overhead, trench: Object.freeze({ createTrench: t.createTrench, composeGround: t.composeGround }),
    cableRoute: Object.freeze({ routeCable: c.routeCable }) }))));
const withBase = o => Object.freeze(Object.defineProperties(o, Object.fromEntries(['overhead', 'trench', 'cableRoute']
  .map(k => [k, { get: () => BASE?.[k], enumerable: true }]))));
const LIB = withBase({ ...SHARED });

// The shared library as the manifest lists it: every file fetched, hash-checked and imported, or { lib: null, why }.
// get and load are for tests (load(text) imports checked module text).
export async function loadLib(entry, base, { get = (u, o) => fetch(u, o), load = importText } = {}) {
  const no = why => ({ lib: null, why });
  if (!entry) return no('the manifest lists no lib');
  if (entry.version !== LIB_VERSION) return no(`the manifest's lib is version ${entry.version}, this page serves ${LIB_VERSION}`);
  const mods = {};
  // All files fetched at once (one round trip on a slow phone link, review E), then checked and imported in order.
  const got = await Promise.all((entry.files || []).map(async f => {
    const res = await get(new URL(f.path, base).href, { cache: 'no-cache' });
    return { f, res, text: res.ok ? normalise(await res.text()) : null };
  }));
  for (const { f, res, text } of got) {
    if (!res.ok) return no(`lib ${f.id}: HTTP ${res.status}`);
    const hash = await sha256(text);
    if (!hash) return no('this browser cannot check hashes here (needs https)');
    if (hash !== f.sha256) return no(`lib ${f.id} hash ${hash.slice(0, 12)} is not the manifest's ${String(f.sha256).slice(0, 12)}`);
    mods[f.id] = Object.freeze({ ...await load(text) });
  }
  const missing = LIB_FILES.filter(id => !mods[id]);
  if (missing.length) return no(`the manifest's lib has no ${missing.join(', ')}`);
  return { lib: withBase({ version: LIB_VERSION, ...mods }), why: null };
}

// Why a layer that declares lib version `want` cannot run on `lib` (null when it can, or declares none).
export function libRefusal(want, lib, why) {
  if (want === undefined || want === null) return null;
  if (!lib) return `refused: it needs lib version ${want} and the lib was refused (${why})`;
  return want === lib.version ? null : `refused: it declares lib version ${want}, the substrate serves ${lib.version}`;
}

// A fetch world.html started with the page (window.__early, keyed by absolute URL) is used once; otherwise a new one.
function earlyFetch(url) {
  const m = globalThis.__early, p = m?.get?.(url);
  if (p) { m.delete(url); return p; }
  return fetch(url, { cache: 'no-cache' });
}

async function importText(text) {
  const blob = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  try { return await import(blob); } finally { URL.revokeObjectURL(blob); }
}

// hooks.started(item): called as each layer starts (the substrate mounts a layer's own controls, imagery's date slider).
// hooks.site: a staged site chosen on the page ({ name, centre_e, centre_n, tiles, sha256 } from data/sites.json);
// its tile index replaces the manifest's for the terrain layer, and it becomes the site the world centres on.
export async function loadLayers(manifestUrl, hooks = {}) {
  const base = new URL(manifestUrl, location.href);
  // The lib's files are asked for alongside the manifest (their hashes are checked once it arrives): one round trip less.
  // world.html starts the manifest, the lib's texts and the first layers with the page (earlyFetch): each is taken once.
  const early = new Map(LIB_FILES.map(id => { const u = new URL(`./lib/${id}.mjs`, base).href; return [u, earlyFetch(u)]; }));
  const res = await earlyFetch(base.href);
  if (!res.ok) throw Error(`manifest HTTP ${res.status}`);
  const manifest = await res.json();
  // The shared library is fetched and checked alongside the first layers (not before them: the first frame waits
  // for neither more than it must); a layer starts only once the lib is known.
  const libP = loadLib(manifest.lib, base, { get: (u, o) => early.get(u) || fetch(u, o) }).catch(e => ({ lib: null, why: 'lib: ' + e.message }));
  let lib = null, why = null, api = null;
  const ready = libP.then(r => { ({ lib, why } = r); api = makeApi(new URL('./', base).href, { ...hooks, lib: lib || withBase({}) }); });
  // Fetch and hash: the layers that start on all at once, in parallel; import and start them in manifest order.
  // hooks.deferred: ids of layers that start switched off; they are fetched, checked and started only when first
  // switched on (item.load()), so the first frame does not wait for them (review E, win 1).
  const fetchChecked = async entry => {
    if (!entry.sha256) return { status: 'refused: the manifest gives no hash' };
    const res = await earlyFetch(new URL(entry.path, base).href);
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const text = normalise(await res.text());
    const hash = await sha256(text);
    if (!hash) return { status: 'refused: this browser cannot check hashes here (needs https)' };
    if (hash !== entry.sha256) return { status: `refused: file hash ${hash.slice(0, 12)} is not the manifest's ${entry.sha256.slice(0, 12)}` };
    return { text };
  };
  const start = async (item, entry, got) => {
    if (!got.text) { item.status = got.status; return; }
    await ready;
    const refused = libRefusal(entry.lib, lib, why);
    if (refused) { item.status = refused; return; }
    const mod = await importText(got.text);
    const late = libRefusal(mod.LIB_VERSION, lib, why);
    if (late) { item.status = late; return; }
    item.layer = mod.default; item.status = 'loaded, hash matches';
    const pick = entry.id === 'terrain' && hooks.site ? { index: hooks.site.tiles, sha256: hooks.site.sha256 } : null;
    startLayer(item, Object.freeze({ ...api, config: pick ? { ...entry.config, ...pick } : entry.config || null })); // per-layer settings
    try { hooks.started?.(item); } catch (e) { item.status += ' (its controls failed: ' + e.message + ')'; }
  };
  // hooks.first: ids the first frame needs (the ground); the other layers that start on are fetched once those have
  // arrived and started just after, and loadLayers returns without waiting for them (its rest promise says when).
  const deferred = new Set(hooks.deferred || []), entries = manifest.layers || [];
  const first = hooks.first ? new Set(hooks.first) : null, isFirst = e => !first || first.has(e.id);
  const fetchOne = e => fetchChecked(e).then(got => got, err => ({ status: 'failed: ' + err.message }));
  const pending = entries.map(e => (deferred.has(e.id) || !isFirst(e) ? null : fetchOne(e)));
  const later = Promise.all(pending).then(() => {
    const base = loadBase().catch(() => null), got = entries.map((e, i) => pending[i] || (deferred.has(e.id) ? null : fetchOne(e)));
    return base.then(() => got);
  });
  const out = [], rest = [];
  for (const [i, entry] of entries.entries()) {
    const item = { id: entry.id, status: 'loading' };
    out.push(item);
    if (deferred.has(entry.id)) {
      item.status = 'ready: loads when switched on';
      let once = null;
      item.load = () => (once ||= (async () => {
        item.status = 'ready: loading now'; // stays available in the panel while it loads
        await loadBase().catch(() => {});
        try { await start(item, entry, await fetchChecked(entry)); } catch (e) { item.status = 'failed: ' + e.message; }
        if (item.layer && !item.hidden && typeof item.layer.setEnabled === 'function' && !item.layer.enabled) item.layer.setEnabled(true);
        hooks.invalidate?.({ ground: false });
      })());
      continue;
    }
    if (!isFirst(entry)) { rest.push([item, entry, i]); continue; }
    try { await start(item, entry, await pending[i]); } catch (e) { item.status = 'failed: ' + e.message; }
  }
  await ready;
  const restP = rest.length ? (async () => {
    const got = await later;
    for (const [item, entry, i] of rest) {
      try { await start(item, entry, await got[i]); } catch (e) { item.status = 'failed: ' + e.message; }
      hooks.invalidate?.({ ground: false });
    }
  })().catch(() => {}) : loadBase().catch(() => {});
  const s = hooks.site, site = s ? { ...manifest.site, name: s.name, centre_e: s.centre_e, centre_n: s.centre_n } : manifest.site || null;
  return { generation: manifest.generation, site, layers: out, rest: restP, lib: lib ? `version ${lib.version}, hashes match` : `refused: ${why}` };
}

// A layer's loader status with its own words. "hash matches" is about the layer's code; when the layer's own data
// (a tile index, a data file) was refused or failed, the words say that and never "hash matches".
export const REFUSED = /refused|failed|no .*hash|not hash-checked|mismatch/i;
export function statusLine(item) {
  const own = typeof item?.layer?.status === 'string' ? item.layer.status : '';
  const base = String(item?.status ?? '');
  if (own && REFUSED.test(own)) return `${base.replace(/,? hash matches/, '')} (${own})`;
  return own ? `${base} (${own})` : base;
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

// base: absolute URL of a folder. hooks: { invalidate(opts), origin(), lib }; fetchImpl is for tests; lib defaults to the static copy.
export function makeApi(base, { invalidate = () => {}, origin = () => ({ e: 0, n: 0, id: 0 }), fetchImpl, lib = LIB } = {}) {
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
    lib
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
