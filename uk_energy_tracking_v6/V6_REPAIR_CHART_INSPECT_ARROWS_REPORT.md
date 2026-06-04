# V6 Repair Report: Chart Inspect Arrows

Generated UTC: 2026-06-04T19:40:32.043239+00:00

## Scope

This repair adds chart inspection behaviour to the shared V6 price chart renderer.

## Behaviour

1. Inspection is available only for raw half hourly chart windows up to 6 months.
2. The initial inspection line appears at the highest visible half hourly price point.
3. The selected data box appears only after the user moves the pointer or uses the previous or next point arrows.
4. Mouse movement, touch movement, previous point and next point all snap to exact loaded half hourly points.
5. Long daily aggregate views remain unchanged.

## Files touched by script

- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js

## Guardrails

- No CSV files changed.
- No data loader files changed.
- No source paths changed.
- No annual calculations changed.
- Both the live V6 page and the main article chart use the same shared renderer.

## Manual checks

1. Open /uk_energy_tracking_v6/.
2. Select Latest 1 week.
3. Confirm a thin inspection line starts at the high point.
4. Press previous point and next point.
5. Confirm the selected data box appears with exact date, time and £/MWh.
6. Touch or move mouse across the chart and confirm snapping to points.
7. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html and repeat.
8. Confirm 10 year daily view is not changed.
