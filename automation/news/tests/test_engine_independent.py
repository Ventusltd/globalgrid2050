"""Independent Agent 3 V9.28 News Engine acceptance: synthetic fixtures only.

Run against the exact PR #130 source on an isolated branch. No network, real
publisher extraction, rights acceptance, source activation or public output.
"""
from __future__ import annotations

import copy
import json

import pytest

from automation.news.engine import build_intelligence, canonical_url


SOURCE = {
    "id": "fixture_press",
    "publisher": "Fixture Press",
    "kind": "reporting",
    "rights_status": "unknown",
    "enabled": False,
    "output_policy": "headline_link_only",
}
ARTICLE = {
    "url": "https://press.example.org/news/solar?utm_campaign=test",
    "title": "East Meadow Solar Farm moves to planning",
    "source_id": "fixture_press",
    "source": "Fixture Press",
    "publisher": "Fixture Press",
    "pub_date": "2026-11-16T08:00:00Z",
    "first_seen": "2026-11-16T09:00:00Z",
    "fetched_at": "2026-11-16T09:05:00Z",
    "source_receipt_sha256": "a" * 64,
    "content": "REPD 2002 invented body text must not become a match",
    "importance_score": 1.0,
    "ranking_score": 99999,
    "score": 12,
    "priority": 1,
    "rank": 1,
}
PROJECTS = [
    {"id": "1018", "name": "East Meadow Solar Farm", "technology": "solar"},
    {"id": "2002", "name": "A Different Solar Farm", "technology": "solar"},
]


def run(items=None, sources=None, projects=None):
    return build_intelligence(
        [copy.deepcopy(ARTICLE)] if items is None else items,
        [copy.deepcopy(SOURCE)] if sources is None else sources,
        copy.deepcopy(PROJECTS) if projects is None else projects,
    )


def test_independent_title_only_without_content_or_scores():
    out = run()
    assert out["counts"] == {
        "articles": 1, "provisional_project_edges": 1,
        "verified_project_edges": 0, "rights_unresolved_articles": 1,
    }
    row = out["articles"][0]
    assert [e["id"] for e in row["project_candidates"]] == ["1018"]
    assert row["project_candidates"][0]["status"] == "PROVISIONAL"
    assert row["publisher_independence"] == "UNASSESSED"
    assert row["publication_eligibility"] == "WITHHELD_INDEPENDENT_REVIEW_REQUIRED"
    serialised = json.dumps(out)
    assert "invented body text" not in serialised
    for forbidden in ("importance_score", "ranking_score", '"score"', '"priority"', '"rank"'):
        assert forbidden not in serialised


def test_independent_general_market_news_has_no_project_evidence():
    market = {**ARTICLE, "title": "UK solar industry investment rises"}
    out = run(items=[market])
    assert out["articles"][0]["project_candidates"] == []
    assert out["counts"]["provisional_project_edges"] == 0
    assert out["counts"]["verified_project_edges"] == 0


def test_independent_duplicate_title_two_unrelated_urls_are_not_merged():
    first = copy.deepcopy(ARTICLE)
    second = {**ARTICLE, "url": "https://other.example.org/news/solar"}
    out = run(items=[first, second])
    assert out["counts"]["articles"] == 2
    assert out["counts"]["verified_project_edges"] == 0


def test_independent_tracking_variants_preserve_original_urls_deterministically():
    a = copy.deepcopy(ARTICLE)
    b = {**ARTICLE, "url": "https://press.example.org/news/solar?utm_medium=email"}
    forward = run(items=[a, b])
    reverse = run(items=[b, a])
    assert forward == reverse
    assert forward["counts"]["articles"] == 1
    assert forward["articles"][0]["observed_article_urls"] == sorted([a["url"], b["url"]])


def test_independent_same_url_with_different_publisher_fails_closed():
    other_source = {**SOURCE, "id": "other", "publisher": "Other Outlet"}
    mismatched = {**ARTICLE, "source_id": "other", "publisher": "Other Outlet", "source": "Other Outlet"}
    with pytest.raises(ValueError, match="collision"):
        run(items=[ARTICLE, mismatched], sources=[SOURCE, other_source])


def test_independent_ambiguous_repd_name_never_proves_identity():
    projects = PROJECTS + [{"id": "3000", "name": "East Meadow Solar Farm"}]
    out = run(projects=projects)
    assert out["counts"]["provisional_project_edges"] == 0
    assert out["counts"]["verified_project_edges"] == 0


def test_independent_non_repd_id_cannot_be_repd_identity():
    out = run(projects=[{"id": "dc-001", "name": "East Meadow Solar Farm", "namespace": "datacentre"}])
    assert out["counts"]["provisional_project_edges"] == 0


def test_independent_explicit_multiple_repd_ids_are_ambiguous_not_verified():
    item = {**ARTICLE, "title": "REPD 1018 and REPD 2002 planning update"}
    out = run(items=[item])
    assert out["counts"]["provisional_project_edges"] == 2
    assert out["counts"]["verified_project_edges"] == 0
    assert all(e.get("ambiguous_multi_project") for e in out["articles"][0]["project_candidates"])


@pytest.mark.parametrize("value", [
    "http://press.example.org/news", "https://localhost/local", "https://127.0.0.1/news",
    "https://user@press.example.org/news", "https://press.example.org:8080/news",
])
def test_independent_reject_unsafe_urls(value):
    with pytest.raises(ValueError):
        canonical_url(value)


def test_independent_source_id_cannot_override_contradictory_source_publisher():
    """REGRESSION: valid source_id must not conceal another publisher in source."""
    bad = {**ARTICLE, "source": "Other Outlet"}
    with pytest.raises(ValueError, match="attribution"):
        run(items=[bad])


def test_independent_source_label_cannot_contradict_without_publisher_key():
    bad = {**ARTICLE, "source": "Other Outlet"}
    del bad["publisher"]
    with pytest.raises(ValueError, match="attribution"):
        run(items=[bad])


@pytest.mark.parametrize("bad", ["not-a-date", "2026-02-30", "2026-13-17", "2026-11-16T35:00:00Z"])
def test_independent_invalid_publisher_dates_fail_closed(bad):
    """Bad dates must not masquerade as accepted publication times."""
    with pytest.raises(ValueError, match="timestamp"):
        run(items=[{**ARTICLE, "pub_date": bad}])


def test_independent_missing_dates_remain_null():
    item = copy.deepcopy(ARTICLE)
    for key in ("pub_date", "first_seen", "fetched_at"):
        item.pop(key)
    row = run(items=[item])["articles"][0]
    assert row["published_at"] is None
    assert row["first_seen"] is None
    assert row["fetched_at"] is None


@pytest.mark.parametrize("bad", ["abc", "A" * 64, 12, None])
def test_independent_bad_hashes_fail_closed(bad):
    item = {**ARTICLE, "source_receipt_sha256": bad}
    if bad is None:
        # An absent receipt is allowed as unknown, so test explicit null separately.
        assert run(items=[item])["articles"][0]["source_receipt_sha256"] is None
    else:
        with pytest.raises(ValueError, match="receipt"):
            run(items=[item])


def test_independent_rights_assertion_does_not_authorise_publication():
    source = {**SOURCE, "rights_status": "accepted", "enabled": True,
              "rights_review_url": "https://publisher.example.org/rights"}
    row = run(sources=[source])["articles"][0]
    assert row["publication_eligibility"].startswith("WITHHELD")
    assert row["usage_rights"]["status"] == "accepted"
    assert row["verification_status"] == "NOT_VERIFIED"


def test_independent_publisher_body_cannot_create_repd_id():
    item = {**ARTICLE, "title": "Industry capacity outlook in Britain",
            "content": "REPD reference 1018 and named East Meadow Solar Farm"}
    assert run(items=[item])["counts"]["provisional_project_edges"] == 0
