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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="PR Git base, e.g. HEAD^1")
    args = ap.parse_args()
    base = args.base
    ensure_scope(base)
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
