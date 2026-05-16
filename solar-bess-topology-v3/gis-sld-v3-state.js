"use strict";

// GIS SLD Financial Sandbox V3
// State extracted by GridBot feature 004.
// Must load after config and helpers, and before the inline app script.

const state = {
    activeTab: "string",
    currentGeoJSON: { type: "FeatureCollection", features: [] },
    activeDrawCenter: null,
    selectedSubstation: null,
    subsVisible: true,
    satActive: false,
    activePopup: null,
    lastStats: null,
    lastFinance: { fin_string: null, fin_central: null }
};
