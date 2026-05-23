#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V7 = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox" / "GIS_SLD_FULL_CODE_REPORT_V7.md"
V8 = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox" / "GIS_SLD_FULL_CODE_REPORT_V8.md"
GRIDBOT = ROOT / "gridbot_reports" / "generate_gis_sld_full_code_reports.md"

for path in [V7, V8, GRIDBOT]:
    assert path.exists(), f"Missing {path}"

v7 = V7.read_text(encoding="utf-8")
v8 = V8.read_text(encoding="utf-8")
gridbot = GRIDBOT.read_text(encoding="utf-8")

for token in [
    "# V7 GIS SLD Financial Sandbox Full Code Report",
    "Read it before modifying this GIS SLD app",
    "## File inventory",
    "## Full source code",
    "### `index.html`",
    "gis-sld-v5-map.js",
    "gis-sld-v5-drawing.js",
    "gis-sld-v5-ui.js",
    "maplibre",
]:
    assert token in v7, token

for token in [
    "# V8 BESS GIS SLD Financial Sandbox Full Code Report",
    "Read it before modifying this GIS SLD app",
    "## File inventory",
    "## Full source code",
    "### `index.html`",
    "gis-sld-v5-map.js",
    "gis-sld-v5-drawing.js",
    "gis-sld-v5-ui.js",
    "BESS",
]:
    assert token in v8, token

for forbidden in [
    "GIS_SLD_FULL_CODE_REPORT_V7.md\n###",
    "GIS_SLD_FULL_CODE_REPORT_V8.md\n###",
]:
    assert forbidden not in v7
    assert forbidden not in v8

assert "solar-bess-topology-v7/gis-sld-financial-sandbox/GIS_SLD_FULL_CODE_REPORT_V7.md" in gridbot
assert "solar-bess-topology-v8/bess-gis-sld-financial-sandbox/GIS_SLD_FULL_CODE_REPORT_V8.md" in gridbot

print("GIS SLD full code report checks passed.")
