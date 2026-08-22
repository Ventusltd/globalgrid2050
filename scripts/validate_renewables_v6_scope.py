#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone, timedelta
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
BASELINE_BLOBS = {
    "v1": "e2d99e37d6388d3f498a79696773238ad689574b",
    "v2": "cb953a67332d3d29355945fb58a513e30c681013",
    "v3": "911921e7aa254f0bfdecc122d975cc0e3af130c7",
    "v4": "f356b37b1c6202150f3a5bb404a57ee329212f70",
    "v5": "ac33daf67dba8951527b06761ab587003a19f60e",
}

MASTER = DIST / "repd_master.json"
MANIFEST = DIST / "manifest_v4.json"
PROJECTS = DIST / "major_projects_v6.json"
NEWS = DIST / "major_project_news_v6.json"
IDENTITY_REPORT = DIST / "project_identity_v6_integrity.json"
SOURCE_REPORT = DIST / "repd_source_reconciliation_v6.json"
LINKS = DIST / "project_news_links_v6.json"

SOLAR_MIN_EXCLUSIVE = 1.0
BESS_MIN_EXCLUSIVE = 100.0
MIN_UPDATE_COVERAGE = 0.99
MIN_CONFIDENCE = 68
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
    "south africa", "new zealand", "ireland", "united states", "new york", "arizona", "nevada",
    "florida", "ohio", "virginia", "new south wales", "queensland", "alberta", "ontario canada",
    "massachusetts", "pennsylvania", "colorado",
}
KNOWN_BAD = {"forest healthcare", "evolution mining", "us roundup", "new jersey board of public utilities"}

errors = []
checks = []


def check(condition, gate, detail=""):
    ok = bool(condition)
    checks.append({"gate": gate, "pass": ok, "detail": detail})
    if not ok:
        errors.append(f"{gate}: {detail}" if detail else gate)


def clean(v):
    return str(v or "").strip()


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower())).strip()


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"cannot load {path.relative_to(ROOT)}: {exc}")
        return {}


def git_blob_sha(path):
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def num(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None


# ---------- immutable lineage / structural integrity ----------
texts = {}
sizes = {}
for version, path in FILES.items():
    check(path.exists(), f"{version} exists", str(path.relative_to(ROOT)))
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    texts[version] = text
    sizes[version] = len(text.encode("utf-8"))
    check("</html>" in text.lower(), f"{version} closing HTML", f"bytes={sizes[version]}")
    if version in BASELINE_BLOBS:
        check(git_blob_sha(path) == BASELINE_BLOBS[version], f"{version} immutable gospel", git_blob_sha(path))

v6 = texts.get("v6", "")
required_tokens = {
    "standalone Chart.js": "cdn.jsdelivr.net/npm/chart.js",
    "REPD loader": "../dist/repd_master.json",
    "V6 news loader": "../dist/major_project_news_v6.json",
    "gauges": 'id="g3"',
    "technology filters": 'data-tech="Solar"',
    "status filters": 'data-status="Operational"',
    "county filter": 'id="county"',
    "asset search": "SEARCH OPERATOR OR SITE",
    "REPD table": 'id="tbody"',
    "CSV export": "EXPORT CSV",
    "newspaper": "GLOBALGRID2050 <span>ENERGY DAILY</span>",
    "news search": "SEARCH HEADLINES / PROJECT / OPERATOR",
    "news signal": "NEWS SIGNAL",
    "REPD status": "REPD STATUS",
    "not REPD confirmed": "not REPD-confirmed",
    "mobile": "@media(max-width:768px)",
    "GlobalGrid ID": "GLOBALGRID ID",
    "GG development": "GG DEVELOPMENT",
    "REPD ref": "REPD REF",
    "REPD updated": "REPD UPDATED",
    "explicit null date display": "not supplied by REPD",
    "GlobalGrid loader binding": "ggProjectId",
    "development loader binding": "ggDevelopmentId",
    "V5 lineage": "dashboard_v5_live.html",
    "V1-V5 statement": "V1–V5 behaviour retained.",
    "solar >1 threshold": "solar &gt;1 MWp",
}
for label, token in required_tokens.items():
    check(token in v6, f"V6 feature: {label}", token)
check("<iframe" not in v6.lower(), "V6 standalone no iframe")
if "v5" in sizes and "v6" in sizes:
    check(sizes["v6"] >= sizes["v5"], "V6 not truncated versus V5", f"V5={sizes['v5']} V6={sizes['v6']}")
if all(k in sizes for k in ("v2", "v3", "v4", "v6")):
    check(sizes["v6"] > sizes["v2"] * 3, "V6 not wrapper-sized versus V2", f"V2={sizes['v2']} V6={sizes['v6']}")
    check(sizes["v6"] >= min(sizes["v3"], sizes["v4"]), "V6 standalone floor versus V3/V4")

# ---------- official DESNZ source provenance and independent reconciliation ----------
manifest = load_json(MANIFEST)
source_report = load_json(SOURCE_REPORT)
identity_report = load_json(IDENTITY_REPORT)
check(int(manifest.get("schema_version") or 0) >= 6, "REPD manifest schema >=6", clean(manifest.get("schema_version")))
check(clean(manifest.get("source_owner")) == "Department for Energy Security and Net Zero (DESNZ)", "DESNZ source owner")
check(clean(manifest.get("source_page")) == "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract", "official GOV.UK REPD page")
check(urlparse(clean(manifest.get("source_url"))).netloc == "assets.publishing.service.gov.uk", "official DESNZ CSV host", clean(manifest.get("source_url")))
check(clean(manifest.get("source_url")).lower().endswith(".csv"), "official DESNZ CSV extension")
check(urlparse(clean(manifest.get("source_excel_url"))).netloc == "assets.publishing.service.gov.uk", "official DESNZ XLSX host", clean(manifest.get("source_excel_url")))
check(clean(manifest.get("source_excel_url")).lower().endswith(".xlsx"), "official DESNZ XLSX extension")
check(manifest.get("ingestion_profile") == "globalgrid2050.repd-v6-hardened", "hardened V6 REPD ingestion profile")
check(source_report.get("pass") is True, "CSV/XLSX DESNZ reconciliation passed", str(source_report.get("errors") or []))
check(identity_report.get("pass") is True, "GlobalGrid project identity validation passed", str(identity_report.get("errors") or []))

# ---------- serving REPD master and exact V6 eligible universe ----------
master = load_json(MASTER)
features = master.get("features") or []
check(master.get("schema") == "globalgrid2050.repd-master.v6", "REPD master V6 schema", clean(master.get("schema")))
check(master.get("ingestion_profile") == "globalgrid2050.repd-v6-hardened", "REPD master hardened profile")
check(len(features) > 100, "REPD master non-trivial", f"features={len(features)}")

ref_map = {}
for feature in features:
    p = feature.get("properties") or {}
    ref = clean(p.get("repd_ref"))
    if not ref:
        errors.append(f"master feature missing REPD Ref ID: {p.get('name')}")
        continue
    if ref in ref_map:
        errors.append(f"duplicate REPD Ref ID in master: {ref}")
    ref_map[ref] = p
check(len(ref_map) == len(features), "100% unique REPD Ref ID coverage in serving master", f"refs={len(ref_map)} features={len(features)}")

eligible = {}
for ref, p in ref_map.items():
    if p.get("capacity_known") is False:
        continue
    mw = num(p.get("capacity"))
    if mw is None:
        continue
    tech = clean(p.get("tech"))
    if tech in {"solar", "solar_roof"} and mw > SOLAR_MIN_EXCLUSIVE:
        eligible[ref] = p
    elif tech == "bess" and mw > BESS_MIN_EXCLUSIVE:
        eligible[ref] = p
check(bool(eligible), "eligible V6 serving universe exists", f"eligible={len(eligible)}")

update_supplied = sum(bool(clean(p.get("repd_record_updated"))) for p in eligible.values())
update_coverage = update_supplied / len(eligible) if eligible else 1.0
check(update_coverage >= MIN_UPDATE_COVERAGE, "eligible REPD update-date coverage >=99%", f"coverage={update_coverage:.4%}")

projects = load_json(PROJECTS)
project_rows = projects.get("projects") or []
project_refs = [clean(p.get("repd_ref")) for p in project_rows]
check(projects.get("repd_bound") is True, "V6 projects REPD-bound")
check(projects.get("globalgrid_id_required") is True, "V6 projects GlobalGrid-bound")
check((projects.get("thresholds") or {}).get("solar_mw_exclusive") == 1.0, "V6 solar threshold >1MW")
check((projects.get("thresholds") or {}).get("bess_mw_exclusive") == 100.0, "V6 BESS threshold >100MW")
check(int(projects.get("count") or -1) == len(eligible), "V6 project count exact versus serving master", f"json={projects.get('count')} eligible={len(eligible)}")
check(set(project_refs) == set(eligible), "V6 project Ref ID set exact versus serving master", f"json={len(set(project_refs))} eligible={len(eligible)}")
check(abs(float(projects.get("repd_record_update_coverage") or 0) - update_coverage) < 1e-8, "V6 project update-date coverage metadata exact")

for row in project_rows:
    ref = clean(row.get("repd_ref"))
    p = eligible.get(ref)
    if not p:
        continue
    check(clean(row.get("name")) == clean(p.get("name")), f"project name exact REPD {ref}")
    check(clean(row.get("status")) == clean(p.get("status")), f"project status exact REPD {ref}")
    check(clean(row.get("repd_record_updated")) == clean(p.get("repd_record_updated")), f"project update date exact REPD {ref}")
    check(abs(float(row.get("capacity_mw")) - float(p.get("capacity"))) <= 0.001, f"project capacity exact REPD {ref}")

# ---------- newspaper discovery, quality and primary identity ----------
news = load_json(NEWS)
items = news.get("items") or []
check(news.get("repd_bound") is True, "V6 newspaper REPD-bound")
check(news.get("globalgrid_id_required") is True, "V6 newspaper GlobalGrid-bound")
check(int(news.get("eligible_projects") or -1) == len(eligible), "news eligible count exact", f"json={news.get('eligible_projects')} eligible={len(eligible)}")
check(int(news.get("headline_count") or -1) == len(items), "headline metadata exact", f"json={news.get('headline_count')} rows={len(items)}")
check((news.get("thresholds") or {}).get("solar_mw_exclusive") == 1.0, "news solar threshold >1MW")
check((news.get("thresholds") or {}).get("bess_mw_exclusive") == 100.0, "news BESS threshold >100MW")
check(0 < int(news.get("lookback_days") or 0) <= 183, "news horizon <= six months", f"days={news.get('lookback_days')}")
check(REQUIRED_PRIORITY_SOURCES.issubset(set(news.get("priority_sources") or [])), "all mandated sources configured")
check(int(news.get("query_count") or 0) > 0, "news discovery queries executed", f"queries={news.get('query_count')}")
check(int(news.get("raw_story_count") or 0) > 0, "news discovery returned candidate stories", f"raw={news.get('raw_story_count')}")
check("source-first" in clean(news.get("discovery_policy")).lower(), "source-first discovery policy recorded")
check("duplicate-name" in clean(news.get("quality_gate")).lower(), "duplicate-name quality gate recorded")
check(abs(float(news.get("repd_record_update_coverage") or 0) - update_coverage) < 1e-8, "news update-date coverage metadata exact")

cutoff = datetime.now(timezone.utc).date() - timedelta(days=int(news.get("lookback_days") or 183) + 1)
seen_headlines = set()
seen_articles = set()
official_actual = 0
for idx, item in enumerate(items):
    ref = clean(item.get("repd_ref"))
    p = eligible.get(ref)
    if not p:
        errors.append(f"headline {idx} not tied to eligible REPD Ref ID: {ref}")
        continue
    check(clean(item.get("project_id")) == ref, f"headline {idx} project_id equals REPD ref")
    check(clean(item.get("project")) == clean(p.get("name")), f"headline {idx} project name exact REPD")
    check(clean(item.get("status")) == clean(p.get("status")), f"headline {idx} carries official REPD status unchanged")
    check(clean(item.get("repd_record_updated")) == clean(p.get("repd_record_updated")), f"headline {idx} REPD update date exact")
    check(abs(float(item.get("capacity_mw")) - float(p.get("capacity"))) <= 0.001, f"headline {idx} capacity exact REPD")
    check(bool(clean(item.get("gg_project_id"))), f"headline {idx} GlobalGrid project ID present")
    check(bool(clean(item.get("gg_development_id"))), f"headline {idx} GlobalGrid development ID present")
    check(bool(clean(item.get("gg_article_id"))), f"headline {idx} canonical article ID present")
    check(bool(clean(item.get("headline"))), f"headline {idx} text present")
    check(bool(clean(item.get("source"))), f"headline {idx} source present")
    parsed = urlparse(clean(item.get("url")))
    check(parsed.scheme in {"http", "https"} and bool(parsed.netloc), f"headline {idx} URL valid", clean(item.get("url")))
    check(int(item.get("confidence") or 0) >= MIN_CONFIDENCE, f"headline {idx} confidence >= {MIN_CONFIDENCE}", clean(item.get("confidence")))

    try:
        published = datetime.fromisoformat(clean(item.get("published"))).date()
        check(cutoff <= published <= datetime.now(timezone.utc).date(), f"headline {idx} publication date inside horizon", clean(item.get("published")))
    except Exception:
        errors.append(f"headline {idx} invalid publication date: {item.get('published')}")

    hk = norm(item.get("headline"))
    if hk in seen_headlines:
        errors.append(f"duplicate headline: {item.get('headline')}")
    seen_headlines.add(hk)
    aid = clean(item.get("gg_article_id"))
    if aid in seen_articles:
        errors.append(f"duplicate article ID: {aid}")
    seen_articles.add(aid)

    combined = norm(clean(item.get("headline")) + " " + clean(item.get("source")) + " " + clean(item.get("source_url")))
    project_name = norm(item.get("project"))
    leaked = [place for place in FOREIGN if norm(place) in combined and norm(place) not in project_name]
    if leaked:
        errors.append(f"foreign-location leakage REPD {ref}: {leaked} :: {item.get('headline')}")
    bad = [phrase for phrase in KNOWN_BAD if norm(phrase) in combined]
    if bad:
        errors.append(f"known false-positive class REPD {ref}: {bad} :: {item.get('headline')}")

    source_text = norm(clean(item.get("source")) + " " + clean(item.get("source_url")))
    if any(x in source_text for x in ("gov uk", "planning inspectorate", "planninginspectorate")):
        official_actual += 1

check(int(news.get("official_source_headlines") or 0) == official_actual, "official-source headline metadata exact", f"json={news.get('official_source_headlines')} actual={official_actual}")

links = load_json(LINKS)
check(links.get("schema") == "globalgrid2050.project-news-links.v6", "project-news relationship schema")
check(int(links.get("article_count") or -1) == len(items), "one relationship article identity per displayed story")
check(int(links.get("primary_link_count") or -1) == len(items), "exactly one PRIMARY_MATCH per story")
check((links.get("rules") or {}).get("related_development_never_confirms_repd_status") is True, "related development never confirms REPD status")

report = {
    "schema": "globalgrid2050.renewables-v6-integrity.v2",
    "pass": not errors,
    "generated": datetime.now(timezone.utc).isoformat(),
    "scope_plan": "uk_renewables_pipeline/V6_BUILD_PLAN_2026-08-22.md",
    "metrics": {
        "v6_bytes": sizes.get("v6"),
        "repd_master_features": len(features),
        "eligible_projects": len(eligible),
        "eligible_update_date_coverage": round(update_coverage, 8),
        "headlines": len(items),
        "official_source_headlines": official_actual,
        "queries": news.get("query_count"),
        "raw_stories": news.get("raw_story_count"),
    },
    "checks": checks,
    "errors": errors,
}
REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")

if errors:
    print("V6 AGREED-SCOPE VALIDATION FAILED")
    for error in errors[:150]:
        print(" -", error)
    raise SystemExit(1)

print("V6 AGREED-SCOPE VALIDATION PASS", json.dumps(report["metrics"], sort_keys=True))
