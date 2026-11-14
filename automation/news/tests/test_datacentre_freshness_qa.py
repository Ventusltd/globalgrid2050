"""Independent fail-closed N4 freshness regression fixtures (no network)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import datacentre_feed as D  # noqa: E402

NOW = "2026-11-14T10:00:00Z"


def story(link, date=None, first_seen="2026-11-14T09:00:00Z", pinned=False):
    return {"title": link, "link": "https://example.org/" + link,
            "date": date, "first_seen": first_seen, "pinned": pinned,
            "lanes": ["capex"], "sites": [], "matched_terms": {"capex": ["build"]}}


def build(previous, incoming, feeds=None):
    return D.build({"items": previous}, incoming,
                   feeds if feeds is not None else [{"status": "ok"}], NOW)


def test_expired_published_story_cannot_reenter_from_previous_or_new_feed():
    old = story("old", date="2026-10-01T00:00:00Z")
    fresh = story("fresh", date="2026-11-13T00:00:00Z")
    out = build([old], [old, fresh])
    assert [x["title"] for x in out["items"]] == ["fresh"]
    assert out["counts"]["items"] == 1
    assert out["limits"]["news_max_age_days"] == 14


def test_undated_story_expires_by_original_first_seen_even_if_repeated():
    old = story("old-undated", first_seen="2026-11-01T00:00:00Z")
    duplicate = story("old-undated", first_seen=NOW)
    out = build([old], [duplicate])
    assert out["items"] == []


def test_invalid_future_and_timezone_naive_dates_fail_closed():
    rows = [
        story("future", date="2026-11-20T00:00:00Z"),
        story("malformed", date="not-a-date"),
        story("naive", date="2026-11-13T00:00:00"),
        story("undated-too-old", first_seen="2026-11-10T00:00:00Z"),
        story("recent", date="2026-11-14T08:00:00Z"),
    ]
    out = build([], rows)
    assert [x["title"] for x in out["items"]] == ["recent"]


def test_pinned_historical_item_retained_but_not_treated_as_new_feed():
    pinned = story("pinned", date="2020-01-01T00:00:00Z", pinned=True)
    out = build([], [pinned])
    assert len(out["items"]) == 1 and out["items"][0]["pinned"] is True


def test_all_feeds_failed_does_not_refresh_stale_history():
    stale = story("stale", date="2026-10-01T00:00:00Z")
    out = build([stale], [], [{"status": "failed"}])
    assert out["status"] == "failed"
    assert out["items"] == []
    assert out["counts"]["feeds_ok"] == 0


def test_filter_before_cap_keeps_fresh_record_behind_old_entries():
    old = [story("stale-" + str(i), date="2026-01-01T00:00:00Z") for i in range(10)]
    recent = story("recent", date="2026-11-13T00:00:00Z")
    out = D.build({"items": old}, [recent], [{"status": "ok"}], NOW, cap=1)
    assert [x["title"] for x in out["items"]] == ["recent"]
