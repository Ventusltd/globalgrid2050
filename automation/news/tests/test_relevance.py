import json
from datetime import date

import pytest

from automation.news import events as E
from automation.news import relevance as R

REF = date(2026, 10, 23)


def _ranked(releases, dc=None, previous=None):
    old, new = E.load_pair(*releases)
    doc = E.build_events(old, new)
    return R.rank_events(doc["events"], REF, dc, previous)


def _comp(ev, name):
    return next(c for c in ev["relevance"]["components"] if c["name"] == name)


def test_components_visible_and_sum(releases):
    for ev in _ranked(releases):
        comps = ev["relevance"]["components"]
        assert [c["name"] for c in comps] == ["capacity", "stage", "technology", "recency", "national_route",
                                             "datacentre_proximity", "novelty", "evidence_tier", "colocated_storage"]
        assert ev["relevance"]["score"] == pytest.approx(sum(c["points"] for c in comps))
        assert all(c["basis"] for c in comps)
        assert ev["relevance"]["score"] <= ev["relevance"]["max_possible"]


def test_capacity_component():
    assert R.capacity_component(None)["points"] == 0
    assert "unknown" in R.capacity_component(None)["basis"]
    assert R.capacity_component(999)["points"] == pytest.approx(30.0)
    assert R.capacity_component(5000)["points"] == 30.0
    assert R.capacity_component(9)["points"] == pytest.approx(10.0)


def test_recency_against_reference_not_clock():
    assert R.recency_component("2026-10-01", REF)["points"] == 10
    assert R.recency_component("2026-06-01", REF)["points"] == 4
    assert R.recency_component("2020-01-01", REF)["points"] == 0
    assert R.recency_component(None, REF)["points"] == 1


def test_national_route_and_colocation(releases):
    ev = next(e for e in _ranked(releases) if e["ref"] == "1" and e["event_type"] == "CONSENTED")
    assert _comp(ev, "national_route")["points"] == 8
    assert _comp(ev, "colocated_storage")["points"] == 3
    assert _comp(ev, "evidence_tier")["tier"] == "official_record"


def test_consent_of_large_solar_outranks_small_withdrawal(releases):
    ranked = _ranked(releases)
    pos = {(e["ref"], e["event_type"]): e["rank"] for e in ranked}
    assert pos[("1", "CONSENTED")] < pos[("6", "WITHDRAWN")]
    assert [e["rank"] for e in ranked] == list(range(1, len(ranked) + 1))


def test_datacentre_component_reliability():
    ctx = {"nearest": {"id": "dcuk-x", "status": "operational", "km": 4.2, "proximity_reliable": True}}
    assert R.datacentre_component(ctx)["points"] == 10
    ctx["nearest"]["km"] = 30
    assert R.datacentre_component(ctx)["points"] == 2
    ctx["nearest"]["proximity_reliable"] = False
    assert R.datacentre_component(ctx)["points"] == 0
    assert R.datacentre_component(None)["points"] == 0
    assert "not a connection" in R.datacentre_component({"nearest": {"id": "d", "km": 1, "status": "x"}})["basis"]


def test_novelty_uses_previous_feed_and_siblings(releases, tmp_path):
    prev = tmp_path / "prev_feed.json"
    prev.write_text(json.dumps({"canonical_items": [
        {"repd_ref": "1", "role": "PRIMARY_MATCH", "event": "CONSENT", "gg_article_id": "A1"},
        {"repd_ref": "3", "role": "PRIMARY_MATCH", "event": "ACQUISITION", "gg_article_id": "A2"}]}))
    previous = R.load_previous_feed(prev)
    ranked = _ranked(releases, previous=previous)
    get = lambda ref, t: next(e for e in ranked if e["ref"] == ref and e["event_type"] == t)  # noqa: E731
    assert _comp(get("1", "CONSENTED"), "novelty")["points"] == 0
    assert _comp(get("2", "CONSENTED"), "novelty")["points"] == 0       # sibling of ref 1, same event
    assert _comp(get("3", "CONSTRUCTION_STARTED"), "novelty")["points"] == 3
    assert _comp(get("4", "OPERATIONAL"), "novelty")["points"] == 6


def test_top_events_folds_siblings(releases):
    top = R.top_events(_ranked(releases), 5)
    assert len(top) == 5
    lead = top[0]
    assert set(lead["grouped_refs"]) <= {"1", "2"}


def test_profile_hash_stable():
    assert R.profile_sha256() == R.profile_sha256(json.loads(json.dumps(R.DEFAULT_PROFILE)))


def test_article_evidence_tiers():
    assert R.evidence_tier_of("GOV.UK", "https://www.gov.uk")[0] == "official_record"
    assert R.evidence_tier_of("Some Council", "https://planning.example.gov.uk")[0] == "official_record"
    assert R.evidence_tier_of("reNEWS", "https://renews.biz")[0] == "attributed_reporting"
    assert R.evidence_tier_of("", "https://news.google.com/rss/x")[0] == "unverified_lead"


def test_article_event_classification():
    assert R.classify_article_event("Hatton solar farm approved on appeal") == "CONSENTED"
    assert R.classify_article_event("Blocked BESS: appeal fails for 150 MW site") == "REFUSED"
    assert R.classify_article_event("Coalburn 1 battery enters operations") == "OPERATIONAL"
    assert R.classify_article_event("Ampyr acquires 530MW East Yorkshire Solar Farm") == "ACQUISITION"


def test_corroboration_and_contradiction():
    project = {"ref": "5", "status": "Application Refused"}
    c, contra = R.corroboration("CONSENTED", project, {})
    assert c["points"] == 0 and contra and "Application Refused" in contra
    c, contra = R.corroboration("REFUSED", project, {"5": {"REFUSED"}})
    assert c["points"] == 6 and contra is None
    c, _ = R.corroboration("CONSENTED", {"ref": "1", "status": "Awaiting Construction"}, {})
    assert c["points"] == 3
