#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"
INDEX = APP / "index.html"
JS = APP / "bess-gis-sld-financial-sandbox.js"
CSS = APP / "bess-gis-sld-financial-sandbox.css"
REPORT = ROOT / "gridbot_reports" / "restore_v8_bess_maplibre_standalone.md"

for path in [INDEX, JS, CSS, REPORT]:
    assert path.exists(), f"Missing {path}"

index = INDEX.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
report = REPORT.read_text(encoding="utf-8")

# This must be the standalone BESS app, not the V7 PV GIS SLD clone.
for token in [
    "BESS GIS SLD Financial Sandbox V8",
    "maplibre-gl",
    "bess-gis-sld-financial-sandbox.css",
    "bess-gis-sld-financial-sandbox.js",
    "data-tab=\"layout\"",
    "data-tab=\"finance\"",
    "data-tab=\"notes\"",
    "btn_draw_at_center",
    "btn_reset_geo",
    "btn_export_geojson",
    "geo_rotation_deg",
]:
    assert token in index, token

for token in [
    "buildBessGeoJsonAt",
    "drawBessGeoLayoutAtMapCenter",
    "ensureBessGeoLayers",
    "bess_container",
    "integrated_pcs_transformer",
    "external_transformer",
    "grid_export_point",
    "dc_collection_path",
    "not cable sizing",
    "exportBessGeoJson",
]:
    assert token in js, token

for token in [
    ".tabs",
    ".tab-panel",
    "#map",
    ".map-toolbar",
]:
    assert token in css, token

# Guard against the broken V7 frame copy returning here.
for forbidden in [
    "gis-sld-v5-map.js",
    "gis-sld-v5-ui.js",
    "Solar Photovoltaic (PV)",
    "tabbtn_string",
    "tabbtn_central",
    "v8-hidden-pv",
    "target_dc_mwp",
]:
    assert forbidden not in index, f"Forbidden V7 PV clone token in index: {forbidden}"

assert "f90d9e53965e83fd9a11b94e81ed23aefd3aef7f" in report
print("V8 BESS MapLibre standalone restore checks passed.")
