#!/usr/bin/env python3
"""
Add A4 portrait print buttons and print CSS to all V6 and V7 application pages.

Covers:
- GIS SLD Financial Sandbox
- Module Layout
- DC AC LV Topology Review
- Cable Geometry Visualiser

This is deliberately conservative:
- It adds print buttons to existing headers/control areas.
- It appends print CSS to the app CSS files.
- It does not alter calculation logic.
- It preserves interactive screen behaviour.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_all_apps_a4_print_formatting.md"

VERSIONS = ["v6", "v7"]

APP_CONFIGS = [
    {
        "name": "gis-sld-financial-sandbox",
        "css": "gis-sld-v5.css",
        "button_marker": '<button id="btn_key_toggle" class="map-toggle-btn active">KEY ON</button>',
        "button_html": '<button id="btn_print_report" class="map-toggle-btn print-btn">PRINT</button>',
        "ui_js": "gis-sld-v5-ui.js",
        "event_marker": '$("btn_key_toggle")?.addEventListener("click", toggleKeyCollapse);',
        "event_line": '$("btn_print_report")?.addEventListener("click", () => window.print());',
    },
    {
        "name": "module-layout",
        "css": "module-layout-v5.css",
        "button_marker": '<div class="topo-header-links">',
        "button_html": '<button id="ml_print_report" class="module-link print-btn" type="button" onclick="window.print()">Print</button>',
    },
    {
        "name": "dc-ac-lv-topology-review",
        "css": "dc-ac-lv-topology-review-v5.css",
        "button_marker": '<div class="topo-header-links">',
        "button_html": '<button id="topo_print_report" class="module-link print-btn" type="button" onclick="window.print()">Print</button>',
    },
    {
        "name": "cable-geometry-visualiser",
        "css": "style.css",
        "button_marker": '<div class="button-row">',
        "button_html": '<button id="cg_print_report" class="btn print-btn" type="button" onclick="window.print()">Print</button>',
    },
]

COMMON_PRINT_CSS_MARKER = "/* GLOBALGRID2050 A4 PORTRAIT PRINT MODE */"
COMMON_PRINT_CSS = r'''

/* GLOBALGRID2050 A4 PORTRAIT PRINT MODE */
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
    content: "GlobalGrid2050  |  A4 Portrait Screening Report";
    display: block;
    color: #111111;
    font-weight: bold;
    font-size: 13pt;
    border-bottom: 1px solid #999999;
    padding: 0 0 5mm 0;
    margin: 0 0 6mm 0;
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
  }

  .panel,
  .panel-left,
  .panel-right,
  .module-panel,
  .topo-panel,
  .module-map-card,
  section,
  header,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
    color: #111111 !important;
    border-color: #cccccc !important;
    box-shadow: none !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .panel,
  .module-panel,
  .topo-panel,
  .module-map-card,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    border: 1px solid #cccccc !important;
    border-radius: 0 !important;
    padding: 5mm !important;
    margin: 0 0 6mm 0 !important;
  }

  .panel-right,
  .module-map-card {
    page-break-before: auto;
    break-before: auto;
  }

  #map,
  #module_map,
  canvas,
  svg {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 110mm !important;
    max-height: 170mm !important;
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
  .module-map-toolbar,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  .topo-header-links,
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
    background: #ffffff !important;
    color: #111111 !important;
    border: 1px solid #cccccc !important;
    padding: 4mm !important;
    margin: 4mm 0 0 0 !important;
    font-size: 8pt !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  h1,
  h2,
  h3,
  h4 {
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
  strong,
  li {
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
  .module-stat,
  .stat-row,
  .summary-row,
  .function-item,
  .card,
  .topo-mode,
  .tab-content {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .tab-content,
  .topo-mode {
    display: block !important;
  }

  .tab-content:not(.active),
  .topo-mode:not(.active) {
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


def app_folder(version: str, name: str) -> Path:
    return ROOT / f"solar-bess-topology-{version}" / name


def update_app(version: str, config: dict[str, str]) -> list[str]:
    folder = app_folder(version, config["name"])
    index = folder / "index.html"
    css = folder / config["css"]
    actions: list[str] = []

    for path in (index, css):
        if not path.exists():
            raise SystemExit(f"Missing required file: {path.relative_to(ROOT)}")

    html = read(index)
    if config["button_html"] not in html:
        marker = config["button_marker"]
        if marker not in html:
            raise SystemExit(f"{version} {config['name']}: print button marker not found")
        if marker.endswith(">") and marker.startswith("<div"):
            html = html.replace(marker, marker + "\n" + config["button_html"], 1)
        else:
            html = html.replace(marker, marker + "\n" + config["button_html"], 1)
        write(index, html)
        actions.append(f"{version} {config['name']}: added print button")
    else:
        actions.append(f"{version} {config['name']}: print button already present")

    if "ui_js" in config:
        ui = folder / config["ui_js"]
        if not ui.exists():
            raise SystemExit(f"Missing required file: {ui.relative_to(ROOT)}")
        js = read(ui)
        if config["event_line"] not in js:
            if config["event_marker"] not in js:
                raise SystemExit(f"{version} {config['name']}: print event marker not found")
            js = js.replace(config["event_marker"], config["event_marker"] + "\n" + config["event_line"], 1)
            write(ui, js)
            actions.append(f"{version} {config['name']}: wired print button")
        else:
            actions.append(f"{version} {config['name']}: print button already wired")

    style = read(css)
    if COMMON_PRINT_CSS_MARKER not in style:
        write(css, style.rstrip() + COMMON_PRINT_CSS + "\n")
        actions.append(f"{version} {config['name']}: appended A4 print CSS")
    else:
        actions.append(f"{version} {config['name']}: A4 print CSS already present")

    return actions


def main() -> int:
    all_actions: list[str] = []
    for version in VERSIONS:
        for config in APP_CONFIGS:
            all_actions.extend(update_app(version, config))

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add V6 V7 All Apps A4 Print Formatting",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Add print buttons and A4 portrait print formatting to all V6 and V7 application pages.",
        "",
        "## Apps covered",
        "",
        "- GIS SLD Financial Sandbox",
        "- Physical Solar Module Layout",
        "- DC AC LV Topology Review",
        "- Cable Geometry Visualiser",
        "",
        "## Print behaviour",
        "",
        "- Adds a visible Print button to each app page.",
        "- Uses A4 portrait page settings.",
        "- Hides interactive controls, tabs, map buttons and tool overlays during print.",
        "- Keeps inputs, outputs, notes, warnings, legends, canvases and map figures visible where possible.",
        "- Uses white background and black text for cleaner PDF export.",
        "",
        "## Actions",
        "",
        *[f"- {action}" for action in all_actions],
        "",
        "## Manual test",
        "",
        "Open each V6 and V7 app, press Print, preview Save as PDF and confirm the output fits A4 portrait cleanly.",
        "",
    ])
    write(REPORT, report)
    print(f"All app print formatting complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
