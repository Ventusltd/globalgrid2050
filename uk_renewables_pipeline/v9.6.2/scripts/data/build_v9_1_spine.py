#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from build_v7_2_spine import atomic_write_json, canonical_sha, resolve_geometry, sha256


ROOT = Path(__file__).resolve().parents[4]
V9 = ROOT / "uk_renewables_pipeline/v9"
CONTRACT_PATH = V9 / "contracts/release.v9.1.json"
OUTPUT_DIR = V9 / "data/v9.1"

TECHNOLOGY_MAP = {
    "Solar Photovoltaics": "solar",
    "Battery": "bess",
    "Wind Onshore": "wind_onshore",
    "Wind Offshore": "wind_offshore",
}


def main() -> None:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    identity_path = ROOT / contract["source"]["identity_fixture"]
    coordinate_path = ROOT / contract["source"]["coordinate_fixture"]
    if sha256(identity_path) != contract["source"]["identity_fixture_sha256"]:
        raise RuntimeError("V9.1 identity fixture hash mismatch")
    if sha256(coordinate_path) != contract["source"]["coordinate_fixture_sha256"]:
        raise RuntimeError("V9.1 coordinate fixture hash mismatch")

    identity_payload = json.loads(identity_path.read_text(encoding="utf-8"))
    coordinate_payload = json.loads(coordinate_path.read_text(encoding="utf-8"))
    if coordinate_payload["source_workbook_sha256"] != contract["source"]["workbook_sha256"]:
        raise RuntimeError("V9.1 coordinate workbook hash mismatch")

    coordinates = {row["repd_ref"]: row for row in coordinate_payload["records"]}
    minimum = float(contract["scope"]["capacity_mw_inclusive_minimum"])
    selected = [
        record for record in identity_payload["records"]
        if record.get("capacity_known") is True
        and record.get("technology") in TECHNOLOGY_MAP
        and float(record["capacity_mw"]) >= minimum
    ]

    projects = []
    for record in selected:
        coordinate = coordinates.get(record["repd_ref"], {})
        easting, northing = coordinate.get("easting"), coordinate.get("northing")
        geometry_status, longitude, latitude = resolve_geometry(easting, northing)
        projects.append({
            "gg_project_id": record["gg_project_id"],
            "gg_development_id": record["gg_development_id"],
            "identity_status": record["identity_status"],
            "identity_confidence": record["identity_confidence"],
            "repd_ref": record["repd_ref"],
            "repd_old_ref": record["repd_old_ref"],
            "repd_record_updated": record["repd_record_updated"],
            "name": record["site_name"],
            "technology": TECHNOLOGY_MAP[record["technology"]],
            "repd_technology": record["technology"],
            "capacity_mw": record["capacity_mw"],
            "capacity_known": True,
            "status": record["status"],
            "lifecycle": record["lifecycle"],
            "operator": record["operator"],
            "county": record["county"],
            "region": record["region"],
            "country": record["country"],
            "planning_authority": record["planning_authority"],
            "planning_application_reference": record["planning_application_reference"],
            "planning_application_submitted": record["planning_application_submitted"],
            "planning_application_withdrawn": record["planning_application_withdrawn"],
            "planning_permission_refused": record["planning_permission_refused"],
            "planning_permission_granted": record["planning_permission_granted"],
            "planning_permission_expired": record["planning_permission_expired"],
            "under_construction": record["under_construction"],
            "operational": record["operational"],
            "relationships": record["relationships"],
            "direct_related_repd_refs": record["direct_related_repd_refs"],
            "planning_sibling_repd_refs": record["planning_sibling_repd_refs"],
            "development_repd_refs": record["development_repd_refs"],
            "source_row": record["source_row"],
            "geometry_status": geometry_status,
            "easting": easting,
            "northing": northing,
            "longitude": longitude,
            "latitude": latitude,
            "coordinate_source": "documented OSGB36-to-WGS84 seven-parameter Helmert approximation" if geometry_status == "valid" else None,
        })

    projects.sort(key=lambda row: (-float(row["capacity_mw"]), row["name"].casefold(), row["repd_ref"]))
    features = [{
        "type": "Feature",
        "id": project["gg_project_id"],
        "geometry": {"type": "Point", "coordinates": [project["longitude"], project["latitude"]]},
        "properties": {
            "repd_ref": project["repd_ref"],
            "gg_project_id": project["gg_project_id"],
            "name": project["name"],
            "technology": project["technology"],
            "repd_technology": project["repd_technology"],
            "capacity_mw": project["capacity_mw"],
            "status": project["status"],
            "operator": project["operator"],
        },
    } for project in projects if project["geometry_status"] == "valid"]
    counts = Counter(project["technology"] for project in projects)
    total_capacity = round(sum(float(project["capacity_mw"]) for project in projects), 2)
    expected = contract["expected"]
    actual = {
        "project_count": len(projects),
        "capacity_mw": total_capacity,
        "largest_mw": max(float(project["capacity_mw"]) for project in projects),
        "solar_count": counts["solar"],
        "bess_count": counts["bess"],
        "wind_onshore_count": counts["wind_onshore"],
        "wind_offshore_count": counts["wind_offshore"],
    }
    if actual != expected:
        raise RuntimeError(f"V9.1 acceptance mismatch: {actual!r}")

    common = {
        "release": "9.1",
        "source_dataset": contract["source"]["dataset"],
        "source_record_count": identity_payload["raw_record_count"],
        "source_identity_sha256": sha256(identity_path),
        "source_coordinate_fixture_sha256": sha256(coordinate_path),
        "source_workbook_sha256": coordinate_payload["source_workbook_sha256"],
        "scope": contract["scope"],
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    projects_dir = OUTPUT_DIR / "projects"
    atlas_dir = OUTPUT_DIR / "atlas"
    projects_dir.mkdir(exist_ok=True)
    atlas_dir.mkdir(exist_ok=True)
    for stale in [OUTPUT_DIR / "projects.json", OUTPUT_DIR / "projects.geojson"]:
        stale.unlink(missing_ok=True)
    for stale in [*projects_dir.glob("part-*.json"), *atlas_dir.glob("*.geojson")]:
        stale.unlink()

    project_partitions = []
    partition_size = 500
    for index, start in enumerate(range(0, len(projects), partition_size), 1):
        path = projects_dir / f"part-{index:03d}.json"
        partition = projects[start:start + partition_size]
        atomic_write_json(path, {
            "schema": "globalgrid2050.v9.project-partition.v9.1",
            "release": "9.1",
            "partition": index,
            "record_count": len(partition),
            "projects": partition,
        })
        project_partitions.append({"path": f"data/v9.1/projects/{path.name}", "record_count": len(partition), "sha256": sha256(path)})

    atlas_partitions = []
    atlas_partition_size = 500
    for technology in TECHNOLOGY_MAP.values():
        technology_features = [feature for feature in features if feature["properties"]["technology"] == technology]
        for index, start in enumerate(range(0, len(technology_features), atlas_partition_size), 1):
            path = atlas_dir / f"{technology}-part-{index:03d}.geojson"
            partition = technology_features[start:start + atlas_partition_size]
            atomic_write_json(path, {
                "type": "FeatureCollection",
                "schema": "globalgrid2050.v9.atlas-projects.v9.1",
                "release": "9.1",
                "technology": technology,
                "partition": index,
                "feature_count": len(partition),
                "features": partition,
            })
            atlas_partitions.append({"path": f"data/v9.1/atlas/{path.name}", "technology": technology, "feature_count": len(partition), "sha256": sha256(path)})

    projects_sha256 = canonical_sha(projects)
    features_sha256 = canonical_sha(features)
    manifest_path = OUTPUT_DIR / "build_manifest.json"
    atomic_write_json(manifest_path, {
        "schema": "globalgrid2050.v9.project-spine-build.v9.1",
        **common,
        **actual,
        "geometry_count": len(features),
        "missing_geometry_count": len(projects) - len(features),
        "projects_sha256": projects_sha256,
        "features_sha256": features_sha256,
        "project_partitions": project_partitions,
        "atlas_partitions": atlas_partitions,
    }, indent=2)
    print(f"V9.1 spine built: {len(projects)} records, {total_capacity:,.2f} MW, {len(features)} geometries")


if __name__ == "__main__":
    main()
