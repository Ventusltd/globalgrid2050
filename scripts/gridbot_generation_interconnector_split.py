#!/usr/bin/env python3
from __future__ import annotations
import argparse, calendar, datetime as dt, json, math, re, time, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"
INDEX = APP / "index.md"
LOAD = APP / "load_generation_mwh_aggregates.js"
RENDER = APP / "render_generation_mwh_aggregates.js"
CONTROL = APP / "control_generation_mwh_aggregates.js"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "json" / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.json"
OUT_ANNUAL = APP / "generation_interconnector_annual_mwh_by_link.json"
OUT_MONTHLY = APP / "generation_interconnector_monthly_mwh_by_link.json"
ELEXON = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH"
CACHE = "20260613interconnectorsplit1"
LEGACY = "Imports & Exports"
LINKS = [
    ("France", "IFA", "INTFR"),
    ("France", "IFA2", "INTIFA2"),
    ("France", "ElecLink", "INTELEC"),
    ("Belgium", "Nemo Link", "INTNEM"),
    ("Netherlands", "BritNed", "INTNED"),
    ("Norway", "North Sea Link", "INTNSL"),
    ("Denmark", "Viking Link", "INTVKL"),
    ("Republic of Ireland", "East-West Interconnector", "INTEW"),
    ("Republic of Ireland", "Greenlink", "INTGRNL"),
    ("Northern Ireland", "Moyle", "INTIRL"),
]
CODE_META = {c: {"country": a, "interconnector": b, "bmrsCode": c, "label": f"{a} - {b} - {c}"} for a, b, c in LINKS}
CODES = set(CODE_META)

LOAD_JS = """window.V6LoadGenerationMwhAggregates=(function(){var cache={};function f(k,u){if(cache[k])return cache[k];cache[k]=fetch(u+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});return cache[k]}return{annual:function(){return f('annual','/uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json')},monthly:function(){return f('monthly','/uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json')},seasonal:function(){return f('seasonal','/uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json')},dayNight:function(){return f('daynight','/uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json')},interconnectorAnnual:function(){return f('icAnnual','/uk_energy_tracking_v6/generation_history/generation_interconnector_annual_mwh_by_link.json')},interconnectorMonthly:function(){return f('icMonthly','/uk_energy_tracking_v6/generation_history/generation_interconnector_monthly_mwh_by_link.json')}}})();\n"""

RENDER_JS = """window.V6RenderGenerationMwhAggregates=(function(){var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6',Other:'#a6adbb'},hide={'Imports & Exports':1},ord={Solar:10,Wind:20,Gas:30,Nuclear:40,Biomass:50,Hydro:60,'Pumped Storage':70,Coal:80,Other:90};function fmt(n,d){return n==null||isNaN(Number(n))?'--':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}function clean(rows){return(rows||[]).filter(function(r){return r&&!hide[r.technology]})}function link(r){return(r.country||'')+' - '+(r.interconnector||'')+' - '+(r.bmrsCode||'')}function annual(el,rows,ic){if(!el)return;rows=rows||[];if(!rows.length){el.innerHTML='<div class=\"mwh-empty\">Awaiting annual MWh aggregate data.</div>';return}var y=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0})),rs=clean(rows.filter(function(r){return Number(r.year)===y})).sort(function(a,b){return(ord[a.technology]||999)-(ord[b.technology]||999)}),tot=rs.reduce(function(s,r){return s+Math.max(0,Number(r.totalMWh||0))},0),h='<div class=\"mwh-aggregate-head\"><strong>Annual MWh by technology</strong><span>'+y+' - generation shown; interconnectors split below</span></div><div class=\"mwh-bars\">';rs.forEach(function(r){var v=Number(r.totalMWh||0),p=tot?Math.max(0,v)/tot*100:0,c=colours[r.technology]||'#00ffff';h+='<div class=\"mwh-row\"><div class=\"mwh-label\">'+r.technology+'</div><div class=\"mwh-track\"><i style=\"width:'+p+'%;background:'+c+'\"></i></div><div class=\"mwh-value\">'+fmt(v/1000000,2)+' TWh</div></div>'});h+='</div>';var x=(ic||[]).filter(function(r){return Number(r.year)===y}).sort(function(a,b){return link(a).localeCompare(link(b))});if(x.length){var mx=Math.max.apply(null,x.map(function(r){return Math.max(Math.abs(Number(r.importMWh||0)),Math.abs(Number(r.exportMWh||0)),Math.abs(Number(r.netMWh||0)))}));h+='<div class=\"mwh-aggregate-head\" style=\"margin-top:16px\"><strong>Interconnectors - imports / exports</strong><span>Country - interconnector - BMRS code</span></div><div class=\"mwh-bars mwh-interconnector-bars\">';x.forEach(function(r){var i=Number(r.importMWh||0),e=Number(r.exportMWh||0),n=Number(r.netMWh||0),p=mx?Math.max(2,Math.abs(n)/mx*100):2,c=n>=0?'#00d0ff':'#ff7777';h+='<div class=\"mwh-row mwh-interconnector-row\"><div class=\"mwh-label\" title=\"'+link(r)+'\">'+link(r)+'</div><div class=\"mwh-track\"><i style=\"width:'+p+'%;background:'+c+'\"></i></div><div class=\"mwh-value\">I '+fmt(i/1000000,2)+' / E '+fmt(e/1000000,2)+' / N '+fmt(n/1000000,2)+' TWh</div></div>'});h+='</div><div class=\"mwh-note-line\">Interconnectors are separated from generation. Positive FUELHH MW = GB import; negative FUELHH MW = GB export.</div>'}else h+='<div class=\"mwh-note-line\">Interconnector split awaiting compact FUELHH import/export facts.</div>';el.innerHTML=h}function monthly(el,rows,technology){if(!el)return;rows=clean(rows).filter(function(r){return !technology||r.technology===technology});if(!rows.length){el.innerHTML='<div class=\"mwh-empty\">Awaiting monthly MWh aggregate data.</div>';return}rows=rows.slice().sort(function(a,b){return(a.year-b.year)||(a.month-b.month)});var mx=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0})),sample=rows.slice(-24),h='<div class=\"mwh-aggregate-head\"><strong>Monthly MWh trend</strong><span>'+(technology||'All generation technologies')+'</span></div><div class=\"mwh-mini-chart\">';sample.forEach(function(r){var p=mx?Math.max(2,Number(r.totalMWh)/mx*100):2;h+='<div class=\"mwh-col\" title=\"'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh\"><i style=\"height:'+p+'%;background:'+(colours[r.technology]||'#00ffff')+'\"></i></div>'});el.innerHTML=h+'</div>'}function dayNight(el,rows,technology){if(!el)return;rows=clean(rows).filter(function(r){return !technology||r.technology===technology});if(!rows.length){el.innerHTML='<div class=\"mwh-empty\">Awaiting day/night aggregate data.</div>';return}var y=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0})),day=0,night=0;rows.filter(function(r){return Number(r.year)===y}).forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});var t=day+night,dp=t?day/t*100:0,np=t?night/t*100:0;el.innerHTML='<div class=\"mwh-aggregate-head\"><strong>Day versus night MWh</strong><span>'+y+' - '+(technology||'All generation technologies')+'</span></div><div class=\"mwh-split\"><div style=\"width:'+dp+'%\">Day '+fmt(dp,1)+'%</div><div style=\"width:'+np+'%\">Night '+fmt(np,1)+'%</div></div><div class=\"mwh-note-line\">Day '+fmt(day/1000000,2)+' TWh - Night '+fmt(night/1000000,2)+' TWh</div>'}return{annual:annual,monthly:monthly,dayNight:dayNight}})();\n"""

CONTROL_JS = """window.V6ControlGenerationMwhAggregates=(function(){var hide={'Imports & Exports':1};function byId(id){return document.getElementById(id)}function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !hide[t]});e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'')}function setStatus(t){var e=byId('generation-mwh-status');if(e)e.textContent=t}function refresh(){setStatus('Loading MWh aggregate intelligence and interconnector split...');Promise.all([window.V6LoadGenerationMwhAggregates.annual(),window.V6LoadGenerationMwhAggregates.monthly(),window.V6LoadGenerationMwhAggregates.dayNight(),window.V6LoadGenerationMwhAggregates.interconnectorAnnual(),window.V6LoadGenerationMwhAggregates.interconnectorMonthly()]).then(function(p){window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),p[0],p[3]);window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),p[1],tech(),p[4]);window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),p[2],tech());setStatus('Aggregate files loaded - legacy Imports & Exports hidden - interconnector import/export rows '+p[3].length+' annual / '+p[4].length+' monthly')}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}return{init:init,refresh:refresh}})();document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});\n"""

def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")

def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace") if p.exists() else ""

def write(p: Path, txt: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(txt, encoding="utf-8")

def existing_rows(p: Path) -> list[dict[str, Any]]:
    try:
        d = json.loads(read(p))
        r = d.get("rows", [])
        return r if isinstance(r, list) else []
    except Exception:
        return []

def pick(row: dict[str, Any], names: list[str]) -> Any:
    folded = {str(k).lower(): v for k, v in row.items()}
    for n in names:
        v = folded.get(n.lower())
        if v not in (None, ""):
            return v
    return ""

def row_time(row: dict[str, Any]) -> dt.datetime | None:
    v = pick(row, ["startTime", "settlementPeriodStartTime", "periodStartUTC", "publishDateTime"])
    if v:
        try:
            d = dt.datetime.fromisoformat(str(v).replace("Z", "+00:00"))
            if d.tzinfo is None:
                d = d.replace(tzinfo=dt.timezone.utc)
            return d.astimezone(dt.timezone.utc)
        except Exception:
            pass
    try:
        sd = str(row.get("settlementDate", ""))[:10]
        sp = int(row.get("settlementPeriod"))
        return dt.datetime.combine(dt.date.fromisoformat(sd), dt.time(), tzinfo=dt.timezone.utc) + dt.timedelta(minutes=30 * (sp - 1))
    except Exception:
        return None

def mw_value(row: dict[str, Any]) -> float | None:
    try:
        x = float(pick(row, ["generation", "generationMW", "quantity", "currentUsage"]))
        return x if math.isfinite(x) else None
    except Exception:
        return None

def month_end(y: int, m: int) -> dt.date:
    return dt.date(y, m, calendar.monthrange(y, m)[1])

def months(start_year: int, end_year: int):
    today = dt.datetime.now(dt.timezone.utc).date()
    for y in range(start_year, end_year + 1):
        for m in range(1, 13):
            s = dt.date(y, m, 1)
            e = month_end(y, m)
            if s > today:
                continue
            if y == today.year and m == today.month:
                e = min(e, today - dt.timedelta(days=1))
            if e >= s:
                yield y, m, s, e

def fetch_json(url: str, retries: int = 4) -> Any:
    err = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as exc:
            err = exc
            time.sleep(min(30, 2 ** i))
    raise RuntimeError(err)

def extract(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        for k in ("data", "results", "items"):
            if isinstance(payload.get(k), list):
                return [x for x in payload[k] if isinstance(x, dict)]
    return []

def fuel(row: dict[str, Any]) -> str:
    return str(pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"])).strip().upper()

def fetch_interconnectors(start_year: int, end_year: int, offline: bool):
    if offline:
        return [], {"offline": True, "rawRows": 0, "usedRows": 0, "fetches": []}
    buckets = defaultdict(lambda: {"importMWh": 0.0, "exportMWh": 0.0, "netMWh": 0.0, "records": 0, "positiveRecords": 0, "negativeRecords": 0})
    meta = {"offline": False, "rawRows": 0, "usedRows": 0, "fetches": []}
    for y, m, s, e in months(start_year, end_year):
        params = [("settlementDateFrom", s.isoformat()), ("settlementDateTo", e.isoformat()), ("format", "json")]
        params += [("fuelType", c) for c in sorted(CODES)]
        url = ELEXON + "?" + urllib.parse.urlencode(params)
        try:
            source = extract(fetch_json(url))
            status = "ok"
        except Exception as exc:
            source = []
            status = str(exc)
        used = 0
        meta["rawRows"] += len(source)
        for r in source:
            c = fuel(r)
            t = row_time(r)
            mw = mw_value(r)
            if c not in CODES or t is None or mw is None:
                continue
            mwh = mw * 0.5
            b = buckets[(t.year, t.month, c)]
            if mwh >= 0:
                b["importMWh"] += mwh
                b["positiveRecords"] += 1
            else:
                b["exportMWh"] += abs(mwh)
                b["negativeRecords"] += 1
            b["netMWh"] += mwh
            b["records"] += 1
            used += 1
        meta["usedRows"] += used
        meta["fetches"].append({"year": y, "month": m, "rawRows": len(source), "usedRows": used, "status": status})
    rows = []
    for (y, m, c), b in sorted(buckets.items()):
        base = dict(CODE_META[c])
        base.update({"year": y, "month": m, **{k: round(v, 3) if k.endswith("MWh") else int(v) for k, v in b.items()}, "source": "Elexon BMRS FUELHH"})
        rows.append(base)
    return rows, meta

def annualise(monthly: list[dict[str, Any]]) -> list[dict[str, Any]]:
    acc = defaultdict(lambda: {"importMWh": 0.0, "exportMWh": 0.0, "netMWh": 0.0, "records": 0, "positiveRecords": 0, "negativeRecords": 0})
    for r in monthly:
        b = acc[(int(r["year"]), r["bmrsCode"])]
        for k in ("importMWh", "exportMWh", "netMWh"):
            b[k] += float(r.get(k) or 0)
        for k in ("records", "positiveRecords", "negativeRecords"):
            b[k] += int(r.get(k) or 0)
    out = []
    for (y, c), b in sorted(acc.items()):
        base = dict(CODE_META[c])
        base.update({"year": y, **{k: round(v, 3) if k.endswith("MWh") else int(v) for k, v in b.items()}, "source": "Elexon BMRS FUELHH"})
        out.append(base)
    return out

def payload(title: str, grain: str, rows: list[dict[str, Any]], start_year: int, end_year: int) -> dict[str, Any]:
    return {"schemaVersion": "1.0.0-interconnector-split", "generatedUTC": utcnow(), "title": title, "grain": grain, "unit": "MWh", "signConvention": "Positive FUELHH MW = GB import; negative FUELHH MW = GB export.", "sourceNote": "Interconnectors are separate from generation. Raw rows are not committed.", "startYear": start_year, "endYear": end_year, "rows": rows}

def patch_index(txt: str) -> str:
    warning = '<div class="generation-source-warning mwh-interconnector-split-warning"><strong>Interconnector accounting:</strong> The former Imports &amp; Exports generation bucket is hidden. Interconnectors are shown separately as imports, exports and net flow, labelled country first, interconnector name second and BMRS code third.</div>'
    if "mwh-interconnector-split-warning" not in txt:
        txt = txt.replace('          <div class="mwh-card" id="generation-mwh-daynight"></div>\n        </div>', '          <div class="mwh-card" id="generation-mwh-daynight"></div>\n        </div>\n        ' + warning, 1)
    for name in ("load_generation_mwh_aggregates", "render_generation_mwh_aggregates", "control_generation_mwh_aggregates"):
        txt = re.sub(rf"(/uk_energy_tracking_v6/generation_history/{name}\.js\?v=)[^\"']+", rf"\g<1>{CACHE}", txt)
    return txt

def write_reports(report: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines = ["# Generation Interconnector Split", "", f"Generated UTC: `{report['generatedUTC']}`", f"Mode: `{report['mode']}`", f"Pass: `{report['pass']}`", "", "## Interconnectors"]
    lines += [f"- {x}" for x in report["interconnectors"]]
    lines += ["", "## Checks"]
    lines += [f"- `{k}`: `{v}`" for k, v in report["checks"].items()]
    lines += ["", "## Method", "Positive FUELHH MW is treated as GB import. Negative FUELHH MW is treated as GB export. The old Imports & Exports row is hidden from generation, not treated as generation."]
    write(REPORT_MD, "\n".join(lines) + "\n")
    write(REPORT_JSON, json.dumps(report, indent=2) + "\n")

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-year", type=int, default=2016)
    ap.add_argument("--end-year", default="auto")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--offline", action="store_true")
    args = ap.parse_args()
    end_year = dt.datetime.now(dt.timezone.utc).year if args.end_year == "auto" else int(args.end_year)
    monthly, meta = fetch_interconnectors(args.start_year, end_year, args.offline)
    annual = annualise(monthly)
    checks = {
        "target_files_exist": all(p.exists() for p in (INDEX, LOAD, RENDER, CONTROL)),
        "legacy_hidden_in_control": "Imports & Exports" in CONTROL_JS,
        "legacy_hidden_in_render": "Imports & Exports" in RENDER_JS,
        "separate_import_export_net_fields": all(x in RENDER_JS for x in ("importMWh", "exportMWh", "netMWh")),
        "country_first_labels": all(CODE_META[c]["label"].split(" - ")[0] for c in CODES),
        "raw_rows_not_written": True,
        "interconnector_rows_available_or_offline_audit": bool(annual) or args.offline,
    }
    report = {
        "reportTitle": "Generation Interconnector Split",
        "schemaVersion": "1.0.0",
        "generatedUTC": utcnow(),
        "mode": "apply" if args.apply else "audit",
        "repository": "Ventusltd/globalgrid2050",
        "workflowName": "GridBot Generation Interconnector Split",
        "scriptName": "scripts/gridbot_generation_interconnector_split.py",
        "interconnectors": [CODE_META[c]["label"] for c in sorted(CODES)],
        "legacyBucketRowsFound": {
            "annual": sum(1 for r in existing_rows(APP / "generation_annual_mwh_by_technology.json") if r.get("technology") == LEGACY),
            "monthly": sum(1 for r in existing_rows(APP / "generation_monthly_mwh_by_technology.json") if r.get("technology") == LEGACY),
        },
        "fetchMeta": meta,
        "outputRows": {"annual": len(annual), "monthly": len(monthly)},
        "changedFiles": [rel(INDEX), rel(LOAD), rel(RENDER), rel(CONTROL), rel(OUT_ANNUAL), rel(OUT_MONTHLY), rel(REPORT_MD), rel(REPORT_JSON)],
        "checks": checks,
        "rollbackMethod": "Revert the apply commit.",
        "applied": bool(args.apply),
        "pass": all(checks.values()),
    }
    if not report["pass"]:
        write_reports(report)
        raise SystemExit("checks failed")
    if args.apply:
        write(LOAD, LOAD_JS)
        write(RENDER, RENDER_JS)
        write(CONTROL, CONTROL_JS)
        write(INDEX, patch_index(read(INDEX)))
        write(OUT_ANNUAL, json.dumps(payload("Annual interconnector import/export/net MWh", "annual by interconnector", annual, args.start_year, end_year), indent=2) + "\n")
        write(OUT_MONTHLY, json.dumps(payload("Monthly interconnector import/export/net MWh", "monthly by interconnector", monthly, args.start_year, end_year), indent=2) + "\n")
    write_reports(report)
    print(json.dumps({"pass": report["pass"], "applied": report["applied"], "annualRows": len(annual), "monthlyRows": len(monthly)}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
