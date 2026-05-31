# UK Energy Tracking V5 to V6 Comprehensive Comparison Report

Generated UTC: `2026-05-31T19:57:06Z`

## Purpose

This report compares the protected V5 UK Energy Tracking application against the modular V6 application before any further V6 repair work. It is non destructive and does not patch either app.

## Doctrine files checked

| Document | Exists | Lines | SHA |
|---|---|---|---|
| AI_START_HERE.md | yes | 201 | a25fef4e0b3d649b |
| ARCHITECTURE.md | yes | 1247 | 23bf621a6b3e578f |
| PHILOSOPHY.md | yes | 165 | 4f5b34b44ce50bcd |
| LAUNCH_FREEZE.md | yes | 48 | 2f1d9cb93382a5ad |
| README.md | yes | 57 | afb8ca3793d8fff8 |
| OPERATOR_MANUAL_V1.md | yes | 163 | 63735a5b0c422593 |
| WORKFLOW_REGISTRY.md | yes | 50 | 01140ef50ace7d11 |
| REPOSITORY_SIZE_REPORT.md | yes | 23 | ce9777ae74cc44e8 |
| GIS_SLD_APP_ADDRESS_MAP.md | yes | 10 | a709daac25fcaecf |
| GIS_SLD_V2_MODULAR_SITE_MAP.md | yes | 95 | e92ff7367b3b797b |
| GRIDBOT_FEATURE_INSTALL_INSTRUCTIONS.md | yes | 61 | 67f83be5b771aaf9 |
| uk_energy_tracking_v5/README.md | yes | 184 | d83d6820e20ce119 |
| uk_energy_tracking_v5/AI_RELOAD_INSTRUCTIONS.md | yes | 157 | 2a45ab234ec189f9 |

## App folder inventory

| Folder | Files | Text files | Total bytes |
|---|---|---|---|
| uk_energy_tracking_v5 | 35 | 34 | 3475645 |
| uk_energy_tracking_v6 | 19 | 19 | 710020 |

## Price history file presence

| App | File | Exists | Lines | Bytes |
|---|---|---|---|---|
| V5 | index.md | yes | 278 | 20442 |
| V5 | price-history-ui.js | yes | 79 | 27767 |
| V5 | price-history-ui.css | yes | 229 | 8625 |
| V5 | price-history-fullscreen.js | yes | 39 | 14445 |
| V5 | live-config.js | yes | 8 | 654 |
| V5 | live-app.js | yes | 68 | 5347 |
| V5 | live-helpers.js | yes | 10 | 656 |
| V6 | index.md | yes | 138 | 10086 |
| V6 | styles/app.css | yes | 120 | 10498 |
| V6 | live_data_pipeline/live-config.js | yes | 9 | 415 |
| V6 | shared_helpers/dom_text/dom_text.js | yes | 7 | 625 |
| V6 | price_history_chart/load_price_history_data/load_price_history_data.js | yes | 29 | 7403 |
| V6 | price_history_chart/render_price_chart/render_price_chart.js | yes | 31 | 11625 |
| V6 | price_history_chart/control_price_history/control_price_history.js | yes | 24 | 5602 |
| V6 | app_bootstrap/start_v6_app/start_v6_app.js | yes | 7 | 648 |

## Page load order

| App | Order | Script source |
|---|---|---|
| V5 | 1 | /uk_energy_tracking_v5/price-history-ui.js?v=20260527o |
| V5 | 2 | /uk_energy_tracking_v5/price-history-fullscreen.js?v=20260527p |
| V5 | 3 | /uk_energy_tracking_v5/live-config.js?v=20260526a |
| V5 | 4 | /uk_energy_tracking_v5/live-helpers.js?v=20260526a |
| V5 | 5 | /uk_energy_tracking_v5/live-gauges.js?v=20260526a |
| V5 | 6 | /uk_energy_tracking_v5/live-transport.js?v=20260526a |
| V5 | 7 | /uk_energy_tracking_v5/live-oil-chart.js?v=20260526a |
| V5 | 8 | /uk_energy_tracking_v5/live-app.js?v=20260527a |
| V6 | 1 | /uk_energy_tracking_v6/shared_helpers/dom_text/dom_text.js?v=20260530o |
| V6 | 2 | /uk_energy_tracking_v6/live_data_pipeline/live-config.js?v=20260530o |
| V6 | 3 | /uk_energy_tracking_v6/live_data_pipeline/load_json/load_json.js?v=20260530o |
| V6 | 4 | /uk_energy_tracking_v6/live_data_pipeline/render_live_snapshot/render_live_snapshot.js?v=20260530o |
| V6 | 5 | /uk_energy_tracking_v6/live_data_pipeline/render_generation_mix/render_generation_mix.js?v=20260530o |
| V6 | 6 | /uk_energy_tracking_v6/commodity_price_signals/render_commodities/render_commodities.js?v=20260530o |
| V6 | 7 | /uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js?v=20260530o |
| V6 | 8 | /uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260530o |
| V6 | 9 | /uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js?v=20260530o |
| V6 | 10 | /uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js?v=20260530o |

## Stylesheet load order

| App | Order | Stylesheet |
|---|---|---|
| V5 | 1 | /uk_energy_tracking_v5/price-history-ui.css |
| V6 | 1 | /uk_energy_tracking_v6/styles/app.css?v=20260530o |

## DOM id parity

| ID | Meaning | V5 | V6 | Status |
|---|---|---|---|---|
| price-history-canvas | main price history canvas | yes | yes | ok |
| price-history-fullscreen-overlay | full screen overlay | yes | yes | ok |
| price-history-fullscreen-canvas | full screen canvas | yes | yes | ok |
| price-history-fullscreen-btn | full screen button | yes | yes | ok |
| price-history-start | start date control | yes | yes | ok |
| price-history-period | period control | yes | yes | ok |
| price-history-year | year control | yes | yes | ok |
| price-history-refresh | refresh button | no | yes | mismatch |
| price-history-period-back | previous period button | no | no | ok |
| price-history-period-forward | next period button | no | no | ok |
| price-history-fullscreen-period-back | full screen previous period button | no | yes | mismatch |
| price-history-fullscreen-period-forward | full screen next period button | no | yes | mismatch |
| price-history-range-status | range status text | yes | yes | ok |
| ph-latest-price | latest price card | yes | yes | ok |
| ph-latest-time | latest time card | yes | yes | ok |
| ph-row-count | visible record count card | yes | yes | ok |
| ph-source | source card | yes | yes | ok |
| price-history-table-body | captured records table body | yes | yes | ok |

V5 ids missing from V6: `11`

`diesel-price`, `ev-rapid-price`, `ev-ultra-price`, `fuel-breakdown`, `oil-range`, `oil-stats`, `oil-tooltip`, `oil-trend-canvas`, `petrol-price`, `price-history-zoom-reset`, `scada-mix`

V6 ids not present in V5: `10`

`generation-mix-grid`, `live-electricity-snapshot`, `price-history-discovery`, `price-history-fullscreen-period-back`, `price-history-fullscreen-period-forward`, `price-history-refresh`, `summary-carbon`, `summary-demand`, `summary-price`, `summary-timestamps`

## CSS class parity from index files

V5 classes missing from V6 index: `20`

`ev-card`, `ev-card-grid`, `ev-label`, `ev-panel`, `ev-value`, `fuel-logic-panel`, `fuel-source-links`, `oil-chart-wrap`, `oil-stats-grid`, `oil-tooltip`, `price-history-fullscreen-note`, `pump-card`, `pump-grid`, `pump-label`, `pump-value`, `scada-gauge`, `scada-gauge-card`, `scada-gauge-title`, `scada-gauges`, `trend-controls`

V6 classes not present in V5 index: `9`

`price-history-discovery`, `price-history-fullscreen-arrow`, `price-history-fullscreen-arrow-left`, `price-history-fullscreen-arrow-right`, `scada-live-summary`, `scada-summary-grid`, `scada-summary-time`, `scada-summary-title`, `v6-app`

## Behaviour keyword parity

| Term | Meaning | V5 count | V6 count | Presence status |
|---|---|---|---|---|
| seasonColor | season colouring | 7 | 2 | ok |
| Winter | winter label | 9 | 3 | ok |
| Spring | spring label | 9 | 3 | ok |
| Summer | summer label | 9 | 3 | ok |
| Autumn | autumn label | 6 | 2 | ok |
| fullscreen | full screen behaviour | 50 | 44 | ok |
| devicePixelRatio | retina canvas scaling | 4 | 1 | ok |
| roundRect | canvas rounded panels | 2 | 1 | ok |
| highAt | daily high time | 4 | 1 | ok |
| lowAt | daily low time | 4 | 1 | ok |
| average | daily average | 23 | 18 | ok |
| settlementPeriod | settlement period | 5 | 4 | ok |
| periodStartUTC | CSV period start | 2 | 2 | ok |
| priceGBPperMWh | price value field | 64 | 13 | ok |
| 12hday | 12 hour day filter | 5 | 5 | ok |
| 12hnight | 12 hour night filter | 4 | 4 | ok |
| 6m | 6 month period | 8 | 3 | ok |
| 12m | 12 month period | 4 | 4 | ok |
| 10y | 10 year period | 8 | 4 | ok |

## Function name comparison

Function names only in V5: `105`

`ageMin`, `arcPath`, `axisLabel`, `bindControls`, `bindOilTooltip`, `bucketSeries`, `canvasSetup`, `carbonValue`, `clamp`, `close`, `convert4Bucket`, `copyState`, `css`, `csvLine`, `dateFromOffset`, `decimate`, `deferredLoad`, `dlab`, `draw`, `drawBucketLegend`, `drawDailyEvents`, `drawDailyKey`, `drawDateTick`, `drawEvents`, `drawFourBucket`, `drawHalfHourlyLine`, `drawOilTrend`, `drawPointer`, `drawSeasonKey`, `drawSeasonLine`, `drawWeekly`, `ensureControls`, `ensureDiscoveryPanel`, `ensurePeriodOptions`, `ensureScroller`, `ensureSummaryPanel`, `ensureSummaryStyle`, `ensureV6Notice`, `eventBox`, `eventText`, `extrema`, `filterTimeMode`, `fmtMoney`, `fullDate`, `fullMonth`, `getJSON`, `getJson`, `getText`, `hide`, `injectStyle`, `install`, `isDailyPeriod`, `isDayNightPeriod`, `line`, `loadCaptured`, `loadDailyRows`, `loadForWindow`, `loadFourBucket`, `loadFourBucketRange`, `loadFrequencyModule`, `loadHalfHourly`, `merge`, `modeForDays`, `modeText`, `moneySymbol`, `niceStep`, `offsetFromDate`, `oilStats`, `onclick`, `open`, `parseMarketInputs`, `passesTimeMode`, `pct`, `rangeCutoff`, `refresh`, `refreshAfterLoad`, `reloadIfNeeded`, `renderCommodities`, `renderEvPrices`, `renderFuelBreakdown`, `renderGauge`, `renderMetalCard`, `renderMix`, `selectedPeriod`, `selectedStart`, `setMode`, `setOffset`, `setPeriod`, `show`, `slab`, `stateMatchesControls`, `statsDaily`, `statsHalf`, `status`, `syncScrollerFromStart`, `syncStartFromScroller`, `table`, `timeModeLabel`, `tlab`, `totalScrollableDays`, `txt`, `weekLabel`, `x`, `y`, `yearsBetween`

Function names only in V6: `44`

`actualValue`, `attachPeriodButtons`, `closeFullscreen`, `currentPeriod`, `debouncedLoad`, `drawForecast`, `drawHealthBar`, `drawKey`, `ensurePeriodControls`, `forecastHealth`, `forecastMaxDate`, `forecastPoint`, `forecastValue`, `formatPrice`, `futureMaxDate`, `isDaily`, `isDayNight`, `isoLabel`, `loadCapture`, `loadForecastWindow`, `loadHalf`, `loadWindow`, `maxDate`, `mean`, `minDate`, `niceClock`, `niceDate`, `nudgePeriod`, `openFullscreen`, `parseCsvLine`, `price`, `redrawFullscreen`, `refreshLive`, `render`, `renderTo`, `sameMonthDay`, `sameMonthDow`, `start`, `stats`, `step`, `time`, `todayMax`, `values`, `years`

## Data file comparison

| Data file | V5 summary | V6 summary |
|---|---|---|
| live_grid_energy.json | {"exists": true, "type": "dict"} | {"exists": true, "type": "dict"} |
| live_grid_price.json | {"exists": true, "type": "dict"} | {"exists": true, "type": "dict"} |
| live_oil_prices.json | {"exists": true, "type": "dict"} | {"exists": true, "type": "dict"} |
| electricity_price_history_daily_decade.json | {"exists": true, "type": "dict", "rows": 3652, "first": {"date": "2016-05-31", "average": 35.68, "high": 89.0, "highAt": "18:00", "low": 14.92, "lowAt": "04:30", "observations": 48}, "last": {"date": "2026-05-30", "average": 109.14, "high": 153.32, "highAt": "15:30", "low": -3.62, "lowAt": "01:00", "observations": 48}, "keys": ["average", "date", "high", "highAt", "low", "lowAt", "observations"]} | {"exists": true, "type": "dict", "rows": 3652, "first": {"date": "2016-05-29", "average": 22.52, "high": 50.18, "highAt": "10:00", "low": 15.0, "lowAt": "08:00", "observations": 48}, "last": {"date": "2026-05-28", "average": 70.7, "high": 134.9, "highAt": "21:30", "low": -27.51, "lowAt": "13:00", "observations": 48}, "keys": ["average", "date", "high", "highAt", "low", "lowAt", "observations"]} |
| electricity_price_history.csv | {"path": "/home/runner/work/globalgrid2050/globalgrid2050/uk_energy_tracking_v5/electricity_price_history.csv", "exists": true, "size": 6393, "lines": 49, "sha256": "7c751091a59cd864"} | {"path": "/home/runner/work/globalgrid2050/globalgrid2050/uk_energy_tracking_v6/electricity_price_history.csv", "exists": true, "size": 171, "lines": 3, "sha256": "a56bf842944f8c28"} |

## Critical chart contract checks

| Contract | Pass |
|---|---|
| Raw chart must load published Elexon data only | yes |
| 6 month mode should be full half hourly if required by current decision | yes |
| 12 month plus should preserve daily high average low | yes |
| Full screen arrows should exist | yes |
| Bottom period arrows should exist | yes |
| Season colours should exist | yes |
| Latest time card should be written | yes |
| Table body should be written or consciously omitted | yes |
| Forecast renderer should not be wired into raw chart unless approved | yes |

## V5 to V6 direct file diff snippets

### `uk_energy_tracking_v5/index.md` versus `uk_energy_tracking_v6/index.md`

```diff
--- uk_energy_tracking_v5/index.md
+++ uk_energy_tracking_v6/index.md
@@ -1,121 +1,14 @@
 ---
 layout: page
-title: UK Live Grid Tracker V5
-permalink: /uk_energy_tracking_v5/
+title: UK Live Grid Tracker V6
+permalink: /uk_energy_tracking_v6/
 ---
 
-<link rel="stylesheet" href="/uk_energy_tracking_v5/price-history-ui.css">
-<style>
-:root {
-  --gg-bg: #050505;
-  --gg-panel: #0b0f17;
-  --gg-line: #252b36;
-  --gg-text: #f5f7fb;
-  --gg-muted: #9aa3b6;
-  --gg-cyan: #00ffff;
-  --gg-magenta: #ff00e6;
-  --gg-green: #00ff88;
-  --gg-yellow: #ffcc00;
-  --gg-orange: #ff9900;
-  --gg-red: #ff4444;
-}
-body { background: var(--gg-bg) !important; color: var(--gg-text) !important; }
-a { color: #7fdfff; }
-.page-content, .wrapper, main { background: var(--gg-bg) !important; color: var(--gg-text) !important; }
-.scada-grid { font-family: "Courier New", monospace; max-width: 1280px; margin: 0 auto; }
-.scada-hero { border-bottom: 1px solid var(--gg-line); padding: 18px 0 12px; margin-bottom: 18px; }
-.scada-subtitle { letter-spacing: .28em; color: var(--gg-muted); font-size: 14px; text-transform: uppercase; }
-.scada-title { margin: 10px 0 8px 0; color: var(--gg-text); font-size: clamp(28px, 5vw, 44px); line-height: 1.1; font-weight: 800; }
-.scada-title-rule { height: 1px; background: var(--gg-text); opacity: .75; margin: 12px 0 0 0; }
-.scada-live-row, .scada-live-pill, .scada-update-panel, .scada-intro, .scada-dev-note, .scada-status, .scada-gauges { display:none !important; }
-.scada-mix-grid, .commodity-grid, .pump-grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:14px; margin-top:18px; }
-.scada-mini { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:12px 12px 10px; }
-.scada-mini-top { display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
-.scada-mini-name { color:var(--gg-text); text-transform:uppercase; letter-spacing:.12em; font-size:12px; }
-.scada-mini-value { color:var(--gg-cyan); font-size:13px; white-space:nowrap; }
-.scada-mini-track { height:8px; border-radius:5px; background:rgba(255,255,255,.08); overflow:hidden; margin-top:10px; }
-.scada-mini-fill { height:100%; border-radius:5px; transition:width .6s ease; }
-.commodity-card { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:14px; }
-.commodity-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.16em; font-size:12px; }
-.commodity-value { color:var(--gg-text); font-size:clamp(24px,5vw,38px); font-weight:800; margin-top:8px; }
-.commodity-unit { color:var(--gg-muted); font-size:11px; margin-top:4px; }
-.commodity-card.oil .commodity-value { color:var(--gg-orange); }
-.commodity-card.metal .commodity-value { color:var(--gg-cyan); }
-.pump-grid { grid-template-columns: repeat(2, minmax(0,1fr)); opacity:.86; }
-.pump-card { background:rgba(255,255,255,.03); border:1px solid var(--gg-line); border-radius:6px; padding:12px; }
-.pump-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.14em; font-size:11px; }
-.pump-value { color:var(--gg-yellow); font-size:24px; font-weight:800; margin-top:6px; }
-.trend-panel { background:var(--gg-panel); border:1px solid var(--gg-line); border-radius:6px; padding:14px; margin-top:18px; }
-.trend-controls, .price-history-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px; }
-.trend-controls select, .price-history-actions select, .price-history-actions input { background:#050505; color:var(--gg-cyan); border:1px solid var(--gg-line); padding:8px; font-family:"Courier New", monospace; border-radius:4px; }
-.price-history-actions a, .price-history-actions button { border:1px solid var(--gg-line); border-radius:4px; padding:8px 10px; color:#7fdfff; background:rgba(255,255,255,.03); font-family:"Courier New", monospace; }
-.price-history-date-label { display:flex; gap:6px; align-items:center; color:var(--gg-muted); text-transform:uppercase; letter-spacing:.12em; font-size:11px; }
-#electricity-price-history-panel .price-history-range-status,
-#electricity-price-history-panel .unit-panel,
-#electricity-price-history-panel .price-history-grid,
-#electricity-price-history-panel .price-history-table-toggle { display:none !important; }
-#electricity-price-history-panel .trend-panel { padding:12px; }
-#electricity-price-history-panel .price-history-actions::after { content:"Scrollable Elexon System Price history · select start, period and hour filter · red line marks £0/MWh"; display:block; width:100%; color:var(--gg-muted); font-size:12px; letter-spacing:.08em; text-transform:uppercase; margin-top:4px; }
-#electricity-price-history-panel #price-history-canvas { height: min(76dvh, 760px) !important; min-height:520px !important; width:100% !important; display:block; touch-action: pan-y; }
-#oil-trend-canvas { width:100%; height:300px; display:block; border:1px solid rgba(255,255,255,.05); background:#070a10; touch-action:auto; }
-.oil-chart-wrap { position:relative; }
-.oil-tooltip { position:absolute; display:none; pointer-events:none; background:rgba(5,5,5,.94); border:1px solid var(--gg-cyan); color:var(--gg-text); padding:8px 10px; border-radius:4px; font-size:12px; line-height:1.45; box-shadow:0 0 18px rgba(0,255,255,.12); z-index:5; }
-.oil-stats-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:10px; }
-.oil-stat { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:4px; padding:9px; }
-.oil-stat-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.12em; font-size:10px; }
-.oil-stat-value { color:var(--gg-cyan); font-size:16px; font-weight:800; margin-top:4px; }
-.unit-panel { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:6px; padding:10px 12px; margin-top:10px; color:var(--gg-muted); font-size:12px; line-height:1.5; }
-.unit-panel strong { color:var(--gg-text); }
-.fuel-logic-panel, .ev-panel { border:1px solid var(--gg-line); background:rgba(255,255,255,.03); border-radius:6px; padding:14px; margin-top:14px; color:var(--gg-muted); font-size:13px; line-height:1.55; }
-.fuel-logic-panel strong, .ev-panel strong { color:var(--gg-text); }
-.fuel-source-links { display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; }
-.fuel-source-links a { border:1px solid var(--gg-line); border-radius:4px; padding:7px 9px; color:#7fdfff; }
-.ev-card-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px; }
-.ev-card { border:1px solid var(--gg-line); background:var(--gg-panel); border-radius:6px; padding:12px; }
-.ev-label { color:var(--gg-muted); text-transform:uppercase; letter-spacing:.14em; font-size:11px; }
-.ev-value { color:var(--gg-green); font-size:22px; font-weight:800; margin-top:6px; }
-.scada-credit { font-size:12px; color:var(--gg-muted); margin-top:22px; line-height:1.5; }
-.scada-credit h2 { color:var(--gg-cyan); font-size:20px; letter-spacing:.06em; text-transform:uppercase; }
-.section-title { color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:22px;margin-top:26px; }
-html.v5-chart-open, body.v5-chart-open { overflow:hidden !important; height:100dvh !important; }
-@media (max-width: 850px) { .scada-mix-grid, .commodity-grid, .pump-grid, .ev-card-grid { grid-template-columns:1fr; } .oil-stats-grid { grid-template-columns:1fr 1fr; } #electricity-price-history-panel #price-history-canvas { min-height:560px !important; height:72dvh !important; } }
-@media (orientation: landscape) and (max-height: 520px) {
-  #electricity-price-history-panel #price-history-canvas { height:68dvh !important; min-height:260px !important; }
-  #electricity-price-history-panel .trend-panel { padding:8px !important; }
-  #electricity-price-history-panel .price-history-actions { max-height:none !important; overflow:visible !important; }
-  .price-history-scroller, .price-history-time-tabs { padding:7px 8px !important; margin:7px 0 !important; }
-}
+<link rel="stylesheet" href="/uk_energy_tracking_v6/styles/app.css?v=20260530o">
 
-#electricity-price-history-panel .gg-machine-note {
-  border: 1px solid rgba(255,255,255,.10);
-  background: rgba(255,255,255,.018);
-  color: var(--gg-muted);
-  font-size: 10.5px;
-  line-height: 1.45;
-  letter-spacing: .04em;
-  padding: 8px 10px;
-  margin: 8px 0 10px;
-  border-radius: 5px;
-}
-#electricity-price-history-panel .gg-machine-note strong {
-  color: var(--gg-cyan);
-  text-transform: uppercase;
-  letter-spacing: .10em;
-  display: block;
-  margin-bottom: 4px;
-}
-#electricity-price-history-panel .gg-machine-note span {
-  display: block;
-}
-#electricity-price-history-panel .gg-machine-note b {
-  color: var(--gg-text);
-}
-
-</style>
-
-<div class="scada-grid" id="scada-grid">
+<div class="scada-grid v6-app" id="scada-grid">
   <header class="scada-hero">
-    <div class="scada-subtitle">GLOBALGRID2050 · UK LIVE GRID TRACKER V5</div>
+    <div class="scada-subtitle">GLOBALGRID2050 · UK LIVE GRID TRACKER V6</div>
     <h1 class="scada-title">GB Electricity, Price, Carbon, Oil and Transport Energy Monitor</h1>
     <div class="scada-title-rule"></div>
     <div class="scada-live-row">
@@ -128,50 +21,63 @@
     </div>
   </header>
 
-  <p class="scada-intro scada-dev-note"><strong>V5 experimental clone.</strong> Original tracker remains protected at /uk_energy_tracking/. This page uses isolated V5 feeds for development, transport energy and price history testing.</p>
-
-  <p class="scada-intro">Near real time GB electricity demand, market price, carbon intensity and generation mix. Generation mix refreshes every 5 minutes; price and carbon update every half hour at their native cadence. Commodity prices update daily through GridBot.</p>
+  <p class="scada-intro scada-dev-note"><strong>V6 modular development build.</strong> V5 remains the protected reference while this page runs the same tracker through modular V6 files.</p>
 
   <div id="scada-status" class="scada-status stale">Awaiting live feed.</div>
 
-  <section class="scada-gauges">
-    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Demand</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="demand"></svg></div>
-    <div class="scada-gauge-card"><div class="scada-gauge-title">Electricity Price</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="price"></svg></div>
-    <div class="scada-gauge-card"><div class="scada-gauge-title">Carbon Intensity</div><svg class="scada-gauge" viewBox="0 0 220 140" data-gauge="carbon"></svg></div>
+  <section class="scada-live-summary" id="live-electricity-snapshot">
+    <div class="scada-summary-title">Live electricity snapshot</div>
+    <div class="scada-summary-grid">
+      <div><span>Demand</span><strong id="summary-demand">—</strong><em>GW</em></div>
+      <div><span>Price</span><strong id="summary-price">—</strong><em>£/MWh</em></div>
+      <div><span>Carbon</span><strong id="summary-carbon">—</strong><em>g/kWh</em></div>
+    </div>
+    <div class="scada-summary-time" id="summary-timestamps">Awaiting V6 live data.</div>
   </section>
 
   <section>
     <h2 class="section-title">Generation Mix</h2>
-    <div id="scada-mix" class="scada-mix-grid"></div>
+    <div id="generation-mix-grid" class="scada-mix-grid"></div>
   </section>
 
   <section id="electricity-price-history-panel">
     <h2 class="section-title">Electricity Price History</h2>
     <div class="trend-panel">
       <div class="price-history-actions">
-        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Electricity Price History £/MWh</strong>
+        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Electricity half hourly settlement price in GBP (£) per MWh</strong>
         <label class="price-history-date-label">Year <select id="price-history-year"></select></label>
         <label class="price-history-date-label">Start <input type="date" id="price-history-start"></label>
         <label class="price-history-date-label">Period <select id="price-history-period">
+          <option value="12hday">12 hours day</option>
+          <option value="12hnight">12 hours night</option>
+          <option value="1d">1 day</option>
           <option value="7d" selected>1 week</option>
           <option value="30d">1 month</option>
           <option value="3m">3 months</option>
+          <option value="6m">6 months</option>
+          <option value="12m">12 months</option>
+          <option value="5y">5 years</option>
+          <option value="10y">10 years</option>
         </select></label>
-        
-        <a href="/uk_energy_tracking_v5/electricity_price_history.csv" download>Download CSV</a>
+        <a href="/uk_energy_tracking_v6/electricity_price_history.csv" download>Download CSV</a>
         <button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>
+        <button type="button" id="price-history-refresh">Refresh chart</button>
       </div>
       <div id="price-history-range-status" class="price-history-range-status">Selected range will appear here.</div>
       <div class="unit-panel"><strong>Unit:</strong> pounds per Megawatt hour. Select a year, a start date and a period. The chart automatically loads the required Elexon annual CSV file and calculates the end date. The red line marks £0/MWh.</div>
-      
       <div class="gg-machine-note">
         <strong>Grid intelligence machine:</strong>
         <span><b>Inputs:</b> Elexon prices, live demand, carbon data, oil and fuel data, time windows, day and night filters.</span>
-        <span><b>Mechanism:</b> lazy loading, event detection, high and low marker logic, date windowing, chart rendering, mobile full screen controls.</span>
+        <span><b>Mechanism:</b> lazy loading, event detection, high and low marker logic, date windowing, chart rendering, mobile full screen controls, indicative 7 day seasonal baseline.</span>
         <span><b>Outputs:</b> price volatility insight, peak and trough timing, market spread visibility, battery opportunity signals, future circuit sizing logic.</span>
       </div>
-
-<canvas id="price-history-canvas" width="900" height="720"></canvas>
+      <canvas id="price-history-canvas" width="900" height="720"></canvas>
+      <details id="price-history-discovery" class="price-history-discovery">
+        <summary>What does this Elexon price mean?</summary>
+        <p><strong>Interpretation:</strong> this is an Elexon System Price / imbalance price signal used in GB electricity settlement. It is not a retail tariff and it is not a simple consumer wholesale bill.</p>
+        <p><strong>Market meaning:</strong> it reflects the marginal stress or surplus cost of balancing the power system in each settlement period. It can correlate with wholesale spot prices, but it is a balancing and settlement signal rather than a pure day ahead or intraday merchant price.</p>
+        <p><strong>Forecast baseline:</strong> the dashed line is an indicative 7 day seasonal baseline calculated from historic Elexon price behaviour and shown only for the next week. It does not include weather, gas prices, outages, interconnector events, policy changes or market shocks. It is not financial advice, not trading advice and not an AI prediction.</p>
+      </details>
       <div class="price-history-grid">
         <div class="price-history-card"><div class="price-history-label">Latest visible price</div><div class="price-history-value" id="ph-latest-price">—</div></div>
         <div class="price-history-card"><div class="price-history-label">Settlement time</div><div class="price-history-value" id="ph-latest-time">—</div></div>
@@ -198,80 +104,34 @@
       <div class="commodity-card metal"><div class="commodity-label">Copper</div><div class="commodity-value" id="copper-price">—</div><div class="commodity-unit">US dollars per tonne (USD/t)</div></div>
       <div class="commodity-card metal"><div class="commodity-label">Aluminium</div><div class="commodity-value" id="aluminium-price">—</div><div class="commodity-unit">US dollars per tonne (USD/t)</div></div>
     </div>
-    <div class="trend-panel">
-      <div class="trend-controls">
-        <strong style="color:#00ffff;letter-spacing:.12em;text-transform:uppercase;">Oil Price Trend</strong>
-        <select id="oil-range">
-          <option value="7d">1 week</option>
-          <option value="1m">1 month</option>
-          <option value="3m">3 months</option>
-          <option value="6m">6 months</option>
-          <option value="9m">9 months</option>
-          <option value="1y">1 year</option>
-          <option value="5y">5 years</option>
-          <option value="10y">10 years</option>
-          <option value="25y" selected>25 years</option>
-        </select>
-      </div>
-      <div class="unit-panel"><strong>Unit:</strong> USD per barrel (USD/bbl). Touch or move across the graph to inspect date, Brent and WTI values.</div>
-      <div class="oil-chart-wrap"><canvas id="oil-trend-canvas" width="900" height="300"></canvas><div id="oil-tooltip" class="oil-tooltip"></div></div>
-      <div id="oil-stats" class="oil-stats-grid"></div>
-    </div>
-  </section>
-
-  <section>
-    <h2 class="section-title" style="font-size:18px;color:#a6adbb;">Road Fuel & EV Charging</h2>
-    <div class="pump-grid">
-      <div class="pump-card"><div class="pump-label">Petrol</div><div class="pump-value" id="petrol-price">—</div><div class="commodity-unit">DESNZ weekly average, pence per litre</div></div>
-      <div class="pump-card"><div class="pump-label">Diesel</div><div class="pump-value" id="diesel-price">—</div><div class="commodity-unit">DESNZ weekly average, pence per litre</div></div>
-    </div>
-    <div class="fuel-logic-panel">
-      <strong>Road fuel price logic:</strong> Brent crude is quoted in US dollars per barrel. A rough product cost proxy converts USD per barrel into GBP per litre by applying an FX assumption and dividing by about 159 litres per barrel. UK pump prices then add refining spread, wholesale margin, logistics, retail margin, fuel duty and VAT.
-      <div id="fuel-breakdown" style="margin-top:10px;">Awaiting DESNZ fuel price feed.</div>
-      <div class="fuel-source-links">
-        <a href="https://www.gov.uk/government/statistics/weekly-road-fuel-prices" target="_blank" rel="noopener noreferrer">DESNZ weekly road fuel prices</a>
-        <a href="https://www.gov.uk/tax-on-shopping/fuel-duty" target="_blank" rel="noopener noreferrer">GOV.UK fuel duty</a>
-        <a href="https://www.gov.uk/vat-rates" target="_blank" rel="noopener noreferrer">GOV.UK VAT rates</a>
-      </div>
-    </div>
-    <div class="ev-panel">
-      <strong>EV charging comparison placeholder:</strong> Public EV tariffs will be compared with petrol, diesel, wholesale electricity and operator tariff data. The Atlas V8 reference is embedded below while the exact EV charging layer path is verified.
-      <div class="ev-card-grid">
-        <div class="ev-card"><div class="ev-label">Rapid charging average</div><div class="ev-value" id="ev-rapid-price">—</div><div class="commodity-unit">pence per kilowatt hour</div></div>
-        <div class="ev-card"><div class="ev-label">Ultra rapid average</div><div class="ev-value" id="ev-ultra-price">—</div><div class="commodity-unit">pence per kilowatt hour</div></div>
-      </div>
-    </div>
   </section>
 
   <section class="scada-credit">
     <h2>Data sources & attribution</h2>
-    <p>This tracker uses free public sources. We gratefully acknowledge them:</p>
... diff truncated after 260 lines ...
```

### `uk_energy_tracking_v5/price-history-ui.css` versus `uk_energy_tracking_v6/styles/app.css`

```diff
--- uk_energy_tracking_v5/price-history-ui.css
+++ uk_energy_tracking_v6/styles/app.css
@@ -1,228 +1,119 @@
-#electricity-price-history-panel,
-#electricity-price-history-panel * {
-  box-sizing: border-box;
+:root{
+  --gg-bg:#050505;
+  --gg-panel:#0b0f17;
+  --gg-line:#252b36;
+  --gg-text:#f5f7fb;
+  --gg-muted:#9aa3b6;
+  --gg-cyan:#00ffff;
+  --gg-magenta:#ff00e6;
+  --gg-green:#00ff88;
+  --gg-yellow:#ffcc00;
+  --gg-orange:#ff9900;
+  --gg-red:#ff4444;
 }
 
-#electricity-price-history-panel {
-  width: 100%;
-  max-width: 100%;
-  overflow: hidden;
+body{background:var(--gg-bg)!important;color:var(--gg-text)!important;}
+a{color:#7fdfff;}
+.page-content,.wrapper,main{background:var(--gg-bg)!important;color:var(--gg-text)!important;}
+.scada-grid,.v6-app{font-family:"Courier New",monospace;max-width:1280px;margin:0 auto;}
+.scada-hero{border-bottom:1px solid var(--gg-line);padding:18px 0 12px;margin-bottom:18px;}
+.scada-subtitle{letter-spacing:.28em;color:var(--gg-muted);font-size:14px;text-transform:uppercase;}
+.scada-title{margin:10px 0 8px;color:var(--gg-text);font-size:clamp(28px,5vw,44px);line-height:1.1;font-weight:800;}
+.scada-title-rule{height:1px;background:var(--gg-text);opacity:.75;margin:12px 0 0;}
+.scada-live-row,.scada-live-pill,.scada-update-panel,.scada-intro,.scada-dev-note,.scada-status,.scada-gauges{display:none!important;}
+
+.scada-live-summary{border:1px solid var(--gg-cyan);background:rgba(0,255,255,.04);border-radius:6px;padding:18px 16px;margin:18px 0 24px;box-shadow:0 0 18px rgba(0,255,255,.08);font-family:"Courier New",monospace;}
+.scada-summary-title{color:var(--gg-cyan);text-transform:uppercase;letter-spacing:.16em;font-size:13px;margin-bottom:16px;text-align:center;}
+.scada-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;}
+.scada-summary-grid div{border:1px solid var(--gg-line);background:rgba(255,255,255,.025);border-radius:4px;padding:14px 12px;text-align:center;}
+.scada-summary-grid span{display:block;color:var(--gg-muted);text-transform:uppercase;letter-spacing:.14em;font-size:10px;margin-bottom:8px;}
+.scada-summary-grid strong{display:inline-block;color:var(--gg-text);font-size:clamp(28px,5vw,46px);line-height:1.05;margin-right:6px;}
+.scada-summary-grid em{font-style:normal;color:var(--gg-muted);font-size:13px;}
+.scada-summary-time{margin-top:14px;color:var(--gg-muted);font-size:11px;line-height:1.45;text-align:center;}
+
+.scada-mix-grid,.commodity-grid,.pump-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:18px;}
+.scada-mini{background:var(--gg-panel);border:1px solid var(--gg-line);border-radius:6px;padding:12px 12px 10px;}
+.scada-mini-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline;}
+.scada-mini-name{color:var(--gg-text);text-transform:uppercase;letter-spacing:.12em;font-size:12px;}
+.scada-mini-value{color:var(--gg-cyan);font-size:13px;white-space:nowrap;}
+.scada-mini-track{height:8px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:10px;}
+.scada-mini-fill{height:100%;border-radius:5px;transition:width .6s ease;}
+
+.commodity-card{background:var(--gg-panel);border:1px solid var(--gg-line);border-radius:6px;padding:14px;}
+.commodity-label{color:var(--gg-muted);text-transform:uppercase;letter-spacing:.16em;font-size:12px;}
+.commodity-value{color:var(--gg-text);font-size:clamp(24px,5vw,38px);font-weight:800;margin-top:8px;}
+.commodity-unit{color:var(--gg-muted);font-size:11px;margin-top:4px;}
+.commodity-card.oil .commodity-value{color:var(--gg-orange);}
+.commodity-card.metal .commodity-value{color:var(--gg-cyan);}
+
+.section-title{color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:22px;margin-top:26px;}
+.trend-panel{background:var(--gg-panel);border:1px solid var(--gg-line);border-radius:6px;padding:14px;margin-top:18px;}
+.price-history-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
+.price-history-actions select,.price-history-actions input{background:#050505;color:var(--gg-cyan);border:1px solid var(--gg-line);padding:8px;font-family:"Courier New",monospace;border-radius:4px;}
+.price-history-actions a,.price-history-actions button,.price-history-chart-nav button{border:1px solid var(--gg-line);border-radius:4px;padding:8px 11px;color:#00ffff;background:rgba(0,255,255,.05);font-family:"Courier New",monospace;cursor:pointer;}
+.price-history-date-label{display:flex;gap:6px;align-items:center;color:var(--gg-muted);text-transform:uppercase;letter-spacing:.12em;font-size:11px;}
+
+#electricity-price-history-panel .price-history-range-status,
+#electricity-price-history-panel .unit-panel,
+#electricity-price-history-panel .price-history-grid,
+#electricity-price-history-panel .price-history-table-toggle{display:none!important;}
+#electricity-price-history-panel .trend-panel{padding:12px;width:100%;max-width:100%;overflow:hidden;background:#070a10!important;border:1px solid #252b36!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 0 22px rgba(0,255,255,.05);}
+#electricity-price-history-panel .price-history-actions::after{content:"Elexon System Price history · select start, period and hour filter · red markers show high and low";display:block;width:100%;color:var(--gg-muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}
+#electricity-price-history-panel #price-history-canvas{height:min(76dvh,760px)!important;min-height:520px!important;width:100%!important;display:block;touch-action:pan-y;background:#05070c!important;border:1px solid rgba(255,255,255,.06);border-radius:6px;}
+
+.gg-machine-note{border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.018);color:var(--gg-muted);font-size:10.5px;line-height:1.45;letter-spacing:.04em;padding:8px 10px;margin:8px 0 10px;border-radius:5px;}
+.gg-machine-note strong{color:var(--gg-cyan);text-transform:uppercase;letter-spacing:.10em;display:block;margin-bottom:4px;}
+.gg-machine-note span{display:block;}
+.gg-machine-note b{color:var(--gg-text);}
+
+.price-history-scroller{display:none!important;}
+.price-history-time-tabs,.price-history-chart-nav{width:100%;border:1px solid var(--gg-line);background:rgba(255,255,255,.025);border-radius:6px;padding:10px 12px;margin:10px 0;box-sizing:border-box;}
+.price-history-time-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--gg-muted);font:11px "Courier New",monospace;text-transform:uppercase;letter-spacing:.08em;}
+.price-history-time-tabs button.active{background:rgba(0,255,255,.18);box-shadow:0 0 10px rgba(0,255,255,.12);}
+.price-history-chart-nav{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:rgba(0,255,255,.025);}
+.price-history-chart-nav button{min-height:42px;font-size:13px;letter-spacing:.04em;}
+
+.price-history-discovery{border:1px solid rgba(0,255,255,.28);background:rgba(0,255,255,.035);border-radius:6px;padding:10px 12px;margin:10px 0;color:#9aa3b6;font:12px "Courier New",monospace;line-height:1.55;}
+.price-history-discovery summary{cursor:pointer;color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-weight:800;}
+.price-history-discovery strong{color:#f5f7fb;}
+.price-history-discovery p{margin:8px 0 0;}
+
+.scada-credit{font-size:12px;color:var(--gg-muted);margin-top:22px;line-height:1.5;}
+.scada-credit h2{color:var(--gg-cyan);font-size:20px;letter-spacing:.06em;text-transform:uppercase;}
+
+html.v5-chart-open,body.v5-chart-open{overflow:hidden!important;height:100dvh!important;}
+.price-history-fullscreen-btn{border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;color:#00ffff!important;background:rgba(0,255,255,.05)!important;font-family:"Courier New",monospace;cursor:pointer;}
+.price-history-fullscreen-overlay{position:fixed;inset:0;display:none;z-index:9999;background:#000;padding:0;box-sizing:border-box;overflow:hidden;}
+.price-history-fullscreen-overlay.open{display:flex;}
+.price-history-fullscreen-shell{position:relative;width:100vw;height:100dvh;min-height:0;border:0;background:#05070c;box-shadow:none;display:flex;flex-direction:column;overflow:hidden;transform:translateZ(0);will-change:transform;}
+.price-history-fullscreen-toolbar{position:absolute;z-index:4;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));height:34px;display:flex;align-items:center;gap:8px;padding:0 4px;background:rgba(0,0,0,.34);backdrop-filter:blur(4px);color:#f5f7fb;font-family:"Courier New",monospace;pointer-events:none;}
+.price-history-fullscreen-toolbar strong{color:#00ffff;text-transform:uppercase;letter-spacing:.14em;font-size:12px;white-space:nowrap;}
+.price-history-fullscreen-toolbar span{display:none!important;}
+.price-history-fullscreen-toolbar button{margin-left:auto;pointer-events:auto;border:1px solid rgba(0,255,255,.22);border-radius:50%;width:34px;height:34px;color:#00ffff;background:rgba(0,255,255,.05);font:24px/1 "Courier New",monospace;cursor:pointer;}
+.price-history-fullscreen-arrow{position:absolute;z-index:5;top:50%;transform:translateY(-50%);width:42px;height:72px;border:0;border-radius:999px;color:#00ffff;background:rgba(0,0,0,.18);font:42px/1 "Courier New",monospace;cursor:pointer;text-shadow:0 0 10px rgba(0,255,255,.65);opacity:.72;}
+.price-history-fullscreen-arrow-left{left:max(6px,env(safe-area-inset-left));}
+.price-history-fullscreen-arrow-right{right:max(6px,env(safe-area-inset-right));}
+.price-history-fullscreen-arrow:active{background:rgba(0,255,255,.10);opacity:1;}
+#price-history-fullscreen-canvas{width:100vw;height:100dvh;min-height:0;flex:1 1 auto;display:block;background:#05070c;touch-action:none;transform:translateZ(0);will-change:transform;}
+.price-history-fullscreen-note{display:none!important;}
+
+@media(max-width:850px){
+  .scada-summary-grid,.scada-mix-grid,.commodity-grid,.pump-grid{grid-template-columns:1fr;}
+  #electricity-price-history-panel #price-history-canvas{min-height:580px!important;height:74dvh!important;}
+  .price-history-chart-nav{grid-template-columns:1fr;}
+  .price-history-time-tabs,.price-history-chart-nav{padding:9px!important;}
+  .price-history-chart-nav button{min-height:44px;}
 }
 
-#electricity-price-history-panel .trend-panel {
-  width: 100%;
-  max-width: 100%;
-  overflow: hidden;
-  background: #070a10 !important;
-  border: 1px solid #252b36 !important;
-  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 22px rgba(0,255,255,.05);
+@media(orientation:landscape){
+  .price-history-fullscreen-toolbar{height:30px;}
+  .price-history-fullscreen-toolbar strong{font-size:11px;}
+  .price-history-fullscreen-toolbar button{width:30px;height:30px;font-size:21px;}
+  .price-history-fullscreen-arrow{width:54px;height:54px;font-size:38px;}
 }
 
-#electricity-price-history-panel .price-history-actions {
-  display: flex;
-  flex-wrap: wrap;
-  gap: 10px;
-  align-items: center;
-  margin-bottom: 10px;
+@media(orientation:landscape) and (max-height:520px){
+  #electricity-price-history-panel #price-history-canvas{height:68dvh!important;min-height:260px!important;}
+  #electricity-price-history-panel .trend-panel{padding:8px!important;}
+  .price-history-time-tabs,.price-history-chart-nav{padding:7px 8px!important;margin:7px 0!important;}
 }
-
-#electricity-price-history-panel .price-history-actions strong {
-  color: #00ffff !important;
-  letter-spacing: .12em;
-  text-transform: uppercase;
-}
-
-#electricity-price-history-panel .price-history-actions select {
-  background: #050505 !important;
-  color: #00ffff !important;
-  border: 1px solid #252b36 !important;
-  border-radius: 4px;
-  padding: 7px 9px;
-  font-family: "Courier New", monospace;
-}
-
-#electricity-price-history-panel .price-history-actions a {
-  border: 1px solid #252b36 !important;
-  border-radius: 4px;
-  padding: 7px 9px;
-  color: #7fdfff !important;
-  text-decoration: none !important;
-  background: rgba(255,255,255,.03) !important;
-}
-
-#electricity-price-history-panel #price-history-canvas {
-  width: 100% !important;
-  max-width: 100% !important;
-  height: clamp(230px, 34vw, 340px) !important;
-  display: block;
-  border: 1px solid #252b36 !important;
-  background: #05070c !important;
-  border-radius: 6px;
-  touch-action: none;
-  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
-}
-
-#electricity-price-history-panel .price-history-grid {
-  display: grid;
-  grid-template-columns: repeat(4,minmax(0,1fr));
-  gap: 10px;
-  margin-top: 12px;
-}
-
-#electricity-price-history-panel .price-history-card {
-  border: 1px solid #252b36 !important;
-  background: #0b0f17 !important;
-  border-radius: 6px;
-  padding: 12px;
-  min-width: 0;
-  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
-}
-
-#electricity-price-history-panel .price-history-label {
-  color: #9aa3b6 !important;
-  text-transform: uppercase;
-  letter-spacing: .12em;
-  font-size: 10px;
-}
-
-#electricity-price-history-panel .price-history-value {
-  color: #00ffff !important;
-  font-size: 18px;
-  font-weight: 800;
-  margin-top: 5px;
-  overflow-wrap: anywhere;
-}
-
-#electricity-price-history-panel .price-history-table-toggle {
-  margin-top: 12px;
-  border: 1px solid #252b36 !important;
-  border-radius: 6px;
-  background: #0b0f17 !important;
-  overflow: hidden;
-}
-
-#electricity-price-history-panel .price-history-table-toggle summary {
-  cursor: pointer;
-  list-style: none;
-  padding: 10px 12px;
-  color: #00ffff !important;
-  background: #05070c !important;
-  text-transform: uppercase;
-  letter-spacing: .1em;
-  font-size: 11px;
-  border-bottom: 1px solid #252b36 !important;
-}
-
-#electricity-price-history-panel .price-history-table-toggle summary::-webkit-details-marker {
-  display: none;
-}
-
-#electricity-price-history-panel .price-history-table-toggle summary::after {
-  content: "Open";
-  float: right;
-  color: #9aa3b6;
-  letter-spacing: .08em;
-}
-
-#electricity-price-history-panel .price-history-table-toggle[open] summary::after {
-  content: "Close";
-}
-
-#electricity-price-history-panel .price-history-table-wrap {
-  overflow-x: auto;
-  overflow-y: auto;
-  border: 0 !important;
-  border-radius: 0;
-  margin-top: 0;
-  max-height: 320px;
-  max-width: 100%;
-  background: #070a10 !important;
-  box-shadow: inset 0 0 0 1px rgba(255,255,255,.02);
-}
-
-#electricity-price-history-panel table.price-history-table {
-  width: 100%;
-  min-width: 760px;
... diff truncated after 260 lines ...
```

### `uk_energy_tracking_v5/price-history-ui.js` versus `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`

```diff
--- uk_energy_tracking_v5/price-history-ui.js
+++ uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js
@@ -1,78 +1,31 @@
-(function(){
-var JSON_URL='/uk_energy_tracking_v5/electricity_price_history.json';
-var DAILY_URL='/uk_energy_tracking_v5/electricity_price_history_daily_decade.json';
-var DAILY_FALLBACK_URL='/uk_energy_tracking_v5/electricity_price_history_4bucket_decade.json';
-var ANNUAL_URL_BASE='/data/electricity/elexon_system_prices_';
-var FIRST_YEAR=2016;
-var MIN_DATE=new Date(Date.UTC(FIRST_YEAR,0,1,0,0,0));
-var TODAY=new Date();
-var MAX_DATE=new Date(Date.UTC(TODAY.getUTCFullYear(),TODAY.getUTCMonth(),TODAY.getUTCDate(),23,59,59));
-var ANNUAL_CACHE={}, DAILY_CACHE=null, CAPTURE_CACHE=null;
-var pendingTimer=null;
-var STATE={all:[],visible:[],meta:null,loadedYears:[],sourceRows:0,timeMode:'all',mode:'halfhourly'};
-window.__v5PriceHistoryState=STATE;
-function $(id){return document.getElementById(id)}
-function fmt(n,d){return n==null||isNaN(n)?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
-function pence(n){return n==null||isNaN(n)?'—':fmt(Number(n)/10,2)}
-function dlab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
-function slab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
-function tlab(t){return new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
-function axisLabel(t,span){return span<=45*86400000?slab(t):new Date(t).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
-function ymd(d){return d.toISOString().slice(0,10)}
-function set(id,v){var e=$(id);if(e)e.textContent=v}
-function timeModeLabel(){if(STATE.timeMode==='day')return 'Day 06 to 18 UTC';if(STATE.timeMode==='night')return 'Night 18 to 06 UTC';return 'All hours'}
-function csvLine(l){var o=[],v='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){o.push(v);v=''}else v+=c}o.push(v);return o}
-function parseCsv(t){t=(t||'').trim();if(!t)return[];var lines=t.split(/\r?\n/),h=csvLine(lines[0]).map(function(x){return x.trim()});return lines.slice(1).map(function(line){var c=csvLine(line),r={};h.forEach(function(x,i){r[x]=(c[i]||'').trim()});var p=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{source:r.source||'Elexon BMRS System Prices',priceTimeUTC:r.periodStartUTC||r.priceTimeUTC||'',capturedAtUTC:r.fetchedAtUTC||r.capturedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:p,carbonGperKWh:r.carbonGperKWh||'',carbonIndex:r.carbonIndex||'',priceHealth:r.priceHealth||'historical system price',carbonHealth:r.carbonHealth||'',netImbalanceVolumeMWh:r.netImbalanceVolumeMWh||''}}).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))})}
-function loadJson(){if(CAPTURE_CACHE)return CAPTURE_CACHE;CAPTURE_CACHE=fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return CAPTURE_CACHE}
-function loadAnnual(year){if(ANNUAL_CACHE[year])return ANNUAL_CACHE[year];ANNUAL_CACHE[year]=fetch(ANNUAL_URL_BASE+year+'.csv?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(parseCsv).catch(function(){return[]});return ANNUAL_CACHE[year]}
-function convert4Bucket(d){return (d.rows||[]).map(function(r){var vals=[r.night,r.morning,r.midday,r.evening].filter(function(v){return v!=null&&!isNaN(Number(v))}).map(Number);return{date:r.date,average:vals.length?Number((vals.reduce(function(a,b){return a+b},0)/vals.length).toFixed(2)):null,high:r.peakPrice!=null?Number(r.peakPrice):(vals.length?Math.max.apply(null,vals):null),highAt:r.peakAt||'',low:vals.length?Math.min.apply(null,vals):null,lowAt:'',observations:r.observations||0}})}
-function loadDaily(){if(DAILY_CACHE)return DAILY_CACHE;DAILY_CACHE=fetch(DAILY_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('daily missing');return r.json()}).then(function(d){return d.rows||[]}).catch(function(){return fetch(DAILY_FALLBACK_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(convert4Bucket).catch(function(){return[]})});return DAILY_CACHE}
-function yearsBetween(a,b){var y=[],s=a.getUTCFullYear(),e=b.getUTCFullYear();for(var n=s;n<=e;n++)y.push(n);return y}
-function norm(rows){var seen={};return(rows||[]).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))}).map(function(r){var o=Object.assign({},r);o.priceGBPperMWh=Number(o.priceGBPperMWh);return o}).sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)}).filter(function(r){var k=r.priceTimeUTC+'|'+r.priceGBPperMWh+'|'+(r.source||'');if(seen[k])return false;seen[k]=1;return true})}
-function merge(sys,cap){var rows=[];sys.forEach(function(r){rows.push(Object.assign({},r,{source:'Elexon BMRS System Prices',priceHealth:r.priceHealth||'historical system price'}))});cap.forEach(function(r){rows.push(Object.assign({},r,{source:r.source||'V5 captured Elexon Market Index Price'}))});return norm(rows)}
-function periodDays(period){return {'12hday':0.5,'12hnight':0.5,'1d':1,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[period]||7}
-function periodLabel(period){return {'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','5y':'5 years','10y':'10 years'}[period]||'1 week'}
-function isDailyPeriod(p){return ['6m','12m','5y','10y'].indexOf(p)>=0}
-function isDayNightPeriod(p){return p==='12hday'||p==='12hnight'}
-function totalScrollableDays(){return Math.max(1,Math.floor((MAX_DATE-MIN_DATE)/86400000))}
-function dateFromOffset(v){var d=new Date(MIN_DATE.getTime()+Number(v)*86400000);d.setUTCHours(0,0,0,0);return d}
-function offsetFromDate(d){return Math.max(0,Math.min(totalScrollableDays(),Math.floor((d-MIN_DATE)/86400000)))}
-function ensurePeriodOptions(){var p=$('price-history-period');if(!p)return;var wanted=[['12hday','12 hours day'],['12hnight','12 hours night'],['1d','1 day'],['7d','1 week'],['30d','1 month'],['3m','3 months'],['6m','6 months'],['12m','12 months'],['5y','5 years'],['10y','10 years']];var current=p.value||'7d';p.innerHTML='';wanted.forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];p.appendChild(o)});p.value=current&&wanted.some(function(x){return x[0]===current})?current:'7d'}
-function ensureModeTabs(){if($('price-history-time-tabs'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var tabs=document.createElement('div');tabs.id='price-history-time-tabs';tabs.className='price-history-time-tabs';tabs.innerHTML='<span>Hour filter</span><button type="button" data-mode="all" class="active">All</button><button type="button" data-mode="day">Day</button><button type="button" data-mode="night">Night</button>';actions.appendChild(tabs);tabs.addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;STATE.timeMode=b.getAttribute('data-mode');tabs.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});load()})}
-function ensureScroller(){if($('price-history-scroll'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var wrap=document.createElement('div');wrap.className='price-history-scroller';wrap.innerHTML='<div class="price-history-scroller-head"><strong>History scroller</strong><span id="price-history-scroll-label">1 day, 1 week, 1 month and 3 months use full settlement data. 6 months and longer use daily high, low and average.</span></div><div class="price-history-scroll-row"><button type="button" id="price-history-prev">◀</button><input id="price-history-scroll" type="range" min="0" max="'+totalScrollableDays()+'" step="1"><button type="button" id="price-history-next">▶</button></div>';actions.parentNode.insertBefore(wrap,actions.nextSibling);var style=document.createElement('style');style.textContent='.price-history-scroller,.price-history-time-tabs{width:100%;border:1px solid var(--gg-line,#252b36);background:rgba(255,255,255,.025);border-radius:6px;padding:10px 12px;margin:10px 0}.price-history-scroller-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--gg-muted,#9aa3b6);font:11px Courier New,monospace;letter-spacing:.08em;text-transform:uppercase}.price-history-scroller-head strong{color:var(--gg-cyan,#00ffff)}.price-history-scroll-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-top:8px}.price-history-scroll-row button,.price-history-time-tabs button{border:1px solid var(--gg-line,#252b36);border-radius:4px;background:rgba(0,255,255,.05);color:#00ffff;padding:7px 10px;font-family:Courier New,monospace}.price-history-time-tabs button.active{background:rgba(0,255,255,.18);box-shadow:0 0 10px rgba(0,255,255,.12)}.price-history-time-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--gg-muted,#9aa3b6);font:11px Courier New,monospace;text-transform:uppercase;letter-spacing:.08em}.price-history-scroll-row input[type=range]{width:100%;accent-color:#00ffff}.price-history-device-note{color:#ff9900!important}.price-history-discovery{border:1px solid rgba(0,255,255,.28);background:rgba(0,255,255,.035);border-radius:6px;padding:10px 12px;margin:10px 0;color:#9aa3b6;font:12px Courier New,monospace;line-height:1.55}.price-history-discovery summary{cursor:pointer;color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.price-history-discovery strong{color:#f5f7fb}.price-history-discovery p{margin:8px 0 0}';document.head.appendChild(style)}
-function ensureDiscoveryPanel(){if($('price-history-discovery'))return;var canvas=$('price-history-canvas');if(!canvas||!canvas.parentNode)return;var d=document.createElement('details');d.id='price-history-discovery';d.className='price-history-discovery';d.innerHTML='<summary>What does this Elexon price mean?</summary><p><strong>Interpretation:</strong> this is an Elexon System Price / imbalance price signal used in GB electricity settlement. It is not a retail tariff and it is not a simple consumer wholesale bill.</p><p><strong>Market meaning:</strong> it reflects the marginal stress or surplus cost of balancing the power system in each settlement period. It can correlate with wholesale spot prices, but it is a balancing and settlement signal rather than a pure day ahead or intraday merchant price.</p><p><strong>How to read the chart:</strong> p/kWh values are indicative equivalents for human intuition. The formal unit remains £/MWh. High, average and low boxes expose volatility, storage opportunity and system stress.</p>';canvas.parentNode.insertBefore(d,canvas)}
-function ensureYearOptions(){var y=$('price-history-year');if(!y||y.options.length)return;var nowYear=MAX_DATE.getUTCFullYear();for(var n=nowYear;n>=FIRST_YEAR;n--){var o=document.createElement('option');o.value=String(n);o.textContent=String(n);y.appendChild(o)}y.value=String(nowYear)}
-function ensureStartDate(){var y=$('price-history-year'),s=$('price-history-start');if(!s)return;var selectedYear=y&&y.value?Number(y.value):MAX_DATE.getUTCFullYear();if(!s.value||s.value.slice(0,4)!==String(selectedYear)){var start;if(selectedYear===MAX_DATE.getUTCFullYear()){start=new Date(MAX_DATE.getTime()-7*86400000)}else{start=new Date(Date.UTC(selectedYear,0,1,0,0,0))}s.value=ymd(start)}syncScrollerFromStart()}
-function syncScrollerFromStart(){var s=$('price-history-start'),r=$('price-history-scroll');if(!s||!r||!s.value)return;r.value=String(offsetFromDate(new Date(s.value+'T00:00:00Z')))}
-function syncStartFromScroller(){var r=$('price-history-scroll'),s=$('price-history-start'),y=$('price-history-year');if(!r||!s)return;var d=dateFromOffset(r.value);s.value=ymd(d);if(y)y.value=String(d.getUTCFullYear())}
-function selectedWindow(){ensureStartDate();var y=$('price-history-year'),s=$('price-history-start'),p=$('price-history-period');var year=y&&y.value?Number(y.value):MAX_DATE.getUTCFullYear();var period=p&&p.value?p.value:'7d';var start=s&&s.value?new Date(s.value+'T00:00:00Z'):new Date(Date.UTC(year,0,1,0,0,0));if(isNaN(start))start=new Date(Date.UTC(year,0,1,0,0,0));if(isDayNightPeriod(period)){start.setUTCHours(period==='12hday'?6:18,0,0,0)}if(start<MIN_DATE)start=new Date(MIN_DATE);if(start>MAX_DATE)start=new Date(MAX_DATE);if(s)s.value=ymd(start);if(y)y.value=String(start.getUTCFullYear());var days=periodDays(period);var end=new Date(start.getTime()+days*86400000-1000);if(end>MAX_DATE)end=new Date(MAX_DATE);return{start:start,end:end,label:start.getUTCFullYear()+' '+period,period:period,year:start.getUTCFullYear(),capped:false,timeMode:STATE.timeMode,mode:isDailyPeriod(period)?'daily':'halfhourly'}}
-function passesTimeMode(r){if(STATE.timeMode==='all')return true;var h=new Date(r.priceTimeUTC).getUTCHours();var day=h>=6&&h<18;return STATE.timeMode==='day'?day:!day}
-function minMax(v){var lo=0,hi=0;v.forEach(function(x){if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=(hi-lo)*0.06;return{lo:lo-m,hi:hi+m}}
-function niceStep(span){var raw=span/10,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
-function seasonName(t){var m=new Date(t).getUTCMonth()+1;if(m===12||m<=2)return'Winter';if(m>=3&&m<=5)return'Spring';if(m>=6&&m<=8)return'Summer';return'Autumn'}
-function seasonColor(t){var s=seasonName(t);if(s==='Winter')return'#00ffff';if(s==='Spring')return'#00ff88';if(s==='Summer')return'#ffcc00';return'#c79245'}
-function drawSeasonKey(g,q,w,h,pad){var items=[['Winter','#00ffff'],['Spring','#00ff88'],['Summer','#ffcc00'],['Autumn','#c79245']],x=pad.left,y=pad.top-24*q;g.save();g.font=9*q+'px Courier New';items.forEach(function(it){g.fillStyle=it[1];g.shadowColor=it[1];g.shadowBlur=4*q;g.fillRect(x,y-7*q,8*q,8*q);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.fillText(it[0],x+12*q,y);x+=58*q});g.restore()}
-function drawDailyKey(g,q,pad){drawSeasonKey(g,q,0,0,pad);g.save();g.fillStyle='#9aa3b6';g.font=9*q+'px Courier New';g.fillText('Daily high low average shown in seasonal colours',pad.left,pad.top-8*q);g.restore()}
-function drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}
-function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step,span=t1-t0;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle='#f5f7fb';g.fillText('£'+fmt(val,0),8*q,yy+4*q)}for(var i=0;i<2;i++){var ts=i===0?t0:t1,x=i===0?pad.left:w-pad.right;g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();drawDateTick(g,x,h-74*q,ts,q,i===0?'left':'right',span)}}
-function decimateRows(rows,limit){if(!rows||rows.length<=limit)return rows||[];var out=[],bucket=Math.ceil(rows.length/limit);for(var i=0;i<rows.length;i+=bucket){var slice=rows.slice(i,i+bucket),hi=slice[0],lo=slice[0];slice.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});if(new Date(lo.priceTimeUTC)<new Date(hi.priceTimeUTC)){out.push(lo);if(hi!==lo)out.push(hi)}else{out.push(hi);if(hi!==lo)out.push(lo)}}return out.sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)})}
-window.decimateRows=decimateRows;
-function statsHalf(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0],sum=0;rows.forEach(function(r){var v=Number(r.priceGBPperMWh);sum+=v;if(v>Number(hi.priceGBPperMWh))hi=r;if(v<Number(lo.priceGBPperMWh))lo=r});return{hi:hi,lo:lo,avg:sum/rows.length,hiValue:Number(hi.priceGBPperMWh),loValue:Number(lo.priceGBPperMWh),hiDate:slab(hi.priceTimeUTC)+' '+tlab(hi.priceTimeUTC),loDate:slab(lo.priceTimeUTC)+' '+tlab(lo.priceTimeUTC)}}
-function statsDaily(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0],sum=0,c=0;rows.forEach(function(r){if(r.average!=null){sum+=Number(r.average);c++}if(Number(r.high)>Number(hi.high))hi=r;if(Number(r.low)<Number(lo.low))lo=r});return{hi:hi,lo:lo,avg:c?sum/c:null,hiValue:Number(hi.high),loValue:Number(lo.low),hiDate:hi.date+' '+(hi.highAt||''),loDate:lo.date+' '+(lo.lowAt||'')}}
-function eventBox(g,lines,q,x,y,align){var pad=8*q,lh=18*q,w=0;g.save();g.font='900 '+14*q+'px Courier New';lines.forEach(function(t){w=Math.max(w,g.measureText(t).width)});var h=lines.length*lh+pad*2,xx=align==='right'?x-w-pad*2:x;g.fillStyle='rgba(5,7,12,.78)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,y-h+4*q,w+pad*2,h,6*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#ff3333';g.textAlign=align;lines.forEach(function(t,i){g.fillText(t,x,y-(lines.length-1-i)*lh)});g.restore()}
-function drawPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.5*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-24*q);g.stroke();g.restore()}
-function drawEvents(g,rows,X,Y,q,w,h,pad){var s=statsHalf(rows);if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',s.hiDate],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',s.loDate],q,lxText,lyText,lr?'left':'right')}
-function drawSeasonLine(g,lineRows,X,Y,q){g.save();g.lineWidth=2.1*q;g.lineCap='round';g.lineJoin='round';for(var i=1;i<lineRows.length;i++){var a=lineRows[i-1],b=lineRows[i],col=seasonColor(b.priceTimeUTC);g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=5*q;g.beginPath();g.moveTo(X(a),Y(Number(a.priceGBPperMWh)));g.lineTo(X(b),Y(Number(b.priceGBPperMWh)));g.stroke()}g.restore()}
-function drawDailyLines(g,rows,X,Y,q){['average','high','low'].forEach(function(k){g.save();g.lineWidth=(k==='average'?2.4:1.6)*q;g.setLineDash(k==='average'?[]:(k==='high'?[5*q,4*q]:[2*q,5*q]));g.lineCap='round';g.lineJoin='round';for(var i=1;i<rows.length;i++){var a=rows[i-1],b=rows[i];if(a[k]==null||b[k]==null||isNaN(Number(a[k]))||isNaN(Number(b[k])))continue;var col=seasonColor(b.date+'T12:00:00Z');g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=4*q;g.beginPath();g.moveTo(X(a),Y(Number(a[k])));g.lineTo(X(b),Y(Number(b[k])));g.stroke()}g.restore()});g.save();g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1*q;rows.forEach(function(r){if(r.high==null||r.low==null)return;var x=X(r);g.beginPath();g.moveTo(x,Y(Number(r.high)));g.lineTo(x,Y(Number(r.low)));g.stroke()});g.restore()}
-function drawDailyEvents(g,rows,X,Y,q,w,h,pad){var s=statsDaily(rows);if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',s.hiDate],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',s.loDate],q,lxText,lyText,lr?'left':'right')}
-function drawSummary(g,stats,q,w,h,pad){if(!stats)return;var y=h-44*q;g.save();g.fillStyle='rgba(5,7,12,.72)';g.strokeStyle='rgba(0,255,255,.26)';g.lineWidth=1*q;g.beginPath();g.roundRect(pad.left,y-22*q,w-pad.left-pad.right,34*q,6*q);g.fill();g.stroke();g.fillStyle='#f5f7fb';g.font='900 '+10*q+'px Courier New';g.textAlign='center';var mid=w/2;g.fillText('HIGH '+pence(stats.hiValue)+'p/kWh (£'+fmt(stats.hiValue,2)+'/MWh)     AVG '+pence(stats.avg)+'p/kWh (£'+fmt(stats.avg,2)+'/MWh)     LOW '+pence(stats.loValue)+'p/kWh (£'+fmt(stats.loValue,2)+'/MWh)',mid,y);g.fillStyle='#9aa3b6';g.font='8.5px Courier New';g.fillText('Indicative conversion for attention only. Formal price unit remains pounds per Megawatt hour.',mid,y+11*q);g.restore()}
-function draw(rows,meta){var c=$('price-history-canvas');if(!c)return;var q=devicePixelRatio||1,r=c.getBoundingClientRect();if(r.width){c.width=Math.max(320,Math.floor(r.width*q));c.height=Math.max(320,Math.floor((r.height||360)*q))}var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:74*q,right:24*q,top:96*q,bottom:154*q};g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var t0=meta?meta.start.getTime():0,t1=meta?meta.end.getTime():1;if(t1<=t0)t1=t0+1;var daily=meta&&meta.mode==='daily';var vals=daily?rows.flatMap(function(x){return [x.high,x.low,x.average].filter(function(v){return v!=null&&!isNaN(Number(v))}).map(Number)}):rows.map(function(x){return Number(x.priceGBPperMWh)});if(vals.length<2){g.fillStyle='#00ffff';g.font=14*q+'px Courier New';g.fillText('No records in selected range.',pad.left,42*q);return}var mm=minMax(vals);function X(r){var t=daily?new Date(r.date+'T12:00:00Z').getTime():new Date(r.priceTimeUTC).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawAxes(g,w,h,q,mm,t0,t1,pad);var s=daily?statsDaily(rows):statsHalf(rows);if(daily){drawDailyLines(g,rows,X,Y,q);drawDailyKey(g,q,pad);drawDailyEvents(g,rows,X,Y,q,w,h,pad)}else{var lineRows=decimateRows(rows,Math.max(900,Math.floor((w/q)*1.8)));drawSeasonLine(g,lineRows,X,Y,q);drawSeasonKey(g,q,w,h,pad);drawEvents(g,rows,X,Y,q,w,h,pad)}drawSummary(g,s,q,w,h,pad)}
-function status(meta,sourceRows,rows,years){var s=$('price-history-range-status');var lab=$('price-history-scroll-label');var mode=meta.mode==='daily'?'daily high low average':'full settlement';var text=dlab(meta.start)+' to '+dlab(meta.end)+' | '+(meta.mode==='daily'?'All hours':timeModeLabel())+' | '+rows.length.toLocaleString('en-GB')+' '+mode+' points';if(s){s.textContent=text;s.className='price-history-range-status'}if(lab)lab.textContent=(meta.mode==='daily'?'Daily high low and average mode.':'Full half hourly settlement data mode.')+' '+periodLabel(meta.period)+'.'}
-function table(rows,meta){var b=$('price-history-table-body');if(!b)return;if(!rows.length){b.innerHTML='<tr><td colspan="5">No records available.</td></tr>';return}if(meta&&meta.mode==='daily'){b.innerHTML=rows.slice().reverse().slice(0,500).map(function(r){return '<tr><td>'+r.date+'</td><td>Avg £'+fmt(r.average,2)+' | High £'+fmt(r.high,2)+' | Low £'+fmt(r.low,2)+'</td><td>'+(r.highAt||'—')+'</td><td>'+(r.lowAt||'—')+'</td><td>'+r.observations+' observations</td></tr>'}).join('');return}b.innerHTML=rows.slice().reverse().slice(0,1000).map(function(r){return '<tr><td>'+dlab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC)+'</td><td>£'+fmt(Number(r.priceGBPperMWh),2)+'/MWh</td><td>'+(r.settlementPeriod||'—')+'</td><td>'+(r.capturedAtUTC?dlab(r.capturedAtUTC)+' '+tlab(r.capturedAtUTC):'—')+'</td><td>'+(r.carbonGperKWh||'—')+'</td></tr>'}).join('')}
-function loadHalfHourly(meta){var years=yearsBetween(meta.start,meta.end);return Promise.all([loadJson()].concat(years.map(loadAnnual))).then(function(parts){var cap=parts[0],sys=[];parts.slice(1).forEach(function(a){sys=sys.concat(a)});var all=merge(norm(sys),norm(cap));var rows=all.filter(function(r){var t=new Date(r.priceTimeUTC);return t>=meta.start&&t<=meta.end&&passesTimeMode(r)});STATE.all=all;STATE.sourceRows=sys.length;STATE.loadedYears=years;return rows})}
-function loadDailyRows(meta){return loadDaily().then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});STATE.all=all;STATE.sourceRows=all.length;STATE.loadedYears=[];return rows})}
-function load(){ensurePeriodOptions();ensureModeTabs();ensureYearOptions();ensureScroller();ensureDiscoveryPanel();var meta=selectedWindow();syncScrollerFromStart();var promise=meta.mode==='daily'?loadDailyRows(meta):loadHalfHourly(meta);promise.then(function(rows){STATE.visible=rows;STATE.meta=meta;STATE.mode=meta.mode;var latest=rows.length?rows[rows.length-1]:null;set('ph-latest-price',latest?(meta.mode==='daily'?'Avg £'+fmt(latest.average,2)+'/MWh':'£'+fmt(Number(latest.priceGBPperMWh),2)+'/MWh'):'—');set('ph-latest-time',latest?(meta.mode==='daily'?latest.date:dlab(latest.priceTimeUTC)+' '+tlab(latest.priceTimeUTC)):'—');set('ph-row-count',String(rows.length));set('ph-source',meta.mode==='daily'?'V5 daily high low average aggregate':'Elexon annual CSVs plus V5 Market Index audit');status(meta,STATE.sourceRows,rows,STATE.loadedYears);table(rows,meta);draw(rows,meta)}).catch(function(){var m={start:new Date(),end:new Date(),period:'7d',mode:'halfhourly'};STATE.visible=[];STATE.meta=m;table([],m);draw([],m)})}
-function deferredLoad(){clearTimeout(pendingTimer);pendingTimer=setTimeout(load,160)}
-window.__v5PriceHistoryControls={load:load,deferredLoad:deferredLoad,periodDays:periodDays,totalScrollableDays:totalScrollableDays,dateFromOffset:dateFromOffset,offsetFromDate:offsetFromDate,syncStartFromScroller:syncStartFromScroller,setOffset:function(v){var r=$('price-history-scroll');if(r){r.value=v;syncStartFromScroller();load()}},setPeriod:function(v){var p=$('price-history-period');if(p){p.value=v;load()}},setMode:function(v){STATE.timeMode=v;load()}};
-document.addEventListener('DOMContentLoaded',function(){ensurePeriodOptions();ensureModeTabs();ensureYearOptions();ensureScroller();ensureDiscoveryPanel();ensureStartDate();var y=$('price-history-year'),p=$('price-history-period'),s=$('price-history-start'),cl=$('price-history-clear-start'),r=$('price-history-scroll'),prev=$('price-history-prev'),next=$('price-history-next');if(cl)cl.remove();if(y)y.addEventListener('change',function(){var st=$('price-history-start');if(st)st.value='';ensureStartDate();load()});if(p)p.addEventListener('change',load);if(s)s.addEventListener('change',function(){syncScrollerFromStart();load()});if(r)r.addEventListener('input',function(){syncStartFromScroller();deferredLoad()});if(prev)prev.addEventListener('click',function(){var rr=$('price-history-scroll');if(!rr)return;rr.value=Math.max(0,Number(rr.value)-Math.max(1,periodDays(($('price-history-period')||{}).value)));syncStartFromScroller();load()});if(next)next.addEventListener('click',function(){var rr=$('price-history-scroll');if(!rr)return;rr.value=Math.min(totalScrollableDays(),Number(rr.value)+Math.max(1,periodDays(($('price-history-period')||{}).value)));syncStartFromScroller();load()});load();setInterval(load,5*60*1000);window.addEventListener('resize',function(){if(STATE.meta)draw(STATE.visible,STATE.meta)})});
+window.V6RenderPriceChart=(function(){
+  var lastResult=null;
+  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
+  function price(r){return Number(r.price!=null?r.price:r.priceGBPperMWh)}
+  function time(r){return r.time||r.priceTimeUTC}
+  function niceDate(v){var d=v instanceof Date?v:new Date(String(v).replace(' ','T')+'Z');if(isNaN(d.getTime()))d=new Date(v);return isNaN(d.getTime())?'—':d.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
+  function niceClock(v){var s=String(v||'');var m=s.match(/(\d{2}:\d{2})/);return m?m[1]:''}
+  function seasonName(t){var m=new Date(t).getUTCMonth()+1;if(m===12||m<=2)return'Winter';if(m>=3&&m<=5)return'Spring';if(m>=6&&m<=8)return'Summer';return'Autumn'}
+  function seasonColor(t){var s=seasonName(t);if(s==='Winter')return'#00ffff';if(s==='Spring')return'#00ff88';if(s==='Summer')return'#ffcc00';return'#c79245'}
+  function actualValue(r,mode){return mode==='daily'?Number(r.average):price(r)}
+  function forecastValue(r){return Number(r.forecast!=null?r.forecast:r.average)}
+  function values(result){var out=[];(result.rows||[]).forEach(function(r){if(result.mode==='daily'){['average','high','low'].forEach(function(k){var v=Number(r[k]);if(!isNaN(v))out.push(v)})}else{var v=price(r);if(!isNaN(v))out.push(v)}});(result.forecastRows||[]).forEach(function(r){var f=forecastValue(r);if(!isNaN(f))out.push(f)});return out}
+  function stats(result){var rows=result.rows||[];if(!rows.length)return null;if(result.mode==='daily'){var valid=rows.filter(function(r){return r.average!=null&&r.high!=null&&r.low!=null&&!isNaN(Number(r.average))&&!isNaN(Number(r.high))&&!isNaN(Number(r.low))});if(!valid.length)return null;var hi=valid[0],lo=valid[0],sum=0;valid.forEach(function(r){sum+=Number(r.average);if(Number(r.high)>Number(hi.high))hi=r;if(Number(r.low)<Number(lo.low))lo=r});return{hi:hi,lo:lo,avg:sum/valid.length,hiValue:Number(hi.high),loValue:Number(lo.low),hiDate:niceDate(hi.date),loDate:niceDate(lo.date),hiClock:hi.highAt||'',loClock:lo.lowAt||'',avgDate:niceDate(result.start)+' to '+niceDate(result.end)}}var h=rows[0],l=rows[0],s=0;rows.forEach(function(r){var v=price(r);s+=v;if(v>price(h))h=r;if(v<price(l))l=r});return{hi:h,lo:l,avg:s/rows.length,hiValue:price(h),loValue:price(l),hiDate:niceDate(time(h)),loDate:niceDate(time(l)),hiClock:niceClock(time(h)),loClock:niceClock(time(l)),avgDate:niceDate(result.start)+' to '+niceDate(result.end)}}
+  function minMax(v){var lo=0,hi=0;v.forEach(function(x){if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=Math.max((hi-lo)*.08,10);return{lo:lo-m,hi:hi+m}}
+  function step(span){var raw=span/8,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
+  function dateLabel(t,span){return span>45*86400000?new Date(t).toLocaleDateString('en-GB',{month:'long',year:'numeric'}):new Date(t).toLocaleDateString('en-GB')}
+  function drawAxes(g,w,h,q,mm,pad,t0,t1){var st=step(mm.hi-mm.lo),start=Math.ceil(mm.lo/st)*st,span=t1-t0;g.font=11*q+'px Courier New';for(var v=start;v<=mm.hi+st*.5;v+=st){var y=pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom);g.fillStyle='#f5f7fb';g.textAlign='left';g.fillText('£'+fmt(v,0).replace('-0','0'),8*q,y+4*q)}g.save();g.strokeStyle='rgba(255,255,255,.26)';g.lineWidth=1*q;g.beginPath();g.moveTo(pad.left,h-pad.bottom);g.lineTo(w-pad.right,h-pad.bottom);g.stroke();g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.textAlign='left';g.fillText(dateLabel(t0,span),pad.left,h-pad.bottom+24*q);g.textAlign='right';g.fillText(dateLabel(t1,span),w-pad.right,h-pad.bottom+24*q);g.restore();g.textAlign='left'}
+  function drawKey(g,q,pad,isFull,result){var items=result.mode==='daily'?[['Average','#00ffff'],['High','#ffcc00'],['Low','#ff3333']]:[['Winter','#00ffff'],['Spring','#00ff88'],['Summer','#ffcc00'],['Autumn','#c79245']];if((result.forecastRows||[]).length)items.push(['Forecast','#8a95a8']);var x=pad.left,y=pad.top-24*q;g.save();g.font=(isFull?8.5:9)*q+'px Courier New';items.forEach(function(it){g.fillStyle=it[1];g.shadowColor=it[1];g.shadowBlur=4*q;g.fillRect(x,y-7*q,8*q,8*q);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.fillText(it[0],x+12*q,y);x+=(isFull?58:66)*q});g.restore()}
+  function pence(v){return fmt(Number(v)/10,2)}
+  function set(id,v){var e=document.getElementById(id);if(e)e.textContent=v}
+  function forecastHealth(result){var f=result.forecastRows||[],a=result.rows||[];if(!f.length||!a.length)return{label:'Forecast health: awaiting actual data',skill:0,mae:null,n:0};var map={};f.forEach(function(r){map[r.date]=forecastValue(r)});var errs=[];a.forEach(function(r){var key=result.mode==='daily'?r.date:(time(r)||'').slice(0,10);var fv=map[key],av=actualValue(r,result.mode);if(fv!=null&&!isNaN(fv)&&!isNaN(av))errs.push(Math.abs(av-fv))});if(errs.length<7)return{label:'Forecast health: awaiting more actual data',skill:0,mae:null,n:errs.length};var mae=errs.reduce(function(x,y){return x+y},0)/errs.length;var label=mae<15?'Tracking close':mae<35?'Moderate deviation':mae<70?'Large deviation':'Market moved beyond seasonal baseline';var skill=Math.max(0,Math.min(1,1-mae/100));return{label:label,skill:skill,mae:mae,n:errs.length}}
+  function drawHealthBar(g,result,q,w,h,pad){var health=forecastHealth(result),x=pad.left,y=h-34*q,bw=w-pad.left-pad.right,bh=10*q;g.save();g.fillStyle='rgba(255,255,255,.08)';g.fillRect(x,y,bw,bh);g.fillStyle=health.skill>.65?'#00ff88':health.skill>.3?'#ffcc00':'#ff4444';g.fillRect(x,y,bw*health.skill,bh);g.strokeStyle='rgba(0,255,255,.25)';g.strokeRect(x,y,bw,bh);g.fillStyle='#9aa3b6';g.font=9*q+'px Courier New';g.textAlign='left';var txt=health.label+(health.mae!=null?' · MAE £'+fmt(health.mae,2)+'/MWh · n='+health.n:'');g.fillText(txt,x,y-8*q);g.restore()}
+  function drawSummary(g,s,q,w,h,pad,isFull){var boxH=(isFull?92:118)*q,y=h-pad.bottom+(isFull?44:64)*q,x=pad.left,bw=w-pad.left-pad.right;if(!isFull)y=h-128*q;g.save();g.fillStyle='rgba(5,7,12,.82)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.18)';g.shadowBlur=8*q;g.beginPath();g.roundRect(x,y,bw,boxH,8*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#f5f7fb';g.textAlign='center';var cx=x+bw/2;var small=(w/q)<720||isFull;g.font='900 '+(small?8.2:10.5)*q+'px Courier New';if(small){g.fillText('HIGH  '+pence(s.hiValue)+'p/kWh   £'+fmt(s.hiValue,2)+'/MWh',cx,y+20*q);g.fillText(s.hiDate+(s.hiClock?'  '+s.hiClock:''),cx,y+35*q);g.fillText('AVG   '+pence(s.avg)+'p/kWh   £'+fmt(s.avg,2)+'/MWh',cx,y+55*q);g.fillText(s.avgDate,cx,y+70*q);g.fillText('LOW   '+pence(s.loValue)+'p/kWh   £'+fmt(s.loValue,2)+'/MWh',cx,y+90*q);if(!isFull)g.fillText(s.loDate+(s.loClock?'  '+s.loClock:''),cx,y+105*q)}else{g.fillText('HIGH  '+pence(s.hiValue)+'p/kWh   £'+fmt(s.hiValue,2)+'/MWh   '+s.hiDate+(s.hiClock?' '+s.hiClock:''),cx,y+24*q);g.fillText('AVG   '+pence(s.avg)+'p/kWh   £'+fmt(s.avg,2)+'/MWh   '+s.avgDate,cx,y+58*q);g.fillText('LOW   '+pence(s.loValue)+'p/kWh   £'+fmt(s.loValue,2)+'/MWh   '+s.loDate+(s.loClock?' '+s.loClock:''),cx,y+92*q)}g.restore()}
+  function decimateRows(rows,limit){if(!rows||rows.length<=limit)return rows||[];var out=[],bucket=Math.ceil(rows.length/limit);for(var i=0;i<rows.length;i+=bucket){var slice=rows.slice(i,i+bucket),hi=slice[0],lo=slice[0];slice.forEach(function(r){if(price(r)>price(hi))hi=r;if(price(r)<price(lo))lo=r});if(new Date(time(lo))<new Date(time(hi))){out.push(lo);if(hi!==lo)out.push(hi)}else{out.push(hi);if(hi!==lo)out.push(lo)}}return out.sort(function(a,b){return new Date(time(a))-new Date(time(b))})}
+  function drawForecast(g,result,q,X,Y){var rows=result.forecastRows||[];if(rows.length<2)return;g.save();g.lineWidth=1.7*q;g.lineCap='round';g.lineJoin='round';g.setLineDash([7*q,6*q]);g.strokeStyle='rgba(180,190,210,.76)';g.shadowColor='rgba(180,190,210,.35)';g.shadowBlur=4*q;g.beginPath();rows.forEach(function(r,i){var x=X(r,true),y=Y(forecastValue(r));if(i)g.lineTo(x,y);else g.moveTo(x,y)});g.stroke();g.restore()}
+  function drawDailyLines(g,result,q,X,Y){var rows=result.rows||[];if(rows.length<2)return;var series=[['high','#ffcc00',2.1],['average','#00ffff',2.4],['low','#ff3333',2.1]];series.forEach(function(s){g.save();g.lineWidth=s[2]*q;g.lineCap='round';g.lineJoin='round';g.setLineDash([]);g.strokeStyle=s[1];g.shadowColor=s[1];g.shadowBlur=5*q;g.beginPath();var started=false;rows.forEach(function(r){var v=Number(r[s[0]]);if(isNaN(v))return;var x=X(r),y=Y(v);if(started)g.lineTo(x,y);else{g.moveTo(x,y);started=true}});g.stroke();g.restore()})}
+  function renderTo(canvasId,result){var c=document.getElementById(canvasId);if(!c)return;var isFull=canvasId==='price-history-fullscreen-canvas';var q=window.devicePixelRatio||1,r=c.getBoundingClientRect();c.width=Math.max(320,Math.floor((r.width||1200)*q));c.height=Math.max(360,Math.floor((r.height||720)*q));var g=c.getContext('2d'),w=c.width,h=c.height;var pad=isFull?{left:58*q,right:18*q,top:112*q,bottom:176*q}:{left:74*q,right:24*q,top:96*q,bottom:284*q};g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var vals=values(result);if(vals.length<2)vals=[0,100];var mm=minMax(vals),t0=result.start.getTime(),t1=result.end.getTime();drawAxes(g,w,h,q,mm,pad,t0,t1);drawKey(g,q,pad,isFull,result);function X(row,isForecast){var t;if(result.mode==='daily'||isForecast)t=new Date(row.date+'T12:00:00Z').getTime();else t=new Date(time(row)).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawForecast(g,result,q,X,Y);if(result.mode==='daily'){drawDailyLines(g,result,q,X,Y)}else{var lineRows=decimateRows(result.rows,Math.max(900,Math.floor((w/q)*1.8)));g.save();g.lineWidth=2.1*q;g.lineCap='round';g.lineJoin='round';for(var j=1;j<lineRows.length;j++){var aa=lineRows[j-1],bb=lineRows[j],col2=seasonColor(time(bb));g.strokeStyle=col2;g.shadowColor=col2;g.shadowBlur=5*q;g.beginPath();g.moveTo(X(aa),Y(price(aa)));g.lineTo(X(bb),Y(price(bb)));g.stroke()}g.restore()}var s=stats(result);if(s){var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.8)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,4.5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,4.5*q,0,Math.PI*2);g.fill();g.restore();drawSummary(g,s,q,w,h,pad,isFull);set('ph-latest-price','£'+fmt(s.avg,2)+'/MWh');set('ph-latest-time',s.avgDate);set('ph-row-count',(result.rows||[]).length.toLocaleString('en-GB'));set('ph-source','Elexon BMRS')}else{g.save();g.fillStyle='#00ffff';g.font='900 '+13*q+'px Courier New';g.textAlign='center';g.fillText('No actual data yet · showing indicative seasonal baseline',w/2,pad.top+48*q);g.restore();set('ph-latest-price','Forecast baseline');set('ph-row-count','0');set('ph-source','Seasonal baseline')}if(!isFull&&result.forecastRows&&result.forecastRows.length)drawHealthBar(g,result,q,w,h,pad);set('price-history-range-status',new Date(result.start).toLocaleDateString('en-GB')+' to '+new Date(result.end).toLocaleDateString('en-GB')+' | '+(result.rows||[]).length.toLocaleString('en-GB')+' actual points')}
+  function render(result){lastResult=result;renderTo('price-history-canvas',result);var o=document.getElementById('price-history-fullscreen-overlay');if(o&&o.classList.contains('open'))renderTo('price-history-fullscreen-canvas',result)}
+  function redrawFullscreen(){if(lastResult)renderTo('price-history-fullscreen-canvas',lastResult)}
+  return{render:render,redrawFullscreen:redrawFullscreen};
 })();
```

### `uk_energy_tracking_v5/price-history-ui.js` versus `uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js`

```diff
--- uk_energy_tracking_v5/price-history-ui.js
+++ uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js
@@ -1,78 +1,29 @@
-(function(){
-var JSON_URL='/uk_energy_tracking_v5/electricity_price_history.json';
-var DAILY_URL='/uk_energy_tracking_v5/electricity_price_history_daily_decade.json';
-var DAILY_FALLBACK_URL='/uk_energy_tracking_v5/electricity_price_history_4bucket_decade.json';
-var ANNUAL_URL_BASE='/data/electricity/elexon_system_prices_';
-var FIRST_YEAR=2016;
-var MIN_DATE=new Date(Date.UTC(FIRST_YEAR,0,1,0,0,0));
-var TODAY=new Date();
-var MAX_DATE=new Date(Date.UTC(TODAY.getUTCFullYear(),TODAY.getUTCMonth(),TODAY.getUTCDate(),23,59,59));
-var ANNUAL_CACHE={}, DAILY_CACHE=null, CAPTURE_CACHE=null;
-var pendingTimer=null;
-var STATE={all:[],visible:[],meta:null,loadedYears:[],sourceRows:0,timeMode:'all',mode:'halfhourly'};
-window.__v5PriceHistoryState=STATE;
-function $(id){return document.getElementById(id)}
-function fmt(n,d){return n==null||isNaN(n)?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
-function pence(n){return n==null||isNaN(n)?'—':fmt(Number(n)/10,2)}
-function dlab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
-function slab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
-function tlab(t){return new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
-function axisLabel(t,span){return span<=45*86400000?slab(t):new Date(t).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
-function ymd(d){return d.toISOString().slice(0,10)}
-function set(id,v){var e=$(id);if(e)e.textContent=v}
-function timeModeLabel(){if(STATE.timeMode==='day')return 'Day 06 to 18 UTC';if(STATE.timeMode==='night')return 'Night 18 to 06 UTC';return 'All hours'}
-function csvLine(l){var o=[],v='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){o.push(v);v=''}else v+=c}o.push(v);return o}
-function parseCsv(t){t=(t||'').trim();if(!t)return[];var lines=t.split(/\r?\n/),h=csvLine(lines[0]).map(function(x){return x.trim()});return lines.slice(1).map(function(line){var c=csvLine(line),r={};h.forEach(function(x,i){r[x]=(c[i]||'').trim()});var p=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{source:r.source||'Elexon BMRS System Prices',priceTimeUTC:r.periodStartUTC||r.priceTimeUTC||'',capturedAtUTC:r.fetchedAtUTC||r.capturedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:p,carbonGperKWh:r.carbonGperKWh||'',carbonIndex:r.carbonIndex||'',priceHealth:r.priceHealth||'historical system price',carbonHealth:r.carbonHealth||'',netImbalanceVolumeMWh:r.netImbalanceVolumeMWh||''}}).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))})}
-function loadJson(){if(CAPTURE_CACHE)return CAPTURE_CACHE;CAPTURE_CACHE=fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return CAPTURE_CACHE}
-function loadAnnual(year){if(ANNUAL_CACHE[year])return ANNUAL_CACHE[year];ANNUAL_CACHE[year]=fetch(ANNUAL_URL_BASE+year+'.csv?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(parseCsv).catch(function(){return[]});return ANNUAL_CACHE[year]}
-function convert4Bucket(d){return (d.rows||[]).map(function(r){var vals=[r.night,r.morning,r.midday,r.evening].filter(function(v){return v!=null&&!isNaN(Number(v))}).map(Number);return{date:r.date,average:vals.length?Number((vals.reduce(function(a,b){return a+b},0)/vals.length).toFixed(2)):null,high:r.peakPrice!=null?Number(r.peakPrice):(vals.length?Math.max.apply(null,vals):null),highAt:r.peakAt||'',low:vals.length?Math.min.apply(null,vals):null,lowAt:'',observations:r.observations||0}})}
-function loadDaily(){if(DAILY_CACHE)return DAILY_CACHE;DAILY_CACHE=fetch(DAILY_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('daily missing');return r.json()}).then(function(d){return d.rows||[]}).catch(function(){return fetch(DAILY_FALLBACK_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(convert4Bucket).catch(function(){return[]})});return DAILY_CACHE}
-function yearsBetween(a,b){var y=[],s=a.getUTCFullYear(),e=b.getUTCFullYear();for(var n=s;n<=e;n++)y.push(n);return y}
-function norm(rows){var seen={};return(rows||[]).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))}).map(function(r){var o=Object.assign({},r);o.priceGBPperMWh=Number(o.priceGBPperMWh);return o}).sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)}).filter(function(r){var k=r.priceTimeUTC+'|'+r.priceGBPperMWh+'|'+(r.source||'');if(seen[k])return false;seen[k]=1;return true})}
-function merge(sys,cap){var rows=[];sys.forEach(function(r){rows.push(Object.assign({},r,{source:'Elexon BMRS System Prices',priceHealth:r.priceHealth||'historical system price'}))});cap.forEach(function(r){rows.push(Object.assign({},r,{source:r.source||'V5 captured Elexon Market Index Price'}))});return norm(rows)}
-function periodDays(period){return {'12hday':0.5,'12hnight':0.5,'1d':1,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[period]||7}
-function periodLabel(period){return {'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','5y':'5 years','10y':'10 years'}[period]||'1 week'}
-function isDailyPeriod(p){return ['6m','12m','5y','10y'].indexOf(p)>=0}
-function isDayNightPeriod(p){return p==='12hday'||p==='12hnight'}
-function totalScrollableDays(){return Math.max(1,Math.floor((MAX_DATE-MIN_DATE)/86400000))}
-function dateFromOffset(v){var d=new Date(MIN_DATE.getTime()+Number(v)*86400000);d.setUTCHours(0,0,0,0);return d}
-function offsetFromDate(d){return Math.max(0,Math.min(totalScrollableDays(),Math.floor((d-MIN_DATE)/86400000)))}
-function ensurePeriodOptions(){var p=$('price-history-period');if(!p)return;var wanted=[['12hday','12 hours day'],['12hnight','12 hours night'],['1d','1 day'],['7d','1 week'],['30d','1 month'],['3m','3 months'],['6m','6 months'],['12m','12 months'],['5y','5 years'],['10y','10 years']];var current=p.value||'7d';p.innerHTML='';wanted.forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];p.appendChild(o)});p.value=current&&wanted.some(function(x){return x[0]===current})?current:'7d'}
-function ensureModeTabs(){if($('price-history-time-tabs'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var tabs=document.createElement('div');tabs.id='price-history-time-tabs';tabs.className='price-history-time-tabs';tabs.innerHTML='<span>Hour filter</span><button type="button" data-mode="all" class="active">All</button><button type="button" data-mode="day">Day</button><button type="button" data-mode="night">Night</button>';actions.appendChild(tabs);tabs.addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;STATE.timeMode=b.getAttribute('data-mode');tabs.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});load()})}
-function ensureScroller(){if($('price-history-scroll'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var wrap=document.createElement('div');wrap.className='price-history-scroller';wrap.innerHTML='<div class="price-history-scroller-head"><strong>History scroller</strong><span id="price-history-scroll-label">1 day, 1 week, 1 month and 3 months use full settlement data. 6 months and longer use daily high, low and average.</span></div><div class="price-history-scroll-row"><button type="button" id="price-history-prev">◀</button><input id="price-history-scroll" type="range" min="0" max="'+totalScrollableDays()+'" step="1"><button type="button" id="price-history-next">▶</button></div>';actions.parentNode.insertBefore(wrap,actions.nextSibling);var style=document.createElement('style');style.textContent='.price-history-scroller,.price-history-time-tabs{width:100%;border:1px solid var(--gg-line,#252b36);background:rgba(255,255,255,.025);border-radius:6px;padding:10px 12px;margin:10px 0}.price-history-scroller-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--gg-muted,#9aa3b6);font:11px Courier New,monospace;letter-spacing:.08em;text-transform:uppercase}.price-history-scroller-head strong{color:var(--gg-cyan,#00ffff)}.price-history-scroll-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-top:8px}.price-history-scroll-row button,.price-history-time-tabs button{border:1px solid var(--gg-line,#252b36);border-radius:4px;background:rgba(0,255,255,.05);color:#00ffff;padding:7px 10px;font-family:Courier New,monospace}.price-history-time-tabs button.active{background:rgba(0,255,255,.18);box-shadow:0 0 10px rgba(0,255,255,.12)}.price-history-time-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--gg-muted,#9aa3b6);font:11px Courier New,monospace;text-transform:uppercase;letter-spacing:.08em}.price-history-scroll-row input[type=range]{width:100%;accent-color:#00ffff}.price-history-device-note{color:#ff9900!important}.price-history-discovery{border:1px solid rgba(0,255,255,.28);background:rgba(0,255,255,.035);border-radius:6px;padding:10px 12px;margin:10px 0;color:#9aa3b6;font:12px Courier New,monospace;line-height:1.55}.price-history-discovery summary{cursor:pointer;color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.price-history-discovery strong{color:#f5f7fb}.price-history-discovery p{margin:8px 0 0}';document.head.appendChild(style)}
-function ensureDiscoveryPanel(){if($('price-history-discovery'))return;var canvas=$('price-history-canvas');if(!canvas||!canvas.parentNode)return;var d=document.createElement('details');d.id='price-history-discovery';d.className='price-history-discovery';d.innerHTML='<summary>What does this Elexon price mean?</summary><p><strong>Interpretation:</strong> this is an Elexon System Price / imbalance price signal used in GB electricity settlement. It is not a retail tariff and it is not a simple consumer wholesale bill.</p><p><strong>Market meaning:</strong> it reflects the marginal stress or surplus cost of balancing the power system in each settlement period. It can correlate with wholesale spot prices, but it is a balancing and settlement signal rather than a pure day ahead or intraday merchant price.</p><p><strong>How to read the chart:</strong> p/kWh values are indicative equivalents for human intuition. The formal unit remains £/MWh. High, average and low boxes expose volatility, storage opportunity and system stress.</p>';canvas.parentNode.insertBefore(d,canvas)}
-function ensureYearOptions(){var y=$('price-history-year');if(!y||y.options.length)return;var nowYear=MAX_DATE.getUTCFullYear();for(var n=nowYear;n>=FIRST_YEAR;n--){var o=document.createElement('option');o.value=String(n);o.textContent=String(n);y.appendChild(o)}y.value=String(nowYear)}
-function ensureStartDate(){var y=$('price-history-year'),s=$('price-history-start');if(!s)return;var selectedYear=y&&y.value?Number(y.value):MAX_DATE.getUTCFullYear();if(!s.value||s.value.slice(0,4)!==String(selectedYear)){var start;if(selectedYear===MAX_DATE.getUTCFullYear()){start=new Date(MAX_DATE.getTime()-7*86400000)}else{start=new Date(Date.UTC(selectedYear,0,1,0,0,0))}s.value=ymd(start)}syncScrollerFromStart()}
-function syncScrollerFromStart(){var s=$('price-history-start'),r=$('price-history-scroll');if(!s||!r||!s.value)return;r.value=String(offsetFromDate(new Date(s.value+'T00:00:00Z')))}
-function syncStartFromScroller(){var r=$('price-history-scroll'),s=$('price-history-start'),y=$('price-history-year');if(!r||!s)return;var d=dateFromOffset(r.value);s.value=ymd(d);if(y)y.value=String(d.getUTCFullYear())}
-function selectedWindow(){ensureStartDate();var y=$('price-history-year'),s=$('price-history-start'),p=$('price-history-period');var year=y&&y.value?Number(y.value):MAX_DATE.getUTCFullYear();var period=p&&p.value?p.value:'7d';var start=s&&s.value?new Date(s.value+'T00:00:00Z'):new Date(Date.UTC(year,0,1,0,0,0));if(isNaN(start))start=new Date(Date.UTC(year,0,1,0,0,0));if(isDayNightPeriod(period)){start.setUTCHours(period==='12hday'?6:18,0,0,0)}if(start<MIN_DATE)start=new Date(MIN_DATE);if(start>MAX_DATE)start=new Date(MAX_DATE);if(s)s.value=ymd(start);if(y)y.value=String(start.getUTCFullYear());var days=periodDays(period);var end=new Date(start.getTime()+days*86400000-1000);if(end>MAX_DATE)end=new Date(MAX_DATE);return{start:start,end:end,label:start.getUTCFullYear()+' '+period,period:period,year:start.getUTCFullYear(),capped:false,timeMode:STATE.timeMode,mode:isDailyPeriod(period)?'daily':'halfhourly'}}
-function passesTimeMode(r){if(STATE.timeMode==='all')return true;var h=new Date(r.priceTimeUTC).getUTCHours();var day=h>=6&&h<18;return STATE.timeMode==='day'?day:!day}
-function minMax(v){var lo=0,hi=0;v.forEach(function(x){if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=(hi-lo)*0.06;return{lo:lo-m,hi:hi+m}}
-function niceStep(span){var raw=span/10,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
-function seasonName(t){var m=new Date(t).getUTCMonth()+1;if(m===12||m<=2)return'Winter';if(m>=3&&m<=5)return'Spring';if(m>=6&&m<=8)return'Summer';return'Autumn'}
-function seasonColor(t){var s=seasonName(t);if(s==='Winter')return'#00ffff';if(s==='Spring')return'#00ff88';if(s==='Summer')return'#ffcc00';return'#c79245'}
-function drawSeasonKey(g,q,w,h,pad){var items=[['Winter','#00ffff'],['Spring','#00ff88'],['Summer','#ffcc00'],['Autumn','#c79245']],x=pad.left,y=pad.top-24*q;g.save();g.font=9*q+'px Courier New';items.forEach(function(it){g.fillStyle=it[1];g.shadowColor=it[1];g.shadowBlur=4*q;g.fillRect(x,y-7*q,8*q,8*q);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.fillText(it[0],x+12*q,y);x+=58*q});g.restore()}
-function drawDailyKey(g,q,pad){drawSeasonKey(g,q,0,0,pad);g.save();g.fillStyle='#9aa3b6';g.font=9*q+'px Courier New';g.fillText('Daily high low average shown in seasonal colours',pad.left,pad.top-8*q);g.restore()}
-function drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}
-function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step,span=t1-t0;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle='#f5f7fb';g.fillText('£'+fmt(val,0),8*q,yy+4*q)}for(var i=0;i<2;i++){var ts=i===0?t0:t1,x=i===0?pad.left:w-pad.right;g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();drawDateTick(g,x,h-74*q,ts,q,i===0?'left':'right',span)}}
-function decimateRows(rows,limit){if(!rows||rows.length<=limit)return rows||[];var out=[],bucket=Math.ceil(rows.length/limit);for(var i=0;i<rows.length;i+=bucket){var slice=rows.slice(i,i+bucket),hi=slice[0],lo=slice[0];slice.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});if(new Date(lo.priceTimeUTC)<new Date(hi.priceTimeUTC)){out.push(lo);if(hi!==lo)out.push(hi)}else{out.push(hi);if(hi!==lo)out.push(lo)}}return out.sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)})}
-window.decimateRows=decimateRows;
-function statsHalf(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0],sum=0;rows.forEach(function(r){var v=Number(r.priceGBPperMWh);sum+=v;if(v>Number(hi.priceGBPperMWh))hi=r;if(v<Number(lo.priceGBPperMWh))lo=r});return{hi:hi,lo:lo,avg:sum/rows.length,hiValue:Number(hi.priceGBPperMWh),loValue:Number(lo.priceGBPperMWh),hiDate:slab(hi.priceTimeUTC)+' '+tlab(hi.priceTimeUTC),loDate:slab(lo.priceTimeUTC)+' '+tlab(lo.priceTimeUTC)}}
-function statsDaily(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0],sum=0,c=0;rows.forEach(function(r){if(r.average!=null){sum+=Number(r.average);c++}if(Number(r.high)>Number(hi.high))hi=r;if(Number(r.low)<Number(lo.low))lo=r});return{hi:hi,lo:lo,avg:c?sum/c:null,hiValue:Number(hi.high),loValue:Number(lo.low),hiDate:hi.date+' '+(hi.highAt||''),loDate:lo.date+' '+(lo.lowAt||'')}}
-function eventBox(g,lines,q,x,y,align){var pad=8*q,lh=18*q,w=0;g.save();g.font='900 '+14*q+'px Courier New';lines.forEach(function(t){w=Math.max(w,g.measureText(t).width)});var h=lines.length*lh+pad*2,xx=align==='right'?x-w-pad*2:x;g.fillStyle='rgba(5,7,12,.78)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,y-h+4*q,w+pad*2,h,6*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#ff3333';g.textAlign=align;lines.forEach(function(t,i){g.fillText(t,x,y-(lines.length-1-i)*lh)});g.restore()}
-function drawPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.5*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-24*q);g.stroke();g.restore()}
-function drawEvents(g,rows,X,Y,q,w,h,pad){var s=statsHalf(rows);if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',s.hiDate],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',s.loDate],q,lxText,lyText,lr?'left':'right')}
-function drawSeasonLine(g,lineRows,X,Y,q){g.save();g.lineWidth=2.1*q;g.lineCap='round';g.lineJoin='round';for(var i=1;i<lineRows.length;i++){var a=lineRows[i-1],b=lineRows[i],col=seasonColor(b.priceTimeUTC);g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=5*q;g.beginPath();g.moveTo(X(a),Y(Number(a.priceGBPperMWh)));g.lineTo(X(b),Y(Number(b.priceGBPperMWh)));g.stroke()}g.restore()}
-function drawDailyLines(g,rows,X,Y,q){['average','high','low'].forEach(function(k){g.save();g.lineWidth=(k==='average'?2.4:1.6)*q;g.setLineDash(k==='average'?[]:(k==='high'?[5*q,4*q]:[2*q,5*q]));g.lineCap='round';g.lineJoin='round';for(var i=1;i<rows.length;i++){var a=rows[i-1],b=rows[i];if(a[k]==null||b[k]==null||isNaN(Number(a[k]))||isNaN(Number(b[k])))continue;var col=seasonColor(b.date+'T12:00:00Z');g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=4*q;g.beginPath();g.moveTo(X(a),Y(Number(a[k])));g.lineTo(X(b),Y(Number(b[k])));g.stroke()}g.restore()});g.save();g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1*q;rows.forEach(function(r){if(r.high==null||r.low==null)return;var x=X(r);g.beginPath();g.moveTo(x,Y(Number(r.high)));g.lineTo(x,Y(Number(r.low)));g.stroke()});g.restore()}
-function drawDailyEvents(g,rows,X,Y,q,w,h,pad){var s=statsDaily(rows);if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',s.hiDate],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',s.loDate],q,lxText,lyText,lr?'left':'right')}
-function drawSummary(g,stats,q,w,h,pad){if(!stats)return;var y=h-44*q;g.save();g.fillStyle='rgba(5,7,12,.72)';g.strokeStyle='rgba(0,255,255,.26)';g.lineWidth=1*q;g.beginPath();g.roundRect(pad.left,y-22*q,w-pad.left-pad.right,34*q,6*q);g.fill();g.stroke();g.fillStyle='#f5f7fb';g.font='900 '+10*q+'px Courier New';g.textAlign='center';var mid=w/2;g.fillText('HIGH '+pence(stats.hiValue)+'p/kWh (£'+fmt(stats.hiValue,2)+'/MWh)     AVG '+pence(stats.avg)+'p/kWh (£'+fmt(stats.avg,2)+'/MWh)     LOW '+pence(stats.loValue)+'p/kWh (£'+fmt(stats.loValue,2)+'/MWh)',mid,y);g.fillStyle='#9aa3b6';g.font='8.5px Courier New';g.fillText('Indicative conversion for attention only. Formal price unit remains pounds per Megawatt hour.',mid,y+11*q);g.restore()}
-function draw(rows,meta){var c=$('price-history-canvas');if(!c)return;var q=devicePixelRatio||1,r=c.getBoundingClientRect();if(r.width){c.width=Math.max(320,Math.floor(r.width*q));c.height=Math.max(320,Math.floor((r.height||360)*q))}var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:74*q,right:24*q,top:96*q,bottom:154*q};g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var t0=meta?meta.start.getTime():0,t1=meta?meta.end.getTime():1;if(t1<=t0)t1=t0+1;var daily=meta&&meta.mode==='daily';var vals=daily?rows.flatMap(function(x){return [x.high,x.low,x.average].filter(function(v){return v!=null&&!isNaN(Number(v))}).map(Number)}):rows.map(function(x){return Number(x.priceGBPperMWh)});if(vals.length<2){g.fillStyle='#00ffff';g.font=14*q+'px Courier New';g.fillText('No records in selected range.',pad.left,42*q);return}var mm=minMax(vals);function X(r){var t=daily?new Date(r.date+'T12:00:00Z').getTime():new Date(r.priceTimeUTC).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawAxes(g,w,h,q,mm,t0,t1,pad);var s=daily?statsDaily(rows):statsHalf(rows);if(daily){drawDailyLines(g,rows,X,Y,q);drawDailyKey(g,q,pad);drawDailyEvents(g,rows,X,Y,q,w,h,pad)}else{var lineRows=decimateRows(rows,Math.max(900,Math.floor((w/q)*1.8)));drawSeasonLine(g,lineRows,X,Y,q);drawSeasonKey(g,q,w,h,pad);drawEvents(g,rows,X,Y,q,w,h,pad)}drawSummary(g,s,q,w,h,pad)}
-function status(meta,sourceRows,rows,years){var s=$('price-history-range-status');var lab=$('price-history-scroll-label');var mode=meta.mode==='daily'?'daily high low average':'full settlement';var text=dlab(meta.start)+' to '+dlab(meta.end)+' | '+(meta.mode==='daily'?'All hours':timeModeLabel())+' | '+rows.length.toLocaleString('en-GB')+' '+mode+' points';if(s){s.textContent=text;s.className='price-history-range-status'}if(lab)lab.textContent=(meta.mode==='daily'?'Daily high low and average mode.':'Full half hourly settlement data mode.')+' '+periodLabel(meta.period)+'.'}
-function table(rows,meta){var b=$('price-history-table-body');if(!b)return;if(!rows.length){b.innerHTML='<tr><td colspan="5">No records available.</td></tr>';return}if(meta&&meta.mode==='daily'){b.innerHTML=rows.slice().reverse().slice(0,500).map(function(r){return '<tr><td>'+r.date+'</td><td>Avg £'+fmt(r.average,2)+' | High £'+fmt(r.high,2)+' | Low £'+fmt(r.low,2)+'</td><td>'+(r.highAt||'—')+'</td><td>'+(r.lowAt||'—')+'</td><td>'+r.observations+' observations</td></tr>'}).join('');return}b.innerHTML=rows.slice().reverse().slice(0,1000).map(function(r){return '<tr><td>'+dlab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC)+'</td><td>£'+fmt(Number(r.priceGBPperMWh),2)+'/MWh</td><td>'+(r.settlementPeriod||'—')+'</td><td>'+(r.capturedAtUTC?dlab(r.capturedAtUTC)+' '+tlab(r.capturedAtUTC):'—')+'</td><td>'+(r.carbonGperKWh||'—')+'</td></tr>'}).join('')}
-function loadHalfHourly(meta){var years=yearsBetween(meta.start,meta.end);return Promise.all([loadJson()].concat(years.map(loadAnnual))).then(function(parts){var cap=parts[0],sys=[];parts.slice(1).forEach(function(a){sys=sys.concat(a)});var all=merge(norm(sys),norm(cap));var rows=all.filter(function(r){var t=new Date(r.priceTimeUTC);return t>=meta.start&&t<=meta.end&&passesTimeMode(r)});STATE.all=all;STATE.sourceRows=sys.length;STATE.loadedYears=years;return rows})}
-function loadDailyRows(meta){return loadDaily().then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});STATE.all=all;STATE.sourceRows=all.length;STATE.loadedYears=[];return rows})}
-function load(){ensurePeriodOptions();ensureModeTabs();ensureYearOptions();ensureScroller();ensureDiscoveryPanel();var meta=selectedWindow();syncScrollerFromStart();var promise=meta.mode==='daily'?loadDailyRows(meta):loadHalfHourly(meta);promise.then(function(rows){STATE.visible=rows;STATE.meta=meta;STATE.mode=meta.mode;var latest=rows.length?rows[rows.length-1]:null;set('ph-latest-price',latest?(meta.mode==='daily'?'Avg £'+fmt(latest.average,2)+'/MWh':'£'+fmt(Number(latest.priceGBPperMWh),2)+'/MWh'):'—');set('ph-latest-time',latest?(meta.mode==='daily'?latest.date:dlab(latest.priceTimeUTC)+' '+tlab(latest.priceTimeUTC)):'—');set('ph-row-count',String(rows.length));set('ph-source',meta.mode==='daily'?'V5 daily high low average aggregate':'Elexon annual CSVs plus V5 Market Index audit');status(meta,STATE.sourceRows,rows,STATE.loadedYears);table(rows,meta);draw(rows,meta)}).catch(function(){var m={start:new Date(),end:new Date(),period:'7d',mode:'halfhourly'};STATE.visible=[];STATE.meta=m;table([],m);draw([],m)})}
-function deferredLoad(){clearTimeout(pendingTimer);pendingTimer=setTimeout(load,160)}
-window.__v5PriceHistoryControls={load:load,deferredLoad:deferredLoad,periodDays:periodDays,totalScrollableDays:totalScrollableDays,dateFromOffset:dateFromOffset,offsetFromDate:offsetFromDate,syncStartFromScroller:syncStartFromScroller,setOffset:function(v){var r=$('price-history-scroll');if(r){r.value=v;syncStartFromScroller();load()}},setPeriod:function(v){var p=$('price-history-period');if(p){p.value=v;load()}},setMode:function(v){STATE.timeMode=v;load()}};
-document.addEventListener('DOMContentLoaded',function(){ensurePeriodOptions();ensureModeTabs();ensureYearOptions();ensureScroller();ensureDiscoveryPanel();ensureStartDate();var y=$('price-history-year'),p=$('price-history-period'),s=$('price-history-start'),cl=$('price-history-clear-start'),r=$('price-history-scroll'),prev=$('price-history-prev'),next=$('price-history-next');if(cl)cl.remove();if(y)y.addEventListener('change',function(){var st=$('price-history-start');if(st)st.value='';ensureStartDate();load()});if(p)p.addEventListener('change',load);if(s)s.addEventListener('change',function(){syncScrollerFromStart();load()});if(r)r.addEventListener('input',function(){syncStartFromScroller();deferredLoad()});if(prev)prev.addEventListener('click',function(){var rr=$('price-history-scroll');if(!rr)return;rr.value=Math.max(0,Number(rr.value)-Math.max(1,periodDays(($('price-history-period')||{}).value)));syncStartFromScroller();load()});if(next)next.addEventListener('click',function(){var rr=$('price-history-scroll');if(!rr)return;rr.value=Math.min(totalScrollableDays(),Number(rr.value)+Math.max(1,periodDays(($('price-history-period')||{}).value)));syncStartFromScroller();load()});load();setInterval(load,5*60*1000);window.addEventListener('resize',function(){if(STATE.meta)draw(STATE.visible,STATE.meta)})});
+window.V6LoadPriceHistoryData=(function(){
+  var cache={annual:{},daily:null,capture:null};
+  var FIRST_YEAR=2016;
+  function todayMax(){var d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),23,59,59))}
+  function forecastMaxDate(){return new Date(todayMax().getTime()+7*86400000)}
+  function minDate(){return new Date(Date.UTC(FIRST_YEAR,0,1,0,0,0))}
+  function futureMaxDate(){return forecastMaxDate()}
+  function ymd(d){return d.toISOString().slice(0,10)}
+  function mean(vals){var a=vals.filter(function(v){return !isNaN(Number(v))}).map(Number);return a.length?a.reduce(function(x,y){return x+y},0)/a.length:0}
+  function parseCsvLine(line){var out=[],v='',q=false;for(var i=0;i<line.length;i++){var c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){out.push(v);v=''}else v+=c}out.push(v);return out}
+  function parseCsv(text){text=(text||'').trim();if(!text)return[];var lines=text.split(/\r?\n/),head=parseCsvLine(lines[0]).map(function(x){return x.trim()});return lines.slice(1).map(function(line){var cells=parseCsvLine(line),r={};head.forEach(function(h,i){r[h]=(cells[i]||'').trim()});var price=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{source:r.source||'Elexon BMRS System Prices',priceTimeUTC:r.periodStartUTC||r.priceTimeUTC||'',capturedAtUTC:r.fetchedAtUTC||r.capturedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:price,carbonGperKWh:r.carbonGperKWh||'',priceHealth:r.priceHealth||'historical system price'}}).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))})}
+  function norm(rows){var seen={};return(rows||[]).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))}).map(function(r){var o=Object.assign({},r);o.priceGBPperMWh=Number(o.priceGBPperMWh);return o}).sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)}).filter(function(r){var k=r.priceTimeUTC+'|'+r.priceGBPperMWh+'|'+(r.source||'');if(seen[k])return false;seen[k]=1;return true})}
+  function periodDays(p){return {'12hday':0.5,'12hnight':0.5,'1d':1,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[p]||7}
+  function periodLabel(p){return {'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','5y':'5 years','10y':'10 years'}[p]||'1 week'}
+  function isDaily(p){return ['12m','5y','10y'].indexOf(p)>=0}
+  function isDayNight(p){return p==='12hday'||p==='12hnight'}
+  function loadAnnual(year){if(cache.annual[year])return cache.annual[year];cache.annual[year]=fetch(window.V6LiveConfig.annualBase+year+'.csv?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(parseCsv).catch(function(){return[]});return cache.annual[year]}
+  function loadCapture(){if(cache.capture)return cache.capture;cache.capture=fetch(window.V6LiveConfig.priceHistory+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(j){return(j.rows||[]).map(function(r){return{source:r.source||'V6 captured Elexon Market Index Price',priceTimeUTC:r.priceTimeUTC||r.periodStartUTC||'',capturedAtUTC:r.capturedAtUTC||r.fetchedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:r.priceGBPperMWh,carbonGperKWh:r.carbonGperKWh||'',priceHealth:r.priceHealth||'captured system price'}})}).catch(function(){return[]});return cache.capture}
+  function loadDaily(){if(cache.daily)return cache.daily;cache.daily=fetch(window.V6LiveConfig.dailyPriceHistory+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return cache.daily}
+  function years(start,end){var out=[],last=todayMax().getUTCFullYear();for(var y=start.getUTCFullYear();y<=end.getUTCFullYear()&&y<=last;y++)out.push(y);return out}
+  function selectedWindow(start,period){var min=minDate(),fmax=forecastMaxDate();if(isDayNight(period))start.setUTCHours(period==='12hday'?6:18,0,0,0);if(start<min)start=new Date(min);if(start>fmax)start=new Date(fmax);var end=new Date(start.getTime()+periodDays(period)*86400000-1000);if(end>fmax)end=new Date(fmax);return{start:start,end:end,period:period,mode:isDaily(period)?'daily':'halfhourly'}}
+  function loadHalf(meta,timeMode){return Promise.all([loadCapture()].concat(years(meta.start,meta.end).map(loadAnnual))).then(function(parts){var cap=parts[0],sys=[];parts.slice(1).forEach(function(p){sys=sys.concat(p)});var all=norm(sys.concat(cap));return all.filter(function(r){var t=new Date(r.priceTimeUTC);if(t<meta.start||t>meta.end)return false;if(timeMode==='day'){var h=t.getUTCHours();return h>=6&&h<18}if(timeMode==='night'){var hn=t.getUTCHours();return hn>=18||hn<6}return true})})}
+  function loadWindow(start,period,timeMode){var meta=selectedWindow(new Date(start),period);if(meta.mode==='daily')return loadDaily().then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});return{mode:'daily',start:meta.start,end:meta.end,period:period,timeMode:timeMode||'all',rows:rows,forecastRows:[]}});return loadHalf(meta,timeMode||'all').then(function(rows){return{mode:'halfhourly',start:meta.start,end:meta.end,period:period,timeMode:timeMode||'all',rows:rows,forecastRows:[]}})}
+  function sameMonthDay(row,target){return row.date&&row.date.slice(5,10)===target.slice(5,10)}
+  function sameMonthDow(row,d){var rd=new Date(row.date+'T12:00:00Z');return rd.getUTCMonth()===d.getUTCMonth()&&rd.getUTCDay()===d.getUTCDay()}
+  function forecastPoint(all,targetDate){var target=ymd(targetDate),actual=(all||[]).find(function(r){return r.date===target&&r.high!=null&&r.low!=null&&r.average!=null});if(actual)return{date:target,high:Number(actual.high),average:Number(actual.average),low:Number(actual.low),status:'actual',source:'Published Elexon daily aggregate'};var historic=(all||[]).filter(function(r){return r.date<target&&r.high!=null&&r.low!=null&&r.average!=null&&sameMonthDay(r,target)});if(historic.length<3)historic=(all||[]).filter(function(r){return r.date<target&&r.high!=null&&r.low!=null&&r.average!=null&&sameMonthDow(r,targetDate)});return{date:target,high:Number(mean(historic.map(function(r){return r.high})).toFixed(2)),average:Number(mean(historic.map(function(r){return r.average})).toFixed(2)),low:Number(mean(historic.map(function(r){return r.low})).toFixed(2)),status:'forecast',source:'10 year daily average baseline'}}
+  function loadForecastWindow(){return loadDaily().then(function(all){var start=new Date(todayMax().getTime()+1000),rows=[];for(var i=0;i<7;i++){rows.push(forecastPoint(all,new Date(start.getTime()+i*86400000)))}return{mode:'forecast_daily',start:start,end:new Date(start.getTime()+6*86400000),rows:rows,method:'Forecast values are the 10 year daily average for high, average and low on the matching calendar day, with month and weekday fallback. If published actual daily data exists for a date, it replaces the forecast value.'}})}
+  return{loadWindow:loadWindow,loadForecastWindow:loadForecastWindow,periodDays:periodDays,periodLabel:periodLabel,isDaily:isDaily,minDate:minDate,maxDate:todayMax,futureMaxDate:futureMaxDate};
 })();
```

### `uk_energy_tracking_v5/price-history-ui.js` versus `uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js`

```diff
--- uk_energy_tracking_v5/price-history-ui.js
+++ uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js
@@ -1,78 +1,24 @@
-(function(){
-var JSON_URL='/uk_energy_tracking_v5/electricity_price_history.json';
-var DAILY_URL='/uk_energy_tracking_v5/electricity_price_history_daily_decade.json';
-var DAILY_FALLBACK_URL='/uk_energy_tracking_v5/electricity_price_history_4bucket_decade.json';
-var ANNUAL_URL_BASE='/data/electricity/elexon_system_prices_';
-var FIRST_YEAR=2016;
-var MIN_DATE=new Date(Date.UTC(FIRST_YEAR,0,1,0,0,0));
-var TODAY=new Date();
-var MAX_DATE=new Date(Date.UTC(TODAY.getUTCFullYear(),TODAY.getUTCMonth(),TODAY.getUTCDate(),23,59,59));
-var ANNUAL_CACHE={}, DAILY_CACHE=null, CAPTURE_CACHE=null;
-var pendingTimer=null;
-var STATE={all:[],visible:[],meta:null,loadedYears:[],sourceRows:0,timeMode:'all',mode:'halfhourly'};
-window.__v5PriceHistoryState=STATE;
-function $(id){return document.getElementById(id)}
-function fmt(n,d){return n==null||isNaN(n)?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
-function pence(n){return n==null||isNaN(n)?'—':fmt(Number(n)/10,2)}
-function dlab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
-function slab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
-function tlab(t){return new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
-function axisLabel(t,span){return span<=45*86400000?slab(t):new Date(t).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
-function ymd(d){return d.toISOString().slice(0,10)}
-function set(id,v){var e=$(id);if(e)e.textContent=v}
-function timeModeLabel(){if(STATE.timeMode==='day')return 'Day 06 to 18 UTC';if(STATE.timeMode==='night')return 'Night 18 to 06 UTC';return 'All hours'}
-function csvLine(l){var o=[],v='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){o.push(v);v=''}else v+=c}o.push(v);return o}
-function parseCsv(t){t=(t||'').trim();if(!t)return[];var lines=t.split(/\r?\n/),h=csvLine(lines[0]).map(function(x){return x.trim()});return lines.slice(1).map(function(line){var c=csvLine(line),r={};h.forEach(function(x,i){r[x]=(c[i]||'').trim()});var p=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{source:r.source||'Elexon BMRS System Prices',priceTimeUTC:r.periodStartUTC||r.priceTimeUTC||'',capturedAtUTC:r.fetchedAtUTC||r.capturedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:p,carbonGperKWh:r.carbonGperKWh||'',carbonIndex:r.carbonIndex||'',priceHealth:r.priceHealth||'historical system price',carbonHealth:r.carbonHealth||'',netImbalanceVolumeMWh:r.netImbalanceVolumeMWh||''}}).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))})}
-function loadJson(){if(CAPTURE_CACHE)return CAPTURE_CACHE;CAPTURE_CACHE=fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return CAPTURE_CACHE}
-function loadAnnual(year){if(ANNUAL_CACHE[year])return ANNUAL_CACHE[year];ANNUAL_CACHE[year]=fetch(ANNUAL_URL_BASE+year+'.csv?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(parseCsv).catch(function(){return[]});return ANNUAL_CACHE[year]}
-function convert4Bucket(d){return (d.rows||[]).map(function(r){var vals=[r.night,r.morning,r.midday,r.evening].filter(function(v){return v!=null&&!isNaN(Number(v))}).map(Number);return{date:r.date,average:vals.length?Number((vals.reduce(function(a,b){return a+b},0)/vals.length).toFixed(2)):null,high:r.peakPrice!=null?Number(r.peakPrice):(vals.length?Math.max.apply(null,vals):null),highAt:r.peakAt||'',low:vals.length?Math.min.apply(null,vals):null,lowAt:'',observations:r.observations||0}})}
-function loadDaily(){if(DAILY_CACHE)return DAILY_CACHE;DAILY_CACHE=fetch(DAILY_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('daily missing');return r.json()}).then(function(d){return d.rows||[]}).catch(function(){return fetch(DAILY_FALLBACK_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(convert4Bucket).catch(function(){return[]})});return DAILY_CACHE}
-function yearsBetween(a,b){var y=[],s=a.getUTCFullYear(),e=b.getUTCFullYear();for(var n=s;n<=e;n++)y.push(n);return y}
-function norm(rows){var seen={};return(rows||[]).filter(function(r){return r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))}).map(function(r){var o=Object.assign({},r);o.priceGBPperMWh=Number(o.priceGBPperMWh);return o}).sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)}).filter(function(r){var k=r.priceTimeUTC+'|'+r.priceGBPperMWh+'|'+(r.source||'');if(seen[k])return false;seen[k]=1;return true})}
-function merge(sys,cap){var rows=[];sys.forEach(function(r){rows.push(Object.assign({},r,{source:'Elexon BMRS System Prices',priceHealth:r.priceHealth||'historical system price'}))});cap.forEach(function(r){rows.push(Object.assign({},r,{source:r.source||'V5 captured Elexon Market Index Price'}))});return norm(rows)}
-function periodDays(period){return {'12hday':0.5,'12hnight':0.5,'1d':1,'7d':7,'30d':30,'3m':92,'6m':183,'12m':366,'5y':1827,'10y':3653}[period]||7}
-function periodLabel(period){return {'12hday':'12 hours day','12hnight':'12 hours night','1d':'1 day','7d':'1 week','30d':'1 month','3m':'3 months','6m':'6 months','12m':'12 months','5y':'5 years','10y':'10 years'}[period]||'1 week'}
-function isDailyPeriod(p){return ['6m','12m','5y','10y'].indexOf(p)>=0}
-function isDayNightPeriod(p){return p==='12hday'||p==='12hnight'}
-function totalScrollableDays(){return Math.max(1,Math.floor((MAX_DATE-MIN_DATE)/86400000))}
-function dateFromOffset(v){var d=new Date(MIN_DATE.getTime()+Number(v)*86400000);d.setUTCHours(0,0,0,0);return d}
-function offsetFromDate(d){return Math.max(0,Math.min(totalScrollableDays(),Math.floor((d-MIN_DATE)/86400000)))}
-function ensurePeriodOptions(){var p=$('price-history-period');if(!p)return;var wanted=[['12hday','12 hours day'],['12hnight','12 hours night'],['1d','1 day'],['7d','1 week'],['30d','1 month'],['3m','3 months'],['6m','6 months'],['12m','12 months'],['5y','5 years'],['10y','10 years']];var current=p.value||'7d';p.innerHTML='';wanted.forEach(function(x){var o=document.createElement('option');o.value=x[0];o.textContent=x[1];p.appendChild(o)});p.value=current&&wanted.some(function(x){return x[0]===current})?current:'7d'}
-function ensureModeTabs(){if($('price-history-time-tabs'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var tabs=document.createElement('div');tabs.id='price-history-time-tabs';tabs.className='price-history-time-tabs';tabs.innerHTML='<span>Hour filter</span><button type="button" data-mode="all" class="active">All</button><button type="button" data-mode="day">Day</button><button type="button" data-mode="night">Night</button>';actions.appendChild(tabs);tabs.addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;STATE.timeMode=b.getAttribute('data-mode');tabs.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});load()})}
-function ensureScroller(){if($('price-history-scroll'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var wrap=document.createElement('div');wrap.className='price-history-scroller';wrap.innerHTML='<div class="price-history-scroller-head"><strong>History scroller</strong><span id="price-history-scroll-label">1 day, 1 week, 1 month and 3 months use full settlement data. 6 months and longer use daily high, low and average.</span></div><div class="price-history-scroll-row"><button type="button" id="price-history-prev">◀</button><input id="price-history-scroll" type="range" min="0" max="'+totalScrollableDays()+'" step="1"><button type="button" id="price-history-next">▶</button></div>';actions.parentNode.insertBefore(wrap,actions.nextSibling);var style=document.createElement('style');style.textContent='.price-history-scroller,.price-history-time-tabs{width:100%;border:1px solid var(--gg-line,#252b36);background:rgba(255,255,255,.025);border-radius:6px;padding:10px 12px;margin:10px 0}.price-history-scroller-head{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--gg-muted,#9aa3b6);font:11px Courier New,monospace;letter-spacing:.08em;text-transform:uppercase}.price-history-scroller-head strong{color:var(--gg-cyan,#00ffff)}.price-history-scroll-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-top:8px}.price-history-scroll-row button,.price-history-time-tabs button{border:1px solid var(--gg-line,#252b36);border-radius:4px;background:rgba(0,255,255,.05);color:#00ffff;padding:7px 10px;font-family:Courier New,monospace}.price-history-time-tabs button.active{background:rgba(0,255,255,.18);box-shadow:0 0 10px rgba(0,255,255,.12)}.price-history-time-tabs{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--gg-muted,#9aa3b6);font:11px Courier New,monospace;text-transform:uppercase;letter-spacing:.08em}.price-history-scroll-row input[type=range]{width:100%;accent-color:#00ffff}.price-history-device-note{color:#ff9900!important}.price-history-discovery{border:1px solid rgba(0,255,255,.28);background:rgba(0,255,255,.035);border-radius:6px;padding:10px 12px;margin:10px 0;color:#9aa3b6;font:12px Courier New,monospace;line-height:1.55}.price-history-discovery summary{cursor:pointer;color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.price-history-discovery strong{color:#f5f7fb}.price-history-discovery p{margin:8px 0 0}';document.head.appendChild(style)}
-function ensureDiscoveryPanel(){if($('price-history-discovery'))return;var canvas=$('price-history-canvas');if(!canvas||!canvas.parentNode)return;var d=document.createElement('details');d.id='price-history-discovery';d.className='price-history-discovery';d.innerHTML='<summary>What does this Elexon price mean?</summary><p><strong>Interpretation:</strong> this is an Elexon System Price / imbalance price signal used in GB electricity settlement. It is not a retail tariff and it is not a simple consumer wholesale bill.</p><p><strong>Market meaning:</strong> it reflects the marginal stress or surplus cost of balancing the power system in each settlement period. It can correlate with wholesale spot prices, but it is a balancing and settlement signal rather than a pure day ahead or intraday merchant price.</p><p><strong>How to read the chart:</strong> p/kWh values are indicative equivalents for human intuition. The formal unit remains £/MWh. High, average and low boxes expose volatility, storage opportunity and system stress.</p>';canvas.parentNode.insertBefore(d,canvas)}
-function ensureYearOptions(){var y=$('price-history-year');if(!y||y.options.length)return;var nowYear=MAX_DATE.getUTCFullYear();for(var n=nowYear;n>=FIRST_YEAR;n--){var o=document.createElement('option');o.value=String(n);o.textContent=String(n);y.appendChild(o)}y.value=String(nowYear)}
-function ensureStartDate(){var y=$('price-history-year'),s=$('price-history-start');if(!s)return;var selectedYear=y&&y.value?Number(y.value):MAX_DATE.getUTCFullYear();if(!s.value||s.value.slice(0,4)!==String(selectedYear)){var start;if(selectedYear===MAX_DATE.getUTCFullYear()){start=new Date(MAX_DATE.getTime()-7*86400000)}else{start=new Date(Date.UTC(selectedYear,0,1,0,0,0))}s.value=ymd(start)}syncScrollerFromStart()}
-function syncScrollerFromStart(){var s=$('price-history-start'),r=$('price-history-scroll');if(!s||!r||!s.value)return;r.value=String(offsetFromDate(new Date(s.value+'T00:00:00Z')))}
-function syncStartFromScroller(){var r=$('price-history-scroll'),s=$('price-history-start'),y=$('price-history-year');if(!r||!s)return;var d=dateFromOffset(r.value);s.value=ymd(d);if(y)y.value=String(d.getUTCFullYear())}
-function selectedWindow(){ensureStartDate();var y=$('price-history-year'),s=$('price-history-start'),p=$('price-history-period');var year=y&&y.value?Number(y.value):MAX_DATE.getUTCFullYear();var period=p&&p.value?p.value:'7d';var start=s&&s.value?new Date(s.value+'T00:00:00Z'):new Date(Date.UTC(year,0,1,0,0,0));if(isNaN(start))start=new Date(Date.UTC(year,0,1,0,0,0));if(isDayNightPeriod(period)){start.setUTCHours(period==='12hday'?6:18,0,0,0)}if(start<MIN_DATE)start=new Date(MIN_DATE);if(start>MAX_DATE)start=new Date(MAX_DATE);if(s)s.value=ymd(start);if(y)y.value=String(start.getUTCFullYear());var days=periodDays(period);var end=new Date(start.getTime()+days*86400000-1000);if(end>MAX_DATE)end=new Date(MAX_DATE);return{start:start,end:end,label:start.getUTCFullYear()+' '+period,period:period,year:start.getUTCFullYear(),capped:false,timeMode:STATE.timeMode,mode:isDailyPeriod(period)?'daily':'halfhourly'}}
-function passesTimeMode(r){if(STATE.timeMode==='all')return true;var h=new Date(r.priceTimeUTC).getUTCHours();var day=h>=6&&h<18;return STATE.timeMode==='day'?day:!day}
-function minMax(v){var lo=0,hi=0;v.forEach(function(x){if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=(hi-lo)*0.06;return{lo:lo-m,hi:hi+m}}
-function niceStep(span){var raw=span/10,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
-function seasonName(t){var m=new Date(t).getUTCMonth()+1;if(m===12||m<=2)return'Winter';if(m>=3&&m<=5)return'Spring';if(m>=6&&m<=8)return'Summer';return'Autumn'}
-function seasonColor(t){var s=seasonName(t);if(s==='Winter')return'#00ffff';if(s==='Spring')return'#00ff88';if(s==='Summer')return'#ffcc00';return'#c79245'}
-function drawSeasonKey(g,q,w,h,pad){var items=[['Winter','#00ffff'],['Spring','#00ff88'],['Summer','#ffcc00'],['Autumn','#c79245']],x=pad.left,y=pad.top-24*q;g.save();g.font=9*q+'px Courier New';items.forEach(function(it){g.fillStyle=it[1];g.shadowColor=it[1];g.shadowBlur=4*q;g.fillRect(x,y-7*q,8*q,8*q);g.shadowBlur=0;g.fillStyle='#9aa3b6';g.fillText(it[0],x+12*q,y);x+=58*q});g.restore()}
-function drawDailyKey(g,q,pad){drawSeasonKey(g,q,0,0,pad);g.save();g.fillStyle='#9aa3b6';g.font=9*q+'px Courier New';g.fillText('Daily high low average shown in seasonal colours',pad.left,pad.top-8*q);g.restore()}
-function drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}
-function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step,span=t1-t0;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle='#f5f7fb';g.fillText('£'+fmt(val,0),8*q,yy+4*q)}for(var i=0;i<2;i++){var ts=i===0?t0:t1,x=i===0?pad.left:w-pad.right;g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();drawDateTick(g,x,h-74*q,ts,q,i===0?'left':'right',span)}}
-function decimateRows(rows,limit){if(!rows||rows.length<=limit)return rows||[];var out=[],bucket=Math.ceil(rows.length/limit);for(var i=0;i<rows.length;i+=bucket){var slice=rows.slice(i,i+bucket),hi=slice[0],lo=slice[0];slice.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});if(new Date(lo.priceTimeUTC)<new Date(hi.priceTimeUTC)){out.push(lo);if(hi!==lo)out.push(hi)}else{out.push(hi);if(hi!==lo)out.push(lo)}}return out.sort(function(a,b){return new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)})}
-window.decimateRows=decimateRows;
-function statsHalf(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0],sum=0;rows.forEach(function(r){var v=Number(r.priceGBPperMWh);sum+=v;if(v>Number(hi.priceGBPperMWh))hi=r;if(v<Number(lo.priceGBPperMWh))lo=r});return{hi:hi,lo:lo,avg:sum/rows.length,hiValue:Number(hi.priceGBPperMWh),loValue:Number(lo.priceGBPperMWh),hiDate:slab(hi.priceTimeUTC)+' '+tlab(hi.priceTimeUTC),loDate:slab(lo.priceTimeUTC)+' '+tlab(lo.priceTimeUTC)}}
-function statsDaily(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0],sum=0,c=0;rows.forEach(function(r){if(r.average!=null){sum+=Number(r.average);c++}if(Number(r.high)>Number(hi.high))hi=r;if(Number(r.low)<Number(lo.low))lo=r});return{hi:hi,lo:lo,avg:c?sum/c:null,hiValue:Number(hi.high),loValue:Number(lo.low),hiDate:hi.date+' '+(hi.highAt||''),loDate:lo.date+' '+(lo.lowAt||'')}}
-function eventBox(g,lines,q,x,y,align){var pad=8*q,lh=18*q,w=0;g.save();g.font='900 '+14*q+'px Courier New';lines.forEach(function(t){w=Math.max(w,g.measureText(t).width)});var h=lines.length*lh+pad*2,xx=align==='right'?x-w-pad*2:x;g.fillStyle='rgba(5,7,12,.78)';g.strokeStyle='rgba(0,255,255,.35)';g.lineWidth=1*q;g.shadowColor='rgba(0,255,255,.24)';g.shadowBlur=8*q;g.beginPath();g.roundRect(xx,y-h+4*q,w+pad*2,h,6*q);g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#ff3333';g.textAlign=align;lines.forEach(function(t,i){g.fillText(t,x,y-(lines.length-1-i)*lh)});g.restore()}
-function drawPointer(g,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.55)';g.shadowBlur=7*q;g.lineWidth=1.5*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y-24*q);g.stroke();g.restore()}
-function drawEvents(g,rows,X,Y,q,w,h,pad){var s=statsHalf(rows);if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',s.hiDate],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',s.loDate],q,lxText,lyText,lr?'left':'right')}
-function drawSeasonLine(g,lineRows,X,Y,q){g.save();g.lineWidth=2.1*q;g.lineCap='round';g.lineJoin='round';for(var i=1;i<lineRows.length;i++){var a=lineRows[i-1],b=lineRows[i],col=seasonColor(b.priceTimeUTC);g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=5*q;g.beginPath();g.moveTo(X(a),Y(Number(a.priceGBPperMWh)));g.lineTo(X(b),Y(Number(b.priceGBPperMWh)));g.stroke()}g.restore()}
-function drawDailyLines(g,rows,X,Y,q){['average','high','low'].forEach(function(k){g.save();g.lineWidth=(k==='average'?2.4:1.6)*q;g.setLineDash(k==='average'?[]:(k==='high'?[5*q,4*q]:[2*q,5*q]));g.lineCap='round';g.lineJoin='round';for(var i=1;i<rows.length;i++){var a=rows[i-1],b=rows[i];if(a[k]==null||b[k]==null||isNaN(Number(a[k]))||isNaN(Number(b[k])))continue;var col=seasonColor(b.date+'T12:00:00Z');g.strokeStyle=col;g.shadowColor=col;g.shadowBlur=4*q;g.beginPath();g.moveTo(X(a),Y(Number(a[k])));g.lineTo(X(b),Y(Number(b[k])));g.stroke()}g.restore()});g.save();g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1*q;rows.forEach(function(r){if(r.high==null||r.low==null)return;var x=X(r);g.beginPath();g.moveTo(x,Y(Number(r.high)));g.lineTo(x,Y(Number(r.low)));g.stroke()});g.restore()}
-function drawDailyEvents(g,rows,X,Y,q,w,h,pad){var s=statsDaily(rows);if(!s)return;var hx=X(s.hi),hy=Y(s.hiValue),lx=X(s.lo),ly=Y(s.loValue);g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=8*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hr=hx<w/2,lr=lx<w/2;var hxText=hr?Math.min(w-pad.right-150*q,hx+18*q):Math.max(pad.left+150*q,hx-18*q);var lxText=lr?Math.min(w-pad.right-150*q,lx+18*q):Math.max(pad.left+150*q,lx-18*q);var hyText=Math.max(pad.top+54*q,hy-24*q);var lyText=Math.min(h-pad.bottom-28*q,ly+54*q);drawPointer(g,{x:hx,y:hy},q,hxText,hyText);drawPointer(g,{x:lx,y:ly},q,lxText,lyText);eventBox(g,['HIGH','£'+fmt(s.hiValue,2)+'/MWh',s.hiDate],q,hxText,hyText,hr?'left':'right');eventBox(g,['LOW','£'+fmt(s.loValue,2)+'/MWh',s.loDate],q,lxText,lyText,lr?'left':'right')}
-function drawSummary(g,stats,q,w,h,pad){if(!stats)return;var y=h-44*q;g.save();g.fillStyle='rgba(5,7,12,.72)';g.strokeStyle='rgba(0,255,255,.26)';g.lineWidth=1*q;g.beginPath();g.roundRect(pad.left,y-22*q,w-pad.left-pad.right,34*q,6*q);g.fill();g.stroke();g.fillStyle='#f5f7fb';g.font='900 '+10*q+'px Courier New';g.textAlign='center';var mid=w/2;g.fillText('HIGH '+pence(stats.hiValue)+'p/kWh (£'+fmt(stats.hiValue,2)+'/MWh)     AVG '+pence(stats.avg)+'p/kWh (£'+fmt(stats.avg,2)+'/MWh)     LOW '+pence(stats.loValue)+'p/kWh (£'+fmt(stats.loValue,2)+'/MWh)',mid,y);g.fillStyle='#9aa3b6';g.font='8.5px Courier New';g.fillText('Indicative conversion for attention only. Formal price unit remains pounds per Megawatt hour.',mid,y+11*q);g.restore()}
-function draw(rows,meta){var c=$('price-history-canvas');if(!c)return;var q=devicePixelRatio||1,r=c.getBoundingClientRect();if(r.width){c.width=Math.max(320,Math.floor(r.width*q));c.height=Math.max(320,Math.floor((r.height||360)*q))}var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:74*q,right:24*q,top:96*q,bottom:154*q};g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);var t0=meta?meta.start.getTime():0,t1=meta?meta.end.getTime():1;if(t1<=t0)t1=t0+1;var daily=meta&&meta.mode==='daily';var vals=daily?rows.flatMap(function(x){return [x.high,x.low,x.average].filter(function(v){return v!=null&&!isNaN(Number(v))}).map(Number)}):rows.map(function(x){return Number(x.priceGBPperMWh)});if(vals.length<2){g.fillStyle='#00ffff';g.font=14*q+'px Courier New';g.fillText('No records in selected range.',pad.left,42*q);return}var mm=minMax(vals);function X(r){var t=daily?new Date(r.date+'T12:00:00Z').getTime():new Date(r.priceTimeUTC).getTime();return pad.left+((t-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((mm.hi-v)/(mm.hi-mm.lo))*(h-pad.top-pad.bottom)}drawAxes(g,w,h,q,mm,t0,t1,pad);var s=daily?statsDaily(rows):statsHalf(rows);if(daily){drawDailyLines(g,rows,X,Y,q);drawDailyKey(g,q,pad);drawDailyEvents(g,rows,X,Y,q,w,h,pad)}else{var lineRows=decimateRows(rows,Math.max(900,Math.floor((w/q)*1.8)));drawSeasonLine(g,lineRows,X,Y,q);drawSeasonKey(g,q,w,h,pad);drawEvents(g,rows,X,Y,q,w,h,pad)}drawSummary(g,s,q,w,h,pad)}
-function status(meta,sourceRows,rows,years){var s=$('price-history-range-status');var lab=$('price-history-scroll-label');var mode=meta.mode==='daily'?'daily high low average':'full settlement';var text=dlab(meta.start)+' to '+dlab(meta.end)+' | '+(meta.mode==='daily'?'All hours':timeModeLabel())+' | '+rows.length.toLocaleString('en-GB')+' '+mode+' points';if(s){s.textContent=text;s.className='price-history-range-status'}if(lab)lab.textContent=(meta.mode==='daily'?'Daily high low and average mode.':'Full half hourly settlement data mode.')+' '+periodLabel(meta.period)+'.'}
-function table(rows,meta){var b=$('price-history-table-body');if(!b)return;if(!rows.length){b.innerHTML='<tr><td colspan="5">No records available.</td></tr>';return}if(meta&&meta.mode==='daily'){b.innerHTML=rows.slice().reverse().slice(0,500).map(function(r){return '<tr><td>'+r.date+'</td><td>Avg £'+fmt(r.average,2)+' | High £'+fmt(r.high,2)+' | Low £'+fmt(r.low,2)+'</td><td>'+(r.highAt||'—')+'</td><td>'+(r.lowAt||'—')+'</td><td>'+r.observations+' observations</td></tr>'}).join('');return}b.innerHTML=rows.slice().reverse().slice(0,1000).map(function(r){return '<tr><td>'+dlab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC)+'</td><td>£'+fmt(Number(r.priceGBPperMWh),2)+'/MWh</td><td>'+(r.settlementPeriod||'—')+'</td><td>'+(r.capturedAtUTC?dlab(r.capturedAtUTC)+' '+tlab(r.capturedAtUTC):'—')+'</td><td>'+(r.carbonGperKWh||'—')+'</td></tr>'}).join('')}
-function loadHalfHourly(meta){var years=yearsBetween(meta.start,meta.end);return Promise.all([loadJson()].concat(years.map(loadAnnual))).then(function(parts){var cap=parts[0],sys=[];parts.slice(1).forEach(function(a){sys=sys.concat(a)});var all=merge(norm(sys),norm(cap));var rows=all.filter(function(r){var t=new Date(r.priceTimeUTC);return t>=meta.start&&t<=meta.end&&passesTimeMode(r)});STATE.all=all;STATE.sourceRows=sys.length;STATE.loadedYears=years;return rows})}
-function loadDailyRows(meta){return loadDaily().then(function(all){var rows=all.filter(function(r){var t=new Date(r.date+'T12:00:00Z');return t>=meta.start&&t<=meta.end});STATE.all=all;STATE.sourceRows=all.length;STATE.loadedYears=[];return rows})}
-function load(){ensurePeriodOptions();ensureModeTabs();ensureYearOptions();ensureScroller();ensureDiscoveryPanel();var meta=selectedWindow();syncScrollerFromStart();var promise=meta.mode==='daily'?loadDailyRows(meta):loadHalfHourly(meta);promise.then(function(rows){STATE.visible=rows;STATE.meta=meta;STATE.mode=meta.mode;var latest=rows.length?rows[rows.length-1]:null;set('ph-latest-price',latest?(meta.mode==='daily'?'Avg £'+fmt(latest.average,2)+'/MWh':'£'+fmt(Number(latest.priceGBPperMWh),2)+'/MWh'):'—');set('ph-latest-time',latest?(meta.mode==='daily'?latest.date:dlab(latest.priceTimeUTC)+' '+tlab(latest.priceTimeUTC)):'—');set('ph-row-count',String(rows.length));set('ph-source',meta.mode==='daily'?'V5 daily high low average aggregate':'Elexon annual CSVs plus V5 Market Index audit');status(meta,STATE.sourceRows,rows,STATE.loadedYears);table(rows,meta);draw(rows,meta)}).catch(function(){var m={start:new Date(),end:new Date(),period:'7d',mode:'halfhourly'};STATE.visible=[];STATE.meta=m;table([],m);draw([],m)})}
-function deferredLoad(){clearTimeout(pendingTimer);pendingTimer=setTimeout(load,160)}
-window.__v5PriceHistoryControls={load:load,deferredLoad:deferredLoad,periodDays:periodDays,totalScrollableDays:totalScrollableDays,dateFromOffset:dateFromOffset,offsetFromDate:offsetFromDate,syncStartFromScroller:syncStartFromScroller,setOffset:function(v){var r=$('price-history-scroll');if(r){r.value=v;syncStartFromScroller();load()}},setPeriod:function(v){var p=$('price-history-period');if(p){p.value=v;load()}},setMode:function(v){STATE.timeMode=v;load()}};
-document.addEventListener('DOMContentLoaded',function(){ensurePeriodOptions();ensureModeTabs();ensureYearOptions();ensureScroller();ensureDiscoveryPanel();ensureStartDate();var y=$('price-history-year'),p=$('price-history-period'),s=$('price-history-start'),cl=$('price-history-clear-start'),r=$('price-history-scroll'),prev=$('price-history-prev'),next=$('price-history-next');if(cl)cl.remove();if(y)y.addEventListener('change',function(){var st=$('price-history-start');if(st)st.value='';ensureStartDate();load()});if(p)p.addEventListener('change',load);if(s)s.addEventListener('change',function(){syncScrollerFromStart();load()});if(r)r.addEventListener('input',function(){syncStartFromScroller();deferredLoad()});if(prev)prev.addEventListener('click',function(){var rr=$('price-history-scroll');if(!rr)return;rr.value=Math.max(0,Number(rr.value)-Math.max(1,periodDays(($('price-history-period')||{}).value)));syncStartFromScroller();load()});if(next)next.addEventListener('click',function(){var rr=$('price-history-scroll');if(!rr)return;rr.value=Math.min(totalScrollableDays(),Number(rr.value)+Math.max(1,periodDays(($('price-history-period')||{}).value)));syncStartFromScroller();load()});load();setInterval(load,5*60*1000);window.addEventListener('resize',function(){if(STATE.meta)draw(STATE.visible,STATE.meta)})});
+window.V6ControlPriceHistory=(function(){
+  var FIRST_YEAR=2016;
+  var STATE={timeMode:'all'};
+  function $(id){return document.getElementById(id)}
+  function ymd(d){return d.toISOString().slice(0,10)}
+  function maxDate(){return window.V6LoadPriceHistoryData.maxDate()}
+  function futureMaxDate(){return window.V6LoadPriceHistoryData.futureMaxDate?window.V6LoadPriceHistoryData.futureMaxDate():maxDate()}
+  function minDate(){return window.V6LoadPriceHistoryData.minDate()}
+  function periodDays(p){return window.V6LoadPriceHistoryData.periodDays(p)}
+  function ensureYearOptions(){var y=$('price-history-year');if(!y||y.options.length)return;var now=futureMaxDate().getUTCFullYear();for(var n=now;n>=FIRST_YEAR;n--){var o=document.createElement('option');o.value=String(n);o.textContent=String(n);y.appendChild(o)}y.value=String(maxDate().getUTCFullYear())}
+  function ensureStartDate(){var y=$('price-history-year'),s=$('price-history-start');if(!s)return;var selectedYear=y&&y.value?Number(y.value):maxDate().getUTCFullYear();if(!s.value||s.value.slice(0,4)!==String(selectedYear)){var start;if(selectedYear===maxDate().getUTCFullYear()){start=new Date(maxDate().getTime()-7*86400000)}else{start=new Date(Date.UTC(selectedYear,0,1,0,0,0))}s.value=ymd(start)}}
+  function ensureModeTabs(){if($('price-history-time-tabs'))return;var actions=document.querySelector('#electricity-price-history-panel .price-history-actions');if(!actions)return;var tabs=document.createElement('div');tabs.id='price-history-time-tabs';tabs.className='price-history-time-tabs';tabs.innerHTML='<span>Hour filter</span><button type="button" data-mode="all" class="active">All</button><button type="button" data-mode="day">Day</button><button type="button" data-mode="night">Night</button>';actions.appendChild(tabs);tabs.addEventListener('click',function(e){var b=e.target.closest('button[data-mode]');if(!b)return;STATE.timeMode=b.getAttribute('data-mode');tabs.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});load()})}
+  function currentPeriod(){var p=$('price-history-period');return p&&p.value?p.value:'7d'}
+  function nudgePeriod(direction){var s=$('price-history-start');if(!s)return;var period=currentPeriod();var current=s.value?new Date(s.value+'T00:00:00Z'):new Date(maxDate().getTime()-7*86400000);var days=Math.max(1,Math.round(periodDays(period)));var next=new Date(current.getTime()+direction*days*86400000);if(next<minDate())next=minDate();if(next>futureMaxDate())next=futureMaxDate();s.value=ymd(next);var y=$('price-history-year');if(y)y.value=String(next.getUTCFullYear());load()}
+  function attachPeriodButtons(scope){var back=$(scope+'-back'),forward=$(scope+'-forward');if(back&&!back.dataset.bound){back.dataset.bound='1';back.addEventListener('click',function(){nudgePeriod(-1)})}if(forward&&!forward.dataset.bound){forward.dataset.bound='1';forward.addEventListener('click',function(){nudgePeriod(1)})}}
+  function ensurePeriodControls(){if($('price-history-period-nav'))return;var canvas=$('price-history-canvas');if(!canvas||!canvas.parentNode)return;var nav=document.createElement('div');nav.id='price-history-period-nav';nav.className='price-history-chart-nav';nav.innerHTML='<button type="button" id="price-history-period-back">◀ Previous period</button><button type="button" id="price-history-period-forward">Next period ▶</button>';canvas.parentNode.insertBefore(nav,canvas.nextSibling);attachPeriodButtons('price-history-period')}
+  var pending=null;
+  function debouncedLoad(){clearTimeout(pending);pending=setTimeout(load,120)}
+  function load(){ensureStartDate();var s=$('price-history-start'),period=currentPeriod();var start=s&&s.value?new Date(s.value+'T00:00:00Z'):new Date(maxDate().getTime()-7*86400000);return window.V6LoadPriceHistoryData.loadWindow(start,period,STATE.timeMode).then(function(result){var meta=$('price-history-fullscreen-meta');if(meta)meta.textContent=new Date(result.start).toLocaleDateString('en-GB')+' to '+new Date(result.end).toLocaleDateString('en-GB')+' · '+(result.mode==='daily'?'daily average / baseline':'full settlement');window.V6RenderPriceChart.render(result)})}
+  function openFullscreen(){var o=$('price-history-fullscreen-overlay');if(!o)return;o.classList.add('open');document.documentElement.classList.add('v5-chart-open');document.body.classList.add('v5-chart-open');attachPeriodButtons('price-history-fullscreen-period');setTimeout(function(){if(window.V6RenderPriceChart.redrawFullscreen)window.V6RenderPriceChart.redrawFullscreen()},80)}
+  function closeFullscreen(){var o=$('price-history-fullscreen-overlay');if(!o)return;o.classList.remove('open');document.documentElement.classList.remove('v5-chart-open');document.body.classList.remove('v5-chart-open')}
+  function start(){ensureYearOptions();ensureModeTabs();ensurePeriodControls();ensureStartDate();attachPeriodButtons('price-history-fullscreen-period');var btn=$('price-history-refresh'),period=$('price-history-period'),startEl=$('price-history-start'),year=$('price-history-year');if(btn)btn.addEventListener('click',load);if(period)period.addEventListener('change',load);if(startEl)startEl.addEventListener('change',load);if(year)year.addEventListener('change',function(){var s=$('price-history-start');if(s)s.value='';ensureStartDate();load()});var full=$('price-history-fullscreen-btn'),close=$('price-history-fullscreen-close');if(full)full.addEventListener('click',openFullscreen);if(close)close.addEventListener('click',closeFullscreen);window.addEventListener('resize',debouncedLoad);load()}
+  return{start:start,load:load};
 })();
```

## Initial interpretation rules

1. Do not patch V6 from this report automatically.
2. First identify whether a missing feature is intentional modularisation or an accidental regression.
3. Restore V5 behaviour before adding any new forecast or annotation feature.
4. Prefer one small patch at a time after the comparison report has been reviewed.
5. Preserve V5 as the reference twin.
