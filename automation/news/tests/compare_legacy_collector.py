#!/usr/bin/env python3
"""Fail-closed legacy replay and exact source guard for the BBC COP31 priority lane.

Every pre-existing publisher, UK planning record, REPD match and output must
remain equivalent on the original fixture. No homepage or version edits.
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
    "automation/news/news_algorithm.py",
    "automation/news/tests/test_cop31_climate_priority.py",
}



def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def ensure_scope(base: str) -> None:
    changed = {s for s in git("diff", "--name-only", f"{base}..HEAD").decode().splitlines() if s}
    forbidden = changed - ALLOWED
    if forbidden:
        raise AssertionError("Unrelated change detected: " + ", ".join(sorted(forbidden)))
    expected = {"automation/news/pipeline_headlines.py", "automation/news/pipeline_feeds.json",
                "automation/news/news_algorithm.py", "automation/news/tests/test_cop31_climate_priority.py"}
    if not expected <= changed:
        raise AssertionError("Expected additive collector/config changes missing")


def run_once(script: Path, feeds: Path, fixtures: Path, repd: Path, dest: Path) -> dict:
    subprocess.run(
        [sys.executable, str(script), "--feeds", str(feeds),
         "--fixtures", str(fixtures), "--repd", str(repd), "--out", str(dest),
         "--now", "2026-11-14T12:00:00Z"],
        cwd=ROOT, check=True, capture_output=True, text=True, timeout=60)
    return json.loads(dest.read_text(encoding="utf-8"))


def ensure_only_cop31_bbc_added(base: str) -> None:
    old = json.loads(git("show", f"{base}:automation/news/pipeline_feeds.json"))
    new = json.loads((ROOT / "automation/news/pipeline_feeds.json").read_text(encoding="utf-8"))
    legacy = old["feeds"]
    feeds = new["feeds"]
    assert len(feeds) == len(legacy) + 1, "Exactly one curated BBC link expected"
    assert feeds[:len(legacy)] == legacy, "Prior feeds, source order and flags must not change"
    addition = feeds[-1]
    assert addition.get("url") == "https://www.bbc.co.uk/news/articles/c6ly5w40eg07o"
    assert addition.get("source") == "BBC News"
    assert addition.get("kind") == "curated"
    assert addition.get("uk_only") is False
    assert addition.get("title") == "COP31 fossil-fuel negotiations reach a deadlock"
    assert addition.get("date") == "2026-11-21T07:31:05Z"
    assert new.get("climate_policy_patch_id") == "20261122-cop31-priority-v1"
    assert new.get("source_patch_id") == old.get("source_patch_id")
    assert new.get("excluded_sources") == old.get("excluded_sources") == ["Solar Power Portal"]
    assert new.get("source_release_id") == old.get("source_release_id")
    assert len({f["url"] for f in feeds}) == len(feeds), "Duplicate URLs forbidden"
    print(f"PASS: {len(legacy)} prior feeds byte-equivalent, exactly one BBC COP31 link")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="PR Git base, e.g. HEAD^1")
    args = ap.parse_args()
    base = args.base
    ensure_scope(base)
    ensure_only_cop31_bbc_added(base)
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
