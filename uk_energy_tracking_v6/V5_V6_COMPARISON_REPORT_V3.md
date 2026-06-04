# UK Energy Tracking V5 to V6 Comparison Report V3

Generated UTC: `2026-06-04T11:02:13Z`

## Purpose

This is the V3 generated change tracker. It follows the V2 naming convention and explicitly compares the existing V2 report against the current repository state before the next major V6 upgrade.

## Naming convention continuity

| Item | V2 | V3 |
|---|---|---|
| Report | uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md | uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V3.md |
| Generator | scripts/compare_uk_energy_v5_v6_v2.py | scripts/compare_uk_energy_v5_v6_v3.py |
| Workflow | .github/workflows/compare_uk_energy_v5_v6_v2.yml | .github/workflows/compare_uk_energy_v5_v6_v3.yml |

## Governance reads

| File | Exists | SHA |
|---|---|---|
| AI_START_HERE.md | yes | a25fef4e0b3d649b |
| uk_energy_tracking_v6/V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md | yes | 0e09e79a7ed9b5b3 |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md | yes | 2c10668f2faf1723 |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md | yes | ef96129c0ca9665d |

## Previous report state

| Previous report | Exists | Generated UTC | Lines | SHA |
|---|---|---|---|---|
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md | yes | 2026-06-03T12:33:09Z | 215 | ef96129c0ca9665d |

## Existing change tracker and workflow

| Tracker or workflow | Exists | SHA | Purpose |
|---|---|---|---|
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT.md | yes | 2c10668f2faf1723 | Original baseline audit snapshot |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md | yes | ef96129c0ca9665d | Previous generated current-state change tracker |
| uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V3.md | no | missing | New generated current-state plus V2 delta tracker |
| scripts/compare_uk_energy_v5_v6_v2.py | yes | 6dad5073a683e157 | Regenerates V2 |
| scripts/compare_uk_energy_v5_v6_v3.py | yes | 1c8dccad29d79279 | Regenerates V3 |
| .github/workflows/compare_uk_energy_v5_v6_v2.yml | yes | 59158bfdf8f95443 | Manual workflow to refresh V2 |
| .github/workflows/compare_uk_energy_v5_v6_v3.yml | yes | 84e24aba8e1c15eb | Manual workflow to refresh V3 and compare against V2 |

## App inventory

| Folder | Files | Text files | Total bytes |
|---|---|---|---|
| uk_energy_tracking_v5 | 35 | 34 | 3488177 |
| uk_energy_tracking_v6 | 43 | 42 | 2857119 |

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
| V5 fullscreen event text helper | function eventText | fixed |
| Split in-page event renderer | function drawInPageEvents | fixed |
| Split fullscreen event renderer | function drawFullscreenEvents | fixed |
| Fullscreen custom period menu | V6FullscreenPeriodMenu | fixed |
| Custom fullscreen period script loaded | fullscreen_period_menu.js | fixed |
| Native fullscreen select hidden by custom menu | price-history-native-hidden | fixed |
| Custom period menu black background | background:#05070c | fixed |
| Custom period menu cyan text | color:#00ffff | fixed |

Repair observation count fixed: `25` of `25`


## Annotation and UI migration tracker

| Check | Evidence | Pass |
|---|---|---|
| Only working V6 renderer loaded | render_price_chart.js loaded and no clean replacement | yes |
| Overlay workaround removed | render_price_chart_box_overlay.js absent | yes |
| Bottom summary draw call removed | drawSummary call absent from render path | yes |
| V5 in-page UI helper present | function eventBox | yes |
| V5 in-page pointer helper present | function drawPointer | yes |
| Fullscreen SCADA period menu loaded | fullscreen_period_menu.js | yes |
| Fullscreen SCADA period menu started | V6FullscreenPeriodMenu.start | yes |
| Native select retained for state | price-history-fullscreen-period-select | yes |
| Native select hidden by custom menu | price-history-native-hidden | yes |
| V5 files not targeted by V6 repair scripts | diagnostic scripts read V5 only | yes |

## V2 report versus current repo state

| Check | V2 recorded state | Current state | Movement |
|---|---|---|---|
| Oil trend range selector | fixed | fixed | same |
| Oil trend canvas | fixed | fixed | same |
| Oil tooltip | fixed | fixed | same |
| Oil statistics grid | fixed | fixed | same |
| Petrol price card | fixed | fixed | same |
| Diesel price card | fixed | fixed | same |
| Fuel breakdown | fixed | fixed | same |
| EV rapid price card | fixed | fixed | same |
| EV ultra rapid price card | fixed | fixed | same |
| Frequency script loaded | fixed | fixed | same |
| V6 fuel feed config | fixed | fixed | same |
| V6 EV feed config | fixed | fixed | same |
| V6 oil history config | fixed | fixed | same |
| Fullscreen swipe function | fixed | fixed | same |
| Compact date helper | fixed | fixed | same |
| V5 style in-page event box helper | fixed | fixed | same |
| V5 style in-page pointer helper | fixed | fixed | same |
| V5 fullscreen event text helper | open | fixed | changed |
| Split in-page event renderer | open | fixed | changed |
| Split fullscreen event renderer | open | fixed | changed |
| Fullscreen custom period menu | not tracked in V2 | fixed | changed |
| Custom fullscreen period script loaded | not tracked in V2 | fixed | changed |
| Native fullscreen select hidden by custom menu | not tracked in V2 | fixed | changed |
| Custom period menu black background | not tracked in V2 | fixed | changed |
| Custom period menu cyan text | not tracked in V2 | fixed | changed |
| Only working V6 renderer loaded | yes | yes | same |
| Overlay workaround removed | yes | yes | same |
| Bottom summary draw call removed | yes | yes | same |
| V5 in-page UI helper present | yes | yes | same |
| V5 in-page pointer helper present | yes | yes | same |
| Fullscreen SCADA period menu loaded | not tracked in V2 | yes | changed |
| Fullscreen SCADA period menu started | not tracked in V2 | yes | changed |
| Native select retained for state | not tracked in V2 | yes | changed |
| Native select hidden by custom menu | not tracked in V2 | yes | changed |
| V5 files not targeted by V6 repair scripts | yes | yes | same |

## DOM id parity

| ID | V5 | V6 | Status |
|---|---|---|---|
| price-history-canvas | yes | yes | ok |
| price-history-fullscreen-overlay | yes | yes | ok |
| price-history-fullscreen-canvas | yes | yes | ok |
| price-history-fullscreen-btn | yes | yes | ok |
| price-history-fullscreen-period-select | no | yes | ok |
| price-history-fullscreen-period-back | no | yes | ok |
| price-history-fullscreen-period-forward | no | yes | ok |
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
| V6 | 8 | /uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260604chartfit2 |
| V6 | 9 | /uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js?v=20260601d |
| V6 | 10 | /uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js?v=20260604menu1 |
| V6 | 11 | /uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js?v=20260604menu1 |
| V6 | 12 | /uk_energy_tracking_v6/frequency_history/frequency-history-ui.js?v=20260531a |

## Workflow comparison

| Workflow | Exists | Trigger | Runs V5 price | Runs V6 price | Runs V6 frequency |
|---|---|---|---|---|---|
| .github/workflows/fetch_uk_energy_and_prices_v5.yml | yes | manual only | True | False | False |
| .github/workflows/fetch_uk_energy_and_prices_v6.yml | yes | schedule | False | True | False |
| .github/workflows/fetch_uk_frequency_v6.yml | yes | schedule | False | False | True |
| .github/workflows/compare_uk_energy_v5_v6_v2.yml | yes | manual only | False | False | False |
| .github/workflows/compare_uk_energy_v5_v6_v3.yml | yes | manual only | False | False | False |
| .github/workflows/update_v5_v6_granular_change_tracker.yml | yes | manual only | False | False | False |
| .github/workflows/diagnose_repair_v6_price_v5_ui_split.yml | yes | manual only | False | False | False |
| .github/workflows/repair_v6_inpage_chart_real_estate.yml | yes | manual only | False | False | False |

## Current data file presence

| Data file | V5 summary | V6 summary |
|---|---|---|
| live_grid_energy.json | {"exists": true, "bytes": 1079, "sha": "929a67219f4acc53", "lines": 65, "type": "dict"} | {"exists": true, "bytes": 1063, "sha": "4eba4a90a4b6c899", "lines": 65, "type": "dict"} |
| live_grid_price.json | {"exists": true, "bytes": 245, "sha": "e6e9da74cfc13913", "lines": 12, "type": "dict"} | {"exists": true, "bytes": 245, "sha": "552791a79382d529", "lines": 12, "type": "dict"} |
| live_oil_prices.json | {"exists": true, "bytes": 1058, "sha": "a6813c04a322e2c4", "lines": 39, "type": "dict"} | {"exists": true, "bytes": 289, "sha": "7f3e386bd8c31697", "lines": 15, "type": "dict"} |
| oil_price_history.geojson | {"exists": true, "bytes": 1837502, "sha": "d2e59c5b3d578dac", "features": 6279} | {"exists": true, "bytes": 1837463, "sha": "283b145fb4d5106c", "features": 6280} |
| live_uk_fuel_prices.json | {"exists": true, "bytes": 50645, "sha": "530c88f49ddaee5a", "lines": 2211, "type": "dict", "history": 438, "latest": {"week": "18/05/2026", "petrolPencePerLitre": 157.39, "dieselPencePerLitre": 186.56}} | {"exists": true, "bytes": 50873, "sha": "2471f3cf47fcfadd", "lines": 2221, "type": "dict", "history": 440, "latest": {"week": "01/06/2026", "petrolPencePerLitre": 158.74, "dieselPencePerLitre": 184.11}} |
| ev_charging_prices.json | {"exists": true, "bytes": 907, "sha": "3f75da1928540af8", "lines": 32, "type": "dict", "operators": 3} | {"exists": true, "bytes": 1674, "sha": "d0dc09b9029d3160", "lines": 50, "type": "dict", "operators": 3} |
| grid_frequency_history.csv | {"exists": true, "bytes": 534, "sha": "0791c13281ae2921", "lines": 10} | {"exists": true, "bytes": 534, "sha": "49c4f5391e300fba", "lines": 10} |
| live_grid_frequency.json | {"exists": true, "bytes": 383, "sha": "0b01d442e22801b4", "lines": 18, "type": "dict", "latest": {"source_time_utc": "2026-06-04T09:05:24Z", "frequency_hz": 49.98, "captured_utc": "2026-06-04T09:05:24Z", "source": "Elexon", "status": "ok"}} | {"exists": true, "bytes": 382, "sha": "0d82717cd1f7ee2e", "lines": 18, "type": "dict", "latest": {"source_time_utc": "2026-06-04T10:14:11Z", "frequency_hz": 49.98, "captured_utc": "2026-06-04T10:14:11Z", "source": "Elexon", "status": "ok"}} |
| grid_frequency_weekly_health.csv | {"exists": true, "bytes": 256, "sha": "94f98273d4ba187b", "lines": 4} | {"exists": true, "bytes": 188, "sha": "a5d7dec07089e05c", "lines": 3} |
| live_grid_frequency_weekly_health.json | {"exists": true, "bytes": 1066, "sha": "117484fb3b9c11b6", "lines": 42, "type": "dict", "rows": 2} | {"exists": true, "bytes": 758, "sha": "1e62e67babf39fda", "lines": 31, "type": "dict", "rows": 1} |
| electricity_price_history_daily_decade.json | {"exists": true, "bytes": 655794, "sha": "f3f59449e6ce2dc2", "lines": 32887, "type": "dict", "rows": 3652} | {"exists": true, "bytes": 655794, "sha": "f3f59449e6ce2dc2", "lines": 32887, "type": "dict", "rows": 3652} |
| electricity_price_history.csv | {"exists": true, "bytes": 8701, "sha": "4aed35a0da3d5b8e", "lines": 67} | {"exists": true, "bytes": 812, "sha": "81040302aaf62ea2", "lines": 10} |

## Current V6 contract checks

| Contract | Evidence | Pass |
|---|---|---|
| V6 raw chart remains based on loadWindow | loadWindow plus forecastRows empty | yes |
| Fullscreen period arrows exist | fullscreen previous and forward IDs | yes |
| Fullscreen swipe is installed | attachFullscreenSwipe | yes |
| Fullscreen SCADA period menu exists | fullscreen_period_menu.js plus V6FullscreenPeriodMenu | yes |
| Road fuel rendering is installed | renderFuelBreakdown | yes |
| EV rendering is installed | renderEvPrices | yes |
| Oil trend rendering is installed | drawOilTrend | yes |
| Frequency script is loaded | frequency-history-ui.js | yes |
| V6 frequency live file exists | live_grid_frequency.json | yes |
| Refresh chart button removed from index | price-history-refresh absent | yes |
| V6 overlay workaround absent | render_price_chart_box_overlay absent | yes |

## Live price migration readiness

| Readiness check | Evidence | Pass |
|---|---|---|
| V6 price workflow exists | .github/workflows/fetch_uk_energy_and_prices_v6.yml | yes |
| V6 price workflow is scheduled | schedule block in V6 workflow | yes |
| V5 price workflow is manual only | no schedule block in V5 workflow | yes |
| V6 workflow runs price updater | update_uk_price_v6.py | yes |
| V6 workflow commits V6 price history files | git add V6 price files | yes |
| V6 live price JSON exists | live_grid_price.json | yes |
| V6 decade daily price history exists | daily decade rows >= 3650 | yes |
| V6 short price CSV is populated comparably to V5 | V6 lines 10, V5 lines 67 | no |
| V6 renderer is current and single path | working renderer only | yes |

## Watched files for next major upgrade

| File | Exists | Lines | SHA | Recent commits touching file |
|---|---|---|---|---|
| uk_energy_tracking_v6/index.md | yes | 205 | d30e11bbb4c6cff0 | d39647c3 2026-06-04 Load V6 SCADA fullscreen period menu<br>6af0de29 2026-06-04 Repair V6 chart space<br>e21dbcd8 2026-06-04 Repair V6 chart space<br>a272605e 2026-06-04 Repair V6 chart space |
| uk_energy_tracking_v6/styles/app.css | yes | 451 | 134e8b746e5be4bb | 6af0de29 2026-06-04 Repair V6 chart space<br>e21dbcd8 2026-06-04 Repair V6 chart space<br>a272605e 2026-06-04 Repair V6 chart space<br>c5f4378b 2026-06-03 Repair V6 chart space |
| uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js | yes | 29 | 4b50f3dd6df663e9 | 076bf96b 2026-05-30 Revert V6 forecast layer data changes<br>bbc55d00 2026-05-30 Keep V6 forecast separate from actual data<br>540d6046 2026-05-30 Separate V6 forecast data from raw price chart<br>90764b89 2026-05-30 Use full half hourly data for V6 six month chart |
| uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js | yes | 36 | 1cede28abc1a847c | a272605e 2026-06-04 Repair V6 chart space<br>c5f4378b 2026-06-03 Repair V6 chart space<br>3d9aff8d 2026-06-02 Repair V6 price annotations V5 style<br>99ba6fcc 2026-06-02 Repair V6 event boxes visible |
| uk_energy_tracking_v6/price_history_chart/control_price_history/control_price_history.js | yes | 28 | 84485991b104b276 | 6f711e01 2026-06-01 Wire V6 fullscreen period selector<br>70ca6925 2026-05-31 Repair V6 fullscreen swipe<br>747bf519 2026-05-30 Revert V6 forecast and annotation controls<br>7e7e28b1 2026-05-30 Wire V6 forecast and annotation toggle controls |
| uk_energy_tracking_v6/price_history_chart/fullscreen_period_menu/fullscreen_period_menu.js | yes | 46 | 9e87e530485c4795 | fd86aa9a 2026-06-04 Add SCADA fullscreen period menu |
| uk_energy_tracking_v6/app_bootstrap/start_v6_app/start_v6_app.js | yes | 14 | f04c09418b8a3d21 | da96d83e 2026-06-04 Start V6 fullscreen period menu<br>8702b273 2026-05-31 Repair V6 restore V5 panels<br>8aea8e10 2026-05-30 Add V6 app bootstrap |
| uk_energy_tracking_v6/frequency_history/frequency-history-ui.js | yes | 144 | 4e136ec56e7e4e2b | 8702b273 2026-05-31 Repair V6 restore V5 panels |
| uk_energy_tracking_v6/live_data_pipeline/live-config.js | yes | 15 | b545cd5febc6a0bc | 8702b273 2026-05-31 Repair V6 restore V5 panels<br>4203360a 2026-05-29 Add V6 live data config module |
| scripts/compare_uk_energy_v5_v6_v2.py | yes | 365 | 6dad5073a683e157 | a872a428 2026-06-03 Extend V5 V6 comparison for live price migration audit<br>3d0e38cb 2026-06-01 Add V5 V6 comparison report V2 generator |
| scripts/compare_uk_energy_v5_v6_v3.py | yes | 485 | 1c8dccad29d79279 | 308eb0e0 2026-06-04 Add V5 V6 comparison report V3 generator |
| scripts/update_v5_v6_granular_change_tracker.py | yes | 223 | 9cb30585248fc532 | bcde6483 2026-06-04 Add granular V5 V6 change tracker generator |
| scripts/repair_v6_inpage_chart_real_estate.py | yes | 209 | 828b1a9c8a1e080a | 2a772974 2026-06-04 Fix V6 fullscreen period dropdown override<br>b1e73c1c 2026-06-04 Stage 1 adjust V6 chart height and fullscreen period position<br>e1b173df 2026-06-04 Adjust V6 portrait chart height and fullscreen period styling<br>a955f25e 2026-06-03 Tighten V6 non fullscreen chart layout repair |
| scripts/update_uk_frequency_v6.py | yes | 369 | a4491b641b4eadd1 | f982945c 2026-06-03 Replace V6 frequency wrapper with direct collector<br>f6b91e4e 2026-06-03 Add V6 UK grid frequency collector |
| .github/workflows/compare_uk_energy_v5_v6_v2.yml | yes | 27 | 59158bfdf8f95443 | c660043e 2026-06-01 Add V5 V6 comparison report V2 workflow |
| .github/workflows/compare_uk_energy_v5_v6_v3.yml | yes | 29 | 84e24aba8e1c15eb | 873c6ad8 2026-06-04 Add V5 V6 comparison report V3 workflow |
| .github/workflows/update_v5_v6_granular_change_tracker.yml | yes | 29 | f0fe52f47ac18d30 | b263b33d 2026-06-04 Add granular V5 V6 tracker workflow |
| .github/workflows/fetch_uk_energy_and_prices_v5.yml | yes | 78 | 5c314a8142fddac2 | e8073031 2026-06-03 Migrate live UK energy price schedule from V5 to V6<br>1fc7e2c5 2026-05-29 Generate V5 daily price aggregates with price feed<br>56da1c2e 2026-05-28 Add V5 scheduled energy tracker workflow |
| .github/workflows/fetch_uk_energy_and_prices_v6.yml | yes | 65 | 8db6f68e882d644b | c5fd09d2 2026-06-03 Migrate live UK energy price schedule from V5 to V6<br>c2641b01 2026-05-30 Add V6 live energy and price workflow |
| .github/workflows/fetch_uk_frequency_v6.yml | yes | 89 | 1c723a2d23deba18 | 271bbb15 2026-06-03 Fix V6 frequency workflow staging<br>88da6ea2 2026-06-03 Add V6 frequency workflow |
| .github/workflows/repair_v6_inpage_chart_real_estate.yml | yes | 32 | 398414a13cfda951 | 5c922554 2026-06-03 Add V6 chart real estate repair workflow |

## Live price migration decision note

Open blockers before declaring V6 migration fully clean:

1. V6 short price CSV is populated comparably to V5

## Next major upgrade gate

All tracked V6 contract checks pass in the generated V3 report.

Proceed one feature at a time with exact target files and a rollback commit plan.
