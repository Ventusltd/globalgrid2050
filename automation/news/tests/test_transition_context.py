"""Actual typed producers composed offline; no live source acquisition."""
from copy import deepcopy
import csv
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

import pytest

from automation.news import build_transition_context as context
from automation.news.dc_context import grid, solar
from automation.news.policy_commitments import ledger as policy
from automation.news.tests.test_policy_commitments import numeric  # existing synthetic fixture

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[1]
AS_OF = "2026-11-16T18:00:00Z"
PATHS = {"policy": HERE / "policy_commitments/sample_ledger.json",
         "grid": HERE / "dc_context/grid-source-fixture.json",
         "solar": HERE / "dc_context/fixtures/solar-context.json"}


@pytest.fixture
def inputs():
    return {name: json.loads(path.read_text(encoding="utf-8")) for name, path in PATHS.items()}


def compose(inputs, **kwargs):
    return context.build(inputs["policy"], inputs["grid"], inputs["solar"], as_of=kwargs.get("as_of", AS_OF))


def rows(report, family):
    return [row for row in report["records"] if row["family"] == family]


def grid_claim(inputs):
    return next(row["numeric_claims"][0] for row in inputs["grid"]["contexts"] if row["numeric_claims"])


def command(paths=None, *extra):
    paths = paths or PATHS
    return [sys.executable, "-B", "-X", "utf8", "-m", "automation.news.build_transition_context",
            "--policy", str(paths["policy"]), "--grid", str(paths["grid"]), "--solar", str(paths["solar"]),
            "--as-of", AS_OF, *extra]


def test_actual_fourteen_contexts_remain_unlinked_and_provisional(inputs):
    before = deepcopy(inputs)
    report = compose(inputs)
    assert report["schema"] == context.SCHEMA and report["status"] == "PROVISIONAL"
    assert report["coverage"] == {"records": 14, "families": {"policy": 8, "grid": 2, "solar": 4},
                                  "numeric_claims": 3, "linked_projects": 0, "scope": "BOUNDED_SUPPLIED_CONTEXT"}
    assert all(row["scope"]["canonical_project_id"] is None and row["scope"]["binding"] == "UNLINKED"
               for row in report["records"])
    assert [row["evaluation_state"] for row in rows(report, "policy")].count("UNKNOWN") == 7
    assert [row["evaluation_state"] for row in rows(report, "policy")].count("REPORTED_PROGRESS") == 1
    assert all(row["evaluation_state"] == row["applicability_state"] == "UNKNOWN"
               for row in rows(report, "grid") + rows(report, "solar"))
    assert inputs == before
    report["records"][0]["native_record"]["name"] = "changed copy"
    assert inputs == before


def test_native_records_and_source_receipts_survive_exactly(inputs):
    report = compose(inputs)
    assert [row["native_record"] for row in rows(report, "policy")] == policy.evaluate(inputs["policy"], as_of=AS_OF)["results"]
    assert [row["native_record"] for row in rows(report, "grid")] == grid.build(inputs["grid"], as_of=AS_OF)["records"]
    assert [row["native_record"] for row in rows(report, "solar")] == solar.build(inputs["solar"], as_of=AS_OF)["records"]
    for row in report["records"]:
        for link in row["source_links"]:
            assert link["url"] == link["receipt"]["url"]
            assert link["retrieved_at"] == link["receipt"]["retrieved_at"]
    assert all(item["source_byte_validation"] == "RECEIPTS_ONLY" for item in report["input_receipts"])
    for receipt in report["input_receipts"]:
        family = receipt["family"]
        reconstructed = {**receipt["native_metadata"],
                         "results" if family == "policy" else "records": [row["native_record"] for row in rows(report, family)]}
        original = (policy.evaluate(inputs[family], as_of=AS_OF) if family == "policy"
                    else (grid if family == "grid" else solar).build(inputs[family], as_of=AS_OF))
        assert reconstructed == original


def test_rejection_forecast_upper_bound_and_missing_capacity_are_not_delivered(inputs):
    report = compose(inputs)
    rejected = next(row for row in rows(report, "grid") if row["source_state"] == "REJECTED")
    figure = rejected["numeric_claims"][0]
    assert figure["qualifier"] is None and figure["claim"]["value"] == "480"
    assert figure["claim"]["basis"] == "forecast" and figure["claim"]["quantity_kind"] == "project_demand"
    battery = next(row for row in rows(report, "solar") if "storage:google-nevada" in row["id"])
    assert battery["numeric_claims"][0]["qualifier"] == "upper_bound"
    assert battery["numeric_claims"][0]["claim"]["as_of"] == "2024"
    assert battery["native_record"]["current_delivery"] == "UNKNOWN"
    missing = next(row for row in rows(report, "solar") if "livingston" in row["id"])
    assert missing["numeric_claims"] == [] and missing["native_record"]["current_site_supply_mw"] is None
    assert missing["source_links"][0]["published_date"] is None


def test_scope_categories_do_not_allocate_portfolio_to_site(inputs):
    report = compose(inputs)
    portfolio = next(row for row in rows(report, "solar") if "shell" in row["id"])
    assert portfolio["scope"]["kind"] == "portfolio"
    assert portfolio["scope"]["native_scope"] == "issuer"
    assert portfolio["numeric_claims"] == []
    zone = next(row for row in rows(report, "grid") if row["scope"]["native_scope"] == "zone")
    assert zone["scope"]["kind"] == "UNKNOWN"
    assert all(row["scope"]["kind"] == "policy" for row in rows(report, "policy"))


def test_unknown_original_hash_and_clocks_are_not_fabricated(inputs):
    report = compose(inputs)
    metadata = report["input_receipts"][0]["native_metadata"]
    cop = next(doc for doc in metadata["documents"] if doc["document_state"] == "IN_PROGRESS")
    assert cop["published_on"] is cop["retrieved_at"] is cop["content_sha256"] is None
    assert cop["reviewed_at"] == "2026-11-16T17:16:51Z" and cop["hash_limitation"]
    answer = next(link for row in rows(report, "policy") for link in row["source_links"]
                  if link["receipt"]["source_kind"] == "OFFICIAL_ANSWER")
    assert answer["sha256"] is answer["retrieved_at"] is None


def test_deterministic_complete_input_digests_and_dates(inputs):
    first = compose(inputs)
    assert context.dumps(first) == context.dumps(compose(inputs))
    for receipt in first["input_receipts"]:
        raw = context.dumps(inputs[receipt["family"]]).encode("utf-8")
        assert receipt["input_sha256"] == hashlib.sha256(raw).hexdigest()
    changed = deepcopy(inputs)
    changed["policy"]["coverage_note"] += " Additional bounded review note."
    second = compose(changed)
    assert first["input_receipts"][0]["input_sha256"] != second["input_receipts"][0]["input_sha256"]
    later = compose(inputs, as_of="2026-12-16T18:00:00Z")
    assert [row["source_links"] for row in first["records"]] == [row["source_links"] for row in later["records"]]


def test_exact_large_decimals_and_comparison_remain_shared_figures(inputs, numeric):
    numeric["commitments"][0]["target"]["value"] = "9007199254740993.010"
    numeric["updates"][0]["claim"]["value"] = "9007199254740993.011"
    inputs["policy"] = numeric
    row = rows(compose(inputs), "policy")[0]
    assert row["evaluation_state"] == "EVIDENCE_SUPPORTED_RESULT"
    assert row["native_record"]["comparison"]["relation"] == "GREATER_THAN"
    assert row["native_record"]["legal_compliance"] == "NOT_ASSESSED"
    assert [(f["role"], f["claim"]["value"]) for f in row["numeric_claims"]] == [
        ("TARGET", "9007199254740993.010"), ("UPDATE", "9007199254740993.011")]
    assert row["scope"]["kind"] == "project" and row["scope"]["binding"] == "UNLINKED"


@pytest.mark.parametrize("field,value", [("unit", "GW"), ("reporting_period", {"start": "2026-01", "end": "2026-10"})])
def test_incompatible_measurements_do_not_become_results(inputs, numeric, field, value):
    numeric["updates"][0]["claim"][field] = value
    inputs["policy"] = numeric
    assert rows(compose(inputs), "policy")[0]["evaluation_state"] == "UNKNOWN"


@pytest.mark.parametrize("observed_stage,expected", [("announced", "UNKNOWN"), ("disbursed", "EVIDENCE_SUPPORTED_RESULT")])
def test_finance_stages_are_preserved_without_delivery_inference(inputs, numeric, observed_stage, expected):
    target, actual = numeric["commitments"][0]["target"], numeric["updates"][0]["claim"]
    for claim in (target, actual):
        claim.update(quantity_kind="finance", unit="currency", original_unit="euros", currency="EUR", finance_stage="disbursed")
    actual["finance_stage"] = observed_stage
    inputs["policy"] = numeric
    row = rows(compose(inputs), "policy")[0]
    assert row["evaluation_state"] == expected
    assert row["numeric_claims"][1]["claim"]["finance_stage"] == observed_stage
    assert row["native_record"]["legal_compliance"] == "NOT_ASSESSED"


@pytest.mark.parametrize("change", ["draft", "unknown_applicability", "baseline_revision"])
def test_policy_uncertainties_survive_composition(inputs, numeric, change):
    if change == "draft":
        numeric["documents"][0]["document_state"] = "DRAFT"
    elif change == "unknown_applicability":
        numeric["commitments"][0]["applicability"]["state"] = "UNKNOWN"
    else:
        numeric["updates"][0]["baseline_revision_id"] = "earlier"
    inputs["policy"] = numeric
    row = rows(compose(inputs), "policy")[0]
    assert row["evaluation_state"] == "UNKNOWN" and row["native_record"]["comparison"] is None


def test_issuer_scope_stays_issuer_and_future_deadline_is_not_delivery(inputs, numeric):
    entity = inputs["solar"]["contexts"][0]["entity"]
    entity["scope"] = "issuer"
    inputs["solar"]["contexts"][0]["numeric_claims"][0]["claim"]["entity"] = deepcopy(entity)
    numeric["updates"] = []
    numeric["commitments"][0]["deadline"] = {"value": "2027", "wording": "by 2027"}
    inputs["policy"] = numeric
    report = compose(inputs)
    assert rows(report, "policy")[0]["evaluation_state"] == "NOT_YET_DUE"
    assert next(row for row in rows(report, "solar") if row["id"] == "solar:solar:google-nevada-2021")["scope"]["kind"] == "issuer"


def test_csv_roundtrip_preserves_whole_bundle_and_formula_safety(inputs):
    inputs["policy"]["commitments"][0]["statement"] = '=SUM(1,2) "Türkiye €"'
    report = compose(inputs)
    exported = list(csv.DictReader(io.StringIO(context.csv_report(report))))
    assert len(exported) == len(report["records"])
    for flat, row in zip(exported, report["records"]):
        assert json.loads(flat["bundle"]) == {k: v for k, v in report.items() if k != "records"}
        for key, value in row.items():
            if isinstance(value, (dict, list)):
                assert json.loads(flat[key]) == value
            else:
                assert flat[key] == ("'" + value if value.startswith(("=", "+", "-", "@", "\t", "\r")) else value)


@pytest.mark.parametrize("family,field", [("policy", "commitments"), ("grid", "contexts"), ("solar", "contexts")])
def test_empty_family_fails_whole_composition(inputs, family, field):
    inputs[family][field] = []
    with pytest.raises(ValueError):
        compose(inputs)


@pytest.mark.parametrize("mutation", [
    lambda x: grid_claim(x).update(value=480),
    lambda x: x["solar"]["contexts"][0]["numeric_claims"][0].update(qualifier="delivered"),
    lambda x: x["grid"]["sources"][0].update(url="javascript:alert(1)"),
    lambda x: x["policy"]["documents"][0].update(reviewed_at="2027-01-01T00:00:00Z"),
    lambda x: x["solar"]["contexts"][0]["numeric_claims"][0]["claim"]["provenance"].update(sha256="0" * 64),
    lambda x: x["grid"]["contexts"][0].update(canonical_project_id="invented"),
])
def test_invalid_input_fails_closed(inputs, mutation):
    mutation(inputs)
    with pytest.raises((ValueError, KeyError, TypeError)):
        compose(inputs)


def test_cross_family_repeated_claim_identity_is_not_corroboration(inputs):
    duplicate = grid_claim(inputs)["claim_id"]
    inputs["solar"]["contexts"][0]["numeric_claims"][0]["claim"]["claim_id"] = duplicate
    with pytest.raises(ValueError, match="Repeated FIGURES"):
        compose(inputs)


@pytest.mark.parametrize("format", ["json", "csv"])
def test_real_cli_utf8_export_and_no_overwrite(tmp_path, format):
    destination = tmp_path / ("context." + format)
    result = subprocess.run(command(None, "--format", format, "--output", str(destination)), cwd=ROOT, capture_output=True)
    assert result.returncode == 0 and result.stdout == b""
    original = destination.read_bytes()
    decoded = original.decode("utf-8")
    assert len(json.loads(decoded)["records"] if format == "json" else list(csv.DictReader(io.StringIO(decoded)))) == 14
    second = subprocess.run(command(None, "--format", format, "--output", str(destination)), cwd=ROOT, capture_output=True)
    assert second.returncode != 0 and second.stdout == b"" and destination.read_bytes() == original


@pytest.mark.parametrize("payload", [b'{"schema":"x","schema":"y"}', b'{bad json', b'{}', b'[]'])
def test_cli_invalid_input_emits_no_stdout_or_file(tmp_path, payload):
    invalid = tmp_path / "invalid.json"
    invalid.write_bytes(payload)
    output = tmp_path / "output.json"
    result = subprocess.run(command({**PATHS, "solar": invalid}, "--output", str(output)), cwd=ROOT, capture_output=True)
    assert result.returncode != 0 and result.stdout == b"" and not output.exists()
    assert b"Traceback" not in result.stderr


def test_cli_missing_file_and_oversized_inputs_fail(tmp_path):
    invalid = tmp_path / "missing.json"
    output = tmp_path / "output.json"
    for raw in (None, b" " * (context.MAX_INPUT_BYTES + 1)):
        if raw is not None:
            invalid.write_bytes(raw)
        result = subprocess.run(command({**PATHS, "grid": invalid}, "--output", str(output)), cwd=ROOT, capture_output=True)
        assert result.returncode != 0 and result.stdout == b"" and not output.exists()


def test_library_size_bound_fails_before_returning_partial_report(inputs, monkeypatch):
    monkeypatch.setattr(context, "MAX_OUTPUT_BYTES", 100)
    with pytest.raises(ValueError, match="bounded size"):
        compose(inputs)


def test_csv_repeated_metadata_is_bounded_during_serialization(inputs, monkeypatch):
    report = compose(inputs)
    monkeypatch.setattr(context, "MAX_OUTPUT_BYTES", 1000)
    with pytest.raises(ValueError, match="CSV export exceeds bounded size"):
        context.csv_report(report)


@pytest.mark.parametrize("format", ["json", "csv"])
def test_cli_unicode_quotes_and_formula_prefix_survive(inputs, tmp_path, format):
    statement = '=SUM(1,2) "Türkiye €"'
    inputs["policy"]["commitments"][0]["statement"] = statement
    input_path = tmp_path / "policy.json"
    input_path.write_text(json.dumps(inputs["policy"], ensure_ascii=False), encoding="utf-8")
    result = subprocess.run(command({**PATHS, "policy": input_path}, "--format", format), cwd=ROOT, capture_output=True)
    assert result.returncode == 0
    text = result.stdout.decode("utf-8")
    if format == "json":
        assert any(row["title"] == statement for row in json.loads(text)["records"])
    else:
        parsed = list(csv.DictReader(io.StringIO(text)))
        assert any(row["title"] == "'" + statement for row in parsed)


def test_partial_disk_write_leaves_no_published_file_or_staging_file(tmp_path, monkeypatch, capsys):
    destination = tmp_path / "new.json"
    original = context.os.fdopen
    observed = []

    class FailingWriter:
        def __init__(self, descriptor, mode):
            self.handle = original(descriptor, mode)

        def __enter__(self):
            return self

        def write(self, raw):
            fragment = raw[:len(raw) // 2]
            self.handle.write(fragment)
            self.handle.flush()
            staged = list(tmp_path.glob(".transition-context-*.tmp"))
            assert len(staged) == 1 and staged[0].read_bytes() == fragment
            observed.append(len(fragment))
            raise OSError("Simulated interrupted disk write")

        def __exit__(self, *args):
            self.handle.close()

    monkeypatch.setattr(context.os, "fdopen", FailingWriter)
    with pytest.raises(SystemExit) as error:
        context.main(command(None, "--output", str(destination))[6:])
    assert error.value.code == 2 and observed and observed[0] > 0
    assert not destination.exists() and list(tmp_path.iterdir()) == []
    assert capsys.readouterr().out == ""


def test_concurrent_destination_creation_is_preserved(tmp_path, monkeypatch):
    destination = tmp_path / "raced.json"
    link = context.os.link

    def race(source, target):
        destination.write_bytes(b"existing winner")
        return link(source, target)

    monkeypatch.setattr(context.os, "link", race)
    with pytest.raises(FileExistsError):
        context._publish_new(destination, b"candidate")
    assert destination.read_bytes() == b"existing winner"
    assert list(tmp_path.iterdir()) == [destination]


def test_unsupported_atomic_link_fails_without_fallback(tmp_path, monkeypatch):
    destination = tmp_path / "unsupported.json"

    def unavailable(*args):
        raise OSError("Hard links unavailable")

    monkeypatch.setattr(context.os, "link", unavailable)
    with pytest.raises(OSError):
        context._publish_new(destination, b"candidate")
    assert not destination.exists() and list(tmp_path.iterdir()) == []
