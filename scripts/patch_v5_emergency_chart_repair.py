from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "uk_energy_tracking_v5" / "price-history-ui.js"
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_emergency_chart_repair.md"


def patch_fullscreen(txt):
    # Critical bug fix: previous patch changed rows.forEach to lineRows.forEach but did not define lineRows.
    if "lineRows.forEach" in txt and "var lineRows=" not in txt:
        txt = txt.replace(
            "drawAxes(g,w,h,q,m,t0,t1,pad);g.strokeStyle='#00ffff';",
            "drawAxes(g,w,h,q,m,t0,t1,pad);var lineRows=(window.decimateRows?window.decimateRows(rows,Math.max(900,Math.floor((w/q)*1.8))):rows);g.strokeStyle='#00ffff';",
        )

    # In fullscreen axes, draw only full start and full end dates. No middle labels.
    txt = re.sub(
        r"if\(!\(count===3&&i===1\)\)drawDateTick\(g,x,h-68\*q,ts,q,i===0\?'left':\(i===count-1\?'right':'center'\),span\)",
        "if(i===0||i===count-1)drawDateTick(g,x,h-68*q,ts,q,i===0?'left':'right',span)",
        txt,
    )
    txt = re.sub(
        r"if\(!\(count===3&&i===1\)\)\{g\.fillStyle='#f5f7fb';g\.font=10\*q\+'px Courier New';g\.textAlign=i===0\?'left':\(i===count-1\?'right':'center'\);g\.fillText\(axisLabel\(ts,span\),x,h-52\*q\)\}",
        "if(i===0||i===count-1){g.fillStyle='#f5f7fb';g.font=10*q+'px Courier New';g.textAlign=i===0?'left':'right';g.fillText(axisLabel(ts,span),x,h-52*q)}",
        txt,
    )

    # If Trend mode exists, keep the title in a protected header band and use it correctly.
    txt = txt.replace(
        "g.fillText('ELECTRICITY PRICE £/MWh',pad.left,(isLandscape?28:64)*q);",
        "g.fillText(MINIMAL?'£/MWh':'ELECTRICITY PRICE £/MWh',pad.left,MINIMAL?40*q:(isLandscape?28:64)*q);",
    )
    txt = txt.replace(
        "g.fillText(slab(meta.start)+' to '+slab(meta.end)+' | '+modeText()+' | '+rows.length.toLocaleString('en-GB')+' price points',pad.left,(isLandscape?46:84)*q);",
        "if(!MINIMAL)g.fillText(slab(meta.start)+' to '+slab(meta.end)+' | '+modeText()+' | '+rows.length.toLocaleString('en-GB')+' price points',pad.left,(isLandscape?46:84)*q);",
    )
    return txt


def patch_normal(txt):
    # Normal mode x axis: show full start and full end dates only.
    txt = re.sub(
        r"if\(i===0\|\|i===count-1\)drawDateTick\(g,x,h-74\*q,ts,q,i===0\?'left':\(i===count-1\?'right':'center'\),span\)",
        "if(i===0||i===count-1)drawDateTick(g,x,h-74*q,ts,q,i===0?'left':'right',span)",
        txt,
    )
    txt = re.sub(
        r"if\(!\(count===3&&i===1\)\)drawDateTick\(g,x,h-74\*q,ts,q,i===0\?'left':\(i===count-1\?'right':'center'\),span\)",
        "if(i===0||i===count-1)drawDateTick(g,x,h-74*q,ts,q,i===0?'left':'right',span)",
        txt,
    )

    # Keep HIGH and LOW labels inside the plot safe zone, away from x axis labels.
    txt = re.sub(
        r"glowingLabel\(g,'HIGH',e\.hi,\{x:hx,y:hy\},q,hxText,pad\.top-22\*q,hxText>=hx\);glowingLabel\(g,'LOW',e\.lo,\{x:lx,y:ly\},q,lxText,h-pad\.bottom\+32\*q,lxText>=lx\)",
        "glowingLabel(g,'HIGH',e.hi,{x:hx,y:hy},q,hxText,pad.top+22*q,hxText>=hx);glowingLabel(g,'LOW',e.lo,{x:lx,y:ly},q,lxText,h-pad.bottom-26*q,lxText>=lx)",
        txt,
    )
    txt = re.sub(
        r"glowingLabel\(g,'HIGH',e\.hi,\{x:hx,y:hy\},q,hxText,pad\.top-8\*q,hxText>=hx\);glowingLabel\(g,'LOW',e\.lo,\{x:lx,y:ly\},q,lxText,h-pad\.bottom\+18\*q,lxText>=lx\)",
        "glowingLabel(g,'HIGH',e.hi,{x:hx,y:hy},q,hxText,pad.top+22*q,hxText>=hx);glowingLabel(g,'LOW',e.lo,{x:lx,y:ly},q,lxText,h-pad.bottom-26*q,lxText>=lx)",
        txt,
    )
    return txt


def main():
    FS.write_text(patch_fullscreen(FS.read_text()))
    UI.write_text(patch_normal(UI.read_text()))

    idx = INDEX.read_text()
    for old in ["20260527b", "20260527c", "20260527d", "20260527e", "20260527f", "20260527g", "20260527h", "20260527i", "20260527j", "20260527k", "20260527l", "20260527m", "20260527n", "20260527o", "20260527p"]:
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527q")
        idx = idx.replace(f"price-history-ui.js?v={old}", "price-history-ui.js?v=20260527q")
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 emergency chart repair\n\n"
        "Diagnosed and repaired the immediate V5 chart breakage.\n\n"
        "Findings:\n"
        "1. Fullscreen chart drawing was broken because `lineRows.forEach(...)` was introduced without defining `lineRows`. This produced axes and labels but no cyan price line.\n"
        "2. V4 did not have this issue because it drew directly from `rows.forEach(...)`.\n"
        "3. Normal chart event labels were still allowed to sit in the x axis label zone.\n\n"
        "Repairs:\n"
        "1. Defined `lineRows` before fullscreen rendering.\n"
        "2. Kept decimated drawing for performance while preserving HIGH and LOW detection from full rows.\n"
        "3. Reduced x axis labels to full start date and full end date only.\n"
        "4. Moved HIGH and LOW normal chart annotations inside the plot safe zone, away from x axis labels.\n"
        "5. Updated cache keys to 20260527q.\n"
    )


if __name__ == "__main__":
    main()
