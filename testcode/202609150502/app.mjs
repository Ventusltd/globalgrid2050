import {makeCore,readState,queryFor,projectURL,seriesLight,PAL} from './model.mjs';
import {createGL} from '../202609142225/gl.js';
import ring from './ring.mjs';
import table from './table.mjs';
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString('en-GB',{maximumFractionDigits:3});
const lenses=new Map([[ring.id,ring],[table.id,table]]);
let core,state,G,view,pos,pack,today,provenance,missingOnly=false,limit=40,contextLost=false;
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
async function loadJSON(path,proof){
  const r=await fetch(path);if(!r.ok)throw new Error(`${path}: HTTP ${r.status}`);
  const bytes=await r.arrayBuffer();
  if(proof&&(bytes.byteLength!==proof.bytes||await digest(bytes)!==proof.sha256))throw new Error(`${path}: snapshot hash mismatch`);
  return JSON.parse(new TextDecoder().decode(bytes));
}
function visible(){
  const q=$('search').value.trim().toLowerCase(),status=$('status').value;
  return core.rec.flatMap((p,i)=>(!q||p.repd_ref===q||p.name.toLowerCase().includes(q))&&(!status||p.status===status)&&(!missingOnly||p.latitude===null)?[i]:[]);
}
function navigate(i){state.key=core.keyStr[i];state.focus=i;state.notes=[];history.pushState(null,'',queryFor(state));update();}
function renderDetail(){
  $('selected').textContent=core.label(state.focus);$('detail').replaceChildren();
  if(state.focus<0){$('detail').textContent=state.key?'This key is not in the published snapshot.':'Use the search, table or ring to inspect a permanent REPD key.';return;}
  const p=core.rec[state.focus],dl=document.createElement('dl');
  for(const [label,value] of [['Status',p.status],['Recorded capacity',p.capacity_mw===null?'Not recorded':`${fmt(p.capacity_mw)} MW`],['Region',p.region||'Not recorded'],['Coordinates',p.latitude===null?'Missing — no geographic position assigned':`${p.latitude}, ${p.longitude}`],['Permanent key',`REPD ${p.repd_ref}`]]){
    const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);
  }
  const a=document.createElement('a');a.href=projectURL(p.repd_ref);a.textContent='uses · Pipeline News project';a.style.display='inline-flex';a.style.minHeight='44px';a.style.alignItems='center';
  $('detail').append(dl,a);
}
function drawLight(){
  const canvas=$('light'),ctx=canvas.getContext('2d'),{w,h,dpr}=view;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  const light=seriesLight(today.pv_live.series),r=Math.max(1,Math.min(w,h)/2-8);
  for(let i=0;i<light.length;i++){
    ctx.beginPath();ctx.strokeStyle=PAL.accent;ctx.globalAlpha=.15+.85*light[i];ctx.lineWidth=4;
    ctx.arc(w/2,h/2,r,-Math.PI/2+2*Math.PI*i/light.length,-Math.PI/2+2*Math.PI*(i+.88)/light.length);ctx.stroke();
  }
}
function drawFallback(){
  const canvas=$('canvas'),c=G.ctx2d;canvas.width=Math.round(view.w*view.dpr);canvas.height=Math.round(view.h*view.dpr);
  c.setTransform(view.dpr,0,0,view.dpr,0,0);c.fillStyle=PAL.body;c.fillRect(0,0,view.w,view.h);
  for(let i=0;i<core.N;i++){
    const light=i===state.focus?1:.35;const size=Math.min(14,Math.max(2,3.2+.35*Math.sqrt(core.mass[i])))*(i===state.focus?1.5:1);
    c.globalAlpha=.18+.82*light;c.fillStyle=core.colour(i);c.beginPath();c.arc(pos[2*i],pos[2*i+1],size/2,0,Math.PI*2);c.fill();
  }c.globalAlpha=1;
}
function render(){if(state.lens!=='ring'||contextLost)return;if(G.ok){G.mix=1;G.frame();}else drawFallback();}
function update(){
  const L=lenses.get(state.lens),ids=visible();
  for(const id of lenses.keys())$(id).setAttribute('aria-pressed',String(id===state.lens));
  $('notice').textContent=state.notes.join(' ');
  $('stage').hidden=state.lens!=='ring';$('overlay').hidden=state.lens!=='table';
  $('results').textContent=`${fmt(ids.length)} matching projects${missingOnly?' · coordinates missing':''}`;
  $('matches').replaceChildren();
  const showMatches=state.lens==='ring'&&($('search').value||$('status').value||missingOnly);
  if(showMatches)table.overlay(core,{focus:state.focus,visible:ids.slice(0,limit)},$('matches'),{navigate});
  $('more').hidden=ids.length<=limit||(!showMatches&&state.lens!=='table');
  const rect=$('stage').getBoundingClientRect();
  view={w:rect.width||$('overlay').clientWidth,h:rect.height||480,dpr:Math.min(2,devicePixelRatio||1),mobile:innerWidth<=600,
    focus:state.focus,seed:state.seed,visible:ids.slice(0,limit),lit:new Uint8Array(core.N),params:{},recipe:new Uint32Array(),trail:new Uint32Array(),kindsOn:0,cat:-1};
  if(state.focus>=0)view.lit[state.focus]=2;
  pos.fill(NaN);L.layout(core,view,pos);view.pos=pos;
  for(const cls of L.always||[])for(let i=core.range[cls][0];i<core.range[cls][1];i++)if(!Number.isFinite(pos[2*i])||!Number.isFinite(pos[2*i+1]))throw new Error('Lens left a project unanchored');
  if(state.lens==='ring'){
    if(G.ok){G.resize(view.w,view.h,view.dpr);G.setPositions(pos);G.setLit(view.lit);G.mix=1;}
    render();drawLight();
  }else L.overlay(core,view,$('overlay'),{navigate});
  $('hint').textContent=L.hint(core,view);renderDetail();
}
async function boot(){
  provenance=await loadJSON('data/provenance.json');
  for(const name of ['uk-solar.json','today.json']){
    const p=provenance.files?.[name];
    if(!p||!Number.isSafeInteger(p.bytes)||p.bytes<=0||!/^([a-f0-9]{64})$/.test(p.sha256))throw new Error(`Missing or malformed snapshot proof: ${name}`);
  }
  [pack,today]=await Promise.all(['uk-solar.json','today.json'].map(p=>loadJSON(`data/${p}`,provenance.files[p])));
  core=makeCore(pack);state=readState(location.search,today.seed,core);pos=new Float32Array(core.N*2);
  const canvas=$('canvas');G=createGL(canvas,core);
  $('render-mode').textContent=G.ok?'WebGL2 · redraws on interaction; no continuous animation':'GPU not available: drawn without animation';
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;$('render-mode').textContent='Graphics context lost. Table and project details remain available.';});
  canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;G=createGL(canvas,core);update();});
  for(const s of core.statuses){const o=document.createElement('option');o.value=s;o.textContent=s;$('status').append(o);}
  const missing=core.rec.filter(p=>p.latitude===null).length,total=core.rec.reduce((a,p)=>a+(p.capacity_mw??0),0);
  $('counts').textContent=`${fmt(core.N)} public solar projects · ${fmt(core.N-missing)} with coordinates · ${fmt(missing)} coordinates missing · ${fmt(total)} MW across all statuses`;
  $('pv').textContent=`Ring light shows PV Live national generation for ${today.pv_live.data_date||today.pv_live.date}, requested ${today.pv_live.requested_date||today.pv_live.date}. Each arc is one ${today.pv_live.interval_minutes}-minute sample, clockwise from the first timestamp. Opacity = 0.15 + 0.85 × generation / daily peak. This is a visual encoding, not measured irradiance at the projects. ${fmt(today.pv_live.energy_mwh)} MWh reported for the series.`;
  $('source').textContent=`Pinned public snapshot: star-solar-star ${provenance.source_commit.slice(0,12)} · built ${today.built_utc}. Seed and REPD key travel in the URL.`;
  for(const [k,status] of core.statuses.entries()){
    const s=document.createElement('span');s.textContent=`${status} (${core.rec.filter(p=>p.status===status).length})`;s.style.borderLeftColor=core.colour(core.rec.findIndex(p=>p.status===status));$('legend').append(s);
  }
  for(const id of lenses.keys())$(id).addEventListener('click',()=>{state.lens=id;history.pushState(null,'',queryFor(state));update();});
  for(const id of ['search','status'])$(id).addEventListener('input',()=>{limit=40;update();});
  $('missing').addEventListener('click',()=>{missingOnly=true;$('search').value='';$('status').value='';limit=40;update();});
  $('all').addEventListener('click',()=>{missingOnly=false;$('search').value='';$('status').value='';limit=40;update();});
  $('more').addEventListener('click',()=>{limit+=40;update();});
  $('copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);$('notice').textContent='Link copied.';}catch{$('notice').textContent='Copy the address from your browser to keep this seed and selection.';}});
  canvas.addEventListener('click',e=>{
    if(contextLost)return;
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    const candidates=[];for(let i=0;i<core.N;i++){const d=Math.hypot(pos[2*i]-x,pos[2*i+1]-y);if(d<=22)candidates.push([i,d]);}
    candidates.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    if(candidates.length>1&&candidates[1][1]-candidates[0][1]<6){
      $('notice').textContent=`${candidates.length} nearby projects. Choose a permanent key below.`;
      table.overlay(core,{focus:state.focus,visible:candidates.map(c=>c[0])},$('matches'),{navigate});
    }else if(candidates.length)navigate(candidates[0][0]);
  });
  addEventListener('resize',update);addEventListener('popstate',()=>{state=readState(location.search,today.seed,core);update();});
  history.replaceState(null,'',queryFor(state));update();
  window.__solar={core,get state(){return {...state};},get positions(){return Array.from(pos);},get renderer(){return G.ok?G.gl.getParameter(G.gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL||G.gl.RENDERER):'Canvas2D';},render,navigate,ready:true};
}
boot().catch(e=>{$('counts').textContent='Could not load the verified public snapshot.';$('notice').textContent=e.message;window.__solar={ready:false,error:e.message};});
