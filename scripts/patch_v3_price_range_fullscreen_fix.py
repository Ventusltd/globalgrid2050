from pathlib import Path

PAGE = Path('uk_energy_tracking_v3/index.md')
CSS = Path('uk_energy_tracking_v3/price-history-ui.css')
JS = Path('uk_energy_tracking_v3/price-history-ui.js')
FS = Path('uk_energy_tracking_v3/price-history-fullscreen.js')
DIARY = Path('uk_energy_tracking_v3/WORK_DIARY.md')

DATE_HTML = '''
        <label class="price-history-date-label">From <input type="date" id="price-history-from"></label>
        <label class="price-history-date-label">To <input type="date" id="price-history-to"></label>
        <button type="button" id="price-history-clear-dates" class="price-history-date-apply">Clear dates</button>'''

CSS_ADD = '''

/* V3 price history calendar range controls */
#electricity-price-history-panel .price-history-date-label{display:flex;align-items:center;gap:6px;color:#9aa3b6;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
#electricity-price-history-panel .price-history-date-label input{background:#050505!important;color:#00ffff!important;border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;font-family:"Courier New",monospace}
#electricity-price-history-panel .price-history-date-apply{border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;color:#00ffff!important;background:rgba(0,255,255,.05)!important;font-family:"Courier New",monospace;cursor:pointer}
#electricity-price-history-panel table.price-history-table tr.price-warning td{background:#20160b!important;color:#ffd28a!important}
#electricity-price-history-panel table.price-history-table tr.price-warning td:nth-child(2){color:#ffcc66!important}
'''

FS_JS = r'''(function(){
  var JSON_URL='/uk_energy_tracking_v3/electricity_price_history.json';
  var CSV_URL='/data/electricity/elexon_system_prices_half_hourly.csv';
  var S={rows:[],a:0,b:1,drag:false,x:0};
  function E(id){return document.getElementById(id)}
  function csvLine(line){var out=[],v='',q=false;for(var i=0;i<line.length;i++){var c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){out.push(v);v=''}else v+=c}out.push(v);return out}
  function fmtDate(t){return new Date(t).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
  function parseCsv(text){text=(text||'').trim();if(!text)return[];var lines=text.split(/\r?\n/),heads=csvLine(lines[0]).map(function(h){return h.trim()});return lines.slice(1).map(function(line){var cols=csvLine(line),r={};heads.forEach(function(h,i){r[h]=(cols[i]||'').trim()});var price=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{t:new Date(r.periodStartUTC||r.priceTimeUTC).getTime(),v:Number(price),health:r.priceHealth||'historical system price'}}).filter(function(r){return r.t&&r.v===r.v}).sort(function(a,b){return a.t-b.t})}
  function parseJson(data){return(data.rows||[]).map(function(r){return{t:new Date(r.priceTimeUTC).getTime(),v:Number(r.priceGBPperMWh),health:r.priceHealth||''}}).filter(function(r){return r.t&&r.v===r.v})}
  function cutoff(range){if(range==='all')return null;var end=Date.now(),ms=0;if(range==='24h')ms=86400000;else if(range==='7d')ms=7*86400000;else if(range==='30d')ms=30*86400000;else if(range==='3m')ms=92*86400000;else if(range==='6m')ms=183*86400000;else if(range==='12m')ms=366*86400000;else ms=3650*86400000;return end-ms}
  function customWindow(){var f=E('price-history-from'),t=E('price-history-to');if(!f||!t||!f.value||!t.value)return null;var a=new Date(f.value+'T00:00:00Z').getTime(),b=new Date(t.value+'T23:59:59Z').getTime();if(!a||!b||b<a)return null;var max=60*86400000;if(b-a>max)b=a+max;return{a:a,b:b}}
  function loadRows(){var rangeEl=E('price-history-range'),range=rangeEl?rangeEl.value:'7d',cw=customWindow(),cut=cutoff(range);return Promise.all([fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(parseJson).catch(function(){return[]}),fetch(CSV_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(parseCsv).catch(function(){return[]})]).then(function(pair){var merged={};pair[1].forEach(function(r){merged[r.t]=r});pair[0].forEach(function(r){merged[r.t]=r});var rows=Object.keys(merged).sort().map(function(k){return merged[k]});if(cw)return rows.filter(function(r){return r.t>=cw.a&&r.t<=cw.b});return cut?rows.filter(function(r){return r.t>=cut}):rows})}
  function setView(){if(S.rows.length){S.a=S.rows[0].t;S.b=S.rows[S.rows.length-1].t;if(S.b<=S.a)S.b=S.a+1}}
  function minMax(rows){var lo=rows[0].v,hi=lo;rows.forEach(function(r){if(r.v<lo)lo=r.v;if(r.v>hi)hi=r.v});if(lo===hi)hi=lo+1;var m=(hi-lo)*.1;return{lo:lo-m,hi:hi+m}}
  function draw(){var c=E('price-history-fullscreen-canvas');if(!c)return;var q=devicePixelRatio||1,rc=c.getBoundingClientRect();c.width=Math.max(400,Math.floor(rc.width*q));c.height=Math.max(260,Math.floor(rc.height*q));var g=c.getContext('2d'),w=c.width,h=c.height,p=74*q,rp=28*q;g.fillStyle='#05070c';g.fillRect(0,0,w,h);g.font=12*q+'px Courier New';var rows=S.rows.filter(function(r){return r.t>=S.a&&r.t<=S.b});if(rows.length<2){g.fillStyle='#00ffff';g.fillText('Not enough records in this view',p,42*q);return}var mm=minMax(rows);function X(t){return p+(t-S.a)/(S.b-S.a||1)*(w-p-rp)}function Y(v){return h-p-(v-mm.lo)/(mm.hi-mm.lo)*(h-p*1.55)}g.strokeStyle='rgba(0,255,255,.14)';g.lineWidth=q;g.fillStyle='#c8d4e8';for(var i=0;i<6;i++){var val=mm.hi-i*(mm.hi-mm.lo)/5,yy=Y(val);g.beginPath();g.moveTo(p,yy);g.lineTo(w-rp,yy);g.stroke();g.fillText('£'+Math.round(val),10*q,yy+4*q)}g.strokeStyle='#00ffff';g.lineWidth=2.2*q;g.beginPath();rows.forEach(function(x,i){var xx=X(x.t),yy=Y(x.v);if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();g.fillStyle='#c8d4e8';g.fillText(fmtDate(S.a),p,h-20*q);g.textAlign='right';g.fillText(fmtDate(S.b),w-rp,h-20*q);g.textAlign='left';var meta=E('price-history-fullscreen-meta');if(meta)meta.textContent=rows.length+' visible records of '+S.rows.length+' loaded records'}
  function zoom(f,cr){var sp=S.b-S.a,cen=S.a+sp*(cr==null?.5:cr),ns=Math.max(1800000,sp*f),k=cr==null?.5:cr;S.a=cen-ns*k;S.b=S.a+ns;draw()}
  function open(){var o=E('price-history-fullscreen-overlay');if(!o)return;o.classList.add('open');loadRows().then(function(rows){S.rows=rows;setView();draw()})}
  function close(){var o=E('price-history-fullscreen-overlay');if(o)o.classList.remove('open')}
  document.addEventListener('DOMContentLoaded',function(){var b=E('price-history-fullscreen-btn');if(b)b.onclick=open;var c=E('price-history-fullscreen-close');if(c)c.onclick=close;var z=E('price-history-zoom-reset');if(z)z.onclick=function(){setView();draw()};var zi=E('price-history-zoom-in');if(zi)zi.onclick=function(){zoom(.7)};var zo=E('price-history-zoom-out');if(zo)zo.onclick=function(){zoom(1.4)};var cv=E('price-history-fullscreen-canvas');if(cv){cv.addEventListener('wheel',function(e){e.preventDefault();var r=cv.getBoundingClientRect();zoom(e.deltaY<0?.82:1.22,(e.clientX-r.left)/r.width)},{passive:false});cv.addEventListener('pointerdown',function(e){S.drag=true;S.x=e.clientX;cv.setPointerCapture(e.pointerId)});cv.addEventListener('pointermove',function(e){if(!S.drag)return;var dx=e.clientX-S.x;S.x=e.clientX;var sp=S.b-S.a,shift=-dx/Math.max(1,cv.getBoundingClientRect().width)*sp;S.a+=shift;S.b+=shift;requestAnimationFrame(draw)});cv.addEventListener('pointerup',function(){S.drag=false});cv.addEventListener('pointercancel',function(){S.drag=false})}document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});window.addEventListener('resize',draw)})
})();'''


def patch_page():
    text=PAGE.read_text(encoding='utf-8')
    if 'price-history-from' not in text:
        text=text.replace('<a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>',DATE_HTML+'\n        <a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>',1)
    text=text.replace('Captured Market Index Price','Electricity Price History')
    text=text.replace('Independently captured from Elexon BMRS Market Index values.','Historical Elexon System Prices are shown for context. New live Market Index records build forward. Warnings are shown in the table health column.')
    PAGE.write_text(text,encoding='utf-8')


def patch_css():
    text=CSS.read_text(encoding='utf-8')
    if 'price-history-date-label' not in text:
        text=text.rstrip()+CSS_ADD
    elif 'tr.price-warning' not in text:
        text=text.rstrip()+"\n#electricity-price-history-panel table.price-history-table tr.price-warning td{background:#20160b!important;color:#ffd28a!important}\n#electricity-price-history-panel table.price-history-table tr.price-warning td:nth-child(2){color:#ffcc66!important}\n"
    CSS.write_text(text,encoding='utf-8')


def patch_js():
    text=JS.read_text(encoding='utf-8')
    old_cut="""  function cutoff(range){
    if(range === "all") return null;
    var d = new Date();
    if(range === "24h") d.setDate(d.getDate() - 1);
    else if(range === "7d") d.setDate(d.getDate() - 7);
    else if(range === "30d") d.setDate(d.getDate() - 30);
    else if(range === "3m") d.setMonth(d.getMonth() - 3);
    else if(range === "6m") d.setMonth(d.getMonth() - 6);
    else if(range === "12m") d.setFullYear(d.getFullYear() - 1);
    else d.setFullYear(d.getFullYear() - 10);
    return d;
  }
"""
    new_cut="""  function customDateWindow(){
    var f = document.getElementById("price-history-from"), t = document.getElementById("price-history-to");
    if(!f || !t || !f.value || !t.value) return null;
    var start = new Date(f.value + "T00:00:00Z");
    var end = new Date(t.value + "T23:59:59Z");
    if(isNaN(start) || isNaN(end) || end < start) return null;
    var max = 60 * 24 * 60 * 60 * 1000;
    if(end - start > max) end = new Date(start.getTime() + max);
    return {start:start, end:end, label:f.value + " to " + end.toISOString().slice(0,10)};
  }
  function cutoff(range){
    if(range === "all") return null;
    var now = Date.now(), days = 3650;
    if(range === "24h") days = 1;
    else if(range === "7d") days = 7;
    else if(range === "30d") days = 30;
    else if(range === "3m") days = 92;
    else if(range === "6m") days = 183;
    else if(range === "12m") days = 366;
    return new Date(now - days * 24 * 60 * 60 * 1000);
  }
"""
    if old_cut in text:
        text=text.replace(old_cut,new_cut,1)
    elif 'function customDateWindow' not in text:
        text=text.replace('  function cutoff(range){\n',new_cut+'\n  function cutoff(range){\n',1)
    old_health="""  function carbonHealthCell(r){
    if(r.carbonGperKWh !== "" && r.carbonGperKWh != null) return r.carbonGperKWh + " g/kWh";
    if(r.carbonIndex) return String(r.carbonIndex);
    if(r.priceHealth && r.priceHealth !== "ok") return "price: " + r.priceHealth;
    if(r.carbonHealth && r.carbonHealth !== "ok") return "carbon: " + r.carbonHealth;
    return "—";
  }
"""
    new_health="""  function carbonHealthCell(r){
    if(r.priceHealth && r.priceHealth !== "ok") return "price: " + r.priceHealth;
    if(r.carbonHealth && r.carbonHealth !== "ok") return "carbon: " + r.carbonHealth;
    if(r.carbonGperKWh !== "" && r.carbonGperKWh != null) return r.carbonGperKWh + " g/kWh";
    if(r.carbonIndex) return String(r.carbonIndex);
    return "—";
  }
"""
    if old_health in text:
        text=text.replace(old_health,new_health,1)
    text=text.replace('      var cut = cutoff(range);\n      var rows = cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows;','      var custom = customDateWindow();\n      var cut = cutoff(range);\n      var rows = custom ? allRows.filter(function(r){ var t = new Date(r.priceTimeUTC); return t >= custom.start && t <= custom.end; }) : (cut ? allRows.filter(function(r){ return new Date(r.priceTimeUTC) >= cut; }) : allRows);\n      var activeRangeLabel = custom ? custom.label : range;')
    text=text.replace('      renderTable(rows, range);\n      draw(rows, range);','      renderTable(rows, activeRangeLabel);\n      draw(rows, activeRangeLabel);')
    text=text.replace("return '<tr><td>' + dateLabel(r.priceTimeUTC)", "return '<tr class=\"' + ((r.priceHealth && r.priceHealth !== 'ok') ? 'price-warning' : '') + '\"><td>' + dateLabel(r.priceTimeUTC)")
    if 'price-history-clear-dates' not in text:
        text=text.replace('    if(rangeEl) rangeEl.addEventListener("change", load);\n    load();','    if(rangeEl) rangeEl.addEventListener("change", load);\n    var f=document.getElementById("price-history-from"),to=document.getElementById("price-history-to"),cl=document.getElementById("price-history-clear-dates");\n    if(f)f.addEventListener("change",load);\n    if(to)to.addEventListener("change",load);\n    if(cl)cl.addEventListener("click",function(){if(f)f.value="";if(to)to.value="";load();});\n    load();')
    JS.write_text(text,encoding='utf-8')


def patch_diary():
    text=DIARY.read_text(encoding='utf-8')
    marker='## Diary entry: 2026-05-26 V3 range and full screen correction amended before run'
    if marker not in text:
        text+='\n\n'+marker+'\n\nAmended before execution after code review. The patch now aligns full screen with the inline chart by loading both the historical Elexon system price CSV and the V3 captured JSON. It adds From and To date controls capped to 60 days, changes rolling cutoffs to millisecond based UTC comparisons, surfaces priceHealth warnings before carbon values in the table health column and highlights warned rows. It also fixes the label so the panel is not described as captured Market Index only when historical System Prices are present.\n'
    DIARY.write_text(text,encoding='utf-8')


def main():
    patch_page(); patch_css(); patch_js(); FS.write_text(FS_JS,encoding='utf-8'); patch_diary(); print('amended V3 price range and fullscreen fix ready')

if __name__=='__main__': main()
