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
