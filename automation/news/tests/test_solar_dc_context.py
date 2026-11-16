"""Offline primary-source fixture and adversarial solar/DC scope tests."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

from automation.news.dc_context.solar import build, dumps, verify_source_bytes

FIXTURE = Path(__file__).resolve().parents[1] / "dc_context/fixtures/solar-context.json"
NOW = "2026-11-16T17:30:00Z"


@pytest.fixture
def bundle():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def claim(bundle, index=0):
    return bundle["contexts"][index]["numeric_claims"][0]["claim"]


def test_real_receipt_slice_preserves_forecast_bounds_and_source_scope(bundle):
    original = deepcopy(bundle)
    output = build(bundle, as_of=NOW)
    assert output["context_count"] == 4
    assert output["numeric_claim_count"] == 2
    assert output["linked_project_count"] == 0
    assert output["source_byte_validation"] == "RECEIPTS_ONLY"
    by_id = {r["id"]: r for r in output["records"]}
    solar = by_id["solar:google-nevada-2021"]["numeric_claims"][0]
    battery = by_id["storage:google-nevada-2021"]["numeric_claims"][0]
    assert solar["claim"]["value"] == "350"
    assert battery["claim"]["value"] == "280"
    assert battery["qualifier"] == "upper_bound"
    assert battery["claim"]["quantity_kind"] == "storage_power"
    assert battery["claim"]["unit"] == "MW"
    assert battery["claim"]["basis"] == "forecast"
    assert battery["claim"]["as_of"] == "2024"
    assert by_id["storage:google-uk-shell-2025"]["entity"]["scope"] == "issuer"
    livingston = by_id["solar:sma-iron-mountain-livingston"]
    assert livingston["numeric_claims"] == []
    assert livingston["source_document_age_days"] is None
    assert livingston["source_as_of"] == "2020-03"
    assert "unresolved" in livingston["figures_omitted_reason"]
    for row in output["records"]:
        assert row["status"] == "PROVISIONAL"
        assert row["current_delivery"] == "UNKNOWN"
        assert row["canonical_project_id"] is None
        assert row["current_site_supply_mw"] is None
        assert row["current_storage_energy_mwh"] is None
    assert bundle == original
    output["records"][0]["source"]["title"] = "mutation"
    assert bundle == original


def test_deterministic_order_and_json(bundle):
    expected = dumps(build(bundle, as_of=NOW))
    bundle["sources"].reverse()
    bundle["contexts"].reverse()
    assert dumps(build(bundle, as_of=NOW)) == expected


@pytest.mark.parametrize("mutation", [
    lambda b: b.update(body="private hidden payload"),
    lambda b: b["contexts"][0].update(canonical_project_id="repd:1018"),
    lambda b: b["contexts"][0].update(relationship="nearby_solar"),
    lambda b: b["contexts"][0].update(source_state="VERIFIED"),
    lambda b: b["contexts"][0].update(source_id="missing"),
    lambda b: b["contexts"][0].update(section=None, page=None),
    lambda b: b["contexts"][0].update(name="<script>"),
    lambda b: b["contexts"][0].update(source_as_of="2027-01-01"),
    lambda b: b["contexts"][0].update(numeric_claims=[], figures_omitted_reason=None),
    lambda b: b["contexts"][0].update(figures_omitted_reason="unknown"),
    lambda b: b["contexts"][2]["entity"].update(scope="site"),
    lambda b: b["contexts"][3]["entity"].update(scope="issuer"),
    lambda b: b["sources"][0].update(http_status=403),
    lambda b: b["sources"][0].update(http_status=True),
    lambda b: b["sources"][0].update(bytes=0),
    lambda b: b["sources"][0].update(retrieved_at="2026-12-01T00:00:00Z"),
    lambda b: b["sources"][0].update(published_date="2027-01-01"),
    lambda b: b["sources"][0].update(sha256="bad"),
    lambda b: b["sources"][0].update(url="https://www.epa.gov.evil.example/document"),
    lambda b: b["sources"][0].update(url="https://127.0.0.1/document"),
    lambda b: b["sources"][0].update(authority="GOVERNMENT_VERIFIED"),
    lambda b: b["sources"][0].update(output_policy="FULL_BODY"),
    lambda b: b["sources"].append(deepcopy(b["sources"][0])),
    lambda b: b["contexts"].append(deepcopy(b["contexts"][0])),
    lambda b: claim(b).update(status="VERIFIED"),
    lambda b: claim(b).update(value=350.0),
    lambda b: claim(b).update(value="NaN"),
    lambda b: claim(b).update(quantity_kind="it_load"),
    lambda b: claim(b).update(basis="reported"),
    lambda b: claim(b).update(assurance="audited"),
    lambda b: claim(b)["entity"].update(scope="site"),
    lambda b: claim(b)["provenance"].update(sha256="0" * 64),
    lambda b: claim(b)["provenance"].update(section="Another scope"),
    lambda b: claim(b, 1).update(unit="MWh"),
    lambda b: b["contexts"][1]["numeric_claims"][0].update(qualifier=None),
    lambda b: b["contexts"][1]["numeric_claims"][0].pop("qualifier"),
])
def test_rejects_scope_unit_proximity_source_and_verification_tampering(bundle, mutation):
    mutation(bundle)
    with pytest.raises(ValueError):
        build(bundle, as_of=NOW)


def test_all_supplied_source_bytes_required_and_checked(bundle):
    # Explicit synthetic bytes test the contract; not replacements for real receipts.
    supplied = {}
    for source in bundle["sources"]:
        raw = ("SYNTHETIC SOURCE " + source["id"]).encode()
        supplied[source["id"]] = raw
        source.update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
        for context in bundle["contexts"]:
            if context["source_id"] == source["id"]:
                for figure in context["numeric_claims"]:
                    figure["claim"]["provenance"]["sha256"] = source["sha256"]
    result = build(bundle, as_of=NOW, source_bytes=supplied)
    assert result["source_byte_validation"] == "MATCHED_SUPPLIED_BYTES"
    assert "SYNTHETIC SOURCE" not in dumps(result)
    with pytest.raises(ValueError, match="coverage"):
        build(bundle, as_of=NOW, source_bytes={})
    supplied[next(iter(supplied))] += b"tamper"
    with pytest.raises(ValueError, match="bytes"):
        build(bundle, as_of=NOW, source_bytes=supplied)


def test_source_receipt_rejects_wrong_bytes(bundle):
    with pytest.raises(ValueError, match="receipt"):
        verify_source_bytes(bundle["sources"][0], b"not observed publisher bytes")


def test_empty_coverage_is_not_success(bundle):
    bundle["contexts"] = []
    with pytest.raises(ValueError, match="nonempty"):
        build(bundle, as_of=NOW)


def test_parent_finance_stays_exact_and_stage_specific(bundle):
    # Entirely synthetic finance example; no real financial claim is asserted.
    context = bundle["contexts"][0]
    context.update(relationship="procurement_finance", source_state="ANNOUNCED")
    context["entity"].update(scope="consolidated_group", id="group:synthetic",
                              consolidation_group_id="group:synthetic")
    c = claim(bundle)
    c.update(quantity_kind="finance", metric="Synthetic planned procurement funding",
             value="1.2300", scale="1e9", unit="currency", original_unit="billion USD",
             currency="USD", finance_stage="announced", entity=deepcopy(context["entity"]))
    result = build(bundle, as_of=NOW)
    result_claim = next(r for r in result["records"] if r["id"] == context["id"])["numeric_claims"][0]["claim"]
    assert result_claim["value"] == "1.2300"
    assert result_claim["scale"] == "1e9"
    assert result_claim["currency"] == "USD"
    assert result_claim["finance_stage"] == "announced"
    c["finance_stage"] = "disbursed"
    with pytest.raises(ValueError, match="Funding stage"):
        build(bundle, as_of=NOW)


def test_cli_writes_new_artifact_and_refuses_overwrite(tmp_path):
    output = tmp_path / "context.json"
    args = [sys.executable, "-m", "automation.news.dc_context.solar", "--input", str(FIXTURE),
            "--as-of", NOW, "--output", str(output)]
    completed = subprocess.run(args, capture_output=True, text=True)
    assert completed.returncode == 0, completed.stderr
    before = output.read_bytes()
    assert json.loads(before)["context_count"] == 4
    assert subprocess.run(args, capture_output=True).returncode != 0
    assert output.read_bytes() == before
