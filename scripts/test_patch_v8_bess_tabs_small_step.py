#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"
INDEX = APP / "index.html"
CSS = APP / "gis-sld-v5.css"
UI = APP / "gis-sld-v5-ui.js"
REPORT = ROOT / "gridbot_reports" / "patch_v8_bess_tabs_small_step.md"

for path in [INDEX, CSS, UI, REPORT]:
    assert path.exists(), f"Missing {path}"

index = INDEX.read_text(encoding="utf-8")
css = CSS.read_text(encoding="utf-8")
ui = UI.read_text(encoding="utf-8")
report = REPORT.read_text(encoding="utf-8")

for token in [
    'id="v8_bess_panel"',
    'class="v8-bess-tabs"',
    'data-v8-bess-tab="layout"',
    'data-v8-bess-tab="pcs"',
    'data-v8-bess-tab="finance"',
    'data-v8-bess-tab="map"',
    'data-v8-bess-tab="notes"',
    'data-v8-bess-panel="layout"',
    'data-v8-bess-panel="pcs"',
    'data-v8-bess-panel="finance"',
    'data-v8-bess-panel="map"',
    'data-v8-bess-panel="notes"',
    'bess_export_mw',
    'bess_container_size',
    'bess_layout_mode',
    'btn_bess_draw_geo',
    'btn_bess_export_geojson',
    'tab-container v8-hidden-pv',
]:
    assert token in index, token

for token in [
    'GLOBALGRID2050 V8 BESS TABS SMALL STEP',
    '.v8-bess-tabs',
    '.v8-bess-tab-btn.active',
    '.v8-bess-tab-panel.active',
]:
    assert token in css, token

for token in [
    'function v8InitBessTabsSmallStep',
    'data-v8-bess-tab',
    'data-v8-bess-panel',
    'v8InitBessTabsSmallStep',
]:
    assert token in ui, token

assert 'No V7 files are modified' in report
print('V8 BESS tabs small step checks passed.')
