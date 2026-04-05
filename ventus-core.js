'use strict';

window.initVentusMap = function({ config, center, zoom }) {
    if (typeof maplibregl === 'undefined') {
        document.getElementById('fatal-banner').style.display = 'block';
        throw new Error('CRITICAL: MapLibre failed to load.');
    }

    // ── Utilities ────────────────────────────────────────────────────────────────
    function deepFreeze(obj) {
        Object.keys(obj).forEach(prop => {
            if (typeof obj[prop] === 'object' && obj[prop] !== null) deepFreeze(obj[prop]);
        });
        return Object.freeze(obj);
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function normalizeStatus(status) {
        return String(status ?? '').trim().toLowerCase();
    }

    function fmt(n, decimals) {
        return n.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    }

    function haversine(lon1, lat1, lon2, lat2) {
        const R = 6371, r = Math.PI / 180;
        const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ── Config Loading ────────────────────────────────────────────────────────────
    const GRID_CONFIG = deepFreeze(config);
    const RUNTIME_STATE = {};
    GRID_CONFIG.forEach(group => {
        group.layers.forEach(layer => {
            RUNTIME_STATE[layer.id] = { status: 'WAIT', loading: false, loaded: false };
        });
    });

    const REPD_IDS    = ['solar','solar_roof','wind','bess','biomass','tidal','hydrogen','hydro','flywheel','act','geothermal','caes'];
    const TRANSIT_IDS = ['elizabeth','lu','dlr','metro','tram','hs2'];
    const TRANSIT_SOURCE_MAP = { 'elizabeth':'src-elizabeth','lu':'src-lu','dlr':'src-metros','metro':'src-metros','tram':'src-metros','hs2':'src-hs2' };
    const TRANSIT_URLS = { 'src-elizabeth':'/elizabeth_line.geojson','src-lu':'/london_underground.geojson','src-metros':'/uk_metros_trams.geojson','src-hs2':'/hs2.geojson' };

    const SEARCH_THRESHOLD = {
        'solar':50,'solar_roof':0.5,'wind':50,'bess':50,'biomass':50,
        'tidal':10,'hydrogen':10,'hydro':10,'flywheel':1,'act':10,'geothermal':1,'caes':1
    };

    const TECH_TERMS = new Map([
        ['solar','solar farm'],['solar_roof','rooftop solar'],['wind','wind farm'],
        ['bess','battery storage'],['biomass','biomass plant'],['tidal','tidal energy'],
        ['hydrogen','hydrogen plant'],['hydro','hydro power'],['flywheel','flywheel storage'],
        ['act','advanced conversion energy'],['geothermal','geothermal energy'],['caes','compressed air energy storage']
    ]);

    const TECH_COLOURS = new Map([
        ['solar','#ffff00'],['solar_roof','#ffcc00'],['wind','#00ffff'],['bess','#ffae00'],
        ['biomass','#39ff14'],['tidal','#00bfff'],['hydrogen','#ffffff'],['hydro','#00aaff'],
        ['flywheel','#ff69b4'],['act','#ff6600'],['geothermal','#ff3300'],['caes','#88aaff']
    ]);

    const STATUS_COLOURS = {
        'operational':'#00ff88','under construction':'#ffcc00','awaiting construction':'#ffaa00',
        'consented':'#ff8800','planning permission granted':'#ff8800','planning approved':'#ff8800',
        'application submitted':'#8888ff','pre-construction':'#aaaaff'
    };

    let statusMode  = false;
    let radiusMode  = false;
    let radiusMarker  = null;
    let radiusCenter  = null;
    
    // RADIUS AREA STATE
    let radiusAreaMode = false;
    let radiusAreaMarker = null;
    let radiusAreaCenter = null;

    // ── POLY ZONE STATE ───────────────────────────────────────────────────────────
    // Drag-handle polygon editor. Click to place a starting triangle,
    // drag any vertex to reshape freely into any polygon.
    // Click any edge midpoint to add a new vertex and split that edge.
    let polyZoneMode      = false;
    let polyZonePoints    = [];   // array of [lon, lat]
    let polyZoneDragging  = false;
    let polyZoneDragIdx   = -1;   // index of vertex being dragged
    let polyZoneHoverIdx  = -1;   // index of vertex under cursor (-1 = none)
    let polyZonePopupHidden = false; // user hit ✕ — keep shape, hide popup

    const urlCache = {};
    let globalSubsData  = null;
    let allREPDFeatures = [];
    let searchIndex     = [];

    // ── Single popup instance — prevents accumulation ────────────────────────────
    let activePopup = null;
    function openPopup(lngLat, html, maxWidth) {
        if (activePopup) { activePopup.remove(); activePopup = null; }
        activePopup = new maplibregl.Popup({ maxWidth: maxWidth || '300px' })
            .setLngLat(lngLat)
            .setHTML(html)
            .addTo(map);
        activePopup.on('close', () => { activePopup = null; });
        return activePopup;
    }
    function closeActivePopup() {
        if (activePopup) { activePopup.remove(); activePopup = null; }
    }

    // ── Fullscreen ───────────────────────────────────────────────────────────────
    let fsActive = false;
    let curtainOpen = false;

    window.enterFullscreen = function() {
        fsActive = true;
        document.body.classList.add('fs-active');
        document.documentElement.classList.add('fs-active');
        document.getElementById('map-container').classList.add('is-fullscreen');
        document.getElementById('btn-fullscreen').style.display = 'none';
        const el = document.getElementById('map-container');
        if (el.requestFullscreen) { el.requestFullscreen().catch(() => {}); }
        else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
        setTimeout(() => map.resize(), 50);
    };

    window.exitFullscreen = function() {
        fsActive = false;
        curtainOpen = false;
        document.body.classList.remove('fs-active');
        document.documentElement.classList.remove('fs-active');
        document.getElementById('map-container').classList.remove('is-fullscreen');
        document.getElementById('btn-fullscreen').style.display = '';
        document.getElementById('fs-curtain').classList.remove('curtain-open');
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        setTimeout(() => map.resize(), 50);
    };

    function toggleCurtain() {
        curtainOpen = !curtainOpen;
        const curtain = document.getElementById('fs-curtain');
        const tab = document.getElementById('fs-curtain-tab');
        curtain.classList.toggle('curtain-open', curtainOpen);
        tab.innerText = curtainOpen ? '⬆ Close' : '⬇ Layers';
    }

    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && fsActive) exitFullscreen(); });
    document.addEventListener('webkitfullscreenchange', () => { if (!document.webkitFullscreenElement && fsActive) exitFullscreen(); });

    // ── Radius Tool ───────────────────────────────────────────────────────────────
    const RADIUS_MIN = 1;
    const RADIUS_MAX = 160;

    function getRadiusValue() {
        const raw = parseFloat(document.getElementById('radius-input').value);
        if (isNaN(raw) || raw < RADIUS_MIN) return RADIUS_MIN;
        if (raw > RADIUS_MAX) return RADIUS_MAX;
        return raw;
    }

    function validateRadiusInput() {
        const input = document.getElementById('radius-input');
        const raw = parseFloat(input.value);
        const invalid = isNaN(raw) || raw < RADIUS_MIN || raw > RADIUS_MAX;
        input.classList.toggle('invalid', invalid);
        return !invalid;
    }

    // ── Measure Tool ──────────────────────────────────────────────────────────────
    let measureMode = false;
    let measurePoints = [];
    let measureClosed = false;
    let _lastMouseMoveRaf = null;

    function updateMeasureDisplay() {
        const lineEl  = document.getElementById('m-line');
        const perimEl = document.getElementById('m-perim');
        const areaEl  = document.getElementById('m-area');
        const hint    = document.getElementById('m-hint');
        const undoBtn = document.getElementById('btn-measure-undo');

        undoBtn.style.display = (measurePoints.length > 0 && !measureClosed) ? 'inline-block' : 'none';

        if (measurePoints.length < 2) {
            lineEl.style.display = 'none'; perimEl.style.display = 'none'; areaEl.style.display = 'none';
            hint.innerText = 'Click to add points · Double-click to close polygon';
            return;
        }

        let totalKm = 0;
        for (let i = 1; i < measurePoints.length; i++) {
            totalKm += haversine(measurePoints[i-1][0], measurePoints[i-1][1], measurePoints[i][0], measurePoints[i][1]);
        }

        if (!measureClosed) {
            lineEl.style.display = 'block'; perimEl.style.display = 'none'; areaEl.style.display = 'none';
            document.getElementById('m-km').innerText = fmt(totalKm, 2);
            document.getElementById('m-m').innerText  = fmt(totalKm * 1000, 0);
            document.getElementById('m-mi').innerText = fmt(totalKm * 0.621371, 2);
            hint.innerText = 'Double-click last point to close polygon';
        } else {
            const closingKm = haversine(measurePoints[measurePoints.length-1][0], measurePoints[measurePoints.length-1][1], measurePoints[0][0], measurePoints[0][1]);
            const perimKm = totalKm + closingKm;
            let area = 0;
            const R = 6371;
            for (let i = 0; i < measurePoints.length; i++) {
                const j  = (i + 1) % measurePoints.length;
                const xi = measurePoints[i][0] * Math.PI / 180; const yi = measurePoints[i][1] * Math.PI / 180;
                const xj = measurePoints[j][0] * Math.PI / 180; const yj = measurePoints[j][1] * Math.PI / 180;
                area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
            }
            const areaKm2 = Math.abs(area) * R * R / 2;
            const areaHa  = areaKm2 * 100; const areaAc  = areaKm2 * 247.105;

            lineEl.style.display  = 'none'; perimEl.style.display = 'block'; areaEl.style.display  = 'block';
            document.getElementById('m-pkm').innerText = fmt(perimKm, 2); document.getElementById('m-pm').innerText  = fmt(perimKm * 1000, 0);
            document.getElementById('m-km2').innerText = fmt(areaKm2, 3); document.getElementById('m-ha').innerText  = fmt(areaHa, 1);
            document.getElementById('m-ac').innerText  = fmt(areaAc, 1);
            hint.innerText = 'Click 📏 Measure again to reset';
        }
    }

    function updateMeasureLayers() {
        if (!map.getSource('src-measure-line')) return;
        const lineCoords = [...measurePoints];
        if (measureClosed && measurePoints.length > 2) lineCoords.push(measurePoints[0]);
        map.getSource('src-measure-line').setData({ type: 'FeatureCollection', features: lineCoords.length > 1 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: lineCoords } }] : [] });
        map.getSource('src-measure-fill').setData({ type: 'FeatureCollection', features: measureClosed && measurePoints.length > 2 ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...measurePoints, measurePoints[0]]] } }] : [] });
        map.getSource('src-measure-points').setData({ type: 'FeatureCollection', features: measurePoints.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c } })) });
    }

    function clearMeasure() {
        measurePoints = []; measureClosed = false; updateMeasureLayers(); updateMeasureDisplay();
        document.getElementById('measure-display').style.display = 'none';
    }

    function undoLastMeasurePoint() {
        if (measurePoints.length === 0 || measureClosed) return;
        measurePoints.pop(); updateMeasureLayers(); updateMeasureDisplay();
    }

    function toggleMeasureMode() {
        measureMode = !measureMode;
        const btn = document.getElementById('btn-measure');
        btn.classList.toggle('active', measureMode); btn.setAttribute('aria-pressed', measureMode);
        map.getCanvas().style.cursor = measureMode ? 'crosshair' : '';
        if (!measureMode) { clearMeasure(); } else {
            if (radiusMode) toggleRadiusMode();
            if (radiusAreaMode) toggleRadiusAreaMode();
            document.getElementById('measure-display').style.display = 'block'; updateMeasureDisplay();
        }
    }

    // ── Radius Area Tool ──────────────────────────────────────────────────────────
    function toggleRadiusAreaMode() {
        radiusAreaMode = !radiusAreaMode;
        const btn = document.getElementById('btn-radius-area');
        if(btn) {
            btn.classList.toggle('active', radiusAreaMode); 
            btn.setAttribute('aria-pressed', radiusAreaMode);
        }
        const popupEl = document.getElementById('radius-area-popup');
        if(popupEl) popupEl.style.display = radiusAreaMode ? 'block' : 'none';
        
        map.getCanvas().style.cursor = radiusAreaMode ? 'crosshair' : '';
        
        if (radiusAreaMode && radiusMode) toggleRadiusMode();
        if (radiusAreaMode && measureMode) toggleMeasureMode();
        
        if (!radiusAreaMode) { 
            if(map.getSource('src-radius-area')) {
                map.getSource('src-radius-area').setData({ type: 'FeatureCollection', features: [] });
            }
            radiusAreaCenter = null; 
            if (radiusAreaMarker) { radiusAreaMarker.remove(); radiusAreaMarker = null; }
            // BUG FIX: close only the tracked popup, not a random first popup in DOM
            closeActivePopup();
        }
    }

    function doRadiusAreaMeasure(lon, lat) {
        const input = document.getElementById('radius-area-input');
        if(!input) return;
        const km = parseFloat(input.value);
        if (isNaN(km) || km <= 0 || km > 160) {
            input.classList.add('invalid');
            return;
        }
        input.classList.remove('invalid');
        radiusAreaCenter = { lon, lat };

        if(map.getSource('src-radius-area')) {
            map.getSource('src-radius-area').setData(createGeoJSONCircle(lon, lat, km));
        }
        if (radiusAreaMarker) radiusAreaMarker.remove(); radiusAreaMarker = null;

        // Calculate Geodesic Spherical Cap Area
        const R = 6371;
        const areaKm2  = 2 * Math.PI * R * R * (1 - Math.cos(km / R));
        const areaM2   = areaKm2 * 1000000;
        const areaHa   = areaM2 / 10000;
        const areaAc   = areaM2 / 4046.85642;
        const areaMi2  = areaKm2 * 0.386102;
        const pitches  = areaM2 / 7140;

        // Full expanded popup — all units always visible.
        // ✕ closes the popup but keeps the circle on the map for browsing.
        openPopup([lon, lat], `
            <div style="font-family:monospace;background:#000;padding:10px 12px;border:1px solid #ff00ff;border-radius:4px;min-width:220px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <b style="color:#ff00ff;font-size:13px;">◵ ${km}km radius</b>
                    <span onclick="(function(){var p=document.querySelector('.maplibregl-popup');if(p)p.style.display='none';})()" style="color:#555;font-size:14px;cursor:pointer;line-height:1;padding:0 2px;user-select:none;" title="Close popup, keep circle">✕</span>
                </div>
                <div style="color:#ffae00;font-size:13px;margin-bottom:10px;">⚽ ${fmt(pitches, 1)} football pitches</div>
                <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px;">
                    <span style="color:#888;">Square Metres</span><span style="color:#fff;">${fmt(areaM2, 0)}</span>
                    <span style="color:#888;">Hectares</span><span style="color:#fff;">${fmt(areaHa, 2)}</span>
                    <span style="color:#888;">Acres</span><span style="color:#fff;">${fmt(areaAc, 2)}</span>
                    <span style="color:#888;">Square Kilometres</span><span style="color:#fff;">${fmt(areaKm2, 3)}</span>
                    <span style="color:#888;">Square Miles</span><span style="color:#fff;">${fmt(areaMi2, 3)}</span>
                </div>
            </div>`);
    }

    // ── Poly Zone Tool ────────────────────────────────────────────────────────────
    // Free-draw polygon constrained within a configurable radius (0.1–5km).
    // Click to place triangle → drag vertices → click edge to add vertex.

    function _polyZoneDefaultTriangle(lon, lat) {
        const earthR = 6371, d = 0.7, deg = Math.PI / 180;
        return [0, 120, 240].map(bearingDeg => {
            const b = bearingDeg * deg, lat1 = lat * deg, ad = d / earthR;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(b));
            const lon2 = lon * deg + Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));
            return [lon2 / deg, lat2 / deg];
        });
    }

    function _polyZoneCalcArea(pts) {
        if (pts.length < 3) return { areaKm2: 0, areaHa: 0, areaAc: 0, areaMi2: 0, areaM2: 0, perimKm: 0, pitches: 0 };
        let area = 0;
        const R = 6371;
        for (let i = 0; i < pts.length; i++) {
            const j  = (i + 1) % pts.length;
            const xi = pts[i][0] * Math.PI / 180, yi = pts[i][1] * Math.PI / 180;
            const xj = pts[j][0] * Math.PI / 180, yj = pts[j][1] * Math.PI / 180;
            area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
        }
        const areaKm2 = Math.abs(area) * R * R / 2;
        let perimKm = 0;
        for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            perimKm += haversine(pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
        }
        const areaM2 = areaKm2 * 1000000;
        return { areaKm2, areaHa: areaM2 / 10000, areaAc: areaM2 / 4046.85642, areaMi2: areaKm2 * 0.386102, areaM2, perimKm, pitches: areaM2 / 7140 };
    }

    function _polyZoneUpdateLayers() {
        if (!map.getSource('src-polyzone-fill')) return;
        const n = polyZonePoints.length;
        // Clear old boundary/centre sources from previous tool version
        if (map.getSource('src-polyzone-boundary')) map.getSource('src-polyzone-boundary').setData({ type: 'FeatureCollection', features: [] });
        if (map.getSource('src-polyzone-centre'))   map.getSource('src-polyzone-centre').setData({ type: 'FeatureCollection', features: [] });
        if (n < 3) {
            map.getSource('src-polyzone-fill').setData({ type: 'FeatureCollection', features: [] });
            map.getSource('src-polyzone-line').setData({ type: 'FeatureCollection', features: [] });
            map.getSource('src-polyzone-points').setData({ type: 'FeatureCollection', features: [] });
            return;
        }
        const ring = [...polyZonePoints, polyZonePoints[0]];
        map.getSource('src-polyzone-fill').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }] });
        map.getSource('src-polyzone-line').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: ring } }] });
        // Vertex dots — main drag handles
        const vFeatures = polyZonePoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }));
        // Edge sub-dots — 3 per edge at 25%, 50%, 75% positions for denser grab points
        const mFeatures = [];
        polyZonePoints.forEach((c, i) => {
            const j = (i + 1) % n;
            const b = polyZonePoints[j];
            [0.25, 0.5, 0.75].forEach(t => {
                mFeatures.push({ type: 'Feature', properties: { kind: 'mid', edgeIdx: i, t }, geometry: { type: 'Point', coordinates: [c[0] + (b[0] - c[0]) * t, c[1] + (b[1] - c[1]) * t] } });
            });
        });
        map.getSource('src-polyzone-points').setData({ type: 'FeatureCollection', features: [...vFeatures, ...mFeatures] });
    }

    let _polyZonePopupRaf = null;
    let _polyZoneCollapsed = false; // true = showing mini label only

    function _polyZoneShowPopup() {
        if (polyZonePoints.length < 3) return;
        const { areaKm2, areaHa, areaAc, areaMi2, areaM2, perimKm, pitches } = _polyZoneCalcArea(polyZonePoints);
        const centLon = polyZonePoints.reduce((s, p) => s + p[0], 0) / polyZonePoints.length;
        const centLat = polyZonePoints.reduce((s, p) => s + p[1], 0) / polyZonePoints.length;

        if (_polyZoneCollapsed) {
            // Collapsed mini label — click to expand
            openPopup([centLon, centLat], `
                <div onclick="window._pzExpand && window._pzExpand()" style="font-family:monospace;background:#000;padding:5px 10px;border:1px solid #ff00ff;border-radius:4px;cursor:pointer;color:#ff00ff;font-size:11px;white-space:nowrap;">
                    ⬡ ${fmt(areaKm2, 3)} km² · ⚽ ${fmt(pitches, 0)} pitches &nbsp;▾
                </div>`);
            window._pzExpand = () => { _polyZoneCollapsed = false; _polyZoneShowPopup(); };
        } else {
            // Full expanded popup — magenta to match radius area, full unit names
            openPopup([centLon, centLat], `
                <div style="font-family:monospace;background:#000;padding:10px 12px;border:1px solid #ff00ff;border-radius:4px;min-width:230px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <b style="color:#ff00ff;font-size:13px;">⬡ Poly Zone</b>
                        <span onclick="window._pzCollapse && window._pzCollapse()" style="color:#555;font-size:12px;cursor:pointer;padding:0 4px;user-select:none;" title="Collapse — keeps polygon">▴ hide</span>
                    </div>
                    <div style="color:#ffae00;font-size:13px;margin-bottom:10px;">⚽ ${fmt(pitches, 1)} football pitches</div>
                    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px;">
                        <span style="color:#888;">Square Metres</span><span style="color:#fff;">${fmt(areaM2, 0)}</span>
                        <span style="color:#888;">Hectares</span><span style="color:#fff;">${fmt(areaHa, 2)}</span>
                        <span style="color:#888;">Acres</span><span style="color:#fff;">${fmt(areaAc, 2)}</span>
                        <span style="color:#888;">Square Kilometres</span><span style="color:#fff;">${fmt(areaKm2, 4)}</span>
                        <span style="color:#888;">Square Miles</span><span style="color:#fff;">${fmt(areaMi2, 3)}</span>
                        <span style="color:#888;">Perimeter</span><span style="color:#fff;">${fmt(perimKm, 2)} km</span>
                    </div>
                    <div style="color:#555;font-size:9px;margin-top:8px;">Drag vertices · Click edge dot to add point</div>
                </div>`);
            window._pzCollapse = () => { _polyZoneCollapsed = true; _polyZoneShowPopup(); };
        }
    }

    function _polyZoneShowPopupDebounced() {
        // During drag, throttle popup redraws to once per RAF to prevent flicker
        if (_polyZonePopupRaf) return;
        _polyZonePopupRaf = requestAnimationFrame(() => {
            _polyZonePopupRaf = null;
            _polyZoneShowPopup();
        });
    }

    function _polyZoneUpdateDisplay() {
        const undoBtn = document.getElementById('btn-polyzone-undo');
        const hint    = document.getElementById('pz-hint');
        const areaEl  = document.getElementById('pz-area');
        const perimEl = document.getElementById('pz-perim');
        if (areaEl)  areaEl.style.display  = 'none';
        if (perimEl) perimEl.style.display = 'none';
        if (undoBtn) undoBtn.style.display = polyZonePoints.length > 3 ? 'inline-block' : 'none';
        if (hint) hint.innerText = polyZonePoints.length === 0 ? 'Click map to place triangle' : 'Drag vertices · Click edge to add vertex · ↩ removes last';
    }

    function _polyZoneClear() {
        polyZonePoints      = [];
        polyZoneDragging    = false;
        polyZoneDragIdx     = -1;
        polyZoneHoverIdx    = -1;
        polyZonePopupHidden = false;
        _polyZoneCollapsed  = false;
        window._pzExpand    = null;
        window._pzCollapse  = null;
        closeActivePopup();
        _polyZoneUpdateLayers();
        _polyZoneUpdateDisplay();
        const el = document.getElementById('polyzone-display');
        if (el) el.style.display = 'none';
    }

    function polyZoneUndo() {
        if (polyZonePoints.length <= 3) { _polyZoneClear(); return; }
        polyZonePoints.pop();
        _polyZoneUpdateLayers();
        _polyZoneShowPopup();
        _polyZoneUpdateDisplay();
    }

    function togglePolyZoneMode() {
        polyZoneMode = !polyZoneMode;
        const btn = document.getElementById('btn-polyzone');
        if (btn) { btn.classList.toggle('active', polyZoneMode); btn.setAttribute('aria-pressed', polyZoneMode); }
        const panel = document.getElementById('polyzone-panel');
        if (panel) panel.style.display = 'none';
        map.getCanvas().style.cursor = polyZoneMode ? 'crosshair' : '';
        if (polyZoneMode) {
            if (radiusMode)     toggleRadiusMode();
            if (radiusAreaMode) toggleRadiusAreaMode();
            if (measureMode)    toggleMeasureMode();
            const el = document.getElementById('polyzone-display');
            if (el) el.style.display = 'block';
            _polyZoneUpdateDisplay();
        } else {
            _polyZoneClear();
        }
    }

    // ── Poly Zone mouse handlers — wired into map events below ────────────────────
    function _polyZoneOnClick(e) {
        if (polyZoneDragging) return;
        const lon = e.lngLat.lng, lat = e.lngLat.lat;
        if (polyZonePoints.length === 0) {
            polyZonePoints      = _polyZoneDefaultTriangle(lon, lat);
            polyZonePopupHidden = false;
            _polyZoneUpdateLayers(); _polyZoneShowPopup(); _polyZoneUpdateDisplay();
            return;
        }
        // Check for click near any edge sub-dot — insert vertex at that position
        const px = map.project([lon, lat]);
        for (let i = 0; i < polyZonePoints.length; i++) {
            const j = (i + 1) % polyZonePoints.length;
            const a = polyZonePoints[i], b = polyZonePoints[j];
            for (const t of [0.25, 0.5, 0.75]) {
                const dot = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
                const dpx = map.project(dot);
                const dx = px.x - dpx.x, dy = px.y - dpx.y;
                if (Math.sqrt(dx * dx + dy * dy) < 14) {
                    polyZonePoints.splice(j, 0, [lon, lat]);
                    _polyZoneUpdateLayers(); _polyZoneShowPopup(); _polyZoneUpdateDisplay();
                    return;
                }
            }
        }
        // Click on empty space — reset with new triangle
        polyZonePoints      = _polyZoneDefaultTriangle(lon, lat);
        polyZonePopupHidden = false;
        _polyZoneUpdateLayers(); _polyZoneShowPopup(); _polyZoneUpdateDisplay();
    }

    function _polyZoneOnMouseDown(e) {
        if (!polyZoneMode || polyZonePoints.length < 3) return;
        const px = map.project(e.lngLat);
        for (let i = 0; i < polyZonePoints.length; i++) {
            const vpx = map.project(polyZonePoints[i]);
            const dx = px.x - vpx.x, dy = px.y - vpx.y;
            if (Math.sqrt(dx * dx + dy * dy) < 14) {
                polyZoneDragging = true; polyZoneDragIdx = i;
                map.dragPan.disable();
                map.getCanvas().style.cursor = 'grabbing';
                e.preventDefault(); return;
            }
        }
    }

    function _polyZoneOnMouseMove(e) {
        if (!polyZoneMode || polyZonePoints.length < 3) return;
        if (polyZoneDragging && polyZoneDragIdx >= 0) {
            polyZonePoints[polyZoneDragIdx] = [e.lngLat.lng, e.lngLat.lat];
            polyZonePopupHidden = false;
            _polyZoneUpdateLayers(); _polyZoneShowPopupDebounced(); return;
        }
        const px = map.project(e.lngLat);
        let found = -1;
        for (let i = 0; i < polyZonePoints.length; i++) {
            const vpx = map.project(polyZonePoints[i]);
            const dx = px.x - vpx.x, dy = px.y - vpx.y;
            if (Math.sqrt(dx * dx + dy * dy) < 14) { found = i; break; }
        }
        if (found !== polyZoneHoverIdx) { polyZoneHoverIdx = found; _polyZoneUpdateLayers(); }
        map.getCanvas().style.cursor = found >= 0 ? 'grab' : 'crosshair';
    }

    function _polyZoneOnMouseUp() {
        if (!polyZoneDragging) return;
        polyZoneDragging = false; polyZoneDragIdx = -1;
        map.dragPan.enable();
        map.getCanvas().style.cursor = 'crosshair';
    }

    // ── Clock ─────────────────────────────────────────────────────────────────────
    setInterval(() => {
        const now    = new Date();
        const target = new Date(Date.UTC(2050, 0, 1, 0, 0, 0));
        document.getElementById('clock').innerText = now.toLocaleTimeString('en-GB');
        document.getElementById('date').innerText  = now.toLocaleDateString('en-GB');
        document.getElementById('days').innerText  = Math.floor((target - now) / 86400000) + ' DAYS';
    }, 1000);

    // ── Map Init ──────────────────────────────────────────────────────────────────
    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: center,
        zoom: zoom,
        attributionControl: false
    });

    new ResizeObserver(() => map.resize()).observe(document.getElementById('map'));

    // ── UI State ──────────────────────────────────────────────────────────────────
    function updateUIState(id, state, stats) {
        RUNTIME_STATE[id].status = state;
        ['lbl-', 'fs-lbl-'].forEach(prefix => {
            const span = document.getElementById(`${prefix}${id}`);
            if (span) {
                const baseText = span.getAttribute('data-base-label');
                if (stats && stats.count > 0) {
                    const mw = stats.mw >= 1000 ? `${(stats.mw / 1000).toFixed(1)}GW` : `${Math.round(stats.mw)}MW`;
                    span.innerText = `${baseText} [${stats.count} | ${mw}]`;
                } else {
                    span.innerText = `${baseText} [${state}]`;
                }
                span.style.opacity = state === 'FAIL' ? '0.5' : '1';
            }
        });
    }

    // ── Fetch Queue ───────────────────────────────────────────────────────────────
    class FetchQueue {
        constructor(concurrency) { this.concurrency = concurrency; this.active = 0; this.queue = []; }
        async add(task) {
            if (this.active >= this.concurrency) await new Promise(resolve => this.queue.push(resolve));
            this.active++;
            try { return await task(); }
            finally { this.active--; if (this.queue.length > 0) this.queue.shift()(); }
        }
    }
    const networkQueue = new FetchQueue(4);

    async function fetchWithTimeout(url, ms = 15000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), ms);
        try {
            const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
            return response;
        } catch (err) { clearTimeout(id); throw err; }
    }

    async function fetchAndParseGeoJSON(url) {
        if (urlCache[url]) return await urlCache[url];
        const promise = fetchWithTimeout(url)
            .then(res => res.json())
            .then(data => {
                if (!data || !Array.isArray(data.features)) { console.error(`[INVALID GEOJSON] ${url}`, data); return []; }
                console.log(`[DATA LOADED] ${url}: ${data.features.length} features`); return data.features;
            })
            .catch(err => { delete urlCache[url]; console.error(`[FETCH ERROR] ${url}`, err); throw err; });
        urlCache[url] = promise;
        return promise;
    }

    // ── Geometry ──────────────────────────────────────────────────────────────────
    function snapLines(features, subs) {
        if (!subs || !subs.length) return features;

        // INTENTIONAL TRADEOFF: planar squared-distance with latitude cosine correction,
        // not haversine. This is a deliberate runtime performance decision — haversine
        // inside a nested loop of ~5800 substations × all line endpoints × 5 topology
        // layers firing simultaneously on load is measurably expensive.
        // Accuracy: error is <0.1% at UK latitudes for a 100m snap tolerance.
        // This is acceptable for visual grid topology snapping.
        // TECH DEBT: move to build pipeline to remove runtime cost entirely.
        const TOLERANCE_DEG_SQ = 0.001 * 0.001; // ~111m at equator, tighter at UK latitudes
        const RAD = Math.PI / 180;

        const snapCoordinate = (coord) => {
            let best = coord, min = Infinity;
            const latCos = Math.cos(coord[1] * RAD);
            subs.forEach(s => {
                const sc = s.geometry && s.geometry.coordinates;
                if (!sc) return;
                const dx = (coord[0] - sc[0]) * latCos;
                const dy = (coord[1] - sc[1]);
                const d = dx * dx + dy * dy;
                if (d < min && d <= TOLERANCE_DEG_SQ) { min = d; best = sc; }
            });
            return best;
        };

        return features.map(f => {
            const geom = f.geometry;
            if (!geom || !geom.coordinates) return f;
            if (geom.type === 'LineString') {
                const c = [...geom.coordinates];
                if (c.length > 0) { 
                    c[0] = snapCoordinate(c[0]); 
                    c[c.length - 1] = snapCoordinate(c[c.length - 1]); 
                }
                return { ...f, geometry: { ...geom, coordinates: c } };
            }
            if (geom.type === 'MultiLineString') {
                const coords = geom.coordinates.map(line => {
                    const l = [...line];
                    if (l.length > 0) { 
                        l[0] = snapCoordinate(l[0]); 
                        l[l.length - 1] = snapCoordinate(l[l.length - 1]); 
                    }
                    return l;
                });
                return { ...f, geometry: { ...geom, coordinates: coords } };
            }
            return f;
        });
    }

    function createGeoJSONCircle(lon, lat, radiusKm, points = 64) {
        const coords = [];
        const distX = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
        const distY = radiusKm / 110.574;
        for (let i = 0; i < points; i++) {
            const theta = (i / points) * (2 * Math.PI);
            coords.push([lon + distX * Math.cos(theta), lat + distY * Math.sin(theta)]);
        }
        coords.push(coords[0]);
        return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }] };
    }

    function drawRadiusCircle(lon, lat, radiusKm) { map.getSource('src-radius-circle').setData(createGeoJSONCircle(lon, lat, radiusKm)); }
    function clearRadiusCircle() { map.getSource('src-radius-circle').setData({ type: 'FeatureCollection', features: [] }); }

    // ── PERF: Twin visible layer caches ──────────────────────────────────────────
    // _visibleInteractiveIds — used by click handler (all interactive layers)
    // _visibleHoverIds       — used by mousemove handler (currently same set, but
    //                          kept separate so purely cosmetic layers can be
    //                          excluded from hover hit-testing without touching
    //                          click logic)
    let _visibleInteractiveIds = [];
    let _visibleHoverIds = [];

    function _rebuildVisibleCache(allLayerIds) {
        _visibleInteractiveIds = allLayerIds.filter(id => {
            try { return map.getLayoutProperty(id, 'visibility') === 'visible'; }
            catch(e) { return false; }
        });
        // Hover cache currently mirrors interactive cache — line layers included.
        // Rationale: transmission line layers are clickable engineering assets and
        // users need the pointer cursor to discover them.
        // If hover lag becomes measurable with topology layers active, narrow this
        // by filtering type !== 'line' — the twin-cache structure makes that a
        // one-line change without touching click behaviour.
        _visibleHoverIds = [..._visibleInteractiveIds];
    }

    // PERF: throttle timestamp for hover hit-testing (target ~100ms cadence)
    let _lastHoverMs = 0;

    // ── Popup / Search ────────────────────────────────────────────────────────────
    function buildSearchButtons(name, capacity, tech) {
        const threshold = SEARCH_THRESHOLD[tech] !== undefined ? SEARCH_THRESHOLD[tech] : 50;
        if (capacity < threshold) return '';
        const term = TECH_TERMS.get(tech) || 'energy project';
        const q = encodeURIComponent(`${name} ${term} UK`);
        const newsUrl  = `https://news.google.com/search?q=${q}`;
        const imageUrl = `https://www.google.com/search?q=${q}&tbm=isch`;
        return `<div class="popup-search-btns">
            <a class="popup-btn popup-btn-news" href="${newsUrl}" target="_blank" rel="noopener noreferrer">📰 NEWS</a>
            <a class="popup-btn popup-btn-images" href="${imageUrl}" target="_blank" rel="noopener noreferrer">🖼 IMAGES</a>
        </div>`;
    }

    function buildSearchIndex() {
        searchIndex = allREPDFeatures
            .filter(f => f && f.properties && f.properties.name)
            .map(f => ({ feature: f, nameLower: String(f.properties.name).toLowerCase(), capacity: Number(f.properties.capacity) || 0 }));
    }

    function flyToProject(feature) {
        const [lon, lat] = feature.geometry.coordinates;
        const p = feature.properties;
        const cap = p.capacity ? `${p.capacity} MW` : '';
        const mounting = p.mounting ? ` | ${escapeHTML(p.mounting)}` : '';
        map.flyTo({ center: [lon, lat], zoom: 12, duration: 1800, essential: true });
        setTimeout(() => {
            openPopup([lon, lat], `<div style="font-family:monospace;background:#000;padding:6px">
                    <b style="color:#00ffff;font-size:13px">${escapeHTML(p.name)}</b><br>
                    <span style="color:#888">${escapeHTML(p.raw_tech || p.tech)}${mounting}</span><br>
                    <span style="color:#ffae00">${escapeHTML(cap)}</span>
                    <span style="color:#666"> | ${escapeHTML(p.status)}</span><br>
                    <span style="color:#555;font-size:10px">${escapeHTML(p.operator)}</span>
                    ${REPD_IDS.includes(p.tech) ? buildSearchButtons(p.name, parseFloat(p.capacity) || 0, p.tech) : ''}
                </div>`);
        }, 1900);
    }

    function searchProjects(query) {
        const resultsEl = document.getElementById('search-results');
        if (!query || query.length < 2) { resultsEl.style.display = 'none'; return; }
        if (!allREPDFeatures.length) {
            resultsEl.innerHTML = '<div class="search-no-results">Load a REPD layer first to enable search</div>';
            resultsEl.style.display = 'block'; return;
        }
        const q = query.toLowerCase();
        const matches = searchIndex.filter(item => item.nameLower.includes(q)).sort((a, b) => b.capacity - a.capacity).slice(0, 12).map(item => item.feature);
        if (!matches.length) { resultsEl.innerHTML = '<div class="search-no-results">No projects found</div>'; resultsEl.style.display = 'block'; return; }
        resultsEl.innerHTML = matches.map((f, i) => {
            const p   = f.properties;
            const cap = p.capacity ? ` — ${p.capacity} MW` : '';
            const col = TECH_COLOURS.get(p.tech) || '#888';
            return `<div class="search-result-item" data-idx="${i}"><b>${escapeHTML(p.name)}</b><span style="color:#555">${escapeHTML(cap)}</span><br>
                <span style="color:${col};font-size:9px">${escapeHTML(p.raw_tech || p.tech)}</span>
                <span style="color:#444;font-size:9px"> | ${escapeHTML(p.status || '')}</span></div>`;
        }).join('');
        resultsEl.querySelectorAll('.search-result-item').forEach((el, i) => {
            el.addEventListener('click', () => { flyToProject(matches[i]); resultsEl.style.display = 'none'; document.getElementById('search-input').value = matches[i].properties.name; });
        });
        resultsEl.style.display = 'block';
    }

    // ── Export ────────────────────────────────────────────────────────────────────
    function exportCSV() {
        if (!allREPDFeatures.length) { alert('Load a REPD layer first'); return; }
        const visibleTechs = REPD_IDS.filter(id => { const cb = document.querySelector(`input[data-layer-id="${id}"]`); return cb && cb.checked; });
        const rows = allREPDFeatures.filter(f => visibleTechs.includes(f.properties.tech));
        if (!rows.length) { alert('No visible REPD layers to export — tick some layers first'); return; }
        const headers = ['name','tech','raw_tech','capacity_mw','status','operator','mounting','longitude','latitude'];
        const csv = [headers.join(','), ...rows.map(f => {
            const p = f.properties; const [lon, lat] = f.geometry.coordinates;
            return [`"${(p.name||'').replace(/"/g, '""')}"`,`"${(p.tech||'').replace(/"/g, '""')}"`,`"${(p.raw_tech||'').replace(/"/g, '""')}"`,p.capacity,`"${(p.status||'').replace(/"/g, '""')}"`,`"${(p.operator||'').replace(/"/g, '""')}"`,`"${(p.mounting||'').replace(/"/g, '""')}"`,lon, lat].join(',');
        })].join('\n');
        const blob      = new Blob([csv], { type: 'text/csv' });
        const objectUrl = URL.createObjectURL(blob);
        const a         = document.createElement('a'); a.href = objectUrl; a.download = `globalgrid2050_export_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
    }

    // ── Status / Radius ───────────────────────────────────────────────────────────
    function toggleStatusMode() {
        statusMode = !statusMode;
        const btn = document.getElementById('btn-status');
        btn.classList.toggle('active', statusMode); btn.setAttribute('aria-pressed', statusMode);
        REPD_IDS.forEach(id => {
            if (!map.getLayer(`l-${id}`)) return;
            if (id === 'solar' || id === 'solar_roof') {
                if (map.getLayer(`l-${id}-glow`)) {
                    const isBaseVisible = document.querySelector(`input[data-layer-id="${id}"]`).checked;
                    map.setLayoutProperty(`l-${id}-glow`, 'visibility', statusMode ? 'none' : (isBaseVisible ? 'visible' : 'none'));
                }
            }
            if (statusMode) {
                map.setPaintProperty(`l-${id}`, 'circle-color', ['match', ['downcase', ['coalesce', ['get', 'status'], '']],
                    'operational','#00ff88','under construction','#ffcc00','awaiting construction','#ffaa00',
                    'consented','#ff8800','planning permission granted','#ff8800','planning approved','#ff8800',
                    'application submitted','#8888ff','pre-construction','#aaaaff','#444']);
            } else {
                const layer = GRID_CONFIG.flatMap(g => g.layers).find(l => l.id === id);
                if (id === 'solar_roof') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffcc00',0.99,'#ffcc00',1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400']);
                } else if (id === 'solar') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffff00',20.0,'#ffcc00',50.0,'#ffaa00',200.0,'#ff6600',500.0,'#ff2200']);
                } else {
                    map.setPaintProperty(`l-${id}`, 'circle-color', layer.color);
                }
            }
        });
    }

    function toggleRadiusMode() {
        radiusMode = !radiusMode;
        const btn = document.getElementById('btn-radius');
        btn.classList.toggle('active', radiusMode); btn.setAttribute('aria-pressed', radiusMode);
        document.getElementById('radius-popup').style.display = radiusMode ? 'block' : 'none';
        map.getCanvas().style.cursor = radiusMode ? 'crosshair' : '';
        
        if (radiusMode && measureMode) toggleMeasureMode();
        if (radiusMode && radiusAreaMode) toggleRadiusAreaMode();

        if (!radiusMode) { clearRadiusCircle(); radiusCenter = null; if (radiusMarker) { radiusMarker.remove(); radiusMarker = null; } }
    }

    function doRadiusSearch(lon, lat) {
        if (!validateRadiusInput()) return;
        const km = getRadiusValue(); radiusCenter = { lon, lat }; drawRadiusCircle(lon, lat, km);
        if (radiusMarker) radiusMarker.remove(); radiusMarker = null;
        const nearby = allREPDFeatures.filter(f => { const [flon, flat] = f.geometry.coordinates; return haversine(lon, lat, flon, flat) <= km; }).sort((a, b) => (b.properties.capacity || 0) - (a.properties.capacity || 0));
        if (!nearby.length) {
            openPopup([lon, lat], `
                <div style="font-family:monospace;background:#000;padding:8px">
                    <b style="color:#00ffff">◎ ${km}km radius active</b><br><br>
                    <span style="color:#888;font-size:10px">No REPD assets found in this area.</span><br>
                    <span style="color:#555;font-size:9px;line-height:1.6">Tick layers in the panel below<br>to explore assets within this circle.</span>
                </div>`);
            return;
        }
        const totalMW = nearby.reduce((s, f) => s + (parseFloat(f.properties.capacity) || 0), 0);
        const byTech  = {};
        nearby.forEach(f => { const t = f.properties.tech; byTech[t] = (byTech[t] || 0) + 1; });
        const techSummary = Object.entries(byTech).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span style="color:#888">${escapeHTML(t)}: ${n}</span>`).join('<br>');
        const topAssets = nearby.slice(0, 5).map(f => {
            const p = f.properties;
            return `<div style="border-top:1px solid #222;padding-top:4px;margin-top:4px">
                <b style="color:#ffcc00;font-size:11px">${escapeHTML(p.name)}</b><br>
                <span style="color:#888;font-size:10px">${escapeHTML(p.raw_tech)}</span>
                <span style="color:#ffae00;font-size:10px"> ${p.capacity || '?'} MW</span></div>`;
        }).join('');
        openPopup([lon, lat], `
            <div style="font-family:monospace;background:#000;padding:6px">
                <b style="color:#00ffff">◎ ${km}km — ${nearby.length} assets | ${totalMW.toFixed(1)} MW</b><br>
                <span style="color:#555;font-size:9px;line-height:1.8">Tick layers in the panel to explore this area</span><br><br>
                ${techSummary}${topAssets}
            </div>`);
    }

    // ── DOM Builder ───────────────────────────────────────────────────────────────
    function buildLayerRow(layer, idPrefix) {
        const label = document.createElement('label'); label.className = 'key-item';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.layerId = layer.id; input.setAttribute('data-layer-id', layer.id);
        const span = document.createElement('span'); span.id = `${idPrefix}${layer.id}`; span.setAttribute('data-base-label', layer.label); span.style.color = layer.color; span.style.fontSize = '11px';
        const existing = document.getElementById(`lbl-${layer.id}`); span.innerText = existing ? existing.innerText : `${layer.label} [WAIT]`;
        const mainCb = document.querySelector(`input[data-layer-id="${layer.id}"]`); if (mainCb) input.checked = mainCb.checked;
        label.appendChild(input); label.appendChild(document.createTextNode(' ')); label.appendChild(span);
        return label;
    }

    function buildDOM() {
        const container   = document.getElementById('scada-ui-container');
        const fsContainer = document.getElementById('fs-curtain-keys');
        container.innerHTML = ''; fsContainer.innerHTML = '';
        const fragment   = document.createDocumentFragment();
        const fsFragment = document.createDocumentFragment();

        GRID_CONFIG.forEach(group => {
            const groupDiv   = document.createElement('div'); groupDiv.className = 'key-group';
            const fsGroupDiv = document.createElement('div'); fsGroupDiv.className = 'key-group';
            groupDiv.innerHTML = fsGroupDiv.innerHTML = `<div class="key-title">${group.group}</div>`;
            group.layers.forEach(layer => {
                const label = document.createElement('label'); label.className = 'key-item';
                const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.layerId = layer.id; input.setAttribute('data-layer-id', layer.id);
                const span  = document.createElement('span'); span.id = `lbl-${layer.id}`; span.setAttribute('data-base-label', layer.label); span.style.color = layer.color; span.innerText = `${layer.label} [WAIT]`;
                label.appendChild(input); label.appendChild(document.createTextNode(' ')); label.appendChild(span);
                groupDiv.appendChild(label); fsGroupDiv.appendChild(buildLayerRow(layer, 'fs-lbl-'));
            });
            fragment.appendChild(groupDiv); fsFragment.appendChild(fsGroupDiv);
        });

        const bmHTML = `<div class="key-title">Basemap</div><label class="key-item"><input type="radio" name="bm" value="dark" checked> Dark</label><label class="key-item"><input type="radio" name="bm" value="sat"> Satellite</label>`;
        const bmGroup = document.createElement('div'); bmGroup.className = 'key-group'; bmGroup.innerHTML = bmHTML; fragment.appendChild(bmGroup);
        const fsBmGroup = document.createElement('div'); fsBmGroup.className = 'key-group'; fsBmGroup.innerHTML = bmHTML.replace(/name="bm"/g, 'name="bm-fs"'); fsFragment.appendChild(fsBmGroup);

        container.appendChild(fragment); fsContainer.appendChild(fsFragment);

        container.addEventListener('change', e => {
            if (e.target.type === 'checkbox' && e.target.dataset.layerId) {
                const layerId = e.target.dataset.layerId; const isVisible = e.target.checked;
                const fsCb = document.querySelector(`#fs-curtain-keys input[data-layer-id="${layerId}"]`); if (fsCb) fsCb.checked = isVisible;
                handleLayerToggle(layerId, isVisible);
            } else if (e.target.name === 'bm') {
                map.setLayoutProperty('l-sat', 'visibility', e.target.value === 'sat' ? 'visible' : 'none');
                const fsBm = document.querySelector(`input[name="bm-fs"][value="${e.target.value}"]`); if (fsBm) fsBm.checked = true;
            }
        });

        fsContainer.addEventListener('change', e => {
            if (e.target.type === 'checkbox' && e.target.dataset.layerId) {
                const layerId = e.target.dataset.layerId; const isVisible = e.target.checked;
                const mainCb = document.querySelector(`#scada-ui-container input[data-layer-id="${layerId}"]`); if (mainCb) mainCb.checked = isVisible;
                handleLayerToggle(layerId, isVisible);
            } else if (e.target.name === 'bm-fs') {
                map.setLayoutProperty('l-sat', 'visibility', e.target.value === 'sat' ? 'visible' : 'none');
                const mainBm = document.querySelector(`input[name="bm"][value="${e.target.value}"]`); if (mainBm) mainBm.checked = true;
            }
        });

        document.getElementById('fs-curtain-tab').addEventListener('click', toggleCurtain);

        const input = document.getElementById('search-input'); const btn = document.getElementById('search-btn'); const resultsEl = document.getElementById('search-results');
        input.addEventListener('input', () => searchProjects(input.value));
        input.addEventListener('keydown', e => { if (e.key === 'Enter') searchProjects(input.value); if (e.key === 'Escape') resultsEl.style.display = 'none'; });
        btn.addEventListener('click', () => searchProjects(input.value));
        document.getElementById('map').addEventListener('click', () => { resultsEl.style.display = 'none'; });

        document.getElementById('btn-export').addEventListener('click', exportCSV); document.getElementById('btn-status').addEventListener('click', toggleStatusMode);
        document.getElementById('btn-radius').addEventListener('click', toggleRadiusMode); document.getElementById('btn-measure').addEventListener('click', toggleMeasureMode);
        document.getElementById('btn-measure-undo').addEventListener('click', undoLastMeasurePoint);

        const radiusInput = document.getElementById('radius-input');
        if(radiusInput) {
            radiusInput.addEventListener('input', () => validateRadiusInput());
            radiusInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (validateRadiusInput() && radiusCenter) doRadiusSearch(radiusCenter.lon, radiusCenter.lat); } e.stopPropagation(); });
            radiusInput.addEventListener('blur', () => {
                const raw = parseFloat(radiusInput.value);
                if (isNaN(raw) || raw < RADIUS_MIN) radiusInput.value = RADIUS_MIN; else if (raw > RADIUS_MAX) radiusInput.value = RADIUS_MAX;
                radiusInput.classList.remove('invalid'); if (radiusCenter) doRadiusSearch(radiusCenter.lon, radiusCenter.lat);
            });
        }

        const btnRadiusArea = document.getElementById('btn-radius-area');
        if (btnRadiusArea) btnRadiusArea.addEventListener('click', toggleRadiusAreaMode);

        const btnPolyZone = document.getElementById('btn-polyzone');
        if (btnPolyZone) btnPolyZone.addEventListener('click', togglePolyZoneMode);

        const btnPolyZoneUndo = document.getElementById('btn-polyzone-undo');
        if (btnPolyZoneUndo) btnPolyZoneUndo.addEventListener('click', polyZoneUndo);

        const polyZoneRadiusInput = document.getElementById('polyzone-radius-input');
        if (polyZoneRadiusInput) {
            polyZoneRadiusInput.addEventListener('keydown', e => { e.stopPropagation(); });
            polyZoneRadiusInput.addEventListener('blur', () => {
                const raw = parseFloat(polyZoneRadiusInput.value);
                if (isNaN(raw) || raw < 0.1) polyZoneRadiusInput.value = '0.1';
                else if (raw > POLY_ZONE_MAX_KM) polyZoneRadiusInput.value = String(POLY_ZONE_MAX_KM);
                // If we haven't placed a centre yet, update the radius live
                polyZoneRadiusKm = parseFloat(polyZoneRadiusInput.value);
            });
        }

        const rAreaInput = document.getElementById('radius-area-input');
        if (rAreaInput) {
            rAreaInput.addEventListener('keydown', e => { 
                if (e.key === 'Enter') { 
                    e.preventDefault(); 
                    if (radiusAreaCenter) doRadiusAreaMeasure(radiusAreaCenter.lon, radiusAreaCenter.lat); 
                } 
                e.stopPropagation(); 
            });
            rAreaInput.addEventListener('blur', () => {
                const raw = parseFloat(rAreaInput.value);
                if (isNaN(raw) || raw <= 0) rAreaInput.value = 1; else if (raw > 160) rAreaInput.value = 160;
                rAreaInput.classList.remove('invalid'); 
                if (radiusAreaCenter) doRadiusAreaMeasure(radiusAreaCenter.lon, radiusAreaCenter.lat);
            });
        }
    }

    // ── Layer Hydration ───────────────────────────────────────────────────────────
    function handleLayerToggle(layerId, isVisible) {
        if (map.getLayer(`l-${layerId}`)) map.setLayoutProperty(`l-${layerId}`, 'visibility', isVisible ? 'visible' : 'none');
        if (map.getLayer(`l-${layerId}-glow`)) map.setLayoutProperty(`l-${layerId}-glow`, 'visibility', (isVisible && !statusMode) ? 'visible' : 'none');
        // PERF: keep both visible layer caches in sync on every toggle
        const mapId = `l-${layerId}`;
        if (isVisible) {
            if (!_visibleInteractiveIds.includes(mapId)) _visibleInteractiveIds.push(mapId);
            if (!_visibleHoverIds.includes(mapId)) _visibleHoverIds.push(mapId);
        } else {
            _visibleInteractiveIds = _visibleInteractiveIds.filter(id => id !== mapId);
            _visibleHoverIds = _visibleHoverIds.filter(id => id !== mapId);
        }
        if (isVisible) hydrateLayer(layerId);
    }

    function getLayerConfig(layerId) { return GRID_CONFIG.flatMap(g => g.layers).find(l => l.id === layerId); }

    function getSourceIdForLayer(layerId) {
        if (REPD_IDS.includes(layerId)) return 'src-repd';
        if (TRANSIT_IDS.includes(layerId)) return TRANSIT_SOURCE_MAP[layerId];
        return `src-${layerId}`;
    }

    async function hydrateLayer(layerId) {
        const state = RUNTIME_STATE[layerId];
        if (!state || state.loaded || state.loading) return;
        state.loading = true; updateUIState(layerId, 'LOAD');
        const layerConfig = getLayerConfig(layerId);
        if (!layerConfig) { updateUIState(layerId, 'FAIL'); state.loading = false; return; }

        if (TRANSIT_IDS.includes(layerId)) {
            const sourceId = TRANSIT_SOURCE_MAP[layerId];
            const siblings = TRANSIT_IDS.filter(id => TRANSIT_SOURCE_MAP[id] === sourceId && id !== layerId);
            if (siblings.some(id => RUNTIME_STATE[id] && RUNTIME_STATE[id].loaded)) { state.loaded = true; state.loading = false; updateUIState(layerId, 'OK'); return; }
        }

        await networkQueue.add(async () => {
            try {
                let features = await fetchAndParseGeoJSON(layerConfig.url);
                if (features.length === 0) { updateUIState(layerId, 'EMPTY'); state.loading = false; return; }
                if (layerConfig.isSubs) globalSubsData = features;
                if (layerConfig.snap) {
                    // ── TECH DEBT: snapLines() runs in the browser at runtime.
                    // This should be moved to the build pipeline (pre-processed GeoJSON)
                    // so the browser receives already-snapped topology.
                    // Retained here temporarily to preserve physical grid truth.
                    if (!globalSubsData) { const subsLayer = getLayerConfig('subs'); globalSubsData = await fetchAndParseGeoJSON(subsLayer.url); }
                    console.warn(`[SNAP] Runtime snapping active for "${layerId}" — ${features.length} features. Move to build pipeline when possible.`);
                    features = snapLines(features, globalSubsData);
                }
                const sourceId = getSourceIdForLayer(layerId);
                const source   = map.getSource(sourceId);
                if (!source) { console.error(`[SOURCE MISSING] ${sourceId}`); updateUIState(layerId, 'FAIL'); state.loading = false; return; }
                source.setData({ type: 'FeatureCollection', features });
                state.loaded = true; state.loading = false;

                if (REPD_IDS.includes(layerId)) {
                    allREPDFeatures = features; buildSearchIndex();
                    const stats = {};
                    features.forEach(f => { const t = f.properties.tech; if (!stats[t]) stats[t] = { count: 0, mw: 0 }; stats[t].count++; stats[t].mw += parseFloat(f.properties.capacity) || 0; });
                    REPD_IDS.forEach(id => { if (RUNTIME_STATE[id]) { RUNTIME_STATE[id].loaded = true; RUNTIME_STATE[id].loading = false; updateUIState(id, stats[id] && stats[id].count > 0 ? 'OK' : 'EMPTY', stats[id]); } });
                    if (statusMode) { toggleStatusMode(); toggleStatusMode(); }
                } else if (TRANSIT_IDS.includes(layerId)) {
                    TRANSIT_IDS.forEach(tid => { if (TRANSIT_SOURCE_MAP[tid] === TRANSIT_SOURCE_MAP[layerId] && RUNTIME_STATE[tid]) { RUNTIME_STATE[tid].loaded = true; RUNTIME_STATE[tid].loading = false; updateUIState(tid, 'OK'); } });
                } else { updateUIState(layerId, 'OK'); }
            } catch (err) { console.error(`[LAYER FAILED] ${layerId}:`, err); state.loading = false; updateUIState(layerId, 'FAIL'); }
        });
    }

    // ── Map Load ──────────────────────────────────────────────────────────────────
    map.on('load', () => {
        buildDOM();
        map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
        map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });

        map.addSource('src-radius-circle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-radius-circle-fill',   type: 'fill', source: 'src-radius-circle', paint: { 'fill-color': '#00ffff', 'fill-opacity': 0.04 } });
        map.addLayer({ id: 'l-radius-circle-stroke', type: 'line', source: 'src-radius-circle', paint: { 'line-color': '#00ffff', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } });

        map.addSource('src-radius-area', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-radius-area-fill',   type: 'fill', source: 'src-radius-area', paint: { 'fill-color': '#ff00ff', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'l-radius-area-stroke', type: 'line', source: 'src-radius-area', paint: { 'line-color': '#ff00ff', 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } });

        map.addSource('src-measure-line',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-measure-fill',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-measure-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-measure-fill',   type: 'fill',   source: 'src-measure-fill',   paint: { 'fill-color': '#ffff00', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'l-measure-line',   type: 'line',   source: 'src-measure-line',   paint: { 'line-color': '#ffff00', 'line-width': 2, 'line-dasharray': [3, 2] } });
        map.addLayer({ id: 'l-measure-points', type: 'circle', source: 'src-measure-points', paint: { 'circle-color': '#ffff00', 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000' } });

        // ── Poly Zone layers (orange accent) ──────────────────────────────────────
        map.addSource('src-polyzone-boundary', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-polyzone-centre',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-polyzone-line',     { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-polyzone-fill',     { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-polyzone-points',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        // Boundary guide circle — dashed orange
        map.addLayer({ id: 'l-polyzone-boundary-fill',   type: 'fill',   source: 'src-polyzone-boundary', paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.04 } });
        map.addLayer({ id: 'l-polyzone-boundary-stroke', type: 'line',   source: 'src-polyzone-boundary', paint: { 'line-color': '#ff6600', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [3, 3] } });
        // Centre crosshair dot
        map.addLayer({ id: 'l-polyzone-centre', type: 'circle', source: 'src-polyzone-centre', paint: { 'circle-color': '#ff6600', 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.9 } });
        // Drawn polygon
        map.addLayer({ id: 'l-polyzone-fill',   type: 'fill',   source: 'src-polyzone-fill',   paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.12 } });
        map.addLayer({ id: 'l-polyzone-line',   type: 'line',   source: 'src-polyzone-line',   paint: { 'line-color': '#ff6600', 'line-width': 2, 'line-dasharray': [4, 2] } });
        map.addLayer({ id: 'l-polyzone-points', type: 'circle', source: 'src-polyzone-points', paint: { 'circle-color': '#ff6600', 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000' } });

        const allLayerIds = [];

        GRID_CONFIG.forEach(group => {
            group.layers.forEach(layer => {
                if (REPD_IDS.includes(layer.id) || TRANSIT_IDS.includes(layer.id) || layer.id === 'ev') return;
                map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
                const layerObject = {
                    id: `l-${layer.id}`, type: layer.type === 'line' ? 'line' : 'circle', source: `src-${layer.id}`, layout: { visibility: 'none' },
                    paint: layer.type === 'line' ? { 'line-color': layer.color, 'line-width': layer.width } : { 'circle-color': layer.color, 'circle-radius': layer.radius, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' }
                };
                if (layer.filter)  layerObject.filter  = layer.filter; if (layer.minzoom) layerObject.minzoom  = layer.minzoom;
                map.addLayer(layerObject); allLayerIds.push(`l-${layer.id}`);
            });
        });

        Object.keys(TRANSIT_URLS).forEach(sourceId => { map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); });
        TRANSIT_IDS.forEach(id => {
            const layer = getLayerConfig(id);
            const layerObject = {
                id: `l-${id}`, type: 'circle', source: TRANSIT_SOURCE_MAP[id], layout: { visibility: 'none' },
                paint: { 'circle-color': layer.color, 'circle-radius': layer.radius, 'circle-stroke-width': 1, 'circle-stroke-color': '#000', 'circle-opacity': 0.9 }
            };
            if (layer.filter)  layerObject.filter  = layer.filter; if (layer.minzoom) layerObject.minzoom  = layer.minzoom;
            map.addLayer(layerObject); allLayerIds.push(`l-${id}`);
        });

        map.addSource('src-ev', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-ev', type: 'circle', source: 'src-ev', layout: { visibility: 'none' }, paint: { 'circle-color': '#00ff88', 'circle-radius': 5, 'circle-stroke-width': 1, 'circle-stroke-color': '#000', 'circle-opacity': 0.9 } });
        allLayerIds.push('l-ev');

        map.addSource('src-repd', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        REPD_IDS.forEach(id => {
            const layer = getLayerConfig(id);
            if (id === 'solar_roof') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 1.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],1.0,26,2.0,30,5.0,36,10.0,44], 'circle-opacity': 0.15, 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'solar') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 4.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],4.0,'#ffff00',20.0,'#ffaa00',50.0,'#ff4400',200.0,'#ff0000'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],4.0,22,20.0,32,50.0,44,200.0,60,500.0,80], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],4.0,0.12,20.0,0.18,50.0,0.25,200.0,0.35], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            const circlePaint = id === 'solar_roof'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffcc00',0.99,'#ffcc00',1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,7,0.5,7,0.99,8,1.0,16,2.0,18,5.0,22,10.0,28], 'circle-stroke-width': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,1,0.99,1,1.0,2], 'circle-stroke-color': '#000', 'circle-opacity': 0.9 }
                : id === 'solar'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffff00',20.0,'#ffcc00',50.0,'#ffaa00',200.0,'#ff6600',500.0,'#ff2200'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 }
                : { 'circle-color': layer.color, 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 };

            map.addLayer({ id: `l-${id}`, type: 'circle', source: 'src-repd', filter: layer.filter, layout: { visibility: 'none' }, paint: circlePaint });
            allLayerIds.push(`l-${id}`);
        });

        // ── PERF: seed the visible layer cache from actual map state after all layers are added
        _rebuildVisibleCache(allLayerIds);

        // ── Map Events ────────────────────────────────────────────────────────────

        // BUG FIX: shared deferred-click guard for measure tool.
        // 220ms timeout so dblclick can cancel before ghost vertex is committed.
        let _pendingToolClick = null;

        // Poly Zone drag — needs mousedown on canvas before map click
        map.getCanvas().addEventListener('mousedown', e => {
            if (!polyZoneMode) return;
            const lngLat = map.unproject([e.offsetX, e.offsetY]);
            _polyZoneOnMouseDown({ lngLat, preventDefault: () => e.preventDefault() });
        });

        map.on('click', e => {
            if (measureMode) {
                _pendingToolClick = setTimeout(() => {
                    _pendingToolClick = null;
                    if (!measureClosed) {
                        measurePoints.push([e.lngLat.lng, e.lngLat.lat]);
                        updateMeasureLayers();
                        updateMeasureDisplay();
                    }
                }, 220);
                return;
            }
            if (polyZoneMode) { _polyZoneOnClick(e); return; }
            if (radiusMode) { doRadiusSearch(e.lngLat.lng, e.lngLat.lat); return; }
            if (radiusAreaMode) { doRadiusAreaMeasure(e.lngLat.lng, e.lngLat.lat); return; }

            // PERF: use cached visible layer ids — no per-click property lookups
            if (!_visibleInteractiveIds.length) return;
            const features = map.queryRenderedFeatures(e.point, { layers: _visibleInteractiveIds });

            if (!features.length) return;
            const p    = features[0].properties || {}; const name = p.name || p.SiteName || p['Site Name'] || 'Unnamed Asset';

            if (p.type === 'supermarket') {
                const address = [p.street, p.city, p.postcode].filter(Boolean).join(', '); const area = p.area_m2 ? `${p.area_m2.toLocaleString()} m²` : '';
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:${p.colour || '#00ffff'};font-size:13px">${escapeHTML(p.brand || name)}</b><br>${p.name && p.name !== p.brand ? `<span style="color:#fff">${escapeHTML(p.name)}</span><br>` : ''}<span style="color:#888">${escapeHTML(address)}</span><br>${area ? `<span style="color:#ffae00">Area: ${escapeHTML(area)}</span>` : ''}</div>`); return;
            }

            if (p.type === 'elizabeth_line_station') {
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#60399E;font-size:13px">${escapeHTML(name)}</b><br><span style="color:#888">Elizabeth Line Station</span><br><span style="color:#555;font-size:10px">${escapeHTML(p.operator)}</span></div>`); return;
            }

            if (p.type === 'stadium') {
                const club = p.club ? `<span style="color:#fff">${escapeHTML(p.club)}</span><br>` : ''; const cap = p.capacity && p.capacity !== "Unknown" ? `Capacity: ${Number(p.capacity).toLocaleString()}` : 'Capacity: Unknown';
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#e5ff00;font-size:13px">${escapeHTML(name)}</b><br>${club}<span style="color:#888">${escapeHTML(p.sport)}</span><br><span style="color:#ffae00">${escapeHTML(cap)}</span></div>`); return;
            }

            const tech = p.tech || ''; const rawTech = p.raw_tech || p.type || tech; const voltage = p.voltage || ''; const capacity = parseFloat(p.capacity) || 0; const powerKw = p.power_kw || null; const connectors = p.connectors || ''; const status = p.status || ''; const operator = p.operator || ''; const mounting = p.mounting ? ` | ${escapeHTML(p.mounting)}` : ''; const capStr = capacity ? `${capacity} MW` : ''; const statusCol = STATUS_COLOURS[normalizeStatus(status)] || '#888'; const searchBtns = REPD_IDS.includes(tech) ? buildSearchButtons(name, capacity, tech) : ''; const evFields = powerKw ? `<span style="color:#00ff88;font-size:10px">${powerKw} kW</span>${connectors ? `<span style="color:#555;font-size:10px"> | ${escapeHTML(connectors)}</span>` : ''}<br>` : '';
            openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#00ffff;font-size:13px">${escapeHTML(name)}</b><br><span style="color:#888">${escapeHTML(rawTech)}${voltage ? ` | ${escapeHTML(voltage)}` : ''}${mounting}</span><br>${evFields}${capStr ? `<span style="color:#ffae00">${escapeHTML(capStr)}</span>` : ''}${status ? `<span style="color:${statusCol};font-size:10px"> ● ${escapeHTML(status)}</span>` : ''}<br>${operator ? `<span style="color:#555;font-size:10px">${escapeHTML(operator)}</span>` : ''}${searchBtns}</div>`);
        });

        map.on('dblclick', e => {
            if (_pendingToolClick) { clearTimeout(_pendingToolClick); _pendingToolClick = null; }
            if (!measureMode || measurePoints.length < 2) return;
            e.preventDefault();
            measureClosed = true;
            updateMeasureLayers();
            updateMeasureDisplay();
        });

        // Global mouseup to end poly zone drag anywhere on page
        window.addEventListener('mouseup', () => { if (polyZoneMode) _polyZoneOnMouseUp(); });

        map.on('mousemove', e => {
            // Poly zone drag takes priority
            if (polyZoneMode) { _polyZoneOnMouseMove(e); return; }

            if (measureMode || radiusMode || radiusAreaMode) { map.getCanvas().style.cursor = 'crosshair'; return; }

            // PERF: hard-exit if nothing is visible — zero query cost
            if (!_visibleHoverIds.length) { map.getCanvas().style.cursor = ''; return; }

            // PERF: throttle hover hit-testing to ~100ms cadence.
            const now = Date.now();
            if (now - _lastHoverMs < 100) return;
            _lastHoverMs = now;

            if (_lastMouseMoveRaf) return;
            _lastMouseMoveRaf = requestAnimationFrame(() => {
                _lastMouseMoveRaf = null;
                const features = map.queryRenderedFeatures(e.point, { layers: _visibleHoverIds });
                map.getCanvas().style.cursor = features.length ? 'pointer' : '';
            });
        });

        GRID_CONFIG.forEach(group => { group.layers.forEach(layer => { if (layer.preload) hydrateLayer(layer.id); }); });
    });
};
