---
layout: page
title: Grid Scale Battery Atlas (BESS)
permalink: /grid-batteries/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />

<style>
    .dashboard-container { max-width: 1200px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    
    /* Filter Styling */
    .filter-panel {
        background: #111;
        padding: 15px;
        border-radius: 12px;
        border: 1px solid #444;
        margin-bottom: 15px;
        color: white;
    }
    .filter-panel label { display: block; margin-bottom: 10px; font-weight: bold; color: #66ccff; }
    input[type=range] { width: 100%; cursor: pointer; accent-color: #66ccff; }

    #map { height: 600px; width: 100%; border-radius: 12px; background: #0b0e14; border: 2px solid #2a2f3a; margin-bottom: 20px; }
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
</style>

<div class="dashboard-container">
    
    <div class="filter-panel">
        <label for="capacityRange">Minimum Project Size: <span id="capacityVal">0</span> MW</label>
        <input type="range" id="capacityRange" min="0" max="500" value="0" step="5">
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OSM' }).addTo(map);

    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 13 });
    const csvUrl = '{{ site.baseurl }}/repd-grid-batteries.csv';
    
    let allData = [];
    let allMarkers = [];
    let dataTable;

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
        updateDisplay(0);

        $('#capacityRange').on('input', function() {
            const minMW = parseFloat($(this).val());
            $('#capacityVal').text(minMW);
            updateDisplay(minMW);
        });
    }

    function updateDisplay(minMW) {
        // 1. Clear existing map layers
        markers.clearLayers();
        allMarkers = [];
        const filteredTableData = [];

        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            
            // Apply Filter
            if (capacity >= minMW) {
                const x = parseFloat(row['X-coordinate']);
                const y = parseFloat(row['Y-coordinate']);
                
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = row['Development Status'] === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00';
                        const baseRadius = Math.max(4, Math.sqrt(capacity) || 4);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius,
                            baseRadius: baseRadius,
                            fillColor: color,
                            color: "#fff",
                            weight: 0.5,
                            fillOpacity: 0.8
                        }).bindPopup(`<b>${row['Site Name']}</b><br>${capacity} MW`);

                        markers.addLayer(marker);
                        allMarkers.push(marker);

                        filteredTableData.push([
                            row['Site Name'],
                            row['Technology Type'],
                            capacity,
                            row['Development Status'],
                            row['County']
                        ]);
                    } catch (e) {}
                }
            }
        });

        map.addLayer(markers);
        applyZoomScaling(); // Ensure circles stay fat if zoomed in

        // 2. Update Table
        if ($.fn.DataTable.isDataTable('#repd-table')) {
            dataTable.clear().rows.add(filteredTableData).draw();
        } else {
            dataTable = $('#repd-table').DataTable({
                data: filteredTableData,
                pageLength: 10,
                order: [[2, 'desc']],
                responsive: true
            });
        }
    }

    function applyZoomScaling() {
        const currentZoom = map.getZoom();
        const scaleMultiplier = currentZoom > 9 ? Math.pow(1.35, currentZoom - 9) : 1;
        allMarkers.forEach(layer => {
            layer.setRadius(layer.options.baseRadius * scaleMultiplier);
        });
    }

    map.on('zoomend', applyZoomScaling);
</script>
