import {buildRssView,refreshRss} from './202609060232-bbc-rss-pipeline-model.mjs';
export const CONTRACT={schema:'pipelinenews.bbc-rss-pipeline.v1',generation:'202609060232'};

export function mount({host,payload,evidence=[],projects=[],official=[],fetcher=fetch}) {
  const doc=host.ownerDocument;
  const ukTime=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(date):'unknown';};
  const create=(tag,text)=>{const el=doc.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const description=create('p','BBC RSS discovery runs every two hours. This panel checks the latest collected headlines on opening; article pages are not fetched. News reports do not establish consent, firm capacity or connection headroom.');
  const controls=create('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';
  const refresh=create('button','Refresh collected RSS'),snapshot=create('button','Publication snapshot');
  for(const button of [refresh,snapshot]){button.type='button';button.style.cssText='min-height:44px;padding:8px 12px;cursor:pointer';}
  controls.append(refresh,snapshot);
  const status=create('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=create('div');list.style.overflowWrap='anywhere';
  const details=create('details'),summary=create('summary','Source feed health'),feeds=create('ul');details.append(summary,feeds);
  host.replaceChildren(description,controls,status,list,details);
  let current=payload,mode='Publication snapshot',request=0,disposed=false;
  const options=()=>({projects:typeof projects==='function'?projects():projects,evidence,official});
  function render(view) {
    host.dataset.rssReady='true';host.dataset.rssFreshness=view.freshness;host.dataset.rssCollection=view.collection;host.dataset.rssItems=String(view.items.length);
    status.textContent=`${mode} | ${view.collection}: ${view.feed_success}/${view.feed_total} feeds | ${view.freshness} | checked ${view.checked_at?ukTime(view.checked_at):'unknown'} | last successful collection ${view.last_success_at?ukTime(view.last_success_at):'none'}.`+(view.refresh_error?' Refresh unavailable: '+view.refresh_error+'. Previous observations retained.':'');
    list.replaceChildren();
    if(!view.items.length)list.append(create('p','No matching headlines in this collection. An empty feed is not proof that a project does not exist.'));
    for(const item of view.items) {
      const article=create('article');article.style.cssText='border-top:1px solid currentColor;padding:12px 0';
      const link=create('a',item.headline);link.href=item.url;link.rel='noopener noreferrer';
      article.append(link,create('p','BBC News | '+(item.published_at?ukTime(item.published_at):'Publication date unavailable')));
      const observation=item.observation;
      if(observation.name) {
        const identity=observation.repd_ref?'Verified official REPD identity '+observation.repd_ref:'Awaiting verified REPD match'+(observation.temporary_ref?' | '+observation.temporary_ref:'');
        article.append(create('p',observation.name+' | '+identity+(observation.gg_project_id?' | '+observation.gg_project_id:'')));
        const claims=create('ul');
        for(const claim of observation.claims)claims.append(create('li',claim.metric.replaceAll('_',' ')+': '+(claim.value===true?'reported included':String(claim.value))+(claim.unit?' '+claim.unit:'')+(claim.qualifier?' — '+claim.qualifier:'')));
        article.append(claims,create('p','These statements remain reported evidence, even after an official identity match. '+observation.capacity_basis+'.'));
        if(observation.related_projects.length)article.append(create('p','Separate related project: '+observation.related_projects.map(project=>project.name).join(', ')+'. Its capacity and cost are not attributed to '+observation.name+'.'));
        if(observation.unknowns.length)article.append(create('p','Not established by this report: '+observation.unknowns.join('; ')+'.'));
        if(observation.evidence_basis)article.append(create('small',observation.evidence_basis));
      } else article.append(create('p','REPD match unverified. Headline metadata only; no project capacity inferred.'));
      list.append(article);
    }
    feeds.replaceChildren();for(const feed of view.feeds)feeds.append(create('li',feed.status+' | '+feed.url));
    summary.textContent=`Source feed health (${view.feed_success}/${view.feed_total} successful)`;
  }
  async function update() {
    const token=++request;refresh.disabled=true;status.textContent='Refreshing collected BBC RSS metadata…';
    const result=await refreshRss(current,{...options(),fetcher});
    if(disposed||token!==request)return;
    current=result.payload;if(result.live)mode='Latest collected RSS';
    refresh.disabled=false;render(result.view);
  }
  refresh.addEventListener('click',update);
  snapshot.addEventListener('click',()=>{request++;refresh.disabled=false;current=payload;mode='Publication snapshot';render(buildRssView(current,options()));});
  render(buildRssView(current,options()));
  const ready=update();
  return {ready,refresh:update,dispose(){disposed=true;request++;}};
}
