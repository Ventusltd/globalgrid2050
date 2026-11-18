import {buildJourneyUrl,mapOrigin,checkedNewsContextBase} from '../../automation/journey_entry_ui/20261118/model.mjs';
const document=globalThis.document;
const canonical='https://ventusltd.github.io/gridatlas/atlas/';
const stateKey='pipelineJourneyReturn';
const origins=new WeakMap();
const originals=new WeakMap();
let newsContextUrl;
// Reuse exactly the working JOURNEY destination, but expose ONE MAP action.
// Keep the existing anchor alive for native mobile navigation and return state.
function action(map,identity,parent){
  if(!map){
    if(!parent.querySelector(':scope > .pn-journey-unavailable')){
      const span=document.createElement('span');span.className='pn-journey-unavailable';span.textContent='NO MAP';parent.append(span);
    }
    return;
  }
  if(!originals.has(map)) originals.set(map,map.href);
  const original=originals.get(map);
  const origin=mapOrigin(original,identity);
  const href=origin?buildJourneyUrl(original,origin,{newsContextUrl}):null;
  if(!href)return; // leave the original fallback alone if identity/coordinates cannot be validated
  const signature=JSON.stringify([identity.origin_type,identity.origin_id,href]);
  if(map.dataset.singleMapSignature===signature)return;
  map.dataset.singleMapSignature=signature;
  map.classList.add('action-link','atlaslink','pn-journey-link');
  map.href=href;map.textContent='MAP';
  map.title='Open the selected asset in GridAtlas';
  map.removeAttribute('aria-label');
  origins.set(map,origin);
}
function refresh(){
 for(const map of document.querySelectorAll('#tbody a.atlaslink')){
   const url=new URL(originals.get(map)||map.href),ref=url.searchParams.get('repd_ref');if(!/^[1-9]\d*$/.test(ref||''))continue;
   const row=map.closest('tr'),name=row?.querySelector('.site')?.firstChild?.textContent?.trim();
   action(map,{origin_type:'repd',origin_id:'repd:'+ref,name},map.parentElement);
 }
 for(const row of document.querySelectorAll('#gridLayerHost tr[data-source-id]')){
   const map=[...row.querySelectorAll('a')].find(a=>a.href.startsWith(canonical));
   if(!map)continue;
   action(map,{origin_type:'substation',origin_id:row.dataset.sourceId,name:row.querySelector('strong')?.textContent},map.parentElement);
 }
 for(const row of document.querySelectorAll('#datacentreHost .ggdc-table tbody tr')){
   const id=row.querySelector('.ggdc-id')?.textContent?.trim();if(!/^DC-WD-Q[1-9]\d*$/.test(id||''))continue;
   const actions=row.querySelector('.ggdc-location-actions');
   const map=actions&&[...actions.querySelectorAll('a')].find(a=>a.href.startsWith(canonical));
   const parent=actions||row.lastElementChild;if(!parent)continue;
   // A late source-backed location replaces the unavailable placeholder.
   if(actions)row.querySelector('td > .pn-journey-unavailable')?.remove();
   action(map,{origin_type:'datacentre',origin_id:id,name:row.querySelector('.ggdc-identity')?.firstChild?.textContent},parent);
 }
 // Keep only the existing MAP ATLAS header link; the beta navigation is withdrawn.
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
