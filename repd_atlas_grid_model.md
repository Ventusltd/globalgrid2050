---
layout: page
title: UK Energy Atlas (REPD)
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
    ::-webkit-scrollbar-button:single-button:vertical:decrement { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>'); background-size: 16px; background-position: center; background-repeat: no-repeat; }
    ::-webkit-scrollbar-button:single-button:vertical:increment { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'); background-size: 16px; background-position: center; background-repeat: no-repeat; }
    
    /* --- Standard Dashboard Styles --- */
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; position: relative; }
    #map-wrapper { width: 100%; margin-bottom: 20px; position: relative; }
    #map { height: 850px; width: 100%; border-radius: 12px; background: #0b0e14; border: 3px solid #2a2f3a; }

    .filter-panel { background: #111; padding: 20px; border-radius: 12px; border: 1px solid #444; margin-bottom: 15px; color: white; }
    .filter-panel h3 { margin-top: 0; color: #66ccff; font-size: 22px; margin-bottom: 15px; }
    .filter-group { margin-bottom: 20px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 16px; }
    
    .slider-container { display: flex; gap: 15px; align-items: center; margin-bottom: 10px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    .number-input { width: 90px; padding: 8px; background: #222; color: #66ccff; border: 1px solid #66ccff; border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 16px; text-align: center; }
    select.filter-select { width: 100%; padding: 10px; margin-bottom: 10px; background: #222; color: white; border: 1px solid #66ccff; border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 16px; cursor: pointer; }
    .slider-label-small { font-size:13px; color:#ccc; margin-bottom:2px; display:block; }
    
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; overflow-x: auto; }
    table.dataTable.nowrap th, table.dataTable.nowrap td { white-space: nowrap; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    
    /* --- MAP KEY BOX --- */
    .leaflet-control-layers { 
        background: rgba(17, 17, 17, 0.9) !important; 
        border: 1px solid #444 !important; 
        color: white !important; 
        border-radius: 6px !important; 
        font-family: 'Courier New', Courier, monospace; 
        padding: 5px 8px !important; 
        max-height: 400px; 
        overflow-y: auto; 
    }
    .leaflet-control-layers::-webkit-scrollbar { width: 6px; }
    .leaflet-control-layers::-webkit-scrollbar-track { background: #222; border-radius: 4px; }
    .leaflet-control-layers::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
    .leaflet-control-layers-overlays input[type="checkbox"] { transform: scale(1.0); margin-right: 6px; margin-left: 2px; cursor: pointer; }
    .leaflet-control-layers-overlays label { margin-bottom: 4px; cursor: pointer; display: flex; align-items: center; font-size: 11px; line-height: 1.1; }
    
    .substation-marker { background-color: #ffffff; border: 2px solid #000; border-radius: 2px; }
    .throttle-instruction { font-size: 13px; color: #aaa; margin-bottom: 10px; font-style: italic; }

    /* --- INFRASTRUCTURE MARKER STYLES --- */
    .dc-marker { background-color: #00ffff; border: 1px solid #ffffff; border-radius: 0; box-shadow: 0 0 8px #00ffff; }
    .airport-marker { background-color: #ff00ff; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ff00ff; }
    .railway-marker { background-color: #ffd700; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #ffd700; }
    .water-marker { background-color: #0088ff; border: 1px solid #ffffff; border-radius: 50%; box-shadow: 0 0 8px #0088ff; }
    .nuclear-marker { background-color: #39ff14; border: 2px solid #000; border-radius: 50%; box-shadow: 0 0 10px #39ff14; }
    .gas-marker { background-color: #ff4500; border: 1px solid #fff; border-radius: 50%; box-shadow: 0 0 8px #ff4500; }
    .hs2-marker { background-color: #8a2be2; border: 1px solid #fff; transform: rotate(45deg); box-shadow: 0 0 8px #8a2be2; }

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
        </div>
        
        <div class="filter-group">
            <label for="maxCapacityRange">Maximum Size (MW):</label>
            <div class="slider-container">
                <input type="range" id="maxCapacityRange" min="0" max="10000" value="10000" step="1">
                <input type="number" id="maxCapacityInput" value="10000" min="0" max="10000" class="number-input">
            </div>
        </div>

        <div class="filter-group" style="margin-top: 25px; border-top: 1px solid #444; padding-top: 15px;">
            <label for="substationDensityRange" style="color:#ffffff;">■ Substation Data Density (Midlands Outwards):</label>
            <div class="throttle-instruction">*Expands outwards from Central England to manage RAM.</div>
            <div class="slider-container">
                <input type="range" id="substationDensityRange" min="0" max="100" value="10" step="5">
                <input type="text" id="substationDensityInput" value="10%" readonly class="number-input" style="color:#fff; border-color:#fff;">
            </div>
        </div>

        <div class="filter-group" style="margin-top: 15px;">
            <label for="waterDensityRange" style="color:#ffffff;">💧 Water Utilities Density (Midlands Outwards):</label>
            <div class="throttle-instruction">*Expands outwards from Central England to manage RAM.</div>
            <div class="slider-container">
                <input type="range" id="waterDensityRange" min="0" max="100" value="10" step="5">
                <input type="text" id="waterDensityInput" value="10%" readonly class="number-input" style="color:#fff; border-color:#fff;">
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
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });
    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });

    const map = L.map('map', { center: [52.7, -1.5], zoom: 6, preferCanvas: true, layers: [darkMap] });

    // Base Latitude for expanding "Midlands Outwards"
    const MIDLANDS_LAT = 52.7; 

    // Grid Layers
    const grid400Layer = L.layerGroup(); const grid275Layer = L.layerGroup(); const grid220Layer = L.layerGroup();
    const grid132Layer = L.layerGroup(); const grid66Layer = L.layerGroup(); 
    
    const subsLayer = L.layerGroup();
    let allSubstationFeatures = []; let currentSubstationPercentage = 10; 
    
    // Infrastructure Layers
    const dataCentreLayer = L.layerGroup();
    const airportLayer = L.layerGroup();
    const railwayLayer = L.layerGroup();
    
    // Industrial Split Layers
    const industryLayer = L.layerGroup();
    const oilLayer = L.layerGroup();
    const waterLayer = L.layerGroup(); 
    let allWaterFeatures = []; let currentWaterPercentage = 10;

    const nuclearLayer = L.layerGroup();
    const gasLayer = L.layerGroup();
    const hs2Layer = L.layerGroup();
    
    const dummyHeaderLayer = L.layerGroup(); 
    
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    map.addLayer(markers); 

    const baseMaps = { "🌑 Dark Mode": darkMap, "🌍 Satellite View": satelliteMap };
    
    // --- MAP KEY OVERLAYS ---
    const overlayMaps = {
        "<span style='color: #0054ff; font-weight: bold;'>400kV Lines</span>": grid400Layer,
        "<span style='color: #ff0000; font-weight: bold;'>275kV Lines</span>": grid275Layer,
        "<span style='color: #ff9900; font-weight: bold;'>220kV Cables</span>": grid220Layer,
        "<span style='color: #00cc00; font-weight: bold;'>132kV Lines</span>": grid132Layer,
        "<span style='color: #b200ff; font-weight: bold;'>66kV Cables</span>": grid66Layer,
        "<span style='color: #ffffff; font-weight: bold;'>■ Substations</span>": subsLayer,
        "⚡ Energy Projects": markers,
        "<span style='color: #39ff14; font-weight: bold;'>☢️ Nuclear Plants</span>": nuclearLayer,
        "<span style='color: #ff4500; font-weight: bold;'>🔥 Gas Plants</span>": gasLayer,
        
        "<div style='margin-top:8px; margin-bottom:4px; border-bottom:1px solid #555; padding-bottom:4px; color:#aaa; font-weight:bold; font-size:10px; pointer-events:none;'>HEAVY ENERGY USERS<br>(Potential PPA/Offtakers)</div>": dummyHeaderLayer,
        
        "<span style='color: #ff6600; font-weight: bold;'>🏭 Heavy Industry</span>": industryLayer,
        "<span style='color: #cccccc; font-weight: bold;'>🛢️ Oil Sites</span>": oilLayer,
        "<span style='color: #0088ff; font-weight: bold;'>💧 Water Utilities</span>": waterLayer,
        "<span style='color: #00ffff; font-weight: bold;'>🖥️ Data Centres</span>": dataCentreLayer,
        "<span style='color: #ff00ff; font-weight: bold;'>✈️ Airports</span>": airportLayer,
        "<span style='color: #8a2be2; font-weight: bold;'>🚄 HS2 Stations</span>": hs2Layer,
        "<span style='color: #ffd700; font-weight: bold;'>🚆 Railways</span>": railwayLayer
    };
    
    L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

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
                // Note: The popup overrides the exact script label so it says "Oil Site" smoothly
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
        
        // Sort water features by Absolute Distance from Midlands
        allWaterFeatures.sort((a, b) => {
            const distA = Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT);
            const distB = Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT);
            return distA - distB;
        });
        renderWater(currentWaterPercentage);
        
    }).catch(e => console.error(e));

    function renderWater(percentage) {
        waterLayer.clearLayers();
        if (allWaterFeatures.length === 0) return;
        
        const numToLoad = Math.floor((percentage / 100) * allWaterFeatures.length);
        const featuresToRender = allWaterFeatures.slice(0, numToLoad);
        
        featuresToRender.forEach(f => {
            const lat = f.geometry.coordinates[1];
            const lon = f.geometry.coordinates[0];
            const marker = L.marker([lat, lon], { icon: L.divIcon({ className: 'water-marker', iconSize: [10, 10] }) });
            marker.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name}</b><br>Type: ${f.properties.type}<br>Operator: ${f.properties.operator}</div>`);
            waterLayer.addLayer(marker);
        });
    }

    $('#waterDensityRange').on('input', function() {
        const val = parseInt($(this).val());
        $('#waterDensityInput').val(val + "%");
        renderWater(val);
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

    // --- FETCH SUBSTATIONS & MIDLANDS OUTWARDS THROTTLE ---
    fetch('{{ site.baseurl }}/grid_substations.geojson')
        .then(r => r.json())
        .then(data => {
            // Sort by Absolute Distance from Midlands
            allSubstationFeatures = data.features.sort((a, b) => {
                const distA = Math.abs(a.geometry.coordinates[1] - MIDLANDS_LAT);
                const distB = Math.abs(b.geometry.coordinates[1] - MIDLANDS_LAT);
                return distA - distB;
            });
            renderSubstations(currentSubstationPercentage);
        })
        .catch(e => console.error(e));

    function renderSubstations(percentage) {
        subsLayer.clearLayers();
        if (allSubstationFeatures.length === 0) return;
        
        const numToLoad = Math.floor((percentage / 100) * allSubstationFeatures.length);
        const featuresToRender = allSubstationFeatures.slice(0, numToLoad);
        
        L.geoJSON({"type": "FeatureCollection", "features": featuresToRender}, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'substation-marker', iconSize: [8, 8] }) }); },
            onEachFeature: function (f, l) { 
                const v = f.properties.voltage || "Unknown";
                l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Substation"}</b><br>Voltage: ${v} V<br>Operator: ${f.properties.operator || "Unknown"}</div>`); 
            }
        }).addTo(subsLayer);
    }

    $('#substationDensityRange').on('input', function() {
        const val = parseInt($(this).val());
        $('#substationDensityInput').val(val + "%");
        renderSubstations(val);
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
        let markersCurrentlyVisible = map.hasLayer(markers) || allMarkers.length === 0;
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

        if (markersCurrentlyVisible) { map.addLayer(markers); }
        applyZoomScaling();

        if ($.fn.DataTable.isDataTable('#repd-table')) {
            dataTable.clear().rows.add(filteredTableData).draw();
        } else {
            dataTable = $('#repd-table').DataTable({
                data: filteredTableData, pageLength: 10, order: [[3, 'desc']], responsive: true, scrollX: true, language: { search: "Scan Systems:" }
            });
        }
    }

    function applyZoomScaling() {
        const currentZoom = map.getZoom();
        const scaleMultiplier = currentZoom > 9 ? Math.pow(1.4, currentZoom - 9) : 1;
        allMarkers.forEach(layer => { layer.setRadius(layer.options.baseRadius * scaleMultiplier); });
    }
    map.on('zoomend', applyZoomScaling);

    // --- HIDE THE CHECKBOX FOR THE DUMMY HEADER ---
    setTimeout(() => {
        const labels = document.querySelectorAll('.leaflet-control-layers-overlays label');
        labels.forEach(label => {
            if (label.innerHTML.includes('HEAVY ENERGY USERS')) {
                const checkbox = label.querySelector('input');
                if (checkbox) checkbox.style.display = 'none';
            }
        });
    }, 500);

</script>
