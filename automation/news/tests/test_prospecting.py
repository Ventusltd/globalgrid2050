"""Offline research priorities: real pinned baseline plus synthetic receipt fixtures."""
import copy
import hashlib
import json
from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
from automation.news import prospecting as p
from automation.news.acquisition.evidence_store import EvidenceStore

AS_OF = "2026-11-16T23:00:00Z"
FETCHED = "2026-11-16T18:00:00Z"
ROOT = Path(__file__).resolve().parents[3]


def write_pin(tmp_path, payload, name="input.json"):
    raw = json.dumps(payload, allow_nan=True).encode()
    path = tmp_path / name
    path.write_bytes(raw)
    return path, hashlib.sha256(raw).hexdigest()


@pytest.fixture(scope="module")
def baseline():
    return p.official(ROOT)


@pytest.fixture
def evidence(baseline):
    rows, ids, _ = baseline
    projects = [dict(r, id=r["repd_ref"]) for r, _ in rows if r["repd_ref"] in ids]
    # Synthetic accepted receipt, never a claim that a real publisher authorised reuse.
    receipt = {"id": "synthetic", "status": "ok", "url": "https://publisher.example/feed",
               "fetched_at": FETCHED, "response_sha256": "a" * 64, "http_status": 200,
               "eligible_for_publication": True, "probe_only": False, "rights_status": "accepted",
               "rights_review_url": "https://publisher.example/fixture-rights",
               "channel_access": {"state": "OPEN", "checked_at": FETCHED,
                                  "review_url": "https://publisher.example/fixture-access"},
               "article_access": {"https://publisher.example/story": {
                   "state": "OPEN", "checked_at": FETCHED,
                   "review_url": "https://publisher.example/fixture-story-access"}}}
    article = {"id": "test-article", "url": "https://publisher.example/story",
               "title": "Synthetic project headline", "pub_date": "2026-11-15T12:00:00Z",
               "source_id": "synthetic", "publisher": "Synthetic publisher"}
    match = {"project_id": ids[0], "article_url": article["url"],
             "status": "PROVISIONAL", "match_method": "repd_id"}
    with EvidenceStore() as store:
        store.record_run(projects, [article], [match], FETCHED, [receipt])
        snapshot = store.snapshot(timestamp=FETCHED)
    return snapshot


@pytest.fixture
def dc():
    path = ROOT / "uk_renewables_pipeline/202611161630/global-datacentres/projects.json"
    data = json.loads(path.read_bytes())
    data["records"] = data["records"][:1]
    data["record_count"] = data["country_count"] = 1
    return data


def test_real_official_scope_stable_and_no_invented_events_or_freshness(baseline):
    before = json.dumps(baseline, sort_keys=True)
    result = p.build(as_of=AS_OF, limit=1000)
    assert result == p.build(as_of=AS_OF, limit=1000)
    assert result["input_count"] == 7775
    assert result["input_receipts"][0]["solar1000_count"] == 1000
    assert result["input_receipts"][0]["observed_at"] is None
    assert result["input_receipts"][0]["freshness"] == "UNKNOWN"
    assert result["profile_sha256"] == p.relevance.profile_sha256(result["profile"])
    records = result["records"]
    assert records == sorted(records, key=lambda r: (-r["score"], r["id"]))
    assert all(r["score"] == round(sum(c["points"] for c in r["reasons"]), 2) for r in records)
    assert all(r["record_state"] == "OFFICIAL" and r["research_state"] == "UNKNOWN" for r in records)
    assert all("coverage unknown" in r["reasons"][-1]["basis"] for r in records)
    assert all("event" not in r and "event_date" not in r and "available_grid_mw" not in r for r in records)
    assert all(c["name"] not in {"stage", "novelty", "datacentre_proximity", "recency"}
               for r in records for c in r["reasons"])
    assert all(r["event_at"] is None and r["heat"]["score"] == 0
               and not r["corporate_eligibility"]["eligible"] for r in records)
    assert json.dumps(baseline, sort_keys=True) == before
    assert all(not row["enabled"] and row["rights_state"] == "UNKNOWN" for row in result["unsupported_interfaces"])


def test_missing_name_capacity_country_remain_unknown(baseline):
    row, source = copy.deepcopy(baseline[0][0])
    row.update(name="", country="", capacity_mw=None, capacity_known=False, repd_record_updated=None)
    candidate = p.official_candidate(row, source, {}, p._moment(AS_OF))
    assert candidate["name"] is candidate["country"] is candidate["capacities"]["repd_installed_mw"] is None
    assert candidate["record_freshness"]["state"] == "UNKNOWN"
    assert candidate["reasons"][0]["points"] == 0


@pytest.mark.parametrize("value", [-1, float("nan"), float("inf"), True, "100"])
def test_invalid_capacity_cannot_become_positive_priority(value, baseline):
    row, source = copy.deepcopy(baseline[0][0])
    row["capacity_mw"] = value
    with pytest.raises(ValueError):
        p.official_candidate(row, source, {}, p._moment(AS_OF))


def test_future_record_date_rejected_even_outside_returned_top_n():
    with pytest.raises(ValueError, match="Future official record date"):
        p.build(as_of="2026-01-01T00:00:00Z", limit=1)


def test_evidence_is_provisional_and_news_age_never_becomes_event(evidence, baseline, tmp_path):
    spec = write_pin(tmp_path, evidence)
    records, receipt = p.evidence_input(spec, baseline[1], p._moment(AS_OF))
    ref = baseline[1][0]
    row, source = next(x for x in baseline[0] if x[0]["repd_ref"] == ref)
    candidate = p.official_candidate(row, source, records[ref], p._moment(AS_OF))
    assert candidate["record_state"] == "OFFICIAL" and candidate["research_state"] == "PROVISIONAL"
    assert candidate["evidence"][0]["state"] == "PROVISIONAL"
    assert candidate["reasons"][-1]["points"] == 5
    assert receipt["sha256"] == spec[1]
    assert candidate["last_researched_at"] == FETCHED
    assert candidate["evidence"][0]["title"] == "Synthetic project headline" and "event_date" not in candidate
    old_records, _ = p.evidence_input(spec, baseline[1], p._moment("2027-01-01T00:00:00Z"))
    stale = p.official_candidate(row, source, old_records[ref], p._moment("2027-01-01T00:00:00Z"))
    assert stale["reasons"][-1]["points"] == 0
    assert stale["evidence"][0]["freshness"]["state"] == "STALE"
    assert stale["evidence"][0]["pub_date"] == candidate["evidence"][0]["pub_date"]


@pytest.mark.parametrize("change", [
    lambda x: x["sources"][0].update(rights_status="unknown"),
    lambda x: x["sources"][0].update(status="failed"),
    lambda x: x["sources"][0].update(probe_only=True),
    lambda x: x["sources"][0].update(fetched_at="2026-11-17T00:00:00Z"),
    lambda x: x["sources"][0].update(rights_review_url="https://127.0.0.1/private"),
    lambda x: x["sources"][0].pop("channel_access"),
    lambda x: x["sources"][0]["channel_access"].update(state="PAYWALLED"),
    lambda x: x["sources"][0]["channel_access"].update(state="UNKNOWN"),
    lambda x: x["sources"][0].update(article_access={}),
    lambda x: x["sources"][0]["article_access"]["https://publisher.example/story"].update(state="PAYWALLED"),
    lambda x: x.update(generated_at="2026-11-17T00:00:00Z"),
    lambda x: x.update(schema="globalgrid2050.news.pipeline-headlines.v1"),
    lambda x: next(r for r in x["projects"] if r["evidence"])["evidence"][0].update(source_id="unreceipted"),
    lambda x: next(r for r in x["projects"] if r["evidence"])["evidence"][0].update(pub_date="2027-01-01T00:00:00Z"),
    lambda x: next(r for r in x["projects"] if r["evidence"])["evidence"][0].update(pub_date="2026-11-15"),
    lambda x: next(r for r in x["projects"] if r["evidence"])["evidence"][0].update(last_seen="2026-11-14T00:00:00Z"),
])
def test_bad_news_input_fails_closed(change, evidence, tmp_path):
    change(evidence)
    with pytest.raises(ValueError):
        p.build(as_of=AS_OF, evidence=write_pin(tmp_path, evidence), limit=1)


def test_dc_distinct_unknown_capacity_and_original_revision(dc, tmp_path):
    dc["records"][0]["source"]["private_path"] = "never-export-local-receipts"
    spec = write_pin(tmp_path, dc)
    result = p.build(as_of=AS_OF, datacentres=spec, record_type="data_centre")
    assert result["input_count"] == 7776 and result["eligible_count"] == 1
    row = result["records"][0]
    assert row["id"].startswith("DC-WD-") and row["record_state"] == "PROVISIONAL"
    assert row["official_status"] is None
    assert row["capacities"] == {"it_load_mw": None, "site_demand_mw": None, "grid_connection_mw": None}
    assert row["source"]["revision_url"] == dc["records"][0]["source"]["revision_url"]
    assert row["source"]["sha256"] == spec[1]
    assert "never-export-local-receipts" not in json.dumps(result)
    assert str(tmp_path) not in json.dumps(result)


@pytest.mark.parametrize("change", [
    lambda x: x.update(schema="other"),
    lambda x: x.update(record_count=2),
    lambda x: x.update(country_count=2),
    lambda x: x.update(generated_from_retrieval="2027-01-01T00:00:00Z"),
    lambda x: x["records"][0].update(verification_status="VERIFIED"),
    lambda x: x["records"][0]["capacity"].update(it_load_mw=123),
    lambda x: x["records"][0]["source"].update(licence="unknown"),
    lambda x: x["records"][0]["source"].update(revision_url="https://www.wikidata.org/wiki/Q142068695"),
    lambda x: x["records"][0]["field_sources"].update(country="https://localhost/private"),
])
def test_invalid_dc_fails_even_when_filtered_out(change, dc, tmp_path):
    change(dc)
    with pytest.raises(ValueError):
        p.build(as_of=AS_OF, datacentres=write_pin(tmp_path, dc), record_type="renewable_project", limit=1)


def test_cli_hash_failure_preserves_previous_artifact(tmp_path):
    source, _ = write_pin(tmp_path, {"untrusted": True})
    output = tmp_path / "triage.json"
    output.write_bytes(b"previous reviewed artifact")
    with pytest.raises(SystemExit) as error:
        p.main(["--as-of", AS_OF, "--out", str(output), "--datacentres", str(source),
                "--datacentres-sha256", "0" * 64])
    assert error.value.code == 2
    assert output.read_bytes() == b"previous reviewed artifact"
    assert set(tmp_path.iterdir()) == {source, output}


def test_cli_repeatable_bytes_and_no_local_path(tmp_path):
    first, second = tmp_path / "first.json", tmp_path / "second.json"
    for target in (first, second):
        assert p.main(["--as-of", AS_OF, "--out", str(target), "--limit", "10"]) == 0
    assert first.read_bytes() == second.read_bytes()
    assert str(ROOT).encode() not in first.read_bytes()


def test_cli_refuses_release_tree_output_without_touching_baseline():
    manifest = ROOT / "uk_renewables_pipeline" / p.queue.RELEASE_ID / "solar1000/manifest.json"
    before = manifest.read_bytes()
    with pytest.raises(SystemExit):
        p.main(["--as-of", AS_OF, "--out", str(manifest)])
    assert manifest.read_bytes() == before


def test_changed_official_pin_fails_closed(monkeypatch):
    monkeypatch.setattr(p.queue, "BUILD_MANIFEST_SHA256", "0" * 64)
    with pytest.raises(ValueError, match="Immutable V9.24 input changed"):
        p.build(as_of=AS_OF)


def test_company_names_do_not_infer_listed_parent_or_enable_personal_enrichment(dc, tmp_path):
    dc["records"][0].update(name="NASDAQ famous listed group FTSE250",
                            operator="Ambiguous company name", directors=["Must not export"],
                            residential_address="Must not export")
    result = p.build(as_of=AS_OF, datacentres=write_pin(tmp_path, dc), record_type="data_centre")
    eligibility = result["records"][0]["corporate_eligibility"]
    assert eligibility["state"] == "UNKNOWN" and eligibility["listed_parent"] is None
    assert not eligibility["eligible"] and not eligibility["membership_evidence"]
    assert "Must not export" not in json.dumps(result)
    assert not result["source_policy"]["sme_targeting"]
    assert not result["source_policy"]["government_hosting_implies_reuse_permission"]


def test_multiple_headlines_do_not_manufacture_independent_momentum(evidence, baseline, tmp_path):
    row = next(r for r in evidence["projects"] if r["evidence"])
    duplicate = dict(row["evidence"][0], id="syndicated", url="https://publisher.example/repost")
    row["evidence"].append(duplicate)
    row["evidence_count"] = row["provisional_count"] = evidence["evidence_count"] = 2
    source = evidence["sources"][0]
    source["article_access"][duplicate["url"]] = source["article_access"]["https://publisher.example/story"]
    records, _ = p.evidence_input(write_pin(tmp_path, evidence), baseline[1], p._moment(AS_OF))
    official, provenance = next(x for x in baseline[0] if x[0]["repd_ref"] == row["project_id"])
    candidate = p.official_candidate(official, provenance, records[row["project_id"]], p._moment(AS_OF))
    assert candidate["reasons"][-1]["points"] == 5
    assert candidate["heat"]["state"] == "UNKNOWN" and candidate["heat"]["independent_signal_count"] is None


def test_generator_requires_no_network(monkeypatch):
    import socket

    def forbidden(*args, **kwargs):
        raise AssertionError("Network is not part of offline triage")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(socket, "getaddrinfo", forbidden)
    assert p.build(as_of=AS_OF, limit=1)["returned_count"] == 1
