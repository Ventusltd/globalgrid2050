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
    setText("out_sub_ac_rating", stats.production_substation_ac_mva.toFixed(2) + " MVA");
    setText("out_ring_ac_rating", stats.ring_main_ac_mva.toFixed(2) + " MVA");
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
function updateLegend() {
    const legend = $("map_legend");
    if (!legend) return;
    let html = `
        <div class="legend-item"><div class="swatch" style="background:#ffffff; border-color:#ff3333;"></div> Atlas Substation Dataset</div>
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
