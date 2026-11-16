"""Full-row analytical closure and fail-closed immutable output checks."""
import copy
import hashlib
import json
from pathlib import Path
import sys

import duckdb
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from automation.news.acquisition import analytics
from automation.news.acquisition.evidence_store import EvidenceStore, EvidenceValidationError
from automation.news.acquisition.research_queue import load_seed_projects

NOW = "2026-11-16T16:00:00Z"


@pytest.fixture
def snapshot():
    projects = load_seed_projects()
    article = {"id": "synthetic", "url": "https://fixtures.example/solar",
               "title": "Synthetic solar association", "pub_date": NOW,
               "source_id": "fixture", "publisher": "Synthetic test publisher"}
    source = {"id": "fixture", "status": "ok", "url": "https://fixtures.example/feed",
              "fetched_at": NOW, "response_sha256": "a" * 64, "http_status": 200,
              "eligible_for_publication": True, "probe_only": False, "rights_status": "accepted",
              "rights_review_url": "https://fixtures.example/synthetic-rights"}
    # Same article associated with two projects: preserve association identity.
    matches = [{"project_id": p["id"], "article_url": article["url"],
                "status": "PROVISIONAL", "match_method": "repd_id"} for p in projects[:2]]
    with EvidenceStore() as store:
        store.record_run(projects, [article], matches, NOW, [source])
        return store.snapshot(), [p["id"] for p in projects]


def export(tmp_path, snapshot):
    payload, ids = snapshot
    receipt = analytics.export_analytics(payload, tmp_path, expected_project_ids=ids)
    return tmp_path / receipt["directory"], receipt


def bytes_in(directory):
    return {p.relative_to(directory).as_posix(): p.read_bytes()
            for p in directory.rglob("*") if p.is_file()}


def test_full_seed_parquet_join_and_replay_preserve_operational_state(tmp_path, snapshot):
    (tmp_path / "latest.json").write_bytes(b"existing pointer")
    (tmp_path / "evidence.sqlite").write_bytes(b"existing operational store")
    directory, receipt = export(tmp_path, snapshot)
    assert receipt["project_count"] == 1000
    assert receipt["evidence_count"] == 2
    assert not str(tmp_path) in json.dumps(receipt)
    with duckdb.connect() as db:
        projects = db.read_parquet(str(directory / "projects.parquet"))
        assert projects.count("*").fetchone()[0] == 1000
        assert projects.filter("verified_count <> 0 OR last_event IS NOT NULL").count("*").fetchone()[0] == 0
        evidence = db.read_parquet(str(directory / "evidence.parquet"))
        assert evidence.aggregate("count(DISTINCT project_id)").fetchone()[0] == 2
        assert evidence.aggregate("count(DISTINCT url)").fetchone()[0] == 1
        assert "body" not in evidence.columns
    before = bytes_in(tmp_path)
    assert export(tmp_path, snapshot)[1] == receipt
    assert bytes_in(tmp_path) == before
    assert before["latest.json"] == b"existing pointer"
    assert before["evidence.sqlite"] == b"existing operational store"


def test_empty_evidence_keeps_typed_table_and_unknown_coordinates(tmp_path, snapshot):
    payload, ids = copy.deepcopy(snapshot)
    for row in payload["projects"]:
        row.update(evidence=[], evidence_count=0, provisional_count=0,
                   status="RESEARCH_ATTEMPTED_NO_EVIDENCE", latitude=None, longitude=None)
    payload["evidence_count"] = 0
    directory, _ = export(tmp_path, (payload, ids))
    with duckdb.connect() as db:
        relation = db.read_parquet(str(directory / "evidence.parquet"))
        assert relation.columns == [c for c, _ in analytics.TABLES["evidence"]]
        assert relation.count("*").fetchone()[0] == 0
        projects = db.read_parquet(str(directory / "projects.parquet"))
        assert projects.filter("latitude IS NULL AND longitude IS NULL").count("*").fetchone()[0] == 1000


@pytest.mark.parametrize("mutation", [
    lambda p: p.update(verified_count=1),
    lambda p: p["sources"][0].update(rights_status="unknown"),
    lambda p: p["projects"][0].update(project_id="99999999"),
    lambda p: p["projects"][0]["evidence"][0].update(body="do not persist"),
    lambda p: p["projects"][0].update(evidence_count=999),
])
def test_invalid_source_fails_before_output(tmp_path, snapshot, mutation):
    payload, ids = copy.deepcopy(snapshot)
    mutation(payload)
    with pytest.raises(EvidenceValidationError):
        analytics.export_analytics(payload, tmp_path, expected_project_ids=ids)
    assert list(tmp_path.iterdir()) == []


def test_changed_source_same_generation_cannot_overwrite(tmp_path, snapshot):
    directory, _ = export(tmp_path, snapshot)
    before = bytes_in(directory)
    payload, ids = copy.deepcopy(snapshot)
    payload["projects"][0]["name"] = "Changed identity"
    with pytest.raises(EvidenceValidationError, match="source identity"):
        analytics.export_analytics(payload, tmp_path, expected_project_ids=ids)
    assert bytes_in(directory) == before


@pytest.mark.parametrize("change", ["corrupt", "missing", "extra"])
def test_artifact_tampering_rejected(tmp_path, snapshot, change):
    directory, _ = export(tmp_path, snapshot)
    parquet = directory / "projects.parquet"
    if change == "corrupt":
        parquet.write_bytes(parquet.read_bytes() + b"corruption")
    elif change == "missing":
        parquet.unlink()
    else:
        (directory / "unowned.txt").write_text("unexpected")
    with pytest.raises(EvidenceValidationError):
        analytics.validate_analytics(directory, snapshot[0], expected_project_ids=snapshot[1])


def test_recomputed_hash_cannot_hide_changed_parquet_values(tmp_path, snapshot):
    directory, _ = export(tmp_path, snapshot)
    path = directory / "evidence.parquet"
    replacement = tmp_path / "changed.parquet"
    with duckdb.connect() as db:
        db.read_parquet(str(path)).create_view("original")
        db.execute("COPY (SELECT * REPLACE ('VERIFIED' AS status) FROM original) TO "
                   + analytics._literal(replacement) + " (FORMAT PARQUET, COMPRESSION ZSTD)")
    path.write_bytes(replacement.read_bytes())
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["artifacts"]["evidence"].update(
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size)
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(EvidenceValidationError, match="full-row comparison"):
        analytics.validate_analytics(directory, snapshot[0], expected_project_ids=snapshot[1])


def test_failed_readback_leaves_no_partial_generation_or_pointer(tmp_path, snapshot, monkeypatch):
    (tmp_path / "latest.json").write_bytes(b"accepted")
    def fail(*args, **kwargs):
        raise EvidenceValidationError("simulated readback failure")
    monkeypatch.setattr(analytics, "validate_analytics", fail)
    with pytest.raises(EvidenceValidationError, match="simulated"):
        export(tmp_path, snapshot)
    assert bytes_in(tmp_path) == {"latest.json": b"accepted"}
    assert [p.name for p in tmp_path.iterdir()] == ["latest.json"]


def test_output_path_with_quote_is_not_sql(tmp_path, snapshot):
    directory, _ = export(tmp_path / "producer's output", snapshot)
    assert directory.is_dir()


def test_fixed_payload_builds_identical_bytes_in_independent_directories(tmp_path, snapshot):
    first, receipt_a = export(tmp_path / "first", snapshot)
    second, receipt_b = export(tmp_path / "second", snapshot)
    assert bytes_in(first) == bytes_in(second)
    assert receipt_a == receipt_b


def test_hash_repair_does_not_hide_wrong_column_type(tmp_path, snapshot):
    directory, _ = export(tmp_path, snapshot)
    path = directory / "projects.parquet"
    replacement = tmp_path / "wrong-schema.parquet"
    with duckdb.connect() as db:
        db.read_parquet(str(path)).create_view("original")
        db.execute("COPY (SELECT * REPLACE (CAST(project_id AS BIGINT) AS project_id) FROM original) TO "
                   + analytics._literal(replacement) + " (FORMAT PARQUET, COMPRESSION ZSTD)")
    path.write_bytes(replacement.read_bytes())
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["artifacts"]["projects"].update(
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size)
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(EvidenceValidationError, match="Parquet schema"):
        analytics.validate_analytics(directory, snapshot[0], expected_project_ids=snapshot[1])
