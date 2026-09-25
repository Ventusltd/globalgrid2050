import {build,sources,length} from './inverter-48-model.mjs';
import {createNativeAdapter} from './inverter-48-native.mjs';
import {mountElectrical} from './inverter-48-electrical-ui.mjs';
const $=id=>document.getElementById(id), frame=$('engine');
let model=build(),ready=false,playing=true,selected='S01',clock=0,last=performance.now(),drawing;
let flowCanvas=null,flowFrames=0,flowScope='all',flowStats={strings:0,homePaths:0};
let nativeAdapter=null,nativeWalks=[],electrical=null,electricalReport=null,tolerance=3;
const enteredLengths=new Map();
const win=()=>frame.contentWindow;
const map=p=>[p[0]*.01,-p[1]*.01];
const polygon=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
function nativeDrawing(){
  applyLengths();
  const shapes=[],marks=[],b=model.inverterDrawing;
  const add=(role,node,pts,extra={})=>{const s={role,node,pts:pts.map(map),order:0,pot:0,...extra};shapes.push(s);return s;};
  const label=(text,x,y,size=11,colour='#b6c9dc',extra={})=>marks.push({text,x:x*.01,y:-y*.01,size,colour,minPx:0,rank:0,...extra});
  add('inverter','INV-01',polygon(b.x,b.y,b.width,b.height),{fill:'#111b26'});
  label('352 kVA inverter',b.x+1,b.y+1,16);label('12 MPPT / 24 STRINGS',b.x+1,b.y+2.5,10);
  for(const m of model.modules){add('module',m.id,m.drawing,{fill:'#0c1119',stringId:m.stringId});label(m.id,m.drawing[0][0]+.15,m.drawing[0][1]+.35,9,'#788d9e',{minPx:24});}
  for(const l of model.links){
    const halves=[win().polySlice(l.drawing,0,.5),win().polySlice(l.drawing,.5,1)];
    for(let k=0;k<2;k++)add('cable',l.id+'-'+k,halves[k],{plus:k===0,stringId:l.stringId,weight:1.8,hit:true,says:l.id+' · '+l.routeM.toFixed(2)+' m physical intermodule route',connected:l.connected});
    add('mate',l.id+'-mate',[[ (l.drawing[0][0]+l.drawing.at(-1)[0])/2,l.drawing[1][1] ]],{along:[1,0],mated:true});
  }
  for(const h of model.homes)add('cable','home-'+h.id,h.drawing,{plus:h.sign==='+',stringId:h.stringId,weight:2.5,hit:true,says:h.id+' → '+h.portId+' · '+h.routeM.toFixed(2)+' m estimated physical route',connected:true});
  for(const p of model.ports){
    add('plug',p.id,[p.drawing],{male:p.sign==='+',plus:p.sign==='+',along:[1,0],pot:p.sign==='+'?1:0});
    label(p.stringId+' '+p.sign,p.drawing[0]-6.6,p.drawing[1],10,p.sign==='+'?'#ff9385':'#bed5e8');
  }
  for(const mppt of model.mppts){const p=model.ports.find(p=>p.mppt===mppt.id);label('MPPT '+String(mppt.id).padStart(2,'0'),b.x+1,p.drawing[1]+1.45,10,'#81dbe2');}
  for(const s of model.strings){
    const lengths=model.homes.filter(h=>h.stringId===s.id),lengthLabel=['+','-'].map(sign=>{const h=lengths.find(h=>h.sign===sign);return h?sign+' '+h.suppliedLengthM.toFixed(1)+'m'+(enteredLengths.has(h.id)?' E':''):'';}).join(' / ');
    label(s.id+(s.connected?'  MPPT '+String(s.mppt).padStart(2,'0')+'-'+s.input+'  |  '+lengthLabel:'  /  TO OTHER INVERTER — OFF DRAWING'),s.column===1?0:(s.column-1)*30*(model.width+model.gap),s.drawY-.65,10,s.connected?'#9fd4dc':'#eabc74');
    for(const [sign,p] of [['-',s.minus],['+',s.plus]]){
      add('terminal',s.id+sign,[p],{dot:.0015,pot:sign==='+'?1:0});
      if(!s.connected){add('cable',s.id+'-offsheet'+sign,[p,[p[0],p[1]+1.9]],{plus:sign==='+',weight:2});label('↓ '+sign,p[0]-.2,p[1]+(sign==='+'?2.85:2.35),9,'#eabc74');}
    }
  }
  label('EAST FACE  /  15 STRINGS  /  FIVE PORTRAIT ROWS',0,-3.3,14,'#9cdce8');
  label('WEST FACE  /  15 STRINGS  /  FIVE PORTRAIT ROWS',0,model.layout.westY-3.3,14,'#9cdce8');
  label('30 × 660 Wp = 19.8 kWp / STRING  |  LENGTHS: ROUTE + '+tolerance+'% ALLOWANCE; E = ENTERED',0,-5.3,11);
  label('48 SEPARATE DC CABLES',-29,-5.3,10);
  label(model.drawingOffset+' m DRAWING SEPARATION',-29,(b.height+1),10,'#8193a8');
  label('NOT TO SCALE',model.arrayWidth-32,(b.height+1),19,'#b9b6ab');
  label('OVERSIZED CONDUCTORS / ILLUSTRATIVE ELECTRON FLOW',0,(b.height+1),10,'#8193a8');
  add('cable','AC-export',[[b.x,b.height-6],[b.x-8,b.height-6]],{plus:false,weight:3});
  label('AC EXPORT → 352 kVA AT 30°C',b.x-5,b.height-2,10);
  const g={c:{sheet:0,view:'macro'},N:900,pitch:model.width+.02,pair:0,short:[],links:[],rows:10,cols:90,rowY:[],order:[],bothNear:true,ret:0,row:model.arrayWidth,lead_m:0,field_m:0,ohm:0};
  drawing={kind:'string',opened:true,shapes,marks,words:[],conns:[],terminals:[],wiring:true,crossings:[],perM:.01,open:true,g,
    freeCamera:true,firstModuleX:0,volts:0,volts_open:0,earth_node:'earth',bounds:{x0:-.6,y0:-.75,x1:1.25,y1:.09},near:{x:0,y:0},mPerUnit:100,amps:0,front:-1,head:-1,walk:null,t0:0,inverter48:true};
  g.__draw=drawing;
  nativeWalks=nativeAdapter?.build(model)||[];
  return {numbers:{modules:900,strings:30,connected:24,ports:48,mppts:12},said:'Thirty east-west strings, 24 connected here, six to another inverter off drawing, 48 separate conductors; NOT TO SCALE.',how:'Source dimensions; generic physical route estimates; illustrative electron animation.',block:g};
}
function fit(bounds){
  if(!ready)return;
  const w=win(),points=bounds||drawing.shapes.filter(s=>['module','inverter','cable'].includes(s.role)).flatMap(s=>s.pts),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x0=Math.min(...xs)-.04,x1=Math.max(...xs)+.04,y0=Math.min(...ys)-.07,y1=Math.max(...ys)+.08;
  const R=w.eval('Math.sqrt(SPACE)*BODY_RADIUS_MAX'),z=Math.min((w.innerWidth-60)/((x1-x0)*R),(w.innerHeight-60)/((y1-y0)*R));
  w.eval('atHome=false;if(body&&body.sld)bodyJump(0);bodyAnim=null;tween=null;cx='+((x0+x1)/2*R)+';cy='+((y0+y1)/2*R)+';zoom='+z+';dirty=true;');
}
function paint(){
  if(!ready||!drawing)return;
  const w=win(),canvas=w.document.getElementById('sldshapes');if(!canvas)return;
  if(w.eval('!!bodyAnim')){w.eval('bodyAnim=null');w.drawSldShapes();}
  const ctx=canvas.getContext('2d'),dpr=Math.max(1,Math.min(3,w.devicePixelRatio||1));ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const path=pts=>{ctx.beginPath();pts.map(w.shapePoint).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));};
  // Every home cable is always visible. Selection emphasizes, never hides others.
  for(const h of model.homes){const pts=h.drawing.map(map);path(pts);ctx.lineWidth=selected===h.stringId?5:3;ctx.strokeStyle='#05080d';ctx.stroke();path(pts);ctx.lineWidth=selected===h.stringId?2.8:1.7;ctx.strokeStyle=h.sign==='+'?'#ff6255':'#b9cbdf';ctx.stroke();}
  for(const walk of nativeWalks){const r=electricalReport?.strings.find(s=>s.id===walk.stringId);walk.operatingCurrentA=r?.currentA??null;walk.invalidOperatingPoint=r?.invalidOperatingPoint??false;}

  nativeAdapter?.drawConnectors(ctx,model);
  for(const h of model.homes.filter(h=>h.shortM>0)){path(h.drawing.map(map));ctx.strokeStyle='#ffb066';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);}
  // Pencil-like architectural annotation remains readable regardless of zoom.
  ctx.font='18px "Courier New", monospace';ctx.textAlign='right';ctx.lineWidth=.55;ctx.strokeStyle='#b9b6ab';ctx.strokeText('NOT TO SCALE',w.innerWidth-24,48);
  ctx.restore();
}
function summary(){
  $('dimensions').textContent='Each physical face: '+model.arrayWidth.toFixed(3)+' m × '+model.faceDepth.toFixed(3)+' m on the slope; 20 mm module gaps; opposed '+model.tilt+'° faces. Drawing rows are spread apart for legibility.';
  $('lengths').textContent='48 home-cable route estimates: '+model.totals.homeRouteM.toFixed(1)+' m total. Per-cable values are in the CSV; changing drawing separation does not change these lengths.';
}
function save(name,type,body){const u=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
function csv(){return 'string,orientation,MPPT,input,polarity,inverter_connector,estimated_physical_route_m,supplied_length_m,allowance_m,shortfall_m\n'+model.homes.map(h=>[h.stringId,model.strings.find(s=>s.id===h.stringId).side,h.mppt,h.input,h.sign,h.portId,h.routeM.toFixed(3),h.suppliedLengthM.toFixed(3),h.allowanceM.toFixed(3),h.shortM.toFixed(3)].join(',')).join('\n');}
function svg(){
  const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const b=model.inverterDrawing,x0=b.x-10,y0=-9,scale=25,W=(model.arrayWidth-x0+5)*scale,H=(b.height+18)*scale;
  const p=q=>[(q[0]-x0)*scale,(q[1]-y0)*scale],poly=pts=>pts.map(q=>p(q).join(',')).join(' ');
  let text='<svg xmlns="http://www.w3.org/2000/svg" width="'+Math.ceil(W)+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><rect width="100%" height="100%" fill="#090c13"/><g fill="none" stroke-linejoin="round">';
  for(const m of model.modules)text+='<polyline points="'+poly(m.drawing)+'" stroke="#506477" stroke-width=".8"/>';
  text+='<polyline points="'+poly(polygon(b.x,b.y,b.width,b.height))+'" fill="#111b26" stroke="#b5cedd"/>';
  for(const l of model.links)for(let k=0;k<2;k++)text+='<polyline points="'+poly(win().polySlice(l.drawing,k/2,(k+1)/2))+'" stroke="'+(k===0?'#ff6255':'#bed5e8')+'" stroke-width="1.6"/>';
  for(const s of model.strings.filter(s=>!s.connected))for(const [sign,q]of [['-',s.minus],['+',s.plus]])text+='<polyline points="'+poly([q,[q[0],q[1]+1.9]])+'" stroke="'+(sign==='+'?'#ff6255':'#bed5e8')+'" stroke-width="2.7"/>';
  text+='<polyline points="'+poly([[b.x,b.height-6],[b.x-8,b.height-6]])+'" stroke="#c0d1df" stroke-width="3"/>';
  for(const h of model.homes)text+='<polyline data-cable="'+h.id+'" points="'+poly(h.drawing)+'" stroke="#05080d" stroke-width="6"/><polyline points="'+poly(h.drawing)+'" stroke="'+(h.sign==='+'?'#ff6255':'#bed5e8')+'" stroke-width="2.7"/>';
  text+=nativeAdapter?.svgConnectors(model,p)||'';
  text+='</g><g font-family="monospace" fill="#c0d1df">';
  for(const m of drawing.marks){if(m.minPx>0)continue;const q=p([m.x*100,-m.y*100]);text+='<text x="'+q[0]+'" y="'+q[1]+'" font-size="'+Math.max(16,m.size*1.4)+'" fill="'+m.colour+'">'+esc(m.text)+'</text>';}
  text+='<text x="35" y="35" font-size="24" fill="none" stroke="#b9b6ab" stroke-width=".65">NOT TO SCALE</text><text x="35" y="'+(H-28)+'" font-size="18">475.2 kWp connected DC / 594 kWp installed / 48 home cables / 12 MPPTs / six strings to other inverter, off drawing. Static export.</text></g></svg>';
  return text;
}
for(const s of model.strings)$('string').add(new Option(s.id+' · '+s.side+(s.connected?' · MPPT '+s.mppt:' · OTHER INVERTER'),s.id));
for(const s of model.strings.filter(s=>s.connected))$('length-string').add(new Option(s.id+' · '+s.side+' · MPPT '+s.mppt,s.id));
$('menu').onclick=()=>{const panel=document.querySelector('.toolbar');panel.hidden=!panel.hidden;$('menu').setAttribute('aria-expanded',String(!panel.hidden));};
function showHud(show){$('analysis-hud').hidden=!show;$('hud-toggle').setAttribute('aria-expanded',String(show));}
$('hud-toggle').onclick=()=>showHud($('analysis-hud').hidden);$('hud-close').onclick=()=>showHud(false);
$('basis').onclick=()=>{document.querySelector('.bottom').hidden=!document.querySelector('.bottom').hidden;};$('basis-close').onclick=()=>{document.querySelector('.bottom').hidden=true;};
function supplied(h){return enteredLengths.get(h.id)??h.routeM*(1+tolerance/100);}
function applyLengths(){for(const h of model.homes){h.originalDrawing??=structuredClone(h.drawing);h.drawing=structuredClone(h.originalDrawing);h.suppliedLengthM=supplied(h);h.allowanceM=Math.max(0,h.suppliedLengthM-h.routeM);h.shortM=Math.max(0,h.routeM-h.suppliedLengthM);
    // A small unfolded allowance loop is schematic; it is never used for physical length.
    if(h.allowanceM>0){const lane=h.drawing[1][1],right=h.drawing[1][0],left=h.drawing[2][0],w=Math.min((right-left)*.2,.25+h.allowanceM*.08),x=right-.3,depth=Math.min(.22,.06+h.allowanceM*.005);h.drawing.splice(2,0,[x,lane],[x,lane+depth],[x-w,lane+depth],[x-w,lane]);}
  }}
function lengthControls(){const id=$('length-string').value,hs=model.homes.filter(h=>h.stringId===id);for(const sign of ['+','-']){const h=hs.find(h=>h.sign===sign);$('length-'+(sign==='+'?'plus':'minus')).value=supplied(h).toFixed(3);} $('length-readout').textContent=hs.map(h=>h.sign+' route '+h.routeM.toFixed(2)+' m / entered '+supplied(h).toFixed(2)+' m'+(supplied(h)<h.routeM?' / SHORT '+(h.routeM-supplied(h)).toFixed(2)+' m':' / allowance '+(supplied(h)-h.routeM).toFixed(2)+' m')).join('\n');}
function lengthsChanged(){applyLengths();lengthControls();render();electrical?.refresh();}
$('string').onchange=()=>{selected=$('string').value;};
$('length-string').onchange=()=>{selected=$('length-string').value;lengthControls();};
for(const [field,sign]of [['length-plus','+'],['length-minus','-']])$(field).onchange=()=>{const v=Number($(field).value);if(!Number.isFinite(v)||v<0||v>10000){$('error').textContent='Cable length must be 0–10,000 m.';return;}enteredLengths.set($('length-string').value+sign,v);$('error').textContent='';lengthsChanged();};
$('tolerance').onchange=()=>{const v=Number($('tolerance').value);if(!Number.isFinite(v)||v<0||v>50){$('error').textContent='Allowance must be 0–50%.';return;}tolerance=v;$('error').textContent='';lengthsChanged();};
$('length-reset').onclick=()=>{for(const sign of ['+','-'])enteredLengths.delete($('length-string').value+sign);lengthsChanged();};
$('module-source').href=sources.module;$('inverter-source').href=sources.inverter;
$('flow').onclick=()=>{playing=!playing;$('flow').textContent=playing?'Pause flow':'Animate flow';$('flow').setAttribute('aria-pressed',String(playing));};
$('overview').onclick=()=>{$('viewport').classList.remove('desk');setTimeout(()=>fit(),80);};
$('desk').onclick=()=>{$('viewport').classList.add('desk');setTimeout(()=>fit(),80);};
$('ports').onclick=()=>{$('viewport').classList.remove('desk');setTimeout(()=>fit(drawing.shapes.filter(s=>s.role==='inverter'||model.ports.some(p=>p.id===s.node)).flatMap(s=>s.pts)),80);};
$('focus').onclick=()=>{selected=$('string').value;const s=model.strings.find(s=>s.id===selected),hs=model.homes.filter(h=>h.stringId===selected);$('selection').textContent=s.id+' / '+s.side+' / '+(s.connected?'MPPT '+s.mppt+' input '+s.input+' / '+hs.map(h=>h.sign+' '+h.routeM.toFixed(2)+' m').join(' · '):'TO OTHER INVERTER — OFF DRAWING. Excluded from this inverter’s 475.2 kWp.');$('viewport').classList.remove('desk');setTimeout(()=>fit(drawing.shapes.filter(x=>x.stringId===selected||x.node.startsWith(selected+'-')).flatMap(x=>x.pts)),80);};
$('fullscreen').onclick=()=>document.documentElement.requestFullscreen();
$('csv').onclick=()=>save('inverter-48-cable-lengths.csv','text/csv',csv());
$('json').onclick=()=>save('inverter-48-geometry.json','application/json',JSON.stringify(model,null,2));
$('svg').onclick=()=>save('inverter-48-NOT-TO-SCALE.svg','image/svg+xml',svg());
$('rebuild').onclick=()=>{try{const next=build({physicalOffset:Number($('physical-offset').value),drawingOffset:Number($('drawing-offset').value)});model=next;applyLengths();summary();lengthControls();electrical?.refresh();$('error').textContent='';render();}catch(e){$('error').textContent=e.message;}};
function render(){if(!ready)return;win().fireCommand('fire inverter-48 {}',null);setTimeout(()=>fit(),220);}
applyLengths();summary();lengthControls();electrical=mountElectrical($('electrical-hud'),{getModel:()=>model,getCableLength:supplied,onChange:report=>{electricalReport=report;}});
const activeWalks=()=>nativeWalks.filter(w=>(flowScope==='all'||w.stringId===selected)&&!w.open&&w.operatingCurrentA!==0&&!w.invalidOperatingPoint);
window.__inverter48={get model(){return structuredClone(model);},get ready(){return ready;},get playing(){return playing;},get selected(){return selected;},get flowScope(){return flowScope;},get flowStats(){return {...flowStats};},get flowFrames(){return flowFrames;},get pulseCount(){return playing?activeWalks().length*3:0;},selectString(id){if(!model.strings.some(s=>s.id===id))return;selected=id;},get animatedHomeCount(){return playing?activeWalks().length*2:0;},get animatedSeriesCount(){return playing?activeWalks().length*29:0;},get nativeWalks(){return nativeWalks.map(w=>({stringId:w.stringId,open:w.open,legs:w.legs.length,currentA:w.operatingCurrentA}));},electrical,csv,svg,build,fit};
let tries=0;
const poll=setInterval(async()=>{try{
  const w=win();if(++tries>300)throw Error('Native renderer did not become ready.');
  if(!w.FIRE||!w.fireCommand||!w.eval('typeof N!=="undefined"&&N>0&&typeof lastFire!=="undefined"&&!!lastFire'))return;
  clearInterval(poll);nativeAdapter=await createNativeAdapter(w);ready=true;
  const style=w.document.createElement('style');style.textContent='#anonymous-project-tools,#manufacturer-tools,#connector-lens,#local-drawing-tools,#series-tools,#foot,#presets,#top,#hud,#say,#card,#kdev{display:none!important}#c{opacity:0}#sldshapes{background:#090c13}';w.document.head.append(style);
  const clamp=w.stringClampMicro;w.stringClampMicro=function(){if(w.eval('sldShapes&&sldShapes.inverter48'))return;return clamp.apply(this,arguments);};
  w.FIRE.register('inverter-48','48 CABLES / ONE INVERTER',nativeDrawing,[]);w.FIRE_SLD_KIND['inverter-48']='string';w.__wafer.onDraw.add(paint);
  let pointerStart=null;
  w.document.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};},true);
  w.document.addEventListener('pointerup',e=>{
    if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5||e.target.tagName!=='CANVAS'){pointerStart=null;return;}
    pointerStart=null;let nearest=null,limit=8;
    for(const h of model.homes){const pts=h.drawing.map(map).map(w.shapePoint);for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],sq=dx*dx+dy*dy,t=sq?Math.max(0,Math.min(1,((e.clientX-a[0])*dx+(e.clientY-a[1])*dy)/sq)):0,d=Math.hypot(e.clientX-a[0]-t*dx,e.clientY-a[1]-t*dy);if(d<limit){limit=d;nearest=h;}}}
    if(nearest){selected=nearest.stringId;$('length-string').value=selected;lengthControls();showHud(true);$('length-editor').open=true;$('length-'+(nearest.sign==='+'?'plus':'minus')).focus();$('selection').textContent=nearest.id+' → '+nearest.portId+' | route '+nearest.routeM.toFixed(2)+' m | entered/estimated '+nearest.suppliedLengthM.toFixed(2)+' m';}
  },true);
  $('loading').hidden=true;$('loading').style.display='none';render();
}catch(e){clearInterval(poll);$('error').textContent=e.message;$('loading').textContent=e.message;}},100);
function drawFlowOverlay(){
  if(!ready)return;
  const w=win();
  for(const walk of nativeWalks){const r=electricalReport?.strings.find(s=>s.id===walk.stringId);walk.operatingCurrentA=r?.currentA??null;walk.invalidOperatingPoint=r?.invalidOperatingPoint??false;}
  if(!flowCanvas){flowCanvas=w.document.createElement('canvas');flowCanvas.id='inverter-flow';flowCanvas.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:10';w.document.body.append(flowCanvas);}
  const dpr=Math.min(2,w.devicePixelRatio||1),width=w.innerWidth,height=w.innerHeight;
  if(flowCanvas.width!==Math.round(width*dpr)||flowCanvas.height!==Math.round(height*dpr)){flowCanvas.width=Math.round(width*dpr);flowCanvas.height=Math.round(height*dpr);flowCanvas.style.width=width+'px';flowCanvas.style.height=height+'px';}
  const ctx=flowCanvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  flowStats={strings:0,homePaths:0};if(playing&&!document.hidden){flowStats=nativeAdapter?.drawFlow(ctx,activeWalks(),clock,{selected})??{strings:0,homePaths:0};flowFrames++;}
}
let previousFrame=0;
function tick(now){const dt=Math.min(.1,(now-last)/1000);last=now;if(playing&&!document.hidden)clock+=dt;if(now-previousFrame>=50){previousFrame=now;drawFlowOverlay();}requestAnimationFrame(tick);}requestAnimationFrame(tick);

$('flow-scope').onclick=()=>{flowScope=flowScope==='all'?'selected':'all';$('flow-scope').textContent=flowScope==='all'?'All 24 strings':'Selected string';$('flow-scope').setAttribute('aria-pressed',String(flowScope==='all'));$('selection').textContent=flowScope==='all'?'24 connected strings / 48 DC cables. Open or invalid circuits do not animate.':'Following the selected string; all wiring remains visible.';};
