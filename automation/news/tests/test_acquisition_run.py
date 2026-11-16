"""End-to-end candidate builds use explicit synthetic feed/rights fixtures only."""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3
import sys

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from automation.news.acquisition import run
from automation.news.acquisition.evidence_store import EvidenceValidationError, validate_snapshot
from automation.news.acquisition.fetch import FetchError, parse_feed
from automation.news.acquisition.research_queue import load_seed_projects

NOW = "2026-11-16T16:00:00Z"
SOURCE = {
    "id": "pv_magazine_global", "publisher": "PV Magazine", "kind": "rss",
    "url": "https://www.pv-magazine.com/feed/", "technology": ["solar"],
    "interval_hours": 168, "enabled": True, "output_policy": "headline_link_only",
    "rights_status": "accepted", "rights_review_url": "https://fixtures.example/synthetic-rights-review",
}
RSS = b'''<rss><channel><item>
<title>Synthetic fixture: REPD Ref 1018 solar project</title>
<link>https://www.pv-magazine.com/synthetic-test-fixture/</link>
<pubDate>Sun, 15 Nov 2026 12:00:00 GMT</pubDate>
<description>Transient fixture content must not persist.</description>
</item></channel></rss>'''


class FrozenClock:
    @staticmethod
    def now(tz):
        return datetime(2026, 11, 16, 16, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def setup(tmp_path, monkeypatch):
    # Exercise the real, byte-pinned V9.24 input loader, not a reselected list.
    projects = load_seed_projects()
    monkeypatch.setattr(run, "datetime", FrozenClock)
    config = tmp_path / "synthetic-sources.yaml"
    config.write_text(yaml.safe_dump([SOURCE]), encoding="utf-8")
    return {"out": tmp_path / "evidence", "config": config, "ids": [p["id"] for p in projects]}


def fixture_fetcher(source, *, probe=False):
    return {"articles": parse_feed(RSS, source), "source": {
        "id": source["id"], "publisher": source["publisher"], "url": source["url"],
        "status": "ok", "fetched_at": NOW, "http_status": 200,
        "response_sha256": hashlib.sha256(RSS).hexdigest(),
        "probe_only": probe, "eligible_for_publication": not probe,
        "rights_status": source["rights_status"], "rights_review_url": source["rights_review_url"],
    }}


def build(setup, **kwargs):
    return run.collect(setup["out"], sources_path=setup["config"], fetcher=fixture_fetcher, **kwargs)


def state_bytes(out):
    return {str(path.relative_to(out)): path.read_bytes() for path in out.rglob("*") if path.is_file()}


def test_real_seed_synthetic_feed_through_sqlite_and_all_exports(setup):
    result = build(setup)
    assert result["selected"] == 1000 and result["provisional_matches"] == 1
    assert result["verified"] == 0 and result["probe_only"] is False
    out, pointer = setup["out"], result["pointer"]
    assert json.loads((out / "latest.json").read_text()) == pointer
    payload = json.loads((out / pointer["json"]).read_text())
    validate_snapshot(payload, setup["ids"])
    row = next(row for row in payload["projects"] if row["project_id"] == "1018")
    assert row["evidence_count"] == 1 and row["evidence"][0]["status"] == "PROVISIONAL"
    assert row["evidence"][0]["match_method"] == "repd_id"
    assert (out / pointer["csv"]).is_file() and (out / pointer["geojson"]).is_file()
    with sqlite3.connect(out / "evidence.sqlite") as db:
        assert db.execute("SELECT count(*) FROM projects").fetchone()[0] == 1000
        assert db.execute("SELECT count(*) FROM evidence").fetchone()[0] == 1000
        assert db.execute("SELECT count(*) FROM evidence WHERE status='PROVISIONAL'").fetchone()[0] == 1
    assert all(b"Transient fixture content" not in content for content in state_bytes(out).values())
    previous = state_bytes(out)
    assert build(setup)["pointer"] == pointer
    # SQLite may change its page layout on an idempotent rerun; public exports
    # and logical row counts are the invariant, not database file bytes.
    after = state_bytes(out)
    previous.pop("evidence.sqlite")
    after.pop("evidence.sqlite")
    assert after == previous
    with sqlite3.connect(out / "evidence.sqlite") as db:
        assert db.execute("SELECT count(*) FROM evidence").fetchone()[0] == 1000


def test_probe_returns_health_without_creating_or_changing_state(setup):
    result = build(setup, probe=True)
    assert result["probe_only"] is True and "pointer" not in result
    assert not setup["out"].exists()
    build(setup)
    previous = state_bytes(setup["out"])
    build(setup, probe=True)
    assert state_bytes(setup["out"]) == previous


def test_critical_fetch_failure_keeps_previous_state(setup):
    build(setup)
    previous = state_bytes(setup["out"])

    def failing_fetcher(*args, **kwargs):
        raise FetchError("Critical source HTTP 503")

    with pytest.raises(FetchError):
        run.collect(setup["out"], sources_path=setup["config"], fetcher=failing_fetcher)
    assert state_bytes(setup["out"]) == previous


@pytest.mark.parametrize("mutation", [
    lambda result: result["source"].update(status="failed"),
    lambda result: result["source"].update(rights_status="unknown"),
    lambda result: result["source"].update(probe_only=True),
    lambda result: result["articles"][0].update(pub_date="invalid"),
])
def test_schema_or_rights_failure_keeps_database_and_latest(setup, mutation):
    build(setup)
    previous = state_bytes(setup["out"])

    def invalid_fetcher(source, **kwargs):
        result = fixture_fetcher(source, **kwargs)
        mutation(result)
        return result

    with pytest.raises(EvidenceValidationError):
        run.collect(setup["out"], sources_path=setup["config"], fetcher=invalid_fetcher)
    assert state_bytes(setup["out"]) == previous


def test_export_validation_failure_does_not_commit_staged_database(setup, monkeypatch):
    build(setup)
    previous = state_bytes(setup["out"])

    def fail_export(*args, **kwargs):
        raise EvidenceValidationError("Injected malformed export")

    monkeypatch.setattr(run, "export_snapshot", fail_export)
    with pytest.raises(EvidenceValidationError):
        build(setup)
    assert state_bytes(setup["out"]) == previous


def test_changed_article_keeps_previous_database_and_pointer(setup):
    build(setup)
    previous = state_bytes(setup["out"])

    def changed_fetcher(source, **kwargs):
        result = fixture_fetcher(source, **kwargs)
        result["articles"][0]["title"] += " revised"
        return result

    with pytest.raises(EvidenceValidationError, match="Stored article metadata changed"):
        run.collect(setup["out"], sources_path=setup["config"], fetcher=changed_fetcher)
    assert state_bytes(setup["out"]) == previous


@pytest.mark.parametrize("mutation", [
    lambda sources: sources.append(copy.deepcopy(sources[0])),
    lambda sources: sources[0].update(url="http://127.0.0.1/feed"),
    lambda sources: sources[0].update(rights_status="unknown"),
])
def test_invalid_source_config_fails_before_fetch_or_output(setup, mutation):
    sources = [copy.deepcopy(SOURCE)]
    mutation(sources)
    setup["config"].write_text(yaml.safe_dump(sources), encoding="utf-8")

    def unexpected_fetch(*args, **kwargs):
        pytest.fail("Invalid source must never be fetched")

    with pytest.raises(ValueError):
        run.collect(setup["out"], sources_path=setup["config"], fetcher=unexpected_fetch)
    assert not setup["out"].exists()


def test_disabled_unknown_rights_source_only_allows_probe(setup):
    disabled = {**SOURCE, "enabled": False, "rights_status": "unknown", "rights_review_url": None}
    setup["config"].write_text(yaml.safe_dump([disabled]), encoding="utf-8")
    with pytest.raises(FetchError, match="No enabled source"):
        build(setup)
    assert not setup["out"].exists()
    assert build(setup, probe=True)["probe_only"] is True
    assert not setup["out"].exists()


def test_cli_failure_report_is_redacted_and_requires_manual_review(tmp_path, monkeypatch, capsys):
    report = tmp_path / "report.json"

    def fail_collect(*args, **kwargs):
        raise ValueError("secret-example-token and machine-specific-path")

    monkeypatch.setattr(run, "collect", fail_collect)
    monkeypatch.setattr(sys, "argv", ["run", "--report", str(report), "--out", str(tmp_path / "out")])
    assert run.main() == 1
    payload = json.loads(report.read_text())
    assert payload == {"result": "blocked", "error_type": "ValueError", "manual_review_required": True,
                       "probe_only": False}
    assert "secret-example-token" not in report.read_text() + capsys.readouterr().out
    assert not (tmp_path / "out").exists()
