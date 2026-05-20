#!/usr/bin/env python3
"""
Fix V7 GIS SLD mobile map control wrapping so ARRAY ON/OFF remains visible.

Issue:
- The ARRAY ON/OFF button exists in index.html.
- On mobile the top map control row can overflow or clip because the row does not take full available width.
- Result: ARRAY ON/OFF can disappear from the visible controls.

Fix:
- Force mobile map control rows to use full width.
- Centre and wrap rows cleanly.
- Give ARRAY ON/OFF a stable visible order.
- Keep PRINT visible but allow wrapping below if needed.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "gis-sld-v5.css"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "fix_v7_gis_sld_mobile_array_toggle_visibility.md"

MARKER = "/* GLOBALGRID2050 V7 MOBILE ARRAY TOGGLE VISIBILITY FIX */"
PATCH = r'''

/* GLOBALGRID2050 V7 MOBILE ARRAY TOGGLE VISIBILITY FIX */
@media (max-width: 900px) {
  .map-controls {
    left: 8px !important;
    right: 8px !important;
    width: auto !important;
    align-items: stretch !important;
  }

  .map-controls > .map-toggle-row {
    width: 100% !important;
    justify-content: center !important;
    align-items: center !important;
    flex-wrap: wrap !important;
  }

  .map-controls .map-toggle-btn {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }

  #btn_subs_toggle { order: 1; }
  #btn_basemap { order: 2; }
  #btn_map_expand { order: 3; }
  #btn_key_toggle { order: 4; }
  #btn_array_toggle { order: 5; }
  #btn_print_report { order: 6; }

  #btn_array_toggle {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    visibility: visible !important;
    border-color: #00ff88 !important;
    color: #00ff88 !important;
    min-width: 92px !important;
  }
}

@media (max-width: 520px) {
  .map-controls {
    top: 8px !important;
    gap: 7px !important;
  }

  .map-controls > .map-toggle-row:first-child {
    display: grid !important;
    grid-template-columns: repeat(3, max-content) !important;
    justify-content: center !important;
    gap: 7px !important;
  }

  #btn_array_toggle {
    grid-column: auto !important;
  }

  #btn_print_report {
    grid-column: auto !important;
  }

  .voltage-toggle-row,
  .asset-toggle-row {
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
        actions.append("added mobile array toggle visibility and row wrapping override")
    else:
        actions.append("mobile array toggle visibility fix already present")

    REPORTS.mkdir(parents=True, exist_ok=True)
    REPORT.write_text("\n".join([
        "# Fix V7 GIS SLD Mobile Array Toggle Visibility",
        "",
        f"UTC created: {dt.datetime.now(dt.timezone.utc).isoformat()}",
        "",
        "## Purpose",
        "",
        "Make ARRAY ON/OFF visible on mobile by forcing the top map control row to use full width and wrap cleanly.",
        "",
        "## Actions",
        "",
        *[f"- {a}" for a in actions],
        "",
        "## Manual acceptance test",
        "",
        "1. Open V7 GIS SLD on mobile.",
        "2. Confirm ARRAY ON is visible beside the main map controls.",
        "3. Toggle ARRAY OFF and confirm the generated array disappears.",
        "4. Toggle ARRAY ON and confirm it returns.",
        "5. Confirm voltage and operating asset toggles remain visible below the first row.",
        "",
    ]), encoding="utf-8")

    print("V7 mobile array toggle visibility fix complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
