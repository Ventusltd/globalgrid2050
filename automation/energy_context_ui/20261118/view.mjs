import {acceptedPolicy,acceptedGridContext,policySource,relatedHeadlines,contextForOrigin,infrastructureEntries,newsContextBase,newsContextUrl,requestedContext} from './model.mjs';
const D=document,news=D.querySelector('.pn-news-quality'),grid=D.getElementById('gridPanel');
const el=(tag,text)=>{const n=D.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
let origin=null,policy=null,gridContext=null,feed=window.pipelineHeadlineDocument,requestApplied=false,activeTopic=null,newsApi=null,viewAdapter=null,lastView=null;
const returnKey='pipelineEnergyNewsReturn',filterKinds=['source','topic','category','kind'];
const newsQuery=()=>D.querySelector('.pn-news-header-search input');
const newsSelect=kind=>D.querySelector('.pn-news-filter-tools select[aria-label="News '+({source:'publisher',topic:'topic',category:'category',kind:'ranking source type'}[kind])+'"]');
const policyPanel=el('details'),summary=el('summary','AI demand, clean energy and grid policy');policyPanel.className='pn-energy-context';policyPanel.id='energyPolicyContext';policyPanel.append(summary);
const body=el('div');policyPanel.append(body);news?.append(policyPanel);
const related=el('details'),relatedBody=el('div');related.className='pn-energy-context';related.id='journeyNewsContext';related.append(el('summary','Journey context — original news and official sources'),relatedBody);grid?.append(related);
const contextStatus=el('div'),contextLabel=el('span'),allHeadlines=el('button','All original headlines');contextStatus.className='pn-news-context-status';contextStatus.id='headlineContextStatus';contextStatus.hidden=true;contextStatus.setAttribute('role','status');allHeadlines.type='button';contextStatus.append(contextLabel,allHeadlines);D.getElementById('liveNews')?.before(contextStatus);
const topicLabels={datacentre:'data-centre infrastructure',grid:'grid infrastructure',storage:'storage and flexibility',renewables:'energy transition',solar:'solar',wind:'wind'};
function showContext(){contextStatus.hidden=!activeTopic;contextStatus.dataset.topic=activeTopic||'';contextLabel.textContent=activeTopic?'Headline context: '+topicLabels[activeTopic]+'. Reset for the complete original view.':'';}
function renderMain(view=lastView){if(!viewAdapter||!view)return false;viewAdapter({...view,entries:infrastructureEntries(view.entries,activeTopic)});showContext();return true;}
function connectNews(){const api=window.pipelineHeadlines;if(newsApi===api&&viewAdapter)return true;const adapter=api?.getViewAdapter?.();if(typeof adapter!=='function')return false;newsApi=api;viewAdapter=adapter;api.attachView(view=>{lastView=view;renderMain(view);});const clear=D.querySelector('.pn-news-filter-tools button');clear?.addEventListener('click',()=>{requestApplied=true;activeTopic=null;renderMain();});return true;}
allHeadlines.addEventListener('click',()=>{requestApplied=true;activeTopic=null;const clear=D.querySelector('.pn-news-filter-tools button');if(clear)clear.click();else renderMain();});
function topicFilter(topic){
 const select=D.querySelector('.pn-news-filter-tools select[aria-label="News topic"]'),category=D.querySelector('.pn-news-filter-tools select[aria-label="News category"]'),query=D.querySelector('.pn-news-header-search input');
 if(!select||!query)return false;
 for(const node of D.querySelectorAll('.pn-news-filter-tools select'))node.value='';query.value='';
 if(connectNews()){activeTopic=topic;renderMain();D.getElementById('headlinesHeading')?.scrollIntoView({block:'start'});return true;}
 if([...select.options].some(o=>o.value===topic)){select.value=topic;select.dispatchEvent(new Event('change',{bubbles:true}));}
 else if(category&&[...category.options].some(o=>o.value===topic)){category.value=topic;category.dispatchEvent(new Event('change',{bubbles:true}));}
 else{query.value={grid:'grid',storage:'storage',renewables:'renewable',datacentre:'datacentre'}[topic]||topic;query.dispatchEvent(new Event('input',{bubbles:true}));}
 D.getElementById('headlinesHeading')?.scrollIntoView({block:'start'});return true;
}
function buttons(host){
 const controls=el('div');controls.className='pn-energy-actions';
 for(const [topic,label] of [['datacentre','Data-centre news'],['grid','Grid infrastructure news'],['storage','Storage and flexibility'],['renewables','Energy-transition news']]){
  const button=el('button',label);button.type='button';button.dataset.newsTopic=topic;button.addEventListener('click',()=>{requestApplied=true;const ok=topicFilter(topic);status.textContent=ok?'Applied '+label.toLowerCase()+' to the existing news controls; zero matches is a valid result.':'News controls are not available yet.';});controls.append(button);
 }const status=el('p');status.setAttribute('role','status');host.append(controls,status);
}
function drawPolicy(){
 body.replaceChildren();body.append(el('p','Explore renewable supply, AI electricity demand and grid upgrades using the existing news topics.' ));buttons(body);
 body.append(link('UK Government Data Centre Covenant',policySource));
 if(gridContext){const upgrade=el('details');upgrade.dataset.officialContext='planning:EN020026';upgrade.append(el('summary','Official grid-upgrade context — Sea Link'),el('p',`Consent decision ${gridContext.decision.value} (DAY); proposed transmission up to ${gridContext.planned_upper_bound.value} ${gridContext.planned_upper_bound.unit}. Not commissioned or available capacity; no selected-asset association.`));for(const source of gridContext.documents)upgrade.append(link(source.title,source.source_url),el('p',`${source.publisher} · published ${source.published_date.value} (DAY)`));const show=el('button','Read exact grid-document facts');show.type='button';show.addEventListener('click',()=>{D.getElementById('gridTab')?.click();const facts=D.querySelector('.pn-document-facts');if(facts){facts.open=true;facts.scrollIntoView({block:'start'});}});upgrade.append(show);body.append(upgrade);}
 if(!policy){body.append(el('p','Policy facts await source-integrity and independent review. The official publication remains available.'));return;}
 body.append(el('p',`${policy.publisher} · published ${policy.published_date.value} (DAY). National policy context; no project compliance assessment.`));
 const ul=el('ul');for(const theme of policy.themes){const li=el('li');li.append(link(theme.label,policy.source_url+'#'+theme.fragment));ul.append(li);}body.append(ul);
 for(const q of policy.quantities)body.append(el('p',`${q.id==='new_facility_pue'?'PUE '+q.value+' or better':q.value+' '+q.unit} — ${q.meaning}.`));
 const details=el('details');details.append(el('summary','Source and fact provenance'),el('p',`Retrieved ${policy.retrieved_at}. Source SHA-256 ${policy.source_sha256}.`));
 for(const q of policy.quantities)details.append(el('p',`${q.id}: ${q.locator}; paragraph SHA-256 ${q.text_sha256}`));
 details.append(link('Open Government Licence v3.0',policy.rights.licence_url),el('p','Government-authored facts only. No image or third-party material reproduced.'));body.append(details);
}
function drawRelated(){
 relatedBody.replaceChildren();const context=contextForOrigin(origin);
 relatedBody.append(el('p',context?`${context.origin_type.toUpperCase()} ${context.origin_id}: topic context only. Headlines are not evidence of a connection, supply agreement or project association.`:'Choose a REPD project, data centre or substation JOURNEY to retain its origin while exploring related news topics.'));
 buttons(relatedBody);
 if(context){const items=relatedHeadlines(feed,origin);const ul=el('ul');for(const {item} of items){const li=el('li');li.append(link(item.title,item.link),el('span',` — ${item.source}; ${item.date?'publisher date '+item.date:item.first_seen?'first collected '+item.first_seen:'article date unknown'}`));ul.append(li);}relatedBody.append(items.length?ul:el('p','No matching topic headlines in the current feed. No project association inferred.'));}
 relatedBody.append(link('Official Data Centre Covenant policy context',policySource),el('p','Behind the meter: documented on-site generation, storage and demand. Front of meter: documented network assets and upgrades. A nearby asset is not a proven supplier or connection.'));
}
function selectOrigin(value){origin=contextForOrigin(value);drawRelated();return !!origin;}
function rememberNews(){const query=newsQuery();if(!query||query.value.length>2048)return;const filters={query:query.value,...Object.fromEntries(filterKinds.map(kind=>[kind,newsSelect(kind)?.value||'']))};try{history.replaceState({...history.state,[returnKey]:{path:location.pathname,filters,origin,contextTopic:activeTopic}},'');}catch{}}
function restoreNews(saved){const query=newsQuery();if(!query||!saved?.filters||typeof saved.filters.query!=='string'||saved.filters.query.length>2048)return false;if(saved.contextTopic&&requestedContext('?news_topic='+encodeURIComponent(saved.contextTopic))&&connectNews()){activeTopic=saved.contextTopic;renderMain();}let complete=true;query.value=saved.filters.query;for(const kind of filterKinds){const select=newsSelect(kind),value=saved.filters[kind];if(select&&typeof value==='string'&&[...select.options].some(o=>o.value===value))select.value=value;else if(value)complete=false;}query.dispatchEvent(new Event('input',{bubbles:true}));if(saved.origin)selectOrigin(saved.origin);return complete;}
function connectEntry(){const api=window.pipelineJourneyEntry,base=newsContextBase(location.origin+location.pathname);if(!base||api?.schema!=='pipeline.journey-entry.v1'||typeof api.setNewsContextUrl!=='function')return false;try{api.setNewsContextUrl(base);return true;}catch{return false;}}
window.pipelineEnergyContext={selectOrigin,topic:()=>activeTopic,newsBase:()=>newsContextBase(location.origin+location.pathname),newsUrl:value=>newsContextUrl(location.origin+location.pathname,value)};
window.addEventListener('pipeline-news-ready',()=>queueMicrotask(connectNews));D.addEventListener('DOMContentLoaded',connectNews,{once:true});connectNews();
window.addEventListener('pipeline-journey-ready',connectEntry);connectEntry();
window.addEventListener('pipeline-journey-origin',event=>{if(selectOrigin(event.detail))rememberNews();});
D.addEventListener('click',event=>{if(event.target.closest?.('#journeyAtlasNav'))rememberNews();},true);
for(const node of [newsQuery(),...filterKinds.map(newsSelect)].filter(Boolean))for(const type of ['input','change'])node.addEventListener(type,event=>{if(event.isTrusted)requestApplied=true;});
const applyRequest=()=>{if(requestApplied||!Array.isArray(feed?.items))return;const saved=history.state?.[returnKey];if(saved?.path===location.pathname){setTimeout(()=>{if(!requestApplied)requestApplied=restoreNews(saved);},0);return;}const request=requestedContext(location.search);if(request){if(request.origin)selectOrigin(request.origin);setTimeout(()=>{if(!requestApplied)requestApplied=topicFilter(request.topic);},0);}};
window.addEventListener('pipeline-feed-loaded',event=>{feed=event.detail;drawRelated();applyRequest();});
drawPolicy();drawRelated();
if(feed)applyRequest();
async function boundedText(name,max){const response=await fetch(new URL(name,import.meta.url),{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('Source unavailable');const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Source bound exceeded');chunks.push(value);}}finally{await reader.cancel();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
try{const [a,b]=await Promise.all([boundedText('policy.json',16000),boundedText('review.json',8000)]);policy=await acceptedPolicy(a,JSON.parse(b));}catch{}
policyPanel.dataset.state=policy?'source-qualified':'withheld';drawPolicy();
try{const [facts,notice]=await Promise.all([boundedText('../../document_facts_ui/20261117-v939/facts.json',16000),boundedText('../../grid_notice_ui/20261117-v938/notice.json',16000)]);gridContext=await acceptedGridContext(facts,JSON.parse(notice));}catch{}
policyPanel.dataset.gridContext=gridContext?'source-qualified':'withheld';drawPolicy();
