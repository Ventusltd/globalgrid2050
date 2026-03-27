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
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    
    #map { 
        height: 850px; 
        min-height: 75vh; 
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
        margin-bottom: 20px; 
    }

    .filter-panel {
        background: #111;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 15px;
        color: white;
    }
    .filter-panel h3 { margin-top: 0; color: #66ccff; font-size: 22px; margin-bottom: 15px; }
    .filter-panel h4 { margin-top: 25px; color: #e6e600; font-size: 18px; margin-bottom: 15px; border-top: 1px solid #444; padding-top: 20px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 16px; }
    
    .slider-container { display: flex; gap: 15px; align-items: center; margin-bottom: 20px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    
    .number-input {
        width: 90px; padding: 8px; background: #222; color: #66ccff; border: 1px solid #66ccff;
        border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 16px; text-align: center;
    }

    select.filter-select {
        width: 100%; padding: 10px; margin-bottom: 20px; background: #222; color: white; border: 1px solid #66ccff;
        border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 16px; cursor: pointer;
    }
    
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    table.dataTable.nowrap th, table.dataTable.nowrap td { white-space: nowrap; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    
    .leaflet-control-layers {
        background: rgba(17, 17, 17, 0.9) !important; 
        border: 1px solid #444 !important;
        color: white !important; 
        border-radius: 8px !important; 
        font-family: 'Courier New', Courier, monospace; 
        padding: 10px 15px !important;
        max-height: 250px; 
        overflow-y: auto; 
    }
    
    .leaflet-control-layers::-webkit-scrollbar { width: 6px; }
    .leaflet-control-layers::-webkit-scrollbar-track { background: #222; border-radius: 4px; }
    .leaflet-control-layers::-webkit-scrollbar-thumb { background: #66ccff; border-radius: 4px; }
    
    .leaflet-control-layers-overlays input[type="checkbox"] { transform: scale(1.5); margin-right: 12px; margin-left: 5px; cursor: pointer; }
    .leaflet-control-layers-overlays label { margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; font-size: 14px; }
    
    .substation-marker { background-color: #ffffff; border: 2px solid #000; border-radius: 2px; }
    
    /* NEW: Styling for the Substation Throttle Instruction */
    .throttle-instruction { font-size: 13px; color: #aaa; margin-bottom: 15px; font-style: italic; }
</style>

<div class="dashboard-container">
    
    <div class="filter-panel">
        <h3>🔍 Map Filters</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
            <div>
                <label for="techSelect">Technology Type:</label>
                <select id="techSelect" class="filter-select">
                    <option value="all">All Technologies</option>
                    <option value="solar">Solar Photovoltaics</option>
                    <option value="wind_onshore">Wind (Onshore)</option>
                    <option value="wind_offshore">Wind (Offshore)</option>
                    <option value="battery">Battery / Storage</option>
                </select>

                <label for="minCapacityRange">Minimum Size (MW):</label>
                <div class="slider-container">
                    <input type="range" id="minCapacityRange" min="0" max="10000" value="0" step="1">
                    <input type="number" id="minCapacityInput" value="0" min="0" max="10000" class="number-input">
                </div>
                
                <label for="maxCapacityRange">Maximum Size (MW):</label>
                <div class="slider-container">
                    <input type="range" id="maxCapacityRange" min="0" max="10000" value="10000" step="1">
                    <input type="number" id="maxCapacityInput" value="10000" min="0" max="10000" class="number-input">
                </div>
            </div>
            
            <div>
                <label for="statusSelect">Project Status:</label>
                <select id="statusSelect" class="filter-select">
                    <option value="all">All Statuses</option>
                    <option value="operational">Operational</option>
                    <option value="construction">Under Construction</option>
                    <option value="consented">Consented / Awaiting Construction</option>
                    <option value="planning">In Planning / Submitted</option>
                </select>

                <label for="substationDensityRange" style="color:#ffffff;">■ Substation Data Throttle (South to North):</label>
                <div class="throttle-instruction">*Adjust density based on your device's processing power.</div>
                <div class="slider-container">
                    <input type="range" id="substationDensityRange" min="0" max="100" value="10" step="5">
                    <input type="text" id="substationDensityInput" value="10%" readonly class="number-input" style="color:#fff; border-color:#fff;">
                </div>
            </div>
        </div>
    </div>

    <div id="map"></div>

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

    const map = L.map('map', { center: [54.5, -2.5], zoom: 6, preferCanvas: true, layers: [darkMap] });

    const grid400Layer = L.layerGroup(); const grid275Layer = L.layerGroup(); const grid220Layer = L.layerGroup();
    const grid132Layer = L.layerGroup(); const grid66Layer = L.layerGroup(); 
    
    // Substation layer setup
    const subsLayer = L.layerGroup();
    let allSubstationFeatures = []; // Will hold the raw, sorted GeoJSON features
    let currentSubstationPercentage = 10; // Default load is 10%
    
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    map.addLayer(markers); 

    const baseMaps = { "🌑 Dark Mode": darkMap, "🌍 Satellite View": satelliteMap };
    
    const overlayMaps = {
        "⚡ Energy Projects": markers,
        "<span style='color: #ffffff; font-weight: bold;'>■ Substations (Throttled)</span>": subsLayer,
        "<span style='color: #0054ff; font-weight: bold;'>400kV Lines</span>": grid400Layer,
        "<span style='color: #ff0000; font-weight: bold;'>275kV Lines</span>": grid275Layer,
        "<span style='color: #ff9900; font-weight: bold;'>220kV Cables</span>": grid220Layer,
        "<span style='color: #00cc00; font-weight: bold;'>132kV Lines</span>": grid132Layer,
        "<span style='color: #b200ff; font-weight: bold;'>66kV Cables</span>": grid66Layer
    };
    L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

    fetch('{{ site.baseurl }}/grid_400kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(grid400Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_275kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(grid275Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_220kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff9900', weight: 2, opacity: 0.8 } }).addTo(grid220Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_132kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(grid132Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_66kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#b200ff', weight: 1.5, opacity: 0.7 } }).addTo(grid66Layer)).catch(e => console.error(e));
    
    // --- NEW: Substation Throttle Logic ---
    fetch('{{ site.baseurl }}/grid_substations.geojson')
        .then(r => r.json())
        .then(data => {
            // Sort features by Latitude (South to North)
            allSubstationFeatures = data.features.sort((a, b) => {
                const latA = a.geometry.coordinates[1];
                const latB = b.geometry.coordinates[1];
                return latA - latB;
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

    // Substation Slider Event Listener
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
                        const isOp = status === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00'; 
                        const baseRadius = Math.max(10, (Math.sqrt(capacity) || 4) * 2);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
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
</script>
