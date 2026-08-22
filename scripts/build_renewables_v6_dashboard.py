#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "uk_renewables_pipeline" / "dashboard_v5_live.html"
OUT = ROOT / "uk_renewables_pipeline" / "dashboard_v6_live.html"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"V6 builder expected exactly one {label} marker, found {count}")
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label):
    # Lambda prevents re.sub from interpreting JS backslashes in the replacement.
    updated, count = re.subn(pattern, lambda _: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"V6 builder expected exactly one {label} block, found {count}")
    return updated


src = SRC.read_text(encoding="utf-8")
if "</html>" not in src.lower() or "<iframe" in src.lower():
    raise RuntimeError("V5 gospel source is incomplete or unexpectedly contains an iframe")
if "major_project_news_v5.json" not in src or "NEWS SIGNAL" not in src or "REPD STATUS" not in src:
    raise RuntimeError("V5 gospel source is missing required newspaper/REPD features")

# Start from the complete V5 application, then make bounded V6 changes.
html = src.replace("V5", "V6").replace("v5", "v6")
html = replace_once(html, "V1–V4 behaviour retained.", "V1–V5 behaviour retained.", "version lineage")
html = replace_once(
    html,
    "Newspaper universe: solar &gt;49 MWp · BESS &gt;100 MW.",
    "Newspaper universe: solar &gt;1 MWp · BESS &gt;100 MW · every story bound to official REPD Ref ID + record update date.",
    "newspaper threshold",
)
html = replace_once(
    html,
    "UK utility-scale solar + battery intelligence",
    "UK solar &gt;1 MWp + BESS &gt;100 MW · DESNZ REPD-bound intelligence",
    "newspaper strap",
)
html = replace_once(
    html,
    '<a class="active" href="#">V6 NEWSPAPER</a><a href="dashboard_v4_live.html">V4</a>',
    '<a class="active" href="#">V6 NEWSPAPER</a><a href="dashboard_v5_live.html">V5</a><a href="dashboard_v4_live.html">V4</a>',
    "V5 navigation link",
)
html = replace_once(
    html,
    '<div class="tablewrap"><table><thead><tr><th>SITE NAME</th><th class="hide-mobile">COUNTY</th><th class="hide-mobile">OPERATOR</th><th>TECHNOLOGY</th><th>REPD STATUS</th><th>CAPACITY (MW)</th><th>NEWS SIGNAL</th><th>NEWS</th></tr></thead><tbody id="tbody"></tbody></table></div>',
    '<div class="tablewrap"><table><thead><tr><th>SITE NAME</th><th>REPD REF</th><th>REPD UPDATED</th><th class="hide-mobile">COUNTY</th><th class="hide-mobile">OPERATOR</th><th>TECHNOLOGY</th><th>REPD STATUS</th><th>CAPACITY (MW)</th><th>NEWS SIGNAL</th><th>NEWS</th></tr></thead><tbody id="tbody"></tbody></table></div>',
    "REPD table header",
)

html = sub_once(
    html,
    r"function signalForProject\(name\)\{.*?\}\nfunction charts",
    "function signalForProject(ref){const hit=newsItems.find(i=>String(i.repd_ref||'')===String(ref||''));if(!hit)return {label:'—',cls:'none',note:'no matched headline'};const e=String(hit.event||'PROJECT UPDATE').toUpperCase();if(e==='CONSENT')return {label:'APPROVED*',cls:'approved',note:`headline ${hit.published||''}`};if(e==='OPERATIONAL')return {label:'OPERATIONAL*',cls:'operational',note:`headline ${hit.published||''}`};if(e==='CONSTRUCTION')return {label:'CONSTRUCTION*',cls:'construction',note:`headline ${hit.published||''}`};if(['FINANCIAL CLOSE','ACQUISITION'].includes(e))return {label:e==='ACQUISITION'?'M&A*':'FINANCED*',cls:'finance',note:`headline ${hit.published||''}`};return {label:(e+'*').slice(0,22),cls:'',note:`headline ${hit.published||''}`}}\nfunction charts",
    "REPD-ref news signal",
)

html = sub_once(
    html,
    r"function table\(d\)\{.*?\}\nfunction apply",
    "function table(d){const tb=document.getElementById('tbody');tb.innerHTML='';d.forEach(x=>{const tr=document.createElement('tr'),q=encodeURIComponent(x.name+' '+x.cat+' REPD '+x.repdRef),sub=[x.county,x.op].filter(Boolean).join(' | '),fc=x.cat==='Offshore Wind'?'#fff':'#000',sig=signalForProject(x.repdRef);tr.innerHTML=`<td class=\"site\">${esc(x.name)}${sub?`<div class=\"mobile-extra\">${esc(sub)}</div>`:''}</td><td><b>${esc(x.repdRef||'-')}</b></td><td>${esc(x.repdUpdated||'-')}</td><td class=\"hide-mobile\">${esc(x.county||'-')}</td><td class=\"hide-mobile\">${esc(x.op||'-')}</td><td><span class=\"badge\" style=\"background:${colors[x.cat]||'#888'};color:${fc}\">${esc(x.cat)}</span></td><td>${esc(x.status)}</td><td class=\"mw\">${x.mw.toFixed(1)}</td><td><span class=\"signal ${sig.cls}\">${esc(sig.label)}</span><div class=\"signal-note\">${esc(sig.note)} · not REPD-confirmed</div></td><td><a class=\"newslink\" target=\"_blank\" rel=\"noopener\" href=\"https://www.google.com/search?q=${q}&tbm=nws\">📰</a></td>`;tb.appendChild(tr)})}\nfunction apply",
    "REPD-ref table renderer",
)

html = replace_once(
    html,
    "const hay=[i.headline,i.project,i.operator,i.county,i.source,i.event].join(' ').toUpperCase();",
    "const hay=[i.headline,i.project,i.repd_ref,i.repd_record_updated,i.planning_application_reference,i.operator,i.county,i.source,i.event].join(' ').toUpperCase();",
    "news search fields",
)

html = sub_once(
    html,
    r"function drawNews\(\)\{.*?\}\nfunction renderNews",
    "function drawNews(){const box=document.getElementById('stories'),rows=newsItems.filter(newsMatch);if(!rows.length){box.innerHTML='<div class=\"news-empty\">No headlines match this newspaper filter.</div>';return}box.innerHTML=rows.map(i=>{const cls=i.technology==='bess'?'bess':'solar',cap=Number(i.capacity_mw||0),conf=Number(i.confidence||0);return `<a class=\"story ${cls}\" href=\"${esc(i.url)}\" target=\"_blank\" rel=\"noopener\"><div class=\"kicker\">${esc((i.technology||'').toUpperCase())} · ${esc(i.event||'PROJECT UPDATE')} · ${esc(i.published||'')}</div><h3>${esc(i.headline||i.project)}</h3><p><span class=\"project\">${esc(i.project||'')}${cap?' · '+cap.toLocaleString()+' MW':''}</span>${i.operator?' · '+esc(i.operator):''}${i.county?' · '+esc(i.county):''}</p><span class=\"source\">REPD #${esc(i.repd_ref||'?')} · record updated ${esc(i.repd_record_updated||'?')}${i.planning_application_reference?' · planning '+esc(i.planning_application_reference):''}</span><span class=\"source\">${esc(i.source||'Source')}${conf?' · match '+conf+'%':''}</span></a>`}).join('')}\nfunction renderNews",
    "REPD-bound newspaper cards",
)

html = sub_once(
    html,
    r"function renderNews\(payload\)\{.*?\}\nfunction validNewsPayload",
    "function renderNews(payload){newsItems=Array.isArray(payload.items)?payload.items:[];const eligible=payload.eligible_projects==null?'REPD universe pending refresh':Number(payload.eligible_projects).toLocaleString()+' eligible projects';const edition=String(payload.repd_edition||'DESNZ REPD').replace(/\\s*\\(CSV\\)\\s*$/,'');document.getElementById('newsMeta').textContent=`${newsItems.length} headlines · ${eligible} · ${edition} · ${String(payload.updated||'').slice(0,10)}`;drawNews();if(all.length)table(filtered)}\nfunction validNewsPayload",
    "V6 newspaper metadata",
)
html = replace_once(
    html,
    "function validNewsPayload(p){return p&&Array.isArray(p.items)&&Number.isFinite(Number(p.headline_count??p.items.length))}",
    "function validNewsPayload(p){return p&&p.repd_bound===true&&Array.isArray(p.items)&&p.items.every(i=>i.repd_ref&&i.repd_record_updated)&&Number.isFinite(Number(p.headline_count??p.items.length))}",
    "V6 payload integrity check",
)

html = sub_once(
    html,
    r"document\.getElementById\('export'\)\.onclick=e=>\{.*?\};\nwindow\.onload",
    "document.getElementById('export').onclick=e=>{e.preventDefault();const rows=filtered.length?filtered:all,out=['Site Name,REPD Ref,REPD Record Updated,County,Operator,Technology,REPD Status,Capacity MW,News Signal,News Signal Note'];rows.forEach(x=>{const s=signalForProject(x.repdRef);out.push([x.name,x.repdRef,x.repdUpdated,x.county,x.op,x.cat,x.status,x.mw,s.label,s.note+'; not REPD-confirmed'].map(v=>'\\\"'+String(v).replace(/\\\"/g,'\\\"\\\"')+'\\\"').join(','))});const u=URL.createObjectURL(new Blob(['\\ufeff'+out.join('\\n')],{type:'text/csv'})),a=document.createElement('a');a.href=u;a.download='globalgrid2050_uk_renewables_pipeline_v6_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u)};\nwindow.onload",
    "V6 CSV export",
)

html = replace_once(
    html,
    "all.push({name:p.name||'Unknown Site',county:co,op,cat,status:title(p.status||'Unknown'),mw})",
    "all.push({name:p.name||'Unknown Site',repdRef:String(p.repd_ref||''),repdUpdated:String(p.repd_record_updated||''),county:co,op,cat,status:title(p.status||'Unknown'),mw})",
    "REPD loader binding",
)
html = html.replace('colspan="8"', 'colspan="10"')

if "major_project_news_v6.json" not in html:
    raise RuntimeError("V6 feed path missing after generation")
if "REPD REF" not in html or "REPD UPDATED" not in html or "repdRef" not in html:
    raise RuntimeError("V6 official REPD fields missing after generation")
if "dashboard_v5_live.html" not in html:
    raise RuntimeError("V6 lineage link back to V5 missing")
if "<iframe" in html.lower():
    raise RuntimeError("V6 must remain a standalone application")
if "</html>" not in html.lower():
    raise RuntimeError("V6 closing HTML missing")
if len(html.encode("utf-8")) < len(src.encode("utf-8")):
    raise RuntimeError("V6 unexpectedly became smaller than V5 gospel source")

OUT.write_text(html, encoding="utf-8")
print(f"V6 dashboard built from V5 gospel: V5={len(src.encode('utf-8'))} bytes V6={len(html.encode('utf-8'))} bytes")
