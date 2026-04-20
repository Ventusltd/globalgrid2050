/**
 * TODO Phase 2: Map Adapter (MapLibre GL abstraction)
 * See ARCHITECTURE_V2.md Section 3
 * 
 * Purpose: Thin wrapper around MapLibre GL for testability
 * 
 * Interface:
 * - addSource(id, spec)
 * - addLayer(layer)
 * - removeLayer(id)
 * - setLayoutProperty(layerId, property, value)
 * - on(event, handler)
 * - off(event, handler)
 * - flyTo(options)
 * - queryRenderedFeatures(point, options)
 * - project(lngLat)
 * - unproject(point)
 * - resize()
 */

export class MapAdapter {
  constructor() {
    throw new Error('MapAdapter not implemented - Phase 2');
  }
}
