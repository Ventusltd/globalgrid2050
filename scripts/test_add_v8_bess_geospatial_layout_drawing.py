#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"

index = (APP / "index.html").read_text(encoding="utf-8")
css = (APP / "bess-gis-sld-financial-sandbox.css").read_text(encoding="utf-8")
js = (APP / "bess-gis-sld-financial-sandbox.js").read_text(encoding="utf-8")
report = (ROOT / "gridbot_reports" / "add_v8_bess_geospatial_layout_drawing.md").read_text(encoding="utf-8")

for token in [
    "btn_draw_at_center",
    "btn_reset_geo",
    "btn_export_geojson",
    "geo_rotation_deg",
    "Draw BESS at map centre",
    "Export GeoJSON",
]:
    assert token in index, token

for token in [
    "map-inline-input",
    "map-inline-label",
]:
    assert token in css, token

for token in [
    "function metresToLngLat",
    "function rotatePoint",
    "function rectFeature",
    "function buildBessGeoJsonAt",
    "function ensureBessGeoLayers",
    "function drawBessGeoLayoutAtMapCenter",
    "function resetBessGeoLayout",
    "function exportBessGeoJson",
    "compound_boundary",
    "bess_container",
    "pcs_block",
    "integrated_pcs_transformer",
    "external_transformer",
    "access_road",
    "grid_export_point",
    "dc_collection_path",
    "not cable sizing",
]:
    assert token in js, token

assert "No V7 files are modified" in report
assert "No cable sizing" in report

print("V8 BESS geospatial layout drawing checks passed.")
