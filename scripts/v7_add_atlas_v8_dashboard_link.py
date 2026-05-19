#!/usr/bin/env python3
"""
Add Atlas V8 link to V7 dashboard.

This script does not move or copy the Atlas V8 app.
It only adds a V7 dashboard card and a supporting engineering function note.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V7_INDEX = ROOT / "solar-bess-topology-v7" / "index.html"
ATLAS_INDEX = ROOT / "repd_grid_atlasv8" / "index.html"
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "v7_add_atlas_v8_dashboard_link.md"

ATLAS_CARD = '''
            <a class="card" href="../repd_grid_atlasv8/">
                <h2>UK Energy Atlas V8</h2>
                <p>Standalone UK grid, renewables pipeline and infrastructure atlas for wider spatial and grid screening analysis.</p>
                <span>Open app</span>
            </a>'''

CARD_MARKER = '''            <a class="card" href="./cable-geometry-visualiser/index.html">
                <h2>Cable Geometry Visualiser</h2>
                <p>Cable formation, trench, bend and geometry visualiser.</p>
                <span>Open app</span>
            </a>'''

FUNCTION_ITEM = '''
            <div class="function-item"><h3>15. Atlas V8 wider grid analysis</h3><p>Open the standalone Atlas V8 app for wider UK grid, infrastructure, project pipeline and spatial screening analysis alongside the V7 solar BESS tools.</p></div>'''

FUNCTION_MARKER = '''            <div class="function-item"><h3>14. Commercial engineering linkage</h3><p>Connect topology, cable distance, grid proximity and losses to CAPEX, revenue, profit, cashflow and IRR sensitivity.</p></div>'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def main() -> int:
    if not V7_INDEX.exists():
        raise SystemExit(f"Missing V7 dashboard: {V7_INDEX}")
    if not ATLAS_INDEX.exists():
        raise SystemExit(f"Missing Atlas V8 app: {ATLAS_INDEX}")

    html = read(V7_INDEX)
    actions: list[str] = []

    if "../repd_grid_atlasv8/" not in html:
        if CARD_MARKER not in html:
            raise SystemExit("Cable Geometry Visualiser card marker not found in V7 dashboard")
        html = html.replace(CARD_MARKER, CARD_MARKER + ATLAS_CARD)
        actions.append("Added UK Energy Atlas V8 card after Cable Geometry Visualiser card")
    else:
        actions.append("Atlas V8 card already present")

    if "15. Atlas V8 wider grid analysis" not in html:
        if FUNCTION_MARKER not in html:
            raise SystemExit("Commercial engineering linkage function marker not found in V7 dashboard")
        html = html.replace(FUNCTION_MARKER, FUNCTION_MARKER + FUNCTION_ITEM)
        actions.append("Added Atlas V8 wider grid analysis as engineering function 15")
    else:
        actions.append("Atlas V8 engineering function already present")

    write(V7_INDEX, html)

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# V7 Add Atlas V8 Dashboard Link",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Add a V7 dashboard link to the existing standalone Atlas V8 application without moving or duplicating the Atlas folder.",
        "",
        "## Target",
        "",
        "- Dashboard: `solar-bess-topology-v7/index.html`",
        "- Linked app: `repd_grid_atlasv8/`",
        "",
        "## Actions",
        "",
        *[f"- {action}" for action in actions],
        "",
        "## Test links",
        "",
        "- `/solar-bess-topology-v7/`",
        "- `/repd_grid_atlasv8/`",
        "",
    ])
    write(REPORT, report)
    print(f"V7 dashboard Atlas V8 link update complete. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
