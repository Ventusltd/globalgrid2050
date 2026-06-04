# V6 Repair Report: Connect Inspect Overlay

Generated UTC: 2026-06-04T19:54:18.824186+00:00

## Reason

The previous inspection workflow inserted the helper functions but did not connect them into the renderTo execution path. The function definition existed, but the renderer did not call it.

## Change

1. renderTo now creates and attaches the previous point and next point inspection controls.
2. renderTo now calls drawInspectOverlay after the high and low marker stage.
3. Inspection remains limited to raw half hourly windows up to 6 months.

## Files touched by script

- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js

## Guardrails

- No data files changed.
- No loader files changed.
- No source paths changed.
- No annual calculations changed.
