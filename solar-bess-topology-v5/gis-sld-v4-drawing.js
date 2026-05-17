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