#!/usr/bin/env python3
"""Agent 3: fail-closed candidate evidence manifest validator (offline contract only).

Usage: python3 automation/pipeline_release/agent3_candidate_gate.py manifest.json
This never publishes, fetches external sources or approves a release.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

SHA = re.compile(r"^[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
REQUIRED = (
    "source", "rights", "identity", "top200", "history", "strict_ci",
    "integrated_ci", "editorial_ci", "probe_ci", "browser_390",
    "browser_1440", "accessibility", "csv", "map", "served_bytes", "rollback",
    "dc_exclusion",
)
REQUIRED_ARTIFACTS = ("html", "js", "css", "json", "csv")

def check(manifest):
    errors = []
    if not isinstance(manifest, dict):
        return ["manifest must be an object"]
    for name in ("candidate_commit", "desnz_source_commit", "protected_history_commit"):
        if not COMMIT.fullmatch(str(manifest.get(name, ""))):
            errors.append(f"{name}: exact 40-character commit SHA required")
    if not SHA.fullmatch(str(manifest.get("desnz_csv_sha256", ""))):
        errors.append("desnz_csv_sha256: original official bytes digest required")
    ids = manifest.get("canonical_repd_ids")
    if not isinstance(ids, list) or len(ids) != 200 or any(
        isinstance(x, bool) or not isinstance(x, int) or x <= 0 for x in ids
    ) or len(set(ids)) != 200:
        errors.append("canonical_repd_ids: exactly 200 distinct positive integer IDs required")
    gates = manifest.get("gates")
    if not isinstance(gates, dict):
        gates = {}
        errors.append("gates object missing")
    for name in REQUIRED:
        gate = gates.get(name)
        if not isinstance(gate, dict) or gate.get("status") != "PASS":
            errors.append(f"{name}: not independently PASS")
            continue
        if not gate.get("evidence_url") or not gate.get("tested_commit"):
            errors.append(f"{name}: evidence URL and tested commit required")
        elif gate["tested_commit"] != manifest.get("candidate_commit"):
            errors.append(f"{name}: tested commit differs from candidate")
    artifacts = manifest.get("served_sha256", {})
    if not isinstance(artifacts, dict):
        artifacts = {}
    for name in REQUIRED_ARTIFACTS:
        if not SHA.fullmatch(str(artifacts.get(name, ""))):
            errors.append(f"served_sha256.{name}: missing SHA256")
    if manifest.get("writer_on_failed_tests") is not False:
        errors.append("writer_on_failed_tests must be false")
    if manifest.get("public_release_count", 0) and errors:
        errors.append("release claimed while evidence gates fail")
    return errors

def main():
    if len(sys.argv) != 2:
        print("Usage: agent3_candidate_gate.py manifest.json", file=sys.stderr)
        return 2
    try:
        manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"HOLD: cannot read manifest: {exc}")
        return 2
    errors = check(manifest)
    for error in errors:
        print("HOLD:", error)
    if errors:
        print(f"HOLD: {len(errors)} missing/invalid release receipts; no publication authority")
        return 1
    print("MANIFEST CONTRACT COMPLETE ONLY; external evidence and actual browser/deployment remain independently unverified")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
