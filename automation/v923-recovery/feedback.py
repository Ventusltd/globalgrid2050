#!/usr/bin/env python3
"""Deterministic V9.23 CI feedback: diagnose failures, never self-authorise publication.

The half-hourly workflow writes this report for an independent agent to decide
the next code patch. GitHub Actions cannot infer or fabricate a successful fix.
"""
from __future__ import annotations
import datetime as dt
import json
import os
import sys
from pathlib import Path

TARGET = "202611160020"

SUGGESTED_REPAIRS = {
    "tree_unchanged": "Re-run the candidate generator and pin only the new V9.23 tree; never repin historical versions.",
    "runner": "Inspect the exact failing V9.23 runner step and its pinned V9.22 parent.",
    "map_contract": "Diff every generated MAP deep link against the canonical V9.22 contract; do not change GridAtlas unilaterally.",
    "grid_engine_contract": "Test the actual Grid Engine parameters and nearest-result receiver; URLs alone are insufficient.",
    "map_links_identical_to_parent": "Restore character-for-character V9.22 MAP href parity for all 7,775 REPD records.",
    "data_unchanged_from_parent": "Reject any new candidate that silently rewrites official REPD source data.",
    "features_kept": "List the exact inherited feature lost; only the owner's explicit withdrawn features may be retired.",
    "feature_probes": "Inspect failed named browser probes; recreate the event in Chromium/WebKit and add a targeted negative test.",
    "browser": "Inspect screenshots, JS exceptions, same-origin failures and 390/393 mobile layout independently.",
    "csv_export": "Compare all 7,775 exported rows and their exact header/body hashes with the parent.",
    "size_budget": "Remove unneeded duplicated assets without touching the frozen source partitions.",
}

def analyse(document: dict | None, head: str = "") -> dict:
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    result = {
        "schema": "globalgrid2050.pipeline-news.v923-ci-feedback.v1",
        "generated_at_utc": now,
        "candidate": TARGET,
        "head": head,
        "verdict": "UNVERIFIED",
        "failed_checks": [],
        "failed_browser_probes": [],
        "next_repair_actions": [],
        "release_holds": [
            "Original publisher rights and independently accepted article-to-REPD binding unverified",
            "GridAtlas REPD12588/REPD2470 mobile first-restore regressions remain known issues",
            "Independent physical iPhone and served immutable V9.23 byte acceptance pending",
            "Production homepage remains V9.22",
        ],
    }
    if not document or not isinstance(document.get("versions"), list):
        result["next_repair_actions"].append("NO_VERDICT_FILE: inspect the generator and workflow that stopped before release verification.")
        return result
    version = next((v for v in document["versions"] if v.get("id") == TARGET), None)
    if not version:
        result["next_repair_actions"].append("MISSING_V923_VERDICT: verify the branch and exact candidate identity.")
        return result
    checks = version.get("checks") or {}
    failed = sorted(name for name, value in checks.items() if not isinstance(value, dict) or value.get("pass") is not True)
    result["failed_checks"] = failed
    for name in failed:
        result["next_repair_actions"].append(SUGGESTED_REPAIRS.get(name, "Inspect the raw verdict and add a named regression test for " + name + "."))
        if name == "feature_probes":
            probes = checks[name].get("results") or []
            result["failed_browser_probes"] = [
                {"name": p.get("name", "unnamed"), "viewport": p.get("viewport", "unknown"),
                 "detail": str(p.get("detail") or "")[:500]}
                for p in probes if p.get("pass") is not True
            ][:30]
    result["verdict"] = "PRODUCT_CI_PASS_WITH_OPEN_EXTERNAL_HOLDS" if not failed else "PRODUCT_CI_FAIL"
    return result

def main(argv: list[str]) -> int:
    if len(argv) != 4:
        raise SystemExit("usage: feedback.py INPUT_VERDICTS_JSON OUTPUT_JSON OUTPUT_MARKDOWN")
    incoming, out_json, out_md = map(Path, argv[1:4])
    try:
        doc = json.loads(incoming.read_text()) if incoming.is_file() else None
    except (OSError, ValueError, TypeError):
        doc = None
    info = analyse(doc, os.getenv("ACTUAL_CANDIDATE_SHA") or os.getenv("GITHUB_SHA", "unverified"))
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    msg = [
        "## V9.23 CI feedback (automated, non-publishing)",
        "UTC: " + info["generated_at_utc"],
        "Exact checkout/commit: " + info["head"],
        "Verdict: **" + info["verdict"] + "**",
        "Failed checks: " + (", ".join(info["failed_checks"]) or "none measured"),
    ]
    if info["failed_browser_probes"]:
        msg.append("Failed browser probes:")
        msg.extend("- " + str(p["name"]) + " [" + str(p["viewport"]) + "] " + p["detail"]
                   for p in info["failed_browser_probes"])
    msg.append("Next reproducible repair:")
    msg.extend("- " + item for item in (info["next_repair_actions"] or ["No product regression detected; obtain independent evidence and maintain the release hold."]))
    msg.append("Release limits (not waived):")
    msg.extend("- " + item for item in info["release_holds"])
    out_md.write_text("\n".join(msg) + "\n", encoding="utf-8")
    print(info["verdict"], "failures=", len(info["failed_checks"]),
          "probe failures=", len(info["failed_browser_probes"]))
    return 0  # Preserve reports even when earlier validation failed.

if __name__ == "__main__":
    sys.exit(main(sys.argv))
