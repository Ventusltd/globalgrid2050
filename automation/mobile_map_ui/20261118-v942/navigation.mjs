/* Native touch navigation: do not open a background tab or wait on a fetch. */
const touch=matchMedia('(pointer: coarse)');
const selector='a.atlaslink,#mapAtlasNav';
const key='pipelineMapReturn';
const originalTargets=new WeakMap();
function decorate(){
  for(const a of document.querySelectorAll(selector)){
    if(!originalTargets.has(a))originalTargets.set(a,a.getAttribute('target'));
    const target=touch.matches?'_self':originalTargets.get(a);
    if(target===null)a.removeAttribute('target');else a.target=target;
    a.dataset.mapNavigation=target==='_blank'?'new-tab':'current-tab';
    a.setAttribute('aria-description',target==='_blank'?'Opens the grid map in a new tab.':'Opens the grid map in this tab. Use Back to return to these results.');
  }
}
function remember(){
  const url=new URL(location.href),value=id=>document.getElementById(id)?.value;
  const fields={technology:document.querySelector('#tech [aria-pressed="true"]')?.dataset.technology,
    status:document.querySelector('#status [aria-pressed="true"]')?.dataset.officialStatus,
    county:value('county'),q:value('search'),sort:value('sortProjects')};
  for(const [param,id] of [['submitted_year','submittedYear'],['updated_year','updatedYear'],['operational_year','operationalYear']])
    fields[param]=document.querySelector('[data-year-filter="'+id+'"]')?.value;
  for(const [param,v]of Object.entries(fields))if(v!==undefined)url.searchParams.set(param,v);
  const wrapper=document.querySelector('#tbody')?.closest('.tablewrap');
  try{history.replaceState({...history.state,[key]:{path:location.pathname,page:Number(document.getElementById('projectPager')?.dataset.page)||1,x:scrollX,y:scrollY,left:wrapper?.scrollLeft||0}},'',url)}catch{/* Navigation stays native if history is unavailable. */}
}
document.addEventListener('click',event=>{
  const link=event.target.closest?.(selector);
  if(!link)return;
  decorate();
  if(touch.matches&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)remember();
},true);
touch.addEventListener('change',decorate);
new MutationObserver(decorate).observe(document.getElementById('tbody'),{childList:true,subtree:true});
decorate();
// BFCache preserves the actual DOM. A full Back reload uses the URL filters and
// the saved page/scroll instead; no filters or data are synthesized here.
const saved=history.state?.[key];
if(saved?.path===location.pathname){
  let attempts=0;
  const restore=()=>{
    const body=document.getElementById('tbody'),pager=document.getElementById('projectPager');
    if(Number(body?.dataset.total)>0&&pager){
      const target=Math.min(Math.max(1,saved.page),Number(pager.dataset.pages)||1);
      while(Number(pager.dataset.page)<target){
        const next=pager.querySelector('[data-page-step="1"]');
        if(!next||next.disabled)break;
        next.click();
      }
      const wrapper=body.closest('.tablewrap');if(wrapper)wrapper.scrollLeft=saved.left;
      scrollTo(saved.x,saved.y);
    }else if(++attempts<300)setTimeout(restore,100);
  };
  restore();
}
