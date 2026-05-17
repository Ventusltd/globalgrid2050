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
    el.textContent = km.toFixed(2) + " km";
}

function updateArrayRotationDisplay() {
    const el = $("out_array_rotation_deg");
    if (!el) return;
    const deg = Number.isFinite(state.arrayRotationDeg) ? state.arrayRotationDeg : 0;
    el.textContent = (((deg % 360) + 360) % 360).toFixed(0) + "°";
}

function rotateArrayBy(deltaDeg) {
    state.arrayRotationDeg = (((state.arrayRotationDeg || 0) + deltaDeg) % 360 + 360) % 360;
    state.cableRouteWaypoints = [];
    updateArrayRotationDisplay();
    redrawIfTopologyExists();
}

function resetArrayRotation() {
    state.arrayRotationDeg = 0;
    state.cableRouteWaypoints = [];
    updateArrayRotationDisplay();
    redrawIfTopologyExists();
}

function calculateStringInverterKvaFromInputs() {
    const modulesPerString = intVal("x_mods", 0);
    const stringsPerInverter = intVal("z_strings", 0);
    const moduleWp = num("mod_wp");
    const ratio = num("dc_ac_ratio") || 1.2;
    if (modulesPerString <= 0 || stringsPerInverter <= 0 || moduleWp <= 0 || ratio <= 0) return 0;
    return (modulesPerString * stringsPerInverter * moduleWp / 1000) / ratio;
}

function updateTopologyAbstractionDisplay() {
    const kvaEl = $("out_string_inverter_kva");
    if (kvaEl) kvaEl.textContent = calculateStringInverterKvaFromInputs().toFixed(1) + " kVA";
    const stringLayer = $("show_string_inverter_layer");
    if (stringLayer) stringLayer.checked = Boolean(state.showStringInverterLayer);
    const cbLayer = $("show_central_combiner_layer");
    if (cbLayer) cbLayer.checked = Boolean(state.showCentralCombinerLayer);
}

function applyTargetStringInverterKva() {
    const target = num("target_string_inverter_kva");
    const modulesPerString = intVal("x_mods", 0);
    const moduleWp = num("mod_wp");
    const ratio = num("dc_ac_ratio") || 1.2;
    if (target <= 0 || modulesPerString <= 0 || moduleWp <= 0 || ratio <= 0) return;
    const strings = Math.max(1, Math.round((target * ratio * 1000) / (modulesPerString * moduleWp)));
    const z = $("z_strings");
    if (z) {
        z.value = strings;
        z.dispatchEvent(new Event("input", { bubbles: true }));
    }
    updateTopologyAbstractionDisplay();
    redrawIfTopologyExists();
}

function updateCableRouteStatus() {
    const el = $("cable_route_status");
    if (!el) return;
    const count = Array.isArray(state.cableRouteWaypoints) ? state.cableRouteWaypoints.length : 0;
    if (state.cableRouteMode) {
        el.textContent = "Route mode active. Click map to add waypoints. Waypoints: " + count;
        el.style.color = "#00ffff";
    } else if (count > 0) {
        el.textContent = "Custom route active. Waypoints: " + count + ". Live length is calculated along route.";
        el.style.color = "#00ff88";
    } else {
        el.textContent = "No custom route. Export cable is direct unless waypoints are added.";
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
        <div class="stat-row"><span>Live Export Cable Length:</span><span class="stat-val cyan" id="out_export_cable_length_km">0.00 km</span></div>
        <div class="stat-row"><span>Array Rotation:</span><span class="stat-val orange" id="out_array_rotation_deg">0°</span></div>
        <div class="input-group"><label>Export Cable Extra Length km</label><input type="number" id="layout_export_extra_km" value="0" step="0.05" min="-0.2"></div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Moves the whole array further from or closer to the point of connection along the existing axis. Pick Up Array and cable route waypoints also recalculate this live length.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <h3 style="margin-top:0;color:#00ff88;border-bottom-color:#00ff88;">GIS Topology Layers</h3>
        <div class="stat-row"><span>Implied String Inverter:</span><span class="stat-val green" id="out_string_inverter_kva">0.0 kVA</span></div>
        <div class="input-group"><label>Target String Inverter kVA AC</label><input type="number" id="target_string_inverter_kva" value="250" step="5" min="1"></div>
        <button class="btn" id="btn_apply_string_kva" style="background:#00ff88;color:#001111;">Apply kVA to Strings / Inverter</button>
        <div style="display:flex;gap:6px;align-items:center;margin-top:7px;font-size:11px;color:var(--muted);">
            <input type="checkbox" id="show_string_inverter_layer" checked style="width:auto;"> <span>Show string inverter symbols</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:5px;font-size:11px;color:var(--muted);">
            <input type="checkbox" id="show_central_combiner_layer" checked style="width:auto;"> <span>Show central combiner box symbols</span>
        </div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            GIS abstraction only. String inverter kVA adjusts strings per inverter using module rating and DC/AC ratio. Central combiner boxes follow strings per combiner.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <button class="btn" id="btn_rotate_left_30" style="background:#222;color:#fff;">Rotate Left 30°</button>
        <button class="btn" id="btn_rotate_right_30" style="margin-top:6px;background:#222;color:#fff;">Rotate Right 30°</button>
        <button class="btn" id="btn_rotate_right_90" style="margin-top:6px;background:#ff9900;color:#000000;">Rotate 90°</button>
        <button class="btn" id="btn_reset_rotation" style="margin-top:6px;">Reset Rotation</button>
        <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Rotation keeps the grid point fixed and redraws the export cable. Custom cable waypoints are cleared when rotation changes.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <button class="btn" id="btn_pick_array" style="margin-top:8px;background:#00ffff;color:#001111;">Pick Up Array</button>
        <button class="btn" id="btn_reset_array_move" style="margin-top:6px;">Reset Array Location</button>
        <div id="array_move_status" style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Pick Up Array keeps the grid point fixed. Click anywhere on the map to place the array centre.
        </div>
        <div style="border-top:1px dashed #333;margin:8px 0;"></div>
        <button class="btn" id="btn_draw_cable_route" style="background:#ff9900;color:#000000;">Draw Cable Route</button>
        <button class="btn" id="btn_finish_cable_route" style="margin-top:6px;">Finish Route</button>
        <button class="btn" id="btn_clear_cable_route" style="margin-top:6px;">Clear Route</button>
        <div id="cable_route_status" style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            No custom route. Export cable is direct unless waypoints are added.
        </div>
    `;

    drawBtn.parentNode.insertBefore(box, drawBtn);
    updateExportCableLengthDisplay();
    updateArrayRotationDisplay();
    updateTopologyAbstractionDisplay();
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
    state.cableRouteMode = false;
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
    setArrayMoveStatus("Array reset to calculated default position.", false);
    redrawIfTopologyExists();
}

function placeArrayAtMapPoint(e) {
    if (!state.arrayMoveMode) return;
    if (!e || !e.lngLat) return;
    state.arrayOverrideCenter = [e.lngLat.lng, e.lngLat.lat];
    state.arrayMoveMode = false;
    setArrayMoveStatus("Array moved. Grid point stayed fixed and export cable length recalculated.", false);
    computeAndDraw();
}

function startCableRouteMode() {
    if (!state.activeDrawCenter) {
        updateCableRouteStatus();
        return;
    }
    state.arrayMoveMode = false;
    state.cableRouteMode = true;
    updateCableRouteStatus();
}

function finishCableRouteMode() {
    state.cableRouteMode = false;
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

function clearCableRoute() {
    state.cableRouteMode = false;
    state.cableRouteWaypoints = [];
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

function addCableRouteWaypoint(e) {
    if (!state.cableRouteMode) return;
    if (!e || !e.lngLat) return;
    state.cableRouteWaypoints.push([e.lngLat.lng, e.lngLat.lat]);
    updateCableRouteStatus();
    redrawIfTopologyExists();
}

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
    state.cableRouteMode = false;
    state.cableRouteWaypoints = [];
    computeAndDraw();
    updateSelectedSubstationDisplay();
    setArrayMoveStatus("Grid drawn. Use Pick Up Array to relocate the array while the grid point stays fixed.", false);
    updateCableRouteStatus();
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

    // Draw / Export
    $("btn_draw")?.addEventListener("click", triggerDrawAtCenter);
    $("btn_export")?.addEventListener("click", exportGeoJSON);

    // Array rotation
    $("btn_rotate_left_30")?.addEventListener("click", () => rotateArrayBy(-30));
    $("btn_rotate_right_30")?.addEventListener("click", () => rotateArrayBy(30));
    $("btn_rotate_right_90")?.addEventListener("click", () => rotateArrayBy(90));
    $("btn_reset_rotation")?.addEventListener("click", resetArrayRotation);

    // Topology abstraction
    $("btn_apply_string_kva")?.addEventListener("click", applyTargetStringInverterKva);
    $("show_string_inverter_layer")?.addEventListener("change", (e) => {
        state.showStringInverterLayer = Boolean(e.target.checked);
        redrawIfTopologyExists();
    });
    $("show_central_combiner_layer")?.addEventListener("change", (e) => {
        state.showCentralCombinerLayer = Boolean(e.target.checked);
        redrawIfTopologyExists();
    });

    // Array movement
    $("btn_pick_array")?.addEventListener("click", toggleArrayMoveMode);
    $("btn_reset_array_move")?.addEventListener("click", resetArrayLocation);

    // Cable route waypoints
    $("btn_draw_cable_route")?.addEventListener("click", startCableRouteMode);
    $("btn_finish_cable_route")?.addEventListener("click", finishCableRouteMode);
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
        state.cableRouteWaypoints = [];
        redrawIfTopologyExists();
    });
    $("layout_export_extra_km")?.addEventListener("change", () => {
        state.arrayOverrideCenter = null;
        state.cableRouteWaypoints = [];
        redrawIfTopologyExists();
    });

    // Global recalc on input changes (debounced)
    document.querySelectorAll("input, select").forEach(el => {
        el.addEventListener("input", () => {
            updateTopologyAbstractionDisplay();
            recalcDebounced();
        });
        el.addEventListener("change", () => {
            updateTopologyAbstractionDisplay();
            recalcDebounced();
        });
    });
}

function wireMapMoveEvents() {
    if (!map || map.__arrayMoveWired) return;
    map.__arrayMoveWired = true;
    map.on("click", (e) => {
        if (state.cableRouteMode) addCableRouteWaypoint(e);
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
    setArrayMoveStatus("Draw a grid first. Then use Pick Up Array to relocate the array centre.", false);
    updateExportCableLengthDisplay();
    updateArrayRotationDisplay();
    updateTopologyAbstractionDisplay();
    updateCableRouteStatus();
}

// Libraries loaded via defer, so DOMContentLoaded is the right signal.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}