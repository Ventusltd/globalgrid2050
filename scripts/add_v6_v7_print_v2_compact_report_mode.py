#!/usr/bin/env python3
"""
Add V6 and V7 compact A4 portrait print report mode.

Purpose:
- Replace weak print rules with stricter compact print layout rules.
- Remove large gaps by reducing padding, avoiding forced page breaks and printing only active tab content.
- Hide interactive controls, tool overlays and irrelevant screen controls.
- Reset expanded map positioning for print.
- Keep map, legend, active inputs, outputs, notes and disclaimers visible.

This script appends a later print CSS block so it overrides earlier print CSS without deleting history.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_print_v2_compact_report_mode.md"

TARGET_CSS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox" / "gis-sld-v5.css",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "gis-sld-v5.css",
    ROOT / "solar-bess-topology-v6" / "module-layout" / "module-layout-v5.css",
    ROOT / "solar-bess-topology-v7" / "module-layout" / "module-layout-v5.css",
    ROOT / "solar-bess-topology-v6" / "dc-ac-lv-topology-review" / "dc-ac-lv-topology-review-v5.css",
    ROOT / "solar-bess-topology-v7" / "dc-ac-lv-topology-review" / "dc-ac-lv-topology-review-v5.css",
    ROOT / "solar-bess-topology-v6" / "cable-geometry-visualiser" / "style.css",
    ROOT / "solar-bess-topology-v7" / "cable-geometry-visualiser" / "style.css",
]

MARKER = "/* GLOBALGRID2050 PRINT V2 COMPACT REPORT MODE */"

PRINT_V2_CSS = r'''

/* GLOBALGRID2050 PRINT V2 COMPACT REPORT MODE */
@media print {
  @page {
    size: A4 portrait;
    margin: 9mm;
  }

  html,
  body {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    display: block !important;
    background: #fff !important;
    color: #111 !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 8.5pt !important;
    line-height: 1.22 !important;
  }

  body::before {
    content: "GlobalGrid2050 Screening Report";
    display: block !important;
    font-weight: 700 !important;
    font-size: 11pt !important;
    color: #111 !important;
    border-bottom: 1px solid #999 !important;
    padding: 0 0 3mm 0 !important;
    margin: 0 0 4mm 0 !important;
  }

  .dashboard,
  .module-app-shell,
  .module-main,
  .topo-main,
  main {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    gap: 0 !important;
  }

  header,
  .panel,
  .panel-left,
  .panel-right,
  .module-panel,
  .topo-panel,
  .module-map-card,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    display: block !important;
    position: static !important;
    inset: auto !important;
    float: none !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #fff !important;
    color: #111 !important;
    border: 1px solid #ccc !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 3.5mm !important;
    margin: 0 0 4mm 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .panel-left,
  .module-panel,
  .topo-panel {
    column-count: 2;
    column-gap: 8mm;
    column-rule: 1px solid #ddd;
  }

  .panel-right,
  .panel-right.map-expanded,
  .panel-right.map-fullscreen,
  .module-map-card {
    position: static !important;
    inset: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    z-index: auto !important;
    page-break-before: auto !important;
    break-before: auto !important;
    column-count: initial !important;
    column-gap: initial !important;
    column-rule: none !important;
  }

  #map,
  #module_map {
    display: block !important;
    width: 100% !important;
    height: 125mm !important;
    min-height: 125mm !important;
    max-height: 125mm !important;
    border: 1px solid #999 !important;
    margin: 0 0 3mm 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  canvas,
  svg {
    max-width: 100% !important;
    height: auto !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .maplibregl-canvas,
  .maplibregl-map {
    max-width: 100% !important;
  }

  .map-controls,
  .map-tool-overlay,
  .module-map-toolbar,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  .search-box,
  .button-row,
  .btn,
  button,
  .tab-container,
  .topo-tabs,
  .toolbar,
  .print-btn,
  [id*="btn_"],
  [class*="toggle"] {
    display: none !important;
  }

  .legend {
    display: block !important;
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    background: #fff !important;
    color: #111 !important;
    border: 1px solid #ccc !important;
    padding: 2.5mm !important;
    margin: 2mm 0 0 0 !important;
    font-size: 7.5pt !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .legend * {
    color: #111 !important;
  }

  h1 {
    font-size: 14pt !important;
    line-height: 1.15 !important;
    margin: 0 0 3mm 0 !important;
    padding: 0 !important;
  }

  h2 {
    font-size: 10pt !important;
    line-height: 1.15 !important;
    margin: 2.5mm 0 1.5mm 0 !important;
    padding: 0 0 1mm 0 !important;
    border-bottom: 1px solid #999 !important;
    color: #111 !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  h3 {
    font-size: 8.5pt !important;
    line-height: 1.15 !important;
    margin: 2mm 0 1mm 0 !important;
    padding: 0 0 0.75mm 0 !important;
    border-bottom: 1px dotted #bbb !important;
    color: #111 !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  p,
  label,
  div,
  span,
  small,
  strong,
  li {
    color: #111 !important;
  }

  p {
    margin: 0 0 2mm 0 !important;
  }

  .input-group,
  .module-stat,
  .stat-row,
  .summary-row {
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    gap: 2mm !important;
    align-items: baseline !important;
    margin: 0 0 1mm 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  input,
  select,
  textarea {
    color: #111 !important;
    background: #fff !important;
    border: none !important;
    border-bottom: 1px solid #aaa !important;
    padding: 0 !important;
    min-height: 0 !important;
    font-size: 8.5pt !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .tab-content,
  .topo-mode {
    display: none !important;
  }

  .tab-content.active,
  .topo-mode.active,
  .topo-mode[data-mode-panel].active {
    display: block !important;
  }

  details:not([open]) {
    display: none !important;
  }

  .collapsed,
  .hidden,
  [hidden] {
    display: none !important;
  }

  .warning,
  .notice,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    font-size: 8pt !important;
    line-height: 1.2 !important;
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


def main() -> int:
    actions: list[str] = []
    for path in TARGET_CSS:
        if not path.exists():
            raise SystemExit(f"Missing CSS file: {path.relative_to(ROOT)}")
        css = read(path)
        if MARKER in css:
            actions.append(f"already present: {path.relative_to(ROOT)}")
            continue
        write(path, css.rstrip() + PRINT_V2_CSS + "\n")
        actions.append(f"appended print v2 compact report mode: {path.relative_to(ROOT)}")

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V6 V7 Print V2 Compact Report Mode",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Improve A4 portrait PDF output by reducing white space, hiding irrelevant controls and preventing map overlap.",
        "",
        "## Fixes targeted",
        "",
        "- Do not print inactive tabs.",
        "- Do not print map controls or tool overlays.",
        "- Reset expanded or fullscreen map positioning before print.",
        "- Reduce panel padding and font size for A4 portrait.",
        "- Use two compact columns for input and output panels where appropriate.",
        "- Keep map and legend as report figures rather than raw UI overlays.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open each V6 and V7 app.",
        "2. Press Print or use browser print.",
        "3. Confirm active tab only is printed.",
        "4. Confirm no tool buttons appear in the PDF.",
        "5. Confirm map is not overlaid on report text.",
        "6. Confirm there are no large blank gaps between report sections.",
        "",
    ])
    write(REPORT, report)
    print(f"Print V2 compact report mode complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
