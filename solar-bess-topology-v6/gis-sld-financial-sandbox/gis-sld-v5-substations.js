"use strict";

// GIS SLD Financial Sandbox V6
// Substation data loading extracted by GridBot feature 005.
// Must load after config, helpers and state, and before the inline app script.

function normaliseSubstations(raw) {
    if (!raw) throw new Error("Empty dataset");

    let features = [];

    if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) {
        features = raw.features;
    } else if (Array.isArray(raw)) {
        features = raw.map(item => ({
            type: "Feature",
            geometry: item.geometry || {
                type: "Point",
                coordinates: [
                    item.lon ?? item.lng ?? item.longitude ?? item.Longitude ?? item.X,
                    item.lat ?? item.latitude ?? item.Latitude ?? item.Y
                ]
            },
            properties: item.properties || item
        }));
    } else {
        throw new Error("Not a FeatureCollection or array");
    }

    const cleaned = features
        .filter(f => f && f.geometry && f.geometry.type === "Point")
        .map(f => {
            const c = f.geometry.coordinates.map(Number);
            if (!isValidLngLat(c)) return null;

            const p = f.properties || {};

            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [c[0], c[1]] },
                properties: {
                    ...p,
                    name_clean: pickProp(
                        p,
                        ["name", "Name", "site_name", "SiteName", "Site Name", "substation", "Substation", "substation_name", "Substation Name"],
                        "Substation"
                    ),
                    voltage_clean: pickProp(
                        p,
                        ["voltage", "Voltage", "kv", "kV", "KV", "voltage_kv", "Voltage kV"],
                        "Unknown"
                    )
                }
            };
        })
        .filter(Boolean);

    return { type: "FeatureCollection", features: cleaned };
}

async function loadSubstations() {
    setFetchStatus("Loading substations…", false);

    try {
        const url = SUBSTATIONS_URL + (SUBSTATIONS_URL.includes("?") ? "&" : "?") + "v=" + Date.now();
        const res = await fetch(url);

        if (!res.ok) throw new Error("HTTP " + res.status);

        const raw = await res.json();
        const cleaned = normaliseSubstations(raw);
        const src = map.getSource("src-subs");

        if (src) src.setData(cleaned);

        console.log("Substations loaded:", cleaned.features.length);
        setFetchStatus(`${cleaned.features.length.toLocaleString()} substations loaded`, false);
        setTimeout(() => setFetchStatus("", false), 2500);
    } catch (err) {
        console.error("Substation load failed:", err);
        setFetchStatus(`Substations unavailable: ${err.message}. Check SUBSTATIONS_URL.`, true);
    }
}
