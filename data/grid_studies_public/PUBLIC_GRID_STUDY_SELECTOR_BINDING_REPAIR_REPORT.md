# Public Grid Study Selector Binding Repair Report

Generated UTC: 2026-06-05T00:16:11.943681+00:00

## Problem found

The Year and Period selectors were visible, but the existing preset button state could remain visually and functionally dominant. On mobile this made the chart appear to remain locked to the 10 year preset even after changing the Period selector.

## Repair

1. Added an explicit Apply selected year and period button.
2. Added both input and change listeners for mobile selector behaviour.
3. Clears preset button active state before rendering the selected year and period.
4. Marks the selector apply button active after selector rendering.
5. Defaults the selector based chart to 12 months Jan to Dec.
6. Triggers a selector render after page load so the selector state and chart state are aligned.
7. Preserves all existing preset buttons.

## Files touched by script

- data/grid_studies_public/gb_electricity_year_selector.js
- data/grid_studies_public/great_britain_electricity_price_grid_constraint_trends_2016_2026.html

## Maintainer test checklist

1. Open the public grid study page.
2. Confirm Year and Period selectors appear.
3. Confirm an Apply selected year and period button appears.
4. Confirm default selector chart is 12 months Jan to Dec or current YTD for the active year.
5. Select 2016 and 6 months, then apply if needed.
6. Confirm the chart no longer remains on 10 year view.
7. Confirm all existing preset buttons still work.
