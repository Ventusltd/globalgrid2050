import {parseArtifact,selectRecords,MAX_BYTES} from './adapter.mjs';
import {renderReviewRows} from './view.mjs';
let model=null,recordType='renewable_project';
const rows=document.querySelector('#reviewRows'),status=document.querySelector('#artifactStatus'),search=document.querySelector('#search'),sort=document.querySelector('#sort');
function render(){const selected=model?selectRecords(model,{recordType,query:search.value,sort:sort.value}):[];renderReviewRows(rows,selected,model?.as_of);document.querySelector('#reviewCount').textContent=model?`${selected.length} shown from ${model.returned_count} ranked review records; ${model.eligible_count} eligible input records. This subset is not Solar-1000.`:'0 records loaded';}
document.querySelector('#artifact').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>MAX_BYTES)throw new Error('Priority artifact exceeds size limit');const next=await parseArtifact(await file.arrayBuffer());model=next;status.textContent=`Review artifact validated as of ${next.as_of}. ${next.coverage} Local file bytes are not a publication or source-authenticity approval.`;}
  catch{model=null;status.textContent='Review artifact unavailable: contract validation failed. No rankings or source claims displayed.';}
  render();
});
const tabs=Array.from(document.querySelectorAll('[role=tab]'));
function activate(tab){recordType=tab.dataset.type;for(const button of tabs){button.setAttribute('aria-selected',String(button===tab));button.tabIndex=button===tab?0:-1;}rows.setAttribute('aria-labelledby',tab.id);render();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length];activate(next);next.focus();});});
search.addEventListener('input',render);sort.addEventListener('change',render);render();
