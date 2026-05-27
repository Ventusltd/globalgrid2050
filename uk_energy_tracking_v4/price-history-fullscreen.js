(function(){
var S={rows:[],meta:null};
function $(id){return document.getElementById(id)}
function fmt(n,d){return Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
function mlab(t){return new Date(t).toLocaleDateString('en-GB',{month:'short',year:'2-digit'})}
function slab(t){return new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function mm(v){var lo=0,hi=0;v.forEach(function(x){if(x<lo)lo=x;if(x>hi)hi=x});if(lo===hi)hi=lo+1;var m=(hi-lo)*0.08;return{lo:lo-m,hi:hi+m}}
function niceStep(span){var raw=span/7,p=Math.pow(10,Math.floor(Math.log10(Math.max(raw,1)))),n=raw/p;if(n<=1)return p;if(n<=2)return 2*p;if(n<=5)return 5*p;return 10*p}
function injectStyle(){
 if(document.getElementById('v4-fullscreen-graph-controls'))return;
 var s=document.createElement('style');
 s.id='v4-fullscreen-graph-controls';
 s.textContent='.price-history-fullscreen-overlay.open{display:block!important}.price-history-fullscreen-overlay{position:fixed!important;inset:0!important;z-index:99999!important;background:#000!important;padding:0!important;overflow:hidden!important}.price-history-fullscreen-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important;border-radius:0!important;background:#05070c!important;display:block!important;overflow:hidden!important}.price-history-fullscreen-toolbar{position:fixed!important;top:calc(env(safe-area-inset-top,0px) + 8px)!important;right:8px!important;z-index:100002!important;display:flex!important;gap:6px!important;border:0!important;background:transparent!important;padding:0!important}.price-history-fullscreen-toolbar strong,.price-history-fullscreen-toolbar span,#price-history-zoom-reset{display:none!important}.price-history-fullscreen-toolbar button,.fs-mini button{border:1px solid rgba(0,255,255,.70)!important;border-radius:6px!important;padding:7px 9px!important;background:rgba(5,7,12,.70)!important;color:#00ffff!important;font:11px Courier New,monospace!important}.price-history-fullscreen-note{display:none!important}#price-history-fullscreen-canvas{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;border:0!important;background:#05070c!important}.fs-mini{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:72px;z-index:100001;display:flex;gap:6px;align-items:center}.fs-mini button.active{background:rgba(0,255,255,.20)!important}.fs-mini-label{position:fixed;left:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);z-index:100001;color:#9aa3b6;font:10px Courier New,monospace;background:rgba(5,7,12,.52);padding:5px 7px;border:1px solid rgba(255,255,255,.10);border-radius:5px}.fs-nav{position:fixed;top:50%;z-index:100001;transform:translateY(-50%);width:40px;height:56px;border:1px solid rgba(0,255,255,.45);background:rgba(5,7,12,.50);color:#00ffff;border-radius:7px;font:24px Courier New,monospace}.fs-nav.left{left:8px}.fs-nav.right{right:8px}@media(orientation:landscape){.fs-mini-label{bottom:6px}.fs-nav{height:46px}.fs-mini{right:70px}}';
 document.head.appendChild(s)
}
function ensureControls(){
 injectStyle();var o=$('price-history-fullscreen-overlay');if(!o||$('fs-mini'))return;
 var mini=document.createElement('div');mini.id='fs-mini';mini.className='fs-mini';mini.innerHTML='<button type="button" data-fs-mode="all" class="active">All</button><button type="button" data-fs-mode="day">Day</button><button type="button" data-fs-mode="night">Night</button>';
 var left=document.createElement('button');left.id='fs-prev';left.className='fs-nav left';left.type='button';left.textContent='‹';
 var right=document.createElement('button');right.id='fs-next';right.className='fs-nav right';right.type='button';right.textContent='›';
 var lab=document.createElement('div');lab.id='fs-label';lab.className='fs-mini-label';lab.textContent='';
 o.appendChild(mini);o.appendChild(left);o.appendChild(right);o.appendChild(lab);bindControls()
}
function bindControls(){
 var c=window.__v4PriceHistoryControls;if(!c)return;var prev=$('fs-prev'),next=$('fs-next'),mini=$('fs-mini');
 if(prev)prev.addEventListener('click',function(){var st=window.__v4PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.max(0,v-days));setTimeout(open,120)});
 if(next)next.addEventListener('click',function(){var st=window.__v4PriceHistoryState||{},days=c.periodDays((st.meta||{}).period||'7d'),v=c.offsetFromDate((st.meta||{}).start||new Date());c.setOffset(Math.min(c.totalScrollableDays(),v+days));setTimeout(open,120)});
 if(mini)mini.addEventListener('click',function(e){var b=e.target.closest('button[data-fs-mode]');if(!b)return;mini.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b)});c.setMode(b.getAttribute('data-fs-mode'));setTimeout(open,120)})
}
function modeText(){var st=window.__v4PriceHistoryState||{};var m=st.timeMode||'all';if(m==='day')return 'Day 06 to 18 UTC';if(m==='night')return 'Night 18 to 06 UTC';return 'All hours'}
function drawDateTick(g,x,y,t,q,align){g.textAlign=align||'center';g.fillStyle='#f5f7fb';g.font=11*q+'px Courier New';g.fillText(mlab(t),x,y);g.textAlign='left'}
function drawAxes(g,w,h,q,m,t0,t1,pad){
 var step=niceStep(m.hi-m.lo),start=Math.ceil(m.lo/step)*step;g.lineWidth=q;g.font=11*q+'px Courier New';g.textAlign='left';
 for(var val=start;val<=m.hi+step*.5;val+=step){var yy=pad.top+((m.hi-val)/(m.hi-m.lo))*(h-pad.top-pad.bottom);g.strokeStyle=val===0?'rgba(255,51,51,.98)':'rgba(255,255,255,.17)';g.lineWidth=val===0?2*q:q;g.beginPath();g.moveTo(pad.left,yy);g.lineTo(w-pad.right,yy);g.stroke();g.fillStyle=val===0?'#ff3333':'#f5f7fb';g.fillText(val===0?'£0':'£'+fmt(val,0),8*q,yy+4*q)}
 var count=(t1-t0)>180*86400000?6:3;for(var i=0;i<count;i++){var ts=t0+(i/(count-1))*(t1-t0),x=pad.left+(i/(count-1))*(w-pad.left-pad.right);g.strokeStyle='rgba(255,255,255,.11)';g.lineWidth=q;g.beginPath();g.moveTo(x,pad.top);g.lineTo(x,h-pad.bottom);g.stroke();drawDateTick(g,x,h-28*q,ts,q,i===0?'left':(i===count-1?'right':'center'))}
}
function draw(){
 var c=$('price-history-fullscreen-canvas');if(!c)return;var q=devicePixelRatio||1,cssW=window.innerWidth,cssH=window.innerHeight;c.width=Math.max(320,Math.floor(cssW*q));c.height=Math.max(320,Math.floor(cssH*q));
 var g=c.getContext('2d'),w=c.width,h=c.height,isLandscape=w>h;
 var pad={left:(isLandscape?68:62)*q,right:(isLandscape?54:34)*q,top:(isLandscape?54:74)*q,bottom:(isLandscape?42:58)*q};
 g.fillStyle='#05070c';g.fillRect(0,0,w,h);
 var rows=S.rows,meta=S.meta;if(!meta){meta={start:new Date(),end:new Date(),period:'7d',timeMode:'all'}}var t0=meta.start.getTime(),t1=meta.end.getTime();if(t1<=t0)t1=t0+1;
 g.fillStyle='#00ffff';g.font=(isLandscape?12:13)*q+'px Courier New';g.fillText('ELECTRICITY PRICE',12*q,(isLandscape?22:34)*q);
 g.fillStyle='#9aa3b6';g.font=(isLandscape?9:10)*q+'px Courier New';g.fillText(slab(meta.start)+' to '+slab(meta.end)+' | '+modeText()+' | '+rows.length+' pts',12*q,(isLandscape?40:54)*q);
 if(rows.length<2){g.fillStyle='#00ffff';g.fillText('No records in view',pad.left,pad.top+40*q);return}
 var vals=rows.map(function(x){return Number(x.priceGBPperMWh)}),m=mm(vals);function X(r){return pad.left+((new Date(r.priceTimeUTC).getTime()-t0)/(t1-t0))*(w-pad.left-pad.right)}function Y(v){return pad.top+((m.hi-v)/(m.hi-m.lo))*(h-pad.top-pad.bottom)}
 drawAxes(g,w,h,q,m,t0,t1,pad);
 g.strokeStyle='#00ffff';g.lineWidth=(isLandscape?1.9:2.2)*q;g.shadowColor='#00ffff';g.shadowBlur=4*q;g.beginPath();rows.forEach(function(x,i){var xx=X(x),yy=Y(Number(x.priceGBPperMWh));if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy)});g.stroke();g.shadowBlur=0;
 var lab=$('fs-label');if(lab)lab.textContent='‹ › move by window | '+modeText()+' | '+slab(meta.start)+' to '+slab(meta.end)
}
function syncFs(){var st=window.__v4PriceHistoryState||{};var mini=$('fs-mini');if(mini){mini.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-fs-mode')===(st.timeMode||'all'))})}}
function open(){ensureControls();var o=$('price-history-fullscreen-overlay'),st=window.__v4PriceHistoryState;if(!o)return;o.classList.add('open');S.rows=(st&&st.visible)||[];S.meta=(st&&st.meta)||null;syncFs();setTimeout(draw,40)}
function close(){var o=$('price-history-fullscreen-overlay');if(o)o.classList.remove('open')}
document.addEventListener('DOMContentLoaded',function(){injectStyle();var b=$('price-history-fullscreen-btn'),c=$('price-history-fullscreen-close'),r=$('price-history-zoom-reset');if(b)b.onclick=open;if(c)c.onclick=close;if(r)r.onclick=draw;document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});window.addEventListener('resize',function(){if($('price-history-fullscreen-overlay')&&$('price-history-fullscreen-overlay').classList.contains('open'))draw()})});
})();