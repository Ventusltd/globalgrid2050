#!/usr/bin/env python3
"""Read-only, fail-closed structural rights gate for NEW data-centre release candidates.

This does not grant legal clearance. Independent publisher-rights and ODbL
derivative/collective review remain required even when this structural gate passes.
It never edits existing Q3, V9.20, data branches or homepage pointers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

HEX64 = re.compile(r"^[0-9a-f]{64}$")
TREATMENTS = {"collective", "derivative", "not_applicable"}


def audit(doc, rights):
    errors = []
    if doc.get("schema") != "globalgrid2050.pipeline-news.datacentre-sites.v1":
        errors.append("invalid data-centre candidate schema")
    sites = doc.get("sites")
    if not isinstance(sites, list) or not sites:
        return {"pass": False, "sites": 0, "source_entries": 0,
                "errors": errors + ["missing site records"]}
    entries = rights.get("sources") if isinstance(rights, dict) else None
    if not isinstance(entries, list):
        entries = []
    ledger = {}
    for row in entries:
        if not isinstance(row, dict) or not row.get("source_id"):
            errors.append("malformed rights-ledger entry")
            continue
        key = row["source_id"]
        if key in ledger:
            errors.append("duplicate rights-ledger source_id: " + str(key))
        ledger[key] = row
    ids = set()
    total = 0
    unresolved = 0
    for site in sites:
        if not isinstance(site, dict):
            errors.append("non-object site")
            continue
        site_id = str(site.get("id") or "")
        if not site_id.startswith("dcuk-") or site_id in ids:
            errors.append("invalid or duplicate dcuk site id: " + site_id)
        ids.add(site_id)
        sources = site.get("sources")
        if not isinstance(sources, list) or not sources:
            errors.append(site_id + ": missing provenance sources")
            continue
        for source in sources:
            total += 1
            if not isinstance(source, dict):
                errors.append(site_id + ": invalid source object")
                continue
            sid = str(source.get("id") or "")
            if source.get("licence_status") != "verified":
                unresolved += 1
                errors.append(site_id + "/" + sid + ": source licence not verified")
            for key in ("id", "dataset", "url", "licence", "licence_url", "attribution"):
                if not isinstance(source.get(key), str) or not source[key].strip():
                    errors.append(site_id + "/" + sid + ": missing " + key)
            proof = ledger.get(sid)
            if proof is None:
                errors.append(site_id + "/" + sid + ": no independent rights-ledger entry")
                continue
            # A valid-looking receipt for a different publisher/dataset must not clear this source.
            for field, proof_field in (("url", "source_url"), ("licence", "licence"), ("attribution", "attribution")):
                if source.get(field) != proof.get(proof_field):
                    errors.append(sid + ": rights ledger source identity mismatch: " + field)
            for key in ("publisher", "terms_url", "checked_at", "reviewer"):
                if not isinstance(proof.get(key), str) or not proof[key].strip():
                    errors.append(sid + ": missing rights evidence " + key)
            if not HEX64.fullmatch(str(proof.get("terms_sha256") or "")):
                errors.append(sid + ": missing exact rights-terms SHA256")
            if proof.get("redistribution") != "verified":
                errors.append(sid + ": redistribution not independently verified")
            treatment = proof.get("database_treatment")
            if treatment not in TREATMENTS:
                errors.append(sid + ": missing database treatment review")
            if source.get("licence") == "ODbL-1.0" and treatment == "not_applicable":
                errors.append(sid + ": ODbL requires derivative/collective classification")
            if treatment == "derivative" and not proof.get("derived_database_access_url"):
                errors.append(sid + ": derivative database access not recorded")
    return {"pass": not errors, "sites": len(sites), "source_entries": total,
            "unverified_source_entries": unresolved, "rights_ledger_entries": len(ledger),
            "errors": errors}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("candidate", type=Path, help="versioned convergence/datacentres.json")
    parser.add_argument("rights", type=Path, help="independently reviewed per-source rights ledger")
    parser.add_argument("--report", type=Path, help="optional JSON report output")
    args = parser.parse_args()
    doc = json.loads(args.candidate.read_text(encoding="utf-8"))
    rights = json.loads(args.rights.read_text(encoding="utf-8"))
    result = audit(doc, rights)
    result["candidate_sha256"] = hashlib.sha256(args.candidate.read_bytes()).hexdigest()
    result["rights_sha256"] = hashlib.sha256(args.rights.read_bytes()).hexdigest()
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.report:
        args.report.write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    return 0 if result["pass"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
