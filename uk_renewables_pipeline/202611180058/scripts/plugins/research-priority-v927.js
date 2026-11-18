// Research ordering is separate from official facts, news verification and Solar-1000.
import {parsePriorityBundle,attachProjectPriority} from './prospecting/bundle.mjs';
const PIN='4cb13bcdc332730f1c88804b1a1cadae76b75d1c9ada4dd4f6d1c7252f86de27';
const directory=new URL('../../prospecting/',import.meta.url);
const status=document.getElementById('researchPriorityStatus');
let bundle=null,state='loading',epoch=0;
window.projectResearchPriorityState=state;
async function boundedFile(name,limit){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(new URL(name,directory),{signal:controller.signal});
    if(!response.ok||Number(response.headers.get('content-length'))>limit)throw Error('Priority file unavailable');
    const reader=response.body.getReader(),chunks=[];let size=0;
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Priority file exceeds limit');}chunks.push(value);}
    const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
  }finally{clearTimeout(timer);}
}
function renderRecord(details){
  const row=details.closest('#tbody > tr[id^="repd-"]');if(!row||state==='loading')return;
  if(details.dataset.priorityEpoch===String(epoch))return;
  const identity='REPD-'+row.id.slice(5);
  try{attachProjectPriority(details,identity,bundle);}catch{attachProjectPriority(details,identity,null);}
  details.dataset.priorityEpoch=String(epoch);
}
function attachRows(){
  for(const row of document.querySelectorAll('#tbody > tr[id^="repd-"]')){
    const details=row.querySelector('.project-record');if(!details)continue;
    const identity='REPD-'+row.id.slice(5),priority=bundle?.byId.get(identity);
    let button=row.querySelector('.v927-priority-hint');
    if(!priority){button?.remove();}else{
      if(!button){button=document.createElement('button');button.type='button';button.className='v927-priority-hint';button.dataset.priorityProject=identity;details.after(button);}
      button.textContent=`Research #${priority.rank} · ${priority.score} points`;
      button.setAttribute('aria-label',`Read research priority ${priority.rank} for ${priority.name||identity}`);
    }
    if(details.open)renderRecord(details);
  }
}
export async function reloadPriority(){
  const current=++epoch;bundle=null;state='loading';window.projectResearchPriorityState=state;
  document.querySelectorAll('.v927-priority-hint, [data-priority-id], [data-priority-state]').forEach(node=>node.remove());
  if(status)status.textContent='Research priority is loading; official records remain unchanged.';
  try{
    const [manifest,priority]=await Promise.all([boundedFile('manifest.json',1024*1024),boundedFile('priority.json',16*1024*1024)]);
    const parsed=await parsePriorityBundle(priority,manifest,PIN);
    if(current!==epoch)return;
    bundle=parsed;state='accepted';
    if(status)status.textContent=`Research priority: ${bundle.model.returned_count.toLocaleString('en-GB')} ranked from 7,775 official records. Ranking reference time ${bundle.model.as_of}; source dates are shown per project. Momentum and financing are not assessed. This subset does not replace Solar-1000.`;
  }catch{
    if(current!==epoch)return;
    bundle=null;state='rejected';
    if(status)status.textContent='Research priority unavailable: the source-bound bundle could not be validated. Official records, CSV and MAP remain available.';
  }
  window.projectResearchPriorityState=state;attachRows();
}
window.addEventListener('pipeline-projects-rendered',attachRows);
document.getElementById('tbody')?.addEventListener('toggle',event=>{if(event.target.matches('.project-record')&&event.target.open)renderRecord(event.target);},true);
document.getElementById('tbody')?.addEventListener('click',event=>{
  const button=event.target.closest('.v927-priority-hint');if(!button)return;
  const details=button.closest('tr').querySelector('.project-record');details.open=true;renderRecord(details);
  const priority=details.querySelector('[data-priority-id]');if(priority){priority.open=true;priority.scrollIntoView({block:'start'});}
});
reloadPriority();
