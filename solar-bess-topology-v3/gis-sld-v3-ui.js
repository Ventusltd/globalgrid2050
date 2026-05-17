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
    computeAndDraw();
    updateSelectedSubstationDisplay();
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
}

// Libraries loaded via defer, so DOMContentLoaded is the right signal.
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
} else {
    boot();
}
