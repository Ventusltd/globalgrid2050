# V6 Repair: Normal-page Electricity Chart Layout

Status: prepared by deterministic repair script.

## Exact code location

The non-fullscreen chart is managed in:

`uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`

Inside:

`function renderTo(canvasId,result)`

The key variable is:

`var pad = ...`

The fullscreen branch is:

`isFull ? (...) : (...)`

The normal-page branch is the second branch after the colon. This repair changes only that normal-page branch and keeps fullscreen chart drawing values at the previous working values.

## Problem observed

The previous chart-space repair made the normal portrait canvas too tall. The fullscreen period selector also looked like a default spreadsheet select and sat too centrally in the toolbar.

## Behaviour changed

1. Fullscreen chart drawing is left alone:
   - fullscreen landscape pad remains `left 50q, right 22q, top 74q, bottom 44q`
   - fullscreen portrait pad remains `left 58q, right 18q, top 104q, bottom 285q`
2. Normal-page portrait canvas is reduced by about 30 percent from the earlier 128dvh value:
   - `height 90dvh`
   - `min-height 670px`
3. Normal-page landscape remains:
   - `height 88dvh`
   - `min-height 420px`
4. Non-fullscreen landscape keeps its own renderer pad:
   - `left 58q, right 22q, top 56q, bottom 48q`
5. Non-fullscreen portrait keeps its own renderer pad:
   - `left 66q, right 24q, top 88q, bottom 44q`
6. Fullscreen period selector is moved to the right side of the toolbar beside the close button.
7. Fullscreen period selector is styled in the SCADA colour scheme.
8. No V5 file changed.
9. No data logic changed.
10. No price fetch changed.
11. No frequency logic changed.

## Required test

1. Open `/uk_energy_tracking_v6/` on mobile portrait normal page.
2. Confirm the in-page chart is about 30 percent shorter than the previous stretched version.
3. Open fullscreen mode.
4. Confirm the period selector sits on the right near the close button.
5. Confirm the period selector uses the dark/cyan SCADA style rather than the default white iOS select style.
