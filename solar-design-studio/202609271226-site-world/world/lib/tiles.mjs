// lib/tiles.mjs: the tile loader every tiled layer shares (terrain, slope, flow, contours, shade, visibility,
// canopy). A layer cannot import, so it reaches this through api.lib.tiles; the substrate hash-checks this file
// against the manifest before any layer sees it. No imports, no DOM.
//
// The loader reads a tile index (fetched with the layer's configured hash), asks for the tiles within `radius`
// metres of the viewer, nearest first, `maxInFlight` at a time, never twice after a failure, and forgets the
// least recently used above `maxTiles`. Every tile is placed in local metres from the live site origin; when the
// origin moves, index entries and loaded tiles are re-placed and each loaded tile's `cache` is cleared.

// Distance from a point to an axis-aligned rectangle (0 inside).
export const rectDist = (x, y, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

/**
 * createTileLoader(api, o) -> loader
 * api: the layer's api (config.index / config.sha256 win over the defaults, origin(), fetchJSON, fetchVerified,
 *      invalidate).
 * o:   file        index name in messages ('slope-tiles.json')
 *      path, sha() default index path and hash (the build tool may set the hash later)
 *      tileNoun    'slope tile': "slope tile 3_4 failed: ..."
 *      decode(data) -> tile with e0, n0 (national-grid metres); data is bytes, or parsed JSON when o.json
 *      size(tile)  tile side in metres (default (samples - 1) * spacing)
 *      radius, maxInFlight, maxTiles
 *      active()    loads only while it is true (default: always)
 *      keep(entry) index entries worth fetching (default: all)
 *      tieCentre   break distance ties by distance to the tile centre
 *      ground      new tiles are new ground: invalidate() says so; else invalidate({ ground: false })
 *      pumpOnReady ask for tiles as soon as the index arrives (default true)
 *      say(text)   status sink
 *      onIndex(j)  before the index is built; onReady(j, dir) once it is
 *      onIndexError(e, whileLoading)  default: say("<file> failed: <message>")
 *      afterReady(j, dir)  after the first ask for tiles (a returned promise is chained)
 *      onMove()    after the origin moved and every tile was re-placed; keepCaches leaves each tile's cache alone
 */
export function createTileLoader(api, o) {
  const active = o.active || (() => true), size = o.size || (t => (t.samples - 1) * t.spacing);
  const loaded = new Map();   // key -> { tile, x0, y0, size, used, cache }
  const inFlight = new Set(), failed = new Set(), stats = { requested: [], evicted: [] };
  let index = null, state = 'idle', clock = 0, lastPos = null; // state: idle | loading | ready | failed
  const o0 = typeof api.origin === 'function' ? api.origin() : null;
  let origin = o0 ? { e: o0.e, n: o0.n } : { e: 0, n: 0 };
  const invalidate = () => (o.ground ? api.invalidate() : api.invalidate({ ground: false }));
  const place = t => { t.x0 = t.e0 - origin.e; t.y0 = t.n0 - origin.n; return t; };

  // Re-places everything when the site origin has moved; true if it had.
  function follow() {
    const g = typeof api.origin === 'function' ? api.origin() : null;
    if (!g || (g.e === origin.e && g.n === origin.n)) return false;
    origin = { e: g.e, n: g.n };
    for (const t of index || []) place(t);
    for (const t of loaded.values()) { t.x0 = t.tile.e0 - origin.e; t.y0 = t.tile.n0 - origin.n; if (!o.keepCaches) t.cache = null; }
    o.onMove?.();
    return true;
  }

  function load() {
    if (state !== 'idle' || !active()) return;
    follow();
    const sha = api.config?.sha256 || o.sha(), path = api.config?.index || o.path;
    if (!sha || sha.startsWith('__')) { state = 'failed'; o.say(`no ${o.file} hash configured`); return; }
    state = 'loading';
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
    Promise.resolve().then(() => api.fetchJSON(path, sha)).then(j => {
      if (!j || !Array.isArray(j.tiles)) throw Error(`${o.file} has no tiles list`);
      o.onIndex?.(j);
      index = j.tiles.map(t => place({ ...t, path: dir + t.file, size: t.tile_m || j.tile_m || 256 })); // a far-ring tile (8 or 16 m nodes) carries its own size
      state = 'ready';
      o.onReady?.(j, dir);
      if (o.pumpOnReady !== false) pump();
      invalidate();
      return o.afterReady?.(j, dir);
    }).catch(e => {
      const whileLoading = state === 'loading';
      if (whileLoading) state = 'failed';
      if (o.onIndexError) o.onIndexError(e, whileLoading); else o.say(`${o.file} failed: ${e.message}`);
    });
  }

  // Index entries within radius of (x, y) worth fetching, nearest first.
  function wanted(x, y) {
    if (!index) return [];
    return index
      .filter(t => !o.keep || o.keep(t))
      .map(t => ({ t, d: rectDist(x, y, t.x0, t.y0, t.x0 + t.size, t.y0 + t.size),
        c: o.tieCentre ? Math.hypot(x - t.x0 - t.size / 2, y - t.y0 - t.size / 2) : 0 }))
      .filter(v => v.d <= o.radius)
      .sort((a, b) => a.d - b.d || a.c - b.c)
      .map(v => v.t);
  }

  function request(entry) {
    inFlight.add(entry.key);
    stats.requested.push(entry.key);
    Promise.resolve().then(() => (o.json ? api.fetchJSON(entry.path, entry.sha256) : api.fetchVerified(entry.path, entry.sha256))).then(data => {
      const tile = o.decode(data);
      loaded.set(entry.key, { tile, x0: tile.e0 - origin.e, y0: tile.n0 - origin.n, size: size(tile), used: ++clock, cache: null });
      evict();
      invalidate();
    }).catch(e => { failed.add(entry.key); o.say(`${o.tileNoun} ${entry.key} failed: ${e.message}`); })
      .finally(() => { inFlight.delete(entry.key); pump(); });
  }

  function pump() {
    if (!lastPos || state !== 'ready' || !active()) return;
    follow();
    for (const t of wanted(lastPos[0], lastPos[1])) {
      if (inFlight.size >= o.maxInFlight) break;
      if (loaded.has(t.key)) { loaded.get(t.key).used = ++clock; continue; }
      if (inFlight.has(t.key) || failed.has(t.key)) continue;
      request(t);
    }
  }

  function evict() {
    while (loaded.size > o.maxTiles) {
      let oldest = null;
      for (const [k, v] of loaded) if (!oldest || v.used < loaded.get(oldest).used) oldest = k;
      loaded.delete(oldest);
      stats.evicted.push(oldest);
    }
  }

  return {
    loaded, stats, load, pump, follow, wanted,
    get state() { return state; },
    get index() { return index; },
    get origin() { return origin; },
    // One frame: follow the origin, remember the viewer, load the index if it is due, ask for tiles.
    frame(pos) { follow(); lastPos = pos; if (state === 'idle') load(); pump(); },
    // Loaded tiles within radius of pos, as [key, tile] pairs.
    near: pos => [...loaded].filter(([, t]) => rectDist(pos[0], pos[1], t.x0, t.y0, t.x0 + t.size, t.y0 + t.size) <= o.radius),
    touch: t => { t.used = ++clock; },
    debug: () => ({ loaded: [...loaded.keys()], inFlight: [...inFlight], failed: [...failed], indexState: state })
  };
}
