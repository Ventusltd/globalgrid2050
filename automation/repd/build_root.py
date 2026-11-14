#!/usr/bin/env python3
"""Root-format REPD datasets for a new release, built from the cleaned canonical CSV.

Reproduces, under NEW names, the files the legacy atlas and table pages read:

    repd.csv                              full register, official 53-column layout
    repd-grid-batteries.csv               Battery, active statuses
    repd-solar-operational.csv            Solar PV, Operational, > 1 MW, ground or roof (43 columns)
    repd-solar-operational-over-4mw.csv   Solar PV, Operational, > 4 MW
    dist/repd_master.json                 GeoJSON of viable geocoded records (scripts/repd_updater.py)
    dist/manifest_v4.json                 provenance of that GeoJSON

Nothing existing is overwritten: the orchestrator (run.py) renames each output with the
release label (repd-2026q3.csv, dist/repd_master_2026q3.json, ...). The January 2026 files
of the same base names stay byte-identical; other releases and repositories pin their hashes.

The filters are the ones that reproduce the committed January subsets exactly by Ref ID
(crawl note 16, lineage note 3.3). Blank capacity is unknown and never passes a threshold.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

BATTERY_STATUSES = {
    "Operational", "Under Construction", "Awaiting Construction",
    "Application Submitted", "Appeal Lodged", "No Application Required",
}
SOLAR = "Solar Photovoltaics"
CAPACITY = "Installed Capacity (MWelec)"
STATUS = "Development Status (short)"
TECH = "Technology Type"
MOUNT = "Mounting Type for Solar"

# Header of the committed repd-solar-operational.csv (43 of the 53 official columns, same order).
SOLAR_OPERATIONAL_DROPPED = {
    "Storage Type", "Share Community Scheme", "Turbine Capacity (MW)", "No. of Turbines",
    "Height of Turbines (m)", "Offshore Wind Round", "Appeal Withdrawn", "Appeal Refused",
    "Secretary of State - Refusal", "Heat Network Ref",
}


def _norm(name: str) -> str:
    return " ".join(str(name).replace("﻿", "").split())


def _capacity(value: str):
    text = (value or "").strip().replace(",", "")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def read_canonical(path: Path) -> tuple[list[str], list[dict]]:
    raw = Path(path).read_bytes()
    text = raw.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text, newline=""))
    header = next(reader)
    rows = []
    for record in reader:
        if len(record) != len(header):
            raise RuntimeError(f"record with {len(record)} fields, header has {len(header)}")
        rows.append(dict(zip(header, record)))
    return header, rows


def _write_csv(path: Path, header: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\r\n")
        writer.writerow(header)
        for row in rows:
            writer.writerow([row[column] for column in header])


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def solar_operational_header(official_header: list[str], legacy_file: Path | None) -> list[str]:
    """43-column header: taken from the committed legacy file when present, else derived."""
    by_norm = {_norm(column): column for column in official_header}
    if legacy_file and Path(legacy_file).is_file():
        with Path(legacy_file).open("r", encoding="utf-8-sig", newline="") as handle:
            legacy = next(csv.reader(handle))
        missing = [column for column in legacy if _norm(column) not in by_norm]
        if missing:
            raise RuntimeError(f"legacy solar header has columns absent from the release: {missing}")
        return [by_norm[_norm(column)] for column in legacy]
    return [column for column in official_header if _norm(column) not in SOLAR_OPERATIONAL_DROPPED]


def build_master(canonical_csv: Path, repo_root: Path) -> dict:
    """GeoJSON via the repository's own refiner (scripts/repd_updater.py), unchanged."""
    scripts = str(Path(repo_root) / "scripts")
    if scripts not in sys.path:
        sys.path.insert(0, scripts)
    import os
    previous = os.getcwd()
    os.chdir(repo_root)  # REPDUpdater reads config/registry.yaml relative to the repo root
    try:
        from repd_updater import REPDUpdater
        return REPDUpdater().refine_dataset(str(canonical_csv))
    finally:
        os.chdir(previous)


def build_root(canonical_csv, out_dir, repo_root=None, descriptor=None, label=None) -> dict:
    canonical_csv, out_dir = Path(canonical_csv), Path(out_dir)
    repo_root = Path(repo_root) if repo_root else Path(__file__).resolve().parents[2]
    descriptor = descriptor or {}
    out_dir.mkdir(parents=True, exist_ok=True)

    header, rows = read_canonical(canonical_csv)
    refs = [row["Ref ID"] for row in rows]
    if len(set(refs)) != len(refs):
        raise RuntimeError("canonical CSV has duplicate Ref IDs; refusing to build")
    for column in (TECH, STATUS, CAPACITY, MOUNT, "Ref ID"):
        if column not in header:
            raise RuntimeError(f"canonical CSV lacks required column {column!r}")

    files: dict[str, Path] = {}
    counts: dict[str, int] = {}

    # 1. full register: the cleaned canonical file, byte for byte
    full = out_dir / "repd.csv"
    full.write_bytes(canonical_csv.read_bytes())
    files["repd.csv"], counts["repd.csv"] = full, len(rows)

    # 2. batteries, active statuses
    batteries = [r for r in rows if r[TECH].strip() == "Battery" and r[STATUS].strip() in BATTERY_STATUSES]
    path = out_dir / "repd-grid-batteries.csv"
    _write_csv(path, header, batteries)
    files["repd-grid-batteries.csv"], counts["repd-grid-batteries.csv"] = path, len(batteries)

    # 3. operational solar above 1 MW, ground or roof, 43 columns
    def operational_solar(row, floor):
        capacity = _capacity(row[CAPACITY])
        return (row[TECH].strip() == SOLAR and row[STATUS].strip() == "Operational"
                and capacity is not None and capacity > floor)

    solar_1 = [r for r in rows if operational_solar(r, 1.0) and r[MOUNT].strip() in {"Ground", "Roof"}]
    solar_header = solar_operational_header(header, repo_root / "repd-solar-operational.csv")
    path = out_dir / "repd-solar-operational.csv"
    _write_csv(path, solar_header, solar_1)
    files["repd-solar-operational.csv"], counts["repd-solar-operational.csv"] = path, len(solar_1)

    # 4. operational solar above 4 MW, all mountings, 53 columns
    solar_4 = [r for r in rows if operational_solar(r, 4.0)]
    path = out_dir / "repd-solar-operational-over-4mw.csv"
    _write_csv(path, header, solar_4)
    files["repd-solar-operational-over-4mw.csv"], counts["repd-solar-operational-over-4mw.csv"] = path, len(solar_4)

    # 5. master GeoJSON and its manifest
    geojson = build_master(full, repo_root)
    master = out_dir / "dist" / "repd_master.json"
    master.parent.mkdir(parents=True, exist_ok=True)
    master.write_text(json.dumps(geojson, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    files["dist/repd_master.json"], counts["dist/repd_master.json"] = master, len(geojson["features"])

    manifest = {
        "system": "VENTUS_CORE",
        "schema_version": 6,
        "last_sync": descriptor.get("retrieved_at") or datetime.now(timezone.utc).isoformat(),
        "source_owner": "Department for Energy Security and Net Zero (DESNZ)",
        "source_url": descriptor.get("csv_url"),
        "source_excel_url": descriptor.get("xlsx_url"),
        "source_page": descriptor.get("source_page")
        or "https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract",
        "source_dataset_title": descriptor.get("title") or descriptor.get("dataset_title")
        or "Renewable Energy Planning Database",
        "source_page_last_updated": descriptor.get("page_last_updated"),
        "source_file": (descriptor.get("csv_url") or "").rsplit("/", 1)[-1] or None,
        "source_sha256": {"csv": descriptor.get("expected_csv_sha256"), "xlsx": descriptor.get("expected_xlsx_sha256")},
        "cleaned_csv_sha256": _sha256(full),
        "official_ref_field": "Ref ID",
        "official_record_update_field": "Record Last Updated (dd/mm/yyyy)",
        "record_count": len(rows),
        "feature_count": len(geojson["features"]),
        "release_label": label or descriptor.get("label"),
        "status": "CANDIDATE",
    }
    manifest_path = out_dir / "dist" / "manifest_v4.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    files["dist/manifest_v4.json"] = manifest_path

    return {
        "status": "ok",
        "files": {rel: str(path) for rel, path in files.items()},
        "counts": counts,
        "sha256": {rel: _sha256(path) for rel, path in files.items()},
    }


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("canonical_csv")
    parser.add_argument("--out", required=True)
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--descriptor", default=None, help="release descriptor JSON")
    parser.add_argument("--label", default=None)
    args = parser.parse_args(argv)
    descriptor = json.loads(Path(args.descriptor).read_text(encoding="utf-8")) if args.descriptor else {}
    result = build_root(args.canonical_csv, args.out, args.repo_root, descriptor, args.label)
    print(json.dumps({"counts": result["counts"], "sha256": result["sha256"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
