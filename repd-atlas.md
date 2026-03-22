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
    .controls { background: #1a1a1a; padding: 20px; border-radius: 12px; margin-bottom: 15px; color: white; display: flex; gap: 20px; align-items: center; flex-wrap: wrap; border: 1px solid #2a2f3a; }
    #map { height: 600px; width: 100%; border-radius: 12px; background: #0b0e14; border: 2px solid #2a2f3a; }
    .dashboard-container { max-width: 1400px; margin: auto; padding: 10px; font-family: 'Courier New', Courier, monospace; }
    #repd-table-container { background: #fff; padding: 20px; border-radius: 12px; margin-top: 20px; border: 1px solid #ddd; overflow-x: auto; color: #333; }
    
    select { padding: 10px; background: #333; color: white; border: 1px solid #555; border-radius: 6px; font-family: 'Courier New', monospace; cursor: pointer; }
    .legend { display: flex; gap: 15px; flex-wrap: wrap; font-size: 14px; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; border: 1px solid #fff; }

    /* NMS Style Cluster Colors */
    .marker-cluster-small { background-color: rgba(255, 255, 255, 0.2); }
    .marker-cluster-small div { background-color: rgba(255, 255, 255, 0.4); color: #fff; }
</style>

<div class="dashboard-container">
    <div class="controls">
        <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:12px; color:#aaa;">TECHNOLOGY BIOME:</label>
            <select id="techFilter">
                <option value="ALL">All Systems</option>
                <option value="Solar Photovoltaics">Solar Only</option>
                <option value="Battery">Battery/Storage Only</option>
                <option value="Wind">Wind Only</option>
            </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:5px;">
            <label style="font-size:12px; color:#aaa;">STATUS FILTER:</label>
            <select id="statusFilter">
                <option value="ALL">All Statuses</option>
                <option value="Operational">Operational Only</option>
                <option value="Planning">Planning/Construction</option>
            </select>
        </div>
        <div id="legend-box" class="legend">
            </div>
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
                    <th>Address</th>
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

    const techColors = {
        'Solar Photovoltaics': '#fff000', // Yellow
        'Battery/Storage': '#ff00ff',     // Magenta
        'Wind': '#00d4ff',               // Cyan
        'Other': '#cccccc'               // Grey
    };

    const map = L.map('map').setView([54.5, -2.5], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    let allMarkers = L.markerClusterGroup({ disableClusteringAtZoom: 13 });
    let masterData = [];
    let dataTable;

    function getMarkerColor(tech) {
        if (tech.includes('Solar')) return techColors['Solar Photovoltaics'];
        if (tech.includes('Battery') || tech.includes('Storage')) return techColors['Battery/Storage'];
        if (tech.includes('Wind')) return techColors['Wind'];
        return techColors['Other'];
    }

    Papa.parse('{{ site.baseurl }}/repd.csv', {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            masterData = results.data;
            initLegend();
            updateDisplay();
        }
    });

    function initLegend() {
        let html = '';
        for (const [name, color] of Object.entries(techColors)) {
            html += `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${name}</div>`;
        }
        $('#legend-box').html(html);
    }

    function updateDisplay() {
        allMarkers.clearLayers();
        const selectedTech = $('#techFilter').val();
        const selectedStatus = $('#statusFilter').val();
        const tableData = [];

        masterData.forEach(row => {
            const tech = row['Technology Type'] || "";
            const status = row['Development Status'] || "";
            const x = parseFloat(row['X-coordinate']);
            const y = parseFloat(row['Y-coordinate']);
            
            if (!x || !y) return;

            const matchTech = (selectedTech === "ALL" || tech.includes(selectedTech));
            const matchStatus = (selectedStatus === "ALL" || (selectedStatus === "Operational" ? status === "Operational" : status !== "Operational"));

            if (matchTech && matchStatus) {
                try {
                    const coords = proj4("EPSG:27700", "WGS84", [x, y]);
                    const isOp = status === "Operational";
                    const capacity = row['Installed Capacity (MWelec)'] || "0";
                    
                    const marker = L.circleMarker([coords[1], coords[0]], {
                        radius: Math.max(4, Math.sqrt(parseFloat(capacity)) || 4),
                        fillColor: getMarkerColor(tech),
                        color: "#fff",
                        weight: isOp ? 1.5 : 0.5,
                        fillOpacity: isOp ? 0.9 : 0.3
                    }).bindPopup(`
                        <div style="min-width:200px">
                            <b>${row['Site Name']}</b><br>
                            <span style="font-size:11px; color:#666;">${row['Address']}</span><br>
                            <hr style="margin:5px 0; border:0; border-top:1px solid #eee;">
                            Type: ${tech}<br>
                            Capacity: <b>${capacity} MW</b><br>
                            Status: <b>${status}</b>
                        </div>
                    `);

                    allMarkers.addLayer(marker);
                    tableData.push([
                        row['Site Name'], 
                        tech, 
                        parseFloat(capacity) || 0, 
                        status, 
                        row['Address'] || "N/A"
                    ]);
                } catch (e) {}
            }
        });

        map.addLayer(allMarkers);
        
        if (dataTable) dataTable.destroy();
        dataTable = $('#repd-table').DataTable({
            data: tableData,
            order: [[2, 'desc']],
            pageLength: 10,
            responsive: true,
            language: { search: "Scan Systems:" }
        });
    }

    $('#techFilter, #statusFilter').on('change', updateDisplay);
</script>
