#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DATA = ROOT / "data"
REPD_MASTER = DIST / "repd_master.json"
MANIFEST = DIST / "manifest_v4.json"
LOCAL_CSV = DATA / "latest_repd.csv"
IDENTITY_OUT = DIST / "project_identity_v6.json"

SCHEMA = "globalgrid2050.project-identity.v6"
MIN_REPD_ROWS = 1000
MIN_REF_COVERAGE = 0.999


def clean(v):
    s = str(v or "").strip()
    return "" if s.lower() in {"nan", "none", "null", "not set"} else s


def norm(v):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean(v).lower().replace("&", " and "))).strip()


def canon_header(v):
    return norm(v)


def clean_ref(v):
    s = clean(v)
    if re.fullmatch(r"\d+\.0", s):
        s = s[:-2]
    return s


def split_refs(v):
    # REPD cross-reference cells are normally numeric IDs, sometimes separated by punctuation.
    return list(dict.fromkeys(re.findall(r"\b\d+\b", clean(v))))


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
        raise RuntimeError("Missing dist/manifest_v4.json; cannot bind identity to a declared DESNZ edition")
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def ensure_official_csv(manifest):
    source_url = clean(manifest.get("source_url"))
    if not source_url or not source_url.lower().endswith(".csv") or "assets.publishing.service.gov.uk" not in source_url:
        raise RuntimeError(f"Manifest does not point to an official DESNZ CSV: {source_url!r}")
    DATA.mkdir(parents=True, exist_ok=True)
    r = requests.get(source_url, headers={"User-Agent": "GlobalGrid2050/6.0 (+https://globalgrid2050.com/)"}, timeout=45)
    r.raise_for_status()
    LOCAL_CSV.write_bytes(r.content)
    return source_url


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

    reader = csv.DictReader(text.splitlines())
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
        "planning_authority": resolve(headers, "Planning Authority", "Local Planning Authority"),
        "planning_application_reference": resolve(headers, "Planning Application Reference"),
    }
    required = ["ref_id", "site_name", "technology"]
    missing = [k for k in required if not cols[k]]
    if missing:
        raise RuntimeError(f"Official REPD schema missing identity columns after header normalisation: {missing}; headers={headers}")

    # Future-proof REPD relationship discovery: take any cross-reference field containing
    # 'REPD Ref ID', except this row's own Ref ID and the historical Old Ref ID.
    relationship_columns = []
    for h in headers:
        ch = canon_header(h)
        if "repd ref id" in ch and ch not in {canon_header(cols["ref_id"]), canon_header(cols["old_ref_id"])}:
            relationship_columns.append(h)

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
            "planning_authority": clean(source.get(cols["planning_authority"])) if cols["planning_authority"] else "",
            "planning_application_reference": clean(source.get(cols["planning_application_reference"])) if cols["planning_application_reference"] else "",
            "direct_related_repd_refs": [],
        }
        related = []
        for h in relationship_columns:
            related.extend(split_refs(source.get(h)))
        out["direct_related_repd_refs"] = [r for r in dict.fromkeys(related) if r and r != repd_ref]
        rows.append(out)
    return rows, headers, relationship_columns


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

    # Explicit REPD cross-references are the strongest grouping signal.
    for ref, row in current.items():
        for related in row["direct_related_repd_refs"]:
            if related in refs:
                uf.union(ref, related)

    # Planning references are strong development-level identifiers when combined with
    # planning authority. NSIP EN-references are nationally unique and may group without it.
    planning_groups = defaultdict(list)
    for ref, row in current.items():
        planning_ref = norm(row["planning_application_reference"])
        authority = norm(row["planning_authority"])
        if not planning_ref:
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

    groups = defaultdict(list)
    for ref in refs:
        groups[uf.find(ref)].append(ref)

    group_id = {}
    for root_ref, members in groups.items():
        members = sorted(members, key=lambda x: (int(x) if x.isdigit() else 10**18, x))
        planning_candidates = []
        for ref in members:
            row = current[ref]
            pr = norm(row["planning_application_reference"])
            pa = norm(row["planning_authority"])
            if pr:
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
            siblings = sorted([r for r in groups[uf.find(ref)] if r != ref], key=lambda x: (int(x) if x.isdigit() else 10**18, x))
            planning_siblings = []
            pr = norm(row["planning_application_reference"])
            pa = norm(row["planning_authority"])
            if pr:
                for other_ref, other in current.items():
                    if other_ref == ref:
                        continue
                    if norm(other["planning_application_reference"]) != pr:
                        continue
                    if pa and norm(other["planning_authority"]) != pa:
                        continue
                    planning_siblings.append(other_ref)
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

        records.append(
            {
                "gg_project_id": gid,
                "gg_development_id": development_id,
                "identity_status": identity_status,
                "identity_confidence": confidence,
                "repd_ref": ref or None,
                "repd_old_ref": row["repd_old_ref"] or None,
                "repd_record_updated_raw": row["repd_record_updated_raw"] or None,
                "site_name": row["site_name"],
                "technology": row["technology"],
                "capacity_mw_raw": row["capacity_mw_raw"] or None,
                "status": row["status"],
                "operator": row["operator"],
                "county": row["county"],
                "region": row["region"],
                "planning_authority": row["planning_authority"],
                "planning_application_reference": row["planning_application_reference"],
                "direct_related_repd_refs": sorted(row["direct_related_repd_refs"], key=lambda x: (int(x) if x.isdigit() else 10**18, x)),
                "planning_sibling_repd_refs": sorted(set(planning_siblings), key=lambda x: (int(x) if x.isdigit() else 10**18, x)),
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


def enrich_master(registry):
    if not REPD_MASTER.exists():
        raise RuntimeError("Missing dist/repd_master.json")
    master = json.loads(REPD_MASTER.read_text(encoding="utf-8"))
    by_ref = {str(r["repd_ref"]): r for r in registry["records"] if r.get("repd_ref")}
    missing = []
    for feature in master.get("features", []):
        p = feature.setdefault("properties", {})
        ref = clean_ref(p.get("repd_ref"))
        if not ref or ref not in by_ref:
            missing.append((ref, p.get("name")))
            continue
        r = by_ref[ref]
        p["gg_project_id"] = r["gg_project_id"]
        p["gg_development_id"] = r["gg_development_id"]
        p["identity_status"] = "REPD_BOUND"
        p["repd_related_refs"] = r["direct_related_repd_refs"]
        p["repd_planning_sibling_refs"] = r["planning_sibling_repd_refs"]
        p["repd_development_refs"] = r["development_repd_refs"]
    if missing:
        raise RuntimeError(f"REPD master contains features that cannot be bound to official identity registry: {missing[:20]}")
    master["identity_schema"] = SCHEMA
    REPD_MASTER.write_text(json.dumps(master, separators=(",", ":")), encoding="utf-8")


def main():
    manifest = load_manifest()
    source_url = ensure_official_csv(manifest)
    rows, headers, relationship_columns = read_official_rows(LOCAL_CSV)
    registry = build_registry(rows, manifest, source_url)
    enrich_master(registry)
    registry["detected_header_count"] = len(headers)
    registry["detected_relationship_columns"] = relationship_columns
    IDENTITY_OUT.write_text(json.dumps(registry, indent=2), encoding="utf-8")
    print(
        "identity",
        f"raw={registry['raw_record_count']}",
        f"repd={registry['repd_bound_count']}",
        f"gg_only={registry['globalgrid_only_count']}",
        f"groups={registry['development_group_count']}",
        f"coverage={registry['repd_ref_coverage']:.3%}",
    )


if __name__ == "__main__":
    main()
