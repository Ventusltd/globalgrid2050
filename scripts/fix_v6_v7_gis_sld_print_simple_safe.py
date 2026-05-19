#!/usr/bin/env python3
"""
Fix V6 and V7 GIS SLD printing by removing the hanging print preparation routine.

Purpose:
- Restore print button to immediate window.print().
- Keep clean default map layers.
- Set public substations default OFF in state.
- Disable the previous JS print map pack without deleting history.
- Add simple CSS so the existing map prints as a large non truncated report figure.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "fix_v6_v7_gis_sld_print_simple_safe.md"

TARGETS = [
    ROOT / "solar-bess-topology-v6" / "gis-sld-financial-sandbox",
    ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox",
]

PREP_EVENT = '$("btn_print_report")?.addEventListener("click", prepareGisSldPrintReport);'
SIMPLE_EVENT = '$("btn_print_report")?.addEventListener("click", () => window.print());'
PACK_AUTORUN = "setTimeout(enforceCleanDefaultMapLayers, 1200);"
PACK_AUTORUN_DISABLED = "// setTimeout(enforceCleanDefaultMapLayers, 1200); // disabled by simple safe print fix"

CSS_MARKER = "/* GLOBALGRID2050 SIMPLE SAFE PRINT MAP FIX */"
CSS_PATCH = r'''

/* GLOBALGRID2050 SIMPLE SAFE PRINT MAP FIX */
@media print {
  /* The report prints first. The live map prints as one large page figure after report content. */
  .panel-right {
    display: block !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    page-break-before: always !important;
    break-before: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    background: #ffffff !important;
  }

  .panel-right::before {
    content: "Map Figure: Current GIS SLD View";
    display: block !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
    color: #111111 !important;
    border-bottom: 1px solid #999999 !important;
    padding: 0 0 3mm 0 !important;
    margin: 0 0 4mm 0 !important;
  }

  #map {
    display: block !important;
    position: relative !important;
    width: 100% !important;
    height: 230mm !important;
    min-height: 230mm !important;
    max-height: 230mm !important;
    overflow: hidden !important;
    border: 1px solid #999999 !important;
    background: #ffffff !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .map-controls,
  .map-tool-overlay,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  .legend {
    display: none !important;
  }

  .print-map-pack,
  .print-map-page,
  .print-map-page-landscape {
    display: none !important;
  }
}
'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def patch_folder(folder: Path) -> list[str]:
    actions: list[str] = []
    state_js = folder / "gis-sld-v5-state.js"
    map_js = folder / "gis-sld-v5-map.js"
    ui_js = folder / "gis-sld-v5-ui.js"
    css = folder / "gis-sld-v5.css"

    for path in [state_js, map_js, ui_js, css]:
        if not path.exists():
            raise SystemExit(f"Missing file: {path.relative_to(ROOT)}")

    state_text = read(state_js)
    if "subsVisible: true" in state_text:
        state_text = state_text.replace("subsVisible: true", "subsVisible: false", 1)
        write(state_js, state_text)
        actions.append(f"set public substations default OFF in {state_js.relative_to(ROOT)}")
    else:
        actions.append(f"public substations already default OFF in {state_js.relative_to(ROOT)}")

    map_text = read(map_js)
    replacements = {
        '"66kv": true': '"66kv": false',
        '"132kv": true': '"132kv": false',
        '"275kv": true': '"275kv": false',
        '"400kv": true': '"400kv": false',
    }
    changed_map = False
    for old, new in replacements.items():
        if old in map_text:
            map_text = map_text.replace(old, new)
            changed_map = True
    if changed_map:
        write(map_js, map_text)
        actions.append(f"confirmed Atlas overhead lines default OFF in {map_js.relative_to(ROOT)}")
    else:
        actions.append(f"Atlas overhead lines already default OFF in {map_js.relative_to(ROOT)}")

    ui_text = read(ui_js)
    if PREP_EVENT in ui_text:
        ui_text = ui_text.replace(PREP_EVENT, SIMPLE_EVENT, 1)
        actions.append(f"restored simple print event in {ui_js.relative_to(ROOT)}")
    elif SIMPLE_EVENT in ui_text:
        actions.append(f"simple print event already present in {ui_js.relative_to(ROOT)}")
    else:
        raise SystemExit(f"No recognised print event found in {ui_js.relative_to(ROOT)}")

    if PACK_AUTORUN in ui_text:
        ui_text = ui_text.replace(PACK_AUTORUN, PACK_AUTORUN_DISABLED, 1)
        actions.append(f"disabled print pack autorun in {ui_js.relative_to(ROOT)}")

    write(ui_js, ui_text)

    css_text = read(css)
    if CSS_MARKER not in css_text:
        css_text = css_text.rstrip() + CSS_PATCH + "\n"
        write(css, css_text)
        actions.append(f"added simple safe print CSS in {css.relative_to(ROOT)}")
    else:
        actions.append(f"simple safe print CSS already present in {css.relative_to(ROOT)}")

    return actions


def main() -> int:
    actions: list[str] = []
    for folder in TARGETS:
        actions.extend(patch_folder(folder))

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Fix V6 V7 GIS SLD Print Simple Safe",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Fix print getting stuck on PREPARING by removing the asynchronous print preparation routine and restoring immediate browser print.",
        "",
        "## Changes",
        "",
        "- Print button calls `window.print()` directly again.",
        "- Public substations default OFF.",
        "- Atlas overhead line layers default OFF.",
        "- Previous print map pack output is hidden in print.",
        "- Live map prints as one large A4 portrait figure after the report.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V6 or V7 GIS SLD.",
        "2. Confirm SUBS default OFF and overhead line buttons default OFF.",
        "3. Press PRINT.",
        "4. Confirm browser print opens immediately.",
        "5. Confirm map prints as a large figure and is not stuck on PREPARING.",
        "",
    ])
    write(REPORT, report)
    print(f"Simple safe print fix complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
