# V6 Repair Report: Event Boxes Visible

Status: prepared by deterministic repair script.

## Problem observed

The previous high low tracker repair committed successfully, but the visual result did not show the floating boxes on the live V6 chart. The existing bottom summary box also remained in normal in-page mode.

## Behaviour changed

1. Repositions HIGH, AVERAGE and LOW tracker boxes inside the visible plot area using explicit top and bottom plot bounds.
2. Draws in-page tracker boxes without drawing the bottom summary box.
3. Keeps the fullscreen portrait bottom summary box, then draws tracker boxes above it.
4. Keeps fullscreen landscape clean by preserving the existing no-tracker behaviour there.
5. Bumps the V6 render script query string so the live page loads the corrected renderer.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_REPAIR_EVENT_BOXES_VISIBLE_REPORT.md`

## Explicit non scope

No V5 file changed.
No CSS changed.
No data feed changed.
No forecast wiring changed.
No period dropdown changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`. In normal page mode confirm the old bottom summary box is gone and the HIGH, AVERAGE and LOW tracker boxes are visible on the chart. Then test fullscreen portrait and confirm the bottom summary box remains while chart tracker boxes are visible above it. Landscape should stay clean.
