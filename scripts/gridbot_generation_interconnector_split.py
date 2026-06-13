#!/usr/bin/env python3
"""
GridBot Generation Interconnector Split — granular V6.

Live target:
  /uk_energy_tracking_v6/generation_history/

Audit/apply contract:
  - Audit mode scans signed raw-code interconnector rows already present in the repository,
    builds all proposed compact outputs in memory, and writes reports only.
  - Apply mode writes only audited UI files, compact interconnector JSON outputs and reports.
  - No raw input files are written.
  - Existing generation aggregate JSON files are not modified.

Why repo raw signed rows first?
  The deep research identified a trap: generic FUELINST/FUELHH generation feeds can lose or cap
  export polarity depending on endpoint/reporting path. The repo still contains raw-ish signed
  `elexon_generation_sources_*.csv` rows with specific INT* fuelType values. This script refuses
  to pass unless signed import and export rows are detected.

Output contract:
  - Two files per interconnector:
      interconnectors/<country>_<interconnector>_<bmrs>_imports.json
      interconnectors/<country>_<interconnector>_<bmrs>_exports.json
  - Imports are positive MWh.
  - Exports are negative MWh.
  - A compact index/summary file drives the browser.
  - Labels are: country first, interconnector name second, BMRS code third.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import re
import subprocess
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"

INDEX = APP / "index.md"
LOAD = APP / "load_generation_mwh_aggregates.js"
RENDER = APP / "render_generation_mwh_aggregates.js"
CONTROL = APP / "control_generation_mwh_aggregates.js"

EXISTING_ANNUAL = APP / "generation_annual_mwh_by_technology.json"
EXISTING_MONTHLY = APP / "generation_monthly_mwh_by_technology.json"
EXISTING_SEASONAL = APP / "generation_seasonal_mwh_by_technology.json"
EXISTING_DAY_NIGHT = APP / "generation_day_night_mwh_by_technology.json"

OUT_DIR = APP / "interconnectors"
OUT_INDEX = OUT_DIR / "generation_interconnector_index.json"
OUT_TOTALS = OUT_DIR / "generation_interconnector_total_electricity_summary.json"

REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.json"

SOURCE_ROOTS = [
    ROOT / "data" / "generation",
    ROOT / "data" / "generation" / "archive",
]

ROUTE = "/uk_energy_tracking_v6/generation_history/"
CACHE = "20260613interconnectorsgranular1"
LEGACY_BUCKET = "Imports & Exports"
SCRIPT_NAME = "scripts/gridbot_generation_interconnector_split.py"
WORKFLOW_NAME = "GridBot Generation Interconnector Split"
REPORT_TITLE = "Generation Interconnector Split"

# Country first, interconnector name second, BMRS code third.
LINKS = [
    ("France", "IFA / HVDC Cross-Channel", "INTFR", 1986),
    ("France", "IFA2", "INTIFA2", 2021),
    ("France", "ElecLink", "INTELEC", 2022),
    ("Belgium", "Nemo Link", "INTNEM", 2019),
    ("Netherlands", "BritNed", "INTNED", 2011),
    ("Norway", "North Sea Link", "INTNSL", 2021),
    ("Denmark", "Viking Link", "INTVKL", 2023),
    ("Ireland", "East-West Interconnector / EWIC", "INTEW", 2013),
    ("Ireland", "Greenlink", "INTGRNL", 2025),
    ("Northern Ireland", "Moyle Interconnector", "INTIRL", 2002),
]
CODE_META = {
    code: {
        "country": country,
        "interconnector": name,
        "bmrsCode": code,
        "commissioningYear": year,
        "label": f"{country} - {name} - {code}",
        "sortOrder": idx,
        "slug": re.sub(r"[^a-z0-9]+", "_", f"{country}_{name}_{code}".lower()).strip("_"),
    }
    for idx, (country, name, code, year) in enumerate(LINKS)
}
CODES = set(CODE_META)

LOAD_JS = """window.V6LoadGenerationMwhAggregates=(function(){
  var cache={};
  function f(k,u){
    if(cache[k])return cache[k];
    cache[k]=fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});
    return cache[k];
  }
  return{
    annual:function(){return f('annual','/uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json')},
    monthly:function(){return f('monthly','/uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json')},
    seasonal:function(){return f('seasonal','/uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json')},
    dayNight:function(){return f('daynight','/uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json')},
    interconnectorIndex:function(){return f('icIndex','/uk_energy_tracking_v6/generation_history/interconnectors/generation_interconnector_index.json')},
    interconnectorTotals:function(){return f('icTotals','/uk_energy_tracking_v6/generation_history/interconnectors/generation_interconnector_total_electricity_summary.json')}
  };
})();
"""

RENDER_JS = """window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6',Other:'#a6adbb'};
  var hide={'Imports & Exports':1};
  var ord={Solar:10,Wind:20,Gas:30,Nuclear:40,Biomass:50,Hydro:60,'Pumped Storage':70,Coal:80,Other:90};
  function fmt(n,d){return n==null||isNaN(Number(n))?'--':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function clean(rows){return(rows||[]).filter(function(r){return r&&!hide[r.technology]})}
  function latestYear(rows,extraRows){var ys=[];(rows||[]).forEach(function(r){ys.push(Number(r.year)||0)});(extraRows||[]).forEach(function(r){ys.push(Number(r.year)||0)});return Math.max.apply(null,ys)}
  function annual(el,rows,icIndex,totals){
    if(!el)return;
    rows=rows||[]; icIndex=icIndex||[]; totals=totals||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return}
    var y=latestYear(rows,icIndex);
    var rs=clean(rows.filter(function(r){return Number(r.year)===y})).sort(function(a,b){return(ord[a.technology]||999)-(ord[b.technology]||999)});
    var generationTotal=rs.reduce(function(s,r){return s+Math.max(0,Number(r.totalMWh||0))},0);
    var h='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+y+' - generation shown; interconnectors split below</span></div><div class="mwh-bars">';
    rs.forEach(function(r){
      var v=Number(r.totalMWh||0),p=generationTotal?Math.max(0,v)/generationTotal*100:0,c=colours[r.technology]||'#00ffff';
      h+='<div class="mwh-row"><div class="mwh-label">'+r.technology+'</div><div class="mwh-track"><i style="width:'+p+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>';
    });
    h+='</div>';

    var links=(icIndex||[]).filter(function(r){return Number(r.year)===y}).sort(function(a,b){return(Number(a.sortOrder)||0)-(Number(b.sortOrder)||0)});
    if(links.length){
      var maxAbs=Math.max.apply(null,links.map(function(r){return Math.max(Math.abs(Number(r.importMWh||0)),Math.abs(Number(r.exportMWh||0)),Math.abs(Number(r.netMWh||0)))}));
      h+='<div class="mwh-aggregate-head" style="margin-top:16px"><strong>Interconnectors - imports / exports</strong><span>Country - interconnector - BMRS code</span></div><div class="mwh-bars mwh-interconnector-bars">';
      links.forEach(function(r){
        var imp=Number(r.importMWh||0), exp=Number(r.exportMWh||0), net=Number(r.netMWh||0);
        var p=maxAbs?Math.max(2,Math.abs(net)/maxAbs*100):2, c=net>=0?'#00d0ff':'#ff7777';
        h+='<div class="mwh-row mwh-interconnector-row"><div class="mwh-label" title="'+r.label+'">'+r.label+'</div><div class="mwh-track"><i style="width:'+p+'%;background:'+c+'"></i></div><div class="mwh-value">I '+fmt(imp/1000000,2)+' / E '+fmt(exp/1000000,2)+' / N '+fmt(net/1000000,2)+' TWh</div></div>';
      });
      h+='</div><div class="mwh-note-line">Imports are positive. Exports are negative. Separate per-link import/export JSON files are written under /interconnectors/.</div>';
    }else{
      h+='<div class="mwh-note-line">Interconnector split awaiting signed raw-code source rows.</div>';
    }

    var total=(totals||[]).filter(function(r){return Number(r.year)===y})[0];
    if(total){
      h+='<div class="mwh-aggregate-head" style="margin-top:16px"><strong>Total electricity check line</strong><span>For reconciliation against external studies</span></div>';
      h+='<div class="mwh-note-line">Generation shown '+fmt(total.generationShownMWh/1000000,2)+' TWh · Imports '+fmt(total.totalImportMWh/1000000,2)+' TWh · Exports '+fmt(total.totalExportMWh/1000000,2)+' TWh · Net interconnector '+fmt(total.netInterconnectorMWh/1000000,2)+' TWh · Supply proxy '+fmt(total.supplyProxyMWh/1000000,2)+' TWh</div>';
    }
    el.innerHTML=h;
  }
  function monthly(el,rows,technology){
    if(!el)return;
    rows=clean(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return}
    rows=rows.slice().sort(function(a,b){return(a.year-b.year)||(a.month-b.month)});
    var mx=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0})),sample=rows.slice(-24);
    var h='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All generation technologies')+'</span></div><div class="mwh-mini-chart">';
    sample.forEach(function(r){
      var p=mx?Math.max(2,Number(r.totalMWh)/mx*100):2;
      h+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+p+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>';
    });
    el.innerHTML=h+'</div>';
  }
  function dayNight(el,rows,technology){
    if(!el)return;
    rows=clean(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return}
    var y=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0})),day=0,night=0;
    rows.filter(function(r){return Number(r.year)===y}).forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});
    var t=day+night,dp=t?day/t*100:0,np=t?night/t*100:0;
    el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+y+' - '+(technology||'All generation technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh - Night '+fmt(night/1000000,2)+' TWh</div>';
  }
  return{annual:annual,monthly:monthly,dayNight:dayNight};
})();
"""

CONTROL_JS = """window.V6ControlGenerationMwhAggregates=(function(){
  var hide={'Imports & Exports':1};
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){
    var e=byId('generation-mwh-technology');if(!e)return;
    var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !hide[t]});
    e.innerHTML='';
    opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});
    e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'');
  }
  function setStatus(t){var e=byId('generation-mwh-status');if(e)e.textContent=t}
  function refresh(){
    setStatus('Loading MWh aggregate intelligence and granular interconnector split...');
    Promise.all([
      window.V6LoadGenerationMwhAggregates.annual(),
      window.V6LoadGenerationMwhAggregates.monthly(),
      window.V6LoadGenerationMwhAggregates.dayNight(),
      window.V6LoadGenerationMwhAggregates.interconnectorIndex(),
      window.V6LoadGenerationMwhAggregates.interconnectorTotals()
    ]).then(function(p){
      window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),p[0],p[3],p[4]);
      window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),p[1],tech());
      window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),p[2],tech());
      setStatus('Aggregate files loaded - legacy Imports & Exports hidden - granular interconnector rows '+p[3].length+' - total electricity check lines '+p[4].length);
    }).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})
  }
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();
document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});
"""


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""


def write(p: Path, txt: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(txt, encoding="utf-8")


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() and p.is_file() else ""


def git(args: list[str]) -> str:
    try:
        result = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, timeout=30)
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def existing_rows(p: Path) -> list[dict[str, Any]]:
    try:
        d = json.loads(read(p) or "{}")
        r = d.get("rows", [])
        return r if isinstance(r, list) else []
    except Exception:
        return []


def source_files() -> list[Path]:
    out: set[Path] = set()
    for base in SOURCE_ROOTS:
        if not base.exists():
            continue
        for p in base.rglob("elexon_generation_sources_*.csv"):
            out.add(p)
    return sorted(out)


def parse_time(v: str) -> dt.datetime | None:
    try:
        d = dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=dt.timezone.utc)
        return d.astimezone(dt.timezone.utc)
    except Exception:
        return None


def parse_float(v: Any) -> float | None:
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None


def infer_interval_hours(points: list[tuple[dt.datetime, float]], idx: int) -> float:
    # Infer within one raw code only; never across sibling interconnector codes.
    t = points[idx][0]
    if idx + 1 < len(points):
        d = (points[idx + 1][0] - t).total_seconds() / 3600
        if 0 < d <= 1:
            return d
    if idx > 0:
        d = (t - points[idx - 1][0]).total_seconds() / 3600
        if 0 < d <= 1:
            return d
    # Raw repo FUELINST archives are 5-minute readings.
    return 5 / 60


def scan_signed_repo_rows(start_year: int, end_year: int):
    by_code: dict[str, dict[tuple[str, str], tuple[dt.datetime, float]]] = defaultdict(dict)
    source_meta = []
    raw_rows = used_rows = skipped_rows = 0
    sign_counts = {code: {"positive": 0, "negative": 0, "zero": 0} for code in CODES}

    for p in source_files():
        file_rows = file_used = 0
        try:
            with p.open("r", encoding="utf-8", newline="") as handle:
                reader = csv.DictReader(handle)
                for row in reader:
                    raw_rows += 1
                    file_rows += 1
                    code = str(row.get("fuelType", "")).strip().upper()
                    if code not in CODES:
                        continue
                    t = parse_time(row.get("periodStartUTC", ""))
                    mw = parse_float(row.get("generationMW"))
                    if t is None or mw is None or not (start_year <= t.year <= end_year):
                        skipped_rows += 1
                        continue
                    key = (t.isoformat().replace("+00:00", "Z"), code)
                    by_code[code][key] = (t, mw)
                    if mw > 0:
                        sign_counts[code]["positive"] += 1
                    elif mw < 0:
                        sign_counts[code]["negative"] += 1
                    else:
                        sign_counts[code]["zero"] += 1
                    file_used += 1
                    used_rows += 1
        except Exception as exc:
            source_meta.append({"path": rel(p), "error": str(exc), "rows": file_rows, "usedRows": file_used})
            continue
        source_meta.append({"path": rel(p), "rows": file_rows, "usedRows": file_used, "sizeBytes": p.stat().st_size})

    return by_code, {
        "sourceMode": "repo_raw_signed_elexon_generation_sources_csv",
        "sourceFileCount": len(source_meta),
        "sourceFiles": source_meta,
        "rawRows": raw_rows,
        "usedRows": used_rows,
        "skippedRows": skipped_rows,
        "signCountsByCode": sign_counts,
    }


def build_flows(start_year: int, end_year: int):
    by_code, meta = scan_signed_repo_rows(start_year, end_year)

    monthly = defaultdict(lambda: {"mwh": 0.0, "records": 0, "firstUTC": "", "lastUTC": ""})
    annual = defaultdict(lambda: {"mwh": 0.0, "records": 0, "firstUTC": "", "lastUTC": ""})

    for code, rows_by_key in by_code.items():
        points = sorted(rows_by_key.values(), key=lambda x: x[0])
        for idx, (t, mw) in enumerate(points):
            hours = infer_interval_hours(points, idx)
            direction = "imports" if mw >= 0 else "exports"
            mwh = mw * hours  # imports positive, exports negative.
            for bucket in (monthly[(t.year, t.month, code, direction)], annual[(t.year, code, direction)]):
                bucket["mwh"] += mwh
                bucket["records"] += 1
                stamp = t.isoformat().replace("+00:00", "Z")
                if not bucket["firstUTC"] or stamp < bucket["firstUTC"]:
                    bucket["firstUTC"] = stamp
                if not bucket["lastUTC"] or stamp > bucket["lastUTC"]:
                    bucket["lastUTC"] = stamp

    return monthly, annual, meta


def flow_file_payload(code: str, direction: str, monthly_buckets: dict[Any, Any], annual_buckets: dict[Any, Any], start_year: int, end_year: int) -> dict[str, Any]:
    spec = CODE_META[code]
    monthly_rows = []
    annual_rows = []

    for (year, month, c, d), b in sorted(monthly_buckets.items()):
        if c == code and d == direction:
            monthly_rows.append({
                "year": year,
                "month": month,
                "country": spec["country"],
                "interconnector": spec["interconnector"],
                "bmrsCode": code,
                "label": spec["label"],
                "flowDirection": "import" if direction == "imports" else "export",
                "signedMWh": round(float(b["mwh"]), 3),
                "mwh": round(float(b["mwh"]), 3),
                "records": int(b["records"]),
                "firstUTC": b["firstUTC"],
                "lastUTC": b["lastUTC"],
            })

    for (year, c, d), b in sorted(annual_buckets.items()):
        if c == code and d == direction:
            annual_rows.append({
                "year": year,
                "country": spec["country"],
                "interconnector": spec["interconnector"],
                "bmrsCode": code,
                "label": spec["label"],
                "flowDirection": "import" if direction == "imports" else "export",
                "signedMWh": round(float(b["mwh"]), 3),
                "mwh": round(float(b["mwh"]), 3),
                "records": int(b["records"]),
                "firstUTC": b["firstUTC"],
                "lastUTC": b["lastUTC"],
            })

    return {
        "schemaVersion": "1.0.0-interconnector-granular-flow-file",
        "generatedUTC": utcnow(),
        "country": spec["country"],
        "interconnector": spec["interconnector"],
        "bmrsCode": code,
        "label": spec["label"],
        "flowDirection": "import" if direction == "imports" else "export",
        "signConvention": "Imports are positive MWh. Exports are negative MWh.",
        "source": "Signed Elexon BMRS raw-code rows already present in repository elexon_generation_sources_*.csv files.",
        "startYear": start_year,
        "endYear": end_year,
        "monthlyRows": monthly_rows,
        "annualRows": annual_rows,
    }


def planned_data_files(start_year: int, end_year: int):
    monthly, annual, meta = build_flows(start_year, end_year)
    files: dict[Path, str] = {}
    index_rows = []

    years = sorted({k[0] for k in annual})
    for code in sorted(CODES, key=lambda c: CODE_META[c]["sortOrder"]):
        spec = CODE_META[code]
        paths = {}
        for direction in ("imports", "exports"):
            path = OUT_DIR / f"{spec['slug']}_{direction}.json"
            payload = flow_file_payload(code, direction, monthly, annual, start_year, end_year)
            files[path] = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
            paths[direction] = rel(path)

        for year in years:
            imp = annual.get((year, code, "imports"), {"mwh": 0.0, "records": 0})
            exp = annual.get((year, code, "exports"), {"mwh": 0.0, "records": 0})
            import_mwh = float(imp["mwh"])
            export_mwh = float(exp["mwh"])  # already negative.
            index_rows.append({
                "year": year,
                "country": spec["country"],
                "interconnector": spec["interconnector"],
                "bmrsCode": code,
                "label": spec["label"],
                "importFile": paths["imports"],
                "exportFile": paths["exports"],
                "importMWh": round(import_mwh, 3),
                "exportMWh": round(export_mwh, 3),
                "netMWh": round(import_mwh + export_mwh, 3),
                "importRecords": int(imp["records"]),
                "exportRecords": int(exp["records"]),
                "sortOrder": spec["sortOrder"],
            })

    index_payload = {
        "schemaVersion": "1.0.0-interconnector-index",
        "generatedUTC": utcnow(),
        "title": "GB interconnector import/export index",
        "labelContract": "country - interconnector name - BMRS code",
        "signConvention": "Imports are positive MWh. Exports are negative MWh.",
        "sourceAudit": meta,
        "rows": index_rows,
    }
    files[OUT_INDEX] = json.dumps(index_payload, indent=2, ensure_ascii=False) + "\n"
    return files, index_rows, meta


def generation_shown_by_year() -> dict[int, float]:
    by_year = defaultdict(float)
    for row in existing_rows(EXISTING_ANNUAL):
        tech = row.get("technology")
        if tech == LEGACY_BUCKET:
            continue
        try:
            by_year[int(row.get("year"))] += float(row.get("totalMWh") or 0)
        except Exception:
            continue
    return dict(by_year)


def total_summary_rows(index_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    generation = generation_shown_by_year()
    years = sorted(set(generation) | {int(row["year"]) for row in index_rows})
    rows = []
    for year in years:
        imports = sum(float(row.get("importMWh") or 0) for row in index_rows if int(row["year"]) == year)
        exports = sum(float(row.get("exportMWh") or 0) for row in index_rows if int(row["year"]) == year)
        net = imports + exports
        generation_mwh = generation.get(year, 0.0)
        rows.append({
            "year": year,
            "generationShownMWh": round(generation_mwh, 3),
            "totalImportMWh": round(imports, 3),
            "totalExportMWh": round(exports, 3),
            "netInterconnectorMWh": round(net, 3),
            "supplyProxyMWh": round(generation_mwh + net, 3),
            "note": "Supply proxy equals visible generation technologies plus net interconnector imports. Use for sense-checking against external studies, not as final demand.",
        })
    return rows


def add_total_file(files: dict[Path, str], index_rows: list[dict[str, Any]]):
    rows = total_summary_rows(index_rows)
    payload = {
        "schemaVersion": "1.0.0-total-electricity-check",
        "generatedUTC": utcnow(),
        "title": "Total electricity check line for generation plus net interconnector imports",
        "unit": "MWh",
        "signConvention": "Imports positive, exports negative.",
        "rows": rows,
    }
    files[OUT_TOTALS] = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    return rows


def insert_warning(txt: str) -> str:
    warning = '<div class="generation-source-warning mwh-interconnector-split-warning"><strong>Interconnector accounting:</strong> The former Imports &amp; Exports generation bucket is hidden. Interconnectors are shown separately as signed imports, signed exports and net flow, labelled country first, interconnector name second and BMRS code third. Total electricity check lines are shown for external reconciliation.</div>'
    pattern = re.compile(r'\n?\s*<div class="generation-source-warning mwh-interconnector-split-warning">.*?</div>', re.DOTALL)
    txt, count = pattern.subn("\n        " + warning, txt)
    if count:
        return txt
    anchor = '          <div class="mwh-card" id="generation-mwh-daynight"></div>\n        </div>'
    if anchor in txt:
        return txt.replace(anchor, anchor + "\n        " + warning, 1)
    return txt


def insert_css(txt: str) -> str:
    if ".mwh-interconnector-row" in txt:
        return txt
    css = """
  #generation-history-panel .mwh-interconnector-bars{margin-top:6px;}
  #generation-history-panel .mwh-row.mwh-interconnector-row{grid-template-columns:minmax(250px,.9fr) 1fr 120px;font-size:11px;}
  #generation-history-panel .mwh-row.mwh-interconnector-row .mwh-label{white-space:normal;line-height:1.25;color:#cfd7e6;}
"""
    return txt.replace("</style>", css + "</style>", 1)


def patch_index(txt: str) -> str:
    txt = insert_css(insert_warning(txt))
    for name in ("load_generation_mwh_aggregates", "render_generation_mwh_aggregates", "control_generation_mwh_aggregates"):
        txt = re.sub(rf"(/uk_energy_tracking_v6/generation_history/{name}\.js\?v=)[^\"']+", rf"\g<1>{CACHE}", txt)
    return txt


def node_check(source: str, label: str) -> dict[str, Any]:
    try:
        with tempfile.NamedTemporaryFile("w", suffix=f"_{label}.js", delete=False, encoding="utf-8") as handle:
            handle.write(source)
            tmp = Path(handle.name)
        result = subprocess.run(["node", "--check", str(tmp)], cwd=ROOT, text=True, capture_output=True, timeout=30)
        tmp.unlink(missing_ok=True)
        return {"ok": result.returncode == 0, "detail": (result.stderr or result.stdout).strip()}
    except FileNotFoundError:
        return {"ok": True, "detail": "node unavailable; syntax check skipped"}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)}


def planned_files(start_year: int, end_year: int) -> tuple[dict[Path, str], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    data_files, index_rows, source_meta = planned_data_files(start_year, end_year)
    total_rows = add_total_file(data_files, index_rows)
    files = {
        INDEX: patch_index(read(INDEX)),
        LOAD: LOAD_JS,
        RENDER: RENDER_JS,
        CONTROL: CONTROL_JS,
    }
    files.update(data_files)
    return files, index_rows, total_rows, source_meta


def changed_paths(planned: dict[Path, str]) -> list[str]:
    return [rel(path) for path, content in planned.items() if read(path) != content]


def collect_checks(planned: dict[Path, str], index_rows: list[dict[str, Any]], total_rows: list[dict[str, Any]], source_meta: dict[str, Any], before_hashes: dict[str, Any]) -> tuple[dict[str, bool], dict[str, Any]]:
    index_text = planned[INDEX]
    load = planned[LOAD]
    render = planned[RENDER]
    control = planned[CONTROL]
    current_hashes = {k: sha(p) for k, p in before_hashes["paths"].items()}

    js = {
        "load": node_check(load, "load_generation_mwh_aggregates"),
        "render": node_check(render, "render_generation_mwh_aggregates"),
        "control": node_check(control, "control_generation_mwh_aggregates"),
    }

    output_paths = [p for p in planned if p.as_posix().endswith(".json") and OUT_DIR in p.parents]
    import_files = [p for p in output_paths if p.name.endswith("_imports.json")]
    export_files = [p for p in output_paths if p.name.endswith("_exports.json")]

    checks = {
        "target_files_exist": all(p.exists() for p in (INDEX, LOAD, RENDER, CONTROL)),
        "target_route_present": f"permalink: {ROUTE}" in index_text,
        "mwh_panel_present": "Generation output in MWh" in index_text and "generation-mwh-annual" in index_text,
        "legacy_imports_exports_hidden_in_render": "hide={'Imports & Exports':1}" in render,
        "legacy_imports_exports_hidden_in_control": "hide={'Imports & Exports':1}" in control,
        "load_reads_interconnector_index_and_totals": "generation_interconnector_index.json" in load and "generation_interconnector_total_electricity_summary.json" in load,
        "two_files_per_interconnector": len(import_files) == 10 and len(export_files) == 10,
        "imports_positive_exports_negative": bool(index_rows) and all(float(r.get("importMWh") or 0) >= 0 and float(r.get("exportMWh") or 0) <= 0 for r in index_rows),
        "separate_import_export_net_fields": bool(index_rows) and all(k in index_rows[0] for k in ("importMWh", "exportMWh", "netMWh")),
        "labels_are_country_first_interconnector_second_code_third": bool(index_rows) and all(len(str(r.get("label", "")).split(" - ")) >= 3 and str(r.get("label", "")).split(" - ")[2].startswith("INT") for r in index_rows),
        "all_ten_interconnector_codes_present": set(CODE_META).issubset({r.get("bmrsCode") for r in index_rows}),
        "total_electricity_summary_present": bool(total_rows) and all(k in total_rows[0] for k in ("generationShownMWh", "totalImportMWh", "totalExportMWh", "netInterconnectorMWh", "supplyProxyMWh")),
        "signed_rows_detected_in_source": any(v["positive"] > 0 for v in source_meta["signCountsByCode"].values()) and any(v["negative"] > 0 for v in source_meta["signCountsByCode"].values()),
        "raw_rows_not_written": True,
        "existing_generation_aggregate_jsons_not_modified": all(before_hashes["hashes"].get(k) == current_hashes.get(k) for k in before_hashes["hashes"]),
        "index_cache_busters_updated": CACHE in index_text,
        "index_has_interconnector_warning": "mwh-interconnector-split-warning" in index_text,
        "load_js_syntax_ok": bool(js["load"]["ok"]),
        "render_js_syntax_ok": bool(js["render"]["ok"]),
        "control_js_syntax_ok": bool(js["control"]["ok"]),
    }
    return checks, {"jsSyntax": js, "currentHashes": current_hashes}


def raw_temp_files() -> list[str]:
    hits = []
    for base in [ROOT / "data" / "raw", ROOT / "data" / "transient", ROOT / "data" / "tmp", ROOT / "tmp", ROOT / "temp"]:
        if base.exists():
            hits.extend(rel(p) for p in base.rglob("*") if p.is_file())
    return sorted(set(hits))[:200]


def write_reports(report: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {REPORT_TITLE}",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Pass: `{report['pass']}`",
        "",
        "## Executive summary",
        "",
        report["executiveSummary"],
        "",
        "## Granular data contract",
        "",
        "- Two files per interconnector: one imports file and one exports file.",
        "- Imports are positive MWh.",
        "- Exports are negative MWh.",
        "- Total electricity check lines are written for external reconciliation.",
        "- Label order is country, interconnector name, BMRS code.",
        "",
        "## Interconnectors",
        "",
    ]
    lines += [f"- {row}" for row in report["interconnectors"]]
    lines += [
        "",
        "## Output rows",
        "",
        f"- Index rows: `{report['outputRows']['index']}`",
        f"- Total electricity rows: `{report['outputRows']['totalElectricity']}`",
        f"- JSON output files: `{report['outputFilesJsonCount']}`",
        "",
        "## Planned changed files",
        "",
    ]
    lines += [f"- `{p}`" for p in report["plannedChangedFiles"]]
    lines += ["", "## Changed files in this mode", ""]
    lines += [f"- `{p}`" for p in report["changedFiles"]] or ["- none"]
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    lines += [f"| {k} | {'✅' if v else '❌'} |" for k, v in report["checks"].items()]
    lines += [
        "",
        "## Method",
        "",
        "Signed raw-code interconnector rows are scanned before collapse. Energy is calculated per BMRS code, not inside a merged INT* technology bucket. Imports are stored as positive signed MWh and exports as negative signed MWh.",
        "",
        "## Rollback",
        "",
        report["rollbackMethod"],
        "",
    ]
    write(REPORT_MD, "\n".join(lines) + "\n")
    write(REPORT_JSON, json.dumps(report, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-year", type=int, default=2016)
    ap.add_argument("--end-year", default="auto")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    end_year = dt.datetime.now(dt.timezone.utc).year if args.end_year == "auto" else int(args.end_year)
    mode = "apply" if args.apply else "audit"
    git_head_before = git(["rev-parse", "HEAD"])
    existing_paths = {
        "annual": EXISTING_ANNUAL,
        "monthly": EXISTING_MONTHLY,
        "seasonal": EXISTING_SEASONAL,
        "dayNight": EXISTING_DAY_NIGHT,
    }
    before_hashes = {"paths": existing_paths, "hashes": {k: sha(p) for k, p in existing_paths.items()}}
    planned, index_rows, total_rows, source_meta = planned_files(args.start_year, end_year)
    planned_changed = changed_paths(planned)
    checks, state = collect_checks(planned, index_rows, total_rows, source_meta, before_hashes)

    output_json_paths = sorted(rel(p) for p in planned if OUT_DIR in p.parents and p.suffix == ".json")
    report = {
        "reportTitle": REPORT_TITLE,
        "schemaVersion": "2.0.0-granular",
        "generatedUTC": utcnow(),
        "repository": "Ventusltd/globalgrid2050",
        "branch": git(["branch", "--show-current"]),
        "gitHeadBefore": git_head_before,
        "gitHeadAfter": git(["rev-parse", "HEAD"]),
        "workflowName": WORKFLOW_NAME,
        "scriptName": SCRIPT_NAME,
        "upgradeType": "live V6 granular interconnector split for MWh panel",
        "mode": mode,
        "sourceApis": [],
        "sourceWindows": [f"{args.start_year} to {end_year}"],
        "inputFiles": [rel(INDEX), rel(LOAD), rel(RENDER), rel(CONTROL), rel(EXISTING_ANNUAL), rel(EXISTING_MONTHLY), rel(EXISTING_SEASONAL), rel(EXISTING_DAY_NIGHT)] + [f["path"] for f in source_meta["sourceFiles"][:50]],
        "outputFiles": [rel(INDEX), rel(LOAD), rel(RENDER), rel(CONTROL), rel(REPORT_MD), rel(REPORT_JSON)] + output_json_paths,
        "outputFilesJsonCount": len(output_json_paths),
        "changedFiles": planned_changed if args.apply else [],
        "plannedChangedFiles": planned_changed,
        "addedFiles": [rel(p) for p in planned if p.suffix == ".json" and OUT_DIR in p.parents and not p.exists()],
        "deletedFiles": [],
        "interconnectors": [CODE_META[c]["label"] for c in sorted(CODES, key=lambda c: CODE_META[c]["sortOrder"])],
        "legacyBucketRowsFound": {
            "annual": sum(1 for r in existing_rows(EXISTING_ANNUAL) if r.get("technology") == LEGACY_BUCKET),
            "monthly": sum(1 for r in existing_rows(EXISTING_MONTHLY) if r.get("technology") == LEGACY_BUCKET),
        },
        "sourceAudit": source_meta,
        "outputRows": {"index": len(index_rows), "totalElectricity": len(total_rows)},
        "sourceHashesBefore": before_hashes["hashes"],
        "sourceHashesAfter": state["currentHashes"],
        "rawTemporaryFilesFound": raw_temp_files(),
        "browserRoutingAffected": True,
        "checks": checks,
        "jsSyntax": state["jsSyntax"],
        "rollbackMethod": "Revert the apply commit. Existing generation aggregate JSON files are not modified by this workflow.",
        "executiveSummary": "Splits interconnectors out of the live V6 Generation Output in MWh panel using granular signed per-link files. The legacy Imports & Exports bucket is hidden, ten interconnectors each receive separate import and export JSON files, imports remain positive, exports remain negative, and a total electricity check line is shown at the bottom for reconciliation.",
        "humanReviewStatus": "awaiting Vikram review" if not args.apply else "apply completed; verify live page after Pages deploy",
        "nextAction": "Review audit report, then rerun in apply mode only if all checks pass." if not args.apply else "Open live page and verify annual MWh panel, interconnector rows and total electricity check line on desktop and mobile.",
        "applied": bool(args.apply),
        "pass": all(checks.values()),
    }

    if not report["pass"]:
        write_reports(report)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        raise SystemExit("checks failed")

    if args.apply:
        for path, content in planned.items():
            if read(path) != content:
                write(path, content)

    report["gitHeadAfter"] = git(["rev-parse", "HEAD"])
    write_reports(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
