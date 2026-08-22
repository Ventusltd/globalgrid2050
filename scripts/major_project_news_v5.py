#!/usr/bin/env python3
from __future__ import annotations
import json, math, re, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus
import requests

ROOT=Path(__file__).resolve().parents[1]
REPD_PATH=ROOT/'dist'/'repd_master.json'; NEWS_OUT=ROOT/'dist'/'major_project_news_v5.json'; PROJECTS_OUT=ROOT/'dist'/'major_projects_v5.json'
SOLAR_MIN_EXCLUSIVE=49.0; BESS_MIN_EXCLUSIVE=100.0; LOOKBACK_DAYS=183; MAX_HEADLINES=200; MAX_PER_PROJECT=4; MIN_SCORE=64; BATCH_SIZE=20; WORKERS=12
PRIORITY_SOURCES={'BBC':'bbc.co.uk','Solar Power Portal':'solarpowerportal.co.uk','Energy-Storage.News':'energy-storage.news','PV Magazine':'pv-magazine.com'}
BROAD_QUERIES=['"solar farm" UK MW','"solar park" UK MW','"solar energy park" UK MW','"battery energy storage" UK MW','BESS UK MW','"battery storage" UK grid','"development consent" solar UK','"planning consent" solar UK','"financial close" solar UK','"financial close" battery UK','"construction" solar farm UK','"construction" battery storage UK','"commercial operation" battery UK','"energised" battery UK','"acquisition" solar farm UK','"acquisition" battery storage UK']
SOURCE_QUERIES=[f'site:{d} UK {t}' for d in PRIORITY_SOURCES.values() for t in ('solar farm MW','solar consent construction operational','battery storage MW','BESS consent construction operational')]
EVENTS=[('OPERATIONAL',['commercial operation','operational','energised','energized','commissioned','goes live','entered operation']),('CONSTRUCTION',['construction','breaking ground','build begins','under construction','construction starts']),('CONSENT',['development consent','planning consent','approved','approval','consented','permission granted']),('FINANCIAL CLOSE',['financial close','financing','funding secured','debt financing']),('ACQUISITION',['acquires','acquired','acquisition','sold to','sale of','portfolio sale']),('GRID CONNECTION',['grid connection','connected to the grid','connection agreement','grid offer']),('EXPANSION',['expansion','expanded','extension','upsized']),('DELAY / REFUSAL',['refused','rejected','delayed','delay','judicial review'])]
STOP={'solar','farm','park','energy','battery','storage','bess','project','limited','ltd','plc','the','and','of','at','uk','phase','site','development','power','renewables','renewable'}
GENERIC_SINGLE={'grange','manor','common','lodge','hall','hill','fields','field','wood','woods','green','bridge','bank','brook','mill','moor','marsh','meadow','meadows'}
FOREIGN_PHRASES={'new jersey','california','texas','australia','canada','germany','italy','spain','india','china','south africa','new zealand','ireland','united states','us roundup'}

def clean(v):
 s=str(v or ''); return '' if s.lower() in {'nan','none','null'} else s.strip()
def norm(v): return re.sub(r'\s+',' ',re.sub(r'[^a-z0-9]+',' ',clean(v).lower().replace('&',' and '))).strip()
def toks(v): return {t for t in norm(v).split() if len(t)>=3 and t not in STOP}
def load_projects():
 data=json.loads(REPD_PATH.read_text(encoding='utf-8')); out=[]; seen=set()
 for f in data.get('features',[]):
  p=f.get('properties',{}); tech=clean(p.get('tech'))
  try: mw=float(p.get('capacity') or 0)
  except: continue
  if not math.isfinite(mw): continue
  solar=tech in {'solar','solar_roof'} and mw>SOLAR_MIN_EXCLUSIVE; bess=tech=='bess' and mw>BESS_MIN_EXCLUSIVE
  if not(solar or bess): continue
  name=clean(p.get('name')) or 'Unknown Site'; cat='solar' if solar else 'bess'; key=(norm(name),cat,round(mw,3))
  if key in seen: continue
  seen.add(key); op=clean(p.get('operator')); county=clean(p.get('county') or p.get('local_planning_authority') or p.get('region'))
  out.append({'id':re.sub(r'[^a-z0-9]+','-',norm(name)).strip('-')[:80] or 'project','name':name,'operator':op,'county':county,'status':clean(p.get('status')),'technology':cat,'capacity_mw':round(mw,3),'_name_norm':norm(name),'_name_tokens':sorted(toks(name)),'_operator_tokens':sorted(toks(op)),'_county_tokens':sorted(toks(county))})
 return sorted(out,key=lambda x:(-x['capacity_mw'],x['name']))
def fetch_rss(q):
 url='https://news.google.com/rss/search?q='+quote_plus(f'{q} when:6m')+'&hl=en-GB&gl=GB&ceid=GB:en'; r=requests.get(url,headers={'User-Agent':'GlobalGrid2050/5.4 (+https://globalgrid2050.com/)'},timeout=15); r.raise_for_status(); root=ET.fromstring(r.content); cutoff=datetime.now(timezone.utc)-timedelta(days=LOOKBACK_DAYS); rows=[]
 for i in root.findall('.//item'):
  title=clean(i.findtext('title')); link=clean(i.findtext('link')); desc=clean(i.findtext('description')); src=i.find('source'); source=clean(src.text if src is not None else ''); source_url=clean(src.attrib.get('url') if src is not None else '')
  try: dt=parsedate_to_datetime(clean(i.findtext('pubDate'))); dt=(dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
  except: continue
  if title and link and dt>=cutoff: rows.append({'title':title,'link':link,'description':re.sub(r'<[^>]+>',' ',desc),'published':dt,'source':source,'source_url':source_url})
 return rows
def event(text):
 t=norm(text)
 for label,needles in EVENTS:
  if any(norm(n) in t for n in needles): return label
 return 'PROJECT UPDATE'
def source_bonus(s,u):
 x=norm(s)+' '+norm(u)
 if any(v in x for v in ('gov uk','planning inspectorate','planninginspectorate')): return 22
 if any(v in x for v in ('solar power portal','energy storage news','pv magazine','bbc')): return 20
 return 5
def capacity_match(p,text):
 for m in re.findall(r'\b(\d{2,4}(?:\.\d+)?)\s*mw\b',text):
  try:
   if abs(float(m)-p['capacity_mw'])<=max(10,p['capacity_mw']*.2): return True
  except: pass
 return False
def gate(p,s):
 text=norm(s['title']+' '+s['description']+' '+s['source']); tt=set(text.split()); names=set(p['_name_tokens']); op=set(p['_operator_tokens']); county=set(p['_county_tokens']); exact=bool(p['_name_norm'] and p['_name_norm'] in text); overlap=len(names&tt); op_hit=bool(op&tt); county_hit=bool(county&tt); cap_hit=capacity_match(p,text); official=any(x in norm(s['source']+' '+s['source_url']) for x in ('gov uk','planning inspectorate','planninginspectorate')); tech_hit=('solar' in tt or 'photovoltaic' in tt or 'pv' in tt) if p['technology']=='solar' else bool({'battery','bess','storage'}&tt)
 foreign=any(norm(x) in text and norm(x) not in p['_name_norm'] for x in FOREIGN_PHRASES)
 if foreign and not(exact and (county_hit or official)): return False
 if not exact and overlap<2: return False
 if len(names)==1 and next(iter(names),'') in GENERIC_SINGLE and not(exact and tech_hit and (op_hit or county_hit or cap_hit or official)): return False
 if not tech_hit and not(official and exact) and not(exact and cap_hit and (op_hit or county_hit)): return False
 return True
def score(p,s):
 if not gate(p,s): return -999
 text=norm(s['title']+' '+s['description']+' '+s['source']); tt=set(text.split()); names=set(p['_name_tokens']); op=set(p['_operator_tokens']); county=set(p['_county_tokens']); exact=p['_name_norm'] in text; ov=len(names&tt); sc=70 if exact else 50 if ov>=3 else 38
 sc+=18 if op and len(op&tt)>=min(2,len(op)) else 8 if op&tt else 0; sc+=12 if county&tt else 0; sc+=15 if capacity_match(p,text) else 0; age=max(0,(datetime.now(timezone.utc)-s['published']).days); sc+=18 if age<=14 else 14 if age<=30 else 10 if age<=90 else 6; sc+=12 if event(text)!='PROJECT UPDATE' else 0
 return sc+source_bonus(s['source'],s['source_url'])
def queries(projects):
 qs=BROAD_QUERIES+SOURCE_QUERIES
 for cat in ('solar','bess'):
  names=[p['name'] for p in projects if p['technology']==cat]; suffix='solar UK' if cat=='solar' else '"battery storage" UK'
  for n in range(0,len(names),BATCH_SIZE): qs.append('('+' OR '.join('"'+x.replace('"','')+'"' for x in names[n:n+BATCH_SIZE])+') '+suffix)
 return qs
def collect(projects):
 raw=[]; seen=set(); qs=queries(projects)
 with ThreadPoolExecutor(max_workers=WORKERS) as ex:
  futs={ex.submit(fetch_rss,q):q for q in qs}
  for f in as_completed(futs):
   try: rows=f.result()
   except Exception as e: print('WARN',futs[f],e); continue
   for s in rows:
    key=(norm(s['title']),s['source_url'] or s['source'])
    if s['link'] not in seen and key not in seen: seen.add(s['link']); seen.add(key); raw.append(s)
 matches=[]; global_seen=set(); rejected=0
 for p in projects:
  cand=[]
  for s in raw:
   if not gate(p,s): rejected+=1; continue
   sc=score(p,s)
   if sc>=MIN_SCORE: cand.append((s['published'].timestamp(),sc,s))
  cand.sort(reverse=True,key=lambda x:(x[0],x[1])); kept=0
  for _,sc,s in cand:
   hk=norm(s['title'])
   if not hk or hk in global_seen: continue
   global_seen.add(hk); matches.append({'project_id':p['id'],'project':p['name'],'technology':p['technology'],'capacity_mw':p['capacity_mw'],'operator':p['operator'],'county':p['county'],'status':p['status'],'event':event(s['title']+' '+s['description']),'headline':re.sub(r'\s+-\s+[^-]{2,80}$','',s['title']).strip(),'published':s['published'].date().isoformat(),'source':s['source'] or 'Google News','source_url':s['source_url'],'url':s['link'],'confidence':min(100,int(sc))}); kept+=1
   if kept>=MAX_PER_PROJECT: break
 matches.sort(key=lambda x:(x['published'],x['confidence'],x['capacity_mw']),reverse=True); print('queries',len(qs),'raw',len(raw),'rejected',rejected); return matches[:MAX_HEADLINES],rejected
def main():
 projects=load_projects(); now=datetime.now(timezone.utc).isoformat(); public=[{k:v for k,v in p.items() if not k.startswith('_')} for p in projects]; PROJECTS_OUT.write_text(json.dumps({'schema':'globalgrid2050.major-projects.v5','updated':now,'thresholds':{'solar_mw_exclusive':49.0,'bess_mw_exclusive':100.0},'count':len(public),'projects':public},indent=2),encoding='utf-8'); headlines,rejected=collect(projects); NEWS_OUT.write_text(json.dumps({'schema':'globalgrid2050.major-project-news.v5','updated':now,'lookback_days':LOOKBACK_DAYS,'news_horizon_days':LOOKBACK_DAYS,'crawl_target_minutes':3,'thresholds':{'solar_mw_exclusive':49.0,'bess_mw_exclusive':100.0},'eligible_projects':len(projects),'headline_count':len(headlines),'priority_sources':list(PRIORITY_SOURCES),'quality_gate':'project identity + UK/location veto + energy context + generic-name corroboration','rejected_candidates':rejected,'method':'REPD eligibility -> six-month concurrent discovery -> hard identity/location gates -> scoring -> dedupe','items':headlines},indent=2),encoding='utf-8'); print('eligible',len(projects),'headlines',len(headlines),'days',LOOKBACK_DAYS)
if __name__=='__main__': main()
