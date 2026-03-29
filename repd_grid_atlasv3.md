---
layout: null
title: GlobalGrid2050 Tactical HUD | Strict Asset Mapping
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>GlobalGrid2050 | Tactical HUD</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        body { margin: 0; background: #000; font-family: 'Courier New', monospace; color: white; overflow: hidden; }
        .dashboard { display: flex; flex-direction: column; height: 100vh; padding: 8px; box-sizing: border-box; }
        
        /* --- HUD HEADER --- */
        .hud-header { background: #0a0a0a; border: 1px solid #333; border-radius: 6px; padding: 8px 15px; margin-bottom: 6px; display: flex; justify-content: space-between; flex-shrink: 0; }
        .hud-val { font-size: 16px; font-weight: bold; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
        
        /* --- MAP AREA --- */
        #map { flex-grow: 1; max-height: 55vh; border: 2px solid #222; border-radius: 6px; background: #0b0e14; }

        /* --- SCADA WRAPPER --- */
        .scada-wrapper {
            background: #050505; border: 1px solid #444; border-radius: 6px; padding: 15px; margin-top: 8px;
            display: flex; flex-direction: column; flex-shrink: 0; max-height: 35vh;
        }

        .scada-keys { 
            display: grid; grid-template-columns: 1fr 1fr; gap: 12px; overflow-y: auto; 
        }
        
        .key-group { border-left: 2px solid #333; padding-left: 12px; }
        .key-title { font-size: 11px; color: #66ccff; text-transform: uppercase; margin-bottom: 8px; font-weight: bold; }
        .key-item { display: flex; align-items: center; gap: 10px; font-size: 14px; margin-bottom: 10px; cursor: pointer; }
        input[type="checkbox"], input[type="radio"] { transform: scale(1.4); margin-right: 8px; accent-color: #00ffff; }
        
        .maplibregl-popup-content { background: #000; color: #00ffff; border: 1px solid #444; font-family: monospace; }

        /* --- THE MINIMALIST QUANTUM FOOTNOTE --- */
        .quantum-footnote {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-align: justify;
            font-size: 10px;
            line-height: 1.5;
            color: #ffffff; /* Crisp white */
            opacity: 0.6; /* Slightly muted so it stays a footnote */
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #222;
            user-select: none;
            pointer-events: none;
        }
    </style>
</head>
<body>

<div class="dashboard">
    <div class="hud-header">
        <div><small style="color:#888">SYSTEM TIME</small><br><span class="hud-val" id="clock">--:--:--</span></div>
        <div style="text-align:right"><small style="color:#888">2050 TARGET</small><br><span class="hud-val" id="days" style="color:#ff9d00">-- DAYS</span></div>
    </div>

    <div id="map"></div>

    <div class="scada-wrapper">
        <div class="scada-keys">
            <div class="key-group">
                <div class="key-title">Topology (GeoJSON)</div>
                <label class="key-item"><input type="checkbox" id="check-400"> <span style="color:#0054ff">400kV</span></label>
                <label class="key-item"><input type="checkbox" id="check-275"> <span style="color:#ff0000">275kV</span></label>
                <label class="key-item"><input type="checkbox" id="check-220"> <span style="color:#ff9900">220kV</span></label>
                <label class="key-item"><input type="checkbox" id="check-132"> <span style="color:#00cc00">132kV</span></label>
                <label class="key-item"><input type="checkbox" id="check-66"> <span style="color:#b200ff">66kV</span></label>
                <label class="key-item"><input type="checkbox" id="check-subs"> <span style="color:#fff">Subs</span></label>
            </div>

            <div class="key-group">
                <div class="key-title">Assets (GeoJSON)</div>
                <label class="key-item"><input type="checkbox" id="check-nuc"> <span style="color:#39ff14">Nuclear</span></label>
                <label class="key-item"><input type="checkbox" id="check-gas"> <span style="color:#ff4500">Gas</span></label>
                <label class="key-item"><input type="checkbox" id="check-ind"> <span style="color:#ff6600">Industry</span></label>
                <label class="key-item"><input type="checkbox" id="check-dc"> <span style="color:#00ffff">Data Centres</span></label>
                <label class="key-item"><input type="checkbox" id="check-air"> <span style="color:#ff00ff">Airports</span></label>
                <label class="key-item"><input type="checkbox" id="check-rail"> <span style="color:#ffd700">Railways</span></label>
            </div>

            <div class="key-group">
                <div class="key-title">REPD (CSV - Pending)</div>
                <label class="key-item"><input type="checkbox" disabled> <span style="color:#555">Solar (Wait)</span></label>
                <label class="key-item"><input type="checkbox" disabled> <span style="color:#555">Wind (Wait)</span></label>
                <label class="key-item"><input type="checkbox" disabled> <span style="color:#555">BESS (Wait)</span></label>
            </div>

            <div class="key-group">
                <div class="key-title">Basemap</div>
                <label class="key-item"><input type="radio" name="bm" id="btn-dark" checked> Dark</label>
                <label class="key-item"><input type="radio" name="bm" id="btn-sat"> Satellite</label>
            </div>
        </div>
        
        <div class="quantum-footnote">
            Quantum computing harnesses superposition and entanglement to process multi-variable problems exponentially faster than classical binary systems. For global energy grids, this enables the solving of hyper-complex optimization, routing, and load-balancing equations in seconds, paving the way for a perfectly efficient, net-zero architecture.
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

    // SNAPPING ENGINE
    function snapLines(features, subs) {
        if (!subs || subs.length === 0) return features;
        const tol = 0.05;
        features.forEach(f => {
            const c = f.geometry.coordinates;
            if (c && c.length > 1) {
                [0, c.length - 1].forEach(i => {
                    let best = c[i], min = Infinity;
                    subs.forEach(s => {
                        const sc = s.geometry.coordinates;
                        const d = Math.pow(c[i][0]-sc[0],2) + Math.pow(c[i][1]-sc[1],2);
                        if (d < min && d < tol * tol) { min = d; best = sc; }
                    });
                    c[i] = best;
                });
            }
        });
        return features;
    }

    map.on('load', async () => {
        // --- SAFE DATA LOADER ---
        async function fetchAndSet(url, sourceId, snapSubs = null) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                if (snapSubs) {
                    map.getSource(sourceId).setData({ type: 'FeatureCollection', features: snapLines(data.features, snapSubs) });
                } else {
                    map.getSource(sourceId).setData(data);
                }
                return data.features;
            } catch (e) {
                console.warn(`Asset missing or failed: ${url}`, e);
                return [];
            }
        }

        // --- SOURCES ---
        map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        
        const sources = ['subs', '400', '275', '220', '132', '66', 'power', 'ind', 'dc', 'air', 'rail'];
        sources.forEach(s => map.addSource(`src-${s}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }));

        // --- LAYERS ---
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });
        
        // Lines
        const addLine = (id, color, w) => map.addLayer({ id: `l-${id}`, type: 'line', source: `src-${id}`, layout: { visibility: 'none' }, paint: { 'line-color': color, 'line-width': w } });
        addLine('400', '#0054ff', 2.5); addLine('275', '#ff0000', 2); addLine('220', '#ff9900', 1.8); addLine('132', '#00cc00', 1.5); addLine('66', '#b200ff', 1.2);
        
        // Points
        const addPoint = (id, src, color, filter=null) => {
            let config = { id: `l-${id}`, type: 'circle', source: `src-${src}`, layout: { visibility: 'none' }, paint: { 'circle-color': color, 'circle-radius': 5, 'circle-stroke-width': 1 } };
            if (filter) config.filter = filter;
            map.addLayer(config);
        };
        addPoint('subs', 'subs', '#fff');
        addPoint('nuc', 'power', '#39ff14', ['==', ['get', 'source'], 'nuclear']);
        addPoint('gas', 'power', '#ff4500', ['!=', ['get', 'source'], 'nuclear']);
        addPoint('ind', 'ind', '#ff6600');
        addPoint('dc', 'dc', '#00ffff');
        addPoint('air', 'air', '#ff00ff');
        addPoint('rail', 'rail', '#ffd700');

        // --- FETCH EXACT FILES ---
        const subsData = await fetchAndSet('/grid_substations.geojson', 'src-subs');
        
        fetchAndSet('/grid_400kv.geojson', 'src-400', subsData);
        fetchAndSet('/grid_275kv.geojson', 'src-275', subsData);
        fetchAndSet('/grid_220kv.geojson', 'src-220', subsData);
        fetchAndSet('/grid_132kv.geojson', 'src-132', subsData);
        fetchAndSet('/grid_66kv.geojson', 'src-66', subsData);
        
        fetchAndSet('/power_plants.geojson', 'src-power');
        fetchAndSet('/industrial_offtakers.geojson', 'src-ind');
        fetchAndSet('/datacentres.geojson', 'src-dc');
        fetchAndSet('/airports.geojson', 'src-air');
        fetchAndSet('/railways.geojson', 'src-rail');

        // --- BIND HTML TO LAYERS ---
        const bind = (btnId, layerId) => {
            const el = document.getElementById(btnId);
            if(el) el.addEventListener('change', e => map.setLayoutProperty(layerId, 'visibility', e.target.checked ? 'visible' : 'none'));
        };
        
        bind('check-400', 'l-400'); bind('check-275', 'l-275'); bind('check-220', 'l-220'); 
        bind('check-132', 'l-132'); bind('check-66', 'l-66'); bind('check-subs', 'l-subs');
        bind('check-nuc', 'l-nuc'); bind('check-gas', 'l-gas'); bind('check-ind', 'l-ind'); 
        bind('check-dc', 'l-dc'); bind('check-air', 'l-air'); bind('check-rail', 'l-rail');

        document.getElementById('btn-sat').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'visible');
        document.getElementById('btn-dark').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'none');

        // --- CLICK INSPECTOR ---
        const clickable = ['l-400', 'l-275', 'l-subs', 'l-nuc', 'l-gas', 'l-ind', 'l-dc', 'l-air', 'l-rail'];
        clickable.forEach(layer => {
            map.on('click', layer, (e) => {
                const p = e.features[0].properties;
                new maplibregl.Popup({maxWidth: '250px'})
                    .setLngLat(e.lngLat)
                    .setHTML(`<div style="font-family:monospace; color:#000;"><b>${p.name || 'Unnamed Asset'}</b><br>Info: ${p.operator || p.voltage || 'N/A'}</div>`)
                    .addTo(map);
            });
        });
    });
</script>
</body>
</html>
