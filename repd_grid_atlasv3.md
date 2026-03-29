<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Grid Geometry Sandbox</title>
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
// --- Permalink Logic: Get Initial State ---
const urlParams = new URLSearchParams(window.location.search);
const initialCenter = [
    parseFloat(urlParams.get('lon')) || -1.5,
    parseFloat(urlget('lat')) || 52
];
const initialZoom = parseFloat(urlParams.get('zoom')) || 6;

const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: initialCenter,
    zoom: initialZoom
});

// --- Permalink Logic: Update URL on Move ---
const updateUrl = () => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const newUrl = `${window.location.pathname}?lat=${center.lat.toFixed(4)}&lon=${center.lng.toFixed(4)}&zoom=${zoom.toFixed(2)}`;
    window.history.replaceState({}, '', newUrl);
};
map.on('moveend', updateUrl);

map.addControl(new maplibregl.NavigationControl(), 'top-right');

let substationFeatures = [];
let grid400Features = [];

function snapLinesToSubstations(lines, substations, tolerance = 0.05) {
    function nearest(coord) {
        let best = coord;
        let min = Infinity;
        substations.forEach(s => {
            const sc = s.geometry.coordinates;
            const dx = coord[0] - sc[0];
            const dy = coord[1] - sc[1];
            const d = dx*dx + dy*dy;
            if (d < min && d < tolerance*tolerance) {
                min = d;
                best = sc;
            }
        });
        return best;
    }
    lines.forEach(f => {
        const coords = f.geometry.coordinates;
        if (coords.length > 1) {
            coords[0] = nearest(coords[0]);
            coords[coords.length - 1] = nearest(coords[coords.length - 1]);
        }
    });
    return lines;
}

map.on('load', async () => {
    map.addSource('subs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addSource('grid400', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

    map.addLayer({
        id: 'grid400-layer',
        type: 'line',
        source: 'grid400',
        paint: { 'line-color': '#0054ff', 'line-width': 3, 'line-opacity': 0.9 }
    });

    map.addLayer({
        id: 'subs-layer',
        type: 'circle',
        source: 'subs',
        paint: {
            'circle-color': '#ffffff',
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#000'
        }
    });

    try {
        const [subsRes, gridRes] = await Promise.all([
            fetch('grid_substations.geojson'),
            fetch('grid_400kv.geojson')
        ]);
        const subsData = await subsRes.json();
        const gridData = await gridRes.json();
        
        substationFeatures = subsData.features;
        const snapped = snapLinesToSubstations(gridData.features, substationFeatures);

        map.getSource('subs').setData({ type: 'FeatureCollection', features: substationFeatures });
        map.getSource('grid400').setData({ type: 'FeatureCollection', features: snapped });
    } catch (e) {
        console.error("Error loading GeoJSON data:", e);
    }
});
</script>
</body>
</html>
