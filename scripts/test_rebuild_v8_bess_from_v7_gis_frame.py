#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"

required = [
    "index.html",
    "gis-sld-v5.css",
    "gis-sld-v5-config.js",
    "gis-sld-v5-helpers.js",
    "gis-sld-v5-state.js",
    "gis-sld-v5-substations.js",
    "gis-sld-v5-map.js",
    "gis-sld-v5-calculations.js",
    "gis-sld-v5-finance.js",
    "gis-sld-v5-ui-core.js",
    "gis-sld-v5-drawing.js",
    "gis-sld-v5-export.js",
    "gis-sld-v5-ui.js",
    "README.md",
]
for name in required:
    assert (APP / name).exists(), f"Missing {name}"

index = (APP / "index.html").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")
ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
map_js = (APP / "gis-sld-v5-map.js").read_text(encoding="utf-8")
report = (ROOT / "gridbot_reports" / "rebuild_v8_bess_from_v7_gis_frame.md").read_text(encoding="utf-8")
launcher = (ROOT / "solar-bess-topology-v8" / "index.html").read_text(encoding="utf-8")

for token in [
    "BESS GIS SLD Financial Sandbox V8",
    "v8_bess_panel",
    "bess_export_mw",
    "bess_duration_h",
    "bess_energy_mwh",
    "bess_container_size",
    "bess_layout_mode",
    "bess_pcs_mw",
    "btn_bess_draw_geo",
    "btn_bess_export_geojson",
    "maplibre-gl",
    "gis-sld-v5-map.js",
]:
    assert token in index, token

for token in [
    "v8-bess-panel",
    "v8-hidden-pv",
    "v8-dev-label",
]:
    assert token in css, token

for token in [
    "V8 BESS geospatial drawing layer built on working V7 GIS frame",
    "function v8BessCalc",
    "function v8BuildBessGeoJson",
    "function v8DrawBessAtMapCentre",
    "function v8ExportBessGeoJson",
    "v8-bess-layout",
    "bess_container",
    "integrated_pcs_transformer",
    "grid_export_point",
    "not cable sizing",
]:
    assert token in ui, token

assert "new maplibregl.Map" in map_js or "maplibregl.Map" in map_js
assert "No V7 files are modified" in report
assert "bess-gis-sld-financial-sandbox/index.html" in launcher

print("V8 BESS rebuild from V7 GIS frame checks passed.")
