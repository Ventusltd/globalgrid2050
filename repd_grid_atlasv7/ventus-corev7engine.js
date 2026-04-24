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

    // ── Earth model ───────────────────────────────────────────────────────────────
    const EARTH_RADIUS_KM = 6378.137;
    const MAX_RADIUS_KM   = Math.PI * EARTH_RADIUS_KM; // 20037.508 km

    // ── V5.1: Named constants ────────────────────────────────────────────────────
    const DEG_TO_RAD          = Math.PI / 180;
    const HIT_RADIUS_VERTEX_PX = 18;   
    const HIT_RADIUS_EDGE_PX   = 22;   
    const CLICK_DEBOUNCE_MS    = 220;  
    const HOVER_THROTTLE_MS    = 100;  
    const POPUP_MAX_WIDTH      = '300px';
    const ZONE_DRAW_VERTICES   = 24;   
    const ZONE_DRAW_DEFAULT_KM = 0.337; 

    function haversine(lon1, lat1, lon2, lat2) {
        const R = EARTH_RADIUS_KM, r = Math.PI / 180;
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

    const layerConfigById = new Map(
        GRID_CONFIG.flatMap(g => g.layers).map(l => [l.id, l])
    );

    // Added naei_co2 to the REPD VIP list
    const REPD_IDS    = ['solar','solar_operational','solar_roof','wind','wind_onshore_operational','wind_offshore_operational','bess','bess_operational','biomass','tidal','hydrogen','hydro','flywheel','act','geothermal','caes', 'naei_co2'];
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

    // ── ZONE DRAW STATE ───────────────────────────────────────────────────────────
    const ZONE_DRAW_MAX_KM      = MAX_RADIUS_KM;
    let zoneDrawMode      = false;
    let zoneDrawPoints    = [];   
    let zoneDrawDragging  = false;
    let zoneDrawDragIdx   = -1;
    let zoneDrawJustDragged = false;
    let _zoneDrawCollapsed = false;

    function _zoneDrawGetRadius() {
        const input = document.getElementById('zonedraw-radius-input');
        if (!input) return ZONE_DRAW_DEFAULT_KM;
        const v = parseFloat(input.value);
        if (isNaN(v) || v <= 0) return ZONE_DRAW_DEFAULT_KM;
        if (v > ZONE_DRAW_MAX_KM) return ZONE_DRAW_MAX_KM;
        return v;
    }

    function _zoneDrawCirclePoints(lon, lat, radiusKm, n) {
        const R = EARTH_RADIUS_KM, DEG = Math.PI / 180;
        const ad = radiusKm / R;
        const lat1 = lat * DEG;
        return Array.from({ length: n }, (_, i) => {
            const b = (i / n) * 2 * Math.PI;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(b));
            const lon2 = lon * DEG + Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));
            return [lon2 / DEG, lat2 / DEG];
        });
    }

    function _zoneDrawCalcArea(pts) {
        if (pts.length < 3) return { areaKm2: 0, areaHa: 0, areaAc: 0, areaMi2: 0, areaM2: 0, perimKm: 0, pitches: 0 };
        let area = 0;
        const R = EARTH_RADIUS_KM;
        for (let i = 0; i < pts.length; i++) {
            const j  = (i + 1) % pts.length;
            const xi = pts[i][0] * Math.PI / 180, yi = pts[i][1] * Math.PI / 180;
            const xj = pts[j][0] * Math.PI / 180, yj = pts[j][1] * Math.PI / 180;
            area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
        }
        const areaKm2 = Math.abs(area) * R * R / 2;
        let perimKm = 0;
        for (let i = 0; i < pts.length; i++) perimKm += haversine(pts[i][0], pts[i][1], pts[(i+1)%pts.length][0], pts[(i+1)%pts.length][1]);
        const areaM2 = areaKm2 * 1e6;
        return { areaKm2, areaHa: areaM2 / 10000, areaAc: areaM2 / 4046.85642, areaMi2: areaKm2 * 0.386102, areaM2, perimKm, pitches: areaM2 / 7140 };
    }

    function _zoneDrawUpdateLayers(dragOnly) {
        if (!map.getSource('src-zonedraw-fill')) return;
        const n = zoneDrawPoints.length;
        if (n < 3) {
            ['fill','line','points'].forEach(s => map.getSource(`src-zonedraw-${s}`).setData({ type: 'FeatureCollection', features: [] }));
            return;
        }
        const ring = [...zoneDrawPoints, zoneDrawPoints[0]];
        map.getSource('src-zonedraw-fill').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }] });
        map.getSource('src-zonedraw-line').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: ring } }] });
        if (dragOnly) {
            map.getSource('src-zonedraw-points').setData({ type: 'FeatureCollection', features:
                zoneDrawPoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }))
            });
        } else {
            const vFeatures = zoneDrawPoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }));
            const mFeatures = [];
            zoneDrawPoints.forEach((c, i) => {
                const b = zoneDrawPoints[(i + 1) % n];
                [0.33, 0.5, 0.66].forEach(t => {
                    mFeatures.push({ type: 'Feature', properties: { kind: 'mid', edgeIdx: i, t }, geometry: { type: 'Point', coordinates: [c[0]+(b[0]-c[0])*t, c[1]+(b[1]-c[1])*t] } });
                });
            });
            map.getSource('src-zonedraw-points').setData({ type: 'FeatureCollection', features: [...vFeatures, ...mFeatures] });
        }
    }

    let _zoneDrawPopupRaf = null;

    function _zoneDrawShowPopup() {
        if (zoneDrawPoints.length < 3) return;
        const { areaKm2, areaHa, areaAc, areaMi2, areaM2, perimKm, pitches } = _zoneDrawCalcArea(zoneDrawPoints);
        const centLon = zoneDrawPoints.reduce((s, p) => s + p[0], 0) / zoneDrawPoints.length;
        const centLat = zoneDrawPoints.reduce((s, p) => s + p[1], 0) / zoneDrawPoints.length;
        if (_zoneDrawCollapsed) {
            openPopup([centLon, centLat], `
                <div onclick="window._zdExpand&&window._zdExpand()" style="font-family:monospace;background:#000;padding:5px 10px;border:1px solid #ff6600;border-radius:4px;cursor:pointer;color:#ff6600;font-size:11px;white-space:nowrap;">
                    ◉ ${fmt(areaKm2,3)} km² · ⚽ ${fmt(pitches,0)} pitches &nbsp;▾
                </div>`);
            window._zdExpand = () => { _zoneDrawCollapsed = false; _zoneDrawShowPopup(); };
        } else {
            openPopup([centLon, centLat], `
                <div style="font-family:monospace;background:#000;padding:10px 12px;border:1px solid #ff6600;border-radius:4px;min-width:230px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <b style="color:#ff6600;font-size:13px;">◉ Zone Draw</b>
                        <span onclick="window._zdCollapse&&window._zdCollapse()" style="color:#555;font-size:12px;cursor:pointer;padding:0 4px;user-select:none;" title="Collapse">▴ hide</span>
                    </div>
                    <div style="color:#ffae00;font-size:13px;margin-bottom:10px;">⚽ ${fmt(pitches,1)} football pitches</div>
                    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px;">
                        <span style="color:#888;">Square Metres</span><span style="color:#fff;">${fmt(areaM2,0)}</span>
                        <span style="color:#888;">Hectares</span><span style="color:#fff;">${fmt(areaHa,2)}</span>
                        <span style="color:#888;">Acres</span><span style="color:#fff;">${fmt(areaAc,2)}</span>
                        <span style="color:#888;">Square Kilometres</span><span style="color:#fff;">${fmt(areaKm2,4)}</span>
                        <span style="color:#888;">Square Miles</span><span style="color:#fff;">${fmt(areaMi2,3)}</span>
                        <span style="color:#888;">Perimeter</span><span style="color:#fff;">${fmt(perimKm,2)} km</span>
                    </div>
                    <div style="color:#555;font-size:10px;margin-top:8px;line-height:1.4;">
                        <b style="color:#ff6600;">HOW TO USE:</b><br>
                        • <b>Drag orange dots</b> to reshape polygon<br>
                        • <b>Click light dots</b> on edges to add points<br>
                        • <b>Undo button</b> in top-left removes last point<br>
                        • <b>Click elsewhere</b> to start new zone
                    </div>
                </div>`);
            window._zdCollapse = () => { _zoneDrawCollapsed = true; _zoneDrawShowPopup(); };
        }
    }

    function _zoneDrawShowPopupDebounced() {
        if (_zoneDrawPopupRaf) return;
        _zoneDrawPopupRaf = requestAnimationFrame(() => { _zoneDrawPopupRaf = null; _zoneDrawShowPopup(); });
    }

    function _zoneDrawClear() {
        zoneDrawPoints    = [];
        zoneDrawDragging  = false;
        zoneDrawDragIdx   = -1;
        zoneDrawJustDragged = false;
        _zoneDrawCollapsed  = false;
        window._zdExpand    = null;
        window._zdCollapse  = null;
        closeActivePopup();
        _zoneDrawUpdateLayers(false);
        const el = document.getElementById('zonedraw-display');
        if (el) el.style.display = 'none';
    }

    function zoneDrawUndo() {
        if (zoneDrawPoints.length <= 3) { _zoneDrawClear(); return; }
        zoneDrawPoints.pop();
        _zoneDrawUpdateLayers(false);
        _zoneDrawShowPopup();
    }

    function toggleZoneDrawMode() {
        zoneDrawMode = !zoneDrawMode;
        const btn = document.getElementById('btn-zonedraw');
        if (btn) { btn.classList.toggle('active', zoneDrawMode); btn.setAttribute('aria-pressed', zoneDrawMode); }
        map.getCanvas().style.cursor = zoneDrawMode ? 'crosshair' : '';
        if (zoneDrawMode) {
            if (radiusMode)     toggleRadiusMode();
            if (radiusAreaMode) toggleRadiusAreaMode();
            if (measureMode)    toggleMeasureMode();
            const el = document.getElementById('zonedraw-display');
            if (el) el.style.display = 'block';
        } else {
            _zoneDrawClear();
        }
    }

    function _zoneDrawNearVertex(px) {
        for (let i = 0; i < zoneDrawPoints.length; i++) {
            const vpx = map.project(zoneDrawPoints[i]);
            const dx = px.x - vpx.x, dy = px.y - vpx.y;
            if (Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS_VERTEX_PX) return i;
        }
        return -1;
    }

    function _zoneDrawNearEdgeDot(px) {
        for (let i = 0; i < zoneDrawPoints.length; i++) {
            const j = (i + 1) % zoneDrawPoints.length;
            const a = zoneDrawPoints[i], b = zoneDrawPoints[j];
            for (const t of [0.33, 0.5, 0.66]) {
                const dot = [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
                const dpx = map.project(dot);
                const dx = px.x - dpx.x, dy = px.y - dpx.y;
                if (Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS_EDGE_PX) return { insertIdx: j, dot };
            }
        }
        return null;
    }

    function _zoneDrawOnClick(e) {
        if (zoneDrawDragging) return;
        if (zoneDrawJustDragged) { zoneDrawJustDragged = false; return; }
        const lon = e.lngLat.lng, lat = e.lngLat.lat;

        if (zoneDrawPoints.length === 0) {
            const km = _zoneDrawGetRadius();
            zoneDrawPoints = _zoneDrawCirclePoints(lon, lat, km, ZONE_DRAW_VERTICES);
            _zoneDrawCollapsed = false;

            const mpp = (km * 2000) / (window.innerWidth * 0.6);
            const lat1 = lat * Math.PI / 180;
            const targetZoom = Math.log2(156543 * Math.cos(lat1) / mpp);
            const clampedZoom = Math.max(8, Math.min(19, targetZoom));
            map.easeTo({ center: [lon, lat], zoom: clampedZoom, duration: 600 });

            _zoneDrawUpdateLayers(false); _zoneDrawShowPopup();
            return;
        }

        const px = map.project([lon, lat]);
        if (_zoneDrawNearVertex(px) >= 0) return;

        const edgeHit = _zoneDrawNearEdgeDot(px);
        if (edgeHit) {
            zoneDrawPoints.splice(edgeHit.insertIdx, 0, [edgeHit.dot[0], edgeHit.dot[1]]);
            _zoneDrawUpdateLayers(false); _zoneDrawShowPopup();
            return;
        }

        const km = _zoneDrawGetRadius();
        zoneDrawPoints = _zoneDrawCirclePoints(lon, lat, km, ZONE_DRAW_VERTICES);
        _zoneDrawCollapsed = false;
        const mpp = (km * 2000) / (window.innerWidth * 0.6);
        const lat1 = lat * Math.PI / 180;
        const targetZoom = Math.log2(156543 * Math.cos(lat1) / mpp);
        map.easeTo({ center: [lon, lat], zoom: Math.max(8, Math.min(19, targetZoom)), duration: 600 });
        _zoneDrawUpdateLayers(false); _zoneDrawShowPopup();
    }

    function _zoneDrawOnMouseDown(e) {
        if (!zoneDrawMode || zoneDrawPoints.length < 3) return;
        const px = map.project(e.lngLat);
        if (_zoneDrawNearEdgeDot(px)) return;
        const vi = _zoneDrawNearVertex(px);
        if (vi >= 0) {
            zoneDrawDragging = true; zoneDrawDragIdx = vi;
            map.dragPan.disable();
            map.getCanvas().style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    function _zoneDrawOnMouseMove(e) {
        if (!zoneDrawMode || zoneDrawPoints.length < 3) return;
        if (zoneDrawDragging && zoneDrawDragIdx >= 0) {
            zoneDrawPoints[zoneDrawDragIdx] = [e.lngLat.lng, e.lngLat.lat];
            _zoneDrawUpdateLayers(true);
            _zoneDrawShowPopupDebounced();
            return;
        }
        const px = map.project(e.lngLat);
        const vi = _zoneDrawNearVertex(px);
        const edgeHit = vi < 0 ? _zoneDrawNearEdgeDot(px) : null;
        map.getCanvas().style.cursor = vi >= 0 ? 'grab' : (edgeHit ? 'copy' : 'crosshair');
    }

    function _zoneDrawOnMouseUp() {
        if (!zoneDrawDragging) return;
        zoneDrawDragging    = false;
        zoneDrawDragIdx     = -1;
        zoneDrawJustDragged = true;
        map.dragPan.enable();
        map.getCanvas().style.cursor = 'crosshair';
        _zoneDrawUpdateLayers(false);
        _zoneDrawShowPopup();
        setTimeout(() => { zoneDrawJustDragged = false; }, 50);
    }


    const urlCache = {};
    let globalSubsData  = null;
    let allREPDFeatures = [];
    let searchIndex     = [];

    // ── Single popup instance — prevents accumulation ────────────────────────────
    let activePopup = null;
    function openPopup(lngLat, html, maxWidth) {
        if (activePopup) { activePopup.remove(); activePopup = null; }
        activePopup = new maplibregl.Popup({ maxWidth: maxWidth || POPUP_MAX_WIDTH })
            .setLngLat(lngLat)
            .setHTML(html)
            .addTo(map);
        activePopup.on('close', () => { activePopup = null; });
        return activePopup;
    }
    function closeActivePopup() {
        if (activePopup) { activePopup.remove(); activePopup = null; }
    }
    window._closePopupKeepShape = () => closeActivePopup();

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
    const RADIUS_MAX = MAX_RADIUS_KM; 

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
            const R = EARTH_RADIUS_KM;
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
            if (zoneDrawMode) toggleZoneDrawMode();
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
        if (radiusAreaMode && zoneDrawMode) toggleZoneDrawMode();
        
        if (!radiusAreaMode) { 
            if(map.getSource('src-radius-area')) {
                map.getSource('src-radius-area').setData({ type: 'FeatureCollection', features: [] });
            }
            radiusAreaCenter = null; 
            if (radiusAreaMarker) { radiusAreaMarker.remove(); radiusAreaMarker = null; }
            closeActivePopup();
        }
    }

    function doRadiusAreaMeasure(lon, lat) {
        const input = document.getElementById('radius-area-input');
        if(!input) return;
        const km = parseFloat(input.value);
        if (isNaN(km) || km <= 0 || km > MAX_RADIUS_KM) {
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
        const R = EARTH_RADIUS_KM;
        const areaKm2  = 2 * Math.PI * R * R * (1 - Math.cos(km / R));
        const areaM2   = areaKm2 * 1000000;
        const areaHa   = areaM2 / 10000;
        const areaAc   = areaM2 / 4046.85642;
        const areaMi2  = areaKm2 * 0.386102;
        const pitches  = areaM2 / 7140;

        openPopup([lon, lat], `
            <div style="font-family:monospace;background:#000;padding:10px 12px;border:1px solid #ff00ff;border-radius:4px;min-width:220px;position:relative;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <b style="color:#ff00ff;font-size:13px;">◵ ${km}km radius</b>
                    <span onclick="window._closePopupKeepShape()" style="color:#555;font-size:14px;cursor:pointer;line-height:1;padding:0 2px;user-select:none;" title="Close popup, keep circle">✕</span>
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
                    let unitStr = '';
                    if (id === 'naei_co2') {
                        unitStr = `${fmt(stats.mw, 0)} tCO₂e`;
                    } else {
                        unitStr = stats.mw >= 1000 ? `${(stats.mw / 1000).toFixed(1)}GW` : `${Math.round(stats.mw)}MW`;
                    }
                    span.innerText = `${baseText} [${stats.count} | ${unitStr}]`;
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

        const TOLERANCE_DEG_SQ = 0.001 * 0.001; 
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

    function createGeoJSONCircle(lon, lat, radiusKm) {
        const points = radiusKm > 5000 ? 128 : radiusKm > 500 ? 96 : 64;
        const R = EARTH_RADIUS_KM, DEG = Math.PI / 180;
        const ad = radiusKm / R;
        const lat1 = lat * DEG;
        const coords = Array.from({ length: points }, (_, i) => {
            const b = (i / points) * 2 * Math.PI;
            const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(b));
            const lon2 = lon * DEG + Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));
            return [lon2 / DEG, lat2 / DEG];
        });
        coords.push(coords[0]);
        return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }] };
    }

    function drawRadiusCircle(lon, lat, radiusKm) { map.getSource('src-radius-circle').setData(createGeoJSONCircle(lon, lat, radiusKm)); }
    function clearRadiusCircle() { map.getSource('src-radius-circle').setData({ type: 'FeatureCollection', features: [] }); }

    let _visibleInteractiveIds = [];
    let _visibleHoverIds = [];

    function _rebuildVisibleCache(allLayerIds) {
        _visibleInteractiveIds = allLayerIds.filter(id => {
            try { return map.getLayoutProperty(id, 'visibility') === 'visible'; }
            catch(e) { return false; }
        });
        _visibleHoverIds = [..._visibleInteractiveIds];
    }

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
        const mounting = (p.mounting && p.mounting !== 'nan') ? ` | ${escapeHTML(p.mounting)}` : '';
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
            if (id === 'solar' || id === 'solar_roof' || id === 'naei_co2') {
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
                const layer = layerConfigById.get(id);
                if (id === 'solar_roof') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffcc00',0.99,'#ffcc00',1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400']);
                } else if (id === 'solar') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffff00',20.0,'#ffcc00',50.0,'#ffaa00',200.0,'#ff6600',500.0,'#ff2200']);
                } else if (id === 'naei_co2') {
                    map.setPaintProperty(`l-${id}`, 'circle-color', ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,'#ffcc00',50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000']);
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
        if (radiusMode && zoneDrawMode) toggleZoneDrawMode();

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

        const btnZoneDraw = document.getElementById('btn-zonedraw');
        if (btnZoneDraw) btnZoneDraw.addEventListener('click', toggleZoneDrawMode);

        const btnZoneDrawUndo = document.getElementById('btn-zonedraw-undo');
        if (btnZoneDrawUndo) btnZoneDrawUndo.addEventListener('click', zoneDrawUndo);

        const zdRadiusInput = document.getElementById('zonedraw-radius-input');
        if (zdRadiusInput) {
            zdRadiusInput.addEventListener('keydown', e => { e.stopPropagation(); });
            zdRadiusInput.addEventListener('blur', () => {
                const raw = parseFloat(zdRadiusInput.value);
                if (isNaN(raw) || raw <= 0) zdRadiusInput.value = String(ZONE_DRAW_DEFAULT_KM);
                else if (raw > ZONE_DRAW_MAX_KM) zdRadiusInput.value = String(ZONE_DRAW_MAX_KM);
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
                if (isNaN(raw) || raw <= 0) rAreaInput.value = 1; else if (raw > MAX_RADIUS_KM) rAreaInput.value = MAX_RADIUS_KM;
                rAreaInput.classList.remove('invalid'); 
                if (radiusAreaCenter) doRadiusAreaMeasure(radiusAreaCenter.lon, radiusAreaCenter.lat);
            });
        }
    }

    // ── Layer Hydration ───────────────────────────────────────────────────────────
    function handleLayerToggle(layerId, isVisible) {
        if (map.getLayer(`l-${layerId}`)) map.setLayoutProperty(`l-${layerId}`, 'visibility', isVisible ? 'visible' : 'none');
        if (map.getLayer(`l-${layerId}-glow`)) map.setLayoutProperty(`l-${layerId}-glow`, 'visibility', (isVisible && !statusMode) ? 'visible' : 'none');
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

    function getLayerConfig(layerId) { return layerConfigById.get(layerId); }

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
                    function evalFilter(filter, props) {
                        if (!filter) return true;
                        const op = filter[0];
                        if (op === '==') { const v = filter[1][0] === 'get' ? props[filter[1][1]] : null; return String(v).toLowerCase() === String(filter[2]).toLowerCase(); }
                        if (op === 'all') { return filter.slice(1).every(f => evalFilter(f, props)); }
                        if (op === '>=') { const v = filter[1][0] === 'coalesce' ? (parseFloat(props[filter[1][1][1]]) || 0) : 0; return v >= filter[2]; }
                        return true;
                    }
                    REPD_IDS.forEach(id => {
                        if (!RUNTIME_STATE[id]) return;
                        RUNTIME_STATE[id].loaded = true; RUNTIME_STATE[id].loading = false;
                        const lCfg = getLayerConfig(id);
                        const filtered = lCfg && lCfg.filter ? features.filter(f => evalFilter(lCfg.filter, f.properties)) : features.filter(f => f.properties.tech === id);
                        const idStats = filtered.reduce((acc, f) => { 
                            acc.count++; 
                            acc.mw += parseFloat(f.properties.capacity) || parseFloat(f.properties.emission_tco2e) || 0; 
                            return acc; 
                        }, { count: 0, mw: 0 });
                        updateUIState(id, idStats.count > 0 ? 'OK' : 'EMPTY', idStats.count > 0 ? idStats : null);
                    });
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

        // ── Zone Draw layers (orange accent) ──────────────────────────────────────
        map.addSource('src-zonedraw-fill',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-zonedraw-line',   { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource('src-zonedraw-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'l-zonedraw-fill',   type: 'fill',   source: 'src-zonedraw-fill',   paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.18 } });
        map.addLayer({ id: 'l-zonedraw-line',   type: 'line',   source: 'src-zonedraw-line',   paint: { 'line-color': '#ff6600', 'line-width': 3, 'line-dasharray': [4, 2] } });
        map.addLayer({ id: 'l-zonedraw-points', type: 'circle', source: 'src-zonedraw-points', paint: {
            'circle-color':   ['case', ['==', ['get', 'kind'], 'vertex'], '#ff6600', '#ffaa44'],
            'circle-radius':  ['case', ['==', ['get', 'kind'], 'vertex'], 9, 6],
            'circle-stroke-width': 2, 'circle-stroke-color': '#000',
            'circle-opacity': ['case', ['==', ['get', 'kind'], 'vertex'], 1, 0.85]
        } });

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
            if (id === 'solar_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#00ff88',50.0,'#00cc66',200.0,'#009944',350.0,'#006622'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,28,50.0,36,200.0,56,350.0,70,500.0,88], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'bess_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#ffb3d9',50.0,'#ff69b4',200.0,'#ff1493',350.0,'#cc0066'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,24,50.0,32,200.0,50,350.0,62,500.0,78], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'wind_onshore_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#99ffee',50.0,'#00ffcc',200.0,'#00ccaa',350.0,'#008877'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,24,50.0,32,200.0,50,350.0,62,500.0,78], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'wind_offshore_operational') {
                map.addLayer({ id: `l-${id}-glow`, type: 'circle', source: 'src-repd', filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'capacity'], 0], 10.0]], layout: { visibility: 'none' }, paint: { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,'#99ccff',50.0,'#3399ff',200.0,'#0055dd',350.0,'#003399'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,24,50.0,32,200.0,50,350.0,62,500.0,78], 'circle-opacity': ['interpolate',['linear'],['coalesce',['get','capacity'],0],10.0,0.15,50.0,0.22,200.0,0.30,350.0,0.38], 'circle-blur': 1.0, 'circle-stroke-width': 0 } });
            }
            if (id === 'naei_co2') {
                map.addLayer({ 
                    id: `l-${id}-glow`, 
                    type: 'circle', 
                    source: 'src-repd', 
                    filter: ['all', layer.filter, ['>=', ['coalesce', ['get', 'emission_tco2e'], 0], 50000]], 
                    layout: { visibility: 'none' }, 
                    paint: { 
                        'circle-color': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000'], 
                        'circle-radius': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,20,200000,40,1000000,60,5000000,90], 
                        'circle-opacity': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,0.15,200000,0.25,1000000,0.35], 
                        'circle-blur': 1.0, 
                        'circle-stroke-width': 0 
                    } 
                });
            }
            const circlePaint = id === 'solar_roof'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffcc00',0.99,'#ffcc00',1.0,'#ff8c00',5.0,'#ff6600',10.0,'#ff4400'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,7,0.5,7,0.99,8,1.0,16,2.0,18,5.0,22,10.0,28], 'circle-stroke-width': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,1,0.99,1,1.0,2], 'circle-stroke-color': '#000', 'circle-opacity': 0.9 }
                : id === 'solar'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffff00',20.0,'#ffcc00',50.0,'#ffaa00',200.0,'#ff6600',500.0,'#ff2200'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 }
                : id === 'solar_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#66ff99',10,'#33ff77',50,'#00dd55',100,'#00bb44',200,'#008833',350,'#006622',500,'#004411'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,10,10,14,50,18,100,22,200,28,350,35,500,42], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'bess_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ffccee',10,'#ffb3d9',50,'#ff69b4',100,'#ff1493',200,'#dd0077',350,'#990066',500,'#660044'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,12,50,16,100,20,200,26,350,32,500,38], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'wind_onshore_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#ccfff5',10,'#99ffee',50,'#00ffcc',100,'#00ddaa',200,'#00aa88',350,'#007766',500,'#004433'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,12,50,16,100,20,200,26,350,32,500,38], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'wind_offshore_operational'
                ? { 'circle-color': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,'#cce5ff',10,'#99ccff',50,'#3399ff',100,'#0066ee',200,'#0044bb',350,'#003399',500,'#001166'], 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,12,50,16,100,20,200,26,350,32,500,38], 'circle-stroke-width': 2, 'circle-stroke-color': '#000', 'circle-opacity': 0.90 }
                : id === 'naei_co2'
                ? { 
                    'circle-color': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,'#ffcc00',50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000'], 
                    'circle-radius': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,6,50000,10,200000,14,1000000,20,5000000,28], 
                    'circle-stroke-width': 1.5, 
                    'circle-stroke-color': '#000', 
                    'circle-opacity': 0.85 
                }
                : { 'circle-color': layer.color, 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 };

            map.addLayer({ id: `l-${id}`, type: 'circle', source: 'src-repd', filter: layer.filter, layout: { visibility: 'none' }, paint: circlePaint });
            allLayerIds.push(`l-${id}`);
        });

        // ── PERF: seed the visible layer cache from actual map state after all layers are added
        _rebuildVisibleCache(allLayerIds);

        // ── Map Events ────────────────────────────────────────────────────────────

        let _pendingToolClick = null;

        map.getCanvas().addEventListener('mousedown', e => {
            if (!zoneDrawMode) return;
            const lngLat = map.unproject([e.offsetX, e.offsetY]);
            _zoneDrawOnMouseDown({ lngLat, preventDefault: () => e.preventDefault() });
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
                }, CLICK_DEBOUNCE_MS);
                return;
            }
            if (zoneDrawMode) { _zoneDrawOnClick(e); return; }
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

            if (p.type === 'naei_emitter') {
                const tonnes = p.emission_tco2e ? Number(p.emission_tco2e).toLocaleString('en-GB', { maximumFractionDigits: 0 }) : 'Unknown';
                const dataLabel = p.datatype === 'O' ? 'Self-reported by the company' : p.datatype === 'M' ? 'Estimated by the government' : 'Official figures';
                openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:8px 10px;border:1px solid #ff4400;border-radius:4px;min-width:220px;max-width:280px"><b style="color:#ff4400;font-size:13px">🏭 ${escapeHTML(name)}</b><br><span style="color:#888;font-size:10px">Run by: ${escapeHTML(p.operator || 'Unknown')}</span><br><span style="color:#aaa;font-size:10px">Industry: ${escapeHTML(p.sector || 'Unknown')}</span><br><span style="color:#aaa;font-size:10px">Country: ${escapeHTML(p.country || 'UK')}</span><br><br><span style="color:#ff4400;font-size:12px">Greenhouse gases pumped into the air in 2023:</span><br><b style="color:#fff;font-size:13px">${tonnes} tonnes</b><br><span style="color:#555;font-size:9px">Carbon dioxide and nitrous oxide combined — measured in CO₂ equivalent tonnes</span><br><br><span style="color:#444;font-size:9px">${escapeHTML(dataLabel)} · UK Government emissions database</span></div>`); return;
            }

            const tech = p.tech || ''; const rawTech = p.raw_tech || p.type || tech; const voltage = p.voltage || ''; const capacity = parseFloat(p.capacity) || 0; const powerKw = p.power_kw || null; const connectors = p.connectors || ''; const status = p.status || ''; const operator = p.operator || ''; const mounting = (p.mounting && p.mounting !== 'nan') ? ` | ${escapeHTML(p.mounting)}` : ''; const capStr = capacity ? `${capacity} MW` : ''; const statusCol = STATUS_COLOURS[normalizeStatus(status)] || '#888'; const searchBtns = REPD_IDS.includes(tech) ? buildSearchButtons(name, capacity, tech) : ''; const evFields = powerKw ? `<span style="color:#00ff88;font-size:10px">${powerKw} kW</span>${connectors ? `<span style="color:#555;font-size:10px"> | ${escapeHTML(connectors)}</span>` : ''}<br>` : '';
            openPopup(e.lngLat, `<div style="font-family:monospace;background:#000;padding:6px"><b style="color:#00ffff;font-size:13px">${escapeHTML(name)}</b><br><span style="color:#888">${escapeHTML(rawTech)}${voltage ? ` | ${escapeHTML(voltage)}` : ''}${mounting}</span><br>${evFields}${capStr ? `<span style="color:#ffae00">${escapeHTML(capStr)}</span>` : ''}${status ? `<span style="color:${statusCol};font-size:10px"> ● ${escapeHTML(status)}</span>` : ''}<br>${operator ? `<span style="color:#555;font-size:10px">${escapeHTML(operator)}</span>` : ''}${searchBtns}</div>`);
        });

        map.on('dblclick', e => {
            if (_pendingToolClick) { clearTimeout(_pendingToolClick); _pendingToolClick = null; }
            if (zoneDrawMode) { e.preventDefault(); return; }
            if (!measureMode || measurePoints.length < 2) return;
            e.preventDefault();
            measureClosed = true;
            updateMeasureLayers();
            updateMeasureDisplay();
        });

        window.addEventListener('mouseup', () => { if (zoneDrawMode) _zoneDrawOnMouseUp(); });

        map.on('mousemove', e => {
            if (zoneDrawMode) { _zoneDrawOnMouseMove(e); return; }

            if (measureMode || radiusMode || radiusAreaMode) { map.getCanvas().style.cursor = 'crosshair'; return; }

            if (!_visibleHoverIds.length) { map.getCanvas().style.cursor = ''; return; }

            const now = Date.now();
            if (now - _lastHoverMs < HOVER_THROTTLE_MS) return;
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
