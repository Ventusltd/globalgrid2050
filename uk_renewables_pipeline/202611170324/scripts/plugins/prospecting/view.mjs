/** Safe DOM renderer; append compact details inside an existing project row. */
function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
function link(label,url){const element=node('a',label);element.href=url;element.target='_blank';element.rel='noopener noreferrer';return element;}
function clockLabel(value){return value?`${value.basis}: ${value.timestamp??'unknown'} (${value.state.toLowerCase().replaceAll('_',' ')})`:'Source observation date: unknown';}
const capacityLabels={repd_installed_mw:'Official installed capacity',it_load_mw:'IT load',site_demand_mw:'Site demand',grid_connection_mw:'Grid connection'};
export function renderPriority(row,asOf){
  const details=node('details',undefined,'research-priority');details.dataset.priorityId=row.id;
  details.append(node('summary',`Research priority #${row.rank} · ${row.score} points`));
  const content=node('div',undefined,'priority-content');details.append(content);
  content.append(node('p','Research ordering only. This score is not verification, investment value or available grid capacity.','priority-note'));
  content.append(node('p',`Ranked as of ${asOf}. Source record: ${row.record_state.toLowerCase()}.`));
  const reasons=node('ul');for(const reason of row.reasons)reasons.append(node('li',`${reason.name.replaceAll('_',' ')}: ${reason.points}/${reason.max} — ${reason.basis}`));content.append(reasons);
  content.append(node('p','Momentum: unknown','priority-unknown'),node('p',row.heat.reason),node('p',clockLabel(row.record_freshness)),node('p',clockLabel(row.retrieval_freshness)));
  const figures=node('ul');for(const [key,value] of Object.entries(row.capacities))figures.append(node('li',`${capacityLabels[key]}: ${value===null?'unknown':`${value} MW`}`));content.append(figures);
  content.append(node('p',`Official status: ${row.official_status??'unknown'}. This is not a newly occurring event.`),node('p','Current financing: not assessed'),node('p',row.research_note),node('p',row.corporate_reason),link('Inspect source record',row.source.url));
  if(row.evidence.length){const list=node('ul');for(const article of row.evidence){const item=node('li');item.append(link(article.title,article.url),node('p',`${article.publisher} · published ${article.pub_date} · provisional association`),node('p',clockLabel(article.retrieval_freshness)));list.append(item);}content.append(list);}
  else content.append(node('p','Project news coverage: unknown. No supplied match does not establish inactivity.'));
  return details;
}
export function attachPriority(host,row,asOf){host.querySelector(':scope > [data-priority-id]')?.remove();host.append(renderPriority(row,asOf));}
export function renderReviewRows(host,rows,asOf){
  host.replaceChildren();
  for(const row of rows){const item=node('article',undefined,'review-row');item.dataset.recordId=row.id;item.append(node('h3',row.name??'Name not supplied by source'),node('p',`${row.id} · ${row.country??'Country unknown'} · ${row.technology}`,'record-meta'),renderPriority(row,asOf));host.append(item);}
  if(!rows.length)host.append(node('p','No records in this loaded review subset match these filters.'));
}
