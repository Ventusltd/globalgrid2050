#!/usr/bin/env python3
"""Validate V6 project/development identities and news relationships."""
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
IDENTITY = DIST / "project_identity_v6.json"
PROJECTS = DIST / "major_projects_v6.json"
NEWS = DIST / "major_project_news_v6.json"
LINKS = DIST / "project_news_links_v6.json"
REPORT = DIST / "project_identity_v6_integrity.json"

EXPECTED_ROWS = 14657
EXPECTED_SOLAR = 3445
EXPECTED_BESS = 269
EXPECTED_PROJECTS = EXPECTED_SOLAR + EXPECTED_BESS

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


def clean(value):
    return str(value or "").strip()


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except Exception:
        return None


identity = load(IDENTITY)
projects = load(PROJECTS)
news = load(NEWS)
links = load(LINKS)

records = identity.get("records") or []
check(identity.get("schema") == "globalgrid2050.project-identity.v6", "identity schema")
check(identity.get("raw_record_count") == EXPECTED_ROWS, "identity raw row count", str(identity.get("raw_record_count")))
check(identity.get("repd_bound_count") == EXPECTED_ROWS, "identity REPD-bound count", str(identity.get("repd_bound_count")))
check(identity.get("globalgrid_only_count") == 0, "no fabricated REPD identities", str(identity.get("globalgrid_only_count")))
check(len(records) == EXPECTED_ROWS, "identity record array exact", f"records={len(records)}")
check(identity.get("identity_rules", {}).get("capacity_not_identity") is True, "capacity excluded from identity")

by_ref = {}
by_gg = {}
identity_error_start = len(errors)
for index, record in enumerate(records):
    ref = clean(record.get("repd_ref"))
    gg = clean(record.get("gg_project_id"))
    development = clean(record.get("gg_development_id"))
    if not ref:
        errors.append(f"identity row {index} lacks official REPD Ref")
    if gg != f"GG2050-REPD-{ref}":
        errors.append(f"identity row {index} has non-deterministic project ID: {gg}")
    if record.get("identity_status") != "REPD_BOUND":
        errors.append(f"identity row {index} is not REPD_BOUND")
    if not development.startswith("GG2050-DEV-"):
        errors.append(f"identity row {index} lacks development ID")
    if record.get("capacity_known") != (number(record.get("capacity_mw")) is not None):
        errors.append(f"identity row {index} violates capacity-null discipline")
    if ref in by_ref:
        errors.append(f"duplicate identity REPD Ref: {ref}")
    if gg in by_gg:
        errors.append(f"duplicate GlobalGrid project ID: {gg}")
    by_ref[ref] = record
    by_gg[gg] = record
check(len(errors) == identity_error_start, "all identity rows valid and unique", f"new_errors={len(errors)-identity_error_start}")

relationship_error_start = len(errors)
for ref, record in by_ref.items():
    development = clean(record.get("gg_development_id"))
    for relation in record.get("relationships") or []:
        target = clean(relation.get("repd_ref"))
        if relation.get("type") not in {"CURRENT_VERSION", "PREVIOUS_REPD_REF", "RELATED_APPLICATION", "COLOCATED_COMPONENT"}:
            errors.append(f"untyped relation {ref}->{target}: {relation.get('type')}")
        if target in by_ref:
            if clean(by_ref[target].get("gg_development_id")) != development:
                errors.append(f"resolvable relation not grouped {ref}->{target}")
    for target in record.get("development_repd_refs") or []:
        target = clean(target)
        if target not in by_ref:
            errors.append(f"development member absent {ref}->{target}")
        elif clean(by_ref[target].get("gg_development_id")) != development:
            errors.append(f"development group inconsistent {ref}->{target}")
check(len(errors) == relationship_error_start, "all identity relationships resolve consistently", f"new_errors={len(errors)-relationship_error_start}")

project_rows = projects.get("projects") or []
check(projects.get("schema") == "globalgrid2050.major-projects.v6", "public project schema")
check(projects.get("repd_bound") is True, "public projects REPD-bound")
check(projects.get("globalgrid_id_required") is True, "public projects GlobalGrid-bound")
check(projects.get("csv_xlsx_reconciled") is True, "public projects reconciled")
check(projects.get("source_record_count") == EXPECTED_ROWS, "public source row metadata")
check(projects.get("project_count") == EXPECTED_PROJECTS == len(project_rows), "public project count", f"metadata={projects.get('project_count')} rows={len(project_rows)}")
check(projects.get("solar_count") == EXPECTED_SOLAR, "public solar count")
check(projects.get("bess_count") == EXPECTED_BESS, "public BESS count")
canonical_projects = json.dumps(project_rows, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
check(projects.get("projects_sha256") == hashlib.sha256(canonical_projects.encode("utf-8")).hexdigest(), "public project-array hash")

project_refs = set()
solar = bess = 0
project_error_start = len(errors)
for index, project in enumerate(project_rows):
    ref = clean(project.get("repd_ref"))
    identity_row = by_ref.get(ref)
    if not identity_row:
        errors.append(f"public project {index} absent from identity registry: {ref}")
        continue
    if ref in project_refs:
        errors.append(f"duplicate public project REPD Ref: {ref}")
    project_refs.add(ref)
    for field, project_key, identity_key in (
        ("project ID", "gg_project_id", "gg_project_id"),
        ("development ID", "gg_development_id", "gg_development_id"),
        ("name", "name", "site_name"),
        ("status", "status", "status"),
        ("update date", "repd_record_updated", "repd_record_updated"),
    ):
        if project.get(project_key) != identity_row.get(identity_key):
            errors.append(f"public {field} differs from identity registry: {ref}")
    if number(project.get("capacity_mw")) != number(identity_row.get("capacity_mw")):
        errors.append(f"public capacity differs from identity registry: {ref}")
    tech, capacity = project.get("technology"), number(project.get("capacity_mw"))
    if tech == "solar" and capacity is not None and capacity > 1.0:
        solar += 1
    elif tech == "bess" and capacity is not None and capacity > 100.0:
        bess += 1
    else:
        errors.append(f"public project outside exclusive thresholds: {ref}")
check(len(errors) == project_error_start, "all public projects bind exactly to identity registry", f"new_errors={len(errors)-project_error_start}")
check(solar == EXPECTED_SOLAR and bess == EXPECTED_BESS, "derived public thresholds", f"solar={solar} bess={bess}")

items = news.get("items") or []
link_rows = links.get("links") or []
check(news.get("repd_bound") is True, "news REPD-bound")
check(news.get("globalgrid_id_required") is True, "news GlobalGrid-bound")
check(news.get("headline_count") == len(items), "news headline count permits zero", f"metadata={news.get('headline_count')} rows={len(items)}")
check(links.get("schema") == "globalgrid2050.project-news-links.v6", "project-news link schema")
check(links.get("article_count") == len(items), "link article count permits zero")

primary = {}
link_error_start = len(errors)
for link in link_rows:
    article = clean(link.get("gg_article_id"))
    ref = clean(link.get("repd_ref"))
    if ref not in project_refs:
        errors.append(f"news link references ineligible project {article}/{ref}")
    if link.get("role") == "PRIMARY_MATCH":
        if article in primary:
            errors.append(f"multiple PRIMARY_MATCH links: {article}")
        primary[article] = link
        if link.get("eligible_for_news_signal") is not True:
            errors.append(f"primary link cannot drive signal: {article}")
    elif link.get("role") == "RELATED_DEVELOPMENT":
        if link.get("eligible_for_news_signal") is not False:
            errors.append(f"related link drives signal: {article}/{ref}")
    else:
        errors.append(f"invalid project-news role: {link.get('role')}")
check(len(errors) == link_error_start, "all project-news links valid", f"new_errors={len(errors)-link_error_start}")

article_ids = set()
article_error_start = len(errors)
for index, item in enumerate(items):
    article = clean(item.get("gg_article_id"))
    ref = clean(item.get("repd_ref"))
    if not article.startswith("GG2050-NEWS-"):
        errors.append(f"news article {index} has invalid ID: {article}")
    if article in article_ids:
        errors.append(f"duplicate news article ID: {article}")
    article_ids.add(article)
    if ref not in project_refs:
        errors.append(f"news article {index} PRIMARY_MATCH is ineligible: {ref}")
    if ref in by_ref:
        if item.get("gg_project_id") != by_ref[ref].get("gg_project_id"):
            errors.append(f"news article {index} project ID mismatch")
        if item.get("gg_development_id") != by_ref[ref].get("gg_development_id"):
            errors.append(f"news article {index} development ID mismatch")
    if article not in primary or clean(primary[article].get("repd_ref")) != ref:
        errors.append(f"news article {index} lacks exactly one matching primary link")
    evidence = item.get("match_evidence") or {}
    for gate in ("identity_gate_passed", "technology_gate_passed", "foreign_veto_passed", "duplicate_name_gate_passed"):
        if evidence.get(gate) is not True:
            errors.append(f"news article {index} failed persisted {gate}")
    if evidence.get("capacity_only") is not False:
        errors.append(f"news article {index} is capacity-only")
check(len(errors) == article_error_start, "all news articles preserve public match evidence", f"new_errors={len(errors)-article_error_start}")
check(len(primary) == len(items), "one PRIMARY_MATCH per article", f"primary={len(primary)} items={len(items)}")

report = {
    "schema": "globalgrid2050.project-identity-integrity.v6",
    "pass": not errors,
    "validated_at": datetime.now(timezone.utc).isoformat(),
    "metrics": {
        "identity_records": len(records),
        "development_groups": len({clean(row.get('gg_development_id')) for row in records}),
        "public_projects": len(project_rows),
        "solar_projects": solar,
        "bess_projects": bess,
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
