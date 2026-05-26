from pathlib import Path

PAGE=Path('uk_energy_tracking_v3/index.md')
CSS=Path('uk_energy_tracking_v3/price-history-ui.css')
JS=Path('uk_energy_tracking_v3/price-history-ui.js')
FS=Path('uk_energy_tracking_v3/price-history-fullscreen.js')
DIARY=Path('uk_energy_tracking_v3/WORK_DIARY.md')

MAIN_JS=r'''(function(){
var JSON_URL='/uk_energy_tracking_v3/electricity_price_history.json',CSV_URL='/data/electricity/elexon_system_prices_half_hourly.csv';
var STATE={all:[],visible:[],meta:null};window.__v3PriceHistoryState=STATE;
function $(id){return document.getElementById(id)}
function fmt(n,d){return n==null||isNaN(n)?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
function dlab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function tlab(t){return new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
function set(id,v){var e=$(id);if(e)e.textContent=v}
function csvLine(l){var o=[],v='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c==='"'){if(q&&l[i+1]==='"'){v+='"';i++}else q=!q}else if(c===','&&!q){o.push(v);v=''}else v+=c}o.push(v);return o}
function parseCsv(t){t=(t||'').trim();if(!t)return[];var lines=t.split(/\r?\n/),h=csvLine(lines[0]).map(x=>x.trim());return lines.slice(1).map(function(line){var c=csvLine(line),r={};h.forEach((x,i)=>r[x]=(c[i]||'').trim());var p=r.systemBuyPriceGBPperMWh||r.systemSellPriceGBPperMWh||r.priceGBPperMWh||'';return{source:r.source||'Elexon BMRS System Prices',priceTimeUTC:r.periodStartUTC||r.priceTimeUTC||'',capturedAtUTC:r.fetchedAtUTC||r.capturedAtUTC||'',settlementDate:r.settlementDate||'',settlementPeriod:r.settlementPeriod||'',priceGBPperMWh:p,carbonGperKWh:r.carbonGperKWh||'',carbonIndex:r.carbonIndex||'',priceHealth:r.priceHealth||'historical system price',carbonHealth:r.carbonHealth||'',netImbalanceVolumeMWh:r.netImbalanceVolumeMWh||''}}).filter(r=>r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh)))}
function loadJson(){return fetch(JSON_URL+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():{rows:[]}).then(d=>d.rows||[]).catch(()=>[])}
function loadCsv(){return fetch(CSV_URL+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.text():'').then(parseCsv).catch(()=>[])}
function norm(rows){var seen={};return(rows||[]).filter(r=>r.priceTimeUTC&&r.priceGBPperMWh!==''&&!isNaN(Number(r.priceGBPperMWh))).map(function(r){var o=Object.assign({},r);o.priceGBPperMWh=Number(o.priceGBPperMWh);return o}).sort((a,b)=>new Date(a.priceTimeUTC)-new Date(b.priceTimeUTC)).filter(function(r){var k=r.priceTimeUTC+'|'+r.priceGBPperMWh;if(seen[k])return false;seen[k]=1;return true})}
function merge(sys,cap){var m={};sys.forEach(r=>{m[r.priceTimeUTC]=Object.assign({},r,{source:'Elexon BMRS System Prices',priceHealth:r.priceHealth||'historical system price'})});cap.forEach(r=>{m[r.priceTimeUTC]=Object.assign({},r,{source:r.source||'V3 captured Elexon Market Index Price'})});return Object.keys(m).sort((a,b)=>new Date(a)-new Date(b)).map(k=>m[k])}
function customWindow(){var f=$('price-history-from'),t=$('price-history-to');if(!f||!t||!f.value||!t.value)return null;var a=new Date(f.value+'T00:00:00Z'),b=new Date(t.value+'T23:59:59Z');if(isNaN(a)||isNaN(b)||b<a)return null;var max=60*86400000;if(b-a>max)b=new Date(a.getTime()+max);return{start:a,end:b,label:f.value+' to '+b.toISOString().slice(0,10),custom:true}}
function rangeWindow(range,all){var cw=customWindow();if(cw)return cw;var now=new Date(),days={"24h":1,"7d":7,"30d":30,"3m":92,"6m":183,"12m":366,"10y":3650}[range];if(range==='all'||!days){var s=all.length?new Date(all[0].priceTimeUTC):now,e=all.length?new Date(all[all.length-1].priceTimeUTC):now;return{start:s,end:e,label:'all available data',custom:false}}return{start:new Date(now.getTime()-days*86400000),end:now,label:range,custom:false}}
function health(r){if(r.priceHealth&&r.priceHealth!=='ok')return 'price: '+r.priceHealth;if(r.carbonHealth&&r.carbonHealth!=='ok')return 'carbon: '+r.carbonHealth;if(r.carbonGperKWh!==''&&r.carbonGperKWh!=null)return r.carbonGperKWh+' g/kWh';if(r.carbonIndex)return String(r.carbonIndex);return '—'}
function minMax(v){var lo=v[0],hi=v[0];v.forEach(x=>{if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=(hi-lo)*.1;return{lo:lo-m,hi:hi+m}}
function draw(rows,meta){var c=$('price-history-canvas');if(!c)return;var q=devicePixelRatio||1,r=c.getBoundingClientRect();if(r.width){c.width=Math.max(320,Math.floor(r.width*q));c.height=Math.max(190,Math.floor((r.height||240)*q))}var g=c.getContext('2d'),w=c.width,h=c.height,p=62*q,rp=22*q;g.clearRect(0,0,w,h);g.fillStyle='#05070c';g.fillRect(0,0,w,h);g.font=12*q+'px Courier New';var t0=meta?meta.start.getTime():0,t1=meta?meta.end.getTime():1;if(t1<=t0)t1=t0+1;var vals=rows.map(x=>Number(x.priceGBPperMWh));if(vals.length<2){g.fillStyle='#00ffff';g.font=14*q+'px Courier New';g.fillText('No records in selected range. Check data source or run Elexon backfill.',p,42*q);g.fillStyle='#c8d4e8';g.fillText(dlab(t0),p,h-18*q);g.textAlign='right';g.fillText(dlab(t1),w-rp,h-18*q);g.textAlign='left';return}var mm=minMax(vals);function X(r){return p+((new Date(r.priceTimeUTC).getTime()-t0)/(t1-t0))*(w-p-rp)}function Y(v){return h-p-((v-mm.lo)/(mm.hi-mm.lo))*(h-p*1.65)}g.strokeStyle='rgba(0,255,255,.16)';g.lineWidth=q;g.fillStyle='#c8d4e8';for(var i=0;i<5;i++){var val=mm.hi-i*(mm.hi-mm.lo)/4,yy=Y(val);g.beginPath();g.moveTo(p,yy);g.lineTo(w-rp,yy);g.stroke();g.fillText('£'+fmt(val,0),8*q,yy+4*q)}g.strokeStyle='#00ffff';g.lineWidth=2.2*q;g.shadowColor='#00ffff';g.shadowBlur=6*q;g.beginPath();rows.forEach((r,i)=>{var xx=X(r),yy=Y(Number(r.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();g.shadowBlur=0;g.fillStyle='#c8d4e8';g.fillText(dlab(t0),p,h-18*q);g.textAlign='right';g.fillText(dlab(t1),w-rp,h-18*q);g.textAlign='left'}
function table(rows,meta){var b=$('price-history-table-body');if(!b)return;if(!rows.length){b.innerHTML='<tr><td colspan="5">No records available for selected range: '+meta.label+'. Check data source or run Elexon backfill.</td></tr>';return}b.innerHTML=rows.slice().reverse().map(r=>'<tr class="'+((r.priceHealth&&r.priceHealth!=='ok')?'price-warning':'')+'"><td>'+dlab(r.priceTimeUTC)+' '+tlab(r.priceTimeUTC)+'</td><td>£'+fmt(Number(r.priceGBPperMWh),2)+'</td><td>'+(r.settlementPeriod||'—')+'</td><td>'+dlab(r.capturedAtUTC)+' '+tlab(r.capturedAtUTC)+'</td><td>'+health(r)+'</td></tr>').join('')}
function status(meta,all,rows){var s=$('price-history-range-status');if(!s)return;var av=all.length?dlab(all[0].priceTimeUTC)+' to '+dlab(all[all.length-1].priceTimeUTC):'no source data';s.textContent='Selected range: '+dlab(meta.start)+' to '+dlab(meta.end)+' | Available source data: '+av+' | Visible records: '+rows.length}
function load(){var rangeEl=$('price-history-range'),range=rangeEl?rangeEl.value:'7d';Promise.all([loadJson(),loadCsv()]).then(function(p){var all=merge(norm(p[1]),norm(p[0])),meta=rangeWindow(range,all);var rows=all.filter(r=>{var t=new Date(r.priceTimeUTC);return t>=meta.start&&t<=meta.end});STATE.all=all;STATE.visible=rows;STATE.meta=meta;var latest=all.length?all[all.length-1]:null;set('ph-latest-price',latest?'£'+fmt(Number(latest.priceGBPperMWh),2):'—');set('ph-latest-time',latest?dlab(latest.priceTimeUTC)+' '+tlab(latest.priceTimeUTC):'—');set('ph-row-count',String(all.length));set('ph-source',p[1].length?'Historical Elexon System Prices plus V3 captured Market Index':'V3 captured Market Index');status(meta,all,rows);table(rows,meta);draw(rows,meta)}).catch(()=>{var m={start:new Date(),end:new Date(),label:'selected range'};table([],m);draw([],m)})}
document.addEventListener('DOMContentLoaded',function(){var r=$('price-history-range'),f=$('price-history-from'),t=$('price-history-to'),cl=$('price-history-clear-dates');if(r)r.addEventListener('change',load);if(f)f.addEventListener('change',load);if(t)t.addEventListener('change',load);if(cl)cl.addEventListener('click',function(){if(f)f.value='';if(t)t.value='';load()});load();setInterval(load,5*60*1000);window.addEventListener('resize',function(){if(STATE.meta)draw(STATE.visible,STATE.meta)})});
})();'''

FULLSCREEN_JS=r'''(function(){
var S={rows:[],meta:null};function $(id){return document.getElementById(id)}function dlab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}function fmt(n,d){return Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
function mm(v){var lo=v[0],hi=v[0];v.forEach(x=>{if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=(hi-lo)*.1;return{lo:lo-m,hi:hi+m}}
function draw(){var c=$('price-history-fullscreen-canvas');if(!c)return;var q=devicePixelRatio||1,r=c.getBoundingClientRect();c.width=Math.max(400,Math.floor(r.width*q));c.height=Math.max(260,Math.floor(r.height*q));var g=c.getContext('2d'),w=c.width,h=c.height,p=74*q,rp=28*q;g.fillStyle='#05070c';g.fillRect(0,0,w,h);g.font=12*q+'px Courier New';var rows=S.rows,meta=S.meta;if(!meta){meta={start:new Date(),end:new Date(),label:'selected range'}}var t0=meta.start.getTime(),t1=meta.end.getTime();if(t1<=t0)t1=t0+1;if(rows.length<2){g.fillStyle='#00ffff';g.fillText('No records in selected range. Check data source or run Elexon backfill.',p,42*q);g.fillStyle='#c8d4e8';g.fillText(dlab(t0),p,h-20*q);g.textAlign='right';g.fillText(dlab(t1),w-rp,h-20*q);g.textAlign='left';return}var vals=rows.map(x=>Number(x.priceGBPperMWh)),m=mm(vals);function X(r){return p+((new Date(r.priceTimeUTC).getTime()-t0)/(t1-t0))*(w-p-rp)}function Y(v){return h-p-((v-m.lo)/(m.hi-m.lo))*(h-p*1.55)}g.strokeStyle='rgba(0,255,255,.14)';g.lineWidth=q;g.fillStyle='#c8d4e8';for(var i=0;i<6;i++){var val=m.hi-i*(m.hi-m.lo)/5,yy=Y(val);g.beginPath();g.moveTo(p,yy);g.lineTo(w-rp,yy);g.stroke();g.fillText('£'+fmt(val,0),10*q,yy+4*q)}g.strokeStyle='#00ffff';g.lineWidth=2.2*q;g.beginPath();rows.forEach(function(x,i){var xx=X(x),yy=Y(Number(x.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();g.fillStyle='#c8d4e8';g.fillText(dlab(t0),p,h-20*q);g.textAlign='right';g.fillText(dlab(t1),w-rp,h-20*q);g.textAlign='left'}
function open(){var o=$('price-history-fullscreen-overlay'),st=window.__v3PriceHistoryState;if(!o)return;o.classList.add('open');S.rows=(st&&st.visible)||[];S.meta=(st&&st.meta)||null;var m=$('price-history-fullscreen-meta');if(m&&S.meta)m.textContent='Selected range: '+dlab(S.meta.start)+' to '+dlab(S.meta.end)+' | visible records: '+S.rows.length+' of '+((st&&st.all&&st.all.length)||S.rows.length)+' loaded records';draw()}
function close(){var o=$('price-history-fullscreen-overlay');if(o)o.classList.remove('open')}
document.addEventListener('DOMContentLoaded',function(){var b=$('price-history-fullscreen-btn'),c=$('price-history-fullscreen-close'),r=$('price-history-zoom-reset');if(b)b.onclick=open;if(c)c.onclick=close;if(r)r.onclick=draw;document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});window.addEventListener('resize',draw)});
})();'''

CSS_ADD='''
#electricity-price-history-panel .price-history-range-status{width:100%;color:#9aa3b6;font-size:11px;line-height:1.45;border:1px solid #252b36;border-radius:4px;padding:7px 9px;background:#070a10;}
#electricity-price-history-panel table.price-history-table tr.price-warning td{background:#20160b!important;color:#ffd28a!important}
#electricity-price-history-panel table.price-history-table tr.price-warning td:nth-child(2){color:#ffcc66!important}
'''

def patch_page():
    t=PAGE.read_text(encoding='utf-8')
    t=t.replace('<button type="button" id="price-history-zoom-out">Zoom out</button>\n        <button type="button" id="price-history-zoom-in">Zoom in</button>\n        <button type="button" id="price-history-zoom-reset">Reset</button>\n        <button type="button" id="price-history-fullscreen-close">Close</button>','<button type="button" id="price-history-zoom-reset">Redraw</button>\n        <button type="button" id="price-history-fullscreen-close">Close</button>')
    t=t.replace('<div class="price-history-fullscreen-note">Wheel to zoom. Drag to pan. Esc closes the chart.</div>','<div class="price-history-fullscreen-note">Full screen uses the selected inline date range. Esc closes the chart.</div>')
    if 'price-history-range-status' not in t:
        t=t.replace('</div>\n      <div class="unit-panel"><strong>Unit:</strong>', '</div>\n      <div id="price-history-range-status" class="price-history-range-status">Selected range will appear here.</div>\n      <div class="unit-panel"><strong>Unit:</strong>',1)
    t=t.replace("<script src='/uk_energy_tracking_v3/price-history-ui.js'></script>","<script src='/uk_energy_tracking_v3/price-history-ui.js?v=20260526d'></script>")
    t=t.replace("<script src='/uk_energy_tracking_v3/price-history-fullscreen.js'></script>","<script src='/uk_energy_tracking_v3/price-history-fullscreen.js?v=20260526d'></script>")
    PAGE.write_text(t,encoding='utf-8')

def patch_css():
    t=CSS.read_text(encoding='utf-8')
    if 'price-history-range-status' not in t:t=t.rstrip()+"\n"+CSS_ADD
    CSS.write_text(t,encoding='utf-8')

def patch_diary():
    t=DIARY.read_text(encoding='utf-8')
    marker='## Diary entry: 2026-05-26 V3 selected range axis and fullscreen simplification patch'
    if marker not in t:
        t+='\n\n'+marker+'\n\nThis patch makes the selected date window govern the x axis rather than allowing the chart to collapse to only the earliest and latest available rows. It adds a visible selected range and available source data status line, makes the table use the same selected range, removes broken zoom in and zoom out controls from full screen mode and makes full screen reuse the already loaded inline chart state. If a selected range has no rows, both chart and table state that no records are available and advise checking the data source or running Elexon backfill.\n'
    DIARY.write_text(t,encoding='utf-8')

def main():
    patch_page();patch_css();JS.write_text(MAIN_JS,encoding='utf-8');FS.write_text(FULLSCREEN_JS,encoding='utf-8');patch_diary();print('patched V3 selected range axis, table status and fullscreen simplification')
if __name__=='__main__':main()
