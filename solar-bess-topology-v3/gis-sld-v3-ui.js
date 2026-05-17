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
        <div class="input-group"><label>Export Cable Extra Length km</label><input type="number" id="layout_export_extra_km" value="0" step="0.05" min="-0.2"></div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Moves the whole array further from or closer to the point of connection along the existing axis. It does not rotate the array or change the internal 33kV radial topology.
        </div>
        <button class="btn" id="btn_pick_array" style="margin-top:8px;background:#00ffff;color:#001111;">Pick Up Array</button>
        <button class="btn" id="btn_reset_array_move" style="margin-top:6px;">Reset Array Location</button>
        <div id="array_move_status" style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:6px;">
            Pick Up Array keeps the grid point fixed. Click anywhere on the map to place the array centre.
        </div>
    `;

    drawBtn.parentNode.insertBefore(box, drawBtn);
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
    state.arrayMoveMode = !state.arrayMoveMode;
    setArrayMoveStatus(
        state.arrayMoveMode ? "Move mode active. Click the map where the array centre should move." : "Move mode cancelled.",
        state.arrayMoveMode
    );
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
    setArrayMoveStatus("Array moved. Grid point stayed fixed and export cable was redrawn.", false);
    computeAndDraw();
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
    computeAndDraw();
    updateSelectedSubstationDisplay();
    setArrayMoveStatus("Grid drawn. Use Pick Up Array to relocate the array while the grid point stays fixed.", false);
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

    // Array movement
    $("btn_pick_array")?.addEventListener("click", toggleArrayMoveMode);
    $("btn_reset_array_move")?.addEventListener("click", resetArrayLocation);

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
        redrawIfTopologyExists();
    });
    $("layout_export_extra_km")?.addEventListener("change", () => {
        state.arrayOverrideCenter = null;
        redrawIfTopologyExists();
    });

    // Global recalc on input changes (debounced)
    document.querySelectorAll("input, select").forEach(el => {
        el.addEventListener("input", recalcDebounced);
        el.addEventListener("change", recalcDebounced);
    });
}

// ============================================================
// BOOT
// ============================================================
function boot() {
    wireEvents();
    initMap();
    updateSelectedSubstationDisplay();
    renderBenchmark();
    setArrayMoveStatus("Draw a grid first. Then use Pick Up Array to relocate the array centre.", false);
}

// Libraries loaded via defer, so DOMContentLoaded is the right signal.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}