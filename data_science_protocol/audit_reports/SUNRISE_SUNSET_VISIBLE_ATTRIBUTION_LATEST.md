# Sunrise Sunset Visible Attribution

Generated UTC: `2026-06-13T23:26:09.062203Z`
Mode: `apply`
Pass: `True`

Adds a visible UI attribution line for the sunrise and sunset reference source under the Generation Output in MWh panel. The line names Sunrise-Sunset.org API, links the source, states Europe/London and UK reference locations. No data files are changed.

## Planned changed files

- `uk_energy_tracking_v6/generation_history/index.md`

## Checks

| Check | Result |
|---|---|
| index_exists | ✅ |
| route_present | ✅ |
| mwh_panel_present | ✅ |
| visible_attribution_inserted | ✅ |
| source_name_visible | ✅ |
| source_link_visible | ✅ |
| timezone_visible | ✅ |
| uk_reference_locations_visible | ✅ |
| attribution_css_inserted | ✅ |
| cache_busters_updated | ✅ |
| data_files_not_touched | ✅ |

## Rollback

Revert the apply commit. This repair changes only uk_energy_tracking_v6/generation_history/index.md.
