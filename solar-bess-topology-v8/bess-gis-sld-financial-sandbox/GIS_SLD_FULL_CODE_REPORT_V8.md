# V8 BESS GIS SLD Financial Sandbox Full Code Report

Generated UTC: 2026-05-23T04:38:25.646465+00:00

## Purpose

V8 standalone BESS GIS SLD development frame.

This file is an AI and GridBot analysis artefact. Read it before modifying this GIS SLD app. It is not linked from the public homepage and should be treated as an internal development reference in the public repository.

## Read first

Future AI, LLM and GridBot workflows should read this report before editing this app. Changes should then be made in small controlled steps, preferably 1 module at a time, with a dedicated script, test and workflow.

## Scope boundary

V8 is the standalone BESS development frame. It should not destabilise V7. Cable sizing, R, X, Z impedance, leakage, reverse current and protection coordination should remain in the advanced topology review unless deliberately promoted in a controlled future feature.

## File inventory

```text
README.md
index.html
gis-sld-v5-config.js
gis-sld-v5-helpers.js
gis-sld-v5-state.js
gis-sld-v5-substations.js
gis-sld-v5-map.js
gis-sld-v5-calculations.js
gis-sld-v5-finance.js
gis-sld-v5-ui-core.js
gis-sld-v5-drawing.js
gis-sld-v5-export.js
gis-sld-v5-ui.js
gis-sld-v5.css
bess-gis-sld-financial-sandbox.css
bess-gis-sld-financial-sandbox.js
```

## Full source code

### `README.md`

Lines: 25

```markdown
# BESS GIS SLD Financial Sandbox V8

This app is rebuilt from the working V7 GIS SLD Financial Sandbox frame.

## What is kept from V7

- MapLibre map frame.
- CARTO / satellite map logic.
- Location search.
- Grid and substation GIS frame.
- Existing V7 map controls and UI structure.

## What V8 adds

- BESS MW and MWh inputs.
- 20 ft and 40 ft container assumptions.
- Energy per container.
- PCS rating and containers per PCS.
- BESS layout modes.
- Geospatial BESS drawing on the map.
- BESS GeoJSON export.

## Boundary

Cable sizing, cable impedance, leakage, reverse current and protection coordination remain in the advanced BESS Electrical Topology Review.
```

### `index.html`

Lines: 550

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>BESS GIS SLD Financial Sandbox V8</title>

<link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js" defer></script>

<script src="gis-sld-v5-config.js"></script>

<script src="gis-sld-v5-helpers.js"></script>

<script src="gis-sld-v5-state.js"></script>

<script src="gis-sld-v5-substations.js"></script>

<link rel="stylesheet" href="gis-sld-v5.css">

</head>
<body>

<div class="dashboard">
    <div class="panel panel-left">
        <h2>BESS GIS SLD Financial Sandbox V8 <span class="v8-dev-label">(in development)</span></h2>

    <div class="search-box">
        <input type="text" id="loc_search" placeholder="Enter location (e.g. London)..." />
        <button id="btn_search">FLY</button>
    </div>



    <section id="v8_bess_panel" class="v8-bess-panel">
        <h3>BESS GIS SLD Financial Sandbox V8</h3>
        <div class="ux-note">BESS only study frame. Containers provide energy in MWh. PCS provides power in MW. Grid export caps the maximum export. Cable sizing, R, X, Z, leakage, reverse current and protection coordination remain in the advanced topology review.</div>

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

        <h3>PCS and Layout Mode</h3>
        <div class="input-group"><label>Layout Mode</label><select id="bess_layout_mode"><option value="integrated">Integrated PCS Transformer Station</option><option value="separated">External Transformer with Separate PCS</option><option value="distributed">Distributed PCS Islands</option><option value="corridor">PCS Corridor Layout</option><option value="central">Central PCS Block</option><option value="hv_compound">Transmission Scale HV Compound</option></select></div>
        <div class="input-group"><label>PCS Rating MW</label><input type="number" id="bess_pcs_mw" value="50" step="0.1" min="0.1" /></div>
        <div class="input-group"><label>Containers per PCS</label><input type="number" id="bess_containers_per_pcs" value="30" step="1" min="1" /></div>
        <div class="input-group"><label>Access Road Width m</label><input type="number" id="bess_access_road_m" value="6" step="0.5" min="0" /></div>
        <div class="input-group"><label>Rotation Degrees</label><input type="number" id="bess_rotation_deg" value="0" step="5" /></div>

        <h3>BESS Summary</h3>
        <div class="stat-row"><span>Required Containers</span><span class="stat-val" id="bess_out_containers">30</span></div>
        <div class="stat-row"><span>PCS Count</span><span class="stat-val" id="bess_out_pcs">1</span></div>
        <div class="stat-row"><span>Total PCS Power</span><span class="stat-val" id="bess_out_pcs_power">50 MW</span></div>
        <div class="stat-row"><span>Approximate BESS Field</span><span class="stat-val" id="bess_out_field">0 m x 0 m</span></div>
        <div class="stat-row"><span>Export Cap</span><span class="stat-val" id="bess_out_export">50 MW</span></div>
        <div class="stat-row"><span>Energy Duration</span><span class="stat-val" id="bess_out_duration">3 h</span></div>

        <div class="v8-bess-actions">
            <button id="btn_bess_draw_geo" type="button" class="btn-main">Draw BESS on Map</button>
            <button id="btn_bess_reset_geo" type="button" class="btn-main">Reset BESS Drawing</button>
            <button id="btn_bess_export_geojson" type="button" class="btn-main">Export BESS GeoJSON</button>
        </div>
    </section>

    <div class="tab-container v8-hidden-pv">
        <button class="tab-btn active" id="tabbtn_string" data-tab="string">String</button>
        <button class="tab-btn" id="tabbtn_central" data-tab="central">Central</button>
    </div>

    <div id="string_tab" class="tab-content active v8-hidden-pv">
        <h3>Dimensions & Physics</h3>
        <div class="input-group"><label>Module Rating (Wp)</label><input type="number" id="mod_wp" value="660" min="1" /></div>
        <div class="input-group">
            <label>Mod L x W (m)</label>
            <div style="display: flex; gap: 4px;">
                <input type="number" id="mod_l" value="2.38" step="0.01" min="0.01" style="width: 45px;" />
                <input type="number" id="mod_w" value="1.30" step="0.01" min="0.01" style="width: 45px;" />
            </div>
        </div>
        <div class="input-group">
            <label>Mounting & GCR</label>
            <select id="mounting_type">
                <option value="0.75">East-West Dome (~75%)</option>
                <option value="0.45" selected>Fixed Tilt South (~45%)</option>
                <option value="0.35">Tracker (~35%)</option>
            </select>
        </div>
        <div class="input-group"><label>Gross Site Factor</label><input type="number" id="gross_factor" value="1.35" step="0.05" min="1.0" /></div>

        <h3>Array Hierarchy (String)</h3>
        <div class="input-group array-size-control"><label>Target DC Capacity MWp</label><input type="number" id="target_dc_mwp" value="" placeholder="Optional" step="1" min="0.1" /></div>
        <div class="ux-note array-size-note">Optional sizing helper. Enter a target MWp DC and the sandbox will resize by whole skid and ring main steps. Module rating, modules per string, strings per inverter and inverter rating remain user controlled.</div>
        <div class="input-group"><label>DC/AC Ratio</label><input type="number" id="dc_ac_ratio" value="1.20" step="0.05" min="0.01" /></div>
        <div class="input-group"><label>String Inverter Rating kVA</label><input type="number" id="string_inv_kva" value="352" step="1" min="1" /></div>
        <div class="input-group"><label>String Skid Transformer Rating MVA</label><input type="number" id="string_skid_mva" value="8.96" step="0.01" min="0.1" /></div>
        <div class="input-group"><label>Modules per String</label><input type="number" id="x_mods" value="28" min="1" /></div>
        <div class="input-group"><label>Strings per String Inverter</label><input type="number" id="z_strings" value="18" min="1" /></div>
        <div class="input-group"><label>String Inverters per Skid</label><input type="number" id="y_invs" value="28" min="1" /></div>
        <div class="input-group"><label>Skids per 33 kV Ring Main</label><input type="number" id="s_subs" value="5" min="1" /></div>
        <div class="input-group"><label>Number of 33 kV Ring Main Circuits</label><input type="number" id="b_cols" value="6" min="1" /></div>

        <h3>Module Logistics</h3>
        <div class="input-group">
            <label>Packaging Preset</label>
            <select id="logistics_preset" data-suffix="">
                <option value="high_density" selected>High Density (33/box, 594/40ft)</option>
                <option value="legacy">Standard Legacy (31/box, 620/40ft)</option>
                <option value="manual">Manual Entry</option>
            </select>
        </div>
        <div class="input-group"><label>Modules / Packing Unit</label><input type="number" id="mods_pallet" value="33" min="1" /></div>
        <div class="input-group"><label>Mods / 40ft Container</label><input type="number" id="mods_container" value="594" min="1" /></div>
        <div class="input-group"><label>Spare Allowance %</label><input type="number" id="spare_pct" value="1.0" step="0.1" min="0" /></div>

        <details class="finance-box">
            <summary>Baseline Project Economics</summary>
            <div class="finance-headline">
                <div class="stat-row"><span>Year 1 Revenue Projection</span><span class="stat-val" id="fin_string_annual_rev">£0</span></div>
                <div class="stat-row"><span>25 Year Revenue Projection</span><span class="stat-val" id="fin_string_25_rev">£0</span></div>
                <div class="stat-row"><span>35 Year Revenue Projection</span><span class="stat-val" id="fin_string_35_rev">£0</span></div>
                <div class="stat-row"><span>Total CAPEX</span><span class="stat-val" id="fin_string_capex">£0</span></div>
                <div class="stat-row"><span>CAPEX per Wp</span><span class="stat-val" id="fin_string_capex_wp">£0.00/Wp</span></div>
                <div class="stat-row"><span>Undiscounted 25 Year Cash Surplus</span><span class="stat-val" id="fin_string_surplus_25">£0</span></div>
                <div class="stat-row"><span>Undiscounted 35 Year Cash Surplus</span><span class="stat-val" id="fin_string_surplus_35">£0</span></div>
            </div>

            <h3>Revenue</h3>
            <div class="input-group"><label>Energy Price £/MWh</label><input type="number" id="fin_string_price" value="65" step="1" min="0"></div>
            <div class="input-group"><label>Other Income £/MWh</label><input type="number" id="fin_string_other" value="0" step="1" min="0"></div>
            <div class="input-group"><label>Base Yield kWh/kWp</label><input type="number" id="fin_string_yield" value="1000" step="10" min="0"></div>
            <div class="input-group"><label>Bifacial Gain %</label><input type="number" id="fin_string_bifacial" value="5" step="0.5" min="0" max="15"></div>
            <div class="input-group"><label>Base Losses %</label><input type="number" id="fin_string_losses" value="2" step="0.1" min="0"></div>
            <div class="input-group"><label>Degradation % (Yr 2+)</label><input type="number" id="fin_string_deg" value="0.4" step="0.01" min="0"></div>
            <div class="input-group"><label>OPEX £/MWac/yr</label><input type="number" id="fin_string_opex" value="25000" step="1000" min="0"></div>

            <h3>Development Financials</h3>
<div class="finance-headline">
    <div class="stat-row"><span>Development Capital at Risk</span><span class="stat-val" id="fin_string_dev_capital">£0</span></div>
    <div class="stat-row"><span>Module Supply Cost</span><span class="stat-val" id="fin_string_dev_module_cost">£0</span></div>
    <div class="stat-row"><span>EPC Cost</span><span class="stat-val" id="fin_string_dev_epc_cost">£0</span></div>
    <div class="stat-row"><span>Other Owner Costs</span><span class="stat-val" id="fin_string_dev_owner_cost">£0</span></div>
<div class="stat-row"><span>Grid Connection Cost</span><span class="stat-val" id="fin_string_dev_grid_cost">£0</span></div>
    <div class="stat-row"><span>Total Build Cost</span><span class="stat-val" id="fin_string_dev_total_cost">£0</span></div>
    <div class="stat-row"><span>Target Exit Value</span><span class="stat-val" id="fin_string_dev_exit_value">£0</span></div>
<div class="stat-row"><span>Operating Asset Net Present Value (NPV)</span><span class="stat-val" id="fin_string_dev_operating_npv">£0</span></div>
    <div class="stat-row"><span>Gross Development Margin</span><span class="stat-val" id="fin_string_dev_margin">£0</span></div>
    <div class="stat-row"><span>Risk Adjusted Development Value</span><span class="stat-val" id="fin_string_dev_risk_value">£0</span></div>
    <div class="stat-row"><span>Development Equity Money Multiple</span><span class="stat-val" id="fin_string_dev_multiple">0.00x</span></div>
</div>

<div class="input-group" style="display: block; margin-bottom: 8px;">
    <label style="margin-bottom: 4px; display: block;">Development Stage</label>
    <select id="fin_string_dev_stage" data-dev-stage-prefix="fin_string" style="width: 100%;">
        <option value="3000">Land Option Signed</option>
        <option value="15000">Grid Connection Application Accepted</option>
        <option value="35000">Planning Application Submitted</option>
        <option value="55000">Planning Permission Granted</option>
        <option value="70000">Grid Connection Terms Reviewed and Agreed</option>
        <option value="80000">Buyer or Revenue Agreement Reviewed (Power Purchase Agreement (PPA) / Offtaker)</option>
        <option value="100000" selected>Construction Contract Signed and Finance Committed (Financial Close)</option>
    </select>
</div>
<div class="input-group"><label>Development Cost £/MW</label><input type="number" id="fin_string_dev_cost_mw" value="100000" step="5000" min="0"></div>
<div class="input-group"><label>Module Supply Cost £/MWp</label><input type="number" id="fin_string_dev_module_mwp" value="150000" step="10000" min="0"></div>
<div class="input-group"><label>EPC Cost £/MW</label><input type="number" id="fin_string_dev_epc_mw" value="500000" step="25000" min="0"></div>
<div class="input-group"><label>Other Owner Costs £/MW</label><input type="number" id="fin_string_dev_owner_mw" value="100000" step="25000" min="0"></div>
<div class="input-group"><label>Grid Connection Cost £ per Megawatt (MW)</label><input type="number" id="fin_string_dev_grid_mw" value="100000" step="25000" min="0"></div>
<div class="input-group"><label>Target Exit Value £/MWp</label><input type="number" id="fin_string_dev_exit_mwp" value="1350000" step="50000" min="0"></div>
<div class="input-group"><label>Operating Asset Net Present Value (NPV) £ per Megawatt peak (MWp)</label><input type="number" id="fin_string_dev_npv_mwp" value="1200000" step="50000" min="0"></div>
<div class="input-group"><label>Development Success Probability %</label><input type="number" id="fin_string_dev_success" value="15" step="1" min="0" max="100"></div>
<div class="input-group"><label>Development Years</label><input type="number" id="fin_string_dev_years" value="4" step="0.5" min="0"></div>

<h3>CAPEX</h3>
<div class="input-group"><label>Modules £/Wp</label><input type="number" id="fin_string_modules" value="0.15" step="0.01" min="0"></div>
<div class="input-group"><label>EPC ex Modules £/Wp</label><input type="number" id="fin_string_epc_ex" value="0.30" step="0.01" min="0"></div>
<div class="input-group">
    <label>Flood Resilience</label>
    <div style="display: flex; gap: 4px; align-items: center;">
        <input type="checkbox" id="fin_string_flood" />
        <input type="number" id="fin_string_flood_rate" value="0.03" step="0.01" min="0" style="width: 50px;" />
    </div>
</div>
<div class="input-group"><label>Other CAPEX £/Wp</label><input type="number" id="fin_string_other_capex" value="0.20" step="0.01" min="0"></div>
<div class="input-group"><label>Fixed CAPEX £</label><input type="number" id="fin_string_fixed_capex" value="1500000" step="50000" min="0"></div>
<div class="input-group"><label>Contingency %</label><input type="number" id="fin_string_cont" value="7" step="0.5" min="0"></div>

            <h3>Loss Allowances</h3>
            <div class="input-group"><label>DC String Cable Loss %</label><input type="number" id="fin_string_loss_dc_string" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>LV Main DC Loss %</label><input type="number" id="fin_string_loss_lv_dc" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>LV AC Loss %</label><input type="number" id="fin_string_loss_lv_ac" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>Transformer Loss %</label><input type="number" id="fin_string_loss_tx" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>Other Electrical Loss %</label><input type="number" id="fin_string_loss_other" value="0" step="0.1" min="0"></div>

            <h3>BESS Optional</h3>
            <div class="input-group"><label>BESS Power MW</label><input type="number" id="fin_string_bess_mw" value="0" step="1" min="0"></div>
            <div class="input-group"><label>BESS Energy MWh</label><input type="number" id="fin_string_bess_mwh" value="0" step="1" min="0"></div>
            <div class="input-group"><label>BESS CAPEX £/MWh</label><input type="number" id="fin_string_bess_capex" value="0" step="10000" min="0"></div>
            <div class="input-group"><label>BESS Cycles / Year</label><input type="number" id="fin_string_bess_cycles" value="0" step="10" min="0"></div>
            <div class="input-group"><label>BESS Spread £/MWh</label><input type="number" id="fin_string_bess_spread" value="0" step="1" min="0"></div>
            <div class="input-group"><label>BESS Efficiency %</label><input type="number" id="fin_string_bess_eff" value="88" step="1" min="0" max="100"></div>

            <div class="warning-box" id="fin_string_warnings"></div>
        </details>
    </div>

    <div id="central_tab" class="tab-content v8-hidden-pv">
        <h3>Dimensions & Physics</h3>
        <div class="input-group"><label>Module Rating (Wp)</label><input type="number" id="mod_wp_c" value="660" min="1" /></div>
        <div class="input-group">
            <label>Mod L x W (m)</label>
            <div style="display: flex; gap: 4px;">
                <input type="number" id="mod_l_c" value="2.38" step="0.01" min="0.01" style="width: 45px;" />
                <input type="number" id="mod_w_c" value="1.30" step="0.01" min="0.01" style="width: 45px;" />
            </div>
        </div>
        <div class="input-group">
            <label>Mounting & GCR</label>
            <select id="mounting_type_c">
                <option value="0.75">East-West Dome (~75%)</option>
                <option value="0.45" selected>Fixed Tilt South (~45%)</option>
                <option value="0.35">Tracker (~35%)</option>
            </select>
        </div>
        <div class="input-group"><label>Gross Site Factor</label><input type="number" id="gross_factor_c" value="1.35" step="0.05" min="1.0" /></div>

        <h3>Array Hierarchy (Central)</h3>
        <div class="input-group array-size-control"><label>Target DC Capacity MWp</label><input type="number" id="target_dc_mwp_c" value="" placeholder="Optional" step="1" min="0.1" /></div>
        <div class="ux-note array-size-note">Optional sizing helper. Enter a target MWp DC and the sandbox will resize by whole central inverter, skid and ring main steps. Module rating, modules per string and central inverter ratings remain user controlled.</div>
        <div class="input-group"><label>Central Inverter DC Input Rating MWdc</label><input type="number" id="inv_dc_mw_c" value="5.28" step="0.01" min="0.1" max="30" /></div>
        <div class="input-group"><label>Central Inverter AC Output Rating MWac</label><input type="number" id="inv_ac_mw_c" value="4.40" step="0.01" min="0.1" max="20" /></div>
        <div class="input-group"><label>Central Skid Transformer Rating MVA</label><input type="number" id="central_skid_mva_c" value="4.40" step="0.01" min="0.1" max="25" /></div>
        <div class="ux-note">A skid is a factory assembled power package. It usually combines inverter equipment, transformer, switchgear, protection and auxiliary systems on a transportable base or frame. Finance and non technical teams can treat each skid as one repeatable cost and power block. Values above 10 MWac should be treated as large power block assumptions and require transformer, MV switchgear, harmonic, thermal, protection and grid code verification.</div>
        <div class="input-group"><label>Calculated DC/AC Ratio</label><input type="number" id="dc_ac_ratio_c" value="1.20" step="0.05" min="0.01" /></div>
        <div class="input-group"><label>Modules / String</label><input type="number" id="x_mods_c" value="28" min="1" /></div>
        <div class="input-group"><label>Strings per Combiner Box</label><input type="number" id="str_per_cb_c" value="24" min="1" /></div>
        <div class="input-group"><label>Combiner Box Design Limit kWdc</label><input type="number" id="combiner_limit_kwdc_c" value="500" step="10" min="1" /></div>
        <div class="input-group"><label>Central Inverter Units per Skid</label><input type="number" id="inv_per_mv_c" value="1" min="1" /></div>
        <div class="input-group"><label>Central Skids per 33 kV Ring Main</label><input type="number" id="mv_per_ring_c" value="4" min="1" /></div>
        <div class="input-group"><label>Number of 33 kV Ring Main Circuits</label><input type="number" id="rings_c" value="4" min="1" /></div>

        <h3>Module Logistics</h3>
        <div class="input-group">
            <label>Packaging Preset</label>
            <select id="logistics_preset_c" data-suffix="_c">
                <option value="high_density" selected>High Density (33/box, 594/40ft)</option>
                <option value="legacy">Standard Legacy (31/box, 620/40ft)</option>
                <option value="manual">Manual Entry</option>
            </select>
        </div>
        <div class="input-group"><label>Modules / Packing Unit</label><input type="number" id="mods_pallet_c" value="33" min="1" /></div>
        <div class="input-group"><label>Mods / 40ft Container</label><input type="number" id="mods_container_c" value="594" min="1" /></div>
        <div class="input-group"><label>Spare Allowance %</label><input type="number" id="spare_pct_c" value="1.0" step="0.1" min="0" /></div>

        <details class="finance-box">
            <summary>Baseline Project Economics</summary>
            <div class="finance-headline">
                <div class="stat-row"><span>Year 1 Revenue Projection</span><span class="stat-val" id="fin_central_annual_rev">£0</span></div>
                <div class="stat-row"><span>25 Year Revenue Projection</span><span class="stat-val" id="fin_central_25_rev">£0</span></div>
                <div class="stat-row"><span>35 Year Revenue Projection</span><span class="stat-val" id="fin_central_35_rev">£0</span></div>
                <div class="stat-row"><span>Total CAPEX</span><span class="stat-val" id="fin_central_capex">£0</span></div>
                <div class="stat-row"><span>CAPEX per Wp</span><span class="stat-val" id="fin_central_capex_wp">£0.00/Wp</span></div>
                <div class="stat-row"><span>Undiscounted 25 Year Cash Surplus</span><span class="stat-val" id="fin_central_surplus_25">£0</span></div>
                <div class="stat-row"><span>Undiscounted 35 Year Cash Surplus</span><span class="stat-val" id="fin_central_surplus_35">£0</span></div>
            </div>

            <h3>Revenue</h3>
            <div class="input-group"><label>Energy Price £/MWh</label><input type="number" id="fin_central_price" value="65" step="1" min="0"></div>
            <div class="input-group"><label>Other Income £/MWh</label><input type="number" id="fin_central_other" value="0" step="1" min="0"></div>
            <div class="input-group"><label>Base Yield kWh/kWp</label><input type="number" id="fin_central_yield" value="1000" step="10" min="0"></div>
            <div class="input-group"><label>Bifacial Gain %</label><input type="number" id="fin_central_bifacial" value="5" step="0.5" min="0" max="15"></div>
            <div class="input-group"><label>Base Losses %</label><input type="number" id="fin_central_losses" value="2" step="0.1" min="0"></div>
            <div class="input-group"><label>Degradation % (Yr 2+)</label><input type="number" id="fin_central_deg" value="0.4" step="0.01" min="0"></div>
            <div class="input-group"><label>OPEX £/MWac/yr</label><input type="number" id="fin_central_opex" value="25000" step="1000" min="0"></div>

            <h3>Development Financials</h3>
<div class="finance-headline">
    <div class="stat-row"><span>Development Capital at Risk</span><span class="stat-val" id="fin_central_dev_capital">£0</span></div>
    <div class="stat-row"><span>Module Supply Cost</span><span class="stat-val" id="fin_central_dev_module_cost">£0</span></div>
    <div class="stat-row"><span>EPC Cost</span><span class="stat-val" id="fin_central_dev_epc_cost">£0</span></div>
    <div class="stat-row"><span>Other Owner Costs</span><span class="stat-val" id="fin_central_dev_owner_cost">£0</span></div>
<div class="stat-row"><span>Grid Connection Cost</span><span class="stat-val" id="fin_central_dev_grid_cost">£0</span></div>
    <div class="stat-row"><span>Total Build Cost</span><span class="stat-val" id="fin_central_dev_total_cost">£0</span></div>
    <div class="stat-row"><span>Target Exit Value</span><span class="stat-val" id="fin_central_dev_exit_value">£0</span></div>
<div class="stat-row"><span>Operating Asset Net Present Value (NPV)</span><span class="stat-val" id="fin_central_dev_operating_npv">£0</span></div>
    <div class="stat-row"><span>Gross Development Margin</span><span class="stat-val" id="fin_central_dev_margin">£0</span></div>
    <div class="stat-row"><span>Risk Adjusted Development Value</span><span class="stat-val" id="fin_central_dev_risk_value">£0</span></div>
    <div class="stat-row"><span>Development Equity Money Multiple</span><span class="stat-val" id="fin_central_dev_multiple">0.00x</span></div>
</div>

<div class="input-group" style="display: block; margin-bottom: 8px;">
    <label style="margin-bottom: 4px; display: block;">Development Stage</label>
    <select id="fin_central_dev_stage" data-dev-stage-prefix="fin_central" style="width: 100%;">
        <option value="3000">Land Option Signed</option>
        <option value="15000">Grid Connection Application Accepted</option>
        <option value="35000">Planning Application Submitted</option>
        <option value="55000">Planning Permission Granted</option>
        <option value="70000">Grid Connection Terms Reviewed and Agreed</option>
        <option value="80000">Buyer or Revenue Agreement Reviewed (Power Purchase Agreement (PPA) / Offtaker)</option>
        <option value="100000" selected>Construction Contract Signed and Finance Committed (Financial Close)</option>
    </select>
</div>
<div class="input-group"><label>Development Cost £/MW</label><input type="number" id="fin_central_dev_cost_mw" value="100000" step="5000" min="0"></div>
<div class="input-group"><label>Module Supply Cost £/MWp</label><input type="number" id="fin_central_dev_module_mwp" value="150000" step="10000" min="0"></div>
<div class="input-group"><label>EPC Cost £/MW</label><input type="number" id="fin_central_dev_epc_mw" value="500000" step="25000" min="0"></div>
<div class="input-group"><label>Other Owner Costs £/MW</label><input type="number" id="fin_central_dev_owner_mw" value="100000" step="25000" min="0"></div>
<div class="input-group"><label>Grid Connection Cost £ per Megawatt (MW)</label><input type="number" id="fin_central_dev_grid_mw" value="100000" step="25000" min="0"></div>
<div class="input-group"><label>Target Exit Value £/MWp</label><input type="number" id="fin_central_dev_exit_mwp" value="1350000" step="50000" min="0"></div>
<div class="input-group"><label>Operating Asset Net Present Value (NPV) £ per Megawatt peak (MWp)</label><input type="number" id="fin_central_dev_npv_mwp" value="1200000" step="50000" min="0"></div>
<div class="input-group"><label>Development Success Probability %</label><input type="number" id="fin_central_dev_success" value="15" step="1" min="0" max="100"></div>
<div class="input-group"><label>Development Years</label><input type="number" id="fin_central_dev_years" value="4" step="0.5" min="0"></div>

<h3>CAPEX</h3>
<div class="input-group"><label>Modules £/Wp</label><input type="number" id="fin_central_modules" value="0.15" step="0.01" min="0"></div>
<div class="input-group"><label>EPC ex Modules £/Wp</label><input type="number" id="fin_central_epc_ex" value="0.30" step="0.01" min="0"></div>
<div class="input-group">
    <label>Flood Resilience</label>
    <div style="display: flex; gap: 4px; align-items: center;">
        <input type="checkbox" id="fin_central_flood" />
        <input type="number" id="fin_central_flood_rate" value="0.03" step="0.01" min="0" style="width: 50px;" />
    </div>
</div>
<div class="input-group"><label>Other CAPEX £/Wp</label><input type="number" id="fin_central_other_capex" value="0.20" step="0.01" min="0"></div>
<div class="input-group"><label>Fixed CAPEX £</label><input type="number" id="fin_central_fixed_capex" value="1500000" step="50000" min="0"></div>
<div class="input-group"><label>Contingency %</label><input type="number" id="fin_central_cont" value="7" step="0.5" min="0"></div>

            <h3>Loss Allowances</h3>
            <div class="input-group"><label>DC String Cable Loss %</label><input type="number" id="fin_central_loss_dc_string" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>LV Main DC Loss %</label><input type="number" id="fin_central_loss_lv_dc" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>LV AC Loss %</label><input type="number" id="fin_central_loss_lv_ac" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>Transformer Loss %</label><input type="number" id="fin_central_loss_tx" value="0" step="0.1" min="0"></div>
            <div class="input-group"><label>Other Electrical Loss %</label><input type="number" id="fin_central_loss_other" value="0" step="0.1" min="0"></div>

            <h3>BESS Optional</h3>
            <div class="input-group"><label>BESS Power MW</label><input type="number" id="fin_central_bess_mw" value="0" step="1" min="0"></div>
            <div class="input-group"><label>BESS Energy MWh</label><input type="number" id="fin_central_bess_mwh" value="0" step="1" min="0"></div>
            <div class="input-group"><label>BESS CAPEX £/MWh</label><input type="number" id="fin_central_bess_capex" value="0" step="10000" min="0"></div>
            <div class="input-group"><label>BESS Cycles / Year</label><input type="number" id="fin_central_bess_cycles" value="0" step="10" min="0"></div>
            <div class="input-group"><label>BESS Spread £/MWh</label><input type="number" id="fin_central_bess_spread" value="0" step="1" min="0"></div>
            <div class="input-group"><label>BESS Efficiency %</label><input type="number" id="fin_central_bess_eff" value="88" step="1" min="0" max="100"></div>

            <div class="warning-box" id="fin_central_warnings"></div>
        </details>
    </div>

    <div class="stat-box" style="border-color: #ff3333; background: rgba(255, 51, 51, 0.05); margin-bottom: 15px;">
        <h3 style="margin-top: 0; color: #ff3333; border-bottom-color: #ff3333;">Selected Grid Node</h3>
        <div class="stat-row"><span>Substation:</span><span class="stat-val" id="out_selected_sub_name">None selected</span></div>
        <div class="stat-row"><span>Voltage:</span><span class="stat-val" id="out_selected_sub_voltage">Unknown</span></div>
        <div class="stat-row"><span>Longitude:</span><span class="stat-val" id="out_selected_sub_lon">n/a</span></div>
        <div class="stat-row"><span>Latitude:</span><span class="stat-val" id="out_selected_sub_lat">n/a</span></div>
    </div>

    <div class="stat-box" id="tech_summary_box">
        <h3>Technical Quantity Summary</h3>
        <div class="stat-row"><span>Total Module Count:</span><span class="stat-val" id="out_module_count">0</span></div>
        <div class="stat-row"><span>Total DC Capacity:</span><span class="stat-val cyan" id="out_dc_capacity">0.00 MWp</span></div>
        <div class="stat-row"><span>Implied AC Capacity:</span><span class="stat-val" id="out_ac_capacity">0.00 MWac</span></div>
        <div class="stat-row"><span>DC/AC Ratio:</span><span class="stat-val" id="out_actual_dcac">1.20</span></div>
        <div class="stat-row"><span>String Inverter Rating:</span><span class="stat-val" id="out_string_inv_rating">n/a</span></div>
        <div class="stat-row"><span>Inverter ACmax per Skid:</span><span class="stat-val" id="out_inverter_acmax_mva">0.00 MVA</span></div>
        <div class="stat-row"><span>Skid Transformer Rating:</span><span class="stat-val" id="out_sub_ac_rating">0.00 MVA</span></div>
        <div class="stat-row"><span>33 kV Ring Main AC Rating:</span><span class="stat-val" id="out_ring_ac_rating">0.00 MVA</span></div>
        <div class="stat-row central-only" style="display: none;"><span>Central Inverter DC Input:</span><span class="stat-val" id="out_central_inv_dc_rating">0.00 MWdc</span></div>
        <div class="stat-row central-only" style="display: none;"><span>Central Inverter AC Output:</span><span class="stat-val" id="out_central_inv_rating">0.00 MWac</span></div>
        <div class="stat-row central-only" style="display: none;"><span>Combiner Box DC Capacity:</span><span class="stat-val" id="out_cb_dc_kw">0.00 kWdc</span></div>
        <div class="stat-row"><span>Engineering Warning:</span><span class="stat-val orange" id="out_engineering_warning">Check assumptions</span></div>
        <div class="stat-row central-only" style="display: none;"><span>Central Combiner Boxes / Inverter:</span><span class="stat-val" id="out_cb_per_inv">0</span></div>
        <div class="stat-row central-only" style="display: none;"><span>Total Central Combiner Boxes:</span><span class="stat-val" id="out_total_cb">0</span></div>
        <div style="border-top:1px dashed #333; margin: 8px 0;"></div>
        <div class="stat-row"><span>Net Module Surface Area:</span><span class="stat-val" id="out_net_mod_area">0 Acres</span></div>
        <div class="stat-row"><span>Net Array Area at GCR:</span><span class="stat-val" id="out_net_array_area">0 Acres</span></div>
        <div class="stat-row"><span>Indicative Gross Site Area:</span><span class="stat-val orange" id="out_gross_area">0 Acres</span></div>
        <div style="border-top:1px dashed #333; margin: 8px 0;"></div>
        <div class="stat-row"><span>Modules per Packing Unit:</span><span class="stat-val" id="out_mod_per_pallet">0</span></div>
        <div class="stat-row"><span>Total Packing Units:</span><span class="stat-val" id="out_pallets">0</span></div>
        <div class="stat-row"><span>Modules per Container:</span><span class="stat-val" id="out_mod_per_cont">0</span></div>
        <div class="stat-row"><span>Total Base Containers:</span><span class="stat-val" id="out_containers">0</span></div>
        <div class="stat-row"><span>Spare Module Allowance:</span><span class="stat-val" id="out_spare_pct">0%</span></div>
        <div class="stat-row"><span>Containers (Inc. Spares):</span><span class="stat-val cyan" id="out_containers_spares">0</span></div>
        <div class="stat-row"><span>Containers per MWp:</span><span class="stat-val cyan" id="out_cont_per_mwp">0.00</span></div>
    </div>

    <button class="btn draw-btn" id="btn_draw">⌖ DRAW NEAT GRID</button>
    <button class="btn" id="btn_export">⬇ Export GeoJSON</button>

    <div class="disclaimer-box">
        <strong>ENGINEERING SCREENING OUTPUT</strong><br><br>
        These outputs are indicative screening values only. They are not construction design, financial advice, EPC pricing, grid compliance, logistics planning or transport instruction. All quantities, packaging, site area, cable routes, container loads, module specifications and financial assumptions must be verified against current manufacturer datasheets, project specific drawings, EPC scope, grid requirements and competent engineering review.
    </div>

    <div class="explainer-box">

        <h3>Electrical Topology Explanation</h3>
        <p>A string is a series chain of PV modules. For example, 30 modules per string means the voltage of 30 modules is added before entering the inverter.</p>
        <p>A string inverter converts DC power from several PV strings into low voltage AC power. The inverter rating in kVA defines the apparent AC power capability of each inverter. For example, 28 string inverters rated at 352 kVA create a skid block of approximately 9,856 kVA before transformer and grid limitations.</p>
        <p>A skid is the local electrical station that collects power from a group of inverters. It normally includes low voltage AC switchgear, a step up transformer, protection equipment and a medium voltage connection, often at 33 kV.</p>
        <p>A Ring Main Unit, or RMU, is medium voltage switchgear used to connect skids into a 33 kV network. It normally includes cable switches, protection, earthing switches and sometimes transformer protection.</p>
        <p>A 33 kV ring main is a medium voltage collection circuit that links several skids back toward the main substation or HV station. In this sandbox, Skids per 33 kV Ring Main means how many local substations sit on each medium voltage collection circuit. Number of 33 kV Ring Main Circuits means how many separate collection circuits are used across the solar farm.</p>
        <p>The financial model is driven by this hierarchy. More modules, strings, inverters, substations and 33 kV ring circuits change DC capacity, AC capacity, site area, cable loading, losses, CAPEX, revenue and development value. If the topology assumptions are unrealistic, the financial outputs will also be unrealistic.</p>

        <h3>About the VENTUS GIS SLD Sandbox</h3>
        <p>VENTUS GIS SLD Sandbox is a working engineering screening tool for utility scale solar, storage and grid connection analysis.</p>
        <p>The tool helps users explore the relationship between land, grid proximity, solar topology, module count, inverter architecture, logistics, BESS assumptions and baseline project economics in one visual interface.</p>
        <p>Users can enter a location, view UK substation reference data, select a grid node and generate an indicative solar layout using either string inverter or central inverter topology. The tool can estimate module count, DC capacity, AC capacity, site area, packing units, container loads, baseline revenue, CAPEX assumptions and simple long term financial outputs.</p>
        <p>This is a real engineering screening tool. It is not a final construction design package, grid offer, connection approval, EPC quotation or financial advice. It is designed to support early stage project assessment by making technical, spatial, logistics and financial assumptions visible before deeper engineering, grid, planning, procurement and financial studies begin.</p>
        <p>A key feature of the sandbox is that technical and commercial assumptions are shown together. In real projects, module count becomes logistics. Cable routing becomes electrical loss. Grid proximity becomes interface risk. BESS assumptions affect land, CAPEX and revenue logic. Financial outputs only become useful when the physical assumptions behind them are visible.</p>
        <p>The tool also includes GeoJSON export so that generated layouts and assumptions can be carried into external GIS workflows, reports, internal review or further engineering discussion. The exported data is intended to preserve context, including topology mode, technical assumptions, logistics assumptions, financial assumptions and warnings.</p>
        <p>The public substation layer is reference data only. A visible substation point does not confirm available capacity, connection rights, voltage suitability, cable route, grid acceptance or point of connection approval. Any real project must still be reviewed by competent engineers, grid specialists, planners, EPC teams, legal advisers and project finance professionals before real world decisions are made.</p>
        <p>VENTUS created this sandbox to support better early stage thinking in solar and storage deployment. The aim is to help developers, engineers, suppliers, investors and commercial teams ask better questions before committing time, capital and contractual responsibility.</p>
        <p>Use the sandbox as a thinking tool. Use it to test scale. Use it to compare assumptions. Use it to understand where deeper engineering begins.</p>

<h3>Financial Model Logic</h3>
<p>The financial model is a screening layer for Solar Photovoltaic (PV) development, grid connection, Engineering, Procurement and Construction (EPC) readiness and operating asset value. It is designed to make the main commercial assumptions visible beside the physical layout, not to replace a full valuation report or investment committee model.</p>
<p>The energy price input is a blended screening assumption. It may represent government backed price stabilisation, a private buyer contract, merchant power exposure or a blended revenue case. Users should enter the expected captured electricity price that best reflects the project route to market.</p>
<p>The Operating Asset Net Present Value (NPV) input is user editable because operational value changes with contract quality, revenue certainty, merchant exposure, grid status, asset maturity, inflation, debt assumptions and investor return requirements. A project with stable long term revenue may justify a higher value assumption than a project with greater merchant exposure.</p>
<p>The development cost per Megawatt (MW) input is user editable because development capital at risk rises as a project moves from site identification through grid review, planning, buyer or revenue agreement review, technical design and Engineering, Procurement and Construction (EPC) readiness.</p>
<p>The Target Exit Value input is a screening assumption, not a promised sale value or formal valuation. It helps users test whether there may be development margin after development cost, module supply cost, Engineering, Procurement and Construction (EPC) cost, grid connection cost and owner costs.</p>
<p>The model deliberately avoids pretending to be a full discounted cash flow model. It is a fast comparison tool for early stage decision making. Real projects still require competent engineering, grid studies, planning review, legal review, tax review, debt sizing, revenue analysis and investment committee approval.</p>

<h3>Detailed Screening Disclaimer</h3>
<p>The VENTUS GIS SLD Sandbox is provided as an early stage screening, learning and project qualification tool. It is intended to help users visualise relationships between land, grid proximity, solar topology, cable route assumptions, module count, inverter architecture, logistics, Battery Energy Storage System (BESS) assumptions, capital cost assumptions, revenue assumptions and indicative project economics.</p>
<p>The sandbox does not create, imply or evidence a grid offer, grid connection approval, point of connection approval, available grid capacity, land right, wayleave, easement, planning consent, EPC price, construction programme, investment recommendation, financial valuation, lending approval or insurance acceptance.</p>
<p>Public substation points, voltage references and grid node markers are reference data only. A visible substation point does not confirm voltage suitability, thermal capacity, fault level headroom, protection compatibility, connection queue status, Gate 2 eligibility, land access, constructability, outage availability, reinforcement cost or acceptance by a Distribution Network Operator (DNO), Transmission Owner (TO), National Energy System Operator (NESO) or any other network party.</p>
<p>User drawn cable routes, pin routes, direct route lines and exported route geometries are indicative routing assumptions only. They do not confirm landowner consent, wayleaves, easements, highway rights, railway crossings, watercourse crossings, third party utility conflicts, environmental constraints, planning acceptability, installation method, cable pulling feasibility, trench design, duct design, joint bay location, thermal rating, voltage drop, losses, protection design, earthing design or final constructability.</p>
<p>All cable lengths, losses and route assumptions must be checked by competent cable engineers using project specific route surveys, cable data sheets, soil thermal resistivity, installation depth, grouping factors, duct factors, cyclic loading, conductor temperature limits, voltage drop limits, short circuit withstand, sheath bonding, earthing design, protection settings and applicable standards before procurement or construction decisions are made.</p>
<p>Solar layout outputs are indicative. Module count, DC capacity, AC capacity, site area, Ground Coverage Ratio (GCR), gross site factor, block layout, inverter count, substation count, access assumptions and container quantities must be verified against manufacturer datasheets, planning drawings, topographical surveys, geotechnical surveys, environmental constraints, drainage strategy, fire access, operations access, EPC scope, grid compliance requirements and final design drawings.</p>
<p>Financial outputs are screening values only. Revenue, capital expenditure, development cost, module cost, EPC cost, owner cost, grid connection cost, operating cost, target exit value, Operating Asset Net Present Value (NPV), development margin and surplus outputs depend on assumptions entered by the user and may change materially with route to market, Contracts for Difference (CfD), Power Purchase Agreement (PPA), merchant exposure, curtailment, grid charges, inflation, interest rates, debt sizing, tax treatment, construction cost, contingencies, warranties, insurance and investor return requirements.</p>
<p>BESS assumptions are indicative only. BESS power, BESS energy, BESS CAPEX, cycles, efficiency and revenue per MWh do not replace battery degradation modelling, augmentation strategy, warranty review, revenue stack modelling, fire safety review, planning review, grid compliance studies, metering design, controls design, availability assumptions, insurance review or safety case preparation.</p>
<p>The GeoJSON export preserves useful context for review and discussion, but exported data is not an Issued for Construction (IFC) drawing, legal boundary plan, grid application pack, cable route schedule, bill of quantities, EPC instruction, investment memorandum or bankable technical due diligence package. Any exported file must be reviewed and validated before being used in external GIS workflows, reports, procurement discussions, investor presentations or professional advice.</p>
<p>Users remain responsible for checking all inputs, outputs, assumptions and exported data. Any real world project should be reviewed by competent engineers, grid specialists, planners, environmental consultants, land agents, legal advisers, tax advisers, insurance advisers, EPC contractors, Owner's Engineers, lenders and investment committee professionals before committing capital, signing contracts, placing orders or making public claims.</p>
<p>The sandbox is designed to make assumptions visible, not to remove professional judgement. It should be used to ask better questions, compare scenarios, identify where deeper work is required and support disciplined early stage decision making.</p>
    </div>
</div>

<div class="panel panel-right">
    <div id="fetch_status"></div>
    <div class="gis-map-search" id="gis_map_search">
        <input id="gis_search_input" class="gis-search-input" type="text" placeholder="Search site or substation..." autocomplete="off" />
        <button id="gis_search_btn" class="map-toggle-btn gis-search-btn">GO</button>
        <div id="gis_search_results" class="gis-search-results"></div>
    </div>
    <div class="map-controls">
        <div class="map-toggle-row">
            <button id="btn_subs_toggle" class="map-toggle-btn active">SUBS ON</button>
            <button id="btn_basemap" class="map-toggle-btn">SATELLITE VIEW</button>
<button id="btn_map_expand" class="map-toggle-btn">MAP MAX</button>
<button id="btn_key_toggle" class="map-toggle-btn active">KEY ON</button>
<button id="btn_array_toggle" class="map-toggle-btn active">ARRAY ON</button>
<button id="btn_print_report" class="map-toggle-btn print-btn">PRINT</button>

        </div>
        <div class="map-toggle-row voltage-toggle-row">
            <button id="btn_atlas_66kv" class="map-toggle-btn active atlas-voltage-btn atlas-66kv" data-atlas-voltage="66kv">66 kV ON</button>
            <button id="btn_atlas_132kv" class="map-toggle-btn active atlas-voltage-btn atlas-132kv" data-atlas-voltage="132kv">132 kV ON</button>
            <button id="btn_atlas_275kv" class="map-toggle-btn active atlas-voltage-btn atlas-275kv" data-atlas-voltage="275kv">275 kV ON</button>
            <button id="btn_atlas_400kv" class="map-toggle-btn active atlas-voltage-btn atlas-400kv" data-atlas-voltage="400kv">400 kV ON</button>
        </div>
        <div class="map-toggle-row asset-toggle-row asset-filter-row">
            <select id="asset_layer_select" class="map-asset-select" title="Energy asset layer">
                <option value="off">Energy assets OFF</option>
                <option value="all">All technologies</option>
                <option value="solar_operational">Solar PV</option>
                <option value="bess_operational">BESS</option>
                <option value="wind_onshore_operational">Onshore wind</option>
                <option value="wind_offshore_operational">Offshore wind</option>
            </select>
            <select id="asset_status_select" class="map-asset-status-select" title="Project status">
                <option value="all">All statuses</option>
                <option value="operational">Operational</option>
                <option value="under construction">Under construction</option>
                <option value="awaiting construction">Awaiting construction</option>
                <option value="planning approved">Planning approved</option>
                <option value="planning submitted">Planning submitted</option>
                <option value="refused">Refused</option>
                <option value="withdrawn">Withdrawn</option>
            </select>
            <input id="asset_min_mw" class="asset-range-input" type="number" min="0" step="1" placeholder="Min MW" title="Minimum project capacity MW" />
            <input id="asset_max_mw" class="asset-range-input" type="number" min="0" step="1" placeholder="Max MW" title="Maximum project capacity MW" />
            <button id="btn_asset_filter_apply" class="map-toggle-btn">APPLY</button>
        </div>
    </div>

    <div class="crosshair">⌖</div>
    <div id="site_intel_panel" class="site-intel-panel collapsed">
        <div class="site-intel-header">
            <span>Site Intelligence</span>
            <button id="site_intel_close" type="button">×</button>
        </div>
        <div id="site_intel_body" class="site-intel-body">
            Click the map to inspect nearby assets, substations and voltage corridors.
        </div>
    </div>
<div class="map-tool-overlay" id="map_tool_overlay">
    <div class="map-toggle-row">
        <button id="btn_map_tools_toggle" class="map-toggle-btn active">TOOLS ON</button>
        <button id="btn_map_draw" class="map-toggle-btn">DRAW</button>
        <button id="btn_map_pick_array" class="map-toggle-btn">PICK ARRAY</button>
        <button id="btn_map_drop_pins" class="map-toggle-btn">DROP PINS</button>
        <button id="btn_map_draw_route" class="map-toggle-btn">DRAW ROUTE</button>
    </div>
    <div class="map-toggle-row map-size-row">
        <input id="map_target_dc_mwp" class="map-size-input" type="number" min="0.1" step="1" placeholder="MWp DC" />
        <button id="btn_map_apply_size" class="map-toggle-btn">SIZE MWp</button>
        <span id="map_size_status" class="map-size-status">Whole block sizing</span>
    </div>
    <div class="map-toggle-row map-tool-row-secondary">
        <button id="btn_map_rotate_left" class="map-toggle-btn">ROT -30</button>
        <button id="btn_map_rotate_right" class="map-toggle-btn">ROT +30</button>
        <button id="btn_map_rotate_90" class="map-toggle-btn">ROT +90</button>
        <button id="btn_map_nudge_up" class="map-toggle-btn">↑</button>
        <button id="btn_map_nudge_left" class="map-toggle-btn">←</button>
        <button id="btn_map_nudge_right" class="map-toggle-btn">→</button>
        <button id="btn_map_nudge_down" class="map-toggle-btn">↓</button>
    </div>
    <div class="map-toggle-row map-tool-row-secondary">
        <button id="btn_map_undo_pin" class="map-toggle-btn">UNDO PIN</button>
        <button id="btn_map_clear_route" class="map-toggle-btn">CLEAR ROUTE</button>
        <button id="btn_map_reset_rotation" class="map-toggle-btn">RESET ROT</button>
        <button id="btn_map_reset_array" class="map-toggle-btn">RESET ARRAY</button>
    </div>
</div>
    <div id="map"></div>
    <div class="legend" id="map_legend"></div>
</div>
</div>

<!-- V7 migrated modular app scripts -->
<script src="gis-sld-v5-map.js"></script>
<script src="gis-sld-v5-calculations.js"></script>
<script src="gis-sld-v5-finance.js"></script>
<script src="gis-sld-v5-ui-core.js"></script>
<script src="gis-sld-v5-drawing.js"></script>
<script src="gis-sld-v5-export.js"></script>
<script src="gis-sld-v5-ui.js"></script>


</body>
</html>
```

### `gis-sld-v5-config.js`

Lines: 24

```javascript
"use strict";

// GIS SLD Financial Sandbox V7
// Config extracted by GridBot feature 002.
// TODO: migrate config into the shared GISSLD namespace at feature 007.

const SUBSTATIONS_URL = "/grid_substations.geojson";

const CONSTANTS = {
    M2_PER_ACRE: 4046.86,
    BESS_M2_PER_MWH: 85,
    BESS_ASPECT: 2.5,
    BLOCK_SPACING_KM: 0.01,
    BOUNDARY_BUFFER_KM: 0.02,
    ARRAY_OFFSET_KM: 0.2,
    DEFAULT_CENTER: [-0.1276, 51.5072],
    DEFAULT_ZOOM: 13,
    RECALC_DEBOUNCE_MS: 80,
    BIFACIAL_BY_GCR: { "0.35": 8, "0.45": 5, "0.75": 2 },
    LOGISTICS_PRESETS: {
        high_density: { pallet: 33, container: 594 },
        legacy: { pallet: 31, container: 620 }
    }
};
```

### `gis-sld-v5-helpers.js`

Lines: 75

```javascript
"use strict";

// GIS SLD Financial Sandbox V7
// Helpers extracted by GridBot feature 003.
// Must load after gis-sld-v5-config.js and before the inline app script.

const $ = (id) => document.getElementById(id);

const num = (id) => {
    const el = $(id);
    return el ? (parseFloat(el.value) || 0) : 0;
};

const intVal = (id, fallback = 0) => {
    const el = $(id);
    return el ? (parseInt(el.value, 10) || fallback) : fallback;
};

const checked = (id) => {
    const el = $(id);
    return el ? !!el.checked : false;
};

const setText = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
};

const setClass = (id, cls) => {
    const el = $(id);
    if (el) el.className = cls;
};

function money(v) {
    const rounded = Math.round(v);
    if (rounded < 0) return "-£" + Math.abs(rounded).toLocaleString();
    return "£" + rounded.toLocaleString();
}

function debounce(fn, ms) {
    let t = null;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
    };
}

function isValidLngLat(c) {
    return Array.isArray(c) && c.length >= 2
        && Number.isFinite(+c[0]) && Number.isFinite(+c[1])
        && +c[0] >= -180 && +c[0] <= 180 && +c[1] >= -90 && +c[1] <= 90;
}

function pickProp(obj, keys, fallback = null) {
    for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
    }
    return fallback;
}

function setFetchStatus(msg, isError) {
    const el = $("fetch_status");
    if (!el) return;

    if (!msg) {
        el.style.display = "none";
        el.textContent = "";
        el.classList.remove("error");
        return;
    }

    el.textContent = msg;
    el.style.display = "block";
    el.classList.toggle("error", !!isError);
}
```

### `gis-sld-v5-state.js`

Lines: 29

```javascript
"use strict";

// GIS SLD Financial Sandbox V7
// State extracted by GridBot feature 004.
// Must load after config and helpers, and before the inline app script.

const state = {
    activeTab: "string",
    currentGeoJSON: { type: "FeatureCollection", features: [] },
    activeDrawCenter: null,
    selectedSubstation: null,
    subsVisible: false,
    satActive: false,
    activePopup: null,
    lastStats: null,
    lastFinance: { fin_string: null, fin_central: null },
    arrayMoveMode: false,
    arrayOverrideCenter: null,
    arrayRotationDeg: 0,
    exportCableLengthKm: 0,
    cableRoutePinMode: false,
    cableRoutePins: [],
    cableRouteCommitted: false,
    suppressNextMapFit: false,
    arrayVisible: true,
    // Legacy aliases retained for older export and drawing logic if needed.
    cableRouteMode: false,
    cableRouteWaypoints: []
};
```

### `gis-sld-v5-substations.js`

Lines: 83

```javascript
"use strict";

// GIS SLD Financial Sandbox V7
// Substation data loading extracted by GridBot feature 005.
// Must load after config, helpers and state, and before the inline app script.

function normaliseSubstations(raw) {
    if (!raw) throw new Error("Empty dataset");

    let features = [];

    if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) {
        features = raw.features;
    } else if (Array.isArray(raw)) {
        features = raw.map(item => ({
            type: "Feature",
            geometry: item.geometry || {
                type: "Point",
                coordinates: [
                    item.lon ?? item.lng ?? item.longitude ?? item.Longitude ?? item.X,
                    item.lat ?? item.latitude ?? item.Latitude ?? item.Y
                ]
            },
            properties: item.properties || item
        }));
    } else {
        throw new Error("Not a FeatureCollection or array");
    }

    const cleaned = features
        .filter(f => f && f.geometry && f.geometry.type === "Point")
        .map(f => {
            const c = f.geometry.coordinates.map(Number);
            if (!isValidLngLat(c)) return null;

            const p = f.properties || {};

            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [c[0], c[1]] },
                properties: {
                    ...p,
                    name_clean: pickProp(
                        p,
                        ["name", "Name", "site_name", "SiteName", "Site Name", "substation", "Substation", "substation_name", "Substation Name"],
                        "Substation"
                    ),
                    voltage_clean: pickProp(
                        p,
                        ["voltage", "Voltage", "kv", "kV", "KV", "voltage_kv", "Voltage kV"],
                        "Unknown"
                    )
                }
            };
        })
        .filter(Boolean);

    return { type: "FeatureCollection", features: cleaned };
}

async function loadSubstations() {
    setFetchStatus("Loading substations…", false);

    try {
        const url = SUBSTATIONS_URL + (SUBSTATIONS_URL.includes("?") ? "&" : "?") + "v=" + Date.now();
        const res = await fetch(url);

        if (!res.ok) throw new Error("HTTP " + res.status);

        const raw = await res.json();
        const cleaned = normaliseSubstations(raw);
        const src = map.getSource("src-subs");

        if (src) src.setData(cleaned);

        console.log("Substations loaded:", cleaned.features.length);
        setFetchStatus(`${cleaned.features.length.toLocaleString()} substations loaded`, false);
        setTimeout(() => setFetchStatus("", false), 2500);
    } catch (err) {
        console.error("Substation load failed:", err);
        setFetchStatus(`Substations unavailable: ${err.message}. Check SUBSTATIONS_URL.`, true);
    }
}
```

### `gis-sld-v5-map.js`

Lines: 476

```javascript
"use strict";

// MAP
// ============================================================
let map = null;
const atlasV8GridLayerVisibility = {
    "66kv": false,
    "132kv": false,
    "275kv": false,
    "400kv": false
};

const atlasV8GridLayerIds = {
    "66kv": "atlas-v8-grid-66kv-line",
    "132kv": "atlas-v8-grid-132kv-line",
    "275kv": "atlas-v8-grid-275kv-line",
    "400kv": "atlas-v8-grid-400kv-line"
};

const atlasV8OperatingAssetVisibility = {
    "solar_operational": false,
    "wind_onshore_operational": false,
    "wind_offshore_operational": false,
    "bess_operational": false
};

const atlasV8AssetFilterState = {
    selected: "off",
    status: "all",
    minMw: null,
    maxMw: null
};

const atlasV8OperatingAssetLayerIds = {
    "solar_operational": "atlas-v8-asset-solar-operational",
    "wind_onshore_operational": "atlas-v8-asset-wind-onshore-operational",
    "wind_offshore_operational": "atlas-v8-asset-wind-offshore-operational",
    "bess_operational": "atlas-v8-asset-bess-operational"
};

function atlasV8CapacityExpression() {
    return ["to-number", ["coalesce", ["get", "capacity"], ["get", "capacity_mw"], 0]];
}

function atlasV8AssetBaseFilter(assetKey) {
    if (assetKey === "solar_operational") return ["==", ["get", "tech"], "solar"];
    if (assetKey === "bess_operational") return ["==", ["get", "tech"], "bess"];
    if (assetKey === "wind_onshore_operational") return ["==", ["get", "raw_tech"], "Wind Onshore"];
    if (assetKey === "wind_offshore_operational") return ["==", ["get", "raw_tech"], "Wind Offshore"];
    return true;
}

function atlasV8StatusExpression() {
    return ["downcase", ["to-string", ["coalesce", ["get", "status"], ["get", "Status"], ""]]];
}

function atlasV8AssetFilter(assetKey) {
    const filters = ["all", atlasV8AssetBaseFilter(assetKey)];
    const capacityExpr = atlasV8CapacityExpression();
    if (atlasV8AssetFilterState.status && atlasV8AssetFilterState.status !== "all") {
        filters.push(["==", atlasV8StatusExpression(), atlasV8AssetFilterState.status]);
    }
    if (Number.isFinite(atlasV8AssetFilterState.minMw)) filters.push([">=", capacityExpr, atlasV8AssetFilterState.minMw]);
    if (Number.isFinite(atlasV8AssetFilterState.maxMw)) filters.push(["<=", capacityExpr, atlasV8AssetFilterState.maxMw]);
    return filters;
}

function applyAtlasV8AssetDropdownFilter(selected = atlasV8AssetFilterState.selected, status = atlasV8AssetFilterState.status, minMw = atlasV8AssetFilterState.minMw, maxMw = atlasV8AssetFilterState.maxMw) {
    atlasV8AssetFilterState.selected = selected || "off";
    atlasV8AssetFilterState.status = status || "all";
    atlasV8AssetFilterState.minMw = Number.isFinite(minMw) ? minMw : null;
    atlasV8AssetFilterState.maxMw = Number.isFinite(maxMw) ? maxMw : null;

    Object.keys(atlasV8OperatingAssetLayerIds).forEach(assetKey => {
        const layerId = atlasV8OperatingAssetLayerIds[assetKey];
        const visible = atlasV8AssetFilterState.selected === "all" || atlasV8AssetFilterState.selected === assetKey;
        atlasV8OperatingAssetVisibility[assetKey] = visible;
        if (map && map.getLayer(layerId)) {
            map.setFilter(layerId, atlasV8AssetFilter(assetKey));
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
    });
    updateLegend?.();
}

function toggleAtlasV8OperatingAssetLayer(assetKey) {
    if (!atlasV8OperatingAssetLayerIds[assetKey]) return;
    const next = atlasV8AssetFilterState.selected === assetKey ? "off" : assetKey;
    applyAtlasV8AssetDropdownFilter(next, atlasV8AssetFilterState.status, atlasV8AssetFilterState.minMw, atlasV8AssetFilterState.maxMw);
}


function toggleAtlasV8GridLayer(voltageKey) {
    if (!atlasV8GridLayerIds[voltageKey]) return;
    atlasV8GridLayerVisibility[voltageKey] = !atlasV8GridLayerVisibility[voltageKey];
    const layerId = atlasV8GridLayerIds[voltageKey];
    if (map && map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", atlasV8GridLayerVisibility[voltageKey] ? "visible" : "none");
    }
    updateLegend();
}


function initMap() {
    if (typeof maplibregl === "undefined") {
        setFetchStatus("MapLibre failed to load. Check network.", true);
        console.error("maplibregl is undefined");
        return;
    }
    if (typeof turf === "undefined") {
        setFetchStatus("Turf failed to load. Check network.", true);
        console.error("turf is undefined");
        return;
    }

    map = new maplibregl.Map({
        container: "map",
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: CONSTANTS.DEFAULT_CENTER,
        zoom: CONSTANTS.DEFAULT_ZOOM
    });

    map.on("error", (e) => console.error("MapLibre error:", e && e.error ? e.error : e));
    map.on("load", onMapLoad);
}

function onMapLoad() {
    map.addSource("sat-s", {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256
    });
    map.addLayer({ id: "l-sat", type: "raster", source: "sat-s", layout: { visibility: "none" } });
// Atlas V8 transmission visibility layers
// These layers are read from the existing Atlas V8 data folder.
// They are visual context only and do not imply confirmed grid headroom.
map.addSource("atlas-v8-grid-66kv", {
    type: "geojson",
    data: "../../repd_grid_atlasv8/data/grid_66kv.geojson"
});
map.addLayer({
    id: "atlas-v8-grid-66kv-line",
    type: "line",
    source: "atlas-v8-grid-66kv",
    layout: { visibility: atlasV8GridLayerVisibility["66kv"] ? "visible" : "none" },
    paint: {
        "line-color": "#66ff66",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, 1.4, 14, 2.4],
        "line-opacity": 0.62
    }
});

map.addSource("atlas-v8-grid-132kv", {
    type: "geojson",
    data: "../../repd_grid_atlasv8/data/grid_132kv.geojson"
});
map.addLayer({
    id: "atlas-v8-grid-132kv-line",
    type: "line",
    source: "atlas-v8-grid-132kv",
    layout: { visibility: atlasV8GridLayerVisibility["132kv"] ? "visible" : "none" },
    paint: {
        "line-color": "#ffcc00",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.0, 10, 1.8, 14, 3.0],
        "line-opacity": 0.72
    }
});

map.addSource("atlas-v8-grid-275kv", {
    type: "geojson",
    data: "../../repd_grid_atlasv8/data/grid_275kv.geojson"
});
map.addLayer({
    id: "atlas-v8-grid-275kv-line",
    type: "line",
    source: "atlas-v8-grid-275kv",
    layout: { visibility: atlasV8GridLayerVisibility["275kv"] ? "visible" : "none" },
    paint: {
        "line-color": "#ff66ff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.3, 10, 2.4, 14, 3.7],
        "line-opacity": 0.76
    }
});

map.addSource("atlas-v8-grid-400kv", {
    type: "geojson",
    data: "../../repd_grid_atlasv8/data/grid_400kv.geojson"
});
map.addLayer({
    id: "atlas-v8-grid-400kv-line",
    type: "line",
    source: "atlas-v8-grid-400kv",
    layout: { visibility: atlasV8GridLayerVisibility["400kv"] ? "visible" : "none" },
    paint: {
        "line-color": "#ff3333",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.6, 10, 2.8, 14, 4.2],
        "line-opacity": 0.82
    }
});



    map.addSource("src-subs", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
        id: "l-subs", type: "circle", source: "src-subs",
        paint: {
            "circle-color": "#ffffff",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 5, 14, 10, 18, 22],
            "circle-stroke-width": 1, "circle-stroke-color": "#ff3333", "circle-opacity": 0.8
        }
    });



    // Atlas V8 operating asset visibility layers from REPD master data.
    // These are existing operating asset context layers only.
    // They help users inspect nearby operating solar, wind and battery assets before drawing a new array.
    map.addSource("atlas-v8-repd-operating-assets", {
        type: "geojson",
        data: "/dist/repd_master.json"
    });

    map.addLayer({
        id: "atlas-v8-asset-solar-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "tech"], "solar"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["solar_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#00ff88",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 30, 9, 50, 10, 100, 12, 200, 15, 350, 18, 500, 21],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1,
            "circle-opacity": 0.88
        }
    });

    map.addLayer({
        id: "atlas-v8-asset-wind-onshore-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "raw_tech"], "Wind Onshore"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["wind_onshore_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#00ffcc",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 30, 9, 50, 10, 100, 12, 200, 15, 350, 18, 500, 21],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1,
            "circle-opacity": 0.88
        }
    });

    map.addLayer({
        id: "atlas-v8-asset-wind-offshore-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "raw_tech"], "Wind Offshore"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["wind_offshore_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#0066ff",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 30, 9, 50, 10, 100, 12, 200, 15, 350, 18, 500, 21],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.88
        }
    });

    map.addLayer({
        id: "atlas-v8-asset-bess-operational",
        type: "circle",
        source: "atlas-v8-repd-operating-assets",
        filter: ["all", ["==", ["get", "tech"], "bess"]],
        layout: { visibility: atlasV8OperatingAssetVisibility["bess_operational"] ? "visible" : "none" },
        paint: {
            "circle-color": "#ff69b4",
            "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "capacity"], 0], 0, 5, 10, 7, 30, 9, 50, 10, 100, 12, 200, 15, 350, 18, 500, 21],
            "circle-stroke-color": "#111111",
            "circle-stroke-width": 1,
            "circle-opacity": 0.9
        }
    });

    map.addSource("topology", { type: "geojson", data: state.currentGeoJSON });

    map.addLayer({
        id: "overall_boundary_fill", type: "fill", source: "topology",
        filter: ["==", "type", "array_boundary"],
        paint: { "fill-color": "#0066ff", "fill-opacity": 0.25 }
    });
    map.addLayer({
        id: "overall_boundary_line", type: "line", source: "topology",
        filter: ["==", "type", "array_boundary"],
        paint: { "line-color": "#0066ff", "line-width": 2, "line-dasharray": [4, 4] }
    });
    map.addLayer({
        id: "footprints", type: "fill", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["skid_footprint", "central_footprint", "bess_footprint"]]],
        paint: {
            "fill-color": ["match", ["get", "type"],
                "skid_footprint", "#00ffff", "central_footprint", "#ff9900", "bess_footprint", "#ff00aa", "#000"],
            "fill-opacity": 0.15
        }
    });
    map.addLayer({
        id: "footprints_outline", type: "line", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["skid_footprint", "central_footprint", "bess_footprint"]]],
        paint: {
            "line-color": ["match", ["get", "type"],
                "skid_footprint", "#00ffff", "central_footprint", "#ff9900", "bess_footprint", "#ff00aa", "#000"],
            "line-width": 1
        }
    });
    map.addLayer({
        id: "export_cable", type: "line", source: "topology",
        filter: ["==", "type", "export_cable"],
        paint: { "line-color": "#ff3333", "line-width": 2, "line-dasharray": [4, 4] }
    });
    map.addLayer({
        id: "radial_spine", type: "line", source: "topology",
        filter: ["==", "type", "33kv_radial"],
        paint: { "line-color": "#00ffff", "line-width": 2 }
    });
    map.addLayer({
        id: "export_cable_pins", type: "circle", source: "topology",
        filter: ["==", "type", "export_cable_pin"],
        paint: {
            "circle-color": ["case", ["==", ["get", "committed_to_route"], true], "#ff3333", "#ff9900"],
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 6, 18, 10],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.95
        }
    });
    map.addLayer({
        id: "inverters", type: "circle", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["string_substation", "central_inverter", "mv_station", "bess_compound"]]],
        paint: {
            "circle-color": ["match", ["get", "type"],
                "string_substation", "#ffff00", "central_inverter", "#ff9900",
                "mv_station", "#6633ff", "bess_compound", "#ff00aa", "#fff"],
            "circle-radius": ["match", ["get", "type"],
                "string_substation", 4, "central_inverter", 6, "mv_station", 4, "bess_compound", 6, 3],
            "circle-stroke-color": "#000", "circle-stroke-width": 1
        }
    });
    map.addLayer({
        id: "substation", type: "circle", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["poi", "private_sub"]]],
        paint: {
            "circle-color": ["match", ["get", "type"], "poi", "#ff3333", "private_sub", "#00ff88", "#fff"],
            "circle-radius": 8, "circle-stroke-color": "#fff", "circle-stroke-width": 2
        }
    });

    // Map clicks
    map.on("click", "l-subs", onSubstationClick);
    map.on("mouseenter", "l-subs", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "l-subs", () => map.getCanvas().style.cursor = "");

    map.on("click", "inverters", onInverterClick);
    map.on("mouseenter", "inverters", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "inverters", () => map.getCanvas().style.cursor = "");

    map.on("click", "export_cable_pins", onCableRoutePinClick);
    map.on("mouseenter", "export_cable_pins", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "export_cable_pins", () => map.getCanvas().style.cursor = "");

    map.on("click", "substation", onPoiClick);
    map.on("mouseenter", "substation", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "substation", () => map.getCanvas().style.cursor = "");

    ["atlas-v8-asset-solar-operational", "atlas-v8-asset-wind-onshore-operational", "atlas-v8-asset-wind-offshore-operational", "atlas-v8-asset-bess-operational"].forEach(layerId => {
        map.on("click", layerId, onOperatingAssetClick);
        map.on("mouseenter", layerId, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", layerId, () => map.getCanvas().style.cursor = "");
    });

    loadSubstations();
    updateLegend();
    recalcAll();
}

function showPopup(coords, html) {
    if (state.activePopup) state.activePopup.remove();
    state.activePopup = new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
    state.activePopup.on("close", () => { state.activePopup = null; });
}

// ============================================================
// MAP CLICK HANDLERS
// ============================================================
function onSubstationClick(e) {
    const f = e.features && e.features[0];
    if (!f || !f.geometry) return;
    const coords = f.geometry.coordinates.slice();
    const p = f.properties || {};

    state.selectedSubstation = {
        name: p.name_clean || pickProp(p, ["name","Name","SiteName","Site Name","substation","Substation"], "Selected Substation"),
        voltage: p.voltage_clean || pickProp(p, ["voltage","Voltage","kv","kV","KV"], "Unknown"),
        properties: p,
        coordinates: coords
    };
    state.activeDrawCenter = coords;
    updateSelectedSubstationDisplay();
    computeAndDraw();

    showPopup(coords, `
        <div style="margin-bottom:5px;color:#ff3333;font-weight:bold;font-size:13px;text-transform:uppercase;">Grid Node</div>
        <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${state.selectedSubstation.name}</span></div>
        <div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${state.selectedSubstation.voltage}</span></div>
        <div class="popup-row"><span>Lon:</span><span class="popup-val" style="color:#fff;">${Number(coords[0]).toFixed(6)}</span></div>
        <div class="popup-row"><span>Lat:</span><span class="popup-val" style="color:#fff;">${Number(coords[1]).toFixed(6)}</span></div>
    `);
}

function onInverterClick(e) {
    const prop = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const colourMap = {
        central_inverter: "#ff9900", string_substation: "#ffff00",
        bess_compound: "#ff00aa", mv_station: "#6633ff"
    };
    const colour = colourMap[prop.type] || "#00ffff";
    let html = `<div style="margin-bottom:5px;color:${colour};font-weight:bold;font-size:13px;text-transform:uppercase;">Block Info</div>
                <div class="popup-row"><span>Type:</span><span class="popup-val" style="color:#fff;">${prop.type}</span></div>`;
    if (prop.type === "bess_compound" && prop.mwh !== undefined) {
        html += `<div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${prop.mwh} MWh</span></div>`;
    }
    showPopup(coords, html);
}

function onCableRoutePinClick(e) {
    const prop = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const idx = prop.pin_index || "?";
    showPopup(coords, `
        <div style="margin-bottom:5px;color:#ff9900;font-weight:bold;font-size:13px;text-transform:uppercase;">Cable Route Pin</div>
        <div class="popup-row"><span>Pin:</span><span class="popup-val" style="color:#fff;">${idx}</span></div>
        <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#fff;">${prop.committed_to_route ? "Committed to cable route" : "Dropped but not drawn"}</span></div>
        <div class="popup-row"><span>Lon:</span><span class="popup-val" style="color:#fff;">${Number(coords[0]).toFixed(6)}</span></div>
        <div class="popup-row"><span>Lat:</span><span class="popup-val" style="color:#fff;">${Number(coords[1]).toFixed(6)}</span></div>
    `);
}


function onOperatingAssetClick(e) {
    const feature = e.features && e.features[0];
    if (!feature || !feature.geometry) return;
    const prop = feature.properties || {};
    const coords = feature.geometry.coordinates.slice();
    const name = pickProp(prop, ["name", "project", "Project Name", "site", "Site Name", "ref_name"], "Operating asset");
    const tech = pickProp(prop, ["raw_tech", "tech", "technology", "Technology Type"], "Unknown technology");
    const status = pickProp(prop, ["status", "Status"], "Unknown status");
    const capacity = pickProp(prop, ["capacity", "capacity_mw", "Installed Capacity (MWelec)", "Capacity (MW)"], "n/a");
    showPopup(coords, `
        <div style="margin-bottom:5px;color:#00ff88;font-weight:bold;font-size:13px;text-transform:uppercase;">Operating Asset</div>
        <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${name}</span></div>
        <div class="popup-row"><span>Technology:</span><span class="popup-val" style="color:#fff;">${tech}</span></div>
        <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#fff;">${status}</span></div>
        <div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${capacity} MW</span></div>
    `);
}

function onPoiClick(e) {
    const prop = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const title = prop.type === "poi" ? "Point of Interconnection" : "Customer Substation";
    const colour = prop.type === "poi" ? "#ff3333" : "#00ff88";
    let html = `<div style="margin-bottom:5px;color:${colour};font-weight:bold;font-size:13px;text-transform:uppercase;">${title}</div>`;
    if (prop.selected_substation_name) html += `<div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${prop.selected_substation_name}</span></div>`;
    if (prop.selected_substation_voltage) html += `<div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${prop.selected_substation_voltage}</span></div>`;
    showPopup(coords, html);
}

// ============================================================
```

### `gis-sld-v5-calculations.js`

Lines: 170

```javascript
"use strict";

// AGGREGATE STATS  (single unified function)
// ============================================================
function readPhysicalInputs(suffix) {
    return {
        mod_wp: num("mod_wp" + suffix),
        mod_l: num("mod_l" + suffix),
        mod_w: num("mod_w" + suffix),
        gcr: parseFloat($("mounting_type" + suffix)?.value) || (suffix === "_c" ? 0.45 : 0.75),
        gross_factor: num("gross_factor" + suffix) || 1.35,
        mods_pallet: intVal("mods_pallet" + suffix, 1),
        mods_container: intVal("mods_container" + suffix, 1),
        spare_pct: num("spare_pct" + suffix)
    };
}

function zeroStats(dc_ac_ratio, mods_pallet, mods_container) {
    return {
        total_blocks: 0, block_ground_area_m2: 0, dc_mwp: 0, ac_mw: 0, module_count: 0,
        net_mod_area_m2: 0, net_array_area_m2: 0, gross_site_area_m2: 0,
        dc_ac_ratio, pallets: 0, containers: 0, spares_pct: 0,
        modules_inc_spares: 0, pallets_inc_spares: 0, containers_inc_spares: 0,
        mods_pallet, mods_container,
        combiner_boxes_per_inverter: 0, total_combiner_boxes: 0,
        string_inverter_kva: 0, production_substation_ac_mva: 0, ring_main_ac_mva: 0,
        central_inverter_mwac: 0, combiner_box_dc_kw: 0, combiner_design_limit_kwdc: 0,
        engineering_warning: "Check assumptions"
    };
}

function buildStats(opts) {
    const {
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        combiner_boxes_per_inverter, total_combiner_boxes,
        string_inverter_kva, inverter_acmax_mva, production_substation_ac_mva, ring_main_ac_mva,
        central_inverter_mwac, central_inverter_mwdc, combiner_box_dc_kw, combiner_design_limit_kwdc,
        engineering_warning
    } = opts;
    const { mod_wp, mod_l, mod_w, gcr, gross_factor, mods_pallet, mods_container, spare_pct } = physical;

    const dc_mwp = (module_count * mod_wp) / 1_000_000;
    const ac_mw = ac_mw_direct != null ? ac_mw_direct : (dc_ac_ratio > 0 ? dc_mwp / dc_ac_ratio : 0);
    const actual_dc_ac = ac_mw > 0 ? dc_mwp / ac_mw : dc_ac_ratio;

    const net_mod_area_m2 = module_count * mod_l * mod_w;
    const net_array_area_m2 = gcr > 0 ? net_mod_area_m2 / gcr : 0;
    const gross_site_area_m2 = net_array_area_m2 * gross_factor;
    const block_ground_area_m2 = total_blocks > 0 ? net_array_area_m2 / total_blocks : 0;

    const pallets = Math.ceil(module_count / mods_pallet);
    const containers = Math.ceil(module_count / mods_container);
    const modules_inc_spares = Math.ceil(module_count * (1 + spare_pct / 100));
    const pallets_inc_spares = Math.ceil(modules_inc_spares / mods_pallet);
    const containers_inc_spares = Math.ceil(modules_inc_spares / mods_container);

    return {
        total_blocks, block_ground_area_m2, dc_mwp, ac_mw, module_count,
        net_mod_area_m2, net_array_area_m2, gross_site_area_m2, dc_ac_ratio: actual_dc_ac,
        pallets, containers, spares_pct: spare_pct,
        modules_inc_spares, pallets_inc_spares, containers_inc_spares,
        mods_pallet, mods_container,
        combiner_boxes_per_inverter: combiner_boxes_per_inverter || 0,
        total_combiner_boxes: total_combiner_boxes || 0,
        string_inverter_kva: string_inverter_kva || 0,
        inverter_acmax_mva: inverter_acmax_mva || 0,
        production_substation_ac_mva: production_substation_ac_mva || 0,
        ring_main_ac_mva: ring_main_ac_mva || 0,
        central_inverter_mwac: central_inverter_mwac || 0,
        central_inverter_mwdc: central_inverter_mwdc || 0,
        combiner_box_dc_kw: combiner_box_dc_kw || 0,
        combiner_design_limit_kwdc: combiner_design_limit_kwdc || 0,
        engineering_warning: engineering_warning || "Check assumptions"
    };
}

function getCentralInverterMwac() {
    const mode = $("central_rating_mode")?.value || "preset";
    const preset = num("inv_ac_mw_c") || 4.4;
    const customRaw = num("inv_ac_mw_custom_c") || preset;
    const custom = Math.min(Math.max(customRaw, 0.1), 20);
    return mode === "custom" ? custom : preset;
}

function getCentralInverterDcMwdc() {
    const dc = num("inv_dc_mw_c") || ((num("inv_ac_mw_c") || 4.4) * 1.2);
    return Math.min(Math.max(dc, 0.1), 30);
}

function getCentralSkidMva() {
    const mva = num("central_skid_mva_c") || (num("inv_ac_mw_c") || 4.4);
    return Math.min(Math.max(mva, 0.1), 25);
}

function computeStringStats() {
    const physical = readPhysicalInputs("");
    const x = intVal("x_mods"), z = intVal("z_strings"), y = intVal("y_invs"), s = intVal("s_subs"), rings = intVal("b_cols");
    const dc_ac_ratio = num("dc_ac_ratio") || 1.2;
    const string_inverter_kva = num("string_inv_kva") || 352;
    const string_skid_mva = num("string_skid_mva") || 8.96;

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const total_blocks = rings * s;
    const module_count = total_blocks * y * z * x;
    const inverter_acmax_mva = (y * string_inverter_kva) / 1000;
    const production_substation_ac_mva = string_skid_mva;
    const ring_main_ac_mva = production_substation_ac_mva * s;
    const ac_mw_direct = total_blocks * production_substation_ac_mva;
    let engineering_warning = "Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.";
    if (inverter_acmax_mva > production_substation_ac_mva) engineering_warning = "Inverter ACmax exceeds skid transformer rating. Verify temperature rating, overload strategy and clipping assumptions.";
    if (string_inverter_kva > 500) engineering_warning = "Large string inverter rating selected. Verify LV switchgear, transformer, cable loading and protection.";

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        string_inverter_kva, inverter_acmax_mva, production_substation_ac_mva, ring_main_ac_mva,
        engineering_warning
    });
}

function computeCentralStats() {
    const physical = readPhysicalInputs("_c");
    const x_mods = intVal("x_mods_c");
    const inv_ac_mw = getCentralInverterMwac();
    const inv_dc_mw = getCentralInverterDcMwdc();
    const central_skid_mva = getCentralSkidMva();
    const dc_ac_ratio = inv_ac_mw > 0 ? inv_dc_mw / inv_ac_mw : 1.2;
    const str_per_cb = intVal("str_per_cb_c", 1);
    const inv_per_mv = intVal("inv_per_mv_c");
    const mv_per_ring = intVal("mv_per_ring_c");
    const rings = intVal("rings_c");
    const combiner_design_limit_kwdc = num("combiner_limit_kwdc_c") || 500;

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x_mods <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const str_dc_kwp = (x_mods * physical.mod_wp) / 1000;
    const combiner_box_dc_kw = str_per_cb * str_dc_kwp;
    const req_strings = str_dc_kwp > 0 ? Math.ceil((inv_dc_mw * 1000) / str_dc_kwp) : 0;
    const combiner_boxes_per_inverter = Math.ceil(req_strings / str_per_cb);
    const total_blocks = inv_per_mv * mv_per_ring * rings;
    const total_combiner_boxes = combiner_boxes_per_inverter * total_blocks;
    const module_count = req_strings * x_mods * total_blocks;
    const ac_mw_direct = total_blocks * central_skid_mva * inv_per_mv;
    const production_substation_ac_mva = central_skid_mva * inv_per_mv;
    const ring_main_ac_mva = production_substation_ac_mva * mv_per_ring;

    let engineering_warning = "Check skid rating, transformer rating, cable ratings, protection, losses and grid compliance.";
    if (combiner_box_dc_kw > combiner_design_limit_kwdc) engineering_warning = "Combiner box DC capacity exceeds the selected design limit.";
    if (inv_ac_mw > central_skid_mva) engineering_warning = "Central inverter AC output exceeds skid transformer rating. Verify thermal rating and export limitation.";
    if (inv_ac_mw > 10) engineering_warning = "Large central inverter or power block selected. Verify transformer, MV switchgear, harmonics, thermal loading, protection and grid code compliance.";

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        combiner_boxes_per_inverter, total_combiner_boxes,
        production_substation_ac_mva, ring_main_ac_mva,
        central_inverter_mwac: inv_ac_mw, central_inverter_mwdc: inv_dc_mw,
        combiner_box_dc_kw, combiner_design_limit_kwdc,
        engineering_warning
    });
}

function computeStats() {
    return state.activeTab === "string" ? computeStringStats() : computeCentralStats();
}

// ============================================================
```

### `gis-sld-v5-finance.js`

Lines: 262

```javascript
"use strict";

// FINANCIALS
// ============================================================
function setFinanceLabel(inputId, labelText) {
    const input = $(inputId);
    if (!input) return;
    const group = input.closest(".input-group");
    const label = group ? group.querySelector("label") : null;
    if (label) label.textContent = labelText;
}

function convertLargeDefaultToWp(inputId) {
    const input = $(inputId);
    if (!input) return;
    const value = parseFloat(input.value);
    if (!Number.isFinite(value)) return;
    if (value > 10) {
        input.value = (value / 1_000_000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    }
}

function setFinanceInputDefaultsForWp(prefix) {
    const stage = $(prefix + "_dev_stage");
    if (stage) {
        const stageValues = ["0.003", "0.015", "0.035", "0.055", "0.070", "0.080", "0.100"];
        Array.from(stage.options).forEach((option, idx) => {
            if (stageValues[idx]) option.value = stageValues[idx];
        });
        if (parseFloat(stage.value) > 10) stage.value = "0.100";
    }

    setFinanceLabel(prefix + "_dev_cost_mw", "Development Cost £/Wp");
    setFinanceLabel(prefix + "_dev_module_mwp", "Module Supply Cost £/Wp");
    setFinanceLabel(prefix + "_dev_epc_mw", "EPC Cost £/Wp");
    setFinanceLabel(prefix + "_dev_owner_mw", "Other Owner Costs £/Wp");
    setFinanceLabel(prefix + "_dev_grid_mw", "Grid Connection Cost £/Wp");
    setFinanceLabel(prefix + "_dev_exit_mwp", "Target Exit Value £/Wp");
    setFinanceLabel(prefix + "_dev_npv_mwp", "Operating Asset Net Present Value (NPV) £/Wp");
    setFinanceLabel(prefix + "_bess_spread", "BESS Revenue per MWh £/MWh");

    convertLargeDefaultToWp(prefix + "_dev_cost_mw");
    convertLargeDefaultToWp(prefix + "_dev_module_mwp");
    convertLargeDefaultToWp(prefix + "_dev_epc_mw");
    convertLargeDefaultToWp(prefix + "_dev_owner_mw");
    convertLargeDefaultToWp(prefix + "_dev_grid_mw");
    convertLargeDefaultToWp(prefix + "_dev_exit_mwp");
    convertLargeDefaultToWp(prefix + "_dev_npv_mwp");

    const stepMap = {
        _dev_cost_mw: "0.005",
        _dev_module_mwp: "0.01",
        _dev_epc_mw: "0.025",
        _dev_owner_mw: "0.025",
        _dev_grid_mw: "0.025",
        _dev_exit_mwp: "0.05",
        _dev_npv_mwp: "0.05"
    };
    Object.entries(stepMap).forEach(([suffix, step]) => {
        const el = $(prefix + suffix);
        if (el) el.step = step;
    });
}

function migrateFinanceUnitsToWp() {
    setFinanceInputDefaultsForWp("fin_string");
    setFinanceInputDefaultsForWp("fin_central");
}

function applyDevelopmentStageDefaults(prefix) {
    const stage = $(prefix + "_dev_stage");
    const cost = $(prefix + "_dev_cost_mw");
    if (!stage || !cost) return;
    cost.value = stage.value;

    const success = $(prefix + "_dev_success");
    const successByStage = {
        "0.003": 10,
        "0.015": 15,
        "0.035": 30,
        "0.055": 55,
        "0.070": 70,
        "0.080": 80,
        "0.100": 95
    };
    if (success && successByStage[stage.value] !== undefined) {
        success.value = successByStage[stage.value];
    }
}

function computeFinance(prefix, stats) {
    const dc_mwp = stats.dc_mwp, ac_mw = stats.ac_mw;

    const price = num(prefix + "_price");
    const other = num(prefix + "_other");
    const yieldVal = num(prefix + "_yield");
    const bifacial = num(prefix + "_bifacial");
    const baseLoss = num(prefix + "_losses");
    const deg = num(prefix + "_deg");
    const opexRate = num(prefix + "_opex");

    const epcEx = num(prefix + "_epc_ex");
    const floodAdder = checked(prefix + "_flood") ? num(prefix + "_flood_rate") : 0;
    const modules = num(prefix + "_modules");
    const otherCapex = num(prefix + "_other_capex");
    const fixedCapex = num(prefix + "_fixed_capex");
    const cont = num(prefix + "_cont");

    const lossExtras = num(prefix + "_loss_dc_string") + num(prefix + "_loss_lv_dc") +
                       num(prefix + "_loss_lv_ac") + num(prefix + "_loss_tx") + num(prefix + "_loss_other");
    const totalLoss = baseLoss + lossExtras;

    const bessMw = num(prefix + "_bess_mw");
    const bessMwh = num(prefix + "_bess_mwh");
    const bessCapexRate = num(prefix + "_bess_capex");
    const bessCycles = num(prefix + "_bess_cycles");
    const bessRevenuePerMwh = num(prefix + "_bess_spread");
    const bessEff = num(prefix + "_bess_eff") / 100;

    const safeLoss = Math.min(Math.max(totalLoss, 0), 100);
    const safeBessEff = Math.min(Math.max(bessEff, 0), 1);
    const effectiveYield = yieldVal * (1 + bifacial / 100);

    const year1Gen = dc_mwp * effectiveYield * (1 - safeLoss / 100);

    let gen25 = 0, gen35 = 0;
    for (let y = 1; y <= 35; y++) {
        const yr = year1Gen * Math.pow(1 - deg / 100, y - 1);
        if (y <= 25) gen25 += yr;
        gen35 += yr;
    }

    const annualSolarRevenue = year1Gen * (price + other);
    const bessAnnualValue = bessMwh * bessCycles * bessRevenuePerMwh * safeBessEff;
    const annualRevenue = annualSolarRevenue + bessAnnualValue;
    const revenue25 = gen25 * (price + other) + bessAnnualValue * 25;
    const revenue35 = gen35 * (price + other) + bessAnnualValue * 35;

    const annualOpex = ac_mw * opexRate;

    const baseCapexWp = epcEx + modules + otherCapex + floodAdder;
    const baseCapex = dc_mwp * 1_000_000 * baseCapexWp;
    const contingency = baseCapex * (cont / 100);
    const bessCapex = bessMwh * bessCapexRate;
    const totalCapex = baseCapex + contingency + fixedCapex + bessCapex;
    const capexPerWp = dc_mwp > 0 ? totalCapex / (dc_mwp * 1_000_000) : 0;

    const surplus25 = revenue25 - annualOpex * 25 - totalCapex;
    const surplus35 = revenue35 - annualOpex * 35 - totalCapex;

    const devCostPerMw = num(prefix + "_dev_cost_mw");
    const devModulePerMwp = num(prefix + "_dev_module_mwp");
    const devEpcPerMw = num(prefix + "_dev_epc_mw");
    const devOwnerPerMw = num(prefix + "_dev_owner_mw");
    const devGridPerMw = num(prefix + "_dev_grid_mw");
    const devExitPerMwp = num(prefix + "_dev_exit_mwp");
    const devNpvPerMwp = num(prefix + "_dev_npv_mwp");
    const devSuccessPct = num(prefix + "_dev_success");
    const devYears = num(prefix + "_dev_years");
    const devStageEl = $(prefix + "_dev_stage");
    const devStage = devStageEl ? devStageEl.options[devStageEl.selectedIndex]?.text || "Manual" : "Manual";

    const wpCapacity = dc_mwp * 1_000_000;
    const devCapitalAtRisk = wpCapacity * devCostPerMw;
    const devModuleCost = wpCapacity * devModulePerMwp;
    const devEpcCost = wpCapacity * devEpcPerMw;
    const devOwnerCost = wpCapacity * devOwnerPerMw;
    const devGridCost = wpCapacity * devGridPerMw;
    const devTotalBuildCost = devCapitalAtRisk + devModuleCost + devEpcCost + devOwnerCost + devGridCost;
    const devExitValue = wpCapacity * devExitPerMwp;
    const devOperatingNpv = wpCapacity * devNpvPerMwp;
    const devGrossMargin = devExitValue - devTotalBuildCost;
    const devRiskAdjustedValue = devGrossMargin * (devSuccessPct / 100);
    const devReturnMultiple = devCapitalAtRisk > 0 ? devGrossMargin / devCapitalAtRisk : 0;

    return {
        annualRevenue, revenue25, revenue35, totalCapex, capexPerWp, surplus25, surplus35,
        devStage, devCostPerMw, devModulePerMwp, devEpcPerMw, devOwnerPerMw, devGridPerMw, devExitPerMwp, devNpvPerMwp, devSuccessPct, devYears,
        devCapitalAtRisk, devModuleCost, devEpcCost, devOwnerCost, devGridCost, devTotalBuildCost, devExitValue, devOperatingNpv,
        devGrossMargin, devRiskAdjustedValue, devReturnMultiple,
        price, other, yieldVal, bifacial, baseLoss, deg, opexRate,
        epcEx, floodActive: checked(prefix + "_flood"), floodRate: num(prefix + "_flood_rate"),
        modules, otherCapex, fixedCapex, cont, totalLoss,
        bessMw, bessMwh, bessCapexRate, bessCycles, bessSpread: bessRevenuePerMwh, bessEff: num(prefix + "_bess_eff"),
        epcIncModules: epcEx + modules
    };
}

function renderFinance(prefix, fin) {
    setText(prefix + "_annual_rev", money(fin.annualRevenue));
    setText(prefix + "_25_rev", money(fin.revenue25));
    setText(prefix + "_35_rev", money(fin.revenue35));
    setText(prefix + "_capex", money(fin.totalCapex));
    setText(prefix + "_capex_wp", "£" + fin.capexPerWp.toFixed(2) + "/Wp");
    setText(prefix + "_surplus_25", money(fin.surplus25));
    setText(prefix + "_surplus_35", money(fin.surplus35));
    setText(prefix + "_dev_capital", money(fin.devCapitalAtRisk));
    setText(prefix + "_dev_module_cost", money(fin.devModuleCost));
    setText(prefix + "_dev_epc_cost", money(fin.devEpcCost));
    setText(prefix + "_dev_owner_cost", money(fin.devOwnerCost));
    setText(prefix + "_dev_grid_cost", money(fin.devGridCost));
    setText(prefix + "_dev_total_cost", money(fin.devTotalBuildCost));
    setText(prefix + "_dev_exit_value", money(fin.devExitValue));
    setText(prefix + "_dev_operating_npv", money(fin.devOperatingNpv));
    setText(prefix + "_dev_margin", money(fin.devGrossMargin));
    setText(prefix + "_dev_risk_value", money(fin.devRiskAdjustedValue));
    setText(prefix + "_dev_multiple", fin.devReturnMultiple.toFixed(2) + "x");
}

function renderFinanceWarnings(prefix, fin, stats) {
    const w = [];
    if (fin.price < 0) w.push("Energy price cannot be negative.");
    if (fin.opexRate < 0) w.push("OPEX cannot be negative.");
    if (fin.totalLoss < 0) w.push("Losses cannot be negative.");
    if (fin.epcIncModules < 0) w.push("EPC cannot be negative.");
    if (fin.capexPerWp < 0) w.push("CAPEX cannot be negative.");
    if (fin.bessMwh < 0 || fin.bessMw < 0) w.push("BESS size cannot be negative.");
    if (fin.bessMwh > 0 && fin.bessEff / 100 <= 0) w.push("BESS efficiency missing.");
    if (fin.bessEff / 100 > 1) w.push("BESS efficiency above 100 percent.");

    if (fin.price < 50) w.push("Low energy price case.");
    if (fin.price > 85) w.push("High energy price case.");
    if (fin.epcIncModules < 0.42) w.push("Aggressive EPC pricing.");
    if (fin.capexPerWp > 1.00) w.push("Full project cost territory.");
    if (fin.capexPerWp > 1.25) w.push("Complex project or asset value territory.");
    if (fin.devCostPerMw > 0.10) w.push("Development cost is above typical EPC signature range.");
    if (fin.devModulePerMwp < 0.10 && fin.devModulePerMwp > 0) w.push("Module supply cost may be aggressive.");
    if (fin.devEpcPerMw < 0.55 && fin.devEpcPerMw > 0) w.push("EPC cost may be aggressive against UK benchmark range.");
    if (fin.devEpcPerMw > 0.85) w.push("EPC cost is above typical non BESS UK benchmark range.");
    if (fin.devNpvPerMwp < 0.90 && fin.devNpvPerMwp > 0) w.push("Operating asset Net Present Value (NPV) assumption is below current screening range.");
    if (fin.devNpvPerMwp > 1.40) w.push("Operating asset Net Present Value (NPV) assumption is above current screening range and may require strong evidence.");
    if (stats.dc_mwp > 100) w.push("Project capacity is above 100 megawatts peak. Nationally Significant Infrastructure Project (NSIP) and Development Consent Order (DCO) planning assumptions may apply and development cost, timescale and owner cost defaults may be too low.");
    if (fin.devGridPerMw > 1.00) w.push("Grid connection cost assumption is very high and may indicate major reinforcement, transmission interface or abnormal connection risk.");
    if (fin.devGridPerMw < 0.10 && fin.devGridPerMw > 0) w.push("Grid connection cost assumption is low and should be checked against the project specific connection scope.");
    if (fin.devSuccessPct < 8) w.push("Development success probability is below typical greenfield to EPC outcome range.");
    if (fin.devSuccessPct > 25) w.push("Development success probability may be optimistic unless project is already materially de risked.");
    if (fin.opexRate < 10000 && fin.opexRate >= 0) w.push("OPEX may be unrealistically low.");
    if (fin.totalLoss > 6) w.push("High loss assumption.");
    if (fin.bifacial > 12) w.push("Aggressive bifacial gain assumption.");
    if (fin.bessMwh > 0 && fin.bessMw <= 0) w.push("BESS MW missing.");
    if (fin.bessMw > 0 && fin.bessMwh / fin.bessMw > 8) w.push("Unusually long BESS duration.");
    if (fin.bessCycles > 365) w.push("Aggressive storage cycling assumption.");

    const elecZero = num(prefix + "_loss_dc_string") + num(prefix + "_loss_lv_dc") +
                     num(prefix + "_loss_lv_ac") + num(prefix + "_loss_tx") + num(prefix + "_loss_other");
    if (elecZero === 0) w.push("Specialist electrical loss fields are blank or zero. Revenue may be overstated until verified.");

    const gf = state.activeTab === "string" ? num("gross_factor") : num("gross_factor_c");
    if (gf < 1.15) w.push("Gross site factor may be too low for roads, buffers, substations, drainage and ecology.");
    if (stats.mods_pallet <= 0 || stats.mods_container <= 0) w.push("Module logistics assumptions are missing.");

    const el = $(prefix + "_warnings");
    if (el) el.innerHTML = w.join("<br>");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", migrateFinanceUnitsToWp);
} else {
    migrateFinanceUnitsToWp();
}

// ============================================================
```

### `gis-sld-v5-ui-core.js`

Lines: 127

```javascript
"use strict";

// RENDER TECHNICAL SUMMARY
// ============================================================
function renderTechSummary(stats) {
    setText("out_module_count", stats.module_count.toLocaleString());
    setText("out_dc_capacity", stats.dc_mwp.toFixed(2) + " MWp");
    setText("out_ac_capacity", stats.ac_mw.toFixed(2) + " MWac");
    setText("out_actual_dcac", stats.dc_ac_ratio.toFixed(2));
    setText("out_cb_per_inv", stats.combiner_boxes_per_inverter.toLocaleString());
    setText("out_total_cb", stats.total_combiner_boxes.toLocaleString());
    setText("out_string_inv_rating", stats.string_inverter_kva ? stats.string_inverter_kva.toFixed(0) + " kVA" : "n/a");
    setText("out_inverter_acmax_mva", stats.inverter_acmax_mva ? stats.inverter_acmax_mva.toFixed(2) + " MVA" : "n/a");
    setText("out_sub_ac_rating", stats.production_substation_ac_mva.toFixed(2) + " MVA");
    setText("out_ring_ac_rating", stats.ring_main_ac_mva.toFixed(2) + " MVA");
    setText("out_central_inv_dc_rating", stats.central_inverter_mwdc.toFixed(2) + " MWdc");
    setText("out_central_inv_rating", stats.central_inverter_mwac.toFixed(2) + " MWac");
    setText("out_cb_dc_kw", stats.combiner_box_dc_kw.toFixed(2) + " kWdc");
    setText("out_engineering_warning", stats.engineering_warning || "Check assumptions");
    setText("out_net_mod_area", (stats.net_mod_area_m2 / CONSTANTS.M2_PER_ACRE).toFixed(0) + " Acres");
    setText("out_net_array_area", (stats.net_array_area_m2 / CONSTANTS.M2_PER_ACRE).toFixed(0) + " Acres");
    setText("out_gross_area", (stats.gross_site_area_m2 / CONSTANTS.M2_PER_ACRE).toFixed(0) + " Acres");
    setText("out_mod_per_pallet", stats.mods_pallet);
    setText("out_pallets", stats.pallets.toLocaleString());
    setText("out_mod_per_cont", stats.mods_container);
    setText("out_containers", stats.containers.toLocaleString());
    setText("out_spare_pct", stats.spares_pct.toFixed(1) + "%");
    setText("out_containers_spares", stats.containers_inc_spares.toLocaleString());

    const tabClass = state.activeTab === "central" ? "stat-val orange" : "stat-val cyan";
    setClass("out_dc_capacity", tabClass);
    setClass("out_containers_spares", tabClass);

    const cpm = stats.dc_mwp > 0 ? stats.containers_inc_spares / stats.dc_mwp : 0;
    setText("out_cont_per_mwp", cpm.toFixed(2));
    setClass("out_cont_per_mwp", tabClass);
}

function renderBenchmark() {
    const mw = num("ref_mw"), mods = num("ref_modules");
    const implied = mw > 0 ? mods / mw : 0;
    setText("out_ref_implied", `~ ${Math.round(implied).toLocaleString()} modules/MW`);
}

function updateSelectedSubstationDisplay() {
    const s = state.selectedSubstation;
    if (!s) {
        setText("out_selected_sub_name", "None selected");
        setText("out_selected_sub_voltage", "Unknown");
        setText("out_selected_sub_lon", "n/a");
        setText("out_selected_sub_lat", "n/a");
        return;
    }
    setText("out_selected_sub_name", s.name || "Selected Substation");
    setText("out_selected_sub_voltage", s.voltage || "Unknown");
    setText("out_selected_sub_lon", s.coordinates ? Number(s.coordinates[0]).toFixed(6) : "n/a");
    setText("out_selected_sub_lat", s.coordinates ? Number(s.coordinates[1]).toFixed(6) : "n/a");
}

// ============================================================
// MAIN RECALC
// ============================================================
function recalcAll() {
    const stats = computeStats();
    state.lastStats = stats;
    renderTechSummary(stats);

    const prefix = state.activeTab === "string" ? "fin_string" : "fin_central";
    const fin = computeFinance(prefix, stats);
    state.lastFinance[prefix] = fin;
    renderFinance(prefix, fin);
    renderFinanceWarnings(prefix, fin, stats);

    renderBenchmark();
    updateSelectedSubstationDisplay();
}

const recalcDebounced = debounce(recalcAll, CONSTANTS.RECALC_DEBOUNCE_MS);

// ============================================================
// LEGEND
// ============================================================
function atlasV8LegendItem(voltageKey, label, colour, widthPx) {
    const visible = atlasV8GridLayerVisibility?.[voltageKey] !== false;
    const opacity = visible ? "1" : "0.35";
    const suffix = visible ? "" : " OFF";
    return `<div class="legend-item" onclick="toggleAtlasV8GridLayer('${voltageKey}')" style="cursor:pointer; opacity:${opacity};" title="Tap to toggle ${label}"><div class="swatch" style="background:transparent; border-bottom: ${widthPx}px solid ${colour};"></div> ${label}${suffix}</div>`;
}

function atlasV8AssetLegendItem(assetKey, label, colour) {
    const visible = atlasV8OperatingAssetVisibility?.[assetKey] === true;
    const opacity = visible ? "1" : "0.35";
    const suffix = visible ? "" : " OFF";
    return `<div class="legend-item" onclick="toggleAtlasV8OperatingAssetLayer('${assetKey}'); updateAtlasV8OperatingAssetToggleButtons?.();" style="cursor:pointer; opacity:${opacity};" title="Tap to toggle ${label}"><div class="swatch" style="background:${colour}; border-color:#111;"></div> ${label}${suffix}</div>`;
}

function updateLegend() {
    const legend = $("map_legend");
    if (!legend) return;
    let html = `
<div class="legend-item"><div class="swatch" style="background:#ffffff; border-color:#ff3333;"></div> Atlas Substation Dataset</div>
        ${atlasV8LegendItem("66kv", "Atlas V8 66 kV Lines", "#66ff66", 2)}
        ${atlasV8LegendItem("132kv", "Atlas V8 132 kV Lines", "#ffcc00", 2)}
        ${atlasV8LegendItem("275kv", "Atlas V8 275 kV Lines", "#ff66ff", 3)}
        ${atlasV8LegendItem("400kv", "Atlas V8 400 kV Lines", "#ff3333", 3)}
        ${atlasV8AssetLegendItem("solar_operational", "Operating Solar PV", "#00ff88")}
        ${atlasV8AssetLegendItem("wind_onshore_operational", "Operating Onshore Wind", "#00ffcc")}
        ${atlasV8AssetLegendItem("wind_offshore_operational", "Operating Offshore Wind", "#0066ff")}
        ${atlasV8AssetLegendItem("bess_operational", "Operating Battery Storage", "#ff69b4")}


        <div class="legend-item"><div class="swatch" style="background:var(--substation);"></div> Point of Interconnection</div>
        <div class="legend-item"><div class="swatch" style="background:transparent; border-bottom: 2px dashed var(--substation);"></div> Export Cable</div>
        <div class="legend-item"><div class="swatch" style="background:var(--private-sub);"></div> Customer Substation</div>
        <div class="legend-item"><div class="swatch" style="background:var(--bess);"></div> BESS Compound</div>
        <div class="legend-item"><div class="swatch" style="background:var(--array-blue); opacity: 0.3; border-style: dashed;"></div> Total Array Boundary</div>`;
    if (state.activeTab === "string") {
        html += `<div class="legend-item"><div class="swatch" style="background:var(--inverter);"></div> String Substation Block</div>
                 <div class="legend-item"><div class="swatch" style="background:transparent; border-bottom: 2px solid var(--accent);"></div> Radial 33kV Spine</div>`;
    } else {
        html += `<div class="legend-item"><div class="swatch" style="background:var(--accent-alt);"></div> Central Inverter Block</div>
                 <div class="legend-item"><div class="swatch" style="background:transparent; border-bottom: 2px solid var(--accent);"></div> Radial 33kV Spine</div>`;
    }
    legend.innerHTML = html;
}

// ============================================================
```

### `gis-sld-v5-drawing.js`

Lines: 236

```javascript
"use strict";

// DRAWING
// ============================================================
function normBearing(deg) {
    return ((deg % 360) + 360) % 360;
}

function getArrayAxisDeg() {
    return normBearing(Number.isFinite(state.arrayRotationDeg) ? state.arrayRotationDeg : 0);
}

function getRectPolygon(centerCoord, width_km, length_km, propType, rotationDeg = 0) {
    const axis = normBearing(rotationDeg);
    const pt = turf.point(centerCoord);
    const ptN = turf.destination(pt, length_km / 2, axis, { units: "kilometers" }).geometry.coordinates;
    const ptS = turf.destination(pt, length_km / 2, axis + 180, { units: "kilometers" }).geometry.coordinates;
    const nw = turf.destination(turf.point(ptN), width_km / 2, axis - 90, { units: "kilometers" }).geometry.coordinates;
    const ne = turf.destination(turf.point(ptN), width_km / 2, axis + 90, { units: "kilometers" }).geometry.coordinates;
    const se = turf.destination(turf.point(ptS), width_km / 2, axis + 90, { units: "kilometers" }).geometry.coordinates;
    const sw = turf.destination(turf.point(ptS), width_km / 2, axis - 90, { units: "kilometers" }).geometry.coordinates;
    return turf.polygon([[nw, ne, se, sw, nw]], { type: propType });
}

function atlasHaversineKm(a, b) {
    const R = 6378.137;
    const r = Math.PI / 180;
    const lon1 = a[0], lat1 = a[1], lon2 = b[0], lat2 = b[1];
    const dLat = (lat2 - lat1) * r;
    const dLon = (lon2 - lon1) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function routeLengthKm(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < coords.length; i++) total += atlasHaversineKm(coords[i - 1], coords[i]);
    return total;
}

function getBlockAspect() {
    const mountingVal = state.activeTab === "string" ? $("mounting_type").value : $("mounting_type_c").value;
    if (mountingVal === "0.45") return 1 / 1.4;
    if (mountingVal === "0.75") return 1.0;
    return 1.4;
}

function getExportCableExtraKm() {
    const el = $("layout_export_extra_km");
    if (!el) return 0;
    const value = parseFloat(el.value);
    return Number.isFinite(value) ? value : 0;
}

function getCommittedCablePins() {
    return state.cableRouteCommitted && Array.isArray(state.cableRoutePins) ? state.cableRoutePins : [];
}

function shouldShowExportCable() {
    if (state.cableRoutePinMode) return false;
    if (Array.isArray(state.cableRoutePins) && state.cableRoutePins.length > 0 && !state.cableRouteCommitted) return false;
    return true;
}

function buildExportCableLine(privateSubCoord, publicSubCoord, safeExtraOffsetKm) {
    const routePoints = getCommittedCablePins();
    const coords = [privateSubCoord, ...routePoints, publicSubCoord];
    return turf.lineString(coords, {
        type: "export_cable",
        export_cable_extra_km: safeExtraOffsetKm,
        export_cable_length_km: 0,
        array_moved_manually: Boolean(state.arrayOverrideCenter),
        array_rotation_deg: getArrayAxisDeg(),
        routed_by_pins: routePoints.length > 0,
        route_pin_count: routePoints.length,
        measurement_method: "atlas_haversine_6378_137_km"
    });
}

function addCableRoutePinMarkers(features) {
    if (!Array.isArray(state.cableRoutePins)) return;
    state.cableRoutePins.forEach((coord, idx) => {
        features.push(turf.point(coord, {
            type: "export_cable_pin",
            pin_index: idx + 1,
            committed_to_route: Boolean(state.cableRouteCommitted)
        }));
    });
}

function computeAndDraw() {
    if (!state.activeDrawCenter || !map) return;
    const stats = computeStats();
    state.lastStats = stats;

    if (stats.total_blocks === 0) {
        recalcAll();
        return;
    }

    const axis = getArrayAxisDeg();
    const N = stats.total_blocks;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);
    const block_area_km2 = stats.block_ground_area_m2 / 1_000_000;

    const aspect = getBlockAspect();
    const block_w = Math.sqrt(block_area_km2 / aspect);
    const block_l = block_w * aspect;
    const spacing = CONSTANTS.BLOCK_SPACING_KM;

    const grid_w = cols * block_w + (cols - 1) * spacing;
    const grid_l = rows * block_l + (rows - 1) * spacing;

    const features = [];
    const publicSubCoord = state.activeDrawCenter;
    const safeExtraOffsetKm = Math.max(-CONSTANTS.ARRAY_OFFSET_KM, getExportCableExtraKm());
    const arrayOffsetKm = grid_l / 2 + CONSTANTS.ARRAY_OFFSET_KM + safeExtraOffsetKm;
    const defaultGridCenter = turf.destination(turf.point(publicSubCoord), arrayOffsetKm, axis, { units: "kilometers" }).geometry.coordinates;
    const gridCenter = state.arrayOverrideCenter || defaultGridCenter;
    const privateSubCoord = turf.destination(turf.point(gridCenter), grid_l / 2, axis + 180, { units: "kilometers" }).geometry.coordinates;
    const exportCableLine = buildExportCableLine(privateSubCoord, publicSubCoord, safeExtraOffsetKm);
    state.exportCableLengthKm = routeLengthKm(exportCableLine.geometry.coordinates);
    exportCableLine.properties.export_cable_length_km = state.exportCableLengthKm;

    features.push(turf.point(publicSubCoord, {
        type: "poi",
        selected_substation_name: state.selectedSubstation?.name || "Local Grid Node",
        selected_substation_voltage: state.selectedSubstation?.voltage || "Unknown"
    }));
    features.push(turf.point(privateSubCoord, {
        type: "private_sub",
        selected_substation_name: "Customer Substation",
        selected_substation_voltage: "Local Voltage",
        export_cable_extra_km: safeExtraOffsetKm,
        export_cable_length_km: state.exportCableLengthKm,
        array_moved_manually: Boolean(state.arrayOverrideCenter),
        array_rotation_deg: axis,
        export_cable_pin_count: state.cableRoutePins.length,
        export_cable_route_committed: Boolean(state.cableRouteCommitted)
    }));
    if (shouldShowExportCable()) features.push(exportCableLine);
    addCableRoutePinMarkers(features);
    features.push(getRectPolygon(gridCenter, grid_w + CONSTANTS.BOUNDARY_BUFFER_KM, grid_l + CONSTANTS.BOUNDARY_BUFFER_KM, "array_boundary", axis));

    const ptN = turf.destination(turf.point(gridCenter), grid_l / 2, axis, { units: "kilometers" }).geometry.coordinates;
    const ptNW = turf.destination(turf.point(ptN), grid_w / 2, axis - 90, { units: "kilometers" }).geometry.coordinates;

    const inverters = [];
    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (count >= N) break;
            const posAcross = turf.destination(turf.point(ptNW), c * block_w + c * spacing + block_w / 2, axis + 90, { units: "kilometers" }).geometry.coordinates;
            const finalPos = turf.destination(turf.point(posAcross), r * block_l + r * spacing + block_l / 2, axis + 180, { units: "kilometers" }).geometry.coordinates;
            const nodeType = state.activeTab === "string" ? "string_substation" : "central_inverter";
            const footType = state.activeTab === "string" ? "skid_footprint" : "central_footprint";
            features.push(getRectPolygon(finalPos, block_w, block_l, footType, axis));
            inverters.push({ coords: finalPos, type: nodeType });
            features.push(turf.point(finalPos, { type: nodeType }));
            count++;
        }
    }

    // BESS
    const prefix = state.activeTab === "string" ? "fin_string" : "fin_central";
    const bess_mwh = num(prefix + "_bess_mwh");
    if (bess_mwh > 0) {
        const bess_area_km2 = (bess_mwh * CONSTANTS.BESS_M2_PER_MWH) / 1_000_000;
        const bess_w = Math.sqrt(bess_area_km2 * CONSTANTS.BESS_ASPECT);
        const bess_l = bess_area_km2 / bess_w;
        const bessCenter = turf.destination(turf.point(privateSubCoord), bess_w / 2 + 0.05, axis - 90, { units: "kilometers" }).geometry.coordinates;
        features.push(getRectPolygon(bessCenter, bess_w, bess_l, "bess_footprint", axis));
        features.push(turf.point(bessCenter, { type: "bess_compound", mwh: bess_mwh }));
        features.push(turf.lineString([bessCenter, privateSubCoord], { type: "33kv_radial" }));
    }

    // Internal 33kV radial links with a clipped visible trunk back to the customer substation.
    if (inverters.length > 0) {
        const projectionLine = turf.lineString([
            privateSubCoord,
            turf.destination(turf.point(privateSubCoord), grid_l, axis, { units: "kilometers" }).geometry.coordinates
        ], { type: "33kv_projection_only" });

        let maxTrunkDistanceKm = 0;
        const projectedBranches = [];
        inverters.forEach(inv => {
            const projected = turf.nearestPointOnLine(projectionLine, turf.point(inv.coords), { units: "kilometers" }).geometry.coordinates;
            const distanceFromCustomerSub = routeLengthKm([privateSubCoord, projected]);
            if (distanceFromCustomerSub > maxTrunkDistanceKm) maxTrunkDistanceKm = distanceFromCustomerSub;
            projectedBranches.push({ inverter: inv.coords, projected });
        });

        if (maxTrunkDistanceKm > 0) {
            const clippedTrunkEnd = turf.destination(turf.point(privateSubCoord), maxTrunkDistanceKm, axis, { units: "kilometers" }).geometry.coordinates;
            features.push(turf.lineString([privateSubCoord, clippedTrunkEnd], {
                type: "33kv_radial",
                role: "collector_trunk",
                clipped_to_inverter_extent: true
            }));
        }

        projectedBranches.forEach(branch => {
            features.push(turf.lineString([branch.inverter, branch.projected], {
                type: "33kv_radial",
                role: "block_branch"
            }));
        });
    }

    state.currentGeoJSON = turf.featureCollection(features);
    const src = map.getSource("topology");
    if (src) src.setData(state.currentGeoJSON);
    setTopologyLayerVisibility?.(state.arrayVisible !== false);
    updateArrayToggleButton?.();

    if (features.length > 0 && !state.suppressNextMapFit) {
        const bbox = turf.bbox(state.currentGeoJSON);
        map.fitBounds(bbox, { padding: 60, duration: 800 });
    }
    state.suppressNextMapFit = false;

    updateExportCableLengthDisplay();
    updateCableRouteStatus();
    updateArrayRotationDisplay();

    // Refresh side-panel values
    renderTechSummary(stats);
    const fin = computeFinance(prefix, stats);
    state.lastFinance[prefix] = fin;
    renderFinance(prefix, fin);
    renderFinanceWarnings(prefix, fin, stats);
}

// ============================================================
```

### `gis-sld-v5-export.js`

Lines: 148

```javascript
"use strict";

// EXPORT
// ============================================================
function exportGeoJSON() {
    if (state.currentGeoJSON.features.length === 0) return;
    const exportData = JSON.parse(JSON.stringify(state.currentGeoJSON));
    const boundary = exportData.features.find(f => f.properties.type === "array_boundary");
    if (!boundary) return triggerDownload(exportData);

    const stats = state.lastStats || computeStats();
    const prefix = state.activeTab === "string" ? "fin_string" : "fin_central";
    const fin = state.lastFinance[prefix] || computeFinance(prefix, stats);

    const suffix = state.activeTab === "string" ? "" : "_c";
    const logisticsPreset = $("logistics_preset" + suffix)?.value || "manual";
    const grossFactor = num("gross_factor" + suffix);
    const gcr = parseFloat($("mounting_type" + suffix)?.value) || 0;
    const moduleRatingWp = num("mod_wp" + suffix);

    const topologyProps = state.activeTab === "string" ? {
        tech_modules_per_string: intVal("x_mods"),
        tech_strings_per_inverter: intVal("z_strings"),
        tech_inverters_per_substation: intVal("y_invs"),
        tech_substations_per_33kv_ring: intVal("s_subs"),
        tech_33kv_rings: intVal("b_cols")
    } : {
        tech_central_ac_rating_mwac: num("inv_ac_mw_c"),
        tech_modules_per_string: intVal("x_mods_c"),
        tech_strings_per_combiner_box: intVal("str_per_cb_c"),
        tech_central_inverters_per_mv_station: intVal("inv_per_mv_c"),
        tech_mv_stations_per_33kv_ring: intVal("mv_per_ring_c"),
        tech_33kv_rings: intVal("rings_c"),
        tech_combiner_boxes_per_inverter: stats.combiner_boxes_per_inverter,
        tech_total_combiner_boxes: stats.total_combiner_boxes
    };

    boundary.properties = {
        ...boundary.properties,
        fin_active_tab: state.activeTab,
        fin_export_note: "Engineering screening output only. Not construction design, financial advice, EPC pricing, grid compliance, logistics planning or transport instruction. Electrical loss fields are assumption fields and require competent project specific verification. Selected substation is a public dataset reference point and does not confirm available capacity, connection rights, voltage suitability or grid acceptance.",

        grid_selected_substation_name: state.selectedSubstation?.name || null,
        grid_selected_substation_voltage: state.selectedSubstation?.voltage || null,
        grid_selected_substation_lon: state.selectedSubstation?.coordinates?.[0] ?? null,
        grid_selected_substation_lat: state.selectedSubstation?.coordinates?.[1] ?? null,
        grid_selected_substation_properties: state.selectedSubstation?.properties || null,

        tech_module_rating_wp: moduleRatingWp,
        tech_module_length_m: num("mod_l" + suffix),
        tech_module_width_m: num("mod_w" + suffix),
        tech_ground_coverage_ratio: gcr,
        tech_gross_site_factor: grossFactor,

        tech_logistics_preset: logisticsPreset,
        tech_modules_per_packing_unit: stats.mods_pallet,
        tech_modules_per_40ft_container: stats.mods_container,
        tech_spare_allowance_percent: stats.spares_pct,
        tech_total_base_packing_units: stats.pallets,
        tech_total_base_containers: stats.containers,
        tech_total_modules_inc_spares: stats.modules_inc_spares,
        tech_total_packing_units_inc_spares: stats.pallets_inc_spares,
        tech_total_containers_inc_spares: stats.containers_inc_spares,
        tech_containers_per_mwp: stats.dc_mwp > 0 ? Number((stats.containers_inc_spares / stats.dc_mwp).toFixed(2)) : 0,

        ...topologyProps,

        tech_module_count: stats.module_count,
        tech_dc_capacity_mwp: stats.dc_mwp,
        tech_ac_capacity_mwac: stats.ac_mw,
        tech_net_mod_area_m2: stats.net_mod_area_m2,
        tech_net_array_area_m2: stats.net_array_area_m2,
        tech_gross_site_area_m2: stats.gross_site_area_m2,

        // Finance — numbers, not formatted strings
        fin_total_capex_gbp: Math.round(fin.totalCapex),
        fin_capex_per_wp_gbp: Number(fin.capexPerWp.toFixed(4)),
        fin_annual_rev_gbp: Math.round(fin.annualRevenue),
        fin_25yr_revenue_gbp: Math.round(fin.revenue25),
        fin_35yr_revenue_gbp: Math.round(fin.revenue35),
        fin_25yr_surplus_gbp: Math.round(fin.surplus25),
        fin_35yr_surplus_gbp: Math.round(fin.surplus35),
fin_development_stage: fin.devStage,
fin_development_cost_gbp_mw: fin.devCostPerMw,
fin_development_module_supply_cost_gbp_mwp: fin.devModulePerMwp,
fin_development_epc_cost_gbp_mw: fin.devEpcPerMw,
fin_development_owner_cost_gbp_mw: fin.devOwnerPerMw,
fin_development_grid_connection_cost_gbp_mw: fin.devGridPerMw,
fin_development_exit_value_gbp_mwp: fin.devExitPerMwp,
fin_development_operating_npv_gbp_mwp: fin.devNpvPerMwp,
fin_development_success_probability_percent: fin.devSuccessPct,
fin_development_years: fin.devYears,
fin_development_capital_at_risk_gbp: Math.round(fin.devCapitalAtRisk),
fin_development_module_supply_cost_gbp: Math.round(fin.devModuleCost),
fin_development_epc_cost_gbp: Math.round(fin.devEpcCost),
fin_development_owner_cost_gbp: Math.round(fin.devOwnerCost),
fin_development_grid_connection_cost_gbp: Math.round(fin.devGridCost),
fin_development_total_build_cost_gbp: Math.round(fin.devTotalBuildCost),
fin_development_target_exit_value_gbp: Math.round(fin.devExitValue),
fin_development_operating_npv_gbp: Math.round(fin.devOperatingNpv),
fin_development_gross_margin_gbp: Math.round(fin.devGrossMargin),
fin_development_risk_adjusted_value_gbp: Math.round(fin.devRiskAdjustedValue),
fin_development_return_multiple: Number(fin.devReturnMultiple.toFixed(4)),

        fin_energy_price_gbp_mwh: fin.price,
        fin_other_income_gbp_mwh: fin.other,
        fin_yield_kwh_kwp: fin.yieldVal,
        fin_bifacial_gain: fin.bifacial,
        fin_flood_resilience: fin.floodActive,
        fin_flood_adder_gbp_wp: fin.floodRate,

        fin_base_losses_percent: fin.baseLoss,
        fin_loss_dc_string_percent: num(prefix + "_loss_dc_string"),
        fin_loss_lv_main_dc_percent: num(prefix + "_loss_lv_dc"),
        fin_loss_lv_ac_percent: num(prefix + "_loss_lv_ac"),
        fin_loss_transformer_percent: num(prefix + "_loss_tx"),
        fin_loss_other_electrical_percent: num(prefix + "_loss_other"),

        fin_opex_gbp_mwac_year: fin.opexRate,
        fin_epc_ex_modules_gbp_wp: fin.epcEx,
        fin_modules_gbp_wp: fin.modules,
        fin_other_capex_gbp_wp: fin.otherCapex,
        fin_fixed_capex_gbp: fin.fixedCapex,
        fin_contingency_percent: fin.cont,
        fin_bess_mw: fin.bessMw,
        fin_bess_mwh: fin.bessMwh,
        fin_bess_capex_gbp_mwh: fin.bessCapexRate,
        fin_bess_cycles_year: fin.bessCycles,
        fin_bess_spread_gbp_mwh: fin.bessSpread,
        fin_bess_efficiency_percent: fin.bessEff
    };

    triggerDownload(exportData);
}

function triggerDownload(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gis_sld_${state.activeTab}_neat_grid.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
```

### `gis-sld-v5-ui.js`

Lines: 1667

```javascript
"use strict";

// TAB SWITCHING
// ============================================================
function switchTab(tab) {
    state.activeTab = tab;
    $("tabbtn_string")?.classList.toggle("active", tab === "string");
    $("tabbtn_central")?.classList.toggle("active", tab === "central");
    $("string_tab")?.classList.toggle("active", tab === "string");
    $("central_tab")?.classList.toggle("active", tab === "central");
    $("btn_draw")?.classList.toggle("central", tab === "central");
    document.querySelectorAll(".central-only").forEach(el => {
        el.style.display = tab === "central" ? "flex" : "none";
    });
    updateLegend();
    syncMapSizeInputFromActiveTab?.();
    if (state.activeDrawCenter) computeAndDraw();
    else recalcAll();
}

// ============================================================
// LOGISTICS PRESET
// ============================================================
function applyLogisticsPreset(val, suffix) {
    const preset = CONSTANTS.LOGISTICS_PRESETS[val];
    if (!preset) return;
    const pEl = $("mods_pallet" + suffix);
    const cEl = $("mods_container" + suffix);
    if (pEl) pEl.value = preset.pallet;
    if (cEl) cEl.value = preset.container;
    recalcAll();
}

// ============================================================
// BIFACIAL AUTO-FILL
// ============================================================
function autoFillBifacial(gcrVal, targetId) {
    const bifacial = CONSTANTS.BIFACIAL_BY_GCR[gcrVal] ?? 0;
    const el = $(targetId);
    if (el) {
        el.value = bifacial;
        el.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

// ============================================================
// SAFE EXPORT CABLE LENGTH CONTROL
// ============================================================
function updateExportCableLengthDisplay() {
    const el = $("out_export_cable_length_km");
    if (!el) return;
    const km = Number.isFinite(state.exportCableLengthKm) ? state.exportCableLengthKm : 0;
    el.textContent = km.toFixed(3) + " km";
}

function updateArrayRotationDisplay() {
    const el = $("out_array_rotation_deg");
    if (!el) return;
    const deg = Number.isFinite(state.arrayRotationDeg) ? state.arrayRotationDeg : 0;
    el.textContent = (((deg % 360) + 360) % 360).toFixed(0) + "°";
}

function rotateArrayBy(deltaDeg) {
    state.arrayRotationDeg = (((state.arrayRotationDeg || 0) + deltaDeg) % 360 + 360) % 360;
    state.cableRoutePins = [];
    state.cableRouteCommitted = false;
    state.cableRouteWaypoints = [];
    state.suppressNextMapFit = true;
    updateArrayRotationDisplay();
    redrawIfTopologyExists();
}

function resetArrayRotation() {
    state.arrayRotationDeg = 0;
    state.cableRoutePins = [];
    state.cableRouteCommitted = false;
    state.cableRouteWaypoints = [];
    state.suppressNextMapFit = true;
    updateArrayRotationDisplay();
    redrawIfTopologyExists();
}

function getCurrentArrayCenter() {
    if (Array.isArray(state.arrayOverrideCenter)) return state.arrayOverrideCenter;
    const boundary = state.currentGeoJSON?.features?.find(f => f.properties?.type === "array_boundary");
    if (!boundary || typeof turf === "undefined") return null;
    try {
        return turf.centroid(boundary).geometry.coordinates;
    } catch (err) {
        console.warn("Array centroid unavailable", err);
        return null;
    }
}

function getArrayNudgeStepKm() {
    const el = $("array_nudge_step_m");
    const metres = el ? parseFloat(el.value) : 25;
    const safeMetres = Number.isFinite(metres) && metres > 0 ? metres : 25;
    return safeMetres / 1000;
}

function clearRouteAfterArrayShift() {
    state.cableRoutePins = [];
    state.cableRouteCommitted = false;
    state.cableRouteWaypoints = [];
    state.cableRoutePinMode = false;
}

function nudgeArray(bearingDeg) {
    if (!state.activeDrawCenter) {
        setArrayMoveStatus("Draw a grid first, then nudge the array.", false);
        return;
    }
    const center = getCurrentArrayCenter();
    if (!center) {
        setArrayMoveStatus("Array centre unavailable. Draw the grid again.", false);
        return;
    }
    const moved = turf.destination(turf.point(center), getArrayNudgeStepKm(), bearingDeg, { units: "kilometers" }).geometry.coordinates;
    state.arrayOverrideCenter = moved;
    state.arrayMoveMode = false;
    state.suppressNextMapFit = true;
    clearRouteAfterArrayShift();
    setArrayMoveStatus("Array nudged. Grid point stayed fixed. Route pins cleared because the customer substation moved.", false);
    redrawIfTopologyExists();
}

function updateCableRouteStatus() {
    const el = $("cable_route_status");
    if (!el) return;
    const count = Array.isArray(state.cableRoutePins) ? state.cableRoutePins.length : 0;
    if (state.cableRoutePinMode) {
        el.textContent = "Pin mode active. Click the map to drop pseudo pylon pins. Pins: " + count;
        el.style.color = "#ff9900";
    } else if (state.cableRouteCommitted && count > 0) {
        el.textContent = "Pinned cable route drawn through " + count + " pins. Atlas haversine length is live.";
        el.style.color = "#00ff88";
    } else if (count > 0) {
        el.textContent = count + " pins dropped. Click Draw Cable to render route through pins.";
        el.style.color = "#ff9900";
    } else {
        el.textContent = "No pins. Export cable is direct until pins are dropped and drawn.";
        el.style.color = "var(--muted)";
    }
}

function injectExportCableLengthControl() {
    if ($("layout_export_extra_km")) return;

    const drawBtn = $("btn_draw");
    if (!drawBtn || !drawBtn.parentNode) return;

    const box = document.createElement("div");
    box.className = "stat-box";
    box.id = "export_cable_length_box";
    box.style.borderColor = "#00ffff";
    box.style.background = "rgba(0, 255, 255, 0.05)";
    box.style.marginBottom = "15px";
    box.innerHTML = `
        <h3 style="margin-top:0;color:#00ffff;border-bottom-color:#00ffff;">Grid Connection Length</h3>
        <div class="stat-row"><span>Live Export Cable Length:</span><span class="stat-val cyan" id="out_export_cable_length_km">0.000 km</span></div>
        <div class="stat-row"><span>Array Rotation:</span><span class="stat-val orange" id="out_array_rotation_deg">0°</span></div>
        <div class="input-group"><label>Export Cable Extra Length km</label><input type="number" id="layout_export_extra_km" value="0" step="0.05" min="-0.2"></div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Moves the whole array further from or closer to the point of connection along the existing axis. Pin routing measures the final cable route using Atlas style haversine maths.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <button class="btn" id="btn_rotate_left_30" style="background:#222;color:#fff;">Rotate Left 30°</button>
        <button class="btn" id="btn_rotate_right_30" style="margin-top:6px;background:#222;color:#fff;">Rotate Right 30°</button>
        <button class="btn" id="btn_rotate_right_90" style="margin-top:6px;background:#ff9900;color:#000000;">Rotate 90°</button>
        <button class="btn" id="btn_reset_rotation" style="margin-top:6px;">Reset Rotation</button>
        <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Rotation keeps the grid point fixed and redraws the export cable. Route pins are cleared when rotation changes.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <button class="btn" id="btn_pick_array" style="margin-top:8px;background:#00ffff;color:#001111;">Pick Up Array</button>
        <button class="btn" id="btn_reset_array_move" style="margin-top:6px;">Reset Array Location</button>
        <div class="input-group" style="margin-top:8px;"><label>Fine Nudge Step metres</label><input type="number" id="array_nudge_step_m" value="25" step="5" min="1"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px;align-items:center;">
            <span></span><button class="btn" id="btn_nudge_up" style="background:#222;color:#fff;padding:8px;">↑</button><span></span>
            <button class="btn" id="btn_nudge_left" style="background:#222;color:#fff;padding:8px;">←</button><button class="btn" id="btn_nudge_down" style="background:#222;color:#fff;padding:8px;">↓</button><button class="btn" id="btn_nudge_right" style="background:#222;color:#fff;padding:8px;">→</button>
        </div>
        <div id="array_move_status" style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Pick Up Array keeps the grid point fixed. Use arrows for fine field fitting.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <button class="btn" id="btn_drop_cable_pins" style="background:#ff9900;color:#000000;">Drop Cable Pins</button>
        <button class="btn" id="btn_draw_cable_route" style="margin-top:6px;background:#00ff88;color:#001111;">Draw Cable Through Pins</button>
        <button class="btn" id="btn_undo_cable_pin" style="margin-top:6px;">Undo Last Pin</button>
        <button class="btn" id="btn_clear_cable_route" style="margin-top:6px;">Clear Pins and Route</button>
        <div id="cable_route_status" style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            No pins. Export cable is direct until pins are dropped and drawn.
        </div>
    `;

    drawBtn.parentNode.insertBefore(box, drawBtn);
    updateExportCableLengthDisplay();
    updateArrayRotationDisplay();
    updateCableRouteStatus();
}

function redrawIfTopologyExists() {
    if (state.activeDrawCenter) computeAndDraw();
    else recalcAll();
}

function setArrayMoveStatus(text, active = false) {
    const el = $("array_move_status");
    if (el) {
        el.textContent = text;
        el.style.color = active ? "#00ffff" : "var(--muted)";
    }
    const btn = $("btn_pick_array");
    if (btn) {
        btn.textContent = active ? "Click Map to Place" : "Pick Up Array";
        btn.style.background = active ? "#ff9900" : "#00ffff";
        btn.style.color = active ? "#000000" : "#001111";
    }
}

function toggleArrayMoveMode() {
    if (!state.activeDrawCenter) {
        setArrayMoveStatus("Draw a grid first, then pick up the array.", false);
        return;
    }
    state.cableRoutePinMode = false;
    state.arrayMoveMode = !state.arrayMoveMode;
    setArrayMoveStatus(
        state.arrayMoveMode ? "Move mode active. Click the map where the array centre should move." : "Move mode cancelled.",
        state.arrayMoveMode
    );
    updateCableRouteStatus();
}

function resetArrayLocation() {
    state.arrayMoveMode = false;
    state.arrayOverrideCenter = null;
    clearRouteAfterArrayShift();
    state.suppressNextMapFit = true;
    setArrayMoveStatus("Array reset to calculated default position.", false);
    redrawIfTopologyExists();
}

function placeArrayAtMapPoint(e) {
    if (!state.arrayMoveMode) return;
    if (!e || !e.lngLat) return;
    state.arrayOverrideCenter = [e.lngLat.lng, e.lngLat.lat];
    state.arrayMoveMode = false;
    state.suppressNextMapFit = true;
    clearRouteAfterArrayShift();
    setArrayMoveStatus("Array moved. Grid point stayed fixed and export cable length recalculated.", false);
    computeAndDraw();
}

function toggleCablePinMode() {
    if (!state.activeDrawCenter) {
        updateCableRouteStatus();
        return;
    }
    state.arrayMoveMode = false;
    state.cableRoutePinMode = !state.cableRoutePinMode;
    state.suppressNextMapFit = true;
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

function commitCablePinRoute() {
    state.cableRoutePinMode = false;
    state.cableRouteCommitted = Array.isArray(state.cableRoutePins) && state.cableRoutePins.length > 0;
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

function undoCablePin() {
    if (!Array.isArray(state.cableRoutePins) || state.cableRoutePins.length === 0) return;
    state.cableRoutePins.pop();
    state.cableRouteCommitted = false;
    state.suppressNextMapFit = true;
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

function clearCableRoute() {
    state.cableRoutePinMode = false;
    state.cableRoutePins = [];
    state.cableRouteCommitted = false;
    state.cableRouteWaypoints = [];
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

function addCableRoutePin(e) {
    if (!state.cableRoutePinMode) return;
    if (!e || !e.lngLat) return;
    state.cableRoutePins.push([e.lngLat.lng, e.lngLat.lat]);
    state.cableRouteCommitted = false;
    state.suppressNextMapFit = true;
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

// Legacy wrappers retained so old references do not break.
function startCableRouteMode() { toggleCablePinMode(); }
function finishCableRouteMode() { commitCablePinRoute(); }
function addCableRouteWaypoint(e) { addCableRoutePin(e); }

// ============================================================
// LOCATION SEARCH
// ============================================================
async function searchLocation() {
    const q = $("loc_search")?.value;
    if (!q) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data && data.length > 0) {
            map.flyTo({ center: [parseFloat(data[0].lon), parseFloat(data[0].lat)], zoom: 14 });
        }
    } catch (e) {
        console.error("Geocoding failed:", e);
    }
}

// ============================================================
// DRAW BUTTON
// ============================================================
function triggerDrawAtCenter() {
    if (!map) return;
    state.selectedSubstation = null;
    state.activeDrawCenter = [map.getCenter().lng, map.getCenter().lat];
    state.arrayOverrideCenter = null;
    state.arrayMoveMode = false;
    state.cableRoutePinMode = false;
    state.cableRoutePins = [];
    state.cableRouteCommitted = false;
    computeAndDraw();
    updateSelectedSubstationDisplay();
    setArrayMoveStatus("Grid drawn. Use Pick Up Array or nudge arrows to relocate the array while the grid point stays fixed.", false);
    updateCableRouteStatus();
}



// ============================================================
// GIS MAP SEARCH: OPERATING ASSETS AND SUBSTATIONS
// ============================================================
let gisSearchReady = false;
let gisAssetSearchIndex = [];
let gisSubstationSearchIndex = [];

function gisSearchEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function gisSearchPick(prop, keys, fallback = "") {
    for (const key of keys) {
        if (prop && prop[key] !== undefined && prop[key] !== null && String(prop[key]).trim() !== "") return prop[key];
    }
    return fallback;
}

function gisSearchValidPoint(feature) {
    return feature && feature.geometry && feature.geometry.type === "Point" && Array.isArray(feature.geometry.coordinates);
}

async function buildGisSearchIndexes() {
    if (gisSearchReady) return;
    try {
        const [repdRes, subsRes] = await Promise.all([
            fetch("/dist/repd_master.json", { cache: "no-cache" }),
            fetch(SUBSTATIONS_URL, { cache: "no-cache" })
        ]);

        const repd = repdRes.ok ? await repdRes.json() : { features: [] };
        const subsRaw = subsRes.ok ? await subsRes.json() : { features: [] };
        const subs = normaliseSubstations?.(subsRaw) || { features: [] };

        gisAssetSearchIndex = (repd.features || [])
            .filter(gisSearchValidPoint)
            .filter(f => {
                const p = f.properties || {};
                return String(p.status || "").toLowerCase() === "operational" &&
                    (["solar", "bess"].includes(String(p.tech || "")) || ["Wind Onshore", "Wind Offshore"].includes(String(p.raw_tech || "")));
            })
            .map(f => {
                const p = f.properties || {};
                const name = gisSearchPick(p, ["name", "project", "site", "Site Name"], "Operating asset");
                const tech = gisSearchPick(p, ["raw_tech", "tech"], "Unknown");
                const capacity = Number(gisSearchPick(p, ["capacity", "capacity_mw"], 0)) || 0;
                return {
                    kind: "asset",
                    feature: f,
                    name,
                    tech,
                    capacity,
                    label: `${name} ${tech} ${capacity} MW`.toLowerCase()
                };
            });

        gisSubstationSearchIndex = (subs.features || [])
            .filter(gisSearchValidPoint)
            .map(f => {
                const p = f.properties || {};
                const name = gisSearchPick(p, ["name_clean", "name", "Name", "substation", "Substation"], "Substation");
                const voltage = gisSearchPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV"], "Unknown");
                return {
                    kind: "substation",
                    feature: f,
                    name,
                    voltage,
                    capacity: 0,
                    label: `${name} ${voltage} substation`.toLowerCase()
                };
            });

        gisSearchReady = true;
    } catch (err) {
        console.error("GIS search index failed", err);
        setFetchStatus?.("Search index unavailable", true);
    }
}

function gisSearchResultsEl() {
    return $("gis_search_results");
}

function hideGisSearchResults() {
    const el = gisSearchResultsEl();
    if (el) el.style.display = "none";
}

function showGisSearchResults(html) {
    const el = gisSearchResultsEl();
    if (!el) return;
    el.innerHTML = html;
    el.style.display = "block";
}

function renderGisSearchResults(query) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) {
        hideGisSearchResults();
        return;
    }

    const assetMatches = gisAssetSearchIndex
        .filter(item => item.label.includes(q))
        .sort((a, b) => b.capacity - a.capacity)
        .slice(0, 8);
    const subMatches = gisSubstationSearchIndex
        .filter(item => item.label.includes(q))
        .slice(0, 8);
    const matches = [...assetMatches, ...subMatches].slice(0, 12);

    if (!matches.length) {
        showGisSearchResults('<div class="gis-search-result-empty">No sites or substations found</div>');
        return;
    }

    showGisSearchResults(matches.map((item, idx) => {
        const meta = item.kind === "asset" ? `${gisSearchEscape(item.tech)} · ${item.capacity || "n/a"} MW` : `Substation · ${gisSearchEscape(item.voltage)}`;
        const cls = item.kind === "asset" ? "asset" : "substation";
        return `<button class="gis-search-result ${cls}" data-gis-search-idx="${idx}">
            <strong>${gisSearchEscape(item.name)}</strong>
            <span>${meta}</span>
        </button>`;
    }).join(""));

    const el = gisSearchResultsEl();
    if (!el) return;
    el.querySelectorAll("[data-gis-search-idx]").forEach((btn, idx) => {
        btn.addEventListener("click", () => flyToGisSearchItem(matches[idx]));
    });
}

function flyToGisSearchItem(item) {
    if (!map || !item || !gisSearchValidPoint(item.feature)) return;
    const coords = item.feature.geometry.coordinates.slice();
    map.flyTo({ center: coords, zoom: item.kind === "asset" ? 11.5 : 13.5, duration: 1200, essential: true });
    hideGisSearchResults();
    const input = $("gis_search_input");
    if (input) input.value = item.name;

    setTimeout(() => {
        if (item.kind === "asset") {
            const p = item.feature.properties || {};
            const name = gisSearchPick(p, ["name", "project", "site", "Site Name"], "Operating asset");
            const tech = gisSearchPick(p, ["raw_tech", "tech"], "Unknown technology");
            const status = gisSearchPick(p, ["status"], "Unknown status");
            const capacity = gisSearchPick(p, ["capacity", "capacity_mw"], "n/a");
            showPopup(coords, `
                <div style="margin-bottom:5px;color:#00ff88;font-weight:bold;font-size:13px;text-transform:uppercase;">Operating Asset</div>
                <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(name)}</span></div>
                <div class="popup-row"><span>Technology:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(tech)}</span></div>
                <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(status)}</span></div>
                <div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(capacity)} MW</span></div>
            `);
        } else {
            const p = item.feature.properties || {};
            const name = gisSearchPick(p, ["name_clean", "name", "Name", "substation", "Substation"], "Substation");
            const voltage = gisSearchPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV"], "Unknown");
            showPopup(coords, `
                <div style="margin-bottom:5px;color:#ff3333;font-weight:bold;font-size:13px;text-transform:uppercase;">Substation</div>
                <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(name)}</span></div>
                <div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(voltage)}</span></div>
                <div class="popup-row"><span>Lon:</span><span class="popup-val" style="color:#fff;">${Number(coords[0]).toFixed(6)}</span></div>
                <div class="popup-row"><span>Lat:</span><span class="popup-val" style="color:#fff;">${Number(coords[1]).toFixed(6)}</span></div>
            `);
        }
    }, 1250);
}

async function wireGisMapSearch() {
    const input = $("gis_search_input");
    const btn = $("gis_search_btn");
    if (!input || !btn) return;

    input.addEventListener("focus", buildGisSearchIndexes);
    input.addEventListener("input", async () => {
        await buildGisSearchIndexes();
        renderGisSearchResults(input.value);
    });
    input.addEventListener("keydown", async e => {
        if (e.key === "Enter") {
            await buildGisSearchIndexes();
            const first = gisSearchResultsEl()?.querySelector(".gis-search-result");
            if (first) first.click();
            else renderGisSearchResults(input.value);
        }
        if (e.key === "Escape") hideGisSearchResults();
    });
    btn.addEventListener("click", async () => {
        await buildGisSearchIndexes();
        const first = gisSearchResultsEl()?.querySelector(".gis-search-result");
        if (first) first.click();
        else renderGisSearchResults(input.value);
    });
    document.addEventListener("click", e => {
        const wrap = $("gis_map_search");
        if (wrap && !wrap.contains(e.target)) hideGisSearchResults();
    });
}


// ============================================================
// V7 SITE INTELLIGENCE PANEL
// ============================================================
const siteIntelData = {
    ready: false,
    loading: false,
    assets: [],
    substations: [],
    grid: {
        "66 kV": [],
        "132 kV": [],
        "275 kV": [],
        "400 kV": []
    }
};

const siteIntelGridUrls = {
    "66 kV": "/repd_grid_atlasv8/data/grid_66kv.geojson",
    "132 kV": "/repd_grid_atlasv8/data/grid_132kv.geojson",
    "275 kV": "/repd_grid_atlasv8/data/grid_275kv.geojson",
    "400 kV": "/repd_grid_atlasv8/data/grid_400kv.geojson"
};

function siteIntelPick(prop, keys, fallback = "") {
    for (const key of keys) {
        if (prop && prop[key] !== undefined && prop[key] !== null && String(prop[key]).trim() !== "") return prop[key];
    }
    return fallback;
}

function siteIntelEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function siteIntelValidPoint(feature) {
    return feature && feature.geometry && feature.geometry.type === "Point" && Array.isArray(feature.geometry.coordinates);
}

function siteIntelFeatureCollection(raw) {
    if (!raw) return { type: "FeatureCollection", features: [] };
    if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) return raw;
    if (Array.isArray(raw)) return { type: "FeatureCollection", features: raw };
    return { type: "FeatureCollection", features: [] };
}

function siteIntelFlattenLines(features) {
    const lines = [];
    (features || []).forEach(feature => {
        if (!feature || !feature.geometry) return;
        const prop = feature.properties || {};
        if (feature.geometry.type === "LineString") {
            lines.push({ type: "Feature", geometry: feature.geometry, properties: prop });
        } else if (feature.geometry.type === "MultiLineString") {
            feature.geometry.coordinates.forEach(coords => {
                lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: prop });
            });
        }
    });
    return lines;
}

function showSiteIntelPanel(html) {
    const panel = $("site_intel_panel");
    const body = $("site_intel_body");
    if (!panel || !body) return;
    body.innerHTML = html;
    panel.classList.remove("collapsed");
}

function hideSiteIntelPanel() {
    const panel = $("site_intel_panel");
    if (panel) panel.classList.add("collapsed");
}

async function loadSiteIntelData() {
    if (siteIntelData.ready || siteIntelData.loading) return;
    siteIntelData.loading = true;

    try {
        const [repdRes, subsRes, ...gridResponses] = await Promise.all([
            fetch("/dist/repd_master.json", { cache: "no-cache" }),
            fetch(SUBSTATIONS_URL, { cache: "no-cache" }),
            fetch(siteIntelGridUrls["66 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["132 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["275 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["400 kV"], { cache: "no-cache" })
        ]);

        const repd = repdRes.ok ? await repdRes.json() : { features: [] };
        const subsRaw = subsRes.ok ? await subsRes.json() : { features: [] };
        const subs = typeof normaliseSubstations === "function" ? normaliseSubstations(subsRaw) : siteIntelFeatureCollection(subsRaw);
        const gridKeys = ["66 kV", "132 kV", "275 kV", "400 kV"];

        siteIntelData.assets = (siteIntelFeatureCollection(repd).features || [])
            .filter(siteIntelValidPoint)
            .filter(feature => {
                const p = feature.properties || {};
                const status = String(siteIntelPick(p, ["status", "Status"], "")).toLowerCase();
                const tech = String(siteIntelPick(p, ["tech"], "")).toLowerCase();
                const rawTech = String(siteIntelPick(p, ["raw_tech", "Technology Type"], ""));
                return status === "operational" && (tech === "solar" || tech === "bess" || rawTech === "Wind Onshore" || rawTech === "Wind Offshore");
            });

        siteIntelData.substations = (subs.features || []).filter(siteIntelValidPoint);

        for (let i = 0; i < gridKeys.length; i++) {
            const key = gridKeys[i];
            const res = gridResponses[i];
            const raw = res && res.ok ? await res.json() : { features: [] };
            siteIntelData.grid[key] = siteIntelFlattenLines(siteIntelFeatureCollection(raw).features);
        }

        siteIntelData.ready = true;
    } catch (err) {
        console.error("Site intelligence data load failed", err);
        showSiteIntelPanel(`<div class="site-intel-warning">Site intelligence data unavailable: ${siteIntelEscape(err.message || err)}</div>`);
    } finally {
        siteIntelData.loading = false;
    }
}

function siteIntelAssetGroup(feature) {
    const p = feature.properties || {};
    const tech = String(siteIntelPick(p, ["tech"], "")).toLowerCase();
    const rawTech = String(siteIntelPick(p, ["raw_tech", "Technology Type"], ""));
    if (tech === "solar") return "Operating Solar PV";
    if (tech === "bess") return "Operating Battery Storage";
    if (rawTech === "Wind Onshore") return "Operating Onshore Wind";
    if (rawTech === "Wind Offshore") return "Operating Offshore Wind";
    return "Operating Asset";
}

function nearestPointFeature(point, features, predicate) {
    let best = null;
    (features || []).forEach(feature => {
        if (!siteIntelValidPoint(feature)) return;
        if (predicate && !predicate(feature)) return;
        const d = turf.distance(point, turf.point(feature.geometry.coordinates), { units: "kilometers" });
        if (!best || d < best.distanceKm) best = { feature, distanceKm: d };
    });
    return best;
}

function nearestLineFeature(point, features) {
    let best = null;
    (features || []).forEach(feature => {
        if (!feature || !feature.geometry || feature.geometry.type !== "LineString") return;
        try {
            const snapped = turf.nearestPointOnLine(feature, point, { units: "kilometers" });
            const d = Number(snapped.properties && snapped.properties.dist);
            if (Number.isFinite(d) && (!best || d < best.distanceKm)) best = { feature, distanceKm: d };
        } catch (err) {
            // Ignore malformed line fragments.
        }
    });
    return best;
}

function formatKm(value) {
    if (!Number.isFinite(value)) return "n/a";
    if (value < 1) return `${Math.round(value * 1000)} m`;
    return `${value.toFixed(1)} km`;
}

function formatCapacity(feature) {
    const p = feature?.properties || {};
    const capacity = Number(siteIntelPick(p, ["capacity", "capacity_mw", "Capacity (MW)"], NaN));
    return Number.isFinite(capacity) && capacity > 0 ? `${capacity.toFixed(capacity >= 100 ? 0 : 1)} MW` : "n/a";
}

function assetName(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["name", "project", "site", "Site Name", "Project Name"], "Operating asset");
}

function substationName(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["name_clean", "name", "Name", "site_name", "Site Name", "substation", "Substation"], "Substation");
}

function substationVoltage(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV", "Voltage kV"], "Unknown");
}

function siteIntelRow(label, main, meta, danger = false) {
    return `<div class="site-intel-row${danger ? " warn" : ""}">
        <div class="site-intel-label">${siteIntelEscape(label)}</div>
        <div class="site-intel-main">${siteIntelEscape(main)}</div>
        <div class="site-intel-meta">${siteIntelEscape(meta)}</div>
    </div>`;
}

function siteIntelOpportunityNotes(results) {
    const notes = [];
    const hvDistances = [results.grid["132 kV"], results.grid["275 kV"], results.grid["400 kV"]]
        .filter(Boolean)
        .map(item => item.distanceKm);
    const minHv = hvDistances.length ? Math.min(...hvDistances) : NaN;
    const nearestSolar = results.assets.solar?.distanceKm;
    const nearestBess = results.assets.bess?.distanceKm;

    if (Number.isFinite(minHv) && minHv <= 5) notes.push("Near high voltage corridor. Worth deeper grid screening.");
    if (Number.isFinite(minHv) && minHv > 15) notes.push("High voltage corridor not immediately nearby. Route and connection assumptions need care.");
    if (Number.isFinite(nearestSolar) && nearestSolar <= 10) notes.push("Existing operating solar nearby. Compare pattern, grid route and project scale.");
    if (Number.isFinite(nearestBess) && nearestBess <= 15) notes.push("Operating battery storage nearby. Check co location or grid constraint context.");
    if (!notes.length) notes.push("Use as early spatial screening only. Formal grid and design studies still required.");
    return notes;
}

async function inspectSiteIntelligenceAt(lngLat) {
    if (!lngLat || typeof turf === "undefined") return;
    showSiteIntelPanel(`<div class="site-intel-loading">Loading site intelligence…</div>`);
    await loadSiteIntelData();
    if (!siteIntelData.ready) return;

    const point = turf.point([lngLat.lng, lngLat.lat]);
    const results = {
        assets: {
            solar: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Solar PV"),
            bess: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Battery Storage"),
            onshore: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Onshore Wind"),
            offshore: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Offshore Wind")
        },
        substation: nearestPointFeature(point, siteIntelData.substations),
        grid: {}
    };

    Object.keys(siteIntelData.grid).forEach(key => {
        results.grid[key] = nearestLineFeature(point, siteIntelData.grid[key]);
    });

    const rows = [];
    rows.push(siteIntelRow("Clicked location", `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`, "Reference point only"));

    const addAssetRow = (label, item) => {
        if (!item) rows.push(siteIntelRow(label, "No data", "Layer data unavailable", true));
        else rows.push(siteIntelRow(label, assetName(item.feature), `${formatKm(item.distanceKm)} · ${formatCapacity(item.feature)}`));
    };

    addAssetRow("Nearest solar", results.assets.solar);
    addAssetRow("Nearest BESS", results.assets.bess);
    addAssetRow("Nearest onshore wind", results.assets.onshore);
    addAssetRow("Nearest offshore wind", results.assets.offshore);

    if (results.substation) {
        rows.push(siteIntelRow("Nearest substation", substationName(results.substation.feature), `${formatKm(results.substation.distanceKm)} · ${substationVoltage(results.substation.feature)}`));
    } else {
        rows.push(siteIntelRow("Nearest substation", "No data", "Substation data unavailable", true));
    }

    ["66 kV", "132 kV", "275 kV", "400 kV"].forEach(key => {
        const item = results.grid[key];
        rows.push(siteIntelRow(`Nearest ${key}`, item ? formatKm(item.distanceKm) : "No data", "Atlas V8 corridor reference", !item));
    });

    const notes = siteIntelOpportunityNotes(results).map(note => `<li>${siteIntelEscape(note)}</li>`).join("");

    showSiteIntelPanel(`
        <div class="site-intel-section-title">Nearest infrastructure context</div>
        ${rows.join("")}
        <div class="site-intel-section-title">Screening notes</div>
        <ul class="site-intel-notes">${notes}</ul>
        <div class="site-intel-disclaimer">Indicative spatial screening only. Distances do not confirm capacity, rights, routes, consent or connection feasibility.</div>
    `);
}

function wireSiteIntelligencePanel() {
    $("site_intel_close")?.addEventListener("click", hideSiteIntelPanel);
    if (!map) return;
    map.on("click", e => {
        const target = e.originalEvent && e.originalEvent.target;
        if (target && target.closest && target.closest(".map-controls, .map-tool-overlay, .legend, .gis-map-search, .site-intel-panel")) return;
        inspectSiteIntelligenceAt(e.lngLat);
    });
}

// ============================================================
// ARRAY VISIBILITY AND TARGET MWp SIZING
// ============================================================
const TOPOLOGY_LAYER_IDS_FOR_ARRAY_TOGGLE = [
    "overall_boundary_fill",
    "overall_boundary_line",
    "footprints",
    "footprints_outline",
    "export_cable",
    "radial_spine",
    "export_cable_pins",
    "inverters",
    "substation"
];

function setTopologyLayerVisibility(visible) {
    if (!map) return;
    TOPOLOGY_LAYER_IDS_FOR_ARRAY_TOGGLE.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
    });
}

function updateArrayToggleButton() {
    const btn = $("btn_array_toggle");
    if (!btn) return;
    const visible = state.arrayVisible !== false;
    btn.textContent = visible ? "ARRAY ON" : "ARRAY OFF";
    btn.classList.toggle("active", visible);
}

function toggleArrayVisibility() {
    state.arrayVisible = state.arrayVisible === false;
    setTopologyLayerVisibility(state.arrayVisible !== false);
    updateArrayToggleButton();
}

function syncMapSizeInputFromActiveTab() {
    const mapInput = $("map_target_dc_mwp");
    if (!mapInput) return;
    const source = state.activeTab === "string" ? $("target_dc_mwp") : $("target_dc_mwp_c");
    mapInput.value = source?.value || "";
}

function setMapSizeStatus(text, ok = true) {
    const el = $("map_size_status");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#00ff88" : "#ff9900";
}

function setInputValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyTargetDcMwpFromActiveTab(source) {
    const suffix = state.activeTab === "string" ? "" : "_c";
    const targetInput = state.activeTab === "string" ? $("target_dc_mwp") : $("target_dc_mwp_c");
    const mapInput = $("map_target_dc_mwp");
    const raw = source === "map" ? parseFloat(mapInput?.value) : parseFloat(targetInput?.value);
    const targetMwp = Number.isFinite(raw) && raw > 0 ? raw : 0;

    if (!targetMwp) {
        setMapSizeStatus("Enter MWp DC", false);
        return;
    }

    if (state.activeTab === "string") {
        const modWp = num("mod_wp");
        const x = intVal("x_mods");
        const z = intVal("z_strings");
        const y = intVal("y_invs");
        const currentSkidsPerRing = Math.max(1, intVal("s_subs", 1));
        if (modWp <= 0 || x <= 0 || z <= 0 || y <= 0) {
            setMapSizeStatus("Check string inputs", false);
            return;
        }
        const dcPerSkidMwp = (modWp * x * z * y) / 1_000_000;
        const desiredSkids = Math.max(1, Math.ceil(targetMwp / dcPerSkidMwp));
        const rings = Math.max(1, Math.ceil(desiredSkids / currentSkidsPerRing));
        const skidsPerRing = Math.max(1, Math.ceil(desiredSkids / rings));
        const actualSkids = skidsPerRing * rings;
        const actualMwp = actualSkids * dcPerSkidMwp;

        setInputValue("s_subs", skidsPerRing);
        setInputValue("b_cols", rings);
        if (targetInput) targetInput.value = targetMwp;
        if (mapInput) mapInput.value = targetMwp;
        setMapSizeStatus(`String ${actualMwp.toFixed(1)} MWp via ${actualSkids} skids`, true);
    } else {
        const invDcMwp = getCentralInverterDcMwdc();
        const invPerSkid = Math.max(1, intVal("inv_per_mv_c", 1));
        const currentSkidsPerRing = Math.max(1, intVal("mv_per_ring_c", 1));
        if (invDcMwp <= 0 || invPerSkid <= 0) {
            setMapSizeStatus("Check central inputs", false);
            return;
        }
        const desiredInverters = Math.max(1, Math.ceil(targetMwp / invDcMwp));
        const desiredSkids = Math.max(1, Math.ceil(desiredInverters / invPerSkid));
        const rings = Math.max(1, Math.ceil(desiredSkids / currentSkidsPerRing));
        const skidsPerRing = Math.max(1, Math.ceil(desiredSkids / rings));
        const actualInverters = invPerSkid * skidsPerRing * rings;
        const actualMwp = actualInverters * invDcMwp;

        setInputValue("mv_per_ring_c", skidsPerRing);
        setInputValue("rings_c", rings);
        if (targetInput) targetInput.value = targetMwp;
        if (mapInput) mapInput.value = targetMwp;
        setMapSizeStatus(`Central ${actualMwp.toFixed(1)} MWp via ${actualInverters} inverter blocks`, true);
    }

    state.arrayOverrideCenter = null;
    state.suppressNextMapFit = true;
    redrawIfTopologyExists();
    setTopologyLayerVisibility(state.arrayVisible !== false);
    updateArrayToggleButton();
}

function wireArraySizingControls() {
    $("btn_array_toggle")?.addEventListener("click", toggleArrayVisibility);
    $("btn_map_apply_size")?.addEventListener("click", () => applyTargetDcMwpFromActiveTab("map"));
    $("map_target_dc_mwp")?.addEventListener("keydown", e => {
        if (e.key === "Enter") applyTargetDcMwpFromActiveTab("map");
    });
    $("target_dc_mwp")?.addEventListener("change", () => applyTargetDcMwpFromActiveTab("panel"));
    $("target_dc_mwp_c")?.addEventListener("change", () => applyTargetDcMwpFromActiveTab("panel"));
    updateArrayToggleButton();
    syncMapSizeInputFromActiveTab();
}

// ============================================================
// BASEMAP / SUBS TOGGLES
// ============================================================
function toggleBasemap() {
    if (!map || !map.getLayer("l-sat")) return;
    state.satActive = !state.satActive;
    map.setLayoutProperty("l-sat", "visibility", state.satActive ? "visible" : "none");
    const btn = $("btn_basemap");
    if (btn) {
        btn.textContent = state.satActive ? "DARK MATTER VIEW" : "SATELLITE VIEW";
        btn.classList.toggle("active", state.satActive);
    }
}

function toggleSubs() {
    if (!map || !map.getLayer("l-subs")) return;
    state.subsVisible = !state.subsVisible;
    map.setLayoutProperty("l-subs", "visibility", state.subsVisible ? "visible" : "none");
    const btn = $("btn_subs_toggle");
    if (btn) {
        btn.textContent = state.subsVisible ? "SUBS ON" : "SUBS OFF";
        btn.classList.toggle("active", state.subsVisible);
    }
}

function updateAtlasV8GridToggleButtons() {
    const labels = { "66kv": "66 kV", "132kv": "132 kV", "275kv": "275 kV", "400kv": "400 kV" };
    Object.keys(labels).forEach(voltageKey => {
        const btn = $(`btn_atlas_${voltageKey}`);
        if (!btn) return;
        const visible = atlasV8GridLayerVisibility?.[voltageKey] !== false;
        btn.textContent = `${labels[voltageKey]} ${visible ? "ON" : "OFF"}`;
        btn.classList.toggle("active", visible);
    });
}


function readAssetFilterCapacityValue(id) {
    const el = $(id);
    if (!el || String(el.value || "").trim() === "") return null;
    const value = Number(el.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateAtlasV8OperatingAssetDropdown() {
    const select = $("asset_layer_select");
    if (select) select.value = atlasV8AssetFilterState?.selected || "off";
    const statusSelect = $("asset_status_select");
    if (statusSelect) statusSelect.value = atlasV8AssetFilterState?.status || "all";
    const minInput = $("asset_min_mw");
    const maxInput = $("asset_max_mw");
    if (minInput && Number.isFinite(atlasV8AssetFilterState?.minMw)) minInput.value = atlasV8AssetFilterState.minMw;
    if (maxInput && Number.isFinite(atlasV8AssetFilterState?.maxMw)) maxInput.value = atlasV8AssetFilterState.maxMw;
}

function applyAssetDropdownFromControls() {
    const selected = $("asset_layer_select")?.value || "off";
    const status = $("asset_status_select")?.value || "all";
    let minMw = readAssetFilterCapacityValue("asset_min_mw");
    let maxMw = readAssetFilterCapacityValue("asset_max_mw");
    if (Number.isFinite(minMw) && Number.isFinite(maxMw) && minMw > maxMw) {
        const temp = minMw;
        minMw = maxMw;
        maxMw = temp;
        if ($("asset_min_mw")) $("asset_min_mw").value = minMw;
        if ($("asset_max_mw")) $("asset_max_mw").value = maxMw;
    }
    applyAtlasV8AssetDropdownFilter?.(selected, status, minMw, maxMw);
    updateAtlasV8OperatingAssetDropdown();
}

function wireAtlasV8PipelineDropdownWithStatus() {
    $("asset_layer_select")?.addEventListener("change", applyAssetDropdownFromControls);
    $("asset_status_select")?.addEventListener("change", applyAssetDropdownFromControls);
    $("btn_asset_filter_apply")?.addEventListener("click", applyAssetDropdownFromControls);
    ["asset_min_mw", "asset_max_mw"].forEach(id => {
        $(id)?.addEventListener("keydown", e => {
            if (e.key === "Enter") applyAssetDropdownFromControls();
        });
        $(id)?.addEventListener("change", applyAssetDropdownFromControls);
    });
    updateAtlasV8OperatingAssetDropdown();
}

function updateAtlasV8OperatingAssetToggleButtons() {
    const labels = {
        "solar_operational": "SOLAR OP",
        "wind_onshore_operational": "ONSHORE WIND",
        "wind_offshore_operational": "OFFSHORE WIND",
        "bess_operational": "BESS OP"
    };
    Object.keys(labels).forEach(assetKey => {
        const btn = $(`btn_asset_${assetKey}`);
        if (!btn) return;
        const visible = atlasV8OperatingAssetVisibility?.[assetKey] === true;
        btn.textContent = `${labels[assetKey]} ${visible ? "ON" : "OFF"}`;
        btn.classList.toggle("active", visible);
    });
}

function wireAtlasV8OperatingAssetToggleButtons() {
    document.querySelectorAll(".asset-layer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleAtlasV8OperatingAssetLayer(btn.dataset.assetLayer);
            updateAtlasV8OperatingAssetToggleButtons();
        });
    });
    updateAtlasV8OperatingAssetToggleButtons();
}

function wireAtlasV8GridToggleButtons() {
    document.querySelectorAll(".atlas-voltage-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleAtlasV8GridLayer(btn.dataset.atlasVoltage);
            updateAtlasV8GridToggleButtons();
        });
    });
    updateAtlasV8GridToggleButtons();
}
function toggleMapExpand() {
    const panel = document.querySelector(".panel-right");
    const btn = $("btn_map_expand");
    if (!panel) return;
    const active = !panel.classList.contains("map-expanded");
    panel.classList.toggle("map-expanded", active);
    document.body.classList.toggle("map-expanded", active);
    if (btn) {
        btn.textContent = active ? "MAP MIN" : "MAP MAX";
        btn.classList.toggle("active", active);
    }
    setTimeout(() => { if (map && typeof map.resize === "function") map.resize(); }, 150);
}

function toggleKeyCollapse() {
    const legend = $("map_legend");
    const btn = $("btn_key_toggle");
    if (!legend) return;
    const hidden = !legend.classList.contains("key-collapsed");
    legend.classList.toggle("key-collapsed", hidden);
    if (btn) {
        btn.textContent = hidden ? "KEY OFF" : "KEY ON";
        btn.classList.toggle("active", !hidden);
    }
}
function toggleMapToolsOverlay() {
    const overlay = $("map_tool_overlay");
    const btn = $("btn_map_tools_toggle");
    if (!overlay || !btn) return;
    const collapsed = !overlay.classList.contains("tools-collapsed");
    overlay.classList.toggle("tools-collapsed", collapsed);
    btn.textContent = collapsed ? "TOOLS OFF" : "TOOLS ON";
    btn.classList.toggle("active", !collapsed);
}

function wireMapToolOverlayButtons() {
    $("btn_map_tools_toggle")?.addEventListener("click", toggleMapToolsOverlay);
    $("btn_map_draw")?.addEventListener("click", triggerDrawAtCenter);
    $("btn_map_pick_array")?.addEventListener("click", toggleArrayMoveMode);
    $("btn_map_drop_pins")?.addEventListener("click", toggleCablePinMode);
    $("btn_map_draw_route")?.addEventListener("click", commitCablePinRoute);
    $("btn_map_rotate_left")?.addEventListener("click", () => rotateArrayBy(-30));
    $("btn_map_rotate_right")?.addEventListener("click", () => rotateArrayBy(30));
    $("btn_map_rotate_90")?.addEventListener("click", () => rotateArrayBy(90));
    $("btn_map_reset_rotation")?.addEventListener("click", resetArrayRotation);
    $("btn_map_reset_array")?.addEventListener("click", resetArrayLocation);
    $("btn_map_nudge_up")?.addEventListener("click", () => nudgeArray(0));
    $("btn_map_nudge_right")?.addEventListener("click", () => nudgeArray(90));
    $("btn_map_nudge_down")?.addEventListener("click", () => nudgeArray(180));
    $("btn_map_nudge_left")?.addEventListener("click", () => nudgeArray(270));
    $("btn_map_undo_pin")?.addEventListener("click", undoCablePin);
    $("btn_map_clear_route")?.addEventListener("click", clearCableRoute);
}
// ============================================================
// WIRE EVERYTHING UP
// ============================================================
function wireEvents() {
    injectExportCableLengthControl();

    // Tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Map toggles
    $("btn_basemap")?.addEventListener("click", toggleBasemap);
    $("btn_subs_toggle")?.addEventListener("click", toggleSubs);
wireAtlasV8GridToggleButtons();
wireAtlasV8PipelineDropdownWithStatus();
$("btn_map_expand")?.addEventListener("click", toggleMapExpand);
$("btn_key_toggle")?.addEventListener("click", toggleKeyCollapse);
$("btn_print_report")?.addEventListener("click", () => window.print());
wireMapToolOverlayButtons();
wireArraySizingControls();
wireGisMapSearch();
wireSiteIntelligencePanel();




    // Draw / Export
    $("btn_draw")?.addEventListener("click", triggerDrawAtCenter);
    $("btn_export")?.addEventListener("click", exportGeoJSON);

    // Array rotation
    $("btn_rotate_left_30")?.addEventListener("click", () => rotateArrayBy(-30));
    $("btn_rotate_right_30")?.addEventListener("click", () => rotateArrayBy(30));
    $("btn_rotate_right_90")?.addEventListener("click", () => rotateArrayBy(90));
    $("btn_reset_rotation")?.addEventListener("click", resetArrayRotation);

    // Array movement
    $("btn_pick_array")?.addEventListener("click", toggleArrayMoveMode);
    $("btn_reset_array_move")?.addEventListener("click", resetArrayLocation);
    $("btn_nudge_up")?.addEventListener("click", () => nudgeArray(0));
    $("btn_nudge_right")?.addEventListener("click", () => nudgeArray(90));
    $("btn_nudge_down")?.addEventListener("click", () => nudgeArray(180));
    $("btn_nudge_left")?.addEventListener("click", () => nudgeArray(270));

    // Cable route pins
    $("btn_drop_cable_pins")?.addEventListener("click", toggleCablePinMode);
    $("btn_draw_cable_route")?.addEventListener("click", commitCablePinRoute);
    $("btn_undo_cable_pin")?.addEventListener("click", undoCablePin);
    $("btn_clear_cable_route")?.addEventListener("click", clearCableRoute);

    // Search
    $("btn_search")?.addEventListener("click", searchLocation);
    $("loc_search")?.addEventListener("keydown", (e) => { if (e.key === "Enter") searchLocation(); });

    // Logistics presets
    document.querySelectorAll("[data-suffix]").forEach(sel => {
        sel.addEventListener("change", () => applyLogisticsPreset(sel.value, sel.dataset.suffix));
    });

    // Bifacial auto-fill

// Development stage defaults
document.querySelectorAll("[data-dev-stage-prefix]").forEach(sel => {
    sel.addEventListener("change", () => {
        applyDevelopmentStageDefaults(sel.dataset.devStagePrefix);
        recalcAll();
    });
});
    $("mounting_type")?.addEventListener("change", (e) => autoFillBifacial(e.target.value, "fin_string_bifacial"));
    $("mounting_type_c")?.addEventListener("change", (e) => autoFillBifacial(e.target.value, "fin_central_bifacial"));

    // Safe export cable length adjustment
    $("layout_export_extra_km")?.addEventListener("input", () => {
        state.arrayOverrideCenter = null;
        clearRouteAfterArrayShift();
        redrawIfTopologyExists();
    });
    $("layout_export_extra_km")?.addEventListener("change", () => {
        state.arrayOverrideCenter = null;
        clearRouteAfterArrayShift();
        redrawIfTopologyExists();
    });

    // Global recalc on input changes (debounced)
    document.querySelectorAll("input, select").forEach(el => {
        el.addEventListener("input", recalcDebounced);
        el.addEventListener("change", recalcDebounced);
    });
}

function wireMapMoveEvents() {
    if (!map || map.__arrayMoveWired) return;
    map.__arrayMoveWired = true;
    map.on("click", (e) => {
        if (state.cableRoutePinMode) addCableRoutePin(e);
        else placeArrayAtMapPoint(e);
    });
}

// ============================================================
// BOOT
// ============================================================
function boot() {
    wireEvents();
    initMap();
    if (map) map.on("load", wireMapMoveEvents);
    wireMapMoveEvents();
    updateSelectedSubstationDisplay();
    renderBenchmark();
    setArrayMoveStatus("Draw a grid first. Then use Pick Up Array or nudge arrows to relocate the array centre.", false);
    updateExportCableLengthDisplay();
    updateArrayRotationDisplay();
    updateCableRouteStatus();
}

// Libraries loaded via defer, so DOMContentLoaded is the right signal.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}

// GLOBALGRID2050 GIS SLD PRINT MAP PACK
function sleepForPrintPack(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setLayerVisibilityForPrintPack(layerId, visible) {
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function setAtlasLayersDefaultOff() {
    if (typeof atlasV8GridLayerVisibility === "undefined") return;
    Object.keys(atlasV8GridLayerVisibility).forEach(voltageKey => {
        atlasV8GridLayerVisibility[voltageKey] = false;
        const layerId = atlasV8GridLayerIds?.[voltageKey];
        if (layerId) setLayerVisibilityForPrintPack(layerId, false);
    });
    updateAtlasV8GridToggleButtons?.();
    updateLegend?.();
}

function setSubsDefaultOff() {
    if (typeof state === "undefined") return;
    state.subsVisible = false;
    setLayerVisibilityForPrintPack("l-subs", false);
    updateSubsToggleButton?.();
    updateLegend?.();
}

function enforceCleanDefaultMapLayers() {
    setAtlasLayersDefaultOff();
    setSubsDefaultOff();
}

function getMapPrintState() {
    if (!map) return null;
    return {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        satActive: !!state.satActive,
        subsVisible: !!state.subsVisible,
        atlas: typeof atlasV8GridLayerVisibility !== "undefined" ? { ...atlasV8GridLayerVisibility } : {},
        keyCollapsed: $("map_legend")?.classList.contains("key-collapsed") || false,
        toolsCollapsed: $("map_tool_overlay")?.classList.contains("tools-collapsed") || false,
        mapExpanded: document.body.classList.contains("map-expanded")
    };
}

async function restoreMapPrintState(saved) {
    if (!map || !saved) return;

    if (typeof state !== "undefined") {
        state.satActive = saved.satActive;
        state.subsVisible = saved.subsVisible;
    }

    setLayerVisibilityForPrintPack("l-sat", saved.satActive);
    setLayerVisibilityForPrintPack("l-subs", saved.subsVisible);

    if (typeof atlasV8GridLayerVisibility !== "undefined") {
        Object.keys(saved.atlas || {}).forEach(voltageKey => {
            atlasV8GridLayerVisibility[voltageKey] = saved.atlas[voltageKey];
            const layerId = atlasV8GridLayerIds?.[voltageKey];
            if (layerId) setLayerVisibilityForPrintPack(layerId, saved.atlas[voltageKey]);
        });
    }

    const legend = $("map_legend");
    if (legend) legend.classList.toggle("key-collapsed", saved.keyCollapsed);
    const keyBtn = $("btn_key_toggle");
    if (keyBtn) {
        keyBtn.textContent = saved.keyCollapsed ? "KEY OFF" : "KEY ON";
        keyBtn.classList.toggle("active", !saved.keyCollapsed);
    }

    const overlay = $("map_tool_overlay");
    if (overlay) overlay.classList.toggle("tools-collapsed", saved.toolsCollapsed);
    const toolsBtn = $("btn_map_tools_toggle");
    if (toolsBtn) {
        toolsBtn.textContent = saved.toolsCollapsed ? "TOOLS OFF" : "TOOLS ON";
        toolsBtn.classList.toggle("active", !saved.toolsCollapsed);
    }

    document.body.classList.toggle("map-expanded", saved.mapExpanded);
    document.querySelector(".panel-right")?.classList.toggle("map-expanded", saved.mapExpanded);

    map.jumpTo({ center: saved.center, zoom: saved.zoom, bearing: saved.bearing, pitch: saved.pitch });
    updateSubsToggleButton?.();
    updateAtlasV8GridToggleButtons?.();
    updateLegend?.();
    map.resize();
    await sleepForPrintPack(350);
}

function ensurePrintMapPackContainer() {
    let pack = document.getElementById("print_map_pack");
    if (!pack) {
        pack = document.createElement("section");
        pack.id = "print_map_pack";
        pack.className = "print-map-pack";
        document.body.appendChild(pack);
    }
    pack.innerHTML = "";
    return pack;
}

function addPrintMapFigure(pack, title, dataUrl, note, landscape = false) {
    const page = document.createElement("section");
    page.className = landscape ? "print-map-page print-map-page-landscape" : "print-map-page";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = title;

    const caption = document.createElement("p");
    caption.textContent = note || "Map figure generated from current GIS SLD sandbox view. Indicative only.";

    page.appendChild(heading);
    page.appendChild(img);
    page.appendChild(caption);
    pack.appendChild(page);
}

async function captureCurrentMapForPrint() {
    if (!map) return "";
    map.resize();
    await sleepForPrintPack(650);
    return map.getCanvas().toDataURL("image/png");
}

function getTopologyBoundsForPrintPack() {
    if (typeof turf === "undefined" || !state?.currentGeoJSON?.features?.length) return null;
    try {
        const bbox = turf.bbox(state.currentGeoJSON);
        if (!bbox || bbox.length !== 4 || bbox.some(v => !Number.isFinite(v))) return null;
        return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    } catch (err) {
        console.warn("Print pack bbox failed", err);
        return null;
    }
}

async function fitContextMapForPrint() {
    const bounds = getTopologyBoundsForPrintPack();
    if (bounds) {
        map.fitBounds(bounds, { padding: 90, duration: 0, maxZoom: 12 });
    } else {
        const currentZoom = map.getZoom();
        map.setZoom(Math.max(currentZoom - 4, 7));
    }
    await sleepForPrintPack(750);
}

async function setSatelliteForPrintPack(active) {
    if (!map) return;
    if (typeof state !== "undefined") state.satActive = !!active;
    setLayerVisibilityForPrintPack("l-sat", !!active);
    const btn = $("btn_basemap");
    if (btn) {
        btn.textContent = active ? "DARK MATTER VIEW" : "SATELLITE VIEW";
        btn.classList.toggle("active", !!active);
    }
    await sleepForPrintPack(500);
}

async function prepareGisSldPrintReport() {
    if (!map) {
        window.print();
        return;
    }

    const btn = $("btn_print_report");
    const oldText = btn ? btn.textContent : "";
    if (btn) btn.textContent = "PREPARING";

    const saved = getMapPrintState();
    const pack = ensurePrintMapPackContainer();

    try {
        document.body.classList.add("preparing-print-pack");
        document.body.classList.remove("map-expanded");
        document.querySelector(".panel-right")?.classList.remove("map-expanded");
        $("map_tool_overlay")?.classList.add("tools-collapsed");
        $("map_legend")?.classList.add("key-collapsed");

        // Page 1 map: current working view, but clean with user selected layers retained.
        map.resize();
        await sleepForPrintPack(600);
        const currentMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 1: Current Project View", currentMap, "Current GIS SLD project view. Interactive controls are removed from print output.");

        // Page 2 map: zoomed out context. Keep current basemap and layer settings.
        await fitContextMapForPrint();
        const contextMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 2: Wider Grid And Route Context", contextMap, "Zoomed out context view showing wider relationship between project, route assumptions and grid geography.");

        // Page 3 map: satellite view, clean and full page.
        await setSatelliteForPrintPack(true);
        await fitContextMapForPrint();
        const satelliteMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 3: Satellite Context View", satelliteMap, "Satellite context view for visual land, route and surrounding area review. Indicative only.", true);

        await restoreMapPrintState(saved);
        document.body.classList.remove("preparing-print-pack");
        if (btn) btn.textContent = oldText || "PRINT";
        window.print();
    } catch (err) {
        console.error("GIS SLD print pack failed", err);
        await restoreMapPrintState(saved);
        document.body.classList.remove("preparing-print-pack");
        if (btn) btn.textContent = oldText || "PRINT";
        window.print();
    }
}

// Clean map defaults after the map and controls have loaded.
// setTimeout(enforceCleanDefaultMapLayers, 1200); // disabled by simple safe print fix


// --- V8 BESS geospatial drawing layer built on working V7 GIS frame ---
window.v8BessGeoJson = { type: 'FeatureCollection', features: [] };

function v8n(id, fallback = 0) {
    const el = document.getElementById(id);
    const value = parseFloat(el ? el.value : fallback);
    return Number.isFinite(value) ? value : fallback;
}

function v8s(id, fallback = '') {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
}

function v8Set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function v8Fmt(value, digits = 2) {
    return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0';
}

function v8BessCalc() {
    const exportMw = v8n('bess_export_mw', 50);
    const duration = v8n('bess_duration_h', 3);
    const energy = v8n('bess_energy_mwh', exportMw * duration);
    const containerMwh = Math.max(0.1, v8n('bess_container_mwh', 5));
    const pcsMw = Math.max(0.1, v8n('bess_pcs_mw', 50));
    const containersPerPcs = Math.max(1, Math.round(v8n('bess_containers_per_pcs', 30)));
    const containers = Math.max(1, Math.ceil(energy / containerMwh));
    const pcsByPower = Math.max(1, Math.ceil(exportMw / pcsMw));
    const pcsByContainers = Math.max(1, Math.ceil(containers / containersPerPcs));
    const pcsCount = Math.max(pcsByPower, pcsByContainers);
    const totalPcsMw = pcsCount * pcsMw;
    const containersPerRow = Math.max(1, Math.round(v8n('bess_containers_per_row', 10)));
    const rows = Math.max(1, Math.ceil(containers / containersPerRow));
    const lengthM = Math.max(1, v8n('bess_container_l', 12.2));
    const widthM = Math.max(1, v8n('bess_container_w', 2.44));
    const gapM = Math.max(0, v8n('bess_container_gap', 2.5));
    const rowGapM = Math.max(0, v8n('bess_row_gap', 6));
    const fieldLength = containersPerRow * lengthM + Math.max(0, containersPerRow - 1) * gapM;
    const fieldWidth = rows * widthM + Math.max(0, rows - 1) * rowGapM;
    return { exportMw, duration, energy, containerMwh, pcsMw, containersPerPcs, containers, pcsCount, totalPcsMw, containersPerRow, rows, lengthM, widthM, gapM, rowGapM, fieldLength, fieldWidth, layoutMode: v8s('bess_layout_mode', 'integrated'), accessRoadM: v8n('bess_access_road_m', 6), rotation: v8n('bess_rotation_deg', 0) };
}

function v8UpdateBessSummary() {
    const c = v8BessCalc();
    v8Set('bess_out_containers', String(c.containers));
    v8Set('bess_out_pcs', String(c.pcsCount));
    v8Set('bess_out_pcs_power', v8Fmt(c.totalPcsMw, 1) + ' MW');
    v8Set('bess_out_field', v8Fmt(c.fieldLength, 1) + ' m x ' + v8Fmt(c.fieldWidth, 1) + ' m');
    v8Set('bess_out_export', v8Fmt(c.exportMw, 1) + ' MW');
    v8Set('bess_out_duration', c.exportMw > 0 ? v8Fmt(c.energy / c.exportMw, 2) + ' h' : '0 h');
}

function v8MetresToLngLat(origin, eastM, northM) {
    const lat = origin.lat;
    const lng = origin.lng;
    return [lng + eastM / (111320 * Math.cos(lat * Math.PI / 180)), lat + northM / 111320];
}

function v8Rotate(x, y, deg) {
    const rad = deg * Math.PI / 180;
    return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)];
}

function v8RectFeature(origin, cx, cy, w, h, rotation, props) {
    const coords = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([x,y]) => {
        const [rx, ry] = v8Rotate(cx + x, cy + y, rotation);
        return v8MetresToLngLat(origin, rx, ry);
    });
    return { type:'Feature', properties:props, geometry:{ type:'Polygon', coordinates:[coords] } };
}

function v8PointFeature(origin, x, y, rotation, props) {
    const [rx, ry] = v8Rotate(x, y, rotation);
    return { type:'Feature', properties:props, geometry:{ type:'Point', coordinates:v8MetresToLngLat(origin, rx, ry) } };
}

function v8LineFeature(origin, points, rotation, props) {
    return { type:'Feature', properties:props, geometry:{ type:'LineString', coordinates:points.map(([x,y]) => { const [rx, ry] = v8Rotate(x, y, rotation); return v8MetresToLngLat(origin, rx, ry); }) } };
}

function v8BuildBessGeoJson(origin) {
    const c = v8BessCalc();
    const features = [];
    const cols = Math.max(1, Math.min(c.containersPerRow, 30));
    const rows = Math.max(1, Math.ceil(c.containers / cols));
    const pitchX = c.lengthM + c.gapM;
    const pitchY = c.widthM + c.rowGapM;
    const fieldW = cols * c.lengthM + Math.max(0, cols - 1) * c.gapM;
    const fieldH = rows * c.widthM + Math.max(0, rows - 1) * c.rowGapM;
    const startX = -fieldW / 2 + c.lengthM / 2;
    const startY = fieldH / 2 - c.widthM / 2;
    const pad = Math.max(25, c.accessRoadM * 3);
    const electricalX = fieldW / 2 + 55;
    const roadY = -fieldH / 2 - Math.max(18, c.accessRoadM);

    features.push(v8RectFeature(origin, 0, 0, fieldW + pad * 2 + 220, fieldH + pad * 2 + 120, c.rotation, { role:'compound_boundary', label:'BESS compound boundary', layout_mode:c.layoutMode }));
    features.push(v8RectFeature(origin, 0, roadY, fieldW + pad * 2 + 160, Math.max(6, c.accessRoadM), c.rotation, { role:'access_road', label:'Access road and maintenance corridor' }));

    for (let i = 0; i < c.containers; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        features.push(v8RectFeature(origin, startX + col * pitchX, startY - row * pitchY, c.lengthM, c.widthM, c.rotation, { role:'bess_container', label:'BESS container ' + (i + 1), container_mwh:c.containerMwh }));
    }

    const pcsShown = Math.min(c.pcsCount, 40);
    for (let i = 0; i < pcsShown; i++) {
        let x = electricalX;
        let y = fieldH / 2 - i * 16;
        if (c.layoutMode === 'distributed') { x = startX + (i % cols) * pitchX; y = fieldH / 2 + 26 + Math.floor(i / Math.max(1, cols)) * 16; }
        if (c.layoutMode === 'corridor') { x = 0; y = roadY - 25 - i * 15; }
        if (c.layoutMode === 'central') { x = electricalX; y = 0; }
        features.push(v8RectFeature(origin, x, y, c.layoutMode === 'integrated' ? 22 : 14, 10, c.rotation, { role:c.layoutMode === 'integrated' ? 'integrated_pcs_transformer' : 'pcs_block', label:c.layoutMode === 'integrated' ? 'Integrated PCS transformer ' + (i + 1) : 'PCS block ' + (i + 1), pcs_mw:c.pcsMw }));
    }

    if (c.layoutMode !== 'integrated') features.push(v8RectFeature(origin, electricalX + 42, 0, 28, 18, c.rotation, { role:'external_transformer', label:'External transformer zone' }));
    if (c.layoutMode === 'hv_compound') features.push(v8RectFeature(origin, electricalX + 88, -36, 58, 38, c.rotation, { role:'hv_compound_placeholder', label:'Future HV compound placeholder' }));
    features.push(v8PointFeature(origin, electricalX + 120, roadY - 50, c.rotation, { role:'grid_export_point', label:'Grid export point', export_mw:c.exportMw }));
    features.push(v8LineFeature(origin, [[fieldW / 2, 0], [electricalX - 10, 0]], c.rotation, { role:'dc_collection_path', label:'Indicative DC collection path, not cable sizing' }));
    return { type:'FeatureCollection', features };
}

function v8EnsureBessGeoLayers() {
    if (!window.map) return;
    if (!map.getSource('v8-bess-layout')) map.addSource('v8-bess-layout', { type:'geojson', data:window.v8BessGeoJson });
    const layers = [
        ['v8-bess-boundary', ['==',['get','role'],'compound_boundary'], 'rgba(43,124,255,0.08)', 'rgba(43,124,255,0.75)'],
        ['v8-bess-containers', ['==',['get','role'],'bess_container'], 'rgba(0,255,136,0.38)', 'rgba(0,255,136,0.95)'],
        ['v8-bess-pcs', ['any',['==',['get','role'],'pcs_block'],['==',['get','role'],'integrated_pcs_transformer']], 'rgba(0,255,255,0.38)', 'rgba(0,255,255,0.95)'],
        ['v8-bess-transformer', ['any',['==',['get','role'],'external_transformer'],['==',['get','role'],'hv_compound_placeholder']], 'rgba(255,153,0,0.38)', 'rgba(255,153,0,0.95)'],
        ['v8-bess-road', ['==',['get','role'],'access_road'], 'rgba(120,80,40,0.55)', 'rgba(120,80,40,0.95)']
    ];
    layers.forEach(([id, filter, fill, outline]) => { if (!map.getLayer(id)) map.addLayer({ id, type:'fill', source:'v8-bess-layout', filter, paint:{ 'fill-color':fill, 'fill-outline-color':outline } }); });
    if (!map.getLayer('v8-bess-path')) map.addLayer({ id:'v8-bess-path', type:'line', source:'v8-bess-layout', filter:['==',['get','role'],'dc_collection_path'], paint:{ 'line-color':'#ff9900', 'line-width':3, 'line-dasharray':[2,2] } });
    if (!map.getLayer('v8-bess-export')) map.addLayer({ id:'v8-bess-export', type:'circle', source:'v8-bess-layout', filter:['==',['get','role'],'grid_export_point'], paint:{ 'circle-radius':7, 'circle-color':'#ffffff', 'circle-stroke-color':'#00ffff', 'circle-stroke-width':2 } });
}

function v8RefreshBessGeo() {
    if (!window.map) return;
    v8EnsureBessGeoLayers();
    const source = map.getSource('v8-bess-layout');
    if (source) source.setData(window.v8BessGeoJson);
}

function v8DrawBessAtMapCentre() {
    if (!window.map) return;
    window.v8BessGeoJson = v8BuildBessGeoJson(map.getCenter());
    v8RefreshBessGeo();
}

function v8ResetBessGeo() {
    window.v8BessGeoJson = { type:'FeatureCollection', features:[] };
    v8RefreshBessGeo();
}

function v8ExportBessGeoJson() {
    const blob = new Blob([JSON.stringify(window.v8BessGeoJson, null, 2)], { type:'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'v8-bess-layout.geojson';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function v8InitBessUi() {
    document.getElementById('btn_bess_sync_energy')?.addEventListener('click', () => { document.getElementById('bess_energy_mwh').value = v8Fmt(v8n('bess_export_mw', 50) * v8n('bess_duration_h', 3), 2); v8UpdateBessSummary(); });
    document.getElementById('btn_bess_draw_geo')?.addEventListener('click', v8DrawBessAtMapCentre);
    document.getElementById('btn_bess_reset_geo')?.addEventListener('click', v8ResetBessGeo);
    document.getElementById('btn_bess_export_geojson')?.addEventListener('click', v8ExportBessGeoJson);
    document.querySelectorAll('#v8_bess_panel input, #v8_bess_panel select').forEach(el => { el.addEventListener('input', v8UpdateBessSummary); el.addEventListener('change', v8UpdateBessSummary); });
    setTimeout(() => { if (window.map) { map.on('style.load', v8RefreshBessGeo); map.on('load', v8RefreshBessGeo); } }, 1000);
    v8UpdateBessSummary();
}

document.addEventListener('DOMContentLoaded', v8InitBessUi);
```

### `gis-sld-v5.css`

Lines: 1967

```css
:root {
  /* Backgrounds & UI */
  --bg: #050505;
  --panel: rgba(10, 10, 10, 0.96);
  --line: #2f343d;
  
  /* Typography & Accents */
  --text: #ffffff;
  --muted: #a6adbb;
  --accent: #00ffff;
  --accent-alt: #ff9900;
  
  /* Status & Specific Elements */
  --ok: #00ff88;
  --substation: #ff3333;
  --private-sub: #00ff88;
  --inverter: #ffff00;
  --mv: #6633ff;
  --bess: #ff00aa;
  --array-blue: #0066ff;
  --warn: #ff4444;
}

* {
  box-sizing: border-box;
}

html, body {
  height: 100%;
}

body {
  margin: 0;
  padding: 20px;
  background: var(--bg);
  color: var(--text);
  font-family: "Courier New", monospace;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

/* Layout */
.dashboard {
  display: flex;
  gap: 20px;
  width: 100%;
  max-width: 1600px;
  height: 100%;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.panel-left {
  width: 440px;
  padding: 20px 20px 80px 20px;
  flex-shrink: 0;
  overflow-y: auto;
  align-items: stretch;
}

.panel-right {
  flex: 1 1 auto;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--line);
  min-height: 400px;
}

/* Typography */
h2 {
  margin: 0 0 10px 0;
  color: var(--text);
  font-size: 18px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--line);
  padding-bottom: 10px;
}

h3 {
  margin: 15px 0 5px 0;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  border-bottom: 1px dashed #333;
  padding-bottom: 3px;
}

/* Tabs */
.tab-container {
  display: flex;
  border-bottom: 1px solid var(--line);
  margin-bottom: 15px;
}

.tab-btn {
  flex: 1;
  padding: 10px 5px;
  background: transparent;
  color: var(--muted);
  border: none;
  cursor: pointer;
  font-family: monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: 0.2s;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
  font-weight: bold;
  background: rgba(0, 255, 255, 0.05);
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

/* Inputs & Forms */
.input-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 6px;
}

.input-group input[type="text"], 
.input-group input[type="number"], 
.input-group select {
  width: 95px;
  background: #111;
  color: var(--accent);
  border: 1px solid #444;
  padding: 5px;
  text-align: right;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

.input-group input[type="text"] {
  text-align: left;
}

.input-group select {
  width: auto;
  min-width: 140px;
  text-align: left;
}

.tab-content#central_tab .input-group input[type="number"], 
.tab-content#central_tab .input-group select {
  color: var(--accent-alt);
}

.input-group input:focus, 
.input-group select:focus {
  border-color: var(--text);
  outline: none;
}

/* Hide native number input arrows while preserving numeric typing */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}

/* Search Box */
.search-box {
  display: flex;
  gap: 5px;
  margin-bottom: 15px;
}

.search-box input {
  flex: 1;
  background: #111;
  color: #fff;
  border: 1px solid #444;
  padding: 8px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}

.search-box button {
  background: #222;
  color: var(--text);
  border: 1px solid #555;
  padding: 8px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-family: monospace;
  font-weight: bold;
}

.search-box button:hover {
  background: #444;
  color: #fff;
}

/* Stats */
.stat-box {
  background: rgba(0, 255, 255, 0.05);
  border: 1px solid var(--accent);
  padding: 12px;
  border-radius: 3px;
  margin-top: 15px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 6px;
  color: var(--muted);
}

.stat-val {
  color: var(--text);
  font-weight: bold;
  text-align: right;
}

.stat-val.cyan {
  color: var(--accent);
  font-size: 13px;
}

.stat-val.orange {
  color: var(--accent-alt);
  font-size: 13px;
}

/* Finance Elements */
.finance-box {
  background: rgba(0, 255, 136, 0.05);
  border: 1px solid var(--ok);
  border-radius: 3px;
  padding: 10px;
  margin-top: 15px;
}

.finance-box summary {
  color: var(--ok);
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.finance-headline {
  border: 1px solid #264d3a;
  padding: 10px;
  margin-bottom: 10px;
  background: rgba(0, 255, 136, 0.04);
}

.finance-box input[type="number"] {
  width: 95px;
  background: #111;
  color: var(--ok);
  border: 1px solid #444;
  padding: 5px;
  text-align: right;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

.finance-box input[type="checkbox"] {
  accent-color: var(--ok);
  cursor: pointer;
  margin: 0;
}

/* Messages & Notes */
.warning-box {
  color: #ffcc00;
  font-size: 10px;
  margin-top: 8px;
  line-height: 1.4;
}

.ux-note {
  font-size: 9px;
  color: var(--muted);
  margin-top: 4px;
  font-style: italic;
}

.benchmark-box {
  background: rgba(17, 17, 17, 0.8);
  border: 1px solid #444;
  border-radius: 3px;
  padding: 10px;
  margin-top: 15px;
}

.disclaimer-box {
  background: rgba(255, 68, 68, 0.05);
  border: 1px solid #ff4444;
  color: #ff9999;
  font-size: 10px;
  padding: 12px;
  border-radius: 3px;
  margin-top: 15px;
  line-height: 1.5;
  text-align: justify;
}

.explainer-box {
  background: rgba(0, 255, 255, 0.04);
  border: 1px solid var(--accent);
  color: var(--muted);
  font-size: 10px;
  padding: 12px 12px 28px 12px;
  border-radius: 3px;
  margin-top: 15px;
  line-height: 1.55;
  text-align: justify;
  flex: 0 0 auto;
  max-height: none;
  overflow: visible;
}

.explainer-box strong {
  color: var(--text);
}

.explainer-box h3 {
  color: var(--accent);
  margin-top: 0;
}

/* Buttons */
.btn {
  padding: 10px;
  background: #000;
  color: var(--text);
  border: 1px solid #555;
  cursor: pointer;
  font-family: monospace;
  font-weight: bold;
  text-transform: uppercase;
  border-radius: 3px;
  margin-top: 10px;
  width: 100%;
  transition: 0.2s;
}

.btn:hover {
  background: #222;
  color: #fff;
}

.btn.draw-btn {
  color: var(--bg);
  background: var(--accent);
  border-color: var(--accent);
}

.btn.draw-btn.central {
  background: var(--accent-alt);
  border-color: var(--accent-alt);
}

.map-toggle-btn {
  background: rgba(5, 5, 5, 0.85);
  color: var(--muted);
  border: 1px solid #444;
  padding: 6px 12px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
  transition: 0.2s;
}

.map-toggle-btn:hover {
  background: #222;
  border-color: #888;
}

.map-toggle-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(0, 255, 255, 0.05);
}

.map-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.map-toggle-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.voltage-toggle-row .map-toggle-btn {
  font-size: 10px;
  padding: 5px 8px;
}

.atlas-voltage-btn:not(.active) {
  color: #777;
  border-color: #333;
  opacity: 0.65;
}

.atlas-66kv.active { border-color: #66ff66; color: #66ff66; }
.atlas-132kv.active { border-color: #ffcc00; color: #ffcc00; }
.atlas-275kv.active { border-color: #ff66ff; color: #ff66ff; }
.atlas-400kv.active { border-color: #ff3333; color: #ff3333; }
body.map-expanded { overflow: hidden; padding: 0; }
body.map-expanded .dashboard { max-width: none; width: 100vw; height: 100vh; }
body.map-expanded .panel-left { display: none; }
.panel-right.map-expanded { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999; border-radius: 0; border: none; }
.panel-right.map-expanded #map { min-height: 100vh; }
.legend.key-collapsed { display: none; }
@media (max-width: 900px) {
  .map-controls { left: 10px; right: 10px; align-items: flex-end; }
  .map-toggle-row { gap: 6px; }
  .map-toggle-btn { font-size: 10px; padding: 5px 7px; }
}
.map-tool-overlay {
  position: absolute;
  top: 110px;
  right: 10px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
  max-width: 520px;
}

.map-tool-overlay.tools-collapsed .map-tool-row-secondary,
.map-tool-overlay.tools-collapsed button:not(#btn_map_tools_toggle) {
  display: none;
}

.map-tool-row-secondary .map-toggle-btn {
  font-size: 10px;
  padding: 5px 7px;
}

@media (max-width: 900px) {
  .map-tool-overlay {
    left: 10px;
    right: 10px;
    top: 118px;
    max-width: none;
  }
}
/* Map Elements */
#map {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-size: 24px;
  pointer-events: none;
  z-index: 10;
  text-shadow: 0 0 5px #000;
}

.legend {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: var(--panel);
  border: 1px solid var(--line);
  padding: 10px;
  font-size: 10px;
  z-index: 1;
  border-radius: 4px;
  pointer-events: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.swatch {
  width: 12px;
  height: 12px;
  border: 1px solid #666;
}

/* Maplibre Popups */
.maplibregl-popup-content {
  background: #111;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  font-family: "Courier New", monospace;
  padding: 12px;
  font-size: 11px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
}

.maplibregl-popup-close-button {
  color: #888;
  padding: 4px;
}

.maplibregl-popup-close-button:hover {
  color: #fff;
}

.popup-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  border-bottom: 1px solid #222;
  padding-bottom: 2px;
  gap: 15px;
}

.popup-val {
  font-weight: bold;
  color: var(--accent);
}

/* Status Indicator */
#fetch_status {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 20;
  background: rgba(5, 5, 5, 0.9);
  border: 1px solid #555;
  padding: 6px 10px;
  border-radius: 3px;
  font-size: 10px;
  color: var(--muted);
  display: none;
}

#fetch_status.error {
  color: #ff6666;
  border-color: #ff4444;
  display: block;
}

/* Responsive Design */
@media (max-width: 800px) {
  html, body {
    height: auto;
  }
  
  body {
    overflow: auto;
    padding: 10px;
  }
  
  .dashboard {
    flex-direction: column;
    height: auto;
  }
  
  .panel-left {
    width: 100%;
    max-height: none;
    flex-shrink: 0;
    padding-bottom: 80px;
  }
  
  .panel-right {
    height: 60vh;
    flex-shrink: 0;
    min-height: 400px;
  }
}

/* GLOBALGRID2050 A4 PORTRAIT PRINT MODE */
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html,
  body {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    display: block !important;
    background: #ffffff !important;
    color: #111111 !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 9.5pt !important;
    line-height: 1.35 !important;
  }

  body::before {
    content: "GlobalGrid2050  |  A4 Portrait Screening Report";
    display: block;
    color: #111111;
    font-weight: bold;
    font-size: 13pt;
    border-bottom: 1px solid #999999;
    padding: 0 0 5mm 0;
    margin: 0 0 6mm 0;
  }

  .dashboard,
  .module-app-shell,
  .module-main,
  .topo-main,
  main {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  .panel,
  .panel-left,
  .panel-right,
  .module-panel,
  .topo-panel,
  .module-map-card,
  section,
  header,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #ffffff !important;
    color: #111111 !important;
    border-color: #cccccc !important;
    box-shadow: none !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .panel,
  .module-panel,
  .topo-panel,
  .module-map-card,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    border: 1px solid #cccccc !important;
    border-radius: 0 !important;
    padding: 5mm !important;
    margin: 0 0 6mm 0 !important;
  }

  .panel-right,
  .module-map-card {
    page-break-before: auto;
    break-before: auto;
  }

  #map,
  #module_map,
  canvas,
  svg {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-height: 110mm !important;
    max-height: 170mm !important;
    border: 1px solid #999999 !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .maplibregl-canvas,
  .maplibregl-map {
    max-width: 100% !important;
  }

  .map-controls,
  .map-tool-overlay,
  .module-map-toolbar,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  .topo-header-links,
  .button-row,
  .btn,
  button,
  .tab-container,
  .topo-tabs,
  .toolbar,
  .print-btn,
  [id*="btn_"],
  [class*="toggle"] {
    display: none !important;
  }

  .legend {
    display: block !important;
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    background: #ffffff !important;
    color: #111111 !important;
    border: 1px solid #cccccc !important;
    padding: 4mm !important;
    margin: 4mm 0 0 0 !important;
    font-size: 8pt !important;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  h1,
  h2,
  h3,
  h4 {
    color: #111111 !important;
    border-color: #999999 !important;
    page-break-after: avoid;
    break-after: avoid;
  }

  p,
  label,
  div,
  span,
  small,
  strong,
  li {
    color: #111111 !important;
  }

  input,
  select,
  textarea {
    color: #111111 !important;
    background: #ffffff !important;
    border: 1px solid #999999 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .input-group,
  .module-stat,
  .stat-row,
  .summary-row,
  .function-item,
  .card,
  .topo-mode,
  .tab-content {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .tab-content,
  .topo-mode {
    display: block !important;
  }

  .tab-content:not(.active),
  .topo-mode:not(.active) {
    display: block !important;
  }

  a::after {
    content: "" !important;
  }

  * {
    text-shadow: none !important;
    box-shadow: none !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}

/* GLOBALGRID2050 PRINT V2 COMPACT REPORT MODE */
@media print {
  @page {
    size: A4 portrait;
    margin: 9mm;
  }

  html,
  body {
    width: auto !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    display: block !important;
    background: #fff !important;
    color: #111 !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 8.5pt !important;
    line-height: 1.22 !important;
  }

  body::before {
    content: "GlobalGrid2050 Screening Report";
    display: block !important;
    font-weight: 700 !important;
    font-size: 11pt !important;
    color: #111 !important;
    border-bottom: 1px solid #999 !important;
    padding: 0 0 3mm 0 !important;
    margin: 0 0 4mm 0 !important;
  }

  .dashboard,
  .module-app-shell,
  .module-main,
  .topo-main,
  main {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    gap: 0 !important;
  }

  header,
  .panel,
  .panel-left,
  .panel-right,
  .module-panel,
  .topo-panel,
  .module-map-card,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    display: block !important;
    position: static !important;
    inset: auto !important;
    float: none !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    background: #fff !important;
    color: #111 !important;
    border: 1px solid #ccc !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 3.5mm !important;
    margin: 0 0 4mm 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .panel-left,
  .module-panel,
  .topo-panel {
    column-count: 2;
    column-gap: 8mm;
    column-rule: 1px solid #ddd;
  }

  .panel-right,
  .panel-right.map-expanded,
  .panel-right.map-fullscreen,
  .module-map-card {
    position: static !important;
    inset: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    z-index: auto !important;
    page-break-before: auto !important;
    break-before: auto !important;
    column-count: initial !important;
    column-gap: initial !important;
    column-rule: none !important;
  }

  #map,
  #module_map {
    display: block !important;
    width: 100% !important;
    height: 125mm !important;
    min-height: 125mm !important;
    max-height: 125mm !important;
    border: 1px solid #999 !important;
    margin: 0 0 3mm 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  canvas,
  svg {
    max-width: 100% !important;
    height: auto !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .maplibregl-canvas,
  .maplibregl-map {
    max-width: 100% !important;
  }

  .map-controls,
  .map-tool-overlay,
  .module-map-toolbar,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  .search-box,
  .button-row,
  .btn,
  button,
  .tab-container,
  .topo-tabs,
  .toolbar,
  .print-btn,
  [id*="btn_"],
  [class*="toggle"] {
    display: none !important;
  }

  .legend {
    display: block !important;
    position: static !important;
    width: 100% !important;
    max-width: none !important;
    background: #fff !important;
    color: #111 !important;
    border: 1px solid #ccc !important;
    padding: 2.5mm !important;
    margin: 2mm 0 0 0 !important;
    font-size: 7.5pt !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .legend * {
    color: #111 !important;
  }

  h1 {
    font-size: 14pt !important;
    line-height: 1.15 !important;
    margin: 0 0 3mm 0 !important;
    padding: 0 !important;
  }

  h2 {
    font-size: 10pt !important;
    line-height: 1.15 !important;
    margin: 2.5mm 0 1.5mm 0 !important;
    padding: 0 0 1mm 0 !important;
    border-bottom: 1px solid #999 !important;
    color: #111 !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  h3 {
    font-size: 8.5pt !important;
    line-height: 1.15 !important;
    margin: 2mm 0 1mm 0 !important;
    padding: 0 0 0.75mm 0 !important;
    border-bottom: 1px dotted #bbb !important;
    color: #111 !important;
    break-after: avoid;
    page-break-after: avoid;
  }

  p,
  label,
  div,
  span,
  small,
  strong,
  li {
    color: #111 !important;
  }

  p {
    margin: 0 0 2mm 0 !important;
  }

  .input-group,
  .module-stat,
  .stat-row,
  .summary-row {
    display: grid !important;
    grid-template-columns: 1fr auto !important;
    gap: 2mm !important;
    align-items: baseline !important;
    margin: 0 0 1mm 0 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  input,
  select,
  textarea {
    color: #111 !important;
    background: #fff !important;
    border: none !important;
    border-bottom: 1px solid #aaa !important;
    padding: 0 !important;
    min-height: 0 !important;
    font-size: 8.5pt !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .tab-content,
  .topo-mode {
    display: none !important;
  }

  .tab-content.active,
  .topo-mode.active,
  .topo-mode[data-mode-panel].active {
    display: block !important;
  }

  details:not([open]) {
    display: none !important;
  }

  .collapsed,
  .hidden,
  [hidden] {
    display: none !important;
  }

  .warning,
  .notice,
  .guidance-box,
  .warning-box,
  .status-box,
  .module-note {
    font-size: 8pt !important;
    line-height: 1.2 !important;
  }

  a::after {
    content: "" !important;
  }

  * {
    text-shadow: none !important;
    box-shadow: none !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}

/* GLOBALGRID2050 PRINT V3 FINANCIALS PATCH */
@media print {
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  body {
    font-size: 8pt !important;
    line-height: 1.16 !important;
  }

  /* Print only the selected topology tab. */
  #string_tab:not(.active),
  #central_tab:not(.active),
  .tab-content:not(.active) {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 0 !important;
  }

  #string_tab.active,
  #central_tab.active,
  .tab-content.active {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  /* Financial section should read like a report table, not a screen form. */
  details.finance-box,
  details.finance-box[open],
  .finance-box {
    display: block !important;
    open: true;
    background: #ffffff !important;
    color: #111111 !important;
    border: 1px solid #bbbbbb !important;
    border-radius: 0 !important;
    padding: 2.5mm !important;
    margin: 2mm 0 3mm 0 !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  .finance-box summary {
    display: block !important;
    font-weight: 700 !important;
    font-size: 9pt !important;
    color: #111111 !important;
    border-bottom: 1px solid #999999 !important;
    padding: 0 0 1.5mm 0 !important;
    margin: 0 0 2mm 0 !important;
    list-style: none !important;
  }

  .finance-box summary::-webkit-details-marker {
    display: none !important;
  }

  .finance-headline,
  .finance-box .finance-headline {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    column-gap: 6mm !important;
    row-gap: 0.6mm !important;
    background: #ffffff !important;
    border: 0 !important;
    padding: 0 !important;
    margin: 0 0 2mm 0 !important;
  }

  .finance-box h3 {
    display: block !important;
    clear: both !important;
    font-size: 8.5pt !important;
    color: #111111 !important;
    border-bottom: 1px solid #bbbbbb !important;
    margin: 2mm 0 1mm 0 !important;
    padding: 0 0 0.8mm 0 !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  .finance-box .input-group,
  .finance-box .stat-row,
  details.finance-box .input-group,
  details.finance-box .stat-row {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 34mm !important;
    gap: 2mm !important;
    align-items: baseline !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 0.55mm 0 !important;
    border-bottom: 1px dotted #dddddd !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .finance-box .input-group[style],
  details.finance-box .input-group[style] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 58mm !important;
    margin: 0 !important;
    padding: 0.55mm 0 !important;
  }

  .finance-box label,
  .finance-box .stat-row span:first-child {
    color: #111111 !important;
    font-weight: 400 !important;
    white-space: normal !important;
  }

  .finance-box input,
  .finance-box select,
  .finance-box textarea,
  .finance-box .stat-val,
  .finance-box .cyan,
  .finance-box .orange,
  .finance-box .green,
  .finance-box [class*="cyan"],
  .finance-box [class*="green"],
  .finance-box [class*="orange"] {
    color: #111111 !important;
    background: #ffffff !important;
    border: 0 !important;
    border-bottom: 1px solid #aaaaaa !important;
    box-shadow: none !important;
    text-shadow: none !important;
    font-weight: 700 !important;
    text-align: right !important;
    min-height: 0 !important;
    height: auto !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .finance-box select {
    white-space: normal !important;
    text-align: left !important;
    font-weight: 400 !important;
    width: 100% !important;
  }

  .finance-box .warning-box,
  .finance-box [id$="_warnings"] {
    display: block !important;
    color: #111111 !important;
    background: #ffffff !important;
    border: 1px solid #999999 !important;
    padding: 2mm !important;
    margin: 2mm 0 0 0 !important;
    font-size: 7.5pt !important;
    line-height: 1.18 !important;
  }

  .finance-box .warning-box:empty,
  .finance-box [id$="_warnings"]:empty {
    display: none !important;
  }

  /* Prevent repeated zero width oddities and duplicated single values. */
  .finance-box input[type="checkbox"] {
    width: 4mm !important;
    height: 4mm !important;
    border: 1px solid #111111 !important;
  }

  /* Compact normal left report panels after finance expansion. */
  .panel-left {
    padding: 3mm !important;
  }

  .panel-left > h2 {
    font-size: 11pt !important;
    margin-bottom: 3mm !important;
  }

  .stat-box,
  .disclaimer-box,
  .explainer-box {
    padding: 2.5mm !important;
    margin: 0 0 3mm 0 !important;
  }

  .explainer-box p,
  .disclaimer-box,
  .ux-note {
    font-size: 7.6pt !important;
    line-height: 1.18 !important;
  }

  /* Keep the map as a final report figure and not an oversized blank section. */
  .panel-right {
    padding: 3mm !important;
    margin-top: 3mm !important;
  }

  #map {
    height: 115mm !important;
    min-height: 115mm !important;
    max-height: 115mm !important;
  }

  .legend {
    font-size: 7pt !important;
    padding: 2mm !important;
    margin-top: 2mm !important;
  }
}

/* GLOBALGRID2050 GIS SLD PRINT MAP PACK */
@media print {
  .panel-right {
    page-break-before: auto !important;
    break-before: auto !important;
  }

  #map {
    height: 150mm !important;
    min-height: 150mm !important;
    max-height: 150mm !important;
    width: 100% !important;
    overflow: hidden !important;
  }

  .print-map-pack {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
  }

  .print-map-page {
    display: block !important;
    width: 100% !important;
    min-height: 265mm !important;
    page-break-before: always !important;
    break-before: page !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #111111 !important;
  }

  .print-map-page h2 {
    display: block !important;
    font-size: 12pt !important;
    color: #111111 !important;
    margin: 0 0 4mm 0 !important;
    padding: 0 0 2mm 0 !important;
    border-bottom: 1px solid #999999 !important;
  }

  .print-map-page img {
    display: block !important;
    width: 100% !important;
    height: 225mm !important;
    object-fit: contain !important;
    border: 1px solid #999999 !important;
    background: #ffffff !important;
    margin: 0 0 3mm 0 !important;
  }

  .print-map-page p {
    display: block !important;
    color: #111111 !important;
    font-size: 8pt !important;
    line-height: 1.2 !important;
    margin: 0 !important;
  }

  .print-map-page-landscape {
    min-height: 265mm !important;
  }

  .print-map-page-landscape img {
    height: 225mm !important;
  }
}

@media screen {
  .print-map-pack {
    display: none;
  }
}

/* GLOBALGRID2050 SIMPLE SAFE PRINT MAP FIX */
@media print {
  /* The report prints first. The live map prints as one large page figure after report content. */
  .panel-right {
    display: block !important;
    position: static !important;
    width: 100% !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    page-break-before: always !important;
    break-before: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    padding: 0 !important;
    margin: 0 !important;
    border: 0 !important;
    background: #ffffff !important;
  }

  .panel-right::before {
    content: "Map Figure: Current GIS SLD View";
    display: block !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
    color: #111111 !important;
    border-bottom: 1px solid #999999 !important;
    padding: 0 0 3mm 0 !important;
    margin: 0 0 4mm 0 !important;
  }

  #map {
    display: block !important;
    position: relative !important;
    width: 100% !important;
    height: 230mm !important;
    min-height: 230mm !important;
    max-height: 230mm !important;
    overflow: hidden !important;
    border: 1px solid #999999 !important;
    background: #ffffff !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .map-controls,
  .map-tool-overlay,
  .crosshair,
  #fetch_status,
  .maplibregl-control-container,
  .maplibregl-ctrl,
  .maplibregl-ctrl-group,
  .legend {
    display: none !important;
  }

  .print-map-pack,
  .print-map-page,
  .print-map-page-landscape {
    display: none !important;
  }
}

/* GLOBALGRID2050 OPERATING ASSET LAYER BUTTONS */
.asset-toggle-row {
    margin-top: 6px;
}
.asset-layer-btn {
    opacity: 0.5;
}
.asset-layer-btn.active {
    opacity: 1;
}
.asset-solar.active {
    border-color: #00ff88;
    color: #00ff88;
}
.asset-wind-onshore.active {
    border-color: #00ffcc;
    color: #00ffcc;
}
.asset-wind-offshore.active {
    border-color: #0066ff;
    color: #66aaff;
}
.asset-bess.active {
    border-color: #ff69b4;
    color: #ff69b4;
}
@media print {
    .asset-toggle-row {
        display: none !important;
    }
}

/* GLOBALGRID2050 V7 ARRAY VISIBILITY AND MWp SIZING */
.array-size-control input {
    color: var(--accent);
    font-weight: bold;
}
.array-size-note {
    border-left: 2px solid var(--accent);
    padding-left: 8px;
    margin-bottom: 10px;
}
.map-size-row {
    align-items: center;
}
.map-size-input {
    width: 90px;
    min-width: 90px;
    padding: 8px 10px;
    background: rgba(0, 0, 0, 0.82);
    border: 1px solid #2f343d;
    border-radius: 4px;
    color: #00ffff;
    font-family: "Courier New", monospace;
    font-size: 12px;
    font-weight: bold;
}
.map-size-input:focus {
    outline: none;
    border-color: #00ffff;
}
.map-size-status {
    color: #a6adbb;
    font-size: 10px;
    font-weight: bold;
    padding: 8px 4px;
    white-space: nowrap;
}
#btn_array_toggle.active {
    border-color: #00ff88;
    color: #00ff88;
}
#btn_array_toggle:not(.active) {
    opacity: 0.55;
}
@media (max-width: 768px) {
    .map-size-row {
        display: flex;
        flex-wrap: wrap;
    }
    .map-size-input {
        width: 82px;
        min-width: 82px;
    }
    .map-size-status {
        width: 100%;
    }
}
@media print {
    .map-size-row,
    .array-size-note {
        display: none !important;
    }
}

/* GLOBALGRID2050 V7 MOBILE TOOLS ENERGY LAYER CLEARANCE FIX */
@media (max-width: 900px) {
  .map-controls {
    z-index: 30 !important;
  }

  .asset-toggle-row,
  .voltage-toggle-row {
    position: relative !important;
    z-index: 35 !important;
    pointer-events: auto !important;
  }

  .asset-toggle-row .map-toggle-btn,
  .voltage-toggle-row .map-toggle-btn {
    pointer-events: auto !important;
  }

  .map-tool-overlay,
  .map-tool-overlay.tools-collapsed,
  .panel-right.map-expanded .map-tool-overlay,
  .panel-right.map-expanded .map-tool-overlay.tools-collapsed,
  body.map-expanded .map-tool-overlay,
  body.map-expanded .map-tool-overlay.tools-collapsed {
    top: 265px !important;
    left: 10px !important;
    right: 10px !important;
    z-index: 24 !important;
    max-width: none !important;
    align-items: stretch !important;
    pointer-events: none !important;
  }

  .map-tool-overlay .map-toggle-btn,
  .map-tool-overlay input,
  .map-tool-overlay span {
    pointer-events: auto !important;
  }

  .map-tool-overlay > .map-toggle-row {
    justify-content: center !important;
  }

  .map-tool-overlay.tools-collapsed {
    width: auto !important;
  }

  .map-tool-overlay.tools-collapsed #btn_map_tools_toggle {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .map-tool-overlay.tools-collapsed .map-size-row,
  .map-tool-overlay.tools-collapsed .map-tool-row-secondary,
  .map-tool-overlay.tools-collapsed button:not(#btn_map_tools_toggle) {
    display: none !important;
  }
}

@media (max-width: 520px) {
  .map-tool-overlay,
  .map-tool-overlay.tools-collapsed,
  .panel-right.map-expanded .map-tool-overlay,
  .panel-right.map-expanded .map-tool-overlay.tools-collapsed,
  body.map-expanded .map-tool-overlay,
  body.map-expanded .map-tool-overlay.tools-collapsed {
    top: 285px !important;
  }

  .map-tool-overlay > .map-toggle-row:first-child {
    display: flex !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
  }
}

/* GLOBALGRID2050 V7 LARGE ASSET MARKERS AND GIS SEARCH */
.gis-map-search {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 45;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    width: min(420px, calc(100% - 20px));
    pointer-events: auto;
}
.gis-search-input {
    flex: 1;
    min-width: 0;
    height: 32px;
    background: rgba(0, 0, 0, 0.88);
    color: #00ffff;
    border: 1px solid #444;
    border-radius: 3px;
    padding: 6px 9px;
    font-family: "Courier New", monospace;
    font-size: 11px;
    font-weight: bold;
}
.gis-search-input:focus {
    outline: none;
    border-color: #00ffff;
}
.gis-search-btn {
    height: 32px;
    padding: 6px 10px;
}
.gis-search-results {
    display: none;
    position: absolute;
    top: 38px;
    left: 0;
    right: 44px;
    background: rgba(5, 5, 5, 0.96);
    border: 1px solid #2f343d;
    border-radius: 4px;
    max-height: 260px;
    overflow-y: auto;
    z-index: 46;
}
.gis-search-result,
.gis-search-result-empty {
    display: block;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: 0;
    border-bottom: 1px solid #222;
    color: #ffffff;
    font-family: "Courier New", monospace;
    font-size: 10px;
    text-align: left;
    cursor: pointer;
}
.gis-search-result:hover {
    background: rgba(0, 255, 255, 0.08);
}
.gis-search-result strong {
    display: block;
    color: #ffffff;
    margin-bottom: 3px;
}
.gis-search-result span {
    display: block;
    color: #a6adbb;
}
.gis-search-result.asset span {
    color: #00ff88;
}
.gis-search-result.substation span {
    color: #ff9999;
}
.gis-search-result-empty {
    color: #a6adbb;
    cursor: default;
}

@media (max-width: 900px) {
    .gis-map-search {
        top: 54px;
        left: 10px;
        right: 10px;
        width: auto;
    }
    .map-controls {
        padding-top: 0 !important;
    }
}

@media (max-width: 520px) {
    .gis-map-search {
        top: 58px;
        width: auto;
    }
    .gis-search-input {
        height: 34px;
        font-size: 10px;
    }
    .gis-search-btn {
        height: 34px;
    }
}

@media print {
    .gis-map-search {
        display: none !important;
    }
}

/* GLOBALGRID2050 V7 SITE INTELLIGENCE PANEL */
.site-intel-panel {
    position: absolute;
    right: 12px;
    bottom: 16px;
    z-index: 42;
    width: min(380px, calc(100% - 24px));
    max-height: 58%;
    overflow-y: auto;
    background: rgba(5, 5, 5, 0.94);
    border: 1px solid #2f343d;
    border-radius: 8px;
    color: #ffffff;
    font-family: "Courier New", monospace;
    box-shadow: 0 10px 30px rgba(0,0,0,0.45);
}
.site-intel-panel.collapsed {
    display: none;
}
.site-intel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-bottom: 1px solid #2f343d;
    color: #00ffff;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 12px;
}
.site-intel-header button {
    background: transparent;
    border: 0;
    color: #a6adbb;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
}
.site-intel-body {
    padding: 10px 12px 12px 12px;
    font-size: 11px;
}
.site-intel-section-title {
    color: #00ff88;
    font-weight: bold;
    text-transform: uppercase;
    margin: 8px 0 6px 0;
}
.site-intel-row {
    display: grid;
    grid-template-columns: 105px 1fr;
    gap: 4px 8px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
}
.site-intel-row.warn .site-intel-main,
.site-intel-row.warn .site-intel-meta {
    color: #ff9900;
}
.site-intel-label {
    color: #a6adbb;
}
.site-intel-main {
    color: #ffffff;
    font-weight: bold;
    word-break: break-word;
}
.site-intel-meta {
    grid-column: 2;
    color: #00ffff;
}
.site-intel-notes {
    margin: 6px 0 8px 18px;
    padding: 0;
    color: #ffffff;
}
.site-intel-notes li {
    margin-bottom: 5px;
}
.site-intel-disclaimer,
.site-intel-loading,
.site-intel-warning {
    margin-top: 8px;
    padding: 8px;
    border: 1px solid #333;
    background: rgba(255,255,255,0.04);
    color: #a6adbb;
    line-height: 1.35;
}
.site-intel-warning {
    color: #ff9900;
    border-color: #ff9900;
}

@media (max-width: 900px) {
    .site-intel-panel {
        left: 10px;
        right: 10px;
        bottom: 14px;
        width: auto;
        max-height: 45%;
    }
    .site-intel-row {
        grid-template-columns: 96px 1fr;
    }
}

@media print {
    .site-intel-panel {
        display: none !important;
    }
}

/* GLOBALGRID2050 V7 ASSET PIPELINE DROPDOWN STATUS FILTER */
.asset-filter-row {
    gap: 6px;
}
.map-asset-select,
.map-asset-status-select,
.asset-range-input {
    height: 32px;
    background: rgba(0, 0, 0, 0.84);
    color: #00ff88;
    border: 1px solid #2f343d;
    border-radius: 4px;
    font-family: "Courier New", monospace;
    font-size: 11px;
    font-weight: bold;
    padding: 6px 8px;
}
.map-asset-select {
    min-width: 150px;
}
.map-asset-status-select {
    min-width: 160px;
    color: #00ffff;
}
.asset-range-input {
    width: 76px;
    text-align: center;
}
.map-asset-select:focus,
.map-asset-status-select:focus,
.asset-range-input:focus {
    outline: none;
    border-color: #00ff88;
}
@media (max-width: 900px) {
    .asset-filter-row {
        display: flex !important;
        flex-wrap: wrap !important;
        justify-content: center !important;
        position: relative !important;
        z-index: 35 !important;
    }
    .map-asset-select { min-width: 142px; max-width: 170px; }
    .map-asset-status-select { min-width: 150px; max-width: 190px; }
    .asset-range-input { width: 72px; }
}
@media (max-width: 520px) {
    .map-asset-select { width: 150px; min-width: 150px; }
    .map-asset-status-select { width: 160px; min-width: 160px; }
    .asset-range-input { width: 70px; }
}
@media print {
    .asset-filter-row { display: none !important; }
}


/* V8 BESS reset from working V7 GIS frame */
.v8-bess-panel {
    border: 2px solid var(--accent);
    border-radius: 10px;
    padding: 14px;
    margin: 14px 0;
    background: rgba(0, 30, 30, 0.32);
}

.v8-bess-panel h3 {
    color: var(--accent);
}

.v8-bess-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 12px;
}

.v8-hidden-pv {
    display: none !important;
}

.v8-dev-label {
    color: #ff3333;
    font-weight: bold;
}
```

### `bess-gis-sld-financial-sandbox.css`

Lines: 49

```css
* { box-sizing: border-box; }
:root { --bg:#050505; --panel:#0b0e14; --line:#2f343d; --text:#fff; --muted:#a6adbb; --accent:#00ffff; --ok:#00ff88; --warn:#ff9900; --bad:#ff3333; }
body { margin:0; background:var(--bg); color:var(--text); font-family:'Courier New', monospace; }
.app-shell { padding:22px; }
.topbar { display:flex; justify-content:space-between; gap:18px; border:1px solid var(--line); background:rgba(10,10,10,.96); border-radius:14px; padding:20px; margin-bottom:18px; }
.kicker { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; }
h1 { margin:8px 0 8px 0; font-size:28px; }
h2 { color:var(--accent); font-size:18px; border-bottom:1px solid var(--line); padding-bottom:6px; margin:18px 0 10px 0; }
p { color:var(--muted); line-height:1.55; }
.topbar-actions { display:flex; gap:8px; flex-wrap:wrap; align-content:flex-start; justify-content:flex-end; }
a, button { font-family:inherit; }
.topbar-actions a, .topbar-actions button, .map-toolbar button, .action, .tab-btn { border:1px solid var(--accent); color:var(--accent); background:#050505; border-radius:6px; padding:9px 12px; text-decoration:none; cursor:pointer; }
.workspace { display:grid; grid-template-columns:360px 1fr; gap:18px; align-items:start; }
.panel { border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:18px; }
.controls-panel { grid-row: span 2; }
.tabs { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:12px; }
.tab-btn.active { color:var(--ok); border-color:var(--ok); }
.tab-panel { display:none; }
.tab-panel.active { display:block; }
label { display:block; color:var(--muted); font-size:13px; margin:10px 0 4px 0; }
input, select { width:100%; background:#050505; color:#fff; border:1px solid #444; border-radius:5px; padding:9px; font-family:inherit; }
.action { width:100%; margin-top:10px; color:var(--ok); border-color:var(--ok); font-weight:bold; }
.stat { display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid #222; }
.stat span { color:var(--muted); }
.stat strong { color:var(--ok); text-align:right; }
.logic-box { margin-top:14px; border:1px solid var(--warn); color:var(--warn); background:rgba(255,153,0,.08); border-radius:10px; padding:14px; line-height:1.5; }
.map-panel { min-height:520px; }
.map-toolbar { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
#map { width:100%; height:480px; border:1px solid #222; border-radius:10px; overflow:hidden; }
.drawing-panel { grid-column:1 / -1; }
.drawing-title { color:var(--accent); font-weight:bold; margin-bottom:12px; }
svg { width:100%; height:auto; background:#030303; border:1px solid #222; border-radius:10px; }
.svg-battery { fill:#102018; stroke:#00ff88; stroke-width:2; }
.svg-pcs { fill:#081018; stroke:#00ffff; stroke-width:3; }
.svg-tx { fill:#141008; stroke:#ff9900; stroke-width:3; }
.svg-grid { fill:#111; stroke:#fff; stroke-width:2; }
.svg-road { fill:#25180f; opacity:.95; }
.svg-boundary { fill:none; stroke:#2b7cff; stroke-width:3; stroke-dasharray:12 8; }
.svg-wall { fill:#5a3b20; opacity:.9; }
.svg-line { stroke:#00ffff; stroke-width:4; fill:none; }
.svg-dc { stroke:#ff9900; stroke-width:3; fill:none; }
.svg-text { fill:#fff; font-family:'Courier New', monospace; font-size:18px; font-weight:bold; }
.svg-small { fill:#a6adbb; font-family:'Courier New', monospace; font-size:13px; }
@media (max-width: 980px) { .app-shell { padding:14px; } .topbar { flex-direction:column; } .workspace { grid-template-columns:1fr; } .controls-panel { grid-row:auto; } #map { height:420px; } }
@media print { body { background:#fff; color:#000; } .topbar, .panel { background:#fff; border-color:#000; } .topbar-actions, .map-toolbar, .tabs { display:none; } .tab-panel { display:block; } #map { height:320px; } }

.map-inline-label { color: var(--muted); align-self:center; font-size:13px; }
.map-inline-input { width:90px; padding:8px; }
```

### `bess-gis-sld-financial-sandbox.js`

Lines: 465

```javascript
const state = { map: null, satellite: false };

const darkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const satStyle = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri'
    }
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
};

function n(id, fallback = 0) {
  const value = parseFloat(document.getElementById(id)?.value || fallback);
  return Number.isFinite(value) ? value : fallback;
}

function v(id, fallback = '') { return document.getElementById(id)?.value || fallback; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function fmt(value, digits = 2) { return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0'; }
function gbp(value) { return '£' + fmt(value, 0); }

function initMap() {
  if (!window.maplibregl) return;
  state.map = new maplibregl.Map({ container: 'map', style: darkStyle, center: [-0.1276, 51.5072], zoom: 10 });
  state.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
}

function switchStyle(style) {
  if (!state.map) return;
  state.map.setStyle(style);
}

function applyContainerPreset() {
  const size = v('container_size', '40ft');
  const length = document.getElementById('container_length_m');
  const width = document.getElementById('container_width_m');
  if (size === '20ft') {
    if (length) length.value = '6.1';
    if (width) width.value = '2.44';
  } else {
    if (length) length.value = '12.2';
    if (width) width.value = '2.44';
  }
}

function syncEnergy() {
  const mw = n('grid_export_mw', 50);
  const hours = n('duration_hours', 3);
  const energy = document.getElementById('energy_mwh');
  if (energy) energy.value = fmt(mw * hours, 2);
  updateAll();
}

function calc() {
  const exportMw = n('grid_export_mw', 50);
  const hours = n('duration_hours', 3);
  const energy = n('energy_mwh', exportMw * hours);
  const containerMwh = Math.max(0.1, n('container_mwh', 5));
  const pcsRating = Math.max(0.1, n('pcs_rating_mw', 50));
  const containersPerPcs = Math.max(1, Math.round(n('containers_per_pcs', 30)));
  const containers = Math.max(1, Math.ceil(energy / containerMwh));
  const pcsByPower = Math.max(1, Math.ceil(exportMw / pcsRating));
  const pcsByContainers = Math.max(1, Math.ceil(containers / containersPerPcs));
  const pcsCount = Math.max(pcsByPower, pcsByContainers);
  const pcsPower = pcsCount * pcsRating;
  const actualHours = exportMw > 0 ? energy / exportMw : 0;
  const cpr = Math.max(1, Math.round(n('containers_per_row', 10)));
  const rows = Math.max(1, Math.ceil(containers / cpr));
  const lengthM = Math.max(1, n('container_length_m', 12.2));
  const widthM = Math.max(1, n('container_width_m', 2.44));
  const spacingM = Math.max(0, n('container_spacing_m', 2.5));
  const rowSpacingM = Math.max(0, n('row_spacing_m', 6));
  const fieldLength = cpr * lengthM + Math.max(0, cpr - 1) * spacingM;
  const fieldWidth = rows * widthM + Math.max(0, rows - 1) * rowSpacingM;
  const capex = energy * n('capex_per_mwh', 180000) + pcsPower * n('pcs_capex_per_mw', 55000) + n('civils_allowance', 2500000) + n('mv_allowance', 3000000);
  const capexWithCont = capex * (1 + n('contingency_pct', 10) / 100);
  const revenue = exportMw * n('revenue_per_mw_year', 70000) * (n('availability_pct', 96) / 100);
  const payback = revenue > 0 ? capexWithCont / revenue : 0;
  return { exportMw, hours, energy, containerMwh, pcsRating, containersPerPcs, containers, pcsCount, pcsPower, actualHours, cpr, rows, lengthM, widthM, spacingM, rowSpacingM, fieldLength, fieldWidth, capexWithCont, revenue, payback, layoutMode: v('layout_mode', 'integrated'), barrierMode: v('barrier_mode', 'none'), accessRoadM: n('access_road_m', 6) };
}

function updateSummary(c) {
  setText('out_energy', fmt(c.energy, 2) + ' MWh');
  setText('out_containers', String(c.containers));
  setText('out_pcs_count', String(c.pcsCount));
  setText('out_pcs_power', fmt(c.pcsPower, 2) + ' MW');
  setText('out_export', fmt(c.exportMw, 2) + ' MW');
  setText('out_duration', fmt(c.actualHours, 2) + ' h');
  setText('out_footprint', fmt(c.fieldLength, 1) + ' m x ' + fmt(c.fieldWidth, 1) + ' m');
  setText('out_capex', gbp(c.capexWithCont));
  setText('out_revenue', gbp(c.revenue));
  setText('out_payback', fmt(c.payback, 1) + ' years');
  const logic = document.getElementById('logic_box');
  if (logic) {
    logic.textContent = `${fmt(c.containers,0)} BESS containers provide ${fmt(c.energy,1)} MWh. ${fmt(c.pcsCount,0)} PCS block(s) provide ${fmt(c.pcsPower,1)} MW installed PCS power. Grid export is capped at ${fmt(c.exportMw,1)} MW.`;
  }
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, String(val));
  return el;
}

function svgText(svg, x, y, text, cls = 'svg-small', anchor = 'start') {
  const t = svgEl('text', { x, y, class: cls, 'text-anchor': anchor });
  t.textContent = text;
  svg.appendChild(t);
}

function drawLayout(c) {
  const svg = document.getElementById('bess_svg');
  if (!svg) return;
  svg.innerHTML = '';
  svg.appendChild(svgEl('rect', { x: 45, y: 45, width: 1310, height: 610, rx: 18, class: 'svg-boundary' }));
  svg.appendChild(svgEl('rect', { x: 80, y: 330, width: 1180, height: 52, class: 'svg-road' }));
  svgText(svg, 670, 363, 'access road and maintenance corridor', 'svg-small', 'middle');

  if (c.barrierMode !== 'none') {
    svg.appendChild(svgEl('rect', { x: 70, y: 94, width: 20, height: 505, class: 'svg-wall' }));
    svgText(svg, 105, 120, c.barrierMode === 'fire' ? 'fire wall' : c.barrierMode === 'acoustic' ? 'acoustic wall' : 'fire and acoustic barrier', 'svg-small');
  }

  const maxShow = Math.min(c.containers, 80);
  const cols = Math.min(c.cpr, 12);
  const rows = Math.ceil(maxShow / cols);
  const startX = 130;
  const startY = 90;
  const boxW = 70;
  const boxH = 32;
  const gapX = 12;
  const gapY = 18;
  for (let i = 0; i < maxShow; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (boxW + gapX);
    const y = startY + row * (boxH + gapY);
    svg.appendChild(svgEl('rect', { x, y, width: boxW, height: boxH, rx: 5, class: 'svg-battery' }));
  }
  svgText(svg, startX, startY - 18, `BESS containers shown ${maxShow} of ${c.containers}`, 'svg-text');

  const pcsY = c.layoutMode === 'corridor' ? 395 : 110;
  const pcsXBase = c.layoutMode === 'central' ? 910 : 860;
  const pcsShown = Math.min(c.pcsCount, 10);
  for (let i = 0; i < pcsShown; i++) {
    const x = pcsXBase + (i % 2) * 120;
    const y = pcsY + Math.floor(i / 2) * 82;
    if (c.layoutMode === 'integrated') {
      svg.appendChild(svgEl('rect', { x, y, width: 185, height: 58, rx: 8, class: 'svg-pcs' }));
      svgText(svg, x + 92, y + 25, 'PCS TX', 'svg-text', 'middle');
      svgText(svg, x + 92, y + 45, 'integrated', 'svg-small', 'middle');
    } else {
      svg.appendChild(svgEl('rect', { x, y, width: 82, height: 58, rx: 8, class: 'svg-pcs' }));
      svgText(svg, x + 41, y + 34, 'PCS', 'svg-text', 'middle');
    }
  }

  if (c.layoutMode !== 'integrated') {
    svg.appendChild(svgEl('rect', { x: 1115, y: 115, width: 130, height: 80, rx: 8, class: 'svg-tx' }));
    svgText(svg, 1180, 150, 'TX', 'svg-text', 'middle');
    svgText(svg, 1180, 174, 'external', 'svg-small', 'middle');
  }

  if (c.layoutMode === 'hv_compound') {
    svg.appendChild(svgEl('rect', { x: 1010, y: 430, width: 250, height: 130, rx: 8, class: 'svg-grid' }));
    svgText(svg, 1135, 485, 'HV compound', 'svg-text', 'middle');
    svgText(svg, 1135, 515, 'future detailed version', 'svg-small', 'middle');
  }

  svg.appendChild(svgEl('path', { d: 'M780 210 C820 240 830 285 860 330', class: 'svg-dc' }));
  svg.appendChild(svgEl('path', { d: 'M1030 180 L1120 180', class: 'svg-line' }));
  svg.appendChild(svgEl('rect', { x: 1120, y: 650, width: 170, height: 70, rx: 8, class: 'svg-grid' }));
  svgText(svg, 1205, 680, 'Grid export', 'svg-text', 'middle');
  svgText(svg, 1205, 704, `${fmt(c.exportMw,1)} MW cap`, 'svg-small', 'middle');
  svg.appendChild(svgEl('path', { d: 'M1180 195 L1180 650', class: 'svg-line' }));

  svgText(svg, 70, 700, `Mode: ${c.layoutMode.replaceAll('_',' ')}`, 'svg-text');
  svgText(svg, 70, 730, 'Layout screening only. Cable sizing and protection validation remain in the advanced topology review.', 'svg-small');
}

function updateAll() {
  const c = calc();
  updateSummary(c);
  drawLayout(c);
}

function bindEvents() {
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', updateAll);
    el.addEventListener('change', updateAll);
  });
  document.getElementById('container_size')?.addEventListener('change', () => { applyContainerPreset(); updateAll(); });
  document.getElementById('btn_sync_energy')?.addEventListener('click', syncEnergy);
  document.getElementById('btn_print')?.addEventListener('click', () => window.print());
  document.getElementById('btn_satellite')?.addEventListener('click', () => switchStyle(satStyle));
  document.getElementById('btn_dark')?.addEventListener('click', () => switchStyle(darkStyle));
  document.getElementById('btn_draw_at_center')?.addEventListener('click', () => updateAll());
  document.getElementById('btn_fit')?.addEventListener('click', () => { if (state.map) state.map.flyTo({ zoom: 10 }); });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab_' + btn.dataset.tab)?.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => { bindEvents(); initMap(); updateAll(); });


// --- V8 geospatial BESS layout drawing ---
// Layout only. No cable sizing, impedance, thermal or protection coordination logic here.
state.bessGeoJson = { type: 'FeatureCollection', features: [] };

function metresToLngLat(origin, eastM, northM) {
  const lat = origin.lat;
  const lng = origin.lng;
  const dLat = northM / 111320;
  const dLng = eastM / (111320 * Math.cos(lat * Math.PI / 180));
  return [lng + dLng, lat + dLat];
}

function rotatePoint(x, y, deg) {
  const rad = deg * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [x * cos - y * sin, x * sin + y * cos];
}

function rectFeature(origin, cx, cy, w, h, rotationDeg, props) {
  const corners = [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
    [-w / 2, -h / 2]
  ].map(([x, y]) => {
    const [rx, ry] = rotatePoint(cx + x, cy + y, rotationDeg);
    return metresToLngLat(origin, rx, ry);
  });
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [corners] }
  };
}

function pointFeature(origin, eastM, northM, rotationDeg, props) {
  const [rx, ry] = rotatePoint(eastM, northM, rotationDeg);
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Point', coordinates: metresToLngLat(origin, rx, ry) }
  };
}

function lineFeature(origin, points, rotationDeg, props) {
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'LineString',
      coordinates: points.map(([x, y]) => {
        const [rx, ry] = rotatePoint(x, y, rotationDeg);
        return metresToLngLat(origin, rx, ry);
      })
    }
  };
}

function buildBessGeoJsonAt(origin) {
  const c = calc();
  const rotation = n('geo_rotation_deg', 0);
  const features = [];
  const cols = Math.max(1, Math.min(c.cpr, 30));
  const rows = Math.max(1, Math.ceil(c.containers / cols));
  const boxW = Math.max(2, c.lengthM);
  const boxH = Math.max(2, c.widthM);
  const pitchX = boxW + c.spacingM;
  const pitchY = boxH + c.rowSpacingM;
  const fieldW = cols * boxW + Math.max(0, cols - 1) * c.spacingM;
  const fieldH = rows * boxH + Math.max(0, rows - 1) * c.rowSpacingM;
  const originX = -fieldW / 2;
  const originY = fieldH / 2;
  const boundaryPad = Math.max(25, c.accessRoadM * 3);
  const electricalX = fieldW / 2 + 55;
  const roadY = -fieldH / 2 - Math.max(18, c.accessRoadM);

  features.push(rectFeature(origin, 0, 0, fieldW + boundaryPad * 2 + 220, fieldH + boundaryPad * 2 + 120, rotation, {
    role: 'compound_boundary',
    label: 'BESS compound boundary',
    layout_mode: c.layoutMode
  }));

  features.push(rectFeature(origin, 0, roadY, fieldW + boundaryPad * 2 + 160, Math.max(6, c.accessRoadM), rotation, {
    role: 'access_road',
    label: 'Access road and maintenance corridor'
  }));

  if (c.barrierMode !== 'none') {
    features.push(rectFeature(origin, originX - boundaryPad / 2, 0, 4, fieldH + boundaryPad, rotation, {
      role: 'barrier',
      label: c.barrierMode === 'fire' ? 'Fire separation wall' : c.barrierMode === 'acoustic' ? 'Acoustic wall' : 'Fire and acoustic barrier'
    }));
  }

  for (let i = 0; i < c.containers; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + boxW / 2 + col * pitchX;
    const y = originY - boxH / 2 - row * pitchY;
    features.push(rectFeature(origin, x, y, boxW, boxH, rotation, {
      role: 'bess_container',
      label: 'BESS container ' + (i + 1),
      container_mwh: c.containerMwh
    }));
  }

  const pcsBlockW = c.layoutMode === 'integrated' ? 22 : 14;
  const pcsBlockH = 10;
  const pcsShown = Math.min(c.pcsCount, 40);
  for (let i = 0; i < pcsShown; i++) {
    let x = electricalX;
    let y = originY - i * (pcsBlockH + 6);
    if (c.layoutMode === 'distributed') {
      x = originX + (i % Math.max(1, Math.min(cols, c.pcsCount))) * pitchX;
      y = originY + 26 + Math.floor(i / Math.max(1, cols)) * 16;
    } else if (c.layoutMode === 'corridor') {
      x = originX + fieldW / 2;
      y = roadY - 25 - i * 15;
    } else if (c.layoutMode === 'central') {
      x = electricalX;
      y = 0;
    }
    features.push(rectFeature(origin, x, y, pcsBlockW, pcsBlockH, rotation, {
      role: c.layoutMode === 'integrated' ? 'integrated_pcs_transformer' : 'pcs_block',
      label: c.layoutMode === 'integrated' ? 'Integrated PCS transformer ' + (i + 1) : 'PCS block ' + (i + 1),
      pcs_mw: c.pcsRating
    }));
  }

  if (c.layoutMode !== 'integrated') {
    features.push(rectFeature(origin, electricalX + 42, 0, 28, 18, rotation, {
      role: 'external_transformer',
      label: 'External transformer zone'
    }));
  }

  if (c.layoutMode === 'hv_compound') {
    features.push(rectFeature(origin, electricalX + 88, -36, 58, 38, rotation, {
      role: 'hv_compound_placeholder',
      label: 'Future HV compound placeholder'
    }));
  }

  features.push(pointFeature(origin, electricalX + 120, roadY - 50, rotation, {
    role: 'grid_export_point',
    label: 'Grid export point',
    export_mw: c.exportMw
  }));

  features.push(lineFeature(origin, [[fieldW / 2, 0], [electricalX - 10, 0]], rotation, {
    role: 'dc_collection_path',
    label: 'Indicative DC collection path, not cable sizing'
  }));

  return { type: 'FeatureCollection', features };
}

function ensureBessGeoLayers() {
  if (!state.map) return;
  if (!state.map.getSource('bess-geo-layout')) {
    state.map.addSource('bess-geo-layout', { type: 'geojson', data: state.bessGeoJson });
  }
  const fillLayers = [
    ['bess-boundary-fill', ['==', ['get', 'role'], 'compound_boundary'], 'rgba(43,124,255,0.08)', 'rgba(43,124,255,0.75)'],
    ['bess-container-fill', ['==', ['get', 'role'], 'bess_container'], 'rgba(0,255,136,0.38)', 'rgba(0,255,136,0.95)'],
    ['bess-pcs-fill', ['any', ['==', ['get', 'role'], 'pcs_block'], ['==', ['get', 'role'], 'integrated_pcs_transformer']], 'rgba(0,255,255,0.38)', 'rgba(0,255,255,0.95)'],
    ['bess-transformer-fill', ['any', ['==', ['get', 'role'], 'external_transformer'], ['==', ['get', 'role'], 'hv_compound_placeholder']], 'rgba(255,153,0,0.38)', 'rgba(255,153,0,0.95)'],
    ['bess-road-fill', ['==', ['get', 'role'], 'access_road'], 'rgba(120,80,40,0.55)', 'rgba(120,80,40,0.95)'],
    ['bess-barrier-fill', ['==', ['get', 'role'], 'barrier'], 'rgba(255,80,80,0.45)', 'rgba(255,80,80,0.95)']
  ];
  fillLayers.forEach(([id, filter, fill, outline]) => {
    if (!state.map.getLayer(id)) {
      state.map.addLayer({ id, type: 'fill', source: 'bess-geo-layout', filter, paint: { 'fill-color': fill, 'fill-outline-color': outline } });
    }
  });
  if (!state.map.getLayer('bess-path-line')) {
    state.map.addLayer({ id: 'bess-path-line', type: 'line', source: 'bess-geo-layout', filter: ['==', ['get', 'role'], 'dc_collection_path'], paint: { 'line-color': '#ff9900', 'line-width': 3, 'line-dasharray': [2, 2] } });
  }
  if (!state.map.getLayer('bess-grid-export-point')) {
    state.map.addLayer({ id: 'bess-grid-export-point', type: 'circle', source: 'bess-geo-layout', filter: ['==', ['get', 'role'], 'grid_export_point'], paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#00ffff', 'circle-stroke-width': 2 } });
  }
}

function refreshBessGeoLayout() {
  if (!state.map || !state.bessGeoJson) return;
  ensureBessGeoLayers();
  const source = state.map.getSource('bess-geo-layout');
  if (source) source.setData(state.bessGeoJson);
}

function drawBessGeoLayoutAtMapCenter() {
  if (!state.map) return;
  const centre = state.map.getCenter();
  state.bessGeoJson = buildBessGeoJsonAt(centre);
  refreshBessGeoLayout();
  fitBessGeoLayout();
}

function resetBessGeoLayout() {
  state.bessGeoJson = { type: 'FeatureCollection', features: [] };
  refreshBessGeoLayout();
}

function fitBessGeoLayout() {
  if (!state.map || !state.bessGeoJson || !state.bessGeoJson.features.length) return;
  const coords = [];
  state.bessGeoJson.features.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;
    if (geom.type === 'Point') coords.push(geom.coordinates);
    if (geom.type === 'LineString') coords.push(...geom.coordinates);
    if (geom.type === 'Polygon') coords.push(...geom.coordinates.flat());
  });
  if (!coords.length) return;
  const bounds = coords.reduce((b, coord) => b.extend(coord), new maplibregl.LngLatBounds(coords[0], coords[0]));
  state.map.fitBounds(bounds, { padding: 70, duration: 600 });
}

function exportBessGeoJson() {
  const blob = new Blob([JSON.stringify(state.bessGeoJson, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'v8-bess-layout.geojson';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn_draw_at_center')?.addEventListener('click', drawBessGeoLayoutAtMapCenter);
  document.getElementById('btn_reset_geo')?.addEventListener('click', resetBessGeoLayout);
  document.getElementById('btn_export_geojson')?.addEventListener('click', exportBessGeoJson);
  document.getElementById('btn_fit')?.addEventListener('click', fitBessGeoLayout);
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => { if (state.bessGeoJson.features.length && state.map) drawBessGeoLayoutAtMapCenter(); });
    el.addEventListener('change', () => { if (state.bessGeoJson.features.length && state.map) drawBessGeoLayoutAtMapCenter(); });
  });
  setTimeout(() => {
    if (state.map) {
      state.map.on('style.load', refreshBessGeoLayout);
      state.map.on('load', refreshBessGeoLayout);
    }
  }, 500);
});
```
