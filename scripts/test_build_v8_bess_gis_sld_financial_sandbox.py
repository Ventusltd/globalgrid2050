#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"

required = [
    "index.html",
    "bess-gis-sld-financial-sandbox.css",
    "bess-gis-sld-financial-sandbox.js",
    "README.md",
]
for name in required:
    assert (APP / name).exists(), f"Missing {name}"

index = (APP / "index.html").read_text(encoding="utf-8")
css = (APP / "bess-gis-sld-financial-sandbox.css").read_text(encoding="utf-8")
js = (APP / "bess-gis-sld-financial-sandbox.js").read_text(encoding="utf-8")
readme = (APP / "README.md").read_text(encoding="utf-8")
launcher = (ROOT / "solar-bess-topology-v8" / "index.html").read_text(encoding="utf-8")
legacy = (ROOT / "solar-bess-topology-v8" / "bess-pcs-standalone" / "index.html").read_text(encoding="utf-8")
report = (ROOT / "gridbot_reports" / "build_v8_bess_gis_sld_financial_sandbox.md").read_text(encoding="utf-8")

for token in [
    "BESS GIS SLD Financial Sandbox",
    "grid_export_mw",
    "duration_hours",
    "energy_mwh",
    "container_size",
    "container_mwh",
    "layout_mode",
    "integrated",
    "separated",
    "distributed",
    "corridor",
    "central",
    "hv_compound",
    "capex_per_mwh",
    "revenue_per_mw_year",
    "maplibre-gl",
    "bess_svg",
]:
    assert token in index, token

for forbidden in [
    "modules per string",
    "PV module rating",
    "string inverter",
]:
    assert forbidden.lower() not in index.lower(), forbidden

for token in [
    "function initMap",
    "function syncEnergy",
    "function calc",
    "function drawLayout",
    "BESS containers provide MWh",
    "PCS provides MW",
]:
    assert token in js, token

assert "Cable sizing" in readme
assert "does not handle cable sizing" in (ROOT / "solar-bess-topology-v8" / "README.md").read_text(encoding="utf-8")
assert "bess-gis-sld-financial-sandbox/index.html" in launcher
assert "refresh" in legacy and "bess-gis-sld-financial-sandbox" in legacy
assert "No V7 files are modified" in report
assert "svg-battery" in css

print("V8 BESS GIS SLD financial sandbox checks passed.")
