#!/usr/bin/env python3
"""
Add external analysis tool links to V6 and V7 dashboards.

This script does not move or copy existing apps.
It only adds dashboard cards and supporting function notes to:
- solar-bess-topology-v6/index.html
- solar-bess-topology-v7/index.html
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "gridbot_reports"
REPORT = REPORTS / "add_v6_v7_external_analysis_dashboard_links.md"

TARGETS = [
    ("V6", ROOT / "solar-bess-topology-v6" / "index.html"),
    ("V7", ROOT / "solar-bess-topology-v7" / "index.html"),
]

REQUIRED_EXISTING_PATHS = [
    ROOT / "uk_renewables_pipeline" / "dashboard.html",
    ROOT / "33kv_uk_dap_price_estimator",
    ROOT / "lv_ac_dc_price_estimator",
    ROOT / "power_systems_studies",
    ROOT / "mv_and_hv_components",
]

CARDS = [
    {
        "href": "../uk_renewables_pipeline/dashboard.html",
        "title": "UK Renewables Pipeline Dashboard",
        "description": "Pipeline analytics dashboard for UK renewables screening, market context and project opportunity review.",
    },
    {
        "href": "../33kv_uk_dap_price_estimator/",
        "title": "33 kV UK DAP Price Estimator",
        "description": "Early 33 kV distribution cable pricing reference for commercial and procurement screening.",
    },
    {
        "href": "../lv_ac_dc_price_estimator/",
        "title": "LV AC and DC Cable Price Estimator",
        "description": "Low voltage AC and DC distribution cable price reference for early commercial screening.",
    },
    {
        "href": "../power_systems_studies/",
        "title": "Power Systems Studies Process",
        "description": "Power systems study process reference, including Braintree EV charging case study context by VENTUS Ltd UK and Studer Cables Switzerland.",
    },
    {
        "href": "../mv_and_hv_components/",
        "title": "MV and HV Connection Process",
        "description": "Medium voltage and high voltage component and connection process reference for grid connection review.",
    },
]

FUNCTIONS = [
    {
        "number": 16,
        "title": "Renewables pipeline context",
        "description": "Open UK renewables pipeline analysis to compare site screening work against wider market and project pipeline context.",
    },
    {
        "number": 17,
        "title": "Cable price screening",
        "description": "Use 33 kV, LV AC and DC cable price references to connect early topology assumptions with commercial procurement awareness.",
    },
    {
        "number": 18,
        "title": "Power systems study process",
        "description": "Use the power systems studies reference to understand which formal studies sit beyond early V6 and V7 screening outputs.",
    },
    {
        "number": 19,
        "title": "MV and HV connection pathway",
        "description": "Use the MV and HV component reference to connect early site and grid screening with the practical connection process.",
    },
]

CARD_FALLBACK_MARKER = '''            <a class="card" href="./cable-geometry-visualiser/index.html">
                <h2>Cable Geometry Visualiser</h2>
                <p>Cable formation, trench, bend and geometry visualiser.</p>
                <span>Open app</span>
            </a>'''

ATLAS_CARD_TITLE = "UK Energy Atlas V8"
FUNCTION_FALLBACK_MARKER = '''            <div class="function-item"><h3>14. Commercial engineering linkage</h3><p>Connect topology, cable distance, grid proximity and losses to CAPEX, revenue, profit, cashflow and IRR sensitivity.</p></div>'''


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def card_html(card: dict[str, str]) -> str:
    return f'''
            <a class="card" href="{card["href"]}">
                <h2>{card["title"]}</h2>
                <p>{card["description"]}</p>
                <span>Open app</span>
            </a>'''


def function_html(version: str, item: dict[str, object]) -> str:
    return f'''
            <div class="function-item"><h3>{item["number"]}. {item["title"]}</h3><p>{item["description"]}</p></div>'''


def find_card_insert_anchor(html: str) -> str:
    if ATLAS_CARD_TITLE in html:
        atlas_start = html.rfind('            <a class="card"', 0, html.find(ATLAS_CARD_TITLE))
        atlas_end = html.find("            </a>", html.find(ATLAS_CARD_TITLE))
        if atlas_start != -1 and atlas_end != -1:
            return html[atlas_start:atlas_end + len("            </a>")]
    if CARD_FALLBACK_MARKER in html:
        return CARD_FALLBACK_MARKER
    raise SystemExit("No safe card insertion anchor found")


def find_function_insert_anchor(html: str) -> str:
    for num in range(19, 13, -1):
        token = f"<h3>{num}. "
        idx = html.rfind(token)
        if idx != -1:
            start = html.rfind('            <div class="function-item"', 0, idx)
            end = html.find("</div>", idx)
            if start != -1 and end != -1:
                return html[start:end + len("</div>")]
    if FUNCTION_FALLBACK_MARKER in html:
        return FUNCTION_FALLBACK_MARKER
    raise SystemExit("No safe function insertion anchor found")


def update_dashboard(version: str, path: Path) -> list[str]:
    if not path.exists():
        raise SystemExit(f"Missing dashboard for {version}: {path}")

    html = read(path)
    actions: list[str] = []

    anchor = find_card_insert_anchor(html)
    additions = []
    for card in CARDS:
        if card["href"] not in html and card["title"] not in html:
            additions.append(card_html(card))
            actions.append(f"{version}: added card {card['title']}")
        else:
            actions.append(f"{version}: card already present {card['title']}")

    if additions:
        html = html.replace(anchor, anchor + "".join(additions), 1)

    function_anchor = find_function_insert_anchor(html)
    function_additions = []
    for item in FUNCTIONS:
        token = f"{item['number']}. {item['title']}"
        if token not in html:
            function_additions.append(function_html(version, item))
            actions.append(f"{version}: added function {token}")
        else:
            actions.append(f"{version}: function already present {token}")

    if function_additions:
        html = html.replace(function_anchor, function_anchor + "".join(function_additions), 1)

    write(path, html)
    return actions


def main() -> int:
    missing = [str(p.relative_to(ROOT)) for p in REQUIRED_EXISTING_PATHS if not p.exists()]
    if missing:
        raise SystemExit("Missing expected existing app paths: " + ", ".join(missing))

    all_actions: list[str] = []
    for version, path in TARGETS:
        all_actions.extend(update_dashboard(version, path))

    REPORTS.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat()
    report = "\n".join([
        "# Add External Analysis Links To V6 And V7 Dashboards",
        "",
        f"UTC created: {timestamp}",
        "",
        "## Purpose",
        "",
        "Add existing GlobalGrid2050 analysis tools to the V6 and V7 dashboards without moving or duplicating their source folders.",
        "",
        "## Added linked tools",
        "",
        "- UK Renewables Pipeline Dashboard",
        "- 33 kV UK DAP Price Estimator",
        "- LV AC and DC Cable Price Estimator",
        "- Power Systems Studies Process and Braintree EV case study context",
        "- MV and HV Connection Process",
        "",
        "## Actions",
        "",
        *[f"- {action}" for action in all_actions],
        "",
        "## Test links",
        "",
        "- `/solar-bess-topology-v6/`",
        "- `/solar-bess-topology-v7/`",
        "- `/uk_renewables_pipeline/dashboard.html`",
        "- `/33kv_uk_dap_price_estimator/`",
        "- `/lv_ac_dc_price_estimator/`",
        "- `/power_systems_studies/`",
        "- `/mv_and_hv_components/`",
        "",
    ])
    write(REPORT, report)
    print(f"Updated V6 and V7 dashboards. Report: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
