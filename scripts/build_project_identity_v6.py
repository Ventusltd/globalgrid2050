#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
from collections import defaultdict
from pathlib import Path

from repd_sources_v6 import (
    CANONICAL_CSV,
    EXPECTED_BESS_GT100,
    EXPECTED_ROWS,
    EXPECTED_SOLAR_GT1,
    MANIFEST,
    REPORT as SOURCE_REPORT,
    clean_ref,
    norm_date,
    norm_number,
)

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
IDENTITY_OUT = DIST / "project_identity_v6.json"
PROJECTS_OUT = DIST / "major_projects_v6.json"

SCHEMA = "globalgrid2050.project-identity.v6"
MIN_REPD_ROWS = 1000
MIN_REF_COVERAGE = 0.999


def clean(v):
    s = str(v or "").strip()
    return "" if s.lower() in {"nan", "none", "null", "not set"} else s


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower().replace("&", " and "))).strip()


def numeric_sort(value):
    text = clean(value)
    return (0, int(text)) if text.isdigit() else (1, text)


def technology_category(value):
    value = norm(value)
    if "solar photovoltaic" in value:
        return "solar"
    if "battery" in value:
        return "bess"
    return None


def lifecycle(status):
    value = norm(status)
    if "operational" in value:
        return "OPERATIONAL"
    if "under construction" in value:
        return "UNDER_CONSTRUCTION"
    if any(word in value for word in ("abandon", "decommission", "refused", "withdrawn", "expired")):
        return "INACTIVE"
    if any(word in value for word in ("application", "awaiting", "consent", "approved", "pre construction")):
        return "LIVE_PRE_CONSTRUCTION"
    return "UNKNOWN"


def valid_planning_ref(value):
    value = norm(value)
    return bool(value and value not in {"n a", "na", "none", "not known", "unknown", "tbc", "pending"})


def canon_header(v):
    return norm(v)


def split_refs(v):
    # Avoid treating the trailing zero in Excel-style "12345.0" as another Ref ID.
    values = []
    for match in re.findall(r"(?<![A-Za-z0-9])\d+(?:\.0)?(?![A-Za-z0-9])", clean(v)):
        ref = clean_ref(match)
        if ref and ref not in values:
            values.append(ref)
    return values


def short_hash(value, n=16):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()[:n].upper()


def gg_project_id(repd_ref, row):
    if repd_ref:
        return f"GG2050-REPD-{repd_ref}"

    # Never fabricate an REPD reference. A GlobalGrid-only ID is generated from the
    # strongest stable public anchors available, excluding capacity so capacity revisions
    # do not change identity.
    planning_ref = clean(row.get("planning_application_reference"))
    planning_authority = clean(row.get("planning_authority"))
    name = clean(row.get("site_name"))
    operator = clean(row.get("operator"))
    county = clean(row.get("county"))
    technology = clean(row.get("technology"))
    if planning_ref:
        fingerprint = f"planning|{norm(planning_authority)}|{norm(planning_ref)}"
        confidence = "strong"
    else:
        fingerprint = f"entity|{norm(name)}|{norm(operator)}|{norm(county)}|{norm(technology)}"
        confidence = "provisional"
    return f"GG2050-UK-{short_hash(fingerprint)}", confidence


class UnionFind:
    def __init__(self, values):
        self.parent = {v: v for v in values}

    def find(self, x):
        p = self.parent[x]
        if p != x:
            self.parent[x] = self.find(p)
        return self.parent[x]

    def union(self, a, b):
        if a not in self.parent or b not in self.parent:
            return
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        # Stable representative: prefer numerically smaller REPD ref when possible.
        try:
            ka, kb = (0, int(ra)), (0, int(rb))
        except Exception:
            ka, kb = (1, ra), (1, rb)
        if ka <= kb:
            self.parent[rb] = ra
        else:
            self.parent[ra] = rb


def resolve(headers, *aliases):
    by_canon = {canon_header(h): h for h in headers}
    for alias in aliases:
        key = canon_header(alias)
        if key in by_canon:
            return by_canon[key]
    return ""


def load_manifest():
    if not MANIFEST.exists():
        raise RuntimeError("Missing dist/manifest_v6.json; source reconciliation must run first")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    report = json.loads(SOURCE_REPORT.read_text(encoding="utf-8")) if SOURCE_REPORT.exists() else {}
    if manifest.get("status") != "VALIDATED" or report.get("pass") is not True:
        raise RuntimeError("V6 source reconciliation has not passed")
    if not CANONICAL_CSV.exists():
        raise RuntimeError("Missing staged reconciled Q2 canonical CSV")
    return manifest


def ensure_official_csv(manifest):
    source_url = clean(manifest.get("source_url"))
    if not source_url or not source_url.lower().endswith(".csv") or "assets.publishing.service.gov.uk" not in source_url:
        raise RuntimeError(f"Manifest does not point to an official DESNZ CSV: {source_url!r}")
    return source_url, CANONICAL_CSV


def read_official_rows(path):
    raw = path.read_bytes()
    text = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise RuntimeError("Unable to decode official REPD CSV")

    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    if not headers:
        raise RuntimeError("Official REPD CSV has no header row")

    cols = {
        "ref_id": resolve(headers, "Ref ID"),
        "old_ref_id": resolve(headers, "Old Ref ID"),
        "record_updated": resolve(headers, "Record Last Updated (dd/mm/yyyy)", "Record Last Updated"),
        "site_name": resolve(headers, "Site Name"),
        "technology": resolve(headers, "Technology Type"),
        "capacity": resolve(headers, "Installed Capacity (MWelec)"),
        "status": resolve(headers, "Development Status (short)"),
        "operator": resolve(headers, "Operator (or Applicant)"),
        "county": resolve(headers, "County"),
        "region": resolve(headers, "Region"),
        "country": resolve(headers, "Country"),
        "planning_authority": resolve(headers, "Planning Authority", "Local Planning Authority"),
        "planning_application_reference": resolve(headers, "Planning Application Reference"),
        "planning_application_submitted": resolve(headers, "Planning Application Submitted"),
        "planning_application_withdrawn": resolve(headers, "Planning Application Withdrawn"),
        "planning_permission_refused": resolve(headers, "Planning Permission Refused"),
        "planning_permission_granted": resolve(headers, "Planning Permission Granted"),
        "planning_permission_expired": resolve(headers, "Planning Permission Expired"),
        "under_construction": resolve(headers, "Under Construction"),
        "operational": resolve(headers, "Operational"),
    }
    required = ["ref_id", "site_name", "technology"]
    missing = [k for k in required if not cols[k]]
    if missing:
        raise RuntimeError(f"Official REPD schema missing identity columns after header normalisation: {missing}; headers={headers}")

    relationship_columns = []
    for h in headers:
        ch = canon_header(h)
        if ch in {canon_header(cols["ref_id"]), canon_header(cols["old_ref_id"])}:
            continue
        if "repd ref" in ch or ("re applying" in ch and "ref" in ch):
            relation = "RELATED_APPLICATION"
            if "storage co location" in ch:
                relation = "COLOCATED_COMPONENT"
            elif "new repd ref" in ch:
                relation = "CURRENT_VERSION"
            elif "old repd ref" in ch:
                relation = "PREVIOUS_REPD_REF"
            relationship_columns.append((h, relation))

    rows = []
    for row_number, source in enumerate(reader, start=2):
        repd_ref = clean_ref(source.get(cols["ref_id"]))
        out = {
            "source_row": row_number,
            "repd_ref": repd_ref,
            "repd_old_ref": clean_ref(source.get(cols["old_ref_id"])) if cols["old_ref_id"] else "",
            "repd_record_updated_raw": clean(source.get(cols["record_updated"])) if cols["record_updated"] else "",
            "site_name": clean(source.get(cols["site_name"])),
            "technology": clean(source.get(cols["technology"])),
            "capacity_mw_raw": clean(source.get(cols["capacity"])) if cols["capacity"] else "",
            "status": clean(source.get(cols["status"])) if cols["status"] else "",
            "operator": clean(source.get(cols["operator"])) if cols["operator"] else "",
            "county": clean(source.get(cols["county"])) if cols["county"] else "",
            "region": clean(source.get(cols["region"])) if cols["region"] else "",
            "country": clean(source.get(cols["country"])) if cols["country"] else "",
            "planning_authority": clean(source.get(cols["planning_authority"])) if cols["planning_authority"] else "",
            "planning_application_reference": clean(source.get(cols["planning_application_reference"])) if cols["planning_application_reference"] else "",
            "planning_application_submitted_raw": clean(source.get(cols["planning_application_submitted"])) if cols["planning_application_submitted"] else "",
            "planning_application_withdrawn_raw": clean(source.get(cols["planning_application_withdrawn"])) if cols["planning_application_withdrawn"] else "",
            "planning_permission_refused_raw": clean(source.get(cols["planning_permission_refused"])) if cols["planning_permission_refused"] else "",
            "planning_permission_granted_raw": clean(source.get(cols["planning_permission_granted"])) if cols["planning_permission_granted"] else "",
            "planning_permission_expired_raw": clean(source.get(cols["planning_permission_expired"])) if cols["planning_permission_expired"] else "",
            "under_construction_raw": clean(source.get(cols["under_construction"])) if cols["under_construction"] else "",
            "operational_raw": clean(source.get(cols["operational"])) if cols["operational"] else "",
            "direct_related_repd_refs": [],
            "relationships": [],
        }
        related = []
        for h, relation in relationship_columns:
            for target in split_refs(source.get(h)):
                if target and target != repd_ref:
                    related.append(target)
                    out["relationships"].append({"repd_ref": target, "type": relation, "source_field": h})
        out["direct_related_repd_refs"] = [r for r in dict.fromkeys(related) if r and r != repd_ref]
        rows.append(out)
    return rows, headers, [{"field": field, "type": relation} for field, relation in relationship_columns]


def build_registry(rows, manifest, source_url):
    if len(rows) < MIN_REPD_ROWS:
        raise RuntimeError(f"Official REPD row count is implausibly small: {len(rows)}")

    current = {}
    missing_ref_rows = []
    duplicate_refs = []
    for row in rows:
        ref = row["repd_ref"]
        if not ref:
            missing_ref_rows.append(row)
            continue
        if ref in current:
            duplicate_refs.append(ref)
        current[ref] = row
    if duplicate_refs:
        raise RuntimeError(f"Duplicate official REPD Ref IDs: {sorted(set(duplicate_refs))[:20]}")

    coverage = len(current) / len(rows)
    if coverage < MIN_REF_COVERAGE:
        raise RuntimeError(f"Official REPD Ref ID coverage below {MIN_REF_COVERAGE:.3%}: {coverage:.3%}")

    refs = set(current)
    uf = UnionFind(refs)

    # Explicit REPD cross-references are the strongest grouping signal. Old Ref ID
    # links are used only when they point to another current official record; history
    # is otherwise retained without inventing a missing record.
    for ref, row in current.items():
        if row["repd_old_ref"] in refs:
            uf.union(ref, row["repd_old_ref"])
        for related in row["direct_related_repd_refs"]:
            if related in refs:
                uf.union(ref, related)

    # Planning references are strong development-level identifiers when combined with
    # planning authority. NSIP EN-references are nationally unique and may group without it.
    planning_groups = defaultdict(list)
    for ref, row in current.items():
        planning_ref = norm(row["planning_application_reference"])
        authority = norm(row["planning_authority"])
        if not valid_planning_ref(planning_ref):
            continue
        if re.fullmatch(r"en\s*\d{5,}", planning_ref.replace(" ", "")):
            key = ("nsip", planning_ref.replace(" ", ""))
        elif authority:
            key = ("local", authority, planning_ref)
        else:
            continue
        planning_groups[key].append(ref)
    for group in planning_groups.values():
        if len(group) > 1:
            anchor = group[0]
            for ref in group[1:]:
                uf.union(anchor, ref)

    planning_siblings_by_ref = defaultdict(list)
    for group in planning_groups.values():
        if len(group) < 2:
            continue
        for ref in group:
            planning_siblings_by_ref[ref] = [other for other in group if other != ref]

    groups = defaultdict(list)
    for ref in refs:
        groups[uf.find(ref)].append(ref)

    group_id = {}
    for root_ref, members in groups.items():
        members = sorted(members, key=numeric_sort)
        planning_candidates = []
        for ref in members:
            row = current[ref]
            pr = norm(row["planning_application_reference"])
            pa = norm(row["planning_authority"])
            if valid_planning_ref(pr):
                planning_candidates.append((pa, pr))
        if planning_candidates:
            pa, pr = sorted(planning_candidates)[0]
            anchor = f"planning|{pa}|{pr}"
            gid = f"GG2050-DEV-{short_hash(anchor, 14)}"
        else:
            gid = f"GG2050-DEV-REPD-{members[0]}"
        for ref in members:
            group_id[ref] = gid

    records = []
    seen_gg = set()
    for row in rows:
        ref = row["repd_ref"]
        if ref:
            gid = f"GG2050-REPD-{ref}"
            confidence = "authoritative"
            identity_status = "REPD_BOUND"
            siblings = sorted([r for r in groups[uf.find(ref)] if r != ref], key=numeric_sort)
            planning_siblings = planning_siblings_by_ref.get(ref, [])
            development_id = group_id[ref]
        else:
            generated = gg_project_id("", row)
            gid, confidence = generated
            identity_status = "GLOBALGRID_ONLY"
            siblings = []
            planning_siblings = []
            development_id = f"GG2050-DEV-{short_hash(gid, 14)}"

        if gid in seen_gg:
            raise RuntimeError(f"GlobalGrid project ID collision: {gid}")
        seen_gg.add(gid)

        related = list(row["relationships"])
        if row["repd_old_ref"] and row["repd_old_ref"] != ref:
            related.append(
                {
                    "repd_ref": row["repd_old_ref"],
                    "type": "PREVIOUS_REPD_REF",
                    "source_field": "Old Ref ID",
                }
            )
        capacity = norm_number(row["capacity_mw_raw"])
        updated = norm_date(row["repd_record_updated_raw"])

        records.append(
            {
                "gg_project_id": gid,
                "gg_development_id": development_id,
                "identity_status": identity_status,
                "identity_confidence": confidence,
                "repd_ref": ref or None,
                "repd_old_ref": row["repd_old_ref"] or None,
                "repd_record_updated": updated or None,
                "repd_record_updated_raw": row["repd_record_updated_raw"] or None,
                "site_name": row["site_name"],
                "technology": row["technology"],
                "capacity_mw": capacity,
                "capacity_known": capacity is not None,
                "capacity_mw_raw": row["capacity_mw_raw"] or None,
                "status": row["status"],
                "lifecycle": lifecycle(row["status"]),
                "operator": row["operator"],
                "county": row["county"],
                "region": row["region"],
                "country": row["country"],
                "planning_authority": row["planning_authority"],
                "planning_application_reference": row["planning_application_reference"],
                "planning_application_submitted": norm_date(row["planning_application_submitted_raw"]) or None,
                "planning_application_withdrawn": norm_date(row["planning_application_withdrawn_raw"]) or None,
                "planning_permission_refused": norm_date(row["planning_permission_refused_raw"]) or None,
                "planning_permission_granted": norm_date(row["planning_permission_granted_raw"]) or None,
                "planning_permission_expired": norm_date(row["planning_permission_expired_raw"]) or None,
                "under_construction": norm_date(row["under_construction_raw"]) or None,
                "operational": norm_date(row["operational_raw"]) or None,
                "relationships": related,
                "direct_related_repd_refs": sorted(row["direct_related_repd_refs"], key=numeric_sort),
                "planning_sibling_repd_refs": sorted(set(planning_siblings), key=numeric_sort),
                "development_repd_refs": ([ref] + siblings) if ref else [],
                "source_row": row["source_row"],
            }
        )

    registry = {
        "schema": SCHEMA,
        "source_owner": manifest.get("source_owner"),
        "source_url": source_url,
        "source_excel_url": manifest.get("source_excel_url"),
        "source_page": manifest.get("source_page"),
        "source_dataset_title": manifest.get("source_dataset_title"),
        "source_page_last_updated": manifest.get("source_page_last_updated"),
        "validated_at": manifest.get("validated_at"),
        "source_hashes": manifest.get("source_hashes"),
        "raw_record_count": len(rows),
        "repd_bound_count": len(current),
        "globalgrid_only_count": len(missing_ref_rows),
        "repd_ref_coverage": round(coverage, 8),
        "development_group_count": len(set(group_id.values())) + len(missing_ref_rows),
        "identity_rules": {
            "repd_bound": "GG2050-REPD-<official Ref ID>",
            "non_repd": "GG2050-UK-<stable public-anchor hash>; never fabricates an REPD Ref ID",
            "development_grouping": "explicit REPD cross-reference first; planning-reference + authority/NSIP grouping second",
            "capacity_not_identity": True,
        },
        "records": records,
    }
    return registry


def build_public_snapshot(registry, manifest):
    projects = []
    for record in registry["records"]:
        category = technology_category(record["technology"])
        capacity = record["capacity_mw"]
        if capacity is None:
            continue
        if category == "solar" and capacity <= 1.0:
            continue
        if category == "bess" and capacity <= 100.0:
            continue
        if category not in {"solar", "bess"}:
            continue
        explicit_types = {
            clean(relation.get("repd_ref")): relation.get("type")
            for relation in record.get("relationships") or []
            if clean(relation.get("repd_ref"))
        }
        development_relationships = [
            {
                "repd_ref": target,
                "type": explicit_types.get(target, "SAME_DEVELOPMENT"),
            }
            for target in record["development_repd_refs"]
            if target != record["repd_ref"]
        ]
        projects.append(
            {
                "gg_project_id": record["gg_project_id"],
                "gg_development_id": record["gg_development_id"],
                "identity_status": record["identity_status"],
                "repd_ref": record["repd_ref"],
                "repd_old_ref": record["repd_old_ref"],
                "repd_record_updated": record["repd_record_updated"],
                "name": record["site_name"],
                "technology": category,
                "repd_technology": record["technology"],
                "capacity_mw": capacity,
                "capacity_known": True,
                "status": record["status"],
                "lifecycle": record["lifecycle"],
                "operator": record["operator"] or None,
                "county": record["county"] or None,
                "region": record["region"] or None,
                "country": record["country"] or None,
                "planning_authority": record["planning_authority"] or None,
                "planning_application_reference": record["planning_application_reference"] or None,
                "planning_application_submitted": record["planning_application_submitted"],
                "planning_application_withdrawn": record["planning_application_withdrawn"],
                "planning_permission_refused": record["planning_permission_refused"],
                "planning_permission_granted": record["planning_permission_granted"],
                "planning_permission_expired": record["planning_permission_expired"],
                "under_construction": record["under_construction"],
                "operational": record["operational"],
                "related_repd_refs": record["development_repd_refs"][1:],
                "relationships": record["relationships"],
                "development_relationships": development_relationships,
                "source_row": record["source_row"],
            }
        )

    projects.sort(key=lambda item: (-item["capacity_mw"], item["name"].casefold(), numeric_sort(item["repd_ref"])))
    solar_count = sum(item["technology"] == "solar" for item in projects)
    bess_count = sum(item["technology"] == "bess" for item in projects)
    if (solar_count, bess_count, len(projects)) != (
        EXPECTED_SOLAR_GT1,
        EXPECTED_BESS_GT100,
        EXPECTED_SOLAR_GT1 + EXPECTED_BESS_GT100,
    ):
        raise RuntimeError(
            "Canonical V6 threshold universe mismatch: "
            f"solar={solar_count} bess={bess_count} total={len(projects)}"
        )

    canonical_projects = json.dumps(projects, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    update_count = sum(bool(item["repd_record_updated"]) for item in projects)
    snapshot = {
        "schema": "globalgrid2050.major-projects.v6",
        "identity_schema": SCHEMA,
        "version": 6,
        "validated_at": manifest["validated_at"],
        "source_owner": manifest["source_owner"],
        "source_dataset_title": manifest["source_dataset_title"],
        "source_publication_date": manifest["source_page_last_updated"],
        "source_page": manifest["source_page"],
        "source_csv_url": manifest["source_url"],
        "source_xlsx_url": manifest["source_excel_url"],
        "source_hashes": manifest["source_hashes"],
        "source_record_count": EXPECTED_ROWS,
        "source_unique_ref_count": EXPECTED_ROWS,
        "csv_xlsx_reconciled": True,
        "repd_bound": True,
        "globalgrid_id_required": True,
        "canonical_capacity_source": manifest["canonical_capacity_source"],
        "thresholds": manifest["thresholds"],
        "project_count": len(projects),
        "count": len(projects),
        "solar_count": solar_count,
        "bess_count": bess_count,
        "record_update_supplied_count": update_count,
        "record_update_missing_count": len(projects) - update_count,
        "projects_sha256": hashlib.sha256(canonical_projects.encode("utf-8")).hexdigest(),
        "projects": projects,
    }
    return snapshot


def main():
    manifest = load_manifest()
    source_url, canonical_path = ensure_official_csv(manifest)
    rows, headers, relationship_columns = read_official_rows(canonical_path)
    registry = build_registry(rows, manifest, source_url)
    registry["detected_header_count"] = len(headers)
    registry["detected_relationship_columns"] = relationship_columns
    IDENTITY_OUT.write_text(json.dumps(registry, indent=2), encoding="utf-8")
    snapshot = build_public_snapshot(registry, manifest)
    PROJECTS_OUT.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")
    manifest["public_snapshot"] = {
        "path": "dist/major_projects_v6.json",
        "project_count": snapshot["project_count"],
        "projects_sha256": snapshot["projects_sha256"],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(
        "identity",
        f"raw={registry['raw_record_count']}",
        f"repd={registry['repd_bound_count']}",
        f"gg_only={registry['globalgrid_only_count']}",
        f"groups={registry['development_group_count']}",
        f"coverage={registry['repd_ref_coverage']:.3%}",
        f"public_projects={snapshot['project_count']}",
    )


if __name__ == "__main__":
    main()
