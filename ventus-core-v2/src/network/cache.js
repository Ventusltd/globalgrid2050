/**
 * URL Cache with TTL (Time To Live)
 * Auto-evicts stale entries to prevent memory leaks
 * Per ARCHITECTURE_V2.md Section 8.1 (Memory Leak Fixes)
 */

export class URLCache {
  constructor() {
    this.cache = new Map(); // url -> { data, expires }
  }

  /**
   * Store data with TTL
   * @param {string} url - Cache key
   * @param {*} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  set(url, data, ttl = 300000) {
    this.cache.set(url, {
      data,
      expires: Date.now() + ttl
    });
  }

  /**
   * Retrieve data if not expired
   * @param {string} url - Cache key
   * @returns {*|null} Cached data or null if missing/expired
   */
  get(url) {
    const entry = this.cache.get(url);
    if (!entry) return null;

    // Check expiry
    if (Date.now() > entry.expires) {
      this.cache.delete(url);
      return null;
    }

    return entry.data;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove expired entries (call periodically)
   * @returns {number} Number of entries evicted
   */
  evictStale() {
    const now = Date.now();
    let evicted = 0;

    for (const [url, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(url);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Get cache statistics
   * @returns {{ size: number, oldest: number, newest: number }}
   */
  getStats() {
    let oldest = Infinity;
    let newest = -Infinity;

    for (const entry of this.cache.values()) {
      if (entry.expires < oldest) oldest = entry.expires;
      if (entry.expires > newest) newest = entry.expires;
    }

    return {
      size: this.cache.size,
      oldest: oldest === Infinity ? null : oldest,
      newest: newest === -Infinity ? null : newest
    };
  }
}
