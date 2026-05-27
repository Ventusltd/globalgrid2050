from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "uk_energy_tracking_v5" / "price-history-ui.js"
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_fullscreen_glow_controls.md"

ARROW_CLOSE_CSS = ".price-history-fullscreen-overlay.open{display:block!important}.price-history-fullscreen-overlay{position:fixed!important;inset:0!important;z-index:99999!important;background:#000!important;padding:0!important;overflow:hidden!important}.price-history-fullscreen-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;border-radius:0!important;background:#05070c!important;display:block!important;overflow:hidden!important}.price-history-fullscreen-toolbar,.price-history-fullscreen-note,.fs-bottom-stack,.fs-mode-row,.fs-period-row,.fs-mini,.fs-period{display:none!important}#price-history-fullscreen-canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;background:#05070c!important}.fs-close-lite{position:fixed;right:10px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:100002;border:1px solid rgba(0,255,255,.45);border-radius:7px;padding:6px 8px;background:rgba(5,7,12,.45);color:rgba(0,255,255,.82);font:10px Courier New,monospace;box-shadow:0 0 8px rgba(0,255,255,.12);text-shadow:0 0 5px rgba(0,255,255,.28)}.fs-nav{position:fixed;top:50%;z-index:100001;transform:translateY(-50%);width:48px;height:48px;border:1px solid rgba(0,255,255,.80);background:rgba(5,7,12,.76);color:#00ffff;border-radius:10px;font:28px Courier New,monospace;box-shadow:0 0 14px rgba(0,255,255,.25),0 0 9px rgba(255,51,51,.18);text-shadow:0 0 7px rgba(0,255,255,.58),0 0 5px rgba(255,51,51,.30)}.fs-nav.left{left:10px}.fs-nav.right{right:10px}@media(orientation:landscape){.fs-nav{width:42px;height:42px}.fs-close-lite{font-size:9px;padding:5px 7px}}"

ENSURE_ARROWS_CLOSE = """function ensureControls(){injectStyle();var o=$('price-history-fullscreen-overlay');if(!o)return;['fs-bottom-stack','fs-mini','fs-period','fs-close2'].forEach(function(id){var el=$(id);if(el)el.remove()});if(!$('fs-prev')){var left=document.createElement('button');left.id='fs-prev';left.className='fs-nav left';left.type='button';left.textContent='‹';o.appendChild(left)}if(!$('fs-next')){var right=document.createElement('button');right.id='fs-next';right.className='fs-nav right';right.type='button';right.textContent='›';o.appendChild(right)}if(!$('fs-close-lite')){var closeBtn=document.createElement('button');closeBtn.id='fs-close-lite';closeBtn.className='fs-close-lite';closeBtn.type='button';closeBtn.textContent='Close';o.appendChild(closeBtn)}bindControls()}"""

BIND_ARROWS_CLOSE = """function bindControls(){var c=window.__v5PriceHistoryControls;if(!c)return;var prev=$('fs-prev'),next=$('fs-next'),closeBtn=$('fs-close-lite');if(closeBtn)closeBtn.onclick=close;if(prev)prev.onclick=function(){var st=window.__v5PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.max(0,v-days));setTimeout(open,120)};if(next)next.onclick=function(){var st=window.__v5PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.min(c.totalScrollableDays(),v+days));setTimeout(open,120)}}"""

SYNC_NONE = "function syncFs(){}"

FS_LABELS = """function eventPoints(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0];rows.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});return{hi:hi,lo:lo}}
function glowingLabel(g,label,r,point,q,x,y,right){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=10*q;g.lineWidth=1.8*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y);g.stroke();g.fillStyle='#ff3333';g.font='bold '+(12*q)+'px Courier New';g.textAlign=right?'left':'right';g.fillText(label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh',x,y);g.font='bold '+(10*q)+'px Courier New';g.fillText(slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC),x,y+15*q);g.restore()}
function drawEvents(g,rows,X,Y,q,w,h,pad){var e=eventPoints(rows);if(!e)return;var hx=X(e.hi),hy=Y(Number(e.hi.priceGBPperMWh)),lx=X(e.lo),ly=Y(Number(e.lo.priceGBPperMWh));g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.90)';g.shadowBlur=11*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hxText=Math.min(w-pad.right-185*q,Math.max(pad.left+185*q,hx+18*q));var lxText=Math.max(pad.left+185*q,Math.min(w-pad.right-185*q,lx-18*q));glowingLabel(g,'HIGH',e.hi,{x:hx,y:hy},q,hxText,pad.top-24*q,hxText>=hx);glowingLabel(g,'LOW',e.lo,{x:lx,y:ly},q,lxText,h-pad.bottom+34*q,lxText>=lx)}"""

NORMAL_LABELS = FS_LABELS.replace("12*q", "11*q").replace("10*q", "9.5*q").replace("pad.top-24*q", "pad.top-22*q").replace("h-pad.bottom+34*q", "h-pad.bottom+32*q")


def replace_function(text, name, new_code):
    pattern = r"function " + re.escape(name) + r"\([^)]*\)\{.*?\nfunction "
    m = re.search(pattern, text, flags=re.S)
    if not m:
        raise SystemExit(f"Could not locate function {name}")
    return text[:m.start()] + new_code + "\nfunction " + text[m.end():]


def patch_dates(text):
    text = re.sub(
        r"function slab\(t\)\{.*?\}\nfunction tlab",
        "function slab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}\nfunction tlab",
        text,
        flags=re.S,
    )
    text = re.sub(
        r"function axisLabel\(t,span\)\{.*?\}\nfunction drawDateTick",
        "function axisLabel(t,span){var d=new Date(t);if(span<=45*86400000)return d.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});return d.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}\nfunction drawDateTick",
        text,
        flags=re.S,
    )
    return text


def remove_mwh_from_y_axis(text):
    text = text.replace("val===0?'£0/MWh':'£'+fmt(val,0)+'/MWh'", "val===0?'£0':'£'+fmt(val,0)")
    text = text.replace("(val===0?'£0/MWh':'£'+fmt(val,0)+'/MWh')", "(val===0?'£0':'£'+fmt(val,0))")
    return text


def patch_fullscreen():
    txt = patch_dates(FS.read_text())
    txt = remove_mwh_from_y_axis(txt)
    txt = re.sub(r"s\.textContent='.*?';document\.head\.appendChild\(s\)", "s.textContent='" + ARROW_CLOSE_CSS + "';document.head.appendChild(s)", txt, flags=re.S)
    txt = replace_function(txt, "ensureControls", ENSURE_ARROWS_CLOSE)
    txt = replace_function(txt, "bindControls", BIND_ARROWS_CLOSE)
    txt = replace_function(txt, "syncFs", SYNC_NONE)
    txt = re.sub(r"function eventPoints\(rows\)\{.*?\nfunction draw\(\)", FS_LABELS + "\nfunction draw()", txt, flags=re.S)
    txt = txt.replace("g.fillText('ELECTRICITY PRICE',pad.left,(isLandscape?28:64)*q)", "g.fillText('ELECTRICITY PRICE £/MWh',pad.left,(isLandscape?28:64)*q)")
    txt = txt.replace("g.fillText('ELECTRICITY PRICE £/MWh',pad.left,(isLandscape?28:64)*q)", "g.fillText('ELECTRICITY PRICE £/MWh',pad.left,(isLandscape?28:64)*q)")
    txt = re.sub(
        r"var pad=\{left:\(isLandscape\?\d+:\d+\)\*q,right:\(isLandscape\?\d+:\d+\)\*q,top:\(isLandscape\?\d+:\d+\)\*q,bottom:\(isLandscape\?\d+:\d+\)\*q\};",
        "var pad={left:(isLandscape?82:86)*q,right:(isLandscape?26:28)*q,top:(isLandscape?74:112)*q,bottom:(isLandscape?96:128)*q};",
        txt,
    )
    FS.write_text(txt)


def patch_normal():
    txt = patch_dates(UI.read_text())
    txt = remove_mwh_from_y_axis(txt)
    txt = re.sub(r"function eventPoints\(rows\)\{.*?\nfunction draw\(rows,meta\)", NORMAL_LABELS + "\nfunction draw(rows,meta)", txt, flags=re.S)
    txt = re.sub(
        r"var g=c\.getContext\('2d'\),w=c\.width,h=c\.height,pad=\{left:[^}]+\};",
        "var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:74*q,right:24*q,top:58*q,bottom:124*q};",
        txt,
        count=1,
    )
    txt = txt.replace("drawDateTick(g,x,h-54*q,ts,q", "drawDateTick(g,x,h-74*q,ts,q")
    txt = txt.replace("drawDateTick(g,x,h-70*q,ts,q", "drawDateTick(g,x,h-74*q,ts,q")
    UI.write_text(txt)


def main():
    patch_fullscreen()
    patch_normal()

    idx = INDEX.read_text()
    idx = idx.replace("Electricity Price History</strong>", "Electricity Price History £/MWh</strong>")
    idx = idx.replace("Electricity Price History £/MWh £/MWh</strong>", "Electricity Price History £/MWh</strong>")
    for old in ["20260527b", "20260527c", "20260527d", "20260527e", "20260527f", "20260527g", "20260527h", "20260527i", "20260527j", "20260527k"]:
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527l")
        idx = idx.replace(f"price-history-ui.js?v={old}", "price-history-ui.js?v=20260527l")
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 chart glow controls refinement\n\n"
        "Implemented the latest chart layout refinement in both normal and fullscreen views.\n\n"
        "Changes:\n"
        "1. Fullscreen now keeps only left arrow, right arrow and a small Close button at top right.\n"
        "2. Removed fullscreen All, Day, Night and period buttons to reduce clutter.\n"
        "3. Y axis labels now show currency only, with £/MWh stated in the chart title.\n"
        "4. Normal chart title text now also states £/MWh.\n"
        "5. HIGH remains in the top band and LOW remains in the bottom band.\n"
        "6. Red annotation text remains bold with cyan glow.\n"
        "7. Chart plot area is stretched wider while preserving room for annotations.\n"
        "8. Date labels remain fully spelled out to avoid UK or US ambiguity.\n"
        "9. Updated both chart cache keys to 20260527l.\n"
    )


if __name__ == "__main__":
    main()
