# V6 Repair Report: Weekly Axis Padding

Generated UTC: 2026-06-04T19:10:22.986109+00:00

## Scope

This repair only changes chart canvas bottom padding for raw half hourly weekly windows.

## Reason

Weekly day labels and 00:00, 06:00, 13:00 and 16:00 time guide labels were being drawn below the available canvas plot area. They were visible but cut off at the bottom edge.

## Behaviour

1. If the visible window is greater than 2.1 days and not greater than 7.1 days, the renderer increases bottom padding to at least 82 device scaled pixels.
2. 24 hour and 48 hour views are not changed by this rule.
3. Daily aggregate and longer range behaviour is not changed.
4. No data files, loaders, CSV files or source paths are changed.

## Files touched by script

- uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js

## Manual checks

1. Open /uk_energy_tracking_v6/ and select 1 week.
2. Confirm day labels and time guide labels are visible and not cut off.
3. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html and select Latest 1 week.
4. Confirm the same behaviour.
5. Confirm 24 hours, 48 hours, 1 month, 6 months and 10 years still behave as before.
