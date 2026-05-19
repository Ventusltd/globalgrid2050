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

function wireAtlasV8GridToggleButtons() {
    document.querySelectorAll(".atlas-voltage-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleAtlasV8GridLayer(btn.dataset.atlasVoltage);
            updateAtlasV8GridToggleButtons();
        });
    });
    updateAtlasV8GridToggleButtons();
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