# MWh Mobile Bounds Repair

Generated UTC: `2026-06-13T20:56:18.160895Z`
Mode: `apply`
Pass: `True`

Fixes phone-width overflow in the Generation Output in MWh cards. It removes the large red interconnector warning box, bounds the Day/Night split and monthly mini-chart to the card width, overrides the old interconnector min-width rule and styles the total electricity check as compact metrics. No data files are changed.

## Planned changed files

- `uk_energy_tracking_v6/generation_history/index.md`

## Checks

| Check | Result |
|---|---|
| index_exists | ✅ |
| route_present | ✅ |
| warning_box_removed | ✅ |
| mobile_bounds_css_inserted | ✅ |
| day_night_split_bounded | ✅ |
| mini_chart_bounded | ✅ |
| interconnector_min_width_overridden | ✅ |
| total_check_metric_grid_styled | ✅ |
| cache_busters_updated | ✅ |
| data_files_not_touched | ✅ |

## Rollback

Revert the apply commit. This repair changes only uk_energy_tracking_v6/generation_history/index.md.
