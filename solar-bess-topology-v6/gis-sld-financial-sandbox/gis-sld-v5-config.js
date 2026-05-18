"use strict";

// GIS SLD Financial Sandbox V6
// Config extracted by GridBot feature 002.
// TODO: migrate config into the shared GISSLD namespace at feature 007.

const SUBSTATIONS_URL = "/grid_substations.geojson";

// Borrowed live reference paths from repd_grid_atlasv8 without duplicating datasets.
// These layers are public GIS screening references only and do not confirm capacity, outage availability or connection rights.
const TRANSMISSION_GRID_LAYERS = [
    {
        id: "400kv",
        label: "400kV Transmission",
        sourceId: "src-grid-400kv",
        layerId: "l-grid-400kv",
        url: "/repd_grid_atlasv8/data/grid_400kv.geojson",
        color: "#0054ff",
        width: 2.8
    },
    {
        id: "132kv",
        label: "132kV Transmission",
        sourceId: "src-grid-132kv",
        layerId: "l-grid-132kv",
        url: "/repd_grid_atlasv8/data/grid_132kv.geojson",
        color: "#00cc00",
        width: 2.0
    }
];

const CONSTANTS = {
    M2_PER_ACRE: 4046.86,
    BESS_M2_PER_MWH: 85,
    BESS_ASPECT: 2.5,
    BLOCK_SPACING_KM: 0.01,
    BOUNDARY_BUFFER_KM: 0.02,
    ARRAY_OFFSET_KM: 0.2,
    DEFAULT_CENTER: [-0.1276, 51.5072],
    DEFAULT_ZOOM: 13,
    RECALC_DEBOUNCE_MS: 80,
    BIFACIAL_BY_GCR: { "0.35": 8, "0.45": 5, "0.75": 2 },
    LOGISTICS_PRESETS: {
        high_density: { pallet: 33, container: 594 },
        legacy: { pallet: 31, container: 620 }
    }
};