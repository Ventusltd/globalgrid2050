#!/usr/bin/env python3
from pathlib import Path

path = Path('uk_renewables_pipeline/dashboard_v5_live.html')
text = path.read_text(encoding='utf-8')

old = "async function loadNews(){try{const r=await fetch('../dist/major_project_news_v5.json?v='+Date.now());if(!r.ok)throw new Error('news '+r.status);renderNews(await r.json())}catch(e){document.getElementById('stories').innerHTML='<div class=\"news-empty\">Daily newspaper feed unavailable. REPD analytics below remain live.</div>';document.getElementById('newsMeta').textContent='feed unavailable'}}"

new = """function validNewsPayload(p){return p&&Array.isArray(p.items)&&Number.isFinite(Number(p.headline_count??p.items.length))}\nfunction newsPayloadTime(p){const t=Date.parse(String(p&&p.updated||''));return Number.isFinite(t)?t:0}\nasync function fetchNewsPayload(label,url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(label+' '+r.status);const data=await r.json();if(!validNewsPayload(data))throw new Error(label+' invalid payload');return {label,data}}\nasync function loadNews(){\n  const stamp=Date.now();\n  const sources=[\n    ['Pages','../dist/major_project_news_v5.json?v='+stamp],\n    ['GitHub main','https://raw.githubusercontent.com/Ventusltd/globalgrid2050/main/dist/major_project_news_v5.json?v='+stamp]\n  ];\n  const settled=await Promise.allSettled(sources.map(([label,url])=>fetchNewsPayload(label,url)));\n  const good=settled.filter(x=>x.status==='fulfilled').map(x=>x.value);\n  if(!good.length){document.getElementById('stories').innerHTML='<div class=\"news-empty\">Daily newspaper feed unavailable. REPD analytics below remain live.</div>';document.getElementById('newsMeta').textContent='feed unavailable';return}\n  good.sort((a,b)=>newsPayloadTime(b.data)-newsPayloadTime(a.data)||((b.data.items||[]).length-(a.data.items||[]).length));\n  const best=good[0];\n  renderNews(best.data);\n  const meta=document.getElementById('newsMeta');\n  meta.textContent += ' · '+best.label;\n}"""

if new in text:
    print('V5 loader already patched')
elif old in text:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print('Patched V5 news loader: Pages + raw GitHub main, newest payload wins')
else:
    raise SystemExit('Expected V5 loadNews function not found; refusing unsafe edit')

check = path.read_text(encoding='utf-8')
required = [
    "major_project_news_v5.json",
    "raw.githubusercontent.com/Ventusltd/globalgrid2050/main/dist/major_project_news_v5.json",
    "repd_master.json",
    "EXPORT CSV",
    "NEWS SIGNAL",
    "function drawNews()",
    "function table(d)",
    "</html>"
]
missing = [x for x in required if x not in check]
if missing:
    raise SystemExit('Integrity failure after patch: '+', '.join(missing))
if '<iframe' in check.lower():
    raise SystemExit('Integrity failure: iframe introduced')
print('V5 loader integrity PASS; bytes', len(check.encode('utf-8')))
