# Fix UK Renewables Pipeline CSV Export

UTC created: 2026-05-20T20:20:17.365517+00:00

## Purpose

Fix the dead EXPORT CSV link on the UK Renewables Pipeline dashboard so it downloads the currently filtered table data.

## Actions

- added id to EXPORT CSV sidebar link
- added currentFilteredData state
- stored currently filtered data before rendering
- added CSV export function
- wired EXPORT CSV click handler

## Manual acceptance test

1. Open `/uk_renewables_pipeline/dashboard.html`.
2. Apply a technology or status filter.
3. Click `EXPORT CSV` in the sidebar.
4. Confirm a CSV downloads with the filtered rows only.
5. Open the CSV and confirm columns: Site Name, County, Operator, Technology, Status, Capacity MW.
