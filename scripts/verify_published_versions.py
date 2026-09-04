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
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
SNAPSHOTS = ROOT / "pipelinenews_intelligence"
HOMEPAGE_VERSIONS = ROOT / "homepage_versions"

GENERATION_RE = re.compile(r"^[0-9]{12}$")
SNAPSHOT_URL_RE = re.compile(r'url:"\./pipelinenews_intelligence/([0-9]{12})/"')
GRIDATLAS_ROW_RE = re.compile(
    r"GRIDATLAS_V9_AUTOMATION_START.*?data_gridatlas_release:\"([0-9]{12})-gridatlas-(v[0-9.]+)\".*?GRIDATLAS_V9_AUTOMATION_END",
    re.S,
)
GRIDATLAS_OS_STRIP_RE = re.compile(
    r'<div class="os-strip"><a href="https://ventusltd\.github\.io/gridatlas/atlas/">'
    r'UK Grid Atlas (V[0-9.]+) — Current Release \(Working Verified\)</a>'
    r'<span class="live-status">([0-9]{12})\b'
)
GRIDATLAS_CATALOGUE_BLOCK_RE = re.compile(
    r"GRIDATLAS_VERSION_CATALOGUE_START(?P<body>.*?)GRIDATLAS_VERSION_CATALOGUE_END",
    re.S,
)
GRIDATLAS_CATALOGUE_ENTRY_RE = re.compile(
    r'\{ name:"(?P<name>[^"]+)",(?: url:"(?P<url>[^"]+)",)? '
    r'note:"(?P<note>[^"]+)", data_gridatlas_catalogue:"'
    r'(?P<version>v[0-9]+(?:\.[0-9]+)?)\|'
    r'(?P<generation>none|[0-9]{12})\|'
    r'(?P<status>LIVE|ARCHIVED|REJECTED_PRE_PROMOTION|MISSING)\|'
    r'(?P<availability>[A-Z_]+)\|'
    r'(?P<commit>none|[0-9a-f]{40})\|'
    r'(?P<checked_at>[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)" \},'
)

GRIDATLAS_FOUNDATION_COUNT = 124
# Filled from the canonical serialisation of the first 124 records (V1 through
# v9.103). Those records can never be rewritten to make room for a successor.
GRIDATLAS_FOUNDATION_SHA256 = "acefa518ef976ebac963cc99c4313f8e3410b6754b0fbd310f88bd9556ac4f82"
GRIDATLAS_AVAILABILITY = {
    "NONE",
    "SOURCE_ONLY",
    "MANIFEST_EVIDENCE",
    "WORKING_VERIFIED",
    "REACHABLE_UNVERIFIED",
    "BROKEN",
}

PIPELINENEWS_RAW = "https://raw.githubusercontent.com/Ventusltd/pipelinenews/main"
GRIDATLAS_CURRENT = "https://raw.githubusercontent.com/Ventusltd/gridatlas/main/atlas/current.json"
GRIDATLAS_MANIFESTS = "https://raw.githubusercontent.com/Ventusltd/gridatlas/main/atlas/manifests"
GRIDATLAS_MAIN_API = "https://api.github.com/repos/Ventusltd/gridatlas/commits/main"

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
    headers = {"User-Agent": "globalgrid2050-publication-check/1"}
    token = os.environ.get("GITHUB_TOKEN")
    if token and url.startswith(("https://api.github.com/", "https://raw.githubusercontent.com/")):
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
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


def parse_gridatlas_catalogue(text: str, failures: list[str], *, required: bool = True) -> list[dict]:
    """Parse the reader-visible, machine-marked lineage without executing JavaScript."""
    blocks = list(GRIDATLAS_CATALOGUE_BLOCK_RE.finditer(text))
    if not blocks:
        if required:
            failures.append("the homepage has no Grid Atlas version catalogue block")
        return []
    if len(blocks) != 1:
        failures.append(f"the homepage must carry exactly one Grid Atlas catalogue block; found {len(blocks)}")
        return []

    body = blocks[0].group("body")
    matches = list(GRIDATLAS_CATALOGUE_ENTRY_RE.finditer(body))
    marker_count = body.count("data_gridatlas_catalogue:")
    if marker_count != len(matches):
        failures.append(
            "one or more Grid Atlas catalogue rows are malformed: "
            f"found {marker_count} markers but parsed {len(matches)} records"
        )

    records = []
    for match in matches:
        record = match.groupdict()
        record["generation"] = None if record["generation"] == "none" else record["generation"]
        record["commit"] = None if record["commit"] == "none" else record["commit"]
        records.append(record)
    return records


def catalogue_digest(records: list[dict]) -> str:
    payload = json.dumps(
        records,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def check_gridatlas_catalogue_retention(records: list[dict]) -> list[str]:
    """A numbered pre-edit snapshot makes already-catalogued identities append-only."""
    failures: list[str] = []
    snapshots = sorted(HOMEPAGE_VERSIONS.glob("homepage_v[0-9][0-9][0-9].html"))
    if not snapshots:
        return ["no numbered homepage snapshot exists before the Grid Atlas catalogue edit"]

    previous_failures: list[str] = []
    previous = parse_gridatlas_catalogue(
        snapshots[-1].read_text(encoding="utf-8"),
        previous_failures,
        required=False,
    )
    if previous_failures:
        failures.extend(f"latest homepage snapshot: {failure}" for failure in previous_failures)
        return failures
    if not previous:
        return failures

    current_by_identity = {
        (record["version"], record["generation"]): record for record in records
    }
    for old in previous:
        identity = (old["version"], old["generation"])
        current = current_by_identity.get(identity)
        if current is None:
            failures.append(
                f"append-only Grid Atlas history lost {old['version']} / {old['generation'] or 'no generation'}"
            )
            continue
        if current["commit"] != old["commit"]:
            failures.append(f"append-only Grid Atlas history rewrote the commit for {old['version']}")
        if old["status"] != "LIVE" and current != old:
            failures.append(f"append-only Grid Atlas history rewrote archived record {old['version']}")
    return failures


def check_gridatlas_homepage_identity(text: str, report: dict) -> list[str]:
    """Require the live identity and the complete append-only catalogue to agree."""
    failures: list[str] = []
    for marker in ("GRIDATLAS_V9_AUTOMATION_START", "GRIDATLAS_V9_AUTOMATION_END"):
        count = text.count(marker)
        if count != 1:
            failures.append(f"the homepage must retain exactly one {marker} marker; found {count}")
    if text.count("const AREAS = [") != 1:
        failures.append("the homepage must retain exactly one AREAS directory")
    if text.count('url:"./repd_grid_atlasv8/"') != 1:
        failures.append("the homepage must retain exactly one local V8 sentinel route")
    if text.count("children:[...GRIDATLAS_VERSION_CATALOGUE].reverse()") != 1:
        failures.append("the complete Grid Atlas catalogue is not wired into AREAS exactly once")

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

    records = parse_gridatlas_catalogue(text, failures)
    report["gridatlas_catalogue_count"] = len(records)
    if not records:
        return failures

    identities = [(record["version"], record["generation"]) for record in records]
    if len(identities) != len(set(identities)):
        failures.append("the Grid Atlas catalogue contains a duplicate version/generation identity")

    def version_key(record: dict) -> tuple[int, int, str]:
        parts = record["version"][1:].split(".")
        return int(parts[0]), int(parts[1]) if len(parts) == 2 else 0, record["generation"] or ""

    if [version_key(record) for record in records] != sorted(version_key(record) for record in records):
        failures.append("the Grid Atlas catalogue is not oldest-first; a successor must be appended, not inserted")

    if len(records) < GRIDATLAS_FOUNDATION_COUNT + 1:
        failures.append(
            f"the Grid Atlas catalogue has {len(records)} records; its protected foundation needs "
            f"at least {GRIDATLAS_FOUNDATION_COUNT + 1}"
        )
    elif catalogue_digest(records[:GRIDATLAS_FOUNDATION_COUNT]) != GRIDATLAS_FOUNDATION_SHA256:
        failures.append("the protected V1-to-v9.103 Grid Atlas catalogue foundation was rewritten")

    for record in records:
        version = record["version"]
        generation = record["generation"]
        status = record["status"]
        availability = record["availability"]
        commit = record["commit"]
        checked_at = record["checked_at"]
        url = record["url"]
        note = record["note"]

        if availability not in GRIDATLAS_AVAILABILITY:
            failures.append(f"{version} uses unknown availability {availability}")
        if version.upper() not in record["name"]:
            failures.append(f"{version} is not named visibly on its catalogue row")
        if not note.startswith(f"{status} | {availability.replace('_', ' ')} | "):
            failures.append(f"{version} does not state its status and evidence class visibly")
        if generation and f"generation {generation}" not in note:
            failures.append(f"{version} does not state generation {generation} visibly")
        if commit and f"source commit {commit}" not in note:
            failures.append(f"{version} does not state its exact source commit visibly")
        if f"checked_at {checked_at}" not in note:
            failures.append(f"{version} does not state checked_at {checked_at} visibly")

        if status == "MISSING":
            if availability != "NONE" or generation or commit or url:
                failures.append(f"missing {version} invents a generation, commit, URL or availability")
        elif not url or not commit:
            failures.append(f"recoverable {version} must carry both a URL and a full source commit")

        if availability == "MANIFEST_EVIDENCE":
            if "not a runnable application" not in note:
                failures.append(f"{version} manifest evidence is not labelled as non-runnable")
            if generation and f"{generation}-composition.json" not in (url or ""):
                failures.append(f"{version} manifest URL does not name its generation")
        elif availability == "BROKEN":
            if status != "ARCHIVED" or not any(
                phrase in note for phrase in ("fails closed", "rejected composition")
            ):
                failures.append(f"{version} broken evidence is not labelled archived with its exact failure")
        elif availability == "REACHABLE_UNVERIFIED":
            if not url or not any(
                phrase in note for phrase in ("functionality unverified", "not working-verified")
            ):
                failures.append(f"{version} reachable route does not say that functionality is unverified")
        elif availability == "WORKING_VERIFIED":
            if status != "LIVE" or "browser click verified" not in note:
                failures.append(f"{version} working claim lacks a visible browser-click proof")

        if status == "REJECTED_PRE_PROMOTION" and (
            availability != "MANIFEST_EVIDENCE"
            or "never live" not in note
            or "candidate_status REJECTED_PRE_PROMOTION" not in note
        ):
            failures.append(
                f"{version} rejected pre-promotion record must be non-runnable manifest evidence "
                "that explicitly says it was never live"
            )

    versions = {record["version"] for record in records}
    missing_majors = [f"v{number}" for number in range(1, 10) if f"v{number}" not in versions]
    if missing_majors:
        failures.append(f"the Grid Atlas major-version catalogue omits: {', '.join(missing_majors)}")

    named = report.get("gridatlas_named")
    current_minor = None
    if named and re.fullmatch(r"v9\.([0-9]+)", named["version"]):
        current_minor = int(named["version"].split(".")[1])
        missing_minors = [
            f"v9.{number}" for number in range(1, current_minor + 1)
            if f"v9.{number}" not in versions
        ]
        if missing_minors:
            failures.append(f"the Grid Atlas minor-version catalogue omits: {', '.join(missing_minors)}")
        future = sorted(
            version for version in versions
            if version.startswith("v9.") and int(version.split(".")[1]) > current_minor
        )
        if future:
            failures.append(
                "the catalogue claims a future Grid Atlas version before it is promoted: "
                + ", ".join(future)
            )

    working_verified = [
        record for record in records
        if record["availability"] == "WORKING_VERIFIED"
    ]
    expected_working = [
        ("v8", None),
        ("v9.103", "202609040058"),
        ("v9.104", "202609040134"),
    ]
    if [(record["version"], record["generation"]) for record in working_verified] != expected_working:
        failures.append("only V8, v9.103 and v9.104 may carry their recorded mobile browser verification")

    current_records = [
        record for record in records
        if named and record["version"] == named["version"]
        and record["generation"] == named["generation"]
    ]
    if len(current_records) != 1:
        failures.append(f"the catalogue must identify exactly one governed current release; found {len(current_records)}")
    elif current_records[0]["status"] != "LIVE" or current_records[0]["url"] != "https://ventusltd.github.io/gridatlas/atlas/":
        failures.append("the catalogue current record has the wrong status or stable application URL")
    else:
        report["gridatlas_current_catalogue"] = {
            "generation": current_records[0]["generation"],
            "version": current_records[0]["version"],
            "commit": current_records[0]["commit"],
        }
    if current_records and records[-1] != current_records[0]:
        failures.append("the current Grid Atlas catalogue record must be the final append-only record")

    broken_legacy = [
        record for record in records
        if record["version"] == "v9" and record["generation"] == "202608291237"
    ]
    if len(broken_legacy) != 1 or broken_legacy[0]["availability"] != "BROKEN":
        failures.append("the 202608291237 V9 shell must remain BROKEN until its 404 dependency is repaired")
    if current_records and (
        current_records[0]["availability"] != "WORKING_VERIFIED"
        or "mobile browser click verified at 393x852" not in current_records[0]["note"]
    ):
        failures.append("the governed v9.104 route must carry its exact 393x852 browser-click proof")

    rejected = [record for record in records if record["status"] == "REJECTED_PRE_PROMOTION"]
    expected_rejected = [
        ("v9.100", "202609040021", "3506bfb2b4d298e6bb00132c05467d67a71e89af"),
        ("v9.101", "202609040046", "6d2bad3c7bd0bb49f6bafad316c11ef7e753c964"),
        ("v9.102", "202609040047", "6d2bad3c7bd0bb49f6bafad316c11ef7e753c964"),
    ]
    if [
        (record["version"], record["generation"], record["commit"])
        for record in rejected
    ] != expected_rejected:
        failures.append(
            "the catalogue must retain exactly v9.100-v9.102 as rejected pre-promotion, "
            "never-live evidence at their exact source commits"
        )

    if current_minor and current_minor > 1:
        previous_version = f"v9.{current_minor - 1}"
        previous = [record for record in records if record["version"] == previous_version]
        if not previous or previous[-1]["status"] == "MISSING":
            failures.append(f"the catalogue does not retain the immediate predecessor {previous_version}")
        else:
            report["gridatlas_previous"] = {
                "generation": previous[-1]["generation"],
                "version": previous[-1]["version"],
            }

    report["gridatlas_catalogue_status_counts"] = {
        status: sum(record["status"] == status for record in records)
        for status in ("LIVE", "ARCHIVED", "REJECTED_PRE_PROMOTION", "MISSING")
    }
    report["gridatlas_catalogue_availability_counts"] = {
        availability: sum(record["availability"] == availability for record in records)
        for availability in sorted(GRIDATLAS_AVAILABILITY)
    }
    failures.extend(check_gridatlas_catalogue_retention(records))
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

        current_catalogue = report.get("gridatlas_current_catalogue")
        try:
            gridatlas_main = json.loads(fetch(GRIDATLAS_MAIN_API))
        except Exception as error:  # pragma: no cover - network shape varies
            report.setdefault("skipped", []).append(f"gridatlas exact main commit: {error}")
        else:
            main_sha = gridatlas_main.get("sha")
            report["gridatlas_main_commit"] = main_sha
            if current_catalogue and current_catalogue["commit"] != main_sha:
                failures.append(
                    "the current Grid Atlas catalogue row is not bound to the exact main commit: "
                    f"catalogue {current_catalogue['commit']}, main {main_sha}"
                )

        catalogue_failures: list[str] = []
        catalogue_records = parse_gridatlas_catalogue(
            INDEX.read_text(encoding="utf-8"),
            catalogue_failures,
        )
        failures.extend(f"network catalogue parse: {failure}" for failure in catalogue_failures)

        previous_generation = current.get("previous_generation")
        previous_matches = [
            record for record in catalogue_records
            if record["generation"] == previous_generation
        ]
        previous_named = None
        if not isinstance(previous_generation, str) or not GENERATION_RE.fullmatch(previous_generation):
            failures.append("the live Grid Atlas pointer does not identify one valid previous generation")
        elif len(previous_matches) != 1:
            failures.append(
                "the homepage catalogue must retain exactly one record for the live pointer's "
                f"previous generation {previous_generation}; found {len(previous_matches)}"
            )
        else:
            previous_named = {
                "generation": previous_matches[0]["generation"],
                "version": previous_matches[0]["version"],
            }
            report["gridatlas_previous_live_pointer"] = previous_named
            try:
                previous_manifest = json.loads(
                    fetch(f"{GRIDATLAS_MANIFESTS}/{previous_generation}-composition.json")
                )
            except Exception as error:  # pragma: no cover - network shape varies
                report.setdefault("skipped", []).append(f"gridatlas previous composition: {error}")
            else:
                manifest_identity = {
                    "generation": previous_manifest.get("generation"),
                    "version": previous_manifest.get("version"),
                }
                report["gridatlas_previous_live"] = manifest_identity
                if previous_named and previous_named != manifest_identity:
                    failures.append(
                        "the homepage's previous Grid Atlas row does not match its immutable composition manifest"
                    )
                expected_composition_id = (
                    f"{manifest_identity['generation']}-gridatlas-{manifest_identity['version']}"
                )
                if previous_manifest.get("composition_id") != expected_composition_id:
                    failures.append("the previous Grid Atlas composition manifest has an inconsistent identity")

        rejected_records = [
            record for record in catalogue_records
            if record["status"] == "REJECTED_PRE_PROMOTION"
        ]
        report["gridatlas_rejected_pre_promotion"] = [
            {"generation": record["generation"], "version": record["version"]}
            for record in rejected_records
        ]
        for record in rejected_records:
            try:
                rejected_manifest = json.loads(fetch(record["url"]))
            except Exception as error:  # pragma: no cover - network shape varies
                report.setdefault("skipped", []).append(
                    f"gridatlas rejected composition {record['generation']}: {error}"
                )
                continue
            manifest_identity = (
                rejected_manifest.get("version"),
                rejected_manifest.get("generation"),
            )
            if manifest_identity != (record["version"], record["generation"]):
                failures.append(
                    f"rejected Grid Atlas manifest {record['generation']} has identity {manifest_identity}"
                )
            if rejected_manifest.get("candidate_status") != "REJECTED_PRE_PROMOTION":
                failures.append(
                    f"rejected Grid Atlas manifest {record['generation']} does not declare "
                    "candidate_status REJECTED_PRE_PROMOTION"
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
