#!/usr/bin/env python3
"""Static checks for V7 GIS SLD large asset markers and search."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"

index = (APP / "index.html").read_text(encoding="utf-8")
map_js = (APP / "gis-sld-v5-map.js").read_text(encoding="utf-8")
ui_js = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["gis_map_search", "gis_search_input", "gis_search_results"]:
    assert token in index, token
for token in ["30, 28", "500, 60", "atlas-v8-asset-solar-operational"]:
    assert token in map_js, token
for token in ["buildGisSearchIndexes", "wireGisMapSearch", "flyToGisSearchItem", "normaliseSubstations"]:
    assert token in ui_js, token
for token in ["gis-map-search", "gis-search-result", "LARGE ASSET MARKERS"]:
    assert token in css, token

print("V7 GIS SLD large asset markers and search static checks passed.")
