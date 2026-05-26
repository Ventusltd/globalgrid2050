# V4 Dependency Diagnostics

Purpose: map all V4 page, script, data and workflow dependencies that must remain in sync before any modularisation or lazy loading patch is applied.

## Executive diagnosis

- WARNING: Collapse risk: V4 price-history-ui.js can load the full Elexon master CSV and the UI still exposes 10y or all data ranges. This can crash mobile Safari and make the chart unreadable.

## Data scale

- Elexon master CSV rows: 182282
- V4 captured price JSON rows: 6
- Elexon master CSV years: 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026
- Annual Elexon files found: 11
  - elexon_system_prices_2016.csv: 17567 rows
  - elexon_system_prices_2017.csv: 17520 rows
  - elexon_system_prices_2018.csv: 17517 rows
  - elexon_system_prices_2019.csv: 17515 rows
  - elexon_system_prices_2020.csv: 17568 rows
  - elexon_system_prices_2021.csv: 17519 rows
  - elexon_system_prices_2022.csv: 17516 rows
  - elexon_system_prices_2023.csv: 17514 rows
  - elexon_system_prices_2024.csv: 17568 rows
  - elexon_system_prices_2025.csv: 17520 rows
  - elexon_system_prices_2026.csv: 6958 rows

## Dependency graph

```text
uk_energy_tracking_v4/index.md
  -> /uk_energy_tracking_v4/price-history-ui.css
  -> /uk_energy_tracking_v4/price-history-ui.js
       -> /uk_energy_tracking_v4/electricity_price_history.json
       -> /data/electricity/elexon_system_prices_half_hourly.csv OR annual CSVs
       -> DOM ids: price-history-range, price-history-from, price-history-to, price-history-canvas, price-history-table-body
  -> /uk_energy_tracking_v4/price-history-fullscreen.js
       -> window.__v4PriceHistoryState from price-history-ui.js
  -> /uk_energy_tracking_v4/live_grid_energy.json
  -> /uk_energy_tracking_v4/live_grid_price.json
  -> /uk_energy_tracking_v4/live_oil_prices.json
  -> /uk_energy_tracking_v4/live_uk_fuel_prices.json
  -> /uk_energy_tracking_v4/ev_charging_prices.json
scripts/update_uk_energy_v4.py -> live_grid_energy.json
scripts/update_uk_price_v4.py -> live_grid_price.json and captured electricity history
scripts/update_oil_prices_v4.py -> oil price files
scripts/update_uk_fuel_prices_v4.py -> fuel price file
scripts/download_elexon_system_prices.py -> data/electricity/elexon_system_prices_half_hourly.csv
scripts/split_elexon_system_prices_by_year.py -> data/electricity/elexon_system_prices_YEAR.csv
```

## Checks

| Group | Item | Status | Path |
|---|---:|---:|---|
| v4_files | page | PASS | `uk_energy_tracking_v4/index.md` |
| v4_files | css | PASS | `uk_energy_tracking_v4/price-history-ui.css` |
| v4_files | price_ui_js | PASS | `uk_energy_tracking_v4/price-history-ui.js` |
| v4_files | fullscreen_js | PASS | `uk_energy_tracking_v4/price-history-fullscreen.js` |
| v4_files | live_energy | PASS | `uk_energy_tracking_v4/live_grid_energy.json` |
| v4_files | live_price | PASS | `uk_energy_tracking_v4/live_grid_price.json` |
| v4_files | price_history_json | PASS | `uk_energy_tracking_v4/electricity_price_history.json` |
| v4_files | price_history_csv | PASS | `uk_energy_tracking_v4/electricity_price_history.csv` |
| v4_files | oil_json | PASS | `uk_energy_tracking_v4/live_oil_prices.json` |
| v4_files | oil_history | PASS | `uk_energy_tracking_v4/oil_price_history.geojson` |
| v4_files | fuel_json | PASS | `uk_energy_tracking_v4/live_uk_fuel_prices.json` |
| v4_files | ev_json | PASS | `uk_energy_tracking_v4/ev_charging_prices.json` |
| scripts | energy_updater | PASS | `scripts/update_uk_energy_v4.py` |
| scripts | price_updater | PASS | `scripts/update_uk_price_v4.py` |
| scripts | oil_updater | PASS | `scripts/update_oil_prices_v4.py` |
| scripts | fuel_updater | PASS | `scripts/update_uk_fuel_prices_v4.py` |
| scripts | elexon_master_downloader | PASS | `scripts/download_elexon_system_prices.py` |
| scripts | elexon_annual_splitter | PASS | `scripts/split_elexon_system_prices_by_year.py` |
| page_script_refs | /uk_energy_tracking_v4/price-history-ui.js?v=20260526d | PASS | `uk_energy_tracking_v4/price-history-ui.js` |
| page_script_refs | /uk_energy_tracking_v4/price-history-fullscreen.js?v=20260526d | PASS | `uk_energy_tracking_v4/price-history-fullscreen.js` |
| page_css_refs | /uk_energy_tracking_v4/price-history-ui.css | PASS | `uk_energy_tracking_v4/price-history-ui.css` |
| dom_ids | price-history-range | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-from | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-to | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-clear-dates | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-canvas | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-table-body | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-fullscreen-btn | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-fullscreen-overlay | PASS | `uk_energy_tracking_v4/index.md` |
| dom_ids | price-history-fullscreen-canvas | PASS | `uk_energy_tracking_v4/index.md` |
| path_isolation | no V3 path leaks inside V4 files | PASS | `uk_energy_tracking_v4` |
| price_history_loading | main chart does not fetch full master CSV | WARN | `uk_energy_tracking_v4/price-history-ui.js` |
| price_history_loading | annual files exist for lazy loading | PASS | `data/electricity/elexon_system_prices_*.csv` |
| price_history_loading | 10 year selector removed before annual lazy loading | WARN | `uk_energy_tracking_v4/index.md` |
| price_history_loading | all data selector removed before annual lazy loading | WARN | `uk_energy_tracking_v4/index.md` |

## Why the lazy loading patch failed

The failed V3 lazy loading patch changed too many coupled layers at once: the visible controls, the chart data source, the range logic, full screen behaviour and attribution text. The inline chart and full screen chart had separate JavaScript logic, so one could be corrected while the other stayed stale. The page also still had a path where the master 2016 to present Elexon CSV could be loaded directly, exposing the browser to too many points. The correct repair is not another large patch. The correct repair is modularisation plus a dependency gate that proves every selector, data source, script reference, DOM id and chart state object is synchronised before deployment.

## Modularisation sequence for V4

1. Run this dependency diagnostic and compare V4 against V3 before every patch.
2. Extract only CSS from inline style into a V4 stylesheet, with no behaviour change.
3. Extract price history JavaScript into modules: data loading, range selection, chart drawing, table rendering and full screen rendering.
4. Make full screen consume the same state object as the inline chart. No separate fetch path.
5. Add annual lazy loading after the module boundary exists.
6. Only then add year, season and explanatory text controls.

## Rule

Patch V4 only. V3 remains the benchmark.
