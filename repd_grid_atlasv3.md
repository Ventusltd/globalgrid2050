---
layout: null
title: GlobalGrid2050 Energy Atlas V3
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>GlobalGrid2050 Tactical HUD</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        /* --- CORE DASHBOARD STYLES --- */
        body { margin: 0; background: #0b0e14; font-family: 'Courier New', Courier, monospace; color: white; overflow-x: hidden; }
        .dashboard-container { padding: 15px; max-width: 98%; margin: auto; }

        /* --- TACTICAL HUD (CLOCK) --- */
        .mission-clock-container {
            background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 12px 25px; margin-bottom: 15px;
        }
        .clock-main-row { display: flex; justify-content: space-between; align-items: center; }
        .clock-label { font-size: 11px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
        .clock-value { font-size: 20px; font-weight: bold; color: #00ffff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.4); }
        .clock-value-alt { font-size: 20px; font-weight: bold; color: #ff9d00; text-shadow: 0 0 8px rgba(255, 157, 0, 0.4); }
        .world-clock-row { display: flex; justify-content: center; gap: 15px; font-size: 10px; color: #666; margin-top: 10px; border-top: 1px solid #222; padding-top: 10px; flex-wrap: wrap; }

        /* --- THE MAP --- */
        #map { height: 75vh; width: 100%; border-radius: 12px; border: 2px solid #2a2f3a; background: #0b0e14; }

        /* --- LEGEND PANEL --- */
        .custom-legend-panel {
            background: rgba(10, 10, 10, 0.9); border: 1px solid #444; border-radius: 8px; padding: 15px;
            margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;
        }
        .legend-header { font-size: 12px; color: #66ccff; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-bottom: 8px; grid-column: 1 / -1; }
        .legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #ccc; cursor: pointer; }
        .legend-item input { accent-color: #66ccff; }
        
        /* MapLibre Popup Overrides */
        .maplibregl-popup-content { background: #111 !important; color: white !important; border: 1px solid #444; font-family: monospace; }
    </style>
</head>
<body>

<div class="dashboard-container">
    <div class="mission-clock-container">
        <div class="clock-main-row">
            <div>
                <div class="clock-label">London / Lisbon</div>
                <div class="clock-value" id="current-time">--:--:--</div>
            </div>
            <div style="text-align: right;">
                <div class="clock-label">Countdown to Net Zero 2050</div>
                <div class="clock-value-alt" id="countdown">--D : --H</div>
            </div>
        </div>
        <div class="world-clock-row" id="world-clocks">
            </div>
    </div>

    <div id="map"></div>

    <div class="custom-legend-panel" id="legend">
        <div class="legend-header">GRID TOPOLOGY CONTROLS</div>
        <label class="legend-item"><input type="checkbox" id="toggle-grid" checked> <span style="color:#0054ff">■ 400kV Transmission</span></label>
        <label class="legend-item"><input type="checkbox" id="toggle-subs" checked> <span style="color:#ffffff">● Substations (Snapped)</span></label>
        <div class="legend-header">BASEMAP</div>
        <label class="legend-item"><input type="radio" name="base" id="base-dark" checked> Dark Matter</label>
        <label class="legend-item"><input type="radio" name="base" id="base-sat"> Satellite Imagery</label>
    </div>
</div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
    // --- MISSION CLOCK ENGINE ---
    function updateClocks() {
        const now = new Date();
        const nz = new Date("2050-01-01T00:00:00Z");
        document.getElementById('current-time').innerText = now.toLocaleTimeString('en-GB');
        
        const diff = nz - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        document.getElementById('countdown').innerText = `${days} DAYS REMAINING`;
    }
    setInterval(updateClocks, 1000); updateClocks();

    // --- MAP ENGINE ---
    const params = new URLSearchParams(window.location.search);
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [parseFloat(params.get('lon')) || -1.5, parseFloat(params.get('lat')) || 52.5],
        zoom: parseFloat(params.get('z')) || 5.8
    });

    // PERMALINK SYNC
    map.on('moveend', () => {
        const c = map.getCenter();
        const url = new URL(window.location);
        url.searchParams.set('lat', c.lat.toFixed(5));
        url.searchParams.set('lon', c.lng.toFixed(5));
        url.searchParams.set('z', map.getZoom().toFixed(2));
        window.history.replaceState({}, '', url);
    });

    // TOPOLOGY SNAPPING ENGINE
    function snapLines(lines, subs) {
        const tol = 0.05;
        lines.forEach(f => {
            const coords = f.geometry.coordinates;
            [0, coords.length - 1].forEach(idx => {
                let best = coords[idx], minD = Infinity;
                subs.forEach(s => {
                    const sc = s.geometry.coordinates;
                    const d = Math.pow(coords[idx][0]-sc[0],2) + Math.pow(coords[idx][1]-sc[1],2);
                    if (d < minD && d < tol*tol) { minD = d; best = sc; }
                });
                coords[idx] = best;
            });
        });
        return lines;
    }

    map.on('load', async () => {
        // SOURCES
        map.addSource('subs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('grid400', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('satellite', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });

        // LAYERS
        map.addLayer({ id: 'sat-layer', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });
        map.addLayer({ id: 'grid-layer', type: 'line', source: 'grid400', paint: { 'line-color': '#0054ff', 'line-width': 2.5 } });
        map.addLayer({ id: 'subs-layer', type: 'circle', source: 'subs', paint: { 'circle-color': '#fff', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });

        // DATA INGESTION
        try {
            const [sR, gR] = await Promise.all([fetch('/grid_substations.geojson'), fetch('/grid_400kv.geojson')]);
            const sD = await sR.json();
            const gD = await gR.json();
            map.getSource('subs').setData(sD);
            map.getSource('grid400').setData({ type: 'FeatureCollection', features: snapLines(gD.features, sD.features) });
        } catch (e) { console.error(e); }

        // INTERACTIVE UI BINDING
        document.getElementById('toggle-grid').addEventListener('change', (e) => {
            map.setLayoutProperty('grid-layer', 'visibility', e.target.checked ? 'visible' : 'none');
        });
        document.getElementById('toggle-subs').addEventListener('change', (e) => {
            map.setLayoutProperty('subs-layer', 'visibility', e.target.checked ? 'visible' : 'none');
        });
        document.getElementById('base-sat').addEventListener('change', () => map.setLayoutProperty('sat-layer', 'visibility', 'visible'));
        document.getElementById('base-dark').addEventListener('change', () => map.setLayoutProperty('sat-layer', 'visibility', 'none'));
    });
</script>
</body>
</html>
