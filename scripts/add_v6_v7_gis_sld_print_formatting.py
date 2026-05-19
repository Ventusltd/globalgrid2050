#!/usr/bin/env python3
"""
Add print formatting to V6 and V7 GIS SLD Financial Sandbox.

Purpose:
- Improve browser print / save to PDF output.
- Hide interactive controls from print.
- Preserve left panel inputs, summaries, explanations and disclaimers.
- Place the map as a clean report figure.
- Add a print button that calls window.print().
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_gis_sld_print_formatting.md"

TARGETS = [
    ("V6", ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox"),
    ("V7", ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"),
]

PRINT_BUTTON = '<button id="btn_print_report" class="map-toggle-btn">PRINT</button>'
PRINT_BUTTON_MARKER = '<button id="btn_key_toggle" class="map-toggle-btn active">KEY ON</button>'
PRINT_EVENT_MARKER = '$("btn_key_toggle")?.addEventListener("click", toggleKeyCollapse);'
PRINT_EVENT_LINE = '$("btn_print_report")?.addEventListener("click", () => window.print());'

PRINT_CSS_MARKER = '/* VENTUS GIS SLD PRINT REPORT MODE */'
PRINT_CSS = r'''

/* VENTUS GIS SLD PRINT REPORT MODE */
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html,
  body {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    display: block !important;
    background: #ffffff !important;
    color: #111111 !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 9.5pt !important;
    line-height: 1.35 !important;
  }

  body::before {
    content: "VENTUS GIS SLD Financial Sandbox  |  Early Stage Engineering Screening Report";
    display: block;
    color: #111111;
    font-weight: bold;
    font-size: 13pt;
    border-bottom: 1px solid #999999;
    padding: 0 0 6mm 0;
    margin: 0 0 6mm 0;
  }

  .dashboard {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
  }

  .panel,
  .panel-left,
  .panel-right {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
    color: #111111 !important;
    border: 1px solid #cccccc !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 8mm !important;
    margin: 0 0 8mm 0 !important;
  }

  .panel-right {
    page-break-before: always;
    break-before: page;
  }

  #map {
    display: block !important;
    height: 170mm !important;
    min-height: 170mm !important;
    width: 100% !important;
    border: 1px solid #999999 !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .maplibregl-canvas,
  .maplibregl-map {
    max-width: 100% !important;
  }

  .map-controls,
  .map-tool-overlay,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  button,
  .search-box,
  .tab-container,
  .btn,
  .action-row,
  .toolbar,
  [class*="toggle"],
  [id*="btn_"] {
    display: none !important;
  }

  .legend {
    display: block !important;
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    background: #ffffff !important;
    color: #111111 !important;
    border: 1px solid #cccccc !important;
    padding: 4mm !important;
    margin: 4mm 0 0 0 !important;
    font-size: 8pt !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .legend * {
    color: #111111 !important;
  }

  h2,
  h3 {
    color: #111111 !important;
    border-color: #999999 !important;
    page-break-after: avoid;
    break-after: avoid;
  }

  p,
  label,
  div,
  span,
  small,
  strong {
    color: #111111 !important;
  }

  input,
  select,
  textarea {
    color: #111111 !important;
    background: #ffffff !important;
    border: 1px solid #999999 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .input-group,
  .stat-row,
  .summary-row,
  .warning,
  .notice,
  .card,
  .panel-section {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .tab-content {
    display: block !important;
  }

  .tab-content:not(.active) {
    display: block !important;
  }

  a::after {
    content: "" !important;
  }

  * {
    text-shadow: none !important;
    box-shadow: none !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def update_target(version: str, folder: Path) -> list[str]:
    index = folder / "index.html"
    css = folder / "gis-sld-v5.css"
    ui = folder / "gis-sld-v5-ui.js"

    for p in (index, css, ui):
        if not p.exists():
            raise SystemExit(f"Missing {version} file: {p.relative_to(ROOT)}")

    actions: list[str] = []

    html = read(index)
    if PRINT_BUTTON not in html:
        if PRINT_BUTTON_MARKER not in html:
            raise SystemExit(f"{version}: print button marker not found")
        html = html.replace(PRINT_BUTTON_MARKER, PRINT_BUTTON_MARKER + "\n" + PRINT_BUTTON, 1)
        write(index, html)
        actions.append(f"{version}: added print button")
    else:
        actions.append(f"{version}: print button already present")

    js = read(ui)
    if PRINT_EVENT_LINE not in js:
        if PRINT_EVENT_MARKER not in js:
            raise SystemExit(f"{version}: print event marker not found")
        js = js.replace(PRINT_EVENT_MARKER, PRINT_EVENT_MARKER + "\n" + PRINT_EVENT_LINE, 1)
        write(ui, js)
        actions.append(f"{version}: wired print button to window.print")
    else:
        actions.append(f"{version}: print button already wired")

    style = read(css)
    if PRINT_CSS_MARKER not in style:
        write(css, style.rstrip() + PRINT_CSS + "\n")
        actions.append(f"{version}: appended print report CSS")
    else:
        actions.append(f"{version}: print report CSS already present")

    return actions


def main() -> int:
    all_actions: list[str] = []
    for version, folder in TARGETS:
        all_actions.extend(update_target(version, folder))

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V6 V7 GIS SLD Print Formatting",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Improve browser print and Save as PDF output for the V6 and V7 GIS SLD Financial Sandbox pages.",
        "",
        "## Changes",
        "",
        "- Adds a PRINT button to map controls.",
        "- Wires the PRINT button to `window.print()`.",
        "- Adds print CSS to hide interactive map controls, tool overlays and buttons.",
        "- Keeps report content, assumptions, summaries, explanatory text and map figure visible.",
        "- Forces printable white background and black text for cleaner PDF output.",
        "",
        "## Actions",
        "",
        *[f"- {action}" for action in all_actions],
        "",
        "## Test links",
        "",
        "- `/solar-bess-topology-v6/gis-sld-financial-sandbox/`",
        "- `/solar-bess-topology-v7/gis-sld-financial-sandbox/`",
        "",
        "## Manual test",
        "",
        "Open either GIS SLD page, press PRINT, then preview Save as PDF. Confirm the PDF is report style, the map prints cleanly, and interactive controls are hidden.",
        "",
    ])
    write(REPORT, report)
    print(f"Print formatting update complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
