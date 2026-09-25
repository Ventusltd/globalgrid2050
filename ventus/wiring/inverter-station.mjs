const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
export const sources={cable:'#drawing-basis',inverter:'#drawing-basis',aluminiumAlpha:'IEC 60228:2004 informative Annex B, printed page 29; general aluminium alpha20 = 0.00403 / K; alloy-specific coefficient requires manufacturer data'};
export function buildStation({feedersPerSection=14,transformerMva=5,areaMm2=400,trenchDepthM=.9,kva=352,lengths={},ambient=30,baseAmpacity=null,derating=1,r20=.0778,conductorTemp=20,alpha=.00403,racFactor=null,reactance=null,pf=1}={}) {
 if(!Number.isInteger(feedersPerSection)||feedersPerSection<1||feedersPerSection>20||!Number.isFinite(transformerMva)||transformerMva<=0||transformerMva>100||!Number.isFinite(areaMm2)||areaMm2<16||areaMm2>1000||!Number.isFinite(trenchDepthM)||trenchDepthM<.1||trenchDepthM>5)throw Error('Invalid station geometry');
 if(![352,320,295].includes(kva)||!Number.isFinite(ambient)||ambient< -40||ambient>90||!Number.isFinite(derating)||derating<=0||derating>1)throw Error('Station input outside supported range');
 if(baseAmpacity!==null&&(!Number.isFinite(baseAmpacity)||baseAmpacity<=0||baseAmpacity>5000))throw Error('Base ampacity must be positive');
 for(const [v,min,max]of [[r20,.0001,10],[conductorTemp,-40,90],[alpha,0,.01],[pf,.01,1]])if(!Number.isFinite(v)||v<min||v>max)throw Error('Conductor calculation input outside range');
 if(racFactor!==null&&(!Number.isFinite(racFactor)||racFactor<1||racFactor>10)||reactance!==null&&(!Number.isFinite(reactance)||reactance<0||reactance>10))throw Error('AC resistance or reactance input outside range');
 const rTheta=r20*(1+alpha*(conductorTemp-20));
 const inverters=[],cables=[],sections=[],lineCurrent=kva*1000/(Math.sqrt(3)*800);
 for(let s=0;s<2;s++){
  const sectionId='LV-'+(s+1),ids=[];
  for(let i=0;i<feedersPerSection;i++){
   const id='INV-'+String(s*feedersPerSection+i+1).padStart(2,'0');ids.push(id);inverters.push({id,sectionId,model:'352 kVA inverter',kva,lineCurrentA:lineCurrent});
   for(let p=1;p<=3;p++){const cableId=id+'-L'+p,value=lengths[cableId]??0;if(!Number.isFinite(value)||value<0||value>10000)throw Error('Cable length outside range');const rdc=value?rTheta*value/1000:null;cables.push({id:cableId,inverterId:id,sectionId,phase:'L'+p,areaMm2,trenchDepthM,shieldMm2:39,material:'Al',part:'reference',lengthM:value||null,ambientC:ambient,baseAmpacityA:baseAmpacity,derating,deratedAmpacityA:baseAmpacity===null?null:baseAmpacity*derating,currentA:lineCurrent,resistanceDcOhm:rdc,dcResistanceLossW:rdc===null?null:lineCurrent**2*rdc,acResistanceLossW:rdc===null||racFactor===null?null:lineCurrent**2*rdc*racFactor});}
  }
  sections.push({id:sectionId,inverters:ids,phases:['L1','L2','L3'],busRatingA:4000,lineCurrentA:feedersPerSection*lineCurrent,kva:feedersPerSection*kva,transformer:'TX-'+(s+1),transformerRatingKva:transformerMva*1000});
 }
 const feeders=inverters.map(inv=>{const cs=cables.filter(c=>c.inverterId===inv.id),complete=cs.every(c=>c.lengthM!==null),balanced=complete&&cs.every(c=>Math.abs(c.lengthM-cs[0].lengthM)<1e-8),delta=balanced&&racFactor!==null&&reactance!==null?Math.sqrt(3)*lineCurrent*cs[0].lengthM/1000*(rTheta*racFactor*pf+reactance*Math.sqrt(1-pf*pf)):null;return {id:inv.id,complete,balanced,dcResistanceLossW:complete?cs.reduce((n,c)=>n+c.dcResistanceLossW,0):null,acResistanceLossW:complete&&racFactor!==null?cs.reduce((n,c)=>n+c.acResistanceLossW,0):null,voltageDifferenceV:delta,voltageDifferencePct:delta===null?null:delta/8};});
 return {design:{feedersPerSection,transformerMva,areaMm2,trenchDepthM},schema:'VENTUS.inverter-station/1',voltageLL:800,kvaPerInverter:kva,inverters,cables,feeders,sections,transformers:sections.map(s=>({id:s.transformer,from:s.id,ratedKva:transformerMva*1000,connectedKva:s.kva})),totalMva:2*feedersPerSection*kva/1000,lineCurrentA:lineCurrent,ambientC:ambient,baseAmpacityA:baseAmpacity,derating,electricalInputs:{r20,conductorTemp,alpha,racFactor,reactance,pf,rTheta},sources,cableSpecificationStatus:'Entered generic 400 mm² aluminium phase-cable scenario; validate actual cable construction and installation before use',scope:'Phase connectivity, nameplate arithmetic and entered-length conductor scenario. No protection or cable suitability verdict.'};
}
let design={feedersPerSection:14,transformerMva:5,areaMm2:400,trenchDepthM:.9};
let entered={},playing=true,model=buildStation(design);
const el=(name,attrs={},text)=>{const e=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;};
const txt=(parent,text,x,y,size=13,fill)=>{const e=el('text',{x,y,'font-size':size,...(fill?{style:'fill:'+fill}:{})},text);parent.append(e);};
function line(parent,d,attrs={}){const e=el('path',{d,fill:'none',stroke:'#9db7cb','stroke-width':2,...attrs});parent.append(e);return e;}
function render(){
 const svg=$('drawing');svg.replaceChildren();svg.classList.toggle('paused',!playing);
 const defs=el('defs'),filter=el('filter',{id:'neon',filterUnits:'userSpaceOnUse',x:0,y:0,width:2000,height:930});filter.append(el('feGaussianBlur',{stdDeviation:2,result:'blur'}));const merge=el('feMerge');merge.append(el('feMergeNode',{in:'blur'}),el('feMergeNode',{in:'SourceGraphic'}));filter.append(merge);defs.append(filter);const arrow=el('marker',{id:'power-arrow',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'});arrow.append(el('path',{d:'M0 0 L10 5 L0 10 Z',fill:'#b8f5fa'}));defs.append(arrow);svg.append(defs,el('rect',{width:2000,height:930,fill:'#090c13'}));
 txt(svg,model.inverters.length+' x '+model.kvaPerInverter+' kVA / 800 V THREE-PHASE AC',40,32,18,'#8edfe7');txt(svg,'NOT TO SCALE',1730,32,23,'#b9b6ab');
 const colours=['#ff927a','#c6ceda','#81cce8'];
 model.sections.forEach((section,s)=>{
  const top=75+s*415;txt(svg,'SECTION '+(s+1)+' / '+section.inverters.length+' INVERTERS / '+(section.inverters.length*3)+' PHASE CABLES',40,top,18,'#95e3e7');
  for(let p=0;p<3;p++){const by=top+222+p*22,elbow=1690-p*20;line(svg,'M55 '+by+' H'+elbow+' V'+(top+280+p*24)+' H1710',{stroke:colours[p],'stroke-width':6,'data-bus-phase':section.id+'-L'+(p+1)});line(svg,'M'+(elbow+3)+' '+(top+280+p*24)+' H1704',{stroke:'#b8f5fa','stroke-width':1.5,'marker-end':'url(#power-arrow)'});txt(svg,'L'+(p+1),19,by+5,13,colours[p]);}
  section.inverters.forEach((id,i)=>{
   const x=45+i*(1568/section.inverters.length),y=top+35;svg.append(el('rect',{x,y,width:92,height:83,rx:2,fill:'#111c28',stroke:'#8ba6bb','data-inverter':id}));
   txt(svg,id,x+8,y+20,13);txt(svg,'352 kVA inverter',x+8,y+38,11);txt(svg,model.kvaPerInverter+' kVA',x+8,y+56,11);txt(svg,model.lineCurrentA.toFixed(1)+' A',x+8,y+73,11,'#8edfe7');
   for(let p=0;p<3;p++){const px=x+23+p*23,end=top+222+p*22,d='M'+px+' '+(y+83)+' V'+end,cable=model.cables.find(c=>c.id===id+'-L'+(p+1));
    line(svg,d,{stroke:'#090c13','stroke-width':6});line(svg,d,{stroke:colours[p],'stroke-width':2,'data-cable':cable.id});line(svg,d,{class:'power','aria-hidden':'true'});
    svg.append(el('circle',{cx:px,cy:end,r:4,fill:colours[p]}));txt(svg,'L'+(p+1),px-8,y+99,9,colours[p]);
    const label=el('text',{x:px-4,y:end-8,transform:'rotate(-90 '+(px-4)+' '+(end-8)+')','font-size':10,'data-length-label':cable.id,style:'fill:'+colours[p]+';paint-order:stroke;stroke:#090c13;stroke-width:3;stroke-linejoin:round;pointer-events:none'},cable.lengthM===null?'ENTER m':cable.lengthM+' m · entered');svg.append(label);
    const hit=el('rect',{x:px-8,y:y+83,width:16,height:end-y-83,fill:'transparent','data-edit-cable':cable.id,role:'button',tabindex:0,'aria-label':'Edit '+cable.id+' entered length',style:'cursor:pointer;pointer-events:all'});svg.append(hit);hit.append(el('title',{},cable.id+' · '+(cable.lengthM===null?'length not entered':'entered '+cable.lengthM+' m')+' · click to edit'));hit.onclick=()=>{$('inverter').value=id;syncLengths();$('hud').hidden=false;$('analysis').setAttribute('aria-expanded','true');$('len'+(p+1)).focus();$('len'+(p+1)).select();};hit.onpointerdown=e=>{e.preventDefault();document.activeElement?.blur();hit.onclick();};hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hit.onclick();}};
   }
  });
  txt(svg,'3 × 1C 400 mm² Al PER INVERTER  /  SELECT A FEEDER IN THE HUD TO ENTER LENGTHS',45,top+21,11,'#809cad');
  txt(svg,section.id+'  /  4,000 A THREE-PHASE ASSEMBLY',45,top+310,17,'#a5e3e8');
  txt(svg,section.lineCurrentA.toFixed(2)+' A RMS PER PHASE  /  '+(section.kva/1000).toFixed(3)+' MVA CONNECTED',45,top+337,15);
  txt(svg,(section.lineCurrentA/4000*100).toFixed(2)+'% OF STATED BUS RATING  /  PROTECTION AND INSTALLATION NOT ASSESSED',45,top+361,11,'#97aabc');
  const ty=top+235;svg.append(el('rect',{x:1710,y:ty,width:245,height:150,rx:3,fill:'#101c29',stroke:'#89a9bd','data-transformer':section.transformer}));txt(svg,section.transformer+' / TRANSFORMER',1727,ty+25,16,'#99e1e7');
  for(let p=0;p<3;p++){svg.append(el('circle',{cx:1748,cy:ty+53+p*24,r:10,fill:'none',stroke:colours[p],'stroke-width':2}),el('circle',{cx:1760,cy:ty+53+p*24,r:10,fill:'none',stroke:colours[p],'stroke-width':2}));}
  txt(svg,(section.kva/1000).toFixed(3)+' MVA',1786,ty+64,16);txt(svg,'CONNECTED INPUT',1786,ty+82,11);txt(svg,model.design.transformerMva+' MVA ASSUMED RATING',1727,ty+130,11);txt(svg,'HV / VECTOR: UNASSIGNED',1727,ty+145,11);
 });
 txt(svg,'NEON = AVERAGE AC POWER DIRECTION TOWARD THE BUSBARS. AC ELECTRONS OSCILLATE; THESE ARE NOT ELECTRON TRAJECTORIES.',40,900,12,'#83bdcc');
 $('total-rating').textContent=(20*model.design.transformerMva)+' MVA site / '+(2*model.design.transformerMva)+' MVA station';
 $('arithmetic').textContent='I = S / (√3 × 800 V) = '+model.lineCurrentA.toFixed(3)+' A per inverter; '+model.design.feedersPerSection+' x I = '+model.sections[0].lineCurrentA.toFixed(2)+' A per phase per section. Each section: '+(model.sections[0].kva/1000).toFixed(3)+' MVA.';
 $('ampacity-result').textContent=model.baseAmpacityA===null?'Cable ampacity: unresolved. No installation rating entered.':'Entered base × factor = '+(model.baseAmpacityA*model.derating).toFixed(1)+' A; nameplate-current margin '+(model.baseAmpacityA*model.derating-model.lineCurrentA).toFixed(1)+' A. Input comparison only; suitability unresolved.';
 lossReadout();
}
function lossReadout(){const id=$('inverter').value,f=model.feeders.find(f=>f.id===id),cs=model.cables.filter(c=>c.inverterId===id);if(!f)return;$('loss-result').textContent=cs.map(c=>c.phase+': '+(c.resistanceDcOhm===null?'length unknown':c.resistanceDcOhm.toFixed(5)+' Ω; I²Rdc '+c.dcResistanceLossW.toFixed(1)+' W'+(c.acResistanceLossW===null?'':'; I²Rac '+c.acResistanceLossW.toFixed(1)+' W'))).join('\n')+'\n'+(f.voltageDifferenceV!==null?'Balanced ΔV: '+f.voltageDifferenceV.toFixed(3)+' V ('+f.voltageDifferencePct.toFixed(3)+'%).':!f.complete?'Voltage difference unresolved: enter all three phase lengths.':!f.balanced?'Unequal phase lengths: balanced voltage formula not applied.':'Voltage difference unresolved: enter AC/DC factor and reactance.');$('loss-result').style.whiteSpace='pre-line';}
function rebuild(){try{model=buildStation({...design,kva:Number($('rating').value),lengths:entered,ambient:Number($('ambient').value),baseAmpacity:$('ampacity').value===''?null:Number($('ampacity').value),derating:Number($('derating').value),r20:Number($('r20').value),conductorTemp:Number($('conductor-temp').value),alpha:Number($('alpha').value),racFactor:$('rac').value===''?null:Number($('rac').value),reactance:$('reactance').value===''?null:Number($('reactance').value),pf:Number($('pf').value)});render();$('status').textContent='84 individual phase cables · L1 / L2 / L3 · neon shows average AC power direction · dots mark joints';}catch(e){$('status').textContent=e.message;}}
function syncLengths(){for(let p=1;p<=3;p++)$('len'+p).value=entered[$('inverter').value+'-L'+p]??0;lossReadout();}
function save(name,type,data){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function svgExport(){const copy=$('drawing').cloneNode(true);copy.querySelectorAll('.power').forEach(e=>e.remove());copy.setAttribute('width','3000');copy.setAttribute('height','1395');const style=el('style',{},'text{font-family:Consolas,monospace;fill:#bbd0e1}');copy.prepend(style);return new XMLSerializer().serializeToString(copy);}
function csv(){return 'cable,inverter,section,phase,area_mm2,material,length_m,current_A,ambient_C,base_ampacity_A,derating,derated_ampacity_A,Rdc_ohm,I2Rdc_W,I2Rac_W,conductor_C,R20_ohm_km,alpha_per_K,Rac_factor,reactance_ohm_km,power_factor\n'+model.cables.map(c=>[c.id,c.inverterId,c.sectionId,c.phase,c.areaMm2,c.material,c.lengthM??'',c.currentA.toFixed(6),c.ambientC,c.baseAmpacityA??'',c.derating,c.deratedAmpacityA??'',c.resistanceDcOhm??'',c.dcResistanceLossW??'',c.acResistanceLossW??'',model.electricalInputs.conductorTemp,model.electricalInputs.r20,model.electricalInputs.alpha,model.electricalInputs.racFactor??'',model.electricalInputs.reactance??'',model.electricalInputs.pf].join(',')).join('\n');}
for(const inv of model.inverters)$('inverter').add(new Option(inv.id+' · '+inv.sectionId,inv.id));$('inverter').onchange=syncLengths;
for(let p=1;p<=3;p++)$('len'+p).onchange=()=>{entered[$('inverter').value+'-L'+p]=Number($('len'+p).value);rebuild();};
for(const id of ['rating','ambient','ampacity','derating','r20','conductor-temp','alpha','rac','reactance','pf'])$(id).onchange=rebuild;
$('controls').onclick=()=>{$('toolbar').hidden=!$('toolbar').hidden;$('controls').setAttribute('aria-expanded',String(!$('toolbar').hidden));};
$('analysis').onclick=()=>{$('hud').hidden=!$('hud').hidden;$('analysis').setAttribute('aria-expanded',String(!$('hud').hidden));};$('close-hud').onclick=()=>{$('hud').hidden=true;$('analysis').setAttribute('aria-expanded','false');};
$('whole').onclick=()=>$('viewport').classList.remove('large');$('large').onclick=()=>$('viewport').classList.add('large');$('flow').onclick=()=>{playing=!playing;$('flow').textContent=playing?'Pause power flow':'Animate power flow';render();};$('fullscreen').onclick=()=>document.documentElement.requestFullscreen();
$('save-svg').onclick=()=>save('inverter-station-NOT-TO-SCALE.svg','image/svg+xml',svgExport());$('save-csv').onclick=()=>save('inverter-station-84-phase-cables.csv','text/csv',csv());
$('cable-source').href=sources.cable;$('inverter-source').href=sources.inverter;syncLengths();render();window.__inverterStation={get model(){return structuredClone(model);},buildStation,csv,svg:svgExport};

// Ten repeated generic station blocks; no surveyed layout or confidential data.
let selectedStation=1;
function siteModel(){return {stationCount:10,transformerCount:20,transformerCapacityMva:20*model.design.transformerMva,inverterCount:10*model.inverters.length,acPhaseCableCount:10*model.cables.length,trenchDepthM:model.design.trenchDepthM,phaseConductorAreaMm2:model.design.areaMm2,hvVoltageKv:33,hvAreaMm2:1000,connectedInverterMva:10*model.totalMva};}
function selectStation(id){selectedStation=id;document.querySelectorAll('[data-station]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.station)===id)));$('station-selected').textContent='STATION '+id+' / 10 | 2 x '+model.design.transformerMva+' MVA | '+model.inverters.length+' inverters | '+model.cables.length+' AC phase cables';render();}
const overview=$('station-overview');
for(let i=1;i<=10;i++){const button=document.createElement('button');button.dataset.station=i;button.textContent=String(i).padStart(2,'0')+' · 10 MVA';button.onclick=()=>selectStation(i);overview.append(button);}
Object.defineProperties(window.__inverterStation,{site:{get:siteModel},selectedStation:{get:()=>selectedStation}});selectStation(1);

const trench=document.createElement('p');trench.id='trench-default';trench.style.cssText='margin:4px 12px;font:12px monospace;flex-shrink:0';trench.textContent='AC trench depth 0.90 m ? each inverter: 3 ? 400 mm? Al ? 352 kVA at 800 V ? cable spacing, cover and installation rating not assigned';document.querySelector('header').after(trench);

window.__inverterStation.setDesign=value=>{const next={...design,...value};buildStation(next);design=next;entered={};rebuild();$('inverter').replaceChildren(...model.inverters.map(i=>new Option(i.id,i.id)));syncLengths();selectStation(selectedStation);document.querySelectorAll('[data-station]').forEach(b=>b.textContent=b.dataset.station+' | '+(2*design.transformerMva)+' MVA');};
