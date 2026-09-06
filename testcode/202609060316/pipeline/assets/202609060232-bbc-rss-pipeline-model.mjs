import {validateReportedProject} from './202609060232-bbc-reported-project.mjs';

export const LIVE_RSS_URL = 'https://raw.githubusercontent.com/Ventusltd/pipelinenews/main/discovery/products/bbc-rss.json';
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export function articleIdentity(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/news\/articles\/([a-z0-9]+)\/?$/i);
    if (url.protocol !== 'https:' || !['www.bbc.co.uk','www.bbc.com'].includes(url.hostname) || !match) return null;
    return {id:'bbc:'+match[1].toLowerCase(), url:`https://www.bbc.co.uk/news/articles/${match[1].toLowerCase()}`};
  } catch { return null; }
}

// The collector's asserted REPD fields are deliberately not a binding authority.
export function projectObservation(item, projects = [], evidence = [], official = []) {
  const identity = articleIdentity(item.url);
  const candidates = projects.filter(project=>articleIdentity(project.article_url)?.id === identity?.id);
  const project = candidates.length === 1 ? candidates[0] : null;
  const reported = evidence.find(report=>articleIdentity(report.article_url)?.id===identity?.id && report.primary_project===project?.name);
  const validated = reported ? validateReportedProject(reported) : null;
  const ref = String(project?.official_repd_ref || '');
  const bound = project?.identity_status==='REPD_BOUND' && /^\d+$/.test(ref) && official.some(row=>String(row.repd_ref)===ref);
  return {
    name:project?.name || null,
    status:bound?'OFFICIAL_IDENTITY_VERIFIED':project?'REPD_PENDING':'UNMATCHED_REQUIRES_REVIEW',
    repd_ref:bound?ref:null,
    temporary_ref:!bound&&/^[0-9]+-REPD-TBC$/.test(project?.repd_ref || '')?project.repd_ref:null,
    gg_project_id:bound?`GG2050-REPD-${ref}`:project?.gg_project_id || null,
    claims:validated?.claims || [],
    related_projects:validated?.related_projects || [],
    unknowns:validated?.unknowns || [],
    evidence_basis:validated?.evidence_basis || null,
    // A verified project identity never converts a report into official capacity or headroom.
    capacity_basis:'reported only; excluded from official REPD totals',
    eligible_for_project_signal:false,
  };
}

export function buildRssView(payload, {now=Date.now(), projects=[], evidence=[], official=[], refreshError=null}={}) {
  if(payload?.schema!=='pipelinenews.bbc-rss.v1' || !Array.isArray(payload.items) || !Array.isArray(payload.feeds)) throw Error('Unsupported BBC RSS product');
  if(payload.items.length>500 || payload.feeds.length>100) throw Error('BBC RSS product exceeds bounded collection contract');
  const checked=Date.parse(payload.checked_at), successful=Date.parse(payload.last_success_at);
  const clockValid=Number.isFinite(now)&&Number.isFinite(checked)&&checked<=now+60000&&Number.isFinite(successful)&&successful<=now+60000;
  const age=clockValid?Math.max(0,now-successful):null;
  const good=payload.feeds.filter(feed=>feed.status==='ok').length;
  const total=payload.feeds.length;
  const collection=good===0?'FAILED':good<total||payload.status!=='ok'?'PARTIAL':'OK';
  const freshness=!clockValid?'UNKNOWN':age>STALE_AFTER_MS?'STALE':'FRESH';
  const unique=new Map();
  let rejected=0;
  for(const item of payload.items) {
    const identity=articleIdentity(item.url);
    if(!identity || typeof item.headline!=='string' || !item.headline.trim() || (item.id && item.id!==identity.id)) {rejected++;continue;}
    if(unique.has(identity.id)) continue;
    unique.set(identity.id,{...identity,headline:item.headline.trim(),published_at:item.source_published_at || null,observation:projectObservation(item,projects,evidence,official)});
  }
  return {items:[...unique.values()],rejected,collection,freshness,age_ms:age,checked_at:payload.checked_at || null,last_success_at:payload.last_success_at || null,feed_success:good,feed_total:total,feeds:payload.feeds.map(feed=>({url:String(feed.url || ''),status:String(feed.status || 'unknown')})),refresh_error:refreshError?String(refreshError):null};
}

// On any fetch/schema failure retain the previous product and visibly mark refresh failure.
export async function refreshRss(previous, {fetcher=fetch, ...options}={}) {
  try {
    const response=await fetcher(LIVE_RSS_URL,{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw Error('Source HTTP '+response.status);
    const text=await response.text();
    if(text.length>2*1024*1024) throw Error('Source exceeds 2 MiB limit');
    const payload=JSON.parse(text);
    return {payload,view:buildRssView(payload,options),live:true};
  } catch(error) {
    return {payload:previous,view:buildRssView(previous,{...options,refreshError:error.message}),live:false};
  }
}
