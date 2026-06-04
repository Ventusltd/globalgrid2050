#!/usr/bin/env python3
"""
V6 electricity price chart normal-page layout repair.

Scope is deliberately narrow:
1. Fix only the non-fullscreen electricity price canvas height and pad.
2. Keep fullscreen chart drawing logic untouched.
3. Style and position the fullscreen period selector without changing data logic.
4. Do not touch V5, data fetchers, price calculations, period controls or frequency code.
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

# Remove previous experimental chart-space blocks before adding the corrected version.
css = re.sub(
    r"\n/\* V6 repair: in-page electricity chart real estate\..*?\n\}\n?",
    "\n",
    css,
    flags=re.S,
)
css = re.sub(
    r"\n/\* V6 repair: normal-page electricity chart real estate\..*?\n\}\n?",
    "\n",
    css,
    flags=re.S,
)
css = re.sub(
    r"\n/\* V6 repair: fullscreen period selector SCADA styling\..*?\n\}\n?",
    "\n",
    css,
    flags=re.S,
)

css_patch = """

/* V6 repair: normal-page electricity chart real estate.
   Scope: non-fullscreen canvas only. Fullscreen canvas drawing is untouched. */
@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{
    height:90dvh!important;
    min-height:670px!important;
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

/* V6 repair: fullscreen period selector SCADA styling.
   Scope: toolbar controls only. Fullscreen canvas size and drawing are untouched. */
.price-history-fullscreen-period-label{
  margin-left:auto!important;
  display:flex!important;
  align-items:center!important;
  gap:8px!important;
  color:#00ffff!important;
  font:12px "Courier New",monospace!important;
  letter-spacing:.10em!important;
  text-transform:uppercase!important;
}
.price-history-fullscreen-period-label select{
  min-width:142px!important;
  max-width:42vw!important;
  appearance:none!important;
  -webkit-appearance:none!important;
  background:linear-gradient(180deg,rgba(0,255,255,.13),rgba(0,255,255,.035))!important;
  color:#00ffff!important;
  border:1px solid rgba(0,255,255,.42)!important;
  border-radius:8px!important;
  padding:7px 34px 7px 10px!important;
  font:14px "Courier New",monospace!important;
  box-shadow:0 0 14px rgba(0,255,255,.14),inset 0 0 16px rgba(0,255,255,.04)!important;
  text-shadow:0 0 8px rgba(0,255,255,.35)!important;
}
.price-history-fullscreen-period-label::after{
  content:"▾";
  margin-left:-30px;
  color:#00ffff;
  pointer-events:none;
  text-shadow:0 0 8px rgba(0,255,255,.65);
}
.price-history-fullscreen-toolbar button{
  margin-left:8px!important;
}
@media(max-width:850px) and (orientation:portrait){
  .price-history-fullscreen-toolbar strong{
    max-width:38vw!important;
  }
  .price-history-fullscreen-period-label{
    gap:6px!important;
    font-size:10px!important;
  }
  .price-history-fullscreen-period-label select{
    min-width:132px!important;
    max-width:40vw!important;
    font-size:13px!important;
  }
}
"""
if "V6 repair: normal-page electricity chart real estate" not in css:
    css = css.rstrip() + css_patch

# Location of the non-fullscreen chart issue:
# renderTo() manages normal and fullscreen drawing. The full-screen branch is `isFull ? ...`.
# The normal-page branch is the `: (...)` branch after that ternary. Only that branch should change.
old_pad_patterns = [
    "var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var nonFullLandscape=!isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:78*q,bottom:48*q}:{left:58*q,right:18*q,top:132*q,bottom:86*q}):(nonFullLandscape?{left:58*q,right:18*q,top:58*q,bottom:72*q}:{left:74*q,right:24*q,top:92*q,bottom:76*q});g.clearRect",
    "var g=c.getContext('2d'),w=c.width,h=c.height,cssW=w/q,cssH=h/q,isLandscape=isFull&&cssW>cssH;var nonFullLandscape=!isFull&&cssW>cssH;var pad=isFull?(isLandscape?{left:50*q,right:22*q,top:74*q,bottom:44*q}:{left:58*q,right:18*q,top:104*q,bottom:285*q}):(nonFullLandscape?{left:58*q,right:22*q,top:56*q,bottom:48*q}:{left:66*q,right:24*q,top:88*q,bottom:44*q});g.clearRect",
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
    '/uk_energy_tracking_v6/styles/app.css?v=20260604chartfit1',
    index,
)
index = re.sub(
    r'/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart\.js\?v=[^"]+',
    '/uk_energy_tracking_v6/price_history_chart/render_price_chart/render_price_chart.js?v=20260604chartfit1',
    index,
)

if "render_price_chart_box_overlay.js" in index:
    raise RuntimeError("Old overlay renderer still referenced in index.md")
if "render_price_chart_v6_clean_boxes.js" in index:
    raise RuntimeError("Broken replacement renderer still referenced in index.md")
if "20260604chartfit1" not in index:
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
""", encoding="utf-8")

print("V6 normal-page chart height and fullscreen period selector repair prepared.")
