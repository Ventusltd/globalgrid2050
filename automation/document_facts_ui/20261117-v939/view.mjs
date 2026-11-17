import {acceptedDocuments} from './model.mjs';
const doc=document,panel=doc.getElementById('gridPanel'),layer=doc.getElementById('gridLayerHost');
if(panel&&layer){
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const host=el('details');host.className='pn-document-facts';host.dataset.state='loading';host.append(el('summary','Publication facts and exact source locators'));panel.append(host);
 try{
  const [facts,notice]=await Promise.all([fetch(new URL('facts.json',import.meta.url),{cache:'no-store'}),fetch(new URL('../../grid_notice_ui/20261117-v938/notice.json',import.meta.url),{cache:'no-store'})]);
  if(!facts.ok||!notice.ok)throw Error('Source unavailable');const payload=await acceptedDocuments(await facts.text(),await notice.json());if(!payload)throw Error('Review or integrity pending');
  host.dataset.state='source-qualified';host.dataset.documentCount='2';host.dataset.factCount='6';host.append(el('p','Sea Link EN020026: 6 automatically distilled facts from 2 government HTML documents. Machine provisional; exact source versions, no independent verification.'));
  const names={application_submitted:'Application submitted',application_accepted:'Accepted for examination',reported_network_operator:'Reported network operator',recommendation:'Recommendation to Secretary of State',consent_decision:'Consent decision',planned_transmission_upper_bound:'Planned transmission upper bound'};
  for(const source of payload.documents){
   const group=el('section');group.append(el('h4',source.publisher));const link=el('a','Original publication');link.href=source.source_url;link.target='_blank';link.rel='noopener noreferrer';group.append(link,el('p','Published '+source.published_date.value+' (DAY); retrieved '+source.retrieved_at));
   for(const fact of source.facts){
    const details=el('details'),value=typeof fact.value==='object'?fact.value.value+' (DAY)':fact.value+(fact.unit?' '+fact.unit:'');details.append(el('summary',names[fact.id]+': '+value));
    if(fact.meaning)details.append(el('p',fact.meaning));
    details.append(el('p','Source paragraph '+fact.locator.paragraph),el('code',fact.locator.selector),el('p','Paragraph SHA-256: '+fact.locator.text_sha256),el('p','Document SHA-256: '+source.source_version));group.append(details);
   }host.append(group);
  }
  host.append(el('p','2 GW is a planned upper bound, not commissioned or currently available capacity. Commissioning, current capacity, coordinates and REPD joins remain unknown.'),el('p','Government-authored facts only under the narrow reviewed Open Government Licence scope; no images or linked third-party material.'),el('p','PDF extraction unavailable: no approved local PDF or installed extractor. No OCR, table inference or body reproduction.'));
 }catch{host.dataset.state='withheld';host.append(el('p','Publication facts unavailable: exact source bytes or independent narrow fact-rights review is pending. Existing Grid layers remain usable.'));}
}
