# Public Grid Study Repair Report: Year and Period Selector

Generated UTC: 2026-06-05T00:01:17.756578+00:00

## Scope

This workflow adds a Period selector beside the existing Year selector on the public Great Britain electricity price and grid constraint study chart.

## Intended behaviour

1. Existing preset buttons remain in place.
2. The Year selector remains in place.
3. A new Period selector is added with 1 week, 1 month, 3 months, 6 months and 12 months Jan to Dec.
4. The default period is 12 months Jan to Dec.
5. Selecting a year defaults to that calendar year unless the current active year is year to date.
6. Selecting a shorter period starts from 1 January of the selected year and ends after the chosen period, or at the available current data limit for the active YTD year.
7. The chart continues to use the existing V6 loader and renderer.
8. The existing preset buttons remain available for COVID, gas squeeze, 2021 spike, Ukraine crisis, negative price regime and latest 24 hour, 48 hour and 1 week views.

## Files touched by script

- data/grid_studies_public/gb_electricity_year_selector.js
- data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html

## Guardrails checked

- AI_START_HERE.md read.
- ARCHITECTURE.md read.
- LAUNCH_FREEZE.md read.
- WORKFLOW_REGISTRY.md read.
- OPERATOR_MANUAL_V1.md read.
- No workflow was deleted, renamed or archived.
- Existing chart preset buttons were not removed.
- Existing data loader and renderer paths remain unchanged.

## Maintainer test checklist

1. Open /data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html.
2. Confirm Year and Period selectors appear above the existing buttons.
3. Confirm Period defaults to 12 months Jan to Dec.
4. Select 2016 and confirm Jan to Dec 2016 loads.
5. Select 2022 and confirm Jan to Dec 2022 loads.
6. Select 2026 YTD and confirm the active year to date range loads.
7. Change Period to 1 month, 3 months and 6 months and confirm the chart updates from 1 January of the selected year.
8. Confirm the existing preset buttons still work.
