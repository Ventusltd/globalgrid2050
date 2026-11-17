import {auditHealth,classification,selectEntries} from './model.mjs';
const doc=document,list=doc.getElementById('liveNews');
if(list){
 const el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const host=el('div');host.className='pn-news-quality';const tools=el('div');tools.className='pn-news-filter-tools';
 const query=el('input');query.type='search';query.placeholder='Search title, source or topic';query.setAttribute('aria-label','Filter news titles, sources or topics');
 const selects={};for(const [id,label] of [['source','Publisher'],['topic','Topic'],['category','Category'],['kind','Ranking source type']]){const wrapper=el('label',label+' '),select=el('select');select.setAttribute('aria-label','News '+label.toLowerCase());selects[id]=select;wrapper.append(select);tools.append(wrapper);}
 const clear=el('button','Clear news filters');clear.type='button';const count=el('span');count.setAttribute('role','status');tools.prepend(query);tools.append(clear,count);
 const details=el('details'),summary=el('summary','Source health & provenance'),health=el('div');details.append(summary,health);host.append(tools,details);list.before(host);
 let current=null,revision='',healthBuilt=false;
 function values(entries,key,ranked){return [...new Set(entries.flatMap(entry=>key==='source'?[entry.item.source]:key==='category'?[entry.item.category]:key==='topic'?classification(entry,ranked).topics:[classification(entry,ranked).kind]).filter(v=>typeof v==='string'&&v))].sort((a,b)=>a.localeCompare(b));}
 function drawHealth(){
  if(!current)return;const audit=auditHealth(current.doc);health.replaceChildren();
  health.append(el('p',audit.articles===null?'Article and publisher metadata unavailable.':`${audit.articles} original articles; ${audit.publishers.length} distinct credited publisher labels${audit.unknownPublishers?`; ${audit.unknownPublishers} publisher credits unavailable`:''}. Publishers and feeds are different counts.`));
  health.append(el('p',audit.available?`${audit.ok} of ${audit.feeds} feed checks succeeded; ${audit.failed} failed.`:audit.reason));
  health.append(el('p',`Collection clock: ${audit.collectionClock||'Unknown'}. Recorded status: ${audit.status}. Display: ${current.source}. Publisher dates and first-collected clocks stay separate.`));
  health.append(el('p',current.ranked?'Ranking metadata is exact-input and current; its source types are classifications, not source verification.':'Ranking source type unavailable: Unclassified. Saved, stale, rejected or missing priority metadata supplies no source authority.'));
  const publishers=el('ul');for(const [name,total] of audit.publishers.slice(0,20))publishers.append(el('li',`${name}: ${total} credited articles`));health.append(publishers);if(audit.publishers.length>20)health.append(el('p',`${audit.publishers.length-20} further publisher labels available in the Publisher filter.`));
  if(audit.available&&audit.failed)for(const f of audit.failedSources.slice(0,5))health.append(el('p',`Failed feed: ${f.source} (${f.url})`));healthBuilt=true;
 }
 function apply(reset=true){if(!current)return;const filter={query:query.value,...Object.fromEntries(Object.entries(selects).map(([k,n])=>[k,n.value]))},selected=selectEntries(current.entries,filter,current.ranked);count.textContent=current.doc?`${selected.length} of ${current.entries.length} original headlines match`:'Headlines unavailable';host.dataset.filteredCount=String(selected.length);current.draw(selected,reset);}
 function update(view){
  const key=JSON.stringify(view.entries.map(entry=>[entry.item.link,entry.item.title,entry.item.source,entry.item.category,classification(entry,view.ranked)]));const same=key===revision;revision=key;current=view;healthBuilt=false;
  for(const [id,select] of Object.entries(selects)){const selected=select.value;select.replaceChildren(new Option('All '+(id==='kind'?'types':id==='source'?'publishers':id==='category'?'categories':'topics'),''));for(const value of values(view.entries,id,view.ranked))select.add(new Option(value,value));if([...select.options].some(o=>o.value===selected))select.value=selected;}
  apply(!same);if(details.open)drawHealth();
 }
 query.addEventListener('input',()=>apply());for(const select of Object.values(selects))select.addEventListener('change',()=>apply());clear.addEventListener('click',()=>{query.value='';for(const select of Object.values(selects))select.value='';apply();});details.addEventListener('toggle',()=>{if(details.open&&!healthBuilt)drawHealth();});
 const attach=()=>window.pipelineHeadlines?.attachView?.(update);if(window.pipelineHeadlines)attach();else window.addEventListener('pipeline-news-ready',attach,{once:true});
}
