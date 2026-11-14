let BASE = "../202611132345/";
let RELEASE = null;
const REF_KEY = /^([1-9]\d{0,7})$/;
const QUALIFIED = new Set(["uk-repd","data-centres","global-projects","ai-investment","cybersecurity","ethics"]);
const STRATEGIC = new Set(["cybersecurity","ethics"]);
const NEWS_SCHEMA = "globalgrid2050.energy24.news.v1";
const TZ = { "Europe/London":"en-GB", "America/New_York":"en-US", "America/Los_Angeles":"en-US", "Asia/Hong_Kong":"en-GB", "Asia/Tokyo":"en-GB", "Australia/Sydney":"en-GB" };
const $ = (selector) => document.querySelector(selector);
const el = (tag, className, value) => {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(value!==undefined) node.textContent=String(value);
  return node;
};
function updateClocks(){
  for(const node of document.querySelectorAll(".market[data-zone]")){
    const zone=node.dataset.zone;
    const clock=node.querySelector("time");
    try {clock.textContent=new Intl.DateTimeFormat(TZ[zone] || "en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());}
    catch {clock.textContent="–";}
  }
}
updateClocks();
setInterval(updateClocks,60000);

const state={articles:[],projects:new Map(),activeFilter:"all",manifest:null,errors:[]};
function verifiedUrl(s) {
  try { const u=new URL(s); return ["https:","http:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null; }
  catch {return null;}
}
function absoluteDate(s) {
  if(typeof s!=="string" || !s.trim()) return null;
  const d=new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}
function dateText(s) {
  const d=absoluteDate(s);
  return d ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(d) : "Date unverified";
}
function stampLabel(s) {
  const d=absoluteDate(s);
  return d ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"UTC"}).format(d)+" UTC" : "unknown";
}
function briefCategory(category) {
  return ({"uk-repd":"UK REPD","data-centres":"DATA CENTRE","global-projects":"GLOBAL ENERGY","ai-investment":"AI INVESTMENT","cybersecurity":"CYBERSECURITY","ethics":"ETHICS & ACCOUNTABILITY"})[category] || "ENERGY";
}
function moreEvidence(a) {
  const fragments=[a.source,dateText(a.published_utc)];
  if(a.repd_ref) fragments.push("REPD "+a.repd_ref);
  if(Number.isFinite(a.capacity_mw)) fragments.push(a.capacity_mw.toLocaleString("en-GB")+" MW");
  if(Number.isFinite(a.capex_usd)) fragments.push("US$"+Math.round(a.capex_usd / 1e6).toLocaleString("en-GB")+"m reported");
  fragments.push(a.evidence_tier === "official" ? "Official publication" : "Attributed report");
  return fragments.join(" · ");
}
function qualify(a){
  if(!a || typeof a!=="object" || typeof a.headline!=="string" || !a.headline.trim() || !verifiedUrl(a.url)) return false;
  if(!QUALIFIED.has(a.category) || !["official","attributed"].includes(a.evidence_tier)) return false;
  if(a.category==="uk-repd"){
    const ref=String(a.repd_ref || "");
    const p=state.projects.get(ref);
    // No UK news signal without exact authoritative REPD Ref and 50 MW+ capacity.
    if(!REF_KEY.test(ref)||!p||!Number.isFinite(Number(p.capacity_mw))||Number(p.capacity_mw)<50) return false;
    if(a.capacity_mw!=null && Math.abs(Number(a.capacity_mw)-Number(p.capacity_mw))>0.02) return false;
    return true;
  }
  if(a.repd_ref) return false; // Prevent an international or data-centre ID being presented as a UK REPD key.
  const capex=typeof a.capex_usd==="number" && Number.isFinite(a.capex_usd) ? a.capex_usd : null;
  const power=typeof a.capacity_mw==="number" && Number.isFinite(a.capacity_mw) ? a.capacity_mw : null;
  // For source-verified strategic events without a measurable project, show only
  // in their labelled subject section, never equate them with a >50 MW project.
  if(STRATEGIC.has(a.category)) return a.strategic_context===true;
  if(power!=null && power<50 && (capex==null || capex<25000000)) return false;
  return (capex!=null && capex>=25000000) || (power!=null && power>=50);
}
function link(title,url,cls){
  const n=el("a",cls,title);n.href=verifiedUrl(url)||"#";n.target="_blank";n.rel="noopener noreferrer";return n;
}
function createInfo(a){
  const meta=el("div","source-row");
  meta.append(el("span",null,a.source || "Unknown source"),el("span",null,dateText(a.published_utc)));
  if(a.repd_ref) meta.append(el("span","ref","REPD "+a.repd_ref));
  if(Number.isFinite(a.capacity_mw)) meta.append(el("span","capex",a.capacity_mw.toLocaleString("en-GB")+" MW"));
  if(Number.isFinite(a.capex_usd)) meta.append(el("span","capex","US$"+(a.capex_usd/1e6).toFixed(0)+"m CAPEX"));
  return meta;
}
function storyCard(a,variant="story-card"){
  const c=el("article",variant);
  c.append(el("span","category",briefCategory(a.category)),el("h3",null,a.headline),createInfo(a),link("Read source",a.url));
  return c;
}
function selectLead(articles){
  const lead=articles.find(a=>!STRATEGIC.has(a.category));
  const container=$("#lead-story");container.replaceChildren();
  if(!lead){container.append(el("div","empty-state","No recent independently sourced headline has cleared the published screening policy."));}
  else{
    container.append(el("div","lead-kicker",briefCategory(lead.category)+(lead.repd_ref?" · REPD "+lead.repd_ref:"")),el("h3",null,lead.headline),el("div","lead-byline",moreEvidence(lead)),link("Read evidence →",lead.url,"lead-action"));
  }
  const more=$("#lead-more");more.replaceChildren();
  for(const a of articles.filter(a=>a!==lead && !STRATEGIC.has(a.category)).slice(0,2)){more.append(storyCard(a,"mini-story"));}
  const uk=$("#uk-focus");uk.replaceChildren();
  const selected=articles.filter(a=>["uk-repd","data-centres"].includes(a.category)).slice(0,5);
  if(!selected.length)uk.append(el("div","empty-state","No qualified UK REPD or data-centre story is available in the current verified source scan."));
  else for(const a of selected) uk.append(storyCard(a,"compact-story"));
}
function renderNews() {
  const list=$("#stories");list.replaceChildren();
  const filtered=state.articles.filter(a=>state.activeFilter==="all"||a.category===state.activeFilter);
  if(!filtered.length)list.append(el("div","empty-state","No published story meets this category's identity, investment and evidence thresholds. Sources will be checked again."));
  else for(const a of filtered.slice(0,36))list.append(storyCard(a));
  selectLead(state.articles);
}
for(const btn of document.querySelectorAll(".filter")){
  btn.addEventListener("click",()=>{
    for(const b of document.querySelectorAll(".filter")){b.classList.toggle("active",b===btn);b.setAttribute("aria-pressed",String(b===btn));}
    state.activeFilter=btn.dataset.filter;renderNews();
  });
}
function findFirstProjects(parts){
  const all=parts.flatMap(p=>p.projects||[]);
  const seen=new Set();
  const eligible=[];
  for(const p of all){
    const ref=String(p.repd_ref||"");
    if(!REF_KEY.test(ref)||seen.has(ref))continue;
    seen.add(ref);state.projects.set(ref,p);
    if(Number(p.capacity_mw)>=50)eligible.push(p);
  }
  eligible.sort((a,b)=>(b.capacity_mw||0)-(a.capacity_mw||0));
  const table=$("#projects-table");table.replaceChildren();
  for(const p of eligible.slice(0,12)){
    const tr=el("tr");
    tr.append(el("td",null,p.repd_ref),el("td",null,p.name||"Name unavailable"),
      el("td",null,String(p.technology||"").replaceAll("_"," ")),el("td",null,Number(p.capacity_mw).toLocaleString("en-GB")),el("td",null,p.status||"Unknown"));
    const map=el("td");
    const u=new URL("https://ventusltd.github.io/gridatlas/atlas/");
    u.searchParams.set("repd_ref",p.repd_ref);
    u.searchParams.set("technology",p.technology||"");
    if(p.geometry_status==="valid"&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)){
      u.searchParams.set("latitude",p.latitude);u.searchParams.set("longitude",p.longitude);u.searchParams.set("zoom","12");
      map.append(link("MAP",u.href));
    }else{
      const noMap=el("span","small-note","NO MAP · REPD location unavailable");
      map.append(noMap);
    }
    tr.append(map);table.append(tr);
  }
  return all.length;
}
async function loadProjects(){
  try{
    const r=await fetch(BASE+"data/v9.1/build_manifest.json",{cache:"no-store"});
    if(!r.ok)throw Error("REPD manifest HTTP "+r.status);
    const manifest=await r.json();
    if(!RELEASE || manifest.project_count!==RELEASE.registry_count||!Array.isArray(manifest.project_partitions)||!manifest.project_partitions.length)throw Error("REPD release count/partition contract differs from explicit versioned source pointer.");
    const parts=await Promise.all(manifest.project_partitions.map(async part=>{
      const rr=await fetch(BASE+part.path);
      if(!rr.ok)throw Error("REPD partition "+part.path+" HTTP "+rr.status);
      const data=await rr.json();
      if(!Array.isArray(data.projects)||data.projects.length!==part.record_count)throw Error("REPD partition count mismatch "+part.path);
      return data;
    }));
    const n=findFirstProjects(parts);
    if(n!==manifest.project_count||state.projects.size!==RELEASE.registry_count)throw Error("REPD full register identity is incomplete or duplicated");
    state.manifest=manifest;
    $("#repd-rows").textContent=RELEASE.unique_repd_refs.toLocaleString("en-GB");
    return true;
  }catch(error){
    $("#projects-table").replaceChildren(el("tr",null));
    $("#projects-table tr").append(el("td",null,"REPD registry unavailable: "+String(error)));
    $("#repd-rows").textContent="UNAVAILABLE";
    state.errors.push("REPD: "+error.message);
    return false;
  }
}
function validArticle(a,asOf){
  if(!qualify(a))return false;
  // Independently enforce public-language requirements on any externally supplied JSON.
  if(/\b(?:fuck(?:ing)?|shit|cunt|motherfucker|bullshit)\b/i.test(a.headline)) return false;
  const d=absoluteDate(a.published_utc);
  if(!d || d.getTime()>asOf+3_600_000 || (asOf-d.getTime())>14*86400000)return false;
  if(!a.source || !a.id || !/^[a-f0-9]{16,64}$/.test(a.id))return false;
  return true;
}
async function loadNews(){
  const status=$("#feed-state"),meta=$("#feed-meta");
  try{
    const response=await fetch("./data/news.latest.json",{cache:"no-store"});
    if(!response.ok)throw Error("Feed HTTP "+response.status);
    const payload=await response.json();
    if(payload.schema!==NEWS_SCHEMA || !Array.isArray(payload.articles) || payload.release!==RELEASE?.release_id)throw Error("Invalid or mismatched news release contract");
    const issued=absoluteDate(payload.generated_utc);
    if(!issued)throw Error("No verified scan timestamp");
    const age=Date.now()-issued.getTime();
    if(age < -3_600_000)throw Error("Future-dated news scan");
    state.articles=payload.articles.filter(a=>validArticle(a,Date.now()))
      .sort((a,b)=>(b.priority||0)-(a.priority||0)||Date.parse(b.published_utc)-Date.parse(a.published_utc));
    const late=age>3*3600_000;
    status.textContent=late?"SOURCE SCAN STALE":state.articles.length?"NEWS SCAN VERIFIED":"NO QUALIFYING HEADLINES";
    meta.textContent="Last source scan: "+stampLabel(payload.generated_utc)+" · "+state.articles.length+" evidence-qualified items"+(late?" · older than 3 hours":"");
    $("#scan-status").textContent=meta.textContent;
    $("#lead-freshness").textContent=late?"Refresh overdue":"Last checked "+stampLabel(payload.generated_utc);
  }catch(error){
    state.articles=[];status.textContent="NEWS FEED UNAVAILABLE";
    meta.textContent="No verified automatic news feed has been published. "+error.message;
    $("#scan-status").textContent="News ingestion unavailable; REPD register remains independent.";
    state.errors.push("News: "+error.message);
  }
  renderNews();
}
async function loadReleasePointer(){
  const r=await fetch("./data/release.json",{cache:"no-store"});
  if(!r.ok)throw Error("REPD version pointer unavailable ("+r.status+")");
  const p=await r.json();
  if(p.schema!=="globalgrid2050.energy24.release-pointer.v1" ||
    !/^20\d{2}q[1-4]$/.test(p.release_id) || !/^20\d{10}$/.test(p.release_directory) ||
    !Number.isInteger(p.registry_count) || p.registry_count<1 ||
    !Number.isInteger(p.unique_repd_refs) || p.unique_repd_refs<p.registry_count ||
    !/^[a-f0-9]{64}$/.test(p.official_csv_sha256))
      throw Error("REPD version pointer invalid; refusing implicit fallback");
  BASE="../"+p.release_directory+"/";
  RELEASE=p;
  $("#repd-rows").title=p.source_label+" · exact official source SHA256 "+p.official_csv_sha256;
}
try{
  await loadReleasePointer();
  await loadProjects();
}catch(error){
  state.errors.push("Version: "+String(error));
  $("#repd-rows").textContent="UNAVAILABLE";
  $("#projects-table").replaceChildren();
  const tr=el("tr"),td=el("td",null,"Verified REPD version unavailable: "+String(error));
  td.colSpan=6;tr.append(td);$("#projects-table").append(tr);
}
await loadNews();
