import csv
import hashlib
import io
import json
from pathlib import Path

import pytest

from automation.news import build_prospecting_priority as export

AS_OF = "2026-11-16T17:40:00Z"


@pytest.fixture(scope="module")
def artifacts():
    return export.build_artifacts(as_of=AS_OF)


def test_real_population_and_ranking_are_separate(artifacts):
    manifest = json.loads(artifacts["manifest.json"])
    triage = json.loads(artifacts["priority.json"])
    rows, pilot, _ = export.prospecting.official(None)
    assert manifest["inventory"]["official_ids"] == ["REPD-" + r["repd_ref"] for r, _ in rows]
    assert manifest["inventory"]["solar1000_ids"] == pilot
    assert len(rows) == 7775 and manifest["solar_count"] == 3604
    assert len(pilot) == 1000 and triage["returned_count"] == 1000
    assert all(r["heat"]["state"] == r["research_state"] == "UNKNOWN" for r in triage["records"])
    assert all(r["event_at"] is None and "This is not a new event" in r["research_note"] for r in triage["records"])
    assert manifest["rank_scope"].endswith("not the numeric Solar-1000 selection")


def test_deterministic_and_exact_file_receipts(artifacts):
    assert export.build_artifacts(as_of=AS_OF) == artifacts
    manifest = json.loads(artifacts["manifest.json"])
    for name, receipt in manifest["files"].items():
        assert receipt == {"sha256": hashlib.sha256(artifacts[name]).hexdigest(), "bytes": len(artifacts[name])}


def test_csv_matches_ranked_ids_and_nulls(artifacts):
    table = list(csv.DictReader(io.StringIO(artifacts["priority.csv"].decode())))
    triage = json.loads(artifacts["priority.json"])
    assert [r["project_id"] for r in table] == [r["id"] for r in triage["records"]]
    assert all(r["momentum_state"] == "UNKNOWN" and r["as_of"] == AS_OF for r in table)
    assert table[0]["source_url"] == triage["records"][0]["source"]["url"]


@pytest.mark.parametrize("value", ["=HYPERLINK(1)", "+1", "-1", "@cmd", "  =1", "\t1", "\r1", "\n1"])
def test_csv_formula_safety(value):
    assert export.csv_text(value) == "'" + value


def test_output_is_write_once_and_failed_digest_creates_nothing(tmp_path, artifacts):
    destination = tmp_path / "run"
    export.write_artifacts(destination, artifacts)
    assert {p.name: p.read_bytes() for p in destination.iterdir()} == artifacts
    with pytest.raises(FileExistsError):
        export.write_artifacts(destination, artifacts)
    changed = {**artifacts, "priority.json": b"{}"}
    with pytest.raises(ValueError, match="digest"):
        export.write_artifacts(tmp_path / "bad", changed)
    assert not (tmp_path / "bad").exists()


def test_invalid_optional_input_does_not_create_output(tmp_path):
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}")
    with pytest.raises(SystemExit) as exc:
        export.main(["--as-of", AS_OF, "--out-dir", str(tmp_path / "output"), "--evidence", str(invalid), "--evidence-sha256", "0" * 64])
    assert exc.value.code == 2 and not (tmp_path / "output").exists()


def test_release_output_forbidden(artifacts):
    with pytest.raises(ValueError, match="immutable"):
        export.write_artifacts(export.prospecting.queue.ROOT / "uk_renewables_pipeline" / "never-write-test", artifacts)


def test_missing_optional_pin_and_limit_are_errors(tmp_path):
    with pytest.raises(SystemExit):
        export.main(["--as-of", AS_OF, "--out-dir", str(tmp_path / "output"), "--datacentres", "unknown.json"])
    with pytest.raises(ValueError, match="Limit"):
        export.build_artifacts(as_of=AS_OF, limit=7775)


def test_unknown_dc_remark_does_not_invent_numbers():
    row = {"record_type": "data_centre"}
    note = export.remark(row)
    assert "unassessed" in note and "MW" not in note


def test_real_dc_input_retains_separate_inventory_and_unknowns():
    path = export.prospecting.queue.ROOT / "uk_renewables_pipeline/202611161630/global-datacentres/projects.json"
    raw = path.read_bytes()
    files = export.build_artifacts(as_of=AS_OF, datacentres=(path, export.sha(raw)))
    manifest = json.loads(files["manifest.json"])
    records = json.loads(raw)["records"]
    assert manifest["inventory"]["data_centre_ids"] == sorted(r["id"] for r in records)
    assert manifest["input_count"] == 7775 + len(records)
    assert manifest["input_receipts"][2]["sha256"] == export.sha(raw)


def test_oversized_output_rejected_before_writing(monkeypatch):
    monkeypatch.setattr(export.prospecting, "MAX_BYTES", 100)
    with pytest.raises(ValueError, match="consumer size"):
        export.build_artifacts(as_of=AS_OF)
