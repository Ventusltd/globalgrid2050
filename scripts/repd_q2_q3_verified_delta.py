#!/usr/bin/env python3
"""Prove original July 2026 REPD recovery and compare raw Q2/Q3 source records.

Evidence-only. Never writes production data or changes an existing release.
Field change counts are raw CSV text differences, NOT all substantive changes.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

EXPECTED = {
    "q2_csv": "84c1b5f958a934d8b4b86ec88f50bdcf43830ded7ff2efc27bffca0c98695035",
    "q2_xlsx": "624a0a9712c58a7a93716e51f2bf054eec8b1af7170f6f9516cc10cd248e2657",
    "q3_csv": "48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862",
    "q3_xlsx": "87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea",
}
ARCHIVE_PAGE = "https://tnaqa.mirrorweb.com/ukgwa/20261102130314oe_/https%3A/www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract"
ARCHIVED_CSV = "https://tnaqa.mirrorweb.com/ukgwa/20261103070426oe_/https://assets.publishing.service.gov.uk/media/6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv"
ARCHIVED_XLSX = "https://tnaqa.mirrorweb.com/ukgwa/20261103065723oe_/https://assets.publishing.service.gov.uk/media/6a6cbdd2862aaf18d9c62b02/REPD_Publication_Q2_2026.xlsx"


def verify(path: Path, expected: str) -> bytes:
    data = path.read_bytes()
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ValueError(f"Source hash mismatch {path}: {actual} != {expected}")
    return data


def rows(raw: bytes) -> tuple[list[str], list[dict[str, str]]]:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")
    reader = csv.reader(io.StringIO(text, newline=""))
    header = [" ".join(s.split()) for s in next(reader)]
    if len(header) != 53 or len(set(header)) != 53:
        raise ValueError("Official 53-column header invalid")
    result = []
    for number, fields in enumerate(reader, 2):
        if len(fields) != 53:
            raise ValueError(f"Truncated/malformed record at CSV line {number}: {len(fields)} fields")
        result.append(dict(zip(header, fields)))
    return header, result


def index(items: list[dict[str, str]], allow_one_identical_duplicate: bool) -> tuple[dict[str, dict[str, str]], dict]:
    by_ref = {}
    duplicates = Counter()
    for item in items:
        ref = item["Ref ID"].strip()
        if not ref or not ref.isdecimal():
            raise ValueError(f"Invalid Ref ID: {ref!r}")
        if ref in by_ref:
            if not allow_one_identical_duplicate or ref != "7679" or item != by_ref[ref]:
                raise ValueError(f"Unexpected conflicting/duplicate Ref ID: {ref}")
            duplicates[ref] += 1
        else:
            by_ref[ref] = item
    if allow_one_identical_duplicate and dict(duplicates) != {"7679": 1}:
        raise ValueError(f"Expected exact duplicate 7679, got {dict(duplicates)}")
    if not allow_one_identical_duplicate and duplicates:
        raise ValueError(f"Unexpected duplicate in July: {dict(duplicates)}")
    return by_ref, dict(duplicates)


def numeric(value: str):
    try:
        return Decimal(value.replace(",", "").strip())
    except InvalidOperation:
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    for key in EXPECTED:
        parser.add_argument("--" + key.replace("_", "-"), type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    raw = {k: verify(getattr(args, k), v) for k, v in EXPECTED.items()}
    h2, source2 = rows(raw["q2_csv"])
    h3, source3 = rows(raw["q3_csv"])
    if h2 != h3:
        raise ValueError("Q2 and Q3 source column names/order differ")
    if len(source2) != 14657 or len(source3) != 14968:
        raise ValueError("Unexpected official source row count")
    old, d2 = index(source2, False)
    new, d3 = index(source3, True)
    if len(old) != 14657 or len(new) != 14967:
        raise ValueError("Unexpected unique identity count")
    old_ids, new_ids = set(old), set(new)
    common = sorted(old_ids & new_ids, key=int)
    added = sorted(new_ids - old_ids, key=int)
    removed = sorted(old_ids - new_ids, key=int)
    field_changes = {}
    for field in h2:
        changed = sum(old[ref][field].strip() != new[ref][field].strip() for ref in common)
        if changed:
            field_changes[field] = changed
    capacity = "Installed Capacity (MWelec)"
    numeric_capacity_changed = sum(
        numeric(old[ref][capacity]) != numeric(new[ref][capacity]) for ref in common
    )
    report = {
        "schema": "globalgrid2050.repd-q2-to-q3-raw-verified.v1",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source": "Official DESNZ REPD July and October 2026 raw CSV and Excel",
        "q2_recovered_archive_page": ARCHIVE_PAGE,
        "q2_recovered_csv_url": ARCHIVED_CSV,
        "q2_recovered_xlsx_url": ARCHIVED_XLSX,
        "source_sha256": EXPECTED,
        "source_bytes": {k: len(v) for k, v in raw.items()},
        "q2_original_rows": len(source2),
        "q2_unique_refs": len(old),
        "q3_original_rows": len(source3),
        "q3_unique_refs": len(new),
        "source_columns": len(h2),
        "q2_duplicates": d2,
        "q3_identical_duplicates": d3,
        "q3_last_ref": source3[-1]["Ref ID"],
        "identity_delta": {
            "added": len(added), "removed": len(removed), "retained": len(common),
            "added_refs": added, "removed_refs": removed,
        },
        "field_change_counts_raw_csv_text": field_changes,
        "capacity_changed_numeric_csv": numeric_capacity_changed,
        "interpretation": "Source-to-source record comparison. Differences in dates, whitespace and rounded capacities can be representational; typed Excel review is needed before treating each changed cell as a substantive project event.",
        "production_deployed": False,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "result": "PASS", "q2_rows": len(source2), "q3_rows": len(source3),
        "q3_unique": len(new), "added": len(added), "removed": len(removed),
        "status_changed": field_changes.get("Development Status (short)", 0),
        "technology_changed": field_changes.get("Technology Type", 0),
        "capacity_numeric_changed": numeric_capacity_changed,
    }, indent=2))


if __name__ == "__main__":
    main()
