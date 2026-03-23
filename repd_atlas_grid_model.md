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
    
    /* Massive Map Upgrade */
    #map { 
        height: 850px; 
        min-height: 75vh; 
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
        margin-bottom: 20px; 
    }

    /* Filter Panel Upgrade */
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
    
    /* NMS Style Cluster Colors */
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
</style>

<div class="dashboard-container">
    
    <div class="filter-panel">
        <label for="capacityRange">Minimum Project Size: <span id="capacityVal">0</span> MW</label>
        <input type="range" id="capacityRange" min="0" max="1000" value="0" step="10">
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
    // 🌍 The Translation Engine
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    const map = L.map('map').setView([54.5, -2.5], 6);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // ⚡ NEW: Fetch and draw the 400kV Grid Lines in Blue
    const gridUrl = '{{ site.baseurl }}/grid_400kv.geojson';
    fetch(gridUrl)
        .then(response => response.json())
        .then(data => {
            L.geoJSON(data, {
                style: {
                    color: '#0054ff', // National Grid Blue
                    weight: 2,
                    opacity: 0.6
                }
            }).addTo(map);
        })
        .catch(error => console.error('Error loading 400kV grid data:', error));

    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    const csvUrl = '{{ site.baseurl }}/repd.csv';

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
        // Load initial state
        updateDisplay(0);

        // Slider Event
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
            const capacity = parseFloat(row['Installed Capacity (MWelec
