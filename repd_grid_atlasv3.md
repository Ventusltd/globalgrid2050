---
layout: null
title: GlobalGrid2050 Tactical HUD | Optimized Controls
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>GlobalGrid2050 | Reborn HUD</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        /* --- RESET & LAYOUT --- */
        body { margin: 0; background: #000; font-family: 'Courier New', monospace; color: white; overflow: hidden; }
        
        .dashboard { 
            display: flex; 
            flex-direction: column; 
            height: 100vh; 
            padding: 8px; 
            box-sizing: border-box; 
        }
        
        /* --- HUD HEADER --- */
        .hud-header { 
            background: #0a0a0a; 
            border: 1px solid #333; 
            border-radius: 6px; 
            padding: 8px 15px; 
            margin-bottom: 6px; 
            display: flex; 
            justify-content: space-between; 
            flex-shrink: 0; 
        }
        .hud-val { font-size: 16px; font-weight: bold; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
        
        /* --- MAP AREA (REDUCED AREA FOR REACHABILITY) --- */
        #map { 
            flex-grow: 1; 
            max-height: 55vh; /* Reduced from 75vh to bring controls up */
            border: 2px solid #222; 
            border-radius: 6px; 
            background: #0b0e14; 
        }

        /* --- SCADA COMMAND INTERFACE (INCREASED RESOLUTION) --- */
        .scada-keys { 
            background: #050505; 
            border: 1px solid #444; 
            border-radius: 6px; 
            padding: 15px; 
            margin-top: 8px;
            display: grid; 
            grid-template-columns: 1fr 1fr; /* Two clear columns for mobile */
            gap: 12px; 
            overflow-y: auto;
            flex-shrink: 0;
        }
        
        .key-group { 
            border-left: 2px solid #333; 
            padding-left: 12px; 
            margin-bottom: 5px;
        }
        
        .key-title { 
            font-size: 11px; 
            color: #66ccff; 
            text-transform: uppercase; 
            margin-bottom: 8px; 
            letter-spacing: 1.5px; 
            font-weight: bold;
        }
        
        /* Bigger touch targets for mobile "Control Resolution" */
        .key-item { 
            display: flex; 
            align-items: center; 
            gap: 10px; 
            font-size: 14px; /* Increased font size */
            margin-bottom: 10px; 
            cursor: pointer;
            padding: 4px 0;
        }
        
        /* Scale up checkboxes for fat-finger safety */
        input[type="checkbox"], input[type="radio"] { 
            transform: scale(1.4); 
            margin-right: 8px;
            accent-color: #66ccff; 
        }

        .maplibregl-popup-content { background: #000; color: #00ffff; border: 1px solid #444; }
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
            <div class="key-title">Topology</div>
            <label class="key-item"><input type="checkbox" id="check-400" checked> <span style="color:#0054ff">400kV</span></label>
            <label class="key-item"><input type="checkbox" id="check-275" checked> <span style="color:#ff0000">275kV</span></label>
            <label class="key-item"><input type="checkbox" id="check-subs" checked> <span style="color:#fff">Subs</span></label>
        </div>

        <div class="key-group">
            <div class="key-title">Assets</div>
            <label class="key-item"><input type="checkbox" id="check-solar"> <span style="color:#ffff00">Solar</span></label>
            <label class="key-item"><input type="checkbox" id="check-wind"> <span style="color:#00ffff">Wind</span></label>
            <label class="key-item"><input type="checkbox" id="check-bess"> <span style="color:#ffae00">BESS</span></label>
        </div>

        <div class="key-group">
            <div class="key-title">Infra</div>
            <label class="key-item"><input type="checkbox" id="check-nuc"> <span style="color:#39ff14">Nuclear</span></label>
            <label class="key-item"><input type="checkbox" id="check-ind"> <span style="color:#ff6600">Industry</span></label>
            <label class="key-item"><input type="checkbox" id="check-dc"> <span style="color:#00ffff">DC's</span></label>
        </div>

        <div class="key-group">
            <div class="key-title">Basemap</div>
            <label class="key-item"><input type="radio" name="bm" id="btn-dark" checked> Dark</label>
            <label class="key-item"><input type="radio" name="bm" id="btn-sat"> Satellite</label>
        </div>
    </div>
</div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
    // HUD CLOCKS
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

    map.on('load', async () => {
        // SOURCES
        map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addSource('subs-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('repd-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('assets-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('g400-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('g275-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        // LAYERS
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });
        map.addLayer({ id: 'l-400', type: 'line', source: 'g400-s', paint: { 'line-color': '#0054ff', 'line-width': 2.5 } });
        map.addLayer({ id: 'l-275', type: 'line', source: 'g275-s', paint: { 'line-color': '#ff0000', 'line-width': 2 } });
        map.addLayer({ id: 'l-subs', type: 'circle', source: 'subs-s', paint: { 'circle-color': '#fff', 'circle-radius': 3.5 } });

        const addAsset = (id, color, type, src='assets-s') => {
            map.addLayer({ id, type: 'circle', source: src, filter: ['==', ['get', 'type'], type], layout: { visibility: 'none' }, paint: { 'circle-color': color, 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } });
        };
        addAsset('l-solar', '#ffff00', 'solar', 'repd-s');
        addAsset('l-wind', '#00ffff', 'wind', 'repd-s');
        addAsset('l-bess', '#ffae00', 'battery', 'repd-s');
        addAsset('l-nuc', '#39ff14', 'nuclear');
        addAsset('l-ind', '#ff6600', 'industry');
        addAsset('l-dc', '#00ffff', 'datacentre');

        // DATA INGEST
        try {
            const [sR, g4R, g2R, rR, aR] = await Promise.all([
                fetch('/grid_substations.geojson'), fetch('/grid_400kv.geojson'), 
                fetch('/grid_275kv.geojson'), fetch('/repd_assets.geojson'),
                fetch('/industrial_offtakers.geojson')
            ]);
            map.getSource('subs-s').setData(await sR.json());
            map.getSource('repd-s').setData(await rR.json());
            map.getSource('assets-s').setData(await aR.json());
            map.getSource('g400-s').setData(await g4R.json());
            map.getSource('g275-s').setData(await g2R.json());
        } catch (e) { console.error(e); }

        // BINDINGS
        const b = (id, l) => document.getElementById(id).addEventListener('change', e => map.setLayoutProperty(l, 'visibility', e.target.checked ? 'visible' : 'none'));
        b('check-400', 'l-400'); b('check-275', 'l-275'); b('check-subs', 'l-subs');
        b('check-solar', 'l-solar'); b('check-wind', 'l-wind'); b('check-bess', 'l-bess');
        b('check-nuc', 'l-nuc'); b('check-ind', 'l-ind'); b('check-dc', 'l-dc');
        
        document.getElementById('btn-sat').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'visible');
        document.getElementById('btn-dark').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'none');
    });
</script>
</body>
</html>
