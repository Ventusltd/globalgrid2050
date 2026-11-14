"""Negative regression fixtures: calendar dates, replay, source failure and data-branch publication."""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import combine as C
import publication_gate as G

NOW = "2026-11-14T12:00:00Z"
CLOCK = dt.datetime(2026, 11, 14, 12, tzinfo=dt.timezone.utc)
ROWS = [{"rank": i + 1, "repd_ref": str(10000 + i), "site_name": "Solar %s" % i,
         "planning_authority": "Council", "planning_ref": "X-%s" % i, "country": "England"}
        for i in range(200)]


def article(date="2026-11-13", link="https://example.org/project-news"):
    return {"repd_ref": "10000", "title": "Solar project granted permission", "link": link,
            "publisher": "Regional News", "date": date, "family": "regional",
            "basis": "project name in title", "confidence": "confirmed"}


def part(items=None, status="ok", generated=NOW):
    return {"schema": C.PART_SCHEMA, "generated_at": generated, "items": items or [],
            "sources": [{"id": "regional", "status": status, "requests": 1,
                         "failures": 0 if status == "ok" else 1, "items": len(items or [])}]}


def built(parts=None, previous=None):
    return C.combine(ROWS, parts=parts or {}, previous=previous, now_iso=NOW, use_module=False)


def test_future_and_impossible_calendar_dates_are_rejected_not_sorted_first():
    for bad in ("2026-11-15", "2026-02-30", "2026-11-14nonsense", "2030-01-01T00:00:00Z"):
        signal, reason = C.clean_item(article(bad), "index", as_of=C.dt.date(2026, 11, 14))
        assert signal is None and reason == "invalid or future date"
    good, reason = C.clean_item(article("2026-11-14"), "index", as_of=C.dt.date(2026, 11, 14))
    assert reason == "" and good["date"] == "2026-11-14"


def test_replayed_article_expires_and_undated_carry_is_not_immortal():
    old = built({"index": part([article("2026-08-01"), article(None, "https://example.org/undated")])})
    replay = built({}, old)
    assert replay["projects"]["10000"]["signals"] == []
    assert replay["carried_from_previous"] == 0
    recent = built({"index": part([article("2026-11-01")])})
    kept = built({}, recent)
    assert kept["carried_from_previous"] == 1


def test_successful_new_confirmed_article_allows_publication():
    source = part([article()])
    combined = built({"index": source})
    report = G.evaluate(combined, None, {"index": source}, CLOCK)
    assert report["publish"] and report["new_confirmed_recent_items"] == 1
    assert report["healthy_current_parts"] == ["index"]


def test_failed_sources_replay_and_planning_searches_do_not_refresh_timestamp():
    source = part([article()])
    combined = built({"index": source})
    previous = combined
    assert not G.evaluate(combined, previous, {"index": source}, CLOCK)["publish"]
    assert not G.evaluate(combined, None, {"index": part([article()], status="failed")}, CLOCK)["publish"]
    assert not G.evaluate(combined, None, {"index": part([article()], generated="2026-11-12T12:00:00Z")}, CLOCK)["publish"]
    assert not G.evaluate(built(), None, {}, CLOCK)["publish"]


def test_old_news_and_future_part_do_not_authorise_new_publish():
    old_source = part([article("2026-10-01")])
    old = built({"index": old_source})
    assert not G.evaluate(old, None, {"index": old_source}, CLOCK)["publish"]
    source = part([article()], generated="2026-11-15T12:00:00Z")
    new = built({"index": source})
    assert not G.evaluate(new, None, {"index": source}, CLOCK)["publish"]


def test_gate_refuses_non_200_or_invalid_combined_contract():
    combined = built()
    combined["projects"].pop("10001")
    try:
        G.evaluate(combined, None, {}, CLOCK)
    except ValueError as exc:
        assert "200" in str(exc)
    else:
        raise AssertionError("invalid top-200 output accepted")
