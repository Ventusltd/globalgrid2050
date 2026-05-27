from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "uk_energy_tracking_v5" / "price-history-ui.js"
FS = ROOT / "uk_energy_tracking_v5" / "price-history-fullscreen.js"
INDEX = ROOT / "uk_energy_tracking_v5" / "index.md"
REPORT = ROOT / "gridbot_reports" / "patch_v5_chart_overlap_controls.md"


def replace_exact(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing expected block: {label}")
    return text.replace(old, new, 1)


def patch_ui(text):
    text = text.replace("/uk_energy_tracking_v4/", "/uk_energy_tracking_v5/")
    text = text.replace("__v4PriceHistoryState", "__v5PriceHistoryState")
    text = text.replace("__v4PriceHistoryControls", "__v5PriceHistoryControls")
    text = text.replace("V4 captured Elexon Market Index Price", "V5 captured Elexon Market Index Price")
    text = text.replace("V4 Market Index audit", "V5 Market Index audit")

    text = replace_exact(
        text,
        "function drawDateTick(g,x,y,t,q,align){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=12*q+'px Courier New';g.fillText(mlab(t),x,y);g.textAlign='left'}",
        "function axisLabel(t,span){var d=new Date(t);if(span<=45*86400000)return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});return mlab(t)}\nfunction drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}",
        "UI drawDateTick",
    )

    text = replace_exact(
        text,
        "function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle=val===0?'rgba(255,51,51,.95)':'rgba(255,255,255,.18)';g.lineWidth=val===0?2*q:q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle=val===0?'#ff3333':'#f5f7fb';g.fillText((val===0?'£0':'£'+fmt(val,0)),8*q,yy+4*q)}var count=(t1-t0)>180*86400000?5:3;for(var i=0;i<count;i++){var ts=t0+(i/(count-1))*(t1-t0),x=pad.left+(i/(count-1))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();drawDateTick(g,x,h-34*q,ts,q,i===0?'left':(i===count-1?'right':'center'))}}",
        "function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step,span=t1-t0;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle=val===0?'rgba(255,51,51,.95)':'rgba(255,255,255,.18)';g.lineWidth=val===0?2*q:q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle=val===0?'#ff3333':'#f5f7fb';g.fillText((val===0?'£0':'£'+fmt(val,0)),8*q,yy+4*q)}var count=span>180*86400000?5:3;for(var i=0;i<count;i++){var ts=t0+(i/(count-1))*span,x=pad.left+(i/(count-1))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.14)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();if(!(count===3&&i===1)){drawDateTick(g,x,h-30*q,ts,q,i===0?'left':(i===count-1?'right':'center'),span)}}}",
        "UI drawAxes",
    )

    text = replace_exact(
        text,
        "function drawMarker(g,label,r,x,y,q,above,colour){var price='£'+fmt(Number(r.priceGBPperMWh),2),time=slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC);var shift=label==='HIGH'?18*q:-18*q;var tx=label==='HIGH'?Math.min(g.canvas.width-118*q,x+shift):Math.max(118*q,x+shift);var ty=above?Math.max(42*q,y-34*q):Math.min(g.canvas.height-44*q,y+48*q);g.strokeStyle=colour;g.fillStyle=colour;g.lineWidth=1.3*q;g.beginPath();g.arc(x,y,4*q,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty-10*q);g.stroke();g.font=10*q+'px Courier New';g.textAlign=label==='HIGH'?'left':'right';g.fillText(label+' '+price,tx,ty);g.font=8.5*q+'px Courier New';g.fillText(time,tx,ty+12*q);g.textAlign='left'}",
        "function drawMarker(g,label,r,x,y,q,above,colour){var price='£'+fmt(Number(r.priceGBPperMWh),2),time=slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC),right=label==='HIGH';var tx=right?Math.min(g.canvas.width-126*q,x+18*q):Math.max(126*q,x-18*q);var ty=above?Math.max(50*q,y-38*q):Math.min(g.canvas.height-70*q,y+38*q);g.strokeStyle=colour;g.fillStyle=colour;g.lineWidth=1.3*q;g.beginPath();g.arc(x,y,4*q,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty-10*q);g.stroke();g.font=10*q+'px Courier New';g.textAlign=right?'left':'right';g.fillText(label+' '+price,tx,ty);g.font=8.5*q+'px Courier New';g.fillText(time,tx,ty+12*q);g.textAlign='left'}",
        "UI drawMarker",
    )

    text = replace_exact(
        text,
        "function drawEvents(g,rows,X,Y,q){var e=eventPoints(rows);if(!e)return;drawMarker(g,'HIGH',e.hi,X(e.hi),Y(Number(e.hi.priceGBPperMWh)),q,true,'#ff3333');drawMarker(g,'LOW',e.lo,X(e.lo),Y(Number(e.lo.priceGBPperMWh)),q,false,'#ff3333')}",
        "function drawEvents(g,rows,X,Y,q){var e=eventPoints(rows);if(!e)return;var hx=X(e.hi),hy=Y(Number(e.hi.priceGBPperMWh)),lx=X(e.lo),ly=Y(Number(e.lo.priceGBPperMWh));drawMarker(g,'HIGH',e.hi,hx,hy,q,hy>g.canvas.height*.28,'#ff3333');drawMarker(g,'LOW',e.lo,lx,ly,q,ly>g.canvas.height*.68,'#ff3333')}",
        "UI drawEvents",
    )

    text = replace_exact(
        text,
        "var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:68*q,right:32*q,top:42*q,bottom:64*q};",
        "var g=c.getContext('2d'),w=c.width,h=c.height,pad={left:68*q,right:32*q,top:46*q,bottom:88*q};",
        "UI pad",
    )

    text = replace_exact(
        text,
        ";drawEvents(g,rows,X,Y,q);g.fillStyle='#9aa3b6';g.font=11*q+'px Courier New';g.fillText(periodLabel(meta.period)+' | '+timeModeLabel()+' | '+rows.length+' pts',pad.left,h-12*q)",
        ";drawEvents(g,rows,X,Y,q)",
        "UI footer removal",
    )
    return text


def patch_fullscreen(text):
    text = text.replace("__v4PriceHistoryState", "__v5PriceHistoryState")
    text = text.replace("__v4PriceHistoryControls", "__v5PriceHistoryControls")
    text = text.replace("v4-", "v5-")

    css_start = "s.textContent='"
    start = text.index(css_start) + len(css_start)
    end = text.index("';\n document.head.appendChild", start)
    css = ".price-history-fullscreen-overlay.open{display:block!important}.price-history-fullscreen-overlay{position:fixed!important;inset:0!important;z-index:99999!important;background:#000!important;padding:0!important;overflow:hidden!important}.price-history-fullscreen-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;border-radius:0!important;background:#05070c!important;display:block!important;overflow:hidden!important}.price-history-fullscreen-toolbar{position:fixed!important;top:calc(env(safe-area-inset-top,0px) + 8px)!important;right:8px!important;z-index:100002!important;display:flex!important;gap:6px!important;border:0!important;background:transparent!important;padding:0!important}.price-history-fullscreen-toolbar strong,.price-history-fullscreen-toolbar span,#price-history-zoom-reset{display:none!important}.price-history-fullscreen-toolbar button,.fs-mini button{border:1px solid rgba(0,255,255,.70)!important;border-radius:6px!important;padding:7px 9px!important;background:rgba(5,7,12,.72)!important;color:#00ffff!important;font:11px Courier New,monospace!important}.price-history-fullscreen-note{display:none!important}#price-history-fullscreen-canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;border:0!important;background:#05070c!important}.fs-mini{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:76px;z-index:100001;display:flex;gap:6px;align-items:center}.fs-mini button.active{background:rgba(0,255,255,.22)!important}.fs-mini-label{display:none!important}.fs-nav{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:100001;transform:none;width:40px;height:38px;border:1px solid rgba(0,255,255,.70);background:rgba(5,7,12,.72);color:#00ffff;border-radius:7px;font:22px Courier New,monospace}.fs-nav.left{left:8px}.fs-nav.right{left:56px;right:auto}@media(orientation:landscape){.fs-nav{height:34px}.fs-mini{right:72px}}"
    text = text[:start] + css + text[end:]

    text = replace_exact(
        text,
        "function drawDateTick(g,x,y,t,q,align){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(mlab(t),x,y);g.textAlign='left'}",
        "function axisLabel(t,span){var d=new Date(t);if(span<=45*86400000)return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});return mlab(t)}\nfunction drawDateTick(g,x,y,t,q,align,span){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=10*q+'px Courier New';g.fillText(axisLabel(t,span||0),x,y);g.textAlign='left'}",
        "FS drawDateTick",
    )

    text = replace_exact(
        text,
        "function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle=val===0?'rgba(255,51,51,.98)':'rgba(255,255,255,.17)';g.lineWidth=val===0?2*q:q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle=val===0?'#ff3333':'#f5f7fb';g.fillText(val===0?'£0':'£'+fmt(val,0),8*q,yy+4*q)}var count=(t1-t0)>180*86400000?6:3;for(var i=0;i<count;i++){var ts=t0+(i/(count-1))*(t1-t0),x=pad.left+(i/(count-1))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.11)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();drawDateTick(g,x,h-28*q,ts,q,i===0?'left':(i===count-1?'right':'center'))}}",
        "function drawAxes(g,w,h,q,m,t0,t1,pad){var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step,span=t1-t0;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle=val===0?'rgba(255,51,51,.98)':'rgba(255,255,255,.17)';g.lineWidth=val===0?2*q:q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle=val===0?'#ff3333':'#f5f7fb';g.fillText(val===0?'£0':'£'+fmt(val,0),8*q,yy+4*q)}var count=span>180*86400000?5:3;for(var i=0;i<count;i++){var ts=t0+(i/(count-1))*span,x=pad.left+(i/(count-1))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.11)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();if(!(count===3&&i===1)){drawDateTick(g,x,h-26*q,ts,q,i===0?'left':(i===count-1?'right':'center'),span)}}}",
        "FS drawAxes",
    )

    text = replace_exact(
        text,
        "function marker(g,label,r,x,y,q,above){var placeRight=label==='HIGH';var tx=placeRight?Math.min(g.canvas.width-118*q,x+18*q):Math.max(118*q,x-18*q);var ty=above?Math.max(62*q,y-32*q):Math.min(g.canvas.height-54*q,y+46*q);g.fillStyle='#ff3333';g.strokeStyle='#ff3333';g.lineWidth=1.3*q;g.beginPath();g.arc(x,y,3.8*q,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty-10*q);g.stroke();g.font=9.5*q+'px Courier New';g.textAlign=placeRight?'left':'right';g.fillText(label+' £'+fmt(Number(r.priceGBPperMWh),2),tx,ty);g.font=8*q+'px Courier New';g.fillText(slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC),tx,ty+11*q);g.textAlign='left'}",
        "function marker(g,label,r,x,y,q,above){var right=label==='HIGH';var tx=right?Math.min(g.canvas.width-126*q,x+18*q):Math.max(126*q,x-18*q);var ty=above?Math.max(58*q,y-36*q):Math.min(g.canvas.height-68*q,y+38*q);g.fillStyle='#ff3333';g.strokeStyle='#ff3333';g.lineWidth=1.3*q;g.beginPath();g.arc(x,y,3.8*q,0,Math.PI*2);g.fill();g.beginPath();g.moveTo(x,y);g.lineTo(tx,ty-10*q);g.stroke();g.font=9.5*q+'px Courier New';g.textAlign=right?'left':'right';g.fillText(label+' £'+fmt(Number(r.priceGBPperMWh),2),tx,ty);g.font=8*q+'px Courier New';g.fillText(slab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC),tx,ty+11*q);g.textAlign='left'}",
        "FS marker",
    )

    text = replace_exact(
        text,
        "function drawEvents(g,rows,X,Y,q){var e=eventPoints(rows);if(!e)return;marker(g,'HIGH',e.hi,X(e.hi),Y(Number(e.hi.priceGBPperMWh)),q,true);marker(g,'LOW',e.lo,X(e.lo),Y(Number(e.lo.priceGBPperMWh)),q,false)}",
        "function drawEvents(g,rows,X,Y,q){var e=eventPoints(rows);if(!e)return;var hx=X(e.hi),hy=Y(Number(e.hi.priceGBPperMWh)),lx=X(e.lo),ly=Y(Number(e.lo.priceGBPperMWh));marker(g,'HIGH',e.hi,hx,hy,q,hy>g.canvas.height*.28);marker(g,'LOW',e.lo,lx,ly,q,ly>g.canvas.height*.68)}",
        "FS drawEvents",
    )

    text = replace_exact(
        text,
        "var pad={left:(isLandscape?70:62)*q,right:(isLandscape?58:36)*q,top:(isLandscape?62:82)*q,bottom:(isLandscape?46:62)*q};",
        "var pad={left:(isLandscape?70:62)*q,right:(isLandscape?58:36)*q,top:(isLandscape?58:76)*q,bottom:(isLandscape?58:76)*q};",
        "FS pad",
    )

    text = replace_exact(
        text,
        "var lab=$('fs-label');if(lab)lab.textContent='High and low price events labelled | '+modeText()+' | '+slab(meta.start)+' to '+slab(meta.end)",
        "var lab=$('fs-label');if(lab)lab.textContent=''",
        "FS label removal",
    )
    return text


def patch_index(text):
    text = text.replace("price-history-ui.js?v=20260527b", "price-history-ui.js?v=20260527c")
    text = text.replace("price-history-fullscreen.js?v=20260527b", "price-history-fullscreen.js?v=20260527c")
    return text


def main():
    ui = patch_ui(UI.read_text())
    fs = patch_fullscreen(FS.read_text())
    idx = patch_index(INDEX.read_text())

    UI.write_text(ui)
    FS.write_text(fs)
    INDEX.write_text(idx)

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        "# V5 chart overlap and control placement patch\n\n"
        "Updated `uk_energy_tracking_v5/price-history-ui.js`, `uk_energy_tracking_v5/price-history-fullscreen.js` and `uk_energy_tracking_v5/index.md`.\n\n"
        "Changes applied:\n"
        "1. Removed the drawn footer text from the normal canvas to stop overlap with x axis labels.\n"
        "2. Increased normal chart bottom padding and made low labels flip above when close to the bottom.\n"
        "3. Reduced repeated centre date labels on short windows.\n"
        "4. Removed the full screen floating bottom label.\n"
        "5. Moved full screen arrows into the top left chart corner.\n"
        "6. Kept All, Day, Night and Close in the top right chart corner.\n"
        "7. Updated script cache keys to `20260527c`.\n"
    )


if __name__ == "__main__":
    main()
