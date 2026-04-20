import { StateStore } from '../state/store.js';
import { CleanupRegistry } from '../utils/cleanup.js';
import { ListenerRegistry } from '../utils/listeners.js';
import { URLCache } from '../network/cache.js';
import { AbortManager } from '../network/abort.js';

/**
 * VentusMap - Main class for Phase 1
 * Per ARCHITECTURE_V2.md Section 2.1
 * 
 * Phase 1 Scope:
 * - Constructor and destroy() lifecycle
 * - Event emitter (on/off/emit)
 * - Cleanup registries (rAF, listeners, cache, aborts)
 * 
 * NOT in Phase 1:
 * - MapLibre integration (Phase 2)
 * - Tool system (Phase 2)
 * - Layer loading (Phase 2)
 */

export class VentusMap {
  constructor(container, options = {}) {
    // Validate container
    if (!container) {
      throw new Error('VentusMap: container element required');
    }

    this.container = container;
    this.options = options;

    // Initialize state store
    this.state = new StateStore();

    // Initialize cleanup registries
    this.cleanup = new CleanupRegistry();
    this.listeners = new ListenerRegistry();
    this.urlCache = new URLCache();
    this.abortManager = new AbortManager();

    // Event emitter
    this.eventHandlers = new Map(); // event -> Set<handler>

    // Destroyed flag
    this.destroyed = false;

    // Debug mode
    this.debug = options.debug || false;

    if (this.debug) {
      console.log('[VentusMap] Initialized', {
        container: container.id || container.className,
        options
      });
    }

    // Phase 1: Setup basic lifecycle
    this._setupLifecycle();
  }

  /**
   * Setup lifecycle (visibilitychange listener for 8-hour dashboard fix)
   * @private
   */
  _setupLifecycle() {
    // 8-Hour Dashboard Fix: Pause updates when tab hidden
    // Prevents Gemini's crash scenario
    this.listeners.register(document, 'visibilitychange', () => {
      if (document.hidden) {
        if (this.debug) console.log('[VentusMap] Tab hidden - pausing updates');
        // Future: pause animation loops, network requests, etc.
      } else {
        if (this.debug) console.log('[VentusMap] Tab visible - resuming');
        // Future: resume updates
      }
    });

    // Setup cache auto-eviction (every 60 seconds)
    const evictionInterval = setInterval(() => {
      if (!this.destroyed) {
        const evicted = this.urlCache.evictStale();
        if (this.debug && evicted > 0) {
          console.log(`[VentusMap] Evicted ${evicted} stale cache entries`);
        }
      }
    }, 60000);

    this.cleanup.registerInterval(evictionInterval);
  }

  /**
   * Event emitter: Register event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Event emitter: Remove event handler
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Event emitter: Emit event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[VentusMap] Error in ${event} handler:`, err);
        }
      });
    }
  }

  /**
   * Get current state (read-only)
   * @returns {Object}
   */
  getState() {
    return this.state.getState();
  }

  /**
   * Destroy map instance - clean teardown
   * Per ARCHITECTURE_V2.md Section 2.1
   * 
   * Success criteria:
   * - All rAFs cancelled
   * - All listeners removed
   * - All network requests aborted
   * - All caches cleared
   * - No memory leaks
   */
  destroy() {
    if (this.destroyed) {
      console.warn('[VentusMap] Already destroyed');
      return;
    }

    if (this.debug) {
      console.log('[VentusMap] Destroying...', {
        rafCount: this.cleanup.getStats().rafCount,
        listenerCount: this.listeners.getCount(),
        cacheSize: this.urlCache.cache.size,
        activeRequests: this.abortManager.getActiveCount()
      });
    }

    // 1. Abort all network requests
    this.abortManager.abortAll();

    // 2. Cancel all rAFs, timeouts, intervals
    this.cleanup.cancelAll();

    // 3. Remove all event listeners
    this.listeners.removeAll();

    // 4. Clear caches
    this.urlCache.clear();

    // 5. Clear event handlers
    this.eventHandlers.clear();

    // 6. Mark as destroyed
    this.destroyed = true;

    // 7. Emit destroy event
    this.emit('destroy', { timestamp: Date.now() });

    if (this.debug) {
      console.log('[VentusMap] Destroyed successfully');
    }
  }

  /**
   * Check if map is destroyed
   * @returns {boolean}
   */
  isDestroyed() {
    return this.destroyed;
  }
}
