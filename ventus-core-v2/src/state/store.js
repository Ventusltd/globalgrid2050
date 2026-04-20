import { createInitialState } from './types.js';

/**
 * State Store with Actions and Subscriptions
 * Per ARCHITECTURE_V2.md Section 4
 * 
 * Single source of truth for all mutable state.
 * Replaces scattered module-scoped `let` variables from v1.
 */

export class StateStore {
  constructor(initialState = null) {
    this.state = initialState || createInitialState();
    this.subscribers = new Map(); // path -> Set<callback>
  }

  /**
   * Dispatch action to mutate state
   * @param {Object} action - { type, payload }
   */
  dispatch(action) {
    const prevState = this.cloneState();

    // Reducer logic
    switch (action.type) {
      // Map
      case 'SET_MAP_CENTER':
        this.state.map.center = action.payload;
        break;
      case 'SET_MAP_ZOOM':
        this.state.map.zoom = action.payload;
        break;
      case 'SET_BASEMAP':
        this.state.map.basemap = action.payload;
        break;

      // Layers
      case 'TOGGLE_LAYER':
        if (action.payload.visible) {
          this.state.layers.visible.add(action.payload.layerId);
        } else {
          this.state.layers.visible.delete(action.payload.layerId);
        }
        break;
      case 'SET_LAYER_LOADED':
        this.state.layers.loaded.set(action.payload.layerId, action.payload.loaded);
        break;
      case 'UPDATE_LAYER_STATS':
        this.state.layers.stats.set(action.payload.layerId, action.payload.stats);
        break;

      // Tools
      case 'SET_ACTIVE_TOOL':
        this.state.tools.active = action.payload;
        break;
      case 'UPDATE_TOOL_TRANSIENT':
        this.state.tools.transient[action.payload.toolId] = action.payload.data;
        break;
      case 'CLEAR_TOOL_TRANSIENT':
        delete this.state.tools.transient[action.payload];
        break;

      // UI
      case 'SHOW_POPUP':
        this.state.ui.popup = {
          visible: true,
          coords: action.payload.coords,
          content: action.payload.content
        };
        break;
      case 'HIDE_POPUP':
        this.state.ui.popup.visible = false;
        break;
      case 'SET_SEARCH_QUERY':
        this.state.ui.search.query = action.payload;
        break;
      case 'SET_SEARCH_RESULTS':
        this.state.ui.search.results = action.payload;
        break;
      case 'TOGGLE_FULLSCREEN':
        this.state.ui.fullscreen = action.payload;
        break;
      case 'TOGGLE_CURTAIN':
        this.state.ui.curtainOpen = action.payload;
        break;

      // Network
      case 'ADD_TO_QUEUE':
        this.state.network.queue.push(action.payload);
        break;
      case 'REMOVE_FROM_QUEUE':
        this.state.network.queue = this.state.network.queue.filter(r => r !== action.payload);
        break;
      case 'SET_IN_FLIGHT':
        if (action.payload.inFlight) {
          this.state.network.inFlight.add(action.payload.url);
        } else {
          this.state.network.inFlight.delete(action.payload.url);
        }
        break;
    }

    // Notify subscribers
    this.notifySubscribers(prevState, this.state);
  }

  /**
   * Subscribe to state changes at a specific path
   * @param {string} path - Dot-separated path (e.g., 'map.center', 'tools.active')
   * @param {Function} callback - Called with new value when changed
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(path);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(path);
        }
      }
    };
  }

  /**
   * Get current state (returns copy to prevent external mutation)
   * @returns {Object}
   */
  getState() {
    return this.cloneState();
  }

  /**
   * Notify subscribers if their watched path changed
   * @private
   */
  notifySubscribers(prevState, nextState) {
    for (const [path, callbacks] of this.subscribers.entries()) {
      const prevValue = this.getValueAtPath(prevState, path);
      const nextValue = this.getValueAtPath(nextState, path);

      // Only notify if value actually changed
      if (prevValue !== nextValue) {
        callbacks.forEach(callback => callback(nextValue));
      }
    }
  }

  /**
   * Get value at dot-separated path
   * @private
   */
  getValueAtPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  /**
   * Clone state (shallow clone of top-level objects)
   * @private
   */
  cloneState() {
    return {
      map: { ...this.state.map },
      layers: {
        visible: new Set(this.state.layers.visible),
        loaded: new Map(this.state.layers.loaded),
        stats: new Map(this.state.layers.stats)
      },
      tools: {
        active: this.state.tools.active,
        transient: { ...this.state.tools.transient }
      },
      ui: {
        popup: { ...this.state.ui.popup },
        search: { ...this.state.ui.search },
        fullscreen: this.state.ui.fullscreen,
        curtainOpen: this.state.ui.curtainOpen
      },
      network: {
        queue: [...this.state.network.queue],
        inFlight: new Set(this.state.network.inFlight),
        abortControllers: new Map(this.state.network.abortControllers)
      }
    };
  }
}
