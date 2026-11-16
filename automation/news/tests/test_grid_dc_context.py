"""Scope, state and provenance regressions for the offline GRID-DC adapter."""
from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys

import pytest

from automation.news.dc_context.grid import build, dumps

FIXTURE = Path(__file__).parents[1] / "dc_context/grid-source-fixture.json"
AS_OF = "2026-11-16T18:00:00Z"


@pytest.fixture
def bundle():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_actual_sources_keep_historical_rejection_and_unknown_current_state(bundle):
    result = build(bundle, as_of=AS_OF)
    assert result["context_count"] == 2
    assert result["numeric_claim_count"] == 1
    assert result["linked_project_count"] == 0
    ferc, culham = result["records"]
    assert ferc["source_state"] == "REJECTED"
    assert ferc["numeric_claims"][0]["value"] == "480"
    assert ferc["numeric_claims"][0]["quantity_kind"] == "project_demand"
    assert "every existing arrangement" in ferc["research_action"]
    assert culham["numeric_claims"] == []
    assert "basis" in culham["figures_omitted_reason"]
    for record in result["records"]:
        assert record["status"] == "PROVISIONAL"
        assert record["current_project_state"] == "UNKNOWN"
        assert record["source_document_age_days"] > 600
        assert record["retrieval_age_days"] == 0
        for key in ("canonical_project_id", "current_secured_connection",
                    "current_energised_load", "available_grid_capacity", "site_capex"):
            assert record[key] is None


def test_committed_replay_matches_every_output_byte(bundle):
    expected = FIXTURE.with_name("grid-context-fixture.json").read_bytes()
    assert dumps(build(bundle, as_of=AS_OF)).encode("utf-8") == expected


def test_replay_sorting_and_input_independence(bundle):
    before = deepcopy(bundle)
    first = build(bundle, as_of=AS_OF)
    assert bundle == before
    bundle["sources"].reverse()
    bundle["contexts"].reverse()
    assert dumps(build(bundle, as_of=AS_OF)) == dumps(first)
    first["records"][0]["source"]["publisher"] = "changed"
    assert build(bundle, as_of=AS_OF)["records"][0]["source"]["publisher"] != "changed"


@pytest.mark.parametrize("field,value", [
    ("http_status", 403), ("http_status", True), ("sha256", "0" * 63),
    ("bytes", 0), ("bytes", 4 * 1024 * 1024 + 1), ("bytes", True),
    ("access_state", "UNKNOWN"), ("access_state", "PAYWALLED"),
    ("output_policy", "FULL_TEXT"), ("authority", "COMPANY"),
    ("retrieved_at", "2026-11-17T00:00:00Z"),
    ("retrieved_at", "2026-11-16T12:00:00"),
    ("published_date", "2026-11-17"), ("published_date", "2025-02-30"),
    ("title", "<img src=x onerror=alert(1)>"),
])
def test_bad_source_aborts_whole_generation(bundle, field, value):
    bundle["sources"][0][field] = value
    with pytest.raises(ValueError):
        build(bundle, as_of=AS_OF)


@pytest.mark.parametrize("url", [
    "http://www.gov.uk/x", "https://www.gov.uk.evil.example/x",
    "https://www.gov.uk@127.0.0.1/x", "https://127.1/x",
    "https://www.gov.uk:8443/x", "https://www.gov.uk\\@example.com/x",
    "https://www.gov.uk/x?redirect=https://example.com", "https://www.gov.uk/x#redirect",
    "https://www.bloomberg.com/story", "https://www.gov.uk/\nfoo",
])
def test_unapproved_or_unsafe_source_urls(bundle, url):
    bundle["sources"][0]["url"] = url
    with pytest.raises(ValueError):
        build(bundle, as_of=AS_OF)


@pytest.mark.parametrize("field,value", [
    ("kind", "proximity_match"), ("source_state", "VERIFIED"),
    ("source_state", "OFFER_REPORTED"), ("entity_scope", "consolidated_group"),
    ("source_id", "missing-source"), ("name", "<script>alert(1)</script>"),
    ("country", "XX"), ("id", "../../private"),
    ("country", []), ("source_id", []), ("entity_scope", []),
])
def test_bad_context_or_unsupported_inference(bundle, field, value):
    bundle["contexts"][0][field] = value
    with pytest.raises(ValueError):
        build(bundle, as_of=AS_OF)


@pytest.mark.parametrize("kind", ["secured_connection", "energised_load", "grid_upgrade", "generation_power", "it_load"])
def test_rejected_load_request_cannot_become_connection_or_operating_power(bundle, kind):
    bundle["contexts"][1]["numeric_claims"][0]["quantity_kind"] = kind
    with pytest.raises(ValueError, match="numeric kind/basis"):
        build(bundle, as_of=AS_OF)


@pytest.mark.parametrize("key,value", [("basis", "reported"), ("value", 480), ("unit", "MWh"),
                                     ("status", "VERIFIED"), ("assurance", "audited")])
def test_shared_figures_semantics_preserved(bundle, key, value):
    bundle["contexts"][1]["numeric_claims"][0][key] = value
    with pytest.raises(ValueError):
        build(bundle, as_of=AS_OF)


@pytest.mark.parametrize("part,key,value", [
    ("entity", "id", "repd:1018"), ("entity", "scope", "site"),
    ("entity", "consolidation_group_id", "group:parent"),
    ("entity", "identity_evidence_url", "https://www.gov.uk/another-project"),
    ("provenance", "document_id", "ferc:different-docket"),
    ("provenance", "sha256", "a" * 64), ("provenance", "page", "2"),
    ("provenance", "section", "Another section"),
    ("provenance", "published_date", "2024-10-31"),
    ("provenance", "retrieved_at", "2026-11-16T17:13:22Z"),
])
def test_cannot_move_figures_between_entities_documents_or_clocks(bundle, part, key, value):
    bundle["contexts"][1]["numeric_claims"][0][part][key] = value
    with pytest.raises(ValueError, match="mismatch"):
        build(bundle, as_of=AS_OF)


@pytest.mark.parametrize("part", ["sources", "contexts"])
def test_duplicate_identifiers_rejected(bundle, part):
    bundle[part].append(deepcopy(bundle[part][0]))
    with pytest.raises(ValueError, match="duplicate"):
        build(bundle, as_of=AS_OF)


def test_no_private_fields_or_implicit_binding_are_passed_through(bundle):
    bundle["contexts"][0]["canonical_project_id"] = "DC-WD-Q123"
    with pytest.raises(ValueError, match="unexpected fields"):
        build(bundle, as_of=AS_OF)


def test_unknown_clock_and_missing_locator_fail_closed(bundle):
    with pytest.raises(ValueError, match="UTC timestamp"):
        build(bundle, as_of="2026-11-16")
    bundle["contexts"][0]["section"] = None
    with pytest.raises(ValueError, match="locator required"):
        build(bundle, as_of=AS_OF)


def test_retrieval_does_not_refresh_the_source_claim(bundle):
    original = build(bundle, as_of=AS_OF)
    newer = "2026-11-16T17:59:00Z"
    bundle["sources"][0]["retrieved_at"] = newer
    replay = build(bundle, as_of=AS_OF)
    assert replay["records"][1]["source_document_age_days"] == original["records"][1]["source_document_age_days"]
    assert replay["records"][1]["current_project_state"] == "UNKNOWN"


def test_exact_value_lexical_precision_is_not_rounded(bundle):
    bundle["contexts"][1]["numeric_claims"][0]["value"] = "480.00"
    result = build(bundle, as_of=AS_OF)
    assert result["records"][0]["numeric_claims"][0]["value"] == "480.00"


@pytest.mark.parametrize("kind,state,quantity,basis", [
    ("connection_offer", "OFFER_REPORTED", "secured_connection", "reported"),
    ("energisation_report", "ENERGISED_REPORTED", "energised_load", "reported"),
    ("grid_upgrade", "PLANNED", "grid_upgrade", "forecast"),
    ("grid_upgrade", "COMMISSIONED_REPORTED", "grid_upgrade", "reported"),
])
def test_synthetic_source_states_do_not_claim_current_connection(bundle, kind, state, quantity, basis):
    # Synthetic schema cases only: these do not reinterpret the real FERC order.
    context = bundle["contexts"][1]
    context["kind"], context["source_state"] = kind, state
    claim = context["numeric_claims"][0]
    claim["quantity_kind"], claim["basis"] = quantity, basis
    record = build(bundle, as_of=AS_OF)["records"][0]
    assert record["source_state"] == state
    assert record["numeric_claims"][0]["quantity_kind"] == quantity
    assert record["current_secured_connection"] is None
    assert record["current_project_state"] == "UNKNOWN"


@pytest.mark.parametrize("state", ["ANNOUNCED", "COMMITTED", "DISBURSED"])
def test_synthetic_funding_keeps_stage_without_allocating_capex(bundle, state):
    context = bundle["contexts"][1]
    context["kind"], context["source_state"] = "funding", state
    claim = context["numeric_claims"][0]
    claim.update(quantity_kind="finance", basis="reported", unit="currency", original_unit="US dollars",
                 currency="USD", finance_stage=state.lower(), value="1.20", scale="1e9")
    record = build(bundle, as_of=AS_OF)["records"][0]
    assert record["numeric_claims"][0]["finance_stage"] == state.lower()
    assert record["site_capex"] is None
    claim["finance_stage"] = "reported"
    with pytest.raises(ValueError, match="finance stage mismatch"):
        build(bundle, as_of=AS_OF)


def test_cli_writes_new_artifact_and_refuses_overwrite(tmp_path):
    output = tmp_path / "grid-context.json"
    command = [sys.executable, "-m", "automation.news.dc_context.grid", "--input", str(FIXTURE),
               "--as-of", AS_OF, "--output", str(output)]
    first = subprocess.run(command, capture_output=True, text=True)
    assert first.returncode == 0, first.stderr
    original = output.read_bytes()
    second = subprocess.run(command, capture_output=True, text=True)
    assert second.returncode != 0
    assert output.read_bytes() == original
    payload = json.loads(original)
    assert payload["context_count"] == 2
    assert payload["numeric_claim_count"] == 1


def test_failed_input_does_not_create_output(tmp_path, bundle):
    bundle["sources"][1]["http_status"] = 403
    source = tmp_path / "broken.json"
    source.write_text(json.dumps(bundle), encoding="utf-8")
    output = tmp_path / "output.json"
    result = subprocess.run([sys.executable, "-m", "automation.news.dc_context.grid", "--input", str(source),
                             "--as-of", AS_OF, "--output", str(output)], capture_output=True, text=True)
    assert result.returncode != 0
    assert not output.exists()
