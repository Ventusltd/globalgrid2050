# Sunrise Sunset Time Bands

Generated UTC: `2026-06-13T22:10:25.928103Z`
Mode: `apply`
Pass: `True`

Fetches UK sunrise and sunset reference times for 5 UK locations on the 15th of each month, using fixed clock time bands only. This prepares the data layer for replacing the crude day versus night panel with time ranges plus sunrise and sunset context. Generation data is not changed.

## Time bands

- `00:00-06:00`
- `06:00-10:00`
- `10:00-16:00`
- `16:00-20:00`
- `20:00-24:00`

## Planned changed files

- `uk_energy_tracking_v6/generation_history/sunrise_sunset_time_bands_reference.json`

## Checks

| Check | Result |
|---|---|
| has_five_time_bands | ✅ |
| time_bands_are_times_only | ✅ |
| has_reference_locations | ✅ |
| fetched_rows_for_12_months_and_5_locations | ✅ |
| monthly_summary_has_12_rows | ✅ |
| sunrise_and_sunset_are_hhmm | ✅ |
| timezone_is_europe_london | ✅ |
| source_attribution_flag_present | ✅ |
| output_under_1mb | ✅ |
| generation_data_not_touched | ✅ |

## Rollback

Delete the compact sunrise_sunset_time_bands_reference.json output or revert the apply commit.
