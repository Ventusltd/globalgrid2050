#!/usr/bin/env python3
"""
Add V6 and V7 print V3 financial formatting patch.

Purpose:
- Make expanded financial tabs print compactly.
- Remove green/cyan/orange financial screen colours from print.
- Reduce blank spaces in financial sections.
- Hide inactive topology tab content more aggressively.
- Keep finance details readable in A4 portrait PDF output.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_print_v3_financials_patch.md"

TARGET_CSS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox" / "gis-sld-v5.css",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "gis-sld-v5.css",
]

MARKER = "/* GLOBALGRID2050 PRINT V3 FINANCIALS PATCH */"

PRINT_V3_CSS = r'''

/* GLOBALGRID2050 PRINT V3 FINANCIALS PATCH */
@media print {
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  body {
    font-size: 8pt !important;
    line-height: 1.16 !important;
  }

  /* Print only the selected topology tab. */
  #string_tab:not(.active),
  #central_tab:not(.active),
  .tab-content:not(.active) {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }

  #string_tab.active,
  #central_tab.active,
  .tab-content.active {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  /* Financial section should read like a report table, not a screen form. */
  details.finance-box,
  details.finance-box[open],
  .finance-box {
    display: block !important;
    open: true;
    background: #ffffff !important;
    color: #111111 !important;
    border: 1px solid #bbbbbb !important;
    border-radius: 0 !important;
    padding: 2.5mm !important;
    margin: 2mm 0 3mm 0 !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  .finance-box summary {
    display: block !important;
    font-weight: 700 !important;
    font-size: 9pt !important;
    color: #111111 !important;
    border-bottom: 1px solid #999999 !important;
    padding: 0 0 1.5mm 0 !important;
    margin: 0 0 2mm 0 !important;
    list-style: none !important;
  }

  .finance-box summary::-webkit-details-marker {
    display: none !important;
  }

  .finance-headline,
  .finance-box .finance-headline {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    column-gap: 6mm !important;
    row-gap: 0.6mm !important;
    background: #ffffff !important;
    border: 0 !important;
    padding: 0 !important;
    margin: 0 0 2mm 0 !important;
  }

  .finance-box h3 {
    display: block !important;
    clear: both !important;
    font-size: 8.5pt !important;
    color: #111111 !important;
    border-bottom: 1px solid #bbbbbb !important;
    margin: 2mm 0 1mm 0 !important;
    padding: 0 0 0.8mm 0 !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  .finance-box .input-group,
  .finance-box .stat-row,
  details.finance-box .input-group,
  details.finance-box .stat-row {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 34mm !important;
    gap: 2mm !important;
    align-items: baseline !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0.55mm 0 !important;
    border-bottom: 1px dotted #dddddd !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .finance-box .input-group[style],
  details.finance-box .input-group[style] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 58mm !important;
    margin: 0 !important;
    padding: 0.55mm 0 !important;
  }

  .finance-box label,
  .finance-box .stat-row span:first-child {
    color: #111111 !important;
    font-weight: 400 !important;
    white-space: normal !important;
  }

  .finance-box input,
  .finance-box select,
  .finance-box textarea,
  .finance-box .stat-val,
  .finance-box .cyan,
  .finance-box .orange,
  .finance-box .green,
  .finance-box [class*="cyan"],
  .finance-box [class*="green"],
  .finance-box [class*="orange"] {
    color: #111111 !important;
    background: #ffffff !important;
    border: 0 !important;
    border-bottom: 1px solid #aaaaaa !important;
    box-shadow: none !important;
    text-shadow: none !important;
    font-weight: 700 !important;
    text-align: right !important;
    min-height: 0 !important;
    height: auto !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .finance-box select {
    white-space: normal !important;
    text-align: left !important;
    font-weight: 400 !important;
    width: 100% !important;
  }

  .finance-box .warning-box,
  .finance-box [id$="_warnings"] {
    display: block !important;
    color: #111111 !important;
    background: #ffffff !important;
    border: 1px solid #999999 !important;
    padding: 2mm !important;
    margin: 2mm 0 0 0 !important;
    font-size: 7.5pt !important;
    line-height: 1.18 !important;
  }

  .finance-box .warning-box:empty,
  .finance-box [id$="_warnings"]:empty {
    display: none !important;
  }

  /* Prevent repeated zero width oddities and duplicated single values. */
  .finance-box input[type="checkbox"] {
    width: 4mm !important;
    height: 4mm !important;
    border: 1px solid #111111 !important;
  }

  /* Compact normal left report panels after finance expansion. */
  .panel-left {
    padding: 3mm !important;
  }

  .panel-left > h2 {
    font-size: 11pt !important;
    margin-bottom: 3mm !important;
  }

  .stat-box,
  .disclaimer-box,
  .explainer-box {
    padding: 2.5mm !important;
    margin: 0 0 3mm 0 !important;
  }

  .explainer-box p,
  .disclaimer-box,
  .ux-note {
    font-size: 7.6pt !important;
    line-height: 1.18 !important;
  }

  /* Keep the map as a final report figure and not an oversized blank section. */
  .panel-right {
    padding: 3mm !important;
    margin-top: 3mm !important;
  }

  #map {
    height: 115mm !important;
    min-height: 115mm !important;
    max-height: 115mm !important;
  }

  .legend {
    font-size: 7pt !important;
    padding: 2mm !important;
    margin-top: 2mm !important;
  }
}
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def main() -> int:
    actions: list[str] = []
    for path in TARGET_CSS:
        if not path.exists():
            raise SystemExit(f"Missing CSS file: {path.relative_to(ROOT)}")
        css = read(path)
        if MARKER in css:
            actions.append(f"already present: {path.relative_to(ROOT)}")
            continue
        write(path, css.rstrip() + PRINT_V3_CSS + "\n")
        actions.append(f"appended print v3 financials patch: {path.relative_to(ROOT)}")

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V6 V7 Print V3 Financials Patch",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Improve print output where the financial details panel is expanded.",
        "",
        "## Fixes",
        "",
        "- Print only the active topology tab.",
        "- Compact financial headline rows into two columns.",
        "- Remove green, cyan and orange financial colours in print.",
        "- Use black financial values for PDF readability.",
        "- Reduce large blank spaces and excessive padding.",
        "- Improve Development Stage wrapping.",
        "- Keep financial warnings readable as compact report notes.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V6 or V7 GIS SLD.",
        "2. Expand Baseline Project Economics.",
        "3. Print to A4 portrait PDF.",
        "4. Confirm finance values are black and readable.",
        "5. Confirm only the active tab prints.",
        "6. Confirm no large blank gaps appear around the finance section.",
        "",
    ])
    write(REPORT, report)
    print(f"Print V3 financials patch complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
