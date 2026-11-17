import {acceptedNotice} from './model.mjs';
const doc=document,panel=doc.getElementById('gridPanel'),layer=doc.getElementById('gridLayerHost');
if(panel&&layer){
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const host=el('div');host.className='pn-grid-notice';host.dataset.state='loading';host.append(el('p','Source-qualified government notice loading.'));layer.after(host);
 try{
  const response=await fetch(new URL('notice.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw Error('Notice unavailable');const f=await acceptedNotice(await response.json());if(!f)throw Error('Independent fact-rights review required');
  host.replaceChildren();host.dataset.state='reviewed-facts';host.dataset.noticeCount='1';host.append(el('h3','Government grid notice'),el('p','1 source-qualified notice · 2 government documents · not a grid asset or REPD update count'));
  const filter=el('input'),count=el('p','1 of 1 source-qualified notices match');filter.type='search';filter.placeholder='Filter notice title, operator or source';filter.setAttribute('aria-label','Filter government grid notices');count.setAttribute('role','status');host.append(filter,count);
  const record=el('article');record.append(el('h4','Sea Link · EN020026'),el('p','Consented · 30 October 2026 (DAY precision). Reported network operator: NGET. Government publishers are separate from the operator.'),el('p','Proposed Suffolk–Kent HVDC transmission link; planned upper bound up to 2 GW, not current available or commissioned capacity.'));
  const details=el('details'),summary=el('summary','Source dates, attribution and known unknowns');details.append(summary);
  for(const d of f.documents){
   const p=el('p'),a=el('a',d.publisher);a.href=d.url;a.target='_blank';a.rel='noopener noreferrer';p.append(a,' · published '+d.published_date.value+' (DAY); retrieved '+d.retrieved_at);details.append(p);
   for(const [name,date]of Object.entries(d.milestones||{}))details.append(el('p',name.replaceAll('_',' ')+': '+date.value+' (DAY)'));
  }
  details.append(el('p','Narrow government-authored facts under the stated Open Government Licence v3.0 only. Images and linked third-party material are excluded.'),el('p','Current capacity, commissioning, connection, project joins and coordinates remain unknown. No REPD/ETYS match, cross-border interconnector row or VERIFIED association is created.'));record.append(details);host.append(record);
  filter.addEventListener('input',()=>{record.hidden=!['Sea Link EN020026 NGET consented Suffolk Kent HVDC',...f.documents.map(d=>d.publisher)].join(' ').toLocaleLowerCase().includes(filter.value.trim().toLocaleLowerCase());host.dataset.filteredCount=record.hidden?'0':'1';count.textContent=(record.hidden?'0':'1')+' of 1 source-qualified notices match';});host.dataset.filteredCount='1';
 }catch{host.dataset.state='withheld';host.replaceChildren(el('p','Source-qualified government notices unavailable: source integrity or independent fact-rights review is pending. Existing Grid layers remain separate and usable.'));}
}
