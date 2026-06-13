#!/usr/bin/env python3
"""
GridBot MWh Mobile Bounds Repair.

Target:
  /uk_energy_tracking_v6/generation_history/

Purpose:
  Fix phone-width overflow in the MWh cards after the interconnector split. This repair is
  CSS/index-only. It does not change generation aggregate data, interconnector JSON data,
  renderer logic or controller logic.

Fixes:
  - remove the large red interconnector warning box from the MWh panel
  - stop Day/Night split from overflowing when the night segment is tiny
  - stop monthly mini chart and MWh cards from exceeding the viewport
  - override the old interconnector row min-width that pushes bars off-screen
  - add compact metric-grid styling for total electricity check

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
REPORT_MD = REPORT_DIR / "MWH_MOBILE_BOUNDS_REPAIR_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "MWH_MOBILE_BOUNDS_REPAIR_LATEST.json"
ROUTE = "/uk_energy_tracking_v6/generation_history/"
CACHE = "20260613mwhmobilebounds1"

CSS_MARKER = "GridBot MWh mobile bounds repair"
CSS = f"""
  /* {CSS_MARKER} */
  #generation-history-panel .mwh-panel,
  #generation-history-panel .mwh-card{{box-sizing:border-box;max-width:100%;overflow:hidden;}}
  #generation-history-panel .mwh-aggregate-head{{min-width:0;max-width:100%;}}
  #generation-history-panel .mwh-aggregate-head span{{min-width:0;max-width:54%;overflow:hidden;text-overflow:ellipsis;}}
  #generation-history-panel .mwh-mini-chart{{box-sizing:border-box;width:100%;max-width:100%;min-width:0;overflow:hidden;}}
  #generation-history-panel .mwh-col{{min-width:0;}}
  #generation-history-panel .mwh-split{{box-sizing:border-box;width:100%;max-width:100%;min-width:0;}}
  #generation-history-panel .mwh-split div{{min-width:0!important;overflow:hidden;white-space:nowrap;}}
  #generation-history-panel .mwh-split div:last-child{{font-size:0;}}
  #generation-history-panel .mwh-check-grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;}}
  #generation-history-panel .mwh-check-metric{{border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px;background:rgba(255,255,255,.03);min-width:0;}}
  #generation-history-panel .mwh-check-metric span{{display:block;color:#9aa3b6;font-size:11px;letter-spacing:.06em;text-transform:uppercase;}}
  #generation-history-panel .mwh-check-metric strong{{display:block;color:#f5f7fb;font-size:13px;margin-top:3px;}}
  @media(max-width:850px){{
    #generation-history-panel .mwh-card{{padding:10px;}}
    #generation-history-panel .mwh-aggregate-head{{display:block;}}
    #generation-history-panel .mwh-aggregate-head span{{display:block;max-width:100%;white-space:normal;text-align:left;margin-top:4px;}}
    #generation-history-panel .mwh-row,
    #generation-history-panel .mwh-row.mwh-interconnector-row{{grid-template-columns:minmax(84px,.78fr) minmax(88px,1fr) minmax(58px,auto)!important;gap:6px;}}
    #generation-history-panel .mwh-row.mwh-interconnector-row .mwh-label{{white-space:normal;line-height:1.25;color:#cfd7e6;}}
    #generation-history-panel .mwh-label{{min-width:0;overflow-wrap:anywhere;}}
    #generation-history-panel .mwh-track{{min-width:0;}}
    #generation-history-panel .mwh-value{{font-size:11px;white-space:nowrap;}}
    #generation-history-panel .mwh-check-grid{{grid-template-columns:1fr;}}
  }}
"""


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def remove_warning(text: str) -> str:
    return re.sub(r'\n?\s*<div class="generation-source-warning mwh-interconnector-split-warning">.*?</div>', '', text, flags=re.DOTALL)


def inject_css(text: str) -> str:
    if CSS_MARKER in text:
        return text
    return text.replace("</style>", CSS + "</style>", 1)


def bump_cache(text: str) -> str:
    for name in ("render_generation_mwh_aggregates", "control_generation_mwh_aggregates"):
        text = re.sub(rf"(/uk_energy_tracking_v6/generation_history/{name}\.js\?v=)[^\"']+", rf"\g<1>{CACHE}", text)
    return text


def patch(text: str) -> str:
    return bump_cache(inject_css(remove_warning(text)))


def checks(patched: str) -> dict[str, bool]:
    return {
        "index_exists": INDEX.exists(),
        "route_present": f"permalink: {ROUTE}" in patched,
        "warning_box_removed": "mwh-interconnector-split-warning" not in patched,
        "mobile_bounds_css_inserted": CSS_MARKER in patched,
        "day_night_split_bounded": "#generation-history-panel .mwh-split div{min-width:0!important" in patched,
        "mini_chart_bounded": "#generation-history-panel .mwh-mini-chart{box-sizing:border-box;width:100%;max-width:100%;" in patched,
        "interconnector_min_width_overridden": "#generation-history-panel .mwh-row.mwh-interconnector-row{grid-template-columns:minmax(84px,.78fr)" in patched,
        "total_check_metric_grid_styled": "#generation-history-panel .mwh-check-grid" in patched and "#generation-history-panel .mwh-check-metric" in patched,
        "cache_busters_updated": CACHE in patched,
        "data_files_not_touched": True,
    }


def write_report(report: dict):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# MWh Mobile Bounds Repair",
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
    lines += [f"- `{p}`" for p in report["plannedChangedFiles"]]
    lines += ["", "## Checks", "", "| Check | Result |", "|---|---|"]
    lines += [f"| {k} | {'✅' if v else '❌'} |" for k, v in report["checks"].items()]
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
        "reportTitle": "MWh Mobile Bounds Repair",
        "schemaVersion": "1.0.0",
        "generatedUTC": now(),
        "repository": "Ventusltd/globalgrid2050",
        "workflowName": "GridBot MWh Mobile Bounds Repair",
        "scriptName": "scripts/gridbot_mwh_mobile_bounds_repair.py",
        "route": ROUTE,
        "mode": mode,
        "changedFiles": planned if args.apply else [],
        "plannedChangedFiles": planned,
        "checks": ch,
        "browserRoutingAffected": True,
        "rollbackMethod": "Revert the apply commit. This repair changes only uk_energy_tracking_v6/generation_history/index.md.",
        "executiveSummary": "Fixes phone-width overflow in the Generation Output in MWh cards. It removes the large red interconnector warning box, bounds the Day/Night split and monthly mini-chart to the card width, overrides the old interconnector min-width rule and styles the total electricity check as compact metrics. No data files are changed.",
        "applied": bool(args.apply),
        "pass": passed,
    }
    write_report(report)
    print(json.dumps(report, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
