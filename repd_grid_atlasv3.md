---
layout: null
title: GlobalGrid2050 Full Universe V3
permalink: /repd_grid_atlasv3/
---
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>GlobalGrid2050 | Full Asset Strip</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        body { margin: 0; background: #000; font-family: monospace; color: #fff; overflow-x: hidden; }
        #map { height: 70vh; width: 100vw; border-bottom: 2px solid #333; }
        .controls { padding: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; background: #0a0a0a; }
        .group { border: 1px solid #222; padding: 8px; border-radius: 4px; }
        .header { font-size: 10px; color: #66ccff; margin-bottom: 5px; text-transform: uppercase; border-bottom: 1px solid #222; }
        .item { display: flex; align-items: center; gap: 5px; font-size: 11px; margin-bottom: 3px; cursor: pointer; }
        input { accent-color: #66ccff; cursor: pointer; }
    </style>
</head>
<body>

<div id="map"></div>

<div class="controls">
    <div class="group">
        <div class="header">Basemaps</div>
        <label class="item"><input type="radio" name="bm" id="btn-dark" checked> Dark Mode</label>
        <label class="item"><input type="radio" name="bm" id="btn-sat"> Satellite</label>
    </div>

    <div class="group">
        <div class="header">High Voltage</div>
        <label class="item"><input type="checkbox" id="c-400" checked> <span style="color:#0054ff">400kV</span></label>
        <label class="item"><input type="checkbox" id="c-275" checked> <span style="color:#ff0000">275kV</span></label>
        <label class="item"><input type="checkbox" id="c-220"> <span style="color:#ff9900">220kV</span></label>
    </div>

    <div class="group">
        <div class="header">Distribution</div>
        <label class="item"><input type="checkbox" id="c-132"> <span style="color:#00cc00">132kV</span></label>
        <label class="item"><input type="checkbox" id="c-66"> <span style="color:#b200ff">66kV</span></label>
        <label class="item"><input type="checkbox" id="c-subs" checked> <span style="color:#fff">Substations</span></label>
    </div>

    <div class="group">
        <div class="header">Generation</div>
        <label class="item"><input type="checkbox" id="c-nuc"> <span style="color:#39ff14">Nuclear</span></label>
        <label class="item"><input type="checkbox" id="c-gas"> <span style="color:#ff4500">Gas</span></label>
        <label class="item"><input type="checkbox" id="c-energy"> <span style="color:#00f2ff">Energy Projects</span></label>
    </div>

    <div class="group">
        <div class="header">Heavy Users</div>
        <label class="item"><input type="checkbox" id="c-ind"> <span style="color:#ff6600">Industry</span></label>
        <label class="item"><input type="checkbox" id="c-dc"> <span style="color:#00ffff">Data Centres</span></label>
        <label class="item"><input type="checkbox" id="c-water"> <span style="color:#0088ff">Water</span></label>
    </div>

    <div class="group">
        <div class="header">Transport</div>
        <label class="item"><input type="checkbox" id="c-air"> <span style="color:#ff00ff">Airports</span></label>
        <label class="item"><input type="checkbox" id="c-rail"> <span style="color:#ffd700">Railways</span></label>
    </div>
</div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.5, 53],
        zoom: 5.5
    });

    // SNAPPING LOGIC
    function snap(lines, subs) {
        const tol = 0.05;
        lines.forEach(f => {
            const coords = f.geometry.coordinates;
            [0, coords.length - 1].forEach(idx => {
                let best = coords[idx], minD = Infinity;
                subs.forEach(s => {
                    const sc = s.geometry.coordinates;
                    const d = Math.pow(coords[idx][0]-sc[0],2) + Math.pow(coords[idx][1]-sc[1],2);
                    if (d < minD && d < tol*tol) { minD = d; best = sc; }
                });
                coords[idx] = best;
            });
        });
        return lines;
    }

    map.on('load', async () => {
        // SOURCES
        map.addSource('sat', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addSource('subs-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('assets-s', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        
        const vs = ['400','275','220','132','66'];
        vs.forEach(v => map.addSource(`v${v}-s`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }));

        // LAYERS
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } });
        map.addLayer({ id: 'l-subs', type: 'circle', source: 'subs-s', paint: { 'circle-color': '#fff', 'circle-radius': 3 } });

        const addLine = (v, color, w, vis) => {
            map.addLayer({ id: `l-${v}`, type: 'line', source: `v${v}-s`, layout: { visibility: vis }, paint: { 'line-color': color, 'line-width': w } });
        };
        addLine('400', '#0054ff', 2.5, 'visible');
        addLine('275', '#ff0000', 2, 'visible');
        addLine('220', '#ff9900', 1.8, 'none');
        addLine('132', '#00cc00', 1.5, 'none');
        addLine('66', '#b200ff', 1.2, 'none');

        const addPoint = (id, color, filter) => {
            map.addLayer({ id, type: 'circle', source: 'assets-s', filter, layout: { visibility: 'none' }, paint: { 'circle-color': color, 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
        };
        addPoint('l-nuc', '#39ff14', ['==', 'type', 'nuclear']);
        addPoint('l-gas', '#ff4500', ['==', 'type', 'gas']);
        addPoint('l-ind', '#ff6600', ['==', 'type', 'industry']);
        addPoint('l-dc', '#00ffff', ['==', 'type', 'datacentre']);
        addPoint('l-water', '#0088ff', ['==', 'type', 'water']);
        addPoint('l-air', '#ff00ff', ['==', 'type', 'airport']);
        addPoint('l-rail', '#ffd700', ['==', 'type', 'railway']);

        // DATA INGESTION
        try {
            const [sR, aR] = await Promise.all([fetch('/grid_substations.geojson'), fetch('/industrial_offtakers.geojson')]);
            const sD = await sR.json();
            map.getSource('subs-s').setData(sD);
            map.getSource('assets-s').setData(await aR.json());

            vs.forEach(async v => {
                const res = await fetch(`/grid_${v}kv.geojson`);
                const data = await res.json();
                map.getSource(`v${v}-s`).setData({ type: 'FeatureCollection', features: snap(data.features, sD.features) });
            });
        } catch (e) { console.error(e); }

        // BINDINGS
        const b = (id, l) => document.getElementById(id).addEventListener('change', e => map.setLayoutProperty(l, 'visibility', e.target.checked ? 'visible' : 'none'));
        b('c-400', 'l-400'); b('c-275', 'l-275'); b('c-220', 'l-220'); b('c-132', 'l-132'); b('c-66', 'l-66'); b('c-subs', 'l-subs');
        b('c-nuc', 'l-nuc'); b('c-gas', 'l-gas'); b('c-ind', 'l-ind'); b('c-dc', 'l-dc'); b('c-water', 'l-water'); b('c-air', 'l-air'); b('c-rail', 'l-rail');

        document.getElementById('btn-sat').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'visible');
        document.getElementById('btn-dark').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'none');
    });
</script>
</body>
</html>
