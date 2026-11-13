#!/usr/bin/env python3
"""Independent candidate integrity and Git backup verifier (no production writes)."""
import csv
import hashlib
import io
import json
import os
import re
import subprocess
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
    assert r["stage"] == "STAGED_WITH_OFFICIAL_DATE_CONFLICTS"
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
    assert len(r["quarantined_official_date_disagreements"]) == 5
    refs = {row["Ref ID"].strip(): row for row in output_rows}
    for item in r["quarantined_official_date_disagreements"]:
        assert refs[item["repd_ref"]][item["field"]] == "", "Conflicted date not quarantined"
    results = {
        "source_csv_sha256": sha(raw), "source_xlsx_sha256": sha(excel),
        "source_csv_bytes": len(raw), "source_xlsx_bytes": len(excel),
        "source_rows": len(source_rows), "candidate_rows": len(output_rows),
        "final_ref_id": output_rows[-1]["Ref ID"],
        "columns": len(output_columns), "historical_blobs": {},
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
