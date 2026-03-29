<script>
    // --- HUD CLOCKS ---
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-time').innerText = now.toLocaleTimeString('en-GB');
        const days = Math.floor((new Date("2050-01-01") - now) / 86400000);
        document.getElementById('nz-countdown').innerText = days + " DAYS TO 2050";
    }, 1000);

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-1.5, 52.5],
        zoom: 5.8
    });

    // --- TOPOLOGY SNAPPING ENGINE ---
    function snapLines(features, subs) {
        const tol = 0.05;
        features.forEach(f => {
            const c = f.geometry.coordinates;
            if (c && c.length > 1) {
                [0, c.length - 1].forEach(i => {
                    let best = c[i], min = Infinity;
                    subs.forEach(s => {
                        const sc = s.geometry.coordinates;
                        const d = Math.pow(c[i][0]-sc[0],2) + Math.pow(c[i][1]-sc[1],2);
                        if (d < min && d < tol * tol) { min = d; best = sc; }
                    });
                    c[i] = best;
                });
            }
        });
        return features;
    }

    map.on('load', async () => {
        // 1. ADD ALL SOURCES
        map.addSource('sat-src', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addSource('subs-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('assets-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        
        const vList = ['400','275','220','132','66'];
        vList.forEach(v => map.addSource(`src-${v}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }));

        // 2. ADD ALL LAYERS
        map.addLayer({ id: 'lyr-sat', type: 'raster', source: 'sat-src', layout: { visibility: 'none' } });
        map.addLayer({ id: 'lyr-subs', type: 'circle', source: 'subs-src', paint: { 'circle-color': '#fff', 'circle-radius': 3.5, 'circle-stroke-width': 1 } });

        const addGrid = (v, color, width, vis) => {
            map.addLayer({ id: `lyr-${v}`, type: 'line', source: `src-${v}`, layout: { visibility: vis }, paint: { 'line-color': color, 'line-width': width } });
        };
        addGrid('400', '#0054ff', 2.5, 'visible');
        addGrid('275', '#ff0000', 2.2, 'visible');
        addGrid('220', '#ff9900', 1.8, 'visible');
        addGrid('132', '#00cc00', 1.5, 'none');
        addGrid('66', '#b200ff', 1.2, 'none');

        const addAsset = (id, color, filter) => {
            map.addLayer({ id, type: 'circle', source: 'assets-src', filter, layout: { visibility: 'none' }, paint: { 'circle-color': color, 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
        };
        // Gen
        addAsset('lyr-nuclear', '#39ff14', ['==', ['get', 'type'], 'nuclear']);
        addAsset('lyr-gas', '#ff4500', ['==', ['get', 'type'], 'gas']);
        addAsset('lyr-energy', '#00f2ff', ['==', ['get', 'type'], 'repd']);
        // Users
        addAsset('lyr-industry', '#ff6600', ['==', ['get', 'type'], 'industry']);
        addAsset('lyr-dc', '#00ffff', ['==', ['get', 'type'], 'datacentre']);
        addAsset('lyr-water', '#0088ff', ['==', ['get', 'type'], 'water']);
        // Transport
        addAsset('lyr-air', '#ff00ff', ['==', ['get', 'type'], 'airport']);
        addAsset('lyr-rail', '#ffd700', ['==', ['get', 'type'], 'railway']);

        // 3. DATA FETCH & SNAP
        try {
            const [sR, aR] = await Promise.all([fetch('/grid_substations.geojson'), fetch('/industrial_offtakers.geojson')]);
            const sD = await sR.json();
            const aD = await aR.json();
            map.getSource('subs-src').setData(sD);
            map.getSource('assets-src').setData(aD);

            vList.forEach(async v => {
                const res = await fetch(`/grid_${v}kv.geojson`);
                const data = await res.json();
                map.getSource(`src-${v}`).setData({ type: 'FeatureCollection', features: snapLines(data.features, sD.features) });
            });
        } catch (e) { console.error("Asset Load Failure", e); }

        // 4. COMMAND KEY BINDINGS (FIXING THE BROKEN CONTROLS)
        const uiMap = {
            'radio-dark': { type: 'basemap', val: 'none' },
            'radio-sat': { type: 'basemap', val: 'visible' },
            'check-400': 'lyr-400',
            'check-275': 'lyr-275',
            'check-220': 'lyr-220',
            'check-132': 'lyr-132',
            'check-66': 'lyr-66',
            'check-subs': 'lyr-subs',
            'check-nuclear': 'lyr-nuclear',
            'check-gas': 'lyr-gas',
            'check-energy': 'lyr-energy',
            'check-industry': 'lyr-industry',
            'check-dc': 'lyr-dc',
            'check-water': 'lyr-water',
            'check-airports': 'lyr-air',
            'check-rail': 'lyr-rail'
        };

        Object.entries(uiMap).forEach(([domId, layerId]) => {
            const el = document.getElementById(domId);
            if (!el) return;
            
            el.addEventListener('change', (e) => {
                if (layerId.type === 'basemap') {
                    map.setLayoutProperty('lyr-sat', 'visibility', layerId.val);
                } else {
                    map.setLayoutProperty(layerId, 'visibility', e.target.checked ? 'visible' : 'none');
                }
            });
        });
    });
</script>
