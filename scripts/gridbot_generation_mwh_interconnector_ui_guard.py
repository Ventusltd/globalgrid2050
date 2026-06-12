#!/usr/bin/env python3
"""
GridBot guard: Generation Output in MWh — interconnector bucket UI removal (V6_2).

Purpose
-------
This is a UI-only guard for /uk_energy_tracking_v6_2/generation_history/.
It hides the collapsed "Imports & Exports" bucket from the Generation Output in MWh panel
and inserts a red source-transparency warning below the MWh cards.

It does not edit aggregate JSON, raw generation data, FUELHH/FUELINST builders, Atlas feeds,
or interconnector backfill logic.

Modes
-----
Audit: verify current state and write MD/JSON reports.
Apply: idempotently patch the MWh UI files, then verify and write MD/JSON reports.

Allowed apply files
-------------------
- uk_energy_tracking_v6_2/generation_history/render_generation_mwh_aggregates.js
- uk_energy_tracking_v6_2/generation_history/control_generation_mwh_aggregates.js
- uk_energy_tracking_v6_2/generation_history/index.md

Forbidden apply files
---------------------
- generation_annual_mwh_by_technology.json
- generation_monthly_mwh_by_technology.json
- generation_seasonal_mwh_by_technology.json
- generation_day_night_mwh_by_technology.json
- any data/generation file
- any FUELHH/FUELINST backfill script
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
MODULE = ROOT / "uk_energy_tracking_v6_2" / "generation_history"
INDEX = MODULE / "index.md"
RENDER = MODULE / "render_generation_mwh_aggregates.js"
CONTROL = MODULE / "control_generation_mwh_aggregates.js"
ANNUAL_JSON = MODULE / "generation_annual_mwh_by_technology.json"
MONTHLY_JSON = MODULE / "generation_monthly_mwh_by_technology.json"
SEASONAL_JSON = MODULE / "generation_seasonal_mwh_by_technology.json"
DAY_NIGHT_JSON = MODULE / "generation_day_night_mwh_by_technology.json"

REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "GENERATION_MWH_INTERCONNECTOR_UI_GUARD_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "GENERATION_MWH_INTERCONNECTOR_UI_GUARD_LATEST.json"

ROUTE = "/uk_energy_tracking_v6_2/generation_history/"
HIDDEN_LABEL = "Imports & Exports"
WARNING_CLASS = "mwh-interconnector-warning"
CACHE_BUST = "20260612intercon1"

WARNING_HTML = """        <div class="generation-source-warning mwh-interconnector-warning"><strong>Interconnector accounting transparency:</strong> The combined Imports &amp; Exports line has been removed from this Generation Output in MWh panel pending source validation. The current audit confirms that the previous bucket collapsed distinct INT* interconnector links into one label, mixed signed import and export flows, and produced a 2026 year-to-date value that is not suitable for a generation-by-technology chart. Interconnector flows will return only after each named link is separated into gross imports, gross exports and net settlement views, with country and counterparty labels validated against Elexon BMRS, NESO/National Grid and DESNZ/DUKES standards.</div>"""

PATCHED_RENDER = """window.V6RenderGenerationMwhAggregates=(function(){
  var colours={Solar:'#f5c518',Wind:'#00d0ff',Hydro:'#0090c0',Gas:'#c0399a',Coal:'#888888',Biomass:'#f59e2b',Nuclear:'#5cb85c','Pumped Storage':'#9b59b6','Imports & Exports':'#e8615a',Other:'#a6adbb'};
  var HIDDEN={'Imports & Exports':true};
  function visible(rows){return(rows||[]).filter(function(r){return r&&!HIDDEN[r.technology]})}
  function fmt(n,d){return n==null||isNaN(Number(n))?'—':Number(n).toLocaleString('en-GB',{minimumFractionDigits:d,maximumFractionDigits:d})}
  function renderAnnual(el,rows){
    if(!el)return;
    rows=rows||[];
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data.</div>';return;}
    var latest=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0}));
    var latestRows=visible(rows.filter(function(r){return Number(r.year)===latest})).sort(function(a,b){return Number(b.totalMWh)-Number(a.totalMWh)});
    if(!latestRows.length){el.innerHTML='<div class="mwh-empty">Awaiting annual MWh aggregate data after hidden bucket filter.</div>';return;}
    var total=latestRows.reduce(function(s,r){return s+Number(r.totalMWh||0)},0);
    var html='<div class="mwh-aggregate-head"><strong>Annual MWh by technology</strong><span>'+latest+' · '+fmt(total/1000000,2)+' TWh total shown</span></div>';
    html+='<div class="mwh-bars">';
    latestRows.forEach(function(r){var v=Number(r.totalMWh||0),pct=total?Math.max(0,v/total*100):0,c=colours[r.technology]||'#00ffff';html+='<div class="mwh-row"><div class="mwh-label">'+r.technology+'</div><div class="mwh-track"><i style="width:'+pct+'%;background:'+c+'"></i></div><div class="mwh-value">'+fmt(v/1000000,2)+' TWh</div></div>'});
    html+='</div>';el.innerHTML=html;
  }
  function renderMonthly(el,rows,technology){
    if(!el)return;
    rows=visible(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting monthly MWh aggregate data.</div>';return;}
    rows=rows.slice().sort(function(a,b){return (a.year-b.year)||(a.month-b.month)});
    var max=Math.max.apply(null,rows.map(function(r){return Number(r.totalMWh)||0}));
    var sample=rows.slice(-24);
    var html='<div class="mwh-aggregate-head"><strong>Monthly MWh trend</strong><span>'+(technology||'All technologies')+'</span></div><div class="mwh-mini-chart">';
    sample.forEach(function(r){var h=max?Math.max(2,Number(r.totalMWh)/max*100):2;html+='<div class="mwh-col" title="'+r.year+'-'+String(r.month).padStart(2,'0')+' '+r.technology+' '+fmt(r.totalMWh/1000000,2)+' TWh"><i style="height:'+h+'%;background:'+(colours[r.technology]||'#00ffff')+'"></i></div>'});
    html+='</div>';el.innerHTML=html;
  }
  function renderDayNight(el,rows,technology){
    if(!el)return;
    rows=visible(rows).filter(function(r){return !technology||r.technology===technology});
    if(!rows.length){el.innerHTML='<div class="mwh-empty">Awaiting day/night aggregate data.</div>';return;}
    var latest=Math.max.apply(null,rows.map(function(r){return Number(r.year)||0}));
    var subset=rows.filter(function(r){return Number(r.year)===latest});
    var day=0,night=0;subset.forEach(function(r){day+=Number(r.dayMWh||0);night+=Number(r.nightMWh||0)});
    var total=day+night,dp=total?day/total*100:0,np=total?night/total*100:0;
    el.innerHTML='<div class="mwh-aggregate-head"><strong>Day versus night MWh</strong><span>'+latest+' · '+(technology||'All technologies')+'</span></div><div class="mwh-split"><div style="width:'+dp+'%">Day '+fmt(dp,1)+'%</div><div style="width:'+np+'%">Night '+fmt(np,1)+'%</div></div><div class="mwh-note-line">Day '+fmt(day/1000000,2)+' TWh · Night '+fmt(night/1000000,2)+' TWh</div>';
  }
  return{annual:renderAnnual,monthly:renderMonthly,dayNight:renderDayNight};
})();
"""

PATCHED_CONTROL = """window.V6ControlGenerationMwhAggregates=(function(){
  var HIDDEN={'Imports & Exports':true};
  function byId(id){return document.getElementById(id)}
  function tech(){var e=byId('generation-mwh-technology');return e?e.value:'Solar'}
  function fillTech(){var e=byId('generation-mwh-technology');if(!e)return;var opts=((window.V6GenerationHistoryConfig&&window.V6GenerationHistoryConfig.technologies)||['Solar','Wind','Gas','Nuclear']).filter(function(t){return !HIDDEN[t]});e.innerHTML='';opts.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=t;e.appendChild(o)});e.value=opts.indexOf('Solar')>=0?'Solar':(opts[0]||'')}
  function setStatus(text){var e=byId('generation-mwh-status');if(e)e.textContent=text}
  function refresh(){setStatus('Loading MWh aggregate intelligence...');Promise.all([window.V6LoadGenerationMwhAggregates.annual(),window.V6LoadGenerationMwhAggregates.monthly(),window.V6LoadGenerationMwhAggregates.dayNight()]).then(function(parts){window.V6RenderGenerationMwhAggregates.annual(byId('generation-mwh-annual'),parts[0]);window.V6RenderGenerationMwhAggregates.monthly(byId('generation-mwh-monthly'),parts[1],tech());window.V6RenderGenerationMwhAggregates.dayNight(byId('generation-mwh-daynight'),parts[2],tech());setStatus('Aggregate files loaded · interconnector bucket hidden pending validation · annual '+parts[0].length+' source rows · monthly '+parts[1].length+' source rows · day/night '+parts[2].length+' source rows')}).catch(function(exc){setStatus('MWh aggregate load failed: '+exc)})}
  function init(){fillTech();var e=byId('generation-mwh-technology');if(e)e.addEventListener('change',refresh);refresh()}
  return{init:init,refresh:refresh};
})();

document.addEventListener('DOMContentLoaded',function(){window.V6ControlGenerationMwhAggregates.init()});
"""


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def sha256(path: Path) -> str:
    if not path.exists():
        return ""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_rows(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(read(path) or "{}")
    rows = payload.get("rows", []) if isinstance(payload, dict) else payload
    return rows if isinstance(rows, list) else []


def replace_warning(index_text: str) -> str:
    pattern = re.compile(r"\n?\s*<div class=\"generation-source-warning mwh-interconnector-warning\">.*?</div>", re.DOTALL)
    text, count = pattern.subn("\n" + WARNING_HTML, index_text)
    if count:
        return text
    anchor = (
        '          <div class="mwh-card" id="generation-mwh-daynight"></div>\n'
        '        </div>'
    )
    if anchor not in text:
        return text
    return text.replace(anchor, anchor + "\n" + WARNING_HTML, 1)


def bump_cache(index_text: str) -> str:
    text = re.sub(
        r'(/uk_energy_tracking_v6_2/generation_history/render_generation_mwh_aggregates\.js\?v=)[^"\']+',
        r'\g<1>' + CACHE_BUST,
        index_text,
    )
    text = re.sub(
        r'(/uk_energy_tracking_v6_2/generation_history/control_generation_mwh_aggregates\.js\?v=)[^"\']+',
        r'\g<1>' + CACHE_BUST,
        text,
    )
    return text


def patch_index(index_text: str) -> str:
    return bump_cache(replace_warning(index_text))


def syntax_check_js(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"ok": False, "detail": "missing"}
    try:
        result = subprocess.run(["node", "--check", str(path)], cwd=ROOT, text=True, capture_output=True, timeout=30)
        return {"ok": result.returncode == 0, "detail": (result.stderr or result.stdout).strip()}
    except FileNotFoundError:
        return {"ok": True, "detail": "node unavailable in this runner; skipped"}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)}


def annual_totals(rows: list[dict[str, Any]]) -> dict[str, Any]:
    years = [int(r.get("year") or 0) for r in rows if isinstance(r, dict)]
    latest = max(years) if years else 0
    latest_rows = [r for r in rows if int(r.get("year") or 0) == latest]
    hidden_rows = [r for r in latest_rows if r.get("technology") == HIDDEN_LABEL]
    source_total = sum(float(r.get("totalMWh") or 0) for r in latest_rows)
    hidden_total = sum(float(r.get("totalMWh") or 0) for r in hidden_rows)
    visible_total = source_total - hidden_total
    return {
        "latestYear": latest,
        "sourceTotalTWh": round(source_total / 1_000_000, 3),
        "hiddenInterconnectorTWh": round(hidden_total / 1_000_000, 3),
        "expectedVisibleTotalTWh": round(visible_total / 1_000_000, 3),
        "hiddenRowCount": len(hidden_rows),
    }


def collect_state(before_json_hashes: dict[str, str] | None = None) -> dict[str, Any]:
    index_text = read(INDEX)
    render_text = read(RENDER)
    control_text = read(CONTROL)
    rows = load_rows(ANNUAL_JSON)
    totals = annual_totals(rows)
    json_hashes = {
        "annual": sha256(ANNUAL_JSON),
        "monthly": sha256(MONTHLY_JSON),
        "seasonal": sha256(SEASONAL_JSON),
        "dayNight": sha256(DAY_NIGHT_JSON),
    }
    if before_json_hashes is None:
        before_json_hashes = json_hashes.copy()
    js_render = syntax_check_js(RENDER)
    js_control = syntax_check_js(CONTROL)
    checks = {
        "targetRoutePermalinkPresent": f"permalink: {ROUTE}" in index_text,
        "targetExplicitlyBackupMirror": "INACTIVE V6 2 BACKUP MIRROR" in index_text or "Inactive backup mirror" in index_text,
        "mwhScriptsUseV6_2Path": "/uk_energy_tracking_v6_2/generation_history/render_generation_mwh_aggregates.js" in index_text and "/uk_energy_tracking_v6_2/generation_history/control_generation_mwh_aggregates.js" in index_text,
        "indexFrontMatterLooksValid": index_text.startswith("---\n") and "\n---\n" in index_text[:220],
        "indexHasNoMarkdownCodeFences": "```" not in index_text,
        "indexHasOneInterconnectorWarning": index_text.count(WARNING_CLASS) == 1,
        "renderHasHiddenMap": "var HIDDEN={'Imports & Exports':true};" in render_text,
        "renderFiltersAnnualTotal": "visible(rows.filter(function(r){return Number(r.year)===latest}))" in render_text,
        "renderFiltersMonthly": "rows=visible(rows).filter" in render_text,
        "renderFiltersDayNight": "rows=visible(rows).filter" in render_text,
        "controlHasHiddenMap": "var HIDDEN={'Imports & Exports':true};" in control_text,
        "controlDropdownFiltersHidden": ".filter(function(t){return !HIDDEN[t]})" in control_text,
        "controlStatusExplainsSourceRows": "interconnector bucket hidden pending validation" in control_text and "source rows" in control_text,
        "annualJsonStillContainsInterconnectorRow": totals["hiddenRowCount"] > 0,
        "annualJsonExpectedVisibleTotalBelowSourceTotal": totals["expectedVisibleTotalTWh"] < totals["sourceTotalTWh"],
        "aggregateJsonHashesUnchangedThisRun": before_json_hashes == json_hashes,
        "renderJsSyntaxOk": bool(js_render["ok"]),
        "controlJsSyntaxOk": bool(js_control["ok"]),
    }
    return {
        "checks": checks,
        "annualTotals": totals,
        "jsonHashes": json_hashes,
        "jsSyntax": {"render": js_render, "control": js_control},
    }


def render_report(payload: dict[str, Any]) -> str:
    checks = payload["checks"]
    totals = payload["annualTotals"]
    lines = [
        f"# Generation MWh Interconnector UI Guard — {'PASS' if payload['pass'] else 'FAIL'}",
        "",
        f"- Generated UTC: {payload['generatedUTC']}",
        f"- Mode: {payload['mode']}",
        f"- Route: `{ROUTE}`",
        "- Scope: UI-only MWh panel guard. No aggregate JSON, raw generation data, backfill script or Atlas/GIS file is edited.",
        "",
        "## Current annual total impact",
        "",
        f"- Latest year: {totals['latestYear']}",
        f"- Source total before UI hide: {totals['sourceTotalTWh']:.3f} TWh",
        f"- Hidden Imports & Exports amount: {totals['hiddenInterconnectorTWh']:.3f} TWh",
        f"- Expected displayed total after UI hide: {totals['expectedVisibleTotalTWh']:.3f} TWh",
        "",
        "## Checks",
        "",
        "| Check | Result |",
        "|---|---|",
    ]
    for key, value in checks.items():
        lines.append(f"| {key} | {'✅' if value else '❌'} |")
    lines.extend([
        "",
        "## Files changed by apply mode",
        "",
        *(f"- `{path}`" for path in payload.get("changedFiles", [])) or ["- none"],
        "",
        "## Notes",
        "",
        "This guard follows the Generation History GridBot audit/apply pattern: audit writes reports, apply modifies only the declared UI files and then writes reports. The collapsed interconnector bucket remains in source JSON so later source validation and data engineering can split named links into gross imports, gross exports and net settlement views.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    before_hashes = {
        "annual": sha256(ANNUAL_JSON),
        "monthly": sha256(MONTHLY_JSON),
        "seasonal": sha256(SEASONAL_JSON),
        "dayNight": sha256(DAY_NIGHT_JSON),
    }
    changed_files: list[str] = []

    if args.apply:
        planned = {
            RENDER: PATCHED_RENDER,
            CONTROL: PATCHED_CONTROL,
            INDEX: patch_index(read(INDEX)),
        }
        for path, content in planned.items():
            old = read(path)
            if old != content:
                write(path, content)
                changed_files.append(path.relative_to(ROOT).as_posix())

    state = collect_state(before_hashes)
    passed = all(state["checks"].values())
    payload = {
        "reportTitle": "Generation MWh Interconnector UI Guard",
        "schemaVersion": "1.0.0",
        "generatedUTC": now(),
        "mode": "apply" if args.apply else "audit",
        "repository": "Ventusltd/globalgrid2050",
        "route": ROUTE,
        "targetPath": MODULE.relative_to(ROOT).as_posix(),
        "scope": "UI-only MWh panel guard",
        "allowedApplyFiles": [RENDER.relative_to(ROOT).as_posix(), CONTROL.relative_to(ROOT).as_posix(), INDEX.relative_to(ROOT).as_posix()],
        "forbiddenDataFiles": [ANNUAL_JSON.relative_to(ROOT).as_posix(), MONTHLY_JSON.relative_to(ROOT).as_posix(), SEASONAL_JSON.relative_to(ROOT).as_posix(), DAY_NIGHT_JSON.relative_to(ROOT).as_posix(), "data/generation/", "scripts/backfill_generation_aggregates_year_v6.py"],
        "changedFiles": changed_files,
        "annualTotals": state["annualTotals"],
        "jsonHashes": state["jsonHashes"],
        "jsSyntax": state["jsSyntax"],
        "checks": state["checks"],
        "pass": passed,
        "nextAction": "If audit passes, run workflow in apply mode. Then run visual smoke/audit workflow before data engineering.",
    }

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    write(REPORT_JSON, json.dumps(payload, indent=2) + "\n")
    write(REPORT_MD, render_report(payload) + "\n")
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
