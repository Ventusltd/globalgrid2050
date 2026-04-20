/**
 * Event Listener Teardown Tracking
 * Tracks all addEventListener calls and removes them on destroy
 * Per ARCHITECTURE_V2.md Section 8.1 (Memory Leak Fixes)
 */

export class ListenerRegistry {
  constructor() {
    this.listeners = []; // Array of { target, event, handler, options }
  }

  /**
   * Register event listener and attach it
   * @param {EventTarget} target - DOM element or other event target
   * @param {string} event - Event name
   * @param {Function} handler - Event handler function
   * @param {Object|boolean} options - addEventListener options
   */
  register(target, event, handler, options = false) {
    target.addEventListener(event, handler, options);
    this.listeners.push({ target, event, handler, options });
  }

  /**
   * Remove specific listener
   * @param {EventTarget} target
   * @param {string} event
   * @param {Function} handler
   */
  remove(target, event, handler) {
    target.removeEventListener(event, handler);
    this.listeners = this.listeners.filter(
      l => !(l.target === target && l.event === event && l.handler === handler)
    );
  }

  /**
   * Remove all tracked listeners
   */
  removeAll() {
    this.listeners.forEach(({ target, event, handler, options }) => {
      target.removeEventListener(event, handler, options);
    });
    this.listeners = [];
  }

  /**
   * Get count of tracked listeners
   * @returns {number}
   */
  getCount() {
    return this.listeners.length;
  }

  /**
   * Get listeners grouped by event type
   * @returns {Map<string, number>}
   */
  getStats() {
    const stats = new Map();
    this.listeners.forEach(({ event }) => {
      stats.set(event, (stats.get(event) || 0) + 1);
    });
    return stats;
  }
}
