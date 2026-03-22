---
layout: page
title: UK Energy Atlas (REPD)
permalink: /atlas/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />

<style>
    #map { height: 600px; width: 100%; border-radius: 12px; background: #0b0e14; border: 2px solid #2a2f3a; margin-bottom: 20px; }
    .dashboard-container { max-width: 1200px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: #333; }
    .source-link-container { margin-top: 30px; text-align: center; padding: 20px; border-top: 1px solid #333; font-size: 14px; color: #888; }
    .source-link-container a { color: #66ccff; text-decoration: none; font-weight: bold; }
    
    /* NMS Style Cluster Colors - Restored */
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

    <div class="source-link-container">
        <p>Data Source: <a href="https://assets.publishing.service.gov.uk/media/6985c316d3f57710b50a9b1f/REPD_Publication_Q4_2025.csv" target="_blank">Download Official REPD Q4 2025 CSV</a></p>
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

    const markers = L.markerClusterGroup({ disableClusteringAtZoom: 13 });
    const csvUrl = '{{ site.baseurl }}/repd.csv';

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            const tableData = [];
            const allCircleMarkers = []; // Array to track markers for dynamic scaling
            
            results.data.forEach(row => {
                const x = parseFloat(row['X-coordinate']);
                const y = parseFloat(row['Y-coordinate']);
                
                if (x && y) {
                    try {
                        const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                        const isOp = row['Development Status'] === 'Operational';
                        const color = isOp ? '#00f2ff' : '#ff9d00';
                        const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
                        const baseRadius = Math.max(4, Math.sqrt(capacity) || 4);
                        
                        const marker = L.circleMarker([coords[1], coords[0]], {
                            radius: baseRadius,
                            baseRadius: baseRadius, // Store original radius for scaling math
                            fillColor: color,
                            color: "#fff",
                            weight: 0.5,
                            fillOpacity: 0.8
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
                        allCircleMarkers.push(marker); // Add to our tracking array

                        tableData.push([
                            row['Site Name'],
                            row['Technology Type'],
                            capacity,
                            row['Development Status'],
                            row['County']
                        ]);
                    } catch (e) {}
                }
            });

            map.addLayer(markers);

            // 🔍 DYNAMIC ZOOM SCALING ENGINE
            map.on('zoomend', function() {
                const currentZoom = map.getZoom();
                // Scale stays at 1x until zoom level 9, then grows exponentially by 35% per zoom level
                const scaleMultiplier = currentZoom > 9 ? Math.pow(1.35, currentZoom - 9) : 1;
                
                allCircleMarkers.forEach(layer => {
                    layer.setRadius(layer.options.baseRadius * scaleMultiplier);
                });
            });

            // Fire once on load to establish correct starting sizes
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
