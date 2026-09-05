"use strict";

const mlState = {
    map: null,
    satActive: false,
    pickMode: false,
    centre: null,
    currentGeoJSON: { type: "FeatureCollection", features: [] }
};

function ml(id) {
    return document.getElementById(id);
}

function mlNum(id, fallback = 0) {
    const el = ml(id);
    if (!el) return fallback;
    const value = parseFloat(el.value);
    return Number.isFinite(value) ? value : fallback;
}

function mlInt(id, fallback = 0) {
    const value = Math.round(mlNum(id, fallback));
    return Number.isFinite(value) ? value : fallback;
}

function mlSetStatus(text) {
    const el = ml("ml_status");
    if (el) el.textContent = text;
}

function mlSetText(id, text) {
    const el = ml(id);
    if (el) el.textContent = text;
}

function mlGetInputs() {
    const totalModules = Math.max(1, mlInt("ml_total_modules", 1200));
    const moduleWidthM = Math.max(0.1, mlNum("ml_module_width_m", 1.134));
    const moduleHeightM = Math.max(0.1, mlNum("ml_module_height_m", 2.278));
    const orientation = ml("ml_orientation")?.value || "portrait";
    const modulesPerRow = Math.max(1, mlInt("ml_modules_per_row", 60));
    const rowPitchM = Math.max(0.1, mlNum("ml_row_pitch_m", 6.0));
    const moduleGapM = Math.max(0, mlNum("ml_module_gap_m", 0.03));
    const rotationDeg = mlNum("ml_rotation_deg", 0);

    const moduleAcrossM = orientation === "landscape" ? moduleHeightM : moduleWidthM;
    const moduleAlongM = orientation === "landscape" ? moduleWidthM : moduleHeightM;
    const rows = Math.ceil(totalModules / modulesPerRow);
    const widthM = modulesPerRow * moduleAcrossM + Math.max(0, modulesPerRow - 1) * moduleGapM;
    const lengthM = rows * rowPitchM;
    const moduleAreaM2 = totalModules * moduleWidthM * moduleHeightM;
    const footprintAreaM2 = widthM * lengthM;

    return {
        totalModules,
        moduleWidthM,
        moduleHeightM,
        orientation,
        modulesPerRow,
        rowPitchM,
        moduleGapM,
        rotationDeg,
        moduleAcrossM,
        moduleAlongM,
        rows,
        widthM,
        lengthM,
        moduleAreaM2,
        footprintAreaM2
    };
}

function mlPointFromOffset(centerCoord, acrossM, alongM, axisDeg) {
    const acrossKm = acrossM / 1000;
    const alongKm = alongM / 1000;
    const p1 = turf.destination(turf.point(centerCoord), acrossKm, axisDeg + 90, { units: "kilometers" }).geometry.coordinates;
    return turf.destination(turf.point(p1), alongKm, axisDeg, { units: "kilometers" }).geometry.coordinates;
}

function mlRect(centerCoord, widthM, lengthM, type, axisDeg, props = {}) {
    const halfW = widthM / 2;
    const halfL = lengthM / 2;
    const nw = mlPointFromOffset(centerCoord, -halfW, halfL, axisDeg);
    const ne = mlPointFromOffset(centerCoord, halfW, halfL, axisDeg);
    const se = mlPointFromOffset(centerCoord, halfW, -halfL, axisDeg);
    const sw = mlPointFromOffset(centerCoord, -halfW, -halfL, axisDeg);
    return turf.polygon([[nw, ne, se, sw, nw]], { type, ...props });
}

function mlUpdateResults(inputs, renderedCount) {
    mlSetText("ml_out_rows", String(inputs.rows));
    mlSetText("ml_out_width", inputs.widthM.toFixed(1) + " m");
    mlSetText("ml_out_length", inputs.lengthM.toFixed(1) + " m");
    mlSetText("ml_out_area", (inputs.footprintAreaM2 / 10000).toFixed(2) + " ha");
    mlSetText("ml_out_rendered", String(renderedCount));
}

function mlBuildLayout(centerCoord) {
    const inputs = mlGetInputs();
    const features = [];
    const axis = inputs.rotationDeg;

    features.push(mlRect(centerCoord, inputs.widthM, inputs.lengthM, "module_layout_boundary", axis, {
        total_modules: inputs.totalModules,
        orientation: inputs.orientation,
        modules_per_row: inputs.modulesPerRow,
        row_count: inputs.rows,
        width_m: inputs.widthM,
        length_m: inputs.lengthM,
        footprint_area_m2: inputs.footprintAreaM2,
        physical_module_area_m2: inputs.moduleAreaM2
    }));

    const maxRenderModules = 6000;
    const renderCount = Math.min(inputs.totalModules, maxRenderModules);
    const startAcross = -inputs.widthM / 2 + inputs.moduleAcrossM / 2;
    const startAlong = inputs.lengthM / 2 - inputs.rowPitchM / 2;

    for (let i = 0; i < renderCount; i++) {
        const row = Math.floor(i / inputs.modulesPerRow);
        const col = i % inputs.modulesPerRow;
        const acrossM = startAcross + col * (inputs.moduleAcrossM + inputs.moduleGapM);
        const alongM = startAlong - row * inputs.rowPitchM;
        const moduleCenter = mlPointFromOffset(centerCoord, acrossM, alongM, axis);
        features.push(mlRect(moduleCenter, inputs.moduleAcrossM, inputs.moduleAlongM, "solar_module", axis, {
            module_index: i + 1,
            row: row + 1,
            column: col + 1,
            orientation: inputs.orientation
        }));
    }

    if (inputs.totalModules > maxRenderModules) {
        mlSetStatus("Rendered first " + maxRenderModules + " modules. Reduce count or use a block level view for very large layouts.");
    } else {
        mlSetStatus("Rendered " + renderCount + " physical modules. Zoom in to inspect module footprint.");
    }

    mlUpdateResults(inputs, renderCount);
    mlState.currentGeoJSON = turf.featureCollection(features);
    const src = mlState.map?.getSource("module-layout");
    if (src) src.setData(mlState.currentGeoJSON);
}

function mlDrawAtMapCentre() {
    if (!mlState.map) return;
    const c = mlState.map.getCenter();
    mlState.centre = [c.lng, c.lat];
    mlBuildLayout(mlState.centre);
    mlZoomToLayout();
}

function mlClear() {
    mlState.centre = null;
    mlState.currentGeoJSON = { type: "FeatureCollection", features: [] };
    const src = mlState.map?.getSource("module-layout");
    if (src) src.setData(mlState.currentGeoJSON);
    mlUpdateResults(mlGetInputs(), 0);
    mlSetStatus("Cleared.");
}

function mlZoomToLayout() {
    if (!mlState.map || !mlState.currentGeoJSON.features.length) return;
    const bbox = turf.bbox(mlState.currentGeoJSON);
    mlState.map.fitBounds(bbox, { padding: 80, duration: 700 });
}

function mlToggleSatellite() {
    if (!mlState.map || !mlState.map.getLayer("ml-sat-layer")) return;
    mlState.satActive = !mlState.satActive;
    mlState.map.setLayoutProperty("ml-sat-layer", "visibility", mlState.satActive ? "visible" : "none");
    const btn = ml("ml_satellite");
    if (btn) btn.textContent = mlState.satActive ? "Dark View" : "Satellite View";
}

function mlTogglePickMode() {
    mlState.pickMode = !mlState.pickMode;
    mlSetStatus(mlState.pickMode ? "Pick mode active. Click the map to place module layout centre." : "Pick mode cancelled.");
}

function mlWireInputs() {
    [
        "ml_total_modules",
        "ml_module_width_m",
        "ml_module_height_m",
        "ml_orientation",
        "ml_modules_per_row",
        "ml_row_pitch_m",
        "ml_module_gap_m",
        "ml_rotation_deg"
    ].forEach(id => {
        const el = ml(id);
        if (!el) return;
        el.addEventListener("input", () => {
            if (mlState.centre) mlBuildLayout(mlState.centre);
            else mlUpdateResults(mlGetInputs(), 0);
        });
        el.addEventListener("change", () => {
            if (mlState.centre) mlBuildLayout(mlState.centre);
            else mlUpdateResults(mlGetInputs(), 0);
        });
    });

    ml("ml_draw_center")?.addEventListener("click", mlDrawAtMapCentre);
    ml("ml_pick_site")?.addEventListener("click", mlTogglePickMode);
    ml("ml_clear")?.addEventListener("click", mlClear);
    ml("ml_satellite")?.addEventListener("click", mlToggleSatellite);
    ml("ml_zoom_layout")?.addEventListener("click", mlZoomToLayout);
}

function mlInitMap() {
    if (typeof maplibregl === "undefined" || typeof turf === "undefined") {
        mlSetStatus("MapLibre or Turf failed to load.");
        return;
    }

    mlState.map = new maplibregl.Map({
        container: "module_map",
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: CONSTANTS.DEFAULT_CENTER || [-0.1276, 51.5072],
        zoom: 15
    });

    mlState.map.on("load", () => {
        mlState.map.addSource("ml-sat-source", {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256
        });
        mlState.map.addLayer({
            id: "ml-sat-layer",
            type: "raster",
            source: "ml-sat-source",
            layout: { visibility: "none" }
        });

        mlState.map.addSource("module-layout", {
            type: "geojson",
            data: mlState.currentGeoJSON
        });

        mlState.map.addLayer({
            id: "ml-boundary-fill",
            type: "fill",
            source: "module-layout",
            filter: ["==", "type", "module_layout_boundary"],
            paint: { "fill-color": "#0066ff", "fill-opacity": 0.18 }
        });
        mlState.map.addLayer({
            id: "ml-boundary-line",
            type: "line",
            source: "module-layout",
            filter: ["==", "type", "module_layout_boundary"],
            paint: { "line-color": "#00ffff", "line-width": 2 }
        });
        mlState.map.addLayer({
            id: "ml-modules-fill",
            type: "fill",
            source: "module-layout",
            filter: ["==", "type", "solar_module"],
            minzoom: 15,
            paint: { "fill-color": "#00ffff", "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0.2, 18, 0.55, 21, 0.85] }
        });
        mlState.map.addLayer({
            id: "ml-modules-line",
            type: "line",
            source: "module-layout",
            filter: ["==", "type", "solar_module"],
            minzoom: 16,
            paint: { "line-color": "#00ffff", "line-width": ["interpolate", ["linear"], ["zoom"], 16, 0.3, 20, 1.2] }
        });

        mlSetStatus("Ready. Draw at map centre or pick a site.");
        mlUpdateResults(mlGetInputs(), 0);
    });

    mlState.map.on("click", (e) => {
        if (!mlState.pickMode) return;
        mlState.pickMode = false;
        mlState.centre = [e.lngLat.lng, e.lngLat.lat];
        mlBuildLayout(mlState.centre);
        mlZoomToLayout();
    });
}

function mlBoot() {
    mlWireInputs();
    mlInitMap();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mlBoot);
} else {
    mlBoot();
}
