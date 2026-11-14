---
title: fixture
---
<script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
<script>
    proj4.defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +datum=OSGB36 +units=m +no_defs");
    const map = L.map('map').setView([54.5, -2.5], 6);
    const markers = L.markerClusterGroup({});
    let allData = []; let dataTable;
    Papa.parse('{{ site.baseurl }}/repd.csv', { download: true, header: true, skipEmptyLines: true,
        complete: function(results) { allData = results.data; draw(); } });
    function draw() {
        const t = [];
        allData.forEach(row => {
            const capacity = parseFloat(row['Installed Capacity (MWelec)']) || 0;
            const x = parseFloat(row['X-coordinate']), y = parseFloat(row['Y-coordinate']);
            if (x && y) { const c = proj4("EPSG:27700", "WGS84", [x, y]);
                markers.addLayer(L.circleMarker([c[1], c[0]], {}).bindPopup(row['Site Name']));
                t.push([row['Site Name'], capacity]); }
        });
        dataTable = $('#repd-table').DataTable({ data: t });
    }
</script>
