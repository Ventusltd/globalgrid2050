# V6 Repair Report: Mobile Inspect Buttons

Generated UTC: 2026-06-04T20:35:28.217353+00:00

## Scope

This repair changes only the inspection control layout and cache version references.

## Behaviour

1. Desktop and wider layouts keep the previous point button, readout and next point button in a normal row.
2. Mobile portrait places the previous point and next point buttons beside each other.
3. The selected point readout moves below the 2 buttons in mobile portrait.
4. The shared renderer is cache busted to `20260604inspect2` on both public pages.

## Files touched by script

- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js
- uk_energy_tracking_v6/index.md
- data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html

## Guardrails

- No data files changed.
- No loader files changed.
- No source data paths changed.
- No chart calculations changed.
