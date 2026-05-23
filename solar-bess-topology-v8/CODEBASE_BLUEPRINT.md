# GlobalGrid2050 V8 Codebase Blueprint

Generated UTC: `2026-05-23T04:00:59.307068+00:00`

This is a compact AI review map of the V8 codebase. It records folder structure, file roles, HTML IDs, linked scripts, linked CSS, JavaScript function signatures, DOM references, event listeners and key CSS selectors.

It is intentionally not a full source dump. Use this first, then inspect individual files only when needed.

## Directory Structure

```text
solar-bess-topology-v8/
    README.md
    index.html
    bess-electrical-topology-review/
        README.md
        bess-electrical-topology-review.css
        bess-electrical-topology-review.js
        index.html
    bess-gis-sld-financial-sandbox/
        README.md
        bess-gis-sld-financial-sandbox.css
        bess-gis-sld-financial-sandbox.js
        index.html
    bess-pcs-standalone/
        gis-sld-v5-calculations.js
        gis-sld-v5-config.js
        gis-sld-v5-drawing.js
        gis-sld-v5-export.js
        gis-sld-v5-finance.js
        gis-sld-v5-helpers.js
        gis-sld-v5-map.js
        gis-sld-v5-state.js
        gis-sld-v5-substations.js
        gis-sld-v5-ui-core.js
        gis-sld-v5-ui.js
        gis-sld-v5.css
        index.html
```

## File Summaries

### `solar-bess-topology-v8/README.md`

Size: `970` characters, `34` lines

Headings:
- # GlobalGrid2050 V8
- ## Current apps
- ## Main app boundary
- ## Advanced review boundary

### `solar-bess-topology-v8/bess-electrical-topology-review/README.md`

Size: `1,202` characters, `31` lines

Headings:
- # BESS Electrical Topology Review V8
- ## Scope
- ## Main validation themes
- ## Doctrine

### `solar-bess-topology-v8/bess-electrical-topology-review/bess-electrical-topology-review.css`

Size: `3,302` characters, `36` lines

CSS selectors:
- `.app-header`
- `.app-shell`
- `.diagram-footer`
- `.diagram-panel`
- `.diagram-title`
- `.header-links`
- `.input-panel label`
- `.kicker`
- `.link-btn`
- `.main-grid`
- `.note`
- `.panel`
- `.scada-bad`
- `.scada-box`
- `.scada-dc`
- `.scada-line`
- `.scada-small`
- `.scada-text`
- `.scada-warn`
- `.stat`
- `.stat span`
- `.stat strong`
- `.status-box`
- `.status-box.bad`
- `.status-box.good`

### `solar-bess-topology-v8/bess-electrical-topology-review/bess-electrical-topology-review.js`

Size: `7,609` characters, `143` lines

Signatures:
```text
function num(id, fallback = 0) {
function val(id) {
function setText(id, text) {
function fmt(value, digits = 2) {
function updateBessTopology() {
function drawScada(data) {
```

Events listened for:
- `DOMContentLoaded`
- `change`
- `input`

DOM IDs referenced:
- `bess_scada`
- `required_studies`
- `status_box`

### `solar-bess-topology-v8/bess-electrical-topology-review/index.html`

Size: `7,046` characters, `87` lines

Linked CSS:
- `./bess-electrical-topology-review.css`

Linked scripts:
- `./bess-electrical-topology-review.js`

HTML IDs:
- `ac_voltage`
- `bess_energy_mwh`
- `bess_power_mw`
- `bess_scada`
- `btn_print`
- `conductor_material`
- `conductor_mm2`
- `dc_disconnector`
- `dc_fault_withstand`
- `dc_imd`
- `dc_leakage`
- `dc_route_m`
- `dc_voltage`
- `installation_basis`
- `out_current_per_set`
- `out_duration`
- `out_mw_per_pcs`
- `out_pcs_match`
- `out_r_path`
- `out_total_dc_current`
- `out_validation_status`
- `out_vdrop`
- `out_x_path`
- `out_z_path`
- `parallel_sets`
- `pcs_qty`
- `pcs_total_mw`
- `pcs_tx_arrangement`
- `protection_status`
- `r_ohm_km`
- `required_studies`
- `reverse_current`
- `rx_confirmed`
- `status_box`
- `tx_impedance_confirmed`
- `tx_mva`
- `x_ohm_km`

HTML classes:
- `app-header`
- `app-shell`
- `diagram-footer`
- `diagram-panel`
- `diagram-title`
- `header-links`
- `input-panel`
- `kicker`
- `link-btn`
- `main-grid`
- `note`
- `panel`
- `results-panel`
- `stat`
- `status-box`

### `solar-bess-topology-v8/bess-gis-sld-financial-sandbox/README.md`

Size: `1,479` characters, `49` lines

Headings:
- # BESS GIS SLD Financial Sandbox V8
- ## Included
- ## Excluded from this app
- ## Future notes

### `solar-bess-topology-v8/bess-gis-sld-financial-sandbox/bess-gis-sld-financial-sandbox.css`

Size: `3,952` characters, `49` lines

CSS selectors:
- `#map`
- `.action`
- `.app-shell`
- `.controls-panel`
- `.drawing-panel`
- `.drawing-title`
- `.kicker`
- `.logic-box`
- `.map-inline-input`
- `.map-inline-label`
- `.map-panel`
- `.map-toolbar`
- `.panel`
- `.stat`
- `.stat span`
- `.stat strong`
- `.svg-battery`
- `.svg-boundary`
- `.svg-dc`
- `.svg-grid`
- `.svg-line`
- `.svg-pcs`
- `.svg-road`
- `.svg-small`
- `.svg-text`
- `.svg-tx`
- `.svg-wall`
- `.tab-btn.active`
- `.tab-panel`
- `.tab-panel.active`
- `.tabs`
- `.topbar`
- `.topbar-actions`
- `.topbar-actions a`
- `.workspace`

### `solar-bess-topology-v8/bess-gis-sld-financial-sandbox/bess-gis-sld-financial-sandbox.js`

Size: `19,908` characters, `465` lines

Signatures:
```text
function n(id, fallback = 0) {
function v(id, fallback = '') { return document.getElementById(id)?.value || fallback; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function fmt(value, digits = 2) { return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0'; }
function gbp(value) { return '£' + fmt(value, 0); }
function initMap() {
function switchStyle(style) {
function applyContainerPreset() {
function syncEnergy() {
function calc() {
function updateSummary(c) {
function svgEl(tag, attrs = {}) {
function svgText(svg, x, y, text, cls = 'svg-small', anchor = 'start') {
function drawLayout(c) {
function updateAll() {
function bindEvents() {
function metresToLngLat(origin, eastM, northM) {
function rotatePoint(x, y, deg) {
function rectFeature(origin, cx, cy, w, h, rotationDeg, props) {
function pointFeature(origin, eastM, northM, rotationDeg, props) {
function lineFeature(origin, points, rotationDeg, props) {
function buildBessGeoJsonAt(origin) {
function ensureBessGeoLayers() {
function refreshBessGeoLayout() {
function drawBessGeoLayoutAtMapCenter() {
function resetBessGeoLayout() {
function fitBessGeoLayout() {
const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
function exportBessGeoJson() {
```

Events listened for:
- `DOMContentLoaded`
- `change`
- `click`
- `input`

DOM IDs referenced:
- `bess_svg`
- `btn_dark`
- `btn_draw_at_center`
- `btn_export_geojson`
- `btn_fit`
- `btn_print`
- `btn_reset_geo`
- `btn_satellite`
- `btn_sync_energy`
- `container_length_m`
- `container_size`
- `container_width_m`
- `energy_mwh`
- `logic_box`
- `tab_`

Selectors referenced:
- `.tab-btn`
- `.tab-panel`
- `input, select`

### `solar-bess-topology-v8/bess-gis-sld-financial-sandbox/index.html`

Size: `8,520` characters, `153` lines

Linked CSS:
- `./bess-gis-sld-financial-sandbox.css`
- `https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.css`

Linked scripts:
- `./bess-gis-sld-financial-sandbox.js`
- `https://unpkg.com/maplibre-gl@3.3.1/dist/maplibre-gl.js`

HTML IDs:
- `access_road_m`
- `analysis_years`
- `availability_pct`
- `barrier_mode`
- `bess_svg`
- `btn_dark`
- `btn_draw_at_center`
- `btn_export_geojson`
- `btn_fit`
- `btn_print`
- `btn_reset_geo`
- `btn_satellite`
- `btn_sync_energy`
- `capex_per_mwh`
- `civils_allowance`
- `container_length_m`
- `container_mwh`
- `container_size`
- `container_spacing_m`
- `container_width_m`
- `containers_per_pcs`
- `containers_per_row`
- `contingency_pct`
- `duration_hours`
- `energy_mwh`
- `geo_rotation_deg`
- `grid_export_mw`
- `layout_mode`
- `logic_box`
- `map`
- `mv_allowance`
- `out_capex`
- `out_containers`
- `out_duration`
- `out_energy`
- `out_export`
- `out_footprint`
- `out_payback`
- `out_pcs_count`
- `out_pcs_power`
- `out_revenue`
- `pcs_capex_per_mw`
- `pcs_rating_mw`
- `revenue_per_mw_year`
- `row_spacing_m`
- `tab_finance`
- `tab_layout`
- `tab_notes`

HTML classes:
- `action`
- `active`
- `app-shell`
- `controls-panel`
- `drawing-panel`
- `drawing-title`
- `kicker`
- `logic-box`
- `map-inline-input`
- `map-inline-label`
- `map-panel`
- `map-toolbar`
- `panel`
- `stat`
- `summary-panel`
- `tab-btn`
- `tab-panel`
- `tabs`
- `topbar`
- `topbar-actions`
- `workspace`

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-calculations.js`

Size: `8,674` characters, `170` lines

Signatures:
```text
function readPhysicalInputs(suffix) {
function zeroStats(dc_ac_ratio, mods_pallet, mods_container) {
function buildStats(opts) {
function getCentralInverterMwac() {
function getCentralInverterDcMwdc() {
function getCentralSkidMva() {
function computeStringStats() {
function computeCentralStats() {
function computeStats() {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-config.js`

Size: `678` characters, `24` lines

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-drawing.js`

Size: `10,735` characters, `236` lines

Signatures:
```text
function normBearing(deg) {
function getArrayAxisDeg() {
function getRectPolygon(centerCoord, width_km, length_km, propType, rotationDeg = 0) {
function atlasHaversineKm(a, b) {
function routeLengthKm(coords) {
function getBlockAspect() {
function getExportCableExtraKm() {
function getCommittedCablePins() {
function shouldShowExportCable() {
function buildExportCableLine(privateSubCoord, publicSubCoord, safeExtraOffsetKm) {
function addCableRoutePinMarkers(features) {
function computeAndDraw() {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-export.js`

Size: `7,434` characters, `148` lines

Signatures:
```text
function exportGeoJSON() {
const boundary = exportData.features.find(f => f.properties.type === "array_boundary");
function triggerDownload(data) {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-finance.js`

Size: `13,264` characters, `262` lines

Signatures:
```text
function setFinanceLabel(inputId, labelText) {
function convertLargeDefaultToWp(inputId) {
function setFinanceInputDefaultsForWp(prefix) {
function migrateFinanceUnitsToWp() {
function applyDevelopmentStageDefaults(prefix) {
function computeFinance(prefix, stats) {
function renderFinance(prefix, fin) {
function renderFinanceWarnings(prefix, fin, stats) {
```

Events listened for:
- `DOMContentLoaded`

Selectors referenced:
- `label`

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-helpers.js`

Size: `1,802` characters, `75` lines

Signatures:
```text
const $ = (id) => document.getElementById(id);
const num = (id) => {
const intVal = (id, fallback = 0) => {
const checked = (id) => {
const setText = (id, val) => {
const setClass = (id, cls) => {
function money(v) {
function debounce(fn, ms) {
function isValidLngLat(c) {
function pickProp(obj, keys, fallback = null) {
function setFetchStatus(msg, isError) {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-map.js`

Size: `21,289` characters, `476` lines

Signatures:
```text
function atlasV8CapacityExpression() {
function atlasV8AssetBaseFilter(assetKey) {
function atlasV8StatusExpression() {
function atlasV8AssetFilter(assetKey) {
function applyAtlasV8AssetDropdownFilter(selected = atlasV8AssetFilterState.selected, status = atlasV8AssetFilterState.status, minMw = atlasV8AssetFilterState.minMw, maxMw = atlasV8AssetFilterState.maxMw) {
function toggleAtlasV8OperatingAssetLayer(assetKey) {
function toggleAtlasV8GridLayer(voltageKey) {
function initMap() {
function onMapLoad() {
function showPopup(coords, html) {
function onSubstationClick(e) {
function onInverterClick(e) {
function onCableRoutePinClick(e) {
function onOperatingAssetClick(e) {
function onPoiClick(e) {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-state.js`

Size: `861` characters, `29` lines

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-substations.js`

Size: `2,914` characters, `83` lines

Signatures:
```text
function normaliseSubstations(raw) {
async function loadSubstations() {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-ui-core.js`

Size: `7,487` characters, `127` lines

Signatures:
```text
function renderTechSummary(stats) {
function renderBenchmark() {
function updateSelectedSubstationDisplay() {
function recalcAll() {
function atlasV8LegendItem(voltageKey, label, colour, widthPx) {
function atlasV8AssetLegendItem(assetKey, label, colour) {
function updateLegend() {
```

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5-ui.js`

Size: `61,679` characters, `1,484` lines

Signatures:
```text
function switchTab(tab) {
function applyLogisticsPreset(val, suffix) {
function autoFillBifacial(gcrVal, targetId) {
function updateExportCableLengthDisplay() {
function updateArrayRotationDisplay() {
function rotateArrayBy(deltaDeg) {
function resetArrayRotation() {
function getCurrentArrayCenter() {
const boundary = state.currentGeoJSON?.features?.find(f => f.properties?.type === "array_boundary");
function getArrayNudgeStepKm() {
function clearRouteAfterArrayShift() {
function nudgeArray(bearingDeg) {
function updateCableRouteStatus() {
function injectExportCableLengthControl() {
function redrawIfTopologyExists() {
function setArrayMoveStatus(text, active = false) {
function toggleArrayMoveMode() {
function resetArrayLocation() {
function placeArrayAtMapPoint(e) {
function toggleCablePinMode() {
function commitCablePinRoute() {
function undoCablePin() {
function clearCableRoute() {
function addCableRoutePin(e) {
function startCableRouteMode() { toggleCablePinMode(); }
function finishCableRouteMode() { commitCablePinRoute(); }
function addCableRouteWaypoint(e) { addCableRoutePin(e); }
async function searchLocation() {
function triggerDrawAtCenter() {
function gisSearchEscape(value) {
function gisSearchPick(prop, keys, fallback = "") {
function gisSearchValidPoint(feature) {
async function buildGisSearchIndexes() {
function gisSearchResultsEl() {
function hideGisSearchResults() {
function showGisSearchResults(html) {
function renderGisSearchResults(query) {
function flyToGisSearchItem(item) {
async function wireGisMapSearch() {
function siteIntelPick(prop, keys, fallback = "") {
function siteIntelEscape(value) {
function siteIntelValidPoint(feature) {
function siteIntelFeatureCollection(raw) {
function siteIntelFlattenLines(features) {
function showSiteIntelPanel(html) {
function hideSiteIntelPanel() {
async function loadSiteIntelData() {
function siteIntelAssetGroup(feature) {
function nearestPointFeature(point, features, predicate) {
function nearestLineFeature(point, features) {
function formatKm(value) {
function formatCapacity(feature) {
function assetName(feature) {
function substationName(feature) {
function substationVoltage(feature) {
function siteIntelRow(label, main, meta, danger = false) {
function siteIntelOpportunityNotes(results) {
async function inspectSiteIntelligenceAt(lngLat) {
const addAssetRow = (label, item) => {
const notes = siteIntelOpportunityNotes(results).map(note => `<li>${siteIntelEscape(note)}</li>`).join("");
function wireSiteIntelligencePanel() {
function setTopologyLayerVisibility(visible) {
function updateArrayToggleButton() {
function toggleArrayVisibility() {
function syncMapSizeInputFromActiveTab() {
function setMapSizeStatus(text, ok = true) {
function setInputValue(id, value) {
function applyTargetDcMwpFromActiveTab(source) {
function wireArraySizingControls() {
function toggleBasemap() {
function toggleSubs() {
function updateAtlasV8GridToggleButtons() {
function readAssetFilterCapacityValue(id) {
function updateAtlasV8OperatingAssetDropdown() {
function applyAssetDropdownFromControls() {
function wireAtlasV8PipelineDropdownWithStatus() {
function updateAtlasV8OperatingAssetToggleButtons() {
function wireAtlasV8OperatingAssetToggleButtons() {
function wireAtlasV8GridToggleButtons() {
function toggleMapExpand() {
function toggleKeyCollapse() {
function toggleMapToolsOverlay() {
function wireMapToolOverlayButtons() {
function wireEvents() {
function wireMapMoveEvents() {
function boot() {
function sleepForPrintPack(ms) {
function setLayerVisibilityForPrintPack(layerId, visible) {
function setAtlasLayersDefaultOff() {
function setSubsDefaultOff() {
function enforceCleanDefaultMapLayers() {
function getMapPrintState() {
async function restoreMapPrintState(saved) {
function ensurePrintMapPackContainer() {
function addPrintMapFigure(pack, title, dataUrl, note, landscape = false) {
async function captureCurrentMapForPrint() {
function getTopologyBoundsForPrintPack() {
async function fitContextMapForPrint() {
async function setSatelliteForPrintPack(active) {
async function prepareGisSldPrintReport() {
```

Events listened for:
- `DOMContentLoaded`
- `change`
- `click`
- `focus`
- `input`
- `keydown`

DOM IDs referenced:
- `print_map_pack`

Selectors referenced:
- `.asset-layer-btn`
- `.atlas-voltage-btn`
- `.central-only`
- `.gis-search-result`
- `.panel-right`
- `.tab-btn`
- `[data-dev-stage-prefix]`
- `[data-gis-search-idx]`
- `[data-suffix]`
- `input, select`

### `solar-bess-topology-v8/bess-pcs-standalone/gis-sld-v5.css`

Size: `39,799` characters, `1,937` lines

CSS selectors:
- `#btn_array_toggle.active`
- `#btn_array_toggle:not(.active)`
- `#central_tab.active`
- `#central_tab:not(.active)`
- `#fetch_status`
- `#fetch_status.error`
- `#map`
- `#module_map`
- `#string_tab.active`
- `#string_tab:not(.active)`
- `.array-size-control input`
- `.array-size-note`
- `.asset-bess.active`
- `.asset-filter-row`
- `.asset-layer-btn`
- `.asset-layer-btn.active`
- `.asset-range-input`
- `.asset-range-input:focus`
- `.asset-solar.active`
- `.asset-toggle-row`
- `.asset-toggle-row .map-toggle-btn`
- `.asset-wind-offshore.active`
- `.asset-wind-onshore.active`
- `.atlas-132kv.active`
- `.atlas-275kv.active`
- `.atlas-400kv.active`
- `.atlas-66kv.active`
- `.atlas-voltage-btn:not(.active)`
- `.benchmark-box`
- `.btn`
- `.btn.draw-btn`
- `.btn.draw-btn.central`
- `.btn:hover`
- `.button-row`
- `.card`
- `.collapsed`
- `.crosshair`
- `.dashboard`
- `.disclaimer-box`
- `.explainer-box`
- `.explainer-box h3`
- `.explainer-box p`
- `.explainer-box strong`
- `.finance-box`
- `.finance-box .cyan`
- `.finance-box .finance-headline`
- `.finance-box .green`
- `.finance-box .input-group`
- `.finance-box .input-group[style]`
- `.finance-box .orange`
- `.finance-box .stat-row`
- `.finance-box .stat-row span:first-child`
- `.finance-box .stat-val`
- `.finance-box .warning-box`
- `.finance-box .warning-box:empty`
- `.finance-box [class*="cyan"]`
- `.finance-box [class*="green"]`
- `.finance-box [class*="orange"]`
- `.finance-box [id$="_warnings"]`
- `.finance-box [id$="_warnings"]:empty`
- `.finance-box h3`
- `.finance-box input`
- `.finance-box input[type="checkbox"]`
- `.finance-box input[type="number"]`
- `.finance-box label`
- `.finance-box select`
- `.finance-box summary`
- `.finance-box summary::-webkit-details-marker`
- `.finance-box textarea`
- `.finance-headline`
- `.function-item`
- `.gis-map-search`
- `.gis-search-btn`
- `.gis-search-input`
- `.gis-search-input:focus`
- `.gis-search-result`
- `.gis-search-result span`
- `.gis-search-result strong`
- `.gis-search-result-empty`
- `.gis-search-result.asset span`
- `.gis-search-result.substation span`
- `.gis-search-result:hover`
- `.gis-search-results`
- `.guidance-box`
- `.hidden`
- `.input-group`
- `.input-group input:focus`
- `.input-group input[type="number"]`
- `.input-group input[type="text"]`
- `.input-group select`
- `.input-group select:focus`
- `.legend`
- `.legend *`
- `.legend-item`
- `.legend.key-collapsed`
- `.map-asset-select`
- `.map-asset-select:focus`
- `.map-asset-status-select`
- `.map-asset-status-select:focus`
- `.map-controls`
- `.map-size-input`
- `.map-size-input:focus`
- `.map-size-row`
- `.map-size-status`
- `.map-toggle-btn`
- `.map-toggle-btn.active`
- `.map-toggle-btn:hover`
- `.map-toggle-row`
- `.map-tool-overlay`
- `.map-tool-overlay .map-toggle-btn`
- `.map-tool-overlay > .map-toggle-row`
- `.map-tool-overlay > .map-toggle-row:first-child`
- `.map-tool-overlay input`
- `.map-tool-overlay span`
- `.map-tool-overlay.tools-collapsed`
- `.map-tool-overlay.tools-collapsed #btn_map_tools_toggle`
- `.map-tool-overlay.tools-collapsed .map-size-row`
- `.map-tool-overlay.tools-collapsed .map-tool-row-secondary`
- `.map-tool-overlay.tools-collapsed button:not(#btn_map_tools_toggle)`
- `.map-tool-row-secondary .map-toggle-btn`

### `solar-bess-topology-v8/bess-pcs-standalone/index.html`

Size: `604` characters, `13` lines

### `solar-bess-topology-v8/index.html`

Size: `2,386` characters, `44` lines

HTML classes:
- `card`
- `grid`
- `kicker`
- `warning`
