---
layout: null
title: GlobalGrid2050 Tactical HUD V3
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>GlobalGrid2050 | Tactical HUD</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        body { margin: 0; background: #0b0e14; font-family: 'Courier New', Courier, monospace; color: white; overflow: hidden; }
        .dashboard-container { padding: 10px; height: 100vh; display: flex; flex-direction: column; }

        /* HUD - MISSION CLOCK */
        .mission-clock-container { background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 10px 20px; margin-bottom: 8px; flex-shrink: 0; }
        .clock-main-row { display: flex; justify-content: space-between; align-items: center; }
        .clock-label { font-size: 10px; color: #888; letter-spacing: 1px; text-transform: uppercase; }
        .clock-value { font-size: 18px; font-weight: bold; color: #00ffff; text-shadow: 0 0 5px rgba(0, 255, 255, 0.4); }

        /* MAP AREA */
        #map { flex-grow: 1; width: 100%; border-radius: 8px; border: 2px solid #2a2f3a; background: #0b0e14; }

        /* SCADA COMMAND KEYS */
        .scada-legend {
            background: rgba(10, 10, 10, 0.95); border: 1px solid #444; border-radius: 8px; padding: 12px;
            margin-top: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;
            max-height: 150px; overflow-y: auto;
        }
        .legend-header { font-size: 10px; color: #66ccff; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 2px; grid-column: 1 / -1; text-transform: uppercase; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; cursor: pointer; color: #bbb; }
        .legend-item:hover { color: #fff; }
        input[type="checkbox"], input[type="radio"] { accent-color: #66ccff; cursor: pointer; }

        .maplibregl-popup-content { background: #000 !important; color: #00ffff !important; border: 1px solid #00ffff; font-family: monospace; font-size: 11px; }
    </style>
</head>
<body>

<div class="dashboard-container">
    <div class="mission-clock-container">
        <div class="clock-main-row">
            <div><div class="clock-label">London Terminal</div><div class="clock-value" id="t-london">--:--:--</div></div>
            <div style="text-align: right;"><div class="clock-label">2050 Net Zero Horizon</div><div class="clock-value" id="t-countdown">-- DAYS</div></div>
        </div>
    </div>

    <div id="map"></div>

    <div class="scada-legend">
        <div class="legend-header">Transmission Network (Cables & Lines)</div>
        <label class="legend-item"><input type="checkbox" id="check-400" checked> <span style="color:#0054ff">400kV Line</span></label>
        <label class="legend-item"><input type="checkbox" id="check-275" checked> <span style="color:#ff0000">275kV Line</span></label>
        <label class="legend-item"><input type="checkbox" id="check-220"> <span style="color:#ff9900">220kV Cable</span></label>
        <label class="legend-item"><input type="checkbox" id="check-132"> <span style="color:#00cc00">132kV Line</span></label>
        <label class="legend-item"><input type="checkbox" id="check-66"> <span style="color:#b200ff">66kV Cable</span></label>
        <label class="legend-item"><input type="checkbox" id="check-subs" checked> <span style="color:#ffffff">Substations</span></label>

        <div class="legend-header">Basemap Controls</div>
        <label class="legend-item"><input type="radio" name="basemap" id="radio-dark" checked> Dark Tactical</label>
        <label class="legend-item"><input type="radio" name="basemap" id="radio-sat"> Satellite</label>
    </div>
</div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
    // HUD CLOCKS
    setInterval(() => {
        const now = new Date();
        document.getElementById('t-london').innerText = now.toLocaleTimeString('en-GB');
        const days = Math.floor((new Date("2050-01-01") - now) / 86400000);
        document.getElementById('t-countdown').innerText = days + " DAYS";
    }, 1000);

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.5, 53.0],
        zoom: 5.5
    });

    // TOPOLOGY SNAPPING ENGINE
    function snapLines(features, subs) {
        const tol = 0.05;
        features.forEach(f => {
            const c = f.geometry.coordinates;
            if (c.length > 1) {
                [0, c.length - 1].forEach(i => {
                    let best = c[i], min = Infinity;
                    subs.forEach(s => {
                        const sc = s.geometry.coordinates;
                        const d = Math.pow(c[i][0]-sc[0],2) + Math.pow(c[i][1]-sc[1],2);
                        if (d < min && d < tol*tol) { min = d; best = sc; }
                    });
                    c[i] = best;
                });
            }
        });
        return features;
    }

    map.on('load', async () => {
        // SOURCES
        map.addSource('sat-src', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addSource('subs-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        
        // Dynamic Cable Sources
        const voltages = ['400', '275', '220', '132', '66'];
        voltages.forEach(v => map.addSource(`grid${v}-src`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }));

        // LAYERS
        map.addLayer({ id: 'sat-layer', type: 'raster', source: 'sat-src', layout: { visibility: 'none' } });
        
        const addCableLayer = (v, color, width, initVis = 'none') => {
            map.addLayer({ id: `layer-${v}`, type: 'line', source: `grid${v}-src`, layout: { visibility: initVis }, paint: { 'line-color': color, 'line-width': width, 'line-opacity': 0.8 } });
        };

        addCableLayer('400', '#0054ff', 2.5, 'visible');
        addCableLayer('275', '#ff0000', 2.0, 'visible');
        addCableLayer('220', '#ff9900', 1.8);
        addCableLayer('132', '#00cc00', 1.5);
        addCableLayer('66', '#b200ff', 1.2);

        map.addLayer({ id: 'subs-layer', type: 'circle', source: 'subs-src', paint: { 'circle-color': '#fff', 'circle-radius': 3.5, 'circle-stroke-width': 1 } });

        // DATA INGESTION
        try {
            const subsRes = await fetch('/grid_substations.geojson');
            const subsData = await subsRes.json();
            map.getSource('subs-src').setData(subsData);

            voltages.forEach(async (v) => {
                const res = await fetch(`/grid_${v}kv.geojson`);
                const data = await res.json();
                map.getSource(`grid${v}-src`).setData({ type: 'FeatureCollection', features: snapLines(data.features, subsData.features) });
            });
        } catch (e) { console.error("Voltage Load Error", e); }

        // COMMAND KEY BINDINGS
        const bind = (id, layer) => document.getElementById(id).addEventListener('change', e => map.setLayoutProperty(layer, 'visibility', e.target.checked ? 'visible' : 'none'));
        bind('check-400', 'layer-400');
        bind('check-275', 'layer-275');
        bind('check-220', 'layer-220');
        bind('check-132', 'layer-132');
        bind('check-66', 'layer-66');
        bind('check-subs', 'subs-layer');

        document.getElementById('radio-sat').onchange = () => map.setLayoutProperty('sat-layer', 'visibility', 'visible');
        document.getElementById('radio-dark').onchange = () => map.setLayoutProperty('sat-layer', 'visibility', 'none');
    });
</script>
</body>
</html>
