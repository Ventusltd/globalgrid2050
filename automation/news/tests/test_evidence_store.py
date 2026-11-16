"""Acquisition storage gates: immutable scope, provisional status and publication."""
import copy
import csv
import hashlib
import json
import sqlite3
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from automation.news.acquisition.evidence_store import (
    EvidenceStore, EvidenceValidationError, NO_EVIDENCE, PROVISIONAL,
    export_snapshot, validate_snapshot,
)

NOW = "2026-11-16T16:00:00Z"
LATER = "2026-11-23T16:00:00Z"


@pytest.fixture
def projects():
    return [{"id": str(i), "name": f"Project {i}", "latitude": 52.1 if i == 1000 else None,
             "longitude": -1.2 if i == 1000 else None} for i in range(1000, 2000)]


@pytest.fixture
def articles():
    return [{"id": "article1", "url": "https://www.pv-magazine.com/example/",
             "title": "Project 1000 solar plans", "pub_date": "2026-11-15T10:00:00Z",
             "source_id": "pv_magazine_global", "publisher": "PV Magazine",
             "content": "This transient snippet must never reach SQLite or published exports."}]


@pytest.fixture
def sources():
    return [{"id": "pv_magazine_global", "status": "ok", "url": "https://www.pv-magazine.com/feed/",
             "fetched_at": NOW, "response_sha256": "a" * 64, "http_status": 200,
             "eligible_for_publication": True, "probe_only": False, "rights_status": "accepted",
             "rights_review_url": "https://fixtures.example/synthetic-rights-review"}]


def matches(articles):
    return [{"project_id": "1000", "article_url": articles[0]["url"],
             "status": PROVISIONAL, "match_method": "exact_name"}]


def test_database_is_durable_idempotent_and_has_no_bodies(tmp_path, projects, articles, sources):
    db = tmp_path / "state.sqlite"
    with EvidenceStore(db) as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        store.record_run(projects, articles, matches(articles), NOW, sources)
        assert store.connection.execute("SELECT count(*) FROM projects").fetchone()[0] == 1000
        assert store.connection.execute("SELECT count(*) FROM articles").fetchone()[0] == 1
        assert store.connection.execute("SELECT count(*) FROM evidence").fetchone()[0] == 1000
        assert store.connection.execute("SELECT count(*) FROM evidence WHERE status=?", (NO_EVIDENCE,)).fetchone()[0] == 999
    assert b"This transient snippet" not in db.read_bytes()
    with EvidenceStore(db) as store:
        # Feed rotation must not erase a match discovered last week.
        store.record_run(projects, [], [], LATER, [{**sources[0], "fetched_at": LATER}])
        snapshot = validate_snapshot(store.snapshot(), [p["id"] for p in projects])
        assert snapshot["evidence_count"] == 1
        assert snapshot["projects"][0]["evidence"][0]["first_seen"] == NOW
        assert snapshot["projects"][0]["last_researched_at"] == LATER


def test_no_evidence_row_replaced_when_match_found(projects, articles, sources):
    with EvidenceStore() as store:
        store.record_run(projects, articles, [], NOW, sources)
        store.record_run(projects, articles, matches(articles), LATER, sources)
        rows = store.connection.execute("SELECT * FROM evidence WHERE project_id='1000'").fetchall()
        assert len(rows) == 1 and rows[0]["status"] == PROVISIONAL


@pytest.mark.parametrize("mutation", [
    lambda p, a, m, s: m[0].update(status="VERIFIED"),
    lambda p, a, m, s: m[0].update(project_id="999999"),
    lambda p, a, m, s: m[0].update(article_url="https://elsewhere.example/unfetched"),
    lambda p, a, m, s: m[0].update(match_method="fuzzy"),
    lambda p, a, m, s: s[0].update(status="failed"),
    lambda p, a, m, s: s[0].update(response_sha256=""),
    lambda p, a, m, s: s[0].update(eligible_for_publication=False),
    lambda p, a, m, s: s[0].update(probe_only=True),
    lambda p, a, m, s: s[0].update(rights_status="unknown"),
    lambda p, a, m, s: s[0].update(rights_review_url=None),
    lambda p, a, m, s: a[0].update(url="javascript:alert(1)"),
    lambda p, a, m, s: a[0].update(pub_date="not a date"),
    lambda p, a, m, s: p.pop(),
    lambda p, a, m, s: p[0].update(latitude=float("nan")),
])
def test_invalid_run_fails_without_mutating_store(projects, articles, sources, mutation):
    with EvidenceStore() as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        before = store.snapshot()
        match = matches(articles)
        mutation(projects, articles, match, sources)
        with pytest.raises(EvidenceValidationError):
            store.record_run(projects, articles, match, LATER, sources)
        assert store.snapshot() == before


def test_seed_metadata_cannot_drift(projects, articles, sources):
    with EvidenceStore() as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        projects[0]["name"] = "Changed identity"
        with pytest.raises(EvidenceValidationError, match="metadata changed"):
            store.record_run(projects, articles, matches(articles), LATER, sources)


def test_database_blocks_verified_and_unknown_schema(tmp_path, projects, articles, sources):
    with EvidenceStore() as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        with pytest.raises(sqlite3.IntegrityError):
            store.connection.execute("UPDATE evidence SET status='VERIFIED' WHERE project_id='1000'")
    path = tmp_path / "bad.sqlite"
    with sqlite3.connect(path) as db:
        db.execute("PRAGMA user_version=9")
    with pytest.raises(EvidenceValidationError, match="Unsupported"):
        EvidenceStore(path)


def test_immutable_exports_roundtrip_and_pointer(tmp_path, projects, articles, sources):
    with EvidenceStore() as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        ids = [p["id"] for p in projects]
        pointer = export_snapshot(store, tmp_path, expected_project_ids=ids)
        assert json.loads((tmp_path / "latest.json").read_text()) == pointer
        snapshot = json.loads((tmp_path / pointer["json"]).read_text())
        validate_snapshot(snapshot, ids)
        for filename, digest in pointer["sha256"].items():
            assert hashlib.sha256((tmp_path / pointer["snapshot"] / filename).read_bytes()).hexdigest() == digest
        with (tmp_path / pointer["csv"]).open(newline="") as handle:
            rows = list(csv.DictReader(handle))
        assert len(rows) == 1000 and rows[0]["provisional_count"] == "1"
        geojson = json.loads((tmp_path / pointer["geojson"]).read_text())
        assert len(geojson["features"]) == 1000
        assert geojson["features"][0]["geometry"]["coordinates"] == [-1.2, 52.1]
        assert geojson["features"][1]["geometry"] is None
        assert "content" not in snapshot["projects"][0]["evidence"][0]
        assert snapshot["projects"][0]["last_event"] is None
        # An identical invocation safely reproduces the same immutable artifact.
        assert export_snapshot(store, tmp_path, expected_project_ids=ids) == pointer
        previous = (tmp_path / "latest.json").read_bytes()
        articles[0]["title"] = "Changed article title"
        store.record_run(projects, articles, matches(articles), NOW, sources)
        with pytest.raises(EvidenceValidationError, match="Immutable"):
            export_snapshot(store, tmp_path, expected_project_ids=ids)
        assert (tmp_path / "latest.json").read_bytes() == previous


@pytest.mark.parametrize("mutation", [
    lambda x: x.update(schema="wrong"),
    lambda x: x.update(verified_count=1),
    lambda x: x.update(project_count=True),
    lambda x: x.update(evidence_count=2),
    lambda x: x["projects"][0].update(status="VERIFIED"),
    lambda x: x["projects"][0].update(project_id="9999"),
    lambda x: x["projects"][0].update(last_event="planning approved"),
    lambda x: x["projects"][0]["evidence"][0].update(content="body"),
    lambda x: x["sources"][0].update(status="failed"),
    lambda x: x["sources"][0].update(rights_status="unknown"),
    lambda x: x["sources"][0].update(probe_only=True),
])
def test_schema_failure_keeps_previous_pointer(tmp_path, projects, articles, sources, mutation, monkeypatch):
    with EvidenceStore() as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        ids = [p["id"] for p in projects]
        export_snapshot(store, tmp_path, expected_project_ids=ids)
        previous = (tmp_path / "latest.json").read_bytes()
        payload = copy.deepcopy(store.snapshot(LATER))
        mutation(payload)
        monkeypatch.setattr(store, "snapshot", lambda timestamp=None: payload)
        with pytest.raises(EvidenceValidationError):
            export_snapshot(store, tmp_path, LATER, expected_project_ids=ids)
        assert (tmp_path / "latest.json").read_bytes() == previous
        assert len(list(tmp_path.glob("snapshot_*"))) == 1


def test_csv_neutralizes_untrusted_formulas(tmp_path, projects, articles, sources):
    projects[0]["name"] = "=HYPERLINK(\"https://malicious.example\")"
    with EvidenceStore() as store:
        store.record_run(projects, articles, matches(articles), NOW, sources)
        pointer = export_snapshot(store, tmp_path, expected_project_ids=[p["id"] for p in projects])
        with (tmp_path / pointer["csv"]).open(newline="") as handle:
            rows = list(csv.DictReader(handle))
        assert rows[0]["name"].startswith("'=")


def test_no_successful_run_cannot_export(tmp_path, projects):
    with EvidenceStore() as store:
        with pytest.raises(EvidenceValidationError, match="No successful"):
            export_snapshot(store, tmp_path, expected_project_ids=[p["id"] for p in projects])
    assert not (tmp_path / "latest.json").exists()
