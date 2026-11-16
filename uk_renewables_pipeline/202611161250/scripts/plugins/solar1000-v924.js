/* Solar-1000: source candidates, not independently established project news. */
(function(){
'use strict';
var ids=new Set(),candidates=new Map(),loaded=false;
function node(t,s,c){var el=document.createElement(t);el.textContent=String(s);if(c)el.className=c;return el;}
function update(){
 if(!loaded)return;
 document.querySelectorAll('.machine-note-button[data-note-ref]').forEach(function(b){
  var id=String(b.dataset.noteRef||'');if(!ids.has(id))return;
  if(b.dataset.noteCandidate==='possible'&&!candidates.has(id)&&!b.dataset.v924Pilot)return;
  var c=candidates.get(id);
  b.replaceChildren(node('span',c?'SOLAR-1000 · PROVISIONAL':'SOLAR-1000 · NOT RESEARCHED','machine-note-kind'));
  if(c)b.appendChild(node('span',c.publisher+' · NOT VERIFIED','machine-note-headline'));
  b.dataset.v924Pilot=c?'candidate':'not_researched';
  b.title=c?'Original-source candidate; rights and project identity unverified':'Research not attempted for this pilot REPD record';
  b.setAttribute('aria-label',c?'Solar 1000 provisional candidate, not independently verified':'Solar 1000 project has not been researched');
 });
}
function showPilot(id){
 if(!loaded||!ids.has(id))return;
 var body=document.getElementById('machineNoteBody');if(!body||body.querySelector('.solar1000-note'))return;
 var box=node('section','','solar1000-note'),c=candidates.get(id);
 box.appendChild(node('h3','V9.24 SOLAR-1000 RESEARCH STATE'));
 if(!c)box.appendChild(node('p','NOT RESEARCHED — no project-specific search has been attempted for this record. This does not mean that no independent evidence exists.'));
 else{
  box.appendChild(node('p','PROVISIONAL CANDIDATE ONLY — original publisher response, rights and exact project binding NOT VERIFIED.'));
  box.appendChild(node('p',c.publisher+' · Document/listing date '+(c.event_date||'unknown')+'; not independently confirmed as official decision date.'));
  box.appendChild(node('p',c.remarks));
  var a=node('a','OPEN ORIGINAL SOURCE');a.href=c.source_url;a.target='_blank';a.rel='noopener noreferrer';
  box.appendChild(a);box.appendChild(node('p','Publisher rights: UNKNOWN. Official REPD status unchanged.'));
 }
 body.appendChild(box);
}
document.addEventListener('click',function(ev){
 var b=ev.target&&ev.target.closest&&ev.target.closest('.machine-note-button[data-note-ref]');
 if(b)showPilot(String(b.dataset.noteRef||''));
});
window.addEventListener('pipeline-projects-rendered',update);
window.addEventListener('machine-notes-updated',update);
window.solar1000Pilot={has:function(r){return ids.has(String(r));},candidate:function(r){return candidates.has(String(r));},ready:function(){return loaded;}};
function init(){
 fetch('news/solar1000-v924.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
 .then(function(d){
 if(d.schema!=='globalgrid2050.solar1000.pilot.v1'||!Array.isArray(d.ids)||d.ids.length!==1000||
    d.counts.independently_verified!==0||d.counts.not_researched!==998||d.candidates.length!==2)throw Error('invalid pilot schema/counts');
 ids=new Set(d.ids.map(String));if(ids.size!==1000)throw Error('duplicate REPD identities');
 candidates=new Map(d.candidates.map(function(c){
  if(c.verified!==false||c.rights_basis!=='unknown'||!ids.has(String(c.repd_ref)))throw Error('candidate rights/identity gate');
  return [String(c.repd_ref),c];
 }));
 loaded=true;update();
 var p=document.getElementById('solar1000PilotStatus');if(p)p.textContent='LOADED · 1,000 IDs · 2 provisional · 998 not researched · 0 independently verified';
 }).catch(function(e){
 var p=document.getElementById('solar1000PilotStatus');if(p)p.textContent='PILOT UNAVAILABLE: '+e.message+' (official REPD and MAP remain available)';
 });
 var sample=document.getElementById('solar1000PilotSample');
 if(sample)sample.addEventListener('click',function(){
  var input=document.getElementById('search');if(!input)return;
  input.value='1019';input.dispatchEvent(new Event('input',{bubbles:true}));
  var t=document.querySelector('.tablewrap');if(t)t.scrollIntoView({block:'start'});
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
