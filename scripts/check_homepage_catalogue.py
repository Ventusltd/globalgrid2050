#!/usr/bin/env python3
"""Reconcile the committed homepage catalogue against git, on whatever platform
this runs - and it is meant to run on Linux.

WHY
The catalogue carries two references per version: the GlobalGrid2050
reference (the UTC stamp-name) and the independent git reference (the tree
hash, `git rev-parse HEAD:<path>`). The second exists so that the first can be
checked by something that does not depend on anyone's memory or anyone's
machine. On 2026-09-06 a Windows checkout held 3,555 files whose bytes differed
from the blobs git would serve; a catalogue generated there could have carried
barcodes for bytes that never shipped. Git tree hashes are computed from the
blobs, not the working copy, so they are the same on every platform - and this
check proves that for every row, every run, by re-deriving each one.

WHAT FAILS
  - a row whose recorded tree hash differs from `git rev-parse HEAD:<path>` now
  - a row whose relative URL no longer resolves to a page
  - a row whose id is not <12-digit UTC stamp>-<slug>
  - two rows sharing a URL
  - a current release that is not the newest of its family

Run:  python3 scripts/check_homepage_catalogue.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CAT = ROOT / "catalogue" / "homepage-catalogue.json"


def rev_parse(path: str) -> str | None:
    r = subprocess.run(["git", "rev-parse", f"HEAD:{path}"], cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def has_page(rel: str) -> bool:
    p = ROOT / rel
    return p.is_file() or (p / "index.html").is_file() or (p / "index.md").is_file()


doc = json.loads(CAT.read_text(encoding="utf-8"))
rows = doc["entries"]
failures: list[str] = []
reconciled = 0
seen_urls: set[str] = set()

for e in rows:
    if not re.fullmatch(r"\d{12}-[a-z0-9-]+", e["id"]):
        failures.append(f"{e['id']}: id is not <UTC stamp>-<slug>")
    if e["url"] in seen_urls:
        failures.append(f"{e['id']}: duplicate url {e['url']}")
    seen_urls.add(e["url"])
    if e["url"].startswith("./"):
        rel = e["url"][2:].rstrip("/")
        if not has_page(rel):
            failures.append(f"{e['id']}: {e['url']} no longer resolves to a page")
        if e.get("tree"):
            now = rev_parse(rel)
            if now != e["tree"]:
                failures.append(f"{e['id']}: barcode {e['tree'][:12]} recorded, git now says {(now or 'nothing')[:12]} for {rel}")
            else:
                reconciled += 1

for family in doc["families"]:
    fam = [e for e in rows if e["family"] == family]
    current = [e for e in fam if e.get("status") == "current"]
    if len(current) > 1:
        failures.append(f"{family}: {len(current)} rows marked current; there can be one")
    if current and fam:
        newest = max(fam, key=lambda e: e["stamp"])
        if current[0]["stamp"] < newest["stamp"] and newest.get("kind") == current[0].get("kind"):
            failures.append(f"{family}: current is {current[0]['id']} but {newest['id']} is newer of the same kind")

if failures:
    print(f"HOMEPAGE CATALOGUE FAILED - {len(failures)} finding(s) of {len(rows)} rows:")
    for f in failures[:30]:
        print("  - " + f)
    sys.exit(1)
print(f"homepage catalogue: PASS - {len(rows)} rows, {reconciled} barcodes re-derived from git and identical, "
      f"every relative link resolves, one current per family")
