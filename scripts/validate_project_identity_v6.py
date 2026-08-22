#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
IDENTITY = DIST / "project_identity_v6.json"
MASTER = DIST / "repd_master.json"
PROJECTS = DIST / "major_projects_v6.json"
NEWS = DIST / "major_project_news_v6.json"
LINKS = DIST / "project_news_links_v6.json"
REPORT = DIST / "project_identity_v6_integrity.json"

Q2_2026_RAW_ROWS = 14657
Q2_2026_SOLAR_GT1 = 3445
Q2_2026_BESS_GT100 = 269

errors = []
checks = []


def check(condition, gate, detail=""):
    ok = bool(condition)
    checks.append({"gate": gate, "pass": ok, "detail": detail})
    if not ok:
        errors.append(f"{gate}: {detail}" if detail else gate)


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"cannot load {path.relative_to(ROOT)}: {exc}")
        return {}


def clean(v):
    return str(v or "").strip()


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower())).strip()


def num(v):
    try:
        x = float(clean(v).replace(",", ""))
        return x if math.isfinite(x) else None
    except Exception:
        return None


identity = load(IDENTITY)
master = load(MASTER)
projects = load(PROJECTS)
news = load(NEWS)
links = load(LINKS)

records = identity.get("records") or []
check(identity.get("schema") == "globalgrid2050.project-identity.v6", "identity schema")
check(len(records) >= 1000, "identity registry non-trivial", f"records={len(records)}")
check(identity.get("identity_rules", {}).get("capacity_not_identity") is True, "capacity excluded from identity fingerprint")
check(float(identity.get("repd_ref_coverage") or 0) >= 0.999, "official REPD ref coverage >=99.9%", f"coverage={identity.get('repd_ref_coverage')}")

by_ref = {}
by_gg = {}
for i, row in enumerate(records):
    gg = clean(row.get("gg_project_id"))
    ref = clean(row.get("repd_ref"))
    status = clean(row.get("identity_status"))
    check(bool(gg), f"identity row {i} has GlobalGrid ID")
    if gg in by_gg:
        errors.append(f"duplicate gg_project_id: {gg}")
    by_gg[gg] = row
    if status == "REPD_BOUND":
        check(bool(ref), f"REPD-bound identity row {i} has repd_ref")
        check(gg == f"GG2050-REPD-{ref}", f"REPD-bound ID deterministic for {ref}", gg)
        if ref in by_ref:
            errors.append(f"duplicate repd_ref in identity registry: {ref}")
        by_ref[ref] = row
    elif status == "GLOBALGRID_ONLY":
        check(not ref, f"GlobalGrid-only row {i} does not fabricate REPD ref")
        check(gg.startswith("GG2050-UK-"), f"GlobalGrid-only ID namespace row {i}", gg)
    else:
        errors.append(f"unknown identity_status row {i}: {status}")

# Actual Q2 2026 workbook gates are conditional on the exact official publication URL.
source_url = clean(identity.get("source_url"))
if "REPD_Publication_Q2_2026.csv" in source_url:
    check(int(identity.get("raw_record_count") or -1) == Q2_2026_RAW_ROWS, "Q2 2026 raw REPD row count exact", f"actual={identity.get('raw_record_count')} expected={Q2_2026_RAW_ROWS}")
    check(int(identity.get("repd_bound_count") or -1) == Q2_2026_RAW_ROWS, "Q2 2026 all rows have unique official Ref ID", f"bound={identity.get('repd_bound_count')}")
    check(int(identity.get("globalgrid_only_count") or -1) == 0, "Q2 2026 requires no synthetic GlobalGrid-only IDs", f"gg_only={identity.get('globalgrid_only_count')}")
    raw_solar_gt1 = 0
    raw_bess_gt100 = 0
    for row in records:
        mw = num(row.get("capacity_mw_raw"))
        if mw is None:
            continue
        tech = norm(row.get("technology"))
        if "solar photovoltaic" in tech and mw > 1.0:
            raw_solar_gt1 += 1
        if "battery" in tech and mw > 100.0:
            raw_bess_gt100 += 1
    check(raw_solar_gt1 == Q2_2026_SOLAR_GT1, "Q2 2026 raw solar >1MW count exact", f"actual={raw_solar_gt1} expected={Q2_2026_SOLAR_GT1}")
    check(raw_bess_gt100 == Q2_2026_BESS_GT100, "Q2 2026 raw BESS >100MW count exact", f"actual={raw_bess_gt100} expected={Q2_2026_BESS_GT100}")

# Relationship integrity: explicit related current refs must resolve, and development groups must agree.
for ref, row in by_ref.items():
    dev = clean(row.get("gg_development_id"))
    check(bool(dev), f"REPD {ref} has development ID")
    for related_ref in row.get("direct_related_repd_refs") or []:
        if clean(related_ref) in by_ref:
            check(clean(by_ref[clean(related_ref)].get("gg_development_id")) == dev, f"explicit related REPD {ref}<->{related_ref} shares development ID")
    for sibling_ref in row.get("development_repd_refs") or []:
        sr = clean(sibling_ref)
        if sr in by_ref:
            check(clean(by_ref[sr].get("gg_development_id")) == dev, f"development sibling {ref}<->{sr} consistent")

# Shared transformed REPD master must be fully enriched without changing its official identity.
features = master.get("features") or []
check(master.get("identity_schema") == identity.get("schema"), "REPD master declares identity schema")
master_refs = set()
for feature in features:
    p = feature.get("properties") or {}
    ref = clean(p.get("repd_ref"))
    if not ref:
        errors.append(f"master feature lacks official REPD ref: {p.get('name')}")
        continue
    master_refs.add(ref)
    identity_row = by_ref.get(ref)
    if not identity_row:
        errors.append(f"master REPD ref missing from identity registry: {ref}")
        continue
    check(clean(p.get("gg_project_id")) == clean(identity_row.get("gg_project_id")), f"master GlobalGrid ID matches registry {ref}")
    check(clean(p.get("gg_development_id")) == clean(identity_row.get("gg_development_id")), f"master development ID matches registry {ref}")

# Eligible V6 project universe must be 100% GlobalGrid-bound.
project_rows = projects.get("projects") or []
check(projects.get("globalgrid_id_required") is True, "V6 project output requires GlobalGrid IDs")
for row in project_rows:
    ref = clean(row.get("repd_ref"))
    identity_row = by_ref.get(ref)
    if not identity_row:
        errors.append(f"eligible project not in identity registry: {ref}")
        continue
    check(clean(row.get("gg_project_id")) == clean(identity_row.get("gg_project_id")), f"eligible project GlobalGrid ID exact {ref}")
    check(clean(row.get("gg_development_id")) == clean(identity_row.get("gg_development_id")), f"eligible project development ID exact {ref}")

# Newspaper: one primary canonical project link per article; related links are context only.
items = news.get("items") or []
link_rows = links.get("links") or []
check(news.get("globalgrid_id_required") is True, "V6 newspaper requires GlobalGrid IDs")
check(links.get("schema") == "globalgrid2050.project-news-links.v6", "project-news link schema")
check(int(links.get("article_count") or -1) == len(items), "article count equals newspaper items", f"links={links.get('article_count')} news={len(items)}")
primary_by_article = {}
for link in link_rows:
    aid = clean(link.get("gg_article_id"))
    role = clean(link.get("role"))
    ref = clean(link.get("repd_ref"))
    if ref not in by_ref:
        errors.append(f"news link references unknown REPD ref: {ref}")
        continue
    if role == "PRIMARY_MATCH":
        if aid in primary_by_article:
            errors.append(f"article has multiple PRIMARY_MATCH links: {aid}")
        primary_by_article[aid] = link
        check(link.get("eligible_for_news_signal") is True, f"primary link drives news signal {aid}")
    elif role == "RELATED_DEVELOPMENT":
        check(link.get("eligible_for_news_signal") is False, f"related development cannot drive news signal {aid}/{ref}")
    else:
        errors.append(f"unknown project-news link role: {role}")

article_ids = set()
for i, item in enumerate(items):
    aid = clean(item.get("gg_article_id"))
    ref = clean(item.get("repd_ref"))
    gg = clean(item.get("gg_project_id"))
    dev = clean(item.get("gg_development_id"))
    check(bool(aid) and aid.startswith("GG2050-NEWS-"), f"headline {i} canonical article ID", aid)
    if aid in article_ids:
        errors.append(f"duplicate article ID in newspaper: {aid}")
    article_ids.add(aid)
    identity_row = by_ref.get(ref)
    if not identity_row:
        errors.append(f"headline {i} primary ref absent from registry: {ref}")
        continue
    check(gg == clean(identity_row.get("gg_project_id")), f"headline {i} GlobalGrid project ID exact")
    check(dev == clean(identity_row.get("gg_development_id")), f"headline {i} development ID exact")
    primary = primary_by_article.get(aid)
    check(primary is not None and clean(primary.get("repd_ref")) == ref, f"headline {i} has exactly one matching primary link", aid)

check(len(primary_by_article) == len(items), "exactly one PRIMARY_MATCH per article", f"primary={len(primary_by_article)} items={len(items)}")

report = {
    "schema": "globalgrid2050.project-identity-integrity.v6",
    "pass": not errors,
    "source_url": source_url,
    "metrics": {
        "identity_records": len(records),
        "repd_bound_records": len(by_ref),
        "globalgrid_only_records": sum(1 for r in records if r.get("identity_status") == "GLOBALGRID_ONLY"),
        "development_groups": len({clean(r.get('gg_development_id')) for r in records if clean(r.get('gg_development_id'))}),
        "master_features": len(features),
        "eligible_projects": len(project_rows),
        "news_articles": len(items),
        "project_news_links": len(link_rows),
    },
    "checks": checks,
    "errors": errors,
}
REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")

if errors:
    print("PROJECT IDENTITY V6 FAILED")
    for error in errors[:100]:
        print(" -", error)
    raise SystemExit(1)

print("PROJECT IDENTITY V6 PASS", json.dumps(report["metrics"], sort_keys=True))
