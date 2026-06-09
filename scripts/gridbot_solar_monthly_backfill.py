#!/usr/bin/env python3
from __future__ import annotations

import argparse, datetime as dt, hashlib, json, urllib.parse, urllib.request, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
CANDIDATE=ROOT/'data/confirmed/pvlive_solar_daily_candidate.json'
BROWSER=ROOT/'uk_energy_tracking_v6/generation_history/pvlive_solar_daily_browser.json'
PROGRESS=ROOT/'data/confirmed/pvlive_solar_daily_BACKFILL_PROGRESS.json'
REPORT=ROOT/'data_science_protocol/audit_reports/SOLAR_MONTHLY_BACKFILL_LATEST.md'
REPORT_JSON=ROOT/'data_science_protocol/audit_reports/json/SOLAR_MONTHLY_BACKFILL_LATEST.json'
API='https://api.solar.sheffield.ac.uk/pvlive/api/v4/gsp/0'
SOURCE='Sheffield Solar PVLive'
ATTRIBUTION='Sheffield Solar PVLive, solar.sheffield.ac.uk'


def utc_now(): return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
def month_key(d): return f'{d.year:04d}-{d.month:02d}'
def month_start(s):
    y,m=map(int,s.split('-')[:2]); return dt.date(y,m,1)
def next_month(d): return dt.date(d.year+1,1,1) if d.month==12 else dt.date(d.year,d.month+1,1)
def month_end(d): return next_month(d)-dt.timedelta(days=1)
def iso_z(v):
    try:
        x=dt.datetime.fromisoformat(str(v).replace('Z','+00:00'))
        if x.tzinfo is None: x=x.replace(tzinfo=dt.timezone.utc)
        return x.astimezone(dt.timezone.utc).isoformat().replace('+00:00','Z')
    except Exception: return ''
def get_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':'GlobalGrid2050 GridBot'})
    with urllib.request.urlopen(req,timeout=90) as r: return json.loads(r.read().decode('utf-8'))
def rows_from(p):
    if isinstance(p,list): return p
    if isinstance(p,dict):
        for k in ('data','results','items'):
            if isinstance(p.get(k),list): return p[k]
    return []
def parse_row(r):
    if isinstance(r,list) and len(r)>=3: t,g=r[1],r[2]
    elif isinstance(r,dict):
        t=r.get('datetime_gmt') or r.get('datetime') or r.get('time') or r.get('timestamp') or r.get('periodStartUTC')
        g=r.get('generation_mw') or r.get('generationMW') or r.get('generation') or r.get('power')
    else: return None
    try: mw=float(g)
    except Exception: return None
    z=iso_z(t)
    if not z: return None
    return z,mw

def fetch_month(mstart):
    mend=month_end(mstart)
    start=dt.datetime.combine(mstart,dt.time(0,0),tzinfo=dt.timezone.utc)
    end=dt.datetime.combine(mend,dt.time(23,59),tzinfo=dt.timezone.utc)
    url=API+'?'+urllib.parse.urlencode({'start':start.isoformat().replace('+00:00','Z'),'end':end.isoformat().replace('+00:00','Z')})
    by_day={}
    for raw in rows_from(get_json(url)):
        parsed=parse_row(raw)
        if parsed:
            z,mw=parsed; by_day.setdefault(z[:10],[]).append(mw)
    out=[]
    for day,vals in sorted(by_day.items()):
        mwh=round(sum(vals)*0.5,3)
        out.append({'date':day,'technology':'Solar','averageMW':round(sum(vals)/len(vals),3),'highMW':round(max(vals),3),'lowMW':round(min(vals),3),'sampleCount':len(vals),'mwh':mwh,'source':SOURCE,'sourceAttribution':ATTRIBUTION,'methodState':'PVLIVE EMBEDDED ESTIMATE','status':'candidate','completeness':round(len(vals)/48,3)})
    return out,url

def load_rows(path):
    if not path.exists(): return {}
    try:
        p=json.loads(path.read_text(encoding='utf-8'))
        return {r['date']:r for r in p.get('rows',[]) if isinstance(r,dict) and r.get('date')}
    except Exception: return {}

def load_progress():
    if not PROGRESS.exists(): return {'completeMonths':[],'failedMonths':[]}
    try: return json.loads(PROGRESS.read_text(encoding='utf-8'))
    except Exception: return {'completeMonths':[],'failedMonths':[]}

def write_json(path,payload):
    path.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(payload,separators=(',',':'),ensure_ascii=False)
    path.write_text(text,encoding='utf-8')
    return text

def write_report(payload):
    REPORT.parent.mkdir(parents=True,exist_ok=True); REPORT_JSON.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text('# Solar Monthly Backfill Report\n\n```json\n'+json.dumps(payload,indent=2)+'\n```\n',encoding='utf-8')
    REPORT_JSON.write_text(json.dumps(payload,indent=2)+'\n',encoding='utf-8')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--start-month',default='2016-01'); ap.add_argument('--end-month',default=''); ap.add_argument('--max-months',type=int,default=12); ap.add_argument('--apply',action='store_true'); ap.add_argument('--resume',action='store_true')
    args=ap.parse_args(); start=month_start(args.start_month); end=month_start(args.end_month) if args.end_month else dt.date(dt.datetime.now(dt.timezone.utc).year,dt.datetime.now(dt.timezone.utc).month,1)
    existing=load_rows(CANDIDATE); progress=load_progress(); done=set(progress.get('completeMonths',[])) if args.resume else set()
    months=[]; d=start
    while d<=end and len(months)<args.max_months:
        if month_key(d) not in done: months.append(d)
        d=next_month(d)
    fetched=[]; failures=[]; last_url=''
    for m in months:
        try:
            rows,url=fetch_month(m); last_url=url
            if not rows: failures.append({'month':month_key(m),'error':'no rows'})
            else:
                fetched.append(month_key(m))
                for r in rows: existing[r['date']]=r
                time.sleep(0.2)
        except Exception as e: failures.append({'month':month_key(m),'error':str(e)[:240]})
    merged=[existing[k] for k in sorted(existing)]
    cand={'schemaVersion':'0.3.0-pvlive-solar-daily-candidate','generatedUTC':utc_now(),'source':SOURCE,'sourceAttribution':ATTRIBUTION,'sourceNote':'Solar generation is estimated from Sheffield Solar PVLive. It is not Elexon FUELHH transmission metered solar.','rows':merged}
    browser={'schemaVersion':'0.3.0-pvlive-solar-daily-browser','generatedUTC':utc_now(),'source':SOURCE,'sourceAttribution':ATTRIBUTION,'sourceNote':cand['sourceNote'],'rows':merged}
    ctext=json.dumps(cand,separators=(',',':'),ensure_ascii=False); btext=json.dumps(browser,separators=(',',':'),ensure_ascii=False)
    passed=bool(fetched) and not failures and len(btext.encode())<3000000
    if args.apply and passed:
        write_json(CANDIDATE,cand); write_json(BROWSER,browser)
        complete=sorted(set(progress.get('completeMonths',[])+fetched)); failed=[x for x in progress.get('failedMonths',[]) if x.get('month') not in fetched]+failures
        write_json(PROGRESS,{'generatedUTC':utc_now(),'source':SOURCE,'completeMonths':complete,'failedMonths':failed,'lastRunMonths':fetched})
    report={'mode':'apply' if args.apply else 'audit','startMonth':args.start_month,'endMonth':args.end_month or month_key(end),'monthsAttempted':[month_key(m) for m in months],'monthsFetched':fetched,'failures':failures,'rowsAfterMerge':len(merged),'candidateBytes':len(ctext.encode()),'browserBytes':len(btext.encode()),'candidateSha256':hashlib.sha256(ctext.encode()).hexdigest(),'browserSha256':hashlib.sha256(btext.encode()).hexdigest(),'lastUrl':last_url,'applied':bool(args.apply and passed),'pass':passed}
    write_report(report); print(json.dumps(report,indent=2)); return 0 if passed else 1
if __name__=='__main__': raise SystemExit(main())
