# V6 Repair Report: Mobile Chart Readability

Status: prepared by deterministic repair script.

## Scope

This repair improves the mobile electricity price chart layout after the V6 fullscreen restoration.

## Behaviour changed

1. Removes the redundant `Refresh chart` button from the normal page controls.
2. Makes the normal mobile portrait chart use almost the full mobile viewport height.
3. Makes fullscreen portrait mode use a larger compact table style summary box.
4. Uses bolder red metric rows for High, Average and Low to improve readability for weak eyesight.
5. Removes the summary box in fullscreen landscape mode so the graph has maximum cinematic space.
6. Increases fullscreen landscape graph real estate by reducing chart padding.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/index.md`
2. `uk_energy_tracking_v6/styles/app.css`
3. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
4. `uk_energy_tracking_v6/V6_REPAIR_MOBILE_CHART_READABILITY_REPORT.md`

## Explicit non scope

No data feeds changed.
No V5 file changed.
No forecast wiring changed.

## Required maintainer test

1. Open `/uk_energy_tracking_v6/` on mobile portrait.
2. Confirm the normal chart fills most of the portrait screen.
3. Open fullscreen portrait and confirm the bottom summary table is readable.
4. Rotate to landscape and confirm the graph is cinematic with no summary box.
5. Confirm arrows and swipe still change period.
