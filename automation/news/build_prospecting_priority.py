"""Export the existing bounded research ranking without changing official rows.

Offline only. Writes a new immutable review directory containing priority.json,
priority.csv and manifest.json. Integration must pin the manifest before use.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path

from automation.news import prospecting

SCHEMA = "globalgrid2050.prospecting.export.v1"


def encoded(value):
    return (json.dumps(value, sort_keys=True, ensure_ascii=False, indent=2,
                       allow_nan=False) + "\n").encode("utf-8")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def remark(row):
    """Summarise supplied record fields, never create an event or delivery claim."""
    if row["record_type"] == "data_centre":
        return ("Research note: Wikidata source-indexed data-centre lead; "
                "operation, demand, connection and funding remain unassessed. "
                "Inspect the linked entity revision.")
    capacity = row["capacities"]["repd_installed_mw"]
    quantity = "capacity unknown" if capacity is None else f"{capacity:g} MW installed capacity"
    status = row["official_status"] or "status unknown"
    date = row["record_freshness"]["timestamp"] or "unknown update date"
    return (f"Research note: {row['id']} records {quantity}; {status}; record date {date}. "
            "Review the linked REPD record. This is not a new event or evidence of grid access.")


def csv_text(value):
    value = "" if value is None else str(value)
    # Spreadsheet interpretation must not execute source-provided formulas.
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n")) else value


def build_artifacts(*, as_of, limit=1000, evidence=None, datacentres=None, repo_root=None):
    triage = prospecting.build(as_of=as_of, limit=limit, evidence=evidence,
                               datacentres=datacentres, repo_root=repo_root)
    rows, pilot, official = prospecting.official(repo_root)
    ids = ["REPD-" + row["repd_ref"] for row, _ in rows]
    solar_count = sum(row["technology"] == "solar" for row, _ in rows)
    prospecting.require(len(ids) == len(set(ids)) == 7775 and solar_count == 3604,
                        "Official population invariant failed")
    prospecting.require(len(pilot) == len(set(pilot)) == 1000,
                        "Solar-1000 invariant failed")
    dc_rows, _ = prospecting.dc_input(datacentres, prospecting._moment(as_of))
    dc_ids = sorted(row["id"] for row in dc_rows)
    all_ids = set(ids + dc_ids)
    prospecting.require(all(row["id"] in all_ids for row in triage["records"]),
                        "Ranked record is absent from source inventory")
    for row in triage["records"]:
        row["research_note"] = remark(row)
    priority = encoded(triage)
    prospecting.require(len(priority) <= prospecting.MAX_BYTES,
                        "Priority output exceeds consumer size limit")
    stream = io.StringIO(newline="")
    fields = ["rank", "project_id", "record_type", "name", "research_priority_points",
              "official_status", "repd_installed_mw", "research_state", "momentum_state",
              "as_of", "source_record_date", "source_url", "source_sha256", "research_note"]
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(fields)
    for row in triage["records"]:
        writer.writerow([csv_text(value) for value in (
            row["rank"], row["id"], row["record_type"], row["name"], row["score"],
            row["official_status"], row["capacities"].get("repd_installed_mw"),
            row["research_state"], row["heat"]["state"], triage["as_of"],
            row["record_freshness"]["timestamp"], row["source"].get("revision_url", row["source"]["url"]),
            row["source"]["sha256"], row["research_note"])])
    csv_bytes = stream.getvalue().encode("utf-8")
    inventory = {"official_ids": ids, "solar1000_ids": pilot, "data_centre_ids": dc_ids}
    manifest = {
        "schema": SCHEMA, "as_of": as_of, "purpose": triage["purpose"],
        "publication_state": "REVIEW_ARTIFACT", "source_release": official["release"],
        "official_count": 7775, "solar_count": 3604, "solar1000_count": 1000,
        "ranked_count": triage["returned_count"], "input_count": triage["input_count"],
        "rank_scope": "Bounded research subset; not the numeric Solar-1000 selection",
        "unranked_state": "OUTSIDE_RANKED_SUBSET", "inventory": inventory,
        "inventory_sha256": sha(encoded(inventory)),
        "input_receipts": triage["input_receipts"],
        "profile_sha256": triage["profile_sha256"],
        "files": {name: {"sha256": sha(raw), "bytes": len(raw)} for name, raw in
                  (("priority.json", priority), ("priority.csv", csv_bytes))},
    }
    manifest_bytes = encoded(manifest)
    prospecting.require(len(csv_bytes) <= prospecting.MAX_BYTES and len(manifest_bytes) <= 1024 * 1024,
                        "Export output exceeds consumer size limit")
    return {"priority.json": priority, "priority.csv": csv_bytes, "manifest.json": manifest_bytes}


def write_artifacts(directory, artifacts):
    """Validate/build first, then create a new directory; never replace a pointer."""
    destination = Path(directory).resolve()
    prospecting.require(not destination.is_relative_to(prospecting.queue.ROOT / "uk_renewables_pipeline"),
                        "Do not write into immutable release trees")
    prospecting.require(set(artifacts) == {"priority.json", "priority.csv", "manifest.json"},
                        "Unexpected export files")
    manifest = json.loads(artifacts["manifest.json"])
    for name in ("priority.json", "priority.csv"):
        prospecting.require(manifest["files"][name] == {"sha256": sha(artifacts[name]),
                            "bytes": len(artifacts[name])}, "Export digest mismatch")
    destination.mkdir(parents=True, exist_ok=False)
    # Manifest is the completion receipt. An interrupted write has no valid receipt.
    for name in ("priority.json", "priority.csv", "manifest.json"):
        with (destination / name).open("xb") as stream:
            stream.write(artifacts[name])


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=1000)
    for name in ("evidence", "datacentres"):
        parser.add_argument("--" + name, type=Path)
        parser.add_argument("--" + name + "-sha256")
    args = parser.parse_args(argv)
    inputs = {}
    for name in ("evidence", "datacentres"):
        path, digest = getattr(args, name), getattr(args, name + "_sha256")
        if bool(path) != bool(digest):
            parser.error("Optional inputs require both a file and exact SHA256")
        inputs[name] = (path, digest) if path else None
    try:
        artifacts = build_artifacts(as_of=args.as_of, limit=args.limit, **inputs)
        write_artifacts(args.out_dir, artifacts)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Priority export failed: {exc}\n")
    print(f"Priority review export complete: {json.loads(artifacts['manifest.json'])['ranked_count']} ranked; 7775 official IDs retained")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
