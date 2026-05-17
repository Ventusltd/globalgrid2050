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
        string_inverter_kva, production_substation_ac_mva, ring_main_ac_mva,
        central_inverter_mwac, combiner_box_dc_kw, combiner_design_limit_kwdc,
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
        production_substation_ac_mva: production_substation_ac_mva || 0,
        ring_main_ac_mva: ring_main_ac_mva || 0,
        central_inverter_mwac: central_inverter_mwac || 0,
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

function computeStringStats() {
    const physical = readPhysicalInputs("");
    const x = intVal("x_mods"), z = intVal("z_strings"), y = intVal("y_invs"), s = intVal("s_subs"), rings = intVal("b_cols");
    const dc_ac_ratio = num("dc_ac_ratio") || 1.2;
    const string_inverter_kva = num("string_inv_kva") || 352;

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const total_blocks = rings * s;
    const module_count = total_blocks * y * z * x;
    const production_substation_ac_mva = (y * string_inverter_kva) / 1000;
    const ring_main_ac_mva = production_substation_ac_mva * s;
    const ac_mw_direct = total_blocks * y * string_inverter_kva / 1000;
    let engineering_warning = "Check cable ratings, transformer ratings, protection, losses and grid compliance.";
    if (string_inverter_kva > 500) engineering_warning = "Large string inverter rating selected. Verify LV switchgear, transformer, cable loading and protection.";

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        string_inverter_kva, production_substation_ac_mva, ring_main_ac_mva,
        engineering_warning
    });
}

function computeCentralStats() {
    const physical = readPhysicalInputs("_c");
    const x_mods = intVal("x_mods_c");
    const inv_ac_mw = getCentralInverterMwac();
    const dc_ac_ratio = num("dc_ac_ratio_c") || 1.2;
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
    const inv_dc_mwp = inv_ac_mw * dc_ac_ratio;
    const req_strings = str_dc_kwp > 0 ? Math.ceil((inv_dc_mwp * 1000) / str_dc_kwp) : 0;
    const combiner_boxes_per_inverter = Math.ceil(req_strings / str_per_cb);
    const total_blocks = inv_per_mv * mv_per_ring * rings;
    const total_combiner_boxes = combiner_boxes_per_inverter * total_blocks;
    const module_count = req_strings * x_mods * total_blocks;
    const ac_mw_direct = total_blocks * inv_ac_mw;
    const production_substation_ac_mva = inv_ac_mw * inv_per_mv;
    const ring_main_ac_mva = production_substation_ac_mva * mv_per_ring;

    let engineering_warning = "Check cable ratings, transformer ratings, protection, losses and grid compliance.";
    if (combiner_box_dc_kw > combiner_design_limit_kwdc) engineering_warning = "Combiner box DC capacity exceeds the selected design limit.";
    if (inv_ac_mw > 10) engineering_warning = "Large custom central inverter or power block rating selected. Verify transformer, MV switchgear, harmonics, thermal loading, protection and grid code compliance.";

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        combiner_boxes_per_inverter, total_combiner_boxes,
        production_substation_ac_mva, ring_main_ac_mva,
        central_inverter_mwac: inv_ac_mw, combiner_box_dc_kw, combiner_design_limit_kwdc,
        engineering_warning
    });
}

function computeStats() {
    return state.activeTab === "string" ? computeStringStats() : computeCentralStats();
}

// ============================================================
