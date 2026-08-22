#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "uk_renewables_pipeline"
DIST = ROOT / "dist"
REPORT = DIST / "renewables_v6_integrity.json"

FILES = {
    "v1": PIPE / "dashboard.html",
    "v2": PIPE / "dashboard_v2_2026-08-22.html",
    "v3": PIPE / "dashboard_v3_live_2026-08-22.html",
    "v4": PIPE / "dashboard_v4_live.html",
    "v5": PIPE / "dashboard_v5_live.html",
    "v6": PIPE / "dashboard_v6_live.html",
}

REPD = DIST / "repd_master.json"
MANIFEST = DIST / "manifest_v4.json"
V5_NEWS = DIST / "major_project_news_v5.json"
V6_NEWS = DIST / "major_project_news_v6.json"
V6_PROJECTS = DIST / "major_projects_v6.json"

SOLAR_MIN_EXCLUSIVE = 1.0
BESS_MIN_EXCLUSIVE = 100.0
REQUIRED_PRIORITY_SOURCES = {
    "DESNZ / GOV.UK",
    "Planning Inspectorate",
    "BBC",
    "Solar Power Portal",
    "Energy-Storage.News",
    "PV Magazine",
}
FOREIGN = {
    "new jersey", "texas", "australia", "canada", "germany", "italy", "spain", "india", "china",
    "south africa", "new zealand", "ireland", "united states", "new york", "arizona", "nevada", "florida", "ohio", "virginia",
}

errors = []
checks = []


def check(condition, label, detail=""):
    checks.append({"gate": label, "pass": bool(condition), "detail": detail})
    if not condition:
        errors.append(f"{label}: {detail}" if detail else label)


def load_json(path):
    if not path.exists():
        errors.append(f"missing JSON: {path.relative_to(ROOT)}")
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {path.relative_to(ROOT)}: {exc}")
        return {}


def clean(v):
    return str(v or "").strip()


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower())).strip()


# ---------- Structural integrity: V1 -> V6 ----------
texts = {}
sizes = {}
for version, path in FILES.items():
    if not path.exists():
        errors.append(f"missing {version}: {path.relative_to(ROOT)}")
        continue
    text = path.read_text(encoding="utf-8")
    texts[version] = text
    sizes[version] = len(text.encode("utf-8"))
    check("</html>" in text.lower(), f"{version} closing HTML", f"{sizes[version]} bytes")

v6 = texts.get("v6", "")
required_v6 = {
    "Chart.js": "cdn.jsdelivr.net/npm/chart.js",
    "REPD master loader": "../dist/repd_master.json",
    "V6 newspaper loader": "../dist/major_project_news_v6.json",
    "three gauges": 'id="g3"',
    "technology filters": 'data-tech="Solar"',
    "status filters": 'data-status="Operational"',
    "county filter": 'id="county"',
    "site/operator search": "SEARCH OPERATOR OR SITE",
    "REPD table": 'id="tbody"',
    "CSV export": "EXPORT CSV",
    "large newspaper": "GLOBALGRID2050 <span>ENERGY DAILY</span>",
    "news signal": "NEWS SIGNAL",
    "official status": "REPD STATUS",
    "status disclaimer": "not REPD-confirmed",
    "mobile layout": "@media(max-width:768px)",
    "REPD reference column": "REPD REF",
    "REPD update-date column": "REPD UPDATED",
    "REPD reference binding": "repdRef",
    "REPD update binding": "repdUpdated",
    "V5 lineage link": "dashboard_v5_live.html",
    "V1-V5 lineage statement": "V1–V5 behaviour retained.",
    "1MW solar newspaper threshold": "solar &gt;1 MWp",
}
for label, token in required_v6.items():
    check(token in v6, f"V6 feature: {label}", token)
check("<iframe" not in v6.lower(), "V6 standalone no iframe")
if all(k in sizes for k in ("v1", "v2", "v3", "v4", "v5", "v6")):
    check(sizes["v6"] >= sizes["v5"], "V6 not truncated versus V5", f"V5={sizes['v5']} V6={sizes['v6']}")
    check(sizes["v6"] > sizes["v2"] * 3, "V6 not wrapper-sized versus V2", f"V2={sizes['v2']} V6={sizes['v6']}")
    check(sizes["v6"] >= min(sizes["v3"], sizes["v4"]), "V6 standalone floor versus V3/V4", f"V3={sizes['v3']} V4={sizes['v4']} V6={sizes['v6']}")

# ---------- Official DESNZ / GOV.UK source gates ----------
repd = load_json(REPD)
manifest = load_json(MANIFEST)
features = repd.get("features") or []
check(repd.get("schema") == "globalgrid2050.repd-master.v6", "REPD master V6 schema", clean(repd.get("schema")))
check(len(features) > 100, "REPD master non-trivial quantity", f"features={len(features)}")
check(int(manifest.get("schema_version") or 0) >= 6, "REPD manifest schema version", clean(manifest.get("schema_version")))
check("Department for Energy Security and Net Zero" in clean(manifest.get("source_owner")), "DESNZ ownership", clean(manifest.get("source_owner")))
check(clean(manifest.get("source_page")) == "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract", "Official GOV.UK quarterly source page", clean(manifest.get("source_page")))
check(urlparse(clean(manifest.get("source_url"))).netloc == "assets.publishing.service.gov.uk", "Official DESNZ CSV host", clean(manifest.get("source_url")))
check(clean(manifest.get("source_url")).lower().endswith(".csv"), "Official DESNZ CSV file", clean(manifest.get("source_url")))
check(urlparse(clean(manifest.get("source_excel_url"))).netloc == "assets.publishing.service.gov.uk", "Official DESNZ Excel host", clean(manifest.get("source_excel_url")))
check(clean(manifest.get("source_excel_url")).lower().endswith(".xlsx"), "Official DESNZ Excel file", clean(manifest.get("source_excel_url")))
check("Renewable Energy Planning Database" in clean(manifest.get("source_dataset_title")), "REPD dataset edition title", clean(manifest.get("source_dataset_title")))
check(bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean(manifest.get("source_page_last_updated")))), "GOV.UK page update date captured", clean(manifest.get("source_page_last_updated")))
if "Q2_2026" in clean(manifest.get("source_url")):
    check(clean(manifest.get("source_page_last_updated")) == "2026-08-03", "July 2026 DESNZ publication date", clean(manifest.get("source_page_last_updated")))

# ---------- REPD project identity and quantity gates ----------
ref_map = {}
missing_refs = 0
missing_dates = 0
for feature in features:
    p = feature.get("properties") or {}
    ref = clean(p.get("repd_ref"))
    updated = clean(p.get("repd_record_updated"))
    if not ref:
        missing_refs += 1
        continue
    if ref in ref_map:
        errors.append(f"duplicate REPD Ref ID in master: {ref}")
    ref_map[ref] = p
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", updated):
        missing_dates += 1
check(missing_refs == 0, "100% REPD Ref ID coverage", f"missing={missing_refs}")
check(missing_dates == 0, "100% REPD record-update coverage", f"missing/invalid={missing_dates}")

eligible = {}
eligible_solar = 0
eligible_bess = 0
for ref, p in ref_map.items():
    try:
        mw = float(p.get("capacity") or 0)
    except Exception:
        continue
    tech = clean(p.get("tech"))
    if tech in {"solar", "solar_roof"} and mw > SOLAR_MIN_EXCLUSIVE:
        eligible[ref] = p
        eligible_solar += 1
    elif tech == "bess" and mw > BESS_MIN_EXCLUSIVE:
        eligible[ref] = p
        eligible_bess += 1
check(len(eligible) > 0, "V6 eligible REPD universe exists", f"eligible={len(eligible)}")

projects = load_json(V6_PROJECTS)
project_rows = projects.get("projects") or []
check(projects.get("repd_bound") is True, "V6 project universe REPD-bound")
check((projects.get("thresholds") or {}).get("solar_mw_exclusive") == 1.0, "V6 solar threshold >1MW", str((projects.get("thresholds") or {}).get("solar_mw_exclusive")))
check((projects.get("thresholds") or {}).get("bess_mw_exclusive") == 100.0, "V6 BESS threshold >100MW", str((projects.get("thresholds") or {}).get("bess_mw_exclusive")))
check(int(projects.get("count") or -1) == len(eligible), "V6 eligible count equals REPD recomputation", f"json={projects.get('count')} repd={len(eligible)}")
check(int(projects.get("solar_count") or -1) == eligible_solar, "V6 solar count equals REPD", f"json={projects.get('solar_count')} repd={eligible_solar}")
check(int(projects.get("bess_count") or -1) == eligible_bess, "V6 BESS count equals REPD", f"json={projects.get('bess_count')} repd={eligible_bess}")
check(len(project_rows) == len(eligible), "V6 project array quantity exact", f"rows={len(project_rows)} eligible={len(eligible)}")

for row in project_rows:
    ref = clean(row.get("repd_ref"))
    p = eligible.get(ref)
    if not p:
        errors.append(f"V6 project not in eligible REPD universe: {ref} {row.get('name')}")
        continue
    if clean(row.get("repd_record_updated")) != clean(p.get("repd_record_updated")):
        errors.append(f"V6 project REPD update-date mismatch: {ref}")

# Expanded >1MW solar universe should be materially larger than V5's >49MW universe.
v5_news = load_json(V5_NEWS) if V5_NEWS.exists() else {}
v5_eligible = v5_news.get("eligible_projects")
if isinstance(v5_eligible, int) and v5_eligible > 0:
    check(len(eligible) > v5_eligible, "V6 universe expands beyond V5", f"V5={v5_eligible} V6={len(eligible)}")

# ---------- Newspaper quality + quantity gates ----------
news = load_json(V6_NEWS)
items = news.get("items") or []
check(news.get("repd_bound") is True, "V6 newspaper REPD-bound")
check(int(news.get("eligible_projects") or -1) == len(eligible), "Newspaper eligible count exact", f"json={news.get('eligible_projects')} repd={len(eligible)}")
check(int(news.get("headline_count") or -1) == len(items), "Headline count metadata exact", f"json={news.get('headline_count')} rows={len(items)}")
check((news.get("thresholds") or {}).get("solar_mw_exclusive") == 1.0, "Newspaper solar threshold >1MW")
check((news.get("thresholds") or {}).get("bess_mw_exclusive") == 100.0, "Newspaper BESS threshold >100MW")
check(int(news.get("lookback_days") or 0) <= 183, "Newspaper horizon no more than six months", f"days={news.get('lookback_days')}")
check(REQUIRED_PRIORITY_SOURCES.issubset(set(news.get("priority_sources") or [])), "All mandated news/government sources configured", str(sorted(set(news.get('priority_sources') or []))))

v5_headlines = int(v5_news.get("headline_count") or 0)
minimum_headlines = max(20, min(50, round(v5_headlines * 0.30))) if v5_headlines else 20
check(len(items) >= minimum_headlines, "Headline quantity floor", f"headlines={len(items)} minimum={minimum_headlines} V5={v5_headlines}")

official_actual = 0
seen_headlines = set()
for idx, item in enumerate(items):
    ref = clean(item.get("repd_ref"))
    p = eligible.get(ref)
    if not p:
        errors.append(f"headline {idx} not tied to eligible official REPD Ref ID: {ref}")
        continue
    if clean(item.get("project_id")) != ref:
        errors.append(f"headline {idx} project_id is not official REPD Ref ID: {item.get('project_id')} vs {ref}")
    if clean(item.get("repd_record_updated")) != clean(p.get("repd_record_updated")):
        errors.append(f"headline {idx} REPD record date mismatch for ref {ref}")
    try:
        cap_delta = abs(float(item.get("capacity_mw") or 0) - float(p.get("capacity") or 0))
        if cap_delta > 0.01:
            errors.append(f"headline {idx} capacity mismatch for ref {ref}: delta {cap_delta}")
    except Exception:
        errors.append(f"headline {idx} invalid capacity for ref {ref}")
    if not clean(item.get("headline")) or not clean(item.get("url")) or not clean(item.get("source")):
        errors.append(f"headline {idx} missing headline/url/source for ref {ref}")
    if int(item.get("confidence") or 0) < 68:
        errors.append(f"headline {idx} below confidence floor for ref {ref}: {item.get('confidence')}")

    hk = norm(item.get("headline"))
    if hk in seen_headlines:
        errors.append(f"duplicate newspaper headline: {item.get('headline')}")
    seen_headlines.add(hk)

    combined = norm(clean(item.get("headline")) + " " + clean(item.get("source")) + " " + clean(item.get("source_url")))
    project_name = norm(item.get("project"))
    leaked = [place for place in FOREIGN if norm(place) in combined and norm(place) not in project_name]
    if leaked:
        errors.append(f"foreign-location leakage for REPD {ref}: {leaked} :: {item.get('headline')}")

    source_text = norm(clean(item.get("source")) + " " + clean(item.get("source_url")))
    if any(x in source_text for x in ("gov uk", "planning inspectorate", "planninginspectorate")):
        official_actual += 1

check(official_actual >= 1, "At least one DESNZ/GOV.UK or Planning Inspectorate headline", f"official={official_actual}")
check(int(news.get("official_source_headlines") or -1) == official_actual, "Official-source headline metadata exact", f"json={news.get('official_source_headlines')} actual={official_actual}")

report = {
    "schema": "globalgrid2050.renewables-v6-integrity.v1",
    "generated": datetime.now(timezone.utc).isoformat(),
    "status": "PASS" if not errors else "FAIL",
    "version_file_bytes": sizes,
    "lineage": {
        "v1": "original standalone dashboard",
        "v2": "historical iframe wrapper",
        "v3": "standalone recovery",
        "v4": "REPD auto-news",
        "v5": "large daily newspaper + news signal",
        "v6": "V5 gospel + official REPD reference/date binding + expanded >1MW solar search",
    },
    "repd": {
        "features": len(features),
        "eligible_v6": len(eligible),
        "eligible_solar": eligible_solar,
        "eligible_bess": eligible_bess,
        "source_owner": manifest.get("source_owner"),
        "source_page": manifest.get("source_page"),
        "source_csv": manifest.get("source_url"),
        "source_excel": manifest.get("source_excel_url"),
        "edition": manifest.get("source_dataset_title"),
        "page_last_updated": manifest.get("source_page_last_updated"),
    },
    "newspaper": {
        "headlines": len(items),
        "quantity_floor": minimum_headlines,
        "official_source_headlines": official_actual,
        "lookback_days": news.get("lookback_days"),
    },
    "checks": checks,
    "errors": errors,
}
REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
if errors:
    print(f"V6 INTEGRITY FAIL: {len(errors)} error(s)", file=sys.stderr)
    sys.exit(1)
print("V6 INTEGRITY PASS: V1-V5 lineage, DESNZ REPD identity, quantity and news-quality gates all passed.")
