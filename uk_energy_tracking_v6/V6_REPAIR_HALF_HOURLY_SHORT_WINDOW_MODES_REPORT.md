# V6 Repair Report: Half Hourly Short Window Modes

Generated UTC: 2026-06-04T18:16:53.503938+00:00

## Scope

Only short chart windows up to 1 week were touched.

## Intended behaviour

1. 24 hours uses raw half hourly Elexon settlement data and should show up to 48 points.
2. 48 hours uses raw half hourly Elexon settlement data and should show up to 96 points.
3. 1 week uses raw half hourly Elexon settlement data and should show up to 336 points.
4. Periods beyond 1 week are not changed by this repair.

## Files touched by script

- uk_energy_tracking_v6/price_history_chart/load_price_history_data/load_price_history_data.js
- uk_energy_tracking_v6/index.md
- data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html
- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js

## Guardrails checked

- AI_START_HERE.md present.
- V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md present.
- Long range daily aggregation remains 12m, 5y and 10y only.
- Annual CSV path remains unchanged.
- Daily aggregate JSON path remains unchanged.
- Renderer short window tick logic is guarded to 7.1 days maximum.

## Maintainer test checklist

1. Open /uk_energy_tracking_v6/.
2. Test 24 hours, 48 hours and 1 week.
3. Confirm 1 week shows roughly 336 visible records when a complete week is available.
4. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html.
5. Test Latest 24 hours, Latest 48 hours and Latest 1 week.
6. Confirm 1 month, 3 months, 6 months, 12 months, 5 years and 10 years behave as before.
