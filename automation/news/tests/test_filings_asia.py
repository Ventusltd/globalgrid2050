"""Synthetic offline contract tests; no publisher claims or access implied."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from automation.news.filings.asia import normalize_disclosure, source_registry
from automation.news.filings.asia.metadata import MAX_DOCUMENT_BYTES

BODY = b"synthetic offline disclosure fixture; not publisher content"


def sample(source="sse", code="600000"):
    entry = source_registry()["sources"][source]
    url = "https://" + entry["allowed_hosts"][0] + "/synthetic/disclosure.pdf"
    return {
        "source_id": source, "issuer_code": code, "document_id": "fixture-001",
        "document_url": url,
        "published": {"value": "2026-11-16", "precision": "day"},
        "identity_evidence": {
            "issuer_id": f"{source}:{code}", "listed_parent_id": f"{source}:{code}",
            "relation": "self", "eligibility": "eligible_listed_parent_group",
            "listing_evidence_url": url, "group_evidence_url": url,
            "eligibility_evidence_url": url, "reviewed_at": "2026-11-16T18:00:00Z",
        },
        "receipt": {
            "requested_url": url, "final_url": url, "http_status": 200,
            "retrieved_at": "2026-11-16T17:00:00Z", "sha256": hashlib.sha256(BODY).hexdigest(),
        },
    }


@pytest.mark.parametrize("source,code", [("sse", "600000"), ("hkex", "00388"),
    ("sgx", "Z74"), ("jpx", "130A"), ("bse", "500325"), ("nse", "M&M")])
def test_sources_normalize_deterministically_without_enabling_collection(source, code):
    metadata = sample(source, code)
    original = deepcopy(metadata)
    output = normalize_disclosure(metadata, document_bytes=BODY)
    assert output == normalize_disclosure(metadata, document_bytes=BODY)
    assert output["issuer_id"] == f"{source}:{code}"
    assert output["status"] == "PROVISIONAL"
    assert not output["publishable"] and not output["independently_verified"]
    assert not output["collection_enabled"]
    assert output["published"]["precision"] == "day"
    assert metadata == original
    output["identity_evidence"]["issuer_id"] = "changed"
    assert metadata == original
    assert BODY.decode() not in json.dumps(output)


@pytest.mark.parametrize("change", [
    {"body": "full publisher text"}, {"director": "personal profile"},
    {"numeric_claim": "invented revenue"}, {"status": "VERIFIED"},
    {"source_id": "unknown"}, {"issuer_code": 600000},
    {"issuer_code": "name similarity"}, {"document_id": "bad\nidentifier"},
])
def test_unknown_or_forbidden_fields_and_implicit_identity_fail(change):
    metadata = sample()
    metadata.update(change)
    with pytest.raises(ValueError):
        normalize_disclosure(metadata, document_bytes=BODY)


@pytest.mark.parametrize("url", ["http://www.sse.com.cn/a", "https://www.sse.com.cn.evil.test/a",
    "https://user@www.sse.com.cn/a", "https://www.sse.com.cn:8443/a",
    "https://127.0.0.1/a", "https://www.sse.com.cn/a#fragment",
    "https://www.sse.com.cn/\nsecret", "https://www.sse.com.cn\\@evil.test/a"])
def test_official_host_boundary_applies_to_document_receipt_and_identity(url):
    for location in ("document_url", "receipt", "identity_evidence"):
        metadata = sample()
        if location == "document_url":
            metadata[location] = url
        elif location == "receipt":
            metadata[location]["final_url"] = url
        else:
            metadata[location]["group_evidence_url"] = url
        with pytest.raises(ValueError):
            normalize_disclosure(metadata, document_bytes=BODY)


@pytest.mark.parametrize("change", [
    {"issuer_id": "sse:600001"}, {"listed_parent_id": "sse:600001"},
    {"relation": "name_match"}, {"eligibility": "SME"},
    {"eligibility": "unknown"}, {"listing_evidence_url": ""},
    {"reviewed_at": "2026-11-16"}, {"personal_address": "forbidden"},
])
def test_missing_or_contradictory_group_and_eligibility_evidence_fails(change):
    metadata = sample()
    metadata["identity_evidence"].update(change)
    with pytest.raises(ValueError):
        normalize_disclosure(metadata, document_bytes=BODY)


def test_parent_relationship_does_not_collapse_subsidiary_into_consolidated_identity():
    metadata = sample()
    metadata["identity_evidence"].update(relation="subsidiary", listed_parent_id="lei:EXPLICIT-PARENT")
    output = normalize_disclosure(metadata, document_bytes=BODY)
    assert output["issuer_id"] != output["listed_parent_id"]
    assert output["publishable"] is False


@pytest.mark.parametrize("change", [{"http_status": 403}, {"http_status": True},
    {"sha256": "0" * 64}, {"sha256": "missing"}, {"retrieved_at": "2026-11-16T17:00:00"},
    {"final_url": "https://www.sse.com.cn/other.pdf"}])
def test_receipt_must_bind_exact_successful_document_and_bytes(change):
    metadata = sample()
    metadata["receipt"].update(change)
    with pytest.raises(ValueError):
        normalize_disclosure(metadata, document_bytes=BODY)


@pytest.mark.parametrize("published", [
    {"value": "2026-11-18", "precision": "day"},
    {"value": "2026-11-16T17:00:01Z", "precision": "second"},
    {"value": "2026-11-16T17:00:00", "precision": "second"},
    {"value": "2026-11", "precision": "month"},
    {"value": "2026-02-30", "precision": "day"},
])
def test_unobserved_or_impossible_clocks_fail(published):
    metadata = sample()
    metadata["published"] = published
    with pytest.raises(ValueError):
        normalize_disclosure(metadata, document_bytes=BODY)


def test_source_local_day_and_offset_timestamp_are_preserved():
    metadata = sample()
    metadata["receipt"]["retrieved_at"] = "2026-11-15T17:00:00Z"  # Nov 16 in Shanghai
    assert normalize_disclosure(metadata, document_bytes=BODY)["published"] == metadata["published"]
    metadata["published"] = {"value": "2026-11-16T01:00:00+08:00", "precision": "second"}
    assert normalize_disclosure(metadata, document_bytes=BODY)["published"] == metadata["published"]


@pytest.mark.parametrize("body", [b"", "wrong type", b"x" * (MAX_DOCUMENT_BYTES + 1)],
                         ids=["empty", "wrong-type", "over-limit"])
def test_input_bytes_bounded_and_required(body):
    with pytest.raises(ValueError):
        normalize_disclosure(sample(), document_bytes=body)


def test_same_document_identity_keeps_distinct_revisions_by_content_receipt():
    metadata = sample()
    previous = normalize_disclosure(metadata, document_bytes=BODY)
    revised_body = BODY + b" revision"
    metadata["receipt"]["sha256"] = hashlib.sha256(revised_body).hexdigest()
    revised = normalize_disclosure(metadata, document_bytes=revised_body)
    assert previous["id"] == revised["id"]
    assert previous["receipt"]["sha256"] != revised["receipt"]["sha256"]
    assert not revised["publishable"]


def test_registry_and_real_transport_receipts_make_no_data_or_permission_claim():
    registry = source_registry()
    assert len(registry["sources"]) == 6
    assert len({s["market"] for s in registry["sources"].values()}) == 5
    for source in registry["sources"].values():
        assert source["collection_enabled"] is False
        assert source["rights_status"] != "approved"
        assert source["disabled_reason"] and source["authority_evidence_url"]
    receipt_path = Path(__file__).parents[1] / "filings/asia/probe-receipts-20261116.json"
    receipts = json.loads(receipt_path.read_text(encoding="utf-8"))["receipts"]
    assert {r["source_id"] for r in receipts} == set(registry["sources"])
    assert {r["http_status"] for r in receipts} == {200, 403, 503, None}
    assert all(r["method"] == "HEAD" and not r["body_retained"] for r in receipts)
    assert all(r["claim"] == "transport_observation_only" for r in receipts)
    assert all(r["document_sha256"] is None and r["response_body_sha256"] is None for r in receipts)
