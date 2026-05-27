from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_fullscreen_left_legend.md"

CSS = ".price-history-fullscreen-overlay.open{display:block!important}.price-history-fullscreen-overlay{position:fixed!important;inset:0!important;z-index:99999!important;background:#000!important;padding:0!important;overflow:hidden!important}.price-history-fullscreen-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;border-radius:0!important;background:#05070c!important;display:block!important;overflow:hidden!important}.price-history-fullscreen-toolbar,.price-history-fullscreen-note,.fs-bottom-stack,.fs-mode-row,.fs-period-row,.fs-mini,.fs-period{display:none!important}#price-history-fullscreen-canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;background:#05070c!important}.fs-top-lite{position:fixed;right:10px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:100002;display:flex;gap:6px}.fs-top-lite button{border:1px solid rgba(0,255,255,.42);border-radius:7px;padding:6px 8px;background:rgba(5,7,12,.45);color:rgba(0,255,255,.82);font:10px Courier New,monospace;box-shadow:0 0 8px rgba(0,255,255,.12);text-shadow:0 0 5px rgba(0,255,255,.28)}.fs-nav{position:fixed;right:10px;z-index:100001;transform:none;width:44px;height:44px;border:1px solid rgba(0,255,255,.80);background:rgba(5,7,12,.76);color:#00ffff;border-radius:10px;font:26px Courier New,monospace;box-shadow:0 0 14px rgba(0,255,255,.25),0 0 9px rgba(255,51,51,.18);text-shadow:0 0 7px rgba(0,255,255,.58),0 0 5px rgba(255,51,51,.30)}.fs-nav.left{top:calc(50% - 50px);left:auto}.fs-nav.right{top:calc(50% + 10px);left:auto}@media(orientation:landscape){.fs-nav{width:42px;height:42px}.fs-top-lite button{font-size:9px;padding:5px 7px}}"

ENSURE = """function ensureControls(){injectStyle();var o=$('price-history-fullscreen-overlay');if(!o)return;['fs-bottom-stack','fs-mini','fs-period','fs-close2'].forEach(function(id){var el=$(id);if(el)el.remove()});if(!$('fs-prev')){var left=document.createElement('button');left.id='fs-prev';left.className='fs-nav left';left.type='button';left.textContent='‹';o.appendChild(left)}if(!$('fs-next')){var right=document.createElement('button');right.id='fs-next';right.className='fs-nav right';right.type='button';right.textContent='›';o.appendChild(right)}if(!$('fs-top-lite')){var top=document.createElement('div');top.id='fs-top-lite';top.className='fs-top-lite';top.innerHTML='<button type=\"button\" id=\"fs-trend-lite\">Trend</button><button type=\"button\" id=\"fs-close-lite\">Close</button>';o.appendChild(top)}bindControls()}"""

BIND = """function bindControls(){var c=window.__v5PriceHistoryControls;if(!c)return;var prev=$('fs-prev'),next=$('fs-next'),closeBtn=$('fs-close-lite'),trendBtn=$('fs-trend-lite');if(closeBtn)closeBtn.onclick=close;if(trendBtn)trendBtn.onclick=function(){MINIMAL=!MINIMAL;trendBtn.textContent=MINIMAL?'Events':'Trend';draw()};if(prev)prev.onclick=function(){var st=window.__v5PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.max(0,v-days));setTimeout(open,120)};if(next)next.onclick=function(){var st=window.__v5PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.min(c.totalScrollableDays(),v+days));setTimeout(open,120)}}"""

LABELS = """function events(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0];rows.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});return{hi:hi,lo:lo}}
function sideLabel(g,label,r,point,q,x,y){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=10*q;g.lineWidth=1.7*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x+8*q,y-3*q);g.stroke();g.fillStyle='#ff3333';g.font='bold '+(11*q)+'px Courier New';g.textAlign='right';g.fillText(label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh',x,y);g.font='bold '+(9.5*q)+'px Courier New';g.fillText(slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC),x,y+14*q);g.restore()}
function drawEvents(g,rows,X,Y,q,w,h,pad){var e=events(rows);if(!e)return;var hx=X(e.hi),hy=Y(Number(e.hi.priceGBPperMWh)),lx=X(e.lo),ly=Y(Number(e.lo.priceGBPperMWh));g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.90)';g.shadowBlur=10*q;g.beginPath();g.arc(hx,hy,4.8*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,4.8*q,0,Math.PI*2);g.fill();g.restore();var labelX=pad.left-14*q;sideLabel(g,'HIGH',e.hi,{x:hx,y:hy},q,labelX,pad.top+10*q);sideLabel(g,'LOW',e.lo,{x:lx,y:ly},q,labelX,h-pad.bottom+22*q)}"""


def replace_function(text, name, new_code):
    pattern = r"function " + re.escape(name) + r"\([^)]*\)\{.*?\nfunction "
    m = re.search(pattern, text, flags=re.S)
    if not m:
        raise SystemExit(f"Could not locate function {name}")
    return text[:m.start()] + new_code + "\nfunction " + text[m.end():]


def main():
    txt = FS.read_text()
    if "var MINIMAL=" not in txt:
        txt = txt.replace("var S={rows:[],meta:null};", "var S={rows:[],meta:null};\nvar MINIMAL=false;")
    txt = re.sub(r"s\.textContent='.*?';document\.head\.appendChild\(s\)", "s.textContent='" + CSS + "';document.head.appendChild(s)", txt, flags=re.S)
    txt = replace_function(txt, "ensureControls", ENSURE)
    txt = replace_function(txt, "bindControls", BIND)
    txt = re.sub(r"function events\(rows\)\{.*?\nfunction draw\(\)", LABELS + "\nfunction draw()", txt, flags=re.S)
    txt = re.sub(r"function eventPoints\(rows\)\{.*?\nfunction draw\(\)", LABELS + "\nfunction draw()", txt, flags=re.S)
    txt = re.sub(
        r"var pad=MINIMAL\?\{left:[^}]+\}:\{left:[^}]+\};",
        "var pad=MINIMAL?{left:68*q,right:62*q,top:42*q,bottom:68*q}:{left:(isLandscape?238:158)*q,right:(isLandscape?74:62)*q,top:(isLandscape?76:112)*q,bottom:(isLandscape?118:142)*q};",
        txt,
    )
    txt = re.sub(
        r"var pad=\{left:\(isLandscape\?\d+:\d+\)\*q,right:\(isLandscape\?\d+:\d+\)\*q,top:\(isLandscape\?\d+:\d+\)\*q,bottom:\(isLandscape\?\d+:\d+\)\*q\};",
        "var pad=MINIMAL?{left:68*q,right:62*q,top:42*q,bottom:68*q}:{left:(isLandscape?238:158)*q,right:(isLandscape?74:62)*q,top:(isLandscape?76:112)*q,bottom:(isLandscape?118:142)*q};",
        txt,
    )
    txt = txt.replace("if(!MINIMAL)drawEvents(g,rows,X,Y,q,w,h,pad)", "if(!MINIMAL)drawEvents(g,rows,X,Y,q,w,h,pad)")
    if "if(!MINIMAL)drawEvents" not in txt:
        txt = txt.replace("drawEvents(g,rows,X,Y,q,w,h,pad);", "if(!MINIMAL)drawEvents(g,rows,X,Y,q,w,h,pad);")
    FS.write_text(txt)

    idx = INDEX.read_text()
    for old in ["20260527b", "20260527c", "20260527d", "20260527e", "20260527f", "20260527g", "20260527h", "20260527i", "20260527j", "20260527k", "20260527l", "20260527m"]:
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527n")
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 fullscreen left legend patch\n\n"
        "Moved fullscreen HIGH and LOW annotation text into a left side legend outside the plotting area. "
        "Moved the navigation arrows to the right hand side so they do not clash with the annotation legend or y axis labels. "
        "Retained the minimalist Trend toggle and updated the fullscreen cache key to 20260527n.\n"
    )


if __name__ == "__main__":
    main()
