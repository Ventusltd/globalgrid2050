---
layout: page
title: UK & France Energy Atlas
permalink: /repd_atlas_grid_model/
---

<link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />

<style>
    /* --- SYSTEM SCROLLBAR --- */
    html { overflow-y: scroll; scrollbar-color: #555 #111; scrollbar-width: auto; }
    ::-webkit-scrollbar { width: 26px; background-color: #111; }
    ::-webkit-scrollbar-track { background: #111; border-left: 1px solid #333; }
    ::-webkit-scrollbar-thumb { background-color: #444; border: 2px solid #111; border-radius: 8px; }
    
    .dashboard-container { max-width: 98%; margin: auto; padding: 10px 1%; font-family: 'Courier New', monospace; position: relative; }
    
    /* --- MISSION HUD --- */
    .mission-clock-container { display: flex; flex-direction: column; background: #0a0a0a; border: 1px solid #333; border-radius: 8px; padding: 12px 25px; margin-bottom: 20px; color: #fff; }
    .clock-main-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
    .clock-block { display: flex; flex-direction: column; flex: 1; }
    .clock-block.right { text-align: right; }
    .clock-label { font-size: 11px; color: #888; letter-spacing: 2px; margin-bottom: 4px; text-transform: uppercase; }
    .clock-value { font-size: 22px; font-weight: bold; color: #00ffff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.4); line-height: 1.2; }
    .clock-value-alt { font-size: 22px; font-weight: bold; color: #ff9d00; text-shadow: 0 0 8px rgba(255, 157, 0, 0.4); }

    .clock-divider { width: 100%; height: 1px; background: #222; margin: 12px 0 10px 0; }
    .world-clock-row { display: flex; justify-content: center; align-items: center; width: 100%; flex-wrap: wrap; gap: 12px; }
    .world-clock-item { display: flex; align-items: center; gap: 5px; font-size: 11px; }
    .world-city { color: #666; letter-spacing: 1px; font-weight: bold; text-transform: uppercase; }
    .world-time { color: #aaa; }
    
    /* --- MAP ENGINE --- */
    #map-wrapper { width: 100%; margin-bottom: 20px; position: relative; }
    #map { height: 85vh; min-height: 800px; width: 100%; border-radius: 12px; background: #0b0e14; border: 3px solid #2a2f3a; }

    .filter-panel { background: #111; padding: 20px; border-radius: 12px; border: 1px solid #444; margin-bottom: 15px; color: white; display: flex; flex-wrap: wrap; gap: 20px; }
    .filter-panel h3 { margin-top: 0; flex-basis: 100%; color: #66ccff; font-size: 22px; }
    .filter-group { flex: 1 1 200px; min-width: 250px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 14px; }
    
    .slider-container { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    .number-input { width: 70px; padding: 6px; background: #222; color: #66ccff; border: 1px solid #66ccff; border-radius: 5px; text-align: center; }
    select.filter-select { width: 100%; padding: 8px; background: #222; color: white; border: 1px solid #66ccff; border-radius: 5px; }
    
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; color: #333; overflow-x: auto; }
    
    /* --- DISCLAIMER & LEGAL --- */
    .disclaimer-box { 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
        text-align: justify; font-size: 10px; line-height: 1.5; color: #666; 
        margin-top: 25px; padding: 15px; border-top: 1px solid #222; 
        background: #050505; border-radius: 8px; 
    }
    .legal-disclaimer { text-align: center; font-size: 11px; color: #444; margin-top: 15px; padding-bottom: 25px; }
    .legal-disclaimer a { color: #00ffff; text-decoration: none; }
</style>

<div class="dashboard-container">
    <div class="mission-clock-container">
        <div class="clock-main-row">
            <div class="clock-block">
                <span class="clock-label">London / Lisbon</span>
                <span class="clock-value" id="current-time-display">--<br>--:--:--</span>
            </div>
            <div class="clock-block right">
                <span class="clock-label">Time to 2050 Net Zero Target</span>
                <span class="clock-value-alt" id="countdown-display">-- D : -- H : -- M : -- S</span>
            </div>
        </div>
        <div class="clock-divider"></div>
        <div class="world-clock-row">
            <div class="world-clock-item"><span class="world-city">SFO</span> <span class="world-time" id="time-sfo">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">NYC</span> <span class="world-time" id="time-nyc">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">ZUR</span> <span class="world-time" id="time-zur">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">DXB</span> <span class="world-time" id="time-dxb">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">TYO</span> <span class="world-time" id="time-tyo">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">SYD</span> <span class="world-time" id="time-syd">--:--</span></div>
        </div>
    </div>

    <div class="filter-panel">
        <h3>🔍 Map Filters</h3>
        <div class="filter-group">
            <label for="techSelect">Technology Type:</label>
            <select id="techSelect" class="filter-select">
                <option value="all">All Technologies</option>
                <option value="solar">Solar PV</option>
                <option value="wind_onshore">Wind Onshore</option>
                <option value="wind_offshore">Wind Offshore</option>
                <option value="battery">Battery Storage</option>
            </select>
        </div>
        <div class="filter-group">
            <label for="minCapacityRange">Minimum Size (MW):</label>
            <div class="slider-container">
                <input type="range" id="minCapacityRange" min="0" max="10000" value="0">
                <input type="number" id="minCapacityInput" value="0" class="number-input">
            </div>
        </div>
    </div>

    <div id="map-wrapper">
        <div id="map"></div>
    </div>

    <div id="repd-table-container">
        <table id="repd-table" class="display nowrap" style="width:100%">
            <thead>
                <tr>
                    <th>Site Name</th>
                    <th>Operator</th>
                    <th>Technology</th>
                    <th>MW</th>
                    <th>Status</th>
                    <th>County</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <div class="disclaimer-box">
        This interface is based on publicly available and open source infrastructure data, including public energy datasets such as REPD where applicable. It is presented for analytical and visualisation purposes only and does not include live operational or other non public operational data.
    </div>

    <div class="legal-disclaimer">
       This interface is based on publicly available and open source infrastructure data, including public energy datasets such as REPD where applicable. It is presented for analytical and visualisation purposes only and does not include live operational or other non public operational data. Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors | openstreetmap.org</a>. 
        Powered by MapLibre GL JS.
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"></script>

<script>
    // --- CLOCK ENGINE ---
    function updateMissionClock() {
        const now = new Date();
        const target = new Date("2050-01-01T00:00:00Z");
        const diffMs = target - now;
        const opts = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        
        document.getElementById('current-time-display').innerHTML = `${now.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'})}<br>${now.toLocaleTimeString('en-GB', opts)}`;
        
        if (diffMs > 0) {
            const days = Math.floor(diffMs / (86400000));
            const hours = Math.floor((diffMs / 3600000) % 24);
            const mins = Math.floor((diffMs / 60000) % 60);
            document.getElementById('countdown-display').innerText = `${days}D : ${hours}H : ${mins}M`;
        }
        
        const wOpts = { hour: '2-digit', minute: '2-digit', hour12: false };
        document.getElementById('time-sfo').innerText = now.toLocaleTimeString('en-GB', { ...wOpts, timeZone: 'America/Los_Angeles' });
        document.getElementById('time-nyc').innerText = now.toLocaleTimeString('en-GB', { ...wOpts, timeZone: 'America/New_York' });
        document.getElementById('time-zur').innerText = now.toLocaleTimeString('en-GB', { ...wOpts, timeZone: 'Europe/Zurich' });
        document.getElementById('time-dxb').innerText = now.toLocaleTimeString('en-GB', { ...wOpts, timeZone: 'Asia/Dubai' });
        document.getElementById('time-tyo').innerText = now.toLocaleTimeString('en-GB', { ...wOpts, timeZone: 'Asia/Tokyo' });
        document.getElementById('time-syd').innerText = now.toLocaleTimeString('en-GB', { ...wOpts, timeZone: 'Australia/Sydney' });
    }
    setInterval(updateMissionClock, 1000); updateMissionClock();

    // --- MAP ENGINE ---
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");
    
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.5, 52.5],
        zoom: 6,
        attributionControl: false
    });

    map.on('load', () => {
        map.addSource('repd', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
        
        map.addLayer({ id: 'repd-clusters', type: 'circle', source: 'repd', filter: ['has', 'point_count'], paint: { 'circle-color': '#00ffff', 'circle-radius': 20, 'circle-opacity': 0.6 } });
        map.addLayer({ id: 'repd-count', type: 'symbol', source: 'repd', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 } });
        map.addLayer({ id: 'repd-unclustered', type: 'circle', source: 'repd', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#00f2ff', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });

        // Load CSV (Mocking trigger for dashboard init)
        const csvUrl = '{{ site.baseurl }}/repd.csv'; // Ensure this path is correct in your repo
        Papa.parse(csvUrl, { 
            download: true, 
            header: true, 
            skipEmptyLines: true, 
            complete: function(results) { 
                processData(results.data); 
            } 
        });
    });

    function processData(data) {
        const features = [];
        data.forEach(row => {
            const x = parseFloat(row['X-coordinate']);
            const y = parseFloat(row['Y-coordinate']);
            if (x && y) {
                const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                features.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: coords },
                    properties: row
                });
            }
        });
        map.getSource('repd').setData({ type: 'FeatureCollection', features: features });
    }
</script>
