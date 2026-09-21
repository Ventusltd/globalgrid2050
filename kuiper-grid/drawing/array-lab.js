'use strict';
(async function () {
  const $ = id => document.getElementById(id);
  const error = message => { $('error').textContent = message || ''; };
  const response = await fetch('./generic-models.json');
  if (!response.ok) throw Error('Generic model definitions could not load.');
  const catalogue = await response.json();
  let feed = null;
  const feedPromise = Promise.resolve(null);
  const fields = ['count','rows','width','length','gapX','gapY','tilt','azimuth','height','leadPlus','leadMinus','clip','slack'];
  let model, recipe, selected = 0, selectedString='S01', focusString=true, view = 'developed', rear = true, zoom = 1, pan = [0,0], trace = null, kuiperMode=true, engineReady=false;
  const frame=$('kuiper-frame');
  const undoStack=[],redoStack=[];let replayHistory=false,editMode=false,selectedModule=null,moduleDrag=null,syncToken=0;
  const editBar=document.createElement('div');editBar.className='toolbar';editBar.innerHTML='<button id="edit-placement">Move modules</button><button id="rotate-module" disabled>Rotate selected 90°</button><button id="undo-placement" disabled>Undo</button><button id="redo-placement" disabled>Redo</button><label>Snap m <input id="edit-snap" type="number" min="0" max="10" step="0.05" value="0.1" style="width:65px"></label><span id="edit-status">Move mode uses horizontal plan; electrical IDs and orders stay fixed.</span>';document.querySelector('.stage').before(editBar);
  const homePanel=document.createElement('details');homePanel.innerHTML='<summary>Inverter inputs &amp; home cables</summary><p class="note">One INV-01 enclosure contains separate proposed input pairs. These graphics do not join strings or assign a shared MPPT. Generic entered enclosure: 1.2 × 0.9 × 0.4 m. Underside port locations/pitch are illustrative, not manufacturer coordinates. Developed view unfolds the equipment face; cable routes remain assumptions.</p><label><input id="home-enabled" type="checkbox" checked> Show both proposed home runs</label><br><label><input id="home-inverters" type="checkbox" checked> Show shared inverter enclosure</label><div class="pair"><label class="field">Selected string + home cable · installed m<input id="home-plus" type="number" min="0" max="10000" step="0.1" value="0"></label><label class="field">Selected string − home cable · installed m<input id="home-minus" type="number" min="0" max="10000" step="0.1" value="0"></label></div><button id="fit-inverter">Inspect inverter inputs</button><p id="home-info" class="note"></p><p class="note">JSON: inverterInputs.S01 = {minusXYZ:[x,y,z],plusXYZ:[x,y,z]}; homeRunWaypoints["S01+"] / ["S01-"] contain XYZ interior points; homeRunInstalledM uses the same keys. Endpoint positions remain attached. Developed curves are schematic; lengths use XYZ polylines.</p>';document.querySelector('aside').insertBefore(homePanel,document.querySelector('aside details'));
  const parameterFields=[['thicknessM','Thickness · m',.001,.5,.001],['vocV','Voc · V',.001,500,.01],['iscA','Isc · A',.001,1000,.01],['vmpV','Vmp · V',.001,500,.01],['impA','Imp · A',.001,1000,.01],['alphaIscPctPerC','Isc coefficient · %/°C',-5,5,.001],['betaVocPctPerC','Voc coefficient · %/°C',-5,5,.001],['gammaPmaxPctPerC','Pmax coefficient · %/°C',-5,5,.001],['referenceCellC','Reference cell · °C',-80,100,1]];
  const parameterPanel=document.createElement('details');parameterPanel.id='module-parameters';parameterPanel.innerHTML='<summary>Type any module’s parameters</summary><label class="field">Entered module name<input id="mp-name" type="text" maxlength="160" placeholder="Generic entered module"></label><p class="note">Width, height and both lead lengths are editable above. Enter other datasheet values here. Blank electrical fields remain unknown. Values persist in the recipe; they do not approve compatibility or establish a solved electrical model.</p><div class="pair">'+parameterFields.map(([key,label,min,max,step])=>'<label class="field">'+label+'<input id="mp-'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" placeholder="Unknown"></label>').join('')+'</div><p id="mp-status" class="note"></p>';homePanel.before(parameterPanel);
  function historyButtons(){$('undo-placement').disabled=!undoStack.length;$('redo-placement').disabled=!redoStack.length;$('rotate-module').disabled=!selectedModule;}
  function cameraSnapshot(){if(!engineReady)return null;const win=frame.contentWindow,D=win.eval('sldShapes');return D?.arrayMap?{...win.eval('({cx,cy,zoom})'),map:clone(D.arrayMap)}:null;}
  function setCamera(x,y,z){const win=frame.contentWindow;if(![x,y,z].every(Number.isFinite)||z<=0)return;win.eval('atHome=false;tween=null;cx='+x+';cy='+y+';zoom='+z+';dirty=true;');win.drawSldShapes();}
  function restoreCamera(saved){const win=frame.contentWindow,D=win.eval('sldShapes');if(!saved||!D?.arrayMap)return;const R=win.eval('Math.sqrt(SPACE)*BODY_RADIUS_MAX'),old=saved.map,next=D.arrayMap,z=saved.zoom*old.perM/next.perM;setCamera((saved.cx/R/old.perM+old.center[0]-next.center[0])*next.perM*R,(saved.cy/R/old.perM-old.center[1]+next.center[1])*next.perM*R,z);}
  function engineInput(r) {return {modules:r.count,width_m:r.width,module_height_m:r.length,mounting:'fixed',orientation:r.orientation,modules_high:1,gap_m:r.gapX,gap_up_m:r.gapY,routing:r.wiring==='leapfrog'?'leapfrog':'one-after-another',turn_every_second:0,turn_alternate_rows:0,box_across_frac_minus:r.boxes.minusAcross,box_across_frac_plus:r.boxes.plusAcross,box_along_frac:r.boxes.along,lead_plus_m:r.leadPlus,lead_minus_m:r.leadMinus,clip_offset_m:r.clip,slack_m:r.slack,view:'macro'};}
  function engineResult(r) {if(!engineReady)return null;return frame.contentWindow.FIRE.fire('fire string '+JSON.stringify(engineInput(r)));}
  function syncEngine(savedCamera=null) {
    if(!engineReady||!recipe)return;
    const token=++syncToken;
    frame.contentWindow.eval('atHome=false');frame.contentWindow.fireCommand('fire array-lab-table {}',null);
    setTimeout(()=>{try{if(token!==syncToken)return;frame.contentWindow.eval('bodyAnim=null; if(body&&body.sld)bodyJump(0);dirty=true;');if(savedCamera)restoreCamera(savedCamera);else fitNative(focusString);frame.contentWindow.drawSldShapes();}catch(e){error(e.message);}},180);
  }
  let scene = [], linkHits = [], projection = null, traceStarted=0,traceRequest=0;
  const canvas = $('table-canvas'), ctx = canvas.getContext('2d');
  const detail = $('connector-canvas'), dc = detail.getContext('2d');
  const images = {};
  const connectors = catalogue.equipment.filter(x => x.kind === 'connector');
  for (const c of connectors) { const im = new Image(); im.onload = () => drawDetail(); im.src = './generic-assets/' + c.view.path; images[c.connectorKind] = im; }
  for (const m of catalogue.modules) { const o = document.createElement('option'); o.value = m.id; o.textContent = m.label; $('module').append(o); }
  const id = n => 'M' + String(n).padStart(2,'0');
  const dist = (a,b) => Math.hypot(...a.map((x,i) => x-b[i]));
  const length = pts => pts.slice(1).reduce((sum,p,i) => sum+dist(p,pts[i]),0);
  const finite = (v,name,min,max) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(name+' must be between '+min+' and '+max+'.'); return v; };
  const eq = (a,b) => Math.abs(a-b) < 1e-9;
  const clone = x => JSON.parse(JSON.stringify(x));
  function readControls() {
    const r = {...clone(recipe||{}),schema:'kuiper.table/2',moduleId:$('module').value,orientation:$('orientation').value,wiring:$('wiring').value};
    for (const key of fields) r[key] = Number($(key).value);
    r.boxes = recipe?.boxes || {minusAcross:0.35,plusAcross:0.65,along:0.5};
    r.orders = r.wiring === 'custom' ? (recipe?.orders || {}) : {};
    r.routeWaypoints = recipe?.routeWaypoints || {};
    r.placementPreset=$('placement').value;r.modulePlacements=recipe?.modulePlacements||{};r.faceGapM=recipe?.faceGapM??.15;r.patchGapM=recipe?.patchGapM??1;
    if(r.moduleParameters?.presetId&&['width','length','leadPlus','leadMinus'].some(k=>r[k]!==(r.moduleParameters.geometryAtSelection||recipe)?.[k]))r.moduleParameters={...r.moduleParameters,isOverride:true};
    r.assumptions = 'Junction boxes, assigned lead lengths/polarities, tilt/height and routes are entered assumptions. All dimensions are editable generic inputs.';
    return r;
  }
  function validate(r) {
    const allowed=new Set(['schema','moduleId','orientation','wiring','count','rows','width','length','gapX','gapY','tilt','azimuth','height','leadPlus','leadMinus','clip','slack','boxes','orders','routeWaypoints','placementPreset','modulePlacements','faceGapM','patchGapM','moduleParameters','assumptions','syntheticContext','inverterEnclosure','inverterInputs','homeRunWaypoints','homeRunInstalledM','homeRunsEnabled','showInverters']);
    if(r&&Object.keys(r).some(k=>!allowed.has(k)))throw Error('Recipe contains unsupported fields. Import a generic kuiper.table/2 recipe.');
    if (!r || r.schema !== 'kuiper.table/2') throw Error('Use kuiper.table/2: count means modules per independent row string. Earlier single-string recipes must be explicitly migrated.');
    if (!catalogue.modules.some(x=>x.id===r.moduleId)) throw Error('Unknown module source.');
    finite(r.count,'Modules per series string',2,60); finite(r.rows,'Independent string rows',1,24);
    if (!Number.isInteger(r.count) || !Number.isInteger(r.rows)) throw Error('Module and row counts must be whole numbers.');
    if(r.syntheticContext&&(r.rows!==1||r.count!==r.syntheticContext.siteSpec?.series))throw Error('An addressed synthetic string retains its indexed module count. Open a new synthetic site to change series count, or explicitly remove syntheticContext in a standalone recipe.');
    for (const key of ['width','length']) finite(r[key],key,0.1,5);
    for (const key of ['gapX','gapY']) finite(r[key],key,0,10);
    finite(r.tilt,'Tilt',-80,80); finite(r.azimuth,'Azimuth',0,360); finite(r.height,'Height',0,30);
    for (const key of ['leadPlus','leadMinus','clip','slack']) finite(r[key],key,0,30);
    if (!['portrait','landscape'].includes(r.orientation)) throw Error('Unknown orientation.');
    if (!['sequential','leapfrog','custom'].includes(r.wiring)) throw Error('Unknown wiring order.');
    if(!['rows','patches','alternating','east-west'].includes(r.placementPreset||'rows'))throw Error('Unknown physical placement preset.');
    finite(r.faceGapM??.15,'Opposed-face horizontal gap',0,100);finite(r.patchGapM??1,'Patch gap',0,100);
    if(r.modulePlacements&&(typeof r.modulePlacements!=='object'||Array.isArray(r.modulePlacements)))throw Error('modulePlacements must be an object keyed by module ID.');
    for(const [key,p] of Object.entries(r.modulePlacements||{})){
      if(!p||!Array.isArray(p.originXYZ)||p.originXYZ.length!==3)throw Error('Placement '+key+' needs originXYZ [x,y,z].');
      p.originXYZ.forEach(v=>finite(v,'Placement coordinate',-10000,10000));
      finite(p.tilt??r.tilt,'Placement tilt',-80,80);finite(p.azimuth??r.azimuth,'Placement azimuth',0,360);finite(p.rotation??0,'In-plane rotation',-360,360);
    }
    if (!r.boxes) throw Error('Box outlet assumptions are required.');
    for (const key of ['minusAcross','plusAcross','along']) finite(r.boxes[key],'Box '+key,0,1);
    if (r.boxes.minusAcross===r.boxes.plusAcross) throw Error('Positive and negative box outlets must be distinct.');
    if (!r.routeWaypoints || Array.isArray(r.routeWaypoints) || typeof r.routeWaypoints !== 'object') throw Error('routeWaypoints must be an object.');
    for(const key of ['inverterInputs','homeRunWaypoints','homeRunInstalledM'])if(r[key]&&(typeof r[key]!=='object'||Array.isArray(r[key])))throw Error(key+' must be an object.');
    const point=(p,name)=>{if(!Array.isArray(p)||p.length!==3)throw Error(name+' must be XYZ metres.');p.forEach(v=>finite(v,name,-10000,10000));if(p[2]<0)throw Error(name+' is below assumed ground.');};
    const stringIds=Array.from({length:r.rows},(_,i)=>'S'+String(i+1).padStart(2,'0'));
    for(const [key,v]of Object.entries(r.inverterInputs||{})){if(!stringIds.includes(key))throw Error('Unknown inverter input string '+key);point(v.minusXYZ,key+' minus input');point(v.plusXYZ,key+' plus input');if(dist(v.minusXYZ,v.plusXYZ)<.01)throw Error('Input terminals must be distinct.');}
    for(const [key,points]of Object.entries(r.homeRunWaypoints||{})){if(!stringIds.some(s=>key===s+'+'||key===s+'-')||!Array.isArray(points)||points.length>100)throw Error('Invalid home-run route '+key);points.forEach(p=>point(p,key));}
    for(const [key,v]of Object.entries(r.homeRunInstalledM||{})){if(!stringIds.some(s=>key===s+'+'||key===s+'-'))throw Error('Unknown home cable '+key);finite(v,'Installed home cable',0,10000);}
    if(r.inverterEnclosure){const e=r.inverterEnclosure;for(const k of ['widthM','heightM','depthM'])finite(e[k],'Enclosure '+k,.1,5);if(e.originXYZ)point(e.originXYZ,'Enclosure origin');}
    if(r.moduleParameters){const p=r.moduleParameters;if(typeof p!=='object'||Array.isArray(p))throw Error('moduleParameters must be an object.');if(p.name!==undefined&&(typeof p.name!=='string'||p.name.length>160))throw Error('Module name must be up to 160 characters.');for(const[k,label,min,max]of parameterFields)if(p[k]!==undefined&&p[k]!==null)finite(p[k],label,min,max);if(p.vmpV&&p.vocV&&p.vmpV>p.vocV)throw Error('Module Vmp cannot exceed Voc.');if(p.impA&&p.iscA&&p.impA>p.iscA)throw Error('Module Imp cannot exceed Isc.');}
    if (Object.keys(r.routeWaypoints).length>1416) throw Error('Too many route overrides.');
    for (const [key,points] of Object.entries(r.routeWaypoints)) {
      if (!Array.isArray(points) || points.length>100) throw Error('Invalid waypoint list for '+key);
      for (const p of points) { if (!Array.isArray(p) || p.length!==3) throw Error('Each waypoint must be [x,y,z].'); p.forEach(v=>finite(v,'Waypoint coordinate',-10000,10000)); }
    }
  }
  function baseCorners(r) {
    const record = feed?.models?.find(x=>x.id===r.moduleId);
    const points = record?.outline_m || record?.corners_m;
    if (points && points.length>=4 && eq(record.widthM,r.width) && eq(record.heightM,r.length) && points.slice(0,4).every(p=>p.length>=2&&p.slice(0,2).every(Number.isFinite))) return {points:points.slice(0,4).map(p=>p.slice(0,2)),gpu:true};
    return {points:[[0,0],[r.width,0],[r.width,r.length],[0,r.length]],gpu:false};
  }
  function build(r) {
    r=clone(r);const parameters=r.moduleParameters;if(parameters?.presetId&&parameters.geometryAtSelection&&['width','length','leadPlus','leadMinus'].some(k=>r[k]!==parameters.geometryAtSelection[k]))parameters.isOverride=true;
    validate(r);
    const cols = r.count, w = r.orientation==='portrait'?r.width:r.length, h = r.orientation==='portrait'?r.length:r.width;
    const theta = r.tilt*Math.PI/180, ct=Math.cos(theta),st=Math.sin(theta);
    const az=r.azimuth*Math.PI/180,ca=Math.cos(az),sa=Math.sin(az);
    const world = (x,y) => [x*ca-y*ct*sa,x*sa+y*ct*ca,r.height+y*st];
    const oriented = (x,y) => r.orientation==='portrait'?[x,y]:[r.length-y,x];
    const inherited=engineResult(r),g=inherited?.string;
    const base = baseCorners(r), modules=[],preset=r.placementPreset||'rows',patchCols=Math.ceil(r.count/5),patchWidth=patchCols*w+(patchCols-1)*r.gapX,faceLength=5*h+4*r.gapY;
    function posePoint(origin,tilt,azimuth,rotation,u,v){const t=tilt*Math.PI/180,a=azimuth*Math.PI/180,b=rotation*Math.PI/180,xx=u*Math.cos(b)-v*Math.sin(b),yy=u*Math.sin(b)+v*Math.cos(b),horizontalY=yy*Math.cos(t);return [origin[0]+xx*Math.cos(a)-horizontalY*Math.sin(a),origin[1]+xx*Math.sin(a)+horizontalY*Math.cos(a),origin[2]+yy*Math.sin(t)];}
    for(let i=0;i<r.count*r.rows;i++) {
      const row=Math.floor(i/cols),col=i%cols,stringId='S'+String(row+1).padStart(2,'0'),moduleId=stringId+'-'+id(col+1);
      let x=col*(w+r.gapX),y=row*(h+r.gapY),tilt=r.tilt,azimuth=r.azimuth,origin;
      if(preset==='alternating'&&row%2)x=(r.count-1-col)*(w+r.gapX);
      if(preset==='patches'||preset==='east-west'){
        x=(preset==='patches'?row:Math.floor(row/2))*(patchWidth+(r.patchGapM??1))+(col%patchCols)*(w+r.gapX);y=Math.floor(col/patchCols)*(h+r.gapY);
      }
      if(preset==='east-west'){
        const west=row%2===1;tilt=west?-Math.abs(r.tilt):Math.abs(r.tilt);azimuth=(r.azimuth+90)%360;
        const baseY=west?faceLength*Math.cos(Math.abs(r.tilt)*Math.PI/180)+(r.faceGapM??.15):0,baseZ=west?r.height+faceLength*Math.sin(Math.abs(r.tilt)*Math.PI/180):r.height;
        const a=azimuth*Math.PI/180,slotY=baseY+y*Math.cos(tilt*Math.PI/180);origin=[x*Math.cos(a)-slotY*Math.sin(a),x*Math.sin(a)+slotY*Math.cos(a),baseZ+y*Math.sin(tilt*Math.PI/180)];
      }else origin=world(x,y);
      const override=r.modulePlacements?.[moduleId],pose={originXYZ:override?.originXYZ||origin,tilt:override?.tilt??tilt,azimuth:override?.azimuth??azimuth,rotation:override?.rotation??0};
      const fromUV=(u,v)=>posePoint(pose.originXYZ,pose.tilt,pose.azimuth,pose.rotation,u,v);
      const transform = (a,b) => {const q=oriented(a,b);return fromUV(...q);};
      const corners=base.points.map(p=>transform(...p));
      const minusLocal=g?g.minusPt(1):oriented(r.boxes.minusAcross*r.width,r.boxes.along*r.length),plusLocal=g?g.plusPt(1):oriented(r.boxes.plusAcross*r.width,r.boxes.along*r.length);
      const t=pose.tilt*Math.PI/180,a=pose.azimuth*Math.PI/180,normalXYZ=[Math.sin(a)*Math.sin(t),-Math.cos(a)*Math.sin(t),Math.cos(t)],thicknessM=r.moduleParameters?.thicknessM??.035,frontCorners=corners.map(p=>p.map((v,i)=>v+normalXYZ[i]*thicknessM));
      modules.push({id:moduleId,stringId,row,col,x,y,corners,frontCorners,normalXYZ,thicknessM,pose,center:fromUV(w/2,h/2),minus:fromUV(...minusLocal),plus:fromUV(...plusLocal),minusClip:fromUV(minusLocal[0],minusLocal[1]-r.clip),plusClip:fromUV(plusLocal[0],plusLocal[1]-r.clip),minusUV:[x+minusLocal[0],y+minusLocal[1]],plusUV:[x+plusLocal[0],y+plusLocal[1]]});
    }
    for(const key of Object.keys(r.modulePlacements||{}))if(!modules.some(m=>m.id===key))throw Error('Placement references unknown module '+key+'.');
    if (modules.some(m=>m.corners.some(p=>p[2]<-1e-9))) throw Error('The entered tilt/height places a module below the assumed level ground. Raise the low-edge height or change tilt.');
    let order=[],orders={},strings=[];
    for(let row=0;row<r.rows;row++) {
      let ids=modules.filter(m=>m.row===row).map(m=>m.id);
      if(r.wiring==='leapfrog') ids=ids.filter((_,i)=>i%2===0).concat(ids.filter((_,i)=>i%2===1).reverse());
      const stringId='S'+String(row+1).padStart(2,'0');
      if(g&&r.wiring!=='custom')ids=g.order.map(n=>stringId+'-'+id(n));
      if(r.wiring==='custom')ids=r.orders?.[stringId];
      const expected=modules.filter(m=>m.row===row).map(m=>m.id);
      if(!Array.isArray(ids)||ids.length!==r.count||new Set(ids).size!==r.count||ids.some(k=>!expected.includes(k)))throw Error('Custom order for '+stringId+' must visit all its own '+r.count+' modules exactly once. Cross-string links are not allowed.');
      orders[stringId]=[...ids];strings.push({id:stringId,order:[...ids]});
      order.push(...ids);
    }
    const byId=new Map(modules.map(m=>[m.id,m]));
    const links=[];
    for(let i=0;i<order.length-1;i++) {
      const a=byId.get(order[i]),b=byId.get(order[i+1]),key=a.id+'+>'+b.id+'-';
      if(a.stringId!==b.stringId)continue;
      const uvA=a.plusUV,uvB=b.minusUV;
      const laneA=uvA[1]-r.clip,laneB=uvB[1]-r.clip;
      const independent=preset==='east-west'||Object.keys(r.modulePlacements||{}).length>0;
      const interior=r.routeWaypoints[key] || (independent?[a.plusClip,b.minusClip]:[world(uvA[0],laneA),world(uvB[0],laneA),world(uvB[0],laneB)]);
      const points=[a.plus,...interior,b.minus].filter((p,j,all)=>!j||dist(p,all[j-1])>1e-12);
      const routeM=length(points),needM=routeM+r.slack,pairM=r.leadPlus+r.leadMinus;
      links.push({key,stringId:a.stringId,from:a.id,to:b.id,points,routeM,needM,pairM,shortM:Math.max(0,needM-pairM),reaches:pairM+1e-9>=needM,custom:Object.hasOwn(r.routeWaypoints,key),sequence:links.length});
    }
    for(const key of Object.keys(r.routeWaypoints)) if(!links.some(l=>l.key===key)) throw Error('Route override '+key+' is not in this electrical order. Clear it or select the matching custom order.');
    const terminals=strings.flatMap(s=>[{id:s.order[0]+'-',stringId:s.id,point:byId.get(s.order[0]).minus},{id:s.order.at(-1)+'+',stringId:s.id,point:byId.get(s.order.at(-1)).plus}]);
    const homeRuns=[],inverterInputs=[],globalCorners=modules.flatMap(m=>m.corners),globalMin=[0,1,2].map(i=>Math.min(...globalCorners.map(p=>p[i]))),globalMax=[0,1,2].map(i=>Math.max(...globalCorners.map(p=>p[i]))),enclosureInput=r.inverterEnclosure||{},inverterEnclosure={id:'INV-01',widthM:enclosureInput.widthM??1.2,heightM:enclosureInput.heightM??.9,depthM:enclosureInput.depthM??.4,originXYZ:enclosureInput.originXYZ||[globalMin[0]-2.7,(globalMin[1]+globalMax[1])/2,Math.max(.3,globalMin[2])],dimensions:'Generic entered enclosure dimensions; placement and underside port pitch illustrative',portsVerified:false};
    const eo=inverterEnclosure.originXYZ,ew=inverterEnclosure.widthM,eh=inverterEnclosure.heightM,ed=inverterEnclosure.depthM;
    inverterEnclosure.corners=Array.from({length:8},(_,i)=>[eo[0]+(i&1?ew:0),eo[1]+(i&2?ed:0),eo[2]+(i&4?eh:0)]);
    if(r.homeRunsEnabled!==false)for(const s of strings){
      const ms=s.order.map(id=>byId.get(id)),corners=ms.flatMap(m=>m.corners),minY=Math.min(...corners.map(p=>p[1])),maxY=Math.max(...corners.map(p=>p[1])),entered=r.inverterInputs?.[s.id],slot=strings.indexOf(s)*2,port=n=>[eo[0]+ew*(n+.5)/(strings.length*2),eo[1]+ed/2,eo[2]],minus=entered?.minusXYZ||port(slot),plus=entered?.plusXYZ||port(slot+1);
      inverterInputs.push({equipmentId:inverterEnclosure.id,stringId:s.id,minusXYZ:minus,plusXYZ:plus,assumed:!entered,portPlacement:'Illustrative independent underside ports; not manufacturer coordinates or shared MPPT'});
      const first=ms[0],last=ms.at(-1),top=maxY+.6,bottom=minY-.6;
      for(const sign of ['-','+']){const key=s.id+sign,A=sign==='-'?minus:last.plus,B=sign==='-'?first.minus:plus,input=sign==='-'?minus:plus,stub=[input[0],input[1],Math.max(0,input[2]-.2)],interior=r.homeRunWaypoints?.[key]||(sign==='-'?[[eo[0]+ew+.25,minus[1],stub[2]],[eo[0]+ew+.25,top,stub[2]],[B[0],top,B[2]]]:[[A[0],bottom,A[2]],[eo[0]+ew+.25,bottom,stub[2]],[eo[0]+ew+.25,plus[1],stub[2]]]),points=(sign==='-'?[A,stub,...interior,B]:[A,...interior,stub,B]).filter((p,i,a)=>!i||dist(p,a[i-1])>1e-12),routeM=length(points),installedM=r.homeRunInstalledM?.[key]||0;
        homeRuns.push({key,stringId:s.id,sign,from:sign==='-'?'INV-'+s.id+'-':last.id+'+',to:sign==='-'?first.id+'-':'INV-'+s.id+'+',points,routeM,needM:routeM+r.slack,installedM,shortM:Math.max(0,routeM+r.slack-installedM),reaches:installedM>=routeM+r.slack,custom:Object.hasOwn(r.homeRunWaypoints||{},key)});
      }
    }
    const homeRouteM=homeRuns.reduce((n,h)=>n+h.routeM,0);
    const allCorners=modules.flatMap(m=>m.corners.concat(m.frontCorners)),boundsXYZ={min:[0,1,2].map(i=>Math.min(...allCorners.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...allCorners.map(p=>p[i])))};
    return {recipe:clone(r),modules,links,homeRuns,inverterInputs,inverterEnclosure,homeRouteM,homeExtensionLinks:homeRuns.filter(h=>!h.reaches).length,order:[...order],orders,strings,cols,rows:r.rows,w,h,width:cols*w+(cols-1)*r.gapX,slopeLength:r.rows*h+(r.rows-1)*r.gapY,boundsXYZ,placementPreset:preset,developedIsPlan:preset==='east-west'||Object.keys(r.modulePlacements||{}).length>0,gpu:base.gpu,engine:g?'Kuiper FIRE per-string order/outlets + native shape renderer':inherited?.refused?'Native Kuiper shape renderer; geometry only, inherited electrical model refused':'local geometry pending Kuiper load',engineRefusal:inherited?.refused?inherited.said:null,totalRouteM:links.reduce((s,l)=>s+l.routeM,0),extensionLinks:links.filter(l=>!l.reaches).length,terminals};
  }
  function apply(r,reset=true,options={}) {
    const next=build(clone(r));
    const savedCamera=options.preserveCamera?cameraSnapshot():null;
    if(recipe&&!replayHistory&&JSON.stringify(recipe)!==JSON.stringify(r)){undoStack.push(clone(recipe));if(undoStack.length>20)undoStack.shift();redoStack.length=0;}
    if(trace!==null)stopTrace();
    model=next;recipe=clone(next.recipe);recipe.orders=clone(next.orders);delete recipe.order;selected=Math.min(selected,model.links.length-1);
    if(reset) {zoom=1;pan=[0,0];}
    if(selectedModule&&!model.modules.some(m=>m.id===selectedModule))selectedModule=null;
    $('recipe').value=JSON.stringify(recipe,null,2);syncControls();sourceInfo();updateStats();error('');historyButtons();draw();syncEngine(savedCamera);
    window.dispatchEvent(new CustomEvent('kuiper:recipe-changed',{detail:{recipe:clone(recipe),moduleCount:model.modules.length,stringCount:model.strings.length,linkCount:model.links.length,totalRouteM:model.totalRouteM}}));
  }
  function syncControls() {
    for(const key of fields) {
      if(key==='count'&&!Array.from($(key).options).some(o=>Number(o.value)===recipe.count)) {const o=new Option(String(recipe.count),String(recipe.count));$(key).add(o);}
      $(key).value=recipe[key];
    }
    $('module').value=recipe.moduleId;$('orientation').value=recipe.orientation;$('wiring').value=recipe.wiring;$('placement').value=recipe.placementPreset||'rows';
    const p=recipe.moduleParameters||{};$('mp-name').value=p.name||'';for(const[k]of parameterFields)$('mp-'+k).value=p[k]??(k==='thicknessM'?.035:k==='referenceCellC'?25:'');$('mp-status').textContent=(p.isOverride?'Edited preset override. ':p.name?'Entered module parameters. ':'Generic geometry; default thickness 0.035 m is an assumption. ')+(p.vmpV&&p.impA?'Entered STC Vmp × Imp = '+(p.vmpV*p.impA).toFixed(2)+' W. ':'STC maximum-power values incomplete. ')+'Circuit inputs are adopted only by the explicit circuit-panel action.';
    syncHomeControls();
  }
  function syncHomeControls(){$('home-enabled').checked=recipe.homeRunsEnabled!==false;$('home-inverters').checked=recipe.showInverters!==false;$('home-plus').value=recipe.homeRunInstalledM?.[selectedString+'+']||0;$('home-minus').value=recipe.homeRunInstalledM?.[selectedString+'-']||0;const runs=model.homeRuns.filter(h=>h.stringId===selectedString);$('home-info').textContent=selectedString+' · '+runs.map(h=>h.sign+' route '+h.routeM.toFixed(2)+' m / installed '+h.installedM.toFixed(2)+' m'+(h.reaches?' (length supplied)':' (needs '+h.shortM.toFixed(2)+' m)')).join(' · ')+'. Site home routes '+model.homeRouteM.toFixed(2)+' m; intermodule route '+model.totalRouteM.toFixed(2)+' m. Geometry only; no circuit closure asserted.';}
  function sourceInfo() {
    const m=catalogue.modules.find(x=>x.id===recipe.moduleId);
    $('source-note').textContent=recipe.width+' × '+recipe.length+' m entered module outline. Junction boxes, connector symbols, lead lengths and equipment entry positions are assumptions.';
    $('source-art').src='./generic-assets/'+m.views[$('source-view').value].path;
    $('gpu-note').textContent='Geometry and routing run in this browser. No remote calculation service is used.';
  }
  function updateStats() {
    $('stat-modules').textContent=model.modules.length;$('stat-links').textContent=model.links.length;$('stat-route').textContent=model.totalRouteM.toFixed(2)+' m';$('stat-short').textContent=model.extensionLinks;
    const select=$('link-select');select.replaceChildren();model.links.forEach((l,i)=>select.add(new Option((i+1)+'. '+l.from+'+ → '+l.to+'−',String(i))));select.value=selected;
    const rows=$('string-select');rows.replaceChildren();model.strings.forEach(s=>rows.add(new Option(s.id,s.id)));if(!model.strings.some(s=>s.id===selectedString))selectedString=model.strings[0].id;rows.value=selectedString;
    updateSelection();
  }
  function updateSelection() {
    const l=model.links[selected];if(!l)return;
    $('link-select').value=String(selected);
    $('link-info').textContent=l.from+'+ → '+l.to+'−\nXYZ route: '+l.routeM.toFixed(3)+' m'+(l.custom?' · custom waypoints':' · clip route')+'\nAllowance: '+recipe.slack.toFixed(3)+' m · required total '+l.needM.toFixed(3)+' m\nEntered leads: +'+recipe.leadPlus.toFixed(3)+' m / −'+recipe.leadMinus.toFixed(3)+' m\n'+(l.reaches?'Pair reaches proposed route; mating compatibility unverified.':'Extension required: at least '+l.shortM.toFixed(3)+' m before additional connector allowances.');
    drawDetail();
  }
  function size(c) {const b=c.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);if(c.width!==Math.round(b.width*dpr)||c.height!==Math.round(b.height*dpr)){c.width=Math.round(b.width*dpr);c.height=Math.round(b.height*dpr);}const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return [b.width,b.height];}
  function project(p) {
    let [x,y,z]=p;
    if(rear)x=-x;
    if(view==='developed'){if(model.developedIsPlan)return [p[0],-y];let [wx,wy]=p;const az=recipe.azimuth*Math.PI/180,lx=wx*Math.cos(az)+wy*Math.sin(az),ly=(-wx*Math.sin(az)+wy*Math.cos(az))/Math.cos(recipe.tilt*Math.PI/180);return [lx,-ly];}
    return view==='plan'?[x,-y]:[x*.92+y*.29,y*.46-z*.88];
  }
  function sliceRoute(points,start,end) {
    const total=length(points),out=[pointAt(points,start)];let passed=0;
    for(let i=1;i<points.length;i++){passed+=dist(points[i-1],points[i]);const f=total?passed/total:1;if(f>start&&f<end)out.push(points[i]);}
    out.push(pointAt(points,end));return out;
  }
  function nativeDrawing() {
    const physical=model.modules.flatMap(m=>m.corners).concat(model.links.flatMap(l=>l.points),model.homeRuns.flatMap(h=>h.points),model.homeRuns.length?model.inverterEnclosure.corners:[]);
    const raw=physical.map(project),x0=Math.min(...raw.map(p=>p[0])),x1=Math.max(...raw.map(p=>p[0])),y0=Math.min(...raw.map(p=>p[1])),y1=Math.max(...raw.map(p=>p[1]));
    const perM=1.7/Math.max(x1-x0,y1-y0),map=p=>{const q=project(p);return [(q[0]-(x0+x1)/2)*perM,-(q[1]-(y0+y1)/2)*perM];};
    const shapes=[],marks=[],terminals=[],conns=[],drawingRoutes=[],drawingHomes=[];
    for(const m of model.modules){
      const pts=m.corners.map(map);pts.push(pts[0]);
      shapes.push({role:'module',node:m.id,order:0,pot:0,volts:0,earth_v:0,pts,fill:rear?'#172636':'#14344b'});
      if(view==='three'){const front=m.frontCorners.map(map);shapes.push({role:'tube',node:m.id+'-front-frame',order:0,pot:0,pts:front.concat([front[0]])});for(let i=0;i<4;i++)shapes.push({role:'tube',node:m.id+'-depth-'+i,order:0,pot:0,pts:[map(m.corners[i]),front[i]]});}
      const center=map(m.center);marks.push({x:center[0],y:center[1]+model.h*perM*.28,text:m.id,size:9,colour:'#afc4d5',minPx:24,mid:true,rank:2});
      for(const [pol,p] of [['-',m.minus],['+',m.plus]]){const q=map(p),bw=.064*perM,bh=.024*perM;shapes.push({role:'box',node:m.id+pol,order:0,pot:0,pts:[[q[0]-bw/2,q[1]-bh/2],[q[0]+bw/2,q[1]-bh/2],[q[0]+bw/2,q[1]+bh/2],[q[0]-bw/2,q[1]+bh/2]],diode:false});terminals.push({id:m.id+pol,x:q[0],y:q[1],kind:pol==='+'?'plus':'minus',module:m.id});marks.push({x:q[0],y:q[1]-.11*perM,text:pol==='+'?'+':'−',size:9,colour:pol==='+'?'#eaa798':'#c7ddea',minPx:70,mid:true,rank:1});}
    }
    for(const l of model.links){
      const f=recipe.leadPlus/Math.max(1e-9,l.pairM),usable=Math.max(0,l.pairM-recipe.slack),a=l.reaches?f:Math.min(1,usable*f/Math.max(1e-9,l.routeM)),b=l.reaches?f:Math.max(0,1-usable*(1-f)/Math.max(1e-9,l.routeM));
      let displayPoints=l.points.map(map);
      if(view==='developed'){
        const A=displayPoints[0],B=displayPoints.at(-1),back=Number(l.to.split('-M')[1])<Number(l.from.split('-M')[1]);
        const bend=Math.min(.65,Math.abs(B[0]-A[0])/perM*.24)*perM*(back?-1:1),control=[(A[0]+B[0])/2,(A[1]+B[1])/2+2*bend];
        displayPoints=frame.contentWindow.bez(A,control,control,B,24);
      }
      drawingRoutes.push({...l,drawingPoints:displayPoints,schematic:view==='developed'});
      let plus=frame.contentWindow.polySlice(displayPoints,0,a),minus=frame.contentWindow.polySlice(displayPoints,b,1);const pot=(l.sequence%(recipe.count-1)+1)/recipe.count;
      if(plus.length<2)plus=[displayPoints[0],displayPoints[0]];if(minus.length<2)minus=[displayPoints.at(-1),displayPoints.at(-1)];
      const common={node:'L'+l.sequence,order:.5,pot,volts:0,earth_v:0,link:l,hit:true,says:l.key+' · proposed XYZ route '+l.routeM.toFixed(3)+' m',from:l.from+'+',to:l.to+'-'};
      shapes.push({...common,role:'lead',pts:plus,plus:true,open:!l.reaches,metres:recipe.leadPlus});
      shapes.push({...common,role:'lead',pts:minus,plus:false,open:!l.reaches,metres:recipe.leadMinus});
      const pa=plus.at(-1),pb=minus[0],dir=[pb[0]-pa[0],pb[1]-pa[1]],fallback=[plus.at(-1)[0]-plus.at(-2)[0],plus.at(-1)[1]-plus.at(-2)[1]];
      if(l.reaches)shapes.push({...common,role:'mate',pts:[pa],mated:true,along:fallback});
      else{const minusDir=[minus[1][0]-minus[0][0],minus[1][1]-minus[0][1]];shapes.push({...common,role:'plug',pts:[pa],male:true,along:fallback});shapes.push({...common,role:'plug',pts:[pb],male:false,along:minusDir});}
      conns.push({node:l.key,from:l.from+'+',to:l.to+'-',needed:l.needM,pair:l.pairM,reaches:l.reaches,jumper:0});
    }
    for(const t of model.terminals){const p=map(t.point);marks.push({x:p[0],y:p[1]-.35*perM,text:t.id.endsWith('+')?t.stringId+' +':t.stringId+' −',size:10,colour:'#f4d699',minPx:0,mid:true,rank:0});}
    // The original string renderer's round4 construction, using its shared Bezier primitive.
    function roundHome(pp,r){if(view!=='developed')return pp;const out=[pp[0]];for(let i=1;i+1<pp.length;i++){const a=pp[i-1],b=pp[i],c=pp[i+1],u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],L=Math.max(1e-9,Math.hypot(...u)),K=Math.max(1e-9,Math.hypot(...v)),s=b.map((x,j)=>x+u[j]/L*Math.min(r,L*.45)),t=b.map((x,j)=>x+v[j]/K*Math.min(r,K*.45));out.push(s,...frame.contentWindow.bez(s,b,b,t,8),t);}out.push(pp.at(-1));return out;}
    for(const h of model.homeRuns){
      let raw=h.points.map(map);const negative=h.sign==='-',port=negative?raw[0]:raw.at(-1);let stub=negative?raw[1]:raw.at(-2);
      if(view==='developed')stub=[port[0],port[1]-.2*perM];
      const delta=[port[0]-stub[0],port[1]-stub[1]],norm=Math.hypot(...delta),u=norm>1e-9?delta.map(v=>v/norm):null,profile=catalogue.equipment.find(e=>e.connectorKind===(negative?'socket':'plug'));
      let gland=null;
      if(u&&profile){const len=profile.widthM*perM;gland=port.map((v,i)=>v-u[i]*len);const entry=gland.map((v,i)=>v-u[i]*.02*perM);if(view==='developed'){const e=model.inverterEnclosure,edge=map([e.originXYZ[0]+e.widthM,e.originXYZ[1]+e.depthM/2,e.originXYZ[2]]),laneX=edge[0]+(.25+Number(h.stringId.slice(1))*.025)*perM,next=negative?raw[2]:raw.at(-3),outside=[[laneX,stub[1]],[laneX,next[1]]];raw=negative?[gland,entry,stub,...outside,...raw.slice(h.custom?2:3)]:[...raw.slice(0,h.custom?-2:-3),...outside.reverse(),stub,entry,gland];}else raw=negative?[gland,entry,stub,...raw.slice(2)]:[...raw.slice(0,-2),stub,entry,gland];shapes.push({role:'plug',node:'port-'+h.key,equipmentId:model.inverterEnclosure.id,stringId:h.stringId,order:negative?0:1,pot:negative?0:1,male:!negative,along:u.map(v=>v*(negative?-1:1)),pts:[gland],glandAnchor:gland,entryDirection:u,physicalPortXYZ:negative?h.points[0]:h.points.at(-1),sourceIdentity:profile.id,illustrativePort:true});}
      const points=roundHome(raw,.3*perM);if(gland){if(negative){points[0]=gland;points[1]=gland.map((v,i)=>v-u[i]*.02*perM);}else{points[points.length-1]=gland;points[points.length-2]=gland.map((v,i)=>v-u[i]*.02*perM);}}
      drawingHomes.push({...h,drawingPoints:points,glandAnchor:gland,entryDirection:u});shapes.push({role:'cable',node:'home-'+h.key,equipmentId:model.inverterEnclosure.id,stringId:h.stringId,order:negative?0:1,pot:negative?0:1,plus:!negative,weight:1.6,pts:points,from:h.from,to:h.to,metres:h.routeM,glandAnchor:gland,hit:true,says:h.stringId+' '+h.sign+' proposed home cable '+h.routeM.toFixed(3)+' m; illustrative enclosure input, no MPPT assignment or closure'});conns.push({node:'home-'+h.key,from:h.from,to:h.to,needed:h.needM,pair:h.installedM,reaches:h.reaches,home:true});
    }
    if(model.homeRuns.length){const e=model.inverterEnclosure,o=e.originXYZ,front=view==='developed';let box;if(front){const base=map([o[0],o[1]+e.depthM/2,o[2]]),right=map([o[0]+e.widthM,o[1]+e.depthM/2,o[2]]);box=[base,right,[right[0],right[1]+e.heightM*perM],[base[0],base[1]+e.heightM*perM],base];}else box=(view==='plan'?[0,1,3,2,0]:[0,1,5,4,0]).map(i=>map(e.corners[i]));if(recipe.showInverters!==false)shapes.push({role:'inverter',node:e.id,equipmentId:e.id,order:0,pot:0,pts:box,fill:'#0c1119',dimensionsM:[e.widthM,e.heightM,e.depthM]});if(view==='three'&&recipe.showInverters!==false)for(const face of [[2,3,7,6,2],[4,5,7,6,4]])shapes.push({role:'tube',node:e.id+'-edge',equipmentId:e.id,order:0,pot:0,pts:face.map(i=>map(e.corners[i]))});const p=box[0];marks.push({x:(box[0][0]+box[1][0])/2,y:Math.max(...box.map(p=>p[1]))+.18*perM,text:e.id+' · one enclosure',size:10,colour:'#a6cad8',minPx:0,mid:true,rank:0});}
    for(const input of model.inverterInputs)for(const sign of ['-','+']){const point=sign==='-'?input.minusXYZ:input.plusXYZ,q=map(point);shapes.push({role:'terminal',node:'INV-'+input.stringId+sign,equipmentId:model.inverterEnclosure.id,stringId:input.stringId,order:0,pot:sign==='+'?1:0,pts:[q],dot:.008*perM});marks.push({x:q[0],y:q[1]+.045*perM,text:input.stringId+sign,size:9,colour:sign==='+'?'#ff786e':'#bed5e3',minPx:90,mid:true,rank:0});}
    if(view==='three')for(const m of model.modules.filter(m=>m.col===0||m.col===recipe.count-1)){const p=m.corners[0],ground=[p[0],p[1],0];shapes.push({role:'tube',order:0,pot:0,node:'support-'+m.id,pts:[map(ground),map(p)]});}
    const words=[{pinned:3,note:true,text:model.rows+' independent strings × '+recipe.count+' modules = '+model.modules.length+' modules · '+model.links.length+' links · '+model.terminals.length+' free string ends',small:model.rows+' × '+recipe.count+' · '+model.modules.length+' modules'},
      {pinned:4,note:true,text:(view==='three'?'3D':view==='plan'?'Horizontal plan':model.developedIsPlan?'Wiring curves on horizontal placement':'Developed wiring')+' · tilt '+recipe.tilt+'° · XYZ extent '+model.boundsXYZ.max.map((v,i)=>(v-model.boundsXYZ.min[i]).toFixed(2)).join(' × ')+' m · routes '+model.totalRouteM.toFixed(2)+' m',small:'Tilt '+recipe.tilt+'° · XYZ route '+model.totalRouteM.toFixed(2)+' m'},
      {pinned:5,note:true,text:'Proposed geometry: '+model.extensionLinks+' intermodule extensions; '+model.homeRouteM.toFixed(2)+' m home routes, '+model.homeExtensionLinks+' home cables need length. Separate input pairs; no shared MPPT/closure asserted.',small:'Proposed homes '+model.homeRouteM.toFixed(2)+' m · no closure asserted'}];
    const g={c:{sheet:0,view:'macro',lead_plus_m:recipe.leadPlus,lead_minus_m:recipe.leadMinus},N:model.modules.length,pitch:model.w+recipe.gapX,pair:recipe.leadPlus+recipe.leadMinus,short:model.links.filter(l=>!l.reaches),links:model.links,rows:model.rows,cols:model.cols,rowY:[],order:model.order,bothNear:true,ret:0,row:model.width,lead_m:model.modules.length*(recipe.leadPlus+recipe.leadMinus),field_m:0,ohm:0};
    const D={kind:'string',opened:true,shapes,marks,words,conns,terminals,wiring:true,crossings:[],perM,open:true,g,firstModuleX:-.85,volts:0,volts_open:0,earth_node:'earth',bounds:{x0:-.9,y0:-(y1-y0)*perM/2-.15,x1:.9,y1:(y1-y0)*perM/2+.15},near:{x:0,y:0},mPerUnit:1/perM,amps:0,front:-1,head:-1,walk:null,t0:0};g.__draw=D;
    D.arrayMap={perM,center:[(x0+x1)/2,(y0+y1)/2],view,rear};D.arrayRoutes=drawingRoutes;D.arrayHomes=drawingHomes;D.arrayTerminals=model.terminals.map(t=>({...t,drawingPoint:map(t.point)}));
    return {numbers:{modules:model.modules.length,strings:model.rows,series:recipe.count,links:model.links.length,free_ends:model.terminals.length},said:'Independent row strings using Kuiper native shape renderer, entered dimensions and programmable physical route geometry.',how:'Kuiper per-string order/outlets where the inherited model accepts inputs. XYZ polylines and projection added locally. No electrical verdict.',block:g};
  }
  function color(i,a=1) {return 'hsla('+(174+i/Math.max(1,model.links.length-1)*105)+',75%,67%,'+a+')';}
  function path(points,closed=false) {ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(closed)ctx.closePath();}
  function label(text,p,fill='#cddde9',align='center') {ctx.font='11px system-ui';ctx.textAlign=align;ctx.fillStyle='#08111de8';const width=ctx.measureText(text).width;ctx.fillRect(p[0]-(align==='center'?width/2+3:3),p[1]-11,width+6,15);ctx.fillStyle=fill;ctx.fillText(text,p[0],p[1]);}
  function draw() {
    if(!model)return;const [width,height]=size(canvas);ctx.clearRect(0,0,width,height);
    const all=model.modules.flatMap(m=>m.corners).concat(model.links.flatMap(l=>l.points));const flat=all.map(project);
    const minX=Math.min(...flat.map(p=>p[0])),maxX=Math.max(...flat.map(p=>p[0])),minY=Math.min(...flat.map(p=>p[1])),maxY=Math.max(...flat.map(p=>p[1]));
    const scale=Math.min((width-115)/Math.max(.1,maxX-minX),(height-115)/Math.max(.1,maxY-minY))*zoom;
    const mid=[(minX+maxX)/2,(minY+maxY)/2];projection=p=>{const q=project(p);return [(q[0]-mid[0])*scale+width/2+pan[0],(q[1]-mid[1])*scale+height/2+pan[1]];};
    scene=[];linkHits=[];
    for(const m of model.modules) {
      const pts=m.corners.map(projection), center=projection(m.center);scene.push({id:m.id,points:pts,center});
      path(pts,true);ctx.fillStyle=rear?'#192a39':'#133549';ctx.fill();ctx.strokeStyle='#456175';ctx.lineWidth=1;ctx.stroke();
      if(!rear&&scale*model.w>30){for(const f of [.25,.5,.75]){const a=m.corners[0].map((v,i)=>v+(m.corners[1][i]-v)*f),b=m.corners[3].map((v,i)=>v+(m.corners[2][i]-v)*f);path([projection(a),projection(b)]);ctx.strokeStyle='#395368';ctx.lineWidth=.5;ctx.stroke();}}
      if(scale*Math.min(model.w,model.h)>20){ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillStyle='#9bb1c2';ctx.fillText(m.id,center[0],center[1]-Math.min(18,scale*model.h*.23));}
    }
    const active=model.links[selected];
    const ordered=model.links.filter(l=>l!==active).concat(active||[]);
    for(const l of ordered) {
      const points=l.points.map(projection);linkHits.push({index:l.sequence,points});
      path(points);ctx.strokeStyle=l===active?'#ffe5a6':color(l.sequence,.85);ctx.lineWidth=l===active?3:1.7;ctx.setLineDash(l.reaches?[]:[5,4]);ctx.stroke();ctx.setLineDash([]);
      const midPoint=points[Math.floor(points.length/2)];
      if(l===active){ctx.fillStyle='#ffe5a6';ctx.beginPath();ctx.arc(...midPoint,3.2,0,Math.PI*2);ctx.fill();}
    }
    for(const m of model.modules) {
      for(const [sign,point] of [['−',m.minus],['+',m.plus]]) {
        const p=projection(point);ctx.fillStyle=sign==='+'?'#e6a395':'#a6c9dc';ctx.fillRect(p[0]-2.8,p[1]-2.8,5.6,5.6);
        if(scale*model.w>44){ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(sign,p[0],p[1]+13);}
      }
    }
    for(const t of model.terminals) {const p=projection(t.point);ctx.strokeStyle='#f9e1a0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(...p,7,0,Math.PI*2);ctx.stroke();label('STRING '+t.id,p.map((v,i)=>i?v+30:v),'#f9e1a0');}
    if(trace!==null){const l=model.links[Math.floor(trace)%model.links.length],p=pointAt(l.points,trace%1);ctx.fillStyle='#fff7cc';ctx.shadowColor='#ffe4a1';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(...projection(p),5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
    $('view-status').textContent=model.rows+' strings × '+recipe.count+' modules · '+model.placementPreset+' · '+recipe.wiring;
    $('stage-label').textContent=(view==='plan'?'Horizontal plan':'Shallow 3D · same XYZ model')+' · '+(rear?'rear-facing wiring view':'front with wiring overlay')+' · '+recipe.tilt+'° tilt';
    const sx=recipe.width,sy=recipe.length;
    label('Module '+sx.toFixed(3)+' × '+sy.toFixed(3)+' m · XYZ extent '+model.boundsXYZ.max.map((v,i)=>(v-model.boundsXYZ.min[i]).toFixed(2)).join(' × ')+' m',[width/2,height-31],'#9bb8ca');
  }
  function pointAt(points,f) {const total=length(points);let remaining=Math.max(0,Math.min(1,f))*total;for(let i=1;i<points.length;i++){const d=dist(points[i-1],points[i]);if(remaining<=d)return points[i-1].map((v,j)=>v+(points[i][j]-v)*(d?remaining/d:0));remaining-=d;}return points.at(-1);}
  function drawDetail() {
    if(!model)return;const [w,h]=size(detail);dc.clearRect(0,0,w,h);const l=model.links[selected];if(!l)return;
    const y=76,left=25,right=w-25,cx=w/2,gap=40,plug=images.plug,socket=images.socket;
    const maxLen=Math.min(90,w*.19),ratio=0.065/0.070;
    const plugLength=maxLen,socketLength=maxLen*ratio;
    const pMate=cx-gap/2,sMate=cx+gap/2,pCable=pMate-plugLength,sCable=sMate+socketLength;
    dc.lineWidth=3;dc.strokeStyle='#e69787';dc.beginPath();dc.moveTo(left,y);dc.lineTo(pCable,y);dc.stroke();dc.strokeStyle='#a6c9dc';dc.beginPath();dc.moveTo(sCable,y);dc.lineTo(right,y);dc.stroke();
    // Both generic symbols have mating end LEFT and cable end RIGHT. Mirror only the left-hand plug.
    const paint=(im,x,len,mirror)=>{if(!im?.complete||!im.naturalWidth)return;const ih=len*im.naturalHeight/im.naturalWidth;dc.save();dc.filter='invert(1)';if(mirror){dc.translate(x,y);dc.scale(-1,1);dc.drawImage(im,0,-ih/2,len,ih);}else dc.drawImage(im,x,y-ih/2,len,ih);dc.restore();};
    paint(plug,pMate,plugLength,true);paint(socket,sMate,socketLength,false);
    dc.fillStyle='#c6d7e5';dc.font='11px system-ui';dc.textAlign='left';dc.fillText(l.from+' + box',left,30);dc.textAlign='right';dc.fillText(l.to+' − box',right,30);
    dc.textAlign='center';dc.fillStyle='#e69787';dc.fillText('+'+recipe.leadPlus.toFixed(2)+' m',Math.max(55,(left+pCable)/2),115);dc.fillStyle='#a6c9dc';dc.fillText('−'+recipe.leadMinus.toFixed(2)+' m',Math.min(w-55,(right+sCable)/2),115);
    dc.strokeStyle=l.reaches?'#76d8c4':'#f8bc78';dc.setLineDash([3,4]);dc.lineWidth=1;dc.beginPath();dc.moveTo(pMate+2,y);dc.lineTo(sMate-2,y);dc.stroke();dc.setLineDash([]);
    dc.fillStyle='#a6bbce';dc.font='10px system-ui';dc.fillText('Generic symbols · exploded, gap not to route scale',cx,147);
    $('connector-note').textContent='Generic plug/socket symbols, assumed lengths 70 / 65 mm. Cable ends attach to the illustrated leads. '+(l.reaches?'Reference pair shown separated; exact engagement unverified.':'This route needs an extension; separated profiles do not imply a completed connection.')+' Connector gender/polarity assignment is illustrative, compatibility unverified.';
  }
  function fitNative(onlyString) {
    if(!engineReady)return;const win=frame.contentWindow,D=win.eval('sldShapes');if(!D?.arrayRoutes)return;win.eval('atHome=false');
    const points=D.shapes.filter(s=>['module','cable','inverter'].includes(s.role)&&(!onlyString||s.role==='inverter'||s.node.startsWith(selectedString+'-')||s.stringId===selectedString)).flatMap(s=>s.pts);
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),pad=.5*D.perM,x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,y0=Math.min(...ys)-pad,y1=Math.max(...ys)+pad,b=win.shapeBand(true),R=win.eval('Math.sqrt(SPACE)*BODY_RADIUS_MAX'),z=Math.min((b.right-b.left)*.9/((x1-x0)*R),(b.bottom-b.top)*.82/((y1-y0)*R));
    win.flyTo((x0+x1)/2*R-((b.left+b.right)/2-win.innerWidth/2)/z,(y0+y1)/2*R+((b.top+b.bottom)/2-win.innerHeight/2)/z,z);
  }
  function highlightNative() {
    if(!engineReady)return;const win=frame.contentWindow,D=win.eval('sldShapes'),c=win.document.getElementById('sldshapes');if(!D?.arrayRoutes||!c)return;
    if(win.eval('!!bodyAnim || (body && body.sld && !body.shown)')){win.eval('bodyAnim=null; if(body&&body.sld)bodyJump(0);');win.drawSldShapes();}
    const cx=c.getContext('2d'),dpr=Math.min(3,win.devicePixelRatio||1);cx.save();cx.setTransform(dpr,0,0,dpr,0,0);
    if(selectedModule){const s=D.shapes.find(s=>s.role==='module'&&s.node===selectedModule);if(s){cx.beginPath();s.pts.map(win.shapePoint).forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.strokeStyle='#fff0a0';cx.lineWidth=3;cx.stroke();}}
    for(const s of D.shapes.filter(s=>s.role==='module')){const pts=s.pts.map(win.shapePoint);cx.beginPath();pts.forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.closePath();cx.fillStyle=s.node.startsWith(selectedString+'-')?'rgba(14,37,50,.12)':'rgba(6,12,20,.76)';cx.fill();}
    for(const l of D.arrayRoutes.filter(l=>l.stringId===selectedString)){const points=l.drawingPoints.map(win.shapePoint);cx.beginPath();points.forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.lineWidth=3.4;cx.strokeStyle=l.reaches?'#65ffe0':'#ffd48a';cx.setLineDash(l.reaches?[]:[6,4]);cx.stroke();cx.setLineDash([]);const a=points[1]||points[0],b=points[2]||points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len>18){const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,ux=dx/len,uy=dy/len;cx.beginPath();cx.moveTo(x+ux*5,y+uy*5);cx.lineTo(x-ux*4-uy*3,y-uy*4+ux*3);cx.lineTo(x-ux*4+uy*3,y-uy*4-ux*3);cx.closePath();cx.fillStyle=cx.strokeStyle;cx.fill();}}
    for(const t of D.arrayTerminals.filter(t=>t.stringId===selectedString)){const p=win.shapePoint(t.drawingPoint);cx.font='bold 13px system-ui';cx.textAlign='center';cx.fillStyle='#ffe5a0';cx.fillText(t.id.endsWith('+')?selectedString+' + END':selectedString+' − END',p[0],p[1]+32);}
    for(const h of D.arrayHomes||[]){const selected=h.stringId===selectedString;cx.globalAlpha=selected?1:.15;cx.beginPath();h.drawingPoints.map(win.shapePoint).forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.strokeStyle=h.sign==='+'?'#ff6c62':'#c5d8e5';cx.lineWidth=selected?2.8:1;cx.stroke();}cx.globalAlpha=1;
    if(trace!==null){
      const string=model.strings.find(s=>s.id===selectedString),steps=[];
      const homeMinus=D.arrayHomes?.find(h=>h.stringId===selectedString&&h.sign==='-'),homePlus=D.arrayHomes?.find(h=>h.stringId===selectedString&&h.sign==='+');if(homeMinus)steps.push({route:homeMinus});
      for(let i=0;i<string.order.length;i++){steps.push({module:string.order[i]});if(i<string.order.length-1)steps.push({route:D.arrayRoutes.find(l=>l.from===string.order[i]&&l.to===string.order[i+1])});}
      if(homePlus)steps.push({route:homePlus});
      const t=(performance.now()-traceStarted)/650,step=steps[Math.floor(t)%steps.length],u=t%1;
      let pts;
      if(step.module)pts=D.shapes.find(s=>s.role==='module'&&s.node===step.module).pts;
      else pts=win.polySlice(step.route.drawingPoints,Math.max(0,u-.24),u);
      if(pts?.length>1){const screen=pts.map(win.shapePoint);cx.save();cx.globalCompositeOperation='lighter';cx.shadowColor='#7ff0ff';cx.shadowBlur=18;cx.beginPath();screen.forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.lineWidth=step.module?3:7;cx.strokeStyle='rgba(86,214,255,0.45)';cx.stroke();cx.shadowBlur=6;cx.lineWidth=step.module?1.4:2.5;cx.strokeStyle='rgba(224,250,255,0.95)';cx.stroke();cx.restore();}
    }
    if(D.arrayInspect){const info=D.arrayInspect,sign=info.part?.endsWith('-')?'-':'+',link=model.links.find(l=>sign==='+'?l.from===info.id:l.to===info.id),connector=info.part?.startsWith('C')&&link?D.shapes.find(s=>s.node==='L'+link.sequence&&(s.role==='mate'||s.role==='plug'&&s.male===(sign==='+'))):null,box=D.shapes.find(s=>s.role==='box'&&s.node===info.id+sign),s=connector||box;if(s){const p=win.shapePoint(s.pts[0]);cx.beginPath();cx.arc(...p,12,0,Math.PI*2);cx.strokeStyle='#8befff';cx.lineWidth=2;cx.stroke();cx.font='bold 11px system-ui';cx.fillStyle='#b9f7ff';cx.textAlign='center';cx.fillText(info.label,p[0],p[1]-20);if(info.part?.startsWith('C')&&!connector)cx.fillText('Free-end outlet · connector placement unresolved',p[0],p[1]-35);}}
    if(moduleDrag?.preview){const map=p=>win.shapePoint([(rear?-p[0]:p[0])-D.arrayMap.center[0],-p[1]-D.arrayMap.center[1]].map((v,i)=>v*D.perM*(i?-1:1))),m=moduleDrag.preview.modules.find(m=>m.id===selectedModule);cx.strokeStyle='#fff0a0';cx.fillStyle='rgba(250,220,100,.16)';cx.lineWidth=2;cx.beginPath();m.corners.map(map).forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.closePath();cx.fill();cx.stroke();for(const l of moduleDrag.preview.links.filter(l=>l.from===selectedModule||l.to===selectedModule)){cx.beginPath();l.points.map(map).forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.strokeStyle=l.reaches?'#65ffe0':'#ffd48a';cx.setLineDash(l.reaches?[]:[5,4]);cx.stroke();}cx.setLineDash([]);}
    cx.restore();
  }
  function stopTrace(){trace=null;cancelAnimationFrame(traceRequest);$('trace').textContent='Trace wiring';$('trace').classList.remove('active');$('trace-note').textContent='Trace previews the selected wiring order; it is not electrical current.';if(engineReady)frame.contentWindow.eval('dirty=true');}
  function undo(){if(!undoStack.length)return;const r=undoStack.at(-1);build(clone(r));redoStack.push(clone(recipe));undoStack.pop();replayHistory=true;try{apply(r,false,{preserveCamera:true});}finally{replayHistory=false;historyButtons();}}
  function redo(){if(!redoStack.length)return;const r=redoStack.at(-1);build(clone(r));undoStack.push(clone(recipe));redoStack.pop();replayHistory=true;try{apply(r,false,{preserveCamera:true});}finally{replayHistory=false;historyButtons();}}
  function poseRecipe(id,pose){const r=clone(recipe);r.modulePlacements={...(r.modulePlacements||{}),[id]:clone(pose)};return r;}
  function enableMove(value){editMode=!!value;moduleDrag=null;stopTrace();$('edit-placement').classList.toggle('active',editMode);$('edit-placement').textContent=editMode?'Finish moving':'Move modules';$('edit-status').textContent=editMode?'Drag a module in plan. Yellow preview cables follow its box outlets; release to commit. Z stays fixed.':'Move mode uses horizontal plan; electrical IDs and orders stay fixed.';if(editMode)showView('plan');}
  function installModuleEditing(){const win=frame.contentWindow;
    // The inherited one-module clamp recentres on every wheel frame. Component editing
    // must retain the pointer anchor and allow a connector to fill the viewport.
    const inheritedClamp=win.stringClampMicro;
    win.stringClampMicro=function(){const D=win.eval('sldShapes');if(D?.arrayRoutes||D?.siteScale||D?.freeCamera===true)return;return inheritedClamp.apply(this,arguments);};
    for(const event of ['wheel','pointerdown'])win.document.addEventListener(event,()=>{if(win.eval('sldShapes&&!!sldShapes.arrayRoutes'))++syncToken;},{capture:true,passive:true});
    win.document.addEventListener('wheel',e=>{const D=win.eval('sldShapes');if((D?.arrayRoutes||D?.siteScale||D?.freeCamera===true)&&e.target.tagName==='CANVAS')e.preventDefault();},{capture:true,passive:false});
    win.document.addEventListener('pointerdown',e=>{
      if(!editMode||view!=='plan'||e.button!==0||e.target.tagName!=='CANVAS')return;const D=win.eval('sldShapes');if(!D?.arrayRoutes)return;
      e.preventDefault();e.stopImmediatePropagation();const hit=[...D.shapes].reverse().find(s=>s.role==='module'&&inside([e.clientX,e.clientY],s.pts.map(win.shapePoint)));
      if(!hit){selectedModule=null;historyButtons();win.eval('dirty=true');return;}
      selectedModule=hit.node;selectedString=model.modules.find(m=>m.id===hit.node).stringId;$('string-select').value=selectedString;historyButtons();
      const pose=clone(model.modules.find(m=>m.id===selectedModule).pose);moduleDrag={id:selectedModule,x:e.clientX,y:e.clientY,pose,ppm:win.shapeScale()*D.perM,moved:false,preview:null,r:null};
      win.eval('tween=null;dirty=true');e.target.setPointerCapture?.(e.pointerId);$('edit-status').textContent=selectedModule+' selected · drag XY / rotate 90° · Z '+pose.originXYZ[2].toFixed(3)+' m';
    },true);
    win.document.addEventListener('pointermove',e=>{if(!moduleDrag)return;e.preventDefault();e.stopImmediatePropagation();const d=moduleDrag,dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)<2&&!d.moved)return;d.moved=true;
      const snap=Number($('edit-snap').value);if(!Number.isFinite(snap)||snap<0||snap>10){error('Snap must be 0 to 10 metres.');return;}
      const q=clone(d.pose),round=v=>snap?Math.round(v/snap)*snap:v;q.originXYZ=[round(d.pose.originXYZ[0]+dx/d.ppm*(rear?-1:1)),round(d.pose.originXYZ[1]-dy/d.ppm),d.pose.originXYZ[2]];
      try{d.r=poseRecipe(d.id,q);d.preview=build(d.r);const links=d.preview.links.filter(l=>l.from===d.id||l.to===d.id);$('edit-status').textContent=d.id+' · XYZ '+q.originXYZ.map(v=>v.toFixed(2)).join(', ')+' m · attached routes '+links.reduce((s,l)=>s+l.routeM,0).toFixed(2)+' m · '+links.filter(l=>!l.reaches).length+' extensions needed';error('');}catch(err){d.r=null;d.preview=null;error(err.message);}win.eval('dirty=true');
    },true);
    win.document.addEventListener('pointerup',e=>{if(!moduleDrag)return;e.preventDefault();e.stopImmediatePropagation();const d=moduleDrag;moduleDrag=null;if(d.moved&&d.r)attempt(()=>apply(d.r,false,{preserveCamera:true}));win.eval('dirty=true');},true);
    win.document.addEventListener('pointercancel',()=>{moduleDrag=null;win.eval('dirty=true');},true);
    win.document.addEventListener('wheel',e=>{if(moduleDrag){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
  }
  function focusModule(id,inspection=null){if(!engineReady)return false;const win=frame.contentWindow,D=win.eval('sldShapes'),s=D?.shapes.find(s=>s.role==='module'&&s.node===id);if(!s)return false;selectedModule=id;if(inspection)D.arrayInspect={id,...inspection};historyButtons();const xs=s.pts.map(p=>p[0]),ys=s.pts.map(p=>p[1]),pad=.35*D.perM,x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,y0=Math.min(...ys)-pad,y1=Math.max(...ys)+pad,b=win.shapeBand(true),R=win.eval('Math.sqrt(SPACE)*BODY_RADIUS_MAX'),z=Math.min((b.right-b.left)*.55/((x1-x0)*R),(b.bottom-b.top)*.65/((y1-y0)*R));++syncToken;win.eval('bodyAnim=null;if(body&&body.sld)bodyJump(0);');setCamera((x0+x1)/2*R-((b.left+b.right)/2-win.innerWidth/2)/z,(y0+y1)/2*R+((b.top+b.bottom)/2-win.innerHeight/2)/z,z);return true;}
  $('edit-placement').onclick=()=>enableMove(!editMode);$('undo-placement').onclick=()=>attempt(undo);$('redo-placement').onclick=()=>attempt(redo);
  $('rotate-module').onclick=()=>attempt(()=>{const m=model.modules.find(m=>m.id===selectedModule);if(!m)return;const p=clone(m.pose);p.rotation=((p.rotation||0)+90)%360;apply(poseRecipe(m.id,p),false,{preserveCamera:true});$('edit-status').textContent=m.id+' rotated to '+p.rotation+'° in its plane. Physical routes recomputed; order retained.';});
  for(const field of ['home-enabled','home-inverters','home-plus','home-minus'])$(field).onchange=()=>attempt(()=>{const r=clone(recipe);r.homeRunsEnabled=$('home-enabled').checked;r.showInverters=$('home-inverters').checked;r.homeRunInstalledM={...(r.homeRunInstalledM||{}),[selectedString+'+']:Number($('home-plus').value),[selectedString+'-']:Number($('home-minus').value)};apply(r,false,{preserveCamera:field==='home-plus'||field==='home-minus'});});
  $('fit-inverter').onclick=()=>attempt(()=>{if(!engineReady)return;const win=frame.contentWindow,D=win.eval('sldShapes'),points=D?.shapes.filter(s=>s.role==='inverter'||s.role==='plug'&&s.equipmentId==='INV-01').flatMap(s=>s.pts);if(!points?.length)throw Error('Enable proposed home runs and the enclosure first.');const pad=.25*D.perM,xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,y0=Math.min(...ys)-pad,y1=Math.max(...ys)+pad,b=win.shapeBand(true),R=win.eval('Math.sqrt(SPACE)*BODY_RADIUS_MAX'),z=Math.min((b.right-b.left)*.75/((x1-x0)*R),(b.bottom-b.top)*.78/((y1-y0)*R));++syncToken;setCamera((x0+x1)/2*R-((b.left+b.right)/2-win.innerWidth/2)/z,(y0+y1)/2*R+((b.top+b.bottom)/2-win.innerHeight/2)/z,z);});
  for(const field of ['name',...parameterFields.map(p=>p[0])])$('mp-'+field).onchange=()=>attempt(()=>{const r=clone(recipe),p={...(r.moduleParameters||{}),name:$('mp-name').value.trim(),source:'user-entered',isOverride:!!r.moduleParameters?.presetId};for(const[k]of parameterFields){const value=$('mp-'+k).value.trim();if(value==='')delete p[k];else p[k]=Number(value);}r.moduleParameters=p;apply(r,false,{preserveCamera:true});});
  $('trace').onclick=()=>{if(trace!==null){stopTrace();return;}trace=0;traceStarted=performance.now();$('trace').textContent='Stop trace';$('trace').classList.add('active');$('trace-note').textContent='Tracing '+selectedString+' only · cyan/white route preview, including proposed extensions · not current.';function tick(){if(trace===null)return;if(engineReady)frame.contentWindow.eval('dirty=true');traceRequest=requestAnimationFrame(tick);}traceRequest=requestAnimationFrame(tick);};
  function attempt(fn){try{fn();}catch(e){error(e.message);}}
  for(const key of fields.concat(['orientation','wiring','placement'])) $(key).addEventListener('change',()=>attempt(()=>apply(readControls())));
  $('module').onchange=()=>attempt(()=>{const m=catalogue.modules.find(x=>x.id===$('module').value);$('width').value=m.widthM;$('length').value=m.heightM;apply(readControls());});
  $('preset').onclick=()=>attempt(()=>{$('count').value=30;$('rows').value=5;$('orientation').value='portrait';$('placement').value='rows';recipe.routeWaypoints={};recipe.modulePlacements={};apply(readControls());});
  $('source-view').onchange=sourceInfo;
  $('link-select').onchange=()=>{selected=Number($('link-select').value);updateSelection();draw();};
  function showView(mode) {
    if(mode!=='plan'&&editMode){editMode=false;moduleDrag=null;$('edit-placement').classList.remove('active');$('edit-placement').textContent='Move modules';}
    view=mode==='kuiper'?'developed':mode;kuiperMode=true;frame.classList.remove('hidden');zoom=1;pan=[0,0];
    for(const key of ['kuiper','plan','three'])$(key).classList.toggle('active',key===mode);draw();syncEngine();
    window.dispatchEvent(new CustomEvent('kuiper:view-changed',{detail:{kind:'table',projection:view,syntheticContext:recipe.syntheticContext||null}}));
  }
  for(const key of ['kuiper','plan','three'])$(key).onclick=()=>showView(key);
  for(const [button,value] of [['rear',true],['front',false]]) $(button).onclick=()=>{rear=value;$('rear').classList.toggle('active',rear);$('front').classList.toggle('active',!rear);draw();syncEngine();};
  $('fit').onclick=()=>{focusString=false;fitNative(false);};
  $('fit-string').onclick=()=>{focusString=true;fitNative(true);};
  $('string-select').onchange=()=>{stopTrace();selectedString=$('string-select').value;selected=model.links.findIndex(l=>l.stringId===selectedString);updateSelection();syncHomeControls();focusString=true;fitNative(true);frame.contentWindow.eval('dirty=true');};
  $('apply').onclick=()=>attempt(()=>apply(JSON.parse($('recipe').value)));
  $('refresh').onclick=()=>{$('recipe').value=JSON.stringify(recipe,null,2);};
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify(recipe,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='kuiper-table-recipe.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  $('load').onclick=()=>$('file').click();$('file').onchange=async()=>{try{const f=$('file').files[0];if(!f)return;if(f.size>500000)throw Error('Recipe exceeds 500 KB.');apply(JSON.parse(await f.text()));}catch(e){error(e.message);}finally{$('file').value='';}};
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,px:pan[0],py:pan[1],moved:false};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved ||= Math.hypot(dx,dy)>4;pan=[drag.px+dx,drag.py+dy];draw();});
  canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const b=canvas.getBoundingClientRect(),p=[e.clientX-b.left,e.clientY-b.top];let best={d:14,index:-1};for(const link of linkHits)for(let i=1;i<link.points.length;i++){const d=segDistance(p,link.points[i-1],link.points[i]);if(d<best.d)best={d,index:link.index};}if(best.index<0){const hit=scene.find(m=>inside(p,m.points));if(hit)best.index=model.links.findIndex(l=>l.from===hit.id||l.to===hit.id);}if(best.index>=0){selected=best.index;updateSelection();draw();}}drag=null;});
  canvas.addEventListener('pointercancel',()=>{drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const b=canvas.getBoundingClientRect(),p=[e.clientX-b.left-b.width/2,e.clientY-b.top-b.height/2],old=zoom;zoom=Math.max(.3,Math.min(14,zoom*Math.exp(-e.deltaY*.001)));const ratio=zoom/old;pan=pan.map((v,i)=>p[i]-(p[i]-v)*ratio);draw();},{passive:false});
  function segDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
  function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  let animation=0,lastTime=0;
  $('follow').onclick=()=>attempt(()=>{if(!engineReady)return;const win=frame.contentWindow,D=win.eval('sldShapes'),points=D.shapes.filter(s=>s.node==='L'+selected).flatMap(s=>s.pts);if(!points.length)return;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),pad=.3*D.perM,x0=Math.min(...xs)-pad,x1=Math.max(...xs)+pad,y0=Math.min(...ys)-pad,y1=Math.max(...ys)+pad,b=win.shapeBand(true),R=win.eval('Math.sqrt(SPACE)*BODY_RADIUS_MAX'),z=Math.min((b.right-b.left)*.75/((x1-x0)*R),(b.bottom-b.top)*.75/((y1-y0)*R));win.flyTo((x0+x1)/2*R-((b.left+b.right)/2-win.innerWidth/2)/z,(y0+y1)/2*R+((b.top+b.bottom)/2-win.innerHeight/2)/z,z);});
  new ResizeObserver(()=>{draw();drawDetail();}).observe(canvas.parentElement);
  window.__arrayLab={build,apply,read:()=>clone(model),recipe:()=>clone(recipe),setProjection:showView,focusModule,resetHistory:()=>{undoStack.length=0;redoStack.length=0;historyButtons();},editing:()=>({enabled:editMode,selectedModule,undo:undoStack.length,redo:redoStack.length,dragging:!!moduleDrag}),get feed(){return feed;},get engineReady(){return engineReady;}};
  const m=catalogue.modules[0];$('width').value=m.widthM;$('length').value=m.heightM;
  apply(readControls());
  feed=await feedPromise;if(feed)apply(recipe,false);
  let attempts=0;
  const ready=setInterval(()=>{try{const win=frame.contentWindow;if(++attempts>300){clearInterval(ready);frame.classList.add('hidden');error('Original Kuiper load timed out; generic geometry inspection remains available.');return;}if(!win.FIRE||typeof win.fireCommand!=='function'||!win.eval('typeof N!=="undefined" && N>0 && typeof lastFire!=="undefined" && !!lastFire'))return;clearInterval(ready);engineReady=true;win.FIRE.register('array-lab-table','TABLE WIRING',nativeDrawing,[]);win.FIRE_SLD_KIND['array-lab-table']='string';const style=win.document.createElement('style');style.textContent='#foot,#presets,#top,#say{display:none!important}#c{opacity:0}#sldshapes{background:#090c13}';win.document.head.append(style);win.__wafer?.onDraw?.add(highlightNative);installModuleEditing();apply(recipe,false);setTimeout(()=>{if(win.eval('lastFire&&lastFire.name')==='string')syncEngine();},1200);}catch(e){error(e.message);}},100);
})().catch(e=>{document.getElementById('error').textContent=e.message;document.getElementById('view-status').textContent='Drawing could not load';console.error(e);});
