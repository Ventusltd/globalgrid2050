---
layout: page
title: Decision Engine (REPD + Grid)
permalink: /repd_atlas_grid_model/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />

<style>
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    
    #map-wrapper { position: relative; width: 100%; margin-bottom: 20px; }
    
    #map { 
        height: 650px; /* Reduced height to make it scrollable */
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
    }
    
    /* Fullscreen Mode Class */
    #map.fullscreen-mode {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        height: 100vh !important;
        width: 100vw !important;
        z-index: 9999;
        border-radius: 0;
        border: none;
    }

    .fullscreen-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 1000;
        background: rgba(17, 17, 17, 0.9);
        color: #66ccff;
        border: 1px solid #444;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        cursor: pointer;
        font-size: 14px;
    }
    .fullscreen-btn:hover { background: #333; }

    .filter-panel {
        background: #111;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 15px;
        color: white;
    }
    .filter-panel h3 { margin-top: 0; color: #66ccff; font-size: 22px; margin-bottom: 15px; }
    .filter-panel h4 { margin-top: 15px; color: #fff; font-size: 16px; margin-bottom: 10px; border-top: 1px solid #444; padding-top: 15px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 14px; }
    
    .slider-container { display: flex; gap: 15px; align-items: center; margin-bottom: 15px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    
    .number-input {
        width: 80px; padding: 6px; background: #222; color: #66ccff;
        border: 1px solid #66ccff; border-radius: 5px;
        font-family: 'Courier New', Courier, monospace; font-size: 14px; text-align: center;
    }

    select.filter-select {
        width: 100%; padding: 8px; margin-bottom: 15px; background: #222;
        color: white; border: 1px solid #66ccff; border-radius: 5px;
        font-family: 'Courier New', Courier, monospace; font-size: 14px; cursor: pointer;
    }
    
    /* 60% Smaller, Compact Grid Key */
    .compact-key {
        display: flex; flex-wrap: wrap; gap: 15px; background: #1a1a1a; padding: 10px 15px; border-radius: 8px; border: 1px solid #333; margin-bottom: 15px;
    }
    .compact-key label {
        font-size: 13px; font-weight: normal; color: #ccc; cursor: pointer; display: flex; align-items: center; margin: 0;
    }
    .compact-key input { margin-right: 6px; transform: scale(1.2); cursor: pointer; }
    
    /* Custom Checkbox Colors */
    .cb-400 { accent-color: #0054ff; }
    .cb-275 { accent-color: #ff0000; }
    .cb-220 { accent-color: #ff9900; }
    .cb-132 { accent-color: #00cc00; }
    .cb-66 { accent-color: #b200ff; }

    /* 33kV & Substation Regional Grid */
    .toggle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
    .toggle-grid label { font-size: 13px; font-weight: normal; color: #aaa; cursor: pointer; display: flex; align-items: center; margin: 0; }
    .toggle-grid input { margin-right: 8px; transform: scale(1.3); accent-color: #e6e600; cursor: pointer; }

    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    
    /* Hide default leaflet layer control since we built a custom one */
    .leaflet-control-layers { display: none !important; }
    
    .substation-marker { background-color: #ffffff; border: 2px solid #000; border-radius: 2px; }
    .substation-major { width: 10px !important; height: 10px !important; }
</style>

<div class="dashboard-container">
    
    <div class="filter-panel">
        <h3>⚙️ GlobalGrid2050 Decision Engine</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
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

                <label for="maxCapacityRange">Maximum Size (MW):</label>
                <div class="slider-container">
                    <input type="range" id="maxCapacityRange" min="0" max="10000" value="10000" step="1">
                    <input type="number" id="maxCapacityInput" value="10000" min="0" max="10000" class="number-input">
                </div>
            </div>
        </div>

        <h4>National Grid Infrastructure</h4>
        <div class="compact-key">
            <label><input type="checkbox" id="toggle-repd" checked> ⚡ Energy Projects</label>
            <label><input type="checkbox" class="grid-toggle cb-400" value="400"> <span style="color:#0054ff;font-weight:bold;">400kV Lines</span></label>
            <label><input type="checkbox" class="grid-toggle cb-275" value="275"> <span style="color:#ff0000;font-weight:bold;">275kV Lines</span></label>
            <label><input type="checkbox" class="grid-toggle cb-220" value="220"> <span style="color:#ff9900;font-weight:bold;">220kV Cables</span></label>
            <label><input type="checkbox" class="grid-toggle cb-132" value="132"> <span style="color:#00cc00;font-weight:bold;">132kV Lines</span></label>
            <label><input type="checkbox" class="grid-toggle cb-66" value="66"> <span style="color:#b200ff;font-weight:bold;">66kV Cables</span></label>
        </div>

        <h4>Regional Analysis (Load 33kV Lines & Local Substations)</h4>
        <div class="toggle-grid">
            <label><input type="checkbox" class="region-cb" value="Scotland_North"> Scotland North</label>
            <label><input type="checkbox" class="region-cb" value="Scotland_South"> Scotland South</label>
            <label><input type="checkbox" class="region-cb" value="North_East_England"> North East England</label>
            <label><input type="checkbox" class="region-cb" value="North_West_England"> North West England</label>
            <label><input type="checkbox" class="region-cb" value="Yorkshire"> Yorkshire</label>
            <label><input type="checkbox" class="region-cb" value="Wales_North"> Wales North</label>
            <label><input type="checkbox" class="region-cb" value="Wales_South"> Wales South</label>
            <label><input type="checkbox" class="region-cb" value="Midlands"> Midlands</label>
            <label><input type="checkbox" class="region-cb" value="East_of_England"> East of England</label>
            <label><input type="checkbox" class="region-cb" value="South_West_England"> South West</label>
            <label><input type="checkbox" class="region-cb" value="South_East_England"> South East</label>
            <label><input type="checkbox" class="region-cb" value="London_Area"> London Area</label>
        </div>
    </div>

    <div id="map-wrapper">
        <button id="fullscreenToggle" class="fullscreen-btn">⛶ Fullscreen Map</button>
        <div id="map"></div>
    </div>

    <div id="repd-table-container">
        <table id="repd-table" class="display" style="width:100%">
            <thead>
                <tr>
                    <th>Site Name</th>
                    <th>Technology</th>
                    <th>MW</th>
                    <th>Status</th>
                    <th>County</th>
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

    // PERFORMANCE UPGRADE: preferCanvas offloads DOM rendering to the GPU
    const map = L.map('map', {
        center: [54.5, -2.5],
        zoom: 6,
        preferCanvas: true, 
        layers: [darkMap]
    });

    // Fullscreen Logic
    $('#fullscreenToggle').on('click', function() {
        $('#map').toggleClass('fullscreen-mode');
        if ($('#map').hasClass('fullscreen-mode')) {
            $(this).text('✖ Exit Fullscreen').css({position: 'fixed', top: '20px', right: '20px'});
        } else {
            $(this).text('⛶ Fullscreen Map').css({position: 'absolute', top: '15px', right: '15px'});
        }
        setTimeout(() => map.invalidateSize(), 200);
    });

    const gridLayers = {
        "400": L.layerGroup(),
        "275": L.layerGroup(),
        "220": L.layerGroup(),
        "132": L.layerGroup(),
        "66": L.layerGroup()
    };
    
    // Hold our lazily-loaded regional layers
    const regional33Layers = {};
    const regionalSubLayers = {};
    
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    map.addLayer(markers); 

    // Fetch major grid data (initially hidden until checked)
    fetch('{{ site.baseurl }}/grid_400kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(gridLayers["400"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_275kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(gridLayers["275"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_220kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff9900', weight: 2, opacity: 0.8 } }).addTo(gridLayers["220"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_132kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(gridLayers["132"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_66kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#b200ff', weight: 1.5, opacity: 0.7 } }).addTo(gridLayers["66"])).catch(e => console.error(e));

    // Custom Control Panel Logic
    $('#toggle-repd').on('change', function() {
        if ($(this).is(':checked')) { map.addLayer(markers); } else { map.removeLayer(markers); }
    });

    $('.grid-toggle').on('change', function() {
        const val = $(this).val();
        if ($(this).is(':checked')) { map.addLayer(gridLayers[val]); } else { map.removeLayer(gridLayers[val]); }
    });

    // --- REGIONAL LAZY LOADING LOGIC (Lines AND Substations) ---
    $('.region-cb').on('change', function() {
        const regionName = $(this).val();
        const isChecked = $(this).is(':checked');
        
        if (isChecked) {
            // Load Lines
            if (!regional33Layers[regionName]) {
                fetch(`{{ site.baseurl }}/grid_33kv_${regionName}.geojson`)
                    .then(r => r.json())
                    .then(data => {
                        regional33Layers[regionName] = L.geoJSON(data, { style: { color: '#e6e600', weight: 1.2, opacity: 0.7 } }).addTo(map);
                    }).catch(e => console.error(`Missing 33kV lines for ${regionName}`));
            } else { map.addLayer(regional33Layers[regionName]); }

            // Load Local Substations (66kV to 400kV + 33kV Primary)
            if (!regionalSubLayers[regionName]) {
                fetch(`{{ site.baseurl }}/subs_all_${regionName}.geojson`)
                    .then(r => r.json())
                    .then(data => {
                        regionalSubLayers[regionName] = L.geoJSON(data, {
                            pointToLayer: function (feature, latlng) {
                                const v = feature.properties.voltage || "0";
                                const isMajor = v.includes("400000") || v.includes("275000") || v.includes("132000");
                                return L.marker(latlng, {
                                    icon: L.divIcon({ className: isMajor ? 'substation-marker substation-major' : 'substation-marker', iconSize: isMajor ? [10,10] : [6, 6] })
                                });
                            },
                            onEachFeature: function (feature, layer) {
                                layer.bindPopup(`<div style="font-family: Courier, monospace;"><b>${feature.properties.name || "Substation"}</b><br>Voltage: ${feature.properties.voltage || "Unknown"} V</div>`);
                            }
                        }).addTo(map);
                    }).catch(e => console.error(`Missing substations for ${regionName}`));
            } else { map.addLayer(regionalSubLayers[regionName]); }
            
        } else {
            if (regional33Layers[regionName]) map.removeLayer(regional33Layers[regionName]);
            if (regionalSubLayers[regionName]) map.removeLayer(regionalSubLayers[regionName]);
        }
    });

    // REPD Data Logic
    const csvUrl = '{{ site.baseurl }}/repd.csv';
    let allData = [];
    let allMarkers = [];
    let dataTable;

    let currentMin = 0; let currentMax = 10000;
    let currentTech = 'all'; let currentStatus = 'all';

    Papa.parse(csvUrl, {
        download: true, header: true, skipEmptyLines: true,
        complete: function(results) { allData = results.data; initDashboard(); }
    });

    function initDashboard() {
        updateDisplay();
        $('#techSelect, #statusSelect').on('change', function() {
            currentTech = $('#techSelect').val(); currentStatus = $('#statusSelect').val(); updateDisplay();
        });
        
        // Sync Inputs
        $('#minCapacityRange').on('input', function() { currentMin = parseFloat($(this).val()); $('#minCapacityInput').val(currentMin); updateDisplay(); });
        $('#maxCapacityRange').on('input', function() { currentMax = parseFloat($(this).val()); $('#maxCapacityInput').val(currentMax); updateDisplay(); });
        $('#minCapacityInput').on('input', function() { currentMin = parseFloat($(this).val())||0; $('#minCapacityRange').val(currentMin); updateDisplay(); });
        $('#maxCapacityInput').on('input', function() { currentMax = parseFloat($(this).val())||0; $('#maxCapacityRange').val(currentMax); updateDisplay(); });
    }

    function updateDisplay() {
        let markersVisible = map.hasLayer(markers) || allMarkers.length === 0;
        markers.clearLayers(); allMarkers = [];
        const filteredTableData = [];

        allData.forEach(row => {
            const cap = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const stat = row['Development Status'] || 'Unknown';
            const statLow = stat.toLowerCase();
            const tech = (row['Technology Type'] || '').toLowerCase();
            
            let mTech = currentTech==='all' || (currentTech==='solar' && tech.includes('solar')) || (currentTech==='wind_onshore' && tech.includes('wind') && tech.includes('onshore')) || (currentTech==='wind_offshore' && tech.includes('wind') && tech.includes('offshore')) || (currentTech==='battery' && (tech.includes('battery')||tech.includes('storage')));
            let mStat = currentStatus==='all' || (currentStatus==='operational' && statLow==='operational') || (currentStatus==='construction' && statLow.includes('construction')) || (currentStatus==='consented' && (statLow.includes('granted')||statLow.includes('consented')||statLow==='awaiting construction')) || (currentStatus==='planning' && (statLow.includes('submitted')||statLow.includes('planning')||statLow.includes('scoping')));
            let inRng = cap >= currentMin && cap <= currentMax;

            if (mTech && mStat && inRng) {
                const x = parseFloat(row['X-coordinate']); const y = parseFloat(row['Y-coordinate']);
                if (x && y) {
                    try {
                        const c = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = stat === 'Operational';
                        const m = L.circleMarker([c[1], c[0]], {
                            radius: Math.max(8, (Math.sqrt(cap)||4)*1.5),
                            fillColor: isOp ? '#00f2ff' : '#ff9d00', color: "#fff", weight: 1.5, fillOpacity: 0.8
                        }).bindPopup(`<b>${row['Site Name']}</b><br>${row['Technology Type']}<br><b>${cap} MW</b><br>${stat}`);
                        markers.addLayer(m); allMarkers.push(m);
                        filteredTableData.push([row['Site Name'], row['Technology Type'], cap, stat, row['County']]);
                    } catch (e) {}
                }
            }
        });

        if (markersVisible) map.addLayer(markers);
        
        if ($.fn.DataTable.isDataTable('#repd-table')) {
            dataTable.clear().rows.add(filteredTableData).draw();
        } else {
            dataTable = $('#repd-table').DataTable({ data: filteredTableData, pageLength: 10, order: [[2, 'desc']] });
        }
    }
</script>
