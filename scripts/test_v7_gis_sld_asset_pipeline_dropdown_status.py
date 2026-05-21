#!/usr/bin/env python3
"""Static checks for V7 GIS SLD asset pipeline dropdown with status filter."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"
index = (APP / "index.html").read_text(encoding="utf-8")
map_js = (APP / "gis-sld-v5-map.js").read_text(encoding="utf-8")
ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["asset_layer_select", "asset_status_select", "asset_min_mw", "asset_max_mw", "btn_asset_filter_apply"]:
    assert token in index, token
assert "asset-layer-btn" not in index, "old four asset buttons should be replaced"
for token in ["atlasV8AssetFilterState", "status: \"all\"", "atlasV8StatusExpression", "applyAtlasV8AssetDropdownFilter"]:
    assert token in map_js, token
assert '["==", ["get", "status"], "operational"]' not in map_js, "base layers should not be operational only"
assert "500, 60" not in map_js, "oversized marker radius should be removed"
for token in ["wireAtlasV8PipelineDropdownWithStatus", "asset_status_select", "applyAssetDropdownFromControls"]:
    assert token in ui, token
for token in ["map-asset-status-select", "ASSET PIPELINE DROPDOWN STATUS FILTER"]:
    assert token in css, token
print("V7 GIS SLD asset pipeline dropdown with status filter static checks passed.")
