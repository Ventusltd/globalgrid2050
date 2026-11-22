#!/usr/bin/env python3
"""Read-only census of committed Pipeline News files; identical blobs counted once."""
import argparse
from collections import defaultdict
import csv
import json
from pathlib import Path, PurePosixPath
import re
import subprocess

CODE={'.py','.js','.mjs','.cjs','.ts','.tsx','.jsx','.html','.css','.scss','.sh','.bash','.ps1','.sql','.rs','.go','.java','.c','.cpp','.h','.hpp','.vue','.svelte'}
DATA={'.json','.jsonl','.ndjson','.csv','.tsv','.geojson','.parquet','.xml','.xlsx','.db','.sqlite','.gpkg','.pbf','.zip','.gz'}
DOC={'.md','.rst','.txt','.pdf','.docx'}
AUTOMATION={'news','pipeline_release','repd','pipeline_public','convergence','dc_location_ui','document_facts_ui','energy_context_ui','grid_notice_ui','journey_entry_ui','journey_return_ui','mobile_map_ui','news_history_return','news_quality_ui','price_daily_ui','primary_note_ui','repd_expand_ui','ticker_crisp_ui','ticker_neon_ui','v923-recovery','v924_public','v928_context','v928_intelligence'}

def git(*args):
    return subprocess.check_output(['git',*args])

def group(path):
    p=PurePosixPath(path)
    if p.parts[0]=='uk_renewables_pipeline':
        return 'Current V9.57' if p.parts[1]==current else 'Historical application versions'
    if p.parts[0]=='automation' and len(p.parts)>2:
        folder=p.parts[1]
        if folder=='news': return 'News intelligence engine'
        if folder=='pipeline_release': return 'Release engineering'
        if folder in AUTOMATION or re.fullmatch(r'v9\d{2}_preview',folder):
            return 'Other related automation'
    if p.parts[:2]==('.github','workflows') and re.search(r'pipeline|repd|pn-v9|news',p.name,re.I):
        return 'CI/CD workflows'
    return None

def kind(path):
    p=PurePosixPath(path); parts={s.lower() for s in p.parts}; n=p.name.lower(); ext=p.suffix.lower()
    if parts & {'vendor','node_modules','third_party','third-party','thirdparty','external'} or n.endswith(('.min.js','.min.css')): return 'Third-party/vendor'
    if n in {'package-lock.json','yarn.lock','pnpm-lock.yaml','requirements.txt','package.json','pyproject.toml'}: return 'Dependency manifests'
    if ext in CODE:
        if parts & {'test','tests','__tests__','spec','specs'} or re.match(r'(test[-_]|check[-_]|validate[-_])',n) or n.endswith(('.test.js','.spec.js','.test.mjs')): return 'Tests'
        if parts & {'fixtures','generated','dist'}: return 'Generated/fixture code'
        return 'Application/automation source'
    if p.parts[:2]==('.github','workflows') and ext in {'.yml','.yaml'}: return 'Workflow configuration'
    if ext in DATA or parts & {'fixtures'}: return 'Data/fixtures'
    if ext in DOC: return 'Documentation'
    if ext in {'.yaml','.yml','.toml','.ini','.cfg'}: return 'Other configuration'
    return 'Other assets'

parser=argparse.ArgumentParser()
parser.add_argument('--ref',default='HEAD')
parser.add_argument('--current',default='202611201709')
parser.add_argument('--output',default='pipeline-code-census')
args=parser.parse_args()
current=args.current
commit=git('rev-parse',args.ref).decode().strip()
root=Path(args.output);root.mkdir(parents=True,exist_ok=True)
entries=[]
for record in git('ls-tree','-rlz',commit).split(b'\0'):
    if not record: continue
    meta,path=record.split(b'\t',1); mode,typ,oid,size=meta.decode().split()
    if typ!='blob': continue
    path=path.decode('utf-8','surrogateescape'); scope=group(path)
    if scope: entries.append(dict(path=path,scope=scope,category=kind(path),blob=oid,bytes=int(size)))
line_kinds={'Application/automation source','Tests','Generated/fixture code','Third-party/vendor','Workflow configuration','Other configuration'}
metrics={}
# Persistent Git process: one blob read per unique content, no working-tree writes.
with subprocess.Popen(['git','cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE) as proc:
    for e in entries:
        oid=e['blob']
        if e['category'] not in line_kinds or oid in metrics: continue
        proc.stdin.write((oid+'\n').encode());proc.stdin.flush()
        header=proc.stdout.readline().split()
        assert len(header)==3 and header[1]==b'blob',header
        content=proc.stdout.read(int(header[2]));assert proc.stdout.read(1)==b'\n'
        try: lines=content.decode('utf-8').splitlines()
        except UnicodeDecodeError: metrics[oid]=(None,None);continue
        if b'\0' in content: metrics[oid]=(None,None);continue
        metrics[oid]=(len(lines),sum(bool(l.strip()) for l in lines))
    proc.stdin.close()
for e in entries:
    e['lines'],e['nonblank_lines']=metrics.get(e['blob'],(None,None)) if e['category'] in line_kinds else (None,None)

def summarise(items):
    unique={}
    for e in items:
        if e['blob'] not in unique or (unique[e['blob']]['lines'] is None and e['lines'] is not None):unique[e['blob']]=e
    def total(rows,key):return sum(e[key] or 0 for e in rows)
    u=list(unique.values())
    return dict(files=len(items),unique_blobs=len(u),bytes=total(items,'bytes'),unique_bytes=total(u,'bytes'),physical_lines=total(items,'lines'),nonblank_lines=total(items,'nonblank_lines'),unique_physical_lines=total(u,'lines'),unique_nonblank_lines=total(u,'nonblank_lines'),line_counted_files=sum(e['lines'] is not None for e in items))
scopes={}
for s in sorted({e['scope'] for e in entries}):
    items=[e for e in entries if e['scope']==s]
    scopes[s]={k:summarise([e for e in items if e['category']==k]) for k in sorted({e['category'] for e in items})}
categories={k:summarise([e for e in entries if e['category']==k]) for k in sorted({e['category'] for e in entries})}
source=[e for e in entries if e['category']=='Application/automation source']
current_source=[e for e in source if e['scope']=='Current V9.57']
current_ids={e['blob'] for e in current_source}
historical_extra=[e for e in source if e['scope']=='Historical application versions' and e['blob'] not in current_ids]
report={'commit':commit,'release':current,'method':'Physical and nonblank lines of UTF-8 text; exact content deduplication by Git blob. Comments included, near-duplicates not collapsed. Source is a path/extension classification, not reachability or authorship proof. Data and docs counted as files and bytes, not LOC. Scope excludes external repositories and untracked files. Category and scope totals may overlap by content; estate-wide total deduplicates across scopes.','scopes':scopes,'estate_categories':categories,'historical_source_not_in_current':summarise(historical_extra),'all_source':summarise(source),'all_files':summarise(entries)}
(root/'summary.json').write_text(json.dumps(report,indent=2)+'\n')
with (root/'files.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=['path','scope','category','blob','bytes','lines','nonblank_lines']);w.writeheader();w.writerows(entries)
lines=['# Pipeline News code census','',f'Commit: `{commit}`',f'Current release: `{current}`','',report['method'],'','| Scope | Category | Files | Unique files | Physical lines | Unique physical lines | Unique nonblank lines | Unique bytes |','|---|---|---:|---:|---:|---:|---:|---:|']
for s,cats in scopes.items():
    for k,m in cats.items():
        values=[m['files'],m['unique_blobs']]+([m['physical_lines'],m['unique_physical_lines'],m['unique_nonblank_lines']] if m['line_counted_files'] else ['—']*3)+[m['unique_bytes']]
        lines.append('| '+s+' | '+k+' | '+' | '.join(f'{v:,}' if isinstance(v,int) else v for v in values)+' |')
lines+=['','## Deduplicated estate-wide totals','',f"Application/automation source: {report['all_source']['unique_physical_lines']:,} physical lines; {report['all_source']['unique_nonblank_lines']:,} nonblank lines; {report['all_source']['unique_blobs']:,} unique files.",f"Historical source absent as exact content from current V9.57: {report['historical_source_not_in_current']['unique_physical_lines']:,} unique physical lines.",'','Detailed file ledger: files.csv. Machine-readable results: summary.json.']
md='\n'.join(lines)+'\n';(root/'summary.md').write_text(md);print(md)
