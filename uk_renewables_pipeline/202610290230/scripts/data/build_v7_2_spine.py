#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[4]
V7 = ROOT / "uk_renewables_pipeline/v7"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def atomic_write_json(path: Path, value: Any, *, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=None if indent else (",", ":"), indent=indent, allow_nan=False) + "\n"
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as handle:
            temp_path = Path(handle.name)
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        json.loads(temp_path.read_text(encoding="utf-8"))
        os.replace(temp_path, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def clean_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return " ".join(str(value).replace("_x000D_", " ").split())


def optional_float(value: Any) -> float | None:
    if not clean_text(value):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def osgb36_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    a, b, f0 = 6377563.396, 6356256.909, 0.9996012717
    lat0, lon0 = math.radians(49), math.radians(-2)
    n0, e0 = -100000.0, 400000.0
    e2 = 1 - (b * b) / (a * a)
    n = (a - b) / (a + b)
    lat, meridional = lat0, 0.0
    while northing - n0 - meridional >= 0.00001:
        lat += (northing - n0 - meridional) / (a * f0)
        ma = (1 + n + 5 / 4 * n**2 + 5 / 4 * n**3) * (lat - lat0)
        mb = (3 * n + 3 * n**2 + 21 / 8 * n**3) * math.sin(lat - lat0) * math.cos(lat + lat0)
        mc = (15 / 8 * n**2 + 15 / 8 * n**3) * math.sin(2 * (lat - lat0)) * math.cos(2 * (lat + lat0))
        md = 35 / 24 * n**3 * math.sin(3 * (lat - lat0)) * math.cos(3 * (lat + lat0))
        meridional = b * f0 * (ma - mb + mc - md)
    sin_lat, cos_lat, tan_lat = math.sin(lat), math.cos(lat), math.tan(lat)
    nu = a * f0 / math.sqrt(1 - e2 * sin_lat**2)
    rho = a * f0 * (1 - e2) / (1 - e2 * sin_lat**2) ** 1.5
    eta2 = nu / rho - 1
    de = easting - e0
    vii = tan_lat / (2 * rho * nu)
    viii = tan_lat / (24 * rho * nu**3) * (5 + 3 * tan_lat**2 + eta2 - 9 * tan_lat**2 * eta2)
    ix = tan_lat / (720 * rho * nu**5) * (61 + 90 * tan_lat**2 + 45 * tan_lat**4)
    x = 1 / (cos_lat * nu)
    xi = 1 / (cos_lat * 6 * nu**3) * (nu / rho + 2 * tan_lat**2)
    xii = 1 / (cos_lat * 120 * nu**5) * (5 + 28 * tan_lat**2 + 24 * tan_lat**4)
    xiia = 1 / (cos_lat * 5040 * nu**7) * (61 + 662 * tan_lat**2 + 1320 * tan_lat**4 + 720 * tan_lat**6)
    lat_airy = lat - vii * de**2 + viii * de**4 - ix * de**6
    lon_airy = lon0 + x * de - xi * de**3 + xii * de**5 - xiia * de**7

    nu_airy = a / math.sqrt(1 - e2 * math.sin(lat_airy) ** 2)
    x1 = nu_airy * math.cos(lat_airy) * math.cos(lon_airy)
    y1 = nu_airy * math.cos(lat_airy) * math.sin(lon_airy)
    z1 = nu_airy * (1 - e2) * math.sin(lat_airy)
    tx, ty, tz = 446.448, -125.157, 542.060
    rx, ry, rz = (math.radians(v / 3600) for v in (0.1502, 0.2470, 0.8421))
    scale = 1 - 20.4894e-6
    x2 = tx + scale * x1 - rz * y1 + ry * z1
    y2 = ty + rz * x1 + scale * y1 - rx * z1
    z2 = tz - ry * x1 + rx * y1 + scale * z1
    a2, b2 = 6378137.0, 6356752.3141
    e22 = 1 - (b2 * b2) / (a2 * a2)
    p = math.hypot(x2, y2)
    lat2 = math.atan2(z2, p * (1 - e22))
    for _ in range(12):
        nu2 = a2 / math.sqrt(1 - e22 * math.sin(lat2) ** 2)
        next_lat = math.atan2(z2 + e22 * nu2 * math.sin(lat2), p)
        if abs(next_lat - lat2) < 1e-12:
            lat2 = next_lat
            break
        lat2 = next_lat
    return round(math.degrees(math.atan2(y2, x2)), 7), round(math.degrees(lat2), 7)


def resolve_geometry(easting: float | None, northing: float | None) -> tuple[str, float | None, float | None]:
    if easting is None or northing is None:
        return "missing", None, None
    if not (math.isfinite(easting) and math.isfinite(northing) and 0 < easting < 800000 and 0 < northing < 1400000):
        return "invalid", None, None
    try:
        longitude, latitude = osgb36_to_wgs84(easting, northing)
    except (ArithmeticError, ValueError):
        return "invalid", None, None
    if not (math.isfinite(longitude) and math.isfinite(latitude) and -9.5 <= longitude <= 3.5 and 49.0 <= latitude <= 61.5):
        return "invalid", None, None
    return "valid", longitude, latitude


def project_feature(project: dict[str, Any]) -> dict[str, Any] | None:
    if project.get("geometry_status") != "valid":
        return None
    return {
        "type": "Feature",
        "id": project["gg_project_id"],
        "geometry": {"type": "Point", "coordinates": [project["longitude"], project["latitude"]]},
        "properties": {key: value for key, value in project.items() if key not in {"longitude", "latitude"}},
    }


def build_coordinate_fixture(xlsx_path: Path, identity: list[dict[str, Any]], output: Path) -> dict[str, Any]:
    import pandas as pd

    columns = ["Ref ID", "Site Name", "Technology Type", "Installed Capacity (MWelec)", "X-coordinate", "Y-coordinate"]
    frame = pd.read_excel(xlsx_path, sheet_name="REPD", usecols=columns, engine="openpyxl")
    rows: dict[str, dict[str, Any]] = {}
    for _, source in frame.iterrows():
        if pd.isna(source["Ref ID"]):
            continue
        ref = str(int(source["Ref ID"]))
        easting = optional_float(source["X-coordinate"])
        northing = optional_float(source["Y-coordinate"])
        rows[ref] = {
            "repd_ref": ref,
            "site_name": clean_text(source["Site Name"]),
            "technology": clean_text(source["Technology Type"]),
            "capacity_mw": optional_float(source["Installed Capacity (MWelec)"]),
            "easting": easting,
            "northing": northing,
        }
    by_ref = {record["repd_ref"]: record for record in identity}
    if set(rows) != set(by_ref):
        raise RuntimeError("REPD workbook Ref-ID set does not match the canonical identity fixture")
    for ref, source in rows.items():
        target = by_ref[ref]
        if source["technology"] != clean_text(target["technology"]):
            raise RuntimeError(f"Technology mismatch for REPD {ref}")
        if source["capacity_mw"] is not None and not math.isclose(source["capacity_mw"], float(target["capacity_mw"]), abs_tol=1e-9):
            raise RuntimeError(f"Capacity mismatch for REPD {ref}")
        if source["site_name"] != clean_text(target["site_name"]):
            raise RuntimeError(f"Site-name mismatch for REPD {ref}")
    payload = {
        "schema": "globalgrid2050.v7.repd-coordinates.v1",
        "source_workbook": xlsx_path.name,
        "source_workbook_sha256": sha256(xlsx_path),
        "source_records": len(rows),
        "coordinate_records": sum(row["easting"] is not None and row["northing"] is not None for row in rows.values()),
        "crs": "EPSG:27700",
        "records": [rows[ref] for ref in sorted(rows, key=int)],
    }
    atomic_write_json(output, payload)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--contract", type=Path, default=V7 / "contracts/project-spine.v7.2.json")
    parser.add_argument("--repd-xlsx", type=Path)
    args = parser.parse_args()
    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    identity_path = ROOT / contract["identity_fixture"]
    identity_payload = json.loads(identity_path.read_text(encoding="utf-8"))
    identity = identity_payload["records"]
    coordinate_path = ROOT / contract["coordinate_fixture"]
    if args.repd_xlsx:
        coordinates_payload = build_coordinate_fixture(args.repd_xlsx, identity, coordinate_path)
    else:
        coordinates_payload = json.loads(coordinate_path.read_text(encoding="utf-8"))
    if coordinates_payload["source_workbook_sha256"] != contract["source_workbook_sha256"]:
        raise RuntimeError("Coordinate fixture source-workbook hash is not contract-bound")
    coordinates = {row["repd_ref"]: row for row in coordinates_payload["records"]}
    thresholds = contract["thresholds"]
    selected = [record for record in identity if record.get("capacity_known") and (
        record.get("technology") == "Solar Photovoltaics" and float(record["capacity_mw"]) > thresholds["solar_mwp_exclusive"]
        or record.get("technology") == "Battery" and float(record["capacity_mw"]) > thresholds["bess_mw_exclusive"]
    )]
    projects = []
    for record in selected:
        coord = coordinates.get(record["repd_ref"]) or {}
        easting = coord.get("easting")
        northing = coord.get("northing")
        geometry_status, longitude, latitude = resolve_geometry(easting, northing)
        project = {
            "gg_project_id": record["gg_project_id"],
            "gg_development_id": record["gg_development_id"],
            "identity_status": record["identity_status"],
            "identity_confidence": record["identity_confidence"],
            "repd_ref": record["repd_ref"],
            "repd_old_ref": record["repd_old_ref"],
            "repd_record_updated": record["repd_record_updated"],
            "name": record["site_name"],
            "technology": "solar" if record["technology"] == "Solar Photovoltaics" else "bess",
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
            "coordinate_source": contract["geometry_policy"]["transform"] if geometry_status == "valid" else None,
        }
        projects.append(project)
    projects.sort(key=lambda row: (-float(row["capacity_mw"]), row["name"].casefold(), int(row["repd_ref"])))
    counts = Counter(row["technology"] for row in projects)
    lifecycle_counts = Counter(row["lifecycle"] for row in projects)
    geometry_status_counts = Counter(row["geometry_status"] for row in projects)
    features = [feature for row in projects if (feature := project_feature(row)) is not None]
    projects_payload = {
        "schema": "globalgrid2050.v7.projects.v7.2",
        "version": "7.2",
        "status": "VALIDATED_DATA_ONLY_NOT_LIVE",
        "source_identity_sha256": sha256(identity_path),
        "source_coordinate_fixture_sha256": sha256(coordinate_path),
        "source_workbook_sha256": coordinates_payload["source_workbook_sha256"],
        "source_provenance": contract["source_provenance"],
        "geometry_policy": contract["geometry_policy"],
        "thresholds": thresholds,
        "project_count": len(projects),
        "solar_count": counts["solar"],
        "bess_count": counts["bess"],
        "development_count": len({row["gg_development_id"] for row in projects}),
        "solar_mwp": round(sum(row["capacity_mw"] for row in projects if row["technology"] == "solar"), 2),
        "bess_mw": round(sum(row["capacity_mw"] for row in projects if row["technology"] == "bess"), 2),
        "geometry_count": len(features),
        "missing_geometry_count": len(projects) - len(features),
        "geometry_status_counts": dict(sorted(geometry_status_counts.items())),
        "lifecycle_counts": dict(sorted(lifecycle_counts.items())),
        "projects_sha256": canonical_sha(projects),
        "projects": projects,
    }
    geojson = {
        "type": "FeatureCollection",
        "schema": "globalgrid2050.v7.projects-geojson.v7.2",
        "version": "7.2",
        "crs_policy": "RFC 7946 WGS84 longitude/latitude",
        "geometry_policy": contract["geometry_policy"],
        "feature_count": len(features),
        "features_sha256": canonical_sha(features),
        "features": features,
    }
    output_projects = ROOT / contract["outputs"]["projects"]
    output_geojson = ROOT / contract["outputs"]["geojson"]
    output_manifest = ROOT / contract["outputs"]["manifest"]
    atomic_write_json(output_projects, projects_payload)
    atomic_write_json(output_geojson, geojson)
    manifest = {
        "schema": "globalgrid2050.v7.project-spine-build.v1",
        "version": "7.2",
        "status": "VALIDATED_DATA_ONLY_NOT_LIVE",
        "source_provenance": contract["source_provenance"],
        "geometry_policy": contract["geometry_policy"],
        "contract_sha256": sha256(args.contract),
        "inputs": {
            contract["identity_fixture"]: sha256(identity_path),
            contract["coordinate_fixture"]: sha256(coordinate_path),
        },
        "input_bytes": {
            contract["identity_fixture"]: identity_path.stat().st_size,
            contract["coordinate_fixture"]: coordinate_path.stat().st_size,
        },
        "outputs": {
            contract["outputs"]["projects"]: sha256(output_projects),
            contract["outputs"]["geojson"]: sha256(output_geojson),
        },
        "output_bytes": {
            contract["outputs"]["projects"]: output_projects.stat().st_size,
            contract["outputs"]["geojson"]: output_geojson.stat().st_size,
        },
        "metrics": {key: projects_payload[key] for key in ("project_count", "solar_count", "bess_count", "development_count", "solar_mwp", "bess_mw", "geometry_count", "missing_geometry_count")},
        "projects_sha256": projects_payload["projects_sha256"],
        "features_sha256": geojson["features_sha256"],
    }
    atomic_write_json(output_manifest, manifest, indent=2)
    print(f"V7.2 spine built: {len(projects)} projects ({counts['solar']} solar, {counts['bess']} BESS), {len(features)} geometries")


if __name__ == "__main__":
    main()
