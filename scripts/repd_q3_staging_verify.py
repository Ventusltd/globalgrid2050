#!/usr/bin/env python3
"""Independent candidate integrity and Git backup verifier (no production writes)."""
import csv
import hashlib
import io
import json
import os
import re
import subprocess
from datetime import datetime
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get("REPD_Q3_OUTPUT", ROOT / ".repd-staging" / "2026-10"))
PREVIOUS = {
    "repd.csv": "01fe17ae9531d3504490a1418a68350262b06f86",
    "repd-grid-batteries.csv": "2d4142c7bb97bbd4be1c67698731730d2e25c672",
    "repd-solar-operational.csv": "5d8bab7f640eb943dcf66b2631ad6bcde1f52122",
    "repd-solar-operational-over-4mw.csv": "31e840cfe206cfb53d9ed2c043e00bdd69080a82",
    "dist/repd_master.json": "e221065a7b144a9e4b691cf282e23a68c5661e45",
    "dist/manifest_v6.json": "dbaf471f262d3b6557e7f327269b663eeddc432c",
    "dist/repd_source_reconciliation_v6.json": "35835b6b46aa1f996fedac8c7bf3044a3d423814",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def csv_rows(data):
    try:
        decoded = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = data.decode("cp1252")
    reader = csv.DictReader(io.StringIO(decoded, newline=""))
    rows = list(reader)
    assert len(reader.fieldnames) == 53
    assert all(None not in row and all(v is not None for v in row.values()) for row in rows)
    return reader.fieldnames, rows


def main():
    r = json.loads((OUT / "Q3_RECONCILIATION.json").read_text())
    assert r["no_production_promotion"] is True and not r["failures"]
    assert r["stage"] == "STAGED_WITH_SOURCE_DATE_LOCALE_NORMALISATIONS"
    raw = (OUT / "official-sources/REPD_Publication_Q3_2026.csv").read_bytes()
    excel = (OUT / "official-sources/REPD_Publication_Q3_2026.xlsx").read_bytes()
    candidate = (OUT / "Q3_CANONICAL_STAGED.csv").read_bytes()
    assert sha(raw) == r["q3_source_sha256"]["csv"]
    assert sha(excel) == r["q3_source_sha256"]["xlsx"]
    assert raw.endswith(b"\n") and candidate.endswith(b"\n")
    input_columns, source_rows = csv_rows(raw)
    output_columns, output_rows = csv_rows(candidate)
    normalized_columns = [re.sub(r"\s+", " ", name.strip()) for name in input_columns]
    assert normalized_columns == output_columns, "Column loss, collision or reordering beyond whitespace canonicalisation"
    assert len(set(normalized_columns)) == len(output_columns), "Input header normalisation collision"
    src = Counter(row["Ref ID"].strip() for row in source_rows)
    dst = Counter(row["Ref ID"].strip() for row in output_rows)
    assert len(source_rows) == r["original_csv_rows"] == 14968
    assert len(output_rows) == r["q3_unique_ids"] == 14967
    assert set(src) == set(dst) and all(v == 1 for v in dst.values())
    assert {k:v for k,v in src.items() if v != 1} == {"7679": 2}
    assert source_rows[-1]["Ref ID"] == output_rows[-1]["Ref ID"] == "21493"
    assert r["quarantined_official_date_disagreements"] == []
    assert len(r["source_locale_date_normalisations"]) == r["source_locale_date_normalisation_count"] == 25
    assert len(r["formerly_ambiguous_date_representations"]) == 5
    refs = {row["Ref ID"].strip(): row for row in output_rows}
    for item in r["source_locale_date_normalisations"]:
        assert refs[item["repd_ref"]][item["field"]] == item["candidate_value"], "Month-first date not corrected"
        assert datetime.strptime(item["candidate_value"], "%d/%m/%Y").strftime("%Y-%m-%d") == item["official_xlsx"]
        assert datetime.strptime(item["official_csv"], "%m/%d/%Y").strftime("%Y-%m-%d") == item["official_xlsx"]
        assert item["official_xlsx"] <= item["record_last_updated"]
    date_columns = [
        "Planning Application Submitted", "Planning Application Withdrawn",
        "Planning Permission Refused", "Planning Permission Granted",
        "Planning Permission Expired", "Under Construction", "Operational",
        "Record Last Updated (dd/mm/yyyy)",
    ]
    # Also hold every date column the general rule discovered to strict dd/mm/yyyy.
    date_columns = list(dict.fromkeys(date_columns + r["date_rule"]["date_columns"]))
    assert r["date_rule"]["ok"] and r["date_rule"]["failures"] == 0
    non_day_first_dates = []
    for row in output_rows:
        for field in date_columns:
            if field not in row:
                continue
            value = row[field].strip()
            if not value:
                continue
            if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", value):
                non_day_first_dates.append((row["Ref ID"], field, value))
                continue
            try:
                datetime.strptime(value, "%d/%m/%Y")
            except ValueError:
                non_day_first_dates.append((row["Ref ID"], field, value))
    assert non_day_first_dates == [], f"Candidate has invalid/non-dd/mm/yyyy dates: {non_day_first_dates[:10]}"
    results = {
        "source_csv_sha256": sha(raw), "source_xlsx_sha256": sha(excel),
        "source_csv_bytes": len(raw), "source_xlsx_bytes": len(excel),
        "source_rows": len(source_rows), "candidate_rows": len(output_rows),
        "final_ref_id": output_rows[-1]["Ref ID"],
        "columns": len(output_columns), "date_locale_corrections": 25,
        "non_day_first_candidate_date_cells": len(non_day_first_dates), "historical_blobs": {},
    }
    for path, expected_sha in PREVIOUS.items():
        original = ROOT / path
        assert original.is_file(), "Missing historical file: " + path
        blob = subprocess.check_output(["git", "hash-object", str(original)], text=True).strip()
        assert blob == expected_sha, "Historical source changed: " + path
        backup = OUT / "pre-ingestion-backup" / original.name
        assert backup.is_file(), "Missing historical backup: " + path
        assert sha(original.read_bytes()) == sha(backup.read_bytes()), "Backup mismatch: " + path
        results["historical_blobs"][path] = blob
    master = json.loads((ROOT / "dist/repd_master.json").read_text())
    assert len(master["features"]) == 10784, "Historical REPD GeoJSON changed"
    (OUT / "INTEGRITY-VERIFICATION.json").write_text(json.dumps(results, indent=2)+"\n")
    print(json.dumps({"result":"PASS", **results},indent=2))


if __name__ == "__main__":
    main()
