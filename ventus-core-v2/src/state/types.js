/**
 * State Shape Documentation
 * Per ARCHITECTURE_V2.md Section 4.1
 * 
 * This file documents the expected state structure.
 * Not TypeScript yet — using JSDoc for Phase 1.
 */

/**
 * @typedef {Object} VentusState
 * 
 * @property {MapState} map - Map configuration
 * @property {LayersState} layers - Layer visibility and loading state
 * @property {ToolsState} tools - Active tool and transient state
 * @property {UIState} ui - UI component state
 * @property {NetworkState} network - Network request state
 */

/**
 * @typedef {Object} MapState
 * @property {[number, number]} center - [lon, lat]
 * @property {number} zoom - Zoom level
 * @property {string} basemap - 'dark' | 'satellite'
 */

/**
 * @typedef {Object} LayersState
 * @property {Set<string>} visible - Layer IDs currently visible
 * @property {Map<string, boolean>} loaded - Load status per layer
 * @property {Map<string, LayerStats>} stats - Derived stats per layer
 */

/**
 * @typedef {Object} LayerStats
 * @property {number} count - Feature count
 * @property {number} mw - Total megawatts
 */

/**
 * @typedef {Object} ToolsState
 * @property {string|null} active - Active tool ID or null
 * @property {Object} transient - Tool-specific transient state
 */

/**
 * @typedef {Object} UIState
 * @property {PopupState} popup - Popup state
 * @property {SearchState} search - Search state
 * @property {boolean} fullscreen - Fullscreen mode active
 * @property {boolean} curtainOpen - Fullscreen curtain open
 */

/**
 * @typedef {Object} PopupState
 * @property {boolean} visible - Popup visible
 * @property {[number, number]|null} coords - [lon, lat] or null
 * @property {string} content - HTML content
 */

/**
 * @typedef {Object} SearchState
 * @property {string} query - Search query string
 * @property {Array} results - Search results
 * @property {number|null} selected - Selected result index
 */

/**
 * @typedef {Object} NetworkState
 * @property {Array} queue - Pending requests
 * @property {Set<string>} inFlight - URLs being fetched
 * @property {Map<string, AbortController>} abortControllers - Abort controllers
 */

/**
 * Create initial state
 * @returns {VentusState}
 */
export function createInitialState() {
  return {
    map: {
      center: [0, 0],
      zoom: 2,
      basemap: 'dark'
    },
    layers: {
      visible: new Set(),
      loaded: new Map(),
      stats: new Map()
    },
    tools: {
      active: null,
      transient: {}
    },
    ui: {
      popup: {
        visible: false,
        coords: null,
        content: ''
      },
      search: {
        query: '',
        results: [],
        selected: null
      },
      fullscreen: false,
      curtainOpen: false
    },
    network: {
      queue: [],
      inFlight: new Set(),
      abortControllers: new Map()
    }
  };
}
