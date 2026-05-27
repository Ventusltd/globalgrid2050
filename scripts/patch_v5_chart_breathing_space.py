from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "uk_energy_tracking_v5" / "price-history-ui.js"
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_chart_overlap_controls.md"


def replace_first(text, old, new):
    if old in text:
        return text.replace(old, new, 1)
    return text


def patch_common_units(text):
    text = text.replace("'£'+fmt(val,0)", "'£'+fmt(val,0)+'/MWh'")
    text = text.replace("'£'+fmt(val,0)+'/MWh'+'/MWh'", "'£'+fmt(val,0)+'/MWh'")
    text = text.replace("'£0'", "'£0/MWh'")
    text = text.replace("'£0/MWh/MWh'", "'£0/MWh'")
    text = text.replace("label+' £'+fmt(Number(r.priceGBPperMWh),2)", "label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh'")
    text = text.replace("label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh'+'/MWh'", "label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh'")
    text = text.replace("label+' '+price", "label+' '+price+'/MWh'")
    text = text.replace("label+' '+price+'/MWh'+'/MWh'", "label+' '+price+'/MWh'")
    return text


def patch_ui(text):
    text = text.replace("/uk_energy_tracking_v4/", "/uk_energy_tracking_v5/")
    text = text.replace("__v4PriceHistoryState", "__v5PriceHistoryState")
    text = text.replace("__v4PriceHistoryControls", "__v5PriceHistoryControls")
    text = text.replace("V4 captured Elexon Market Index Price", "V5 captured Elexon Market Index Price")
    text = text.replace("V4 Market Index audit", "V5 Market Index audit")

    if "function axisLabel(t,span)" not in text:
        text = replace_first(
            text,
            "function drawDateTick(g,x,y,t,q,align){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=12*q+'px Courier New';g.fillText(mlab(t),x,y);g.textAlign='left'}",
            "function axisLabel(t,span){var d=new Date(t);if(span<=45*86400000)return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});return mlab(t)}\nfunction drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}",
        )

    text = re.sub(
        r"var g=c\.getContext\('2d'\),w=c\.width,h=c\.height,pad=\{left:[^}]+\};",
        "var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:86*q,right:32*q,top:46*q,bottom:136*q};",
        text,
        count=1,
    )

    text = text.replace("drawDateTick(g,x,h-34*q,ts,q", "drawDateTick(g,x,h-62*q,ts,q")
    text = text.replace("drawDateTick(g,x,h-30*q,ts,q", "drawDateTick(g,x,h-62*q,ts,q")
    text = text.replace("drawDateTick(g,x,h-46*q,ts,q", "drawDateTick(g,x,h-62*q,ts,q")

    text = text.replace("ly>g.canvas.height*.68", "ly>g.canvas.height*.58")
    text = text.replace("ly>g.canvas.height*.60", "ly>g.canvas.height*.58")
    text = text.replace("Math.min(g.canvas.height-44*q,y+48*q)", "Math.min(g.canvas.height-118*q,y+58*q)")
    text = text.replace("Math.min(g.canvas.height-70*q,y+38*q)", "Math.min(g.canvas.height-118*q,y+58*q)")
    text = text.replace("Math.min(g.canvas.height-100*q,y+38*q)", "Math.min(g.canvas.height-118*q,y+58*q)")
    text = text.replace("Math.max(42*q,y-34*q)", "Math.max(58*q,y-46*q)")
    text = text.replace("Math.max(50*q,y-38*q)", "Math.max(58*q,y-46*q)")

    text = text.replace(";drawEvents(g,rows,X,Y,q);g.fillStyle='#9aa3b6';g.font=11*q+'px Courier New';g.fillText(periodLabel(meta.period)+' | '+timeModeLabel()+' | '+rows.length+' pts',pad.left,h-12*q)", ";drawEvents(g,rows,X,Y,q)")
    text = patch_common_units(text)
    return text


def patch_fullscreen(text):
    text = text.replace("__v4PriceHistoryState", "__v5PriceHistoryState")
    text = text.replace("__v4PriceHistoryControls", "__v5PriceHistoryControls")
    text = text.replace("v4-", "v5-")

    if "s.textContent='" in text and "';\n document.head.appendChild" in text:
        start = text.index("s.textContent='") + len("s.textContent='")
        end = text.index("';\n document.head.appendChild", start)
        css = ".price-history-fullscreen-overlay.open{display:block!important}.price-history-fullscreen-overlay{position:fixed!important;inset:0!important;z-index:99999!important;background:#000!important;padding:0!important;overflow:hidden!important}.price-history-fullscreen-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;border-radius:0!important;background:#05070c!important;display:block!important;overflow:hidden!important}.price-history-fullscreen-toolbar{position:fixed!important;top:calc(env(safe-area-inset-top,0px) + 8px)!important;right:8px!important;z-index:100002!important;display:flex!important;gap:6px!important;border:0!important;background:transparent!important;padding:0!important}.price-history-fullscreen-toolbar strong,.price-history-fullscreen-toolbar span,#price-history-zoom-reset{display:none!important}.price-history-fullscreen-toolbar button,.fs-mini button{border:1px solid rgba(0,255,255,.70)!important;border-radius:6px!important;padding:7px 9px!important;background:rgba(5,7,12,.72)!important;color:#00ffff!important;font:11px Courier New,monospace!important}.price-history-fullscreen-note{display:none!important}#price-history-fullscreen-canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;background:#05070c!important}.fs-mini{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:76px;z-index:100001;display:flex;gap:6px;align-items:center}.fs-mini button.active{background:rgba(0,255,255,.22)!important}.fs-mini-label{display:none!important}.fs-nav{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:100001;transform:none;width:40px;height:38px;border:1px solid rgba(0,255,255,.70);background:rgba(5,7,12,.72);color:#00ffff;border-radius:7px;font:22px Courier New,monospace}.fs-nav.left{left:8px}.fs-nav.right{left:56px;right:auto}@media(orientation:landscape){.fs-nav{height:34px}.fs-mini{right:72px}}"
        text = text[:start] + css + text[end:]

    if "function axisLabel(t,span)" not in text:
        text = replace_first(
            text,
            "function drawDateTick(g,x,y,t,q,align){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(mlab(t),x,y);g.textAlign='left'}",
            "function axisLabel(t,span){var d=new Date(t);if(span<=45*86400000)return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});return mlab(t)}\nfunction drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=10*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}",
        )

    text = re.sub(
        r"var pad=\{left:\(isLandscape\?70:62\)\*q,right:\(isLandscape\?58:36\)\*q,top:[^}]+\};",
        "var pad={left:(isLandscape?70:62)*q,right:(isLandscape?58:36)*q,top:(isLandscape?58:76)*q,bottom:(isLandscape?58:76)*q};",
        text,
        count=1,
    )
    text = text.replace("ly>g.canvas.height*.68", "ly>g.canvas.height*.58")
    text = text.replace("ly>g.canvas.height*.60", "ly>g.canvas.height*.58")
    text = text.replace("Math.min(g.canvas.height-54*q,y+46*q)", "Math.min(g.canvas.height-110*q,y+58*q)")
    text = text.replace("Math.min(g.canvas.height-68*q,y+38*q)", "Math.min(g.canvas.height-110*q,y+58*q)")
    text = text.replace("Math.min(g.canvas.height-92*q,y+38*q)", "Math.min(g.canvas.height-110*q,y+58*q)")
    text = text.replace("Math.max(62*q,y-32*q)", "Math.max(64*q,y-46*q)")
    text = text.replace("Math.max(58*q,y-36*q)", "Math.max(64*q,y-46*q)")
    text = text.replace("var lab=$('fs-label');if(lab)lab.textContent='High and low price events labelled | '+modeText()+' | '+slab(meta.start)+' to '+slab(meta.end)", "var lab=$('fs-label');if(lab)lab.textContent=''")
    text = patch_common_units(text)
    return text


def main():
    UI.write_text(patch_ui(UI.read_text()))
    FS.write_text(patch_fullscreen(FS.read_text()))

    idx = INDEX.read_text()
    for old in ["20260527b", "20260527c", "20260527d", "20260527e"]:
        idx = idx.replace(f"price-history-ui.js?v={old}", "price-history-ui.js?v=20260527f")
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527f")
    INDEX.write_text(idx)

    report = REPORT.read_text() if REPORT.exists() else "# V5 chart overlap and control placement patch\n"
    report += "\n## Idempotent units and spacing refinement\n\n"
    report += "Made the chart patch tolerant of already patched files. Added explicit £/MWh units to y axis and event labels, increased chart padding and moved full screen controls into chart corners. Cache keys updated to 20260527f.\n"
    REPORT.write_text(report)


if __name__ == "__main__":
    main()
