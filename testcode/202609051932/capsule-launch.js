(async()=>{
const {cases}=await(await fetch('./cases.json')).json();
document.querySelectorAll('[data-case]').forEach(button=>button.addEventListener('click',()=>{
 const c=cases.find(c=>c.case_id===button.dataset.case);const u=new URL('./atlas/',location.href);
 u.searchParams.set('testcode_case',c.case_id);u.searchParams.set('testcode_entity_kind',c.kind);u.searchParams.set('testcode_entity_id',c.entity_id);
 if(c.kind==='repd'){
  u.searchParams.set('repd_ref',c.entity_id);u.searchParams.set('technology',c.technology);u.searchParams.set('project',c.name);
  if(c.capacity_mw!=null)u.searchParams.set('capacity_mw',c.capacity_mw);
  if(c.has_location){u.searchParams.set('longitude',c.longitude);u.searchParams.set('latitude',c.latitude);}
 }
 window.open(u.href,'_blank','noopener');
}));
})();
