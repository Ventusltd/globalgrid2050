import {reconcileProvisional} from './202609060213-provisional-identity.mjs';
export const CONTRACT={schema:'pipelinenews.provisional-pipeline.v1',generation:'202609060213'};
export function mount({host,payload,official,source}) {
  if(payload.schema!=='pipelinenews.provisional-register.v1') throw Error('Pending register schema mismatch');
  const projects=reconcileProvisional(payload.projects,official,source);
  const pending=projects.filter(row=>!row.official_repd_ref);
  const label=document.createElement('p');label.textContent=pending.length+' reported project(s) awaiting a verified REPD match. These are additional intake records, excluded from official REPD capacity totals.';
  const scroll=document.createElement('div');scroll.style.overflowX='auto';
  const table=document.createElement('table');table.style.minWidth='620px';
  const head=table.createTHead().insertRow();for(const text of ['Project','Temporary REPD ID','Global Grid reference','Reported capacity','Status','Source']){const th=document.createElement('th');th.textContent=text;head.append(th);}
  for(const p of pending){const row=table.insertRow();for(const value of [p.name,p.repd_ref,p.gg_project_id,p.capacity_mw+' MW (reported upper bound)',p.status])row.insertCell().textContent=value;const cell=row.insertCell(),link=document.createElement('a');link.href=p.article_url;link.textContent='BBC News';cell.append(link);}
  scroll.append(table);host.replaceChildren(label,scroll);
  if(projects.length!==pending.length){const p=document.createElement('p');p.textContent=(projects.length-pending.length)+' previously temporary record(s) now matched to official REPD numbers; those projects belong in the main REPD table.';host.append(p);}
  host.dataset.pendingReady='true';host.dataset.pendingCount=String(pending.length);
  return {projects,pending:pending.length};
}
