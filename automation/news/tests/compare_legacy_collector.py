#!/usr/bin/env python3
"""Fail-closed byte-for-byte legacy headline regression against PR's Git base.

This checks the live, existing Python collector on the identical offline fixture
feed corpus before and after the additive global-context changes. The *only*
allowed baseline difference is the metadata SCOPE explanatory paragraph.
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
MODULES = ("pipeline_headlines.py", "datacentre_feed.py", "names.py")
ALLOWED = {
    ".github/workflows/pipeline-headlines.yml",
    "automation/news/pipeline_headlines.py",
    "automation/news/pipeline_feeds.json",
    "automation/news/research_indexes.py",
    "automation/news/tests/test_research_context.py",
    "automation/news/tests/compare_legacy_collector.py",
    "automation/news/original_article_links.py",
    "automation/news/tests/test_original_article_links.py",
}


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def ensure_scope(base: str) -> None:
    changed = {s for s in git("diff", "--name-only", f"{base}..HEAD").decode().splitlines() if s}
    forbidden = changed - ALLOWED
    if forbidden:
        raise AssertionError("Unrelated change detected: " + ", ".join(sorted(forbidden)))
    expected = {"automation/news/pipeline_headlines.py", "automation/news/pipeline_feeds.json"}
    if not expected <= changed:
        raise AssertionError("Expected additive collector/config changes missing")


def run_once(script: Path, feeds: Path, fixtures: Path, repd: Path, dest: Path) -> dict:
    subprocess.run(
        [sys.executable, str(script), "--feeds", str(feeds),
         "--fixtures", str(fixtures), "--repd", str(repd), "--out", str(dest),
         "--now", "2026-11-14T12:00:00Z"],
        cwd=ROOT, check=True, capture_output=True, text=True, timeout=60)
    return json.loads(dest.read_text(encoding="utf-8"))


def ensure_sources_are_additive(base: str) -> None:
    old = json.loads(git("show", f"{base}:automation/news/pipeline_feeds.json"))
    new = json.loads((ROOT / "automation/news/pipeline_feeds.json").read_text(encoding="utf-8"))
    legacy = old["feeds"]
    feeds = new["feeds"]
    if feeds[:len(legacy)] != legacy:
        raise AssertionError("Existing publisher feeds, order, labels or flags modified")
    if new.get("source_release_id") != "20261121-global-context-v1":
        raise AssertionError("Unexpected source edition")
    if len(feeds) != len(legacy) + 1:
        raise AssertionError("Expected precisely one additional source")
    if new.get("source_patch_id") != "20261121-spp-original-link-fallback-v1":
        raise AssertionError("Unapproved source patch edition")
    last = feeds[-1]
    expected_url = ("https://api.gdeltproject.org/api/v2/doc/doc?"
                    "query=domain%3Asolarpowerportal.co.uk&mode=artlist&format=rss"
                    "&maxrecords=50&timespan=1month&sort=datedesc")
    if (last.get("url") != expected_url or last.get("source") != "Solar Power Portal"
            or last.get("kind") != "public_article_index"
            or last.get("uk_only") is not True or last.get("primary")
            or last.get("lane") or last.get("focus")):
        raise AssertionError("Fallback may only discover original Solar Power Portal links")
    if len({feed["url"] for feed in feeds}) != len(feeds):
        raise AssertionError("Duplicate source URL")
    print(f"PASS: {len(legacy)} existing sources unchanged; one narrowly allowlisted third-party index")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="PR Git base, e.g. HEAD^1")
    args = ap.parse_args()
    base = args.base
    ensure_scope(base)
    ensure_sources_are_additive(base)
    fixtures = ROOT / "automation/news/tests/fixtures/pipeline"
    with tempfile.TemporaryDirectory(prefix="pn-legacy-comparison-") as tmp:
        tmp = Path(tmp)
        baseline = tmp / "baseline" / "automation" / "news"
        baseline.mkdir(parents=True)
        for file in MODULES:
            (baseline / file).write_bytes(git("show", f"{base}:automation/news/{file}"))
        # The exact original feed list is the testing contract, not the new feeds.
        (tmp / "original_feeds.json").write_bytes(git("show", f"{base}:automation/news/tests/fixtures/pipeline/feeds.json"))
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
    # The addition of global context is deliberately *not* permitted to rewrite
    # any legacy article, time, source, REPD association, count or feed health.
    for key in ("items", "counts", "feeds", "status", "schema", "generated_at", "limits"):
        if old[key] != new[key]:
            raise AssertionError(f"Legacy output regression: {key}")
    print(f"PASS: {len(old['items'])} legacy headlines unchanged on an identical "
          f"offline corpus; no unrelated release or UI edits")


if __name__ == "__main__":
    main()
