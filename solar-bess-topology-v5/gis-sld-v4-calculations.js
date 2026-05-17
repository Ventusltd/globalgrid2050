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
        combiner_boxes_per_inverter: 0, total_combiner_boxes: 0
    };
}

function buildStats(opts) {
    const { total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical, combiner_boxes_per_inverter, total_combiner_boxes } = opts;
    const { mod_wp, mod_l, mod_w, gcr, gross_factor, mods_pallet, mods_container, spare_pct } = physical;

    const dc_mwp = (module_count * mod_wp) / 1_000_000;
    const ac_mw = ac_mw_direct != null ? ac_mw_direct : (dc_ac_ratio > 0 ? dc_mwp / dc_ac_ratio : 0);

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
        net_mod_area_m2, net_array_area_m2, gross_site_area_m2, dc_ac_ratio,
        pallets, containers, spares_pct: spare_pct,
        modules_inc_spares, pallets_inc_spares, containers_inc_spares,
        mods_pallet, mods_container,
        combiner_boxes_per_inverter: combiner_boxes_per_inverter || 0,
        total_combiner_boxes: total_combiner_boxes || 0
    };
}

function computeStringStats() {
    const physical = readPhysicalInputs("");
    const x = intVal("x_mods"), z = intVal("z_strings"), y = intVal("y_invs"), s = intVal("s_subs"), rings = intVal("b_cols");
    const dc_ac_ratio = num("dc_ac_ratio") || 1.2;

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const total_blocks = rings * s;
    const module_count = total_blocks * y * z * x;
    return buildStats({ total_blocks, module_count, dc_ac_ratio, physical });
}

function computeCentralStats() {
    const physical = readPhysicalInputs("_c");
    const x_mods = intVal("x_mods_c");
    const inv_ac_mw = num("inv_ac_mw_c");
    const dc_ac_ratio = num("dc_ac_ratio_c") || 1.2;
    const str_per_cb = intVal("str_per_cb_c", 1);
    const inv_per_mv = intVal("inv_per_mv_c");
    const mv_per_ring = intVal("mv_per_ring_c");
    const rings = intVal("rings_c");

    if (physical.mod_wp <= 0 || physical.mod_l <= 0 || physical.mod_w <= 0 || x_mods <= 0) {
        return zeroStats(dc_ac_ratio, physical.mods_pallet, physical.mods_container);
    }

    const str_dc_kwp = (x_mods * physical.mod_wp) / 1000;
    const inv_dc_mwp = inv_ac_mw * dc_ac_ratio;
    const req_strings = str_dc_kwp > 0 ? Math.ceil((inv_dc_mwp * 1000) / str_dc_kwp) : 0;
    const combiner_boxes_per_inverter = Math.ceil(req_strings / str_per_cb);
    const total_blocks = inv_per_mv * mv_per_ring * rings;
    const total_combiner_boxes = combiner_boxes_per_inverter * total_blocks;
    const module_count = req_strings * x_mods * total_blocks;
    const ac_mw_direct = total_blocks * inv_ac_mw;

    return buildStats({
        total_blocks, module_count, ac_mw_direct, dc_ac_ratio, physical,
        combiner_boxes_per_inverter, total_combiner_boxes
    });
}

function computeStats() {
    return state.activeTab === "string" ? computeStringStats() : computeCentralStats();
}

// ============================================================
