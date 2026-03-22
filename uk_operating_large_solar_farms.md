---
layout: page
title: UK Operating Large Solar Farms Atlas
permalink: /uk_operating_large_solar_farms/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />

<style>
    /* MASSIVE MAP UPGRADE */
    #map { 
        height: 850px; 
        min-height: 75vh; 
        width: 100%; 
        border-radius: 12px; 
        background: #0b0e14; 
        border: 3px solid #2a2f3a; 
        margin-bottom: 20px; 
    }
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    
    .marker-cluster-small { background-color: rgba(0, 242, 255, 0.6); }
    .marker-cluster-small div { background-color: rgba(0, 242, 255, 0.9); color: #000; }
</style>

<div class="dashboard-container">
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

    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 12 });
    const csvUrl = '{{ site.baseurl }}/repd-solar-operational-over-4mw.csv';

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const tableData = [];
            const allCircleMarkers = [];
            
            results.data.forEach(row => {
                const x = parseFloat(row['X-coordinate']);
                const y = parseFloat(row['Y-coordinate']);
                
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = row['Development Status'] === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00';
                        const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
                        
                        // MASSIVE FAT PIXELS
                        const baseRadius = Math.max(12, (Math.sqrt(capacity) || 4) * 2.5);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius,
                            baseRadius: baseRadius,
                            fillColor: color,
                            color: "#fff",
                            weight: 2.5,
                            fillOpacity: 0.9
                        }).bindPopup(`
                            <div style="min-width:160px">
                                <b>${row['Site Name']}</b><br>
                                <hr style="margin:4px 0">
                                ${row['Technology Type']}<br>
                                <b>${capacity} MW</b><br>
                                <i>${row['Development Status']}</i>
                            </div>
                        `);

                        markers.addLayer(marker);
                        allCircleMarkers.push(marker);

                        tableData.push([row['Site Name'], row['Technology Type'], capacity, row['Development Status'], row['County']]);
                    } catch (e) {}
                }
            });

            map.addLayer(markers);

            map.on('zoomend', function() {
                const currentZoom = map.getZoom();
                const scaleMultiplier = currentZoom > 9 ? Math.pow(1.4, currentZoom - 9) : 1;
                allCircleMarkers.forEach(layer => {
                    layer.setRadius(layer.options.baseRadius * scaleMultiplier);
                });
            });

            map.fire('zoomend');

            $('#repd-table').DataTable({
                data: tableData,
                pageLength: 10,
                order: [[2, 'desc']],
                responsive: true,
                language: { search: "Scan Systems:" }
            });
        }
    });
</script>

