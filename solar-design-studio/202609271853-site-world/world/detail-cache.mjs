// Arrival cache and frame pump for procedural detail.
// LRU by bytes: 24 MiB on a phone, 96 MiB on a desktop. Evicted detail is regenerated, never downloaded;
// onEvict(key, value) is where the renderer releases its GPU buffers (gl.deleteBuffer).
// The pump generates queued keys inside a per-frame budget (default 4 ms), called from the page's own
// requestAnimationFrame / requestIdleCallback while the camera moves, never from a timer, so a still
// camera costs 0 fps. Pure: the clock is injected.

export const MiB = 1024 * 1024;
export const CACHE_BUDGET = Object.freeze({ phone: 24 * MiB, desktop: 96 * MiB });
export const FRAME_BUDGET_MS = 4;

export const budgetFor = ({ phone = false } = {}) => (phone ? CACHE_BUDGET.phone : CACHE_BUDGET.desktop);

export class DetailCache {
  constructor(budgetBytes, { onEvict = null } = {}) {
    if (!(budgetBytes > 0)) throw new RangeError('cache budget must be positive bytes');
    this.budget = budgetBytes; this.bytes = 0; this.map = new Map(); this.onEvict = onEvict;
    this.stats = { hits: 0, misses: 0, evictions: 0, generated: 0, oversize: 0 };
  }
  get size() { return this.map.size; }
  has(key) { return this.map.has(key); }
  // A hit refreshes recency (Map keeps insertion order; the first key is the least recently used).
  get(key) {
    const e = this.map.get(key);
    if (!e) { this.stats.misses++; return undefined; }
    this.map.delete(key); this.map.set(key, e); this.stats.hits++;
    return e.value;
  }
  set(key, value, bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) throw new RangeError(`bytes for ${key} must be >= 0`);
    if (this.map.has(key)) this.delete(key);
    if (bytes > this.budget) { this.stats.oversize++; return false; }   // not cached; the caller still draws it
    this.map.set(key, { value, bytes }); this.bytes += bytes;
    this.evict();
    return true;
  }
  delete(key) {
    const e = this.map.get(key);
    if (!e) return false;
    this.map.delete(key); this.bytes -= e.bytes;
    if (this.onEvict) this.onEvict(key, e.value);
    return true;
  }
  // Drop least-recently-used entries until under budget (a smaller budget sheds memory on a warning).
  evict(budget = this.budget) {
    let n = 0;
    for (const key of this.map.keys()) {
      if (this.bytes <= budget) break;
      this.delete(key); n++;
    }
    this.stats.evictions += n;
    return n;
  }
  // Get or generate: generate(key) returns an object with .bytes (a generateTable result fits).
  obtain(key, generate) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const g = generate(key); this.stats.generated++;
    this.set(key, g, g.bytes);
    return g;
  }
}

// Generate queued keys inside the frame budget. The running mean of one item's cost stops the loop
// BEFORE it would overrun; the first item of a frame always runs so the queue cannot stall.
// Returns { done, ms, left, state }; pass the same state back next frame.
export function pump(queue, cache, generate, now, { budgetMs = FRAME_BUDGET_MS, state = { mean: 0, n: 0 } } = {}) {
  const t0 = now(); let done = 0;
  while (queue.length) {
    if (done > 0 && now() - t0 + state.mean > budgetMs) break;
    const key = queue.shift();
    if (cache.has(key)) continue;
    const a = now();
    cache.obtain(key, generate);
    const dt = now() - a;
    state.n++; state.mean += (dt - state.mean) / Math.min(state.n, 32);
    done++;
  }
  return { done, ms: now() - t0, left: queue.length, state };
}

// Arrival order: keys of tables inside radius (metres) of the camera, nearest first, not yet cached.
// tables: [{ key, x, y }] in plant metres. Ties break on key so the order is deterministic.
export function arrivals(tables, cam, radius, cache) {
  const r2 = radius * radius, near = [];
  for (const t of tables) {
    const dx = t.x - cam.x, dy = t.y - cam.y, d2 = dx * dx + dy * dy;
    if (d2 <= r2 && !(cache && cache.has(t.key))) near.push([d2, t.key]);
  }
  near.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return near.map(n => n[1]);
}
