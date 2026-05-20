#!/usr/bin/env python3
"""
Fix V7 GIS SLD mobile MWp DC sizing control visibility.

Issue:
- The MWp DC input and SIZE MWp button exist in the map tools overlay.
- On mobile they can be hidden, squeezed or pushed out of the visible area by the tools row.

Fix:
- Make the MWp sizing row a full-width dedicated row on mobile.
- Keep the input and SIZE MWp button visible when tools are ON.
- Keep it hidden when tools are OFF, preserving declutter behaviour.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "gis-sld-v5.css"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "fix_v7_gis_sld_mobile_mwp_sizing_visibility.md"

MARKER = "/* GLOBALGRID2050 V7 MOBILE MWp SIZING VISIBILITY FIX */"
PATCH = r'''

/* GLOBALGRID2050 V7 MOBILE MWp SIZING VISIBILITY FIX */
@media (max-width: 900px) {
  .map-tool-overlay {
    align-items: stretch !important;
  }

  .map-tool-overlay > .map-toggle-row {
    width: 100% !important;
    justify-content: center !important;
    align-items: center !important;
  }

  .map-size-row {
    display: flex !important;
    width: 100% !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 8px !important;
    margin-top: 4px !important;
    padding: 0 4px !important;
  }

  .map-size-input {
    display: inline-block !important;
    visibility: visible !important;
    width: 96px !important;
    min-width: 96px !important;
    max-width: 96px !important;
    height: 36px !important;
    font-size: 13px !important;
    text-align: center !important;
  }

  #btn_map_apply_size {
    display: inline-flex !important;
    visibility: visible !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 94px !important;
    height: 36px !important;
    color: #ffffff !important;
  }

  .map-size-status {
    display: block !important;
    flex-basis: 100% !important;
    text-align: center !important;
    padding: 2px 0 0 0 !important;
    font-size: 10px !important;
  }

  .map-tool-overlay.tools-collapsed .map-size-row,
  .map-tool-overlay.tools-collapsed .map-size-input,
  .map-tool-overlay.tools-collapsed #btn_map_apply_size,
  .map-tool-overlay.tools-collapsed .map-size-status {
    display: none !important;
  }
}

@media (max-width: 520px) {
  .map-size-row {
    flex-wrap: wrap !important;
  }

  .map-size-input {
    width: 104px !important;
    min-width: 104px !important;
    max-width: 104px !important;
  }

  #btn_map_apply_size {
    min-width: 110px !important;
  }
}
'''


def main() -> int:
    if not CSS.exists():
        raise SystemExit(f"Missing CSS file: {CSS.relative_to(ROOT)}")

    text = CSS.read_text(encoding="utf-8")
    actions = []

    if MARKER not in text:
        text = text.rstrip() + PATCH + "\n"
        CSS.write_text(text, encoding="utf-8")
        actions.append("added mobile MWp sizing visibility override")
    else:
        actions.append("mobile MWp sizing visibility fix already present")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Fix V7 GIS SLD Mobile MWp Sizing Visibility",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Make the MWp DC input and SIZE MWp button visible on mobile by giving the sizing control its own full-width tools row.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD on mobile.",
        "2. Toggle TOOLS ON.",
        "3. Confirm MWp DC input and SIZE MWp button are visible below the first tools row.",
        "4. Enter 20 or 200 and press SIZE MWp.",
        "5. Confirm the array resizes by whole block steps.",
        "6. Toggle TOOLS OFF and confirm the sizing controls hide with the rest of the tools.",
        "",
    ]), encoding="utf-8")

    print("V7 mobile MWp sizing visibility fix complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
