# V6 Repair: Normal-page Electricity Chart Layout

Status: prepared by deterministic repair script.

## Stage 1 changes

1. Normal in-page portrait chart reduced by another 30 percent:
   - from `90dvh / 670px`
   - to `63dvh / 470px`
2. Fullscreen period selector moved to the top left under the title line with one line of spacing.
3. Fullscreen period selector is styled in SCADA dark/cyan colours.
4. Fullscreen chart drawing logic is not changed.
5. V5 is not changed.
6. Data, fetchers, price calculation, frequency and controls are not changed.

## Exact code location

The non-fullscreen chart is managed in:

`uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`

Inside:

`function renderTo(canvasId,result)`

The key variable is:

`var pad = ...`

The fullscreen branch is:

`isFull ? (...) : (...)`

The normal-page branch is the second branch after the colon.

## Required test

1. Open `/uk_energy_tracking_v6/` on mobile portrait normal page.
2. Confirm the in-page chart is shorter than the previous version.
3. Open fullscreen mode.
4. Confirm the period selector sits top left below the title line.
5. Confirm the period selector uses dark/cyan SCADA styling rather than default white styling.
