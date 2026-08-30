(() => {
  'use strict';

  const GENERATION = '202608292126';
  const PRE_SNAPPED_LAYER_IDS = new Set(['400', '275', '220', '132', '66']);
  const originalInit = window.initVentusMap;

  if (typeof originalInit !== 'function') {
    throw new Error('V8 engine init function is unavailable before map-ready adapter');
  }

  const state = {
    schema: 'gridatlas.pre-snapped-config-adapter.v1',
    generation: GENERATION,
    applied: false,
    changed_layer_ids: [],
    preserved_preload_flags: true,
    failures: []
  };
  window.__GRIDATLAS_PRE_SNAPPED_CONFIG__ = state;

  window.initVentusMap = function gridAtlasMapReadyInit(options) {
    try {
      const changed = [];
      const config = options.config.map(group => ({
        ...group,
        layers: group.layers.map(layer => {
          if (!PRE_SNAPPED_LAYER_IDS.has(String(layer.id))) return layer;
          if (layer.snap !== true) {
            throw new Error(`expected V8 snap=true for topology layer ${layer.id}`);
          }
          changed.push(String(layer.id));
          return { ...layer, snap: false };
        })
      }));

      const expected = [...PRE_SNAPPED_LAYER_IDS].sort();
      if (JSON.stringify([...changed].sort()) !== JSON.stringify(expected)) {
        throw new Error(`pre-snapped layer closure mismatch: ${JSON.stringify(changed)}`);
      }

      state.applied = true;
      state.changed_layer_ids = changed;
      return originalInit({ ...options, config });
    } catch (error) {
      state.failures.push(String(error?.message || error));
      throw error;
    }
  };
})();
