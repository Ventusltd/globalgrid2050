/* Local synthetic hierarchy. Arithmetic instance addressing; no electrical solver or surveyed placement. */
'use strict';
(function boot(){
  const frame=document.getElementById('kuiper-frame'),lab=window.__arrayLab,win=frame?.contentWindow;
  if(!lab?.engineReady||!win?.FIRE){setTimeout(boot,200);return;}
  const MAX_GLYPHS=400,STRINGS_PER_BLOCK=32,MIN_WAIT=650;
  const panel=document.createElement('details');panel.id='site-scale';panel.style.cssText='padding:10px 17px;border-bottom:1px solid #35475a;background:#0c1825';
  panel.innerHTML='<summary>Generic 500 MWp farm · explore any component</summary><div class="actions" style="margin-top:10px"><label>Size · DC MWp <input id="scale-mw" type="number" min="0.001" max="1000000" step="1" value="500" style="width:95px"></label><label>Assumed module Wp <input id="scale-wp" type="number" min="100" max="2000" value="660" style="width:80px"></label><label>Modules / string <select id="scale-series" style="width:70px"><option>24</option><option selected>30</option><option>36</option><option>60</option></select></label><button id="scale-build">Open generic farm</button><button id="scale-up">Up one level</button><button id="scale-home">Site overview</button></div><div class="actions" style="margin-top:9px"><input id="scale-command" aria-label="Synthetic site command" value="inspect B0001/S001/M030/C+" style="min-width:290px;flex:1"><button id="scale-go">Go</button><select id="scale-items" aria-label="Visible hierarchy items" style="max-width:260px"></select><button id="scale-open">Open selected</button></div><p id="scale-status" class="note" role="status"></p><p class="note">Synthetic positions and assumed Wp. No voltage/current or electrical suitability is solved. IDs: B0001/S001/M030, with optional /JB+, /JB−, /C+ or /C−. Only the current hierarchy level is generated; wheel inward over an item to descend, or enter an exact ID. Full strings round modeled MW up slightly.</p>';
  document.querySelector('main').prepend(panel);
  const farmButton=document.createElement('button');farmButton.id='open-500mw-farm';farmButton.textContent='Explore 500 MWp farm';farmButton.style.cssText='margin:8px 17px';panel.before(farmButton);farmButton.onclick=()=>attempt(()=>{panel.open=true;generate(500);});
  const scopeStyle=document.createElement('style');scopeStyle.textContent='body.synthetic-scale-active main>.summary,body.synthetic-scale-active main>.detail,body.synthetic-scale-active main>.legend{display:none}';document.head.append(scopeStyle);
  const $=id=>panel.querySelector('#'+id);
  const persistence=document.createElement('div');persistence.innerHTML='<div class="actions"><button id="scale-export">Download project</button><button id="scale-import">Import project</button><input id="scale-project-file" type="file" accept=".json,application/json" hidden></div><p id="scale-save-state" class="note">Sparse synthetic edits save in this browser, by site/block/string. Up to 128 edited strings / 4 MB per scenario. Each string is an independent instance; edits do not propagate to copies. Undo is limited to the current visit; saved placements and wiring survive reload. Import replaces the matching synthetic scenario. Project data stays in this browser.</p>';panel.append(persistence);
  let spec=null,level={kind:'site'},items=[],context=null,savedRecipe=lab.recipe(),active=false,viewToken=0,wheelTimer=0,lastTransition=0,peakShapes=0;
  const STORE_PREFIX='kuiper.public.synthetic-project/1:',MAX_EDITED_STRINGS=128,MAX_PROJECT_BYTES=4*1024*1024;
  let project=null,loadingDetail=false,saveError=null;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const stringKey=a=>bid(a.block)+'/'+sid(a.string);
  function cleanRecipe(r){const clean=copy(r);delete clean.syntheticContext;return clean;}
  function storageKey(id){return STORE_PREFIX+id;}
  function projectState(message){$('scale-save-state').textContent=message||((saveError?'Not saved: '+saveError:'Saved in this browser')+' · '+Object.keys(project?.edits||{}).length+'/'+MAX_EDITED_STRINGS+' independently edited strings · scenario '+(project?.site.id||'none')+'. Undo is limited to this visit. Download a project backup. Project data stays in this browser.');}
  function validateProject(value){
    if(!value||value.schema!=='kuiper.synthetic-project/1'||value.namespace!=='synthetic')throw Error('Expected kuiper.synthetic-project/1 in the synthetic namespace.');
    const s=value.site,canonical=makeSpec(s?.requestedMW,s?.moduleWp,s?.series);if(s.id!==canonical.id||s.moduleCount!==canonical.moduleCount||s.stringCount!==canonical.stringCount||s.blockCount!==canonical.blockCount)throw Error('Project site counts or identity are inconsistent.');
    if(!value.edits||typeof value.edits!=='object'||Array.isArray(value.edits))throw Error('Project edits must be keyed by global block/string ID.');
    if(Object.keys(value.edits).length>MAX_EDITED_STRINGS)throw Error('Project exceeds '+MAX_EDITED_STRINGS+' edited strings.');
    const base=cleanRecipe(value.baseRecipe);if(base.rows!==1||base.count!==canonical.series)throw Error('Base recipe must describe one indexed string.');lab.build(base);
    const edits={};
    for(const [key,raw] of Object.entries(value.edits)){
      const m=/^B(\d{4,})\/S(\d{3})$/.exec(key);if(!m)throw Error('Invalid global string ID '+key+'.');const b=Number(m[1]),n=Number(m[2]),count=Math.min(STRINGS_PER_BLOCK,canonical.stringCount-(b-1)*STRINGS_PER_BLOCK);
      if(b<1||b>canonical.blockCount||n<1||n>count||key!==bid(b)+'/'+sid(n))throw Error('String outside project: '+key+'.');
      if(raw?.syntheticContext)throw Error('Stored recipes must use local IDs; context comes from the global project key.');
      const r=cleanRecipe(raw);if(r.rows!==1||r.count!==canonical.series)throw Error('Recipe '+key+' changes indexed membership.');lab.build(r);edits[key]=r;
    }
    const result={schema:'kuiper.synthetic-project/1',namespace:'synthetic',site:canonical,baseRecipe:base,edits};if(new Blob([JSON.stringify(result)]).size>MAX_PROJECT_BYTES)throw Error('Project exceeds the 4 MB sparse-edit limit.');return result;
  }
  function persist(){if(!project)return;const raw=JSON.stringify(project);if(new Blob([raw]).size>MAX_PROJECT_BYTES)throw Error('Project exceeds 4 MB. Download and split the study before adding more edits.');localStorage.setItem(storageKey(project.site.id),raw);saveError=null;projectState();}
  function loadProject(next,base){
    const raw=localStorage.getItem(storageKey(next.id));if(raw){if(raw.length>MAX_PROJECT_BYTES)throw Error('Stored project exceeds size limit.');project=validateProject(JSON.parse(raw));}
    else project={schema:'kuiper.synthetic-project/1',namespace:'synthetic',site:copy(next),baseRecipe:cleanRecipe(base),edits:{}};
    saveError=null;projectState();
  }
  function saveCurrent(r){
    if(loadingDetail||!project||!r.syntheticContext||r.syntheticContext.siteId!==project.site.id)return;
    const c=r.syntheticContext;if(c.string===null||c.string===undefined)return;const key=stringKey(c),clean=cleanRecipe(r);
    if(clean.rows!==1||clean.count!==project.site.series)throw Error('Cannot save changed indexed membership.');
    const edited=JSON.stringify(clean)!==JSON.stringify(project.baseRecipe);if(edited&&!Object.hasOwn(project.edits,key)&&Object.keys(project.edits).length>=MAX_EDITED_STRINGS)throw Error('This scenario already has 128 edited strings. Download/split the project before editing another.');
    if(edited)project.edits[key]=clean;else delete project.edits[key];persist();
  }
  window.addEventListener('kuiper:recipe-changed',e=>{try{saveCurrent(e.detail.recipe);}catch(err){saveError=err.message;projectState();}});
  const metrics={builds:0,totalBuildMs:0,lastBuildMs:0,peakShapes:0,materializedModules:0,jumps:0,lastJumpMs:0,frameSamples:[]};
  function fail(message){$('scale-status').textContent=message;}
  function number(value,name,min,max){const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(name+' must be between '+min+' and '+max+'.');return n;}
  const bid=n=>'B'+String(n).padStart(4,'0'),sid=n=>'S'+String(n).padStart(3,'0'),mid=n=>'M'+String(n).padStart(3,'0');
  function makeSpec(mw,wp,series){
    mw=number(mw,'Requested MW',.001,1000000);wp=number(wp,'Assumed module Wp',100,2000);series=number(series,'Modules per string',2,60);
    if(!Number.isInteger(series))throw Error('Modules per string must be a whole number.');
    const stringCount=Math.ceil(mw*1e6/(wp*series)),moduleCount=stringCount*series,blockCount=Math.ceil(stringCount/STRINGS_PER_BLOCK);
    if(!Number.isSafeInteger(moduleCount))throw Error('Site count is outside the exact integer range.');
    return {schema:'kuiper.synthetic-site/1',id:'SYN-'+mw+'MW-'+wp+'WP-'+series+'M',requestedMW:mw,moduleWp:wp,series,stringCount,moduleCount,blockCount,stringsPerBlock:STRINGS_PER_BLOCK,modeledMW:moduleCount*wp/1e6,placement:'synthetic-index-grid',electricalState:'unsolved',source:'entered assumptions'};
  }
  function countInBlock(b){return Math.max(0,Math.min(STRINGS_PER_BLOCK,spec.stringCount-(b-1)*STRINGS_PER_BLOCK));}
  function parseAddress(text){
    if(!spec)throw Error('Open a synthetic site first.');
    const clean=String(text).trim().toUpperCase().replaceAll('−','-').replace(/^INSPECT\s+/,'');
    const match=/^B(\d+)(?:\/S(\d+))?(?:\/M(\d+))?(?:\/(JB[+-]|C[+-]))?$/.exec(clean);
    if(!match)throw Error('Use inspect B0001/S001/M030/C+ (component suffix optional).');
    const b=Number(match[1]),s=match[2]?Number(match[2]):null,m=match[3]?Number(match[3]):null,part=match[4]||null;
    if(!Number.isSafeInteger(b)||b<1||b>spec.blockCount)throw Error('Block outside 1…'+spec.blockCount+'.');
    if(s!==null&&(!Number.isInteger(s)||s<1||s>countInBlock(b)))throw Error('String outside this block (1…'+countInBlock(b)+').');
    if(m!==null&&(s===null||!Number.isInteger(m)||m<1||m>spec.series))throw Error('Module outside this string (1…'+spec.series+').');
    if(part&&m===null)throw Error('A component address needs a module.');
    const stringIndex=s===null?null:(b-1)*STRINGS_PER_BLOCK+s-1,moduleIndex=m===null?null:stringIndex*spec.series+m-1;
    return {siteId:spec.id,block:b,string:s,module:m,part,address:bid(b)+(s===null?'':'/'+sid(s))+(m===null?'':'/'+mid(m))+(part?'/'+part:''),stringIndex,moduleIndex};
  }
  function stopTrace(){const b=document.getElementById('trace');if(b?.classList.contains('active'))b.click();}
  function clearOldDrawing(){stopTrace();win.eval('atHome=false');}
  function cells(){
    if(level.kind==='site'){
      const size=Math.max(1,Math.ceil(spec.blockCount/MAX_GLYPHS)),result=[];
      for(let first=1;first<=spec.blockCount;first+=size){const last=Math.min(spec.blockCount,first+size-1),strings=Math.min(spec.stringCount,last*STRINGS_PER_BLOCK)-(first-1)*STRINGS_PER_BLOCK;result.push({key:bid(first)+(last>first?'–'+bid(last):''),kind:last>first?'range':'block',first,last,blocks:last-first+1,strings,modules:strings*spec.series});}
      return result;
    }
    if(level.kind==='range'){const result=[],size=Math.max(1,Math.ceil((level.last-level.first+1)/MAX_GLYPHS));for(let first=level.first;first<=level.last;first+=size){const last=Math.min(level.last,first+size-1),strings=Math.min(spec.stringCount,last*STRINGS_PER_BLOCK)-(first-1)*STRINGS_PER_BLOCK;result.push({key:bid(first)+(last>first?'–'+bid(last):''),kind:last>first?'range':'block',first,last,blocks:last-first+1,strings,modules:strings*spec.series});}return result;}
    if(level.kind==='block')return Array.from({length:countInBlock(level.block)},(_,i)=>({key:bid(level.block)+'/'+sid(i+1),kind:'string',block:level.block,string:i+1,strings:1,modules:spec.series}));
    return [];
  }
  function buildNative(){
    const t0=performance.now();items=cells();
    if(items.length>MAX_GLYPHS)throw Error('Hierarchy level exceeds bounded glyph budget.');
    const cols=Math.max(1,Math.ceil(Math.sqrt(items.length*1.7))),rows=Math.ceil(items.length/cols),w=1,h=.58,gap=.12,spanX=cols*(w+gap)-gap,spanY=rows*(h+gap)-gap,scale=1.72/Math.max(spanX,spanY),shapes=[],marks=[];
    items.forEach((item,i)=>{
      const x=(i%cols)*(w+gap),y=Math.floor(i/cols)*(h+gap),x0=(x-spanX/2)*scale,y0=(spanY/2-y-h)*scale;
      item.rect=[x0,y0,x0+w*scale,y0+h*scale];
      shapes.push({role:'module',node:item.key,order:0,pot:0,pts:[[x0,y0],[x0+w*scale,y0],[x0+w*scale,y0+h*scale],[x0,y0+h*scale],[x0,y0]],fill:'#123849',weight:1});
      marks.push({x:x0+w*scale/2,y:y0+h*scale*.68,text:items.length>64?bid(item.first):item.key,size:items.length>64?8:9,colour:'#b8dfea',minPx:0,mid:true,rank:0});
      if(items.length<=64)marks.push({x:x0+w*scale/2,y:y0+h*scale*.29,text:item.modules.toLocaleString()+' modules',size:9,colour:'#739bb0',minPx:0,mid:true,rank:1});
    });
    const title=level.kind==='site'?'Synthetic site':level.kind==='range'?'Block range '+bid(level.first)+'–'+bid(level.last):'Block '+bid(level.block);
    const words=[{pinned:3,note:true,text:title+' · '+spec.moduleCount.toLocaleString()+' indexed modules · '+spec.stringCount.toLocaleString()+' strings · '+spec.blockCount.toLocaleString()+' blocks',small:title+' · synthetic'},
      {pinned:4,note:true,text:'Requested '+spec.requestedMW.toLocaleString()+' MWp DC · modeled '+spec.modeledMW.toFixed(5)+' MWp DC at assumed '+spec.moduleWp+' Wp · '+items.length+' visible aggregate glyphs',small:items.length+' aggregate glyphs · electrical state unsolved'},
      {pinned:5,note:true,text:'Synthetic index layout; no surveyed positions or solved volts/current. Click an item, zoom inward over it, or enter an exact component ID.',small:'Synthetic placement · no electrical solver'}];
    const g={c:{sheet:0,view:'macro'},N:spec.moduleCount,pitch:1,short:[],links:[],rows,cols,rowY:[],order:[],bothNear:true,ret:0,row:spanX,lead_m:0,field_m:0,ohm:0};
    const D={kind:'string',opened:true,shapes,marks,words,conns:[],terminals:[],wiring:false,crossings:[],perM:scale,open:false,g,firstModuleX:-.86,volts:0,volts_open:0,earth_node:'earth',bounds:{x0:-spanX*scale/2-.025,y0:-spanY*scale/2-.025,x1:spanX*scale/2+.025,y1:spanY*scale/2+.025},near:{x:0,y:0},mPerUnit:1/scale,amps:0,front:-1,head:-1,walk:null,t0:0,siteScale:{siteId:spec.id,kind:level.kind,itemCount:items.length}};
    g.__draw=D;metrics.builds++;metrics.lastBuildMs=performance.now()-t0;metrics.totalBuildMs+=metrics.lastBuildMs;peakShapes=Math.max(peakShapes,shapes.length);metrics.peakShapes=peakShapes;metrics.materializedModules=0;
    return {numbers:{indexed_modules:spec.moduleCount,indexed_strings:spec.stringCount,indexed_blocks:spec.blockCount,visible_aggregate_glyphs:shapes.length,requested_mw:spec.requestedMW,modeled_mw:spec.modeledMW,electrical_state:'unsolved'},said:title+'. Indexed synthetic hierarchy, generated at the visible level only.',how:'Existing Kuiper native shape renderer and camera. Aggregate layout is schematic and nonmetric. Assumed module Wp; no circuit solve.',block:g};
  }
  win.FIRE.register('synthetic-site','SYNTHETIC SCALE',buildNative,[]);win.FIRE_SLD_KIND['synthetic-site']='string';
  function status(){
    if(!spec){fail('Ready to generate an indexed synthetic site from the entered size and module rating.');return;}
    const here=context?context.address:level.kind==='site'?'site overview':level.kind==='range'?bid(level.first)+'–'+bid(level.last):bid(level.block);
    panel.querySelector('summary').textContent='Synthetic '+spec.requestedMW.toLocaleString()+' MWp DC · '+here+' · electrical state unsolved';
    fail(spec.requestedMW.toLocaleString()+' MWp DC requested / '+spec.modeledMW.toFixed(5)+' MWp DC modeled · '+spec.moduleCount.toLocaleString()+' modules indexed, '+spec.stringCount.toLocaleString()+' strings · '+here+' · '+(context?spec.series+' module detail':items.length+' aggregate glyphs')+'. Synthetic placement; electrical state unsolved.');
  }
  function show(newLevel){
    if(!spec)throw Error('Open a synthetic site first.');clearOldDrawing();active=true;context=null;level=newLevel;const token=++viewToken;lastTransition=performance.now();
    win.fireCommand('fire synthetic-site {}',null);
    document.body.classList.add('synthetic-scale-active');document.getElementById('view-status').textContent='Synthetic hierarchy · entered Wp · no circuit solve';
    const select=$('scale-items');select.replaceChildren(...items.map(item=>new Option(item.key,item.key)));
    setTimeout(()=>{if(token!==viewToken||!active)return;win.eval('atHome=false;bodyAnim=null;if(body&&body.sld)bodyJump(0);stringWholeView();dirty=true');},180);
    status();
    window.dispatchEvent(new CustomEvent('kuiper:view-changed',{detail:{kind:'synthetic-site',level:copy(level),siteId:spec.id}}));
  }
  function generate(mw=$('scale-mw').value,wp=$('scale-wp').value,series=$('scale-series').value){
    const next=makeSpec(mw,wp,series);if(!active&&!lab.recipe().syntheticContext)savedRecipe=lab.recipe();const base=cleanRecipe(savedRecipe);base.rows=1;base.count=next.series;base.modulePlacements={};base.routeWaypoints={};base.orders={};if(base.wiring==='custom')base.wiring='sequential';lab.build(base);loadProject(next,base);spec=next;$('scale-mw').value=next.requestedMW;$('scale-wp').value=next.moduleWp;$('scale-series').value=String(next.series);metrics.frameSamples=[];show({kind:'site'});return structuredClone(spec);
  }
  function openItem(item){if(!item)return;if(item.kind==='range')show({kind:'range',first:item.first,last:item.last});else if(item.kind==='block')show({kind:'block',block:item.first});else inspect(item.key);}
  function focusComponent(address){
    const local='S01-M'+String(address.module||1).padStart(2,'0');
    const selectedLink=lab.read().links.findIndex(l=>l.from===local||l.to===local);if(selectedLink>=0){const select=document.getElementById('link-select');select.value=String(selectedLink);select.dispatchEvent(new Event('change'));}
    lab.focusModule(local,{part:address.part,label:address.address});
  }
  function inspect(text){
    const t0=performance.now(),address=parseAddress(text);
    if(address.string===null){show({kind:'block',block:address.block});return address;}
    clearOldDrawing();const r=copy(project.edits[stringKey(address)]||project.baseRecipe);r.schema='kuiper.table/2';
    r.syntheticContext={...address,siteSpec:structuredClone(spec),identityMapping:'local S01-Mnn maps to '+bid(address.block)+'/'+sid(address.string)+'/Mnnn',placement:'synthetic-index-grid',electricalState:'unsolved'};
    active=false;document.body.classList.remove('synthetic-scale-active');context=address;level={kind:'detail',block:address.block,string:address.string};const token=++viewToken;lastTransition=performance.now();loadingDetail=true;try{lab.apply(r);lab.resetHistory();}finally{loadingDetail=false;}lab.setProjection('kuiper');metrics.materializedModules=spec.series;metrics.jumps++;metrics.lastJumpMs=performance.now()-t0;
    setTimeout(()=>{if(token!==viewToken)return;win.eval('atHome=false;bodyAnim=null;if(body&&body.sld)bodyJump(0);dirty=true');if(address.module!==null)focusComponent(address);},500);
    $('scale-command').value='inspect '+address.address;status();return address;
  }
  function up(){if(!spec)return;if(level.kind==='detail')show({kind:'block',block:level.block});else show({kind:'site'});}
  function command(text){const m=/^site\s+([\d.]+)\s*MWp?$/i.exec(String(text).trim());if(m)return generate(m[1]);return inspect(text);}
  function attempt(f){try{return f();}catch(e){fail(e.message);return null;}}
  $('scale-build').onclick=()=>attempt(()=>generate());$('scale-home').onclick=()=>attempt(()=>show({kind:'site'}));$('scale-up').onclick=()=>attempt(up);$('scale-go').onclick=()=>attempt(()=>command($('scale-command').value));$('scale-command').onkeydown=e=>{if(e.key==='Enter')attempt(()=>command($('scale-command').value));};$('scale-open').onclick=()=>attempt(()=>openItem(items.find(i=>i.key===$('scale-items').value)));
  function exportProject(){if(!project)throw Error('Open a synthetic site first.');return copy(project);}
  function importProject(value){const next=validateProject(copy(value)),raw=JSON.stringify(next);localStorage.setItem(storageKey(next.site.id),raw);project=next;spec=copy(next.site);savedRecipe=copy(next.baseRecipe);saveError=null;$('scale-mw').value=spec.requestedMW;$('scale-wp').value=spec.moduleWp;$('scale-series').value=String(spec.series);projectState();show({kind:'site'});return{siteId:spec.id,editedStrings:Object.keys(project.edits).length};}
  $('scale-export').onclick=()=>attempt(()=>{const blob=new Blob([JSON.stringify(exportProject(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=spec.id+'-synthetic-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('scale-import').onclick=()=>$('scale-project-file').click();$('scale-project-file').onchange=async()=>{try{const f=$('scale-project-file').files[0];if(!f)return;if(f.size>MAX_PROJECT_BYTES)throw Error('Project file exceeds 4 MB.');importProject(JSON.parse(await f.text()));}catch(err){fail(err.message);}finally{$('scale-project-file').value='';}};
  function activeDrawing(){return active&&win.eval('sldShapes&&sldShapes.siteScale')?.siteId===spec?.id;}
  function hit(x,y){return items.find(item=>{const a=win.shapePoint([item.rect[0],item.rect[1]]),b=win.shapePoint([item.rect[2],item.rect[3]]);return x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]);});}
  let down=null;
  win.document.addEventListener('pointerdown',e=>{if(activeDrawing()&&e.target.tagName==='CANVAS')down=[e.clientX,e.clientY];},true);
  win.document.addEventListener('pointerup',e=>{if(!down)return;const moved=Math.hypot(e.clientX-down[0],e.clientY-down[1]);down=null;if(moved>5||!activeDrawing())return;const item=hit(e.clientX,e.clientY);if(item)attempt(()=>openItem(item));},true);
  win.document.addEventListener('wheel',e=>{
    if(!activeDrawing()||performance.now()-lastTransition<MIN_WAIT)return;clearTimeout(wheelTimer);const x=e.clientX,y=e.clientY,d=e.deltaY;
    wheelTimer=setTimeout(()=>{if(!activeDrawing())return;const item=hit(x,y);if(d<0&&item){const a=win.shapePoint([item.rect[0],item.rect[1]]),b=win.shapePoint([item.rect[2],item.rect[3]]);if(Math.abs(b[0]-a[0])>180)attempt(()=>openItem(item));}else if(d>0&&level.kind!=='site'){const D=win.eval('sldShapes'),width=(D.bounds.x1-D.bounds.x0)*win.shapeScale();if(width<win.innerWidth*.45)attempt(up);}},260);
  },{capture:true,passive:true});
  let lastFrame=0;
  win.__wafer?.onDraw?.add(()=>{if(!activeDrawing()){document.body.classList.remove('synthetic-scale-active');return;}const now=performance.now();if(lastFrame&&metrics.frameSamples.length<300)metrics.frameSamples.push(now-lastFrame);lastFrame=now;if(win.eval('!!bodyAnim || (body&&body.sld&&!body.shown)')){win.eval('bodyAnim=null;if(body&&body.sld)bodyJump(0);dirty=true');win.drawSldShapes();}});
  win.__wafer?.onDraw?.add(()=>{if(!activeDrawing())return;const c=win.document.getElementById('sldshapes'),ctx=c.getContext('2d'),dpr=Math.min(3,win.devicePixelRatio||1);ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillStyle='#99d4e1';for(const item of items){const a=win.shapePoint(item.rect.slice(0,2)),b=win.shapePoint(item.rect.slice(2,4)),width=Math.abs(b[0]-a[0]),x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;if(width<38||x<0||x>win.innerWidth||y<0||y>win.innerHeight)continue;ctx.fillText(width>110?item.key:item.kind==='string'?sid(item.string):bid(item.first),x,y+3);}ctx.restore();});
  window.__siteScale={generate,inspect,command,up,show,parseAddress,exportProject,importProject,read:()=>({spec:spec&&structuredClone(spec),level:structuredClone(level),context:context&&structuredClone(context),visibleItems:items.map(({key,kind,first,last,block,string,modules})=>({key,kind,first,last,block,string,modules})),active,metrics:structuredClone(metrics),maxGlyphs:MAX_GLYPHS,persistence:{editedStrings:Object.keys(project?.edits||{}),limit:MAX_EDITED_STRINGS,saveError}}),addressForModule:index=>{if(!spec||!Number.isInteger(index)||index<0||index>=spec.moduleCount)throw Error('Module index outside site.');const stringIndex=Math.floor(index/spec.series),b=Math.floor(stringIndex/STRINGS_PER_BLOCK)+1,s=stringIndex%STRINGS_PER_BLOCK+1,m=index%spec.series+1;return bid(b)+'/'+sid(s)+'/'+mid(m);}};
  status();
})();
