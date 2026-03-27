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
    
    .dashboard-title { color: #66ccff; font-size: 26px; margin-bottom: 20px; border-bottom: 2px solid #444; padding-bottom: 10px; }

    #map-wrapper { position: relative; width: 100%; margin-bottom: 25px; }
    
    #map { 
        height: 650px; 
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
    }
    
    #map.fullscreen-mode {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        height: 100vh !important; width: 100vw !important;
        z-index: 9999; border-radius: 0; border: none;
    }

    .fullscreen-btn {
        position: absolute; top: 15px; left: 60px; z-index: 1000; /* Moved to left to avoid Map Key */
        background: rgba(17, 17, 17, 0.9); color: #66ccff; border: 1px solid #444;
        padding: 8px 12px; border-radius: 6px; font-family: 'Courier New', Courier, monospace;
        font-weight: bold; cursor: pointer; font-size: 14px;
    }
    .fullscreen-btn:hover { background: #333; }

    /* Map Key Styling */
    .leaflet-control-layers {
        background: rgba(17, 17, 17, 0.85) !important;
        border: 1px solid #444 !important;
        color: white !important;
        border-radius: 8px !important;
        font-family: 'Courier New', Courier, monospace;
        padding: 10px;
        font-size: 12px; /* Smaller font */
    }
    
    .leaflet-control-layers-overlays input[type="checkbox"] {
        transform: scale(1.2); /* Smaller checkboxes */
        margin-right: 8px;
        cursor: pointer;
    }
    
    .leaflet-control-layers-overlays label {
        margin-bottom: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
    }

    .filter-panel { background: #111; padding: 25px; border-radius: 12px; border: 1px solid #444; margin-bottom: 25px; color: white; }
    .filter-panel h3 { margin-top: 0; color: #fff; font-size: 20px; margin-bottom: 20px; }
    .filter-panel h4 { margin-top: 25px; color: #fff; font-size: 16px; margin-bottom: 15px; border-top: 1px solid #444; padding-top: 20px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 14px; }
    
    .slider-container { display: flex; gap: 15px; align-items: center; margin-bottom: 15px; }
    input[type=range] { flex-grow: 1; cursor: pointer; accent-color: #66ccff; }
    
    .number-input {
        width: 80px; padding: 6px; background: #222; color: #66ccff;
        border: 1px solid #66ccff; border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 14px; text-align: center;
    }

    select.filter-select {
        width: 100%; padding: 8px; margin-bottom: 15px; background: #222; color: white; border: 1px solid #66ccff;
        border-radius: 5px; font-family: 'Courier New', Courier, monospace; font-size: 14px; cursor: pointer;
    }
    
    .toggle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; background: #1a1a1a; padding: 15px; border-radius: 8px; border: 1px solid #333;}
    .toggle-grid label { font-size: 14px; font-weight: normal; color: #aaa; cursor: pointer; display: flex; align-items: center; margin: 0; }
    .toggle-grid input { margin-right: 8px; transform: scale(1.3); accent-color: #e6e600; cursor: pointer; }

    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    table.dataTable.nowrap th, table.dataTable.nowrap td { white-space: nowrap; }

    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    
    .substation-marker { background-color: #ffffff; border: 2px solid #000; border-radius: 2px; }
    .substation-major { width: 8px !important; height: 8px !important; }
    .data-footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #333; color: #888; font-size: 12px; }
</style>

<div class="dashboard-container">
    <h1 class="dashboard-title">⚙️ GlobalGrid2050 Decision Engine</h1>

    <div id="map-wrapper">
        <button id="fullscreenToggle" class="fullscreen-btn">⛶ Fullscreen</button>
        <div id="map"></div>
    </div>

    <div class="filter-panel">
        <h3>📊 Control Panel</h3>
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

    <div id="repd-table-container">
        <table id="repd-table" class="display nowrap" style="width:100%">
            <thead>
                <tr>
                    <th>Site Name</th>
                    <th>Operator / Applicant</th>
                    <th>Technology</th>
                    <th>MW</th>
                    <th>Status</th>
                    <th>County</th>
                    <th>Site Address</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
    
    <div class="data-footer">
        Data sourced from the UK Government Renewable Energy Planning Database (REPD) and OpenStreetMap. Powered by GlobalGrid2050.
    </div>
</div>

<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js"></script>

<script>
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO' });

    const map = L.map('map', {
        center: [54.5, -2.5], zoom: 6, preferCanvas: true, layers: [darkMap]
    });

    $('#fullscreenToggle').on('click', function() {
        $('#map').toggleClass('fullscreen-mode');
        if ($('#map').hasClass('fullscreen-mode')) {
            $(this).text('✖ Exit Fullscreen').css({position: 'fixed', top: '20px', left: '20px'});
            $('body').css('overflow', 'hidden');
        } else {
            $(this).text('⛶ Fullscreen').css({position: 'absolute', top: '15px', left: '60px'});
            $('body').css('overflow', 'auto');
        }
        setTimeout(() => map.invalidateSize(), 200);
    });

    const gridLayers = { "400": L.layerGroup(), "275": L.layerGroup(), "220": L.layerGroup(), "132": L.layerGroup(), "66": L.layerGroup() };
    const subsLayer = L.layerGroup();
    const regional33Layers = {};
    const regionalSubLayers = {};
    
    const connectionLines = L.layerGroup().addTo(map);
    map.on('popupclose', function() { connectionLines.clearLayers(); });
    
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    map.addLayer(markers); 

    // Re-introduce Map Key Layer Control
    const overlayMaps = {
        "⚡ Energy Projects": markers,
        "<span style='color: #ffffff; font-weight: bold;'>■ Major Substations (66kV+)</span>": subsLayer,
        "<span style='color: #0054ff; font-weight: bold;'>400kV Lines</span>": gridLayers["400"],
        "<span style='color: #ff0000; font-weight: bold;'>275kV Lines</span>": gridLayers["275"],
        "<span style='color: #ff9900; font-weight: bold;'>220kV Cables</span>": gridLayers["220"],
        "<span style='color: #00cc00; font-weight: bold;'>132kV Lines</span>": gridLayers["132"],
        "<span style='color: #b200ff; font-weight: bold;'>66kV Cables</span>": gridLayers["66"]
    };
    L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);

    fetch('{{ site.baseurl }}/grid_400kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(gridLayers["400"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_275kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(gridLayers["275"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_220kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff9900', weight: 2, opacity: 0.8 } }).addTo(gridLayers["220"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_132kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(gridLayers["132"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_66kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#b200ff', weight: 1.5, opacity: 0.7 } }).addTo(gridLayers["66"])).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_substations.geojson').then(r => r.json()).then(data => {
        L.geoJSON(data, {
            pointToLayer: function (f, ll) { return L.marker(ll, { icon: L.divIcon({ className: 'substation-marker substation-major', iconSize: [8, 8] }) }); },
            onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Substation"}</b><br>Voltage: ${f.properties.voltage || "Unknown"} V</div>`); }
        }).addTo(subsLayer);
    }).catch(e => console.error(e));

    $('.region-cb').on('change', function() {
        const rName = $(this).val(); const isChecked = $(this).is(':checked');
        if (isChecked) {
            if (!regional33Layers[rName]) {
                fetch(`{{ site.baseurl }}/grid_33kv_${rName}.geojson`).then(r => r.json()).then(data => { regional33Layers[rName] = L.geoJSON(data, { style: { color: '#e6e600', weight: 1.2, opacity: 0.7 } }).addTo(map); }).catch(e => console.error("Awaiting data update"));
            } else { map.addLayer(regional33Layers[rName]); }
            if (!regionalSubLayers[rName]) {
                fetch(`{{ site.baseurl }}/subs_all_${rName}.geojson`).then(r => r.json()).then(data => {
                    regionalSubLayers[rName] = L.geoJSON(data, {
                        pointToLayer: function (f, ll) {
                            const isM = (f.properties.voltage || "0").includes("132000");
                            return L.marker(ll, { icon: L.divIcon({ className: isM ? 'substation-marker substation-major' : 'substation-marker', iconSize: isM ? [8,8] : [6, 6] }) });
                        },
                        onEachFeature: function (f, l) { l.bindPopup(`<div style="font-family: Courier, monospace;"><b>${f.properties.name || "Substation"}</b><br>Voltage: ${f.properties.voltage || "Unknown"} V</div>`); }
                    }).addTo(map);
                }).catch(e => console.error("Awaiting data update"));
            } else { map.addLayer(regionalSubLayers[rName]); }
        } else {
            if (regional33Layers[rName]) map.removeLayer(regional33Layers[rName]);
            if (regionalSubLayers[rName]) map.removeLayer(regionalSubLayers[rName]);
        }
    });

    function getVisibleSubstations() {
        let features = [];
        const extract = (geoJsonLayer) => {
            geoJsonLayer.eachLayer(layer => {
                if (layer.getLatLng && layer.feature) {
                    features.push(turf.point([layer.getLatLng().lng, layer.getLatLng().lat], layer.feature.properties));
                }
            });
        };
        if (map.hasLayer(subsLayer)) extract(subsLayer);
        for (const region in regionalSubLayers) { if (map.hasLayer(regionalSubLayers[region])) extract(regionalSubLayers[region]); }
        return features;
    }

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
        $('#techSelect, #statusSelect').on('change', function() { currentTech = $('#techSelect').val(); currentStatus = $('#statusSelect').val(); updateDisplay(); });
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
            const operator = row['Operator (or Applicant)'] || row['Developer'] || 'Unknown';
            
            let mTech = currentTech==='all' || (currentTech==='solar' && tech.includes('solar')) || (currentTech==='wind_onshore' && tech.includes('wind') && tech.includes('onshore')) || (currentTech==='wind_offshore' && tech.includes('wind') && tech.includes('offshore')) || (currentTech==='battery' && (tech.includes('battery')||tech.includes('storage')));
            let mStat = currentStatus==='all' || (currentStatus==='operational' && statLow==='operational') || (currentStatus==='construction' && statLow.includes('construction')) || (currentStatus==='consented' && (statLow.includes('granted')||statLow.includes('consented')||statLow==='awaiting construction')) || (currentStatus==='planning' && (statLow.includes('submitted')||statLow.includes('planning')||statLow.includes('scoping')));
            let inRng = cap >= currentMin && cap <= currentMax;

            if (mTech && mStat && inRng) {
                const x = parseFloat(row['X-coordinate']); const y = parseFloat(row['Y-coordinate']);
                if (x && y) {
                    try {
                        const c = proj4("EPSG:27700", "WGS84", [x, y]);
                        const lat = c[1]; const lon = c[0];
                        const m = L.circleMarker([lat, lon], {
                            radius: Math.max(8, (Math.sqrt(cap)||4)*1.5),
                            fillColor: stat === 'Operational' ? '#00f2ff' : '#ff9d00', color: "#fff", weight: 1.5, fillOpacity: 0.8
                        });

                        // Dynamic Spatial Query & Voltage Routing
                        m.on('click', function() {
                            connectionLines.clearLayers();
                            const allSubFeatures = getVisibleSubstations();
                            
                            let html = `<div style="font-family: Courier, monospace; min-width: 220px;">
                                <b>${row['Site Name']}</b><br><span style="font-size:12px; color:#555;">${operator}</span><hr style="margin:4px 0;">
                                ${row['Technology Type']}<br><b>${cap} MW</b><br>${stat}<hr style="margin:4px 0;">`;
                            
                            if (allSubFeatures.length > 0) {
                                // Apply Electrical Reality (Voltage Matching Rules)
                                const viableSubs = allSubFeatures.filter(sub => {
                                    const v = sub.properties.voltage || "";
                                    if (!v || v === "Unknown") return true; 
                                    
                                    if (cap < 50) { return v.includes("33000") || v.includes("66000") || v.includes("132000"); } 
                                    else if (cap >= 50 && cap < 150) { return v.includes("132000") || v.includes("275000"); } 
                                    else { return v.includes("275000") || v.includes("400000"); }
                                });

                                if (viableSubs.length > 0) {
                                    const projectPt = turf.point([lon, lat]);
                                    const subCollection = turf.featureCollection(viableSubs);
                                    const nearest = turf.nearestPoint(projectPt, subCollection);
                                    const distKm = turf.distance(projectPt, nearest).toFixed(2);
                                    
                                    html += `<strong style="color:#00cc00;">Constraint Analysis:</strong><br>
                                             Required Grid: <b>${cap < 50 ? '33kV - 132kV' : (cap < 150 ? '132kV - 275kV' : '275kV - 400kV')}</b><br>
                                             Nearest Viable Node: <b>${nearest.properties.name || "Substation"}</b><br>
                                             Distance: <b>${distKm} km</b><br>
                                             <i style="font-size:10px; color:#888;">*Straight-line distance only.</i></div>`;
                                             
                                    L.polyline([ [lat, lon], [nearest.geometry.coordinates[1], nearest.geometry.coordinates[0]] ], 
                                        {color: '#00f2ff', weight: 2, dashArray: '5, 5'}).addTo(connectionLines);
                                } else {
                                    html += `<strong style="color:#ff3333;">Constraint Analysis:</strong><br>
                                             No viable substations found for a <b>${cap} MW</b> connection in active layers.<br>
                                             <i>Try turning on Major Substations.</i></div>`;
                                }
                            } else {
                                html += `<strong style="color:#ff9900;">Constraint Analysis:</strong><br>
                                         <i>Enable a Substation layer below to calculate grid distance.</i></div>`;
                            }
                            L.popup().setLatLng([lat, lon]).setContent(html).openOn(map);
                        });

                        markers.addLayer(m); allMarkers.push(m);
                        filteredTableData.push([row['Site Name'], operator, row['Technology Type'], cap, stat, row['County'], row['Address'] || 'Not Provided']);
                    } catch (e) {}
                }
            }
        });

        if (markersVisible) map.addLayer(markers);
        if ($.fn.DataTable.isDataTable('#repd-table')) { dataTable.clear().rows.add(filteredTableData).draw(); } 
        else { dataTable = $('#repd-table').DataTable({ data: filteredTableData, pageLength: 10, order: [[3, 'desc']], scrollX: true }); }
    }
</script>
