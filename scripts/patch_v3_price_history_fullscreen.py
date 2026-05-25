from pathlib import Path

PAGE = Path('uk_energy_tracking_v3/index.md')
CSS = Path('uk_energy_tracking_v3/price-history-ui.css')
JS = Path('uk_energy_tracking_v3/price-history-fullscreen.js')
DIARY = Path('uk_energy_tracking_v3/WORK_DIARY.md')

BUTTON = '<button type="button" id="price-history-fullscreen-btn" class="price-history-fullscreen-btn">Full screen chart</button>'
SCRIPT = "<script src='/uk_energy_tracking_v3/price-history-fullscreen.js'></script>"
OVERLAY = '''
  <div id="price-history-fullscreen-overlay" class="price-history-fullscreen-overlay">
    <div class="price-history-fullscreen-shell">
      <div class="price-history-fullscreen-toolbar">
        <strong>Electricity Price History</strong>
        <span id="price-history-fullscreen-meta">Captured Elexon market index prices</span>
        <button type="button" id="price-history-zoom-out">Zoom out</button>
        <button type="button" id="price-history-zoom-in">Zoom in</button>
        <button type="button" id="price-history-zoom-reset">Reset</button>
        <button type="button" id="price-history-fullscreen-close">Close</button>
      </div>
      <canvas id="price-history-fullscreen-canvas"></canvas>
      <div class="price-history-fullscreen-note">Wheel to zoom. Drag to pan. Esc closes the chart.</div>
    </div>
  </div>
'''

CSS_APPEND = '''

/* V3 price history fullscreen chart */
#electricity-price-history-panel .price-history-fullscreen-btn{border:1px solid #252b36!important;border-radius:4px;padding:7px 9px;color:#00ffff!important;background:rgba(0,255,255,.05)!important;font-family:"Courier New",monospace;cursor:pointer}.price-history-fullscreen-overlay{position:fixed;inset:0;display:none;z-index:9999;background:rgba(0,0,0,.92);padding:14px;box-sizing:border-box}.price-history-fullscreen-overlay.open{display:block}.price-history-fullscreen-shell{width:100%;height:100%;border:1px solid #00ffff;border-radius:8px;background:#05070c;box-shadow:0 0 32px rgba(0,255,255,.16);display:flex;flex-direction:column;overflow:hidden;transform:translateZ(0);will-change:transform}.price-history-fullscreen-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #252b36;background:#070a10;color:#f5f7fb;font-family:"Courier New",monospace}.price-history-fullscreen-toolbar strong{color:#00ffff;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.price-history-fullscreen-toolbar span{color:#9aa3b6;font-size:12px;margin-right:auto}.price-history-fullscreen-toolbar button{border:1px solid #252b36;border-radius:4px;padding:7px 9px;color:#00ffff;background:rgba(255,255,255,.03);font-family:"Courier New",monospace;cursor:pointer}#price-history-fullscreen-canvas{width:100%;height:100%;flex:1 1 auto;display:block;background:#05070c;touch-action:none;transform:translateZ(0);will-change:transform}.price-history-fullscreen-note{border-top:1px solid #252b36;padding:8px 12px;color:#9aa3b6;font:12px "Courier New",monospace;background:#070a10}
'''

JS_TEXT = r'''(function(){var URL='/uk_energy_tracking_v3/electricity_price_history.json';var S={rows:[],a:0,b:1,drag:false,x:0};function E(i){return document.getElementById(i)}function F(n){return Number(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}function D(t){return new Date(t).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}function cut(r){if(r==='all')return null;var d=new Date();if(r==='24h')d.setDate(d.getDate()-1);else if(r==='7d')d.setDate(d.getDate()-7);else if(r==='30d')d.setDate(d.getDate()-30);else if(r==='3m')d.setMonth(d.getMonth()-3);else if(r==='6m')d.setMonth(d.getMonth()-6);else if(r==='12m')d.setFullYear(d.getFullYear()-1);else d.setFullYear(d.getFullYear()-10);return d.getTime()}function rows(){var r=E('price-history-range'),c=cut(r?r.value:'7d');return fetch(URL+'?t='+Date.now(),{cache:'no-store'}).then(x=>x.ok?x.json():{rows:[]}).then(d=>(d.rows||[]).filter(p=>p.priceTimeUTC&&p.priceGBPperMWh!==''&&!isNaN(Number(p.priceGBPperMWh))).map(p=>({t:new Date(p.priceTimeUTC).getTime(),v:Number(p.priceGBPperMWh)})).sort((a,b)=>a.t-b.t).filter(p=>!c||p.t>=c)).catch(()=>[])}function view(){if(S.rows.length){S.a=S.rows[0].t;S.b=S.rows[S.rows.length-1].t;if(S.b<=S.a)S.b=S.a+1}}function mm(r){var a=r[0].v,b=r[0].v;r.forEach(p=>{if(p.v<a)a=p.v;if(p.v>b)b=p.v});if(a===b)b=a+1;var m=(b-a)*.1;return{a:a-m,b:b+m}}function draw(){var c=E('price-history-fullscreen-canvas');if(!c)return;var q=devicePixelRatio||1,rc=c.getBoundingClientRect();c.width=Math.max(400,rc.width*q);c.height=Math.max(260,rc.height*q);var g=c.getContext('2d'),w=c.width,h=c.height,p=74*q,r=28*q;g.fillStyle='#05070c';g.fillRect(0,0,w,h);g.font=12*q+'px Courier New';var v=S.rows.filter(x=>x.t>=S.a&&x.t<=S.b);if(v.length<2){g.fillStyle='#00ffff';g.fillText('Not enough captured records in this view',p,42*q);return}var m=mm(v);function X(t){return p+(t-S.a)/(S.b-S.a||1)*(w-p-r)}function Y(n){return h-p-(n-m.a)/(m.b-m.a)*(h-p*1.55)}g.strokeStyle='rgba(0,255,255,.14)';g.lineWidth=q;g.fillStyle='#c8d4e8';for(var i=0;i<6;i++){var val=m.b-i*(m.b-m.a)/5,yy=Y(val);g.beginPath();g.moveTo(p,yy);g.lineTo(w-r,yy);g.stroke();g.fillText('£'+Math.round(val),10*q,yy+4*q)}g.strokeStyle='#00ffff';g.lineWidth=2.2*q;g.beginPath();v.forEach((x,i)=>{var xx=X(x.t),yy=Y(x.v);if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();g.fillStyle='#c8d4e8';g.fillText(D(S.a),p,h-20*q);g.textAlign='right';g.fillText(D(S.b),w-r,h-20*q);g.textAlign='left';var meta=E('price-history-fullscreen-meta');if(meta)meta.textContent=v.length+' visible records of '+S.rows.length+' captured records'}function zoom(f,cr){var sp=S.b-S.a,cen=S.a+sp*(cr==null?.5:cr),ns=Math.max(1800000,sp*f),k=cr==null?.5:cr;S.a=cen-ns*k;S.b=S.a+ns;draw()}function open(){var o=E('price-history-fullscreen-overlay');if(!o)return;o.classList.add('open');rows().then(r=>{S.rows=r;view();draw()})}function close(){var o=E('price-history-fullscreen-overlay');if(o)o.classList.remove('open')}document.addEventListener('DOMContentLoaded',()=>{var b=E('price-history-fullscreen-btn');if(b)b.onclick=open;var c=E('price-history-fullscreen-close');if(c)c.onclick=close;var z=E('price-history-zoom-reset');if(z)z.onclick=()=>{view();draw()};var i=E('price-history-zoom-in');if(i)i.onclick=()=>zoom(.7);var o=E('price-history-zoom-out');if(o)o.onclick=()=>zoom(1.4);var cv=E('price-history-fullscreen-canvas');if(cv){cv.addEventListener('wheel',e=>{e.preventDefault();var r=cv.getBoundingClientRect();zoom(e.deltaY<0?.82:1.22,(e.clientX-r.left)/r.width)},{passive:false});cv.addEventListener('pointerdown',e=>{S.drag=true;S.x=e.clientX;cv.setPointerCapture(e.pointerId)});cv.addEventListener('pointermove',e=>{if(!S.drag)return;var dx=e.clientX-S.x;S.x=e.clientX;var sp=S.b-S.a,sh=-dx/Math.max(1,cv.getBoundingClientRect().width)*sp;S.a+=sh;S.b+=sh;requestAnimationFrame(draw)});cv.addEventListener('pointerup',()=>S.drag=false);cv.addEventListener('pointercancel',()=>S.drag=false)}document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});window.addEventListener('resize',draw)})})();'''

DIARY_MARKER='## Diary entry: 2026-05-25 V3 price history full screen chart patch'
DIARY_ENTRY='''\n\n## Diary entry: 2026-05-25 V3 price history full screen chart patch\n\nPurpose:\n\n```text\nadd a large full screen electricity price history chart with zoom and pan while keeping the stable tracker untouched\n```\n\nPatch method:\n\n```text\nadd full screen chart button\nadd full screen overlay and large canvas\nload V3 captured electricity price history JSON\nsupport wheel zoom, drag pan, reset and close\nuse canvas redraw with requestAnimationFrame and GPU friendly CSS compositing hints\n```\n'''

def write_if_changed(path,text):
    old=path.read_text(encoding='utf-8') if path.exists() else ''
    if old==text:return False
    path.write_text(text,encoding='utf-8');return True

def main():
    text=PAGE.read_text(encoding='utf-8')
    if BUTTON not in text:text=text.replace('<a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>','<a href="/uk_energy_tracking_v3/electricity_price_history.csv" download>Download CSV</a>\n        '+BUTTON,1)
    if 'price-history-fullscreen-overlay' not in text:text=text.replace('\n  <div class="scada-status" id="scada-status">',OVERLAY+'\n\n  <div class="scada-status" id="scada-status">',1)
    if SCRIPT not in text:text=text.replace("<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>","<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>\n"+SCRIPT,1)
    write_if_changed(PAGE,text)
    css=CSS.read_text(encoding='utf-8')
    if 'V3 price history fullscreen chart' not in css:css=css.rstrip()+CSS_APPEND
    write_if_changed(CSS,css)
    write_if_changed(JS,JS_TEXT)
    diary=DIARY.read_text(encoding='utf-8')
    if DIARY_MARKER not in diary:write_if_changed(DIARY,diary.rstrip()+DIARY_ENTRY+'\n')
    print('Prepared V3 price history full screen chart patch')

if __name__=='__main__':main()
