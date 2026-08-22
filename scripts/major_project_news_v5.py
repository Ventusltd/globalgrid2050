#!/usr/bin/env python3
from __future__ import annotations
import json, math, re, time, xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus
import requests

ROOT=Path(__file__).resolve().parents[1]
REPD_PATH=ROOT/'dist'/'repd_master.json'
NEWS_OUT=ROOT/'dist'/'major_project_news_v5.json'
PROJECTS_OUT=ROOT/'dist'/'major_projects_v5.json'
SOLAR_MIN_EXCLUSIVE=49.0
BESS_MIN_EXCLUSIVE=100.0
MAX_HEADLINES=75
MIN_SCORE=60
BATCH_SIZE=5

BROAD_QUERIES=[
 '"solar farm" UK MW', '"solar park" UK MW', '"solar energy park" UK MW',
 '"battery energy storage" UK MW', 'BESS UK MW', '"battery storage" UK grid',
 '"development consent" solar UK', '"planning consent" solar UK',
 '"financial close" solar UK', '"financial close" battery UK',
 '"construction" solar farm UK', '"construction" battery storage UK',
 '"commercial operation" battery UK', '"energised" battery UK',
 '"acquisition" solar farm UK', '"acquisition" battery storage UK'
]
EVENTS=[
 ('OPERATIONAL',['commercial operation','operational','energised','energized','commissioned','goes live','entered operation']),
 ('CONSTRUCTION',['construction','breaking ground','build begins','under construction','construction starts']),
 ('CONSENT',['development consent','planning consent','approved','approval','consented','permission granted']),
 ('FINANCIAL CLOSE',['financial close','financing','funding secured','debt financing']),
 ('ACQUISITION',['acquires','acquired','acquisition','sold to','sale of','portfolio sale']),
 ('GRID CONNECTION',['grid connection','connected to the grid','connection agreement','grid offer']),
 ('EXPANSION',['expansion','expanded','extension','upsized']),
 ('DELAY / REFUSAL',['refused','rejected','delayed','delay','judicial review'])
]
STOP={'solar','farm','park','energy','battery','storage','bess','project','limited','ltd','plc','the','and','of','at','uk','phase','site','development','power','renewables','renewable'}

def clean(v):
    s=str(v or '')
    return '' if s.lower() in {'nan','none','null'} else s.strip()

def norm(v):
    s=clean(v).lower().replace('&',' and ')
    s=re.sub(r'[^a-z0-9]+',' ',s)
    return re.sub(r'\s+',' ',s).strip()

def toks(v):
    return {t for t in norm(v).split() if len(t)>=3 and t not in STOP}

def load_projects():
    data=json.loads(REPD_PATH.read_text(encoding='utf-8'))
    out=[]; seen=set()
    for f in data.get('features',[]):
        p=f.get('properties',{}); tech=clean(p.get('tech'))
        try: mw=float(p.get('capacity') or 0)
        except: continue
        if not math.isfinite(mw): continue
        is_solar=tech in {'solar','solar_roof'} and mw>SOLAR_MIN_EXCLUSIVE
        is_bess=tech=='bess' and mw>BESS_MIN_EXCLUSIVE
        if not (is_solar or is_bess): continue
        name=clean(p.get('name')) or 'Unknown Site'
        cat='solar' if is_solar else 'bess'
        key=(norm(name),cat,round(mw,3))
        if key in seen: continue
        seen.add(key)
        operator=clean(p.get('operator'))
        county=clean(p.get('county') or p.get('local_planning_authority') or p.get('region'))
        out.append({
            'id':re.sub(r'[^a-z0-9]+','-',norm(name)).strip('-')[:80] or 'project',
            'name':name,'operator':operator,'county':county,'status':clean(p.get('status')),
            'technology':cat,'capacity_mw':round(mw,3),
            '_name_norm':norm(name),'_name_tokens':sorted(toks(name)),
            '_operator_tokens':sorted(toks(operator)),'_county_tokens':sorted(toks(county))
        })
    out.sort(key=lambda x:(-x['capacity_mw'],x['name']))
    return out

def fetch_rss(q):
    url='https://news.google.com/rss/search?q='+quote_plus(q)+'&hl=en-GB&gl=GB&ceid=GB:en'
    r=requests.get(url,headers={'User-Agent':'GlobalGrid2050/5.0 (+https://globalgrid2050.com/)'},timeout=25)
    r.raise_for_status()
    root=ET.fromstring(r.content); rows=[]
    for i in root.findall('.//item'):
        title=clean(i.findtext('title')); link=clean(i.findtext('link')); desc=clean(i.findtext('description')); pub=clean(i.findtext('pubDate'))
        src=i.find('source'); source=clean(src.text if src is not None else ''); source_url=clean(src.attrib.get('url') if src is not None else '')
        if not title or not link: continue
        try:
            dt=parsedate_to_datetime(pub); dt=dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc); dt=dt.astimezone(timezone.utc)
        except: dt=datetime.now(timezone.utc)
        rows.append({'title':title,'link':link,'description':re.sub(r'<[^>]+>',' ',desc),'published':dt,'source':source,'source_url':source_url})
    return rows

def event(text):
    t=norm(text)
    for label,needles in EVENTS:
        if any(norm(n) in t for n in needles): return label
    return 'PROJECT UPDATE'

def source_bonus(source,url):
    s=norm(source)+' '+norm(url)
    if any(x in s for x in ['gov uk','planning inspectorate','planninginspectorate']): return 20
    if any(x in s for x in ['solar power portal','energy storage news','pv tech','current news']): return 14
    return 5

def score(p,s):
    text=norm(s['title']+' '+s['description']+' '+s['source']); tt=set(text.split()); sc=0
    if p['_name_norm'] and p['_name_norm'] in text: sc+=70
    else:
        ov=len(set(p['_name_tokens']) & tt)
        sc += 50 if ov>=3 else 35 if ov==2 else 22 if ov==1 and len(p['_name_tokens'])==1 else 0
    op=set(p['_operator_tokens']); co=set(p['_county_tokens'])
    sc += 18 if op and len(op&tt)>=min(2,len(op)) else 8 if op&tt else 0
    sc += 10 if co&tt else 0
    for m in re.findall(r'\b(\d{2,4}(?:\.\d+)?)\s*mw\b',text):
        try:
            if abs(float(m)-p['capacity_mw'])<=max(10,p['capacity_mw']*.2): sc+=15; break
        except: pass
    age=max(0,(datetime.now(timezone.utc)-s['published']).days)
    sc += 22 if age<=7 else 18 if age<=14 else 14 if age<=30 else 8 if age<=90 else 2 if age<=365 else -20
    if event(text)!='PROJECT UPDATE': sc+=12
    return sc+source_bonus(s['source'],s['source_url'])

def batched_queries(projects):
    qs=list(BROAD_QUERIES)
    for cat in ('solar','bess'):
        names=[p['name'] for p in projects if p['technology']==cat]
        suffix='solar UK' if cat=='solar' else '"battery storage" UK'
        for n in range(0,len(names),BATCH_SIZE):
            group=names[n:n+BATCH_SIZE]
            ors=' OR '.join('"'+x.replace('"','')+'"' for x in group)
            qs.append('('+ors+') '+suffix)
    return qs

def collect(projects):
    raw=[]; seen=set(); queries=batched_queries(projects)
    for n,q in enumerate(queries):
        try:
            for s in fetch_rss(q):
                if s['link'] not in seen:
                    seen.add(s['link']); raw.append(s)
        except Exception as e:
            print('WARN',q,e)
        if n and n%12==0: time.sleep(.4)
    matches=[]
    for p in projects:
        candidates=[]
        for s in raw:
            sc=score(p,s)
            if sc>=MIN_SCORE: candidates.append((sc,s['published'].timestamp(),s))
        candidates.sort(reverse=True,key=lambda x:(x[0],x[1]))
        if not candidates: continue
        sc,_,s=candidates[0]
        matches.append({
            'project_id':p['id'],'project':p['name'],'technology':p['technology'],'capacity_mw':p['capacity_mw'],
            'operator':p['operator'],'county':p['county'],'status':p['status'],
            'event':event(s['title']+' '+s['description']),
            'headline':re.sub(r'\s+-\s+[^-]{2,80}$','',s['title']).strip(),
            'published':s['published'].date().isoformat(),'source':s['source'] or 'Google News',
            'source_url':s['source_url'],'url':s['link'],'confidence':min(100,int(sc))
        })
    matches.sort(key=lambda x:(x['published'],x['confidence'],x['capacity_mw']),reverse=True)
    return matches[:MAX_HEADLINES]

def main():
    projects=load_projects(); now=datetime.now(timezone.utc).isoformat()
    public=[{k:v for k,v in p.items() if not k.startswith('_')} for p in projects]
    PROJECTS_OUT.write_text(json.dumps({'schema':'globalgrid2050.major-projects.v5','updated':now,'thresholds':{'solar_mw_exclusive':SOLAR_MIN_EXCLUSIVE,'bess_mw_exclusive':BESS_MIN_EXCLUSIVE},'count':len(public),'projects':public},indent=2),encoding='utf-8')
    headlines=collect(projects)
    NEWS_OUT.write_text(json.dumps({'schema':'globalgrid2050.major-project-news.v5','updated':now,'thresholds':{'solar_mw_exclusive':SOLAR_MIN_EXCLUSIVE,'bess_mw_exclusive':BESS_MIN_EXCLUSIVE},'eligible_projects':len(projects),'headline_count':len(headlines),'method':'REPD eligibility -> batched all-project RSS discovery -> deterministic entity scoring -> per-project dedupe','items':headlines},indent=2),encoding='utf-8')
    print('eligible',len(projects),'headlines',len(headlines))

if __name__=='__main__': main()
