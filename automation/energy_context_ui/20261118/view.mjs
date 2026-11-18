import {acceptedPolicy,policySource,relatedHeadlines,contextForOrigin,newsContextUrl,requestedContext} from './model.mjs';
const D=document,news=D.querySelector('.pn-news-quality'),grid=D.getElementById('gridPanel');
const el=(tag,text)=>{const n=D.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
let origin=null,policy=null,feed=window.pipelineHeadlineDocument,requestApplied=false;
const policyPanel=el('details'),summary=el('summary','AI demand, clean energy and grid policy');policyPanel.className='pn-energy-context';policyPanel.id='energyPolicyContext';policyPanel.append(summary);
const body=el('div');policyPanel.append(body);news?.append(policyPanel);
const related=el('details'),relatedBody=el('div');related.className='pn-energy-context';related.id='journeyNewsContext';related.append(el('summary','Journey context — original news and official sources'),relatedBody);grid?.append(related);
function topicFilter(topic){
 const select=D.querySelector('.pn-news-filter-tools select[aria-label="News topic"]'),category=D.querySelector('.pn-news-filter-tools select[aria-label="News category"]'),query=D.querySelector('.pn-news-header-search input');
 if(!select||!query)return false;
 for(const node of D.querySelectorAll('.pn-news-filter-tools select'))node.value='';query.value='';
 if([...select.options].some(o=>o.value===topic)){select.value=topic;select.dispatchEvent(new Event('change',{bubbles:true}));}
 else if(category&&[...category.options].some(o=>o.value===topic)){category.value=topic;category.dispatchEvent(new Event('change',{bubbles:true}));}
 else{query.value={grid:'grid',storage:'storage',renewables:'renewable',datacentre:'datacentre'}[topic]||topic;query.dispatchEvent(new Event('input',{bubbles:true}));}
 D.getElementById('headlinesHeading')?.scrollIntoView({block:'start'});return true;
}
function buttons(host){
 const controls=el('div');controls.className='pn-energy-actions';
 for(const [topic,label] of [['datacentre','Data-centre news'],['grid','Grid-upgrade news'],['storage','Storage and flexibility'],['renewables','Clean-energy news']]){
  const button=el('button',label);button.type='button';button.dataset.newsTopic=topic;button.addEventListener('click',()=>{const ok=topicFilter(topic);status.textContent=ok?'Applied '+label.toLowerCase()+' to the existing news controls; zero matches is a valid result.':'News controls are not available yet.';});controls.append(button);
 }const status=el('p');status.setAttribute('role','status');host.append(controls,status);
}
function drawPolicy(){
 body.replaceChildren();body.append(el('p','Explore renewable supply, AI electricity demand and grid upgrades using the existing news topics.' ));buttons(body);
 body.append(link('UK Government Data Centre Covenant',policySource));
 if(!policy){body.append(el('p','Policy facts await source-integrity and independent review. The official publication remains available.'));return;}
 body.append(el('p',`${policy.publisher} · published ${policy.published_date.value} (DAY). National policy context; no project compliance assessment.`));
 const ul=el('ul');for(const theme of policy.themes){const li=el('li');li.append(link(theme.label,policy.source_url+'#'+theme.fragment));ul.append(li);}body.append(ul);
 for(const q of policy.quantities)body.append(el('p',`${q.value} ${q.unit==='ratio'?'PUE':q.unit} — ${q.meaning}.`));
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
window.pipelineEnergyContext={selectOrigin,newsUrl:value=>newsContextUrl(location.href,value)};
window.addEventListener('pipeline-journey-origin',event=>selectOrigin(event.detail));
const applyRequest=()=>{if(requestApplied)return;const request=requestedContext(location.search);if(request){if(request.origin)selectOrigin(request.origin);setTimeout(()=>{if(!requestApplied)requestApplied=topicFilter(request.topic);},0);}};
window.addEventListener('pipeline-feed-loaded',event=>{feed=event.detail;drawRelated();applyRequest();});
drawPolicy();drawRelated();
if(feed)applyRequest();
async function boundedText(name,max){const response=await fetch(new URL(name,import.meta.url),{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('Source unavailable');const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Source bound exceeded');chunks.push(value);}}finally{await reader.cancel();}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
try{const [a,b]=await Promise.all([boundedText('policy.json',16000),boundedText('review.json',8000)]);policy=await acceptedPolicy(a,JSON.parse(b));}catch{}
policyPanel.dataset.state=policy?'source-qualified':'withheld';drawPolicy();
