"""Owner-data contract regressions and adversarial inputs for the read-only index."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess

import pytest

from automation.news.grid_intelligence.index import (
    build_index, canonical, declared_layers, digest, planned_changes,
    podcast_index, read_pinned, validate_ref, parquet_source_index, layer_data_context,
)

ROOT = Path(__file__).resolve().parents[1] / "grid_intelligence"
SAMPLE = json.loads((ROOT / "etys_sample.json").read_bytes())
REF = SAMPLE["fixture_provenance"]


def test_real_etys_exact_nodes_units_and_plan_not_completion():
    rows = planned_changes(SAMPLE, REF, node="ABHA41")
    assert len(rows) == 1
    assert rows[0]["ratings"]["winter_rating_mva"] == {"value": 2423, "unit": "MVA"}
    assert rows[0]["planned_year"] == 2028
    assert rows[0]["publication_vintage"] == "ETYS 2025"
    assert rows[0]["source_sheet"] == "B-2-2c"
    assert rows[0]["review_state"] == "PROVISIONAL"
    assert rows[0]["actual_commissioned_date"] is None
    assert rows[0]["available_capacity_mw"] is None
    assert rows[0]["project_binding"] is None
    assert planned_changes(SAMPLE, REF, node="ABHA") == []
    assert len(planned_changes(SAMPLE, REF, node="LAGA41")) == 2


def test_null_rating_remains_null_and_repeated_source_rows_not_invented_assets():
    sample = deepcopy(SAMPLE)
    sample["transformer_changes"][0]["rating_mva"] = None
    sample["circuit_changes"].append(deepcopy(sample["circuit_changes"][0]))
    sample["counts"]["circuit_changes"] += 1
    rows = planned_changes(sample, REF)
    assert len({r["id"] for r in rows}) == 4
    assert sum(r["identical_row_occurrence"] == 2 for r in rows) == 1
    assert next(r for r in rows if r["kind"] == "transformer_change")["ratings"]["rating_mva"]["value"] is None
    assert canonical(rows) == canonical(planned_changes(sample, REF))


@pytest.mark.parametrize("field,value", [("year", "2028"), ("year", True), ("year", 9999),
    ("winter_rating_mva", -1), ("winter_rating_mva", float("nan")),
    ("winter_rating_mva", True), ("winter_rating_mva", "2423"), ("source_sheet", "")])
def test_rejects_unusable_etys_values(field, value):
    sample = deepcopy(SAMPLE)
    sample["circuit_changes"][0][field] = value
    with pytest.raises(ValueError):
        planned_changes(sample, REF)


def test_count_and_schema_fail_closed():
    sample = deepcopy(SAMPLE)
    sample["counts"]["circuit_changes"] = 1
    with pytest.raises(ValueError):
        planned_changes(sample, REF)
    sample = deepcopy(SAMPLE)
    sample["schema"] = "new-unknown-contract"
    with pytest.raises(ValueError):
        planned_changes(sample, REF)


@pytest.mark.parametrize("field,value", [("path", "../private"), ("path", "C:/private"),
    ("path", "/private"), ("commit", "main"), ("bytes", 99_000_000),
    ("sha256", "unknown"), ("repository", "other/private")])
def test_no_private_paths_or_mutable_source_pins(field, value):
    ref = dict(REF, **{field: value})
    with pytest.raises(ValueError):
        validate_ref(ref)


def test_read_git_objects_ignores_dirty_working_copy_and_detects_tampering(tmp_path):
    subprocess.run(["git", "init", str(tmp_path)], check=True, capture_output=True)
    path = tmp_path / "source.json"
    path.write_bytes(b'{"source":true}\n')
    subprocess.run(["git", "-C", str(tmp_path), "add", "source.json"], check=True, capture_output=True)
    subprocess.run(["git", "-C", str(tmp_path), "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture"], check=True, capture_output=True)
    commit = subprocess.check_output(["git", "-C", str(tmp_path), "rev-parse", "HEAD"]).decode().strip()
    raw = subprocess.check_output(["git", "-C", str(tmp_path), "show", commit + ":source.json"])
    ref = dict(REF, commit=commit, path="source.json", sha256=digest(raw), bytes=len(raw))
    path.write_bytes(b"dirty")
    assert read_pinned(tmp_path, ref) == raw
    with pytest.raises(ValueError, match="hash mismatch"):
        read_pinned(tmp_path, dict(ref, sha256="0" * 64))


def test_shell_declared_layers_never_assert_live_payload():
    shell = 'const ukConfig = [\n{ layers: [{ id: "400", label: "400kV", type: "line", url: "data/grid_400kv.geojson" }] }\n];'
    layer = declared_layers(shell)[0]
    assert layer["data_plane"] == "drawing_declaration"
    assert layer["runtime_payload_verified"] is False
    assert layer["source_licence"] is None
    with pytest.raises(ValueError):
        declared_layers(shell.replace('url:', 'renamed:'))


def test_podcast_timestamps_are_locators_not_verified_quotes():
    text = '<h2 id="one">Grid &amp; solar</h2>\nGuest (01:22.5)\nGrid connection and battery storage.\nHost (02:31)\nData centres require investment.\n'
    row = podcast_index(text, REF)[0]
    assert row["title"] == "Grid & solar"
    assert row["topics"]["grid"]["first_locators"][0]["timestamp"] == "01:22.5"
    assert row["topics"]["data_centres"]["matching_turns"] == 1
    assert row["claim_class"] == "interview_context_not_verified_project_evidence"
    assert "Grid connection and battery storage" not in canonical(row).decode()


def test_real_podcast_archive_and_checked_catalogue_contract():
    root = Path(__file__).resolve().parents[3]
    ref = next(r for r in json.loads((ROOT / "sources.json").read_bytes())["sources"] if r["id"] == "podcast")
    text = (root / "podcast_transcripts/index.md").read_text(encoding="utf-8")
    episodes = podcast_index(text, ref)
    assert len(episodes) == 21
    assert sum(r["speaker_turns"] for r in episodes) == 1348
    catalogue = json.loads((ROOT / "catalogue.json").read_bytes())
    assert catalogue["podcast"] == episodes
    assert len(catalogue["atlas"]["layers"]) == 60
    assert len(catalogue["engine"]["exports"]) == 15
    assert len(catalogue["atlas"]["data_owner"]["sources"]) == 56
    assert {r["id"] for r in catalogue["atlas"]["data_owner"]["layers"]} == {r["id"] for r in catalogue["atlas"]["layers"]}
    assert sum(r["features"] for r in catalogue["atlas"]["data_owner"]["sources"]) == 541282
    assert all(not r["rights_approved_by_this_index"] for r in catalogue["atlas"]["data_owner"]["layers"])
    assert catalogue["network"]["planned_change_rows"] == 2230
    assert catalogue["network"]["repeated_identical_change_rows"] == 336
    assert catalogue["coverage"]["all_estate_history_read"] is False
    for source in catalogue["sources"]:
        validate_ref(source)


def test_missing_and_tampered_input_cannot_build_catalogue():
    pins = json.loads((ROOT / "sources.json").read_bytes())
    with pytest.raises(ValueError, match="missing pinned input"):
        build_index(pins, {})
    blobs = {r["id"]: b"tampered" for r in pins["sources"]}
    with pytest.raises(ValueError, match="input drift"):
        build_index(pins, blobs)


def test_parquet_reader_preserves_owner_rights_caveats_and_nulls(tmp_path):
    duckdb = pytest.importorskip("duckdb")
    path = tmp_path / "fixture.parquet"
    con = duckdb.connect()
    con.execute("CREATE TABLE sources AS SELECT 'grid' AS source_id, 'wired' AS wiring, 12 AS features, 'hash' AS input_sha256, 'partitions/grid.parquet' AS partition_path, 'UNVERIFIED' AS authority_state, 'UNVERIFIED' AS licence_state, 'QUARANTINE' AS disposition, false AS publishable")
    con.execute("COPY sources TO ? (FORMAT PARQUET)", [str(path)])
    con.close()
    rows = parquet_source_index(path.read_bytes())
    assert rows[0]["licence_state"] == "UNVERIFIED"
    assert rows[0]["publishable"] is False
    registry = {"groups": [{"layers": [{"id": "400", "available": True, "v9_data": {"source_id": "grid", "parquet_url": "data/grid.parquet"}}]}]}
    release = {"files": [{"path": "data/grid.parquet", "sha256": "0" * 64, "bytes": 100}]}
    layer = layer_data_context(registry, release, rows)[0]
    assert layer["release_available_flag"] is True
    assert layer["source_publishable_flag"] is False
    assert layer["rights_approved_by_this_index"] is False
    with pytest.raises(ValueError, match="invalid bounded Parquet"):
        parquet_source_index(b"not parquet")
    with pytest.raises(KeyError):
        layer_data_context(registry, {"files": []}, rows)
