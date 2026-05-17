"use strict";

// DRAWING
// ============================================================
function getRectPolygon(centerCoord, width_km, length_km, propType) {
    const pt = turf.point(centerCoord);
    const ptN = turf.destination(pt, length_km / 2, 0, { units: "kilometers" }).geometry.coordinates;
    const ptS = turf.destination(pt, length_km / 2, 180, { units: "kilometers" }).geometry.coordinates;
    const nw = turf.destination(turf.point(ptN), width_km / 2, -90, { units: "kilometers" }).geometry.coordinates;
    const ne = turf.destination(turf.point(ptN), width_km / 2, 90, { units: "kilometers" }).geometry.coordinates;
    const se = turf.destination(turf.point(ptS), width_km / 2, 90, { units: "kilometers" }).geometry.coordinates;
    const sw = turf.destination(turf.point(ptS), width_km / 2, -90, { units: "kilometers" }).geometry.coordinates;
    return turf.polygon([[nw, ne, se, sw, nw]], { type: propType });
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

function computeAndDraw() {
    if (!state.activeDrawCenter || !map) return;
    const stats = computeStats();
    state.lastStats = stats;

    if (stats.total_blocks === 0) {
        recalcAll();
        return;
    }

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
    const defaultGridCenter = turf.destination(turf.point(publicSubCoord), arrayOffsetKm, 0, { units: "kilometers" }).geometry.coordinates;
    const gridCenter = state.arrayOverrideCenter || defaultGridCenter;
    const privateSubCoord = turf.destination(turf.point(gridCenter), grid_l / 2, 180, { units: "kilometers" }).geometry.coordinates;
    const exportCableLine = turf.lineString([privateSubCoord, publicSubCoord], {
        type: "export_cable",
        export_cable_extra_km: safeExtraOffsetKm,
        array_moved_manually: Boolean(state.arrayOverrideCenter)
    });
    state.exportCableLengthKm = turf.length(exportCableLine, { units: "kilometers" });

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
        array_moved_manually: Boolean(state.arrayOverrideCenter)
    }));
    features.push(exportCableLine);
    features.push(getRectPolygon(gridCenter, grid_w + CONSTANTS.BOUNDARY_BUFFER_KM, grid_l + CONSTANTS.BOUNDARY_BUFFER_KM, "array_boundary"));

    const ptN = turf.destination(turf.point(gridCenter), grid_l / 2, 0, { units: "kilometers" }).geometry.coordinates;
    const ptNW = turf.destination(turf.point(ptN), grid_w / 2, -90, { units: "kilometers" }).geometry.coordinates;

    const inverters = [];
    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (count >= N) break;
            const posE = turf.destination(turf.point(ptNW), c * block_w + c * spacing + block_w / 2, 90, { units: "kilometers" }).geometry.coordinates;
            const finalPos = turf.destination(turf.point(posE), r * block_l + r * spacing + block_l / 2, 180, { units: "kilometers" }).geometry.coordinates;
            const nodeType = state.activeTab === "string" ? "string_substation" : "central_inverter";
            const footType = state.activeTab === "string" ? "skid_footprint" : "central_footprint";
            features.push(getRectPolygon(finalPos, block_w, block_l, footType));
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
        const bessCenter = turf.destination(turf.point(privateSubCoord), bess_w / 2 + 0.05, -90, { units: "kilometers" }).geometry.coordinates;
        features.push(getRectPolygon(bessCenter, bess_w, bess_l, "bess_footprint"));
        features.push(turf.point(bessCenter, { type: "bess_compound", mwh: bess_mwh }));
        features.push(turf.lineString([bessCenter, privateSubCoord], { type: "33kv_radial" }));
    }

    // Spine
    if (inverters.length > 0) {
        let spineN = -90, spineS = 90;
        inverters.forEach(inv => {
            if (inv.coords[1] > spineN) spineN = inv.coords[1];
            if (inv.coords[1] < spineS) spineS = inv.coords[1];
        });
        if (privateSubCoord[1] > spineN) spineN = privateSubCoord[1];
        if (privateSubCoord[1] < spineS) spineS = privateSubCoord[1];
        features.push(turf.lineString([[privateSubCoord[0], spineS], [privateSubCoord[0], spineN]], { type: "33kv_radial" }));
        inverters.forEach(inv => {
            features.push(turf.lineString([inv.coords, [privateSubCoord[0], inv.coords[1]]], { type: "33kv_radial" }));
        });
    }

    state.currentGeoJSON = turf.featureCollection(features);
    const src = map.getSource("topology");
    if (src) src.setData(state.currentGeoJSON);

    if (features.length > 0) {
        const bbox = turf.bbox(state.currentGeoJSON);
        map.fitBounds(bbox, { padding: 60, duration: 800 });
    }

    updateExportCableLengthDisplay();

    // Refresh side-panel values
    renderTechSummary(stats);
    const fin = computeFinance(prefix, stats);
    state.lastFinance[prefix] = fin;
    renderFinance(prefix, fin);
    renderFinanceWarnings(prefix, fin, stats);
}

// ============================================================