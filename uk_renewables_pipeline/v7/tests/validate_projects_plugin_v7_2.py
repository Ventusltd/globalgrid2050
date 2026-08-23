#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
V7 = ROOT / "uk_renewables_pipeline/v7"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the frozen V7.2 projects-plugin contract.")
    parser.add_argument("--phase", choices=("spec", "integrated"), default="spec")
    return parser.parse_args()


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def is_iso_date_or_none(value: Any) -> bool:
    if value is None:
        return True
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def searchable(record: dict[str, Any], fields: list[str], query: str) -> bool:
    needle = query.casefold()
    values: list[str] = []
    for field in fields:
        value = record.get(field)
        if isinstance(value, list):
            values.extend(str(item) for item in value)
        elif value is not None:
            values.append(str(value))
    return any(needle in value.casefold() for value in values)


def search_records(records: list[dict[str, Any]], fields: list[str], query: str) -> list[dict[str, Any]]:
    needle = query.casefold()
    direct = [
        record for record in records
        if str(record.get("repd_ref", "")).casefold() == needle
        or str(record.get("gg_project_id", "")).casefold() == needle
    ]
    return direct or [record for record in records if searchable(record, fields, query)]


def lifecycle_partition(record: dict[str, Any]) -> str:
    lifecycle = record["lifecycle"]
    status = record["status"]
    if lifecycle in {"LIVE_PRE_CONSTRUCTION", "UNDER_CONSTRUCTION", "OPERATIONAL"}:
        return "CURRENT"
    if lifecycle == "INACTIVE":
        return "HISTORICAL"
    if lifecycle == "UNKNOWN" and status == "Appeal Lodged":
        return "DISPUTED"
    if lifecycle == "UNKNOWN" and status == "Revised":
        return "REVIEW"
    return "UNMAPPED"


def main() -> int:
    args = parse_args()
    contract_path = V7 / "contracts/projects-plugin.v7.2.json"
    contract = load(contract_path)
    spine_path = ROOT / contract["governance"]["project_spine_contract"]
    spine = load(spine_path)
    universe = contract["canonical_universe"]
    projects_path = ROOT / universe["source_files"]["projects"]["path"]
    geojson_path = ROOT / universe["source_files"]["geojson"]["path"]
    manifest_path = ROOT / universe["source_files"]["manifest"]["path"]
    payload = load(projects_path)
    geojson = load(geojson_path)
    _manifest = load(manifest_path)
    projects = payload["projects"]
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        checks.append((name, bool(condition), detail))

    check("contract schema", contract.get("schema") == "globalgrid2050.v7.projects-plugin-contract.v1")
    check("target release", contract.get("target_release") == "7.2")
    check("specification status", contract.get("status") == "SPECIFICATION_ONLY_UI_NOT_LIVE")
    check("project-spine hash", sha256(spine_path) == contract["governance"]["project_spine_contract_sha256"])
    check("project-spine remains data only", spine.get("status") == "DATA_ONLY_NOT_LIVE")
    for checkpoint_id in ("checkpoint_1", "checkpoint_2", "checkpoint_3"):
        checkpoint = contract["implementation_checkpoints"][checkpoint_id]
        checkpoint_label = checkpoint_id.replace("_", " ")
        check(f"{checkpoint_label} isolated status", checkpoint.get("status") == "IMPLEMENTED_ISOLATED_NOT_LIVE")
        for relative, expected_hash in checkpoint["files"].items():
            path = ROOT / relative
            check(f"{checkpoint_label} file exists: {relative}", path.is_file())
            check(f"{checkpoint_label} file hash: {relative}", path.is_file() and sha256(path) == expected_hash)
    check("checkpoint 4 pending", contract["implementation_checkpoints"]["checkpoint_4"].get("status") == "PENDING")
    for key in ("projects", "geojson", "manifest"):
        source = universe["source_files"][key]
        path = ROOT / source["path"]
        check(f"{key} source exists", path.is_file())
        check(f"{key} source hash", sha256(path) == source["sha256"])

    check("project count", len(projects) == universe["project_count"] == 766)
    check("development count", len({row["gg_development_id"] for row in projects}) == universe["development_count"] == 718)
    solar = [row for row in projects if row["technology"] == "solar"]
    bess = [row for row in projects if row["technology"] == "bess"]
    check("solar count", len(solar) == universe["solar_count"] == 384)
    check("BESS count", len(bess) == universe["bess_count"] == 382)
    check("no wind", len(projects) == len(solar) + len(bess) and universe["wind_count"] == 0)
    check("exclusive solar threshold", all(row["capacity_mw"] > 49 for row in solar))
    check("exclusive BESS threshold", all(row["capacity_mw"] > 99 for row in bess))
    check("solar MWp", math.isclose(sum(row["capacity_mw"] for row in solar), universe["solar_mwp"], abs_tol=1e-8))
    check("BESS MW", math.isclose(sum(row["capacity_mw"] for row in bess), universe["bess_mw"], abs_tol=1e-8))
    check("largest solar", max(row["capacity_mw"] for row in solar) == universe["solar_largest_mwp"])
    check("largest BESS", max(row["capacity_mw"] for row in bess) == universe["bess_largest_mw"])
    check("combined capacity forbidden", contract["interface"]["combined_capacity_metric_forbidden"] is True)
    check("technology units", contract["interface"]["technology_labels_and_units"] == {"solar": {"label": "Solar", "unit": "MWp"}, "bess": {"label": "Battery Storage", "unit": "MW"}})
    expected_snapshot = universe["published_snapshot"]
    for field in (
        "projects_sha256",
        "source_identity_sha256",
        "source_coordinate_fixture_sha256",
        "source_workbook_sha256",
    ):
        check(f"published snapshot metadata: {field}", payload.get(field) == expected_snapshot.get(field))
    check("published geometry policy", payload.get("geometry_policy") == expected_snapshot.get("geometry_policy"))
    check("published source provenance", payload.get("source_provenance") == expected_snapshot.get("source_provenance"))

    record_contract = contract["project_record"]
    for field in record_contract["required_non_null_strings"]:
        check(f"required string: {field}", all(isinstance(row.get(field), str) and bool(row[field]) for row in projects))
    for field in record_contract["required_finite_numbers"]:
        check(f"required finite number: {field}", all(is_finite_number(row.get(field)) for row in projects))
    for field in record_contract["required_integers"]:
        check(f"required integer: {field}", all(isinstance(row.get(field), int) and not isinstance(row[field], bool) for row in projects))
    for field in record_contract["required_true_booleans"]:
        check(f"required true boolean: {field}", all(row.get(field) is True for row in projects))
    for field in record_contract["nullable_iso_dates"]:
        check(f"nullable ISO date: {field}", all(is_iso_date_or_none(row.get(field)) for row in projects))
    for field in record_contract["nullable_strings"]:
        check(f"nullable string: {field}", all(row.get(field) is None or isinstance(row.get(field), str) for row in projects))
    for field in record_contract["nullable_numbers"]:
        check(f"nullable number: {field}", all(row.get(field) is None or is_finite_number(row.get(field)) for row in projects))
    for field in record_contract["string_may_be_empty"]:
        check(f"string may be empty: {field}", all(isinstance(row.get(field), str) for row in projects))
    for field in record_contract["required_arrays"]:
        check(f"required array: {field}", all(isinstance(row.get(field), list) for row in projects))

    repd_refs = [row["repd_ref"] for row in projects]
    project_ids = [row["gg_project_id"] for row in projects]
    check("unique REPD refs", len(repd_refs) == len(set(repd_refs)))
    check("unique project IDs", len(project_ids) == len(set(project_ids)))
    check("canonical project ID", all(row["gg_project_id"] == f"GG2050-REPD-{row['repd_ref']}" for row in projects))
    check("authoritative bound identity", all(row["identity_status"] == "REPD_BOUND" and row["identity_confidence"] == "authoritative" for row in projects))
    check("development includes self", all(row["repd_ref"] in row["development_repd_refs"] for row in projects))
    relationship_types = set(record_contract["relationship_object"]["type_enum"])
    relationship_ok = all(
        isinstance(rel, dict)
        and set(record_contract["relationship_object"]["required_fields"]).issubset(rel)
        and rel["type"] in relationship_types
        for row in projects for rel in row["relationships"]
    )
    check("relationship schema", relationship_ok)
    relationship_targets = {rel["repd_ref"] for row in projects for rel in row["relationships"]}
    check("out-of-scope relationship targets preserved", bool(relationship_targets - set(repd_refs)))

    partition_counts: dict[str, int] = {}
    for row in projects:
        key = lifecycle_partition(row)
        partition_counts[key] = partition_counts.get(key, 0) + 1
    expected_views = {view["id"]: view["count"] for view in contract["lifecycle_views"]}
    check("lifecycle partition exhaustive", "UNMAPPED" not in partition_counts)
    check("lifecycle partition disjoint totals", sum(partition_counts.values()) == len(projects))
    for view in ("CURRENT", "DISPUTED", "HISTORICAL", "REVIEW"):
        check(f"lifecycle view {view}", partition_counts.get(view) == expected_views[view])
    check("ALL view", expected_views["ALL"] == len(projects))

    valid_ids = {row["gg_project_id"] for row in projects if row["geometry_status"] == "valid"}
    feature_ids = {feature["id"] for feature in geojson["features"]}
    check("GeoJSON valid subset", feature_ids == valid_ids)
    check("GeoJSON feature IDs unique", len(feature_ids) == len(geojson["features"]))
    check("geometry edition count", len(feature_ids) == universe["geometry_count_this_edition"])
    check("geometry does not govern project count", universe["project_count"] == len(projects))

    search_fields = contract["interface"]["search_fields"]
    by_ref = {row["repd_ref"]: row for row in projects}
    for example in contract["acceptance_examples"]:
        results = search_records(projects, search_fields, example["query"])
        result_refs = sorted(row["repd_ref"] for row in results)
        check(
            f"search sentinel: {example['query']}",
            len(results) == example["expected_records"] and result_refs == sorted(example["expected_repd_refs"]),
            f"actual refs={result_refs}",
        )
    check("Beacon Fen components remain separate", by_ref["13599"]["gg_development_id"] == by_ref["13600"]["gg_development_id"] and by_ref["13599"]["gg_project_id"] != by_ref["13600"]["gg_project_id"])

    table_fields = contract["interface"]["primary_table_fields"]
    check("primary table has 11 fields", len(table_fields) == 11)
    check(
        "primary table labels preserve frozen order",
        [field["label"] for field in table_fields] == contract["interface"]["primary_table_columns"],
    )
    check(
        "official milestone fields are explicit",
        contract["interface"]["official_milestone_fields"] == [
            "planning_application_submitted",
            "planning_application_withdrawn",
            "planning_permission_granted",
            "planning_permission_refused",
            "planning_permission_expired",
            "under_construction",
            "operational",
        ],
    )
    export_contract = contract["interface"]["export"]
    export_ids = [column["id"] for column in export_contract["columns"]]
    check("export column IDs unique", len(export_ids) == len(set(export_ids)))
    check("export is filtered only", export_contract["scope"] == "current filtered rows only")
    check("zero-result export is header only", export_contract["zero_results"] == "header only")
    check("CSV null semantics are explicit", export_contract["null_official_value"] == "empty CSV field")
    check("export includes canonical project ID", "gg_project_id" in export_ids)
    check("export includes canonical development ID", "gg_development_id" in export_ids)
    check("export includes published provenance", {"projects_sha256", "source_dataset", "source_row"}.issubset(export_ids))

    news_contract = contract["legacy_news_isolation"]
    news_path = ROOT / news_contract["fixture_path"]
    news = load(news_path)
    items = news["items"]
    check("V5 news fixture hash", sha256(news_path) == news_contract["fixture_sha256"])
    check("V5 news item count", len(items) == news_contract["item_count"] == 125)
    check("V5 solar news count", sum(item.get("technology") == "solar" for item in items) == news_contract["solar_count"])
    check("V5 BESS news count", sum(item.get("technology") == "bess" for item in items) == news_contract["bess_count"])
    check("V5 finance news count", sum(item.get("event") in {"FINANCIAL CLOSE", "ACQUISITION"} for item in items) == news_contract["finance_count"])
    check("legacy news plugin hash", sha256(V7 / "scripts/plugins/newspaper.js") == news_contract["plugin_sha256"])
    forbidden_news_fields = {"headline", "news_signal", "article_capacity_mw", "primary_match"}
    check("canonical records contain no news facts", all(not forbidden_news_fields.intersection(row) for row in projects))

    if args.phase == "spec":
        for relative, expected_hash in contract["v7_1_runtime_guard"]["files"].items():
            check(f"unchanged V7.1 runtime: {relative}", sha256(ROOT / relative) == expected_hash)
        state_text = (V7 / "scripts/core/state.js").read_text(encoding="utf-8")
        check("V7.1 legacy project source remains live", contract["release_state"]["current_project_source"] in state_text)
        check("V7.2 project source not wired", contract["release_state"]["target_project_source"] not in state_text)
        index_text = (V7 / "index.html").read_text(encoding="utf-8")
        check("visible release remains V7.1", "V7.1" in index_text and "V7.2" not in index_text)
        plugin_manifest = load(V7 / "data/plugin_manifest.json")
        check("plugin manifest remains V7.1", plugin_manifest.get("version") == "7.1")
    else:
        state_text = (V7 / "scripts/core/state.js").read_text(encoding="utf-8")
        index_text = (V7 / "index.html").read_text(encoding="utf-8")
        plugin_manifest = load(V7 / "data/plugin_manifest.json")
        check("contract promoted for integration", contract.get("status") in {"LIVE_CANDIDATE", "LIVE_VALIDATED"})
        check("visible release is V7.2", "V7.2" in index_text)
        check("plugin manifest is V7.2", plugin_manifest.get("version") == "7.2")
        check("canonical project source wired", contract["release_state"]["target_project_source"] in state_text)
        check("legacy project source removed", contract["release_state"]["current_project_source"] not in state_text)
        check("wind controls absent", "Onshore Wind" not in index_text and "Offshore Wind" not in index_text)

    failures = [(name, detail) for name, passed, detail in checks if not passed]
    result = "PASS" if not failures else "FAIL"
    print(f"V7.2 projects-plugin {args.phase}: {result} ({len(checks)} checks, {len(failures)} failures)")
    for name, detail in failures:
        print(f"FAIL: {name}{' — ' + detail if detail else ''}")
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (UnicodeError, json.JSONDecodeError, OSError, KeyError, TypeError, ValueError) as error:
        print(f"V7.2 projects-plugin: FAIL (unreadable or malformed contract/data: {error})")
        raise SystemExit(1) from None
