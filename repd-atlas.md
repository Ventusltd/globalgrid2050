---
layout: page
title: REPD Energy Atlas
permalink: /atlas/
---

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css" />
<style>
    #map { height: 500px; width: 100%; border-radius: 8px; background: #1a1a1a; }
    .dashboard-container { display: flex; flex-direction: column; gap: 20px; font-family: 'Courier New', Courier, monospace; }
    #repd-table-container { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #ddd; }
    .status-operational { color: #00ff00; font-weight: bold; } /* Neon Green */
    .status-planning { color: #ffaa00; } /* Amber */
</style>

<div class="dashboard-container">
    <div id="map"></div>
    <div id="repd-table-container">
        <table id="repd-table" class="display" style="width:100%">
            <thead>
                <tr>
                    <th>Site Name</th>
                    <th>Technology</th>
                    <th>Capacity (MW)</th>
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js"></script>

<script>
    // DEFINE THE COORDINATE TRANSLATOR (BNG to Lat/Lon)
    // No Man's Sky logic: Convert raw grid data into visual light
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");

    const map = L.map('map').setView([54.5, -2.5], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    // POINT TO YOUR UPLOADED CSV
    const csvUrl = '{{ site.baseurl }}/REPD_Publication_Q4_2025.csv';

    Papa.parse(csvUrl, {
        download: true,
        header: true,
        complete: function(results) {
            const data = results.data;
            const tableData = [];

            data.forEach(row => {
                if (row['X-coordinate'] && row['Y-coordinate']) {
                    // Translate X/Y to Lat/Lon
                    const coords = proj4("EPSG:27700", "WGS84", [parseFloat(row['X-coordinate']), parseFloat(row['Y-coordinate'])]);
                    const lat = coords[1];
                    const lon = coords[0];

                    // Create procedural markers based on Status
                    let markerColor = row['Development Status'] === 'Operational' ? '#00ff00' : '#ffaa00';
                    
                    L.circleMarker([lat, lon], {
                        radius: Math.sqrt(parseFloat(row['Installed Capacity (MWelec)'])) || 3,
                        fillColor: markerColor,
                        color: "#fff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).bindPopup(`<b>${row['Site Name']}</b><br>${row['Technology Type']}<br>${row['Installed Capacity (MWelec)']} MW`)
                    .addTo(map);

                    // Add to table array
                    tableData.push([
                        row['Site Name'],
                        row['Technology Type'],
                        row['Installed Capacity (MWelec)'],
                        row['Development Status'],
                        row['County']
                    ]);
                }
            });

            // Initialize the HUD (The Table)
            $('#repd-table').DataTable({
                data: tableData,
                pageLength: 10,
                order: [[2, 'desc']] // Order by capacity
            });
        }
    });
</script>

