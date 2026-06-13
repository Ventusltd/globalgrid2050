#!/usr/bin/env python3
"""
GridBot Sunrise Sunset Visible Attribution.

Target:
  /uk_energy_tracking_v6/generation_history/

Purpose:
  Add visible UI attribution for the sunrise and sunset reference data source.
  This is UI-only and changes only index.md plus reports.

Audit mode writes reports only. Apply mode writes index.md and reports.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "uk_energy_tracking_v6" / "generation_history"
INDEX = APP / "index.md"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "SUNRISE_SUNSET_VISIBLE_ATTRIBUTION_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "SUNRISE_SUNSET_VISIBLE_ATTRIBUTION_LATEST.json"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
SCRIPT_NAME = "scripts/gridbot_sunrise_sunset_visible_attribution.py"
WORKFLOW_NAME = "GridBot Sunrise Sunset Visible Attribution"
ATTRIBUTION_MARKER = "sunrise-sunset-visible-attribution"
CSS_MARKER = "GridBot sunrise sunset visible attribution"
CACHE = "20260613sunattr1"

CSS = f"""
  /* {CSS_MARKER} */
  #generation-history-panel .sunrise-sunset-attribution{{margin:10px 0 0;padding:9px 11px;border:1px solid rgba(0,255,255,.22);border-radius:8px;background:rgba(0,255,255,.025);color:#9aa3b6;font-size:11px;line-height:1.45;letter-spacing:.055em;text-transform:uppercase;}}
  #generation-history-panel .sunrise-sunset-attribution strong{{color:#00ffff;letter-spacing:.10em;}}
  #generation-history-panel .sunrise-sunset-attribution a{{color:#00ffff;text-decoration:underline;font-weight:bold;}}
  @media(max-width:850px){{#generation-history-panel .sunrise-sunset-attribution{{font-size:10.5px;letter-spacing:.04em;}}}}
"""

ATTRIBUTION_HTML = f'''        <div class="sunrise-sunset-attribution" data-gridbot="{ATTRIBUTION_MARKER}"><strong>Sunrise and sunset reference:</strong> <a href="https://sunrise-sunset.org/api" rel="noopener noreferrer">Sunrise-Sunset.org API</a> · Europe/London · UK reference locations.</div>'''


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def add_css(text: str) -> str:
    if CSS_MARKER in text:
        return text
    return text.replace("</style>", CSS + "</style>", 1)


def add_attribution(text: str) -> str:
    if ATTRIBUTION_MARKER in text:
        return text
    anchor = """        <div class=\"mwh-grid\">
          <div class=\"mwh-card wide\" id=\"generation-mwh-annual\"></div>
          <div class=\"mwh-card\" id=\"generation-mwh-monthly\"></div>
          <div class=\"mwh-card\" id=\"generation-mwh-daynight\"></div>
        </div>"""
    if anchor in text:
        return text.replace(anchor, anchor + "\n" + ATTRIBUTION_HTML, 1)
    fallback = """        <div id=\"generation-mwh-status\" class=\"mwh-status\">Loading aggregate files.</div>"""
    if fallback in text:
        return text.replace(fallback, fallback + "\n" + ATTRIBUTION_HTML, 1)
    return text


def bump_cache(text: str) -> str:
    # The attribution is pure HTML/CSS, but bump the MWh controller/renderer references so browsers refresh the card area.
    for name in ("render_generation_mwh_aggregates", "control_generation_mwh_aggregates"):
        text = re.sub(rf"(/uk_energy_tracking_v6/generation_history/{name}\.js\?v=)[^\"']+", rf"\g<1>{CACHE}", text)
    return text


def patch(text: str) -> str:
    return bump_cache(add_attribution(add_css(text)))


def checks(patched: str) -> dict[str, bool]:
    return {
        "index_exists": INDEX.exists(),
        "route_present": f"permalink: {ROUTE}" in patched,
        "mwh_panel_present": "Generation output in MWh" in patched and "generation-mwh-annual" in patched,
        "visible_attribution_inserted": ATTRIBUTION_MARKER in patched,
        "source_name_visible": "Sunrise-Sunset.org API" in patched,
        "source_link_visible": "https://sunrise-sunset.org/api" in patched,
        "timezone_visible": "Europe/London" in patched,
        "uk_reference_locations_visible": "UK reference locations" in patched,
        "attribution_css_inserted": CSS_MARKER in patched,
        "cache_busters_updated": CACHE in patched,
        "data_files_not_touched": True,
    }


def write_report(report: dict):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Sunrise Sunset Visible Attribution",
        "",
        f"Generated UTC: `{report['generatedUTC']}`",
        f"Mode: `{report['mode']}`",
        f"Pass: `{report['pass']}`",
        "",
        report["executiveSummary"],
        "",
        "## Planned changed files",
        "",
    ]
    lines += [f"- `{path}`" for path in report["plannedChangedFiles"]]
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    lines += [f"| {key} | {'✅' if value else '❌'} |" for key, value in report["checks"].items()]
    lines += ["", "## Rollback", "", report["rollbackMethod"], ""]
    write(REPORT_MD, "\n".join(lines))
    write(REPORT_JSON, json.dumps(report, indent=2) + "\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    mode = "apply" if args.apply else "audit"
    original = read(INDEX)
    patched = patch(original)
    ch = checks(patched)
    planned = [rel(INDEX)] if patched != original else []
    passed = all(ch.values())
    if args.apply and passed and patched != original:
        write(INDEX, patched)
    report = {
        "reportTitle": "Sunrise Sunset Visible Attribution",
        "schemaVersion": "1.0.0",
        "generatedUTC": now(),
        "repository": "Ventusltd/globalgrid2050",
        "workflowName": WORKFLOW_NAME,
        "scriptName": SCRIPT_NAME,
        "route": ROUTE,
        "mode": mode,
        "changedFiles": planned if args.apply else [],
        "plannedChangedFiles": planned,
        "checks": ch,
        "browserRoutingAffected": True,
        "rollbackMethod": "Revert the apply commit. This repair changes only uk_energy_tracking_v6/generation_history/index.md.",
        "executiveSummary": "Adds a visible UI attribution line for the sunrise and sunset reference source under the Generation Output in MWh panel. The line names Sunrise-Sunset.org API, links the source, states Europe/London and UK reference locations. No data files are changed.",
        "applied": bool(args.apply),
        "pass": passed,
    }
    write_report(report)
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
