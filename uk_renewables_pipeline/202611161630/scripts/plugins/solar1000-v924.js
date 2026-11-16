import { loadEvidence, renderEvidence } from './evidence-v925.js';

import { loadCanonicalProjectsV9_5_1 } from '../data/canonical-projects-v9-5-1.js';
import { atlasUrlV9_5_1 } from './projects-v9-8.js';
const root=document.getElementById('solar1000Pilot');
const result=root?.querySelector('[data-pilot-status]');
const input=root?.querySelector('[data-pilot-search]');
const page=root?.querySelector('[data-pilot-page]');
const prev=root?.querySelector('[data-pilot-prev]');
const next=root?.querySelector('[data-pilot-next]');
const list=root?.querySelector('[data-pilot-rows]');
const counts=root?.querySelector('[data-pilot-count]');
const stamp=root?.querySelector('[data-pilot-source]');
const sourceBadge=root?.querySelector('[data-pilot-verification]');
const PAGE_SIZE=25;
let records=[],current=0;
const evidenceState={loading:true,data:null};
function add(parent,tag,value,cls){const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=String(value);parent.appendChild(n);return n;}
function display(){
 const needle=String(input.value||'').toLowerCase().trim();
 const rows=records.filter(({project:p})=>!needle || [p.repd_ref,p.name,p.county,p.operator,p.planning_application_reference].some(v=>String(v||'').toLowerCase().includes(needle)));
 const total=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));current=Math.min(current,total-1);
 list.textContent='';
 for(const {project:p,candidate:c} of rows.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE)){
   const r=add(list,'div',undefined,'v924-row');
   const name=add(r,'div',undefined,'v924-row-name');
   add(name,'strong',p.name);
   add(name,'span','REPD '+p.repd_ref+' · '+(p.county||'County not specified'));
   const detail=add(r,'div',undefined,'v924-row-detail');
   add(detail,'span','OFFICIAL: '+(p.status||'Unknown'));
   add(detail,'span',typeof p.capacity_mw==='number'?p.capacity_mw.toLocaleString('en-GB',{maximumFractionDigits:2})+' MW':'Capacity not supplied');
   const facts=add(r,'div',undefined,'v924-row-note');
   add(facts,'strong',c?'INHERITED PROVISIONAL SOURCE CANDIDATE — UNVERIFIED':'NO INHERITED SOURCE CANDIDATE');
   if(c){add(facts,'span',c.event_date+' · '+c.publisher+' · '+c.remarks);const a=add(facts,'a','Original source ↗');a.href=c.source_url;a.target='_blank';a.rel='noopener noreferrer';}
   const href=atlasUrlV9_5_1(p);
   if(href){const a=add(r,'a','MAP · GRIDATLAS ↗','v924-map');a.href=href;a.target='_blank';a.rel='noopener noreferrer';}
   else add(r,'span','MAP UNAVAILABLE — SOURCE COORDINATES NOT PRESENT','v924-map');
   renderEvidence(r,p,evidenceState);
 }
 page.textContent='Showing '+(rows.length?current*PAGE_SIZE+1:0)+'–'+Math.min((current+1)*PAGE_SIZE,rows.length)+' of '+rows.length+' selected solar projects';
 prev.disabled=current<=0;next.disabled=current>=total-1;
}
async function start(){
 if(!root)return;
 try{
 const [data,candidates,model]=await Promise.all([
  fetch('solar1000/manifest.json').then(r=>{if(!r.ok)throw Error('Pilot manifest unavailable');return r.json()}),
  fetch('solar1000/candidates.json').then(r=>{if(!r.ok)throw Error('Candidate register unavailable');return r.json()}),
  loadCanonicalProjectsV9_5_1()
 ]);
 const ids=data.ids.map(String);
 if(ids.length!==1000||new Set(ids).size!==1000||ids.some((x,i)=>i&&Number(x)<=Number(ids[i-1]))||data.selection!=='numeric-repd-ref-ascending')throw Error('Pilot membership failed identity checks');
 const byRef=new Map(model.projects.map(p=>[String(p.repd_ref),p]));
 const byCandidate=new Map(candidates.map(c=>[String(c.repd_ref),c]));
 records=ids.map(ref=>({project:byRef.get(ref),candidate:byCandidate.get(ref)}));
 if(records.some(v=>!v.project||v.project.technology!=='solar')||candidates.length!==2||data.independently_verified!==0)throw Error('Pilot source/technology verification failed');
 counts.textContent='1,000 selected of 3,604 solar · 7,775 total REPD records · 2 inherited source candidates · ZERO independently verified';
 sourceBadge.textContent='Research pilot: candidate evidence only — no publisher rights or project-event decisions verified';
 stamp.textContent='V9.23 immutable source · numeric REPD IDs '+ids[0]+'–'+ids.at(-1)+' · 16 source partitions · Agent 11 f8ab48e8';
 result.textContent='Pilot loaded · 1,000 official REPD records, unchanged';
 input.addEventListener('input',()=>{current=0;display()});
 prev.addEventListener('click',()=>{current--;display()});
 next.addEventListener('click',()=>{current++;display()});
 display();
 const evidenceStatus=root.querySelector('[data-evidence-status]');
 loadEvidence(root.dataset.evidencePointer,ids).then(data=>{
  evidenceState.loading=false;evidenceState.data=data;
  evidenceStatus.textContent='Evidence snapshot '+data.generatedAt+' · '+data.count+' provisional matches · 0 verified events · '+data.freshnessLabel;
  display();
 }).catch(()=>{
  evidenceState.loading=false;
  evidenceStatus.textContent='Evidence unavailable — last collection failed or no validated snapshot is available. Manual review required.';
  display();
 });
 }catch(e){result.textContent='Pilot unavailable: '+String(e.message||e)+'; full REPD register and MAP remain available below.';result.setAttribute('data-error','true');}
}
start();
