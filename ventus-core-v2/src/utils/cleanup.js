/**
 * requestAnimationFrame Cleanup Registry
 * Tracks all rAF IDs and cancels them on destroy
 * Per ARCHITECTURE_V2.md Section 8.1 (Memory Leak Fixes)
 */

export class CleanupRegistry {
  constructor() {
    this.rafIds = new Set();
    this.timeoutIds = new Set();
    this.intervalIds = new Set();
  }

  /**
   * Register requestAnimationFrame ID
   * @param {number} id - rAF ID from requestAnimationFrame()
   * @returns {number} The same ID (for chaining)
   */
  registerRAF(id) {
    this.rafIds.add(id);
    return id;
  }

  /**
   * Register setTimeout ID
   * @param {number} id - Timeout ID from setTimeout()
   * @returns {number} The same ID (for chaining)
   */
  registerTimeout(id) {
    this.timeoutIds.add(id);
    return id;
  }

  /**
   * Register setInterval ID
   * @param {number} id - Interval ID from setInterval()
   * @returns {number} The same ID (for chaining)
   */
  registerInterval(id) {
    this.intervalIds.add(id);
    return id;
  }

  /**
   * Cancel all tracked requestAnimationFrame calls
   */
  cancelAllRAFs() {
    this.rafIds.forEach(id => cancelAnimationFrame(id));
    this.rafIds.clear();
  }

  /**
   * Cancel all tracked setTimeout calls
   */
  cancelAllTimeouts() {
    this.timeoutIds.forEach(id => clearTimeout(id));
    this.timeoutIds.clear();
  }

  /**
   * Cancel all tracked setInterval calls
   */
  cancelAllIntervals() {
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds.clear();
  }

  /**
   * Cancel everything
   */
  cancelAll() {
    this.cancelAllRAFs();
    this.cancelAllTimeouts();
    this.cancelAllIntervals();
  }

  /**
   * Get statistics
   * @returns {{ rafCount: number, timeoutCount: number, intervalCount: number }}
   */
  getStats() {
    return {
      rafCount: this.rafIds.size,
      timeoutCount: this.timeoutIds.size,
      intervalCount: this.intervalIds.size
    };
  }
}
