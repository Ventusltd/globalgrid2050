---
layout: page
title: UK Solar Pipeline (1-50MW)
permalink: /repd_solar_pipeline/
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

    /* Upgraded Filter Panel for Dual Sliders */
    .filter-panel {
        background: #111;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 15px;
        color: white;
    }
    .filter-panel h3 { margin-top: 0; color: #ffd700; font-size: 22px; margin-bottom: 15px; }
    .filter-panel label { display: block; margin-bottom: 5px; font-weight: bold; color: #66ccff; font-size: 16px; }
    input[type=range] { width: 100%; cursor: pointer; accent-color: #ffd700; margin-bottom: 15px; }

    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    
    /* Solar Pipeline Cluster Colors (Gold/Yellow) */
    .marker-cluster-small { background-color: rgba(255, 215, 0, 0.6); }
    .marker-cluster-small div { background-color: rgba(255, 215, 0, 0.9); color: #000; }
    
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
        <h3>☀️ Active Solar Pipeline Filter</h3>
        
        <label for="minCapacityRange">Minimum Size: <span id="minCapacityVal">1</span> MW</label>
        <input type="range" id="minCapacityRange" min="1" max="50" value="1" step="1">
        
        <label for="maxCapacityRange">Maximum Size: <span id="maxCapacityVal">50</span> MW</label>
        <input type="range" id="maxCapacityRange" min="1" max="50" value="50" step="1">
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

    const map = L.map('map').setView([54.5, -2.5], 6);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const grid400Layer = L.layerGroup().addTo(map);
    const grid275Layer = L.layerGroup().addTo(map);
    const grid132Layer = L.layerGroup().addTo(map);

    const overlayMaps = {
        "<span style='color: #0054ff; font-weight: bold;'>400kV Lines</span>": grid400Layer,
        "<span style='color: #ff0000; font-weight: bold;'>275kV Lines</span>": grid275Layer,
        "<span style='color: #00cc00; font-weight: bold;'>132kV Lines</span>": grid132Layer
    };
    L.control.layers(null, overlayMaps, { collapsed: false }).addTo(map);

    fetch('{{ site.baseurl }}/grid_400kv.geojson')
        .then(response => response.json())
        .then(data => L.geoJSON(data, { style: { color: '#0054ff', weight: 2, opacity: 0.6 } }).addTo(grid400Layer))
        .catch(error => console.error('Error loading 400kV:', error));

    fetch('{{ site.baseurl }}/grid_275kv.geojson')
        .then(response => response.json())
        .then(data => L.geoJSON(data, { style: { color: '#ff0000', weight: 2, opacity: 0.6 } }).addTo(grid275Layer))
        .catch(error => console.error('Error loading 275kV:', error));

    fetch('{{ site.baseurl }}/grid_132kv.geojson')
        .then(response => response.json())
        .then(data => L.geoJSON(data, { style: { color: '#00cc00', weight: 1.5, opacity: 0.5 } }).addTo(grid132Layer))
        .catch(error => console.error('Error loading 132kV:', error));

    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    const csvUrl = '{{ site.baseurl }}/repd.csv';

    let allData = [];
    let allMarkers = [];
    let dataTable;

    // Dual Slider State
    let currentMin = 1;
    let currentMax = 50;

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
        updateDisplay(currentMin, currentMax);

        // Logic to prevent the Min slider from crossing the Max slider
        $('#minCapacityRange').on('input', function() {
            currentMin = parseFloat($(this).val());
            if (currentMin > currentMax) {
                currentMax = currentMin;
                $('#maxCapacityRange').val(currentMax);
                $('#maxCapacityVal').text(currentMax);
            }
            $('#minCapacityVal').text(currentMin);
            updateDisplay(currentMin, currentMax);
        });

        // Logic to prevent the Max slider from crossing the Min slider
        $('#maxCapacityRange').on('input', function() {
            currentMax = parseFloat($(this).val());
            if (currentMax < currentMin) {
                currentMin = currentMax;
                $('#minCapacityRange').val(currentMin);
                $('#minCapacityVal').text(currentMin);
            }
            $('#maxCapacityVal').text(currentMax);
            updateDisplay(currentMin, currentMax);
        });
    }

    function updateDisplay(minMW, maxMW) {
        markers.clearLayers();
        allMarkers = [];
        const filteredTableData = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const status = row['Development Status'] || 'Unknown';
            const tech = row['Technology Type'] || '';
            
            // FILTER 1: Must be Solar
            const isSolar = tech.toLowerCase().includes('solar');
            
            // FILTER 2: Must NOT be dead or operational (Looking for new pipeline only)
            const statusLower = status.toLowerCase();
            const isDeadOrDone = statusLower.includes('refused') || 
                                 statusLower.includes('abandoned') || 
                                 statusLower.includes('withdrawn') || 
                                 statusLower.includes('operational') ||
                                 statusLower.includes('decommissioned');
            
            // FILTER 3: Must be within our dual slider range
            const inRange = capacity >= minMW && capacity <= maxMW;
            
            // If it passes all criteria, plot it!
            if (isSolar && !isDeadOrDone && inRange) {
                const x = parseFloat(row['X-coordinate']);
                const y = parseFloat(row['Y-coordinate']);
                
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const color = '#ffd700'; // Bright Solar Gold
                        
                        const baseRadius = Math.max(10, (Math.sqrt(capacity) || 4) * 2);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius,
                            baseRadius: baseRadius,
                            fillColor: color,
                            color: "#000",
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

        map.addLayer(markers);
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

