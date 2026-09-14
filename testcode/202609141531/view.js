'use strict';
(async()=>{
 const response=await fetch('data.json');if(!response.ok)throw Error('Evidence HTTP '+response.status);
 const data=await response.json();if(!Array.isArray(data.records)||!data.records.length)throw Error('Missing browser observations');
 const status=document.querySelector('#status');status.textContent=`Observed ${data.observed_utc}\n${data.records.length} viewport loads across ${new Set(data.records.map(r=>r.url)).size} pages; ${data.discovered_pages} discovered page candidates at this snapshot.\nInventory commit: ${data.inventory_commit}\nChrome ${data.browser}; rendering: ${data.renderer}`;
 let page=0;const size=40,filter=document.querySelector('#filter');
 function render(){const records=data.records.filter(r=>r.url.toLowerCase().includes(filter.value.toLowerCase()));page=Math.min(page,Math.max(0,Math.ceil(records.length/size)-1));const body=document.querySelector('#rows');body.replaceChildren();
  for(const r of records.slice(page*size,(page+1)*size)){const row=document.createElement('tr');const values=[r.url,r.width,r.status??'Incomplete',r.load_wall_ms??'—',`${r.console_errors.length} / ${r.failed_requests.length}`,r.metrics?.overflow?'Observed':'Not observed'];for(let i=0;i<values.length;i++){const td=document.createElement('td');if(i===0){const a=document.createElement('a');a.href=r.url;a.textContent=r.url;a.target='_blank';a.rel='noopener';td.append(a);const time=document.createElement('small');time.textContent=' '+r.observed_utc;td.append(time);}else td.textContent=values[i];row.append(td);}body.append(row);}
  document.querySelector('#page').textContent=`${records.length? page*size+1:0}–${Math.min((page+1)*size,records.length)} of ${records.length}`;document.querySelector('#previous').disabled=page===0;document.querySelector('#next').disabled=(page+1)*size>=records.length;
 }
 filter.addEventListener('input',()=>{page=0;render();});document.querySelector('#previous').addEventListener('click',()=>{page--;render();});document.querySelector('#next').addEventListener('click',()=>{page++;render();});render();
})().catch(e=>{document.querySelector('#status').textContent='Evidence unavailable: '+e.message;});
