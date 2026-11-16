"""Synthetic contract fixtures only; no claims about real issuers or projects."""

from copy import deepcopy
from decimal import Decimal
import json

import pytest

from automation.news.filings.contracts import (
    ClaimValidationError, ENERGY_KINDS, POWER_KINDS, SCHEMA, dumps_claim, validate_claim,
)


@pytest.fixture
def claim():
    return {
        "schema": SCHEMA, "claim_id": "filing:synthetic:capex:1",
        "status": "machine-provisional", "quantity_kind": "finance", "metric": "Capital expenditure", "value": "1.20",
        "scale": "1e9", "unit": "currency", "original_unit": "billion US dollars",
        "currency": "USD", "finance_stage": "announced",
        "entity": {"scope": "consolidated_group", "id": "group:synthetic",
                   "consolidation_group_id": "group:synthetic",
                   "identity_evidence_url": "https://www.sec.gov/synthetic-identity"},
        "reporting_period": {"start": "2026-01", "end": "2026-09"},
        "as_of": "2026-09-30", "basis": "reported", "assurance": "unknown",
        "provenance": {"document_id": "filing:synthetic",
                       "document_url": "https://www.sec.gov/synthetic-document",
                       "sha256": "a" * 64, "page": "12", "section": "Capital expenditure",
                       "published_date": "2026-10-01", "retrieved_at": "2026-11-16T12:00:00Z"},
        "revision": {"id": "original", "supersedes_claim_id": None, "restated": False},
    }


def test_exact_decimal_scale_and_source_precision_survive_json(claim):
    wire = dumps_claim(claim)
    assert json.loads(wire) == claim
    assert json.loads(wire)["value"] == "1.20"
    assert json.loads(wire)["scale"] == "1e9"
    assert json.loads(wire)["reporting_period"]["end"] == "2026-09"
    assert wire == dumps_claim(dict(reversed(list(claim.items()))))


def test_no_mutation_or_shared_nested_containers(claim):
    before = deepcopy(claim)
    result = validate_claim(claim)
    result["entity"]["id"] = "group:changed"
    result["reporting_period"]["end"] = "2026-10"
    assert claim == before


@pytest.mark.parametrize("value", [1.2, 1, True, None, Decimal("1.20"), "NaN", "Infinity",
                                      "-Infinity", "1e9", "1,200", "01.2", ".2", "1.", " 1.20", "1.20\n", "9" * 101])
def test_lossy_nonfinite_or_ambiguous_numbers_rejected(claim, value):
    claim["value"] = value
    with pytest.raises(ClaimValidationError, match="value"):
        validate_claim(claim)


@pytest.mark.parametrize("stage", ["announced", "committed", "disbursed", "reported"])
def test_finance_stages_and_signed_reported_value_remain_distinct(claim, stage):
    claim.update(finance_stage=stage, value="-123456789012345678901234567890.00100")
    assert validate_claim(claim)["finance_stage"] == stage
    assert json.loads(dumps_claim(claim))["value"].endswith(".00100")


@pytest.mark.parametrize("kind", sorted(POWER_KINDS | ENERGY_KINDS))
def test_electrical_claims_keep_kind_scope_and_unit(claim, kind):
    claim.update(quantity_kind=kind, unit="MWh" if kind in ENERGY_KINDS else "MW",
                 original_unit="source units", scale="1", currency=None, finance_stage=None)
    claim["entity"].update(scope="phase", id="phase:synthetic", consolidation_group_id=None)
    result = validate_claim(claim)
    assert result["quantity_kind"] == kind
    assert result["entity"]["scope"] == "phase"
    assert result["value"] == "1.20"


@pytest.mark.parametrize("kind,unit", [("storage_energy", "MW"), ("storage_power", "MWh"),
                                       ("it_load", "GWh"), ("finance", "MW")])
def test_no_automatic_power_energy_money_conversion(claim, kind, unit):
    claim.update(quantity_kind=kind, unit=unit)
    if kind != "finance":
        claim.update(currency=None, finance_stage=None)
    with pytest.raises(ClaimValidationError, match="unit"):
        validate_claim(claim)


@pytest.mark.parametrize("key,value", [("currency", None), ("currency", "US$"), ("currency", "usd"),
                                       ("finance_stage", "paid-or-announced"), ("scale", 1000),
                                       ("scale", "2"), ("status", "VERIFIED"), ("basis", "estimated"),
                                       ("original_unit", "")])
def test_unknown_finance_semantics_or_verified_status_rejected(claim, key, value):
    claim[key] = value
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)


def test_negative_power_and_attached_currency_rejected(claim):
    claim.update(quantity_kind="project_demand", unit="MW", value="-1", currency=None, finance_stage=None)
    with pytest.raises(ClaimValidationError, match="negative"):
        validate_claim(claim)
    claim.update(value="1", currency="USD")
    with pytest.raises(ClaimValidationError, match="currency"):
        validate_claim(claim)


def test_consolidation_scope_is_preserved_not_allocated_to_project(claim):
    group = validate_claim(claim)
    subsidiary = deepcopy(claim)
    subsidiary["claim_id"] = "filing:synthetic:subsidiary:1"
    subsidiary["entity"].update(scope="issuer", id="issuer:subsidiary")
    validated = validate_claim(subsidiary)
    assert validated["entity"]["id"] != group["entity"]["id"]
    assert validated["entity"]["consolidation_group_id"] == group["entity"]["id"]
    claim["entity"]["consolidation_group_id"] = None
    with pytest.raises(ClaimValidationError, match="group identity"):
        validate_claim(claim)


def test_forecast_not_audited_actual_and_future_period_explicit(claim):
    claim["reporting_period"] = {"start": "2027", "end": "2029"}
    with pytest.raises(ClaimValidationError, match="forecast"):
        validate_claim(claim)
    claim["basis"] = "forecast"
    claim["as_of"] = "2029-12"
    assert validate_claim(claim)["reporting_period"]["end"] == "2029"
    assert validate_claim(claim)["as_of"] == "2029-12"
    claim["assurance"] = "audited"
    with pytest.raises(ClaimValidationError, match="audited actual"):
        validate_claim(claim)


@pytest.mark.parametrize("value", ["2026-13", "2026-02-30", "0000", "2026-1", "20261101", True])
def test_invalid_source_dates_rejected(claim, value):
    claim["as_of"] = value
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)


def test_period_order_precision_and_missing_temporal_basis(claim):
    for period in ({"start": "2026-10", "end": "2026-09"},
                   {"start": "2026", "end": "2026-09"}, None):
        claim.update(reporting_period=period, as_of=None)
        with pytest.raises(ClaimValidationError):
            validate_claim(claim)


@pytest.mark.parametrize("value", ["2026-11-16T12:00:00", "2026-11-16", "2026-13-16T12:00:00Z"])
def test_retrieval_requires_valid_offset_timestamp(claim, value):
    claim["provenance"]["retrieved_at"] = value
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)


def test_chronology_and_nullable_publication_preserved(claim):
    claim["provenance"]["published_date"] = None
    assert validate_claim(claim)["provenance"]["published_date"] is None
    claim["provenance"]["published_date"] = "2026-12"
    with pytest.raises(ClaimValidationError, match="publication"):
        validate_claim(claim)
    claim["provenance"]["published_date"] = None
    claim["as_of"] = "2027"
    with pytest.raises(ClaimValidationError, match="observation"):
        validate_claim(claim)


def test_source_calendar_offset_explicit_at_retrieval_day_boundary(claim):
    claim["provenance"].update(published_date="2026-11-17", retrieved_at="2026-11-17T00:30:00+09:00")
    assert validate_claim(claim)["provenance"]["retrieved_at"].endswith("+09:00")
    # Same instant, unknown source timezone: conservative rejection is documented.
    claim["provenance"]["retrieved_at"] = "2026-11-16T15:30:00Z"
    with pytest.raises(ClaimValidationError, match="publication"):
        validate_claim(claim)


def test_revision_and_restatement_preserve_history(claim):
    claim["revision"] = {"id": "restatement:2", "supersedes_claim_id": "filing:older:capex:1", "restated": True}
    assert validate_claim(claim)["revision"]["supersedes_claim_id"] == "filing:older:capex:1"
    claim["revision"]["supersedes_claim_id"] = claim["claim_id"]
    with pytest.raises(ClaimValidationError, match="itself"):
        validate_claim(claim)
    claim["revision"]["supersedes_claim_id"] = None
    with pytest.raises(ClaimValidationError, match="earlier claim"):
        validate_claim(claim)
    claim["revision"]["restated"] = 1
    with pytest.raises(ClaimValidationError, match="boolean"):
        validate_claim(claim)


@pytest.mark.parametrize("level", [None, "entity", "provenance", "revision", "reporting_period"])
def test_no_personal_or_untrusted_extra_fields_pass_through(claim, level):
    target = claim if level is None else claim[level]
    target["director_residential_address"] = "synthetic forbidden field"
    with pytest.raises(ClaimValidationError, match="documented fields"):
        validate_claim(claim)


@pytest.mark.parametrize("url", ["http://www.sec.gov/x", "https://localhost/x", "https://127.1/x",
                                    "https://2130706433/x", "https://0x7f000001/x", "https://127.0.0.1/x",
                                    "https://224.0.0.1/x", "https://[::1]/x", "https://user:password@www.sec.gov/x",
                                    "https://www.sec.gov\\@127.0.0.1/x", "https://www.sec.gov:444/x",
                                    "https://host.internal/x", "https://www.sec.gov/%s\n"])
def test_provenance_url_syntax_rejects_private_literals_and_confusion(claim, url):
    claim["provenance"]["document_url"] = url
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)


def test_hash_and_locator_required_without_fabricating_source_evidence(claim):
    claim["provenance"].update(page=None, section=None)
    with pytest.raises(ClaimValidationError, match="locator"):
        validate_claim(claim)
    claim["provenance"].update(section="Table 1", sha256="unknown")
    with pytest.raises(ClaimValidationError, match="SHA256"):
        validate_claim(claim)


def test_unsupported_scope_and_arbitrary_nested_payload_fail(claim):
    claim["entity"]["scope"] = "person"
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)
    claim["entity"]["scope"] = "consolidated_group"
    claim["provenance"]["section"] = {"body": "untrusted data"}
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)


def test_metric_missing_or_unencodable_text_rejected(claim):
    claim["metric"] = "\ud800"
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)
    del claim["metric"]
    with pytest.raises(ClaimValidationError):
        validate_claim(claim)
