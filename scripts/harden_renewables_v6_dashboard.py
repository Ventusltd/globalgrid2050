#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "uk_renewables_pipeline" / "dashboard_v6_live.html"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"V6 identity UI expected exactly one {label}, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"V6 identity UI expected exactly one {label}, found {count}")
    return updated


html = OUT.read_text(encoding="utf-8")
if "UK RENEWABLES PIPELINE V6" not in html or "major_project_news_v6.json" not in html:
    raise RuntimeError("V6 base dashboard has not been built")

html = replace_once(
    html,
    '<div class="tablewrap"><table><thead><tr><th>SITE NAME</th><th>REPD REF</th><th>REPD UPDATED</th><th class="hide-mobile">COUNTY</th><th class="hide-mobile">OPERATOR</th><th>TECHNOLOGY</th><th>REPD STATUS</th><th>CAPACITY (MW)</th><th>NEWS SIGNAL</th><th>NEWS</th></tr></thead><tbody id="tbody"></tbody></table></div>',
    '<div class="tablewrap"><table><thead><tr><th>SITE NAME</th><th>GLOBALGRID ID</th><th>REPD REF</th><th>REPD UPDATED</th><th class="hide-mobile">GG DEVELOPMENT</th><th class="hide-mobile">COUNTY</th><th class="hide-mobile">OPERATOR</th><th>TECHNOLOGY</th><th>REPD STATUS</th><th>CAPACITY (MW)</th><th>NEWS SIGNAL</th><th>NEWS</th></tr></thead><tbody id="tbody"></tbody></table></div>',
    "identity table header",
)

html = replace_once(
    html,
    "function normProject(v){return String(v||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim()}",
    "function normProject(v){return String(v||'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim()}\nfunction repdDate(v){return v?String(v):'not supplied by REPD'}",
    "REPD date helper",
)

html = sub_once(
    html,
    r"function table\(d\)\{.*?\}\nfunction apply",
    "function table(d){const tb=document.getElementById('tbody');tb.innerHTML='';d.forEach(x=>{const tr=document.createElement('tr'),q=encodeURIComponent(x.name+' '+x.cat+' '+x.ggProjectId+' REPD '+x.repdRef),sub=[x.county,x.op].filter(Boolean).join(' | '),fc=x.cat==='Offshore Wind'?'#fff':'#000',sig=signalForProject(x.repdRef),cap=x.capacityKnown?x.mw.toFixed(1):'—';tr.innerHTML=`<td class=\"site\">${esc(x.name)}${sub?`<div class=\"mobile-extra\">${esc(sub)}</div>`:''}</td><td><b>${esc(x.ggProjectId||'-')}</b></td><td><b>${esc(x.repdRef||'-')}</b></td><td>${esc(repdDate(x.repdUpdated))}</td><td class=\"hide-mobile\">${esc(x.ggDevelopmentId||'-')}</td><td class=\"hide-mobile\">${esc(x.county||'-')}</td><td class=\"hide-mobile\">${esc(x.op||'-')}</td><td><span class=\"badge\" style=\"background:${colors[x.cat]||'#888'};color:${fc}\">${esc(x.cat)}</span></td><td>${esc(x.status)}</td><td class=\"mw\">${cap}</td><td><span class=\"signal ${sig.cls}\">${esc(sig.label)}</span><div class=\"signal-note\">${esc(sig.note)} · not REPD-confirmed</div></td><td><a class=\"newslink\" target=\"_blank\" rel=\"noopener\" href=\"https://www.google.com/search?q=${q}&tbm=nws\">📰</a></td>`;tb.appendChild(tr)})}\nfunction apply",
    "identity table renderer",
)

html = sub_once(
    html,
    r"function apply\(\)\{.*?\}\nfunction title",
    "function apply(){filtered=all.filter(x=>(tech==='All'||x.cat===tech)&&(status==='All'||x.status.includes(status))&&(county==='All'||x.county===county)&&(!search||x.op.includes(search)||x.name.toUpperCase().includes(search)||x.repdRef.toUpperCase().includes(search)||x.ggProjectId.toUpperCase().includes(search)||x.ggDevelopmentId.toUpperCase().includes(search)));gauges(filtered);table(filtered)}\nfunction title",
    "identity-aware asset search",
)

html = sub_once(
    html,
    r"function newsMatch\(i\)\{.*?\}\nfunction drawNews",
    "function newsMatch(i){const e=String(i.event||'').toUpperCase(),t=String(i.technology||'').toUpperCase();if(newsMode==='SOLAR'&&t!=='SOLAR')return false;if(newsMode==='BESS'&&t!=='BESS')return false;if(newsMode==='CONSENT'&&e!=='CONSENT')return false;if(newsMode==='CONSTRUCTION'&&e!=='CONSTRUCTION')return false;if(newsMode==='OPERATIONAL'&&e!=='OPERATIONAL')return false;if(newsMode==='FINANCE'&&!financeEvent(e))return false;if(newsQuery){const hay=[i.headline,i.project,i.gg_project_id,i.gg_development_id,i.repd_ref,i.repd_record_updated,i.planning_application_reference,i.operator,i.county,i.source,i.event].join(' ').toUpperCase();if(!hay.includes(newsQuery))return false}return true}\nfunction drawNews",
    "identity-aware news search",
)

html = sub_once(
    html,
    r"function drawNews\(\)\{.*?\}\nfunction renderNews",
    "function drawNews(){const box=document.getElementById('stories'),rows=newsItems.filter(newsMatch);if(!rows.length){box.innerHTML='<div class=\"news-empty\">No headlines match this newspaper filter.</div>';return}box.innerHTML=rows.map(i=>{const cls=i.technology==='bess'?'bess':'solar',cap=Number(i.capacity_mw||0),conf=Number(i.confidence||0);return `<a class=\"story ${cls}\" href=\"${esc(i.url)}\" target=\"_blank\" rel=\"noopener\"><div class=\"kicker\">${esc((i.technology||'').toUpperCase())} · ${esc(i.event||'PROJECT UPDATE')} · ${esc(i.published||'')}</div><h3>${esc(i.headline||i.project)}</h3><p><span class=\"project\">${esc(i.project||'')}${cap?' · '+cap.toLocaleString()+' MW':''}</span>${i.operator?' · '+esc(i.operator):''}${i.county?' · '+esc(i.county):''}</p><span class=\"source\">${esc(i.gg_project_id||'GG ID pending')} · REPD #${esc(i.repd_ref||'?')} · updated ${esc(repdDate(i.repd_record_updated))}</span><span class=\"source\">${esc(i.gg_development_id||'')}${i.planning_application_reference?' · planning '+esc(i.planning_application_reference):''}</span><span class=\"source\">${esc(i.source||'Source')}${conf?' · match '+conf+'%':''}</span></a>`}).join('')}\nfunction renderNews",
    "identity-bound newspaper cards",
)

html = sub_once(
    html,
    r"function renderNews\(payload\)\{.*?\}\nfunction validNewsPayload",
    "function renderNews(payload){newsItems=Array.isArray(payload.items)?payload.items:[];const eligible=payload.eligible_projects==null?'REPD universe pending refresh':Number(payload.eligible_projects).toLocaleString()+' eligible projects',edition=String(payload.repd_edition||'DESNZ REPD').replace(/\\s*\\(CSV\\)\\s*$/,''),coverage=Number(payload.repd_record_update_coverage);const cov=Number.isFinite(coverage)?' · REPD update-date '+(coverage*100).toFixed(1)+'% supplied':'';document.getElementById('newsMeta').textContent=`${newsItems.length} headlines · ${eligible} · ${edition} · ${String(payload.updated||'').slice(0,10)}${cov}`;drawNews();if(all.length)table(filtered)}\nfunction validNewsPayload",
    "identity newspaper metadata",
)

html = replace_once(
    html,
    "function validNewsPayload(p){return p&&p.repd_bound===true&&Array.isArray(p.items)&&p.items.every(i=>i.repd_ref&&i.repd_record_updated)&&Number.isFinite(Number(p.headline_count??p.items.length))}",
    "function validNewsPayload(p){return p&&p.repd_bound===true&&p.globalgrid_id_required===true&&Array.isArray(p.items)&&p.items.every(i=>i.repd_ref&&i.gg_project_id&&i.gg_development_id&&Object.prototype.hasOwnProperty.call(i,'repd_record_updated'))&&Number.isFinite(Number(p.headline_count??p.items.length))}",
    "identity payload gate",
)

html = sub_once(
    html,
    r"document\.getElementById\('export'\)\.onclick=e=>\{.*?\};\nwindow\.onload",
    "document.getElementById('export').onclick=e=>{e.preventDefault();const rows=filtered.length?filtered:all,out=['Site Name,GlobalGrid Project ID,GlobalGrid Development ID,REPD Ref,REPD Record Updated,County,Operator,Technology,REPD Status,Capacity MW,News Signal,News Signal Note'];rows.forEach(x=>{const s=signalForProject(x.repdRef);out.push([x.name,x.ggProjectId,x.ggDevelopmentId,x.repdRef,x.repdUpdated||'not supplied by REPD',x.county,x.op,x.cat,x.status,x.capacityKnown?x.mw:'',s.label,s.note+'; not REPD-confirmed'].map(v=>'\\\"'+String(v??'').replace(/\\\"/g,'\\\"\\\"')+'\\\"').join(','))});const u=URL.createObjectURL(new Blob(['\\ufeff'+out.join('\\n')],{type:'text/csv'})),a=document.createElement('a');a.href=u;a.download='globalgrid2050_uk_renewables_pipeline_v6_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u)};\nwindow.onload",
    "identity CSV export",
)

html = replace_once(
    html,
    "all.push({name:p.name||'Unknown Site',repdRef:String(p.repd_ref||''),repdUpdated:String(p.repd_record_updated||''),county:co,op,cat,status:title(p.status||'Unknown'),mw})",
    "all.push({name:p.name||'Unknown Site',ggProjectId:String(p.gg_project_id||''),ggDevelopmentId:String(p.gg_development_id||''),repdRef:String(p.repd_ref||''),repdUpdated:String(p.repd_record_updated||''),capacityKnown:p.capacity_known!==false,county:co,op,cat,status:title(p.status||'Unknown'),mw})",
    "GlobalGrid REPD loader binding",
)

html = html.replace('colspan="10"', 'colspan="12"')
html = replace_once(
    html,
    "<strong>STATUS DISCIPLINE</strong><span><b>REPD STATUS</b> is the official dataset field. <b>NEWS SIGNAL</b> is headline-derived intelligence only and never changes or confirms REPD status.</span>",
    "<strong>IDENTITY + STATUS DISCIPLINE</strong><span><b>GLOBALGRID ID</b> is the stable internal identity; <b>REPD REF</b> is the authoritative DESNZ record identity. <b>REPD STATUS</b> remains official. <b>NEWS SIGNAL</b> is headline-derived intelligence only and never changes or confirms REPD status.</span>",
    "identity/status discipline",
)

required = [
    "GLOBALGRID ID",
    "GG DEVELOPMENT",
    "ggProjectId",
    "ggDevelopmentId",
    "not supplied by REPD",
    "globalgrid_id_required",
    "REPD REF",
    "REPD UPDATED",
]
for token in required:
    if token not in html:
        raise RuntimeError(f"V6 identity UI missing required token: {token}")
if "<iframe" in html.lower() or "</html>" not in html.lower():
    raise RuntimeError("V6 identity UI lost standalone HTML integrity")

OUT.write_text(html, encoding="utf-8")
print("V6 identity UI hardened", len(html.encode("utf-8")), "bytes")
