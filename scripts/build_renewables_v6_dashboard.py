#!/usr/bin/env python3
"""Read-only structural gate for the maintained standalone V6 dashboard.

V6 is no longer regenerated from V5: doing so silently reintroduced the shared
V5 data loader. V1–V5 remain immutable regression baselines; the maintained V6
file is validated directly.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / "uk_renewables_pipeline" / "dashboard_v6_live.html"


def validate():
    html = DASHBOARD.read_text(encoding="utf-8")
    lower = html.lower()
    required = {
        "standalone V6 title": "UK RENEWABLES PIPELINE V6",
        "same-origin project snapshot": "../dist/major_projects_v6.json",
        "same-origin V6 newspaper": "../dist/major_project_news_v6.json",
        "official publication page": "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
        "analytics gauges": 'id="g3"',
        "newspaper": "ENERGY DAILY",
        "news ALL filter": 'data-mode="ALL"',
        "news solar filter": 'data-mode="SOLAR"',
        "news BESS filter": 'data-mode="BESS"',
        "news consent filter": 'data-mode="CONSENT"',
        "news construction filter": 'data-mode="CONSTRUCTION"',
        "news operational filter": 'data-mode="OPERATIONAL"',
        "news finance filter": 'data-mode="FINANCE"',
        "news search": 'id="newsSearch"',
        "asset status filter": 'id="state"',
        "asset geography filter": 'id="county"',
        "asset search": 'id="assetSearch"',
        "project table": 'id="tbody"',
        "CSV export": 'id="export"',
        "GlobalGrid project ID": "GLOBALGRID PROJECT ID",
        "GlobalGrid development ID": "GLOBALGRID DEVELOPMENT ID",
        "REPD Ref": "REPD REF",
        "REPD update date": "REPD UPDATED",
        "official status": "REPD STATUS",
        "separate news signal": "NEWS SIGNAL",
        "missing official date": "not supplied by REPD",
        "mobile CSS": "@media(max-width:768px)",
    }
    missing = [f"{label}: {token}" for label, token in required.items() if token not in html]
    for lineage in (
        "dashboard.html",
        "dashboard_v2_2026-08-22.html",
        "dashboard_v3_live_2026-08-22.html",
        "dashboard_v4_live.html",
        "dashboard_v5_live.html",
    ):
        if lineage not in html:
            missing.append(f"version-lineage link: {lineage}")
    if "<iframe" in lower:
        missing.append("V6 must not be an iframe")
    if "papaparse" in lower or "papa.parse" in lower:
        missing.append("browser-side CSV parser remains")
    if "assets.publishing.service.gov.uk" in lower:
        missing.append("government asset host remains in browser runtime")
    if "../dist/repd_master.json" in html:
        missing.append("shared V1–V5 REPD master remains in V6")
    if "../dist/major_project_news_v5.json" in html:
        missing.append("unsafe V5 news fallback remains")
    if "</html>" not in lower:
        missing.append("closing HTML missing")
    if missing:
        raise RuntimeError("V6 dashboard structural gate failed:\n - " + "\n - ".join(missing))
    print("V6 DASHBOARD STRUCTURAL PASS", len(html.encode("utf-8")), "bytes")


if __name__ == "__main__":
    validate()
