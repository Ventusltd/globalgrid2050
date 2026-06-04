# V6 Repair Report: Adaptive Weekly Time Ticks

Generated UTC: 2026-06-04T19:30:31.783810+00:00

## Reason

The weekly chart was drawing too many time labels per day. On narrower chart widths the labels overlapped and looked like one merged timestamp string.

## Change

The weekly time row now adapts to available pixels per day:

1. Wide chart: 06:00, 13:00 and 16:00.
2. Medium chart: 06:00 and 16:00.
3. Tight chart: 13:00 only.
4. Very tight chart: day labels only.

The day label itself marks the 00:00 boundary, so the chart still gives a daily time reference without clutter.

## Guardrails

- Raw half hourly data is unchanged.
- Loader files are unchanged.
- CSV paths are unchanged.
- The rule is guarded to windows not greater than 1 week.
- Both the live V6 page and the embedded article chart use this shared renderer.

## Files touched by script

- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js

## Manual checks

1. Open /uk_energy_tracking_v6/ and select 1 week.
2. Confirm the day labels are clear.
3. Confirm the time labels no longer collide.
4. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html and select Latest 1 week.
5. Confirm the same behaviour.
