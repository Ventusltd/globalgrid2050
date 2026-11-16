"""Contract/negative tests for headline ordering, independent of live sources."""
import copy
import json

import pytest

from automation.news import news_algorithm as N

NOW = "2026-11-16T13:06:13Z"


def article(link="https://news.example/1", title="UK solar farm granted planning consent", **extra):
    return {"title": title, "link": link, "source": "A credited publisher", "date": "2026-11-15T12:00:00Z",
            "first_seen": "2026-11-16T12:00:00Z", "category": "consent", "technology": "solar",
            "possible_match": None, **extra}


def rank(items, **kwargs):
    return N.rank_headlines(items, as_of=NOW, **kwargs)["items"]


def test_official_relevant_news_precedes_paid_discovery_without_deleting_credit():
    discovery = article("https://www.bloomberg.com/news/1", source="Bloomberg", date="2026-11-16T12:50:00Z")
    official = article("https://www.gov.uk/government/news/1", source="GOV.UK", date="2026-11-14T12:00:00Z")
    items = rank([discovery, official])
    assert [item["source"] for item in items] == ["GOV.UK", "Bloomberg"]
    assert items[1]["link"] == discovery["link"]
    assert items[1]["editorial"]["role"] == "discovery_lead"
    assert "subscription" in items[1]["editorial"]["source"]["access_notice"]
    assert all(item["editorial"]["verification_status"] == "NOT_VERIFIED" for item in items)


def test_display_diversity_is_soft_and_does_not_drop_valuable_articles():
    repeated = [article(f"https://news.example/{i}") for i in range(15)]
    alternative = article("https://other.example/1", date="2026-11-10T12:00:00Z")
    items = rank(repeated + [alternative])
    assert len(items) == 16 and items[1]["link"] == alternative["link"]
    assert items[2]["editorial"]["publisher_repetition_penalty"] == 8
    uncapped = rank(repeated + [alternative], diversity_penalty=0)
    assert uncapped[-1]["link"] == alternative["link"]


def test_generic_ai_finance_is_context_even_if_legacy_category_says_datacentre():
    stock = article("https://wire.example/1", "AI stocks rally before a busy earnings week", category="datacentre", date=NOW)
    dc = article("https://agency.example/1", "Data centre construction begins in Indiana", technology=None)
    items = rank([stock, dc])
    assert items[0]["link"] == dc["link"]
    assert items[1]["editorial"]["topics"] == []
    assert items[1]["editorial"]["context_bucket"] == 1


def test_uk_context_does_not_claim_project_location_or_use_multinational_name():
    uk = rank([article(title="UK solar project approved")])[0]
    overseas = rank([article(title="National Grid solar project approved in New South Wales")])[0]
    assert uk["editorial"]["components"]["uk_headline_context"] == 5
    assert overseas["editorial"]["components"]["uk_headline_context"] == 0
    assert "country" not in overseas and overseas["editorial"]["project_fact_status"] == "NOT_ASSESSED"


def test_source_policy_is_not_inferred_from_publisher_label():
    fake = article("https://other.example/1", source="GOV.UK")
    assert rank([fake])[0]["editorial"]["source"]["kind"] == "reporting"
    policy = {"source_id": "funding-agency", "hosts": ["other.example"], "kind": "institution",
              "review_url": "https://review.example/source/1", "publisher_group": "funding-agency"}
    row = rank([fake], source_policies=[policy])[0]
    assert row["editorial"]["source"]["kind"] == "institution"
    assert row["editorial"]["source"]["rights_approval"] == "not_assessed_by_ranking"


def test_listed_parent_needs_explicit_identity_and_listing_evidence():
    policy = {"source_id": "issuer", "hosts": ["news.example"], "kind": "listed_parent",
              "review_url": "https://review.example/source/1"}
    with pytest.raises(ValueError, match="listed-parent"):
        rank([article()], source_policies=[policy])
    policy.update(listed_parent_id="issuer:EXAMPLE", listing_evidence_url="https://exchange.example/issuer/EXAMPLE")
    assert rank([article()], source_policies=[policy])[0]["editorial"]["source"]["kind"] == "listed_parent"


def test_reviewed_original_reporting_credit_is_not_inferred_from_brand():
    row = article("https://www.reuters.com/energy/original", source="Reuters")
    assert rank([row])[0]["editorial"]["components"]["reviewed_original_reporting"] == 0
    receipt = {"article_url": row["link"], "kind": "original_reporting", "reviewed": True,
               "basis": "Reviewer inspected attributable original reporting; test fixture.",
               "review_url": "https://review.example/originality/1"}
    ranked = rank([row], originality=[receipt])[0]
    assert ranked["editorial"]["components"]["reviewed_original_reporting"] == 6
    assert ranked["source"] == "Reuters" and ranked["editorial"]["verification_status"] == "NOT_VERIFIED"
    with pytest.raises(ValueError, match="reviewed receipt"):
        rank([row], originality=[dict(receipt, reviewed=False)])


@pytest.mark.parametrize("date,state,precision", [
    (None, "unknown", "unknown"), ("2026-11-15", "current", "day"),
    ("2026-11-15T12:00:00", "unknown", "unknown"),
    ("2026-11-17T12:00:00Z", "future", "second"), ("2025-11-15", "stale", "day"),
])
def test_publication_precision_and_freshness_never_use_first_seen(date, state, precision):
    item = rank([article(date=date, first_seen=NOW)])[0]
    f = item["editorial"]["freshness"]
    assert f["state"] == state and f["precision"] == precision
    if state in ("unknown", "future"):
        assert f["points"] == 0
    assert item["date"] == date


def test_future_or_stale_government_article_does_not_lead_current_project_story():
    fresh = article("https://news.example/current")
    for date in ("2027-01-01", "2024-01-01"):
        gov = article("https://www.gov.uk/news/old", date=date)
        assert rank([gov, fresh])[0]["link"] == fresh["link"]


def test_exclusion_and_document_genre_do_not_become_project_priority():
    rows = [article("https://news.example/e", "Solar eclipse viewing plans announced"),
            article("https://news.example/whitepapers/report", "Global data centre market investment report"),
            article("https://news.example/real", "UK grid reinforcement approved")]
    ranked = rank(rows)
    assert ranked[0]["link"] == rows[-1]["link"]
    assert all(row["editorial"]["context_bucket"] == 1 for row in ranked[1:])


def test_exact_output_is_permutation_stable_and_does_not_mutate_or_republish_body():
    rows = [article("https://news.example/2"), article("https://other.example/1", body="must not survive")]
    before = copy.deepcopy(rows)
    left = N.rank_headlines(rows, as_of=NOW)
    right = N.rank_headlines(list(reversed(rows)), as_of=NOW)
    assert json.dumps(left, sort_keys=True) == json.dumps(right, sort_keys=True)
    assert rows == before and all("body" not in row for row in left["items"])


@pytest.mark.parametrize("url", [
    "javascript:alert(1)", "https://user:pass@news.example/x", "https://news.example:444/x",
    "https://127.1/x", "https://2130706433/x", "https://0x7f000001/x", "https://224.0.0.1/x",
    "https://[::1]/x", "https://example.local/x", "https://example.internal/x", "https://localhost/x",
    "https://news.example\\@evil.example/x", "https://news.example/\nfoo",
])
def test_malformed_or_nonpublic_url_is_rejected(url):
    with pytest.raises(ValueError, match="URL"):
        rank([article(url)])


def test_tracking_canonicalization_detects_duplicate_article_input():
    with pytest.raises(ValueError, match="duplicate canonical URL"):
        rank([article("https://news.example/1?utm_source=a"), article("https://news.example/1?utm_source=b")])


def test_explicit_clock_required_and_policy_conflicts_fail_closed():
    with pytest.raises(ValueError, match="timezone"):
        N.rank_headlines([article()], as_of="2026-11-16")
    policy = {"source_id": "one", "hosts": ["news.example"], "kind": "reporting", "review_url": "https://review.example/1"}
    with pytest.raises(ValueError, match="duplicate source policy"):
        rank([article()], source_policies=[policy, policy])
    with pytest.raises(ValueError, match="diversity"):
        rank([article()], diversity_penalty=True)
