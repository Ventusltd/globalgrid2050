"use strict";

// MAP
// ============================================================
let map = null;

function initMap() {
    if (typeof maplibregl === "undefined") {
        setFetchStatus("MapLibre failed to load. Check network.", true);
        console.error("maplibregl is undefined");
        return;
    }
    if (typeof turf === "undefined") {
        setFetchStatus("Turf failed to load. Check network.", true);
        console.error("turf is undefined");
        return;
    }

    map = new maplibregl.Map({
        container: "map",
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: CONSTANTS.DEFAULT_CENTER,
        zoom: CONSTANTS.DEFAULT_ZOOM
    });

    map.on("error", (e) => console.error("MapLibre error:", e && e.error ? e.error : e));
    map.on("load", onMapLoad);
}

function onMapLoad() {
    map.addSource("sat-s", {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256
    });
    map.addLayer({ id: "l-sat", type: "raster", source: "sat-s", layout: { visibility: "none" } });

    map.addSource("src-subs", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
        id: "l-subs", type: "circle", source: "src-subs",
        paint: {
            "circle-color": "#ffffff",
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 5, 14, 10, 18, 22],
            "circle-stroke-width": 1, "circle-stroke-color": "#ff3333", "circle-opacity": 0.8
        }
    });

    map.addSource("topology", { type: "geojson", data: state.currentGeoJSON });

    map.addLayer({
        id: "overall_boundary_fill", type: "fill", source: "topology",
        filter: ["==", "type", "array_boundary"],
        paint: { "fill-color": "#0066ff", "fill-opacity": 0.25 }
    });
    map.addLayer({
        id: "overall_boundary_line", type: "line", source: "topology",
        filter: ["==", "type", "array_boundary"],
        paint: { "line-color": "#0066ff", "line-width": 2, "line-dasharray": [4, 4] }
    });
    map.addLayer({
        id: "footprints", type: "fill", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["skid_footprint", "central_footprint", "bess_footprint"]]],
        paint: {
            "fill-color": ["match", ["get", "type"],
                "skid_footprint", "#00ffff", "central_footprint", "#ff9900", "bess_footprint", "#ff00aa", "#000"],
            "fill-opacity": 0.15
        }
    });
    map.addLayer({
        id: "footprints_outline", type: "line", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["skid_footprint", "central_footprint", "bess_footprint"]]],
        paint: {
            "line-color": ["match", ["get", "type"],
                "skid_footprint", "#00ffff", "central_footprint", "#ff9900", "bess_footprint", "#ff00aa", "#000"],
            "line-width": 1
        }
    });
    map.addLayer({
        id: "export_cable", type: "line", source: "topology",
        filter: ["==", "type", "export_cable"],
        paint: { "line-color": "#ff3333", "line-width": 2, "line-dasharray": [4, 4] }
    });
    map.addLayer({
        id: "radial_spine", type: "line", source: "topology",
        filter: ["==", "type", "33kv_radial"],
        paint: { "line-color": "#00ffff", "line-width": 2 }
    });
    map.addLayer({
        id: "inverters", type: "circle", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["string_substation", "central_inverter", "mv_station", "bess_compound"]]],
        paint: {
            "circle-color": ["match", ["get", "type"],
                "string_substation", "#ffff00", "central_inverter", "#ff9900",
                "mv_station", "#6633ff", "bess_compound", "#ff00aa", "#fff"],
            "circle-radius": ["match", ["get", "type"],
                "string_substation", 4, "central_inverter", 6, "mv_station", 4, "bess_compound", 6, 3],
            "circle-stroke-color": "#000", "circle-stroke-width": 1
        }
    });
    map.addLayer({
        id: "substation", type: "circle", source: "topology",
        filter: ["in", ["get", "type"], ["literal", ["poi", "private_sub"]]],
        paint: {
            "circle-color": ["match", ["get", "type"], "poi", "#ff3333", "private_sub", "#00ff88", "#fff"],
            "circle-radius": 8, "circle-stroke-color": "#fff", "circle-stroke-width": 2
        }
    });

    // Map clicks
    map.on("click", "l-subs", onSubstationClick);
    map.on("mouseenter", "l-subs", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "l-subs", () => map.getCanvas().style.cursor = "");

    map.on("click", "inverters", onInverterClick);
    map.on("mouseenter", "inverters", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "inverters", () => map.getCanvas().style.cursor = "");

    map.on("click", "substation", onPoiClick);
    map.on("mouseenter", "substation", () => map.getCanvas().style.cursor = "pointer");
    map.on("mouseleave", "substation", () => map.getCanvas().style.cursor = "");

    loadSubstations();
    updateLegend();
    recalcAll();
}

function showPopup(coords, html) {
    if (state.activePopup) state.activePopup.remove();
    state.activePopup = new maplibregl.Popup().setLngLat(coords).setHTML(html).addTo(map);
    state.activePopup.on("close", () => { state.activePopup = null; });
}

// ============================================================
// MAP CLICK HANDLERS
// ============================================================
function onSubstationClick(e) {
    const f = e.features && e.features[0];
    if (!f || !f.geometry) return;
    const coords = f.geometry.coordinates.slice();
    const p = f.properties || {};

    state.selectedSubstation = {
        name: p.name_clean || pickProp(p, ["name","Name","SiteName","Site Name","substation","Substation"], "Selected Substation"),
        voltage: p.voltage_clean || pickProp(p, ["voltage","Voltage","kv","kV","KV"], "Unknown"),
        properties: p,
        coordinates: coords
    };
    state.activeDrawCenter = coords;
    updateSelectedSubstationDisplay();
    computeAndDraw();

    showPopup(coords, `
        <div style="margin-bottom:5px;color:#ff3333;font-weight:bold;font-size:13px;text-transform:uppercase;">Grid Node</div>
        <div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${state.selectedSubstation.name}</span></div>
        <div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${state.selectedSubstation.voltage}</span></div>
        <div class="popup-row"><span>Lon:</span><span class="popup-val" style="color:#fff;">${Number(coords[0]).toFixed(6)}</span></div>
        <div class="popup-row"><span>Lat:</span><span class="popup-val" style="color:#fff;">${Number(coords[1]).toFixed(6)}</span></div>
    `);
}

function onInverterClick(e) {
    const prop = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const colourMap = {
        central_inverter: "#ff9900", string_substation: "#ffff00",
        bess_compound: "#ff00aa", mv_station: "#6633ff"
    };
    const colour = colourMap[prop.type] || "#00ffff";
    let html = `<div style="margin-bottom:5px;color:${colour};font-weight:bold;font-size:13px;text-transform:uppercase;">Block Info</div>
                <div class="popup-row"><span>Type:</span><span class="popup-val" style="color:#fff;">${prop.type}</span></div>`;
    if (prop.type === "bess_compound" && prop.mwh !== undefined) {
        html += `<div class="popup-row"><span>Capacity:</span><span class="popup-val" style="color:#fff;">${prop.mwh} MWh</span></div>`;
    }
    showPopup(coords, html);
}

function onPoiClick(e) {
    const prop = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates.slice();
    const title = prop.type === "poi" ? "Point of Interconnection" : "Customer Substation";
    const colour = prop.type === "poi" ? "#ff3333" : "#00ff88";
    let html = `<div style="margin-bottom:5px;color:${colour};font-weight:bold;font-size:13px;text-transform:uppercase;">${title}</div>`;
    if (prop.selected_substation_name) html += `<div class="popup-row"><span>Name:</span><span class="popup-val" style="color:#fff;">${prop.selected_substation_name}</span></div>`;
    if (prop.selected_substation_voltage) html += `<div class="popup-row"><span>Voltage:</span><span class="popup-val" style="color:#fff;">${prop.selected_substation_voltage}</span></div>`;
    showPopup(coords, html);
}

// ============================================================
