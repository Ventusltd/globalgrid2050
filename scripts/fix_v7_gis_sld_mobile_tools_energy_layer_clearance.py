#!/usr/bin/env python3
"""
Fix V7 GIS SLD mobile tools overlay clearance.

Issue:
- On mobile, TOOLS ON/OFF and MWp sizing controls overlap the operating asset row.
- This blocks SOLAR OP, ONSHORE WIND, OFFSHORE WIND and BESS OP toggles.

Fix:
- Push map tool overlay below the voltage and operating asset control rows.
- Apply the same lower position for both TOOLS ON and TOOLS OFF states.
- Keep MWp sizing inside the tools group and hidden when collapsed.
- Preserve clickable access to operating asset toggles.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "gis-sld-v5.css"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "fix_v7_gis_sld_mobile_tools_energy_layer_clearance.md"

MARKER = "/* GLOBALGRID2050 V7 MOBILE TOOLS ENERGY LAYER CLEARANCE FIX */"
PATCH = r'''

/* GLOBALGRID2050 V7 MOBILE TOOLS ENERGY LAYER CLEARANCE FIX */
@media (max-width: 900px) {
  .map-controls {
    z-index: 30 !important;
  }

  .asset-toggle-row,
  .voltage-toggle-row {
    position: relative !important;
    z-index: 35 !important;
    pointer-events: auto !important;
  }

  .asset-toggle-row .map-toggle-btn,
  .voltage-toggle-row .map-toggle-btn {
    pointer-events: auto !important;
  }

  .map-tool-overlay,
  .map-tool-overlay.tools-collapsed,
  .panel-right.map-expanded .map-tool-overlay,
  .panel-right.map-expanded .map-tool-overlay.tools-collapsed,
  body.map-expanded .map-tool-overlay,
  body.map-expanded .map-tool-overlay.tools-collapsed {
    top: 265px !important;
    left: 10px !important;
    right: 10px !important;
    z-index: 24 !important;
    max-width: none !important;
    align-items: stretch !important;
    pointer-events: none !important;
  }

  .map-tool-overlay .map-toggle-btn,
  .map-tool-overlay input,
  .map-tool-overlay span {
    pointer-events: auto !important;
  }

  .map-tool-overlay > .map-toggle-row {
    justify-content: center !important;
  }

  .map-tool-overlay.tools-collapsed {
    width: auto !important;
  }

  .map-tool-overlay.tools-collapsed #btn_map_tools_toggle {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .map-tool-overlay.tools-collapsed .map-size-row,
  .map-tool-overlay.tools-collapsed .map-tool-row-secondary,
  .map-tool-overlay.tools-collapsed button:not(#btn_map_tools_toggle) {
    display: none !important;
  }
}

@media (max-width: 520px) {
  .map-tool-overlay,
  .map-tool-overlay.tools-collapsed,
  .panel-right.map-expanded .map-tool-overlay,
  .panel-right.map-expanded .map-tool-overlay.tools-collapsed,
  body.map-expanded .map-tool-overlay,
  body.map-expanded .map-tool-overlay.tools-collapsed {
    top: 285px !important;
  }

  .map-tool-overlay > .map-toggle-row:first-child {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
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
        actions.append("added mobile tools clearance override so energy layer buttons remain clickable")
    else:
        actions.append("mobile tools clearance override already present")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Fix V7 GIS SLD Mobile Tools Energy Layer Clearance",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Move the mobile tools overlay lower in both TOOLS ON and TOOLS OFF states so operating asset toggles can be selected.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD on mobile.",
        "2. Confirm SOLAR OP, ONSHORE WIND, OFFSHORE WIND and BESS OP are visible and clickable.",
        "3. Toggle TOOLS OFF and confirm the collapsed tools button does not cover energy layer buttons.",
        "4. Toggle TOOLS ON and confirm the expanded tools group sits lower.",
        "5. Confirm MWp sizing input still appears with TOOLS ON and hides with TOOLS OFF.",
        "",
    ]), encoding="utf-8")

    print("V7 mobile tools energy layer clearance fix complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
