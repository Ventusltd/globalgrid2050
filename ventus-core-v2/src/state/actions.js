/**
 * Action Creators
 * Per ARCHITECTURE_V2.md Section 4.2
 */

// Map actions
export const setMapCenter = (center) => ({
  type: 'SET_MAP_CENTER',
  payload: center
});

export const setMapZoom = (zoom) => ({
  type: 'SET_MAP_ZOOM',
  payload: zoom
});

export const setBasemap = (basemap) => ({
  type: 'SET_BASEMAP',
  payload: basemap
});

// Layer actions
export const toggleLayer = (layerId, visible) => ({
  type: 'TOGGLE_LAYER',
  payload: { layerId, visible }
});

export const setLayerLoaded = (layerId, loaded) => ({
  type: 'SET_LAYER_LOADED',
  payload: { layerId, loaded }
});

export const updateLayerStats = (layerId, stats) => ({
  type: 'UPDATE_LAYER_STATS',
  payload: { layerId, stats }
});

// Tool actions
export const setActiveTool = (toolId) => ({
  type: 'SET_ACTIVE_TOOL',
  payload: toolId
});

export const updateToolTransient = (toolId, data) => ({
  type: 'UPDATE_TOOL_TRANSIENT',
  payload: { toolId, data }
});

export const clearToolTransient = (toolId) => ({
  type: 'CLEAR_TOOL_TRANSIENT',
  payload: toolId
});

// UI actions
export const showPopup = (coords, content) => ({
  type: 'SHOW_POPUP',
  payload: { coords, content }
});

export const hidePopup = () => ({
  type: 'HIDE_POPUP'
});

export const setSearchQuery = (query) => ({
  type: 'SET_SEARCH_QUERY',
  payload: query
});

export const setSearchResults = (results) => ({
  type: 'SET_SEARCH_RESULTS',
  payload: results
});

export const toggleFullscreen = (active) => ({
  type: 'TOGGLE_FULLSCREEN',
  payload: active
});

export const toggleCurtain = (open) => ({
  type: 'TOGGLE_CURTAIN',
  payload: open
});

// Network actions
export const addToQueue = (request) => ({
  type: 'ADD_TO_QUEUE',
  payload: request
});

export const removeFromQueue = (request) => ({
  type: 'REMOVE_FROM_QUEUE',
  payload: request
});

export const setInFlight = (url, inFlight) => ({
  type: 'SET_IN_FLIGHT',
  payload: { url, inFlight }
});
