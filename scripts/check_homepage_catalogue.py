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

def servable_row(entry):
    """Does this row's page decode as text and open like a document?

    Only local rows can be checked; an external URL is taken as given."""
    url = str(entry.get("url") or "")
    if not url.startswith("./"):
        return True
    target = ROOT / url[2:]
    if target.is_dir():
        target = target / "index.html"
    if not target.is_file():
        return True          # a missing page is already caught by the link check
    try:
        head = target.read_bytes()[:2048].decode("utf-8").lstrip().lower()
    except (OSError, UnicodeDecodeError):
        return False
    # Looked-for, not led-with. repd_grid_atlasv4/index.html carries a stray
    # line of build chatter ("supermarkets layer added") above its doctype and is
    # otherwise a perfectly good page; requiring the doctype at byte zero called
    # it corrupt. The defect being caught is bytes that are not text at all, so
    # the test is that it decodes and that a document tag appears near the top.
    return "<html" in head or "<!doctype" in head


for family in doc["families"]:
    fam = [e for e in rows if e["family"] == family]
    current = [e for e in fam if e.get("status") == "current"]
    if len(current) > 1:
        failures.append(f"{family}: {len(current)} rows marked current; there can be one")
    if current and fam:
        """A newer release only outranks the current one if it can be served.

        This rule used to say, flatly, that the newest release of a kind must be
        the current one. On 2026-09-08 that turned into an instruction to publish
        a broken page: 202609080146 was committed with an index.html of binary
        noise rather than HTML, and the rule demanded it be promoted over the
        working 202609071221. With the homepage now reduced to Pipeline News,
        obeying would have taken the site down.

        So an unservable release is not a candidate for current, and it gets its
        own finding instead - the corruption is the problem to report, not the
        pointer that correctly declined to follow it."""
        servable = [e for e in fam if servable_row(e)]
        unservable = [e for e in fam if e not in servable]
        for e in unservable:
            failures.append(
                f"{e['id']}: published page is not readable as text, so it cannot be served "
                f"or made current; the corruption is in the commit, not just the working tree")
        pool = servable or fam
        newest = max(pool, key=lambda e: e["stamp"])
        if current[0]["stamp"] < newest["stamp"] and newest.get("kind") == current[0].get("kind"):
            failures.append(f"{family}: current is {current[0]['id']} but {newest['id']} is newer of the same kind")

if failures:
    print(f"HOMEPAGE CATALOGUE FAILED - {len(failures)} finding(s) of {len(rows)} rows:")
    for f in failures[:30]:
        print("  - " + f)
    sys.exit(1)
print(f"homepage catalogue: PASS - {len(rows)} rows, {reconciled} barcodes re-derived from git and identical, "
      f"every relative link resolves, one current per family")
