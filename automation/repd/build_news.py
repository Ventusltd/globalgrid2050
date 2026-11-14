#!/usr/bin/env python3
"""Build a Pipeline News release-folder candidate for a new REPD quarter.

This is a thin driver around the EXISTING builders; it writes no new data logic.

  1. copy the parent release folder (default: the operative 202609082224) to a NEW
     folder; refuse if it exists (never rebuild a release in place);
  2. identity fixture: the repo's own scripts/build_project_identity_v6.py
     (read_official_rows + build_registry, unchanged) run on a reconciled
     canonical CSV (V6 canonical format), written to a NEW fixture path;
  3. coordinate fixture: the release's own scripts/data/build_v7_2_spine.py
     --repd-xlsx, via a NEW contract whose v7.2 outputs go to a scratch directory
     outside the repo (it would otherwise write into uk_renewables_pipeline/v7);
  4. spine: the release's own scripts/data/build_v9_1_spine.py with ONE line
     changed (V9 = the release folder instead of uk_renewables_pipeline/v9), so
     contract and output are the new folder's own;
  5. contracts release.v9.1.json and release.v9.5.1.json: dataset label, fixture
     paths/hashes, workbook hash and `expected` values (from the builder's own
     acceptance-mismatch message, only with --accept-expected);
  6. hash manifest: sha256 of every file under uk_renewables_pipeline/ and dist/
     outside the new folder before and after; any difference fails the run.

Text-level edits (index.html wording, runner, CHANGES.md) are done by
--release-text-edits JSON (list of {path, old, new}); each `old` must occur once.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

SPINE_LINE_OLD = 'V9 = ROOT / "uk_renewables_pipeline/v9"\n'
SPINE_LINE_NEW = 'V9 = Path(__file__).resolve().parents[2]  # this release folder, never uk_renewables_pipeline/v9\n'


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def hash_tree(root: Path, subdirs: list[str], exclude: Path | None) -> dict[str, str]:
    out: dict[str, str] = {}
    for sub in subdirs:
        base = root / sub
        if not base.exists():
            continue
        for p in sorted(base.rglob("*")):
            if not p.is_file() or ".git" in p.relative_to(root).parts:
                continue
            if exclude is not None and (p == exclude or exclude in p.parents):
                continue
            out[p.relative_to(root).as_posix()] = sha256_file(p)
    return out


def replace_once(text: str, old: str, new: str, label: str) -> str:
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"FAIL: expected exactly one occurrence in {label} of {old!r}, found {n}")
    return text.replace(old, new)


def set_json_scalar(text: str, block: str, key: str, value, label: str) -> str:
    """Replace `"key": <scalar>` inside the first `"block": {...}` object, keeping layout."""
    m = re.search(r'"%s"\s*:\s*\{' % re.escape(block), text)
    if not m:
        raise SystemExit(f"FAIL: {label}: block {block!r} not found")
    depth, i = 0, m.end() - 1
    while True:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                break
        i += 1
    body = text[m.end():i]
    pat = re.compile(r'("%s"\s*:\s*)("(?:[^"\\]|\\.)*"|-?[0-9.eE+-]+|true|false|null)' % re.escape(key))
    if len(pat.findall(body)) != 1:
        raise SystemExit(f"FAIL: {label}: key {block}.{key} not found exactly once")
    body = pat.sub(lambda mm: mm.group(1) + json.dumps(value), body)
    return text[:m.end()] + body + text[i:]


def build_identity(repo: Path, canonical_csv: Path, manifest: dict, out: Path) -> dict:
    sys.path.insert(0, str(repo / "scripts"))
    import build_project_identity_v6 as ident  # existing logic, unchanged

    rows, headers, relationship_columns = ident.read_official_rows(canonical_csv)
    registry = ident.build_registry(rows, manifest, manifest["source_url"])
    registry["detected_header_count"] = len(headers)
    registry["detected_relationship_columns"] = relationship_columns
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(registry, indent=2), encoding="utf-8")  # same serialisation as ident.main()
    return registry


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    # no bytecode: the repo tracks some __pycache__ files and nothing here may add or remove any
    return subprocess.run(cmd, capture_output=True, text=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})


def main() -> None:
    sys.dont_write_bytecode = True
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", type=Path, required=True, help="plain copy of the repository root")
    ap.add_argument("--parent", default="202609082224")
    ap.add_argument("--release", required=True, help="new release folder id, e.g. 202611132345")
    ap.add_argument("--quarter", required=True, help="file-name suffix, e.g. 2026q3")
    ap.add_argument("--dataset", required=True, help='e.g. "DESNZ Renewable Energy Planning Database Q3 2026"')
    ap.add_argument("--canonical-csv", type=Path, required=True)
    ap.add_argument("--xlsx", type=Path, required=True, help="official REPD workbook (sheet REPD) for coordinates")
    ap.add_argument("--source-manifest", type=Path, required=True,
                    help="JSON with source_url, source_excel_url, source_page, source_owner, source_dataset_title, "
                         "source_page_last_updated, validated_at, source_hashes")
    ap.add_argument("--scratch", type=Path, required=True, help="directory OUTSIDE the repo for v7.2 by-products")
    ap.add_argument("--expected-rows", type=int, help="fail unless the identity has this many records")
    ap.add_argument("--accept-expected", action="store_true",
                    help="write the builder's actual figures into the new contracts (human review required)")
    ap.add_argument("--release-text-edits", type=Path, help="JSON list of {path, old, new} edits inside the release")
    ap.add_argument("--hash-report", type=Path, required=True)
    args = ap.parse_args()

    repo = args.repo.resolve()
    pipeline = repo / "uk_renewables_pipeline"
    parent = pipeline / args.parent
    release = pipeline / args.release
    rel = f"uk_renewables_pipeline/{args.release}"
    if not parent.is_dir():
        raise SystemExit(f"FAIL: parent {parent} missing")
    if release.exists():
        raise SystemExit(f"FAIL: {release} already exists; a release is never rebuilt in place")
    scratch = args.scratch.resolve()
    if repo in scratch.parents or scratch == repo:
        raise SystemExit("FAIL: --scratch must be outside the repository copy")

    before = hash_tree(repo, ["."], exclude=release)

    # 1. copy the parent
    shutil.copytree(parent, release, symlinks=True)

    # 2. identity fixture
    manifest = json.loads(args.source_manifest.read_text(encoding="utf-8"))
    identity_rel = f"{rel}/fixtures/{args.quarter}/project_identity_{args.quarter}.json"
    registry = build_identity(repo, args.canonical_csv, manifest, repo / identity_rel)
    if args.expected_rows is not None and registry["raw_record_count"] != args.expected_rows:
        raise SystemExit(f"FAIL: identity has {registry['raw_record_count']} records, expected {args.expected_rows}")

    # 3. coordinate fixture through the existing builder, v7.2 outputs to scratch
    coords_rel = f"{rel}/fixtures/{args.quarter}/repd_{args.quarter}_coordinates.json"
    v72 = json.loads((parent / "contracts/project-spine.v7.2.json").read_text(encoding="utf-8"))
    v72.update({
        "status": "COORDINATE_FIXTURE_BUILD_ONLY",
        "identity_fixture": identity_rel,
        "identity_fixture_sha256": sha256_file(repo / identity_rel),
        "coordinate_fixture": coords_rel,
        "coordinate_fixture_sha256": None,
        "source_workbook_sha256": sha256_file(args.xlsx),
    })
    v72["source_provenance"] = {
        "dataset": args.dataset,
        "canonical_identity_source_csv_sha256": sha256_file(args.canonical_csv),
        "coordinate_workbook_copy_sha256": sha256_file(args.xlsx),
        "reconciliation": "workbook Ref-ID set equals identity Ref-ID set; technology, capacity and site name exact (build_v7_2_spine.build_coordinate_fixture)",
    }
    v72["expected"] = {}
    scratch.mkdir(parents=True, exist_ok=True)
    v72["outputs"] = {k: str(scratch / Path(v).name) for k, v in v72["outputs"].items()}
    coord_contract = scratch / f"project-spine.{args.quarter}.coordinates.json"
    coord_contract.write_text(json.dumps(v72, indent=2) + "\n", encoding="utf-8")
    proc = run([sys.executable, str(release / "scripts/data/build_v7_2_spine.py"),
                "--contract", str(coord_contract), "--repd-xlsx", str(args.xlsx)])
    print(proc.stdout.strip())
    if proc.returncode != 0:
        raise SystemExit(f"FAIL: coordinate fixture build: {proc.stderr.strip()[-2000:]}")

    # 4. spine builder: one line, so it reads and writes this release folder
    spine = release / "scripts/data/build_v9_1_spine.py"
    spine.write_text(replace_once(spine.read_text(encoding="utf-8"), SPINE_LINE_OLD, SPINE_LINE_NEW, str(spine)),
                     encoding="utf-8")

    # 5. contracts
    c91 = release / "contracts/release.v9.1.json"
    t = c91.read_text(encoding="utf-8")
    for key, value in {
        "dataset": args.dataset,
        "identity_fixture": identity_rel,
        "identity_fixture_sha256": sha256_file(repo / identity_rel),
        "coordinate_fixture": coords_rel,
        "coordinate_fixture_sha256": sha256_file(repo / coords_rel),
        "workbook_sha256": sha256_file(args.xlsx),
    }.items():
        t = set_json_scalar(t, "source", key, value, "release.v9.1.json")
    c91.write_text(t, encoding="utf-8")

    proc = run([sys.executable, str(spine)])
    actual = None
    if proc.returncode != 0:
        m = re.search(r"RuntimeError: V9\.1 acceptance mismatch: (\{.*\})", proc.stderr)
        if not m:
            raise SystemExit(f"FAIL: spine build: {proc.stderr.strip()[-2000:]}")
        import ast
        actual = ast.literal_eval(m.group(1))
        print("builder actual:", json.dumps(actual))
        if not args.accept_expected:
            raise SystemExit("FAIL: contract expected != actual; review the figures above, rerun with --accept-expected")
        t = c91.read_text(encoding="utf-8")
        for key, value in actual.items():
            t = set_json_scalar(t, "expected", key, value, "release.v9.1.json")
        c91.write_text(t, encoding="utf-8")
        proc = run([sys.executable, str(spine)])
        if proc.returncode != 0:
            raise SystemExit(f"FAIL: spine build after acceptance: {proc.stderr.strip()[-2000:]}")
    print(proc.stdout.strip())

    built = json.loads((release / "data/v9.1/build_manifest.json").read_text(encoding="utf-8"))
    c951 = release / "contracts/release.v9.5.1.json"
    t = c951.read_text(encoding="utf-8")
    for key, value in {
        "project_count": built["project_count"],
        "capacity_mw": built["capacity_mw"],
        "displayed_capacity_mw": round(built["capacity_mw"]),
        "largest_mw": built["largest_mw"],
        "valid_geometry_count": built["geometry_count"],
        "missing_geometry_count": built["missing_geometry_count"],
        "solar_count": built["solar_count"],
        "bess_count": built["bess_count"],
        "wind_onshore_count": built["wind_onshore_count"],
        "wind_offshore_count": built["wind_offshore_count"],
    }.items():
        t = set_json_scalar(t, "expected", key, value, "release.v9.5.1.json")
    c951.write_text(t, encoding="utf-8")

    # stale atlas partitions: the builder deletes and rewrites its own outputs, so
    # anything left under data/v9.1 that the manifest does not name is an error
    named = {p["path"] for p in built["project_partitions"] + built["atlas_partitions"]} | {"data/v9.1/build_manifest.json"}
    present = {p.relative_to(release).as_posix() for p in (release / "data/v9.1").rglob("*") if p.is_file()}
    if present != named:
        raise SystemExit(f"FAIL: data/v9.1 holds files the manifest does not name: {sorted(present ^ named)}")

    # 6. release-local text edits
    if args.release_text_edits:
        for edit in json.loads(args.release_text_edits.read_text(encoding="utf-8")):
            path = release / edit["path"]
            if edit.get("delete"):
                path.unlink()
                continue
            if edit.get("create") is not None:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(edit["create"], encoding="utf-8")
                continue
            path.write_text(replace_once(path.read_text(encoding="utf-8"), edit["old"], edit["new"], edit["path"]),
                            encoding="utf-8")

    # atomic_write_json leaves tempfile's 0600; the repo tracks plain 100644 files
    for p in release.rglob("*"):
        if p.is_file() and (p.stat().st_mode & 0o777) == 0o600:
            p.chmod(0o644)
    after = hash_tree(repo, ["."], exclude=release)
    changed = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
    report = {
        "release": rel,
        "parent": f"uk_renewables_pipeline/{args.parent}",
        "protected_file_count": len(before),
        "changed_protected_files": changed,
        "identity_records": registry["raw_record_count"],
        "spine": {k: built[k] for k in ("project_count", "capacity_mw", "largest_mw", "geometry_count",
                                         "missing_geometry_count", "solar_count", "bess_count",
                                         "wind_onshore_count", "wind_offshore_count", "projects_sha256",
                                         "features_sha256")},
        "before": before,
    }
    args.hash_report.parent.mkdir(parents=True, exist_ok=True)
    args.hash_report.write_text(json.dumps(report, indent=1) + "\n", encoding="utf-8")
    if changed:
        raise SystemExit(f"FAIL: {len(changed)} protected files changed: {changed[:10]}")
    print(f"OK: {rel} built; {len(before)} protected files byte-identical")


if __name__ == "__main__":
    main()
