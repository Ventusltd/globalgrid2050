#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, datetime as dt, json, math
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parent.parent
SOURCE_ROOT=ROOT/'data'/'generation'/'fuelhh_halfhourly'
OUT_FILE=ROOT/'data'/'confirmed'/'generation_daily_mw_spine_fuelhh_candidate.json'
REPORT_DIR=ROOT/'data_science_protocol'/'audit_reports'
REPORT_JSON_DIR=REPORT_DIR/'json'

def utc_now(): return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')
def stamp(): return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')

def parse_time(value:str):
    if not value: return None
    try:
        p=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
        if p.tzinfo is None: p=p.replace(tzinfo=dt.timezone.utc)
        return p.astimezone(dt.timezone.utc)
    except Exception:
        return None

def read_rows(start_year_month:str):
    buckets=defaultdict(list); source_files=[]; raw_rows=0; parsed_rows=0
    for path in sorted(SOURCE_ROOT.glob('*/*.csv')):
        if 'generation_fuelhh_' not in path.name: continue
        suffix=path.name.replace('generation_fuelhh_','').replace('.csv','')
        parts=suffix.split('_')
        if len(parts)>=2 and f'{parts[0]}-{parts[1]}' < start_year_month: continue
        file_rows=0
        with path.open('r',encoding='utf-8',newline='') as handle:
            for row in csv.DictReader(handle):
                raw_rows+=1; file_rows+=1
                t=parse_time(row.get('time',''))
                try: mw=float(row.get('generationMW',''))
                except Exception: continue
                tech=row.get('technology','') or 'Other'
                if t is None or not math.isfinite(mw): continue
                buckets[(t.date().isoformat(),tech)].append({'time':t.isoformat().replace('+00:00','Z'),'mw':mw})
                parsed_rows+=1
        source_files.append({'path':path.relative_to(ROOT).as_posix(),'rows':file_rows,'sizeBytes':path.stat().st_size})
    return buckets, {'files':source_files,'rawRows':raw_rows,'parsedRows':parsed_rows}

def build_spine(buckets):
    out=[]
    for (date,tech), points in sorted(buckets.items()):
        vals=[float(p['mw']) for p in points]
        if not vals: continue
        hi=max(points,key=lambda p:float(p['mw'])); lo=min(points,key=lambda p:float(p['mw']))
        out.append({'date':date,'technology':tech,'averageMW':round(sum(vals)/len(vals),3),'highMW':round(float(hi['mw']),3),'lowMW':round(float(lo['mw']),3),'highAtUTC':hi['time'],'lowAtUTC':lo['time'],'sampleCount':len(points),'expectedSamples':48,'completeness':round(min(1.0,len(points)/48),4),'status':'candidate','sourceStatus':'settled source candidate fact','sourceLineage':'Elexon BMRS FUELHH'})
    return out

def write_json(path,payload):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

def write_report(payload):
    REPORT_DIR.mkdir(parents=True,exist_ok=True); REPORT_JSON_DIR.mkdir(parents=True,exist_ok=True)
    s=stamp()
    text='\n'.join(['# GlobalGrid2050 FUELHH Daily MW Spine Report','',f"Generated UTC: `{payload['generatedUTC']}`",f"Mode: `{payload['mode']}`",f"Start year-month: `{payload['startYearMonth']}`",f"Source files: `{len(payload['sourceFiles'])}`",f"Raw rows: `{payload['rawRows']}`",f"Parsed rows: `{payload['parsedRows']}`",f"Daily fact rows: `{payload['dailyRows']}`",f"Output path: `{payload['outputPath']}`",f"Output size bytes: `{payload['outputSizeBytes']}`",'','## Source discipline','','This file is a candidate fact layer built from FUELHH half-hourly shards. High and low are not additive. MWh rollups remain separate.'])+'\n'
    for p in (REPORT_DIR/f'FUELHH_DAILY_MW_SPINE_{s}.md', REPORT_DIR/'FUELHH_DAILY_MW_SPINE_LATEST.md'): p.write_text(text,encoding='utf-8')
    js=json.dumps(payload,indent=2,ensure_ascii=False)+'\n'
    for p in (REPORT_JSON_DIR/f'FUELHH_DAILY_MW_SPINE_{s}.json', REPORT_JSON_DIR/'FUELHH_DAILY_MW_SPINE_LATEST.json'): p.write_text(js,encoding='utf-8')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--start-year-month',default='2016-01'); ap.add_argument('--apply',action='store_true'); args=ap.parse_args()
    buckets,meta=read_rows(args.start_year_month); rows=build_spine(buckets)
    out={'schemaVersion':'0.1.0-fuelhh-candidate','generatedUTC':utc_now(),'title':'Generation daily MW spine from FUELHH candidate','timezone':'UTC','status':'candidate','grain':'daily average high low MW per technology','sourceNote':'Built from Elexon BMRS FUELHH monthly shards.','rows':rows}
    if args.apply: write_json(OUT_FILE,out)
    report={'generatedUTC':utc_now(),'mode':'apply' if args.apply else 'audit only','startYearMonth':args.start_year_month,'sourceFiles':meta['files'],'rawRows':meta['rawRows'],'parsedRows':meta['parsedRows'],'dailyRows':len(rows),'outputPath':OUT_FILE.relative_to(ROOT).as_posix(),'outputSizeBytes':OUT_FILE.stat().st_size if OUT_FILE.exists() else 0}
    write_report(report); return 0
if __name__=='__main__': raise SystemExit(main())
