#!/usr/bin/env python3
"""Agent3 P2 read-only release preflight. Never writes, deploys or authorises publication.

Usage:
  python3 automation/pipeline_release/agent3_readonly_gate.py --repo . --out /tmp/baseline.json
  python3 automation/pipeline_release/agent3_readonly_gate.py --repo . --candidate-id YYYYMMDDHHMM --out /tmp/candidate.json

Independent publisher rights, actual served SHA, real browser/CSV/MAP and rollback
require separate externally checked receipts; this script NEVER returns a GO.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

PROTECTED = {
    "202609082224": "6247a0c3c00e8e88324d9ea55b22d67dbbb1be90",
    "202611132345": "0c7a4ed5ea369e4a4e71a45cfa6fe9c186fae773",
    "202611140306": "365d7df093368c39c3878daacf65449ba32e7267",
}
OPERATIVE = "202611140306"
V921 = "202611141017"
RECORDS = 7775
OFFICIAL = {
    "csv": "48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862",
    "xlsx": "87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea",
}
REQUIRED_EVIDENCE = (
    "official_csv_xlsx", "top200_identity", "strict_integrated_ci",
    "independent_publisher_rights_and_bindings", "editorial_red_green",
    "real_browser_1440", "real_browser_390", "downloaded_csv",
    "clicked_map_receiver", "public_served_sha256", "rollback_dry_run",
)

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def object_tree(repo, release):
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse",
             "HEAD:uk_renewables_pipeline/" + release], text=True,
            stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

def git_head(repo):
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True,
            stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

def protected_audit(repo, tree_reader=object_tree):
    audit = {}
    for release, pin in PROTECTED.items():
        observed = tree_reader(repo, release)
        audit[release] = {
            "status": "PASS" if observed == pin else "FAIL",
            "observed": observed, "expected": pin,
        }
    try:
        versions = json.loads((repo / "uk_renewables_pipeline/versions.json").read_text())
        operative = versions["release_candidate"]["operative"]["id"]
    except (OSError, ValueError, KeyError, TypeError):
        operative = None
    # During staging the protected operative V9.20 is required. After an approved
    # promotion a NEW dated version of this gate would be needed: no silent pin drift.
    audit["operative"] = {"status": "PASS" if operative == OPERATIVE else "FAIL",
                          "observed": operative, "expected": OPERATIVE}
    return audit

def read_projects(folder):
    """Audit every partition and returned unique REPD Ref ID, not only the count."""
    root = folder.resolve()
    manifest = json.loads((folder / "data/v9.1/build_manifest.json").read_text())
    refs = set()
    errors = []
    partitions = manifest.get("project_partitions", [])
    if not isinstance(partitions, list) or not partitions:
        return 0, ["no project partitions"]
    total = 0
    for entry in partitions:
        rel = entry.get("path", "")
        target = (folder / rel).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            errors.append("missing or unsafe project partition: " + str(rel))
            continue
        b = target.read_bytes()
        if sha256(b) != entry.get("sha256"):
            errors.append("partition hash mismatch: " + str(rel))
            continue
        try:
            records = json.loads(b)["projects"]
        except (ValueError, KeyError, TypeError):
            errors.append("invalid JSON project partition: " + str(rel))
            continue
        if not isinstance(records, list) or len(records) != entry.get("record_count"):
            errors.append("partition record count mismatch: " + str(rel))
            continue
        for record in records:
            ref = str(record.get("repd_ref", ""))
            if not ref.isdigit() or ref in refs:
                errors.append("duplicate/invalid REPD identity in " + str(rel))
            refs.add(ref)
            typ = str(record.get("technology", "")).lower()
            if "data_centre" in typ or "datacentre" in typ or typ == "dc":
                errors.append("DC identity in project partition: " + ref)
        total += len(records)
    if manifest.get("project_count") != RECORDS or total != RECORDS or len(refs) != RECORDS:
        errors.append(f"REPD rows not exactly {RECORDS}: manifest={manifest.get('project_count')} rows={total} unique={len(refs)}")
    return len(refs), errors

def ensure_original_repd_partitions(repo, folder):
    """The solar-news-only successor MUST retain Q3 project bytes, not just row count."""
    original = repo / "uk_renewables_pipeline" / OPERATIVE / "data/v9.1/build_manifest.json"
    candidate = folder / "data/v9.1/build_manifest.json"
    try:
        a = json.loads(original.read_text())
        b = json.loads(candidate.read_text())
        get = lambda m: sorted((x["path"], x["sha256"], x["record_count"])
                               for x in m["project_partitions"])
        if get(a) != get(b):
            return ["candidate REPD partitions differ from protected V9.20 source"]
    except (OSError, ValueError, KeyError, TypeError):
        return ["cannot compare candidate with protected V9.20 source partitions"]
    return []

def prohibited_dc_payload(folder):
    """Reject obvious DC IDs and explicit dataset payload types, including in UI JS.

    Negative scan is necessary but NOT sufficient proof of complete semantic exclusion.
    """
    errors = []
    for f in folder.rglob("*"):
        if not f.is_file() or f.suffix.lower() not in (".json", ".csv", ".js", ".html", ".geojson"):
            continue
        rel = str(f.relative_to(folder))
        if f.stat().st_size > 30_000_000:
            errors.append("oversized unaudited candidate file: " + rel)
            continue
        data = f.read_bytes().lower()
        if b"dcuk-" in data or re.search(rb'"technology"\s*:\s*"(?:datacentre|data[_ -]centre|dc)"', data):
            errors.append("unverified DC payload detected: " + rel)
    return errors

def verify(repo, candidate=None, tree_reader=object_tree):
    head = git_head(repo)
    audit = protected_audit(repo, tree_reader)
    errors = ["protected release/pointer mismatch: " + k for k,v in audit.items() if v["status"] != "PASS"]
    result = {"schema": "ventus.agent3.p2.readonly-preflight.v1",
              "head": head, "candidate_id": candidate,
              "protected": audit, "official_sha256_pins": OFFICIAL,
              "required_external_acceptance": {k: "UNVERIFIED" for k in REQUIRED_EVIDENCE},
              "release_authorised": False, "publication_status": "HOLD"}
    if candidate is not None:
        if not re.fullmatch(r"20\d{10}", str(candidate)) or candidate <= V921:
            errors.append("candidate ID must be a NEW dated version beyond V9.21")
        else:
            folder = repo / "uk_renewables_pipeline" / str(candidate)
            if not folder.is_dir():
                errors.append("new immutable candidate folder absent")
            else:
                if not (folder / "index.html").is_file():
                    errors.append("candidate index.html absent")
                try:
                    n, faults = read_projects(folder)
                    result["candidate_unique_repd_refs"] = n
                    errors.extend(faults)
                except (OSError, ValueError, KeyError, TypeError) as exc:
                    errors.append("invalid candidate partition: " + str(exc))
                errors.extend(ensure_original_repd_partitions(repo, folder))
                errors.extend(prohibited_dc_payload(folder))
    result["errors"] = errors
    result["offline_integrity_status"] = "FAIL" if errors else "PASS"
    result["acceptance_status"] = "UNVERIFIED"
    return result

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", type=Path, default=Path("."))
    p.add_argument("--candidate-id")
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    out = verify(a.repo.resolve(), a.candidate_id)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps({k: out[k] for k in
        ("head","candidate_id","offline_integrity_status","acceptance_status","publication_status","errors")}))
    return 2 if out["errors"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
