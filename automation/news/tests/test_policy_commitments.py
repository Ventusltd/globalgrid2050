"""COVENANT states, attribution and compatible measurements; no source network."""
import copy
import csv
import io
import json
from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from automation.news.policy_commitments import ledger as policy

AS_OF = "2026-11-16T18:00:00Z"
HERE = ROOT / "automation/news/policy_commitments"


@pytest.fixture
def sample():
    return json.loads((HERE / "sample_ledger.json").read_text(encoding="utf-8"))


@pytest.fixture
def numeric():
    # Synthetic source/measurement receipts exercise the shared FIGURES contract.
    def document(identity, kind, published, retrieved, sha, state, locator):
        return {"id": identity, "title": "Synthetic " + identity, "issuer": "Synthetic institution",
                "url": "https://institution.example/" + identity, "version": "fixture-original",
                "published_on": published, "reviewed_at": retrieved, "retrieved_at": retrieved,
                "content_sha256": sha * 64, "hash_limitation": None,
                "document_state": state, "source_kind": kind,
                "read_coverage": {"state": "READ", "locators": [locator], "note": "Synthetic fixture only"}}
    target_doc = document("policy", "PRIMARY_POLICY", "2026-01-01", "2026-01-02T00:00:00Z", "a", "ADOPTED", "target")
    actual_doc = document("measurement", "OFFICIAL_MEASUREMENT", "2026-11-15", "2026-11-16T00:00:00Z", "b", "PUBLISHED", "table")
    def claim(identity, doc, value, basis):
        return {"schema": "globalgrid2050.filing-figure.v1", "claim_id": identity, "status": "machine-provisional",
                "quantity_kind": "energised_load", "metric": "Energised site load", "value": value, "scale": "1",
                "unit": "MW", "original_unit": "MW", "currency": None, "finance_stage": None,
                "entity": {"scope": "site", "id": "site:synthetic", "consolidation_group_id": None,
                           "identity_evidence_url": "https://institution.example/site-identity"},
                "reporting_period": {"start": "2026-01-01", "end": "2026-10-31"},
                "as_of": "2026-10-31", "basis": basis, "assurance": "unknown",
                "provenance": {"document_id": doc["id"], "document_url": doc["url"], "sha256": doc["content_sha256"],
                               "page": None, "section": doc["read_coverage"]["locators"][0],
                               "published_date": doc["published_on"], "retrieved_at": doc["retrieved_at"]},
                "revision": {"id": "original", "supersedes_claim_id": None, "restated": False}}
    source = {"document_id": "policy", "locator": "target"}
    return {"schema": policy.SCHEMA, "coverage_note": "Synthetic comparison fixtures; no real delivery claims.",
            "documents": [target_doc, actual_doc],
            "scopes": [{"id": "scope:site", "jurisdiction": "Fixture", "description": "One identified site",
                        "entity_id": "site:synthetic", "figure_entity_scope": "site"}],
            "commitments": [{"id": "commitment:site", "issuer": "Synthetic institution", "source": source,
                "scope_id": "scope:site", "statement_type": "UNDERTAKING", "statement": "Synthetic capacity undertaking",
                "conditions": [], "metric": {"label": "Energised site load", "numeric_support": "SUPPORTED", "limitation": None},
                "target": claim("figure:target", target_doc, "100.00", "forecast"), "baseline": None,
                "baseline_state": "NOT_REQUIRED", "deadline": {"value": "2026-10-31", "wording": "by 31 October 2026"},
                "reporting_obligation": None, "applicability": {"state": "ESTABLISHED", "reason": "Fixture identity receipt",
                                                               "evidence": [source]},
                "revision": {"id": "original", "supersedes_commitment_id": None, "baseline_changed": False}}],
            "updates": [{"id": "update:site", "commitment_id": "commitment:site", "commitment_revision_id": "original",
                "baseline_revision_id": "original", "source": {"document_id": "measurement", "locator": "table"},
                "reported_on": "2026-11-15", "statement": "Synthetic measurement report", "kind": "NUMERIC_REPORT",
                "claim": claim("figure:actual", actual_doc, "120.00", "reported"), "measurement_state": "DOCUMENTED_MEASUREMENT"}]}


def only_result(payload):
    return policy.evaluate(payload, as_of=AS_OF)["results"][0]


def test_real_seed_is_bounded_and_cannot_invent_compliance(sample):
    report = policy.evaluate(sample, as_of=AS_OF)
    assert len(report["results"]) == 8 and len(report["documents"]) == 3
    states = {r["commitment_id"]: r["state"] for r in report["results"]}
    assert states["uk:dc:control-centre"] == "REPORTED_PROGRESS"
    assert list(states.values()).count("UNKNOWN") == 7
    assert all(r["legal_compliance"] == "NOT_ASSESSED" and r["status"] == "machine-provisional" for r in report["results"])
    assert all(r["comparison"] is None and r["target"] is None for r in report["results"])
    assert all(r["measurement_state"] == "UNKNOWN" for r in report["results"])
    national = next(r for r in report["results"] if r["commitment_id"] == "uk:dc:national-capacity-context")
    assert national["deadline"]["value"] == "2030"  # source precision retained, no invented date
    assert national["scope"]["entity_id"] is None
    assert all(d["content_sha256"] is None for d in report["documents"] if d["source_kind"] != "PRIMARY_POLICY")


@pytest.mark.parametrize("value,relation", [("120.00", "GREATER_THAN"), ("100.00", "EQUAL"), ("80.00", "LESS_THAN")])
def test_supported_result_is_a_numerical_relation_not_a_compliance_label(numeric, value, relation):
    numeric["updates"][0]["claim"]["value"] = value
    before = copy.deepcopy(numeric)
    result = only_result(numeric)
    assert result["state"] == "EVIDENCE_SUPPORTED_RESULT"
    assert result["comparison"]["relation"] == relation
    assert result["legal_compliance"] == "NOT_ASSESSED"
    assert result["target"]["value"] == "100.00"  # exact FIGURES lexeme
    assert numeric == before


def test_unknown_applicability_wins_over_measurement(numeric):
    numeric["commitments"][0]["applicability"]["state"] = "UNKNOWN"
    assert only_result(numeric)["state"] == "UNKNOWN"


def test_conditional_offer_does_not_apply_without_identity_and_conditions(sample):
    result = next(r for r in policy.evaluate(sample, as_of=AS_OF)["results"] if r["commitment_id"] == "uk:dc:support-offer")
    assert result["statement_type"] == "CONDITIONAL_OFFER" and result["conditions"]
    assert result["state"] == "UNKNOWN" and result["comparison"] is None


@pytest.mark.parametrize("state", ["DRAFT", "IN_PROGRESS", "UNKNOWN"])
def test_incomplete_instrument_cannot_become_an_adopted_result(numeric, state):
    numeric["documents"][0]["document_state"] = state
    assert only_result(numeric)["state"] == "UNKNOWN"


def test_future_deadline_is_not_yet_due_but_missing_overdue_evidence_is_unknown(numeric):
    numeric["updates"] = []
    numeric["commitments"][0]["deadline"] = {"value": "2027", "wording": "by 2027"}
    assert only_result(numeric)["state"] == "NOT_YET_DUE"
    assert policy.evaluate(numeric, as_of="2027-06-01T00:00:00Z")["results"][0]["state"] == "UNKNOWN"
    numeric["commitments"][0]["deadline"] = {"value": "2026-10-31", "wording": "by 31 October 2026"}
    assert only_result(numeric)["state"] == "UNKNOWN"


@pytest.mark.parametrize("change", [
    lambda c: c.update(unit="GW", original_unit="GW"),
    lambda c: c.update(metric="Contracted site load"),
    lambda c: c.update(quantity_kind="secured_connection"),
    lambda c: c.update(reporting_period={"start": "2026-01", "end": "2026-10"}),
    lambda c: c["entity"].update(consolidation_group_id="group:different"),
])
def test_incompatible_measurement_returns_unknown_instead_of_converting(numeric, change):
    change(numeric["updates"][0]["claim"])
    result = only_result(numeric)
    assert result["state"] == "UNKNOWN" and result["comparison"] is None
    assert "incompatible" in result["reasons"][0]


def test_finance_announcement_cannot_substitute_for_disbursement(numeric):
    for claim in (numeric["commitments"][0]["target"], numeric["updates"][0]["claim"]):
        claim.update(quantity_kind="finance", metric="Disbursed project funding", unit="currency",
                     original_unit="pounds sterling", currency="GBP", finance_stage="disbursed")
    numeric["commitments"][0]["metric"]["label"] = "Disbursed project funding"
    numeric["updates"][0]["claim"]["finance_stage"] = "announced"
    result = only_result(numeric)
    assert result["state"] == "UNKNOWN" and "finance_stage" in result["reasons"][0]


def test_reported_or_press_release_claim_is_only_reported_progress(numeric):
    numeric["updates"][0]["measurement_state"] = "REPORTED"
    numeric["documents"][1]["source_kind"] = "PRESS_RELEASE"
    assert only_result(numeric)["state"] == "REPORTED_PROGRESS"
    numeric["updates"][0]["measurement_state"] = "DOCUMENTED_MEASUREMENT"
    with pytest.raises(ValueError, match="cannot certify"):
        policy.validate_ledger(numeric)


def test_changed_baseline_and_old_revision_do_not_transfer_measurement(numeric):
    prior = copy.deepcopy(numeric["commitments"][0])
    prior["id"] = "prior:site"
    prior["target"]["claim_id"] = "figure:prior"
    numeric["commitments"].append(prior)
    numeric["commitments"][0]["revision"] = {"id": "revised", "supersedes_commitment_id": "prior:site", "baseline_changed": True}
    result = next(r for r in policy.evaluate(numeric, as_of=AS_OF)["results"] if r["commitment_id"] == "commitment:site")
    assert result["state"] == "UNKNOWN" and "revision" in result["reasons"][0]
    assert len(policy.evaluate(numeric, as_of=AS_OF)["results"]) == 2
    old = next(r for r in policy.evaluate(numeric, as_of=AS_OF)["results"] if r["commitment_id"] == "prior:site")
    assert old["state"] == "UNKNOWN" and old["superseded_by"] == ["commitment:site"]


@pytest.mark.parametrize("kind", ["CORRECTION", "CONTRADICTION"])
def test_unresolved_source_corrections_remain_visible(numeric, kind):
    update = copy.deepcopy(numeric["updates"][0])
    update.update(id="update:correction", kind=kind, claim=None, measurement_state="UNKNOWN")
    numeric["updates"].append(update)
    result = only_result(numeric)
    assert result["state"] == "UNKNOWN" and len(result["updates"]) == 2


def test_conflicting_measurements_are_not_silently_selected(numeric):
    second = copy.deepcopy(numeric["updates"][0])
    second["id"] = "update:second"
    second["claim"].update(claim_id="figure:second", value="90")
    numeric["updates"].append(second)
    assert only_result(numeric)["state"] == "UNKNOWN"


@pytest.mark.parametrize("change", [
    lambda x: x.update(contacts=["unrequested personal field"]),
    lambda x: x.update(commitments=[]),
    lambda x: x["commitments"][0]["target"].update(unit="ratio"),
    lambda x: x["commitments"][0]["target"].update(value=100.0),
    lambda x: x["updates"][0]["claim"]["entity"].update(id="site:unrelated"),
    lambda x: x["updates"][0]["claim"]["provenance"].update(sha256="c" * 64),
    lambda x: x["updates"][0]["source"].update(locator="unread section"),
    lambda x: x["documents"][1].update(document_state="DRAFT"),
    lambda x: x["updates"][0].update(reported_on="2030-01-01"),
    lambda x: x["updates"][0].update(reported_on="2026-10-01"),
    lambda x: x["documents"][0].update(url="https://127.1/private"),
    lambda x: x["commitments"][0]["applicability"].update(evidence=[]),
    lambda x: x["commitments"][0]["revision"].update(supersedes_commitment_id="commitment:site"),
    lambda x: x["commitments"][0]["metric"].update(numeric_support="UNSUPPORTED", limitation="Unsupported metric"),
])
def test_bad_contracts_fail_closed(numeric, change):
    change(numeric)
    with pytest.raises(ValueError):
        policy.evaluate(numeric, as_of=AS_OF)


def test_future_review_clock_fails_closed(numeric):
    with pytest.raises(ValueError, match="follows evaluation"):
        policy.evaluate(numeric, as_of="2026-11-15T00:00:00Z")


def test_json_csv_are_stable_traceable_and_spreadsheet_safe(numeric):
    numeric["documents"][0]["issuer"] = numeric["commitments"][0]["issuer"] = "=unsafe()"
    report = policy.evaluate(numeric, as_of=AS_OF)
    assert policy.dumps_report(report) == policy.dumps_report(policy.evaluate(numeric, as_of=AS_OF))
    csv_rows = list(csv.DictReader(io.StringIO(policy.csv_report(report))))
    assert len(csv_rows) == 1 and csv_rows[0]["issuer"] == "'=unsafe()"
    assert json.loads(csv_rows[0]["target"])["value"] == "100.00"
    assert json.loads(csv_rows[0]["source"])["content_sha256"] == "a" * 64
    assert json.loads(csv_rows[0]["updates"])[0]["reported_on"] == "2026-11-15"


def test_cli_emits_json_and_csv_without_writing_or_network(sample, monkeypatch, capsys):
    import socket
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: pytest.fail("Unexpected network"))
    for format in ("json", "csv"):
        assert policy.main(["--as-of", AS_OF, "--format", format]) == 0
        output = capsys.readouterr().out
        assert str(ROOT) not in output
        if format == "json":
            assert len(json.loads(output)["results"]) == 8
        else:
            assert len(list(csv.DictReader(io.StringIO(output)))) == 8


def test_target_cannot_borrow_an_unrelated_read_source(numeric):
    measured = numeric["updates"][0]["claim"]
    numeric["commitments"][0]["target"]["provenance"] = copy.deepcopy(measured["provenance"])
    with pytest.raises(ValueError, match="Target claim differs"):
        policy.validate_ledger(numeric)


def test_update_claim_and_statement_must_use_same_read_locator(numeric):
    numeric["documents"][1]["read_coverage"]["locators"].append("another table")
    numeric["updates"][0]["source"]["locator"] = "another table"
    with pytest.raises(ValueError, match="Update claim source differs"):
        policy.validate_ledger(numeric)


def test_restatement_requires_reconciliation_without_replacing_old_values(numeric):
    numeric["updates"][0]["claim"]["revision"] = {
        "id": "restatement", "supersedes_claim_id": "figure:earlier", "restated": True}
    result = only_result(numeric)
    assert result["state"] == "UNKNOWN" and "reconciliation" in result["reasons"][0]
    assert result["updates"][0]["claim"]["value"] == "120.00"


def test_history_inventory_covers_bounded_primary_chain_without_claiming_missing_bytes():
    history = json.loads((HERE / "historical_sources.json").read_text(encoding="utf-8"))
    assert history["schema"] == "globalgrid2050.policy-history.sources.v1"
    assert len(history["sources"]) == 10
    assert len({s["id"] for s in history["sources"]}) == 10
    assert all(s["content_sha256"] is None and s["retrieved_at"] is None for s in history["sources"])
    assert all(s["read_coverage"]["locators"] for s in history["sources"])
    assert all(s["document_state"] != "ADOPTED" or "agenda" in s["title"].lower()
               for s in history["sources"] if "cop31" in s["id"].lower())
