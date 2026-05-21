#!/usr/bin/env python3
"""Static checks for V7 GIS SLD Site Intelligence Panel."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v7" / "gis-sld-financial-sandbox"

index = (APP / "index.html").read_text(encoding="utf-8")
ui = (APP / "gis-sld-v5-ui.js").read_text(encoding="utf-8")
css = (APP / "gis-sld-v5.css").read_text(encoding="utf-8")

for token in ["site_intel_panel", "site_intel_body", "site_intel_close"]:
    assert token in index, token
for token in ["inspectSiteIntelligenceAt", "nearestLineFeature", "nearestPointFeature", "wireSiteIntelligencePanel"]:
    assert token in ui, token
for token in ["66 kV", "132 kV", "275 kV", "400 kV", "/dist/repd_master.json", "SUBSTATIONS_URL"]:
    assert token in ui, token
for token in ["site-intel-panel", "site-intel-row", "SITE INTELLIGENCE PANEL"]:
    assert token in css, token

print("V7 GIS SLD site intelligence panel static checks passed.")
