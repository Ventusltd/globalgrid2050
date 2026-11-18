import {buildJourneyUrl,mapOrigin,checkedNewsContextBase} from './model.mjs';
const document=globalThis.document;
const canonical='https://ventusltd.github.io/gridatlas/atlas/';
const stateKey='pipelineJourneyReturn';
const origins=new WeakMap();
let newsContextUrl;
function action(map,identity,parent){
  const existing=parent.querySelector(':scope > .pn-journey-action');
  const origin=map?mapOrigin(map.href,identity):null;
  const href=origin?buildJourneyUrl(map.href,origin,{newsContextUrl}):null;
  const signature=JSON.stringify([identity.origin_type,identity.origin_id,href]);
  if(existing?.dataset.signature===signature){if(href)origins.set(existing,origin);return}
  existing?.remove();
  const element=document.createElement(href?'a':'span');element.className='pn-journey-action';element.dataset.signature=signature;
  if(href){
    element.classList.add('action-link','atlaslink','pn-journey-link');element.href=href;element.target='_blank';element.rel='noopener noreferrer';element.textContent='JOURNEY';
    element.title='Explore nearby assets and documented network connectivity; not a connection assessment';origins.set(element,origin);
  }else{
    element.classList.add('pn-journey-unavailable');element.textContent='JOURNEY: location unavailable';
  }
  if(map?.parentElement===parent)map.after(element);else parent.append(element);
}
function refresh(){
 for(const map of document.querySelectorAll('#tbody a.atlaslink:not(.pn-journey-link)')){
   const url=new URL(map.href),ref=url.searchParams.get('repd_ref');if(!/^[1-9]\d*$/.test(ref||''))continue;
   const row=map.closest('tr'),name=row?.querySelector('.site')?.firstChild?.textContent?.trim();
   action(map,{origin_type:'repd',origin_id:'repd:'+ref,name},map.parentElement);
 }
 for(const row of document.querySelectorAll('#gridLayerHost tr[data-source-id]')){
   const map=[...row.querySelectorAll('a:not(.pn-journey-link)')].find(a=>a.href.startsWith(canonical));
   if(!map)continue;
   action(map,{origin_type:'substation',origin_id:row.dataset.sourceId,name:row.querySelector('strong')?.textContent},map.parentElement);
 }
 for(const row of document.querySelectorAll('#datacentreHost .ggdc-table tbody tr')){
   const id=row.querySelector('.ggdc-id')?.textContent?.trim();if(!/^DC-WD-Q[1-9]\d*$/.test(id||''))continue;
   const actions=row.querySelector('.ggdc-location-actions');
   const map=actions&&[...actions.querySelectorAll('a:not(.pn-journey-link)')].find(a=>a.href.startsWith(canonical));
   const parent=actions||row.lastElementChild;if(!parent)continue;
   // A late source-backed location replaces the unavailable placeholder.
   if(actions)row.querySelector('td > .pn-journey-unavailable')?.remove();
   action(map,{origin_type:'datacentre',origin_id:id,name:row.querySelector('.ggdc-identity')?.firstChild?.textContent},parent);
 }
 const map=document.getElementById('mapAtlasNav');
 if(map&&!document.getElementById('journeyAtlasNav')){
   const a=document.createElement('a');a.id='journeyAtlasNav';a.className='atlaslink pn-journey-link';a.textContent='GRID JOURNEYS';a.href=canonical+'?journey=vicinity';a.target='_blank';a.rel='noopener noreferrer';map.after(a);
 }
}
let queued=false;
new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;refresh()})}}).observe(document.body,{childList:true,subtree:true});
refresh();
// Only a later accepted news-context component opts into this metadata. The
// entry release never points to an unpublished or arbitrary return destination.
window.pipelineJourneyEntry=Object.freeze({schema:'pipeline.journey-entry.v1',setNewsContextUrl(value){
  const base=checkedNewsContextBase(value);if(!base)throw Error('Invalid immutable news context base');
  newsContextUrl=base;refresh();
}});
window.dispatchEvent(new Event('pipeline-journey-ready'));
function rememberCategory(){
 const category=document.querySelector('.pipeline-tabs [aria-selected="true"]')?.dataset.view;
 const dc=document.getElementById('datacentreHost');
 const state={category,x:scrollX,y:scrollY,
   dcQuery:dc?.querySelector('input[type="search"]')?.value,
   dcKind:dc?.querySelector('[data-kind][aria-pressed="true"]')?.dataset.kind,
   dcCountry:dc?.querySelector('select[aria-label="Country"]')?.value};
 try{history.replaceState({...history.state,[stateKey]:state},'')}catch{/* Native link remains usable. */}
}
document.addEventListener('click',event=>{
 const a=event.target.closest?.('.pn-journey-link');if(!a)return;
 // V9.42's existing atlaslink handler owns native target and filter recovery.
 rememberCategory();
 const origin=origins.get(a);if(origin)window.dispatchEvent(new CustomEvent('pipeline-journey-origin',{detail:origin}));
},true);
// Restore the existing category controls only after the original app finishes
// its default-category initialization. BFCache keeps its live nodes unchanged.
const saved=history.state?.[stateKey];
if(saved&&['solar','bess','grid','datacentre','offtakers','prices'].includes(saved.category)){
 let restored=false;
 const restore=()=>{if(restored)return;restored=true;queueMicrotask(()=>{
   document.querySelector('.pipeline-tabs [data-view="'+saved.category+'"]')?.click();
   if(saved.category!=='datacentre'){scrollTo(saved.x,saved.y);return}
   const dcRestore=()=>{
     const dc=document.getElementById('datacentreHost'),input=dc?.querySelector('input[type="search"]');if(!input)return;
     if(['uk','global'].includes(saved.dcKind))dc.querySelector('[data-kind="'+saved.dcKind+'"]')?.click();
     input.value=saved.dcQuery||'';input.dispatchEvent(new Event('input',{bubbles:true}));
     const country=dc.querySelector('select[aria-label="Country"]');if(country&&[...country.options].some(o=>o.value===saved.dcCountry)){country.value=saved.dcCountry;country.dispatchEvent(new Event('change',{bubbles:true}))}
     scrollTo(saved.x,saved.y);
   };
   window.addEventListener('pipeline-datacentre-ready',dcRestore,{once:true});dcRestore();
 })};
 window.addEventListener('pipeline-projects-rendered',restore,{once:true});
 if(document.getElementById('tbody')?.dataset.complete==='true')restore();
}
