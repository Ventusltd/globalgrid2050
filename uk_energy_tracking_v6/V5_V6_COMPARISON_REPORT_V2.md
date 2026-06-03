# UK Energy Tracking V5 to V6 Comparison Report V2

Generated UTC: `2026-06-03T12:33:09Z`

## Purpose

This is the generated V5 to V6 change tracker. It compares the protected V5 tracker against the current V6 tracker, records repair observations and adds the live price migration readiness notes required before moving the live price fetch from V5 to V6.

## Governance reads

| File | Exists | SHA |
|---|---|---|
| AI_START_HERE.md | yes | a25fef4e0b3d649b |
| uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md | yes | 0e09e79a7ed9b5b3 |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md | yes | 2c10668f2faf1723 |

## Existing change tracker and workflow

| Tracker or workflow | Exists | SHA | Purpose |
|---|---|---|---|
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md | yes | 2c10668f2faf1723 | Original baseline audit snapshot |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md | yes | 4dc01259bf3a9315 | Generated current-state change tracker |
| scripts/compare_uk_energy_v5_v6_v2.py | yes | 6dad5073a683e157 | Regenerates this report |
| .github/workflows/compare_uk_energy_v5_v6_v2.yml | yes | 59158bfdf8f95443 | Manual workflow to refresh this report |

## App inventory

| Folder | Files | Text files | Total bytes |
|---|---|---|---|
| uk_energy_tracking_v5 | 35 | 34 | 3487458 |
| uk_energy_tracking_v6 | 37 | 36 | 2836160 |

## Current repair observations

| Observation | Token checked | Current status |
|---|---|---|
| Oil trend range selector | oil-range | fixed |
| Oil trend canvas | oil-trend-canvas | fixed |
| Oil tooltip | oil-tooltip | fixed |
| Oil statistics grid | oil-stats | fixed |
| Petrol price card | petrol-price | fixed |
| Diesel price card | diesel-price | fixed |
| Fuel breakdown | fuel-breakdown | fixed |
| EV rapid price card | ev-rapid-price | fixed |
| EV ultra rapid price card | ev-ultra-price | fixed |
| Frequency script loaded | frequency-history-ui.js | fixed |
| V6 fuel feed config | fuel: | fixed |
| V6 EV feed config | evPrices: | fixed |
| V6 oil history config | oilHistory: | fixed |
| Fullscreen swipe function | attachFullscreenSwipe | fixed |
| Compact date helper | compactDateText | fixed |
| V5 style in-page event box helper | function eventBox | fixed |
| V5 style in-page pointer helper | function drawPointer | fixed |
| V5 fullscreen event text helper | function eventText | open |
| Split in-page event renderer | function drawInPageEvents | open |
| Split fullscreen event renderer | function drawFullscreenEvents | open |

Repair observation count fixed: `17` of `20`


## Annotation and UI migration tracker

| Check | Evidence | Pass |
|---|---|---|
| Only working V6 renderer loaded | render_price_chart.js loaded and no clean replacement | yes |
| Overlay workaround removed | render_price_chart_box_overlay.js absent | yes |
| Bottom summary draw call removed | drawSummary call absent from render path | yes |
| V5 in-page UI helper present | function eventBox | yes |
| V5 in-page pointer helper present | function drawPointer | yes |
| V5 fullscreen UI helper present | function eventText | no |
| Split in-page/fullscreen routing present | drawInPageEvents and drawFullscreenEvents | no |
| Average event annotation removed | AVERAGE not in tracker helper | yes |
| V5 files not targeted by V6 repair scripts | diagnostic scripts read V5 only | yes |

## DOM id parity

| ID | V5 | V6 | Status |
|---|---|---|---|
| price-history-canvas | yes | yes | ok |
| price-history-fullscreen-overlay | yes | yes | ok |
| price-history-fullscreen-canvas | yes | yes | ok |
| price-history-fullscreen-btn | yes | yes | ok |
| price-history-start | yes | yes | ok |
| price-history-period | yes | yes | ok |
| price-history-year | yes | yes | ok |
| price-history-range-status | yes | yes | ok |
| ph-latest-price | yes | yes | ok |
| ph-latest-time | yes | yes | ok |
| ph-row-count | yes | yes | ok |
| ph-source | yes | yes | ok |
| price-history-table-body | yes | yes | ok |
| oil-range | yes | yes | ok |
| oil-trend-canvas | yes | yes | ok |
| oil-tooltip | yes | yes | ok |
| oil-stats | yes | yes | ok |
| petrol-price | yes | yes | ok |
| diesel-price | yes | yes | ok |
| fuel-breakdown | yes | yes | ok |
| ev-rapid-price | yes | yes | ok |
| ev-ultra-price | yes | yes | ok |

All V5 IDs still missing from V6: `2`

`price-history-zoom-reset`, `scada-mix`

V6 IDs not present in V5: `12`

`generation-mix-grid`, `live-electricity-snapshot`, `oil-price-trend-panel`, `price-history-discovery`, `price-history-fullscreen-period-back`, `price-history-fullscreen-period-forward`, `price-history-fullscreen-period-select`, `road-fuel-ev-panel`, `summary-carbon`, `summary-demand`, `summary-price`, `summary-timestamps`

## CSS class parity from index files

V5 classes still missing from V6 index: `5`

`price-history-fullscreen-note`, `scada-gauge`, `scada-gauge-card`, `scada-gauge-title`, `scada-gauges`

V6 classes not present in V5 index: `11`

`price-history-discovery`, `price-history-fullscreen-arrow`, `price-history-fullscreen-arrow-left`, `price-history-fullscreen-arrow-right`, `price-history-fullscreen-period-label`, `price-history-fullscreen-smallprint`, `scada-live-summary`, `scada-summary-grid`, `scada-summary-time`, `scada-summary-title`, `v6-app`

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
| V6 | 8 | /uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260602v5exact1 |
| V6 | 9 | /uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js?v=20260601d |
| V6 | 10 | /uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js?v=20260530o |
| V6 | 11 | /uk_energy_tracking_v6/frequency_history/frequency-history-ui.js?v=20260531a |

## Workflow comparison

| Workflow | Exists | Trigger | Runs V5 price | Runs V6 price |
|---|---|---|---|---|
| .github/workflows/fetch_uk_energy_and_prices_v5.yml | yes | schedule | True | False |
| .github/workflows/fetch_uk_energy_and_prices_v6.yml | yes | manual only | False | True |
| .github/workflows/compare_uk_energy_v5_v6_v2.yml | yes | manual only | False | False |
| .github/workflows/diagnose_repair_v6_price_v5_ui_split.yml | yes | manual only | False | False |

## Current data file presence

| Data file | V5 summary | V6 summary |
|---|---|---|
| live_grid_energy.json | {"exists": true, "bytes": 1079, "sha": "929a67219f4acc53", "lines": 65, "type": "dict"} | {"exists": true, "bytes": 1076, "sha": "e767a8f9babdb5b7", "lines": 65, "type": "dict"} |
| live_grid_price.json | {"exists": true, "bytes": 245, "sha": "e6e9da74cfc13913", "lines": 12, "type": "dict"} | {"exists": true, "bytes": 254, "sha": "752bf2cd5ad159cf", "lines": 12, "type": "dict"} |
| live_oil_prices.json | {"exists": true, "bytes": 1059, "sha": "3ac623159e9c9fc2", "lines": 39, "type": "dict"} | {"exists": true, "bytes": 289, "sha": "5cc9e3769a239e53", "lines": 15, "type": "dict"} |
| oil_price_history.geojson | {"exists": true, "bytes": 1837294, "sha": "91be8ad3b2f96e4c", "features": 6279} | {"exists": true, "bytes": 1836867, "sha": "e62f2fa40f69ae12", "features": 6278} |
| live_uk_fuel_prices.json | {"exists": true, "bytes": 50645, "sha": "530c88f49ddaee5a", "lines": 2211, "type": "dict", "history": 438, "latest": {"week": "18/05/2026", "petrolPencePerLitre": 157.39, "dieselPencePerLitre": 186.56}} | {"exists": true, "bytes": 50873, "sha": "444222aa82bca1b0", "lines": 2221, "type": "dict", "history": 440, "latest": {"week": "01/06/2026", "petrolPencePerLitre": 158.74, "dieselPencePerLitre": 184.11}} |
| ev_charging_prices.json | {"exists": true, "bytes": 907, "sha": "3f75da1928540af8", "lines": 32, "type": "dict", "operators": 3} | {"exists": true, "bytes": 1674, "sha": "2243538f013f973f", "lines": 50, "type": "dict", "operators": 3} |
| grid_frequency_history.csv | {"exists": true, "bytes": 537, "sha": "10cb35d88c972e20", "lines": 10} | {"exists": false} |
| live_grid_frequency.json | {"exists": true, "bytes": 384, "sha": "b24b41b177557a90", "lines": 18, "type": "dict", "latest": {"source_time_utc": "2026-06-03T12:05:48Z", "frequency_hz": 49.954, "captured_utc": "2026-06-03T12:05:48Z", "source": "Elexon", "status": "ok"}} | {"exists": false} |
| live_grid_frequency_weekly_health.json | {"exists": true, "bytes": 1066, "sha": "18ccbfe9dde6872c", "lines": 42, "type": "dict", "rows": 2} | {"exists": false} |
| electricity_price_history_daily_decade.json | {"exists": true, "bytes": 655794, "sha": "f3f59449e6ce2dc2", "lines": 32887, "type": "dict", "rows": 3652} | {"exists": true, "bytes": 655784, "sha": "1c8df22196009f0e", "lines": 32887, "type": "dict", "rows": 3652} |
| electricity_price_history.csv | {"exists": true, "bytes": 8701, "sha": "4aed35a0da3d5b8e", "lines": 67} | {"exists": true, "bytes": 171, "sha": "a56bf842944f8c28", "lines": 3} |

## Current V6 contract checks

| Contract | Evidence | Pass |
|---|---|---|
| V6 raw chart remains based on loadWindow | loadWindow plus forecastRows empty | yes |
| Fullscreen period arrows exist | fullscreen previous and forward IDs | yes |
| Fullscreen swipe is installed | attachFullscreenSwipe | yes |
| Road fuel rendering is installed | renderFuelBreakdown | yes |
| EV rendering is installed | renderEvPrices | yes |
| Oil trend rendering is installed | drawOilTrend | yes |
| Frequency script is loaded | frequency-history-ui.js | yes |
| Refresh chart button removed from index | price-history-refresh absent | yes |
| V6 annotation split ready | eventBox plus eventText plus split routing | no |
| V6 overlay workaround absent | render_price_chart_box_overlay absent | yes |

## Live price migration readiness

| Readiness check | Evidence | Pass |
|---|---|---|
| V6 price workflow exists | .github/workflows/fetch_uk_energy_and_prices_v6.yml | yes |
| V6 price workflow is scheduled | schedule block in V6 workflow | no |
| V5 price workflow is scheduled | schedule block in V5 workflow | yes |
| V6 workflow runs price updater | update_uk_price_v6.py | yes |
| V6 workflow commits V6 price history files | git add V6 price files | yes |
| V6 live price JSON exists | live_grid_price.json | yes |
| V6 decade daily price history exists | daily decade rows >= 3650 | yes |
| V6 short price CSV is populated comparably to V5 | V6 lines 3, V5 lines 67 | no |
| V6 renderer is current and single path | working renderer only | yes |

## Live price migration decision note

Do not disconnect V5 from the scheduled live price fetch yet.

Open blockers before migration:

1. V6 price workflow is scheduled
2. V6 short price CSV is populated comparably to V5

## Current interpretation

1. V6 has moved from partial shell restoration to active functional restoration.
2. Oil trend, road fuel, EV placeholder, frequency wiring, fullscreen swipe, annotation repair and comparison reporting are now measurable V6 repair domains.
3. `scada-mix` remains intentionally replaced by the V6 generation mix architecture rather than restored literally.
4. `price-history-zoom-reset` remains the clearest optional open item from the original V5 ID gap.
5. The comparison report should be regenerated after every structural V6 repair workflow, not edited by hand.
6. Live price migration must be a separate workflow-only change after this report shows no open migration blockers.
