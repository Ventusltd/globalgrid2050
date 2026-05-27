from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_fullscreen_glow_controls.md"

BOTTOM_CONTROL_CSS = ".price-history-fullscreen-overlay.open{display:block!important}.price-history-fullscreen-overlay{position:fixed!important;inset:0!important;z-index:99999!important;background:#000!important;padding:0!important;overflow:hidden!important}.price-history-fullscreen-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;border-radius:0!important;background:#05070c!important;display:block!important;overflow:hidden!important}.price-history-fullscreen-toolbar,.price-history-fullscreen-note{display:none!important}#price-history-fullscreen-canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;background:#05070c!important}.fs-bottom-stack{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);transform:translateX(-50%);z-index:100001;display:flex;flex-direction:column;gap:7px;align-items:center;justify-content:center;max-width:94vw}.fs-mode-row,.fs-period-row{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}.fs-bottom-stack button{border:1px solid rgba(0,255,255,.80)!important;border-radius:8px!important;padding:7px 10px!important;background:rgba(5,7,12,.76)!important;color:#00ffff!important;font:11px Courier New,monospace!important;box-shadow:0 0 12px rgba(0,255,255,.22),0 0 8px rgba(255,51,51,.16);text-shadow:0 0 6px rgba(0,255,255,.55),0 0 4px rgba(255,51,51,.28)}.fs-bottom-stack button.active{background:rgba(0,255,255,.18)!important}.fs-nav{position:fixed;top:50%;z-index:100001;transform:translateY(-50%);width:48px;height:48px;border:1px solid rgba(0,255,255,.80);background:rgba(5,7,12,.76);color:#00ffff;border-radius:10px;font:28px Courier New,monospace;box-shadow:0 0 14px rgba(0,255,255,.25),0 0 9px rgba(255,51,51,.18);text-shadow:0 0 7px rgba(0,255,255,.58),0 0 5px rgba(255,51,51,.30)}.fs-nav.left{left:10px}.fs-nav.right{right:10px}@media(orientation:landscape){.fs-bottom-stack{bottom:6px}.fs-bottom-stack button{padding:6px 8px!important;font-size:10px!important}.fs-nav{width:42px;height:42px}}"

ENSURE_CONTROLS = """function ensureControls(){injectStyle();var o=$('price-history-fullscreen-overlay');if(!o||$('fs-bottom-stack'))return;var stack=document.createElement('div');stack.id='fs-bottom-stack';stack.className='fs-bottom-stack';stack.innerHTML='<div class=\"fs-mode-row\"><button type=\"button\" data-fs-mode=\"all\" class=\"active\">All</button><button type=\"button\" data-fs-mode=\"day\">Day</button><button type=\"button\" data-fs-mode=\"night\">Night</button><button type=\"button\" id=\"fs-close2\">Close</button></div><div class=\"fs-period-row\"><button type=\"button\" data-fs-period=\"7d\">1 week</button><button type=\"button\" data-fs-period=\"30d\">1 month</button><button type=\"button\" data-fs-period=\"3m\">3 months</button><button type=\"button\" data-fs-period=\"6m\">6 months</button><button type=\"button\" data-fs-period=\"12m\">12 months</button></div>';var left=document.createElement('button');left.id='fs-prev';left.className='fs-nav left';left.type='button';left.textContent='‹';var right=document.createElement('button');right.id='fs-next';right.className='fs-nav right';right.type='button';right.textContent='›';o.appendChild(stack);o.appendChild(left);o.appendChild(right);bindControls()}"""

BIND_CONTROLS = """function bindControls(){var c=window.__v5PriceHistoryControls;if(!c)return;var prev=$('fs-prev'),next=$('fs-next'),stack=$('fs-bottom-stack'),close2=$('fs-close2');if(close2)close2.onclick=close;if(prev)prev.onclick=function(){var st=window.__v5PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.max(0,v-days));setTimeout(open,120)};if(next)next.onclick=function(){var st=window.__v5PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.min(c.totalScrollableDays(),v+days));setTimeout(open,120)};if(stack)stack.onclick=function(e){var bm=e.target.closest('button[data-fs-mode]');if(bm){stack.querySelectorAll('button[data-fs-mode]').forEach(function(x){x.classList.toggle('active',x===bm)});c.setMode(bm.getAttribute('data-fs-mode'));setTimeout(open,120);return}var bp=e.target.closest('button[data-fs-period]');if(bp){stack.querySelectorAll('button[data-fs-period]').forEach(function(x){x.classList.toggle('active',x===bp)});c.setPeriod(bp.getAttribute('data-fs-period'));setTimeout(open,120)}}}"""

SYNC_FS = """function syncFs(){var st=window.__v5PriceHistoryState||{},stack=$('fs-bottom-stack');if(!stack)return;stack.querySelectorAll('button[data-fs-mode]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-fs-mode')===(st.timeMode||'all'))});stack.querySelectorAll('button[data-fs-period]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-fs-period')===((st.meta||{}).period||'7d'))})}"""

GLOW_LABEL_FUNCS = """function eventPoints(rows){if(!rows.length)return null;var hi=rows[0],lo=rows[0];rows.forEach(function(r){if(Number(r.priceGBPperMWh)>Number(hi.priceGBPperMWh))hi=r;if(Number(r.priceGBPperMWh)<Number(lo.priceGBPperMWh))lo=r});return{hi:hi,lo:lo}}
function glowingLabel(g,label,r,point,q,x,y,right){g.save();g.strokeStyle='#ff3333';g.shadowColor='rgba(0,255,255,.85)';g.shadowBlur=10*q;g.lineWidth=1.9*q;g.beginPath();g.moveTo(point.x,point.y);g.lineTo(x,y);g.stroke();g.fillStyle='#ff3333';g.font='bold '+(12*q)+'px Courier New';g.textAlign=right?'left':'right';g.fillText(label+' £'+fmt(Number(r.priceGBPperMWh),2)+'/MWh',x,y);g.font='bold '+(10*q)+'px Courier New';g.fillText(slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC),x,y+15*q);g.restore()}
function drawEvents(g,rows,X,Y,q,w,h,pad){var e=eventPoints(rows);if(!e)return;var hx=X(e.hi),hy=Y(Number(e.hi.priceGBPperMWh)),lx=X(e.lo),ly=Y(Number(e.lo.priceGBPperMWh));g.save();g.fillStyle='#ff3333';g.shadowColor='rgba(0,255,255,.90)';g.shadowBlur=11*q;g.beginPath();g.arc(hx,hy,5*q,0,Math.PI*2);g.fill();g.beginPath();g.arc(lx,ly,5*q,0,Math.PI*2);g.fill();g.restore();var hxText=Math.min(w-pad.right-175*q,Math.max(pad.left+175*q,hx+18*q));var lxText=Math.max(pad.left+175*q,Math.min(w-pad.right-175*q,lx-18*q));glowingLabel(g,'HIGH',e.hi,{x:hx,y:hy},q,hxText,pad.top-8*q,hxText>=hx);glowingLabel(g,'LOW',e.lo,{x:lx,y:ly},q,lxText,h-pad.bottom+18*q,lxText>=lx)}"""


def replace_function(text, name, new_code):
    pattern = r"function " + re.escape(name) + r"\([^)]*\)\{.*?\nfunction "
    m = re.search(pattern, text, flags=re.S)
    if not m:
        raise SystemExit(f"Could not locate function {name}")
    return text[:m.start()] + new_code + "\nfunction " + text[m.end():]


def main():
    txt = FS.read_text()

    # Fully spelled date formatting everywhere used in fullscreen labels and titles.
    txt = re.sub(
        r"function slab\(t\)\{.*?\}\nfunction tlab",
        "function slab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}\nfunction tlab",
        txt,
        flags=re.S,
    )
    txt = re.sub(
        r"function axisLabel\(t,span\)\{.*?\}\nfunction drawDateTick",
        "function axisLabel(t,span){var d=new Date(t);if(span<=45*86400000)return d.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});return d.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}\nfunction drawDateTick",
        txt,
        flags=re.S,
    )

    # Replace fullscreen CSS, controls and control synchronisation.
    txt = re.sub(r"s\.textContent='.*?';document\.head\.appendChild\(s\)", "s.textContent='" + BOTTOM_CONTROL_CSS + "';document.head.appendChild(s)", txt, flags=re.S)
    txt = replace_function(txt, "ensureControls", ENSURE_CONTROLS)
    txt = replace_function(txt, "bindControls", BIND_CONTROLS)
    txt = replace_function(txt, "syncFs", SYNC_FS)

    # Remove the failed black box/collision labelling system and use fixed extreme bands.
    txt = re.sub(
        r"function eventPoints\(rows\)\{.*?\nfunction draw\(\)",
        GLOW_LABEL_FUNCS + "\nfunction draw()",
        txt,
        flags=re.S,
    )

    # Title and canvas geometry refinements.
    txt = txt.replace("g.fillText('ELECTRICITY PRICE',pad.left,(isLandscape?28:64)*q)", "g.fillText('ELECTRICITY PRICE £/MWh',pad.left,(isLandscape?28:64)*q)")
    txt = re.sub(
        r"var pad=\{left:\(isLandscape\?86:86\)\*q,right:\(isLandscape\?46:30\)\*q,top:\(isLandscape\?66:122\)\*q,bottom:\(isLandscape\?86:132\)\*q\};",
        "var pad={left:(isLandscape?94:94)*q,right:(isLandscape?34:34)*q,top:(isLandscape?56:88)*q,bottom:(isLandscape?140:156)*q};",
        txt,
    )

    FS.write_text(txt)

    idx = INDEX.read_text()
    for old in ["20260527b", "20260527c", "20260527d", "20260527e", "20260527f", "20260527g", "20260527h", "20260527i"]:
        idx = idx.replace(f"price-history-fullscreen.js?v={old}", "price-history-fullscreen.js?v=20260527j")
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 fullscreen glow controls patch\n\n"
        "Implemented the revised fullscreen chart design.\n\n"
        "Changes:\n"
        "1. Fullscreen date labels now spell dates clearly as day, full month and year where a day is shown.\n"
        "2. Long window month labels now use full month plus full year, avoiding ambiguous labels such as Dec 23.\n"
        "3. Removed black annotation boxes.\n"
        "4. Forced HIGH annotation into the top band and LOW annotation into the bottom band.\n"
        "5. Added bold red annotation text with cyan glow.\n"
        "6. Moved all fullscreen controls to the bottom.\n"
        "7. Put glowing movement arrows on the left and right side of the chart.\n"
        "8. Retitled the fullscreen chart as ELECTRICITY PRICE £/MWh.\n"
        "9. Updated the fullscreen cache key to 20260527j.\n"
    )


if __name__ == "__main__":
    main()
