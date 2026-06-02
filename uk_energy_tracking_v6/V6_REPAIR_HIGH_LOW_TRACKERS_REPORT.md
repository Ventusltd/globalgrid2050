# V6 Repair Report: High Low Trackers

Status: prepared by deterministic repair script.

## Scope

This repair restores V5-style floating price tracker boxes inside the V6 electricity price chart.

## Behaviour changed

1. Adds floating chart callouts for HIGH, AVERAGE and LOW.
2. Uses the V5 event-box and pointer concept as the behavioural reference.
3. Applies to the normal in-page chart and fullscreen portrait chart.
4. Keeps fullscreen landscape clean by not drawing tracker boxes there.
5. Leaves the existing fullscreen portrait bottom summary box in place.
6. Bumps the V6 render script query string so the live page loads the repaired renderer.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/index.md`
3. `uk_energy_tracking_v6/V6_REPAIR_HIGH_LOW_TRACKERS_REPORT.md`

## Explicit non scope

No V5 file changed.
No CSS changed.
No data feed changed.
No forecast wiring changed.
No period dropdown changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`, test the in-page chart, then enter fullscreen portrait. Confirm HIGH, AVERAGE and LOW tracker boxes render on the chart and the existing bottom summary box remains readable. Rotate to landscape and confirm the graph remains clean without tracker boxes.
