---
layout: page
title: UK & France Energy Atlas
permalink: /repd_atlas_grid_model/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />

<style>
    /* =======================================================
       --- SCADA SYSTEM ARCHITECTURE SCROLLBARS ---
       ======================================================= */
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #0b0e14; }
    ::-webkit-scrollbar { width: 12px; height: 12px; background-color: #111; }
    ::-webkit-scrollbar-track { background: #111; border-left: 1px solid #333; }
    ::-webkit-scrollbar-thumb { background-color: #444; border: 2px solid #111; border-radius: 6px; }
    ::-webkit-scrollbar-thumb:hover { background-color: #666; }

    /* =======================================================
       --- SCADA LAYOUT ENGINE ---
       ======================================================= */
    .app {
        display: flex;
        height: 100vh;
        width: 100vw;
        font-family: 'Courier New', Courier, monospace;
        color: white;
    }

    /* LEFT CONTROL PANEL */
    #control-panel {
        width: 320px;
        min-width: 320px;
        background: #111;
        border-right: 1px solid #333;
        overflow-y: auto;
        padding: 15px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    /* RIGHT MAIN AREA */
    #main-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
    }

    /* PANEL STRUCTURE */
    .panel-header {
        font-size: 16px;
        font-weight: bold;
        color: #00ffff;
        margin-bottom: 15px;
        letter-spacing: 2px;
        text-align: center;
        border-bottom: 1px solid #333;
        padding-bottom: 10px;
    }

    .section-header {
        font-size: 12px;
        color: #aaa;
        background: #1a1a1a;
        padding: 8px 10px;
        border: 1px solid #333;
        border-radius: 4px;
        cursor: pointer;
        text-transform: uppercase;
        font-weight: bold;
        margin-top: 10px;
        user-select: none;
        display: flex;
        justify-content: space-between;
    }
    .section-header:hover { background: #222; color: #fff; }
    .section-header::after { content: "▼"; font-size: 10px; }

    .section-body {
        margin-top: 8px;
        padding: 5px 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    /* LAYER ITEM TOGGLES */
    .layer-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        cursor: pointer;
    }
    .layer-item input {
        transform: scale(1.2);
        cursor: pointer;
        margin: 0;
        accent-color: #00ffff;
    }

    /* FILTERS IN SIDEBAR */
    .filter-group { margin-bottom: 10px; border-bottom: 1px solid #222; padding-bottom: 10px;}
    .filter-group:last-child { border-bottom: none; }
    .filter-group label { display: block; color: #66ccff; font-size: 12px; margin-bottom: 5px; font-weight: bold; }
    select.filter-select { width: 100%; padding: 6px; background: #222; color: white; border: 1px solid #444; border-radius: 4px; font-family: 'Courier New', Courier, monospace; font-size: 12px; cursor: pointer; }
    .slider-container { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    .number-input { width: 55px; padding: 4px; background: #222; color: #66ccff; border: 1px solid #444; border-radius: 4px; font-family: 'Courier New', Courier, monospace; font-size: 12px; text-align: center; }
    .slider-label-small { font-size: 11px; color: #888; margin-bottom: 2px; display: block; }
    .throttle-instruction { font-size: 10px; color: #ff9d00; margin-bottom: 6px; font-style: italic; }

    /* --- TACTICAL MISSION CLOCK HUD --- */
    .mission-clock-container {
        display: flex;
        flex-direction: column;
        background: #0a0a0a;
        border-bottom: 1px solid #333;
        padding: 10px 20px;
        color: #fff;
        flex-shrink: 0;
    }
    .clock-main-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 15px;
    }
    .clock-block { display: flex; flex-direction: column; flex: 1; }
    .clock-block.right { text-align: right; }
    .clock-label { font-size: 10px; color: #888; letter-spacing: 2px; margin-bottom: 2px; text-transform: uppercase; }
    .clock-value { font-size: 18px; font-weight: bold; color: #00ffff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.4); white-space: nowrap; line-height: 1.2; }
    .clock-value-alt { font-size: 18px; font-weight: bold; color: #ff9d00; text-shadow: 0 0 8px rgba(255, 157, 0, 0.4); white-space: nowrap; }

    .clock-divider { width: 100%; height: 1px; background: #222; margin: 8px 0; }
    .world-clock-row { display: flex; justify-content: center; align-items: center; width: 100%; flex-wrap: wrap; gap: 12px; }
    .world-clock-item { display: flex; align-items: center; gap: 4px; font-size: 10px; }
    .world-city { color: #666; letter-spacing: 1px; font-weight: bold; text-transform: uppercase; }
    .world-time { color: #aaa; }
    
    /* --- MAP CONTAINER --- */
    #map-container { 
        flex: 1; 
        width: 100%; 
        position: relative; 
        min-height: 300px;
        background: #0b0e14;
    }
    #map { height: 100%; width: 100%; }

    /* --- DATA TABLE CONTAINER --- */
    #repd-table-container { 
        height: 250px; 
        background: #fff; 
        padding: 10px 15px; 
        border-top: 3px solid #2a2f3a; 
        color: #333; 
        overflow-y: auto;
        overflow-x: auto;
        flex-shrink: 0;
    }
    table.dataTable.nowrap th, table.dataTable.nowrap td { white-space: nowrap; font-size: 13px; }

    /* --- MARKER STYLES --- */
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    .substation-marker { background-color: #ffffff; border: 2px solid #000; border-radius: 2px; }
    .dc-marker { background-color: #00ffff; border: 1px solid #ffffff; border-radius: 0; box-shadow: 0 0 8px #00ffff; }
    .airport-marker { background-color: #ff00ff; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ff00ff; }
    .railway-marker { background-color: #ffd700; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ffd700; }
    .water-marker { background-color: #0088ff; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #0088ff; }
    .nuclear-marker { background-color: #39ff14; border: 2px solid #000; border-radius: 50%; box-shadow: 0 0 10px #39ff14; }
    .gas-marker { background-color: #ff4500; border: 1px solid #fff; border-radius: 50%; box-shadow: 0 0 8px #ff4500; }
    .hs2-marker { background-color: #8a2be2; border: 1px solid #fff; transform: rotate(45deg); box-shadow: 0 0 8px #8a2be2; }
    .industry-marker { background: radial-gradient(circle, rgba(255, 69, 0, 0.9) 15%, rgba(255, 100, 0, 0.5) 45%, rgba(255, 100, 0, 0) 80%); border-radius: 50%; border: none; box-shadow: none; pointer-events: auto; }
    .oil-marker { background: radial-gradient(circle, rgba(200, 200, 200, 0.9) 15%, rgba(100, 100, 100, 0.5) 45%, rgba(0, 0, 0, 0) 80%); border-radius: 50%; border: none; box-shadow: none; pointer-events: auto; }

</style>

<div class="app">
    <div id="control-panel">
        <div class="panel-header">VENTUS GRID CONTROL</div>

        <div class="panel-section" data-group="grid">
            <div class="section-header">Grid & Generation</div>
            <div class="section-body"></div>
        </div>

        <div class="panel-section" data-group="demand">
            <div class="section-header">Demand & Offtakers</div>
            <div class="section-body"></div>
        </div>

        <div class="panel-section" data-group="analytics">
            <div class="section-header">Grid Diagnostics</div>
            <div class="section-body"></div>
        </div>

        <div class="panel-section" data-group="filters">
            <div class="section-header">Map Data Filters</div>
            <div class="section-body">
                
                <div class="filter-group">
                    <label>Technology Type:</label>
                    <select id="techSelect" class="filter-select">
                        <option value="all">All Technologies</option>
                        <option value="solar">Solar Photovoltaics</option>
                        <option value="wind_onshore">Wind (Onshore)</option>
                        <option value="wind_offshore">Wind (Offshore)</option>
                        <option value="battery">Battery / Storage</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label>Project Status:</label>
                    <select id="statusSelect" class="filter-select">
                        <option value="all">All Statuses</option>
                        <option value="operational">Operational</option>
                        <option value="construction">Under Construction</option>
                        <option value="consented">Consented / Awaiting</option>
                        <option value="planning">In Planning / Submitted</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label>Size Range (MW):</label>
                    <div class="slider-container">
                        <span class="slider-label-small" style="width:25px;">Min</span>
                        <input type="range" id="minCapacityRange" min="0" max="10000" value="0" step="1">
                        <input type="number" id="minCapacityInput" value="0" min="0" max="10000" class="number-input">
                    </div>
                    <div class="slider-container">
                        <span class="slider-label-small" style="width:25px;">Max</span>
                        <input type="range" id="maxCapacityRange" min="0" max="10000" value="10000" step="1">
                        <input type="number" id="maxCapacityInput" value="10000" min="0" max="10000" class="number-input">
                    </div>
                </div>

                <div class="filter-group">
                    <label>■ Substation Density</label>
                    <div class="throttle-instruction">*Manage RAM (Midlands Outwards)</div>
                    <span class="slider-label-small">South ➔ North</span>
                    <div class="slider-container">
                        <input type="range" id="substationDensityRangeSN" min="0" max="100" value="10" step="5">
                        <input type="text" id="substationDensityInputSN" value="10%" readonly class="number-input">
                    </div>
                    <span class="slider-label-small">North ➔ South</span>
                    <div class="slider-container">
                        <input type="range" id="substationDensityRangeNS" min="0" max="100" value="0" step="5">
                        <input type="text" id="substationDensityInputNS" value="0%" readonly class="number-input">
                    </div>
                </div>

                <div class="filter-group" style="border-bottom:none;">
                    <label>💧 Water Utilities Density</label>
                    <span class="slider-label-small">South ➔ North</span>
                    <div class="slider-container">
                        <input type="range" id="waterDensityRangeSN" min="0" max="100" value="10" step="5">
                        <input type="text" id="waterDensityInputSN" value="10%" readonly class="number-input">
                    </div>
                    <span class="slider-label-small">North ➔ South</span>
                    <div class="slider-container">
                        <input type="range" id="waterDensityRangeNS" min="0" max="100" value="0" step="5">
                        <input type="text" id="waterDensityInputNS" value="0%" readonly class="number-input">
                    </div>
                </div>

            </div>
        </div>
        
        <div style="text-align: center; font-size: 10px; color: #555; margin-top: 20px; padding-bottom: 20px;">
            ODbL Licence | OpenStreetMap
        </div>
    </div>

    <div id="main-area">
        
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
                <div class="world-clock-item"><span class="world-city">HOU</span> <span class="world-time" id="time-hou">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">NYC</span> <span class="world-time" id="time-nyc">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">ZUR</span> <span class="world-time" id="time-zur">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">DXB</span> <span class="world-time" id="time-dxb">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">DEL</span> <span class="world-time" id="time-del">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">BEI</span> <span class="world-time" id="time-bei">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">TYO</span> <span class="world-time" id="time-tyo">--:--</span></div>
                <div class="world-clock-item"><span class="world-city">SYD</span> <span class="world-time" id="time-syd">--:--</span></div>
            </div>
        </div>

        <div id="map-container">
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
                        <th>Address</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        </div>

    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"></script>

<script>
    // --- 1. CLOCK ENGINE ---
    function updateMissionClock() {
        const now = new Date();
        const target = new Date("2050-01-01T00:00:00Z");
        const diffMs = target - now;

        const dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Europe/London' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/London' }; 
        document.getElementById('current-time-display').innerHTML = `${now.toLocaleDateString('en-GB', dateOptions)}<br>${now.toLocaleTimeString('en-GB', timeOptions)}`;

        if (diffMs > 0) {
            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
            const mins = Math.floor((diffMs / 1000 / 60) % 60);
            const secs = Math.floor((diffMs / 1000) % 60);
            document.getElementById('countdown-display').innerText = `${days}D : ${hours.toString().padStart(2, '0')}H : ${mins.toString().padStart(2, '0')}M : ${secs.toString().padStart(2, '0')}S`;
        } else {
            document.getElementById('countdown-display').innerText = "TARGET REACHED";
        }

        const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
        document.getElementById('time-sfo').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'America/Los_Angeles' });
        document.getElementById('time-hou').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'America/Chicago' });
        document.getElementById('time-nyc').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'America/New_York' });
        document.getElementById('time-zur').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Europe/Zurich' });
        document.getElementById('time-dxb').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Dubai' });
        document.getElementById('time-del').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Kolkata' }); 
        document.getElementById('time-bei').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Shanghai' }); 
        document.getElementById('time-tyo').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Tokyo' });
        document.getElementById('time-syd').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Australia/Sydney' });
    }
    setInterval(updateMissionClock, 1000);
    updateMissionClock();

    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    // --- 2. MAP INITIALIZATION ---
    const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
    const map = L.map('map', { center: [52.5, -1.5], zoom: 6, preferCanvas: true, layers: [darkMap], zoomControl: false }); 
    L.control.zoom({ position: 'topright' }).addTo(map);

    const MIDLANDS_LAT = 52.7; 

    // --- 3. LAYER DEFINITIONS ---
    const grid400Layer = L.layerGroup(); const grid275Layer = L.layerGroup(); const grid220Layer = L.layerGroup();
    const grid132Layer = L.layerGroup(); const grid66Layer = L.layerGroup(); 
    
    const subsLayer = L.layerGroup();
    const dataCentreLayer = L.layerGroup();
    const airportLayer = L.layerGroup();
    const railwayLayer = L.layerGroup();
    const industryLayer = L.layerGroup();
    const oilLayer = L.layerGroup();
    const waterLayer = L.layerGroup(); 
    const nuclearLayer = L.layerGroup();
    const gasLayer = L.layerGroup();
    const hs2Layer = L.layerGroup();
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });

    let allSubstationFeatures = []; let currentSubstationPercentageSN = 10; let currentSubstationPercentageNS = 0; 
    let allWaterFeatures = []; let currentWaterPercentageSN = 10; let currentWaterPercentageNS = 0;

    // --- 4. SCADA STATE ENGINE ---
    const layerState = {
        grid400: true, grid275: true, grid220: false, grid132: false, grid66: false,
        substations: true, projects: true, nuclear: false, gas: false,
        industry: false, oil: false, water: false, datacentres: false, airports: false, hs2: false, railways: false
    };

    const analyticalState = {
        thermalConstraints: false
    };

    const layerRegistry = {
        grid400: grid400Layer, grid275: grid275Layer, grid220: grid220Layer, grid132: grid132Layer, grid66: grid66Layer,
        substations: subsLayer, projects: markers, nuclear: nuclearLayer, gas: gasLayer,
        industry: industryLayer, oil: oilLayer, water: waterLayer, datacentres: dataCentreLayer, airports: airportLayer, hs2: hs2Layer, railways: railwayLayer
    };

    function persistState() {
        localStorage.setItem('ventus-layer-state', JSON.stringify(layerState));
        localStorage.setItem('ventus-analytical-state', JSON.stringify(analyticalState));
    }

    function loadState() {
        const savedLayers = localStorage.getItem('ventus-layer-state');
        if (savedLayers) Object.assign(layerState, JSON.parse(savedLayers));
        
        const savedAnalytics = localStorage.getItem('ventus-analytical-state');
        if (savedAnalytics) Object.assign(analyticalState, JSON.parse(savedAnalytics));
    }

    function updateLayer(key) {
        const layer = layerRegistry[key];
        if (!layer) return;
        if (layerState[key]) {
            layer.addTo(map);
        } else {
            map.removeLayer(layer);
        }
    }

    function createLayerToggle(key, label, group) {
        const container = document.querySelector(`[data-group="${group}"] .section-body`);
        const item = document.createElement('div');
        item.className = 'layer-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = layerState[key];
        
        checkbox.addEventListener('change', () => {
            layerState[key] = checkbox.checked;
            updateLayer(key);
            persistState();
        });
        
        const text = document.createElement('span');
        text.innerHTML = label;
        
        item.appendChild(checkbox);
        item.appendChild(text);
        container.appendChild(item);
    }

    function createAnalyticalToggle(key, label, callback) {
        const container = document.querySelector(`[data-group="analytics"] .section-body`);
        const item = document.createElement('div');
        item.className = 'layer-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = analyticalState[key];
        
        checkbox.addEventListener('change', () => {
            analyticalState[key] = checkbox.checked;
            persistState();
            callback(); 
        });
        
        const text = document.createElement('span');
        text.innerText = label;
        text.style.color = '#ff9d00'; 
        text.style.fontWeight = 'bold';
        
        item.appendChild(checkbox);
        item.appendChild(text);
        container.appendChild(item);
    }

    // --- 5. ANALYTICS ENGINE (THERMAL FLOW) ---
    function updateThermalConstraints() {
        const isConstraintMode = analyticalState.thermalConstraints;

        function applyStyle(layer, defaultColor, defaultWeight) {
            if (typeof layer.feature.properties.simLoad === 'undefined') {
                layer.feature.properties.simLoad = Math.floor(Math.random() * 100);
            }
            const load = layer.feature.properties.simLoad;

            if (isConstraintMode) {
                let riskColor = load > 90 ? '#ff0000' : (load > 70 ? '#ff9d00' : '#39ff14');
                let riskWeight = load > 90 ? 4 : 2; 
                layer.setStyle({ color: riskColor, weight: riskWeight, opacity: 1, dashArray: load > 90 ? '5, 5' : null });
                
                layer.bindPopup(`<div style="font-family: Courier; background:#111; color:#fff; padding:5px; min-width:150px;">
                    <b style="color:#00ffff;">LINE DIAGNOSTIC</b><br>
                    Load: <span style="color:${riskColor}; font-weight:bold; font-size:16px;">${load}%</span><br>
                    Status: <b>${load > 90 ? 'CRITICAL LIMIT' : 'NOMINAL'}</b>
                </div>`);
            } else {
                layer.setStyle({ color: defaultColor, weight: defaultWeight, opacity: 0.6, dashArray: null });
                layer.unbindPopup(); 
            }
        }

        grid400Layer.eachLayer(l => applyStyle(l, '#0054ff', 2));
        grid275Layer.eachLayer(l => applyStyle(l, '#ff0000', 2));
    }

    // --- 6. INITIALIZE UI ---
    loadState();
    
    createLayerToggle('grid400', '<span style="color: #0054ff; font-weight: bold;">400kV Lines</span>', 'grid');
    createLayerToggle('grid275', '<span style="color: #ff0000; font-weight: bold;">275kV Lines</span>', 'grid');
    createLayerToggle('grid220', '<span style="color: #ff9900; font-weight: bold;">220kV Cables</span>', 'grid');
    createLayerToggle('grid132', '<span style="color: #00cc00; font-weight: bold;">132kV Lines</span>', 'grid');
    createLayerToggle('grid66', '<span style="color: #b200ff; font-weight: bold;">66kV Cables</span>', 'grid');
    createLayerToggle('substations', '<span style="color: #ffffff; font-weight: bold;">■ Substations</span>', 'grid');
    createLayerToggle('projects', '⚡ Energy Projects', 'grid');
    createLayerToggle('nuclear', '<span style="color: #39ff14; font-weight: bold;">☢️ Nuclear Plants</span>', 'grid');
    createLayerToggle('gas', '<span style="color: #ff4500; font-weight: bold;">🔥 Gas Plants</span>', 'grid');

    createLayerToggle('industry', '<span style="color: #ff6600; font-weight: bold;">🏭 Heavy Industry</span>', 'demand');
    createLayerToggle('oil', '<span style="color: #cccccc; font-weight: bold;">🛢️ Oil Sites</span>', 'demand');
    createLayerToggle('water', '<span style="color: #0088ff; font-weight: bold;">💧 Water Utilities</span>', 'demand');
    createLayerToggle('datacentres', '<span style="color: #00ffff; font-weight: bold;">🖥️ Data Centres</span>', 'demand');
    createLayerToggle('airports', '<span style="color: #ff00ff; font-weight: bold;">✈️ Airports</span>', 'demand');
    createLayerToggle('hs2', '<span style="color: #8a2be2; font-weight: bold;">🚄 HS2 Stations</span>', 'demand');
    createLayerToggle('railways', '<span style="color: #ffd700; font-weight: bold;">🚆 Railways</span>', 'demand');

    createAnalyticalToggle('thermalConstraints', '⚠️ Thermal Flow (Sim)', updateThermalConstraints);

    Object.keys(layerState).forEach(updateLayer);

    // Collapsible Panel Logic
    document.querySelectorAll('.section-header').forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'flex' : 'none';
            header.style.color = isHidden ? '#aaa' : '#555';
        });
    });

    // --- 7. FETCH DATA ---
    fetch('{{ site.baseurl }}/grid_400kv.geojson').then(r => r.json()).then(data => { L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(grid400Layer); updateThermalConstraints(); }).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_275kv.geojson').then(r => r.json()).then(data => { L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(grid275Layer); updateThermalConstraints(); }).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_220kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff9900', weight: 2, opacity: 0.8 } }).addTo(grid220Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_132kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(grid132Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_66kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#b200ff', weight: 1.5, opacity: 0.7 } }).addTo(grid66Layer)).catch(e => console.error(e));
    
    fetch('{{ site.baseurl }}/datacentres.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'dc-marker', iconSize: [12, 12] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Data Centre"}</b><br>Operator: ${f.properties.operator || "Unknown"}</div>`); }
        }).addTo(dataCentreLayer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/airports.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'airport-marker', iconSize: [12, 12] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Airport"}</b><br>IATA: ${f.properties.iata || "N/A"}</div>`); }
        }).addTo(airportLayer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/railways.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'railway-marker', iconSize: [10, 10] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Railway Station"}</b></div>`); }
        }).addTo(railwayLayer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/power_plants.geojson').then(r => r.json()).then(data => {
        data.features.forEach(f => {
            const isNuke = f.properties.source === 'nuclear';
            const marker = L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { icon: L.divIcon({ className: isNuke ? 'nuclear-marker' : 'gas-marker', iconSize: [14, 14] }) });
            marker.bindPopup(`<div style="font-family: Courier;"><b>${f.properties.name || "Power Plant"}</b><br>Operator: ${f.properties.operator || "Unknown"}</div>`);
            if (isNuke) { nuclearLayer.addLayer(marker); } else { gasLayer.addLayer(marker); }
        });
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/hs2.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'hs2-marker', iconSize: [12, 12] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "HS2 Infrastructure"}</b></div>`); }
        }).addTo(hs2Layer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/industrial_offtakers.geojson').then(r => r.json()).then(data => {
        data.features.forEach(f => {
            const typeLower = (f.properties.type || "").toLowerCase();
            if (typeLower.includes('water')) {
                allWaterFeatures.push(f);
            } else if (typeLower.includes('oil')) {
                const marker = L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { icon: L.divIcon({ className: 'oil-marker', iconSize: [40, 40], iconAnchor: [20, 20] }) });
                marker.bindPopup(`<div style="font-family: Courier;"><b>${f.properties.name}</b><br>Type: Oil Site</div>`);
                oilLayer.addLayer(marker);
            } else {
                const marker = L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { icon: L.divIcon({ className: 'industry-marker', iconSize: [40, 40], iconAnchor: [20, 20] }) });
                marker.bindPopup(`<div style="font-family: Courier;"><b>${f.properties.name}</b><br>Type: ${f.properties.type}</div>`);
                industryLayer.addLayer(marker);
            }
        });
        allWaterFeatures.sort((a, b) => Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT) - Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT));
        renderWater();
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/grid_substations.geojson').then(r => r.json()).then(data => {
        allSubstationFeatures = data.features.sort((a, b) => Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT) - Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT));
        renderSubstations();
    }).catch(e => console.error(e));

    // --- 8. THROTTLE ENGINES ---
    function renderSubstations() {
        subsLayer.clearLayers();
        if (allSubstationFeatures.length === 0) return;
        const total = allSubstationFeatures.length;
        let renderSet = new Set();
        if (currentSubstationPercentageSN > 0) allSubstationFeatures.slice(0, Math.floor((currentSubstationPercentageSN / 100) * total)).forEach(f => renderSet.add(f));
        if (currentSubstationPercentageNS > 0) allSubstationFeatures.slice(total - Math.floor((currentSubstationPercentageNS / 100) * total)).forEach(f => renderSet.add(f));
        
        L.geoJSON({"type": "FeatureCollection", "features": Array.from(renderSet)}, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'substation-marker', iconSize: [8, 8] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier;"><b>${f.properties.name || "Substation"}</b><br>Voltage: ${f.properties.voltage || "Unknown"}</div>`); }
        }).addTo(subsLayer);
    }

    function renderWater() {
        waterLayer.clearLayers();
        if (allWaterFeatures.length === 0) return;
        const total = allWaterFeatures.length;
        let renderSet = new Set();
        if (currentWaterPercentageSN > 0) allWaterFeatures.slice(0, Math.floor((currentWaterPercentageSN / 100) * total)).forEach(f => renderSet.add(f));
        if (currentWaterPercentageNS > 0) allWaterFeatures.slice(total - Math.floor((currentWaterPercentageNS / 100) * total)).forEach(f => renderSet.add(f));
        
        Array.from(renderSet).forEach(f => {
            const marker = L.marker([f.geometry.coordinates[1], f.geometry.coordinates[0]], { icon: L.divIcon({ className: 'water-marker', iconSize: [10, 10] }) });
            marker.bindPopup(`<div style="font-family: Courier;"><b>${f.properties.name}</b></div>`);
            waterLayer.addLayer(marker);
        });
    }

    $('#substationDensityRangeSN').on('input', function() { currentSubstationPercentageSN = parseInt($(this).val()); $('#substationDensityInputSN').val(currentSubstationPercentageSN + "%"); renderSubstations(); });
    $('#substationDensityRangeNS').on('input', function() { currentSubstationPercentageNS = parseInt($(this).val()); $('#substationDensityInputNS').val(currentSubstationPercentageNS + "%"); renderSubstations(); });
    $('#waterDensityRangeSN').on('input', function() { currentWaterPercentageSN = parseInt($(this).val()); $('#waterDensityInputSN').val(currentWaterPercentageSN + "%"); renderWater(); });
    $('#waterDensityRangeNS').on('input', function() { currentWaterPercentageNS = parseInt($(this).val()); $('#waterDensityInputNS').val(currentWaterPercentageNS + "%"); renderWater(); });

    // --- 9. PROJECT DATA & FILTERING ---
    const csvUrl = '{{ site.baseurl }}/repd.csv';
    let allData = []; let allMarkers = []; let dataTable;
    let currentMin = 0; let currentMax = 10000; let currentTech = 'all'; let currentStatus = 'all';

    Papa.parse(csvUrl, {
        download: true, header: true, skipEmptyLines: true,
        complete: function(results) { allData = results.data; initDataDashboard(); }
    });

    function initDataDashboard() {
        updateDisplay();
        $('#techSelect').on('change', function() { currentTech = $(this).val(); updateDisplay(); });
        $('#statusSelect').on('change', function() { currentStatus = $(this).val(); updateDisplay(); });
        $('#minCapacityRange').on('input', function() { currentMin = parseFloat($(this).val()); if(currentMin>currentMax){currentMax=currentMin;$('#maxCapacityRange').val(currentMax);$('#maxCapacityInput').val(currentMax);}$('#minCapacityInput').val(currentMin); updateDisplay(); });
        $('#maxCapacityRange').on('input', function() { currentMax = parseFloat($(this).val()); if(currentMax<currentMin){currentMin=currentMax;$('#minCapacityRange').val(currentMin);$('#minCapacityInput').val(currentMin);}$('#maxCapacityInput').val(currentMax); updateDisplay(); });
        $('#minCapacityInput').on('input', function() { let val = parseFloat($(this).val())||0; if(val>currentMax){currentMax=val;$('#maxCapacityInput').val(val);$('#maxCapacityRange').val(val);}currentMin=val;$('#minCapacityRange').val(val); updateDisplay(); });
        $('#maxCapacityInput').on('input', function() { let val = parseFloat($(this).val())||0; if(val<currentMin){currentMin=val;$('#minCapacityInput').val(val);$('#minCapacityRange').val(val);}currentMax=val;$('#maxCapacityRange').val(val); updateDisplay(); });
    }

    function updateDisplay() {
        markers.clearLayers(); allMarkers = []; const filteredTableData = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const status = row['Development Status'] || 'Unknown';
            const techType = (row['Technology Type'] || '').toLowerCase();
            
            let matchTech = currentTech==='all' || (currentTech==='solar' && techType.includes('solar')) || (currentTech==='wind_onshore' && techType.includes('wind') && techType.includes('onshore')) || (currentTech==='wind_offshore' && techType.includes('wind') && techType.includes('offshore')) || (currentTech==='battery' && (techType.includes('battery') || techType.includes('storage')));
            let matchStatus = currentStatus==='all' || (currentStatus==='operational' && status.toLowerCase()==='operational') || (currentStatus==='construction' && status.toLowerCase().includes('construction')) || (currentStatus==='consented' && (status.toLowerCase().includes('granted') || status.toLowerCase().includes('consented') || status.toLowerCase()==='awaiting construction')) || (currentStatus==='planning' && (status.toLowerCase().includes('submitted') || status.toLowerCase().includes('planning') || status.toLowerCase().includes('scoping')));
            let inRange = capacity >= currentMin && capacity <= currentMax;

            if (matchTech && matchStatus && inRange) {
                const x = parseFloat(row['X-coordinate']); const y = parseFloat(row['Y-coordinate']);
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = status === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00'; 
                        const baseRadius = Math.max(10, (Math.sqrt(capacity) || 4) * 2);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius, baseRadius: baseRadius, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.8
                        }).bindPopup(`<div style="font-family: Courier;"><b>${row['Site Name']}</b><br>${capacity} MW | ${status}</div>`);

                        markers.addLayer(marker); allMarkers.push(marker);
                        filteredTableData.push([row['Site Name'], row['Operator (or Applicant)'] || row['Developer'], row['Technology Type'], capacity, status, row['County'], row['Address'] || '']);
                    } catch (e) {}
                }
            }
        });

        applyZoomScaling();

        if ($.fn.DataTable.isDataTable('#repd-table')) {
            dataTable.clear().rows.add(filteredTableData).draw();
        } else {
            dataTable = $('#repd-table').DataTable({
                data: filteredTableData, 
                pageLength: 25, 
                order: [[3, 'desc']], 
                responsive: false, 
                scrollX: true, 
                scrollY: "200px", 
                scrollCollapse: true,
                language: { search: "Scan Systems:" }
            });
        }
    }

    function applyZoomScaling() {
        const currentZoom = map.getZoom();
        const scaleMultiplier = currentZoom > 9 ? Math.pow(1.4, currentZoom - 9) : 1;
        allMarkers.forEach(layer => { layer.setRadius(layer.options.baseRadius * scaleMultiplier); });
    }
    map.on('zoomend', applyZoomScaling);

</script>
