---
layout: null
title: GlobalGrid2050 | Ventus Core
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>GlobalGrid2050 | Ventus Core</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        /* --- FULL SCREEN LOCK --- */
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; font-family: 'Courier New', monospace; color: white; overflow: hidden; }
        .dashboard { display: flex; flex-direction: column; height: 100dvh; width: 100vw; padding: 6px; box-sizing: border-box; }
        
        /* --- HUD HEADER --- */
        .hud-header { background: #0a0a0a; border: 1px solid #333; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .hud-val { font-size: 16px; font-weight: bold; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
        
        /* Ventus Cables & Connectivity Branding */
        .ventus-brand { text-align: center; line-height: 1.1; }
        .ventus-sub { font-family: -apple-system, sans-serif; font-size: 7px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
        .ventus-main { font-family: -apple-system, sans-serif; font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 4px; text-transform: uppercase; }

        /* --- MAP AREA & OVERLAYS --- */
        .map-container { position: relative; flex-grow: 1; min-height: 0; border: 1px solid #222; border-radius: 6px; overflow: hidden; background: #0b0e14; }
        #map { width: 100%; height: 100%; }
        
        /* The Podcast Tribute */
        .podcast-shoutout {
            position: absolute;
            bottom: 6px;
            right: 8px;
            font-family: -apple-system, sans-serif;
            font-size: 8px;
            color: #ffffff;
            opacity: 0.5;
            text-align: right;
            text-transform: uppercase;
            letter-spacing: 1px;
            pointer-events: none; /* Allows clicking through to the map */
            z-index: 10;
            text-shadow: 1px 1px 2px #000; /* Ensures readability over bright map lines */
        }

        /* --- SCADA WRAPPER --- */
        .scada-wrapper { background: #050505; border: 1px solid #444; border-radius: 6px; padding: 12px; margin-top: 6px; display: flex; flex-direction: column; flex-shrink: 0; max-height: 38vh; }
        .scada-keys { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; overflow-y: auto; padding-bottom: 5px; }
        
        .key-group { border-left: 2px solid #333; padding-left: 10px; margin-bottom: 4px; }
        .key-title { font-size: 10px; color: #66ccff; text-transform: uppercase; margin-bottom: 6px; font-weight: bold; }
        .key-item { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 8px; cursor: pointer; }
        input[type="checkbox"], input[type="radio"] { transform: scale(1.3); margin-right: 4px; accent-color: #00ffff; }
        
        .maplibregl-popup-content { background: #000; color: #00ffff; border: 1px solid #444; font-family: monospace; font-size: 12px; padding: 8px; }

        /* --- THE MINIMALIST QUANTUM FOOTNOTE --- */
        .quantum-footnote {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-align: justify; font-size: 9px; line-height: 1.4; color: #ffffff; opacity: 0.5; 
            margin-top: 10px; padding-top: 8px; border-top: 1px solid #222; user-select: none; pointer-events: none; flex-shrink: 0;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
</head>
<body>

<div class="dashboard">
    <div class="hud-header">
        <div><small style="color:#888">SYSTEM TIME</small><br><span class="hud-val" id="clock">--:--:--</span></div>
        
        <div class="ventus-brand">
            <div class="ventus-sub">Cables & Connectivity</div>
            <div class="ventus-main">Ventus</div>
        </div>

        <div style="text-align:right"><small style="color:#888">2050 TARGET</small><br><span class="hud-val" id="days" style="color:#ff9d00">-- DAYS</span></div>
    </div>

    <div class="map-container">
        <div id="map"></div>
        <div class="podcast-shoutout">In support of The Future of Solar Photovoltaics podcast<br>& all participants to date</div>
    </div>

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
                <div class="key-title">REPD (CSV Parser Active)</div>
                <label class="key-item"><input type="checkbox" id="check-solar"> <span style="color:#ffff00">Solar PV</span></label>
                <label class="key-item"><input type="checkbox" id="check-wind"> <span style="color:#00ffff">Wind Farm</span></label>
                <label class="key-item"><input type="checkbox" id="check-bess"> <span style="color:#ffae00">BESS Storage</span></label>
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
    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toLocaleTimeString('en-GB');
        document.getElementById('days').innerText = Math.floor((new Date("2050-01-01") - now) / 86400000) + " DAYS";
    }, 1000);

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.5, 52.8],
        zoom: 5.8,
        attributionControl: false 
    });

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
        // --- GEOJSON FETCH ENGINE ---
        async function fetchAndSet(url, sourceId, snapSubs = null) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (snapSubs) map.getSource(sourceId).setData({ type: 'FeatureCollection', features: snapLines(data.features, snapSubs) });
                else map.getSource(sourceId).setData(data);
                return data.features;
            } catch (e) { console.warn(`Asset missing: ${url}`); return []; }
        }

        // --- CSV PAPAPARSE TRANSLATOR ---
        async function fetchCSVToGeoJSON(url, sourceId) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const csvText = await res.text();
                
                Papa.parse(csvText, {
                    header: true, skipEmptyLines: true, dynamicTyping: true,
                    complete: function(results) {
                        const features = [];
                        results.data.forEach(row => {
                            let lat = row['Lat'] || row['lat'] || row['Latitude'] || row['latitude'] || row['Y'] || row['y'];
                            let lon = row['Lon'] || row['lon'] || row['Longitude'] || row['longitude'] || row['X'] || row['x'];
                            
                            if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                                features.push({
                                    type: 'Feature',
                                    geometry: { type: 'Point', coordinates: [parseFloat(lon), parseFloat(lat)] },
                                    properties: row
                                });
                            }
                        });
                        if (map.getSource(sourceId)) {
                            map.getSource(sourceId).setData({ type: 'FeatureCollection', features: features });
                        }
                    }
                });
            } catch (e) { console.warn(`CSV missing: ${url}`); }
        }

        // --- SOURCES ---
        map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        const geoSources = ['subs', '400', '275', '220', '132', '66', 'power', 'ind', 'dc', 'air', 'rail', 'solar', 'wind', 'bess'];
        geoSources.forEach(s => map.addSource(`src-${s}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }));

        // --- LAYERS ---
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });
        
        const addLine = (id, color, w) => map.addLayer({ id: `l-${id}`, type: 'line', source: `src-${id}`, layout: { visibility: 'none' }, paint: { 'line-color': color, 'line-width': w } });
        addLine('400', '#0054ff', 2.5); addLine('275', '#ff0000', 2); addLine('220', '#ff9900', 1.8); addLine('132', '#00cc00', 1.5); addLine('66', '#b200ff', 1.2);
        
        const addPoint = (id, src, color, filter=null) => {
            let config = { id: `l-${id}`, type: 'circle', source: `src-${src}`, layout: { visibility: 'none' }, paint: { 'circle-color': color, 'circle-radius': 4.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } };
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
        addPoint('solar', 'solar', '#ffff00');
        addPoint('wind', 'wind', '#00ffff');
        addPoint('bess', 'bess', '#ffae00');

        // --- INITIATE GEOJSON FETCHES ---
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

        // --- INITIATE CSV PARSERS ---
        fetchCSVToGeoJSON('/repd-solar-operational.csv', 'src-solar');
        fetchCSVToGeoJSON('/repd-grid-batteries.csv', 'src-bess');
        fetchCSVToGeoJSON('/repd.csv', 'src-wind'); 

        // --- BIND HTML TO LAYERS ---
        const bind = (btnId, layerId) => {
            const el = document.getElementById(btnId);
            if(el) el.addEventListener('change', e => map.setLayoutProperty(layerId, 'visibility', e.target.checked ? 'visible' : 'none'));
        };
        ['400', '275', '220', '132', '66', 'subs', 'nuc', 'gas', 'ind', 'dc', 'air', 'rail', 'solar', 'wind', 'bess'].forEach(id => bind(`check-${id}`, `l-${id}`));

        document.getElementById('btn-sat').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'visible');
        document.getElementById('btn-dark').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'none');

        // --- CLICK INSPECTOR ---
        const clickable = ['l-400', 'l-275', 'l-subs', 'l-nuc', 'l-gas', 'l-ind', 'l-dc', 'l-solar', 'l-wind', 'l-bess'];
        clickable.forEach(layer => {
            map.on('click', layer, (e) => {
                const p = e.features[0].properties;
                const name = p.name || p.SiteName || p['Site Name'] || 'Unnamed Asset';
                const info = p.operator || p.capacity || p['Installed Capacity (MWelec)'] || p.voltage || 'Data Node';
                
                new maplibregl.Popup({maxWidth: '250px'})
                    .setLngLat(e.lngLat)
                    .setHTML(`<div style="font-family:monospace; color:#000;"><b>${name}</b><br><span style="color:#444;">${info}</span></div>`)
                    .addTo(map);
            });
        });
    });
</script>
</body>
</html>
