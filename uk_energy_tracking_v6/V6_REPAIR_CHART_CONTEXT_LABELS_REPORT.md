# V6 Repair Report: Chart Context Labels

Generated UTC: 2026-06-04T18:28:54.816178+00:00

## Scope

This repair updates presentation only.

## Changes

1. Main article chart buttons now describe the chosen historical windows more clearly.
2. A short explanatory line below the buttons explains long windows, short half hourly windows and forward gas or LNG stress monitoring.
3. Weekly view now adds light time guide labels at 00:00, 06:00, 13:00 and 16:00 for each day where space permits.

## Files touched by script

- data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html
- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js

## Guardrails

- No data files changed.
- No loader files changed.
- No source paths changed.
- Weekly time labels remain guarded to windows not greater than 1 week.

## Manual checks

1. Open the main article and confirm button labels read correctly.
2. Confirm the explanatory sentence appears under the buttons.
3. Select Latest 1 week and check day labels plus small time guide labels.
4. Confirm 24 hour and 48 hour views are not cluttered.
