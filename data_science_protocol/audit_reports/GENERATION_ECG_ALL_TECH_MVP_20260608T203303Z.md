# GlobalGrid2050 All Technology ECG MVP Report

Generated UTC: `2026-06-08T20:33:03Z`
Mode: `audit only`
ECG days: `30`
Rows parsed: `2268187`
Daily rows: `7035`
Monthly rows: `289`
All technology ECG rows: `442080`

## Outputs


## Source files

uk_energy_tracking_v6/generation_history/generation_recent_halfhourly_30d.json  parsed 79200 rows
uk_energy_tracking_v6/generation_history/generation_recent_30d_30min.json  parsed 14409 rows
data/generation/elexon_generation_sources_half_hourly.csv  parsed 174240 rows
data/generation/elexon_generation_sources_2026.csv  parsed 174240 rows
data/generation/elexon_generation_sources_2025.csv  parsed 20 rows
data/generation/archive/2021/elexon_generation_sources_2020-12.csv  parsed 16 rows
data/generation/archive/2021/elexon_generation_sources_2021-01.csv  parsed 145662 rows
data/generation/archive/2021/elexon_generation_sources_2021-02.csv  parsed 138432 rows
data/generation/archive/2021/elexon_generation_sources_2021-03.csv  parsed 152890 rows
data/generation/archive/2021/elexon_generation_sources_2021-04.csv  parsed 148320 rows
data/generation/archive/2021/elexon_generation_sources_2021-05.csv  parsed 153213 rows
data/generation/archive/2021/elexon_generation_sources_2021-06.csv  parsed 148320 rows
data/generation/archive/2021/elexon_generation_sources_2021-07.csv  parsed 153264 rows
data/generation/archive/2021/elexon_generation_sources_2021-08.csv  parsed 153264 rows
data/generation/archive/2021/elexon_generation_sources_2021-09.csv  parsed 153153 rows
data/generation/archive/2021/elexon_generation_sources_2021-10.csv  parsed 162084 rows
data/generation/archive/2021/elexon_generation_sources_2021-11.csv  parsed 156096 rows
data/generation/archive/2021/elexon_generation_sources_2021-12.csv  parsed 161364 rows

## Browser rule

The ECG hot tier stores all technologies for the rolling window. The chart must filter client side by selected technology and must not draw all technology traces by default.

## Notes

Candidate first. This does not promote confirmed data and does not overwrite production files. It proves the all technology hot tier ECG storage pattern while keeping browser display to one selected technology.
