# V6 Repair Report: Fullscreen Summary Box

Status: prepared by deterministic repair script.

## Scope

This repair improves the V6 electricity price fullscreen chart summary box.

## Behaviour changed

1. Moves the fullscreen summary box higher above the mobile browser bottom bar.
2. Increases fullscreen bottom chart padding so the axis date and summary box no longer collide.
3. Renders one clean line each for High, Average and Low.
4. Spells out High, Average and Low in the fullscreen summary box.

## Files changed by workflow execution

1. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
2. `uk_energy_tracking_v6/V6_REPAIR_FULLSCREEN_SUMMARY_BOX_REPORT.md`

## Explicit non scope

No data paths changed.
No forecast logic changed.
No V5 file changed.

## Required maintainer test

Open `/uk_energy_tracking_v6/`, enter fullscreen on mobile and verify that the bottom date, axis and summary box are readable without awkward clipping.
