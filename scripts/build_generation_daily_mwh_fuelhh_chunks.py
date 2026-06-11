#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, datetime as dt, hashlib, json, math
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'generation' / 'fuelhh_halfhourly'
OUT = ROOT / 'uk_energy_tracking_v6' / 'generation_history'
REPORT = ROOT / 'data_science_protocol' / 'audit_reports'
REPORT_JSON = REPORT / 'json'
STEM = 'GENERATION_DAILY_MWH_FUELHH_CHUNKS'
MAX_BYTES = 25_000_000

def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00','Z')

def stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')

def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()

def parse_time(v: str):
    try:
        x = dt.datetime.fromisoformat(str(v).replace('Z','+00:00'))
    except Exception:
        return None
    if x.tzinfo is None:
        x = x.replace(tzinfo=dt.timezone.utc)
    return x.astimezone(dt.timezone.utc)

def file_year(path: Path):
    s = path.name.replace('generation_fuelhh_','').replace('.csv','')
    parts = s.split('_')
    try:
        return int(parts[0])
    except Exception:
        return None

def source_files(start_year: int, end_year: int):
    files = []
    for p in sorted(SRC.glob('*/*.csv')):
        if not p.name.startswith('generation_fuelhh_'):
            continue
        y = file_year(p)
        if y is not None and start_year <= y <= end_year:
            files.append(p)
    return files

def build(start_year: int, end_year: int):
    buckets: dict[tuple[str,str], dict[str, Any]] = {}
    meta = []
    raw = parsed = skipped = 0
    for p in source_files(start_year, end_year):
        file_rows = file_parsed = 0
        with p.open('r', encoding='utf-8', newline='') as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                raw += 1
                file_rows += 1
                t = parse_time(row.get('time',''))
                tech = (row.get('technology','') or 'Other').strip() or 'Other'
                try:
                    mw = float(row.get('generationMW',''))
                except Exception:
                    skipped += 1
                    continue
                if t is None or not math.isfinite(mw):
                    skipped += 1
                    continue
                day = t.date().isoformat()
                b = buckets.setdefault((day, tech), {'date': day, 'technology': tech, 'mwh': 0.0, 'sumMW': 0.0, 'records': 0, 'highMW': mw, 'lowMW': mw})
                b['mwh'] += mw * 0.5
                b['sumMW'] += mw
                b['records'] += 1
                b['highMW'] = max(float(b['highMW']), mw)
                b['lowMW'] = min(float(b['lowMW']), mw)
                parsed += 1
                file_parsed += 1
        meta.append({'path': rel(p), 'rows': file_rows, 'parsedRows': file_parsed, 'sizeBytes': p.stat().st_size})
    rows = []
    for b in buckets.values():
        n = int(b['records'])
        rows.append({'date': b['date'], 'technology': b['technology'], 'mwh': round(float(b['mwh']),3), 'averageMW': round(float(b['sumMW'])/n,3), 'highMW': round(float(b['highMW']),3), 'lowMW': round(float(b['lowMW']),3), 'records': n, 'expectedRecords': 48, 'completeness': round(n/48,4), 'source': 'Elexon BMRS FUELHH clean half hourly shard', 'methodState': 'Daily MWh equals sum of half hourly MW times 0.5 hours'} )
    rows.sort(key=lambda r: (r['date'], r['technology']))
    return rows, meta, raw, parsed, skipped

def write_json(path: Path, payload: Any, compact: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, separators=(',',':'), ensure_ascii=False) if compact else json.dumps(payload, indent=2, ensure_ascii=False) + '\n'
    path.write_text(text, encoding='utf-8')
    return path.stat().st_size, hashlib.sha256(text.encode('utf-8')).hexdigest()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start-year', type=int, required=True)
    ap.add_argument('--end-year', type=int, required=True)
    ap.add_argument('--max-bytes', type=int, default=MAX_BYTES)
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()
    if args.end_year < args.start_year:
        raise SystemExit('end year must be greater than or equal to start year')
    rows, meta, raw, parsed, skipped = build(args.start_year, args.end_year)
    suffix = f"{args.start_year}_{args.end_year}" if args.start_year != args.end_year else str(args.start_year)
    out_path = OUT / f'generation_daily_mwh_by_technology_fuelhh_{suffix}.json'
    payload = {'schemaVersion':'1.0.0-fuelhh-daily-mwh','generatedUTC':now(),'title':'Generation daily MWh by technology from Elexon FUELHH','grain':'daily MWh by technology','unit':'MWh','timezone':'UTC','startYear':args.start_year,'endYear':args.end_year,'sourceNote':'Derived from clean Elexon FUELHH half hourly MW shards. Sheffield Solar PVLive daily MWh remains separate.','calculationMethod':'daily MWh = sum of half hourly generationMW multiplied by 0.5 hours','rows':rows}
    text = json.dumps(payload, separators=(',',':'), ensure_ascii=False)
    size = len(text.encode('utf-8'))
    sha = hashlib.sha256(text.encode('utf-8')).hexdigest()
    if size > args.max_bytes:
        raise SystemExit(f'output too large: {size} bytes')
    if args.apply:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text, encoding='utf-8')
    index_path = OUT / 'generation_daily_mwh_by_technology_fuelhh_index.json'
    if args.apply:
        if index_path.exists():
            try:
                index = json.loads(index_path.read_text(encoding='utf-8'))
            except Exception:
                index = {}
        else:
            index = {}
        chunks = [c for c in index.get('chunks', []) if not (c.get('startYear') == args.start_year and c.get('endYear') == args.end_year)]
        chunks.append({'startYear':args.start_year,'endYear':args.end_year,'path':rel(out_path),'rows':len(rows),'sizeBytes':size})
        chunks.sort(key=lambda c: (c.get('startYear',0), c.get('endYear',0)))
        write_json(index_path, {'schemaVersion':'1.0.0-fuelhh-daily-mwh-index','generatedUTC':now(),'unit':'MWh','sourceNote':'Chunk index for Elexon derived daily MWh by technology. Solar PVLive is separate.','chunks':chunks})
    checks = {'source_files_found': len(meta)>0, 'raw_rows_positive': raw>0, 'parsed_rows_positive': parsed>0, 'output_rows_positive': len(rows)>0, 'output_under_25mb': size <= args.max_bytes, 'raw_halfhourly_not_written': True, 'solar_pvlive_not_mixed': True, 'formula_declared': True}
    report = {'reportTitle':'Generation Daily MWh FUELHH Chunks','schemaVersion':'1.0.0','generatedUTC':now(),'mode':'apply' if args.apply else 'audit','startYear':args.start_year,'endYear':args.end_year,'sourceRoot':rel(SRC),'sourceFileCount':len(meta),'sourceFiles':meta,'rawRows':raw,'parsedRows':parsed,'skippedRows':skipped,'outputPath':rel(out_path),'indexPath':rel(index_path),'outputRows':len(rows),'outputSizeBytes':size,'maxBytes':args.max_bytes,'sha256':sha,'unit':'MWh','calculationMethod':'daily MWh = sum of half hourly generationMW times 0.5 hours, grouped by UTC date and technology','rawTemporaryFilesCommitted':False,'checks':checks,'pass':all(checks.values()),'applied':bool(args.apply)}
    REPORT.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.mkdir(parents=True, exist_ok=True)
    s = stamp()
    md = '\n'.join(['# Generation Daily MWh FUELHH Chunks','',f"Generated UTC: `{report['generatedUTC']}`",f"Mode: `{report['mode']}`",f"Window: `{args.start_year}` to `{args.end_year}`",f"Output path: `{rel(out_path)}`",f"Output rows: `{len(rows)}`",f"Output size bytes: `{size}`",f"Pass: `{report['pass']}`",'', 'Daily MWh equals sum of half hourly MW times 0.5 hours. Raw half hourly rows are not written by this script. Solar PVLive remains separate.']) + '\n'
    for p in (REPORT / f'{STEM}_{s}.md', REPORT / f'{STEM}_LATEST.md'):
        p.write_text(md, encoding='utf-8')
    js = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    for p in (REPORT_JSON / f'{STEM}_{s}.json', REPORT_JSON / f'{STEM}_LATEST.json'):
        p.write_text(js, encoding='utf-8')
    if not report['pass']:
        raise SystemExit('checks failed')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
