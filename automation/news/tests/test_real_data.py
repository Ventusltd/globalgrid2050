"""Real-data smoke tests. Skipped when the inputs are not present in the checkout.

The official July 2026 cleaned CSV (REPD_Q2_2026_cleaned.csv, sha256 52e2c81c...) lives on branch
repd/2026-07-verified-archive-20261113; point NEWS_PREVIOUS_REPD at it to run the exact-reconciliation
tests. Without it the derived dist/project_identity_v6.json is used for structural checks only."""
from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

import pytest

from automation.news import events as E
from automation.news import relevance as R
from automation.news import binder as B
from automation.repd import diff as repd

REPO = Path(__file__).resolve().parents[3]
NEW = REPO / "repd-2026q3.csv"
DIFF = REPO / "docs/repd/2026q3/changes-jul-to-oct/diff.json"
LEGACY_FEED = REPO / "dist/major_project_news_v9_5_1.json"
LABELS = REPO / "automation/news/labels/binding_labels_v9_5_1.json"
FEED = REPO / "dist/news/repd_events_2026q3.json"
SCHEMA = REPO / "automation/news/schema/repd-events-feed.v1.schema.json"
OFFICIAL_PREV = os.environ.get("NEWS_PREVIOUS_REPD")
DERIVED_PREV = REPO / "dist/project_identity_v6.json"

need_new = pytest.mark.skipif(not NEW.exists(), reason="repd-2026q3.csv not in checkout")


def _prev():
    if OFFICIAL_PREV and Path(OFFICIAL_PREV).exists():
        return Path(OFFICIAL_PREV), True
    if DERIVED_PREV.exists():
        return DERIVED_PREV, False
    pytest.skip("no previous release available")


@need_new
def test_milestones_reconcile_with_published_change_report():
    prev, official = _prev()
    old, new = E.load_pair(prev, NEW)
    doc = E.build_events(old, new)
    assert doc["new"]["unique_refs"] == 14967
    if not (official and DIFF.exists()):
        assert doc["counts"]["CONSENTED"] > 0
        pytest.skip("official July CSV not supplied; structural check only")
    d = json.loads(DIFF.read_text())
    assert doc["previous"]["sha256"] == d["previous"]["sha256"]
    m = d["summary"]["milestones"]
    for key, etype in (("consented", "CONSENTED"), ("under_construction", "CONSTRUCTION_STARTED"),
                       ("operational", "OPERATIONAL"), ("refused", "REFUSED"), ("withdrawn", "WITHDRAWN")):
        evs = [e for e in doc["events"] if e["event_type"] == etype]
        assert len(evs) == m[key]["n"], etype
        assert round(sum(e["capacity_mw"] or 0 for e in evs), 2) == pytest.approx(m[key]["mw"]), etype
        assert sum(1 for e in evs if e["capacity_mw"] is None) == m[key]["n_unknown_mw"], etype
    assert doc["counts"]["REMOVED_FROM_REGISTER"] == d["summary"]["removed"]
    added = sum(1 for e in doc["events"] if e["basis"] == "new_record")
    assert added == d["summary"]["added"]
    assert doc["counts"]["CAPACITY_CHANGE"] == d["capacity_edits"]["n"] + d["capacity_edits"]["unknown_to_known"]["n"] \
        + d["capacity_edits"]["known_to_unknown"]["n"]


@need_new
def test_ranking_deterministic_and_profile_bounded():
    prev, _ = _prev()
    old, new = E.load_pair(prev, NEW)
    doc = E.build_events(old, new)
    ref = date.fromisoformat(new["info"]["max_record_last_updated"])
    a = R.rank_events(doc["events"], ref)
    b = R.rank_events(doc["events"], ref)
    assert [e["event_id"] for e in a] == [e["event_id"] for e in b]
    assert all(0 <= e["relevance"]["score"] <= e["relevance"]["max_possible"] for e in a)
    assert len(R.top_events(a, 50)) == 50


@need_new
@pytest.mark.skipif(not LABELS.exists(), reason="labelled set absent")
def test_binder_on_labelled_set_meets_floor():
    index = B.ProjectIndex(repd.load_csv(NEW))
    labels = json.loads(LABELS.read_text())["labels"]
    ev = B.evaluate(labels, index)
    assert ev["signal_metrics"]["precision"] >= 0.95
    assert ev["signal_metrics"]["recall"] >= 0.90
    assert ev["per_class"]["STRONG"]["false_positive"] == 0


@pytest.mark.skipif(not (FEED.exists() and SCHEMA.exists()), reason="committed feed absent")
def test_committed_feed_matches_schema_and_invariants():
    jsonschema = pytest.importorskip("jsonschema")
    feed = json.loads(FEED.read_text())
    schema = json.loads(SCHEMA.read_text())
    jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(feed)
    assert len(feed["top"]) == feed["top_n"] == 50
    assert feed["event_count"] == len(feed["events"]) == sum(feed["counts"].values())
    assert feed["profile_sha256"] == R.profile_sha256(feed["profile"])
    for ev in feed["events"]:
        assert round(sum(c["points"] for c in ev["relevance"]["components"]), 2) == ev["relevance"]["score"]
        if ev["capacity_mw"] is None:
            assert "capacity not stated" in ev["headline"] or ev["event_type"] in ("CAPACITY_CHANGE", "TECHNOLOGY_CHANGE")
    text = FEED.read_text()
    assert "/home/" not in text and "\\Users\\" not in text


@pytest.mark.skipif(not (FEED.exists() and OFFICIAL_PREV and LEGACY_FEED.exists()), reason="needs official July CSV")
def test_committed_feed_rebuilds_byte_identically(tmp_path):
    from automation.news import build_feed
    conv = REPO / "dist/convergence/2026q3"
    args = ["--previous", OFFICIAL_PREV, "--previous-label", "July 2026 (Q2)", "--new", str(NEW),
            "--new-label", "October 2026 (Q3)", "--release", "2026q3", "--previous-feed", str(LEGACY_FEED),
            "--out-dir", str(tmp_path)]
    if conv.is_dir():
        args += ["--convergence", str(conv)]
    build_feed.main(args)
    assert (tmp_path / "repd_events_2026q3.json").read_bytes() == FEED.read_bytes()


@pytest.mark.skipif(not FEED.exists(), reason="committed feed absent")
def test_panel_fields_shared_with_datacentre_panel():
    feed = json.loads(FEED.read_text())
    for ev in feed["top"]:
        assert ev["lane"] == "REPD_EVENTS" and ev["title"] == ev["headline"] and ev["score"] == ev["relevance"]["score"]
        assert ev["link"] is None and ev["ref"]
