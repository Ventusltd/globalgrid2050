"""Offline SEC scope/identity/provenance rejection tests. All filings synthetic."""
import copy
import hashlib
import json

import pytest

from automation.news.filings.west.sec import FilingError, MAX_BYTES, load_registry, normalize_submissions


def example():
    return {
        "cik": "1234567", "name": "SYNTHETIC LISTED GROUP", "entityType": "operating",
        "category": "Large accelerated filer", "tickers": ["SYNTH"], "exchanges": ["Nasdaq"],
        "addresses": {"business": {"street1": "DO NOT COPY"}},
        "filings": {"recent": {
            "accessionNumber": ["0001234567-26-000001", "0001234567-26-000002", "0001234567-26-000003"],
            "form": ["10-Q", "10-Q/A", "4"],
            "filingDate": ["2026-10-20", "2026-10-21", "2026-10-22"],
            "reportDate": ["2026-09-30", "2026-09-30", ""],
            "acceptanceDateTime": ["2026-10-20T15:00:00Z", "2026-10-21T15:00:00Z", "2026-10-22T15:00:00Z"],
            "primaryDocument": ["group-quarter.htm", "group-amendment.htm", "insider.xml"],
        }, "files": [{"name": "older-unfetched.json"}]},
    }


def inputs(payload=None, raw=None):
    raw = raw if raw is not None else json.dumps(example() if payload is None else payload).encode()
    digest = hashlib.sha256(raw).hexdigest()
    url = "https://data.sec.gov/submissions/CIK0001234567.json"
    receipt = {"source_id": "us-sec-edgar", "requested_url": url, "final_url": url,
               "http_status": 200, "content_type": "application/json; charset=utf-8",
               "payload_sha256": digest, "bytes": len(raw), "retrieved_at": "2026-11-16T17:00:00Z",
               "eligible_for_publication": False}
    scope = {"cik": "0001234567", "entity_kind": "listed_corporate_group",
             "decision": "ALLOW_METADATA_RESEARCH", "payload_sha256": digest,
             "includes_personal_or_sme_enrichment": False, "ticker": "SYNTH", "exchange": "Nasdaq",
             "review_url": "https://github.com/Ventusltd/neural-link-between-agents/issues/42#issuecomment-12345",
             "reviewed_at": "2026-11-16T17:01:00Z"}
    return raw, receipt, scope


def run(payload=None):
    raw, receipt, scope = inputs(payload)
    return normalize_submissions(raw, receipt=receipt, issuer_scope=scope)


def test_metadata_only_amendment_is_not_restatement_or_parent_evidence():
    result = run()
    assert result["input_rows"] == 3 and result["returned_rows"] == 2
    assert result["filings"][1]["is_amendment"] is True
    assert result["filings"][1]["restatement_status"] == "UNKNOWN"
    assert result["filings"][1]["supersedes"] is None
    assert all(f["document_sha256"] is None and f["figures"] == [] for f in result["filings"])
    assert result["group_relationships"] == result["financial_claims"] == []
    assert result["eligible_for_publication"] is result["automatic_collection_enabled"] is False
    assert "DO NOT COPY" not in json.dumps(result) and "insider.xml" not in json.dumps(result)
    assert result["filings"][0]["document_url"] == "https://www.sec.gov/Archives/edgar/data/1234567/000123456726000001/group-quarter.htm"


def test_bounded_selection_declares_truncation_without_changing_source_order():
    raw, receipt, scope = inputs()
    result = normalize_submissions(raw, receipt=receipt, issuer_scope=scope, limit=1)
    assert result["returned_rows"] == 1 and result["supported_rows"] == 2
    assert result["selection_truncated"] and result["coverage"] == "RECENT_ARRAY_ONLY"
    assert result["filings"][0]["source_row"] == 0


@pytest.mark.parametrize("value", ["", None])
def test_unknown_report_date_remains_null(value):
    payload = example()
    payload["filings"]["recent"]["reportDate"][0] = value
    assert run(payload)["filings"][0]["report_date"] is None


@pytest.mark.parametrize("field,value", [
    ("cik", 999), ("cik", True), ("entityType", "investment"),
    ("category", "Smaller reporting company"), ("category", ""),
    ("tickers", []), ("exchanges", []), ("tickers", ["OTHER"]),
])
def test_noneligible_issuer_rejected(field, value):
    payload = example(); payload[field] = value
    with pytest.raises(FilingError): run(payload)


@pytest.mark.parametrize("field,value", [
    ("http_status", 403), ("http_status", True), ("payload_sha256", "0" * 64),
    ("bytes", 0), ("content_type", "text/html"), ("eligible_for_publication", True),
    ("requested_url", "https://data.sec.gov.evil.test/submissions/CIK0001234567.json"),
    ("final_url", "https://127.1/submissions/CIK0001234567.json"),
    ("final_url", "https://user@data.sec.gov/submissions/CIK0001234567.json"),
    ("retrieved_at", "2026-11-16"),
])
def test_receipt_rejection(field, value):
    raw, receipt, scope = inputs(); receipt[field] = value
    with pytest.raises(FilingError): normalize_submissions(raw, receipt=receipt, issuer_scope=scope)


@pytest.mark.parametrize("field,value", [
    ("entity_kind", "individual"), ("entity_kind", "sme"),
    ("decision", "VERIFIED"), ("includes_personal_or_sme_enrichment", True),
    ("payload_sha256", "0" * 64), ("exchange", "OTHER"),
    ("reviewed_at", "2026-11-15T00:00:00Z"),
    ("review_url", "https://github.com.evil.test/Ventusltd/neural-link-between-agents/issues/42#issuecomment-12345"),
])
def test_scope_must_be_explicit_and_bound(field, value):
    raw, receipt, scope = inputs(); scope[field] = value
    with pytest.raises(FilingError): normalize_submissions(raw, receipt=receipt, issuer_scope=scope)


@pytest.mark.parametrize("field,value", [
    ("primaryDocument", "../secret.htm"), ("primaryDocument", "https://other.test/a.htm"),
    ("primaryDocument", "group%2fsecret.htm"), ("primaryDocument", "group\\secret.htm"),
    ("reportDate", "2026-10-21"), ("reportDate", 0), ("reportDate", "2026-02-30"),
    ("filingDate", "2027-01-01"), ("acceptanceDateTime", "2027-01-01T00:00:00Z"),
    ("acceptanceDateTime", "2026-10-20T15:00:00"),
])
def test_corrupt_selected_row_fails_whole_payload(field, value):
    payload = example(); payload["filings"]["recent"][field][0] = value
    with pytest.raises(FilingError): run(payload)


def test_unaligned_columns_and_duplicate_accessions_rejected():
    payload = example(); payload["filings"]["recent"]["reportDate"].pop()
    with pytest.raises(FilingError): run(payload)
    payload = example(); payload["filings"]["recent"]["accessionNumber"][1] = payload["filings"]["recent"]["accessionNumber"][0]
    with pytest.raises(FilingError): run(payload)


@pytest.mark.parametrize("raw", [b'{"cik":1,"cik":2}', b'{"value":NaN}', b'[]', b'\xff', b'{}' * 20])
def test_invalid_json_shapes_rejected(raw):
    raw, receipt, scope = inputs(raw=raw)
    with pytest.raises(FilingError): normalize_submissions(raw, receipt=receipt, issuer_scope=scope)


def test_oversize_and_boolean_limit_rejected():
    raw, receipt, scope = inputs()
    with pytest.raises(FilingError): normalize_submissions(b'x' * (MAX_BYTES + 1), receipt=receipt, issuer_scope=scope)
    with pytest.raises(FilingError): normalize_submissions(raw, receipt=receipt, issuer_scope=scope, limit=True)


def test_no_mutation_and_repeatable_output():
    raw, receipt, scope = inputs(); saved = copy.deepcopy((receipt, scope))
    first = normalize_submissions(raw, receipt=receipt, issuer_scope=scope)
    assert first == normalize_submissions(raw, receipt=receipt, issuer_scope=scope)
    assert (receipt, scope) == saved


def test_disabled_registry_has_official_evidence_and_existing_ch_owner():
    registry = load_registry()
    assert registry["automatic_collection_enabled"] is False
    assert {r["country"] for r in registry["sources"]} == {"US", "GB", "CH", "DE", "FR"}
    assert all(r["enabled"] is False and r["disabled_reason"] and r["official_reference"] for r in registry["sources"])
    ch = next(r for r in registry["sources"] if r["source_id"] == "uk-companies-house-owner")
    assert "Ventusltd/companies/blob/ac70a374" in ch["owner_module"]
