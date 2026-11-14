"""Negative regression fixtures: calendar dates, replay, source failure and data-branch publication."""
from __future__ import annotations

import datetime as dt
import copy
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


def article(date="2026-11-13", link="https://www.solarpowerportal.co.uk/solar-projects/project-news"):
    return {"repd_ref": "10000", "title": "Solar project granted permission", "link": link,
            "publisher": "Solar Power Portal", "date": date, "family": "trade",
            "basis": "project name in title", "confidence": "confirmed"}


def part(items=None, status="ok", generated=NOW):
    return {"schema": C.PART_SCHEMA, "generated_at": generated, "items": items or [],
            "sources": [{"id": "solar-power-portal", "url": "https://www.solarpowerportal.co.uk",
                         "status": status, "requests": 1,
                         "failures": 0 if status == "ok" else 1, "items": len(items or [])}]}


def built(parts=None, previous=None):
    return C.combine(ROWS, parts=parts or {}, previous=previous, now_iso=NOW, use_module=False)


def evaluate(combined, previous, parts, now=CLOCK):
    # Synthetic IDs are explicitly allowed ONLY in offline fixture invocation;
    # publication_gate.py's CLI always loads the authoritative top200_solar.json.
    return G.evaluate(combined, previous, parts, now,
                      authoritative_refs={r["repd_ref"] for r in ROWS})


def test_future_and_impossible_calendar_dates_are_rejected_not_sorted_first():
    for bad in ("2026-11-15", "2026-02-30", "2026-11-14nonsense", "2030-01-01T00:00:00Z"):
        signal, reason = C.clean_item(article(bad), "index", as_of=C.dt.date(2026, 11, 14))
        assert signal is None and reason == "invalid or future date"
    good, reason = C.clean_item(article("2026-11-14"), "index", as_of=C.dt.date(2026, 11, 14))
    assert reason == "" and good["date"] == "2026-11-14"


def test_replayed_article_expires_and_undated_carry_is_not_immortal():
    old = built({"trade": part([article("2026-08-01"), article(None, "https://example.org/undated")])})
    replay = built({}, old)
    assert replay["projects"]["10000"]["signals"] == []
    assert replay["carried_from_previous"] == 0
    recent = built({"trade": part([article("2026-11-01")])})
    kept = built({}, recent)
    assert kept["carried_from_previous"] == 1


def test_successful_new_confirmed_article_allows_publication():
    source = part([article()])
    combined = built({"trade": source})
    report = evaluate(combined, None, {"trade": source}, CLOCK)
    assert report["publish"] and report["new_confirmed_recent_items"] == 1
    assert report["healthy_current_parts"] == ["index"]


def test_failed_sources_replay_and_planning_searches_do_not_refresh_timestamp():
    source = part([article()])
    combined = built({"trade": source})
    previous = combined
    assert not evaluate(combined, previous, {"trade": source}, CLOCK)["publish"]
    assert not evaluate(combined, None, {"trade": part([article()], status="failed")}, CLOCK)["publish"]
    assert not evaluate(combined, None, {"trade": part([article()], generated="2026-11-12T12:00:00Z")}, CLOCK)["publish"]
    assert not evaluate(built(), None, {}, CLOCK)["publish"]


def test_old_news_and_future_part_do_not_authorise_new_publish():
    old_source = part([article("2026-10-01")])
    old = built({"trade": old_source})
    assert not evaluate(old, None, {"trade": old_source}, CLOCK)["publish"]
    source = part([article()], generated="2026-11-15T12:00:00Z")
    new = built({"trade": source})
    assert not evaluate(new, None, {"trade": source}, CLOCK)["publish"]


def test_gate_refuses_non_200_or_invalid_combined_contract():
    combined = built()
    combined["projects"].pop("10001")
    try:
        evaluate(combined, None, {}, CLOCK)
    except ValueError as exc:
        assert "200" in str(exc)
    else:
        raise AssertionError("invalid top-200 output accepted")

def test_200_arbitrary_ids_with_same_count_cannot_authorise_a_fabricated_ref():
    combined = built({"trade": part([article()])})
    forged = copy.deepcopy(combined)
    forged["projects"]["999999"] = forged["projects"].pop("10001")
    assert len(forged["projects"]) == 200
    try:
        evaluate(forged, None, {"trade": part([article()])})
    except ValueError as exc:
        assert "authoritative" in str(exc)
    else:
        raise AssertionError("forged 200-identity set passed")


def test_failed_publisher_cannot_borrow_success_of_another_publisher():
    malicious = article(link="https://renews.biz/solar/imaginary-project")
    fake_source = part([malicious])
    # SPP succeeded; reNEWS failed. A generic team-level health check
    # incorrectly marks all of this part's items as source-backed.
    fake_source["sources"].append({
        "id": "renews", "url": "https://renews.biz", "status": "failed",
        "requests": 1, "failures": 1, "items": 1
    })
    combined = built({"trade": fake_source})
    result = evaluate(combined, None, {"trade": fake_source})
    assert result["publish"] is False and result["new_confirmed_recent_items"] == 0


def test_spoofed_source_host_is_not_evidence():
    fake_source = part([article()])
    fake_source["sources"][0]["url"] = "https://bad.example"
    combined = built({"trade": fake_source})
    assert not evaluate(combined, None, {"trade": fake_source})["publish"]


def test_index_gdelt_article_is_not_laundered_by_healthy_bbc_feed():
    gdelt_link = "https://www.thisisoxfordshire.co.uk/news/1234567/solar-story"
    raw = article(link=gdelt_link)
    raw.update(family="regional", publisher="Oxford News")
    candidate = part([raw])
    candidate["sources"] = [
        {"id": "bbc-rss", "url": "https://feeds.bbci.co.uk/news/", "status": "ok",
         "requests": 1, "failures": 0, "items": 1},
        {"id": "gdelt-doc", "url": "https://api.gdeltproject.org/api/v2/doc/doc",
         "status": "failed", "requests": 1, "failures": 1, "items": 1}
    ]
    combined = built({"index": candidate})
    assert not evaluate(combined, None, {"index": candidate})["publish"]


def test_matching_article_and_source_domain_is_publish_eligible():
    candidate = part([article()])
    combined = built({"trade": candidate})
    result = evaluate(combined, None, {"trade": candidate})
    assert result["publish"] and result["new_confirmed_recent_items"] == 1
