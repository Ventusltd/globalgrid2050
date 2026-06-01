# UK Energy Tracking V5 to V6 Comparison Report V2

Generated UTC: `2026-06-01T01:19:23Z`

## Purpose

This V2 report compares the protected V5 tracker against the current V6 tracker after the V6 restoration and mobile readability repair workflows. The original `V5_V6_COMPARISON_REPORT.md` remains preserved as the first audit snapshot.

## Governance reads

| File | Exists | SHA |
|---|---|---|
| AI_START_HERE.md | yes | a25fef4e0b3d649b |
| uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md | yes | 0e09e79a7ed9b5b3 |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md | yes | 2c10668f2faf1723 |

## App inventory

| Folder | Files | Text files | Total bytes |
|---|---|---|---|
| uk_energy_tracking_v5 | 35 | 34 | 3477574 |
| uk_energy_tracking_v6 | 30 | 29 | 2800597 |

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
| Frequency script | frequency-history-ui.js | fixed |
| V6 fuel feed config | fuel: | fixed |
| V6 EV feed config | evPrices: | fixed |
| V6 oil history config | oilHistory: | fixed |
| Fullscreen swipe function | attachFullscreenSwipe | fixed |
| Fullscreen summary repair | compactDateText | fixed |
| Mobile readability repair | mobile chart readability | fixed |

Repair observation count fixed: `16` of `16`

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

V6 IDs not present in V5: `11`

`generation-mix-grid`, `live-electricity-snapshot`, `oil-price-trend-panel`, `price-history-discovery`, `price-history-fullscreen-period-back`, `price-history-fullscreen-period-forward`, `road-fuel-ev-panel`, `summary-carbon`, `summary-demand`, `summary-price`, `summary-timestamps`

## CSS class parity from index files

V5 classes still missing from V6 index: `5`

`price-history-fullscreen-note`, `scada-gauge`, `scada-gauge-card`, `scada-gauge-title`, `scada-gauges`

V6 classes not present in V5 index: `9`

`price-history-discovery`, `price-history-fullscreen-arrow`, `price-history-fullscreen-arrow-left`, `price-history-fullscreen-arrow-right`, `scada-live-summary`, `scada-summary-grid`, `scada-summary-time`, `scada-summary-title`, `v6-app`

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
| V6 | 11 | /uk_energy_tracking_v6/frequency_history/frequency-history-ui.js?v=20260531a |

## Current data file presence

| Data file | V5 summary | V6 summary |
|---|---|---|
| live_grid_energy.json | {"exists": true, "bytes": 1081, "sha": "1c72100dc9bb0535", "lines": 65, "type": "dict"} | {"exists": true, "bytes": 1076, "sha": "e767a8f9babdb5b7", "lines": 65, "type": "dict"} |
| live_grid_price.json | {"exists": true, "bytes": 249, "sha": "b225497ac10b07ca", "lines": 12, "type": "dict"} | {"exists": true, "bytes": 254, "sha": "752bf2cd5ad159cf", "lines": 12, "type": "dict"} |
| live_oil_prices.json | {"exists": true, "bytes": 1051, "sha": "03ba323efe5d9144", "lines": 39, "type": "dict"} | {"exists": true, "bytes": 289, "sha": "6004eb66e7294719", "lines": 15, "type": "dict"} |
| oil_price_history.geojson | {"exists": true, "bytes": 1836907, "sha": "0c37bcb0d5c36644", "features": 6278} | {"exists": true, "bytes": 1837076, "sha": "d92292d0deb74a10", "features": 6279} |
| live_uk_fuel_prices.json | {"exists": true, "bytes": 50645, "sha": "530c88f49ddaee5a", "lines": 2211, "type": "dict", "history": 438, "latest": {"week": "18/05/2026", "petrolPencePerLitre": 157.39, "dieselPencePerLitre": 186.56}} | {"exists": true, "bytes": 50759, "sha": "c2ffca40d4a978ab", "lines": 2216, "type": "dict", "history": 439, "latest": {"week": "25/05/2026", "petrolPencePerLitre": 158.78, "dieselPencePerLitre": 185.07}} |
| ev_charging_prices.json | {"exists": true, "bytes": 907, "sha": "3f75da1928540af8", "lines": 32, "type": "dict", "operators": 3} | {"exists": true, "bytes": 1674, "sha": "628e0beb00180c85", "lines": 50, "type": "dict", "operators": 3} |
| grid_frequency_history.csv | {"exists": true, "bytes": 897, "sha": "840b35733aa4867a", "lines": 16} | {"exists": false} |
| live_grid_frequency.json | {"exists": true, "bytes": 384, "sha": "e8523353bd499cf4", "lines": 18, "type": "dict", "latest": {"source_time_utc": "2026-05-31T23:34:50Z", "frequency_hz": 50.106, "captured_utc": "2026-05-31T23:34:50Z", "source": "Elexon", "status": "ok"}} | {"exists": false} |
| live_grid_frequency_weekly_health.json | {"exists": true, "bytes": 744, "sha": "053d92df1c1baf77", "lines": 31, "type": "dict", "rows": 1} | {"exists": false} |
| electricity_price_history_daily_decade.json | {"exists": true, "bytes": 655722, "sha": "0f56640a20afa370", "lines": 32883, "type": "dict", "rows": 3652} | {"exists": true, "bytes": 655784, "sha": "1c8df22196009f0e", "lines": 32887, "type": "dict", "rows": 3652} |
| electricity_price_history.csv | {"exists": true, "bytes": 6873, "sha": "13e2364a74cba7a8", "lines": 53} | {"exists": true, "bytes": 171, "sha": "a56bf842944f8c28", "lines": 3} |

## Current V6 contract checks

| Contract | Pass |
|---|---|
| V6 raw chart remains based on loadWindow | yes |
| Fullscreen period arrows exist | yes |
| Fullscreen swipe is installed | yes |
| Mobile readability repair is installed | yes |
| Portrait summary compact date helper exists | yes |
| Landscape fullscreen no summary mode exists | yes |
| Road fuel rendering is installed | yes |
| EV rendering is installed | yes |
| Oil trend rendering is installed | yes |
| Frequency script is loaded | yes |
| Refresh chart button removed from index | yes |

## Current interpretation

1. V6 has moved from partial shell restoration to active functional restoration.
2. Oil trend, road fuel, EV placeholder, frequency wiring, fullscreen swipe and mobile readability are now measurable V6 repair domains.
3. `scada-mix` remains intentionally replaced by the V6 generation mix architecture rather than restored literally.
4. `price-history-zoom-reset` remains the clearest optional open item from the original V5 ID gap.
5. The comparison report should be regenerated after every structural V6 repair workflow, not edited by hand.
