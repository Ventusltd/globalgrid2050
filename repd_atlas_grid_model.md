---
layout: page
title: UK & France Energy Atlas
permalink: /repd_atlas_grid_model/
---

<link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />

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

    /* MapLibre specific popup resets */
    .maplibregl-popup-content {
        background: #111;
        color: white;
        border: 1px solid #444;
        border-radius: 8px;
        font-family: 'Courier New', Courier, monospace;
        padding: 10px;
    }
    .maplibregl-popup-anchor-bottom .maplibregl-popup-tip { border-top-color: #111; }
    .maplibregl-popup-close-button { color: white; }

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
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; overflow-x: auto; }
    table.dataTable.nowrap th, table.dataTable.nowrap td { white-space: nowrap; }
    
    /* =======================================================
       --- CUSTOM SCADA LEGEND PANEL ---
       ======================================================= */
    #custom-legend-container { margin-bottom: 25px; width: 100%; }
    
    .custom-legend-panel {
        background: #111; border: 1px solid #444; border-radius: 12px; padding: 20px;
        margin-bottom: 25px; max-height: 220px; overflow-y: auto; overflow-x: hidden;
        box-sizing: border-box; scrollbar-color: #555 #111; scrollbar-width: thin;
    }

    .legend-section-title { font-size: 11px; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
    .legend-divider { width: 100%; height: 1px; background: #333; margin: 14px 0; }
    .legend-header {
        grid-column: 1 / -1; font-size: 12px; color: #aaa; font-weight: bold;
        letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #555;
        padding-bottom: 6px; margin-top: 4px; width: 100%;
    }

    .legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; align-items: start; width: 100%; }
    .legend-item { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.35; cursor: pointer; color: white; word-break: break-word; }
    .legend-item input[type="checkbox"], .legend-item input[type="radio"] { flex-shrink: 0; margin-top: 3px; transform: scale(1.15); cursor: pointer; accent-color: #66ccff; }

    @media (max-width: 768px) {
        .legend-grid { grid-template-columns: 1fr; gap: 10px 0; }
        .legend-item { font-size: 13px; }
    }

    .throttle-instruction { font-size: 12px; color: #aaa; margin-bottom: 8px; font-style: italic; }
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

    <div id="custom-legend-container"></div>

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
                    <th>Address</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <div class="legal-disclaimer">
        Map data includes OpenStreetMap contributors and is used under the ODbL licence. Powered by MapLibre GL JS.
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
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
    setInterval(updateMissionClock, 1000); updateMissionClock();

    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    const MIDLANDS_LAT = 52.7;

    // --- MAPLIBRE INITIALIZATION ---
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.0, 49.5],
        zoom: 5.5,
        attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    let allSubstationFeatures = []; let currentSubstationPercentageSN = 10; let currentSubstationPercentageNS = 0; 
    let allWaterFeatures = []; let currentWaterPercentageSN = 10; let currentWaterPercentageNS = 0;

    // Helper for popup generation during fetch
    function generatePopupHTML(title, lines) {
        return `<div style="font-family: Courier, monospace;"><b>${title}</b><br>${lines.join('<br>')}</div>`;
    }

    // --- SCADA CONFIG & LEGEND PANEL ---
    const layerConfig = [
        { type: 'header', label: 'NATIONAL GRID & GENERATION' },
        { id: 'grid400', layerIds: ['grid400-layer'], label: '400kV Lines', color: '#0054ff', default: true },
        { id: 'grid275', layerIds: ['grid275-layer'], label: '275kV Lines', color: '#ff0000', default: false },
        { id: 'grid220', layerIds: ['grid220-layer'], label: '220kV Cables', color: '#ff9900', default: false },
        { id: 'grid132', layerIds: ['grid132-layer'], label: '132kV Lines', color: '#00cc00', default: false },
        { id: 'grid66', layerIds: ['grid66-layer'], label: '66kV Cables', color: '#b200ff', default: false },
        { id: 'subs', layerIds: ['subs-layer'], label: '■ Substations', color: '#ffffff', default: true },
        { id: 'energy', layerIds: ['repd-clusters', 'repd-cluster-count', 'repd-unclustered'], label: '⚡ Energy Projects', color: '#00f2ff', default: true },
        { id: 'nuclear', layerIds: ['nuclear-layer'], label: '☢️ Nuclear Plants', color: '#39ff14', default: false },
        { id: 'gas', layerIds: ['gas-layer'], label: '🔥 Gas Plants', color: '#ff4500', default: false },
        { type: 'header', label: 'HEAVY ENERGY USERS (Potential PPA/Offtakers)' },
        { id: 'industry', layerIds: ['industry-layer'], label: '🏭 Heavy Industry', color: '#ff6600', default: false },
        { id: 'oil', layerIds: ['oil-layer'], label: '🛢️ Oil Sites', color: '#cccccc', default: false },
        { id: 'water', layerIds: ['water-layer'], label: '💧 Water Utilities', color: '#0088ff', default: false },
        { id: 'dc', layerIds: ['dc-layer'], label: '🖥️ Data Centres', color: '#00ffff', default: false },
        { id: 'airports', layerIds: ['airports-layer'], label: '✈️ Airports', color: '#ff00ff', default: false },
        { id: 'hs2', layerIds: ['hs2-layer'], label: '🚄 HS2 Stations', color: '#8a2be2', default: false },
        { id: 'rail', layerIds: ['rail-layer'], label: '🚆 Railways', color: '#ffd700', default: false },
    ];

    function toggleMapLibreLayers(layerIds, isVisible) {
        layerIds.forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none');
        });
    }

    function buildLegendPanel() {
        const container = document.getElementById('custom-legend-container');

        const baseHtml = `
            <label class="legend-item"><input type="radio" name="basemap" value="dark" checked><span style="color:#aaa;">🌑 Dark Mode</span></label>
            <label class="legend-item"><input type="radio" name="basemap" value="satellite"><span style="color:#aaa;">🌍 Satellite View</span></label>
        `;

        const overlayHtml = layerConfig.map(item => {
            if (item.type === 'header') return `<div class="legend-header">${item.label}</div>`;
            return `<label class="legend-item"><input type="checkbox" data-layer-id="${item.id}" ${item.default ? 'checked' : ''}><span style="color: ${item.color};">${item.label}</span></label>`;
        }).join('');

        container.innerHTML = `
            <div class="custom-legend-panel">
                <div class="legend-section-title">BASE MAP</div>
                <div class="legend-grid legend-basemaps">${baseHtml}</div>
                <div class="legend-divider"></div>
                <div class="legend-grid legend-overlays">${overlayHtml}</div>
            </div>
        `;

        container.querySelectorAll('input[name="basemap"]').forEach(radio => {
            radio.addEventListener('change', function() {
                if(this.value === 'satellite') toggleMapLibreLayers(['satellite-basemap'], true);
                else toggleMapLibreLayers(['satellite-basemap'], false);
            });
        });

        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', function() {
                const cfg = layerConfig.find(l => l.id === this.dataset.layerId);
                if (!cfg) return;
                toggleMapLibreLayers(cfg.layerIds, this.checked);
                if (this.checked && cfg.id === 'water') renderWater();
                if (this.checked && cfg.id === 'subs') renderSubstations();
            });
        });
    }

    // --- DATA LOADING & RENDERING (MAPLIBRE) ---
    map.on('load', () => {
        // Inject non-destructive satellite raster underneath everything
        map.addSource('satellite', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addLayer({ id: 'satellite-basemap', type: 'raster', source: 'satellite', layout: { visibility: 'none' } });

        // Helper to add sources and layers
        function addMapLayer(sourceId, layerId, type, paintStyles, filter = null) {
            if(!map.getSource(sourceId)) {
                map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            }
            const cfg = layerConfig.find(c => c.layerIds && c.layerIds.includes(layerId));
            const isVisible = cfg ? cfg.default : true;

            let layerDef = { id: layerId, type: type, source: sourceId, layout: { visibility: isVisible ? 'visible' : 'none' }, paint: paintStyles };
            if(filter) layerDef.filter = filter;
            map.addLayer(layerDef);
            
            // Add global click handler for popups
            map.on('click', layerId, (e) => {
                const html = e.features[0].properties.popupHTML;
                if(html) new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
            });
            map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
        }

        // Add base layers
        addMapLayer('grid400', 'grid400-layer', 'line', { 'line-color': '#0054ff', 'line-width': 3, 'line-opacity': 0.9 });
        addMapLayer('grid275', 'grid275-layer', 'line', { 'line-color': '#ff0000', 'line-width': 2.5, 'line-opacity': 0.85 });
        addMapLayer('grid220', 'grid220-layer', 'line', { 'line-color': '#ff9900', 'line-width': 2, 'line-opacity': 0.8 });
        addMapLayer('grid132', 'grid132-layer', 'line', { 'line-color': '#00cc00', 'line-width': 1.5, 'line-opacity': 0.7 });
        addMapLayer('grid66', 'grid66-layer', 'line', { 'line-color': '#b200ff', 'line-width': 1.2, 'line-opacity': 0.6 });
        
        addMapLayer('subs', 'subs-layer', 'circle', { 'circle-color': '#ffffff', 'circle-radius': 4, 'circle-stroke-width': 2, 'circle-stroke-color': '#000' });
        
        addMapLayer('dc', 'dc-layer', 'circle', { 'circle-color': '#00ffff', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' });
        addMapLayer('airports', 'airports-layer', 'circle', { 'circle-color': '#ff00ff', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' });
        addMapLayer('rail', 'rail-layer', 'circle', { 'circle-color': '#ffd700', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' });
        
        addMapLayer('industry', 'industry-layer', 'circle', { 'circle-color': '#ff4500', 'circle-radius': 12, 'circle-blur': 0.6 });
        addMapLayer('oil', 'oil-layer', 'circle', { 'circle-color': '#cccccc', 'circle-radius': 12, 'circle-blur': 0.6 });
        addMapLayer('water', 'water-layer', 'circle', { 'circle-color': '#0088ff', 'circle-radius': 4, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' });

        addMapLayer('powerplants', 'nuclear-layer', 'circle', { 'circle-color': '#39ff14', 'circle-radius': 6, 'circle-stroke-width': 2, 'circle-stroke-color': '#000' }, ['==', 'source', 'nuclear']);
        addMapLayer('powerplants', 'gas-layer', 'circle', { 'circle-color': '#ff4500', 'circle-radius': 6, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' }, ['!=', 'source', 'nuclear']);
        
        addMapLayer('hs2', 'hs2-layer', 'circle', { 'circle-color': '#8a2be2', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' });

        // --- NATIVE REPD CLUSTERING ---
        map.addSource('repd', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterMaxZoom: 12, clusterRadius: 50 });
        
        map.addLayer({ id: 'repd-clusters', type: 'circle', source: 'repd', filter: ['has', 'point_count'], layout: { visibility: 'visible' },
            paint: { 'circle-color': 'rgba(0, 242, 255, 0.6)', 'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40], 'circle-stroke-width': 1, 'circle-stroke-color': '#00f2ff' }
        });
        
        map.addLayer({ id: 'repd-cluster-count', type: 'symbol', source: 'repd', filter: ['has', 'point_count'], layout: { visibility: 'visible', 'text-field': '{point_count_abbreviated}', 'text-font': ['Open Sans Bold'], 'text-size': 12 }, paint: { 'text-color': '#000000' } });
        
        // Interactive unclustered points mapping directly to CSV properties
        map.addLayer({ id: 'repd-unclustered', type: 'circle', source: 'repd', filter: ['!', ['has', 'point_count']], layout: { visibility: 'visible' },
            paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['get', 'radius'], 12, ['*', 1.5, ['get', 'radius']]], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 0.8 }
        });
        
        map.on('click', 'repd-unclustered', (e) => {
            const html = e.features[0].properties.popupHTML;
            if(html) new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
        map.on('mouseenter', 'repd-unclustered', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'repd-unclustered', () => map.getCanvas().style.cursor = '');

        // Now build legend so toggles bind to actual MapLibre layers
        buildLegendPanel();
        
        // Fetch all geoJSON sources
        fetchGeo('{{ site.baseurl }}/grid_400kv.geojson', 'grid400', f => f.properties.popupHTML = generatePopupHTML('400kV Line', []));
        fetchGeo('{{ site.baseurl }}/grid_275kv.geojson', 'grid275', f => f.properties.popupHTML = generatePopupHTML('275kV Line', []));
        fetchGeo('{{ site.baseurl }}/grid_220kv.geojson', 'grid220', f => f.properties.popupHTML = generatePopupHTML('220kV Cable', []));
        fetchGeo('{{ site.baseurl }}/grid_132kv.geojson', 'grid132', f => f.properties.popupHTML = generatePopupHTML('132kV Line', []));
        fetchGeo('{{ site.baseurl }}/grid_66kv.geojson', 'grid66', f => f.properties.popupHTML = generatePopupHTML('66kV Cable', []));
        
        fetchGeo('{{ site.baseurl }}/datacentres.geojson', 'dc', f => f.properties.popupHTML = generatePopupHTML(f.properties.name || "Data Centre", [`Operator: ${f.properties.operator || "Unknown"}`]));
        fetchGeo('{{ site.baseurl }}/airports.geojson', 'airports', f => f.properties.popupHTML = generatePopupHTML(f.properties.name || "Airport", [`IATA: ${f.properties.iata || "N/A"}`, `ICAO: ${f.properties.icao || "N/A"}`]));
        fetchGeo('{{ site.baseurl }}/railways.geojson', 'rail', f => f.properties.popupHTML = generatePopupHTML(f.properties.name || "Railway Station", [`Network: ${f.properties.network || "National Rail"}`]));
        fetchGeo('{{ site.baseurl }}/hs2.geojson', 'hs2', f => f.properties.popupHTML = generatePopupHTML(f.properties.name || "HS2 Infrastructure", ["Status: Future Demand Centre"]));
        
        fetchGeo('{{ site.baseurl }}/power_plants.geojson', 'powerplants', f => {
            const typeText = f.properties.source === 'nuclear' ? 'Nuclear Power Plant' : 'Gas Power Plant';
            f.properties.popupHTML = generatePopupHTML(f.properties.name || "Power Plant", [`Type: ${typeText}`, `Operator: ${f.properties.operator || "Unknown"}`]);
        });

        // Fetch complex layers
        fetch('{{ site.baseurl }}/industrial_offtakers.geojson').then(r=>r.json()).then(data => {
            let indus=[], oil=[];
            data.features.forEach(f => {
                const tl = (f.properties.type || "").toLowerCase();
                f.properties.popupHTML = generatePopupHTML(f.properties.name, [`Type: ${f.properties.type}`, `Operator: ${f.properties.operator}`]);
                if(tl.includes('water')) { allWaterFeatures.push(f); }
                else if(tl.includes('oil')) { oil.push(f); }
                else { indus.push(f); }
            });
            map.getSource('industry').setData({type: 'FeatureCollection', features: indus});
            map.getSource('oil').setData({type: 'FeatureCollection', features: oil});
            allWaterFeatures.sort((a, b) => Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT) - Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT));
            renderWater();
        }).catch(e=>console.error(e));

        fetch('{{ site.baseurl }}/grid_substations.geojson').then(r=>r.json()).then(data => {
            allSubstationFeatures = data.features.sort((a, b) => Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT) - Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT));
            renderSubstations();
        }).catch(e=>console.error(e));

        // Start PapaParse REPD ingestion after map loads
        Papa.parse(csvUrl, { download: true, header: true, skipEmptyLines: true, complete: function(res) { allData = res.data; initDashboard(); }});
    });

    function fetchGeo(url, sourceId, formatter) {
        fetch(url).then(r=>r.json()).then(d => {
            if(formatter) d.features.forEach(formatter);
            map.getSource(sourceId).setData(d);
        }).catch(e => console.error(e));
    }

    // --- SLIDER RENDERING ---
    function renderWater() {
        if(!map.getSource('water')) return;
        const total = allWaterFeatures.length;
        const numSN = Math.floor((currentWaterPercentageSN / 100) * total);
        const numNS = Math.floor((currentWaterPercentageNS / 100) * total);
        let renderSet = new Set();
        if (numSN > 0) allWaterFeatures.slice(0, numSN).forEach(f => renderSet.add(f));
        if (numNS > 0) allWaterFeatures.slice(total - numNS).forEach(f => renderSet.add(f));
        map.getSource('water').setData({type: 'FeatureCollection', features: Array.from(renderSet)});
    }
    $('#waterDensityRangeSN').on('input', function() { currentWaterPercentageSN = parseInt($(this).val()); $('#waterDensityInputSN').val(currentWaterPercentageSN + "%"); renderWater(); });
    $('#waterDensityRangeNS').on('input', function() { currentWaterPercentageNS = parseInt($(this).val()); $('#waterDensityInputNS').val(currentWaterPercentageNS + "%"); renderWater(); });

    function renderSubstations() {
        if(!map.getSource('subs')) return;
        const total = allSubstationFeatures.length;
        const numSN = Math.floor((currentSubstationPercentageSN / 100) * total);
        const numNS = Math.floor((currentSubstationPercentageNS / 100) * total);
        let renderSet = new Set();
        if (numSN > 0) allSubstationFeatures.slice(0, numSN).forEach(f => { f.properties.popupHTML = generatePopupHTML(f.properties.name||"Substation", [`Voltage: ${f.properties.voltage||"Unknown"} V`, `Operator: ${f.properties.operator||"Unknown"}`]); renderSet.add(f); });
        if (numNS > 0) allSubstationFeatures.slice(total - numNS).forEach(f => { f.properties.popupHTML = generatePopupHTML(f.properties.name||"Substation", [`Voltage: ${f.properties.voltage||"Unknown"} V`, `Operator: ${f.properties.operator||"Unknown"}`]); renderSet.add(f); });
        map.getSource('subs').setData({type: 'FeatureCollection', features: Array.from(renderSet)});
    }
    $('#substationDensityRangeSN').on('input', function() { currentSubstationPercentageSN = parseInt($(this).val()); $('#substationDensityInputSN').val(currentSubstationPercentageSN + "%"); renderSubstations(); });
    $('#substationDensityRangeNS').on('input', function() { currentSubstationPercentageNS = parseInt($(this).val()); $('#substationDensityInputNS').val(currentSubstationPercentageNS + "%"); renderSubstations(); });

    // --- REPD CSV DATA & TABLE ENGINE ---
    let allData = []; let dataTable;
    let currentMin = 0; let currentMax = 10000; let currentTech = 'all'; let currentStatus = 'all';

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
        const filteredTableData = [];
        const geoJSONFeatures = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const status = row['Development Status'] || 'Unknown';
            const statusLower = status.toLowerCase();
            const techType = (row['Technology Type'] || '').toLowerCase();
            
            let matchTech = currentTech==='all' || (currentTech==='solar' && techType.includes('solar')) || (currentTech==='wind_onshore' && techType.includes('wind') && techType.includes('onshore')) || (currentTech==='wind_offshore' && techType.includes('wind') && techType.includes('offshore')) || (currentTech==='battery' && (techType.includes('battery') || techType.includes('storage')));
            let matchStatus = currentStatus==='all' || (currentStatus==='operational' && statusLower==='operational') || (currentStatus==='construction' && statusLower.includes('construction')) || (currentStatus==='consented' && (statusLower.includes('granted') || statusLower.includes('consented') || statusLower==='awaiting construction')) || (currentStatus==='planning' && (statusLower.includes('submitted') || statusLower.includes('planning') || statusLower.includes('scoping')));
            let inRange = capacity >= currentMin && capacity <= currentMax;

            if (matchTech && matchStatus && inRange) {
                const x = parseFloat(row['X-coordinate']); const y = parseFloat(row['Y-coordinate']);
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = status === 'Operational';
                        const baseRadius = Math.max(5, (Math.sqrt(capacity) || 4));
                        
                        const popup = `<div style="min-width:180px; font-family: Courier, monospace;">
                            <b style="font-size:14px; color:#000;">${row['Site Name']}</b><br>
                            <span style="font-size:12px; color:#555;">${row['Operator (or Applicant)'] || row['Developer'] || 'Unknown'}</span>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #ccc;">
                            <span style="font-size:13px;">${row['Technology Type']}</span><br>
                            <span style="font-size:16px;"><b>${capacity} MW</b></span><br>
                            <span style="color:#555;">Status: <b>${status}</b></span><br><small>${row['County']}</small></div>`;

                        geoJSONFeatures.push({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: coords },
                            properties: { radius: baseRadius, color: isOp ? '#00f2ff' : '#ff9d00', popupHTML: popup }
                        });
                        filteredTableData.push([row['Site Name'], row['Operator (or Applicant)'] || row['Developer'] || 'Unknown', row['Technology Type'], capacity, status, row['County'], row['Address'] || 'Not Provided']);
                    } catch (e) {}
                }
            }
        });

        // Push new array directly to the GPU rendering engine
        if(map.getSource('repd')) map.getSource('repd').setData({type: 'FeatureCollection', features: geoJSONFeatures});

        if ($.fn.DataTable.isDataTable('#repd-table')) { dataTable.clear().rows.add(filteredTableData).draw(); } 
        else { dataTable = $('#repd-table').DataTable({ data: filteredTableData, pageLength: 10, order: [[3, 'desc']], responsive: false, scrollX: true, scrollY: "300px", scrollCollapse: true, language: { search: "Scan Systems:" }}); }
    }
</script>
