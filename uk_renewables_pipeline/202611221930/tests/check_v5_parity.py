#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
V7 = ROOT / "uk_renewables_pipeline/v7"
FAILURES: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    if not condition:
        FAILURES.append(f"{name}: {detail}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def title_case(value: str) -> str:
    return " ".join(word[:1].upper() + word[1:].lower() for word in value.split(" "))


def project_fixture() -> None:
    geojson = json.loads((ROOT / "dist/repd_master.json").read_text(encoding="utf-8"))
    rows: list[dict[str, object]] = []
    counties: set[str] = set()
    for feature in geojson.get("features", []):
        properties = feature.get("properties") or {}
        try:
            capacity = float(properties.get("capacity") or 0)
        except (TypeError, ValueError):
            capacity = 0
        if capacity < 1:
            continue
        raw = str(properties.get("raw_tech") or "").lower()
        technology = properties.get("tech")
        if technology in {"solar", "solar_roof"}:
            category = "Solar"
        elif technology == "bess":
            category = "Battery Storage"
        elif technology == "wind":
            category = "Offshore Wind" if "offshore" in raw else "Onshore Wind"
        else:
            continue
        county = title_case(str(
            properties.get("county")
            or properties.get("County")
            or properties.get("lpa")
            or properties.get("local_planning_authority")
            or properties.get("region")
            or ""
        ).strip())
        if county.lower() in {"nan", "none"}:
            county = ""
        if county:
            counties.add(county)
        rows.append({"name": properties.get("name") or "Unknown Site", "cat": category, "mw": capacity})

    expected = {
        "Solar": (2667, 52866.1, 840.0),
        "Battery Storage": (1271, 126959.4, 1450.0),
        "Onshore Wind": (1192, 36107.9, 525.0),
        "Offshore Wind": (80, 46463.4, 4100.0),
    }
    check("legacy project row count", len(rows) == 5210, str(len(rows)))
    check("legacy populated county count", len(counties) == 152, str(len(counties)))
    check("legacy total capacity", abs(sum(float(row["mw"]) for row in rows) - 262396.8) < 0.05)
    check("legacy descending largest", max(float(row["mw"]) for row in rows) == 4100.0)
    for category, (count, capacity, largest) in expected.items():
        selected = [row for row in rows if row["cat"] == category]
        check(f"{category} count", len(selected) == count, str(len(selected)))
        check(
            f"{category} capacity",
            abs(sum(float(row["mw"]) for row in selected) - capacity) < 0.05,
            str(sum(float(row["mw"]) for row in selected)),
        )
        check(f"{category} largest", max(float(row["mw"]) for row in selected) == largest)


def news_fixture() -> None:
    payload = json.loads((ROOT / "dist/major_project_news_v5.json").read_text(encoding="utf-8"))
    items = payload.get("items") or []
    technology = Counter(str(item.get("technology") or "").lower() for item in items)
    events = Counter(str(item.get("event") or "").upper() for item in items)
    expected_events = {
        "CONSENT": 21,
        "CONSTRUCTION": 9,
        "OPERATIONAL": 1,
        "FINANCIAL CLOSE": 16,
        "ACQUISITION": 18,
        "PROJECT UPDATE": 60,
    }
    check("V5 headline count", payload.get("headline_count") == 125 and len(items) == 125)
    check("V5 eligible count", payload.get("eligible_projects") == 559)
    check("V5 horizon", payload.get("lookback_days") == 366)
    check("V5 solar stories", technology["solar"] == 69, str(technology))
    check("V5 BESS stories", technology["bess"] == 56, str(technology))
    for event, count in expected_events.items():
        check(f"V5 {event} stories", events[event] == count, str(events))
    check("V5 finance-filter fixture", events["FINANCIAL CLOSE"] + events["ACQUISITION"] == 34)


def interface_fixture() -> None:
    index = (V7 / "index.html").read_text(encoding="utf-8")
    expected_ids = {
        "county", "export", "g1", "g2", "g3", "v1", "v2", "v3", "newsMeta", "newsSearch",
        "newsTools", "search", "status", "stories", "tbody", "tech",
    }
    ids = set(re.findall(r'\bid="([^"]+)"', index))
    check("required DOM IDs", expected_ids <= ids, str(sorted(expected_ids - ids)))
    check("news control count", len(re.findall(r"\bdata-news=", index)) == 7)
    check("technology control count", len(re.findall(r"\bdata-tech=", index)) == 5)
    check("status control count", len(re.findall(r"\bdata-status=", index)) == 5)
    check("table column count", len(re.findall(r"<th(?:\s|>)", index)) == 8)
    check("Chart.js dependency", "https://cdn.jsdelivr.net/npm/chart.js" in index)
    check("V7.1 release label", "V7.1" in index)
    check("no page-level inline CSS", "<style>" not in index)
    check("no inline JavaScript", not re.search(r"<script(?![^>]*\bsrc=)[^>]*>", index))
    expected_links = [
        "../dashboard_v6_live.html", "../dashboard_v5_live.html", "../dashboard_v4_live.html",
        "../dashboard_v3_live_2026-08-22.html", "../dashboard_v2_2026-08-22.html", "../dashboard.html",
        "../../index.html", "../../repd_grid_atlasv8/",
    ]
    for link in expected_links:
        check(f"navigation link {link}", f'href="{link}"' in index)


def module_fixture() -> None:
    expected_css = "036dbfe43ef1ffb2c55ba277d49dec57ab7c7be976289226a5d568e1f1be319d"
    check("exact V5 CSS extraction", sha256(V7 / "styles/v7.css") == expected_css, sha256(V7 / "styles/v7.css"))
    state_source = (V7 / "scripts/core/state.js").read_text(encoding="utf-8")
    newspaper = (V7 / "scripts/plugins/newspaper.js").read_text(encoding="utf-8")
    projects = (V7 / "scripts/plugins/projects.js").read_text(encoding="utf-8")
    filters = (V7 / "scripts/plugins/project-filters.js").read_text(encoding="utf-8")
    table = (V7 / "scripts/plugins/project-table.js").read_text(encoding="utf-8")
    export = (V7 / "scripts/plugins/project-export.js").read_text(encoding="utf-8")
    app = (V7 / "scripts/app.js").read_text(encoding="utf-8")
    plugin_manifest = json.loads((V7 / "data/plugin_manifest.json").read_text(encoding="utf-8"))
    for path in ("../../dist/repd_master.json", "../../dist/major_project_news_v5.json"):
        check(f"same-origin path {path}", path in state_source)
    check("raw GitHub news fallback", "raw.githubusercontent.com/Ventusltd/globalgrid2050/main" in state_source)
    check("parallel news source collection", "Promise.allSettled" in newspaper)
    check("newest news edition selection", "payloadTime(right.data) - payloadTime(left.data)" in newspaper)
    check("news redraws loaded projects", "if (state.all.length) refreshProjects();" in newspaper)
    check("independent news load", "loadNews();" in app)
    check("independent project load", "loadProjects();" in app)
    check("stable plugin manifest version", plugin_manifest.get("version") == "7.1")
    check(
        "stable plugin order",
        [plugin.get("id") for plugin in plugin_manifest.get("plugins", [])] == ["gauges", "newspaper", "projects"],
    )
    check("plugin host entrypoint", "startPlugins([" in app)
    check("one-MW display floor", "if (mw < 1) return null;" in projects)
    check("descending-capacity rows", "right.mw - left.mw" in projects)
    check("filters separated from loader", "applyProjectFilters" in filters and "bindProjectFilters" in filters)
    check("table separated from loader", "drawProjectTable" in table)
    check("export separated from loader", "bindProjectExport" in export)
    check("CSV BOM", "\\ufeff" in export)
    check("zero-result export parity", "state.filtered.length ? state.filtered : state.all" in export)
    check("Google News project link", "google.com/search" in table and "tbm=nws" in table)


def main() -> int:
    interface_fixture()
    module_fixture()
    project_fixture()
    news_fixture()
    if FAILURES:
        print(f"V5 parity: FAIL ({len(FAILURES)} failures)")
        for failure in FAILURES:
            print(f"FAIL: {failure}")
        return 1
    print("V5 parity: PASS (interface, modules, 5,210 projects, 125 headlines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
