---
layout: null
title: UK Energy Atlas (Grid Overlay V3)
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>Grid Geometry Overlay</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        body { margin: 0; background: #0b0e14; font-family: monospace; }
        #map { width: 100vw; height: 100vh; }
    </style>
</head>
<body>
<div id="map"></div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
// PERMALINK READ
const params = new URLSearchParams(window.location.search);
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [parseFloat(params.get('lon')) || -1.5, parseFloat(params.get('lat')) || 52.5],
    zoom: parseFloat(params.get('z')) || 6
});

// PERMALINK WRITE
map.on('moveend', () => {
    const c = map.getCenter();
    const url = new URL(window.location);
    url.searchParams.set('lat', c.lat.toFixed(5));
    url.searchParams.set('lon', c.lng.toFixed(5));
    url.searchParams.set('z', map.getZoom().toFixed(2));
    window.history.replaceState({}, '', url);
});

map.addControl(new maplibregl.NavigationControl(), 'top-right');

function snapLines(lines, subs) {
    const tol = 0.05;
    lines.forEach(f => {
        const coords = f.geometry.coordinates;
        if (coords.length > 1) {
            [0, coords.length - 1].forEach(idx => {
                let best = coords[idx], minD = Infinity;
                subs.forEach(s => {
                    const sc = s.geometry.coordinates;
                    const d = Math.pow(coords[idx][0]-sc[0],2) + Math.pow(coords[idx][1]-sc[1],2);
                    if (d < minD && d < tol*tol) { minD = d; best = sc; }
                });
                coords[idx] = best;
            });
        }
    });
    return lines;
}

map.on('load', async () => {
    map.addSource('subs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('grid400', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({ id: 'grid400-layer', type: 'line', source: 'grid400', paint: { 'line-color': '#0054ff', 'line-width': 3 } });
    map.addLayer({ id: 'subs-layer', type: 'circle', source: 'subs', paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-width': 1 } });

    try {
        // Using root-relative paths to ensure files load from any URL
        const [sR, gR] = await Promise.all([
            fetch('/grid_substations.geojson'),
            fetch('/grid_400kv.geojson')
        ]);
        const sD = await sR.json();
        const gD = await gR.json();
        
        const snapped = snapLines(gD.features, sD.features);
        
        map.getSource('subs').setData(sD);
        map.getSource('grid400').setData({ type: 'FeatureCollection', features: snapped });
    } catch (e) { console.error("Data Load Error:", e); }
});
</script>
</body>
</html>
