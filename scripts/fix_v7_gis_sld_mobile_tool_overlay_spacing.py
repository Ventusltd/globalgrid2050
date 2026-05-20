#!/usr/bin/env python3
"""
Lower the V7 GIS SLD mobile map tools overlay so it no longer overlaps
solar, wind, BESS and voltage layer toggles.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "gis-sld-v5.css"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "fix_v7_gis_sld_mobile_tool_overlay_spacing.md"

MARKER = "/* GLOBALGRID2050 V7 MOBILE TOOL OVERLAY SPACING FIX */"
PATCH = r'''

/* GLOBALGRID2050 V7 MOBILE TOOL OVERLAY SPACING FIX */
@media (max-width: 900px) {
  .map-tool-overlay {
    top: 210px !important;
    left: 10px;
    right: 10px;
    max-width: none;
  }

  .panel-right.map-expanded .map-tool-overlay,
  body.map-expanded .map-tool-overlay {
    top: 210px !important;
  }
}

@media (max-width: 520px) {
  .map-tool-overlay {
    top: 225px !important;
  }

  .panel-right.map-expanded .map-tool-overlay,
  body.map-expanded .map-tool-overlay {
    top: 225px !important;
  }

  .map-tool-overlay.tools-collapsed {
    top: 255px !important;
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
        actions.append("added mobile overlay spacing override")
    else:
        actions.append("mobile overlay spacing override already present")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Fix V7 GIS SLD Mobile Tool Overlay Spacing",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Move the map tools overlay lower on mobile so the solar, wind, BESS and voltage toggles remain visible and usable.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD on mobile.",
        "2. Confirm the voltage toggles and operating asset toggles remain visible.",
        "3. Confirm the tools row sits lower and no longer blocks the solar, wind or BESS toggles.",
        "4. Toggle TOOLS OFF and ON and confirm layout remains usable.",
        "",
    ]), encoding="utf-8")

    print("V7 mobile tool overlay spacing fix complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
