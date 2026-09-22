/* Generic whole-site collection geometry. No project boundary or MV circuit inference. */
(function(root){'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function finite(v,name,min,max,integer=false){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))throw Error(name+' is outside the supported range');return v;}
function length(points){let n=0;for(let i=1;i<points.length;i++)n+=Math.hypot(...points[i].map((v,j)=>v-points[i-1][j]));return n;}
// All geometry lies on one explicitly assumed ground layer. Merge collinear
// intervals, then split every resulting interval at perpendicular crossings.
function roadUnion(roads){
 const groups=new Map();
 for(const road of roads)for(let i=1;i<road.points.length;i++){
  const a=road.points[i-1],b=road.points[i];for(const p of [a,b])if(!Array.isArray(p)||p.length!==3||p.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw Error('Finite XYZ road points required');if(a[2]!==0||b[2]!==0)throw Error('Only the assumed ground road layer is supported');
  if(a[0]!==b[0]&&a[1]!==b[1])throw Error('Road segments must be axis aligned');
  const h=a[1]===b[1],lo=Math.min(a[h?0:1],b[h?0:1]),hi=Math.max(a[h?0:1],b[h?0:1]);if(lo===hi)continue;
  const fixed=a[h?1:0],key=(h?'h:':'v:')+fixed;if(!groups.has(key))groups.set(key,{horizontal:h,fixed,intervals:[]});groups.get(key).intervals.push({lo,hi});
 }
 const merged=[];
 for(const group of groups.values()){group.intervals.sort((a,b)=>a.lo-b.lo);let active=null;for(const item of group.intervals){if(!active||item.lo>active.hi){active={horizontal:group.horizontal,fixed:group.fixed,lo:item.lo,hi:item.hi};merged.push(active);}else active.hi=Math.max(active.hi,item.hi);}}
 const h=merged.filter(s=>s.horizontal),v=merged.filter(s=>!s.horizontal);for(const s of merged)s.cuts=new Set([s.lo,s.hi]);
 // Preserve input endpoints even where merging removed an intermediate vertex.
 for(const group of groups.values())for(const s of merged){if(s.horizontal!==group.horizontal||s.fixed!==group.fixed)continue;for(const i of group.intervals)for(const x of [i.lo,i.hi])if(x>=s.lo&&x<=s.hi)s.cuts.add(x);}
 for(const a of h)for(const b of v)if(b.fixed>=a.lo&&b.fixed<=a.hi&&a.fixed>=b.lo&&a.fixed<=b.hi){a.cuts.add(b.fixed);b.cuts.add(a.fixed);}
 const segments=[];for(const s of merged){const cuts=[...s.cuts].sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++)segments.push({id:'ROAD-UNION-'+String(segments.length+1).padStart(6,'0'),layer:'assumed-ground',points:s.horizontal?[[cuts[i-1],s.fixed,0],[cuts[i],s.fixed,0]]:[[s.fixed,cuts[i-1],0],[s.fixed,cuts[i],0]],lengthM:cuts[i]-cuts[i-1]});}
 return{segments,lengthM:segments.reduce((a,s)=>a+s.lengthM,0),meaning:'Unique road centreline length on one assumed ground layer, not surface area; geometric crossings are not electrical junctions.'};
}
function build(proposal,settings){
 const blocks=root.KuiperPowerBlocks;if(!blocks)throw Error('Load power-block-planner.js first');
 if(!proposal||proposal.schema!==blocks.schema||!settings||typeof settings!=='object')throw Error('Proposal and explicit route settings required');
 const canonical=blocks.build(proposal.inputs);
 // Keep a private canonical copy; reject changed counts, IDs or membership.
 for(const key of ['proposalId','summary','inverters','stations'])if(JSON.stringify(proposal[key])!==JSON.stringify(canonical[key]))throw Error('Proposal '+key+' differs from its validated inputs');
 const cols=finite(settings.stationColumns,'stationColumns',1,2000,true),dx=finite(settings.horizontalM,'horizontalM',1,100000),dy=finite(settings.verticalM,'verticalM',1,100000);
 const local=settings.stationLocal;if(!local||typeof local!=='object')throw Error('Explicit stationLocal route options required');
 for(const k of ['lateralM','rowPitchM','roadOffsetM'])finite(local[k],k,5,1000);
 const options={lateralM:local.lateralM,rowPitchM:local.rowPitchM,roadOffsetM:local.roadOffsetM};
 const l=options.lateralM,p=options.rowPitchM,o=options.roadOffsetM,maxCount=Math.max(...canonical.stations.map(s=>s.inverterCount));
 const width=2*l+o,height=Math.ceil(maxCount/2)*p+o;
 if(dx<=width||dy<=height)throw Error('Spacing must exceed station route/road envelope width '+width+' m and height '+height+' m. Module-field fit is not evaluated.');
 const stationIndex=new Map(),inverterIndex=new Map(),roads=[],addresses=[];let lvCircuits=0,lvTrench=0;
 for(const s of canonical.stations){
  const col=s.index%cols,row=Math.floor(s.index/cols),x=col*dx,y=row*dy,n=s.inverterCount,rows=Math.ceil(n/2),k=Math.floor(n/2),rowSum=n%2?(k+1)**2:k*(k+1);
  const address={id:s.id,index:s.index,row,column:col,xyz:[x,y,0],inverterIds:s.inverterIds.slice(),inverterCount:n,partial:s.isPartial,envelope:{min:[x-l,y,0],max:[x+l+o,y+rows*p+o,0]},totalFeederRouteM:n*l+rowSum*p,uniqueLvTrenchM:n*l+rows*p};
  addresses.push(address);stationIndex.set(s.id,address);lvCircuits+=address.totalFeederRouteM;lvTrench+=address.uniqueLvTrenchM;
  s.inverterIds.forEach((id,i)=>inverterIndex.set(id,{id,stationId:s.id,indexWithinStation:i,xyz:[x+(i%2?l:-l),y+(Math.floor(i/2)+1)*p,0]}));
  roads.push({id:s.id+'/ROAD',kind:'station-access',stationId:s.id,layer:'assumed-ground',points:[[x,y,0],[x+l+o,y,0],[x+l+o,y+rows*p+o,0]],widthM:4});
 }
 const rowCount=Math.ceil(addresses.length/cols),spineX=-l-o,entry=[spineX,-o,0],corridors=[];
 const spine={id:canonical.proposalId+'/ACCESS-SPINE',kind:'interstation-access',layer:'assumed-ground',points:[entry,[spineX,(rowCount-1)*dy,0]],widthM:4};roads.push(spine);
 for(let row=0;row<rowCount;row++){const inRow=addresses.filter(s=>s.row===row),last=inRow.at(-1);roads.push({id:canonical.proposalId+'/ACCESS-ROW-'+String(row+1).padStart(6,'0'),kind:'interstation-access',layer:'assumed-ground',points:[[spineX,row*dy,0],[last.xyz[0],row*dy,0]],widthM:4});}
 for(const road of roads.filter(r=>r.kind==='interstation-access'))corridors.push({id:road.id.replace('/ACCESS-','/UNASSIGNED-CORRIDOR-'),points:clone(road.points),assignment:'unassigned proposed corridor; no cable circuit',circuitId:null,voltageKv:null,excavationIncluded:false});
 const union=roadUnion(roads);
 const overview={schema:'kuiper.whole-site-routes/1',revision:1,proposalId:canonical.proposalId,units:'m',settings:{stationColumns:cols,horizontalM:dx,verticalM:dy,stationLocal:options},geometryBasis:'generic provisional station collection layout; no project boundary or module-field layout',entry,stationEnvelopeMaximum:{widthM:width,heightM:height},stations:addresses,stationCount:addresses.length,inverterCount:canonical.summary.inverterCount,feederCircuitCount:canonical.summary.inverterCount,totals:{totalLvFeederRouteM:lvCircuits,uniqueLvTrenchM:lvTrench,uniqueRoadCentrelineM:union.lengthM,unassignedCorridorCentrelineM:corridors.reduce((a,c)=>a+length(c.points),0)},roads,roadUnion:union,unassignedCorridors:corridors,mv:{circuits:null,voltageKv:null,topology:null,transformerRatings:null,status:'unassigned'},limits:['Spacing validates only inverter/trench/road envelopes; module fields and real boundaries are absent.','Station LV trench sets are disjoint by validated envelopes. Shared local trench does not electrically join its circuits.','Road centreline union counts overlapping intervals once on one assumed ground layer; widths/areas and grade separation are unresolved.','Road and unassigned corridor networks are reported separately from LV excavation. No road-to-trench area or shared excavation is inferred.','Interstation access roads do not imply electrical station connections. No MV cable circuit, conductor count, rating or electrical design is inferred.']};
 function materializeStation(id){const address=stationIndex.get(id);if(!address)throw Error('Unknown proposal station');const r=blocks.collection(canonical,id,options),at=p=>p.map((v,i)=>v+address.xyz[i]);r.stationXYZ=at(r.stationXYZ);r.inverters.forEach(x=>{x.xyz=at(x.xyz);});for(const list of [r.feeders,r.segments])list.forEach(x=>{x.points=x.points.map(at);});r.road.points=r.road.points.map(at);r.coordinates='generic whole-site coordinates; translated station layout, not surveyed';r.envelope=clone(address.envelope);return r;}
 function locateInverter(id){const found=inverterIndex.get(id);if(!found)throw Error('Unknown proposal inverter');return clone(found);}
 return Object.freeze({overview:clone(overview),materializeStation,locateInverter});
}
root.KuiperWholeSiteRoutes=Object.freeze({build,roadUnion});if(typeof module!=='undefined')module.exports=root.KuiperWholeSiteRoutes;
})(typeof window!=='undefined'?window:globalThis);
