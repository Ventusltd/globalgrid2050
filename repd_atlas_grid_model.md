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
       --- LARGE, NEUTRAL CUSTOM PAGE SCROLLBAR ---
       ======================================================= */
    html { overflow-y: scroll; scrollbar-color: #555 #111; scrollbar-width: auto; }
    ::-webkit-scrollbar { width: 26px; background-color: #111; }
    ::-webkit-scrollbar-track { background: #111; border-left: 1px solid #333; }
    ::-webkit-scrollbar-thumb { background-color: #444; border: 2px solid #111; border-radius: 8px; }
    ::-webkit-scrollbar-thumb:hover { background-color: #666; }
    ::-webkit-scrollbar-button:single-button { background-color: #222; display: block; height: 26px; width: 26px; border-left: 1px solid #333; }
    ::-webkit-scrollbar-button:single-button:hover { background-color: #444; }
    
    /* --- FULL WIDTH DASHBOARD --- */
    .dashboard-container { 
        max-width: 98%; 
        margin: auto; 
        padding: 10px 1%; 
        font-family: 'Courier New', Courier, monospace; 
        position: relative; 
    }
    
    /* --- TACTICAL MISSION CLOCK HUD --- */
    .mission-clock-container {
        display: flex;
        flex-direction: column;
        background: #0a0a0a;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 12px 25px;
        margin-bottom: 20px;
        color: #fff;
        box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.05);
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
    .clock-label { font-size: 11px; color: #888; letter-spacing: 2px; margin-bottom: 4px; text-transform: uppercase; }
    .clock-value { font-size: 22px; font-weight: bold; color: #00ffff; text-shadow: 0 0 8px rgba(0, 255, 255, 0.4); white-space: nowrap; line-height: 1.2; }
    .clock-value-alt { font-size: 22px; font-weight: bold; color: #ff9d00; text-shadow: 0 0 8px rgba(255, 157, 0, 0.4); white-space: nowrap; }

    /* --- WORLD CLOCKS TIER --- */
    .clock-divider {
        width: 100%;
        height: 1px;
        background: #222;
        margin: 12px 0 10px 0;
    }
    .world-clock-row {
        display: flex;
        justify-content: center; 
        align-items: center;
        width: 100%;
        flex-wrap: wrap; 
        gap: 12px;
    }
    .world-clock-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px; 
    }
    .world-city { color: #666; letter-spacing: 1px; font-weight: bold; text-transform: uppercase; }
    .world-time { color: #aaa; font-family: 'Courier New', Courier, monospace; }
    
    #map-wrapper { width: 100%; margin-bottom: 20px; position: relative; }
    
    /* --- VERTICALLY EXPANDED MAP --- */
    #map { 
        height: 85vh; 
        min-height: 800px;
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
    }

    .filter-panel { background: #111; padding: 20px; border-radius: 12px; border: 1px solid #444; margin-bottom: 15px; color: white; display: flex; flex-wrap: wrap; gap: 20px; }
    .filter-panel h3 { margin-top: 0; flex-basis: 100%; color: #66ccff; font-size: 22px; margin-bottom: 5px; }
    .filter-group { flex: 1 1 200px; min-width: 250px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 14px; }
    
    .slider-container { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    .number-input { width: 70px; padding: 6px; background: #222; color: #66ccff; border: 1px solid #66ccff; border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 14px; text-align: center; }
    select.filter-select { width: 100%; padding: 8px; background: #222; color: white; border: 1px solid #66ccff; border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 14px; cursor: pointer; }
    .slider-label-small { font-size:12px; color:#ccc; margin-bottom:2px; display:block; }
    
    /* --- WIDE, LESS VERTICAL TABLE --- */
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    table.dataTable.nowrap th, table.dataTable.nowrap td { white-space: nowrap; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    
    /* =======================================================
       --- HORIZONTAL EXTERNAL MAP KEY (BELOW MAP) ---
       ======================================================= */
    #custom-legend-container {
        margin-bottom: 25px;
        width: 100%;
    }
    #custom-legend-container .leaflet-control-layers {
        position: static !important; 
        background: #111 !important; 
        border: 1px solid #444 !important; 
        color: white !important; 
        border-radius: 12px !important; 
        padding: 20px !important; 
        max-height: none !important; 
        width: 100%;
        box-sizing: border-box;
        box-shadow: none !important;
    }
    #custom-legend-container .leaflet-control-layers-list { display: block; }
    #custom-legend-container .leaflet-control-layers-base,
    #custom-legend-container .leaflet-control-layers-overlays {
        display: flex;
        flex-wrap: wrap;
        column-gap: 30px;
        row-gap: 15px;
        align-items: center;
    }
    #custom-legend-container .leaflet-control-layers-separator {
        display: block;
        flex-basis: 100%;
        height: 1px;
        background: #333;
        margin: 10px 0;
    }
    #custom-legend-container .leaflet-control-layers label {
        display: flex;
        align-items: center;
        font-size: 15px;
        margin: 0 !important;
        white-space: nowrap;
        cursor: pointer;
    }
    #custom-legend-container input[type="checkbox"], 
    #custom-legend-container input[type="radio"] {
        transform: scale(1.2);
        margin-right: 10px;
        cursor: pointer;
    }

    /* --- THEMED SECTION BREAKS IN THE KEY --- */
    .legend-break {
        flex-basis: 100%; 
        width: 100%;
        margin-top: 15px;
        border-bottom: 1px solid #555;
        padding-bottom: 5px;
        color: #aaa;
        font-weight: bold;
        font-size: 13px;
        letter-spacing: 1px;
        pointer-events: none;
    }

    .substation-marker { background-color: #ffffff; border: 2px solid #000; border-radius: 2px; }
    .throttle-instruction { font-size: 12px; color: #aaa; margin-bottom: 8px; font-style: italic; }

    /* --- INFRASTRUCTURE MARKER STYLES --- */
    .dc-marker { background-color: #00ffff; border: 1px solid #ffffff; border-radius: 0; box-shadow: 0 0 8px #00ffff; }
    .airport-marker { background-color: #ff00ff; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ff00ff; }
    .railway-marker { background-color: #ffd700; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ffd700; }
    .water-marker { background-color: #0088ff; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #0088ff; }
    .nuclear-marker { background-color: #39ff14; border: 2px solid #000; border-radius: 50%; box-shadow: 0 0 10px #39ff14; }
    .gas-marker { background-color: #ff4500; border: 1px solid #fff; border-radius: 50%; box-shadow: 0 0 8px #ff4500; }
    .hs2-marker { background-color: #8a2be2; border: 1px solid #fff; transform: rotate(45deg); box-shadow: 0 0 8px #8a2be2; }
    .tube-marker { background-color: #e32017; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #e32017; } /* TfL Red */

    /* --- GLOWING HEATMAP-STYLE MARKERS --- */
    .industry-marker { 
        background: radial-gradient(circle, rgba(255, 69, 0, 0.9) 15%, rgba(255, 100, 0, 0.5) 45%, rgba(255, 100, 0, 0) 80%);
        border-radius: 50%; 
        border: none; 
        box-shadow: none; 
        pointer-events: auto;
    }
    .oil-marker { 
        background: radial-gradient(circle, rgba(200, 200, 200, 0.9) 15%, rgba(100, 100, 100, 0.5) 45%, rgba(0, 0, 0, 0) 80%);
        border-radius: 50%; 
        border: none; 
        box-shadow: none; 
        pointer-events: auto;
    }

    /* --- LEGAL DISCLAIMER --- */
    .legal-disclaimer { text-align: center; font-size: 12px; color: #888; margin-top: 25px; padding-bottom: 15px; font-family: 'Courier New', Courier, monospace; }
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
            <div class="world-clock-item"><span class="world-city">San Francisco</span> <span class="world-time" id="time-sfo">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Houston</span> <span class="world-time" id="time-hou">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">New York</span> <span class="world-time" id="time-nyc">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Santo Domingo</span> <span class="world-time" id="time-sdo">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Santiago</span> <span class="world-time" id="time-scl">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">São Paulo</span> <span class="world-time" id="time-sao">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Zurich / EU</span> <span class="world-time" id="time-zur">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Athens / Kyiv / Tel Aviv</span> <span class="world-time" id="time-ath">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Cape Town</span> <span class="world-time" id="time-cpt">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Moscow / Istanbul</span> <span class="world-time" id="time-mos">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Tehran</span> <span class="world-time" id="time-thr">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Dubai / Mauritius</span> <span class="world-time" id="time-dxb">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Delhi / Bangalore</span> <span class="world-time" id="time-del">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Beijing / Perth / Manila</span> <span class="world-time" id="time-bei">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Tokyo</span> <span class="world-time" id="time-tyo">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Sydney</span> <span class="world-time" id="time-syd">--:--</span></div>
            <div class="world-clock-item"><span class="world-city">Auckland</span> <span class="world-time" id="time-akl">--:--</span></div>
        </div>
    </div>

    <div class="filter-panel">
        <h3>🔍 Map Filters</h3>
        
        <div class="filter-group">
            <label for="techSelect">Technology Type:</label>
            <select id="techSelect" class="filter-select">
                <option value="all">All Technologies</option>
                <option value="solar">Solar Photovoltaics</option>
                <option value="wind_onshore">Wind (Onshore)</option>
                <option value="wind_offshore">Wind (Offshore)</option>
                <option value="battery">Battery / Storage</option>
            </select>
        </div>

        <div class="filter-group">
            <label for="statusSelect">Project Status:</label>
            <select id="statusSelect" class="filter-select">
                <option value="all">All Statuses</option>
                <option value="operational">Operational</option>
                <option value="construction">Under Construction</option>
                <option value="consented">Consented / Awaiting Construction</option>
                <option value="planning">In Planning / Submitted</option>
            </select>
        </div>

        <div class="filter-group">
            <label for="minCapacityRange">Minimum Size (MW):</label>
            <div class="slider-container">
                <input type="range" id="minCapacityRange" min="0" max="10000" value="0" step="1">
                <input type="number" id="minCapacityInput" value="0" min="0" max="10000" class="number-input">
            </div>
            
            <label for="maxCapacityRange" style="margin-top:10px;">Maximum Size (MW):</label>
            <div class="slider-container">
                <input type="range" id="maxCapacityRange" min="0" max="10000" value="10000" step="1">
                <input type="number" id="maxCapacityInput" value="10000" min="0" max="10000" class="number-input">
            </div>
        </div>

        <div class="filter-group" style="border-left: 1px solid #444; padding-left: 20px;">
            <label style="color:#ffffff;">■ Substation Density:</label>
            <div class="throttle-instruction">*Manage RAM (Midlands Outwards)</div>
            <span class="slider-label-small">South ➔ North</span>
            <div class="slider-container">
                <input type="range" id="substationDensityRangeSN" min="0" max="100" value="10" step="5">
                <input type="text" id="substationDensityInputSN" value="10%" readonly class="number-input" style="color:#fff; border-color:#fff;">
            </div>
            <span class="slider-label-small" style="margin-top:5px;">North ➔ South</span>
            <div class="slider-container">
                <input type="range" id="substationDensityRangeNS" min="0" max="100" value="0" step="5">
                <input type="text" id="substationDensityInputNS" value="0%" readonly class="number-input" style="color:#fff; border-color:#fff;">
            </div>
        </div>

        <div class="filter-group">
            <label style="color:#ffffff;">💧 Water Utilities Density:</label>
            <div class="throttle-instruction">*Manage RAM (Midlands Outwards)</div>
            <span class="slider-label-small">South ➔ North</span>
            <div class="slider-container">
                <input type="range" id="waterDensityRangeSN" min="0" max="100" value="10" step="5">
                <input type="text" id="waterDensityInputSN" value="10%" readonly class="number-input" style="color:#fff; border-color:#fff;">
            </div>
            <span class="slider-label-small" style="margin-top:5px;">North ➔ South</span>
            <div class="slider-container">
                <input type="range" id="waterDensityRangeNS" min="0" max="100" value="0" step="5">
                <input type="text" id="waterDensityInputNS" value="0%" readonly class="number-input" style="color:#fff; border-color:#fff;">
            </div>
        </div>
    </div>

    <div id="map-wrapper">
        <div id="map"></div>
    </div>

    <div id="custom-legend-container"></div>

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

    <div class="legal-disclaimer">
        Map data includes OpenStreetMap contributors and is used under the ODbL licence.
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"></script>

<script>
    // --- CLOCK SCRIPT ---
    function updateMissionClock() {
        const now = new Date();
        const target = new Date("2050-01-01T00:00:00Z");
        const diffMs = target - now;

        const dateOptions = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Europe/London' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/London' }; 
        
        const dateStr = now.toLocaleDateString('en-GB', dateOptions);
        const timeStr = now.toLocaleTimeString('en-GB', timeOptions);
        
        document.getElementById('current-time-display').innerHTML = `${dateStr}<br>${timeStr}`;

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
        document.getElementById('time-sdo').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'America/Santo_Domingo' });
        document.getElementById('time-scl').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'America/Santiago' });
        document.getElementById('time-sao').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'America/Sao_Paulo' });
        document.getElementById('time-zur').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Europe/Zurich' });
        document.getElementById('time-ath').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Europe/Athens' }); 
        document.getElementById('time-cpt').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Africa/Johannesburg' }); 
        document.getElementById('time-mos').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Europe/Istanbul' }); 
        document.getElementById('time-thr').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Tehran' });
        document.getElementById('time-dxb').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Dubai' });
        document.getElementById('time-del').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Kolkata' }); 
        document.getElementById('time-bei').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Shanghai' }); 
        document.getElementById('time-tyo').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Asia/Tokyo' });
        document.getElementById('time-syd').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Australia/Sydney' });
        document.getElementById('time-akl').innerText = now.toLocaleTimeString('en-GB', { ...opts, timeZone: 'Pacific/Auckland' });
    }
    setInterval(updateMissionClock, 1000);
    updateMissionClock();

    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });

    const map = L.map('map', { center: [49.5, -1.0], zoom: 5.5, preferCanvas: true, layers: [darkMap] }); 

    const MIDLANDS_LAT = 52.7; 

    // Grid Layers
    const grid400Layer = L.layerGroup(); const grid275Layer = L.layerGroup(); const grid220Layer = L.layerGroup();
    const grid132Layer = L.layerGroup(); const grid66Layer = L.layerGroup(); 
    
    const subsLayer = L.layerGroup();
    let allSubstationFeatures = []; 
    let currentSubstationPercentageSN = 10; 
    let currentSubstationPercentageNS = 0; 
    
    // Infrastructure Layers
    const dataCentreLayer = L.layerGroup();
    const airportLayer = L.layerGroup();
    const railwayLayer = L.layerGroup();
    const tubeLayer = L.layerGroup(); // Added strictly for London Underground
    
    const industryLayer = L.layerGroup();
    const oilLayer = L.layerGroup();
    
    const waterLayer = L.layerGroup(); 
    let allWaterFeatures = []; 
    let currentWaterPercentageSN = 10;
    let currentWaterPercentageNS = 0;

    const nuclearLayer = L.layerGroup();
    const gasLayer = L.layerGroup();
    const hs2Layer = L.layerGroup();
    
    const dummyHeaderGrid = L.layerGroup(); 
    const dummyHeaderDemand = L.layerGroup(); 
    
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });

    const baseMaps = { "🌑 Dark Mode": darkMap, "🌍 Satellite View": satelliteMap };
    
    // --- MAP KEY OVERLAYS ---
    const overlayMaps = {
        "<div class='legend-break' style='margin-top:0;'>NATIONAL GRID & GENERATION</div>": dummyHeaderGrid,
        
        "<span style='color: #0054ff; font-weight: bold;'>400kV Lines</span>": grid400Layer,
        "<span style='color: #ff0000; font-weight: bold;'>275kV Lines</span>": grid275Layer,
        "<span style='color: #ff9900; font-weight: bold;'>220kV Cables</span>": grid220Layer,
        "<span style='color: #00cc00; font-weight: bold;'>132kV Lines</span>": grid132Layer,
        "<span style='color: #b200ff; font-weight: bold;'>66kV Cables</span>": grid66Layer,
        "<span style='color: #ffffff; font-weight: bold;'>■ Substations</span>": subsLayer,
        "⚡ Energy Projects": markers,
        "<span style='color: #39ff14; font-weight: bold;'>☢️ Nuclear Plants</span>": nuclearLayer,
        "<span style='color: #ff4500; font-weight: bold;'>🔥 Gas Plants</span>": gasLayer,
        
        "<div class='legend-break'>HEAVY ENERGY USERS (Potential PPA/Offtakers)</div>": dummyHeaderDemand,
        
        "<span style='color: #ff6600; font-weight: bold;'>🏭 Heavy Industry</span>": industryLayer,
        "<span style='color: #cccccc; font-weight: bold;'>🛢️ Oil Sites</span>": oilLayer,
        "<span style='color: #0088ff; font-weight: bold;'>💧 Water Utilities</span>": waterLayer,
        "<span style='color: #00ffff; font-weight: bold;'>🖥️ Data Centres</span>": dataCentreLayer,
        "<span style='color: #ff00ff; font-weight: bold;'>✈️ Airports</span>": airportLayer,
        "<span style='color: #8a2be2; font-weight: bold;'>🚄 HS2 Stations</span>": hs2Layer,
        "<span style='color: #ffd700; font-weight: bold;'>🚆 Railways</span>": railwayLayer,
        "<span style='color: #e32017; font-weight: bold;'>🚇 London Underground</span>": tubeLayer // Mapped specifically to the tube layer
    };
    
    const layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);
    const legendHtml = layerControl.getContainer();
    document.getElementById('custom-legend-container').appendChild(legendHtml);
    L.DomEvent.disableClickPropagation(legendHtml); 

    // --- FETCH GRID DATA ---
    fetch('{{ site.baseurl }}/grid_400kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(grid400Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_275kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(grid275Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_220kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff9900', weight: 2, opacity: 0.8 } }).addTo(grid220Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_132kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(grid132Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_66kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#b200ff', weight: 1.5, opacity: 0.7 } }).addTo(grid66Layer)).catch(e => console.error(e));
    
    // --- FETCH INFRASTRUCTURE DATA ---
    fetch('{{ site.baseurl }}/datacentres.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'dc-marker', iconSize: [12, 12] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Data Centre"}</b><br>Operator: ${f.properties.operator || "Unknown"}</div>`); }
        }).addTo(dataCentreLayer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/airports.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'airport-marker', iconSize: [12, 12] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Airport"}</b><br>IATA: ${f.properties.iata || "N/A"}<br>ICAO: ${f.properties.icao || "N/A"}</div>`); }
        }).addTo(airportLayer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/railways.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'railway-marker', iconSize: [10, 10] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Railway Station"}</b><br>Network: ${f.properties.network || "National Rail / TFL"}</div>`); }
        }).addTo(railwayLayer);
    }).catch(e => console.error(e));

    // --- FETCH LONDON UNDERGROUND (STANDALONE) ---
    fetch('{{ site.baseurl }}/london_underground.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { 
                return L.marker(ll, { icon: L.divIcon({ className: 'tube-marker', iconSize: [8, 8] }) }); 
            },
            onEachFeature: function (f, l) { 
                l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Station"}</b><br>Network: ${f.properties.operator || "TfL"}</div>`); 
            }
        }).addTo(tubeLayer);
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/industrial_offtakers.geojson').then(r => r.json()).then(data => {
        data.features.forEach(f => {
            const typeLower = (f.properties.type || "").toLowerCase();
            const isWater = typeLower.includes('water');
            const isOil = typeLower.includes('oil');
            
            if (isWater) {
                allWaterFeatures.push(f);
            } else if (isOil) {
                const lat = f.geometry.coordinates[1];
                const lon = f.geometry.coordinates[0];
                const marker = L.marker([lat, lon], { icon: L.divIcon({ className: 'oil-marker', iconSize: [40, 40], iconAnchor: [20, 20] }) });
                marker.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name}</b><br>Type: Oil Site<br>Operator: ${f.properties.operator}</div>`);
                oilLayer.addLayer(marker);
            } else {
                const lat = f.geometry.coordinates[1];
                const lon = f.geometry.coordinates[0];
                const marker = L.marker([lat, lon], { icon: L.divIcon({ className: 'industry-marker', iconSize: [40, 40], iconAnchor: [20, 20] }) });
                marker.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name}</b><br>Type: ${f.properties.type}<br>Operator: ${f.properties.operator}</div>`);
                industryLayer.addLayer(marker);
            }
        });
        
        allWaterFeatures.sort((a, b) => {
            const distA = Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT);
            const distB = Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT);
            return distA - distB;
        });
        renderWater();
        
    }).catch(e => console.error(e));

    function renderWater() {
        waterLayer.clearLayers();
        if (allWaterFeatures.length === 0) return;
        
        const total = allWaterFeatures.length;
        const numSN = Math.floor((currentWaterPercentageSN / 100) * total);
        const numNS = Math.floor((currentWaterPercentageNS / 100) * total);
        
        let featuresToRender = new Set();
        if (numSN > 0) allWaterFeatures.slice(0, numSN).forEach(f => featuresToRender.add(f));
        if (numNS > 0) allWaterFeatures.slice(total - numNS).forEach(f => featuresToRender.add(f));
        
        Array.from(featuresToRender).forEach(f => {
            const lat = f.geometry.coordinates[1];
            const lon = f.geometry.coordinates[0];
            const marker = L.marker([lat, lon], { icon: L.divIcon({ className: 'water-marker', iconSize: [10, 10] }) });
            marker.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name}</b><br>Type: ${f.properties.type}<br>Operator: ${f.properties.operator}</div>`);
            waterLayer.addLayer(marker);
        });
    }

    $('#waterDensityRangeSN').on('input', function() {
        const val = parseInt($(this).val());
        $('#waterDensityInputSN').val(val + "%");
        currentWaterPercentageSN = val;
        renderWater();
    });

    $('#waterDensityRangeNS').on('input', function() {
        const val = parseInt($(this).val());
        $('#waterDensityInputNS').val(val + "%");
        currentWaterPercentageNS = val;
        renderWater();
    });

    fetch('{{ site.baseurl }}/power_plants.geojson').then(r => r.json()).then(data => {
        data.features.forEach(f => {
            const isNuke = f.properties.source === 'nuclear';
            const lat = f.geometry.coordinates[1];
            const lon = f.geometry.coordinates[0];
            const typeText = isNuke ? 'Nuclear Power Plant' : 'Gas Power Plant';
            const marker = L.marker([lat, lon], { icon: L.divIcon({ className: isNuke ? 'nuclear-marker' : 'gas-marker', iconSize: [14, 14] }) });
            marker.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Power Plant"}</b><br>Type: ${typeText}<br>Operator: ${f.properties.operator || "Unknown"}</div>`);
            if (isNuke) { nuclearLayer.addLayer(marker); } else { gasLayer.addLayer(marker); }
        });
    }).catch(e => console.error(e));

    fetch('{{ site.baseurl }}/hs2.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'hs2-marker', iconSize: [12, 12] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "HS2 Infrastructure"}</b><br>Status: Future Demand Centre</div>`); }
        }).addTo(hs2Layer);
    }).catch(e => console.error(e));

    // --- FETCH SUBSTATIONS & DUAL THROTTLE ---
    fetch('{{ site.baseurl }}/grid_substations.geojson')
        .then(r => r.json())
        .then(data => {
            allSubstationFeatures = data.features.sort((a, b) => {
                const distA = Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT);
                const distB = Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT);
                return distA - distB;
            });
            renderSubstations();
        })
        .catch(e => console.error(e));

    function renderSubstations() {
        subsLayer.clearLayers();
        if (allSubstationFeatures.length === 0) return;
        
        const total = allSubstationFeatures.length;
        const numSN = Math.floor((currentSubstationPercentageSN / 100) * total);
        const numNS = Math.floor((currentSubstationPercentageNS / 100) * total);
        
        let featuresToRender = new Set();
        if (numSN > 0) allSubstationFeatures.slice(0, numSN).forEach(f => featuresToRender.add(f));
        if (numNS > 0) allSubstationFeatures.slice(total - numNS).forEach(f => featuresToRender.add(f));
        
        L.geoJSON({"type": "FeatureCollection", "features": Array.from(featuresToRender)}, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'substation-marker', iconSize: [8, 8] }) }); },
            onEachFeature: function (f, l) { 
                const v = f.properties.voltage || "Unknown";
                l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Substation"}</b><br>Voltage: ${v} V<br>Operator: ${f.properties.operator || "Unknown"}</div>`); 
            }
        }).addTo(subsLayer);
    }

    $('#substationDensityRangeSN').on('input', function() {
        const val = parseInt($(this).val());
        $('#substationDensityInputSN').val(val + "%");
        currentSubstationPercentageSN = val;
        renderSubstations();
    });

    $('#substationDensityRangeNS').on('input', function() {
        const val = parseInt($(this).val());
        $('#substationDensityInputNS').val(val + "%");
        currentSubstationPercentageNS = val;
        renderSubstations();
    });

    const csvUrl = '{{ site.baseurl }}/repd.csv';
    let allData = []; let allMarkers = []; let dataTable;
    let currentMin = 0; let currentMax = 10000;
    let currentTech = 'all'; let currentStatus = 'all';

    Papa.parse(csvUrl, {
        download: true, header: true, skipEmptyLines: true,
        complete: function(results) { allData = results.data; initDashboard(); }
    });

    function initDashboard() {
        updateDisplay();
        $('#techSelect').on('change', function() { currentTech = $(this).val(); updateDisplay(); });
        $('#statusSelect').on('change', function() { currentStatus = $(this).val(); updateDisplay(); });
        $('#minCapacityRange').on('input', function() { currentMin = parseFloat($(this).val()); if(currentMin>currentMax){currentMax=currentMin;$('#maxCapacityRange').val(currentMax);$('#maxCapacityInput').val(currentMax);}$('#minCapacityInput').val(currentMin); updateDisplay(); });
        $('#maxCapacityRange').on('input', function() { currentMax = parseFloat($(this).val()); if(currentMax<currentMin){currentMin=currentMax;$('#minCapacityRange').val(currentMin);$('#minCapacityInput').val(currentMin);}$('#maxCapacityInput').val(currentMax); updateDisplay(); });
        $('#minCapacityInput').on('input', function() { let val = parseFloat($(this).val())||0; if(val>currentMax){currentMax=val;$('#maxCapacityInput').val(val);$('#maxCapacityRange').val(val);}currentMin=val;$('#minCapacityRange').val(val); updateDisplay(); });
        $('#maxCapacityInput').on('input', function() { let val = parseFloat($(this).val())||0; if(val<currentMin){currentMin=val;$('#minCapacityInput').val(val);$('#minCapacityRange').val(val);}currentMax=val;$('#maxCapacityRange').val(val); updateDisplay(); });
    }

    function updateDisplay() {
        markers.clearLayers(); allMarkers = [];
        const filteredTableData = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const status = row['Development Status'] || 'Unknown';
            const statusLower = status.toLowerCase();
            const techType = (row['Technology Type'] || '').toLowerCase();
            
            const operator = row['Operator (or Applicant)'] || row['Developer'] || 'Unknown';
            const address = row['Address'] || 'Not Provided';
            
            let matchTech = currentTech==='all' || (currentTech==='solar' && techType.includes('solar')) || (currentTech==='wind_onshore' && techType.includes('wind') && techType.includes('onshore')) || (currentTech==='wind_offshore' && techType.includes('wind') && techType.includes('offshore')) || (currentTech==='battery' && (techType.includes('battery') || techType.includes('storage')));
            let matchStatus = currentStatus==='all' || (currentStatus==='operational' && statusLower==='operational') || (currentStatus==='construction' && statusLower.includes('construction')) || (currentStatus==='consented' && (statusLower.includes('granted') || statusLower.includes('consented') || statusLower==='awaiting construction')) || (currentStatus==='planning' && (statusLower.includes('submitted') || statusLower.includes('planning') || statusLower.includes('scoping')));
            let inRange = capacity >= currentMin && capacity <= currentMax;

            if (matchTech && matchStatus && inRange) {
                const x = parseFloat(row['X-coordinate']); const y = parseFloat(row['Y-coordinate']);
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const lat = coords[1]; const lon = coords[0];
                        const isOp = status === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00'; 
                        const baseRadius = Math.max(10, (Math.sqrt(capacity) || 4) * 2);
                        
                        const marker = L.circleMarker([lat, lon], {
                            radius: baseRadius, baseRadius: baseRadius, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.8
                        }).bindPopup(`
                            <div style="min-width:180px; font-family: Courier, monospace;">
                                <b style="font-size:14px; color:#000;">${row['Site Name']}</b><br>
                                <span style="font-size:12px; color:#555;">${operator}</span>
                                <hr style="margin:5px 0; border:0; border-top:1px solid #ccc;">
                                <span style="font-size:13px;">${row['Technology Type']}</span><br>
                                <span style="font-size:16px;"><b>${capacity} MW</b></span><br>
                                <span style="color:#555;">Status: <b>${status}</b></span><br>
                                <small>${row['County']}</small>
                            </div>
                        `);

                        markers.addLayer(marker); allMarkers.push(marker);
                        filteredTableData.push([row['Site Name'], operator, row['Technology Type'], capacity, status, row['County'], address]);
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
                pageLength: 10, 
                order: [[3, 'desc']], 
                responsive: true, 
                scrollX: true, 
                scrollY: "300px", 
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

    // --- HIDE THE CHECKBOX FOR THE DUMMY HEADERS & FORCE LINE BREAK ---
    setTimeout(() => {
        const labels = document.querySelectorAll('#custom-legend-container label');
        labels.forEach(label => {
            if (label.innerHTML.includes('HEAVY ENERGY USERS') || label.innerHTML.includes('NATIONAL GRID')) {
                const checkbox = label.querySelector('input');
                if (checkbox) checkbox.style.display = 'none';
                label.style.flexBasis = "100%"; 
            }
        });
    }, 500);

</script>
