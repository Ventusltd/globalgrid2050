# V6 Repair: In-page Electricity Chart Real Estate

Status: prepared by deterministic repair script.

## Problem observed

The normal V6 electricity price chart is too compressed on mobile. Portrait leaves too much unused space and the plot needs to be more vivid. Mobile landscape is worse: the chart can inherit portrait-style padding because the renderer only identifies landscape for fullscreen mode. This can push the x-axis and date labels into the wrong visual area.

## Code dependencies identified

1. `uk_energy_tracking_v6/index.md`
   - Loads `styles/app.css`.
   - Contains `#price-history-canvas`.
   - Loads `render_price_chart.js` after the V6 price data loader.

2. `uk_energy_tracking_v6/styles/app.css`
   - Controls the rendered height of `#price-history-canvas`.
   - Existing mobile portrait rule controls normal-page mobile height.
   - Existing landscape rule compresses the chart on short mobile landscape screens.

3. `uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js`
   - `renderTo(...)` reads the canvas CSS box using `getBoundingClientRect()`.
   - `renderTo(...)` converts that box into internal canvas pixels.
   - The `pad` object controls the plot area, including where the x-axis is drawn.
   - The old logic treated `isLandscape` as fullscreen-only, so normal landscape inherited the wrong padding.

4. `uk_energy_tracking_v6/V5_V6_COMPARISON_REPORT_V2.md`
   - Confirms the working renderer is loaded.
   - Confirms the overlay workaround is absent.
   - Confirms the page load order and DOM ID parity.

## Behaviour changed

1. Mobile portrait normal-page chart height increased to `128dvh` with `960px` minimum height.
2. Mobile landscape normal-page chart height increased to `108dvh` with `520px` minimum height.
3. Mobile landscape hides the Grid Intelligence note inside the price panel so the chart gets more screen space.
4. Renderer now has `nonFullLandscape` detection.
5. Renderer uses separate non-fullscreen landscape padding:
   - left `58q`
   - right `18q`
   - top `58q`
   - bottom `72q`
6. Renderer uses tighter non-fullscreen portrait padding:
   - top `92q`
   - bottom `76q`
7. No data logic changed.
8. No V5 file changed.
9. No workflow changed.
10. No price calculation changed.

## Required test

1. Open `/uk_energy_tracking_v6/` on mobile portrait.
2. Confirm the normal in-page electricity chart is much taller and the trace is more vivid.
3. Rotate to mobile landscape without fullscreen.
4. Confirm the plot fills more of the screen and the x-axis sits at the bottom of the plot, not in the wrong visual band.
5. Confirm fullscreen mode still opens and swipes/arrows still work.
