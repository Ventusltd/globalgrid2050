#!/usr/bin/env python3
from pathlib import Path
import datetime as dt

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "solar-bess-topology-v8" / "bess-gis-sld-financial-sandbox"
INDEX = APP / "index.html"
CSS = APP / "gis-sld-v5.css"
UI = APP / "gis-sld-v5-ui.js"
REPORT = ROOT / "gridbot_reports" / "patch_v8_bess_tabs_small_step.md"

TABBED_PANEL = '''    <section id="v8_bess_panel" class="v8-bess-panel">
        <h3>BESS GIS SLD Financial Sandbox V8</h3>
        <div class="ux-note">BESS only study frame. Containers provide energy in MWh. PCS provides power in MW. Grid export caps the maximum export. Cable sizing, R, X, Z, leakage, reverse current and protection coordination remain in the advanced topology review.</div>

        <div class="v8-bess-tabs" role="tablist" aria-label="BESS controls">
            <button class="v8-bess-tab-btn active" type="button" data-v8-bess-tab="layout">Layout</button>
            <button class="v8-bess-tab-btn" type="button" data-v8-bess-tab="pcs">PCS</button>
            <button class="v8-bess-tab-btn" type="button" data-v8-bess-tab="finance">Finance</button>
            <button class="v8-bess-tab-btn" type="button" data-v8-bess-tab="map">Map Export</button>
            <button class="v8-bess-tab-btn" type="button" data-v8-bess-tab="notes">Notes</button>
        </div>

        <div id="v8_bess_tab_layout" class="v8-bess-tab-panel active" data-v8-bess-panel="layout">
            <h3>BESS Power and Energy</h3>
            <div class="input-group"><label>Grid Export Limit MW</label><input type="number" id="bess_export_mw" value="50" step="1" min="0" /></div>
            <div class="input-group"><label>Storage Duration Hours</label><input type="number" id="bess_duration_h" value="3" step="0.25" min="0" /></div>
            <div class="input-group"><label>Required Energy MWh</label><input type="number" id="bess_energy_mwh" value="150" step="1" min="0" /></div>
            <button id="btn_bess_sync_energy" type="button" class="btn-main">Set MWh from MW x hours</button>

            <h3>BESS Containers</h3>
            <div class="input-group"><label>Container Size</label><select id="bess_container_size"><option value="20ft">20 ft</option><option value="40ft" selected>40 ft</option></select></div>
            <div class="input-group"><label>Energy per Container MWh</label><input type="number" id="bess_container_mwh" value="5" step="0.1" min="0.1" /></div>
            <div class="input-group"><label>Container Length m</label><input type="number" id="bess_container_l" value="12.2" step="0.1" min="1" /></div>
            <div class="input-group"><label>Container Width m</label><input type="number" id="bess_container_w" value="2.44" step="0.01" min="1" /></div>
            <div class="input-group"><label>Container Spacing m</label><input type="number" id="bess_container_gap" value="2.5" step="0.1" min="0" /></div>
            <div class="input-group"><label>Containers per Row</label><input type="number" id="bess_containers_per_row" value="10" step="1" min="1" /></div>
            <div class="input-group"><label>Row Spacing m</label><input type="number" id="bess_row_gap" value="6" step="0.5" min="0" /></div>
        </div>

        <div id="v8_bess_tab_pcs" class="v8-bess-tab-panel" data-v8-bess-panel="pcs">
            <h3>PCS and Layout Mode</h3>
            <div class="input-group"><label>Layout Mode</label><select id="bess_layout_mode"><option value="integrated">Integrated PCS Transformer Station</option><option value="separated">External Transformer with Separate PCS</option><option value="distributed">Distributed PCS Islands</option><option value="corridor">PCS Corridor Layout</option><option value="central">Central PCS Block</option><option value="hv_compound">Transmission Scale HV Compound</option></select></div>
            <div class="input-group"><label>PCS Rating MW</label><input type="number" id="bess_pcs_mw" value="50" step="0.1" min="0.1" /></div>
            <div class="input-group"><label>Containers per PCS</label><input type="number" id="bess_containers_per_pcs" value="30" step="1" min="1" /></div>
            <div class="input-group"><label>Access Road Width m</label><input type="number" id="bess_access_road_m" value="6" step="0.5" min="0" /></div>
            <div class="input-group"><label>Rotation Degrees</label><input type="number" id="bess_rotation_deg" value="0" step="5" /></div>
        </div>

        <div id="v8_bess_tab_finance" class="v8-bess-tab-panel" data-v8-bess-panel="finance">
            <h3>BESS Summary</h3>
            <div class="stat-row"><span>Required Containers</span><span class="stat-val" id="bess_out_containers">30</span></div>
            <div class="stat-row"><span>PCS Count</span><span class="stat-val" id="bess_out_pcs">1</span></div>
            <div class="stat-row"><span>Total PCS Power</span><span class="stat-val" id="bess_out_pcs_power">50 MW</span></div>
            <div class="stat-row"><span>Approximate BESS Field</span><span class="stat-val" id="bess_out_field">0 m x 0 m</span></div>
            <div class="stat-row"><span>Export Cap</span><span class="stat-val" id="bess_out_export">50 MW</span></div>
            <div class="stat-row"><span>Energy Duration</span><span class="stat-val" id="bess_out_duration">3 h</span></div>
            <div class="ux-note">Finance fields will be added after the BESS geometry is stable. This prevents hidden PV finance assumptions from being mistaken for BESS economics.</div>
        </div>

        <div id="v8_bess_tab_map" class="v8-bess-tab-panel" data-v8-bess-panel="map">
            <h3>Map and Export</h3>
            <div class="v8-bess-actions">
                <button id="btn_bess_draw_geo" type="button" class="btn-main">Draw BESS on Map</button>
                <button id="btn_bess_reset_geo" type="button" class="btn-main">Reset BESS Drawing</button>
                <button id="btn_bess_export_geojson" type="button" class="btn-main">Export BESS GeoJSON</button>
            </div>
            <div class="ux-note">Map drawing is layout screening only. Cable sizing and protection validation remain outside this app.</div>
        </div>

        <div id="v8_bess_tab_notes" class="v8-bess-tab-panel" data-v8-bess-panel="notes">
            <h3>Scope Notes</h3>
            <div class="ux-note v8-bess-note-block">This V8 screen is for standalone BESS layout, PCS arrangement and simple geospatial placement. It keeps the working V7 GIS frame but must not destabilise V7.</div>
            <div class="ux-note v8-bess-note-block">Future advanced versions may add client substation footprint, transformer bay footprint, fire access logic, acoustic barrier allowance and separate electrical topology review links.</div>
            <div class="ux-note v8-bess-note-block">Do not add cable sizing, R, X, Z impedance, leakage, reverse current or protection coordination into this layout tab. Those belong in the advanced topology review.</div>
        </div>
    </section>'''

CSS_BLOCK = '''

/* GLOBALGRID2050 V8 BESS TABS SMALL STEP */
.v8-bess-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 10px 0;
  border-bottom: 1px solid var(--line);
  padding-bottom: 8px;
}
.v8-bess-tab-btn {
  flex: 1 1 86px;
  background: rgba(5, 5, 5, 0.9);
  color: var(--muted);
  border: 1px solid #444;
  border-radius: 3px;
  padding: 8px 6px;
  font-family: "Courier New", monospace;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
}
.v8-bess-tab-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(0, 255, 255, 0.06);
}
.v8-bess-tab-panel { display: none; }
.v8-bess-tab-panel.active { display: block; }
.v8-bess-actions { display: grid; gap: 8px; }
.v8-bess-note-block {
  display: block;
  border-left: 2px solid var(--accent);
  padding-left: 8px;
  margin: 8px 0;
  font-style: normal;
}
@media (max-width: 520px) {
  .v8-bess-tab-btn { flex-basis: 45%; font-size: 9px; }
}
'''

JS_BLOCK = '''

// GLOBALGRID2050 V8 BESS TABS SMALL STEP
function v8InitBessTabsSmallStep() {
    const panel = document.getElementById('v8_bess_panel');
    if (!panel) return;
    const buttons = panel.querySelectorAll('[data-v8-bess-tab]');
    const panels = panel.querySelectorAll('[data-v8-bess-panel]');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const target = button.dataset.v8BessTab;
            buttons.forEach(btn => btn.classList.toggle('active', btn === button));
            panels.forEach(item => item.classList.toggle('active', item.dataset.v8BessPanel === target));
        });
    });
}

document.addEventListener('DOMContentLoaded', v8InitBessTabsSmallStep);
'''


def replace_panel(text: str) -> str:
    marker = '    <section id="v8_bess_panel" class="v8-bess-panel">'
    start = text.find(marker)
    if start == -1:
        raise SystemExit('v8_bess_panel start not found')
    hidden_marker = '\n\n    <div class="tab-container v8-hidden-pv">'
    end = text.find(hidden_marker, start)
    if end == -1:
        raise SystemExit('hidden PV marker not found after BESS panel')
    return text[:start] + TABBED_PANEL + text[end:]


def append_once(text: str, marker: str, block: str) -> str:
    if marker in text:
        return text
    return text.rstrip() + block + '\n'


def main() -> int:
    index = INDEX.read_text(encoding='utf-8')
    css = CSS.read_text(encoding='utf-8')
    ui = UI.read_text(encoding='utf-8')

    INDEX.write_text(replace_panel(index), encoding='utf-8')
    CSS.write_text(append_once(css, 'GLOBALGRID2050 V8 BESS TABS SMALL STEP', CSS_BLOCK), encoding='utf-8')
    UI.write_text(append_once(ui, 'v8InitBessTabsSmallStep', JS_BLOCK), encoding='utf-8')

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        '# Patch V8 BESS Tabs Small Step\n\n'
        f'Generated UTC: {dt.datetime.now(dt.timezone.utc).isoformat()}\n\n'
        '## Scope\n\n'
        'Adds compact BESS tabs inside the existing V8 BESS panel. No V7 files are modified. Map logic is not rebuilt. Hidden PV controls are left in place for now to avoid destabilising the inherited V7 frame.\n\n'
        '## Tabs\n\n'
        'Layout, PCS, Finance, Map Export and Notes.\n\n'
        '## Next safe step\n\n'
        'After live testing, add one BESS finance input group or one BESS map improvement only.\n',
        encoding='utf-8'
    )
    print('Patched V8 BESS tabs small step')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
