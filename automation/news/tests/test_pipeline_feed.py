"""Tests for automation/news/pipeline_feed.py. Synthetic fixtures only; no network."""
from __future__ import annotations

import json
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG))

import datacentre_feed as D  # noqa: E402
import pipeline_feed as P  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "pipeline"
NOW = "2026-11-14T10:00:00Z"


def run(tmp_path, now=NOW, fixtures=FIXTURES):
    out = tmp_path / "pipeline_news.json"
    code = P.main(["--out", str(out), "--fixtures", str(fixtures), "--now", now])
    return code, json.loads(out.read_text())


def test_feeds_are_a_subset_of_the_feeds_the_scheduled_workflow_already_fetches():
    known = {f[0] for f in D.FEEDS}
    assert len(P.FEEDS) == len(P.FEED_URLS) == 4
    assert all(f[0] in known and f[0].startswith("https://") for f in P.FEEDS)


def test_keeps_in_scope_headlines_and_links_only(tmp_path):
    code, doc = run(tmp_path)
    assert code == 0 and doc["schema"] == P.SCHEMA
    titles = [i["title"] for i in doc["items"]]
    assert "FIXTURE: Solar farm approved on former airfield" in titles
    assert "FIXTURE: Connections queue reform for wind farms" in titles
    assert "FIXTURE: Developer plans new site" in titles           # in scope through the feed summary
    assert "FIXTURE: Retailer reports quarterly sales" not in titles
    assert "FIXTURE: Ministerial visit" not in titles
    for item in doc["items"]:
        assert set(item) == {"title", "link", "source", "date", "first_seen", "topics"}
        assert item["link"].startswith("https://")
    assert "summary" not in json.dumps(doc).lower().replace("feed summary", "")
    assert "never be stored" not in json.dumps(doc)


def test_sponsored_entries_are_dropped(tmp_path):
    _, doc = run(tmp_path)
    assert not any("ponsored" in i["title"] for i in doc["items"])
    assert not any("sponsored-wind" in i["link"] for i in doc["items"])


def test_tracking_parameters_and_fragments_are_removed(tmp_path):
    _, doc = run(tmp_path)
    assert "https://example.org/news/solar-farm" in [i["link"] for i in doc["items"]]


def test_newest_first_and_undated_last(tmp_path):
    _, doc = run(tmp_path)
    dates = [i["date"] for i in doc["items"]]
    dated = [d for d in dates if d]
    assert dated == sorted(dated, reverse=True)
    assert dates[-1] is None and doc["items"][-1]["title"] == "FIXTURE: Undated note on pylons"


def test_a_failed_feed_is_recorded_and_the_run_continues(tmp_path):
    code, doc = run(tmp_path)
    assert code == 0 and doc["status"] == "partial"
    assert doc["counts"]["feeds_ok"] == 2 and doc["counts"]["feeds_failed"] == 2
    assert all("error" in f for f in doc["feeds"] if f["status"] == "failed")


def test_two_runs_give_the_same_bytes_and_keep_first_seen(tmp_path):
    run(tmp_path)
    first = (tmp_path / "pipeline_news.json").read_bytes()
    _, doc = run(tmp_path, now="2026-11-15T10:00:00Z")
    assert all(i["first_seen"] == NOW for i in doc["items"])
    assert len(doc["items"]) == len(json.loads(first)["items"])
    run(tmp_path, now="2026-11-15T10:00:00Z")
    assert (tmp_path / "pipeline_news.json").read_bytes() == json.dumps(doc, ensure_ascii=False, indent=1).encode() + b"\n"


def test_every_feed_failing_keeps_the_earlier_file_and_its_date(tmp_path):
    run(tmp_path)
    empty = tmp_path / "empty"
    empty.mkdir()
    code, doc = run(tmp_path, now="2026-11-16T10:00:00Z", fixtures=empty)
    assert code == 0 and doc["status"] == "failed"
    assert doc["generated_at"] == NOW and doc["last_attempt_at"] == "2026-11-16T10:00:00Z"
    assert len(doc["items"]) == 4


def test_every_feed_failing_with_no_earlier_file_fails_the_run(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    code, doc = run(tmp_path, fixtures=empty)
    assert code == 1 and doc["status"] == "failed" and doc["items"] == []


def test_cap(tmp_path):
    out = tmp_path / "pipeline_news.json"
    P.main(["--out", str(out), "--fixtures", str(FIXTURES), "--now", NOW, "--max-items", "2"])
    assert len(json.loads(out.read_text())["items"]) == 2
