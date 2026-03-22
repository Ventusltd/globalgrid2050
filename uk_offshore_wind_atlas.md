---
layout: page
title: UK Offshore Wind Atlas
permalink: /uk_offshore_wind_atlas/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />

<style>
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    
    /* Technical Viewport */
    #map { 
        height: 850px; 
        min-height: 75vh; 
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
        margin-bottom: 20px; 
    }

    /* Professional Filter Deck */
    .filter-panel {
        background: #111;
        padding: 20px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 15px;
        color: white;
    }
    .filter-panel label { display: block; margin-bottom: 10px; font-weight: bold; color: #66ccff; font-size: 18px; }
    input[type=range] { width: 100%; cursor: pointer; accent-color: #66ccff; }

    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    
    /* Cluster Styling */
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
</style>

<div class="dashboard-container">
    
    <div class="filter-panel">
        <label for="capacityRange">Minimum Offshore Wind Size: <span id="capacityVal">0</span> MW</label>
        <input type="range" id="capacityRange" min="0" max="4000" value="0" step="50">
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
    // 🌍 OSGB36 to WGS84 Projection Engine
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    // Centered slightly higher/further east to capture the North Sea arrays
    const map = L.map('map').setView([55.0, 0.0], 5);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 10 });
    const csvUrl = '{{ site.baseurl }}/repd.csv'; // Scanning the core REPD dataset

    let allData = [];
    let allMarkers = [];
    let dataTable;

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            // Filter only for Offshore Wind assets on ingestion
            allData = results.data.filter(row => row['Technology Type'] === 'Wind Offshore');
            initDashboard();
        }
    });

    function initDashboard() {
        updateDisplay(0);

        // Filter Logic: Capacity Slider
        $('#capacityRange').on('input', function() {
            const minMW = parseFloat($(this).val());
            $('#capacityVal').text(minMW);
            updateDisplay(minMW);
        });
    }

    function updateDisplay(minMW) {
        markers.clearLayers();
        allMarkers = [];
        const filteredTableData = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const status = row['Development Status'] || 'Unknown';
            
            if (capacity >= minMW) {
                const x = parseFloat(row['X-coordinate']);
                const y = parseFloat(row['Y-coordinate']);
                
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = status === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00';
                        
                        // Scalable Visual Weight logic
                        const baseRadius = Math.max(12, (Math.sqrt(capacity) || 4) * 1.5); // Slightly scaled down multiplier to handle GW scale
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius,
                            baseRadius: baseRadius,
                            fillColor: color,
                            color: "#fff",
                            weight: 2.5,
                            fillOpacity: 0.9
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

        // Data Table Synchronization
        if ($.fn.DataTable.isDataTable('#repd-table')) {
            dataTable.clear().rows.add(filteredTableData).draw();
        } else {
            dataTable = $('#repd-table').DataTable({
                data: filteredTableData,
                pageLength: 10,
                order: [[2, 'desc']],
                responsive: true,
                language: { search: "Scan Offshore Arrays:" }
            });
        }
    }

    function applyZoomScaling() {
        const currentZoom = map.getZoom();
        const scaleMultiplier = currentZoom > 7 ? Math.pow(1.3, currentZoom - 7) : 1;
        allMarkers.forEach(layer => {
            layer.setRadius(layer.options.baseRadius * scaleMultiplier);
        });
    }

    map.on('zoomend', applyZoomScaling);
</script>

