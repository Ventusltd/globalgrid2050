'use strict';
(function boot(){
 if(!window.__arrayLab?.engineReady){setTimeout(boot,200);return;}
 function build(){
  const m=__arrayLab.read(),r=__arrayLab.recipe(),copy=v=>JSON.parse(JSON.stringify(v));
  const components=m.modules.map(x=>({id:x.id,kind:'pv-module',lifecycle:'proposed',approval:'unapproved',stringId:x.stringId,pose:copy(x.pose),cornersXYZM:copy(x.corners),thicknessM:x.thicknessM,parameters:copy(r.moduleParameters||{}),ports:[{id:x.id+'-',polarity:'negative',xyzM:copy(x.minus)},{id:x.id+'+',polarity:'positive',xyzM:copy(x.plus)}]}));
  const ports=m.inverterInputs.flatMap(x=>[{id:'INV-'+x.stringId+'-',polarity:'negative',xyzM:copy(x.minusXYZ)},{id:'INV-'+x.stringId+'+',polarity:'positive',xyzM:copy(x.plusXYZ)}]);
  if(ports.length)components.push({id:'INV-01',kind:'string-inverter-enclosure',lifecycle:'proposed',approval:'unapproved',ports,internalCircuit:null,mpptAssignments:null,portGeometryVerified:false});
  const cables=m.links.map(x=>({id:x.key,kind:'intermodule',from:x.from+'+',to:x.to+'-',stringId:x.stringId,routeXYZM:copy(x.points),routeM:x.routeM,requiredWithSlackM:x.needM,availableLeadPairM:x.pairM,extensionShortfallM:x.shortM,lifecycle:'proposed',installed:false}));
  for(const x of m.homeRuns)cables.push({id:'HOME/'+x.key,kind:'home-run',from:x.from,to:x.to,stringId:x.stringId,routeXYZM:copy(x.points),routeM:x.routeM,requiredWithSlackM:x.needM,enteredInstalledLengthM:x.installedM,extensionShortfallM:x.shortM,lifecycle:'proposed',installed:false});
  const ids=new Set(components.flatMap(x=>x.ports.map(p=>p.id)));
  if(cables.some(c=>!ids.has(c.from)||!ids.has(c.to)))throw Error('Cable references an absent terminal.');
  return {schema:'kuiper.design-record/1',createdAt:new Date().toISOString(),scope:'current table only',coordinateSystem:{kind:'local Cartesian',units:'m',georeferenced:false},lifecycle:'proposed',approval:'unapproved',components,cables,strings:copy(m.strings),quantities:{modules:m.modules.length,strings:m.strings.length,seriesLinks:m.links.length,homeRuns:m.homeRuns.length,intermoduleRouteM:m.totalRouteM,homeRouteM:m.homeRouteM},limitations:['Proposed cable graph; not a commissioned circuit.','Inverter internal connections and MPPT assignment remain unknown.','Routes have not been checked against site obstacles.','Local XYZ must not be interpreted as geographic coordinates.']};
 }
 const panel=document.createElement('details');panel.id='design-record';panel.style.cssText='padding:16px;border-top:1px solid #35475a';panel.innerHTML='<summary>Design record · components and connections</summary><p class="note">Export this table’s proposed components, named terminals, cable routes, module parameters and quantities. Stable drawing IDs connect the records. Site-wide quantities and grid studies are separate; this record does not mark equipment installed or approved.</p><button id="design-record-save">Download table design record</button><p id="design-record-status" role="status" class="note"></p>';
 document.querySelector('main').append(panel);
 panel.querySelector('button').onclick=()=>{try{const record=build(),url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='kuiper-proposed-table.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);panel.querySelector('[role=status]').textContent=record.components.length+' components and '+record.cables.length+' proposed cables exported.';}catch(e){panel.querySelector('[role=status]').textContent=e.message;}};
 window.__designRecord={build};
})();
