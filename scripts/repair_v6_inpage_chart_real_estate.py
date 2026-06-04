#!/usr/bin/env python3
"""
V6 electricity price chart layout repair.

Narrow scope:
1. Normal in page portrait chart height only.
2. Fullscreen toolbar and Period selector CSS only.
3. No data, fetcher, render calculation, V5 or frequency changes.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
V6 = ROOT / "uk_energy_tracking_v6"
CSS = V6 / "styles" / "app.css"
INDEX = V6 / "index.md"
REPORT = V6 / "V6_REPAIR_INPAGE_CHART_REAL_ESTATE.md"

required = [
    ROOT / "AI_START_HERE.md",
    V6 / "V6_ARCHITECTURAL_INTEGRITY_PROTOCOL.md",
    V6 / "V5_V6_COMPARISON_REPORT.md",
    V6 / "V5_V6_COMPARISON_REPORT_V2.md",
    CSS,
    INDEX,
]
for path in required:
    if not path.exists():
        raise FileNotFoundError(f"Required file missing: {path.relative_to(ROOT)}")
    path.read_text(encoding="utf-8", errors="replace")

css = CSS.read_text(encoding="utf-8", errors="replace")
index = INDEX.read_text(encoding="utf-8", errors="replace")

# Remove only this final hard override if rerun. Older historic repair blocks are left alone,
# because this block is appended last and uses stronger selectors with !important.
css = re.sub(
    r"\n/\* V6 hard override: fullscreen toolbar grid and safe selector\..*?\n/\* End V6 hard override \*/\n?",
    "\n",
    css,
    flags=re.S,
)

hard_override = """

/* V6 hard override: fullscreen toolbar grid and safe selector.
   This block must sit last so it defeats the older flex toolbar rules above. */
@media(max-width:850px) and (orientation:portrait){
  #electricity-price-history-panel #price-history-canvas{
    height:63dvh!important;
    min-height:470px!important;
    max-height:none!important;
  }
}

.price-history-fullscreen-toolbar{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 40px!important;
  grid-template-rows:22px 46px!important;
  align-items:start!important;
  gap:4px 8px!important;
  height:76px!important;
  padding:7px max(8px,env(safe-area-inset-right)) 5px max(8px,env(safe-area-inset-left))!important;
  background:rgba(0,0,0,.82)!important;
  border-bottom:1px solid rgba(0,255,255,.12)!important;
  backdrop-filter:blur(4px)!important;
  color:#00ffff!important;
  font-family:"Courier New",monospace!important;
  box-sizing:border-box!important;
}
.price-history-fullscreen-toolbar strong{
  grid-column:1!important;
  grid-row:1!important;
  color:#00ffff!important;
  font:800 12px/18px "Courier New",monospace!important;
  letter-spacing:.08em!important;
  text-transform:uppercase!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  max-width:100%!important;
  margin:0!important;
}
.price-history-fullscreen-toolbar button#price-history-fullscreen-close{
  grid-column:2!important;
  grid-row:1 / span 2!important;
  justify-self:end!important;
  align-self:start!important;
  margin:0!important;
  width:34px!important;
  height:34px!important;
  border:1px solid rgba(0,255,255,.35)!important;
  border-radius:50%!important;
  background:#05070c!important;
  color:#00ffff!important;
  box-shadow:0 0 12px rgba(0,255,255,.18)!important;
  font:24px/1 "Courier New",monospace!important;
}
.price-history-fullscreen-period-label{
  grid-column:1!important;
  grid-row:2!important;
  justify-self:start!important;
  align-self:start!important;
  display:flex!important;
  align-items:center!important;
  gap:9px!important;
  margin:1ch 0 0 0!important;
  color:#00ffff!important;
  font:800 11px/1 "Courier New",monospace!important;
  letter-spacing:.12em!important;
  text-transform:uppercase!important;
}
.price-history-fullscreen-period-label select{
  color-scheme:dark!important;
  appearance:none!important;
  -webkit-appearance:none!important;
  min-width:150px!important;
  max-width:58vw!important;
  padding:8px 34px 8px 12px!important;
  border:1px solid rgba(0,255,255,.45)!important;
  border-radius:7px!important;
  background:#05070c!important;
  color:#00ffff!important;
  font:800 14px/1.1 "Courier New",monospace!important;
  box-shadow:0 0 12px rgba(0,255,255,.16),inset 0 0 18px rgba(0,255,255,.045)!important;
  text-shadow:0 0 7px rgba(0,255,255,.35)!important;
}
.price-history-fullscreen-period-label select option{
  background:#05070c!important;
  color:#00ffff!important;
  font-family:"Courier New",monospace!important;
}
.price-history-fullscreen-period-label::after{
  content:"▾"!important;
  margin-left:-31px!important;
  color:#00ffff!important;
  pointer-events:none!important;
  text-shadow:0 0 8px rgba(0,255,255,.65)!important;
}
#price-history-fullscreen-meta{
  display:none!important;
}
#price-history-fullscreen-canvas{
  height:calc(100dvh - 76px)!important;
}
@media(orientation:landscape){
  .price-history-fullscreen-toolbar{
    height:64px!important;
    grid-template-rows:18px 38px!important;
  }
  .price-history-fullscreen-toolbar strong{
    font-size:11px!important;
    line-height:16px!important;
  }
  .price-history-fullscreen-period-label{
    margin-top:.6ch!important;
  }
  .price-history-fullscreen-period-label select{
    min-width:138px!important;
    font-size:12px!important;
    padding:6px 32px 6px 10px!important;
  }
  #price-history-fullscreen-canvas{
    height:calc(100dvh - 64px)!important;
  }
}
/* End V6 hard override */
"""

css = css.rstrip() + hard_override

index = re.sub(
    r'/uk_energy_tracking_v6/styles/app\.css\?v=[^"]+',
    '/uk_energy_tracking_v6/styles/app.css?v=20260604toolbargrid1',
    index,
)
if "20260604toolbargrid1" not in index:
    raise RuntimeError("Cache bust token missing from index.md")

CSS.write_text(css, encoding="utf-8")
INDEX.write_text(index, encoding="utf-8")

REPORT.write_text("""# V6 Repair: Fullscreen Toolbar Grid and Safe Period Selector

Status: prepared by deterministic repair script.

## Why the earlier fix did not work

The live stylesheet still had the original fullscreen toolbar as a flex row. The close button still used margin left auto. That forced the title, Period selector and close button into one row.

The previous selector styling did not survive into the final live stylesheet in the required position, so the browser kept applying the old toolbar contract.

## Fix applied by this script

1. Adds a hard CSS override at the end of `app.css`.
2. Changes fullscreen toolbar from flex to a 2 row grid.
3. Row 1 left is the title.
4. Row 1 right is the close button.
5. Row 2 left is the Period selector.
6. The Period selector uses black background and cyan text, not cyan text on white.
7. The normal in page portrait chart remains `63dvh` with `470px` minimum height.
8. No chart renderer logic is changed.
9. No data logic is changed.
10. No V5 file is changed.
""", encoding="utf-8")

print("V6 fullscreen toolbar grid and safe selector repair prepared.")
