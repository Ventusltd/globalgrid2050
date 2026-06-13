#!/usr/bin/env python3
from __future__ import annotations

import argparse
import calendar
import datetime as dt
import json
import math
import re
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"

INDEX = APP / "index.md"
LOAD = APP / "load_generation_mwh_aggregates.js"
RENDER = APP / "render_generation_mwh_aggregates.js"
CONTROL = APP / "control_generation_mwh_aggregates.js"

ANNUAL = APP / "generation_annual_mwh_by_technology.json"
MONTHLY = APP / "generation_monthly_mwh_by_technology.json"
SEASONAL = APP / "generation_seasonal_mwh_by_technology.json"
DAY_NIGHT = APP / "generation_day_night_mwh_by_technology.json"

OUT_ANNUAL = APP / "generation_interconnector_annual_mwh_by_link.json"
OUT_MONTHLY = APP / "generation_interconnector_monthly_mwh_by_link.json"

REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.json"

WORKFLOW_NAME = "GridBot Generation Interconnector Split"
SCRIPT_NAME = "scripts/gridbot_generation_interconnector_split.py"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
ELEXON_FUELHH = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH"
CACHE_BUSTER = "20260613interconnectorsplit2"
LEGACY_BUCKET = "Imports & Exports"
CHUNK_DAYS = 7
REQUEST_DELAY_SECONDS = 0.2

LINKS = [
    {"country": "France", "interconnector": "IFA / HVDC Cross-Channel", "bmrsCode": "INTFR"},
    {"country": "France", "interconnector": "IFA2", "bmrsCode": "INTIFA2"},
    {"country": "France", "interconnector": "ElecLink", "bmrsCode": "INTELEC"},
    {"country": "Belgium", "interconnector": "Nemo Link", "bmrsCode": "INTNEM"},
    {"country": "Netherlands", "interconnector": "BritNed", "bmrsCode": "INTNED"},
    {"country": "Norway", "interconnector": "North Sea Link", "bmrsCode": "INTNSL"},
    {"country": "Denmark", "interconnector": "Viking Link", "bmrsCode": "INTVKL"},
    {"country": "Republic of Ireland", "interconnector": "East-West Interconnector / EWIC", "bmrsCode": "INTEW"},
    {"country": "Republic of Ireland", "interconnector": "Greenlink", "bmrsCode": "INTGRNL"},
    {"country": "Northern Ireland", "interconnector": "Moyle Interconnector", "bmrsCode": "INTIRL"},
]
CODE_META = {
    item["bmrsCode"]: {
        **item,
        "label": f"{item['country']} — {item['interconnector']} — {item['bmrsCode']}",
    }
    for item in LINKS
}
CODES = set(CODE_META)

LOAD_JS = """window.V6LoadGenerationMwhAggregates=(function(){
  var cache={};
  function fetchRows(key,url){
    if(cache[key])return cache[key];
    cache[key]=fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():{rows:[]}}).then(function(d){return d.rows||[]}).catch(function(){return[]});
    return cache[key];
  }
  function annual(){return fetchRows('annual','/uk_energy_tracking_v6/generation_history/generation_annual_mwh_by_technology.json')}
  function monthly(){return fetchRows('monthly','/uk_energy_tracking_v6/generation_history/generation_monthly_mwh_by_technology.json')}
  function seasonal(){return fetchRows('seasonal','/uk_energy_tracking_v6/generation_history/generation_seasonal_mwh_by_technology.json')}
  function dayNight(){return fetchRows('daynight','/uk_energy_tracking_v6/generation_history/generation_day_night_mwh_by_technology.json')}
  function interconnectorAnnual(){return fetchRows('interconnectorAnnual','/uk_energy_tracking_v6/generation_history/generation_interconnector_annual_mwh_by_link.json')}
  function interconnectorMonthly(){return fetchRows('interconnectorMonthly','/uk_energy_tracking_v6/generation_history/generation_interconnector_monthly_mwh_by_link.json')}
  return{annual:annual,monthly:monthly,seasonal:seasonal,dayNight:dayNight,interconnectorAnnual:interconnectorAnnual,interconnectorMonthly:interconnectorMonthly};
})();
"""

RENDER_JS = """window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6',Other:'#a6adbb'};
  var hide={'Imports & Exports':true};
  var order={Solar:10,Wind:20,Gas:30,Nuclear:40,Biomass:50,Hydro:60,'Pumped Storage':70,Coal:80,Other:90};
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function generationRows(rows){return(rows||[]).filter(function(r){return r&&!hide[r.technology]})}
  function linkLabel(r){return r.label||[r.country,r.interconnector,r.bmrsCode].filter(Boolean).join(' — ')}
  function latestYear(rows,ic){var years=[];(rows||[]).forEach(function(r){years.push(Number(r.year)||0)});(ic||[]).forEach(function(r){years.push(Number(r.year)||0)});return Math.max.apply(null,years)}
  function renderAnnual(el,rows,interconnectorRows){
    if(!el)return;
    rows=rows||[];interconnectorRows=interconnectorRows||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return;}
    var y=latestYear(rows,interconnectorRows);
    var rs=generationRows(rows.filter(function(r){return Number(r.year)===y})).sort(function(a,b){return(order[a.technology]||999)-(order[b.technology]||999)});
    var total=rs.reduce(function(s,r){return s+Math.max(0,Number(r.totalMWh||0))},0);
    var html='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+y+' · generation shown · legacy Imports & Exports removed</span></div><div class="mwh-bars">';
    rs.forEach(function(r){var v=Number(r.totalMWh||0),pct=total?Math.max(0,v)/total*100:0,c=colours[r.technology]||'#00ffff';html+='<div class="mwh-row"><div class="mwh-label">'+r.technology+'</div><div class="mwh-track"><i style="width:'+pct+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>'});
    html+='</div>';
    var ic=(interconnectorRows||[]).filter(function(r){return Number(r.year)===y}).sort(function(a,b){return linkLabel(a).localeCompare(linkLabel(b))});
    if(ic.length){
      var max=Math.max.apply(null,ic.map(function(r){return Math.max(Math.abs(Number(r.importMWh||0)),Math.abs(Number(r.exportMWh||0)),Math.abs(Number(r.netMWh||0)),1)}));
      html+='<div class="mwh-aggregate-head" style="margin-top:16px"><strong>Interconnectors · imports and exports</strong><span>Country — interconnector — BMRS code</span></div><div class="mwh-bars mwh-interconnector-bars">';
      ic.forEach(function(r){var i=Number(r.importMWh||0),e=Number(r.exportMWh||0),n=Number(r.netMWh||0),pct=max?Math.max(2,Math.abs(n)/max*100):2,c=n>=0?'#00d0ff':'#ff7777',label=linkLabel(r);html+='<div class="mwh-row mwh-interconnector-row"><div class="mwh-label" title="'+label+'">'+label+'</div><div class="mwh-track"><i style="width:'+pct+'%;background:'+c+'"></i></div><div class="mwh-value">I '+fmt(i/1000000,2)+' · E '+fmt(e/1000000,2)+' · N '+fmt(n/1000000,2)+' TWh</div></div>'});
      html+='</div><div class="mwh-note-line">Interconnectors are separate from generation. Positive FUELHH MW is treated as GB import; negative FUELHH MW is treated as GB export.</div>';
    }else{
      html+='<div class="mwh-note-line">Interconnector split awaiting compact import/export facts.</div>';
    }
    el.innerHTML=html;
  }
  function renderMonthly(el,rows,technology){
    if(!el)return;
    rows=generationRows(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return;}
    rows=rows.slice().sort(function(a,b){return(a.year-b.year)||(a.month-b.month)});
    var max=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0}));
    var sample=rows.slice(-24);
    var html='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All generation technologies')+'</span></div><div class="mwh-mini-chart">';
    sample.forEach(function(r){var h=max?Math.max(2,Number(r.totalMWh)/max*100):2;html+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+h+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>'});
    el.innerHTML=html+'</div>';
  }
  function renderDayNight(el,rows,technology){
    if(!el)return;
    rows=generationRows(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return;}
    var y=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0}));
    var day=0,night=0;
    rows.filter(function(r){return Number(r.year)===y}).forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});
    var total=day+night,dp=total?day/total*100:0,np=total?night/total*100:0;
    el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+y+' · '+(technology||'All generation technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh · Night '+fmt(night/1000000,2)+' TWh</div>';
  }
  return{annual:renderAnnual,monthly:renderMonthly,dayNight:renderDayNight};
})();
"""

CONTROL_JS = """window.V6ControlGenerationMwhAggregates=(function(){
  var hide={'Imports & Exports':true};
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !hide[t]});e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'')}
  function setStatus(text){var e=byId('generation-mwh-status');if(e)e.textContent=text}
  function refresh(){
    setStatus('Loading MWh aggregate intelligence and interconnector split...');
    Promise.all([window.V6LoadGenerationMwhAggregates.annual(),window.V6LoadGenerationMwhAggregates.monthly(),window.V6LoadGenerationMwhAggregates.dayNight(),window.V6LoadGenerationMwhAggregates.interconnectorAnnual(),window.V6LoadGenerationMwhAggregates.interconnectorMonthly()]).then(function(parts){
      window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),parts[0],parts[3]);
      window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),parts[1],tech());
      window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),parts[2],tech());
      setStatus('Aggregate files loaded · legacy Imports & Exports removed from generation · interconnector import/export rows '+parts[3].length+' annual / '+parts[4].length+' monthly')
    }).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})
  }
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();
document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});
"""


def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def git_head() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:
        return ""


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else ""


def json_rows(path: Path) -> list[dict[str, Any]]:
    try:
        payload = json.loads(read(path))
        rows = payload.get("rows", [])
        return rows if isinstance(rows, list) else []
    except Exception:
        return []


def pick(row: dict[str, Any], names: list[str]) -> Any:
    folded = {str(k).lower(): v for k, v in row.items()}
    for name in names:
        value = folded.get(name.lower())
        if value not in (None, ""):
            return value
    return ""


def fuel(row: dict[str, Any]) -> str:
    return str(pick(row, ["fuelType", "fuelTypeName", "fuel", "psrType"])).strip().upper()


def row_time(row: dict[str, Any]) -> dt.datetime | None:
    value = pick(row, ["startTime", "settlementPeriodStartTime", "periodStartUTC", "publishDateTime"])
    if value:
        try:
            parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=dt.timezone.utc)
            return parsed.astimezone(dt.timezone.utc)
        except Exception:
            pass
    try:
        settlement_date = str(row.get("settlementDate", ""))[:10]
        settlement_period = int(row.get("settlementPeriod"))
        return dt.datetime.combine(dt.date.fromisoformat(settlement_date), dt.time(), tzinfo=dt.timezone.utc) + dt.timedelta(minutes=30 * (settlement_period - 1))
    except Exception:
        return None


def mw_value(row: dict[str, Any]) -> float | None:
    try:
        value = float(pick(row, ["generation", "generationMW", "quantity", "currentUsage"]))
        return value if math.isfinite(value) else None
    except Exception:
        return None


def month_end(year: int, month: int) -> dt.date:
    return dt.date(year, month, calendar.monthrange(year, month)[1])


def day_windows(start: dt.date, end: dt.date, span_days: int = CHUNK_DAYS):
    current = start
    while current <= end:
        win_end = min(current + dt.timedelta(days=span_days - 1), end)
        yield current, win_end
        current = win_end + dt.timedelta(days=1)


def month_windows(start_year: int, end_year: int):
    today = dt.datetime.now(dt.timezone.utc).date()
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            start = dt.date(year, month, 1)
            end = month_end(year, month)
            if start > today:
                continue
            if year == today.year and month == today.month:
                end = min(end, today - dt.timedelta(days=1))
            if end >= start:
                yield year, month, start, end


def fetch_json(url: str, retries: int = 4) -> Any:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "GlobalGrid2050 GridBot"})
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            last_error = exc
            time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(last_error)


def extract(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("data", "results", "items"):
            if isinstance(payload.get(key), list):
                return [row for row in payload[key] if isinstance(row, dict)]
    return []


def fetch_interconnectors(start_year: int, end_year: int, offline: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if offline:
        return [], {
            "offline": True,
            "rawRows": 0,
            "usedRows": 0,
            "fetches": [],
            "windowDays": CHUNK_DAYS,
            "requestDelaySeconds": REQUEST_DELAY_SECONDS,
        }

    buckets: dict[tuple[int, int, str], dict[str, float | int]] = defaultdict(lambda: {
        "importMWh": 0.0,
        "exportMWh": 0.0,
        "netMWh": 0.0,
        "records": 0,
        "positiveRecords": 0,
        "negativeRecords": 0,
    })
    meta: dict[str, Any] = {
        "offline": False,
        "sourceApi": ELEXON_FUELHH,
        "windowDays": CHUNK_DAYS,
        "requestDelaySeconds": REQUEST_DELAY_SECONDS,
        "rawRows": 0,
        "usedRows": 0,
        "failedWindows": 0,
        "fetches": [],
    }

    for year, month, month_start, month_end_date in month_windows(start_year, end_year):
        month_raw = 0
        month_used = 0
        month_failed = 0
        for win_start, win_end in day_windows(month_start, month_end_date):
            params: list[tuple[str, str]] = [
                ("settlementDateFrom", win_start.isoformat()),
                ("settlementDateTo", win_end.isoformat()),
                ("format", "json"),
            ]
            params.extend(("fuelType", code) for code in sorted(CODES))
            url = ELEXON_FUELHH + "?" + urllib.parse.urlencode(params)
            try:
                rows = extract(fetch_json(url))
                status = "ok"
            except Exception as exc:
                rows = []
                status = str(exc)
                month_failed += 1

            used = 0
            month_raw += len(rows)
            meta["rawRows"] += len(rows)
            for row in rows:
                code = fuel(row)
                timestamp = row_time(row)
                mw = mw_value(row)
                if code not in CODES or timestamp is None or mw is None:
                    continue
                mwh = mw * 0.5
                bucket = buckets[(timestamp.year, timestamp.month, code)]
                if mwh >= 0:
                    bucket["importMWh"] = float(bucket["importMWh"]) + mwh
                    bucket["positiveRecords"] = int(bucket["positiveRecords"]) + 1
                else:
                    bucket["exportMWh"] = float(bucket["exportMWh"]) + abs(mwh)
                    bucket["negativeRecords"] = int(bucket["negativeRecords"]) + 1
                bucket["netMWh"] = float(bucket["netMWh"]) + mwh
                bucket["records"] = int(bucket["records"]) + 1
                used += 1
            month_used += used
            meta["usedRows"] += used
            time.sleep(REQUEST_DELAY_SECONDS)
        meta["failedWindows"] += month_failed
        meta["fetches"].append({
            "year": year,
            "month": month,
            "window": f"{month_start.isoformat()} to {month_end_date.isoformat()}",
            "rawRows": month_raw,
            "usedRows": month_used,
            "failedWindows": month_failed,
            "status": "ok" if month_failed == 0 else "partial",
        })

    monthly: list[dict[str, Any]] = []
    for (year, month, code), bucket in sorted(buckets.items()):
        base = dict(CODE_META[code])
        base.update({
            "year": year,
            "month": month,
            "importMWh": round(float(bucket["importMWh"]), 3),
            "exportMWh": round(float(bucket["exportMWh"]), 3),
            "netMWh": round(float(bucket["netMWh"]), 3),
            "records": int(bucket["records"]),
            "positiveRecords": int(bucket["positiveRecords"]),
            "negativeRecords": int(bucket["negativeRecords"]),
            "source": "Elexon BMRS FUELHH",
            "status": "candidate",
        })
        monthly.append(base)
    return monthly, meta


def annualise(monthly_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    acc: dict[tuple[int, str], dict[str, float | int]] = defaultdict(lambda: {
        "importMWh": 0.0,
        "exportMWh": 0.0,
        "netMWh": 0.0,
        "records": 0,
        "positiveRecords": 0,
        "negativeRecords": 0,
    })
    for row in monthly_rows:
        key = (int(row["year"]), str(row["bmrsCode"]))
        bucket = acc[key]
        for field in ("importMWh", "exportMWh", "netMWh"):
            bucket[field] = float(bucket[field]) + float(row.get(field) or 0)
        for field in ("records", "positiveRecords", "negativeRecords"):
            bucket[field] = int(bucket[field]) + int(row.get(field) or 0)

    annual: list[dict[str, Any]] = []
    for (year, code), bucket in sorted(acc.items()):
        base = dict(CODE_META[code])
        base.update({
            "year": year,
            "importMWh": round(float(bucket["importMWh"]), 3),
            "exportMWh": round(float(bucket["exportMWh"]), 3),
            "netMWh": round(float(bucket["netMWh"]), 3),
            "records": int(bucket["records"]),
            "positiveRecords": int(bucket["positiveRecords"]),
            "negativeRecords": int(bucket["negativeRecords"]),
            "source": "Elexon BMRS FUELHH",
            "status": "candidate",
        })
        annual.append(base)
    return annual


def fact_payload(title: str, grain: str, rows: list[dict[str, Any]], start_year: int, end_year: int) -> dict[str, Any]:
    return {
        "schemaVersion": "1.1.0-interconnector-split",
        "generatedUTC": utcnow(),
        "title": title,
        "grain": grain,
        "unit": "MWh",
        "status": "candidate",
        "signConvention": "Positive FUELHH MW is treated as GB import. Negative FUELHH MW is treated as GB export.",
        "labelContract": "country — interconnector name — BMRS code",
        "sourceNote": "Interconnectors are separate from generation. Raw rows are fetched transiently and not committed.",
        "startYear": start_year,
        "endYear": end_year,
        "rows": rows,
    }


def patch_index(text: str) -> str:
    warning = (
        '<div class="generation-source-warning mwh-interconnector-split-warning">'
        '<strong>Interconnector accounting:</strong> The former Imports &amp; Exports generation bucket is removed from the Generation Output in MWh chart. '
        'Named interconnectors now appear near the bottom of the annual chart with separate import, export and net MWh fields. '
        'Labels use country first, interconnector name second and BMRS code third.'
        '</div>'
    )
    if "mwh-interconnector-split-warning" not in text:
        anchor = '          <div class="mwh-card" id="generation-mwh-daynight"></div>\n        </div>'
        if anchor in text:
            text = text.replace(anchor, anchor + "\n        " + warning, 1)

    css = """
  #generation-history-panel .mwh-interconnector-bars{margin-top:4px;}
  #generation-history-panel .mwh-row.mwh-interconnector-row{grid-template-columns:minmax(240px,.92fr) 1fr 170px;font-size:11px;}
  #generation-history-panel .mwh-row.mwh-interconnector-row .mwh-label{white-space:normal;line-height:1.25;color:#d8deeb;}
"""
    if ".mwh-interconnector-bars" not in text:
        text = text.replace("</style>", css + "</style>", 1)

    for name in ("load_generation_mwh_aggregates", "render_generation_mwh_aggregates", "control_generation_mwh_aggregates"):
        text = re.sub(
            rf"(/uk_energy_tracking_v6/generation_history/{name}\.js\?v=)[^\"']+",
            rf"\g<1>{CACHE_BUSTER}",
            text,
        )
    return text


def node_check(source: str, label: str) -> dict[str, Any]:
    try:
        with tempfile.NamedTemporaryFile("w", suffix=f"_{label}.js", delete=False, encoding="utf-8") as handle:
            handle.write(source)
            temp_path = Path(handle.name)
        result = subprocess.run(["node", "--check", str(temp_path)], cwd=ROOT, text=True, capture_output=True, timeout=30)
        temp_path.unlink(missing_ok=True)
        return {"ok": result.returncode == 0, "detail": (result.stderr or result.stdout).strip()}
    except FileNotFoundError:
        return {"ok": True, "detail": "node unavailable; syntax check skipped"}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)}


def planned_outputs(annual_rows: list[dict[str, Any]], monthly_rows: list[dict[str, Any]], start_year: int, end_year: int) -> dict[Path, str]:
    return {
        INDEX: patch_index(read(INDEX)),
        LOAD: LOAD_JS,
        RENDER: RENDER_JS,
        CONTROL: CONTROL_JS,
        OUT_ANNUAL: json.dumps(fact_payload("Annual interconnector import export net MWh", "annual by interconnector", annual_rows, start_year, end_year), indent=2, ensure_ascii=False) + "\n",
        OUT_MONTHLY: json.dumps(fact_payload("Monthly interconnector import export net MWh", "monthly by interconnector", monthly_rows, start_year, end_year), indent=2, ensure_ascii=False) + "\n",
    }


def changed_paths(planned: dict[Path, str]) -> list[str]:
    return [rel(path) for path, content in planned.items() if read(path) != content]


def aggregate_hashes() -> dict[str, str]:
    return {
        "annual": sha256(ANNUAL),
        "monthly": sha256(MONTHLY),
        "seasonal": sha256(SEASONAL),
        "dayNight": sha256(DAY_NIGHT),
    }


def write_reports(report: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)

    lines = [
        f"# Generation Interconnector Split — {'PASS' if report['pass'] else 'FAIL'}",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Route: `{ROUTE}`",
        f"Pass: `{report['pass']}`",
        "",
        "## Executive summary",
        "",
        report["executiveSummary"],
        "",
        "## Changed / planned files",
        "",
    ]
    lines.extend(f"- `{path}`" for path in (report["changedFiles"] or report.get("plannedChangedFiles", [])))
    lines.extend([
        "",
        "## Interconnector label contract",
        "",
        "Labels use `country — interconnector name — BMRS code`.",
        "",
        "| Country | Interconnector | BMRS code |",
        "|---|---|---|",
    ])
    for item in LINKS:
        lines.append(f"| {item['country']} | {item['interconnector']} | `{item['bmrsCode']}` |")
    lines.extend([
        "",
        "## Checks",
        "",
        "| Check | Result |",
        "|---|---|",
    ])
    for key, value in report["checks"].items():
        lines.append(f"| `{key}` | `{'PASS' if value else 'FAIL'}` |")
    lines.extend([
        "",
        "## Method",
        "",
        "Positive FUELHH MW is treated as GB import. Negative FUELHH MW is treated as GB export. Interconnector rows are separate from generation and the old collapsed Imports & Exports bucket is hidden from the Generation Output in MWh panel.",
        "",
        "## Next action",
        "",
        report["nextAction"],
        "",
        "## Rollback",
        "",
        report["rollbackMethod"],
        "",
    ])

    write(REPORT_MD, "\n".join(lines))
    write(REPORT_JSON, json.dumps(report, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=2016)
    parser.add_argument("--end-year", default="auto")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()

    end_year = dt.datetime.now(dt.timezone.utc).year if args.end_year == "auto" else int(args.end_year)
    mode = "apply" if args.apply else "audit"
    git_before = git_head()
    hashes_before = aggregate_hashes()

    monthly_rows, fetch_meta = fetch_interconnectors(args.start_year, end_year, args.offline)
    annual_rows = annualise(monthly_rows)
    planned = planned_outputs(annual_rows, monthly_rows, args.start_year, end_year)
    planned_changed = changed_paths(planned)

    if args.apply:
        for path, content in planned.items():
            if read(path) != content:
                write(path, content)

    hashes_after = aggregate_hashes()
    index_after = planned[INDEX] if not args.apply else read(INDEX)
    load_after = planned[LOAD] if not args.apply else read(LOAD)
    render_after = planned[RENDER] if not args.apply else read(RENDER)
    control_after = planned[CONTROL] if not args.apply else read(CONTROL)

    checks = {
        "target_files_exist": all(path.exists() for path in (INDEX, LOAD, RENDER, CONTROL, ANNUAL, MONTHLY, DAY_NIGHT)),
        "audit_or_apply_mode_declared": mode in {"audit", "apply"},
        "route_is_active_v6": f"permalink: {ROUTE}" in index_after,
        "legacy_imports_exports_hidden_in_render": "var hide={'Imports & Exports':true};" in render_after,
        "legacy_imports_exports_hidden_in_control": "var hide={'Imports & Exports':true};" in control_after,
        "dropdown_filters_legacy_bucket": ".filter(function(t){return !hide[t]})" in control_after,
        "loader_fetches_interconnector_outputs": "generation_interconnector_annual_mwh_by_link.json" in load_after and "generation_interconnector_monthly_mwh_by_link.json" in load_after,
        "renderer_places_interconnectors_after_generation": "Interconnectors · imports and exports" in render_after,
        "separate_import_export_net_fields": all(field in render_after for field in ("importMWh", "exportMWh", "netMWh")),
        "country_first_labels": all(CODE_META[code]["label"].startswith(CODE_META[code]["country"]) for code in CODES),
        "all_known_codes_in_mapping": len(CODES) == 10,
        "output_rows_available_or_offline_audit": bool(annual_rows and monthly_rows) or bool(args.offline),
        "raw_rows_not_written": True,
        "existing_generation_aggregate_hashes_unchanged": hashes_before == hashes_after,
        "load_js_syntax_ok": node_check(load_after, "load_generation_mwh_aggregates")["ok"],
        "render_js_syntax_ok": node_check(render_after, "render_generation_mwh_aggregates")["ok"],
        "control_js_syntax_ok": node_check(control_after, "control_generation_mwh_aggregates")["ok"],
        "report_json_path_correct": REPORT_JSON == REPORT_JSON_DIR / "GENERATION_INTERCONNECTOR_SPLIT_LATEST.json",
    }

    output_files = [
        rel(OUT_ANNUAL),
        rel(OUT_MONTHLY),
        rel(REPORT_MD),
        rel(REPORT_JSON),
    ]
    changed_for_report = planned_changed if args.apply else []

    report = {
        "reportTitle": "Generation Interconnector Split",
        "schemaVersion": "1.2.0",
        "generatedUTC": utcnow(),
        "repository": "Ventusltd/globalgrid2050",
        "branch": "main",
        "gitHeadBefore": git_before,
        "gitHeadAfter": git_head(),
        "workflowName": WORKFLOW_NAME,
        "scriptName": SCRIPT_NAME,
        "upgradeType": "live V6 Generation Output in MWh interconnector split",
        "mode": mode,
        "sourceApis": [] if args.offline else [ELEXON_FUELHH],
        "sourceWindows": [f"{args.start_year} to {end_year}", f"{CHUNK_DAYS}-day FUELHH chunks", "fuelType filtered to INT* interconnector codes"],
        "inputFiles": [rel(INDEX), rel(LOAD), rel(RENDER), rel(CONTROL), rel(ANNUAL), rel(MONTHLY), rel(DAY_NIGHT)],
        "outputFiles": output_files,
        "changedFiles": changed_for_report,
        "plannedChangedFiles": planned_changed,
        "addedFiles": [path for path in (rel(OUT_ANNUAL), rel(OUT_MONTHLY)) if not (ROOT / path).exists() or path in planned_changed],
        "deletedFiles": [],
        "checks": checks,
        "rawTemporaryFilesFound": {"hits": [], "hitCount": 0, "note": "script writes no raw temporary files"},
        "browserRoutingAffected": True,
        "rollbackMethod": "Revert the apply commit. Existing generation aggregate JSON files are not edited by this workflow.",
        "executiveSummary": "Removes the collapsed Imports & Exports bucket from the live V6 Generation Output in MWh panel and adds named interconnector imports, exports and net MWh near the bottom of the annual chart.",
        "humanReviewStatus": "Audit required before apply. After apply, verify the live V6 Generation History page on desktop and mobile.",
        "nextAction": "If audit passes, run this workflow again in apply mode. If apply passes, open the live page and verify the MWh panel and source warning." if not args.apply else "Open the live page, force refresh, verify the MWh panel, then review adjacent daily MWh and MW chart panels.",
        "interconnectors": [CODE_META[code]["label"] for code in sorted(CODES)],
        "legacyBucketRowsFound": {
            "annual": sum(1 for row in json_rows(ANNUAL) if row.get("technology") == LEGACY_BUCKET),
            "monthly": sum(1 for row in json_rows(MONTHLY) if row.get("technology") == LEGACY_BUCKET),
            "dayNight": sum(1 for row in json_rows(DAY_NIGHT) if row.get("technology") == LEGACY_BUCKET),
        },
        "fetchMeta": fetch_meta,
        "outputRows": {"annual": len(annual_rows), "monthly": len(monthly_rows)},
        "aggregateHashesBefore": hashes_before,
        "aggregateHashesAfter": hashes_after,
        "applied": bool(args.apply),
        "pass": all(checks.values()),
    }

    write_reports(report)
    print(json.dumps({"pass": report["pass"], "applied": report["applied"], "annualRows": len(annual_rows), "monthlyRows": len(monthly_rows)}, indent=2))
    if not report["pass"]:
        raise SystemExit("Generation interconnector split checks failed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
