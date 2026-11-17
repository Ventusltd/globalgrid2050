#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
V7 = ROOT / "uk_renewables_pipeline/v7"


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def main() -> None:
    contract_path = V7 / "contracts/project-spine.v7.2.json"
    contract = load(contract_path)
    expected = contract["expected"]
    identity_path = ROOT / contract["identity_fixture"]
    coordinate_path = ROOT / contract["coordinate_fixture"]
    projects_path = ROOT / contract["outputs"]["projects"]
    geojson_path = ROOT / contract["outputs"]["geojson"]
    manifest_path = ROOT / contract["outputs"]["manifest"]
    coordinates = load(coordinate_path)
    payload = load(projects_path)
    geojson = load(geojson_path)
    manifest = load(manifest_path)
    north_star = load(V7 / "contracts/north-star.v1.json")
    checks: list[tuple[str, bool]] = []

    def check(name: str, condition: bool) -> None:
        checks.append((name, bool(condition)))

    check("identity fixture hash", sha256(identity_path) == contract["identity_fixture_sha256"])
    check("coordinate fixture hash", sha256(coordinate_path) == contract["coordinate_fixture_sha256"])
    check("workbook hash provenance", coordinates["source_workbook_sha256"] == contract["source_workbook_sha256"])
    coordinate_rows = coordinates["records"]
    coordinate_refs = [row["repd_ref"] for row in coordinate_rows]
    populated_coordinates = sum(
        isinstance(row.get("easting"), (int, float)) and math.isfinite(row["easting"])
        and isinstance(row.get("northing"), (int, float)) and math.isfinite(row["northing"])
        for row in coordinate_rows
    )
    check("coordinate source rows", len(coordinate_rows) == coordinates["source_records"] == expected["source_records"])
    check("coordinate unique REPD refs", len(coordinate_refs) == len(set(coordinate_refs)))
    check("coordinate populated rows", populated_coordinates == coordinates["coordinate_records"] == expected["source_coordinate_records"])
    projects = payload["projects"]
    features = geojson["features"]
    check("project count", len(projects) == payload["project_count"] == expected["projects"])
    check("solar count", sum(row["technology"] == "solar" for row in projects) == expected["solar"])
    check("BESS count", sum(row["technology"] == "bess" for row in projects) == expected["bess"])
    check("no wind", all(row["technology"] in {"solar", "bess"} for row in projects))
    check("development count", len({row["gg_development_id"] for row in projects}) == expected["developments"])
    check("solar capacity", math.isclose(sum(row["capacity_mw"] for row in projects if row["technology"] == "solar"), expected["solar_mwp"], abs_tol=1e-8))
    check("BESS capacity", math.isclose(sum(row["capacity_mw"] for row in projects if row["technology"] == "bess"), expected["bess_mw"], abs_tol=1e-8))
    check("exclusive thresholds", all(row["capacity_mw"] > (49 if row["technology"] == "solar" else 99) for row in projects))
    check("capacity known", all(row["capacity_known"] is True for row in projects))
    check("unique REPD refs", len({row["repd_ref"] for row in projects}) == len(projects))
    check("unique GG project IDs", len({row["gg_project_id"] for row in projects}) == len(projects))
    check("canonical identity", all(row["gg_project_id"] == f"GG2050-REPD-{row['repd_ref']}" and row["identity_status"] == "REPD_BOUND" for row in projects))
    valid_geometry_projects = [row for row in projects if row.get("geometry_status") == "valid"]
    missing_geometry_projects = [row for row in projects if row.get("geometry_status") != "valid"]
    check("geometry status vocabulary", all(row.get("geometry_status") in {"valid", "missing", "invalid"} for row in projects))
    check("geometry count", len(features) == len(valid_geometry_projects) == payload["geometry_count"] == geojson["feature_count"] == expected["geometry_records"])
    check("missing geometry count", len(missing_geometry_projects) == payload["missing_geometry_count"] == expected["missing_geometry"])
    check("nullable missing geometry", all(row.get("longitude") is None and row.get("latitude") is None and row.get("coordinate_source") is None for row in missing_geometry_projects))
    check("projects array hash", canonical_sha(projects) == payload["projects_sha256"] == expected["projects_array_sha256"])
    check("GeoJSON feature hash", canonical_sha(features) == geojson["features_sha256"] == expected["geojson_features_sha256"])
    by_id = {row["gg_project_id"]: row for row in projects}
    geometry_ok = True
    feature_ids = [feature["id"] for feature in features]
    for feature in features:
        row = by_id.get(feature["id"])
        coords = feature.get("geometry", {}).get("coordinates", [])
        if row is None or row.get("geometry_status") != "valid" or len(coords) != 2 or coords != [row["longitude"], row["latitude"]]:
            geometry_ok = False
            break
        if not all(isinstance(value, (int, float)) and math.isfinite(value) for value in coords):
            geometry_ok = False
            break
        if not (-9.5 <= coords[0] <= 3.5 and 49.0 <= coords[1] <= 61.5):
            geometry_ok = False
            break
    check("canonical WGS84 geometry", geometry_ok)
    check("unique GeoJSON feature IDs", len(feature_ids) == len(set(feature_ids)))
    check("GeoJSON is valid-geometry subset", set(feature_ids) == {row["gg_project_id"] for row in valid_geometry_projects})
    by_ref = {row["repd_ref"]: row for row in projects}
    sentinel_ok = True
    for sentinel in north_star["canonical_sentinels"]:
        threshold = 49 if sentinel["technology"] == "Solar Photovoltaics" else 99
        if sentinel["capacity_mw"] <= threshold:
            continue
        row = by_ref.get(sentinel["repd_ref"])
        if row is None or row["gg_development_id"] != sentinel["gg_development_id"] or row["capacity_mw"] != sentinel["capacity_mw"] or row["status"] != sentinel["status"]:
            sentinel_ok = False
            break
    check("North Star sentinels preserved", sentinel_ok)
    forbidden = {"headline", "news_signal", "article_capacity_mw", "primary_match"}
    check("no news-derived fields", all(not forbidden.intersection(row) for row in projects))
    check("manifest contract hash", manifest["contract_sha256"] == sha256(contract_path))
    expected_inputs = {contract["identity_fixture"], contract["coordinate_fixture"]}
    expected_outputs = {contract["outputs"]["projects"], contract["outputs"]["geojson"]}
    check("manifest input path set", set(manifest["inputs"]) == set(manifest["input_bytes"]) == expected_inputs)
    check("manifest output path set", set(manifest["outputs"]) == set(manifest["output_bytes"]) == expected_outputs)
    check("manifest identity input", manifest["inputs"][contract["identity_fixture"]] == sha256(identity_path) and manifest["input_bytes"][contract["identity_fixture"]] == identity_path.stat().st_size)
    check("manifest coordinate input", manifest["inputs"][contract["coordinate_fixture"]] == sha256(coordinate_path) and manifest["input_bytes"][contract["coordinate_fixture"]] == coordinate_path.stat().st_size)
    check("manifest project file", manifest["outputs"][contract["outputs"]["projects"]] == sha256(projects_path) and manifest["output_bytes"][contract["outputs"]["projects"]] == projects_path.stat().st_size)
    check("manifest GeoJSON file", manifest["outputs"][contract["outputs"]["geojson"]] == sha256(geojson_path) and manifest["output_bytes"][contract["outputs"]["geojson"]] == geojson_path.stat().st_size)
    metric_keys = ("project_count", "solar_count", "bess_count", "development_count", "solar_mwp", "bess_mw", "geometry_count", "missing_geometry_count")
    check("manifest metrics", manifest["metrics"] == {key: payload[key] for key in metric_keys})
    check("manifest projects canonical hash", manifest["projects_sha256"] == payload["projects_sha256"] == canonical_sha(projects) == expected["projects_array_sha256"])
    check("manifest features canonical hash", manifest["features_sha256"] == geojson["features_sha256"] == canonical_sha(features) == expected["geojson_features_sha256"])
    failures = [name for name, passed in checks if not passed]
    print(f"V7.2 canonical spine: {'PASS' if not failures else 'FAIL'} ({len(checks)} checks, {len(failures)} failures)")
    for name in failures:
        print(f"FAIL: {name}")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except (UnicodeError, json.JSONDecodeError, OSError, KeyError, TypeError, ValueError) as error:
        print(f"V7.2 canonical spine: FAIL (unreadable or malformed artefact: {error})")
        raise SystemExit(1) from None
