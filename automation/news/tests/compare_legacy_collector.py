#!/usr/bin/env python3
"""Fail-closed exact legacy replay excluding an owner-rejected publisher.

All other publishers, records, REPD matches and counts must remain equivalent.
No existing UI, REPD, publication, or version file may be changed by this PR.
"""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
MODULES = ("pipeline_headlines.py", "datacentre_feed.py", "names.py", "research_indexes.py")
ALLOWED = {
    ".github/workflows/pipeline-headlines.yml",
    "automation/news/pipeline_headlines.py",
    "automation/news/pipeline_feeds.json",
    "automation/news/tests/test_pipeline_headlines.py",
    "automation/news/tests/test_spp_verified_public_links.py",
    "automation/news/tests/test_spp_excluded.py",
    "automation/news/tests/compare_legacy_collector.py",
}



def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def ensure_scope(base: str) -> None:
    changed = {s for s in git("diff", "--name-only", f"{base}..HEAD").decode().splitlines() if s}
    forbidden = changed - ALLOWED
    if forbidden:
        raise AssertionError("Unrelated change detected: " + ", ".join(sorted(forbidden)))
    expected = {"automation/news/pipeline_headlines.py", "automation/news/pipeline_feeds.json", "automation/news/tests/test_spp_excluded.py"}
    if not expected <= changed:
        raise AssertionError("Expected additive collector/config changes missing")


def run_once(script: Path, feeds: Path, fixtures: Path, repd: Path, dest: Path) -> dict:
    subprocess.run(
        [sys.executable, str(script), "--feeds", str(feeds),
         "--fixtures", str(fixtures), "--repd", str(repd), "--out", str(dest),
         "--now", "2026-11-14T12:00:00Z"],
        cwd=ROOT, check=True, capture_output=True, text=True, timeout=60)
    return json.loads(dest.read_text(encoding="utf-8"))


def ensure_only_owner_rejected_publisher_removed(base: str) -> None:
    old = json.loads(git("show", f"{base}:automation/news/pipeline_feeds.json"))
    new = json.loads((ROOT / "automation/news/pipeline_feeds.json").read_text(encoding="utf-8"))
    legacy = old["feeds"]
    excluded = [f for f in legacy if f.get("source") == "Solar Power Portal"]
    remaining = [f for f in legacy if f.get("source") != "Solar Power Portal"]
    if len(excluded) != 5:
        raise AssertionError("Expected five Solar Power Portal original entries")
    if new["feeds"] != remaining:
        raise AssertionError("Unrelated source records, order, flags or dates changed")
    if new.get("excluded_sources") != ["Solar Power Portal"]:
        raise AssertionError("Publisher exclusion policy missing")
    if new.get("source_patch_id") != "20261121-exclude-solar-power-portal-v1":
        raise AssertionError("Unexpected exclusion source patch")
    if new.get("source_release_id") != old.get("source_release_id"):
        raise AssertionError("Prior source edition must not change")
    if any(f.get("url", "").startswith("https://www.solarpowerportal.co.uk/")
           for f in new["feeds"]):
        raise AssertionError("Excluded publisher endpoint still in active catalogue")
    print(f"PASS: {len(remaining)} original nonexcluded sources unchanged; 5 blocked entries removed")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="PR Git base, e.g. HEAD^1")
    args = ap.parse_args()
    base = args.base
    ensure_scope(base)
    ensure_only_owner_rejected_publisher_removed(base)
    fixtures = ROOT / "automation/news/tests/fixtures/pipeline"
    with tempfile.TemporaryDirectory(prefix="pn-legacy-comparison-") as tmp:
        tmp = Path(tmp)
        baseline = tmp / "baseline" / "automation" / "news"
        baseline.mkdir(parents=True)
        for file in MODULES:
            (baseline / file).write_bytes(git("show", f"{base}:automation/news/{file}"))
        # Exclude Solar Power Portal from BOTH runs. Every other fixture item
        # must match the unchanged baseline byte-for-byte.
        fixture = json.loads(git("show", f"{base}:automation/news/tests/fixtures/pipeline/feeds.json"))
        fixture["feeds"] = [f for f in fixture["feeds"]
                            if f.get("source") != "Solar Power Portal"]
        (tmp / "original_feeds.json").write_text(json.dumps(fixture), encoding="utf-8")
        repd = tmp / "repd-fixture.csv"
        with repd.open("w", encoding="utf-8", newline="") as fp:
            writer = csv.DictWriter(fp, fieldnames=[
                "Ref ID", "Site Name", "Technology Type", "Operator (or Applicant)",
                "County", "Planning Authority", "Region"])
            writer.writeheader()
            writer.writerow({
                "Ref ID": "12588", "Site Name": "Botley West Solar Project",
                "Technology Type": "Solar Photovoltaics", "Operator (or Applicant)": "SolarFive",
                "County": "Oxfordshire", "Planning Authority": "West Oxfordshire",
                "Region": "South East"})
        old = run_once(baseline / MODULES[0], tmp / "original_feeds.json",
                       fixtures, repd, tmp / "old.json")
        new = run_once(ROOT / "automation/news/pipeline_headlines.py",
                       tmp / "original_feeds.json", fixtures, repd, tmp / "new.json")
    # Except the explicitly removed publisher, existing article metadata, dates,
    # REPD association, counts and feed health must remain unchanged.
    for key in ("items", "counts", "feeds", "status", "schema", "generated_at", "limits"):
        if old[key] != new[key]:
            raise AssertionError(f"Legacy output regression: {key}")
    print(f"PASS: {len(old['items'])} remaining-publisher headlines unchanged; "
          f"no unrelated release or UI edits")


if __name__ == "__main__":
    main()
