/**
 * AbortController Ownership Manager
 * Per ARCHITECTURE_V2.md Section 6 (AbortController Strategy)
 * 
 * Ownership Rules:
 * - Layer Manager owns layer fetch aborts
 * - Tool Registry owns tool-initiated request aborts
 * - Map instance owns all aborts via destroy()
 */

export class AbortManager {
  constructor() {
    this.controllers = new Map(); // id -> AbortController
  }

  /**
   * Create or replace AbortController for given ID
   * If controller already exists, aborts it first
   * 
   * @param {string} id - Unique identifier (e.g., 'layer-solar', 'tool-search')
   * @returns {AbortController}
   */
  createController(id) {
    // Cancel existing controller if present
    if (this.controllers.has(id)) {
      this.controllers.get(id).abort();
    }

    const controller = new AbortController();
    this.controllers.set(id, controller);
    return controller;
  }

  /**
   * Get abort signal for given ID
   * @param {string} id
   * @returns {AbortSignal|null}
   */
  getSignal(id) {
    return this.controllers.get(id)?.signal || null;
  }

  /**
   * Abort specific controller and remove from registry
   * @param {string} id
   */
  abort(id) {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  /**
   * Abort all controllers and clear registry
   * Called on map destroy()
   */
  abortAll() {
    this.controllers.forEach(ctrl => ctrl.abort());
    this.controllers.clear();
  }

  /**
   * Check if controller exists and is not aborted
   * @param {string} id
   * @returns {boolean}
   */
  isActive(id) {
    const signal = this.getSignal(id);
    return signal !== null && !signal.aborted;
  }

  /**
   * Get count of active controllers
   * @returns {number}
   */
  getActiveCount() {
    let count = 0;
    for (const controller of this.controllers.values()) {
      if (!controller.signal.aborted) count++;
    }
    return count;
  }
}
