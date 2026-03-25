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
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 16px; }
    input[type=range] { width: 100%; cursor: pointer; accent-color: #66ccff; margin-bottom: 15px; }
    
    select#techSelect {
        width: 100%;
        padding: 10px;
        margin-bottom: 20px;
        background: #222;
        color: white;
        border: 1px solid #66ccff;
        border-radius: 5px;
        font-family: 'Courier New', Courier, monospace;
        font-size: 16px;
        cursor: pointer;
    }

    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
    
    .leaflet-control-layers {
        background: rgba(17, 17, 17, 0.9) !important;
        border: 1px solid #444 !important;
        color: white !important;
        border-radius: 8px !important;
        font-family: 'Courier New', Courier, monospace;
    }
</style>

<div class="dashboard-container">
    
    <div class="filter-panel">
        <h3>🔍 Map Filters</h3>
        
        <label for="techSelect">Technology Type:</label>
        <select id="techSelect">
            <option value="all">All Technologies</option>
            <option value="solar">Solar Photovoltaics</option>
            <option value="wind_onshore">Wind (Onshore)</option>
            <option value="wind_offshore">Wind (Offshore)</option>
            <option value="battery">Battery / Storage</option>
        </select>

        <label for="minCapacityRange">Minimum Size: <span id="minCapacityVal">0</span> MW</label>
        <input type="range" id="minCapacityRange" min="0" max="4000" value="0" step="1">
        
        <label for="maxCapacityRange">Maximum Size: <span id="maxCapacityVal">4000</span> MW</label>
        <input type="range" id="maxCapacityRange" min="0" max="4000" value="4000" step="1">
    </div>

    <div id="map"></div>

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

    const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    });

    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const map = L.map('map', {
        center: [54.5, -2.5],
        zoom: 6,
        layers: [darkMap]
    });

    const grid400Layer = L.layerGroup().addTo(map);
    const grid275Layer = L.layerGroup().addTo(map);
    const grid132Layer = L.layerGroup().addTo(map);
    
    // Create the markers layer early so we can add it to the menu!
    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    map.addLayer(markers); // Turn it on by default

    const baseMaps = {
        "🌑 Dark Mode": darkMap,
        "🌍 Satellite View": satelliteMap
    };

    const overlayMaps = {
        "⚡ Energy Projects": markers, // Added to the toggle box!
        "<span style='color: #0054ff; font-weight: bold;'>400kV Lines</span>": grid400Layer,
        "<span style='color: #ff0000; font-weight: bold;'>275kV Lines</span>": grid275Layer,
        "<span style='color: #00cc00; font-weight: bold;'>132kV Lines</span>": grid132Layer
    };
    
    L.control.layers(baseMaps, overlayMaps, { collapsed: false }).addTo(map);

    // Fetch grid data
    fetch('{{ site.baseurl }}/grid_400kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(grid400Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_275kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(grid275Layer)).catch(e => console.error(e));
    fetch('{{ site.baseurl }}/grid_132kv.geojson').then(r => r.json()).then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(grid132Layer)).catch(e => console.error(e));

    const csvUrl = '{{ site.baseurl }}/repd.csv';

    let allData = [];
    let allMarkers = [];
    let dataTable;

    let currentMin = 0;
    let currentMax = 4000;
    let currentTech = 'all';

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            allData = results.data;
            initDashboard();
        }
    });

    function initDashboard() {
        updateDisplay(currentMin, currentMax, currentTech);

        $('#techSelect').on('change', function() {
            currentTech = $(this).val();
            updateDisplay(currentMin, currentMax, currentTech);
        });

        $('#minCapacityRange').on('input', function() {
            currentMin = parseFloat($(this).val());
            if (currentMin > currentMax) {
                currentMax = currentMin;
                $('#maxCapacityRange').val(currentMax);
                $('#maxCapacityVal').text(currentMax);
            }
            $('#minCapacityVal').text(currentMin);
            updateDisplay(currentMin, currentMax, currentTech);
        });

        $('#maxCapacityRange').on('input', function() {
            currentMax = parseFloat($(this).val());
            if (currentMax < currentMin) {
                currentMin = currentMax;
                $('#minCapacityRange').val(currentMin);
                $('#minCapacityVal').text(currentMin);
            }
            $('#maxCapacityVal').text(currentMax);
            updateDisplay(currentMin, currentMax, currentTech);
        });
    }

    function updateDisplay(minMW, maxMW, techFilter) {
        // Smart Logic: Check if the user has manually turned the projects off in the menu
        let markersCurrentlyVisible = map.hasLayer(markers) || allMarkers.length === 0;

        markers.clearLayers();
        allMarkers = [];
        const filteredTableData = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const status = row['Development Status'] || 'Unknown';
            const techType = (row['Technology Type'] || '').toLowerCase();
            
            let matchTech = false;
            if (techFilter === 'all') {
                matchTech = true;
            } else if (techFilter === 'solar' && techType.includes('solar')) {
                matchTech = true;
            } else if (techFilter === 'wind_onshore' && techType.includes('wind') && techType.includes('onshore')) {
                matchTech = true;
            } else if (techFilter === 'wind_offshore' && techType.includes('wind') && techType.includes('offshore')) {
                matchTech = true;
            } else if (techFilter === 'battery' && (techType.includes('battery') || techType.includes('storage'))) {
                matchTech = true;
            }

            const inRange = capacity >= minMW && capacity <= maxMW;

            if (matchTech && inRange) {
                const x = parseFloat(row['X-coordinate']);
                const y = parseFloat(row['Y-coordinate']);
                
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        
                        const isOp = status === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00'; 
                        
                        const baseRadius = Math.max(10, (Math.sqrt(capacity) || 4) * 2);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius,
                            baseRadius: baseRadius,
                            fillColor: color,
                            color: "#fff",
                            weight: 2,
                            fillOpacity: 0.8
                        }).bindPopup(`
                            <div style="min-width:180px; font-family: Courier, monospace;">
                                <b style="font-size:14px; color:#000;">${row['Site Name']}</b><br>
                                <hr style="margin:5px 0; border:0; border-top:1px solid #ccc;">
                                <span style="font-size:13px;">${row['Technology Type']}</span><br>
                                <span style="font-size:16px;"><b>${capacity} MW</b></span><br>
                                <span style="color:#555;">Status: <b>${status}</b></span><br>
                                <small>${row['County']}</small>
                            </div>
                        `);

                        markers.addLayer(marker);
                        allMarkers.push(marker);

                        filteredTableData.push([
                            row['Site Name'],
                            row['Technology Type'],
                            capacity,
                            status,
                            row['County']
                        ]);
                    } catch (e) {}
                }
            }
        });

        // Only redraw them on the map if the user hasn't hidden them via the top right menu
        if (markersCurrentlyVisible) {
            map.addLayer(markers);
        }
        
        applyZoomScaling();

        if ($.fn.DataTable.isDataTable('#repd-table')) {
            dataTable.clear().rows.add(filteredTableData).draw();
        } else {
            dataTable = $('#repd-table').DataTable({
                data: filteredTableData,
                pageLength: 10,
                order: [[2, 'desc']],
                responsive: true,
                language: { search: "Scan Systems:" }
            });
        }
    }

    function applyZoomScaling() {
        const currentZoom = map.getZoom();
        const scaleMultiplier = currentZoom > 9 ? Math.pow(1.4, currentZoom - 9) : 1;
        allMarkers.forEach(layer => {
            layer.setRadius(layer.options.baseRadius * scaleMultiplier);
        });
    }

    map.on('zoomend', applyZoomScaling);
</script>
