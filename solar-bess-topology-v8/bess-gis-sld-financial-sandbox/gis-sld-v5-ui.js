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
    syncMapSizeInputFromActiveTab?.();
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
// GIS MAP SEARCH: OPERATING ASSETS AND SUBSTATIONS
// ============================================================
let gisSearchReady = false;
let gisAssetSearchIndex = [];
let gisSubstationSearchIndex = [];

function gisSearchEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function gisSearchPick(prop, keys, fallback = "") {
    for (const key of keys) {
        if (prop && prop[key] !== undefined && prop[key] !== null && String(prop[key]).trim() !== "") return prop[key];
    }
    return fallback;
}

function gisSearchValidPoint(feature) {
    return feature && feature.geometry && feature.geometry.type === "Point" && Array.isArray(feature.geometry.coordinates);
}

async function buildGisSearchIndexes() {
    if (gisSearchReady) return;
    try {
        const [repdRes, subsRes] = await Promise.all([
            fetch("/dist/repd_master.json", { cache: "no-cache" }),
            fetch(SUBSTATIONS_URL, { cache: "no-cache" })
        ]);

        const repd = repdRes.ok ? await repdRes.json() : { features: [] };
        const subsRaw = subsRes.ok ? await subsRes.json() : { features: [] };
        const subs = normaliseSubstations?.(subsRaw) || { features: [] };

        gisAssetSearchIndex = (repd.features || [])
            .filter(gisSearchValidPoint)
            .filter(f => {
                const p = f.properties || {};
                return String(p.status || "").toLowerCase() === "operational" &&
                    (["solar", "bess"].includes(String(p.tech || "")) || ["Wind Onshore", "Wind Offshore"].includes(String(p.raw_tech || "")));
            })
            .map(f => {
                const p = f.properties || {};
                const name = gisSearchPick(p, ["name", "project", "site", "Site Name"], "Operating asset");
                const tech = gisSearchPick(p, ["raw_tech", "tech"], "Unknown");
                const capacity = Number(gisSearchPick(p, ["capacity", "capacity_mw"], 0)) || 0;
                return {
                    kind: "asset",
                    feature: f,
                    name,
                    tech,
                    capacity,
                    label: `${name} ${tech} ${capacity} MW`.toLowerCase()
                };
            });

        gisSubstationSearchIndex = (subs.features || [])
            .filter(gisSearchValidPoint)
            .map(f => {
                const p = f.properties || {};
                const name = gisSearchPick(p, ["name_clean", "name", "Name", "substation", "Substation"], "Substation");
                const voltage = gisSearchPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV"], "Unknown");
                return {
                    kind: "substation",
                    feature: f,
                    name,
                    voltage,
                    capacity: 0,
                    label: `${name} ${voltage} substation`.toLowerCase()
                };
            });

        gisSearchReady = true;
    } catch (err) {
        console.error("GIS search index failed", err);
        setFetchStatus?.("Search index unavailable", true);
    }
}

function gisSearchResultsEl() {
    return $("gis_search_results");
}

function hideGisSearchResults() {
    const el = gisSearchResultsEl();
    if (el) el.style.display = "none";
}

function showGisSearchResults(html) {
    const el = gisSearchResultsEl();
    if (!el) return;
    el.innerHTML = html;
    el.style.display = "block";
}

function renderGisSearchResults(query) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) {
        hideGisSearchResults();
        return;
    }

    const assetMatches = gisAssetSearchIndex
        .filter(item => item.label.includes(q))
        .sort((a, b) => b.capacity - a.capacity)
        .slice(0, 8);
    const subMatches = gisSubstationSearchIndex
        .filter(item => item.label.includes(q))
        .slice(0, 8);
    const matches = [...assetMatches, ...subMatches].slice(0, 12);

    if (!matches.length) {
        showGisSearchResults('<div class="gis-search-result-empty">No sites or substations found</div>');
        return;
    }

    showGisSearchResults(matches.map((item, idx) => {
        const meta = item.kind === "asset" ? `${gisSearchEscape(item.tech)} · ${item.capacity || "n/a"} MW` : `Substation · ${gisSearchEscape(item.voltage)}`;
        const cls = item.kind === "asset" ? "asset" : "substation";
        return `<button class="gis-search-result ${cls}" data-gis-search-idx="${idx}">
            <strong>${gisSearchEscape(item.name)}</strong>
            <span>${meta}</span>
        </button>`;
    }).join(""));

    const el = gisSearchResultsEl();
    if (!el) return;
    el.querySelectorAll("[data-gis-search-idx]").forEach((btn, idx) => {
        btn.addEventListener("click", () => flyToGisSearchItem(matches[idx]));
    });
}

function flyToGisSearchItem(item) {
    if (!map || !item || !gisSearchValidPoint(item.feature)) return;
    const coords = item.feature.geometry.coordinates.slice();
    map.flyTo({ center: coords, zoom: item.kind === "asset" ? 11.5 : 13.5, duration: 1200, essential: true });
    hideGisSearchResults();
    const input = $("gis_search_input");
    if (input) input.value = item.name;

    setTimeout(() => {
        if (item.kind === "asset") {
            const p = item.feature.properties || {};
            const name = gisSearchPick(p, ["name", "project", "site", "Site Name"], "Operating asset");
            const tech = gisSearchPick(p, ["raw_tech", "tech"], "Unknown technology");
            const status = gisSearchPick(p, ["status"], "Unknown status");
            const capacity = gisSearchPick(p, ["capacity", "capacity_mw"], "n/a");
            showPopup(coords, `
                <div style="margin-bottom:5px;color:#00ff88;font-weight:bold;font-size:13px;text-transform:uppercase;">Operating Asset</div>
                <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(name)}</span></div>
                <div class="popup-row"><span>Technology:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(tech)}</span></div>
                <div class="popup-row"><span>Status:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(status)}</span></div>
                <div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(capacity)} MW</span></div>
            `);
        } else {
            const p = item.feature.properties || {};
            const name = gisSearchPick(p, ["name_clean", "name", "Name", "substation", "Substation"], "Substation");
            const voltage = gisSearchPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV"], "Unknown");
            showPopup(coords, `
                <div style="margin-bottom:5px;color:#ff3333;font-weight:bold;font-size:13px;text-transform:uppercase;">Substation</div>
                <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(name)}</span></div>
                <div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${gisSearchEscape(voltage)}</span></div>
                <div class="popup-row"><span>Lon:</span><span class="popup-val" style="color:#fff;">${Number(coords[0]).toFixed(6)}</span></div>
                <div class="popup-row"><span>Lat:</span><span class="popup-val" style="color:#fff;">${Number(coords[1]).toFixed(6)}</span></div>
            `);
        }
    }, 1250);
}

async function wireGisMapSearch() {
    const input = $("gis_search_input");
    const btn = $("gis_search_btn");
    if (!input || !btn) return;

    input.addEventListener("focus", buildGisSearchIndexes);
    input.addEventListener("input", async () => {
        await buildGisSearchIndexes();
        renderGisSearchResults(input.value);
    });
    input.addEventListener("keydown", async e => {
        if (e.key === "Enter") {
            await buildGisSearchIndexes();
            const first = gisSearchResultsEl()?.querySelector(".gis-search-result");
            if (first) first.click();
            else renderGisSearchResults(input.value);
        }
        if (e.key === "Escape") hideGisSearchResults();
    });
    btn.addEventListener("click", async () => {
        await buildGisSearchIndexes();
        const first = gisSearchResultsEl()?.querySelector(".gis-search-result");
        if (first) first.click();
        else renderGisSearchResults(input.value);
    });
    document.addEventListener("click", e => {
        const wrap = $("gis_map_search");
        if (wrap && !wrap.contains(e.target)) hideGisSearchResults();
    });
}


// ============================================================
// V7 SITE INTELLIGENCE PANEL
// ============================================================
const siteIntelData = {
    ready: false,
    loading: false,
    assets: [],
    substations: [],
    grid: {
        "66 kV": [],
        "132 kV": [],
        "275 kV": [],
        "400 kV": []
    }
};

const siteIntelGridUrls = {
    "66 kV": "/repd_grid_atlasv8/data/grid_66kv.geojson",
    "132 kV": "/repd_grid_atlasv8/data/grid_132kv.geojson",
    "275 kV": "/repd_grid_atlasv8/data/grid_275kv.geojson",
    "400 kV": "/repd_grid_atlasv8/data/grid_400kv.geojson"
};

function siteIntelPick(prop, keys, fallback = "") {
    for (const key of keys) {
        if (prop && prop[key] !== undefined && prop[key] !== null && String(prop[key]).trim() !== "") return prop[key];
    }
    return fallback;
}

function siteIntelEscape(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function siteIntelValidPoint(feature) {
    return feature && feature.geometry && feature.geometry.type === "Point" && Array.isArray(feature.geometry.coordinates);
}

function siteIntelFeatureCollection(raw) {
    if (!raw) return { type: "FeatureCollection", features: [] };
    if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) return raw;
    if (Array.isArray(raw)) return { type: "FeatureCollection", features: raw };
    return { type: "FeatureCollection", features: [] };
}

function siteIntelFlattenLines(features) {
    const lines = [];
    (features || []).forEach(feature => {
        if (!feature || !feature.geometry) return;
        const prop = feature.properties || {};
        if (feature.geometry.type === "LineString") {
            lines.push({ type: "Feature", geometry: feature.geometry, properties: prop });
        } else if (feature.geometry.type === "MultiLineString") {
            feature.geometry.coordinates.forEach(coords => {
                lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: prop });
            });
        }
    });
    return lines;
}

function showSiteIntelPanel(html) {
    const panel = $("site_intel_panel");
    const body = $("site_intel_body");
    if (!panel || !body) return;
    body.innerHTML = html;
    panel.classList.remove("collapsed");
}

function hideSiteIntelPanel() {
    const panel = $("site_intel_panel");
    if (panel) panel.classList.add("collapsed");
}

async function loadSiteIntelData() {
    if (siteIntelData.ready || siteIntelData.loading) return;
    siteIntelData.loading = true;

    try {
        const [repdRes, subsRes, ...gridResponses] = await Promise.all([
            fetch("/dist/repd_master.json", { cache: "no-cache" }),
            fetch(SUBSTATIONS_URL, { cache: "no-cache" }),
            fetch(siteIntelGridUrls["66 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["132 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["275 kV"], { cache: "no-cache" }),
            fetch(siteIntelGridUrls["400 kV"], { cache: "no-cache" })
        ]);

        const repd = repdRes.ok ? await repdRes.json() : { features: [] };
        const subsRaw = subsRes.ok ? await subsRes.json() : { features: [] };
        const subs = typeof normaliseSubstations === "function" ? normaliseSubstations(subsRaw) : siteIntelFeatureCollection(subsRaw);
        const gridKeys = ["66 kV", "132 kV", "275 kV", "400 kV"];

        siteIntelData.assets = (siteIntelFeatureCollection(repd).features || [])
            .filter(siteIntelValidPoint)
            .filter(feature => {
                const p = feature.properties || {};
                const status = String(siteIntelPick(p, ["status", "Status"], "")).toLowerCase();
                const tech = String(siteIntelPick(p, ["tech"], "")).toLowerCase();
                const rawTech = String(siteIntelPick(p, ["raw_tech", "Technology Type"], ""));
                return status === "operational" && (tech === "solar" || tech === "bess" || rawTech === "Wind Onshore" || rawTech === "Wind Offshore");
            });

        siteIntelData.substations = (subs.features || []).filter(siteIntelValidPoint);

        for (let i = 0; i < gridKeys.length; i++) {
            const key = gridKeys[i];
            const res = gridResponses[i];
            const raw = res && res.ok ? await res.json() : { features: [] };
            siteIntelData.grid[key] = siteIntelFlattenLines(siteIntelFeatureCollection(raw).features);
        }

        siteIntelData.ready = true;
    } catch (err) {
        console.error("Site intelligence data load failed", err);
        showSiteIntelPanel(`<div class="site-intel-warning">Site intelligence data unavailable: ${siteIntelEscape(err.message || err)}</div>`);
    } finally {
        siteIntelData.loading = false;
    }
}

function siteIntelAssetGroup(feature) {
    const p = feature.properties || {};
    const tech = String(siteIntelPick(p, ["tech"], "")).toLowerCase();
    const rawTech = String(siteIntelPick(p, ["raw_tech", "Technology Type"], ""));
    if (tech === "solar") return "Operating Solar PV";
    if (tech === "bess") return "Operating Battery Storage";
    if (rawTech === "Wind Onshore") return "Operating Onshore Wind";
    if (rawTech === "Wind Offshore") return "Operating Offshore Wind";
    return "Operating Asset";
}

function nearestPointFeature(point, features, predicate) {
    let best = null;
    (features || []).forEach(feature => {
        if (!siteIntelValidPoint(feature)) return;
        if (predicate && !predicate(feature)) return;
        const d = turf.distance(point, turf.point(feature.geometry.coordinates), { units: "kilometers" });
        if (!best || d < best.distanceKm) best = { feature, distanceKm: d };
    });
    return best;
}

function nearestLineFeature(point, features) {
    let best = null;
    (features || []).forEach(feature => {
        if (!feature || !feature.geometry || feature.geometry.type !== "LineString") return;
        try {
            const snapped = turf.nearestPointOnLine(feature, point, { units: "kilometers" });
            const d = Number(snapped.properties && snapped.properties.dist);
            if (Number.isFinite(d) && (!best || d < best.distanceKm)) best = { feature, distanceKm: d };
        } catch (err) {
            // Ignore malformed line fragments.
        }
    });
    return best;
}

function formatKm(value) {
    if (!Number.isFinite(value)) return "n/a";
    if (value < 1) return `${Math.round(value * 1000)} m`;
    return `${value.toFixed(1)} km`;
}

function formatCapacity(feature) {
    const p = feature?.properties || {};
    const capacity = Number(siteIntelPick(p, ["capacity", "capacity_mw", "Capacity (MW)"], NaN));
    return Number.isFinite(capacity) && capacity > 0 ? `${capacity.toFixed(capacity >= 100 ? 0 : 1)} MW` : "n/a";
}

function assetName(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["name", "project", "site", "Site Name", "Project Name"], "Operating asset");
}

function substationName(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["name_clean", "name", "Name", "site_name", "Site Name", "substation", "Substation"], "Substation");
}

function substationVoltage(feature) {
    const p = feature?.properties || {};
    return siteIntelPick(p, ["voltage_clean", "voltage", "Voltage", "kv", "kV", "Voltage kV"], "Unknown");
}

function siteIntelRow(label, main, meta, danger = false) {
    return `<div class="site-intel-row${danger ? " warn" : ""}">
        <div class="site-intel-label">${siteIntelEscape(label)}</div>
        <div class="site-intel-main">${siteIntelEscape(main)}</div>
        <div class="site-intel-meta">${siteIntelEscape(meta)}</div>
    </div>`;
}

function siteIntelOpportunityNotes(results) {
    const notes = [];
    const hvDistances = [results.grid["132 kV"], results.grid["275 kV"], results.grid["400 kV"]]
        .filter(Boolean)
        .map(item => item.distanceKm);
    const minHv = hvDistances.length ? Math.min(...hvDistances) : NaN;
    const nearestSolar = results.assets.solar?.distanceKm;
    const nearestBess = results.assets.bess?.distanceKm;

    if (Number.isFinite(minHv) && minHv <= 5) notes.push("Near high voltage corridor. Worth deeper grid screening.");
    if (Number.isFinite(minHv) && minHv > 15) notes.push("High voltage corridor not immediately nearby. Route and connection assumptions need care.");
    if (Number.isFinite(nearestSolar) && nearestSolar <= 10) notes.push("Existing operating solar nearby. Compare pattern, grid route and project scale.");
    if (Number.isFinite(nearestBess) && nearestBess <= 15) notes.push("Operating battery storage nearby. Check co location or grid constraint context.");
    if (!notes.length) notes.push("Use as early spatial screening only. Formal grid and design studies still required.");
    return notes;
}

async function inspectSiteIntelligenceAt(lngLat) {
    if (!lngLat || typeof turf === "undefined") return;
    showSiteIntelPanel(`<div class="site-intel-loading">Loading site intelligence…</div>`);
    await loadSiteIntelData();
    if (!siteIntelData.ready) return;

    const point = turf.point([lngLat.lng, lngLat.lat]);
    const results = {
        assets: {
            solar: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Solar PV"),
            bess: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Battery Storage"),
            onshore: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Onshore Wind"),
            offshore: nearestPointFeature(point, siteIntelData.assets, f => siteIntelAssetGroup(f) === "Operating Offshore Wind")
        },
        substation: nearestPointFeature(point, siteIntelData.substations),
        grid: {}
    };

    Object.keys(siteIntelData.grid).forEach(key => {
        results.grid[key] = nearestLineFeature(point, siteIntelData.grid[key]);
    });

    const rows = [];
    rows.push(siteIntelRow("Clicked location", `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`, "Reference point only"));

    const addAssetRow = (label, item) => {
        if (!item) rows.push(siteIntelRow(label, "No data", "Layer data unavailable", true));
        else rows.push(siteIntelRow(label, assetName(item.feature), `${formatKm(item.distanceKm)} · ${formatCapacity(item.feature)}`));
    };

    addAssetRow("Nearest solar", results.assets.solar);
    addAssetRow("Nearest BESS", results.assets.bess);
    addAssetRow("Nearest onshore wind", results.assets.onshore);
    addAssetRow("Nearest offshore wind", results.assets.offshore);

    if (results.substation) {
        rows.push(siteIntelRow("Nearest substation", substationName(results.substation.feature), `${formatKm(results.substation.distanceKm)} · ${substationVoltage(results.substation.feature)}`));
    } else {
        rows.push(siteIntelRow("Nearest substation", "No data", "Substation data unavailable", true));
    }

    ["66 kV", "132 kV", "275 kV", "400 kV"].forEach(key => {
        const item = results.grid[key];
        rows.push(siteIntelRow(`Nearest ${key}`, item ? formatKm(item.distanceKm) : "No data", "Atlas V8 corridor reference", !item));
    });

    const notes = siteIntelOpportunityNotes(results).map(note => `<li>${siteIntelEscape(note)}</li>`).join("");

    showSiteIntelPanel(`
        <div class="site-intel-section-title">Nearest infrastructure context</div>
        ${rows.join("")}
        <div class="site-intel-section-title">Screening notes</div>
        <ul class="site-intel-notes">${notes}</ul>
        <div class="site-intel-disclaimer">Indicative spatial screening only. Distances do not confirm capacity, rights, routes, consent or connection feasibility.</div>
    `);
}

function wireSiteIntelligencePanel() {
    $("site_intel_close")?.addEventListener("click", hideSiteIntelPanel);
    if (!map) return;
    map.on("click", e => {
        const target = e.originalEvent && e.originalEvent.target;
        if (target && target.closest && target.closest(".map-controls, .map-tool-overlay, .legend, .gis-map-search, .site-intel-panel")) return;
        inspectSiteIntelligenceAt(e.lngLat);
    });
}

// ============================================================
// ARRAY VISIBILITY AND TARGET MWp SIZING
// ============================================================
const TOPOLOGY_LAYER_IDS_FOR_ARRAY_TOGGLE = [
    "overall_boundary_fill",
    "overall_boundary_line",
    "footprints",
    "footprints_outline",
    "export_cable",
    "radial_spine",
    "export_cable_pins",
    "inverters",
    "substation"
];

function setTopologyLayerVisibility(visible) {
    if (!map) return;
    TOPOLOGY_LAYER_IDS_FOR_ARRAY_TOGGLE.forEach(layerId => {
        if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
        }
    });
}

function updateArrayToggleButton() {
    const btn = $("btn_array_toggle");
    if (!btn) return;
    const visible = state.arrayVisible !== false;
    btn.textContent = visible ? "ARRAY ON" : "ARRAY OFF";
    btn.classList.toggle("active", visible);
}

function toggleArrayVisibility() {
    state.arrayVisible = state.arrayVisible === false;
    setTopologyLayerVisibility(state.arrayVisible !== false);
    updateArrayToggleButton();
}

function syncMapSizeInputFromActiveTab() {
    const mapInput = $("map_target_dc_mwp");
    if (!mapInput) return;
    const source = state.activeTab === "string" ? $("target_dc_mwp") : $("target_dc_mwp_c");
    mapInput.value = source?.value || "";
}

function setMapSizeStatus(text, ok = true) {
    const el = $("map_size_status");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#00ff88" : "#ff9900";
}

function setInputValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyTargetDcMwpFromActiveTab(source) {
    const suffix = state.activeTab === "string" ? "" : "_c";
    const targetInput = state.activeTab === "string" ? $("target_dc_mwp") : $("target_dc_mwp_c");
    const mapInput = $("map_target_dc_mwp");
    const raw = source === "map" ? parseFloat(mapInput?.value) : parseFloat(targetInput?.value);
    const targetMwp = Number.isFinite(raw) && raw > 0 ? raw : 0;

    if (!targetMwp) {
        setMapSizeStatus("Enter MWp DC", false);
        return;
    }

    if (state.activeTab === "string") {
        const modWp = num("mod_wp");
        const x = intVal("x_mods");
        const z = intVal("z_strings");
        const y = intVal("y_invs");
        const currentSkidsPerRing = Math.max(1, intVal("s_subs", 1));
        if (modWp <= 0 || x <= 0 || z <= 0 || y <= 0) {
            setMapSizeStatus("Check string inputs", false);
            return;
        }
        const dcPerSkidMwp = (modWp * x * z * y) / 1_000_000;
        const desiredSkids = Math.max(1, Math.ceil(targetMwp / dcPerSkidMwp));
        const rings = Math.max(1, Math.ceil(desiredSkids / currentSkidsPerRing));
        const skidsPerRing = Math.max(1, Math.ceil(desiredSkids / rings));
        const actualSkids = skidsPerRing * rings;
        const actualMwp = actualSkids * dcPerSkidMwp;

        setInputValue("s_subs", skidsPerRing);
        setInputValue("b_cols", rings);
        if (targetInput) targetInput.value = targetMwp;
        if (mapInput) mapInput.value = targetMwp;
        setMapSizeStatus(`String ${actualMwp.toFixed(1)} MWp via ${actualSkids} skids`, true);
    } else {
        const invDcMwp = getCentralInverterDcMwdc();
        const invPerSkid = Math.max(1, intVal("inv_per_mv_c", 1));
        const currentSkidsPerRing = Math.max(1, intVal("mv_per_ring_c", 1));
        if (invDcMwp <= 0 || invPerSkid <= 0) {
            setMapSizeStatus("Check central inputs", false);
            return;
        }
        const desiredInverters = Math.max(1, Math.ceil(targetMwp / invDcMwp));
        const desiredSkids = Math.max(1, Math.ceil(desiredInverters / invPerSkid));
        const rings = Math.max(1, Math.ceil(desiredSkids / currentSkidsPerRing));
        const skidsPerRing = Math.max(1, Math.ceil(desiredSkids / rings));
        const actualInverters = invPerSkid * skidsPerRing * rings;
        const actualMwp = actualInverters * invDcMwp;

        setInputValue("mv_per_ring_c", skidsPerRing);
        setInputValue("rings_c", rings);
        if (targetInput) targetInput.value = targetMwp;
        if (mapInput) mapInput.value = targetMwp;
        setMapSizeStatus(`Central ${actualMwp.toFixed(1)} MWp via ${actualInverters} inverter blocks`, true);
    }

    state.arrayOverrideCenter = null;
    state.suppressNextMapFit = true;
    redrawIfTopologyExists();
    setTopologyLayerVisibility(state.arrayVisible !== false);
    updateArrayToggleButton();
}

function wireArraySizingControls() {
    $("btn_array_toggle")?.addEventListener("click", toggleArrayVisibility);
    $("btn_map_apply_size")?.addEventListener("click", () => applyTargetDcMwpFromActiveTab("map"));
    $("map_target_dc_mwp")?.addEventListener("keydown", e => {
        if (e.key === "Enter") applyTargetDcMwpFromActiveTab("map");
    });
    $("target_dc_mwp")?.addEventListener("change", () => applyTargetDcMwpFromActiveTab("panel"));
    $("target_dc_mwp_c")?.addEventListener("change", () => applyTargetDcMwpFromActiveTab("panel"));
    updateArrayToggleButton();
    syncMapSizeInputFromActiveTab();
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


function readAssetFilterCapacityValue(id) {
    const el = $(id);
    if (!el || String(el.value || "").trim() === "") return null;
    const value = Number(el.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
}

function updateAtlasV8OperatingAssetDropdown() {
    const select = $("asset_layer_select");
    if (select) select.value = atlasV8AssetFilterState?.selected || "off";
    const statusSelect = $("asset_status_select");
    if (statusSelect) statusSelect.value = atlasV8AssetFilterState?.status || "all";
    const minInput = $("asset_min_mw");
    const maxInput = $("asset_max_mw");
    if (minInput && Number.isFinite(atlasV8AssetFilterState?.minMw)) minInput.value = atlasV8AssetFilterState.minMw;
    if (maxInput && Number.isFinite(atlasV8AssetFilterState?.maxMw)) maxInput.value = atlasV8AssetFilterState.maxMw;
}

function applyAssetDropdownFromControls() {
    const selected = $("asset_layer_select")?.value || "off";
    const status = $("asset_status_select")?.value || "all";
    let minMw = readAssetFilterCapacityValue("asset_min_mw");
    let maxMw = readAssetFilterCapacityValue("asset_max_mw");
    if (Number.isFinite(minMw) && Number.isFinite(maxMw) && minMw > maxMw) {
        const temp = minMw;
        minMw = maxMw;
        maxMw = temp;
        if ($("asset_min_mw")) $("asset_min_mw").value = minMw;
        if ($("asset_max_mw")) $("asset_max_mw").value = maxMw;
    }
    applyAtlasV8AssetDropdownFilter?.(selected, status, minMw, maxMw);
    updateAtlasV8OperatingAssetDropdown();
}

function wireAtlasV8PipelineDropdownWithStatus() {
    $("asset_layer_select")?.addEventListener("change", applyAssetDropdownFromControls);
    $("asset_status_select")?.addEventListener("change", applyAssetDropdownFromControls);
    $("btn_asset_filter_apply")?.addEventListener("click", applyAssetDropdownFromControls);
    ["asset_min_mw", "asset_max_mw"].forEach(id => {
        $(id)?.addEventListener("keydown", e => {
            if (e.key === "Enter") applyAssetDropdownFromControls();
        });
        $(id)?.addEventListener("change", applyAssetDropdownFromControls);
    });
    updateAtlasV8OperatingAssetDropdown();
}

function updateAtlasV8OperatingAssetToggleButtons() {
    const labels = {
        "solar_operational": "SOLAR OP",
        "wind_onshore_operational": "ONSHORE WIND",
        "wind_offshore_operational": "OFFSHORE WIND",
        "bess_operational": "BESS OP"
    };
    Object.keys(labels).forEach(assetKey => {
        const btn = $(`btn_asset_${assetKey}`);
        if (!btn) return;
        const visible = atlasV8OperatingAssetVisibility?.[assetKey] === true;
        btn.textContent = `${labels[assetKey]} ${visible ? "ON" : "OFF"}`;
        btn.classList.toggle("active", visible);
    });
}

function wireAtlasV8OperatingAssetToggleButtons() {
    document.querySelectorAll(".asset-layer-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            toggleAtlasV8OperatingAssetLayer(btn.dataset.assetLayer);
            updateAtlasV8OperatingAssetToggleButtons();
        });
    });
    updateAtlasV8OperatingAssetToggleButtons();
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
function toggleMapExpand() {
    const panel = document.querySelector(".panel-right");
    const btn = $("btn_map_expand");
    if (!panel) return;
    const active = !panel.classList.contains("map-expanded");
    panel.classList.toggle("map-expanded", active);
    document.body.classList.toggle("map-expanded", active);
    if (btn) {
        btn.textContent = active ? "MAP MIN" : "MAP MAX";
        btn.classList.toggle("active", active);
    }
    setTimeout(() => { if (map && typeof map.resize === "function") map.resize(); }, 150);
}

function toggleKeyCollapse() {
    const legend = $("map_legend");
    const btn = $("btn_key_toggle");
    if (!legend) return;
    const hidden = !legend.classList.contains("key-collapsed");
    legend.classList.toggle("key-collapsed", hidden);
    if (btn) {
        btn.textContent = hidden ? "KEY OFF" : "KEY ON";
        btn.classList.toggle("active", !hidden);
    }
}
function toggleMapToolsOverlay() {
    const overlay = $("map_tool_overlay");
    const btn = $("btn_map_tools_toggle");
    if (!overlay || !btn) return;
    const collapsed = !overlay.classList.contains("tools-collapsed");
    overlay.classList.toggle("tools-collapsed", collapsed);
    btn.textContent = collapsed ? "TOOLS OFF" : "TOOLS ON";
    btn.classList.toggle("active", !collapsed);
}

function wireMapToolOverlayButtons() {
    $("btn_map_tools_toggle")?.addEventListener("click", toggleMapToolsOverlay);
    $("btn_map_draw")?.addEventListener("click", triggerDrawAtCenter);
    $("btn_map_pick_array")?.addEventListener("click", toggleArrayMoveMode);
    $("btn_map_drop_pins")?.addEventListener("click", toggleCablePinMode);
    $("btn_map_draw_route")?.addEventListener("click", commitCablePinRoute);
    $("btn_map_rotate_left")?.addEventListener("click", () => rotateArrayBy(-30));
    $("btn_map_rotate_right")?.addEventListener("click", () => rotateArrayBy(30));
    $("btn_map_rotate_90")?.addEventListener("click", () => rotateArrayBy(90));
    $("btn_map_reset_rotation")?.addEventListener("click", resetArrayRotation);
    $("btn_map_reset_array")?.addEventListener("click", resetArrayLocation);
    $("btn_map_nudge_up")?.addEventListener("click", () => nudgeArray(0));
    $("btn_map_nudge_right")?.addEventListener("click", () => nudgeArray(90));
    $("btn_map_nudge_down")?.addEventListener("click", () => nudgeArray(180));
    $("btn_map_nudge_left")?.addEventListener("click", () => nudgeArray(270));
    $("btn_map_undo_pin")?.addEventListener("click", undoCablePin);
    $("btn_map_clear_route")?.addEventListener("click", clearCableRoute);
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
wireAtlasV8PipelineDropdownWithStatus();
$("btn_map_expand")?.addEventListener("click", toggleMapExpand);
$("btn_key_toggle")?.addEventListener("click", toggleKeyCollapse);
$("btn_print_report")?.addEventListener("click", () => window.print());
wireMapToolOverlayButtons();
wireArraySizingControls();
wireGisMapSearch();
wireSiteIntelligencePanel();




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

// GLOBALGRID2050 GIS SLD PRINT MAP PACK
function sleepForPrintPack(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setLayerVisibilityForPrintPack(layerId, visible) {
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function setAtlasLayersDefaultOff() {
    if (typeof atlasV8GridLayerVisibility === "undefined") return;
    Object.keys(atlasV8GridLayerVisibility).forEach(voltageKey => {
        atlasV8GridLayerVisibility[voltageKey] = false;
        const layerId = atlasV8GridLayerIds?.[voltageKey];
        if (layerId) setLayerVisibilityForPrintPack(layerId, false);
    });
    updateAtlasV8GridToggleButtons?.();
    updateLegend?.();
}

function setSubsDefaultOff() {
    if (typeof state === "undefined") return;
    state.subsVisible = false;
    setLayerVisibilityForPrintPack("l-subs", false);
    updateSubsToggleButton?.();
    updateLegend?.();
}

function enforceCleanDefaultMapLayers() {
    setAtlasLayersDefaultOff();
    setSubsDefaultOff();
}

function getMapPrintState() {
    if (!map) return null;
    return {
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        satActive: !!state.satActive,
        subsVisible: !!state.subsVisible,
        atlas: typeof atlasV8GridLayerVisibility !== "undefined" ? { ...atlasV8GridLayerVisibility } : {},
        keyCollapsed: $("map_legend")?.classList.contains("key-collapsed") || false,
        toolsCollapsed: $("map_tool_overlay")?.classList.contains("tools-collapsed") || false,
        mapExpanded: document.body.classList.contains("map-expanded")
    };
}

async function restoreMapPrintState(saved) {
    if (!map || !saved) return;

    if (typeof state !== "undefined") {
        state.satActive = saved.satActive;
        state.subsVisible = saved.subsVisible;
    }

    setLayerVisibilityForPrintPack("l-sat", saved.satActive);
    setLayerVisibilityForPrintPack("l-subs", saved.subsVisible);

    if (typeof atlasV8GridLayerVisibility !== "undefined") {
        Object.keys(saved.atlas || {}).forEach(voltageKey => {
            atlasV8GridLayerVisibility[voltageKey] = saved.atlas[voltageKey];
            const layerId = atlasV8GridLayerIds?.[voltageKey];
            if (layerId) setLayerVisibilityForPrintPack(layerId, saved.atlas[voltageKey]);
        });
    }

    const legend = $("map_legend");
    if (legend) legend.classList.toggle("key-collapsed", saved.keyCollapsed);
    const keyBtn = $("btn_key_toggle");
    if (keyBtn) {
        keyBtn.textContent = saved.keyCollapsed ? "KEY OFF" : "KEY ON";
        keyBtn.classList.toggle("active", !saved.keyCollapsed);
    }

    const overlay = $("map_tool_overlay");
    if (overlay) overlay.classList.toggle("tools-collapsed", saved.toolsCollapsed);
    const toolsBtn = $("btn_map_tools_toggle");
    if (toolsBtn) {
        toolsBtn.textContent = saved.toolsCollapsed ? "TOOLS OFF" : "TOOLS ON";
        toolsBtn.classList.toggle("active", !saved.toolsCollapsed);
    }

    document.body.classList.toggle("map-expanded", saved.mapExpanded);
    document.querySelector(".panel-right")?.classList.toggle("map-expanded", saved.mapExpanded);

    map.jumpTo({ center: saved.center, zoom: saved.zoom, bearing: saved.bearing, pitch: saved.pitch });
    updateSubsToggleButton?.();
    updateAtlasV8GridToggleButtons?.();
    updateLegend?.();
    map.resize();
    await sleepForPrintPack(350);
}

function ensurePrintMapPackContainer() {
    let pack = document.getElementById("print_map_pack");
    if (!pack) {
        pack = document.createElement("section");
        pack.id = "print_map_pack";
        pack.className = "print-map-pack";
        document.body.appendChild(pack);
    }
    pack.innerHTML = "";
    return pack;
}

function addPrintMapFigure(pack, title, dataUrl, note, landscape = false) {
    const page = document.createElement("section");
    page.className = landscape ? "print-map-page print-map-page-landscape" : "print-map-page";

    const heading = document.createElement("h2");
    heading.textContent = title;

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = title;

    const caption = document.createElement("p");
    caption.textContent = note || "Map figure generated from current GIS SLD sandbox view. Indicative only.";

    page.appendChild(heading);
    page.appendChild(img);
    page.appendChild(caption);
    pack.appendChild(page);
}

async function captureCurrentMapForPrint() {
    if (!map) return "";
    map.resize();
    await sleepForPrintPack(650);
    return map.getCanvas().toDataURL("image/png");
}

function getTopologyBoundsForPrintPack() {
    if (typeof turf === "undefined" || !state?.currentGeoJSON?.features?.length) return null;
    try {
        const bbox = turf.bbox(state.currentGeoJSON);
        if (!bbox || bbox.length !== 4 || bbox.some(v => !Number.isFinite(v))) return null;
        return [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    } catch (err) {
        console.warn("Print pack bbox failed", err);
        return null;
    }
}

async function fitContextMapForPrint() {
    const bounds = getTopologyBoundsForPrintPack();
    if (bounds) {
        map.fitBounds(bounds, { padding: 90, duration: 0, maxZoom: 12 });
    } else {
        const currentZoom = map.getZoom();
        map.setZoom(Math.max(currentZoom - 4, 7));
    }
    await sleepForPrintPack(750);
}

async function setSatelliteForPrintPack(active) {
    if (!map) return;
    if (typeof state !== "undefined") state.satActive = !!active;
    setLayerVisibilityForPrintPack("l-sat", !!active);
    const btn = $("btn_basemap");
    if (btn) {
        btn.textContent = active ? "DARK MATTER VIEW" : "SATELLITE VIEW";
        btn.classList.toggle("active", !!active);
    }
    await sleepForPrintPack(500);
}

async function prepareGisSldPrintReport() {
    if (!map) {
        window.print();
        return;
    }

    const btn = $("btn_print_report");
    const oldText = btn ? btn.textContent : "";
    if (btn) btn.textContent = "PREPARING";

    const saved = getMapPrintState();
    const pack = ensurePrintMapPackContainer();

    try {
        document.body.classList.add("preparing-print-pack");
        document.body.classList.remove("map-expanded");
        document.querySelector(".panel-right")?.classList.remove("map-expanded");
        $("map_tool_overlay")?.classList.add("tools-collapsed");
        $("map_legend")?.classList.add("key-collapsed");

        // Page 1 map: current working view, but clean with user selected layers retained.
        map.resize();
        await sleepForPrintPack(600);
        const currentMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 1: Current Project View", currentMap, "Current GIS SLD project view. Interactive controls are removed from print output.");

        // Page 2 map: zoomed out context. Keep current basemap and layer settings.
        await fitContextMapForPrint();
        const contextMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 2: Wider Grid And Route Context", contextMap, "Zoomed out context view showing wider relationship between project, route assumptions and grid geography.");

        // Page 3 map: satellite view, clean and full page.
        await setSatelliteForPrintPack(true);
        await fitContextMapForPrint();
        const satelliteMap = await captureCurrentMapForPrint();
        addPrintMapFigure(pack, "Map Figure 3: Satellite Context View", satelliteMap, "Satellite context view for visual land, route and surrounding area review. Indicative only.", true);

        await restoreMapPrintState(saved);
        document.body.classList.remove("preparing-print-pack");
        if (btn) btn.textContent = oldText || "PRINT";
        window.print();
    } catch (err) {
        console.error("GIS SLD print pack failed", err);
        await restoreMapPrintState(saved);
        document.body.classList.remove("preparing-print-pack");
        if (btn) btn.textContent = oldText || "PRINT";
        window.print();
    }
}

// Clean map defaults after the map and controls have loaded.
// setTimeout(enforceCleanDefaultMapLayers, 1200); // disabled by simple safe print fix


// --- V8 BESS geospatial drawing layer built on working V7 GIS frame ---
window.v8BessGeoJson = { type: 'FeatureCollection', features: [] };

function v8n(id, fallback = 0) {
    const el = document.getElementById(id);
    const value = parseFloat(el ? el.value : fallback);
    return Number.isFinite(value) ? value : fallback;
}

function v8s(id, fallback = '') {
    const el = document.getElementById(id);
    return el ? el.value : fallback;
}

function v8Set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function v8Fmt(value, digits = 2) {
    return Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '0';
}

function v8BessCalc() {
    const exportMw = v8n('bess_export_mw', 50);
    const duration = v8n('bess_duration_h', 3);
    const energy = v8n('bess_energy_mwh', exportMw * duration);
    const containerMwh = Math.max(0.1, v8n('bess_container_mwh', 5));
    const pcsMw = Math.max(0.1, v8n('bess_pcs_mw', 50));
    const containersPerPcs = Math.max(1, Math.round(v8n('bess_containers_per_pcs', 30)));
    const containers = Math.max(1, Math.ceil(energy / containerMwh));
    const pcsByPower = Math.max(1, Math.ceil(exportMw / pcsMw));
    const pcsByContainers = Math.max(1, Math.ceil(containers / containersPerPcs));
    const pcsCount = Math.max(pcsByPower, pcsByContainers);
    const totalPcsMw = pcsCount * pcsMw;
    const containersPerRow = Math.max(1, Math.round(v8n('bess_containers_per_row', 10)));
    const rows = Math.max(1, Math.ceil(containers / containersPerRow));
    const lengthM = Math.max(1, v8n('bess_container_l', 12.2));
    const widthM = Math.max(1, v8n('bess_container_w', 2.44));
    const gapM = Math.max(0, v8n('bess_container_gap', 2.5));
    const rowGapM = Math.max(0, v8n('bess_row_gap', 6));
    const fieldLength = containersPerRow * lengthM + Math.max(0, containersPerRow - 1) * gapM;
    const fieldWidth = rows * widthM + Math.max(0, rows - 1) * rowGapM;
    return { exportMw, duration, energy, containerMwh, pcsMw, containersPerPcs, containers, pcsCount, totalPcsMw, containersPerRow, rows, lengthM, widthM, gapM, rowGapM, fieldLength, fieldWidth, layoutMode: v8s('bess_layout_mode', 'integrated'), accessRoadM: v8n('bess_access_road_m', 6), rotation: v8n('bess_rotation_deg', 0) };
}

function v8UpdateBessSummary() {
    const c = v8BessCalc();
    v8Set('bess_out_containers', String(c.containers));
    v8Set('bess_out_pcs', String(c.pcsCount));
    v8Set('bess_out_pcs_power', v8Fmt(c.totalPcsMw, 1) + ' MW');
    v8Set('bess_out_field', v8Fmt(c.fieldLength, 1) + ' m x ' + v8Fmt(c.fieldWidth, 1) + ' m');
    v8Set('bess_out_export', v8Fmt(c.exportMw, 1) + ' MW');
    v8Set('bess_out_duration', c.exportMw > 0 ? v8Fmt(c.energy / c.exportMw, 2) + ' h' : '0 h');
}

function v8MetresToLngLat(origin, eastM, northM) {
    const lat = origin.lat;
    const lng = origin.lng;
    return [lng + eastM / (111320 * Math.cos(lat * Math.PI / 180)), lat + northM / 111320];
}

function v8Rotate(x, y, deg) {
    const rad = deg * Math.PI / 180;
    return [x * Math.cos(rad) - y * Math.sin(rad), x * Math.sin(rad) + y * Math.cos(rad)];
}

function v8RectFeature(origin, cx, cy, w, h, rotation, props) {
    const coords = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,-h/2]].map(([x,y]) => {
        const [rx, ry] = v8Rotate(cx + x, cy + y, rotation);
        return v8MetresToLngLat(origin, rx, ry);
    });
    return { type:'Feature', properties:props, geometry:{ type:'Polygon', coordinates:[coords] } };
}

function v8PointFeature(origin, x, y, rotation, props) {
    const [rx, ry] = v8Rotate(x, y, rotation);
    return { type:'Feature', properties:props, geometry:{ type:'Point', coordinates:v8MetresToLngLat(origin, rx, ry) } };
}

function v8LineFeature(origin, points, rotation, props) {
    return { type:'Feature', properties:props, geometry:{ type:'LineString', coordinates:points.map(([x,y]) => { const [rx, ry] = v8Rotate(x, y, rotation); return v8MetresToLngLat(origin, rx, ry); }) } };
}

function v8BuildBessGeoJson(origin) {
    const c = v8BessCalc();
    const features = [];
    const cols = Math.max(1, Math.min(c.containersPerRow, 30));
    const rows = Math.max(1, Math.ceil(c.containers / cols));
    const pitchX = c.lengthM + c.gapM;
    const pitchY = c.widthM + c.rowGapM;
    const fieldW = cols * c.lengthM + Math.max(0, cols - 1) * c.gapM;
    const fieldH = rows * c.widthM + Math.max(0, rows - 1) * c.rowGapM;
    const startX = -fieldW / 2 + c.lengthM / 2;
    const startY = fieldH / 2 - c.widthM / 2;
    const pad = Math.max(25, c.accessRoadM * 3);
    const electricalX = fieldW / 2 + 55;
    const roadY = -fieldH / 2 - Math.max(18, c.accessRoadM);

    features.push(v8RectFeature(origin, 0, 0, fieldW + pad * 2 + 220, fieldH + pad * 2 + 120, c.rotation, { role:'compound_boundary', label:'BESS compound boundary', layout_mode:c.layoutMode }));
    features.push(v8RectFeature(origin, 0, roadY, fieldW + pad * 2 + 160, Math.max(6, c.accessRoadM), c.rotation, { role:'access_road', label:'Access road and maintenance corridor' }));

    for (let i = 0; i < c.containers; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        features.push(v8RectFeature(origin, startX + col * pitchX, startY - row * pitchY, c.lengthM, c.widthM, c.rotation, { role:'bess_container', label:'BESS container ' + (i + 1), container_mwh:c.containerMwh }));
    }

    const pcsShown = Math.min(c.pcsCount, 40);
    for (let i = 0; i < pcsShown; i++) {
        let x = electricalX;
        let y = fieldH / 2 - i * 16;
        if (c.layoutMode === 'distributed') { x = startX + (i % cols) * pitchX; y = fieldH / 2 + 26 + Math.floor(i / Math.max(1, cols)) * 16; }
        if (c.layoutMode === 'corridor') { x = 0; y = roadY - 25 - i * 15; }
        if (c.layoutMode === 'central') { x = electricalX; y = 0; }
        features.push(v8RectFeature(origin, x, y, c.layoutMode === 'integrated' ? 22 : 14, 10, c.rotation, { role:c.layoutMode === 'integrated' ? 'integrated_pcs_transformer' : 'pcs_block', label:c.layoutMode === 'integrated' ? 'Integrated PCS transformer ' + (i + 1) : 'PCS block ' + (i + 1), pcs_mw:c.pcsMw }));
    }

    if (c.layoutMode !== 'integrated') features.push(v8RectFeature(origin, electricalX + 42, 0, 28, 18, c.rotation, { role:'external_transformer', label:'External transformer zone' }));
    if (c.layoutMode === 'hv_compound') features.push(v8RectFeature(origin, electricalX + 88, -36, 58, 38, c.rotation, { role:'hv_compound_placeholder', label:'Future HV compound placeholder' }));
    features.push(v8PointFeature(origin, electricalX + 120, roadY - 50, c.rotation, { role:'grid_export_point', label:'Grid export point', export_mw:c.exportMw }));
    features.push(v8LineFeature(origin, [[fieldW / 2, 0], [electricalX - 10, 0]], c.rotation, { role:'dc_collection_path', label:'Indicative DC collection path, not cable sizing' }));
    return { type:'FeatureCollection', features };
}

function v8EnsureBessGeoLayers() {
    if (!window.map) return;
    if (!map.getSource('v8-bess-layout')) map.addSource('v8-bess-layout', { type:'geojson', data:window.v8BessGeoJson });
    const layers = [
        ['v8-bess-boundary', ['==',['get','role'],'compound_boundary'], 'rgba(43,124,255,0.08)', 'rgba(43,124,255,0.75)'],
        ['v8-bess-containers', ['==',['get','role'],'bess_container'], 'rgba(0,255,136,0.38)', 'rgba(0,255,136,0.95)'],
        ['v8-bess-pcs', ['any',['==',['get','role'],'pcs_block'],['==',['get','role'],'integrated_pcs_transformer']], 'rgba(0,255,255,0.38)', 'rgba(0,255,255,0.95)'],
        ['v8-bess-transformer', ['any',['==',['get','role'],'external_transformer'],['==',['get','role'],'hv_compound_placeholder']], 'rgba(255,153,0,0.38)', 'rgba(255,153,0,0.95)'],
        ['v8-bess-road', ['==',['get','role'],'access_road'], 'rgba(120,80,40,0.55)', 'rgba(120,80,40,0.95)']
    ];
    layers.forEach(([id, filter, fill, outline]) => { if (!map.getLayer(id)) map.addLayer({ id, type:'fill', source:'v8-bess-layout', filter, paint:{ 'fill-color':fill, 'fill-outline-color':outline } }); });
    if (!map.getLayer('v8-bess-path')) map.addLayer({ id:'v8-bess-path', type:'line', source:'v8-bess-layout', filter:['==',['get','role'],'dc_collection_path'], paint:{ 'line-color':'#ff9900', 'line-width':3, 'line-dasharray':[2,2] } });
    if (!map.getLayer('v8-bess-export')) map.addLayer({ id:'v8-bess-export', type:'circle', source:'v8-bess-layout', filter:['==',['get','role'],'grid_export_point'], paint:{ 'circle-radius':7, 'circle-color':'#ffffff', 'circle-stroke-color':'#00ffff', 'circle-stroke-width':2 } });
}

function v8RefreshBessGeo() {
    if (!window.map) return;
    v8EnsureBessGeoLayers();
    const source = map.getSource('v8-bess-layout');
    if (source) source.setData(window.v8BessGeoJson);
}

function v8DrawBessAtMapCentre() {
    if (!window.map) return;
    window.v8BessGeoJson = v8BuildBessGeoJson(map.getCenter());
    v8RefreshBessGeo();
}

function v8ResetBessGeo() {
    window.v8BessGeoJson = { type:'FeatureCollection', features:[] };
    v8RefreshBessGeo();
}

function v8ExportBessGeoJson() {
    const blob = new Blob([JSON.stringify(window.v8BessGeoJson, null, 2)], { type:'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'v8-bess-layout.geojson';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function v8InitBessUi() {
    document.getElementById('btn_bess_sync_energy')?.addEventListener('click', () => { document.getElementById('bess_energy_mwh').value = v8Fmt(v8n('bess_export_mw', 50) * v8n('bess_duration_h', 3), 2); v8UpdateBessSummary(); });
    document.getElementById('btn_bess_draw_geo')?.addEventListener('click', v8DrawBessAtMapCentre);
    document.getElementById('btn_bess_reset_geo')?.addEventListener('click', v8ResetBessGeo);
    document.getElementById('btn_bess_export_geojson')?.addEventListener('click', v8ExportBessGeoJson);
    document.querySelectorAll('#v8_bess_panel input, #v8_bess_panel select').forEach(el => { el.addEventListener('input', v8UpdateBessSummary); el.addEventListener('change', v8UpdateBessSummary); });
    setTimeout(() => { if (window.map) { map.on('style.load', v8RefreshBessGeo); map.on('load', v8RefreshBessGeo); } }, 1000);
    v8UpdateBessSummary();
}

document.addEventListener('DOMContentLoaded', v8InitBessUi);

