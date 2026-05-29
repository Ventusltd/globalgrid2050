# UK Energy Tracking V6 Operating Manual

V6 is the modular successor to V5. It is a separate application folder and must not overwrite V5.

## Operating principle

The page shell is `uk_energy_tracking_v6/index.md`.

The application is split into literal functional folders:

- `app_bootstrap/` starts the app.
- `shared_helpers/` contains small reusable helper functions.
- `live_data_pipeline/` loads and renders live energy, price and generation mix data.
- `commodity_price_signals/` renders oil, copper, aluminium and FX commodity signals.
- `price_history_chart/` owns electricity price history loading, controls and chart drawing.
- `styles/` contains the V6 visual layer.

## Data rule

V6 reads V6 JSON paths only. V5 remains protected until V6 is proven.

## Pipeline rule

GridBot writes live feed JSON into `uk_energy_tracking_v6/`. The updater scripts and workflows must explicitly target V6 paths.

## Modification rule

Change one module at a time. Avoid large single file rewrites. If a chart change touches data loading, rendering and controls, split those changes across the three matching modules.

## Test rule

After every step compare V6 behaviour against V5:

1. Page loads.
2. Live snapshot values render.
3. Generation mix renders.
4. Commodity values render.
5. Price history renders.
6. No V5 files were modified unless the step explicitly archives V5 with a link to V6.
