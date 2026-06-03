#!/usr/bin/env python3
"""
V6 electricity price chart real estate repair.

Scope is deliberately narrow:
1. Make the non-fullscreen mobile portrait chart taller and more vivid.
2. Fix non-fullscreen mobile landscape compression by giving the renderer a landscape-aware pad.
3. Do not touch V5, data fetchers, price calculations, period controls or frequency code.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
CSS = V6 / "styles" / "app.css"
RENDER = V6 / "price_history_chart" / "render_price_chart" / "render_price_chart.js"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_REPAIR_INPAGE_CHART_REAL_ESTATE.md"

required = [
    ROOT / "AI_START_HERE.md",
    V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    V6 / "V5_V6_COMPARISON_REPORT.md",
    V6 / "V5_V6_COMPARISON_REPORT_V2.md",
    CSS,
    RENDER,
    INDEX,
]
for path in required:
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path.relative_to(ROOT)}")
    path.read_text(encoding="utf-8", errors="replace")

comparison = (V6 / "V5_V6_COMPARISON_REPORT_V2.md").read_text(encoding="utf-8", errors="replace")
for token in [
    "price-history-canvas",
    "Only working V6 renderer loaded",
    "Overlay workaround removed",
    "Page load order",
]:
    if token not in comparison:
        raise RuntimeError(f"Comparison report does not contain expected guardrail: {token}")

css = CSS.read_text(encoding="utf-8", errors="replace")
render = RENDER.read_text(encoding="utf-8", errors="replace")
index = INDEX.read_text(encoding="utf-8", errors="replace")

css_patch_marker = "V6 repair: in-page electricity chart real estate"
css_patch = """

/* V6 repair: in-page electricity chart real estate.
   Purpose: make the normal mobile chart vivid without touching data logic.
   Portrait gets a taller canvas. Landscape gets enough height so the x-axis
   and y-axis are not crushed into the top of the chart. */
@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{
    height:128dvh!important;
    min-height:960px!important;
    max-height:none!important;
  }
}
@media(max-width:950px) and (orientation:landscape){
  #electricity-price-history-panel .trend-panel{
    padding:6px!important;
  }
  #electricity-price-history-panel #price-history-canvas{
    height:108dvh!important;
    min-height:520px!important;
    max-height:none!important;
  }
  #electricity-price-history-panel .gg-machine-note{
    display:none!important;
  }
  #electricity-price-history-panel .price-history-actions{
    gap:6px!important;
    margin-bottom:6px!important;
  }
}
"""
if css_patch_marker not in css:
    css = css.rstrip() + css_patch

# Make the renderer landscape-aware for the in-page canvas. The previous renderer
# only treated fullscreen as landscape, so non-fullscreen landscape inherited
# portrait padding and could crush the visible plot.
pattern = r"var pad=isFull\?\(isLandscape\?\{[^}]+\}:\{[^}]+\}\):\{[^}]+\};g\.clearRect"
replacement = (
    "var nonFullLandscape=!isFull&&cssW>cssH;"
    "var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:78*q,bottom:48*q}:{left:58*q,right:18*q,top:132*q,bottom:86*q}):(nonFullLandscape?{left:58*q,right:18*q,top:58*q,bottom:72*q}:{left:74*q,right:24*q,top:92*q,bottom:76*q});g.clearRect"
)
render, count = re.subn(pattern, replacement, render, count=1)
if count != 1:
    raise RuntimeError("Could not replace renderer pad definition exactly once")

for token in [
    "nonFullLandscape=!isFull&&cssW>cssH",
    "bottom:72*q",
    "bottom:76*q",
]:
    if token not in render:
        raise RuntimeError(f"Renderer assertion failed: {token}")

# Cache-bust CSS and renderer only. Do not change script order.
index = re.sub(
    r'/uk_energy_tracking_v6/styles/app\.css\?v=[^"]+',
    '/uk_energy_tracking_v6/styles/app.css?v=20260603chartspace1',
    index,
)
index = re.sub(
    r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
    '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260603chartspace1',
    index,
)

if "render_price_chart_box_overlay.js" in index:
    raise RuntimeError("Old overlay renderer still referenced in index.md")
if "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Broken replacement renderer still referenced in index.md")
if "20260603chartspace1" not in index:
    raise RuntimeError("Cache-bust token missing from index.md")

CSS.write_text(css, encoding="utf-8")
RENDER.write_text(render, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

REPORT.write_text("""# V6 Repair: In-page Electricity Chart Real Estate

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
""", encoding="utf-8")

print("V6 in-page chart real estate repair prepared.")
