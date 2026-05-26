from pathlib import Path

PAGE=Path('uk_energy_tracking_v3/index.md')
CSS=Path('uk_energy_tracking_v3/price-history-ui.css')
JS=Path('uk_energy_tracking_v3/price-history-ui.js')
FS=Path('uk_energy_tracking_v3/price-history-fullscreen.js')
DIARY=Path('uk_energy_tracking_v3/WORK_DIARY.md')

DATE_HTML='''
        <label class="price-history-date-label">From <input type="date" id="price-history-from"></label>
        <label class="price-history-date-label">To <input type="date" id="price-history-to"></label>
        <button type="button" id="price-history-clear-dates" class="price-history-date-apply">Clear dates</button>'''

CSS_ADD='''

/* V3 price history calendar range controls */
#electricity-price-history-panel .price-history-date-label{display:flex;align-items:center;gap:6px;color:#9aa3b6;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
#electricity-price-history-panel .price-history-date-label input{background:#050505!important;color:#00ffff!important;border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;font-family:"Courier New",monospace}
#electricity-price-history-panel .price-history-date-apply{border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;color:#00ffff!important;background:rgba(0,255,255,.05)!important;font-family:"Courier New",monospace;cursor:pointer}
'''

FS_JS=r'''(function(){var J='/uk_energy_tracking_v3/electricity_price_history.json',C='/data/electricity/elexon_system_prices_half_hourly.csv',S={rows:[],a:0,b:1,drag:false,x:0};function E(i){return document.getElementById(i)}function D(t){return new Date(t).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}function csvLine(l){var o=[],v='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c==='"'){q=!q}else if(c===','&&!q){o.push(v);v=''}else v+=c}o.push(v);return o}function parseCsv(t){t=(t||'').trim();if(!t)return[];var a=t.split(/\r?\n/),h=csvLine(a[0]);return a.slice(1).map(l=>{var c=csvLine(l),r={};h.forEach((x,i)=>r[x]=c[i]||'');var p=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{t:new Date(r.periodStartUTC||r.priceTimeUTC).getTime(),v:Number(p)}}).filter(r=>r.t&&r.v===r.v).sort((a,b)=>a.t-b.t)}function cut(r){if(r==='all')return null;var d=new Date();if(r==='24h')d.setDate(d.getDate()-1);else if(r==='7d')d.setDate(d.getDate()-7);else if(r==='30d')d.setDate(d.getDate()-30);else if(r==='3m')d.setMonth(d.getMonth()-3);else if(r==='6m')d.setMonth(d.getMonth()-6);else if(r==='12m')d.setFullYear(d.getFullYear()-1);else d.setFullYear(d.getFullYear()-10);return d.getTime()}function custom(){var f=E('price-history-from'),t=E('price-history-to');if(!f||!t||!f.value||!t.value)return null;var a=new Date(f.value+'T00:00:00Z').getTime(),b=new Date(t.value+'T23:59:59Z').getTime();if(!a||!b||b<a)return null;var m=60*86400000;if(b-a>m)b=a+m;return{a:a,b:b}}function normJson(d){return(d.rows||[]).map(r=>({t:new Date(r.priceTimeUTC).getTime(),v:Number(r.priceGBPperMWh)})).filter(r=>r.t&&r.v===r.v)}function rows(){var r=E('price-history-range'),range=r?r.value:'7d',cw=custom(),c=cut(range);return Promise.all([fetch(J+'?t='+Date.now(),{cache:'no-store'}).then(x=>x.ok?x.json():{rows:[]}).then(normJson).catch(()=>[]),fetch(C+'?t='+Date.now(),{cache:'no-store'}).then(x=>x.ok?x.text():'').then(parseCsv).catch(()=>[])]).then(p=>{var m={};p[1].forEach(x=>m[x.t]=x);p[0].forEach(x=>m[x.t]=x);var a=Object.keys(m).sort().map(k=>m[k]);if(cw)return a.filter(x=>x.t>=cw.a&&x.t<=cw.b);return c?a.filter(x=>x.t>=c):a})}function view(){if(S.rows.length){S.a=S.rows[0].t;S.b=S.rows[S.rows.length-1].t;if(S.b<=S.a)S.b=S.a+1}}function mm(r){var a=r[0].v,b=a;r.forEach(x=>{if(x.v<a)a=x.v;if(x.v>b)b=x.v});if(a===b)b=a+1;var m=(b-a)*.1;return{a:a-m,b:b+m}}function draw(){var c=E('price-history-fullscreen-canvas');if(!c)return;var q=devicePixelRatio||1,rc=c.getBoundingClientRect();c.width=Math.max(400,rc.width*q);c.height=Math.max(260,rc.height*q);var g=c.getContext('2d'),w=c.width,h=c.height,p=74*q,r=28*q;g.fillStyle='#05070c';g.fillRect(0,0,w,h);g.font=12*q+'px Courier New';var v=S.rows.filter(x=>x.t>=S.a&&x.t<=S.b);if(v.length<2){g.fillStyle='#00ffff';g.fillText('Not enough records in this view',p,42*q);return}var m=mm(v);function X(t){return p+(t-S.a)/(S.b-S.a||1)*(w-p-r)}function Y(n){return h-p-(n-m.a)/(m.b-m.a)*(h-p*1.55)}g.strokeStyle='rgba(0,255,255,.14)';g.lineWidth=q;g.fillStyle='#c8d4e8';for(var i=0;i<6;i++){var val=m.b-i*(m.b-m.a)/5,yy=Y(val);g.beginPath();g.moveTo(p,yy);g.lineTo(w-r,yy);g.stroke();g.fillText('£'+Math.round(val),10*q,yy+4*q)}g.strokeStyle='#00ffff';g.lineWidth=2.2*q;g.beginPath();v.forEach((x,i)=>{var xx=X(x.t),yy=Y(x.v);if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();g.fillStyle='#c8d4e8';g.fillText(D(S.a),p,h-20*q);g.textAlign='right';g.fillText(D(S.b),w-r,h-20*q);g.textAlign='left';var meta=E('price-history-fullscreen-meta');if(meta)meta.textContent=v.length+' visible records of '+S.rows.length+' loaded records'}function zoom(f,cr){var sp=S.b-S.a,cen=S.a+sp*(cr==null?.5:cr),ns=Math.max(1800000,sp*f),k=cr==null?.5:cr;S.a=cen-ns*k;S.b=S.a+ns;draw()}function open(){var o=E('price-history-fullscreen-overlay');if(!o)return;o.classList.add('open');rows().then(r=>{S.rows=r;view();draw()})}function close(){var o=E('price-history-fullscreen-overlay');if(o)o.classList.remove('open')}document.addEventListener('DOMContentLoaded',()=>{var b=E('price-history-fullscreen-btn');if(b)b.onclick=open;var c=E('price-history-fullscreen-close');if(c)c.onclick=close;var z=E('price-history-zoom-reset');if(z)z.onclick=()=>{view();draw()};var i=E('price-history-zoom-in');if(i)i.onclick=()=>zoom(.7);var o=E('price-history-zoom-out');if(o)o.onclick=()=>zoom(1.4);var cv=E('price-history-fullscreen-canvas');if(cv){cv.addEventListener('wheel',e=>{e.preventDefault();var r=cv.getBoundingClientRect();zoom(e.deltaY<0?.82:1.22,(e.clientX-r.left)/r.width)},{passive:false});cv.addEventListener('pointerdown',e=>{S.drag=true;S.x=e.clientX;cv.setPointerCapture(e.pointerId)});cv.addEventListener('pointermove',e=>{if(!S.drag)return;var dx=e.clientX-S.x;S.x=e.clientX;var sp=S.b-S.a,sh=-dx/Math.max(1,cv.getBoundingClientRect().width)*sp;S.a+=sh;S.b+=sh;requestAnimationFrame(draw)});cv.addEventListener('pointerup',()=>S.drag=false);cv.addEventListener('pointercancel',()=>S.drag=false)}document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});window.addEventListener('resize',draw)})})();'''

def patch_page():
    t=PAGE.read_text(encoding='utf-8')
    if 'price-history-from' not in t:
        t=t.replace('<a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>',DATE_HTML+'\n        <a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>',1)
    t=t.replace('Independently captured from Elexon BMRS Market Index values.','Historical Elexon System Prices are shown for context. New live Market Index records build forward.')
    PAGE.write_text(t,encoding='utf-8')

def patch_css():
    t=CSS.read_text(encoding='utf-8')
    if 'price-history-date-label' not in t:t=t.rstrip()+CSS_ADD
    CSS.write_text(t,encoding='utf-8')

def patch_js():
    t=JS.read_text(encoding='utf-8')
    if 'function customDateWindow' not in t:
        t=t.replace('  function cutoff(range){\n','  function customDateWindow(){\n    var f=document.getElementById("price-history-from"),to=document.getElementById("price-history-to");\n    if(!f||!to||!f.value||!to.value)return null;\n    var a=new Date(f.value+"T00:00:00Z"),b=new Date(to.value+"T23:59:59Z");\n    if(isNaN(a)||isNaN(b)||b<a)return null;\n    var max=60*24*60*60*1000;\n    if(b-a>max)b=new Date(a.getTime()+max);\n    return {start:a,end:b,label:f.value+" to "+b.toISOString().slice(0,10)};\n  }\n  function cutoff(range){\n',1)
    t=t.replace('      var cut = cutoff(range);\n      var rows = cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows;','      var custom = customDateWindow();\n      var cut = cutoff(range);\n      var rows = custom ? allRows.filter(function(r){ var t=new Date(r.priceTimeUTC); return t>=custom.start && t<=custom.end; }) : (cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows);\n      var activeRangeLabel = custom ? custom.label : range;')
    t=t.replace('      renderTable(rows, range);\n      draw(rows, range);','      renderTable(rows, activeRangeLabel);\n      draw(rows, activeRangeLabel);')
    if 'price-history-clear-dates' not in t:
        t=t.replace('    if(rangeEl) rangeEl.addEventListener("change", load);\n    load();','    if(rangeEl) rangeEl.addEventListener("change", load);\n    var f=document.getElementById("price-history-from"),to=document.getElementById("price-history-to"),cl=document.getElementById("price-history-clear-dates");\n    if(f)f.addEventListener("change",load);\n    if(to)to.addEventListener("change",load);\n    if(cl)cl.addEventListener("click",function(){if(f)f.value="";if(to)to.value="";load();});\n    load();')
    JS.write_text(t,encoding='utf-8')

def patch_diary():
    t=DIARY.read_text(encoding='utf-8')
    marker='## Diary entry: 2026-05-26 V3 range and full screen correction'
    if marker not in t:
        t+='\n\n'+marker+'\n\nFixed the missed pieces from the first merge test. The normal chart already used the historical CSV, but the full screen chart still loaded only captured JSON. This patch makes full screen load the same historical CSV plus captured JSON. It also adds from and to date controls above the chart and caps custom viewing windows at 60 days. The Elexon historical CSV currently only goes back to 2026-04-25 because the existing Elexon workflow was last populated with about 30 days. To show more than that, run Update Elexon System Prices with a larger backfill_days value.\n'
    DIARY.write_text(t,encoding='utf-8')

def main():
    patch_page();patch_css();patch_js();FS.write_text(FS_JS,encoding='utf-8');patch_diary();print('patched V3 range controls and full screen source alignment')
if __name__=='__main__':main()
