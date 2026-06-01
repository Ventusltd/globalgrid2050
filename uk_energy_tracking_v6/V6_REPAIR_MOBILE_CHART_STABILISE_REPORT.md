# V6 Repair Report: Mobile Chart Stabilise

Status: prepared by deterministic repair script.

## Problem observed

The previous mobile readability workflow changed the normal mobile chart height too aggressively and the fullscreen portrait table overflowed horizontally. Landscape fullscreen improved but the title/key area remained cramped.

## Behaviour changed

1. Reverts the normal mobile page chart height to the earlier stable mobile size.
2. Keeps fullscreen landscape summary hidden.
3. Reduces landscape chart padding so graph space improves without clipping the title/key area.
4. Makes the portrait fullscreen summary table more compact.
5. Shortens long date strings inside the portrait summary table so they stay inside the box.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/styles/app.css`
2. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
3. `uk_energy_tracking_v6/V6_REPAIR_MOBILE_CHART_STABILISE_REPORT.md`

## Required maintainer test

1. Normal mobile page should look like the earlier stable view again.
2. Fullscreen portrait summary should stay inside the box.
3. Fullscreen landscape should show graph only, with no summary box.
