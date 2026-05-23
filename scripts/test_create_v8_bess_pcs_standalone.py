#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-pcs-standalone"

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
]

missing = [name for name in required if not (APP / name).exists()]
assert not missing, "Missing copied V8 files: " + ", ".join(missing)

index = (APP / "index.html").read_text(encoding="utf-8")
launcher = (ROOT / "solar-bess-topology-v8" / "index.html").read_text(encoding="utf-8")
readme = (ROOT / "solar-bess-topology-v8" / "README.md").read_text(encoding="utf-8")
report = (ROOT / "gridbot_reports" / "create_v8_bess_pcs_standalone.md").read_text(encoding="utf-8")

assert "BESS PCS Standalone V8" in index
assert "id=\"bess_pcs_study_box\"" in index
assert "id=\"bess_power_mw\"" in index
assert "id=\"bess_dc_voltage\"" in index
assert "id=\"bess_parallel_sets\"" in index
assert "id=\"bess_out_total_current\"" in index
assert "id=\"bess_out_set_current\"" in index
assert "function updateBessPcsStudy" in index
assert index.count("id=\"bess_pcs_study_box\"") == 1
assert index.count("function updateBessPcsStudy") == 1
assert "bess-pcs-standalone/index.html" in launcher
assert "V7 is to remain stable" in readme
assert "BESS power MW / DC voltage" in report

print("V8 BESS PCS standalone creation checks passed.")
