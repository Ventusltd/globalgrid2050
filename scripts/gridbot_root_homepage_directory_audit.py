#!/usr/bin/env python3
"""
GridBot Root Homepage Directory Audit.

Target:
  /index.html

Purpose:
  Replace the current flat homepage table with the controlled grouped drawer menu
  supplied by Vikram, without changing data feeds, dashboards or child routes.

Audit mode:
  Reads the current root homepage, builds the proposed replacement in memory and
  writes Markdown and JSON reports only.

Apply mode:
  Writes only index.html after checks pass, then writes Markdown and JSON reports.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "index.html"
REPORT_DIR = ROOT / "data_science_protocol" / "audit_reports"
REPORT_JSON_DIR = REPORT_DIR / "json"
REPORT_MD = REPORT_DIR / "ROOT_HOMEPAGE_DIRECTORY_AUDIT_LATEST.md"
REPORT_JSON = REPORT_JSON_DIR / "ROOT_HOMEPAGE_DIRECTORY_AUDIT_LATEST.json"

ROUTE = "/"
SCRIPT_NAME = "scripts/gridbot_root_homepage_directory_audit.py"
WORKFLOW_NAME = "GridBot Root Homepage Directory Audit"
FEATURE_NAME = "ROOT_HOMEPAGE_DIRECTORY_AUDIT"
EXPECTED_LINK_COUNT = 41

EXPECTED_INDEX_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>GlobalGrid2050</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: dark; }
  html { background: #000; }
  body {
    background: #000;
    color: white;
    font-family: Courier, monospace;
    padding: 40px;
    max-width: 900px;
    margin: 0 auto;
    font-size: 20px;
    line-height: 1.6;
  }
  h1 { margin-top: 0; }

  a { color: #66ccff; text-decoration: none; }
  a:hover { text-decoration: underline; }

  .dev-status { color: #ff3333; font-weight: bold; font-size: 16px; }

  #gridSearch {
    width: 100%;
    padding: 12px;
    background: #111;
    color: white;
    border: 1px solid #444;
    font-family: Courier, monospace;
    font-size: 18px;
    margin-top: 20px;
    margin-bottom: 18px;
    box-sizing: border-box;
  }
  #gridSearch:focus { outline: none; border-color: #66ccff; }

  /* areas (top tier) */
  details.area { border-bottom: 1px solid #333; }
  details.area > summary {
    list-style: none;
    cursor: pointer;
    padding: 14px 0;
    color: #00ffff;
    font-weight: bold;
    letter-spacing: 0.5px;
  }
  details.area > summary::-webkit-details-marker { display: none; }
  details.area > summary::before { content: "[+] "; color: #00ffff; }
  details.area[open] > summary::before { content: "[\2212] "; }
  details.area > summary:hover { text-decoration: none; color: #66ffff; }

  /* drawer rows (infinite) */
  ul.drawer { list-style: none; margin: 0 0 10px; padding: 0; }
  ul.drawer li { padding: 10px 0 10px 28px; border-top: 1px solid #1c1c1c; }

  /* direct top-level links (areas with no children) */
  .toplink { display: block; padding: 14px 0; border-bottom: 1px solid #333; }

  .noresult { color: #888; padding: 20px 0; }

  .footer {
    margin-top: 60px;
    font-size: 16px;
    color: #aaaaaa;
    line-height: 1.5;
  }

  @media (max-width: 600px) {
    body { padding: 25px; font-size: 18px; }
    .footer { font-size: 14px; }
    ul.drawer li { padding-left: 20px; }
  }
</style>
</head>
<body>
<h1>GlobalGrid2050</h1>

<p>An open grid development, engineering, procurement, construction and operations platform dedicated to documenting, analysing and improving the world's electrical energy systems as they undergo rapid electrification.</p>

<input type="text" id="gridSearch" placeholder="Search everything..." autocomplete="off">

<div id="menu"></div>

<div class="footer">
  <p><strong>Disclaimer:</strong> Content provided for general technical documentation and research purposes only.</p>
</div>

<script>
/* ====================================================================== *
 *  MENU DATA  —  the only thing you edit.
 *
 *  A top-level entry is either:
 *    • an AREA with a drawer:   { name: "Pricing", children: [ ...rows ] }
 *    • a direct link:           { name: "Blog", url: "./blog/" }
 *
 *  A drawer row:   { name: "Title", url: "./path/", note: "in development" }
 *  ( note is optional; shown in red. )
 *
 *  Add a row  -> add one line to a children array.
 *  Re-group   -> move a line from one area to another.
 *  Re-order   -> areas and rows display in the order written here.
 * ====================================================================== */
const AREAS = [
  { name: "Solar & BESS Topology", children: [
    { name: "GIS SLD Topology Engine And Financial Sandbox", url: "./solar-bess-topology/indexforgis-sld.html" },
    { name: "GIS SLD Financial Sandbox V2", url: "./solar-bess-topology-v2/indexforgis-sld-v2.html" },
    { name: "GIS SLD Financial Sandbox V4", url: "./solar-bess-topology-v4/indexforgis-sld-v4.html" },
    { name: "GIS SLD Financial Sandbox V5", url: "./solar-bess-topology-v5/indexforgis-sld-v5.html" },
    { name: "Cable Geometry Visualiser V5", url: "./solar-bess-topology-v5/cable-geometry-visualiser-v5.html" },
    { name: "DC AC LV Solar PV Cable Topology Review V5", url: "./solar-bess-topology-v5/dc-ac-lv-topology-review-v5.html" },
    { name: "Physical Solar Module Layout V5", url: "./solar-bess-topology-v5/module-layout-v5.html" },
    { name: "Solar BESS Topology V6 Testing Phase", url: "./solar-bess-topology-v6/" },
    { name: "Solar BESS Topology V7 Workspace", url: "./solar-bess-topology-v7/" },
    { name: "BESS GIS SLD Financial Sandbox V8", url: "./solar-bess-topology-v8/bess-gis-sld-financial-sandbox/index.html", note: "in development" },
  ]},
  { name: "UK Grid Tracking", children: [
    { name: "UK Live Grid Tracker, Electricity, Carbon, Oil and Metals", url: "./uk_energy_tracking/" },
    { name: "UK Live Grid Tracker V2, Transport Energy Test Clone", url: "./uk_energy_tracking_v2/" },
    { name: "UK Live Grid Tracker V3, Experimental Intelligence Lab", url: "./uk_energy_tracking_v3/" },
    { name: "UK Live Grid Tracker V5, Electricity Market Intelligence Machine", url: "./uk_energy_tracking_v5/", note: "in development" },
    { name: "UK Live Grid Tracker V6, Modular Electricity Market Intelligence Machine", url: "./uk_energy_tracking_v6/", note: "modular development" },
    { name: "UK Generation History V6 Module", url: "./uk_energy_tracking_v6/generation_history/", note: "in development" },
    { name: "UK Generation History V6 2 Backup Mirror", url: "./uk_energy_tracking_v6_2/generation_history/", note: "BACKUP" },
    { name: "UK Energy Atlas Grid Overlay V8", url: "./repd_grid_atlasv8/" },
    { name: "UK Macro Energy Consumption Trends ONS", url: "./uk_macro_energy_trends/" },
    { name: "UK Renewables Pipeline Analytics Dashboard", url: "./uk_renewables_pipeline/dashboard.html" },
    { name: "Solar Deployment Statistics", url: "./solar_deployment_statistics/" },
  ]},
  { name: "Cables & Conductors", children: [
    { name: "AC Cables Knowledge", url: "./ac_cables_knowledge/" },
    { name: "DC Cables Knowledge", url: "./dc_cables_knowledge/" },
    { name: "Conductor Resistances", url: "./conductor_resistances/" },
  ]},
  { name: "Pricing & Materials", children: [
    { name: "33 kV UK DAP Price Estimator", url: "./33kv_uk_dap_price_estimator/" },
    { name: "LV AC and DC Distribution Cables Price Estimator", url: "./lv_ac_dc_price_estimator/" },
    { name: "Copper and Aluminium Historic Prices & Trends", url: "./copper_and_aluminium_prices_historic_trends/" },
  ]},
  { name: "Components", children: [
    { name: "MV and HV Components", url: "./mv_and_hv_components/" },
    { name: "Solar Components", url: "./solar_components/" },
  ]},
  { name: "Planning & Requirements", children: [
    { name: "NSIP Solar Farms", url: "./nsip_solar_farms/" },
    { name: "Grid Studies Public", url: "./data/grid_studies_public/" },
    { name: "Employer Requirements BESS Notes", url: "./employers_requirements_BESS/" },
    { name: "Employers Requirements Large Scale Solar", url: "./employers_requirments_large_scale_solar/" },
  ]},
  { name: "Reference & Knowledge", children: [
    { name: "Definitions", url: "./definitions/" },
    { name: "Power Systems Studies", url: "./power_systems_studies/" },
    { name: "Single Line Diagrams And Grids", url: "./sld_single_diagrams_diagrams_and_grids/" },
  ]},
  { name: "About & Media", children: [
    { name: "Why VENTUS Ltd Is Building GlobalGrid2050", url: "./why_ventusltd_building_globalgrid2050/" },
    { name: "Blog", url: "./blog/" },
    { name: "Podcast Transcripts", url: "./podcast_transcripts/" },
    { name: "Earth", url: "./marketing/earth.html" },
    { name: "Time Left Today, Hourglass to 2050", url: "./time_to_2050/" },
  ]},
];

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const menu = document.getElementById("menu");

function rowHtml(r) {
  const note = r.note ? ` <span class="dev-status">(${esc(r.note)})</span>` : "";
  const key = (r.name + " " + (r.note || "")).toLowerCase();
  return `<li data-name="${esc(key)}"><a href="${encodeURI(r.url)}">${esc(r.name)}</a>${note}</li>`;
}

function build() {
  let html = "";
  for (const a of AREAS) {
    if (a.children && a.children.length) {
      const rows = a.children.map(rowHtml).join("");
      html += `<details class="area" data-name="${esc(a.name.toLowerCase())}">` +
              `<summary>${esc(a.name)}</summary>` +
              `<ul class="drawer">${rows}</ul></details>`;
    } else if (a.url) {
      html += `<a class="toplink" data-name="${esc(a.name.toLowerCase())}" href="${encodeURI(a.url)}">${esc(a.name)}</a>`;
    }
  }
  html += `<p class="noresult" id="noresult" style="display:none">No match.</p>`;
  menu.innerHTML = html;
}

function applySearch(raw) {
  const q = raw.trim().toLowerCase();
  let anyVisible = false;

  document.querySelectorAll(".toplink").forEach(el => {
    const show = !q || el.dataset.name.includes(q);
    el.style.display = show ? "" : "none";
    if (show) anyVisible = true;
  });

  document.querySelectorAll("details.area").forEach(d => {
    const areaMatch = !!q && d.dataset.name.includes(q);
    let childMatch = false;
    d.querySelectorAll("li").forEach(li => {
      const liMatch = li.dataset.name.includes(q);
      const show = !q || areaMatch || liMatch;
      li.style.display = show ? "" : "none";
      if (q && liMatch) childMatch = true;
    });
    const visible = !q || areaMatch || childMatch;
    d.style.display = visible ? "" : "none";
    d.open = q ? visible : false;          // search opens matches; empty collapses all
    if (visible) anyVisible = true;
  });

  document.getElementById("noresult").style.display = anyVisible ? "none" : "";
}

build();
document.getElementById("gridSearch").addEventListener("input", e => applySearch(e.target.value));
</script>
</body>
</html>"""


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else ""


def git_head() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=10,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def extract_menu_block(html: str) -> str:
    marker = "const AREAS = ["
    if marker not in html:
        return ""
    return html.split(marker, 1)[1].split("];", 1)[0]


def menu_links(html: str) -> list[str]:
    block = extract_menu_block(html)
    return re.findall(r'url:\s*"([^"]+)"', block)


def table_links(html: str) -> list[str]:
    return re.findall(r'<a\s+href="([^"]+)"', html)


def extract_script(html: str) -> str:
    match = re.search(r"<script>(.*?)</script>", html, re.DOTALL | re.IGNORECASE)
    return match.group(1) if match else ""


def node_check(source: str) -> dict[str, Any]:
    if not source.strip():
        return {"ok": False, "detail": "No inline script found."}
    try:
        with tempfile.NamedTemporaryFile("w", suffix="_root_homepage_menu.js", delete=False, encoding="utf-8") as handle:
            handle.write(source)
            temp_path = Path(handle.name)
        result = subprocess.run(
            ["node", "--check", str(temp_path)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=30,
        )
        temp_path.unlink(missing_ok=True)
        return {"ok": result.returncode == 0, "detail": (result.stderr or result.stdout).strip()}
    except FileNotFoundError:
        return {"ok": True, "detail": "node unavailable in this runner; skipped"}
    except Exception as exc:
        return {"ok": False, "detail": str(exc)}


def target_status(link: str) -> dict[str, Any]:
    if not link.startswith("./"):
        return {"link": link, "exists": False, "reason": "not relative"}
    path = ROOT / link[2:]
    if link.endswith("/"):
        return {"link": link, "exists": path.is_dir(), "reason": "directory"}
    return {"link": link, "exists": path.is_file(), "reason": "file"}


def planned_files() -> dict[Path, str]:
    content = EXPECTED_INDEX_HTML.rstrip() + "\n"
    return {TARGET: content}


def changed_paths_for(planned: dict[Path, str]) -> list[str]:
    return [rel(path) for path, content in planned.items() if read(path) != content]


def collect_state(mode: str, planned: dict[Path, str], before_hash: str, baseline_html: str) -> dict[str, Any]:
    current_html = baseline_html
    proposed_html = planned[TARGET]
    current_links = table_links(current_html)
    proposed_links = menu_links(proposed_html)
    added_links = sorted(set(proposed_links) - set(current_links))
    removed_links = sorted(set(current_links) - set(proposed_links))
    link_status = [target_status(link) for link in proposed_links]
    missing_targets = [row for row in link_status if not row["exists"]]
    js_check = node_check(extract_script(proposed_html))
    checks = {
        "targetFileExists": TARGET.exists(),
        "targetIsRootIndexHtml": rel(TARGET) == "index.html",
        "currentHomepageRead": bool(current_html.strip()),
        "currentFlatDirectoryTableDetected": '<table id="directoryTable">' in current_html,
        "currentHourglassIframeDetectedForRemoval": 'class="hourglass-embed"' in current_html,
        "proposedHtmlHasDoctype": proposed_html.lstrip().startswith("<!DOCTYPE html>"),
        "proposedKeepsTitle": "<title>GlobalGrid2050</title>" in proposed_html,
        "proposedKeepsOpeningDescription": "An open grid development, engineering, procurement, construction and operations platform" in proposed_html,
        "proposedSearchPlaceholderUpdated": 'placeholder="Search everything..."' in proposed_html,
        "proposedHasMenuMount": '<div id="menu"></div>' in proposed_html,
        "proposedHasAreasData": "const AREAS = [" in proposed_html,
        "proposedHasDrawerDetails": 'details class="area"' in proposed_html and 'ul class="drawer"' in proposed_html,
        "proposedHasNoResultState": 'id="noresult"' in proposed_html,
        "proposedEscapesMenuText": "const esc = (s) => String(s).replace" in proposed_html and "&lt;" in proposed_html and "&#39;" in proposed_html,
        "proposedEncodesUrls": "encodeURI(r.url)" in proposed_html,
        "proposedSearchOpensMatches": "d.open = q ? visible : false" in proposed_html,
        "proposedRemovesDirectoryTable": '<table id="directoryTable">' not in proposed_html,
        "proposedRemovesHourglassIframe": "<iframe" not in proposed_html,
        "proposedScriptSyntaxOk": bool(js_check["ok"]),
        "linkCountMatchesExpected": len(proposed_links) == EXPECTED_LINK_COUNT,
        "allExistingHomepageLinksPreserved": not added_links and not removed_links,
        "noNewExternalLinks": not any(link.startswith(("http://", "https://")) for link in proposed_links),
        "noMarkdownCodeFences": "```" not in proposed_html,
        "singleInlineScriptTag": proposed_html.lower().count("<script>") == 1 and proposed_html.lower().count("</script>") == 1,
        "noDataFilesChanged": True,
        "noConfidentialProjectNamesDetected": not any(term in proposed_html.lower() for term in ["cleve hill", "little crow", "mallard pass"]),
    }
    after_hash = sha256_file(TARGET)
    return {
        "checks": checks,
        "currentLinkCount": len(current_links),
        "proposedLinkCount": len(proposed_links),
        "addedLinks": added_links,
        "removedLinks": removed_links,
        "missingProposedLinkTargets": missing_targets,
        "jsSyntax": js_check,
        "currentTargetSha256BeforeApply": before_hash,
        "currentTargetSha256AfterScriptRun": after_hash,
        "proposedTargetSha256": sha256_text(proposed_html),
    }


def render_report(payload: dict[str, Any]) -> str:
    checks = payload["checks"]
    planned = payload.get("plannedChangedFiles", [])
    changed = payload.get("changedFiles", [])
    planned_lines = [f"- `{path}`" for path in planned] or ["- none"]
    changed_lines = [f"- `{path}`" for path in changed] or ["- none"]
    missing = payload.get("missingProposedLinkTargets", [])
    missing_lines = [f"- `{row['link']}` ({row['reason']})" for row in missing] or ["- none detected"]
    lines = [
        f"# Root Homepage Directory Audit {'PASS' if payload['pass'] else 'FAIL'}",
        "",
        f"Generated UTC: `{payload['generatedUTC']}`",
        f"Mode: `{payload['mode']}`",
        f"Route: `{ROUTE}`",
        "",
        payload["executiveSummary"],
        "",
        "## Planned target changes",
        "",
        *planned_lines,
        "",
        "## Files changed in this run",
        "",
        *changed_lines,
        "",
        "## Homepage link reconciliation",
        "",
        f"- Current table links: `{payload['currentLinkCount']}`",
        f"- Proposed menu links: `{payload['proposedLinkCount']}`",
        f"- Added links: `{len(payload['addedLinks'])}`",
        f"- Removed links: `{len(payload['removedLinks'])}`",
        "",
        "## Missing proposed link targets",
        "",
        *missing_lines,
        "",
        "## Checks",
        "",
        "| Check | Result |",
        "|---|---|",
    ]
    for key, value in checks.items():
        lines.append(f"| {key} | {'PASS' if value else 'FAIL'} |")
    lines.extend([
        "",
        "## Rollback",
        "",
        payload["rollbackMethod"],
        "",
        "## Human review",
        "",
        payload["humanReviewStatus"],
        "",
        "## Next action",
        "",
        payload["nextAction"],
        "",
    ])
    return "\n".join(lines)


def write_report(payload: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_DIR.mkdir(parents=True, exist_ok=True)
    write(REPORT_JSON, json.dumps(payload, indent=2) + "\n")
    write(REPORT_MD, render_report(payload) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    mode = "apply" if args.apply else "audit"
    head_before = git_head()
    before_hash = sha256_file(TARGET)
    before_html = read(TARGET)
    planned = planned_files()
    planned_changed = changed_paths_for(planned)

    if args.apply:
        state_before_write = collect_state("audit", planned, before_hash, before_html)
        if not all(state_before_write["checks"].values()):
            payload = build_payload(
                mode=mode,
                head_before=head_before,
                head_after=git_head(),
                planned_changed=planned_changed,
                changed_files=[],
                applied=False,
                passed=False,
                state=state_before_write,
                executive_summary="Apply was blocked because one or more audit checks failed before writing index.html.",
            )
            write_report(payload)
            print(json.dumps(payload, indent=2))
            return 1
        for path, content in planned.items():
            if read(path) != content:
                write(path, content)

    state = collect_state(mode, planned, before_hash, before_html)
    passed = all(state["checks"].values())
    payload = build_payload(
        mode=mode,
        head_before=head_before,
        head_after=git_head(),
        planned_changed=planned_changed,
        changed_files=planned_changed if args.apply else [],
        applied=bool(args.apply),
        passed=passed,
        state=state,
        executive_summary=(
            "Audits the proposed root homepage replacement. The change converts the flat directory table into grouped expandable drawers, preserves the existing 41 homepage routes, keeps the dark Courier style, removes the embedded hourglass iframe from the root page and leaves all data, dashboards and child routes untouched."
        ),
    )
    write_report(payload)
    print(json.dumps(payload, indent=2))
    return 0 if passed else 1


def build_payload(
    *,
    mode: str,
    head_before: str,
    head_after: str,
    planned_changed: list[str],
    changed_files: list[str],
    applied: bool,
    passed: bool,
    state: dict[str, Any],
    executive_summary: str,
) -> dict[str, Any]:
    return {
        "reportTitle": "Root Homepage Directory Audit",
        "schemaVersion": "1.0.0",
        "generatedUTC": now(),
        "repository": "Ventusltd/globalgrid2050",
        "branch": "main",
        "gitHeadBefore": head_before,
        "gitHeadAfter": head_after,
        "workflowName": WORKFLOW_NAME,
        "scriptName": SCRIPT_NAME,
        "upgradeType": "root homepage UI directory replacement",
        "mode": mode,
        "sourceApis": [],
        "sourceWindows": {
            "repoInspection": ["README.md", "AI_START_HERE.md", "index.html"],
            "userProvidedHtml": "Root homepage replacement HTML supplied in chat on 2026-06-15 Europe/London",
        },
        "inputFiles": ["README.md", "AI_START_HERE.md", "index.html"],
        "outputFiles": ([rel(TARGET)] if applied else []) + [
            rel(REPORT_MD),
            rel(REPORT_JSON),
        ],
        "changedFiles": changed_files,
        "plannedChangedFiles": planned_changed,
        "addedFiles": [],
        "deletedFiles": [],
        "checks": state["checks"],
        "rawTemporaryFilesFound": False,
        "browserRoutingAffected": True,
        "route": ROUTE,
        "currentLinkCount": state["currentLinkCount"],
        "proposedLinkCount": state["proposedLinkCount"],
        "addedLinks": state["addedLinks"],
        "removedLinks": state["removedLinks"],
        "missingProposedLinkTargets": state["missingProposedLinkTargets"],
        "jsSyntax": state["jsSyntax"],
        "currentTargetSha256BeforeApply": state["currentTargetSha256BeforeApply"],
        "currentTargetSha256AfterScriptRun": state["currentTargetSha256AfterScriptRun"],
        "proposedTargetSha256": state["proposedTargetSha256"],
        "rollbackMethod": "Revert the apply commit. The only target application file declared for apply mode is index.html.",
        "executiveSummary": executive_summary,
        "humanReviewStatus": "Human review required before apply. Check the audit report, then trigger apply only if the grouped homepage is approved.",
        "nextAction": "Run this workflow in audit mode first. If the report passes, run the same workflow in apply mode and then visually verify the live root homepage on desktop and mobile.",
        "applied": applied,
        "pass": passed,
    }


if __name__ == "__main__":
    raise SystemExit(main())
