#!/usr/bin/env python3
"""Fail when a Pipeline News version is published but not reachable, or named but not published.

WHY THIS EXISTS
---------------
Publishing a version and naming it are two different acts in this repository,
and until 202609020042 nothing checked that the second one had happened.

  * `pipelinenews_intelligence/<generation>/` is copied in by the Pipeline
    News overnight runner, which deliberately does not touch `index.html` -
    the homepage is governed by a numbered-snapshot ritual and a byte-exact
    sentinel contract.
  * `index.html` is the only route a reader has to those directories.

So the bytes of `202609012326` and `202609020025` sat on globalgrid2050.com,
byte-identical to their releases and served with HTTP 200, while the newest
version any reader could reach was `202608312339`. Published, and invisible.
That is the drift this script makes loud.

It also checks the Grid Atlas row, which had gone stale the same way: the
homepage claimed v9.5 / 202608301624 was the current verified release while
the live composition had moved to v9.77.

Offline checks always run.  The two network checks run only when
raw.githubusercontent.com is reachable, and say so when they are skipped.

    python3 scripts/verify_published_versions.py
    python3 scripts/verify_published_versions.py --json report.json
    python3 scripts/verify_published_versions.py --offline
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
SNAPSHOTS = ROOT / "pipelinenews_intelligence"

GENERATION_RE = re.compile(r"^[0-9]{12}$")
SNAPSHOT_URL_RE = re.compile(r'url:"\./pipelinenews_intelligence/([0-9]{12})/"')
GRIDATLAS_ROW_RE = re.compile(
    r"GRIDATLAS_V9_AUTOMATION_START.*?data_gridatlas_release:\"([0-9]{12})-gridatlas-(v[0-9.]+)\".*?GRIDATLAS_V9_AUTOMATION_END",
    re.S,
)
GRIDATLAS_OS_STRIP_RE = re.compile(
    r'<div class="os-strip"><a href="https://ventusltd\.github\.io/gridatlas/atlas/">'
    r'UK Grid Atlas (V[0-9.]+) — Current Verified Release</a>'
    r'<span class="live-status">([0-9]{12})\b'
)

PIPELINENEWS_RAW = "https://raw.githubusercontent.com/Ventusltd/pipelinenews/main"
GRIDATLAS_CURRENT = "https://raw.githubusercontent.com/Ventusltd/gridatlas/main/atlas/current.json"

# A release built and superseded without ever entering the published lineage is
# not a published version.  These are recorded rather than silently ignored so
# the inventory of what exists and what is public stays honest.
UNPUBLISHED_BY_DESIGN = {
    "202608311550": "superseded sibling of 202608311558; never a parent",
    "202608311557": "superseded sibling of 202608311558; never a parent",
    "202608312018": "superseded sibling of 202608312037; never a parent",
    "202608312337": "superseded sibling of 202608312339; never a parent",
    "202609020010": "ISOLATED_CANDIDATE_ONLY_NO_SHARED_POINTER - paired with an isolated Codex atlas lab route",
}


class Failure(Exception):
    pass


def fetch(url: str, timeout: int = 20) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "globalgrid2050-publication-check/1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def published_snapshots() -> list[str]:
    if not SNAPSHOTS.is_dir():
        raise Failure(f"{SNAPSHOTS.relative_to(ROOT)} does not exist")
    found = []
    for child in sorted(SNAPSHOTS.iterdir()):
        if not child.is_dir():
            continue
        if not GENERATION_RE.match(child.name):
            raise Failure(f"snapshot directory is not a 12-digit generation: {child.name}")
        if not (child / "index.html").is_file():
            raise Failure(f"published snapshot has no index.html: {child.name}")
        found.append(child.name)
    return found


def named_on_homepage(text: str) -> list[str]:
    return SNAPSHOT_URL_RE.findall(text)


def check_gridatlas_homepage_identity(text: str, report: dict) -> list[str]:
    """Require the two reader-visible Grid Atlas identities to agree exactly."""
    failures: list[str] = []
    governed = GRIDATLAS_ROW_RE.findall(text)
    strips = GRIDATLAS_OS_STRIP_RE.findall(text)

    if len(governed) != 1:
        failures.append(
            "the GRIDATLAS_V9_AUTOMATION block must carry exactly one "
            f"data_gridatlas_release; found {len(governed)}"
        )
    if len(strips) != 1:
        failures.append(
            "the homepage must carry exactly one Grid Atlas os-strip identity; "
            f"found {len(strips)}"
        )

    if len(governed) == 1:
        report["gridatlas_named"] = {
            "generation": governed[0][0],
            "version": governed[0][1],
        }
    if len(strips) == 1:
        report["gridatlas_os_strip"] = {
            "generation": strips[0][1],
            "version": strips[0][0].lower(),
        }

    if len(governed) == 1 and len(strips) == 1:
        governed_identity = (governed[0][0], governed[0][1].lower())
        strip_identity = (strips[0][1], strips[0][0].lower())
        if strip_identity != governed_identity:
            failures.append(
                "the Grid Atlas os-strip names "
                f"{strip_identity[1]} / {strip_identity[0]} while the governed row names "
                f"{governed_identity[1]} / {governed_identity[0]}"
            )

    return failures


def check_offline(report: dict) -> list[str]:
    failures: list[str] = []
    text = INDEX.read_text(encoding="utf-8")

    on_disk = published_snapshots()
    named = named_on_homepage(text)
    report["published_snapshots"] = on_disk
    report["named_on_homepage"] = named

    duplicates = sorted({g for g in named if named.count(g) > 1})
    if duplicates:
        failures.append(f"named more than once on the homepage: {', '.join(duplicates)}")

    unreachable = sorted(set(on_disk) - set(named))
    if unreachable:
        failures.append(
            "published but not reachable - these directories are served and nothing on the "
            f"homepage links to them: {', '.join(unreachable)}"
        )

    dangling = sorted(set(named) - set(on_disk))
    if dangling:
        failures.append(f"named on the homepage but not published: {', '.join(dangling)}")

    # The newest published version must be the current entry, not buried as a child.
    if on_disk and named:
        newest_published = max(on_disk)
        if named[0] != newest_published:
            failures.append(
                f"the homepage presents {named[0]} first while {newest_published} is the newest "
                "published snapshot; the newest version must be the current entry"
            )
        report["newest_published"] = newest_published
        report["presented_first"] = named[0]

    failures += check_gridatlas_homepage_identity(text, report)

    return failures


def check_network(report: dict) -> list[str]:
    failures: list[str] = []

    # 1. The head of the Pipeline News published lineage must be mirrored here.
    try:
        listing = json.loads(fetch(f"https://api.github.com/repos/Ventusltd/pipelinenews/contents/releases"))
    except Exception as error:  # pragma: no cover - network shape varies
        report.setdefault("skipped", []).append(f"pipelinenews lineage head: {error}")
    else:
        generations = sorted(
            entry["name"].split("-")[0]
            for entry in listing
            if entry.get("type") == "dir" and re.match(r"^[0-9]{12}-pipelinenews$", entry.get("name", ""))
        )
        candidates = [g for g in generations if g not in UNPUBLISHED_BY_DESIGN]
        if candidates:
            head = candidates[-1]
            report["pipelinenews_head"] = head
            if head not in report["published_snapshots"]:
                failures.append(
                    f"the newest Pipeline News release {head} is not mirrored into "
                    "pipelinenews_intelligence/; it cannot be served from this host"
                )

    # 2. The Grid Atlas row must name the composition the Atlas is actually serving.
    try:
        current = json.loads(fetch(GRIDATLAS_CURRENT))
    except Exception as error:  # pragma: no cover - network shape varies
        report.setdefault("skipped", []).append(f"gridatlas composition: {error}")
    else:
        live = {"generation": current.get("generation"), "version": current.get("composition_version")}
        report["gridatlas_live"] = live
        named = report.get("gridatlas_named")
        if named and (named["generation"] != live["generation"] or named["version"] != live["version"]):
            failures.append(
                f"the homepage names Grid Atlas {named['version']} / {named['generation']} as the current "
                f"verified release while the live composition is {live['version']} / {live['generation']}"
            )

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, help="write the report to this path")
    parser.add_argument("--offline", action="store_true", help="skip the two network checks")
    args = parser.parse_args()

    report: dict = {"schema": "globalgrid2050.publication-truth.v1"}
    try:
        failures = check_offline(report)
        if not args.offline:
            failures += check_network(report)
    except Failure as error:
        failures = [str(error)]

    if args.offline:
        report.setdefault("skipped", []).append("both network checks: --offline was requested")

    report["unpublished_by_design"] = UNPUBLISHED_BY_DESIGN
    report["failures"] = failures
    skipped = report.get("skipped", [])
    # A skip is not a pass.  A verdict may only say PASS when every check it
    # names actually ran; when one could not, the verdict says so and the exit
    # code is non-zero, so a caller cannot read silence as health.
    report["status"] = "FAIL" if failures else ("INCOMPLETE" if skipped else "PASS")

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    for entry in skipped:
        print(f"skipped: {entry}")
    if failures:
        print("PUBLICATION TRUTH: FAIL")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    if skipped:
        print(
            f"PUBLICATION TRUTH: INCOMPLETE - {len(skipped)} check(s) could not run; "
            f"the {len(report.get('published_snapshots', []))} published snapshots that were "
            f"checked are reachable, newest is {report.get('newest_published')}"
        )
        for entry in skipped:
            print(f"  - {entry}")
        return 2
    print(
        f"PUBLICATION TRUTH: PASS - {len(report.get('published_snapshots', []))} published snapshots, "
        f"all reachable, newest is {report.get('newest_published')}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
