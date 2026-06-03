#!/usr/bin/env python3
"""
V6 electricity price chart normal-page layout repair.

Scope is deliberately narrow:
1. Fix only the non-fullscreen electricity price canvas.
2. Keep fullscreen chart behaviour untouched.
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
for token in ["price-history-canvas", "Only working V6 renderer loaded", "Overlay workaround removed", "Page load order"]:
    if token not in comparison:
        raise RuntimeError(f"Comparison report does not contain expected guardrail: {token}")

css = CSS.read_text(encoding="utf-8", errors="replace")
render = RENDER.read_text(encoding="utf-8", errors="replace")
index = INDEX.read_text(encoding="utf-8", errors="replace")

# Remove previous experimental chart-space block before adding the corrected version.
css = re.sub(
    r"\n/\* V6 repair: in-page electricity chart real estate\..*?\n\}\n?",
    "\n",
    css,
    flags=re.S,
)

css_patch = """

/* V6 repair: normal-page electricity chart real estate.
   Scope: non-fullscreen canvas only. Fullscreen overlay is untouched. */
@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{
    height:112dvh!important;
    min-height:820px!important;
    max-height:none!important;
  }
}
@media(max-width:950px) and (orientation:landscape){
  #electricity-price-history-panel .trend-panel{
    padding:6px!important;
  }
  #electricity-price-history-panel #price-history-canvas{
    height:88dvh!important;
    min-height:420px!important;
    max-height:none!important;
  }
  #electricity-price-history-panel .gg-machine-note{
    display:none!important;
  }
}
"""
if "V6 repair: normal-page electricity chart real estate" not in css:
    css = css.rstrip() + css_patch

# Location of the issue:
# renderTo() manages normal and fullscreen drawing. The full-screen branch is `isFull ? ...`.
# The normal-page branch is the `: (...)` branch after that ternary. Only that branch should change.
old_pad_patterns = [
    "var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var nonFullLandscape=!isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:78*q,bottom:48*q}:{left:58*q,right:18*q,top:132*q,bottom:86*q}):(nonFullLandscape?{left:58*q,right:18*q,top:58*q,bottom:72*q}:{left:74*q,right:24*q,top:92*q,bottom:76*q});g.clearRect",
    "var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:285*q}):{left:74*q,right:24*q,top:96*q,bottom:284*q};g.clearRect",
]
new_pad = "var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var nonFullLandscape=!isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:285*q}):(nonFullLandscape?{left:58*q,right:22*q,top:56*q,bottom:48*q}:{left:66*q,right:24*q,top:88*q,bottom:44*q});g.clearRect"

replaced = 0
for old in old_pad_patterns:
    if old in render:
        render = render.replace(old, new_pad, 1)
        replaced += 1
        break
if replaced != 1:
    raise RuntimeError("Could not replace renderTo pad definition safely")

for token in [
    "nonFullLandscape=!isFull&&cssW>cssH",
    "{left:50*q,right:22*q,top:74*q,bottom:44*q}",
    "{left:58*q,right:18*q,top:104*q,bottom:285*q}",
    "{left:58*q,right:22*q,top:56*q,bottom:48*q}",
    "{left:66*q,right:24*q,top:88*q,bottom:44*q}",
]:
    if token not in render:
        raise RuntimeError(f"Renderer assertion failed: {token}")

# Cache-bust CSS and renderer only. Do not change script order.
index = re.sub(
    r'/uk_energy_tracking_v6/styles/app\.css\?v=[^"]+',
    '/uk_energy_tracking_v6/styles/app.css?v=20260604normalchart1',
    index,
)
index = re.sub(
    r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
    '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260604normalchart1',
    index,
)

if "render_price_chart_box_overlay.js" in index:
    raise RuntimeError("Old overlay renderer still referenced in index.md")
if "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Broken replacement renderer still referenced in index.md")
if "20260604normalchart1" not in index:
    raise RuntimeError("Cache-bust token missing from index.md")

CSS.write_text(css, encoding="utf-8")
RENDER.write_text(render, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

REPORT.write_text("""# V6 Repair: Normal-page Electricity Chart Layout

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

The normal-page branch is the second branch after the colon. This repair changes only that normal-page branch and restores the fullscreen pad values to the previous working values.

## Problem observed

The previous chart-space repair made the CSS canvas taller but did not give the normal-page renderer a correct plot-area contract. On mobile landscape, the plot could be visually squeezed into the top band and the x-axis could appear in the wrong place. On portrait, the canvas became taller but the graph still did not use the space cleanly.

## Behaviour changed

1. Fullscreen mode is left alone:
   - fullscreen landscape pad restored to `left 50q, right 22q, top 74q, bottom 44q`
   - fullscreen portrait pad restored to `left 58q, right 18q, top 104q, bottom 285q`
2. Non-fullscreen landscape now has its own pad:
   - `left 58q, right 22q, top 56q, bottom 48q`
3. Non-fullscreen portrait now has its own pad:
   - `left 66q, right 24q, top 88q, bottom 44q`
4. Mobile portrait normal-page canvas is set to `112dvh` with `820px` minimum height.
5. Mobile landscape normal-page canvas is set to `88dvh` with `420px` minimum height.
6. The Grid Intelligence note is hidden in mobile landscape only to give chart space.
7. No V5 file changed.
8. No data logic changed.
9. No price fetch changed.
10. No frequency logic changed.

## Required test

1. Open `/uk_energy_tracking_v6/` on mobile portrait.
2. Confirm the normal in-page electricity chart is taller but not wastefully blank.
3. Rotate to mobile landscape without fullscreen.
4. Confirm the x-axis sits at the bottom of the plot.
5. Confirm fullscreen mode still behaves as before.
""", encoding="utf-8")

print("V6 normal-page chart layout repair prepared.")
