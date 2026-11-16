"""Package the existing, pinned Context producer and renderer for a local preview.

No collection, new project binding, rights decision or publication is performed.
By default only verify dependencies and regenerate the accepted export in memory.
An explicit new output directory stages an unchanged, self-contained browser cache.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib
import json
from pathlib import Path
import sys


DIRECTORY = Path(__file__).resolve().parent


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def source_bytes(path, expected):
    """Accept only exact Git bytes or Windows CRLF-only checkout conversion."""
    raw = path.read_bytes()
    if digest(raw) != expected:
        raw = raw.replace(b"\r\n", b"\n")
    if digest(raw) != expected:
        raise ValueError("Pinned Context dependency changed")
    return raw


def assemble(repository, figures_directory, *, include_validation=False):
    closure = json.loads((DIRECTORY / "closure.json").read_text(encoding="utf-8"))
    verified = {}
    for entry in closure["source_files"]:
        if entry["role"] == "validation" and not include_validation:
            continue
        verified[entry["path"]] = source_bytes(repository / entry["path"], entry["sha256"])
    figures = {}
    for name, expected in closure["figures"]["files"].items():
        raw = (figures_directory / name).read_bytes()
        if digest(raw) != expected:
            raise ValueError("Pinned FIGURES dependency changed; exact source bytes required")
        figures[name] = raw

    sys.path.insert(0, str(repository))
    composer = importlib.import_module("automation.news.build_transition_context")
    read = lambda relative: json.loads(verified[relative])
    report = composer.build(
        read("automation/news/policy_commitments/sample_ledger.json"),
        read("automation/news/dc_context/grid-source-fixture.json"),
        read("automation/news/dc_context/fixtures/solar-context.json"),
        as_of=closure["export"]["as_of"],
    )
    raw = composer.dumps(report).encode("utf-8")
    if digest(raw) != closure["export"]["sha256"]:
        raise ValueError("Actual composer export differs from the independently pinned fixture")
    expected = {"records": 14, "families": {"policy": 8, "grid": 2, "solar": 4},
                "numeric_claims": 3, "linked_projects": 0,
                "scope": "BOUNDED_SUPPLIED_CONTEXT"}
    if report["coverage"] != expected or report["status"] != "PROVISIONAL":
        raise ValueError("Context coverage or provisional boundary changed")
    if any(row["scope"]["canonical_project_id"] is not None
           or row["scope"]["binding"] != "UNLINKED" for row in report["records"]):
        raise ValueError("Context must not acquire a project association")

    files = {"transition-context.json": raw}
    for name in ("adapter.mjs", "render.mjs", "context.css"):
        files[name] = verified["automation/news/context-ui/" + name]
    figures_prefix = "figures/" + closure["figures"]["commit"] + "/"
    files.update({figures_prefix + name: value for name, value in figures.items()})
    manifest = {
        "schema": "globalgrid2050.v928-context-preview.v1",
        "preview_only": True,
        "publication_authorized": False,
        "source_rights_status": "UNASSESSED",
        "source_repository": closure["source_repository"],
        "source_commit": closure["source_commit"],
        "as_of": closure["export"]["as_of"],
        "transition_context_sha256": closure["export"]["sha256"],
        "coverage": expected,
        "figures": {**closure["figures"], "cache_directory": figures_prefix},
        "files": {name: {"sha256": digest(data), "bytes": len(data)}
                  for name, data in sorted(files.items())},
        "limitations": report["limitations"],
    }
    files["manifest.json"] = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode("utf-8")
    return files, manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository-root", type=Path, default=DIRECTORY.parents[1])
    parser.add_argument("--figures-dir", type=Path, required=True)
    parser.add_argument("--verify-validation", action="store_true")
    parser.add_argument("--output-dir", type=Path,
                        help="Explicit NEW local-preview directory; never overwrite")
    args = parser.parse_args(argv)
    try:
        files, manifest = assemble(args.repository_root.resolve(), args.figures_dir.resolve(),
                                   include_validation=args.verify_validation)
        if args.output_dir is not None:
            # Validate the entire bundle before creating anything. Manifest is last:
            # an interrupted staging attempt has no complete consumer manifest.
            destination = args.output_dir.resolve()
            destination.mkdir(parents=False, exist_ok=False)
            for name, raw in files.items():
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("xb") as handle:
                    handle.write(raw)
        print(json.dumps({"status": "PASS", "scope": "local provisional Context preview only",
                          "source_commit": manifest["source_commit"],
                          "export_sha256": manifest["transition_context_sha256"],
                          "manifest_sha256": digest(files["manifest.json"]),
                          "coverage": manifest["coverage"],
                          "source_rights_status": "UNASSESSED", "publication_authorized": False},
                         indent=2, sort_keys=True))
    except (OSError, ValueError, ImportError, KeyError, TypeError) as exc:
        parser.exit(2, f"Context preview withheld: {type(exc).__name__}: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
