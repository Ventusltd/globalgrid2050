---
layout: null
title: GlobalGrid2050 Tactical HUD | Total Universe
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>GlobalGrid2050 | Reborn HUD</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        body { margin: 0; background: #000; font-family: 'Courier New', monospace; color: white; overflow: hidden; }
        .dashboard { display: flex; flex-direction: column; height: 100vh; padding: 10px; box-sizing: border-box; }
        
        /* SCADA HEADER */
        .hud-header { background: #0a0a0a; border: 1px solid #333; border-radius: 6px; padding: 10px 20px; margin-bottom: 8px; display: flex; justify-content: space-between; flex-shrink: 0; }
        .hud-val { font-size: 18px; font-weight: bold; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
        
        /* GPU CANVAS */
        #map { flex-grow: 1; border: 2px solid #222; border-radius: 6px; background: #0b0e14; }

        /* COMMAND INTERFACE */
        .scada-keys { 
            background: #050505; border: 1px solid #444; border-radius: 6px; padding: 12px; margin-top: 8px;
            display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; max-height: 25vh; overflow-y: auto;
        }
        .key-group { border-left: 1px solid #333; padding-left: 10px; }
        .key-title { font-size: 10px; color: #66ccff; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px; }
        .key-item { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 4px; cursor: pointer; }
        input { accent-color: #66ccff; cursor: pointer; }
    </style>
</head>
<body>

<div class="dashboard">
    <div class="hud-header">
        <div><small style="color:#888">SYSTEM TIME</small><br><span class="hud-val" id="clock">--:--:--</span></div>
        <div style="text-align:right"><small style="color:#888">2050 TARGET</small><br><span class="hud-val" id="days" style="color:#ff9d00">-- DAYS</span></div>
    </div>

    <div id="map"></div>

    <div class="scada-keys">
        <div class="key-group">
            <div class="key-title">Network Topology</div>
            <label class="key-item"><input type="checkbox" id="check-400" checked> <span style="color:#0054ff">400kV Grid</span></label>
            <label class="key-item"><input type="checkbox" id="check-275" checked> <span style="color:#ff0000">275kV Grid</span></label>
            <label class="key-item"><input type="checkbox" id="check-subs" checked> <span style="color:#fff">Substations</span></label>
        </div>

        <div class="key-group">
            <div class="key-title">Energy Projects (REPD)</div>
            <label class="key-item"><input type="checkbox" id="check-solar"> <span style="color:#ffff00">Solar PV</span></label>
            <label class="key-item"><input type="checkbox" id="check-wind"> <span style="color:#00ffff">Wind Farm</span></label>
            <label class="key-item"><input type="checkbox" id="check-bess"> <span style="color:#ffae00">BESS / Storage</span></label>
        </div>

        <div class="key-group">
            <div class="key-title">Infrastructure</div>
            <label class="key-item"><input type="checkbox" id="check-nuc"> <span style="color:#39ff14">Nuclear</span></label>
            <label class="key-item"><input type="checkbox" id="check-ind"> <span style="color:#ff6600">Heavy Industry</span></label>
            <label class="key-item"><input type="checkbox" id="check-dc"> <span style="color:#00ffff">Data Centres</span></label>
        </div>

        <div class="key-group">
            <div class="key-title">Tactical View</div>
            <label class="key-item"><input type="radio" name="bm" id="btn-dark" checked> Dark Mode</label>
            <label class="key-item"><input type="radio" name="bm" id="btn-sat"> Satellite</label>
        </div>
    </div>
</div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
    // CLOCKS
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('en-GB');
        document.getElementById('days').innerText = Math.floor((new Date("2050-01-01") - now) / 86400000) + " DAYS";
    }, 1000);

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.5, 52.8],
        zoom: 5.8
    });

    // GPU SNAPPING
    function snap(lines, subs) {
        const tol = 0.05;
        lines.forEach(f => {
            const c = f.geometry.coordinates;
            [0, c.length-1].forEach(i => {
                let best = c[i], min = Infinity;
                subs.forEach(s => {
                    const sc = s.geometry.coordinates;
                    const d = Math.pow(c[i][0]-sc[0],2) + Math.pow(c[i][1]-sc[1],2);
                    if (d < min && d < tol*tol) { min = d; best = sc; }
                });
                c[i] = best;
            });
        });
        return lines;
    }

    map.on('load', async () => {
        // SOURCES
        map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addSource('subs-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('repd-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('g400-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('g275-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // LAYERS
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });
        map.addLayer({ id: 'l-400', type: 'line', source: 'g400-s', paint: { 'line-color': '#0054ff', 'line-width': 2.5 } });
        map.addLayer({ id: 'l-275', type: 'line', source: 'g275-s', paint: { 'line-color': '#ff0000', 'line-width': 2 } });
        map.addLayer({ id: 'l-subs', type: 'circle', source: 'subs-s', paint: { 'circle-color': '#fff', 'circle-radius': 3 } });

        // REPD GPU EXPRESSIONS (Filtering Solar/Wind/BESS on one source)
        const addREPD = (id, color, type) => {
            map.addLayer({ id, type: 'circle', source: 'repd-s', filter: ['==', ['get', 'tech'], type], layout: { visibility: 'none' }, paint: { 'circle-color': color, 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
        };
        addREPD('l-solar', '#ffff00', 'solar');
        addREPD('l-wind', '#00ffff', 'wind');
        addREPD('l-bess', '#ffae00', 'battery');

        // DATA INGEST
        try {
            const [sR, g4R, g2R, rR] = await Promise.all([
                fetch('/grid_substations.geojson'), fetch('/grid_400kv.geojson'), fetch('/grid_275kv.geojson'), fetch('/repd_assets.geojson')
            ]);
            const sD = await sR.json();
            map.getSource('subs-s').setData(sD);
            map.getSource('repd-s').setData(await rR.json());
            map.getSource('g400-s').setData({ type: 'FeatureCollection', features: snap((await g4R.json()).features, sD.features) });
            map.getSource('g275-s').setData({ type: 'FeatureCollection', features: snap((await g2R.json()).features, sD.features) });
        } catch (e) { console.error("Universe Sync Failed", e); }

        // BINDINGS
        const b = (id, l) => document.getElementById(id).addEventListener('change', e => map.setLayoutProperty(l, 'visibility', e.target.checked ? 'visible' : 'none'));
        b('check-400', 'l-400'); b('check-275', 'l-275'); b('check-subs', 'l-subs');
        b('check-solar', 'l-solar'); b('check-wind', 'l-wind'); b('check-bess', 'l-bess');
        
        document.getElementById('btn-sat').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'visible');
        document.getElementById('btn-dark').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'none');
    });
</script>
</body>
</html>
