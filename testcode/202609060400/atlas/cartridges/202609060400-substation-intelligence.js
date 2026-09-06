/* 202609060400; source and token/AST compaction receipts in source-provenance.json. */

'use strict';
'use strict';
'use strict';
'use strict';
'use strict';
'use strict';
'use strict';
'use strict';
'use strict';
'use strict';
(() => {
const registry = window.__GRIDATLAS_MODULES__ ||= {};
let state = null;
function close() {
if (!state) return;
const {map, host, rail, control, marker, style} = state;
state = null;
marker.replaceWith(control);
rail.remove(); style.remove();
host.removeAttribute('data-measurement-dock');
document.body.removeAttribute('data-measurement-dock');
map.resize();
}
function open(map, controlId) {
if (state?.control.id === controlId) return;
close();
const canvas = map.getContainer();
const host = canvas.parentElement;
const control = document.getElementById(controlId);
if (!control || !host) throw Error('Measurement dock requires its existing control and map host');
const marker = document.createComment('measurement control home');
control.before(marker);
const rail = document.createElement('aside');
rail.id = 'gridatlas-measurement-dock';
rail.setAttribute('aria-label', 'Shape measurements and controls');
const controls = document.createElement('div');
controls.className = 'measurement-dock-controls';
controls.append(control);
const values = document.createElement('div');
values.className = 'measurement-dock-values';
rail.append(controls, values);
const style = document.createElement('style');
style.textContent = `
#map-container[data-measurement-dock] #map{width:calc(100% - 280px)!important;margin-left:280px!important}
#gridatlas-measurement-dock{position:absolute;left:0;top:64px;bottom:0;width:280px;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background:#080b10;border-right:1px solid #58646d;color:#fff;z-index:1100;padding:10px;font:12px/1.4 ui-monospace,monospace}
#gridatlas-measurement-dock .radius-popup{position:static!important;transform:none!important;margin:0 0 10px!important;width:auto!important;min-width:0!important;max-width:100%!important;box-sizing:border-box}
#gridatlas-measurement-dock .measurement-dock-values>div{min-width:0!important;box-sizing:border-box;max-width:100%}
#gridatlas-measurement-dock button,#gridatlas-measurement-dock input{min-height:36px}
body[data-measurement-dock] #codex-tool-layers{visibility:hidden!important;pointer-events:none!important}
@media(max-width:700px){
 #map-container[data-measurement-dock] #map{width:100%!important;margin-left:0!important;height:calc(100% - min(240px,38dvh))!important}
 #gridatlas-measurement-dock{top:auto;right:0;width:100%;height:min(240px,38dvh);border-right:0;border-top:1px solid #58646d;padding:8px 12px;display:grid;grid-template-columns:minmax(110px,0.8fr) minmax(180px,1.4fr);gap:8px;z-index:1100}
 #gridatlas-measurement-dock .measurement-dock-values>div{padding:6px!important}
 #gridatlas-measurement-dock .radius-popup{padding:6px!important}
 #gridatlas-measurement-dock .radius-input-row{flex-wrap:wrap}
}
@media(max-width:350px){#gridatlas-measurement-dock{grid-template-columns:1fr}}
`;
document.head.append(style);
host.append(rail);
host.setAttribute('data-measurement-dock', controlId);
document.body.setAttribute('data-measurement-dock', controlId);
state = {map, host, rail, control, marker, style, values};
map.resize();
}
function show(html) {
if (!state) throw Error('Open measurement controls before showing results');
const scroll = state.rail.scrollTop;
state.values.innerHTML = html;
state.rail.scrollTop = scroll;
}
function clearValues() {if (state) state.values.replaceChildren();}
const draftKey = 'gridatlas.polygon-draft.v1';
function validOutline(points) {
return Array.isArray(points) && points.length >= 3 && points.length <= 4096 && points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 85.051129);
}
function saveOutline(points) {
try {
if (!validOutline(points)) return {saved:false, message:'Outline cannot be saved: invalid coordinates.'};
localStorage.setItem(draftKey, JSON.stringify({schema:draftKey, points, savedAt:new Date().toISOString()}));
return {saved:true, message:'Saved on this browser'};
} catch { return {saved:false, message:'Browser storage unavailable; keep this tab open.'}; }
}
function readOutline() {
try {
const text = localStorage.getItem(draftKey);
if (!text || text.length > 250000) return null;
const draft = JSON.parse(text);
return draft.schema === draftKey && validOutline(draft.points) ? draft.points.map(point => point.slice()) : null;
} catch { return null; }
}
function clearOutline() {
try {localStorage.removeItem(draftKey);return {saved:true,message:'Polygon reset'};}
catch {return {saved:false,message:'Polygon reset here; browser storage could not be cleared.'};}
}
function exportOutline(points, measurements) {
if (!validOutline(points)) throw Error('Draw a valid polygon before saving a file.');
const ring = points.map(point => point.slice());
const winding = ring.reduce((sum,point,i) => {const next=ring[(i+1)%ring.length];return sum+point[0]*next[1]-next[0]*point[1];},0);
if (winding < 0) ring.reverse();
ring.push(ring[0].slice());
const properties = {name:'GridAtlas drawn polygon', source:'User-drawn outline', coordinate_reference:'WGS84 longitude, latitude', boundary:'Screening outline only; not a surveyed boundary or connection offer.'};
for (const [key,value] of Object.entries(measurements || {})) if (['area_m2','area_ha','perimeter_km'].includes(key) && Number.isFinite(value) && value >= 0) properties[key]=value;
return {type:'FeatureCollection',features:[{type:'Feature',properties,geometry:{type:'Polygon',coordinates:[ring]}}]};
}
function importOutline(text) {
if (typeof text !== 'string' || text.length > 250000) throw Error('Choose a GeoJSON file under 250 KB.');
let data;
try {data=JSON.parse(text);} catch {throw Error('The file is not valid JSON. Your current polygon is unchanged.');}
if (data?.type === 'FeatureCollection') {
if (!Array.isArray(data.features) || data.features.length !== 1) throw Error('Choose a file containing exactly one polygon.');
data=data.features[0];
}
if (data?.type === 'Feature') data=data.geometry;
if (data?.type !== 'Polygon' || !Array.isArray(data.coordinates) || data.coordinates.length !== 1) throw Error('Choose one Polygon without holes; other geometries are not flattened.');
const ring=data.coordinates[0];
if (!Array.isArray(ring) || ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) throw Error('The polygon ring must be closed.');
const points=ring.slice(0,-1);
if (!validOutline(points) || new Set(points.map(point=>JSON.stringify(point))).size < 3) throw Error('Polygon coordinates must be valid WGS84 longitude/latitude pairs, with 3 to 4096 vertices.');
return points.map(point=>point.slice());
}
registry.polygonFiles = Object.freeze({schema:'gridatlas.polygon-files.v1',exportOutline,importOutline});
function createHistory(limit=80) {
let states=[[]],position=0;
const copy=points=>points.map(point=>point.slice());
return Object.freeze({
commit(points) {
if (JSON.stringify(states[position])===JSON.stringify(points)) return;
states=states.slice(0,position+1);states.push(copy(points));
if(states.length>limit)states.shift();position=states.length-1;
},
undo() {if(position===0)return null;return copy(states[--position]);},
redo() {if(position===states.length-1)return null;return copy(states[++position]);},
get canUndo(){return position>0;},get canRedo(){return position<states.length-1;}
});
}
registry.polygonHistory = Object.freeze({createHistory});
registry.polygonDraft = Object.freeze({schema:draftKey,validOutline,saveOutline,readOutline,clearOutline});
registry.measurementDock = Object.freeze({schema:'gridatlas.measurement-dock.v1',open,show,close,clearValues});
})();
'use strict';
window.initVentusMap = function({ config, center, zoom }) {
if (typeof maplibregl === 'undefined') {
document.getElementById('fatal-banner').style.display = 'block';
throw new Error('CRITICAL: MapLibre failed to load.');
}
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
const measurementDock = window.__GRIDATLAS_MODULES__?.measurementDock;
if (!measurementDock) throw Error('Measurement dock module missing');
const EARTH_RADIUS_KM = 6378.137;
const MAX_RADIUS_KM = Math.PI * EARTH_RADIUS_KM;
const DEG_TO_RAD = Math.PI / 180;
const HIT_RADIUS_VERTEX_PX = 22;
const HIT_RADIUS_EDGE_PX = 16;
const EDGE_DOT_CLEARANCE_PX = 10;
const CLICK_DEBOUNCE_MS = 220;
const HOVER_THROTTLE_MS = 100;
const POPUP_MAX_WIDTH = '300px';
const ZONE_DRAW_VERTICES = 24;
const ZONE_DRAW_DEFAULT_KM = 0.337;
function haversine(lon1, lat1, lon2, lat2) {
const R = EARTH_RADIUS_KM, r = Math.PI / 180;
const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
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
const REPD_IDS = ['solar','solar_operational','solar_roof','wind','wind_onshore_operational','wind_offshore_operational','bess','bess_operational','biomass','tidal','hydrogen','hydro','flywheel','act','geothermal','caes'];
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
let statusMode = false;
let radiusMode = false;
let radiusMarker = null;
let radiusCenter = null;
let radiusAreaMode = false;
let radiusAreaMarker = null;
let radiusAreaCenter = null;
const ZONE_DRAW_MAX_KM = MAX_RADIUS_KM;
let zoneDrawMode = false;
let zoneDrawLocked = false;
let zoneDrawPoints = [];
let zoneDrawDragging = false;
let zoneDrawDragIdx = -1;
let zoneDrawJustDragged = false;
let _zoneDrawCollapsed = false;
const zoneHistory = window.__GRIDATLAS_MODULES__.polygonHistory.createHistory();
let zoneHistoryApplying = false;
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
const j = (i + 1) % pts.length;
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
function _zoneDrawStorageStatus(result) {
let status = document.getElementById('zonedraw-storage-status');
if (!status) {
status = document.createElement('div'); status.id = 'zonedraw-storage-status';
status.setAttribute('role','status'); status.style.cssText = 'font-size:10px;margin-top:8px;color:#cbd5e1';
document.getElementById('zonedraw-display')?.append(status);
}
status.textContent = result.message;
}
function _zoneDrawRefreshEditor() {
const select=document.getElementById('zonedraw-vertex');if(!select)return;
const previous=Math.min(Number(select.value)||0,Math.max(0,zoneDrawPoints.length-1));
if(select.options.length!==zoneDrawPoints.length){select.replaceChildren();zoneDrawPoints.forEach((_,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent='Vertex '+(i+1);select.append(option);});}
select.value=String(previous);const point=zoneDrawPoints[previous];
const lon=document.getElementById('zonedraw-longitude'),lat=document.getElementById('zonedraw-latitude');
lon.value=point?String(point[0]):'';lat.value=point?String(point[1]):'';
for(const control of [select,lon,lat,document.getElementById('btn-zonedraw-coordinate')])control.disabled=zoneDrawLocked||zoneDrawPoints.length<3;
}
function _zoneDrawUpdateLayers(dragOnly, renderOnly = false) {
if(!dragOnly && !renderOnly)_zoneDrawRefreshEditor();
if (!dragOnly && !renderOnly) {
if (!zoneHistoryApplying) zoneHistory.commit(zoneDrawPoints);
const undo=document.getElementById('btn-zonedraw-undo'),redo=document.getElementById('btn-zonedraw-redo');
if(undo)undo.disabled=!zoneHistory.canUndo;if(redo)redo.disabled=!zoneHistory.canRedo;
}
const csvButton=document.getElementById('btn-zonedraw-csv');if(csvButton)csvButton.disabled=zoneDrawPoints.length<3;
const fitButton=document.getElementById('btn-zonedraw-fit');if(fitButton)fitButton.disabled=zoneDrawPoints.length<3;
const exportButton = document.getElementById('btn-zonedraw-export');
if (exportButton) exportButton.disabled = zoneDrawPoints.length < 3;
if (!dragOnly && !renderOnly && zoneDrawPoints.length >= 3) _zoneDrawStorageStatus(window.__GRIDATLAS_MODULES__.polygonDraft.saveOutline(zoneDrawPoints));
if (!map.getSource('src-zonedraw-fill')) return;
const n = zoneDrawPoints.length;
if (n < 3) {
['fill','line','points'].forEach(s => map.getSource(`src-zonedraw-${s}`).setData({ type: 'FeatureCollection', features: [] }));
return;
}
const ring = [...zoneDrawPoints, zoneDrawPoints[0]];
map.getSource('src-zonedraw-fill').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }] });
map.getSource('src-zonedraw-line').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: ring } }] });
if (zoneDrawLocked) {map.getSource('src-zonedraw-points').setData({type:'FeatureCollection',features:[]});return;}
if (dragOnly) {
map.getSource('src-zonedraw-points').setData({ type: 'FeatureCollection', features:
zoneDrawPoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }))
});
} else {
const vFeatures = zoneDrawPoints.map((c, i) => ({ type: 'Feature', properties: { kind: 'vertex', idx: i }, geometry: { type: 'Point', coordinates: c } }));
const mFeatures = [];
zoneDrawPoints.forEach((c, i) => {
_zoneDrawEdgeDots(i).forEach(d => {
mFeatures.push({ type: 'Feature', properties: { kind: 'mid', edgeIdx: i, t: d.t }, geometry: { type: 'Point', coordinates: d.dot } });
});
});
map.getSource('src-zonedraw-points').setData({ type: 'FeatureCollection', features: [...vFeatures, ...mFeatures] });
}
}
let _zoneDrawPopupRaf = null;
function _zoneDrawShowPopup() {
if (zoneDrawPoints.length < 3) return;
const { areaKm2, areaHa, areaAc, areaMi2, areaM2, perimKm, pitches } = _zoneDrawCalcArea(zoneDrawPoints);
if (_zoneDrawCollapsed) {
measurementDock.show( `
                <div onclick="window._zdExpand&&window._zdExpand()" style="font-family:monospace;background:#000;padding:5px 10px;border:1px solid #ff6600;border-radius:4px;cursor:pointer;color:#ff6600;font-size:11px;white-space:nowrap;">
                    ◉ ${fmt(areaKm2,3)} km² · ⚽ ${fmt(pitches,0)} pitches &nbsp;▾
                </div>`);
window._zdExpand = () => { _zoneDrawCollapsed = false; _zoneDrawShowPopup(); };
} else {
measurementDock.show( `
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
                        • <b>Reset polygon</b> to start a new zone
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
zoneDrawLocked=false;
const lock=document.getElementById('btn-zonedraw-lock');
if(lock){lock.textContent='Lock polygon';lock.setAttribute('aria-pressed','false');}
_zoneDrawStorageStatus(window.__GRIDATLAS_MODULES__.polygonDraft.clearOutline());
zoneDrawPoints = [];
zoneDrawDragging = false;
zoneDrawDragIdx = -1;
zoneDrawJustDragged = false;
_zoneDrawCollapsed = false;
window._zdExpand = null;
window._zdCollapse = null;
closeActivePopup();
_zoneDrawUpdateLayers(false);
const el = document.getElementById('zonedraw-display');
if (el) el.style.display = 'none';
}
function zoneDrawHistoryMove(direction) {
const points = zoneHistory[direction](); if (!points) return;
zoneDrawPoints = points; zoneDrawDragging=false; zoneDrawDragIdx=-1;
zoneHistoryApplying=true;
try {_zoneDrawUpdateLayers(false);} finally {zoneHistoryApplying=false;}
if(points.length>=3)_zoneDrawShowPopup();
else {measurementDock.clearValues();_zoneDrawStorageStatus(window.__GRIDATLAS_MODULES__.polygonDraft.clearOutline());}
}
function zoneDrawUndo() {zoneDrawHistoryMove('undo');}
function toggleZoneDrawMode() {
zoneDrawMode = !zoneDrawMode;
const btn = document.getElementById('btn-zonedraw');
if (btn) { btn.classList.toggle('active', zoneDrawMode); btn.setAttribute('aria-pressed', zoneDrawMode); }
map.getCanvas().style.cursor = zoneDrawMode ? 'crosshair' : '';
if (zoneDrawMode) {
if (radiusMode) toggleRadiusMode();
if (radiusAreaMode) toggleRadiusAreaMode();
if (measureMode) toggleMeasureMode();
const el = document.getElementById('zonedraw-display');
if (el) el.style.display = 'block';
measurementDock.open(map, 'zonedraw-display');
if (!zoneDrawPoints.length) {
const restored = window.__GRIDATLAS_MODULES__.polygonDraft.readOutline();
if (restored) {
zoneDrawPoints = restored;
_zoneDrawUpdateLayers(false); _zoneDrawFit();
_zoneDrawStorageStatus({message:'Restored saved polygon from this browser'});
}
}
if (zoneDrawPoints.length >= 3) _zoneDrawShowPopup();
} else {
const el = document.getElementById('zonedraw-display');
if (el) el.style.display = 'none';
measurementDock.close();
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
function _zoneDrawEdgeDots(i) {
const j = (i + 1) % zoneDrawPoints.length;
const a = zoneDrawPoints[i], b = zoneDrawPoints[j];
const apx = map.project(a), bpx = map.project(b);
const lenPx = Math.hypot(bpx.x - apx.x, bpx.y - apx.y);
const clearance = HIT_RADIUS_VERTEX_PX + EDGE_DOT_CLEARANCE_PX;
const out = [];
for (const t of [0.33, 0.5, 0.66]) {
if (t * lenPx < clearance || (1 - t) * lenPx < clearance) continue;
out.push({ insertIdx: j, t, dot: [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t] });
}
return out;
}
function _zoneDrawNearEdgeDot(px) {
for (let i = 0; i < zoneDrawPoints.length; i++) {
for (const d of _zoneDrawEdgeDots(i)) {
const dpx = map.project(d.dot);
const dx = px.x - dpx.x, dy = px.y - dpx.y;
if (Math.sqrt(dx*dx + dy*dy) < HIT_RADIUS_EDGE_PX) return { insertIdx: d.insertIdx, dot: d.dot };
}
}
return null;
}
function _zoneDrawFit() {
const lons = zoneDrawPoints.map(p => p[0]), lats = zoneDrawPoints.map(p => p[1]);
map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
padding: { top: 100, right: 36, bottom: 48, left: 36 }, maxZoom: 19, duration: 600
});
}
function _zoneDrawOnClick(e) {
if (zoneDrawLocked) return;
if (zoneDrawDragging) return;
if (zoneDrawJustDragged) { zoneDrawJustDragged = false; return; }
const lon = e.lngLat.lng, lat = e.lngLat.lat;
if (zoneDrawPoints.length === 0) {
const km = _zoneDrawGetRadius();
zoneDrawPoints = _zoneDrawCirclePoints(lon, lat, km, ZONE_DRAW_VERTICES);
_zoneDrawCollapsed = false;
_zoneDrawFit();
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
return;
}
function _zoneDrawOnMouseDown(e) {
if (!zoneDrawMode || zoneDrawLocked || zoneDrawPoints.length < 3) return;
const px = map.project(e.lngLat);
const vi = _zoneDrawNearVertex(px);
if (vi < 0 && _zoneDrawNearEdgeDot(px)) return;
if (vi >= 0) {
zoneDrawDragging = true; zoneDrawDragIdx = vi;
map.dragPan.disable();
map.getCanvas().style.cursor = 'grabbing';
e.preventDefault();
}
}
function _zoneDrawOnMouseMove(e) {
if (!zoneDrawMode || zoneDrawLocked || zoneDrawPoints.length < 3) return;
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
zoneDrawDragging = false;
zoneDrawDragIdx = -1;
zoneDrawJustDragged = true;
map.dragPan.enable();
map.getCanvas().style.cursor = 'crosshair';
_zoneDrawUpdateLayers(false);
_zoneDrawShowPopup();
setTimeout(() => { zoneDrawJustDragged = false; }, 50);
}
const urlCache = {};
let globalSubsData = null;
let allREPDFeatures = [];
let searchIndex = [];
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
measurementDock.clearValues();
if (activePopup) { activePopup.remove(); activePopup = null; }
}
window._closePopupKeepShape = () => closeActivePopup();
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
let measureMode = false;
let measurePoints = [];
let measureClosed = false;
let _lastMouseMoveRaf = null;
function updateMeasureDisplay() {
const lineEl = document.getElementById('m-line');
const perimEl = document.getElementById('m-perim');
const areaEl = document.getElementById('m-area');
const hint = document.getElementById('m-hint');
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
document.getElementById('m-m').innerText = fmt(totalKm * 1000, 0);
document.getElementById('m-mi').innerText = fmt(totalKm * 0.621371, 2);
hint.innerText = 'Double-click last point to close polygon';
} else {
const closingKm = haversine(measurePoints[measurePoints.length-1][0], measurePoints[measurePoints.length-1][1], measurePoints[0][0], measurePoints[0][1]);
const perimKm = totalKm + closingKm;
let area = 0;
const R = EARTH_RADIUS_KM;
for (let i = 0; i < measurePoints.length; i++) {
const j = (i + 1) % measurePoints.length;
const xi = measurePoints[i][0] * Math.PI / 180; const yi = measurePoints[i][1] * Math.PI / 180;
const xj = measurePoints[j][0] * Math.PI / 180; const yj = measurePoints[j][1] * Math.PI / 180;
area += (xj - xi) * (2 + Math.sin(yi) + Math.sin(yj));
}
const areaKm2 = Math.abs(area) * R * R / 2;
const areaHa = areaKm2 * 100; const areaAc = areaKm2 * 247.105;
lineEl.style.display = 'none'; perimEl.style.display = 'block'; areaEl.style.display = 'block';
document.getElementById('m-pkm').innerText = fmt(perimKm, 2); document.getElementById('m-pm').innerText = fmt(perimKm * 1000, 0);
document.getElementById('m-km2').innerText = fmt(areaKm2, 3); document.getElementById('m-ha').innerText = fmt(areaHa, 1);
document.getElementById('m-ac').innerText = fmt(areaAc, 1);
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
if (radiusAreaMode) measurementDock.open(map, 'radius-area-popup');
if (!radiusAreaMode) {
measurementDock.close();
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
const R = EARTH_RADIUS_KM;
const areaKm2 = 2 * Math.PI * R * R * (1 - Math.cos(km / R));
const areaM2 = areaKm2 * 1000000;
const areaHa = areaM2 / 10000;
const areaAc = areaM2 / 4046.85642;
const areaMi2 = areaKm2 * 0.386102;
const pitches = areaM2 / 7140;
measurementDock.show( `
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
setInterval(() => {
const now = new Date();
const target = new Date(Date.UTC(2050, 0, 1, 0, 0, 0));
document.getElementById('clock').innerText = now.toLocaleTimeString('en-GB');
document.getElementById('date').innerText = now.toLocaleDateString('en-GB');
document.getElementById('days').innerText = Math.floor((target - now) / 86400000) + ' DAYS';
}, 1000);
const map = new maplibregl.Map({
container: 'map',
style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
center: center,
zoom: zoom,
attributionControl: false
});
new ResizeObserver(() => map.resize()).observe(document.getElementById('map'));
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
function buildSearchButtons(name, capacity, tech) {
const threshold = SEARCH_THRESHOLD[tech] !== undefined ? SEARCH_THRESHOLD[tech] : 50;
if (capacity < threshold) return '';
const term = TECH_TERMS.get(tech) || 'energy project';
const q = encodeURIComponent(`${name} ${term} UK`);
const newsUrl = `https://news.google.com/search?q=${q}`;
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
async function focusCanonicalProjectDeepLink() {
const params = new URLSearchParams(window.location.search);
const repdRef = String(params.get('repd_ref') || '').trim();
if (!/^[A-Za-z0-9-]{1,40}$/.test(repdRef)) return;
try {
const requestedTechnology = String(params.get('technology') || '').trim();
const allowedTechnologies = new Set([
'solar', 'solar_operational', 'solar_roof',
'bess', 'bess_operational',
'wind', 'wind_onshore', 'wind_onshore_operational',
'wind_offshore', 'wind_offshore_operational',
'biomass', 'tidal', 'hydrogen', 'hydro', 'flywheel',
'act', 'geothermal', 'caes', 'other'
]);
window.__GRIDATLAS_V8_DEEP_LINK__ = {
status: 'DEFERRED_TO_EXACT_REPD_RECEIVER',
repd_ref: repdRef,
technology: requestedTechnology || null,
technology_recognised: requestedTechnology
? allowedTechnologies.has(requestedTechnology) : null,
legacy_fetches: 0
};
return;
} catch (error) {
console.error('[V9 DEEP LINK FAILED]', error);
const lon = Number(params.get('longitude'));
const lat = Number(params.get('latitude'));
if (Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) {
map.flyTo({ center: [lon, lat], zoom: 12, duration: 1800, essential: true });
}
}
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
const p = f.properties;
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
const blob = new Blob([csv], { type: 'text/csv' });
const objectUrl = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = objectUrl; a.download = `globalgrid2050_export_${new Date().toISOString().slice(0, 10)}.csv`;
document.body.appendChild(a);
try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
}
function toggleStatusMode() {
statusMode = !statusMode;
const btn = document.getElementById('btn-status');
btn.classList.toggle('active', statusMode); btn.setAttribute('aria-pressed', statusMode);
if (map.getLayer('l-naei_co2-glow')) {
const isBaseVisible = document.querySelector('input[data-layer-id="naei_co2"]')?.checked;
map.setLayoutProperty('l-naei_co2-glow', 'visibility', statusMode ? 'none' : (isBaseVisible ? 'visible' : 'none'));
}
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
const layer = layerConfigById.get(id);
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
const byTech = {};
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
const container = document.getElementById('scada-ui-container');
const fsContainer = document.getElementById('fs-curtain-keys');
container.innerHTML = ''; fsContainer.innerHTML = '';
const fragment = document.createDocumentFragment();
const fsFragment = document.createDocumentFragment();
GRID_CONFIG.forEach(group => {
const groupDiv = document.createElement('div'); groupDiv.className = 'key-group';
const fsGroupDiv = document.createElement('div'); fsGroupDiv.className = 'key-group';
groupDiv.innerHTML = fsGroupDiv.innerHTML = `<div class="key-title">${group.group}</div>`;
group.layers.forEach(layer => {
const label = document.createElement('label'); label.className = 'key-item';
const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.layerId = layer.id; input.setAttribute('data-layer-id', layer.id);
const span = document.createElement('span'); span.id = `lbl-${layer.id}`; span.setAttribute('data-base-label', layer.label); span.style.color = layer.color; span.innerText = `${layer.label} [WAIT]`;
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
const zoneReset = document.createElement('button');
zoneReset.id = 'btn-zonedraw-reset';
zoneReset.type = 'button';
zoneReset.textContent = 'Reset polygon';
zoneReset.title = 'Clear this polygon and place a new circle';
zoneReset.style.cssText = 'display:block;margin-top:8px;padding:8px;border:1px solid #ff6600;background:#111;color:#ffb14d;cursor:pointer;min-height:44px';
zoneReset.addEventListener('click', () => {
_zoneDrawClear();
const control = document.getElementById('zonedraw-display');
if (control && zoneDrawMode) control.style.display = 'block';
});
document.getElementById('zonedraw-display').append(zoneReset);
const zoneExport = document.createElement('button');
zoneExport.id = 'btn-zonedraw-export'; zoneExport.type = 'button';
zoneExport.textContent = 'Save GeoJSON'; zoneExport.disabled = zoneDrawPoints.length < 3;
zoneExport.style.cssText = 'display:block;margin-top:8px;padding:8px;border:1px solid #42bcca;background:#111;color:#b9f8ff;cursor:pointer;min-height:44px';
zoneExport.addEventListener('click', () => {
try {
const area = _zoneDrawCalcArea(zoneDrawPoints);
const data = window.__GRIDATLAS_MODULES__.polygonFiles.exportOutline(zoneDrawPoints,{area_m2:area.areaM2,area_ha:area.areaHa,perimeter_km:area.perimKm});
const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/geo+json'}));
const anchor = document.createElement('a'); anchor.href=url;
anchor.download='gridatlas-polygon-'+new Date().toISOString().replace(/[:.]/g,'-')+'.geojson';
document.body.append(anchor); anchor.click(); anchor.remove();
setTimeout(() => URL.revokeObjectURL(url),1000);
_zoneDrawStorageStatus({message:'GeoJSON download created'});
} catch(error) {_zoneDrawStorageStatus({message:error.message});}
});
document.getElementById('zonedraw-display').append(zoneExport);
const zoneImport = document.createElement('button');
zoneImport.id='btn-zonedraw-import'; zoneImport.type='button'; zoneImport.textContent='Open GeoJSON';
zoneImport.style.cssText=zoneExport.style.cssText;
const zoneFile=document.createElement('input'); zoneFile.type='file'; zoneFile.id='zonedraw-file';
zoneFile.accept='.geojson,.json,application/geo+json,application/json'; zoneFile.hidden=true;
zoneImport.addEventListener('click',()=>zoneFile.click());
zoneFile.addEventListener('change',async()=>{
const file=zoneFile.files[0]; if(!file)return;
try {
if(file.size>250000)throw Error('Choose a GeoJSON file under 250 KB.');
const points=window.__GRIDATLAS_MODULES__.polygonFiles.importOutline(await file.text());
zoneDrawPoints=points; zoneDrawDragging=false; zoneDrawDragIdx=-1;
_zoneDrawUpdateLayers(false); _zoneDrawShowPopup(); _zoneDrawFit();
_zoneDrawStorageStatus({message:'Opened '+points.length+' polygon vertices from '+file.name});
} catch(error) {_zoneDrawStorageStatus({message:error.message});}
finally {zoneFile.value='';}
});
document.getElementById('zonedraw-display').append(zoneImport,zoneFile);
const zoneRedo=document.createElement('button');zoneRedo.id='btn-zonedraw-redo';zoneRedo.type='button';
zoneRedo.textContent='Redo edit';zoneRedo.disabled=true;zoneRedo.style.cssText=zoneExport.style.cssText;
zoneRedo.addEventListener('click',()=>zoneDrawHistoryMove('redo'));
document.getElementById('zonedraw-display').append(zoneRedo);
const zoneLock=document.createElement('button');zoneLock.id='btn-zonedraw-lock';zoneLock.type='button';
zoneLock.textContent='Lock polygon';zoneLock.setAttribute('aria-pressed','false');zoneLock.style.cssText=zoneExport.style.cssText;
zoneLock.addEventListener('click',()=>{
zoneDrawLocked=!zoneDrawLocked;zoneDrawDragging=false;zoneDrawDragIdx=-1;map.dragPan.enable();
zoneLock.textContent=zoneDrawLocked?'Unlock polygon':'Lock polygon';zoneLock.setAttribute('aria-pressed',String(zoneDrawLocked));
map.getCanvas().style.cursor=zoneDrawLocked?'grab':'crosshair';_zoneDrawUpdateLayers(false);
_zoneDrawStorageStatus({message:zoneDrawLocked?'Polygon locked: pan and zoom without editing vertices':'Polygon unlocked: drag corners to edit'});
});
document.getElementById('zonedraw-display').append(zoneLock);
const zoneFit=document.createElement('button');zoneFit.id='btn-zonedraw-fit';zoneFit.type='button';
zoneFit.textContent='Fit polygon';zoneFit.disabled=zoneDrawPoints.length<3;zoneFit.style.cssText=zoneExport.style.cssText;
zoneFit.addEventListener('click',()=>{if(zoneDrawPoints.length>=3)_zoneDrawFit();});
document.getElementById('zonedraw-display').append(zoneFit);
const zoneCSV=document.createElement('button');zoneCSV.id='btn-zonedraw-csv';zoneCSV.type='button';
zoneCSV.textContent='Save vertex CSV';zoneCSV.disabled=zoneDrawPoints.length<3;zoneCSV.style.cssText=zoneExport.style.cssText;
zoneCSV.addEventListener('click',()=>{
if(zoneDrawPoints.length<3)return;
let chainage=0;const lines=['vertex,longitude_deg,latitude_deg,chainage_m,next_segment_m'];
zoneDrawPoints.forEach((p,i)=>{const q=zoneDrawPoints[(i+1)%zoneDrawPoints.length],length=haversine(p[0],p[1],q[0],q[1])*1000;
lines.push([i+1,p[0],p[1],chainage,length].join(','));chainage+=length;});
const url=URL.createObjectURL(new Blob([lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'}));
const anchor=document.createElement('a');anchor.href=url;anchor.download='gridatlas-polygon-vertices.csv';
document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
_zoneDrawStorageStatus({message:'Vertex CSV created. Chainage follows the drawn order; the last segment closes the outline. Distances are geodesic estimates.'});
});
document.getElementById('zonedraw-display').append(zoneCSV);
const zoneEditor=document.createElement('details');zoneEditor.id='zonedraw-coordinate-editor';zoneEditor.style.cssText='margin-top:8px;font-size:12px';
const summary=document.createElement('summary');summary.textContent='Edit vertex coordinates';summary.style.cssText='min-height:44px;cursor:pointer';zoneEditor.append(summary);
for(const spec of [['Vertex','zonedraw-vertex','select'],['Longitude (degrees)','zonedraw-longitude','input'],['Latitude (degrees)','zonedraw-latitude','input']]){
const label=document.createElement('label');label.textContent=spec[0];label.htmlFor=spec[1];label.style.display='block';
const control=document.createElement(spec[2]);control.id=spec[1];control.disabled=true;control.style.cssText='display:block;box-sizing:border-box;width:100%;min-height:44px;background:#111;color:#fff;border:1px solid #64748b';
if(spec[2]==='input'){control.type='number';control.step='any';control.min=spec[1].endsWith('longitude')?'-180':'-85.051129';control.max=spec[1].endsWith('longitude')?'180':'85.051129';}
zoneEditor.append(label,control);
}
const zoneApply=document.createElement('button');zoneApply.id='btn-zonedraw-coordinate';zoneApply.type='button';zoneApply.textContent='Apply coordinate';zoneApply.disabled=true;zoneApply.style.cssText=zoneExport.style.cssText;zoneEditor.append(zoneApply);
document.getElementById('zonedraw-display').append(zoneEditor);
document.getElementById('zonedraw-vertex').addEventListener('change',_zoneDrawRefreshEditor);
zoneApply.addEventListener('click',()=>{
if(zoneDrawLocked||zoneDrawPoints.length<3)return;
const i=Number(document.getElementById('zonedraw-vertex').value),a=document.getElementById('zonedraw-longitude').value,b=document.getElementById('zonedraw-latitude').value;
const lon=Number(a),lat=Number(b);
if(!a.trim()||!b.trim()||!Number.isInteger(i)||!zoneDrawPoints[i]||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85.051129){_zoneDrawStorageStatus({message:'Enter longitude from -180 to 180 and latitude from -85.051129 to 85.051129 degrees. The outline has not changed.'});return;}
zoneDrawPoints[i]=[lon,lat];_zoneDrawUpdateLayers(false);_zoneDrawShowPopup();
_zoneDrawStorageStatus({message:'Updated vertex '+(i+1)+'. Undo restores its previous coordinate.'});
});
const existingUndo=document.getElementById('btn-zonedraw-undo');
if(existingUndo){existingUndo.textContent='Undo edit';existingUndo.title='Undo the last polygon edit, import or reset';existingUndo.disabled=true;}
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
if (isVisible && layerId !== '400') hydrateLayer(layerId);
}
function getLayerConfig(layerId) { return layerConfigById.get(layerId); }
function getSourceIdForLayer(layerId) {
if (REPD_IDS.includes(layerId)) return 'src-repd';
if (TRANSIT_IDS.includes(layerId)) return TRANSIT_SOURCE_MAP[layerId];
if (layerId === 'naei_co2') return 'src-naei_co2';
return `src-${layerId}`;
}
function transitExpressionValue(expression, feature) {
if (!Array.isArray(expression)) return expression;
if (expression[0] === 'get') return feature && feature.properties
? feature.properties[expression[1]] : undefined;
if (expression[0] === 'literal') return expression[1];
return undefined;
}
function transitFilterMatches(filter, feature) {
if (!Array.isArray(filter) || filter.length === 0) return true;
const operator = filter[0];
if (operator === 'all') return filter.slice(1).every(item => transitFilterMatches(item, feature));
if (operator === 'any') return filter.slice(1).some(item => transitFilterMatches(item, feature));
if (operator === '!') return !transitFilterMatches(filter[1], feature);
if (operator === '==') return transitExpressionValue(filter[1], feature) === transitExpressionValue(filter[2], feature);
if (operator === '!=') return transitExpressionValue(filter[1], feature) !== transitExpressionValue(filter[2], feature);
if (operator === 'in' || operator === '!in') {
const needle = transitExpressionValue(filter[1], feature);
const haystack = transitExpressionValue(filter[2], feature);
const contains = typeof haystack === 'string'
? haystack.includes(String(needle))
: Array.isArray(haystack) && haystack.includes(needle);
return operator === 'in' ? contains : !contains;
}
return true;
}
function geometryFitsMapLayer(layerType, geometryType) {
if (layerType === 'circle' || layerType === 'heatmap') return geometryType === 'Point' || geometryType === 'MultiPoint';
if (layerType === 'line') return geometryType === 'LineString' || geometryType === 'MultiLineString';
if (layerType === 'fill' || layerType === 'fill-extrusion') return geometryType === 'Polygon' || geometryType === 'MultiPolygon';
return true;
}
function countTransitFeaturesLayerCanDraw(layerId, features) {
const layerConfig = getLayerConfig(layerId);
const mapLayer = map.getLayer(`l-${layerId}`);
if (!layerConfig || !mapLayer) return 0;
return features.reduce((count, feature) => {
const geometryType = feature && feature.geometry && feature.geometry.type;
if (!geometryFitsMapLayer(mapLayer.type, geometryType)) return count;
return transitFilterMatches(layerConfig.filter, feature) ? count + 1 : count;
}, 0);
}
function setLayerControlAvailability(layerId, available) {
document.querySelectorAll(`input[data-layer-id="${layerId}"]`).forEach(input => {
input.disabled = !available;
if (!available) input.checked = false;
});
if (available) return;
[`l-${layerId}`, `l-${layerId}-glow`].forEach(mapLayerId => {
if (map.getLayer(mapLayerId)) map.setLayoutProperty(mapLayerId, 'visibility', 'none');
});
const mapLayerId = `l-${layerId}`;
_visibleInteractiveIds = _visibleInteractiveIds.filter(id => id !== mapLayerId);
_visibleHoverIds = _visibleHoverIds.filter(id => id !== mapLayerId);
}
function updateTransitSourceStates(sourceId, features) {
TRANSIT_IDS.forEach(transitId => {
if (TRANSIT_SOURCE_MAP[transitId] !== sourceId || !RUNTIME_STATE[transitId]) return;
const available = countTransitFeaturesLayerCanDraw(transitId, features) > 0;
RUNTIME_STATE[transitId].loaded = true;
RUNTIME_STATE[transitId].loading = false;
setLayerControlAvailability(transitId, available);
updateUIState(transitId, available ? 'OK' : 'EMPTY');
});
}
async function hydrateLayer(layerId) {
const state = RUNTIME_STATE[layerId];
if (!state || state.loaded || state.loading) return;
state.loading = true; updateUIState(layerId, 'LOAD');
const layerConfig = getLayerConfig(layerId);
if (!layerConfig) { updateUIState(layerId, 'FAIL'); state.loading = false; return; }
await networkQueue.add(async () => {
try {
let features = await fetchAndParseGeoJSON(layerConfig.url);
if (features.length === 0) {
if (TRANSIT_IDS.includes(layerId)) updateTransitSourceStates(TRANSIT_SOURCE_MAP[layerId], features);
else { state.loaded = true; state.loading = false; updateUIState(layerId, 'EMPTY'); }
return;
}
if (layerConfig.isSubs) globalSubsData = features;
if (layerConfig.snap) {
if (!globalSubsData) { const subsLayer = getLayerConfig('subs'); globalSubsData = await fetchAndParseGeoJSON(subsLayer.url); }
console.warn(`[SNAP] Runtime snapping active for "${layerId}" — ${features.length} features. Move to build pipeline when possible.`);
features = snapLines(features, globalSubsData);
}
const sourceId = getSourceIdForLayer(layerId);
const source = map.getSource(sourceId);
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
acc.mw += parseFloat(f.properties.capacity) || 0;
return acc;
}, { count: 0, mw: 0 });
updateUIState(id, idStats.count > 0 ? 'OK' : 'EMPTY', idStats.count > 0 ? idStats : null);
});
if (statusMode) { toggleStatusMode(); toggleStatusMode(); }
} else if (layerId === 'naei_co2') {
const stats = features.reduce((acc, f) => {
acc.count++;
acc.mw += parseFloat(f.properties.emission_tco2e) || 0;
return acc;
}, { count: 0, mw: 0 });
updateUIState(layerId, stats.count > 0 ? 'OK' : 'EMPTY', stats.count > 0 ? stats : null);
} else if (TRANSIT_IDS.includes(layerId)) {
updateTransitSourceStates(TRANSIT_SOURCE_MAP[layerId], features);
} else {
updateUIState(layerId, 'OK');
}
} catch (err) { console.error(`[LAYER FAILED] ${layerId}:`, err); state.loading = false; updateUIState(layerId, 'FAIL'); }
});
}
map.on('load', () => {
buildDOM();
map.addSource('sat-s', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 });
map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });
map.addSource('src-radius-circle', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addLayer({ id: 'l-radius-circle-fill', type: 'fill', source: 'src-radius-circle', paint: { 'fill-color': '#00ffff', 'fill-opacity': 0.04 } });
map.addLayer({ id: 'l-radius-circle-stroke', type: 'line', source: 'src-radius-circle', paint: { 'line-color': '#00ffff', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [4, 3] } });
map.addSource('src-radius-area', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addLayer({ id: 'l-radius-area-fill', type: 'fill', source: 'src-radius-area', paint: { 'fill-color': '#ff00ff', 'fill-opacity': 0.08 } });
map.addLayer({ id: 'l-radius-area-stroke', type: 'line', source: 'src-radius-area', paint: { 'line-color': '#ff00ff', 'line-width': 1.5, 'line-opacity': 0.8, 'line-dasharray': [2, 2] } });
map.addSource('src-measure-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addSource('src-measure-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addSource('src-measure-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addLayer({ id: 'l-measure-fill', type: 'fill', source: 'src-measure-fill', paint: { 'fill-color': '#ffff00', 'fill-opacity': 0.08 } });
map.addLayer({ id: 'l-measure-line', type: 'line', source: 'src-measure-line', paint: { 'line-color': '#ffff00', 'line-width': 2, 'line-dasharray': [3, 2] } });
map.addLayer({ id: 'l-measure-points', type: 'circle', source: 'src-measure-points', paint: { 'circle-color': '#ffff00', 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000' } });
map.addSource('src-zonedraw-fill', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addSource('src-zonedraw-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addSource('src-zonedraw-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addLayer({ id: 'l-zonedraw-fill', type: 'fill', source: 'src-zonedraw-fill', paint: { 'fill-color': '#ff6600', 'fill-opacity': 0.18 } });
map.addLayer({ id: 'l-zonedraw-line', type: 'line', source: 'src-zonedraw-line', paint: { 'line-color': '#ff6600', 'line-width': 3, 'line-dasharray': [4, 2] } });
map.addLayer({ id: 'l-zonedraw-points', type: 'circle', source: 'src-zonedraw-points', paint: {
'circle-color': ['case', ['==', ['get', 'kind'], 'vertex'], '#ffb14d', '#c96a12'],
'circle-radius': ['case', ['==', ['get', 'kind'], 'vertex'], 11, 5],
'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'vertex'], 3, 1.5],
'circle-stroke-color': ['case', ['==', ['get', 'kind'], 'vertex'], '#ffffff', '#3a1c00'],
'circle-opacity': ['case', ['==', ['get', 'kind'], 'vertex'], 1, 0.75]
} });
const allLayerIds = [];
GRID_CONFIG.forEach(group => {
group.layers.forEach(layer => {
if (REPD_IDS.includes(layer.id) || TRANSIT_IDS.includes(layer.id) || layer.id === 'ev' || layer.id === 'naei_co2') return;
if (layer.id === '400') {
map.addSource('src-400', {
type: 'geojson',
data: '../cartridges/5f5fbec83f9ce307b47ddc6e7277743f0bba1a2445b0f3ca50a9a1806146e993/grid_400kv.geojson'
});
} else {
map.addSource(`src-${layer.id}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
}
const layerObject = {
id: `l-${layer.id}`, type: layer.type === 'line' ? 'line' : 'circle', source: `src-${layer.id}`, layout: { visibility: 'none' },
paint: layer.type === 'line' ? { 'line-color': layer.color, 'line-width': layer.width } : { 'circle-color': layer.color, 'circle-radius': layer.radius, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' }
};
if (layer.filter) layerObject.filter = layer.filter; if (layer.minzoom) layerObject.minzoom = layer.minzoom;
map.addLayer(layerObject); allLayerIds.push(`l-${layer.id}`);
});
});
map.addSource('src-naei_co2', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
map.addLayer({
id: `l-naei_co2-glow`,
type: 'circle',
source: 'src-naei_co2',
filter: ['>=', ['coalesce', ['get', 'emission_tco2e'], 0], 50000],
layout: { visibility: 'none' },
paint: {
'circle-color': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000'],
'circle-radius': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,20,200000,40,1000000,60,5000000,90],
'circle-opacity': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],50000,0.15,200000,0.25,1000000,0.35],
'circle-blur': 1.0,
'circle-stroke-width': 0
}
});
map.addLayer({
id: 'l-naei_co2',
type: 'circle',
source: 'src-naei_co2',
layout: { visibility: 'none' },
paint: {
'circle-color': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,'#ffcc00',50000,'#ffaa00',200000,'#ff6600',1000000,'#ff0000'],
'circle-radius': ['interpolate',['linear'],['coalesce',['get','emission_tco2e'],0],0,6,50000,10,200000,14,1000000,20,5000000,28],
'circle-stroke-width': 1.5,
'circle-stroke-color': '#000',
'circle-opacity': 0.85
}
});
allLayerIds.push('l-naei_co2-glow', 'l-naei_co2');
Object.keys(TRANSIT_URLS).forEach(sourceId => { map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }); });
TRANSIT_IDS.forEach(id => {
const layer = getLayerConfig(id);
const layerObject = {
id: `l-${id}`, type: 'circle', source: TRANSIT_SOURCE_MAP[id], layout: { visibility: 'none' },
paint: { 'circle-color': layer.color, 'circle-radius': layer.radius, 'circle-stroke-width': 1, 'circle-stroke-color': '#000', 'circle-opacity': 0.9 }
};
if (layer.filter) layerObject.filter = layer.filter; if (layer.minzoom) layerObject.minzoom = layer.minzoom;
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
: { 'circle-color': layer.color, 'circle-radius': ['interpolate',['linear'],['coalesce',['get','capacity'],0],0,8,10,10,50,13,200,17,500,22,1000,28], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#000', 'circle-opacity': 0.85 };
map.addLayer({ id: `l-${id}`, type: 'circle', source: 'src-repd', filter: layer.filter, layout: { visibility: 'none' }, paint: circlePaint });
allLayerIds.push(`l-${id}`);
});
_rebuildVisibleCache(allLayerIds);
let _pendingToolClick = null;
map.getCanvas().addEventListener('mousedown', e => {
if (!zoneDrawMode) return;
const lngLat = map.unproject([e.offsetX, e.offsetY]);
_zoneDrawOnMouseDown({ lngLat, preventDefault: () => e.preventDefault() });
});
map.on('zoomend', () => {
if (zoneDrawMode && zoneDrawPoints.length >= 3) _zoneDrawUpdateLayers(false, true);
});
(function attachZoneTouch() {
const canvas = map.getCanvas();
const pointOf = touch => {
const r = canvas.getBoundingClientRect();
return map.unproject([touch.clientX - r.left, touch.clientY - r.top]);
};
canvas.addEventListener('touchstart', e => {
if (!zoneDrawMode || e.touches.length !== 1) return;
_zoneDrawOnMouseDown({ lngLat: pointOf(e.touches[0]), preventDefault: () => {} });
if (zoneDrawDragging) e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
if (!zoneDrawMode || !zoneDrawDragging || e.touches.length !== 1) return;
e.preventDefault();
_zoneDrawOnMouseMove({ lngLat: pointOf(e.touches[0]) });
}, { passive: false });
const endTouch = () => { if (zoneDrawMode && zoneDrawDragging) _zoneDrawOnMouseUp(); };
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);
})();
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
if (!_visibleInteractiveIds.length) return;
const features = map.queryRenderedFeatures(e.point, { layers: _visibleInteractiveIds });
if (!features.length) return;
const p = features[0].properties || {}; const name = p.name || p.SiteName || p['Site Name'] || 'Unnamed Asset';
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
GRID_CONFIG.forEach(group => { group.layers.forEach(layer => { if (layer.preload && layer.id !== '400') hydrateLayer(layer.id); }); });
const state400 = RUNTIME_STATE['400'];
if (state400) { state400.loaded = true; state400.loading = false; updateUIState('400', 'OK'); }
focusCanonicalProjectDeepLink();
});
};
(() => {
'use strict';
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.geodesy) return;
const EARTH_RADIUS_KM = 6378.137;
const DEG = Math.PI / 180;
function distanceKm(lon1, lat1, lon2, lat2) {
const dLat = (lat2 - lat1) * DEG;
const dLon = (lon2 - lon1) * DEG;
const a = Math.sin(dLat / 2) ** 2
+ Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function representativePoint(geometry) {
if (!geometry) return null;
const { type, coordinates } = geometry;
if (type === 'Point') {
return Array.isArray(coordinates) && coordinates.length >= 2
? [coordinates[0], coordinates[1]] : null;
}
const ring = type === 'Polygon' ? coordinates && coordinates[0]
: type === 'MultiPolygon' ? coordinates && coordinates[0] && coordinates[0][0]
: null;
if (!Array.isArray(ring) || !ring.length) return null;
let sumLon = 0;
let sumLat = 0;
for (const point of ring) {
sumLon += point[0];
sumLat += point[1];
}
return [sumLon / ring.length, sumLat / ring.length];
}
function voltagesKv(properties) {
if (!properties) return [];
const out = [];
const explicit = properties.kv ?? properties.KV;
if (explicit != null && String(explicit).trim() !== '') {
for (const token of String(explicit).match(/\d+(?:\.\d+)?/g) || []) {
const value = Number(token);
if (Number.isFinite(value) && value > 0) out.push(value);
}
}
const volts = properties.voltage ?? properties.VOLTAGE;
if (volts != null) {
for (const token of String(volts).match(/\d+(?:\.\d+)?/g) || []) {
const value = Number(token);
if (Number.isFinite(value) && value > 0) out.push(value / 1000);
}
}
return [...new Set(out)].sort((a, b) => b - a);
}
function destinationPoint(lon, lat, km, bearingDeg) {
const ad = km / EARTH_RADIUS_KM;
const brg = bearingDeg * DEG;
const p1 = lat * DEG;
const p2 = Math.asin(Math.sin(p1) * Math.cos(ad)
+ Math.cos(p1) * Math.sin(ad) * Math.cos(brg));
const l2 = lon * DEG + Math.atan2(
Math.sin(brg) * Math.sin(ad) * Math.cos(p1),
Math.cos(ad) - Math.sin(p1) * Math.sin(p2));
return [l2 / DEG, p2 / DEG];
}
function initialBearingDeg(lon1, lat1, lon2, lat2) {
const p1 = lat1 * DEG; const p2 = lat2 * DEG;
const dl = (lon2 - lon1) * DEG;
const y = Math.sin(dl) * Math.cos(p2);
const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
return (Math.atan2(y, x) / DEG + 360) % 360;
}
NS.geodesy = Object.freeze({
schema: 'gridatlas.module.geodesy.v1',
EARTH_RADIUS_KM,
distanceKm,
destinationPoint,
initialBearingDeg,
representativePoint,
voltagesKv
});
})();
(() => {
'use strict';
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.networkTopology) return;
const ACCEPTS = 'data-grid-gb.transmission-network.v1';
const NOT_AN_ASSESSMENT =
'Counts, lengths, ratings and impedances are what the network operator '
+ 'publishes about this site. None of them states whether any project can '
+ 'connect here, which depends on queue position, committed connections, '
+ 'consent and commercial terms that no published appendix contains.';
const IMPEDANCE_BASIS =
'R, X and B are percentages on a 100 MVA base, as published. They are '
+ 'network parameters, not a solved power flow.';
const UNDECLARED = 'undeclared';
function voltageOf(node) {
if (!node) return null;
if (node.voltage_consistent_with_site !== true) return null;
return Number.isFinite(node.voltage_kv) ? node.voltage_kv : null;
}
const bandKey = (kv) => (kv == null ? UNDECLARED : String(kv));
function ratingsOf(row) {
const seasons = { winter: row.winter_mva, spring: row.spring_mva,
summer: row.summer_mva, autumn: row.autumn_mva };
const published = {};
for (const [season, value] of Object.entries(seasons)) {
if (Number.isFinite(value)) published[season] = value;
}
return Object.keys(published).length ? published : null;
}
function physicalUnits(records) {
const pairs = new Map();
for (const record of records) {
const near = String(record.from_node);
const far = String(record.to_node);
const forward = near < far;
const key = forward ? near + '\u0000' + far : far + '\u0000' + near;
if (!pairs.has(key)) pairs.set(key, { forward: 0, reverse: 0 });
const seen = pairs.get(key);
if (forward) seen.forward += 1; else seen.reverse += 1;
}
let units = 0;
for (const seen of pairs.values()) {
units += (seen.forward && seen.reverse)
? Math.max(seen.forward, seen.reverse)
: seen.forward + seen.reverse;
}
return units;
}
function parametersOf(row) {
const published = {};
for (const [key, field] of [['r_pct', 'r_pct_100mva'], ['x_pct', 'x_pct_100mva'],
['b_pct', 'b_pct_100mva']]) {
if (Number.isFinite(row[field])) published[key] = row[field];
}
return Object.keys(published).length ? published : null;
}
function index(product) {
if (!product || product.schema !== ACCEPTS) return null;
const nodes = new Map();
for (const node of product.nodes || []) {
if (node && node.node) nodes.set(node.node, node);
}
const sitesByCode = new Map();
const sitesByName = new Map();
for (const site of product.sites || []) {
if (!site || !site.code) continue;
sitesByCode.set(String(site.code).toUpperCase(), site);
if (site.name) sitesByName.set(String(site.name).toUpperCase().trim(), site);
}
const byNode = new Map();
function land(nodeName, entry) {
if (!nodeName) return;
if (!byNode.has(nodeName)) byNode.set(nodeName, []);
byNode.get(nodeName).push(entry);
}
for (const [kind, rows] of [['circuit', product.circuits],
['transformer', product.transformers], ['planned_change', product.planned_changes]]) {
for (const row of rows || []) {
if (!row) continue;
land(row.node_1, { kind, row, near: 'node_1', far: 'node_2' });
land(row.node_2, { kind, row, near: 'node_2', far: 'node_1' });
}
}
function siteOf(nodeName) {
const node = nodes.get(nodeName);
return node ? node.site_code : null;
}
function graph() {
return {
schema: 'gridatlas.module.network-topology.graph.v1',
has: (name) => nodes.has(name),
nodeVoltageKv: (name) => voltageOf(nodes.get(name)),
nodeSiteCode: (name) => {
const node = nodes.get(name);
return node ? node.site_code : null;
},
edgesAt: (name) => (byNode.get(name) || [])
.filter((entry) => entry.kind !== 'planned_change'),
nodesOfSite: (code) => {
const wanted = String(code || '').toUpperCase();
const out = [];
for (const node of nodes.values()) {
if (String(node.site_code || '').toUpperCase() === wanted) out.push(node.node);
}
return out.sort();
},
siteByCode: (code) => sitesByCode.get(String(code || '').toUpperCase()) || null,
ratingsOf,
parametersOf
};
}
function resolve(key) {
if (!key) return null;
const wanted = String(key).toUpperCase().trim();
return sitesByCode.get(wanted) || sitesByName.get(wanted) || null;
}
function at(key, options) {
const site = resolve(key);
if (!site) return null;
const wantedKv = options && Number.isFinite(options.voltageKv)
? options.voltageKv : null;
const siteNodes = [];
for (const node of nodes.values()) {
if (node.site_code !== site.code) continue;
const kv = voltageOf(node);
if (wantedKv != null && kv !== wantedKv) continue;
siteNodes.push({ node: node.node, voltage_kv: kv });
}
siteNodes.sort((a, b) => a.node.localeCompare(b.node));
const byVoltage = new Map();
const neighbours = new Map();
for (const entry of siteNodes) {
for (const landing of byNode.get(entry.node) || []) {
const farNode = landing.row[landing.far];
const farSiteCode = siteOf(farNode);
const farSite = farSiteCode ? sitesByCode.get(farSiteCode) : null;
const internal = farSiteCode === site.code;
const key2 = bandKey(entry.voltage_kv);
if (!byVoltage.has(key2)) {
byVoltage.set(key2, { voltage_kv: entry.voltage_kv,
circuits: [], transformers: [], planned_changes: [] });
}
const band = byVoltage.get(key2);
const published = {
from_node: entry.node,
to_node: farNode,
to_site_code: farSiteCode,
to_site_name: farSite ? farSite.name : null,
within_this_site: internal,
transmission_owner: landing.row.transmission_owner || null,
parameters_pct_100mva: parametersOf(landing.row),
ratings_mva: ratingsOf(landing.row)
};
if (landing.kind === 'circuit') {
published.circuit_type = landing.row.circuit_type || null;
if (Number.isFinite(landing.row.ohl_km)) published.ohl_km = landing.row.ohl_km;
if (Number.isFinite(landing.row.cable_km)) published.cable_km = landing.row.cable_km;
band.circuits.push(published);
} else if (landing.kind === 'transformer') {
if (Number.isFinite(landing.row.rating_mva)) published.rating_mva = landing.row.rating_mva;
delete published.ratings_mva;
band.transformers.push(published);
} else {
published.year = landing.row.year || null;
published.status = landing.row.status || null;
published.asset = landing.row.asset || null;
band.planned_changes.push(published);
}
if (landing.kind === 'circuit' && !internal && farSiteCode) {
if (!neighbours.has(farSiteCode)) {
neighbours.set(farSiteCode, {
site_code: farSiteCode,
site_name: farSite ? farSite.name : null,
circuits: 0
});
}
neighbours.get(farSiteCode).circuits += 1;
}
}
}
const voltages = [...byVoltage.entries()]
.sort((a, b) => {
if (a[0] === UNDECLARED) return 1;
if (b[0] === UNDECLARED) return -1;
return Number(b[0]) - Number(a[0]);
})
.map(([, band]) => band);
return {
schema: 'gridatlas.module.network-topology.v1',
source: ACCEPTS,
site: {
code: site.code,
name: site.name,
transmission_owner: site.transmission_owner || null,
voltages_kv: Array.isArray(site.voltages_kv) ? site.voltages_kv.slice() : []
},
requested_voltage_kv: wantedKv,
nodes: siteNodes,
by_voltage: voltages,
neighbours: [...neighbours.values()].sort((a, b) => b.circuits - a.circuits),
counts: {
nodes: siteNodes.length,
circuits: physicalUnits(voltages.flatMap(band => band.circuits)),
transformers: physicalUnits(voltages.flatMap(band => band.transformers)),
planned_changes: physicalUnits(voltages.flatMap(band => band.planned_changes)),
circuit_landings: voltages.reduce((sum, band) => sum + band.circuits.length, 0),
transformer_landings: voltages.reduce((sum, band) => sum + band.transformers.length, 0),
planned_change_landings: voltages.reduce((sum, band) => sum + band.planned_changes.length, 0),
neighbour_sites: neighbours.size
},
counts_are_units: 'A site holds both ends of a transformer and of any '
+ 'internal circuit, so the same branch lands twice. The counts above '
+ 'are physical units; the landing tallies beside them are what the '
+ 'per-voltage lists contain.',
impedance_basis: IMPEDANCE_BASIS,
not_an_assessment: NOT_AN_ASSESSMENT
};
}
return {
schema: 'gridatlas.module.network-topology.v1',
source: ACCEPTS,
counts: {
sites: sitesByCode.size,
nodes: nodes.size,
branch_landings: byNode.size
},
site: resolve,
at,
graph
};
}
NS.networkTopology = Object.freeze({
schema: 'gridatlas.module.network-topology.v1',
accepts: ACCEPTS,
not_an_assessment: NOT_AN_ASSESSMENT,
impedance_basis: IMPEDANCE_BASIS,
index
});
})();
(() => {
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.electricalDistance) return;
const SCHEMA = 'gridatlas.module.electrical-distance.v1';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const NOT_A_DISTANCE =
'Hops are published circuits between two sites, not a distance. A site '
+ 'one hop away may be a hundred kilometres away, and a site ten '
+ 'kilometres away may be on no shared circuit at all.';
const NOT_A_CAPACITY =
'A path existing on the published network says nothing about whether '
+ 'anything can flow along it for a new project. Ratings are the '
+ 'circuit\'s, not a spare allowance, and queue position, committed '
+ 'connections, consent and commercial terms appear in no appendix.';
const IMPEDANCE_CARRIED =
'R, X and B are reproduced on each hop exactly as published, on a '
+ '100 MVA base. They are not added, scaled or combined anywhere in '
+ 'this module. A sum of them would be the beginning of a load flow, '
+ 'which needs a declared model this data does not contain.';
const UNDECLARED = 'undeclared';
function crossing(graph, nearNode, farNode) {
const near = graph.nodeVoltageKv(nearNode);
const far = graph.nodeVoltageKv(farNode);
return {
near_kv: near,
far_kv: far,
both_declared: near != null && far != null,
changes: near != null && far != null && near !== far
};
}
function describe(graph, entry, nearNode) {
const farNode = entry.row[entry.far];
const cross = crossing(graph, nearNode, farNode);
return {
kind: entry.kind,
from_node: nearNode,
to_node: farNode,
from_site_code: graph.nodeSiteCode(nearNode) || null,
to_site_code: graph.nodeSiteCode(farNode) || null,
from_voltage_kv: cross.near_kv,
to_voltage_kv: cross.far_kv,
voltage_changed: cross.changes,
voltage_ratio_kv: entry.kind === 'transformer'
&& typeof entry.row.voltage_ratio_kv === 'string'
? entry.row.voltage_ratio_kv : null,
ratings_mva: graph.ratingsOf(entry.row),
transformer_rating_mva: entry.kind === 'transformer'
&& Number.isFinite(entry.row.rating_mva) ? entry.row.rating_mva : null,
parameters_pct_100mva: graph.parametersOf(entry.row)
};
}
function legality(kind, cross) {
if (!cross.changes) return { legal: true, refusal: null };
if (kind === 'transformer') return { legal: true, refusal: null };
return {
legal: false,
refusal: 'a ' + kind + ' whose two ends carry different declared '
+ 'voltages (' + cross.near_kv + ' kV and ' + cross.far_kv + ' kV); '
+ 'only a transformer may change voltage, so this edge is not walked'
};
}
function startNodes(graph, site, voltageKv) {
const nodes = graph.nodesOfSite(site.code);
if (voltageKv == null) return nodes;
return nodes.filter((name) => graph.nodeVoltageKv(name) === voltageKv);
}
function between(index, fromKey, toKey, options) {
if (!index || typeof index.graph !== 'function') return null;
const graph = index.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const from = index.site(fromKey);
const to = index.site(toKey);
if (!from || !to) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const maxHops = Number.isFinite(opts.maxHops) ? opts.maxHops : 6;
const targets = new Set(graph.nodesOfSite(to.code));
const origins = startNodes(graph, from, voltageKv);
const base = {
schema: SCHEMA,
from: { code: from.code, name: from.name },
to: { code: to.code, name: to.name },
requested_voltage_kv: voltageKv,
max_hops: maxHops,
not_a_distance: NOT_A_DISTANCE,
not_a_capacity: NOT_A_CAPACITY,
impedance_basis: IMPEDANCE_CARRIED
};
if (!origins.length) {
return Object.assign({}, base, {
reached: false,
reason: voltageKv == null
? 'the origin site publishes no nodes in this product'
: 'the origin site publishes no node at ' + voltageKv + ' kV',
hops: null, path: [], refusals: [], ties: 0, explored_nodes: 0
});
}
if (from.code === to.code) {
return Object.assign({}, base, {
reached: true, hops: 0, path: [], refusals: [], ties: 0,
explored_nodes: origins.length,
reason: 'the same site'
});
}
const seen = new Map();
const refusals = [];
let frontier = [];
for (const name of origins.slice().sort()) {
if (targets.has(name)) {
return Object.assign({}, base, {
reached: true, hops: 0, path: [], refusals: [], ties: 0,
explored_nodes: 1,
reason: 'both site codes resolve to the same node'
});
}
seen.set(name, null);
frontier.push(name);
}
for (let depth = 1; depth <= maxHops; depth += 1) {
const next = [];
const arrivals = [];
for (const nearNode of frontier) {
for (const entry of graph.edgesAt(nearNode)) {
const farNode = entry.row[entry.far];
if (!farNode || !graph.has(farNode)) continue;
const cross = crossing(graph, nearNode, farNode);
const verdict = legality(entry.kind, cross);
if (!verdict.legal) {
refusals.push({
at_node: nearNode, to_node: farNode,
kind: entry.kind, reason: verdict.refusal
});
continue;
}
if (seen.has(farNode)) continue;
seen.set(farNode, { via: entry, from: nearNode });
if (targets.has(farNode)) arrivals.push(farNode);
else next.push(farNode);
}
}
if (arrivals.length) {
arrivals.sort();
const path = [];
let cursor = arrivals[0];
while (cursor) {
const step = seen.get(cursor);
if (!step) break;
path.unshift(describe(graph, step.via, step.from));
cursor = step.from;
}
return Object.assign({}, base, {
reached: true,
hops: path.length,
path,
transformers_crossed: path.filter((h) => h.kind === 'transformer').length,
voltage_changes: path.filter((h) => h.voltage_changed).length,
ties: arrivals.length - 1,
refusals,
explored_nodes: seen.size,
arrival_node: arrivals[0]
});
}
if (!next.length) break;
frontier = next.sort();
}
return Object.assign({}, base, {
reached: false,
reason: 'no published path within ' + maxHops + ' hops'
+ (voltageKv == null ? '' : ' from a ' + voltageKv + ' kV node')
+ '; this is a statement about the published network, not about '
+ 'whether the two sites are connected in reality',
hops: null, path: [], refusals, ties: 0, explored_nodes: seen.size
});
}
function within(index, key, options) {
if (!index || typeof index.graph !== 'function') return null;
const graph = index.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const site = index.site(key);
if (!site) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const limit = Number.isFinite(opts.hops) ? opts.hops : 2;
const origins = startNodes(graph, site, voltageKv);
const seen = new Set(origins);
const bySite = new Map();
const refusals = [];
let frontier = origins.slice().sort();
for (let depth = 1; depth <= limit; depth += 1) {
const next = [];
for (const nearNode of frontier) {
for (const entry of graph.edgesAt(nearNode)) {
const farNode = entry.row[entry.far];
if (!farNode || !graph.has(farNode) || seen.has(farNode)) continue;
const cross = crossing(graph, nearNode, farNode);
const verdict = legality(entry.kind, cross);
if (!verdict.legal) {
refusals.push({ at_node: nearNode, to_node: farNode,
kind: entry.kind, reason: verdict.refusal });
continue;
}
seen.add(farNode);
next.push(farNode);
const code = graph.nodeSiteCode(farNode);
if (!code || String(code).toUpperCase() === String(site.code).toUpperCase()) continue;
if (bySite.has(code)) continue;
const far = graph.siteByCode(code);
bySite.set(code, {
code,
name: far ? far.name : null,
hops: depth,
first_node: farNode,
voltage_kv: cross.far_kv,
via: entry.kind
});
}
}
if (!next.length) break;
frontier = next.sort();
}
const sites = [...bySite.values()].sort((a, b) =>
a.hops - b.hops || String(a.code).localeCompare(String(b.code)));
return {
schema: SCHEMA,
site: { code: site.code, name: site.name },
requested_voltage_kv: voltageKv,
hop_limit: limit,
origin_nodes: origins.length,
sites,
counts: {
sites: sites.length,
by_hop: sites.reduce((acc, s) => {
acc[s.hops] = (acc[s.hops] || 0) + 1;
return acc;
}, {})
},
refusals,
not_a_distance: NOT_A_DISTANCE,
not_a_capacity: NOT_A_CAPACITY
};
}
NS.electricalDistance = Object.freeze({
schema: SCHEMA,
requires: REQUIRES,
not_a_distance: NOT_A_DISTANCE,
not_a_capacity: NOT_A_CAPACITY,
impedance_basis: IMPEDANCE_CARRIED,
undeclared: UNDECLARED,
between,
within
});
})();
(() => {
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.ratingEnvelope) return;
const SCHEMA = 'gridatlas.module.rating-envelope.v1';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const SEASONS = Object.freeze(['winter', 'spring', 'summer', 'autumn']);
const FIELD = Object.freeze({
winter: 'winter_mva', spring: 'spring_mva',
summer: 'summer_mva', autumn: 'autumn_mva'
});
const NEVER_SUMMED =
'These are per-circuit thermal ratings under stated seasonal '
+ 'conditions. They are not additive and they are not simultaneous: '
+ 'the sum of the circuits at a site is not a quantity that exists in '
+ 'the network, and this module contains no code that produces one.';
const NOT_A_CAPACITY =
'A rating is what a circuit is rated to carry, not what is free on '
+ 'it. Existing flows, committed connections, queue position, outage '
+ 'conditions and commercial terms decide what a project could use, '
+ 'and no published appendix contains any of them.';
const IMPLAUSIBLE_MVA = 9999;
function seasonsOf(row) {
const published = {};
const absent = [];
for (const season of SEASONS) {
const value = row[FIELD[season]];
if (Number.isFinite(value)) published[season] = value;
else absent.push(season);
}
return { published, absent };
}
function flagsFor(published) {
const flags = [];
for (const [season, value] of Object.entries(published)) {
if (value >= IMPLAUSIBLE_MVA) {
flags.push({
season,
value,
reason: 'at or above ' + IMPLAUSIBLE_MVA + ' MVA, which has the '
+ 'shape of a placeholder rather than a thermal rating; it is '
+ 'reported and excluded from the range below'
});
}
}
return flags;
}
function at(index, key, options) {
if (!index || typeof index.graph !== 'function') return null;
const graph = index.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const site = index.site(key);
if (!site) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const nodes = graph.nodesOfSite(site.code)
.filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);
const circuits = [];
const seen = new Set();
for (const nodeName of nodes) {
for (const entry of graph.edgesAt(nodeName)) {
if (entry.kind !== 'circuit') continue;
const far = entry.row[entry.far];
const id = [nodeName, far].sort().join('|');
if (seen.has(id)) continue;
seen.add(id);
const { published, absent } = seasonsOf(entry.row);
if (!Object.keys(published).length) continue;
circuits.push({
from_node: nodeName,
to_node: far,
to_site_code: graph.nodeSiteCode(far) || null,
voltage_kv: graph.nodeVoltageKv(nodeName),
circuit_type: typeof entry.row.circuit_type === 'string' ? entry.row.circuit_type : null,
ohl_km: Number.isFinite(entry.row.ohl_km) ? entry.row.ohl_km : null,
cable_km: Number.isFinite(entry.row.cable_km) ? entry.row.cable_km : null,
ratings_mva: published,
seasons_not_published: absent,
flags: flagsFor(published),
parameters_pct_100mva: graph.parametersOf(entry.row)
});
}
}
circuits.sort((a, b) => String(a.to_node).localeCompare(String(b.to_node)));
const by_season = {};
for (const season of SEASONS) {
const values = circuits
.filter((c) => Number.isFinite(c.ratings_mva[season])
&& c.ratings_mva[season] < IMPLAUSIBLE_MVA)
.map((c) => c.ratings_mva[season]);
const excluded = circuits
.filter((c) => Number.isFinite(c.ratings_mva[season])
&& c.ratings_mva[season] >= IMPLAUSIBLE_MVA).length;
by_season[season] = values.length
? {
lowest_circuit_mva: Math.min.apply(null, values),
highest_circuit_mva: Math.max.apply(null, values),
circuits: values.length,
excluded_as_implausible: excluded
}
: { circuits: 0, excluded_as_implausible: excluded, published: false };
}
const flagged = circuits.filter((c) => c.flags.length);
const missingSeasons = circuits.filter((c) => c.seasons_not_published.length);
return {
schema: SCHEMA,
site: { code: site.code, name: site.name },
requested_voltage_kv: voltageKv,
scope: voltageKv == null
? 'every voltage at this site; a range across two busbar voltages '
+ 'is a number about neither of them'
: voltageKv + ' kV nodes at this site only',
circuits,
by_season,
counts: {
circuits: circuits.length,
with_a_flagged_value: flagged.length,
with_a_season_not_published: missingSeasons.length
},
never_summed: NEVER_SUMMED,
not_a_capacity: NOT_A_CAPACITY
};
}
NS.ratingEnvelope = Object.freeze({
schema: SCHEMA,
requires: REQUIRES,
seasons: SEASONS,
implausible_mva: IMPLAUSIBLE_MVA,
never_summed: NEVER_SUMMED,
not_a_capacity: NOT_A_CAPACITY,
at
});
})();
(() => {
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.injectionResponse) return;
const SCHEMA = 'gridatlas.module.injection-response.v2';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const BASE_MVA = 100;
const DECLARED_MODEL = Object.freeze({
method: 'linear DC power flow (injection response / power transfer distribution factor)',
equations: 'P = B′ · θ ; branch flow f_ij = (θ_i − θ_j) / x_ij',
base_mva: BASE_MVA,
reactance: 'x = x_pct_100mva / 100, per unit, as published',
resistance: 'not used; the DC approximation neglects series resistance',
shunt_susceptance: 'not used; line charging does not appear in a DC model',
voltages: 'assumed flat at 1.0 per unit; not published and not solved',
angles: 'assumed small, so sin θ ≈ θ',
losses: 'zero by construction; real losses are of order 1-2% and are not represented',
transformer_taps: 'not published, therefore not modelled; transformers are their series reactance only',
contingencies: 'none; this is the intact network',
slack: 'declared explicitly on every answer, never inferred silently'
});
const NOT_A_LOADING =
'This is the response to a NEW injection, not a loading. What is '
+ 'already flowing on these circuits is published nowhere in this '
+ 'product, so the total flow - which is what decides whether a '
+ 'circuit is full - cannot be computed here by anyone.';
const NOT_A_CONNECTION_OFFER =
'A fraction of an injection appearing on a circuit is not permission '
+ 'to use that circuit. Queue position, committed connections, outage '
+ 'conditions, consent and commercial terms decide what a project may '
+ 'connect, and no published appendix contains any of them.';
function makeUnionFind() {
const parent = new Map();
function find(x) {
if (!parent.has(x)) { parent.set(x, x); return x; }
let root = x;
while (parent.get(root) !== root) root = parent.get(root);
let cursor = x;
while (parent.get(cursor) !== cursor) {
const next = parent.get(cursor);
parent.set(cursor, root);
cursor = next;
}
return root;
}
return {
find,
union(a, b) {
const ra = find(a);
const rb = find(b);
if (ra === rb) return false;
parent.set(ra, rb);
return true;
}
};
}
function assemble(graph, nodeNames, { voltageKv, includeTransformers }) {
const inScope = new Set(nodeNames);
const uf = makeUnionFind();
for (const n of nodeNames) uf.find(n);
const branches = [];
const seen = new Set();
let shorted = 0;
let skippedNoReactance = 0;
for (const name of nodeNames) {
for (const entry of graph.edgesAt(name)) {
if (entry.kind === 'transformer' && !includeTransformers) continue;
const far = entry.row[entry.far];
if (!inScope.has(far)) continue;
if (seen.has(entry.row)) continue;
seen.add(entry.row);
const xPct = entry.row.x_pct_100mva;
if (!Number.isFinite(xPct)) { skippedNoReactance += 1; continue; }
if (xPct === 0) {
if (uf.union(name, far)) shorted += 1;
continue;
}
branches.push({
from: name, to: far, kind: entry.kind,
x_pu: xPct / 100,
row: entry.row
});
}
}
const busOf = (name) => uf.find(name);
const buses = [...new Set(nodeNames.map(busOf))].sort();
const busIndex = new Map(buses.map((b, i) => [b, i]));
const edges = [];
for (const b of branches) {
const i = busIndex.get(busOf(b.from));
const j = busIndex.get(busOf(b.to));
if (i === undefined || j === undefined || i === j) continue;
edges.push({ i, j, b: 1 / b.x_pu, meta: b });
}
const comp = makeUnionFind();
for (const b of buses) comp.find(b);
for (const e of edges) comp.union(buses[e.i], buses[e.j]);
const componentOf = (bus) => comp.find(bus);
const componentSizes = new Map();
for (const b of buses) {
const root = componentOf(b);
componentSizes.set(root, (componentSizes.get(root) || 0) + 1);
}
const degree = new Map();
for (const e of edges) {
degree.set(buses[e.i], (degree.get(buses[e.i]) || 0) + 1);
degree.set(buses[e.j], (degree.get(buses[e.j]) || 0) + 1);
}
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
componentOf,
componentSize: (bus) => componentSizes.get(componentOf(bus)) || 0,
degreeOf: (bus) => degree.get(bus) || 0,
voltage_kv: voltageKv,
includes_transformers: includeTransformers,
buses, busIndex, busOf, edges,
counts: {
nodes: nodeNames.length,
buses: buses.length,
branches: edges.length,
shorted_zero_reactance: shorted,
skipped_no_published_reactance: skippedNoReactance,
components: componentSizes.size,
largest_component: Math.max(0, ...componentSizes.values())
}
};
}
function multiply(model, x, slackIndex) {
const y = new Float64Array(x.length);
for (const e of model.edges) {
if (e.i === slackIndex || e.j === slackIndex) {
if (e.i !== slackIndex) y[e.i] += e.b * x[e.i];
if (e.j !== slackIndex) y[e.j] += e.b * x[e.j];
continue;
}
const d = x[e.i] - x[e.j];
y[e.i] += e.b * d;
y[e.j] -= e.b * d;
}
return y;
}
function solve(model, injection, slackIndex, tolerance, maxIterations) {
const n = model.buses.length;
const x = new Float64Array(n);
let r = new Float64Array(injection);
r[slackIndex] = 0;
let p = new Float64Array(r);
let rr = 0;
for (let k = 0; k < n; k += 1) rr += r[k] * r[k];
const target = tolerance * tolerance * Math.max(rr, 1e-30);
let iterations = 0;
for (; iterations < maxIterations && rr > target; iterations += 1) {
const ap = multiply(model, p, slackIndex);
let pap = 0;
for (let k = 0; k < n; k += 1) pap += p[k] * ap[k];
if (!(Math.abs(pap) > 1e-30)) break;
const alpha = rr / pap;
let rrNext = 0;
for (let k = 0; k < n; k += 1) {
x[k] += alpha * p[k];
r[k] -= alpha * ap[k];
rrNext += r[k] * r[k];
}
const beta = rrNext / rr;
for (let k = 0; k < n; k += 1) p[k] = r[k] + beta * p[k];
rr = rrNext;
}
x[slackIndex] = 0;
return { theta: x, iterations, residual: Math.sqrt(rr) };
}
const SINK_RULE =
'Where no withdrawal bus is declared, the sink is the most connected '
+ 'bus in the SAME component as the injection - the bus with the most '
+ 'published branches landing on it. It is a stated rule, not a '
+ 'convenience: a transfer has two ends and the answer is meaningless '
+ 'without naming both. Declare a sink to override it.';
function sinkFor(model, atNode) {
if (!model || typeof model.componentOf !== 'function') return null;
const atBus = model.busOf(atNode);
const component = model.componentOf(atBus);
let best = null;
let bestDegree = -1;
for (const bus of model.buses) {
if (bus === atBus) continue;
if (model.componentOf(bus) !== component) continue;
const d = model.degreeOf(bus);
if (d > bestDegree || (d === bestDegree && best !== null && bus < best)) {
best = bus;
bestDegree = d;
}
}
return best;
}
function respond(model, options) {
const opts = options || {};
const mw = Number.isFinite(opts.mw) ? opts.mw : 100;
const atBus = model.busOf(opts.atNode);
const slackBus = model.busOf(opts.slackNode);
const i = model.busIndex.get(atBus);
const s = model.busIndex.get(slackBus);
if (i === undefined || s === undefined) return null;
if (i === s) {
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
injected_mw: mw,
at_node: opts.atNode,
slack_node: opts.slackNode,
same_bus: true,
reason: 'the injection point and the slack are the same electrical '
+ 'bus once zero-reactance branches are shorted, so there is no '
+ 'transfer to distribute',
branches: [],
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER
};
}
if (typeof model.componentOf === 'function'
&& model.componentOf(atBus) !== model.componentOf(slackBus)) {
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
injected_mw: mw,
at_node: opts.atNode,
slack_node: opts.slackNode,
same_bus: false,
publishable: false,
reason: 'the injection bus and the withdrawal bus are in different '
+ 'connected components of the published network at this voltage, '
+ 'so there is no transfer between them to distribute. The model '
+ 'has ' + (model.counts ? model.counts.components : 'several')
+ ' components at this voltage; a transfer must be solved within one.',
branches: [],
component: {
injection: model.componentOf(atBus),
slack: model.componentOf(slackBus),
injection_component_buses: model.componentSize(atBus)
},
sink_rule: SINK_RULE,
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER
};
}
const n = model.buses.length;
const p = new Float64Array(n);
p[i] = mw / BASE_MVA;
p[s] = -mw / BASE_MVA;
const solved = solve(model, p, s, 1e-10, Math.min(4 * n, 20000));
const minimumShare = Number.isFinite(opts.minimumShare) ? opts.minimumShare : 0.01;
const flows = [];
for (const e of model.edges) {
const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
const flowMw = flowPu * BASE_MVA;
const share = mw === 0 ? 0 : flowMw / mw;
if (Math.abs(share) < minimumShare) continue;
const row = e.meta.row;
const ratings = {};
for (const [season, field] of [['winter', 'winter_mva'], ['spring', 'spring_mva'],
['summer', 'summer_mva'], ['autumn', 'autumn_mva']]) {
if (Number.isFinite(row[field])) ratings[season] = row[field];
}
flows.push({
from_node: e.meta.from,
to_node: e.meta.to,
kind: e.meta.kind,
x_pct_100mva: e.meta.x_pu * 100,
flow_mw: flowMw,
share_of_injection: share,
published_ratings_mva: Object.keys(ratings).length ? ratings : null,
transformer_rating_mva: e.meta.kind === 'transformer'
&& Number.isFinite(row.rating_mva) ? row.rating_mva : null
});
}
flows.sort((a, b) => Math.abs(b.share_of_injection) - Math.abs(a.share_of_injection));
const net = new Float64Array(model.buses.length);
for (const e of model.edges) {
const flowPu = (solved.theta[e.i] - solved.theta[e.j]) * e.b;
net[e.i] += flowPu;
net[e.j] -= flowPu;
}
const kirchhoff = net[i] * BASE_MVA / (mw || 1);
let worstBusError = 0;
let worstBus = null;
for (let k = 0; k < net.length; k += 1) {
const expected = k === i ? mw / BASE_MVA : (k === s ? -mw / BASE_MVA : 0);
const error = Math.abs(net[k] - expected);
if (error > worstBusError) { worstBusError = error; worstBus = model.buses[k]; }
}
const worstBusMw = worstBusError * BASE_MVA;
return {
schema: SCHEMA,
declared_model: DECLARED_MODEL,
injected_mw: mw,
at_node: opts.atNode,
slack_node: opts.slackNode,
same_bus: false,
branches: flows,
counts: {
branches_in_model: model.edges.length,
branches_carrying_at_least: minimumShare,
branches_reported: flows.length
},
convergence: {
iterations: solved.iterations,
residual: solved.residual,
converged: solved.residual < 1e-6
},
publishable: solved.residual < 1e-6 && worstBusMw < 1e-6 * Math.max(1, mw)
&& Math.abs(kirchhoff - 1) < 1e-6,
sink_rule: SINK_RULE,
component: {
solved_in: typeof model.componentOf === 'function' ? model.componentOf(atBus) : null,
buses_in_component: typeof model.componentSize === 'function' ? model.componentSize(atBus) : null
},
validation: {
kirchhoff_at_injection: kirchhoff,
kirchhoff_error: Math.abs(kirchhoff - 1),
worst_bus_error_mw: worstBusMw,
worst_bus: worstBus,
passes: Math.abs(kirchhoff - 1) < 1e-6
&& worstBusMw < 1e-6 * Math.max(1, mw)
&& solved.residual < 1e-6,
what_it_checks: 'the shares leaving the injection bus must sum to 1.0, '
+ 'AND net flow must be zero at every other bus, AND the solve '
+ 'must have converged. Any one of the three alone can hold while '
+ 'the answer is wrong.'
},
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER
};
}
function modelFor(index, options) {
if (!index || typeof index.graph !== 'function') return null;
const graph = index.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const includeTransformers = opts.includeTransformers === true;
const names = [];
for (const name of (opts.nodeNames || [])) {
if (voltageKv == null || graph.nodeVoltageKv(name) === voltageKv) names.push(name);
}
if (!names.length) return null;
return assemble(graph, names, { voltageKv, includeTransformers });
}
NS.injectionResponse = Object.freeze({
schema: SCHEMA,
requires: REQUIRES,
base_mva: BASE_MVA,
declared_model: DECLARED_MODEL,
not_a_loading: NOT_A_LOADING,
not_a_connection_offer: NOT_A_CONNECTION_OFFER,
sink_rule: SINK_RULE,
modelFor,
assemble,
sinkFor,
respond
});
})();
(() => {
'use strict';
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.plannedChange) return;
const SCHEMA = 'gridatlas.module.planned-change.v1';
const ACCEPTS = 'data-grid-gb.transmission-network.v1';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const NOT_EXISTING =
'Every entry here is a change the network operator has published for '
+ 'a future year. None of it is a circuit or a transformer that exists '
+ 'today, none of it is a path, and none of it is counted among the '
+ 'site\'s circuits anywhere in this estate.';
const NOT_A_COMMITMENT =
'A published plan is the operator\'s current view of network '
+ 'development, and the view moves between editions. It is not a '
+ 'commitment to build, not a consent, and the year on a row is the '
+ 'year it is published for - not a delivery date and not a date on '
+ 'which anything could connect.';
const NOT_AN_ASSESSMENT =
'Nothing here states whether any project can connect at this site, '
+ 'before or after a planned change. That depends on queue position, '
+ 'committed connections, consent and commercial terms which no '
+ 'published appendix contains. A rating on a planned row is the '
+ 'planned asset\'s rating, not a spare allowance.';
const IMPEDANCE_BASIS =
'R, X and B on a planned row are percentages on a 100 MVA base, as '
+ 'published for the planned asset. They are carried and not computed '
+ 'with.';
const STATUS_ORDER = Object.freeze(['Addition', 'Change', 'Removed']);
const ASSETS = Object.freeze(['circuit', 'transformer']);
const asString = (v) => (typeof v === 'string' && v.length ? v : null);
const asNumber = (v) => (Number.isFinite(v) ? v : null);
function statusRank(status) {
const i = STATUS_ORDER.indexOf(status);
return i === -1 ? STATUS_ORDER.length : i;
}
function yearRank(year) {
const n = Number(year);
return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}
function publishedToday(graph, nearNode, farNode) {
const today = { circuit: false, transformer: false };
for (const entry of graph.edgesAt(nearNode)) {
if (entry.row[entry.far] !== farNode) continue;
if (entry.kind === 'circuit') today.circuit = true;
if (entry.kind === 'transformer') today.transformer = true;
}
return today;
}
function index(product) {
if (!product || product.schema !== ACCEPTS) return null;
const topology = NS.networkTopology;
if (!topology || typeof topology.index !== 'function') return null;
const base = topology.index(product);
if (!base || typeof base.graph !== 'function') return null;
const graph = base.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const rows = Array.isArray(product.planned_changes) ? product.planned_changes : [];
const byNode = new Map();
for (const row of rows) {
if (!row) continue;
for (const [near, far] of [['node_1', 'node_2'], ['node_2', 'node_1']]) {
const name = row[near];
if (!name) continue;
if (!byNode.has(name)) byNode.set(name, []);
byNode.get(name).push({ row, near, far });
}
}
const tally = { by_year: {}, by_status: {}, by_asset: {} };
for (const row of rows) {
if (!row) continue;
const y = asString(row.year) || 'unstated';
const s = asString(row.status) || 'unstated';
const a = asString(row.asset) || 'unstated';
tally.by_year[y] = (tally.by_year[y] || 0) + 1;
tally.by_status[s] = (tally.by_status[s] || 0) + 1;
tally.by_asset[a] = (tally.by_asset[a] || 0) + 1;
}
function describe(landing, nearNode) {
const row = landing.row;
const farNode = row[landing.far];
const farSiteCode = graph.nodeSiteCode(farNode) || null;
const farSite = farSiteCode ? graph.siteByCode(farSiteCode) : null;
const nearSiteCode = graph.nodeSiteCode(nearNode) || null;
const asset = asString(row.asset);
const entry = {
publication: 'planned',
year: asString(row.year),
status: asString(row.status),
asset,
from_node: nearNode,
to_node: farNode,
from_site_code: nearSiteCode,
to_site_code: farSiteCode,
to_site_name: farSite ? farSite.name : null,
within_this_site: !!farSiteCode && farSiteCode === nearSiteCode,
from_voltage_kv: graph.nodeVoltageKv(nearNode),
to_voltage_kv: graph.has(farNode) ? graph.nodeVoltageKv(farNode) : null,
transmission_owner: asString(row.transmission_owner),
labels: Array.isArray(row.labels) ? row.labels.slice() : [],
parameters_pct_100mva: graph.parametersOf(row),
pair_published_today: graph.has(farNode)
? publishedToday(graph, nearNode, farNode)
: { circuit: false, transformer: false }
};
if (asset === 'transformer') {
entry.rating_mva = asNumber(row.rating_mva);
entry.voltage_ratio_kv = asString(row.voltage_ratio_kv);
} else {
entry.circuit_type = asString(row.circuit_type);
entry.ohl_km = asNumber(row.ohl_km);
entry.cable_km = asNumber(row.cable_km);
entry.ratings_mva = graph.ratingsOf(row);
}
return entry;
}
function at(key, options) {
const site = base.site(key);
if (!site) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const nodes = graph.nodesOfSite(site.code)
.filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);
const seen = new Set();
const entries = [];
for (const nodeName of nodes) {
for (const landing of byNode.get(nodeName) || []) {
if (seen.has(landing.row)) continue;
seen.add(landing.row);
entries.push(describe(landing, nodeName));
}
}
const years = new Map();
for (const entry of entries) {
const y = entry.year || 'unstated';
if (!years.has(y)) years.set(y, new Map());
const statuses = years.get(y);
const s = entry.status || 'unstated';
if (!statuses.has(s)) statuses.set(s, []);
statuses.get(s).push(entry);
}
const by_year = [...years.entries()]
.sort((a, b) => yearRank(a[0]) - yearRank(b[0]) || a[0].localeCompare(b[0]))
.map(([year, statuses]) => {
const by_status = [...statuses.entries()]
.sort((a, b) => statusRank(a[0]) - statusRank(b[0]) || a[0].localeCompare(b[0]))
.map(([status, list]) => {
list.sort((a, b) => String(a.to_node).localeCompare(String(b.to_node)));
const by_asset = {};
for (const a of ASSETS) by_asset[a] = list.filter((e) => e.asset === a).length;
return { status, entries: list, counts: { entries: list.length, by_asset } };
});
const counts = { entries: 0, by_status: {} };
for (const group of by_status) {
counts.entries += group.counts.entries;
counts.by_status[group.status] = group.counts.entries;
}
return { year, by_status, counts };
});
const counts = { planned_changes: entries.length, by_year: {}, by_status: {}, by_asset: {} };
for (const y of by_year) counts.by_year[y.year] = y.counts.entries;
for (const e of entries) {
const s = e.status || 'unstated';
const a = e.asset || 'unstated';
counts.by_status[s] = (counts.by_status[s] || 0) + 1;
counts.by_asset[a] = (counts.by_asset[a] || 0) + 1;
}
counts.on_a_pair_published_today = entries
.filter((e) => e.pair_published_today.circuit || e.pair_published_today.transformer).length;
return {
schema: SCHEMA,
source: ACCEPTS,
site: { code: site.code, name: site.name },
requested_voltage_kv: voltageKv,
scope: voltageKv == null
? 'rows landing on any node of this site; each entry carries the '
+ 'declared voltage of the node it lands on, and undeclared is '
+ 'undeclared'
: 'rows landing on a node this site declares at ' + voltageKv + ' kV only',
nodes_considered: nodes.length,
by_year,
counts,
not_existing: NOT_EXISTING,
not_a_commitment: NOT_A_COMMITMENT,
not_an_assessment: NOT_AN_ASSESSMENT,
impedance_basis: IMPEDANCE_BASIS
};
}
return {
schema: SCHEMA,
source: ACCEPTS,
counts: Object.assign({ planned_changes: rows.length }, tally),
site: base.site,
at
};
}
NS.plannedChange = Object.freeze({
schema: SCHEMA,
accepts: ACCEPTS,
requires: REQUIRES,
status_order: STATUS_ORDER,
not_existing: NOT_EXISTING,
not_a_commitment: NOT_A_COMMITMENT,
not_an_assessment: NOT_AN_ASSESSMENT,
impedance_basis: IMPEDANCE_BASIS,
index
});
})();
(() => {
'use strict';
const NS = window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {};
if (NS.ownerBoundary) return;
const SCHEMA = 'gridatlas.module.owner-boundary.v1';
const ACCEPTS = 'data-grid-gb.transmission-network.v1';
const REQUIRES = 'gridatlas.module.network-topology.graph.v1';
const NOT_A_COUNTERPARTY =
'The transmission owner is the party the network operator publishes '
+ 'as owning an asset. It is not a statement about who a project would '
+ 'contract with, under what process, or on what terms; none of that '
+ 'is in any published appendix.';
const NOT_AN_ASSESSMENT =
'An ownership boundary is a fact about who publishes which asset. It '
+ 'says nothing about whether any project can connect on either side '
+ 'of it, and a rating on a boundary circuit is that circuit\'s rating, '
+ 'not a spare allowance across the boundary.';
const NEVER_INFERRED =
'An owner is reported only where the product publishes one on the '
+ 'record in question. A node with no published owner is unknown, a '
+ 'circuit with an unknown end is undetermined, and nothing is read '
+ 'from a site name, a node code or a neighbour.';
const UNKNOWN = 'unknown';
const UNDECLARED = 'undeclared';
const asString = (v) => (typeof v === 'string' && v.length ? v : null);
const asNumber = (v) => (Number.isFinite(v) ? v : null);
const bandKey = (kv) => (kv == null ? UNDECLARED : String(kv));
function index(product) {
if (!product || product.schema !== ACCEPTS) return null;
const topology = NS.networkTopology;
if (!topology || typeof topology.index !== 'function') return null;
const base = topology.index(product);
if (!base || typeof base.graph !== 'function') return null;
const graph = base.graph();
if (!graph || graph.schema !== REQUIRES) return null;
const nodeOwner = new Map();
for (const node of product.nodes || []) {
if (node && node.node) nodeOwner.set(node.node, asString(node.transmission_owner));
}
const ownerOfNode = (name) => (nodeOwner.has(name) ? nodeOwner.get(name) : null);
function relation(nearOwner, farOwner) {
if (nearOwner == null || farOwner == null) return 'undetermined';
return nearOwner === farOwner ? 'internal' : 'boundary';
}
function describe(entry, nearNode) {
const row = entry.row;
const farNode = row[entry.far];
const nearOwner = ownerOfNode(nearNode);
const farOwner = graph.has(farNode) ? ownerOfNode(farNode) : null;
const assetOwner = asString(row.transmission_owner);
const nearSiteCode = graph.nodeSiteCode(nearNode) || null;
const farSiteCode = graph.has(farNode) ? graph.nodeSiteCode(farNode) || null : null;
const farSite = farSiteCode ? graph.siteByCode(farSiteCode) : null;
const out = {
kind: entry.kind,
from_node: nearNode,
to_node: farNode,
from_site_code: nearSiteCode,
to_site_code: farSiteCode,
to_site_name: farSite ? farSite.name : null,
within_this_site: !!farSiteCode && farSiteCode === nearSiteCode,
from_voltage_kv: graph.nodeVoltageKv(nearNode),
to_voltage_kv: graph.has(farNode) ? graph.nodeVoltageKv(farNode) : null,
from_owner: nearOwner || UNKNOWN,
to_owner: farOwner || UNKNOWN,
asset_owner: assetOwner || UNKNOWN,
ends: relation(nearOwner, farOwner),
asset_owner_matches_an_end: assetOwner && nearOwner && farOwner
? (assetOwner === nearOwner || assetOwner === farOwner)
: null,
parameters_pct_100mva: graph.parametersOf(row)
};
if (entry.kind === 'circuit') {
out.circuit_type = asString(row.circuit_type);
out.ohl_km = asNumber(row.ohl_km);
out.cable_km = asNumber(row.cable_km);
out.ratings_mva = graph.ratingsOf(row);
} else {
out.rating_mva = asNumber(row.rating_mva);
out.voltage_ratio_kv = asString(row.voltage_ratio_kv);
}
return out;
}
function at(key, options) {
const site = base.site(key);
if (!site) return null;
const opts = options || {};
const voltageKv = Number.isFinite(opts.voltageKv) ? opts.voltageKv : null;
const nodeNames = graph.nodesOfSite(site.code)
.filter((name) => voltageKv == null || graph.nodeVoltageKv(name) === voltageKv);
const nodes = nodeNames.map((name) => ({
node: name,
voltage_kv: graph.nodeVoltageKv(name),
transmission_owner: ownerOfNode(name) || UNKNOWN
}));
const seen = new Set();
const bands = new Map();
const boundary_circuits = [];
const boundary_transformers = [];
const undetermined = [];
const asset_owner_differs = [];
function band(kv) {
const k = bandKey(kv);
if (!bands.has(k)) {
bands.set(k, { voltage_kv: kv, by_owner: {}, circuits: 0, transformers: 0, nodes: 0 });
}
return bands.get(k);
}
function count(b, owner, what) {
const o = owner || UNKNOWN;
if (!b.by_owner[o]) b.by_owner[o] = { nodes: 0, circuits: 0, transformers: 0 };
b.by_owner[o][what] += 1;
b[what] += 1;
}
for (const n of nodes) count(band(n.voltage_kv), n.transmission_owner, 'nodes');
for (const nodeName of nodeNames) {
for (const entry of graph.edgesAt(nodeName)) {
if (seen.has(entry.row)) continue;
seen.add(entry.row);
const d = describe(entry, nodeName);
const b = band(d.from_voltage_kv);
count(b, d.asset_owner === UNKNOWN ? null : d.asset_owner,
entry.kind === 'circuit' ? 'circuits' : 'transformers');
if (d.ends === 'boundary') {
(entry.kind === 'circuit' ? boundary_circuits : boundary_transformers).push(d);
} else if (d.ends === 'undetermined') {
undetermined.push(d);
}
if (d.asset_owner_matches_an_end === false) asset_owner_differs.push(d);
}
}
const by_voltage = [...bands.entries()]
.sort((a, b) => {
if (a[0] === UNDECLARED) return 1;
if (b[0] === UNDECLARED) return -1;
return Number(b[0]) - Number(a[0]);
})
.map(([, b]) => b);
const owners = new Set();
for (const b of by_voltage) for (const o of Object.keys(b.by_owner)) owners.add(o);
const byPair = (list) => list.sort((a, b) =>
String(a.from_node).localeCompare(String(b.from_node))
|| String(a.to_node).localeCompare(String(b.to_node)));
return {
schema: SCHEMA,
source: ACCEPTS,
site: {
code: site.code,
name: site.name,
transmission_owner: asString(site.transmission_owner) || UNKNOWN
},
requested_voltage_kv: voltageKv,
scope: voltageKv == null
? 'every node of this site, counted within its own declared voltage; '
+ 'no count here spans two voltages'
: 'nodes this site declares at ' + voltageKv + ' kV only',
nodes,
by_voltage,
owners_present: [...owners].sort(),
boundary_circuits: byPair(boundary_circuits),
boundary_transformers: byPair(boundary_transformers),
undetermined: byPair(undetermined),
asset_owner_differs_from_both_ends: byPair(asset_owner_differs),
counts: {
nodes: nodes.length,
nodes_with_unknown_owner: nodes.filter((n) => n.transmission_owner === UNKNOWN).length,
owners_present: owners.size,
circuits: by_voltage.reduce((s, b) => s + b.circuits, 0),
transformers: by_voltage.reduce((s, b) => s + b.transformers, 0),
boundary_circuits: boundary_circuits.length,
boundary_transformers: boundary_transformers.length,
undetermined: undetermined.length,
asset_owner_differs_from_both_ends: asset_owner_differs.length
},
not_a_counterparty: NOT_A_COUNTERPARTY,
never_inferred: NEVER_INFERRED,
not_an_assessment: NOT_AN_ASSESSMENT
};
}
function boundaries() {
const out = [];
const seen = new Set();
const pairs = {};
for (const [kind, rows] of [['circuit', product.circuits], ['transformer', product.transformers]]) {
for (const row of rows || []) {
if (!row || seen.has(row)) continue;
seen.add(row);
const d = describe({ kind, row, near: 'node_1', far: 'node_2' }, row.node_1);
if (d.ends !== 'boundary') continue;
out.push(d);
const pair = [d.from_owner, d.to_owner].sort().join('/');
pairs[pair] = (pairs[pair] || 0) + 1;
}
}
return {
schema: SCHEMA,
source: ACCEPTS,
branches: out.sort((a, b) =>
String(a.from_node).localeCompare(String(b.from_node))
|| String(a.to_node).localeCompare(String(b.to_node))),
counts: {
boundary_circuits: out.filter((d) => d.kind === 'circuit').length,
boundary_transformers: out.filter((d) => d.kind === 'transformer').length,
by_owner_pair: pairs
},
not_a_counterparty: NOT_A_COUNTERPARTY,
never_inferred: NEVER_INFERRED,
not_an_assessment: NOT_AN_ASSESSMENT
};
}
const ownerTally = {};
for (const node of product.nodes || []) {
const o = (node && asString(node.transmission_owner)) || UNKNOWN;
ownerTally[o] = (ownerTally[o] || 0) + 1;
}
return {
schema: SCHEMA,
source: ACCEPTS,
counts: {
nodes: nodeOwner.size,
nodes_by_owner: ownerTally
},
site: base.site,
at,
boundaries
};
}
NS.ownerBoundary = Object.freeze({
schema: SCHEMA,
accepts: ACCEPTS,
requires: REQUIRES,
unknown: UNKNOWN,
not_a_counterparty: NOT_A_COUNTERPARTY,
never_inferred: NEVER_INFERRED,
not_an_assessment: NOT_AN_ASSESSMENT,
index
});
})();
(() => {
'use strict';
const SCHEMA = 'gridatlas.module.pinned-products.v1';
const RAW = 'https://raw.githubusercontent.com/Ventusltd/';
const PINS = {
'connection-points.v3': {
repository: 'data-grid-gb',
ref: '1c9909d1138704b29235c27fd769436dda8a0b18',
path: 'derived/connection-points.v3.json',
sha256: '11e28859a6d17cc8ee4047c2032d55d043be98f7123743f3b2b03225e07a4c0c',
bytes: 2896561,
schema: 'data-grid-gb.connection-points.v3'
},
'gb-transmission-network.v1': {
repository: 'data-grid-gb',
ref: '1c9909d1138704b29235c27fd769436dda8a0b18',
path: 'derived/gb-transmission-network.v1.json',
sha256: 'fc331cc20b061f85adf18d890762a164328a1c5e84acef6a23d35d36f849fc8a',
bytes: 10069966,
schema: 'data-grid-gb.transmission-network.v1'
},
'price-decade-rollup': {
repository: 'data-gb-electricity',
ref: 'd310e3cec8cd14bc7cd3eef1e37037197bcb0798',
path: 'derived/price-decade-rollup.json',
sha256: '18da5059c93cf09f6036bfcaabf56afaedf16d5f03e664c3cf0b0cff1dca970d',
bytes: 6873,
schema: 'data-gb-electricity.price-decade-rollup.v2'
}
};
function pin(id) {
return Object.prototype.hasOwnProperty.call(PINS, id) ? PINS[id] : null;
}
function url(id) {
const entry = pin(id);
return entry ? RAW + entry.repository + '/' + entry.ref + '/' + entry.path : null;
}
function encode(text) {
try {
return typeof TextEncoder === 'function'
? new TextEncoder().encode(text) : null;
} catch (_) { return null; }
}
async function digestBytes(bytes) {
try {
const subtle = (window.crypto || {}).subtle;
if (!subtle || !bytes) return null;
const digest = await subtle.digest('SHA-256', bytes);
return Array.from(new Uint8Array(digest))
.map(byte => byte.toString(16).padStart(2, '0')).join('');
} catch (_) {
return null;
}
}
async function digestHex(text) {
return digestBytes(encode(text));
}
async function verify(id, text) {
const entry = pin(id);
const bytes = encode(text);
const seen = bytes ? bytes.length : null;
if (!entry) {
return { state: 'unverified: no pin for ' + String(id), sha256: null,
expected: null, ref: null, bytes_seen: seen, bytes_expected: null };
}
const digest = await digestBytes(bytes);
const answer = { sha256: digest, expected: entry.sha256, ref: entry.ref,
bytes_seen: seen, bytes_expected: entry.bytes };
if (seen !== null && seen !== entry.bytes) {
answer.state = 'MISMATCH';
answer.detail = 'the response at ' + entry.ref + ' is ' + seen
+ ' bytes, not the recorded ' + entry.bytes;
} else if (digest === null) {
answer.state = 'unverified: no subtle crypto in this context';
} else if (digest === entry.sha256) {
answer.state = 'verified';
} else {
answer.state = 'MISMATCH';
answer.detail = 'bytes at ' + entry.ref + ' hash to ' + digest
+ ', not the recorded ' + entry.sha256;
}
return answer;
}
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
NS.pinnedProducts = Object.freeze({
schema: SCHEMA,
ids: Object.freeze(Object.keys(PINS)),
pin,
url,
digestHex,
verify,
why: 'A branch ref lets an immutable release change what it says without '
+ 'any of its own bytes changing. The schema string defends shape and is '
+ 'blind to values: a correction to data-grid-gb halves published '
+ 'transformer counts under the same schema. The ref is a commit and the '
+ 'bytes are hashed, so a data correction and a map release are one event.',
not_an_assessment: 'A pin says which bytes were read. It says nothing '
+ 'about whether those bytes are right.'
});
})();
(() => {
'use strict';
const VERSION_LEDGER = [{"g":"202608312121","v":"v9.16","s":"the project arriving from Pipeline News is visible: its own technology layer is enabled and a pin owned by this cartridge is dropped on it, with a toggle on the card"},{"g":"202608312133","v":"v9.17","s":"central AC sizing: the limiting nameplate, not a squared product"},{"g":"202608312140","v":"v9.18","s":"the project marker is a ring, found by looking at it in Chrome"},{"g":"202608312154","v":"v9.19","s":"the grid maths installs even when the basemap never paints"},{"g":"202608312157","v":"v9.20","s":"the Atlas says what it is waiting for, sized for a phone"},{"g":"202608312205","v":"v9.21","s":"the MapLibre exception storm: symbol layers with no glyph atlas"},{"g":"202608312208","v":"v9.22","s":"a symbol layer is added only once its text can be drawn"},{"g":"202608312222","v":"v9.23","s":"card geometry resets on every selection"},{"g":"202608312227","v":"v9.24","s":"the GB electricity tracker is connected to the map"},{"g":"202608312238","v":"v9.25","s":"one source of truth for GB prices: the data repository"},{"g":"202608312244","v":"v9.26","s":"late layer controls are used, and the repository is LF everywhere"},{"g":"202608312257","v":"v9.27","s":"the MAP button works for every technology in the register"},{"g":"202608312300","v":"v9.28","s":"voltage classes are explained, and the whole dashboard is accepted"},{"g":"202608312306","v":"v9.29","s":"the headline capacity actually moves the layout"},{"g":"202608312313","v":"v9.30","s":"the neon flow no longer exhausts the renderer"},{"g":"202608312315","v":"v9.31","s":"Codex's LineAtlas cardinality gate passes"},{"g":"202608312317","v":"v9.32","s":"no substation can display an impossible voltage"},{"g":"202608312321","v":"v9.33","s":"nothing can rewrite the reference design, not even later"},{"g":"202608312324","v":"v9.34","s":"a missing source costs a drawing, never the session"},{"g":"202609010021","v":"v9.35","s":"phone pointer operation, viewport containment and named electrical ratios"},{"g":"202609010040","v":"v9.36","s":"original financial-model parity with explicit correction of the known central AC double-count"},{"g":"202609010053","v":"v9.37","s":"complete the original finance interaction contract by linking development stage, cost and success"},{"g":"202609010058","v":"v9.38","s":"restore topology-isolated physical inputs and the original mounting-to-bifacial linkage"},{"g":"202609010106","v":"v9.39","s":"remove duplicate BESS truth, restore original central defaults and reject fractional topology counts"},{"g":"202609010204","v":"v9.40","s":"the version ledger itself, on the page"},{"g":"202609010722","v":"v9.41","s":"exact GB price evidence, beside the ledger"},{"g":"202609010726","v":"v9.42","s":"the price panel revalidates instead of pinning its first sight"},{"g":"202609010902","v":"v9.43","s":"mobile: tools collapse behind one chip; grid and subs are one tap"},{"g":"202609011141","v":"v9.44","s":"a repd_ref-only link computes the links: identity resolved by the search lane is consumed, not re-required from the URL"},{"g":"202609011205","v":"v9.45","s":"arrival: fullscreen on touch, the identity wait runs to its end, and every stage says what it is doing"},{"g":"202609011215","v":"v9.46","s":"the distances survive the card: a keeper re-attaches the measurement block when a late popup replaces the one it decorated"},{"g":"202609011242","v":"v9.47","s":"the arrival owns its card: 2,421 register-absent projects (873 solar) get a card from the link's own fields, yielded if the register's card lands"},{"g":"202609011243","v":"v9.48","s":"supersedes v9.47's boundary: the composition was sound, its proof shipped one stale check; re-sealed coherent"},{"g":"202609011244","v":"v9.49","s":"supersedes v9.48, whose boundary shipped without its proof file; same composition, re-sealed whole"},{"g":"202609011251","v":"v9.50","s":"the card precedes the lines: a register-absent arrival opened its card after drawing, and the lines-belong-to-the-card watcher rightly wiped them"},{"g":"202609011433","v":"v9.51","s":"the 400 kV public record: declared DCO connections drawn and carded, new customer substations named, nearest 400 kV measured for every project"},{"g":"202609011434","v":"v9.52","s":"a recovered failure is not a failure: late-arrival entries move to their own ledger when the controls arrive, per the Codex supervision finding"},{"g":"202609011435","v":"v9.53","s":"the consented works on the card: customer-substation and PoC interface quotes from the made Orders; the nearest-400 row gains its named companion"},{"g":"202609011612","v":"v9.54","s":"the measurement no longer waits for the engine's layer controls: links draw at once, layers follow when they arrive"},{"g":"202609011615","v":"v9.55","s":"the sales surface answers at once: a declared 400 kV connection and its citation are on the card before the payload arrives, the distance following it"},{"g":"202609011718","v":"v9.56","s":"pink for a point of connection not yet built, and a declared connection that is a circuit rather than a substation draws no line at all"},{"g":"202609011805","v":"v9.58","s":"service restored: v9.57 claimed a shell script the shell never loads, so the composer refused it and the map went dark"},{"g":"202609011820","v":"v9.59","s":"the substation cartridge returns through the engine slot, and the card gains what NESO publishes: circuits, ratings, fault current and planned changes"},{"g":"202609011845","v":"v9.60","s":"the manifest states its own identity, and the Subs control is found by its attribute rather than by label text that changes"},{"g":"202609011915","v":"v9.61","s":"the network sentence names its own scope: a site-wide envelope across the voltages present, never a value for the declared bus"},{"g":"202609012020","v":"v9.62","s":"the Grid Finding Scope: a click on blank space says what grid is mapped there, in bands, and what that cannot tell you"},{"g":"202609012045","v":"v9.63","s":"fault current is quoted at the voltage the connection is made at, not across every busbar at the site"},{"g":"202609012110","v":"v9.64","s":"the Grid Finding Scope stops censusing a voltage that did not parse, and every assembled cartridge is checked against the parts it was built from"},{"g":"202609012130","v":"v9.65","s":"the page's version ledger is written by the cut, so it cannot tell a reader it is running the generation before the one it is running"},{"g":"202609012155","v":"v9.66","s":"the geodesy module measures on the estate's canonical haversine, so every version ever shipped returns the same distance to the last digit"},{"g":"202609012250","v":"v9.67","s":"one geodesy for the whole cartridge, a click reports which cartridges answered it, and the zoom the deep link has always sent is finally read"},{"g":"202609012141","v":"v9.68","s":"sld-sandbox: the declared-connections table moves out of the body into a module proven value-for-value against the last inline copy; the network-topology module (proven 47/47 at 202609012145, composed into nothing until now) is wired on demand - the 10 MB ETYS node/branch product is fetched on first click, never at load, and project and scope cards fill an ETYS topology block in place; the source registry reports the loader's true state instead of ready for a module on a shelf; and this stamp is read from the clock, which is why it sorts before the typed one it succeeds."},{"g":"202609012211","v":"v9.69","s":"sld-sandbox: the sizing arithmetic (physical inputs, the three named ratios, string and central nameplates, the finance port and the two-variable capacity fit) leaves the body for the sizing-arithmetic module, lifted mechanically expression for expression and proven value-for-value against the last inline copy; the body keeps one-line delegations so no caller changes"},{"g":"202609012234","v":"v9.70","s":"the composition manifest is proven against the bytes: substation-intelligence declares connection-points.v3 as it has required since v9.65 (the entry said v2 from v9.63 until this cut), sld-sandbox declares the transmission network and the price rollup it fetches, a data-contract parity proof holds every entry to its bytes in both directions, the source registry states what each fetching source requires in every state and registers the GB conditions loader, whose state the sandbox now publishes"},{"g":"202609012243","v":"v9.71","s":"the Atlas measures in the operator's own circuits as well as in kilometres: an electrical-distance module traverses the published node/branch model, a voltage changes only across a named transformer and a circuit that appears to change voltage is refused and recorded, planned changes are never walked as if they existed today, every hop carries its published rating and its R/X/B untouched, and the card names what lies two hops away"},{"g":"202609012249","v":"v9.72","s":"the card reports every season the operator publishes rather than winter alone, each circuit keeping its own rating and its own season, scoped to the connection voltage; four circuits published at 9,999 MVA on spans of a kilometre or less are named as placeholders and excluded from the range while still being reported; and the module that produces all of this contains no code path that adds two ratings together, which its proof asserts structurally"},{"g":"202609012308","v":"v9.73","s":"the Atlas solves a declared DC injection response on the published node/branch model and reports which circuits would carry a project's stated capacity and what fraction each takes, with the equations, the 100 MVA base, the named slack and every assumption carried in the answer; validated to 1e-9 against networks whose solutions are exact by hand and checked for power conservation at every intermediate bus of the real 400 kV network; it never states a loading, because existing flows are published nowhere"},{"g":"202609012317","v":"v9.74","s":"the grid computation is reachable from the map itself: a tool arms a point query, and a click on open map resolves the nearest published connection points and renders the published circuits, the seasonal ratings, the electrical distance in hops and the declared powerflow against the nearest one, saying every time that 384 of the 886 published points have no coordinates so the nearest MAPPED point may not be the nearest point; and the layers dash collapses and restores on any device without entering fullscreen, the choice remembered per browser"},{"g":"202609012345","v":"v9.75","s":"the card reports what the operator has published as planned in its own sentence - by year, by status and by asset, with the published parameters carried - kept structurally apart from what exists today, because a row published for a future year is not a circuit now, not a commitment, not a consent and not a connection date"},{"g":"202609020006","v":"v9.76","s":"the computation moves to the cartridge that owns it: the five modules that read the operator's published network leave the sandbox for substation-intelligence, which is split into the two halves it has always been - the V8 engine carried verbatim and the intelligence itself - and gains the parts manifest it should always have had; the sandbox drops from 95% of its 400 kB boundary to about 79%, and the new owner-boundary module lands beside its siblings, naming which transmission owners the assets at a site belong to and where two of them meet on one circuit"},{"g":"202609020018","v":"v9.77","s":"the powerflow stops choosing an arbitrary withdrawal bus: the published 400 kV network has 238 connected components, a transfer across two of them does not exist, and the card was asking for one - it now uses a declared sink rule, refuses a cross-component transfer before the solver is asked, accepts an answer only on convergence AND a global residual AND Kirchhoff at every bus rather than at the injection bus alone, says plainly when no answer is available, and counts parallel circuits as the separate published rows they are rather than collapsing those that share a reactance"},{"g":"202609030059","v":"v9.78","s":"a PIPELINE NEWS (REPD) section in the layer dashboard that summons the rest of the pipeline around the selected project"},{"g":"202609030109","v":"v9.79","s":"the site card counts transformers as machines rather than as winding connections: a site owns both ends of its own transformers, so every internal machine was published twice and Cowley's five read as ten"},{"g":"202609030116","v":"v9.80","s":"HIDE LAYERS collapsed the element that contains the map, so on a phone the one control that gets past the layer panel blanked the application and the remembered choice blanked it again on reload"},{"g":"202609030119","v":"v9.81","s":"a deep link carrying coordinates but no register identity moved no camera at all: both lanes that own the arrival stand down at the same identity test, and the zoom was then eased without a centre ever being set"},{"g":"202609030128","v":"v9.82","s":"an unrecognised project technology abandoned the whole arrival - the card, the ring, the measurement and the substation layer - when the only thing that needs to know what a project generates is the one technology layer"},{"g":"202609030137","v":"v9.83","s":"the three products this Atlas reads at runtime are pinned to a commit and checked by their SHA-256, because a schema string defends shape and is blind to values"},{"g":"202609030151","v":"v9.84","s":"the proof reads the published products through the pin the composition declares, by commit and by digest, and a product it cannot get fails those checks loudly instead of skipping them"},{"g":"202609030156","v":"v9.85","s":"the version ledger leaves the sandbox body for the cartridge that has room for it, because the sandbox stood 600 characters short of the guard its own proof asserts and every cut adds another row"},{"g":"202609030200","v":"v9.86","s":"the nearest 400 kV superlative carries the sample it was drawn from, counted at render time from the payload actually fetched rather than written into the sentence"},{"g":"202609030233","v":"v9.87","s":"a straight line is not a route: beside every measured distance the card now prints an indicative highway-corridor estimate, with the calibration it came from and the questions it is not an answer to"},{"g":"202609030234","v":"v9.88","s":"a 44 pixel action opens the corridor figures in full, reachable by button, by right-click and by a long press that stands down for a pan, a pinch and any drag already under way"},{"g":"202609031316","v":"v9.89","s":"the measurement stops reading technology: the one branch that gated it is removed, so offshore measures to the nearest mapped substation instead of withholding, and a module owns which sentences go under the distances rather than which technologies get one"},{"g":"202609031751","v":"v9.90","s":"the measurement arrives before the intelligence that qualifies it, and on a phone the card docks to the bottom edge instead of hanging off a marker: nothing is printed over it and nothing has to be dragged to reach it"},{"g":"202609031809","v":"v9.91","s":"the register owns the coordinates on every repd_ref arrival, not only when the link is malformed, and which source won is published with the distance between them"},{"g":"202609032001","v":"v9.92","s":"collapse the chrome into File, Edit, View and About at the top, closed at rest"},{"g":"202609032005","v":"v9.93","s":"the menu bar fails soft where there is no timer, as its own comment claimed"},{"g":"202609032012","v":"v9.94","s":"restamp both cartridges so every manifest names the generation it is part of"},{"g":"202609032041","v":"v9.95","s":"withdraw the menu bar from the live Atlas on two testers' evidence"},{"g":"202609032213","v":"v9.96","s":"the layer panel opens closed, so the map is the first impression"},{"g":"202609032222","v":"v9.97","s":"a deep link is not a search: the results list and the box it filled get out of the way"},{"g":"202609032246","v":"v9.98","s":"the arrival frames the project by the viewport, so a shared link is not wide and empty on a desktop"},{"g":"202609032315","v":"v9.99","s":"the ceiling warning light reports the limit that can actually fail the build"},{"g":"202609040021","v":"v9.100","s":"Consolidate the existing interface into exactly File, Edit, View, Scope, Grid, and About menus; expose all 60 engine and 3 Pipeline News layer controls through their original handlers; preserve nested Scope and Clear actions; remain closed at rest and fail closed unless all 63 unique layer controls exist."},{"g":"202609040046","v":"v9.101","s":"Valid Pipeline coordinates measure before concurrent REPD verification; every canonical technology reaches the exact receiver; the mobile menu remains hittable above the docked project card; transit bridge hydration executes to a populated source; pipeline layers move to the network cartridge to preserve SLD headroom."},{"g":"202609040047","v":"v9.102","s":"The production receiver uses its exported measure-first plan for all valid Pipeline coordinates, records link provenance, reconciles resolved identity atomically, accepts every canonical technology, and preserves mobile layer hit targets plus executable transit hydration."},{"g":"202609040058","v":"v9.103","s":"A late REPD identity can no longer resurrect an abandoned deep-link arrival: every user selection and clear invalidates the pending token, while intended first and corrected selections carry the current token through asynchronous measurement."},{"g":"202609040134","v":"v9.104","s":"mobile fullscreen no longer creates an ancestor cycle, and Grid keeps each layer tick plus its live V8 status visible"},{"g":"202609040219","v":"v9.105","s":"A successfully fetched transit source is reported available only when its configured MapLibre layer can draw at least one matching feature; zero eligible features become visibly EMPTY, unticked, disabled and non-interactive while quarantined data and historical generations remain unchanged."},{"g":"202609040337","v":"v9.106","s":"Pipeline 0144 arrivals absent from the active register retain their supplied identity and measurement with explicit provenance; real resolver failures remain failures with a working single-epoch owner-to-measurement retry, stale arrival ownership cannot reclaim the map, and the legacy receiver issues no cross-domain Pipeline request."},{"g":"202609040403","v":"v9.107","s":"Move seven byte-identical SLD stylesheet templates into the earlier substation cartridge, fail closed if the module is absent, and restore bounded headroom without changing UI behaviour."},{"g":"202609041221","v":"v9.108","s":"the OSM/CARTO/Open Charge Map credit clears the menu bar unconditionally, measured from the bar's own rendered height, at every width -- not only while body.fs-active happens to be set"},{"g":"202609041244","v":"v9.109","s":"Pipeline News' three broken technology buckets (wind_onshore, wind_offshore, other) resolve to the engine's real layer id through one table instead of a set-membership test that read enabled while the layer sat off, on a third of the register; substation-intelligence carried forward unchanged to keep the on-page version ledger current"},{"g":"202609041250","v":"v9.110","s":"the v8 VENTUS masthead is fused into the six-menu bar's own centre so it is present at every width and cannot be torn into a closed panel and vanish after arrival; the SCADA layer panel is restored with the real, moved-not-cloned .scada-brand and .status-legend nodes and every layer control on a full-size >=44px hit target; every one of the six panels is anchored to its own side group and clamped into the viewport by measurement; and the OSM/CARTO/Open Charge Map credit now outranks every open panel by z-index, not only clearing the bar's own height"},{"g":"202609041330","v":"v9.111","s":"Hide the v8 fullscreen letterhead whenever the menu bar hosts the fused VENTUS masthead, so a phone arrival shows one wordmark in the bar instead of two and the SCOPE, GRID and ABOUT titles are unobscured."},{"g":"202609041945","v":"v9.112","s":"Compose the written-but-never-composed iOS Safari visibility fix so a deep link opened in a background tab is not spent before anyone can see it; share one DuckDB runtime across the two cartridges that each built their own; and keep the GRID and SUBS chips on the map at phone widths instead of inside a menu."},{"g":"202609041956","v":"v9.114","s":"Bring the on-page version ledger up to the composition a reader is actually looking at, so its newest entry names this generation rather than an earlier one."},{"g":"202609041957","v":"v9.115","s":"Bring the arrival cartridge and the cartridge carrying the version ledger onto one generation, so every proof, the ledger's newest entry and the composition a reader is looking at all name the same thing."},{"g":"202609042123","v":"v9.116","s":"Bring the v8 layers panel back beneath the menu bar, open on a desktop and collapsed with its toggle visible on a phone, while keeping every dropdown - FILE, EDIT, VIEW, SCOPE, GRID and ABOUT - exactly as it is."},{"g":"202609050238","v":"v9.117","s":"About: the map attribution moves in, last and in small print, and an Estate group of three links sits above it. File: the engine's canonical modules are listed, fetched once from the engine's own published graph, each linking into it focused on itself. No other panel, control or layer changed."},{"g":"202609050244","v":"v9.118","s":"File: list every node the engine graph publishes, grouped canonical / extract / reference / fragment, not only the canonical eleven; add one copyable command that clones the engine and runs its own gate. No other panel, control or layer changed."},{"g":"202609050249","v":"v9.119","s":"The copyable engine command drops its install step, because the engine has no dependencies and its gate opens no socket. No other change."},{"g":"202609050301","v":"v9.120","s":"View gains a Studies group carrying the GB electricity price and grid constraint series 2016-2026. No other panel, control or layer changed."},{"g":"202609050354","v":"v9.121","s":"File gains an Export group: print the view as a slide, or save it as an image. The print sizes to whatever page the reader chose, portrait or landscape, on a phone or a desktop. The image capture happens inside a render frame and is sampled for non-transparent pixels before it is offered. Both paths carry the attribution."}];
const REJECTED_PRE_PROMOTION = Object.freeze({
'202609040021': 'never live: the mobile project card could cover the engine layer panel',
'202609040046': 'never live: its generation proof reported 748/755',
'202609040047': 'never live: a late identity could restore an arrival after a user selection or clear'
});
for (const entry of VERSION_LEDGER) {
if (!REJECTED_PRE_PROMOTION[entry.g]) continue;
entry.status = 'REJECTED_PRE_PROMOTION';
entry.reason = REJECTED_PRE_PROMOTION[entry.g];
}
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
NS.versionLedger = Object.freeze({
schema: 'gridatlas.module.version-ledger.v1',
entries: VERSION_LEDGER,
written_by: 'tools/recompose.mjs, at the cut, never by hand',
not_an_assessment: 'A ledger row says what a generation changed. It does '
+ 'not say the change was right, and nothing here grades one.'
});
})();
(() => {
'use strict';
const SCHEMA = 'gridatlas.module.corridor-estimate.v1';
const CABLE_FACTOR = 1.245;
const OHL_FACTOR = 1.13;
const MINIMUM_KM = 1;
const BASIS = Object.freeze({
factor: CABLE_FACTOR,
median_absolute_error_pct: 8.45,
within_15_pct: 73,
circuits: 95,
distinct_site_pairs: 59,
source: 'published built lengths of GB transmission cable circuits',
sample_note: 'parallel circuits between the same two sites duplicate the '
+ 'geometry, so the sample is 59 distinct site pairs and not 95 circuits',
minimum_separation_km: MINIMUM_KM,
below_minimum: 'under about a kilometre the site-centroid resolution '
+ 'dominates: median published length 0.59 km against a median error of '
+ '52.5%, so a straight line between centroids is not measuring route '
+ 'factor and no estimate is offered'
});
const CAVEAT = 'Indicative highway-corridor screening only. Not a connection '
+ 'offer, not a constructability assessment and not a consenting design.';
const NOT_FOR_OVERHEAD = 'Calibrated on cable circuits, which follow the '
+ 'highway network. Overhead line crosses open country and measures 1.13; '
+ 'this factor is not applied to an overhead-line question.';
function forCable(km) {
const straight = Number(km);
if (!Number.isFinite(straight) || straight <= 0) return null;
if (straight < MINIMUM_KM) {
return { km: null, factor: CABLE_FACTOR, straight_km: straight,
withheld: BASIS.below_minimum };
}
return {
km: straight * CABLE_FACTOR,
factor: CABLE_FACTOR,
straight_km: straight,
withheld: null
};
}
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
NS.corridorEstimate = Object.freeze({
schema: SCHEMA,
factor: CABLE_FACTOR,
overhead_factor: OHL_FACTOR,
minimum_km: MINIMUM_KM,
basis: BASIS,
caveat: CAVEAT,
not_for_overhead: NOT_FOR_OVERHEAD,
forCable,
not_an_assessment: 'An estimated corridor length says nothing about '
+ 'whether a connection is available, consentable or affordable.'
});
})();
(function gridAtlasMenuBar() {
'use strict';
if (typeof window === 'undefined' || typeof document === 'undefined') return;
var SCHEMA = 'gridatlas.menu-bar.v2';
var BAR_ID = 'gridatlas-menu-bar';
var STYLE_ID = BAR_ID + '-css';
var FAILURE_ID = BAR_ID + '-failure';
var MENUS = ['File', 'Edit', 'View', 'Scope', 'Grid', 'About'];
var EXPECTED_ENGINE_LAYERS = 60;
var EXPECTED_PIPELINE_LAYERS = 3;
var EXPECTED_LAYER_CONTROLS = 63;
var MAX_TRIES = 160;
var NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.menuBar && NS.menuBar.schema === SCHEMA) return;
var state = {
schema: SCHEMA,
menus: MENUS.slice(),
bar_id: BAR_ID,
installed: false,
controls_moved: 0,
layer_controls: 0,
engine_layer_controls: 0,
pipeline_layer_controls: 0,
expected_layer_controls: EXPECTED_LAYER_CONTROLS,
panel_counts: {},
failure: null,
tries: 0,
listeners: 0,
closed_at_rest: true,
one_identity_surface: false
};
NS.menuBar = state;
var bar = null;
var panels = {};
var titles = [];
var layerTargets = Object.create(null);
var layerProxies = Object.create(null);
var forwardingLayerChoice = false;
var observer = null;
var timer = null;
var brandSlot = null;
var gridHead = null;
var gridBody = null;
function array(value) {
return Array.prototype.slice.call(value || []);
}
function cleanText(value) {
return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
function layerKey(input) {
if (!input || !input.getAttribute) return '';
var engine = input.getAttribute('data-layer-id');
if (engine) return 'engine:' + engine;
var pipeline = input.getAttribute('data-pn-layer');
return pipeline ? 'pipeline:' + pipeline : '';
}
function layerLabel(input) {
var label = input && input.closest ? input.closest('label') : null;
var span = label && label.querySelector
? label.querySelector('[data-base-label], [data-pn-label], span') : null;
var base = span && span.getAttribute ? span.getAttribute('data-base-label') : '';
var text = cleanText((span && span.textContent) || base
|| (label && label.textContent) || layerKey(input).split(':').slice(1).join(':'));
return text || layerKey(input);
}
function layerGroup(input) {
var group = input && input.closest ? input.closest('.key-group') : null;
var title = group && group.querySelector ? group.querySelector('.key-title') : null;
return cleanText(title && title.textContent) || 'Other layers';
}
function inventory(doc) {
var host = doc.getElementById('scada-ui-container');
var engine = host ? array(host.querySelectorAll(
'input[type="checkbox"][data-layer-id]')) : [];
var pipeline = host ? array(host.querySelectorAll(
'input[type="checkbox"][data-pn-layer]')) : [];
var controls = engine.concat(pipeline);
var keys = controls.map(layerKey);
var unique = new Set(keys);
return {
host: host,
engine: engine,
pipeline: pipeline,
controls: controls,
keys: keys,
complete: engine.length === EXPECTED_ENGINE_LAYERS
&& pipeline.length === EXPECTED_PIPELINE_LAYERS
&& controls.length === EXPECTED_LAYER_CONTROLS
&& unique.size === EXPECTED_LAYER_CONTROLS
&& !keys.includes('')
};
}
state.inspect = function () {
var found = inventory(document);
return {
engine: found.engine.length,
pipeline: found.pipeline.length,
total: found.controls.length,
unique: new Set(found.keys).size,
complete: found.complete
};
};
function required(doc) {
var found = inventory(doc);
var nodes = {
host: doc.querySelector('.map-container'),
stack: doc.querySelector('.map-controls'),
search: doc.querySelector('.search-bar-wrapper'),
header: doc.querySelector('.hud-header'),
exportButton: doc.getElementById('btn-export'),
statusButton: doc.getElementById('btn-status'),
fullscreenButton: doc.getElementById('btn-fullscreen'),
radiusButton: doc.getElementById('btn-radius'),
radiusAreaButton: doc.getElementById('btn-radius-area'),
zoneButton: doc.getElementById('btn-zonedraw'),
measureButton: doc.getElementById('btn-measure')
};
var missing = Object.keys(nodes).filter(function (key) { return !nodes[key]; });
if (!found.complete) missing.push('63 unique layer controls');
return { found: found, nodes: nodes, missing: missing };
}
function installStyle(doc) {
if (doc.getElementById(STYLE_ID)) return;
var style = doc.createElement('style');
style.id = STYLE_ID;
style.textContent = [
'#' + BAR_ID + '{position:absolute;top:0;left:0;right:0;height:36px;z-index:10020;',
'display:flex;align-items:stretch;gap:0;padding-left:env(safe-area-inset-left);',
'padding-right:env(safe-area-inset-right);box-sizing:border-box;',
'background:rgba(4,10,13,.95);border-bottom:1px solid rgba(80,220,240,.3);',
'font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;',
'-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);',
'isolation:isolate;pointer-events:auto}',
'#' + BAR_ID + ' .gm-menu{position:relative;min-width:0}',
'#' + BAR_ID + ' .gm-title{appearance:none;border:0;background:transparent;color:#cfeef6;',
'min-height:36px;padding:0 11px;cursor:pointer;font:inherit;letter-spacing:.05em;',
'text-transform:uppercase;white-space:nowrap}',
'#' + BAR_ID + ' .gm-title:hover,#' + BAR_ID + ' .gm-title:focus-visible,',
'#' + BAR_ID + ' .gm-menu.gm-open>.gm-title{background:rgba(80,220,240,.16);color:#fff}',
'#' + BAR_ID + ' .gm-title:focus-visible,#' + BAR_ID + ' .gm-panel :focus-visible{',
'outline:2px solid #6bebff;outline-offset:-2px}',
'#' + BAR_ID + ' .gm-side{display:flex;align-items:stretch;flex:1 1 0;min-width:0}',
'#' + BAR_ID + ' .gm-side-left{justify-content:flex-start}',
'#' + BAR_ID + ' .gm-side-right{justify-content:flex-end}',
'#' + BAR_ID + ' .gm-brand-slot{flex:0 1 auto;min-width:0;max-width:64%;',
'display:flex;align-items:center;justify-content:center;overflow:hidden;',
'padding:0 6px;text-align:center}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header{display:flex!important;',
'position:static!important;width:auto!important;align-items:center;',
'justify-content:center;gap:11px;margin:0!important;padding:0!important;',
'background:none!important;border:0!important}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header>div{flex:0 0 auto;line-height:1.05}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header small{font-size:6.5px;white-space:nowrap}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header .hud-val{font-size:10.5px;',
'text-shadow:none}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:14px;font-weight:800;',
'letter-spacing:.2em;margin:0;color:#fff}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:5.5px;letter-spacing:.14em}',
'#' + BAR_ID + ' .gm-panel{position:absolute;top:100%;left:0;min-width:240px;',
'max-width:min(92vw,420px);max-height:min(72dvh,620px);overflow:auto;',
'overscroll-behavior:contain;padding:6px;background:rgba(4,10,13,.98);',
'border:1px solid rgba(80,220,240,.32);border-top:0;',
'box-shadow:0 12px 34px rgba(0,0,0,.68);box-sizing:border-box}',
'#' + BAR_ID + ' .gm-panel[hidden]{display:none!important}',
'#' + BAR_ID + ' .gm-side-right .gm-panel{left:auto;right:0}',
'#' + BAR_ID + ' .gm-panel button,#' + BAR_ID + ' .gm-panel [role="button"]{',
'display:flex;align-items:center;width:100%;min-height:44px;box-sizing:border-box;',
'position:static!important;inset:auto!important;transform:none!important;margin:0 0 3px;',
'padding:7px 10px;border:0;border-radius:2px;background:transparent;color:#cfeef6;',
'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:left;',
'letter-spacing:.03em;text-transform:none;cursor:pointer}',
'#' + BAR_ID + ' .gm-panel button:hover,#' + BAR_ID + ' .gm-panel [role="button"]:hover{',
'background:rgba(80,220,240,.14);color:#fff}',
'#' + BAR_ID + ' .gm-panel a[data-gm-estate],#' + BAR_ID + ' .gm-panel a[data-gm-engine],',
'#' + BAR_ID + ' .gm-panel a[data-gm-study]',
'{text-decoration:none}',
'#' + BAR_ID + ' .gm-panel a[data-gm-engine]{white-space:nowrap;overflow:hidden;',
'text-overflow:ellipsis;display:block;line-height:30px;min-height:44px}',
'#' + BAR_ID + ' .gm-panel .custom-map-attrib{position:static!important;',
'inset:auto!important;margin:4px 0 2px;padding:6px 8px;max-width:none;',
'background:transparent;border:0;white-space:normal;line-height:1.45;',
'font:10px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fb6c0}',
'#' + BAR_ID + ' .gm-layer-group{margin:5px 0 2px;padding:6px 8px 3px;',
'border-top:1px solid #19343b;color:#6fa2ae;font-size:10px;letter-spacing:.08em;',
'text-transform:uppercase}',
'#' + BAR_ID + ' .gm-layer{position:relative;display:flex;align-items:center;gap:10px;',
'min-height:44px;box-sizing:border-box;padding:7px 9px;color:#cfeef6;cursor:pointer;',
'line-height:1.35}',
'#' + BAR_ID + ' .gm-layer:hover{background:rgba(80,220,240,.12)}',
'#' + BAR_ID + ' .gm-layer input{position:absolute;inset:0;width:100%;height:100%;',
'margin:0;opacity:0;cursor:pointer;z-index:1}',
'#' + BAR_ID + ' .gm-layer-box{width:20px;height:20px;flex:0 0 auto;',
'border:1.5px solid #4a8b96;border-radius:4px;position:relative;',
'background:rgba(255,255,255,.04)}',
'#' + BAR_ID + ' .gm-layer input:checked~.gm-layer-box{background:#4fd7ee;',
'border-color:#4fd7ee}',
'#' + BAR_ID + ' .gm-layer input:checked~.gm-layer-box::after{content:"";',
'position:absolute;left:6px;top:2px;width:5px;height:10px;',
'border:solid #04141a;border-width:0 2px 2px 0;transform:rotate(38deg)}',
'#' + BAR_ID + ' .gm-layer input:focus-visible~.gm-layer-box{outline:2px solid #6bebff;',
'outline-offset:2px}',
'#' + BAR_ID + ' .gm-layer-name{overflow-wrap:anywhere}',
'#' + BAR_ID + ' .gm-panel-grid{padding:0;overflow:hidden;display:flex;',
'flex-direction:column;min-width:min(94vw,360px);max-width:min(96vw,900px)}',
'#' + BAR_ID + ' .gm-panel-head{flex:0 0 auto;padding:8px 8px 0}',
'#' + BAR_ID + ' .gm-panel-head .scada-brand{padding:0 0 6px;margin:0 0 6px}',
'#' + BAR_ID + ' .gm-panel-head .status-legend{padding:0 0 8px;margin:0;border:0}',
'#' + BAR_ID + ' .gm-panel-body{flex:1 1 auto;overflow:auto;',
'overscroll-behavior:contain;padding:6px;min-height:0}',
'@media(min-width:560px){#' + BAR_ID + ' .gm-panel-body{column-count:2;',
'column-gap:14px}',
'#' + BAR_ID + ' .gm-panel-body .gm-layer-group{break-inside:avoid}',
'#' + BAR_ID + ' .gm-panel-body .gm-layer{break-inside:avoid}}',
'@media(min-width:900px){#' + BAR_ID + ' .gm-panel-body{column-count:3}}',
'#' + BAR_ID + ' .search-bar-wrapper{position:static!important;display:grid!important;',
'grid-template-columns:minmax(150px,1fr) auto;width:min(82vw,390px);gap:5px;margin:2px 0 6px}',
'#' + BAR_ID + ' .search-bar-wrapper>div{position:relative}',
'#' + BAR_ID + ' .search-input{width:100%!important;min-height:44px;box-sizing:border-box}',
'#' + BAR_ID + ' .search-results{position:static!important;max-height:42vh;overflow:auto}',
'#' + BAR_ID + ' .disclaimer-box,#' + BAR_ID + ' .podcast-shoutout{',
'display:block!important;position:static!important;max-width:380px;padding:8px;',
'box-sizing:border-box;text-align:left;pointer-events:auto}',
'.gridatlas-menu-hosted .map-controls[data-gridatlas-menu-emptied="1"]{display:none!important}',
'.gridatlas-menu-hosted .scada-wrapper{display:flex!important}',
'#gridatlas-dash-toggle{display:inline-flex!important}',
'html.gridatlas-sheet-open #' + BAR_ID + '{z-index:10020!important;pointer-events:auto!important}',
'html.gridatlas-sheet-open #' + BAR_ID + ' .gm-panel{pointer-events:auto!important}',
'body:not(.fs-active) #' + BAR_ID + ' #btn-fullscreen-exit{display:none!important}',
'body.fs-active #' + BAR_ID + ' #btn-fullscreen-exit{display:flex!important}',
'.gridatlas-menu-hosted .custom-map-attrib{',
'top:var(--gridatlas-menu-bar-clear,44px)!important;z-index:10025!important}',
'.gridatlas-menu-hosted #fs-letterhead{display:none!important}',
'@media(max-width:700px){#' + BAR_ID + '{height:34px}',
'#' + BAR_ID + ' .gm-title{min-height:34px;padding:0 6px;font-size:9px;letter-spacing:.025em}',
'#' + BAR_ID + ' .gm-brand-slot{max-width:48%;padding:0 2px}',
'#' + BAR_ID + ' .gm-brand-slot .hud-header>div:first-child,',
'#' + BAR_ID + ' .gm-brand-slot .hud-header>div:last-child{display:none}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-main{font-size:11px;letter-spacing:.14em}',
'#' + BAR_ID + ' .gm-brand-slot .ventus-sub{font-size:4.5px}',
'#' + BAR_ID + ' .gm-panel{position:fixed;top:34px;left:4px!important;right:4px!important;',
'width:auto;max-width:none;max-height:calc(100dvh - 40px);padding-bottom:',
'calc(6px + env(safe-area-inset-bottom))}',
'#' + BAR_ID + ' .gm-panel-grid{max-width:none}}'
].join('');
(doc.head || doc.documentElement).appendChild(style);
}
function syncAttribClearance(doc) {
if (!bar || typeof bar.getBoundingClientRect !== 'function') return;
var root = doc.documentElement;
if (!root || !root.style || typeof root.style.setProperty !== 'function') return;
var rect = bar.getBoundingClientRect();
var height = Math.ceil(rect.height) || 36;
var clearance = height + 8;
root.style.setProperty('--gridatlas-menu-bar-clear', clearance + 'px');
state.attrib_clearance_px = clearance;
}
function closeAll(focusTitle) {
if (!bar) return;
array(bar.querySelectorAll('.gm-menu.gm-open')).forEach(function (menu) {
menu.classList.remove('gm-open');
var title = menu.querySelector('.gm-title');
var panel = menu.querySelector('.gm-panel');
if (title) title.setAttribute('aria-expanded', 'false');
if (panel) panel.hidden = true;
});
state.closed_at_rest = true;
openPanelRefs = null;
if (focusTitle && typeof focusTitle.focus === 'function') focusTitle.focus();
}
function syncLayer(key) {
var original = layerTargets[key];
var proxy = layerProxies[key];
if (!original || !proxy) return;
proxy.checked = !!original.checked;
proxy.disabled = !!original.disabled;
proxy.setAttribute('aria-label', layerLabel(original));
var name = proxy.parentNode && proxy.parentNode.querySelector
? proxy.parentNode.querySelector('.gm-layer-name') : null;
if (name) {
var nextLabel = layerLabel(original);
if (name.textContent !== nextLabel) name.textContent = nextLabel;
}
}
function syncAll() {
Object.keys(layerTargets).forEach(syncLayer);
}
function clampPanel(doc, menu, panel) {
if (!panel || typeof panel.getBoundingClientRect !== 'function') return;
if (!menu || typeof menu.getBoundingClientRect !== 'function') return;
panel.style.left = '';
panel.style.right = '';
var view = doc.defaultView || (typeof window !== 'undefined' ? window : null);
var vw = (view && view.innerWidth) || doc.documentElement.clientWidth;
if (!vw) return;
var margin = 4;
var panelRect = panel.getBoundingClientRect();
var desiredLeft = panelRect.left;
if (panelRect.left < margin) desiredLeft = margin;
else if (panelRect.right > vw - margin) desiredLeft = Math.max(margin, vw - margin - panelRect.width);
if (Math.round(desiredLeft) === Math.round(panelRect.left)) return;
var menuRect = menu.getBoundingClientRect();
panel.style.left = (desiredLeft - menuRect.left) + 'px';
panel.style.right = 'auto';
}
var openPanelRefs = null;
function openMenu(menu, title, panel) {
var wasOpen = menu.classList.contains('gm-open');
closeAll();
if (wasOpen) { openPanelRefs = null; return; }
if (title.textContent === 'Grid') syncAll();
menu.classList.add('gm-open');
title.setAttribute('aria-expanded', 'true');
panel.hidden = false;
state.closed_at_rest = false;
openPanelRefs = { menu: menu, panel: panel };
clampPanel(title.ownerDocument || document, menu, panel);
}
function buildBar(doc) {
var nav = doc.createElement('nav');
nav.id = BAR_ID;
nav.setAttribute('aria-label', 'Atlas menu');
var left = doc.createElement('div');
left.className = 'gm-side gm-side-left';
var right = doc.createElement('div');
right.className = 'gm-side gm-side-right';
var brand = doc.createElement('div');
brand.className = 'gm-brand-slot';
brandSlot = brand;
MENUS.forEach(function (name, index) {
var menu = doc.createElement('div');
menu.className = 'gm-menu';
var title = doc.createElement('button');
title.type = 'button';
title.className = 'gm-title';
title.textContent = name;
title.id = BAR_ID + '-title-' + index;
title.setAttribute('aria-haspopup', 'menu');
title.setAttribute('aria-expanded', 'false');
title.setAttribute('aria-controls', BAR_ID + '-panel-' + index);
var panel = doc.createElement('div');
panel.className = 'gm-panel';
panel.id = BAR_ID + '-panel-' + index;
panel.hidden = true;
panel.setAttribute('role', 'group');
panel.setAttribute('aria-labelledby', title.id);
if (name === 'Grid') {
var head = doc.createElement('div');
head.className = 'gm-panel-head';
var body = doc.createElement('div');
body.className = 'gm-panel-body';
panel.appendChild(head);
panel.appendChild(body);
panel.classList.add('gm-panel-grid');
gridHead = head;
gridBody = body;
}
title.addEventListener('click', function (event) {
event.stopPropagation();
openMenu(menu, title, panel);
});
menu.appendChild(title);
menu.appendChild(panel);
(index < 3 ? left : right).appendChild(menu);
panels[name] = panel;
titles.push(title);
});
nav.appendChild(left);
nav.appendChild(brand);
nav.appendChild(right);
nav.addEventListener('keydown', function (event) {
var active = doc.activeElement;
var index = titles.indexOf(active);
if (event.key === 'Escape') {
var owner = active && active.closest ? active.closest('.gm-menu') : null;
var ownerTitle = owner && owner.querySelector ? owner.querySelector('.gm-title') : null;
closeAll(ownerTitle);
event.preventDefault();
return;
}
if (index < 0) return;
if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
var delta = event.key === 'ArrowRight' ? 1 : -1;
titles[(index + delta + titles.length) % titles.length].focus();
event.preventDefault();
} else if (event.key === 'Home' || event.key === 'End') {
titles[event.key === 'Home' ? 0 : titles.length - 1].focus();
event.preventDefault();
} else if (event.key === 'ArrowDown') {
var ownerMenu = active.closest('.gm-menu');
var ownerPanel = ownerMenu.querySelector('.gm-panel');
openMenu(ownerMenu, active, ownerPanel);
var first = ownerPanel.querySelector('button,input,[role="button"]');
if (first && first.focus) first.focus();
event.preventDefault();
}
});
return nav;
}
function appendGroup(panel, text) {
var heading = document.createElement('div');
heading.className = 'gm-layer-group';
heading.textContent = text;
panel.appendChild(heading);
}
var ESTATE_LINKS = [
{ href: 'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph',
text: 'Grid engine · the maths' },
{ href: 'https://ventusltd.github.io/data-federation-map-for-globalgrid2050-all-repos/dashboard/sandbox/spider_full_po_test.html',
text: 'Federation map' },
{ href: 'https://ventusltd.github.io/spiders/spider_printer_v1/',
text: 'Spider printer' }
];
var ENGINE_GRAPH_URL =
'https://ventusltd.github.io/ventus-grid-engine/genome/engine-graph.json';
var ENGINE_VIEW_URL =
'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph&focus=';
var engineFetchStarted = false;
function appendEngineModules(panel) {
if (!panel || !window.fetch || engineFetchStarted) return;
if (panel.querySelector('[data-gm-engine]')) return;
engineFetchStarted = true;
fetch(ENGINE_GRAPH_URL, { cache: 'no-cache' }).then(function (response) {
if (!response.ok) throw new Error('HTTP ' + response.status);
return response.json();
}).then(function (graph) {
var nodes = (graph && graph.nodes) || [];
if (!nodes.length || panel.querySelector('[data-gm-engine]')) return;
var ORDER = ['canonical', 'extract', 'reference', 'fragment'];
var FALLBACK_LABEL = {
canonical: 'Engine · the maths this runs on',
extract: 'Extracts',
reference: 'References',
fragment: 'Copies elsewhere in the estate'
};
var kindLabels = (graph && graph.kind_labels) || {};
var byKind = {};
nodes.forEach(function (node) {
if (!node || !node.label) return;
var kind = node.type || 'other';
if (!byKind[kind]) byKind[kind] = [];
byKind[kind].push(node);
});
var kinds = ORDER.filter(function (k) { return byKind[k]; })
.concat(Object.keys(byKind).filter(function (k) { return ORDER.indexOf(k) < 0; }).sort());
var RUN_COMMAND =
'git clone https://github.com/Ventusltd/ventus-grid-engine'
+ ' && cd ventus-grid-engine && node verify.mjs';
appendGroup(panel, 'Run the engine yourself · offline, no dependencies');
var run = document.createElement('button');
run.setAttribute('data-gm-engine', '1');
run.setAttribute('type', 'button');
run.title = RUN_COMMAND;
run.textContent = '⧉ Copy: clone the engine and run its 133 checks';
run.addEventListener('click', function () {
var done = function (ok) {
run.textContent = ok
? '✓ Copied — paste it into a terminal'
: '⧉ ' + RUN_COMMAND;
};
try {
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(RUN_COMMAND).then(function () { done(true); },
function () { done(false); });
} else {
done(false);
}
} catch (_) { done(false); }
});
panel.appendChild(run);
var total = 0;
kinds.forEach(function (kind) {
var group = byKind[kind];
group.sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'en-GB'); });
appendGroup(panel, (FALLBACK_LABEL[kind] || kindLabels[kind] || kind) + ' · ' + group.length);
group.forEach(function (node) {
var a = document.createElement('a');
a.setAttribute('data-gm-engine', '1');
a.setAttribute('role', 'button');
a.href = ENGINE_VIEW_URL + encodeURIComponent(node.label);
a.target = '_blank';
a.rel = 'noopener';
a.textContent = node.label;
if (node.reason) a.title = node.reason;
panel.appendChild(a);
total += 1;
});
});
state.engine_modules = total;
}).catch(function () {
state.engine_modules = 0;
});
}
var STUDY_LINKS = [
{ href: 'https://globalgrid2050.com/data/grid_studies_public/'
+ 'great_britain_electricity_price_grid_constraint_trends_2016_2026.html',
text: 'GB electricity price & grid constraint trends · 2016–2026' }
];
function appendStudies(panel) {
if (!panel || panel.querySelector('[data-gm-study]')) return 0;
appendGroup(panel, 'Studies');
var added = 0;
STUDY_LINKS.forEach(function (item) {
var a = document.createElement('a');
a.setAttribute('data-gm-study', '1');
a.setAttribute('role', 'button');
a.href = item.href;
a.target = '_blank';
a.rel = 'noopener';
a.textContent = item.text;
panel.appendChild(a);
added += 1;
});
return added;
}
function exportStamp() {
var now = new Date();
return now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
function attributionText(doc) {
var node = doc.querySelector('.custom-map-attrib');
return cleanText(node && node.textContent)
|| 'Data © OpenStreetMap contributors | © CARTO | EV data © Open Charge Map';
}
function generationText() {
var atlas = window.__GRIDATLAS_ATLAS__;
var generation = (atlas && atlas.generation)
|| (document.documentElement && document.documentElement.dataset
&& document.documentElement.dataset.gridatlasGeneration);
return generation ? 'generation ' + generation : '';
}
function buildPrintFurniture(doc) {
var box = doc.createElement('div');
box.id = 'gridatlas-print-furniture';
var selected = doc.querySelector('.project-popup .name, .gm-panel .project-name');
var title = cleanText(selected && selected.textContent) || 'GlobalGrid2050 · Grid Atlas';
box.innerHTML =
'<div class="gpf-head"><span class="gpf-brand">VENTUS</span>'
+ '<span class="gpf-sub">GLOBAL GRID 2050 · GRID ATLAS</span></div>'
+ '<div class="gpf-title"></div>'
+ '<div class="gpf-foot"><span class="gpf-attrib"></span>'
+ '<span class="gpf-stamp"></span></div>';
box.querySelector('.gpf-title').textContent = title;
box.querySelector('.gpf-attrib').textContent = attributionText(doc);
box.querySelector('.gpf-stamp').textContent =
[generationText(), exportStamp()].filter(Boolean).join(' · ');
doc.body.appendChild(box);
return box;
}
function installPrintStyle(doc) {
if (doc.getElementById('gridatlas-print-css')) return;
var style = doc.createElement('style');
style.id = 'gridatlas-print-css';
style.textContent = [
'#gridatlas-print-furniture{display:none}',
'@media print{',
'  #' + BAR_ID + '{display:none!important}',
'  #gridatlas-print-furniture{display:block;position:fixed;inset:0;',
'    padding:8mm;box-sizing:border-box;pointer-events:none;z-index:9;',
'    font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0b1416}',
'  #gridatlas-print-furniture .gpf-head{letter-spacing:.28em;font-size:13px}',
'  #gridatlas-print-furniture .gpf-brand{font-weight:700;margin-right:10px}',
'  #gridatlas-print-furniture .gpf-sub{opacity:.65;letter-spacing:.16em}',
'  #gridatlas-print-furniture .gpf-title{margin-top:4mm;font-size:20px;',
'    letter-spacing:.02em;max-width:70%}',
'  #gridatlas-print-furniture .gpf-foot{position:absolute;left:10mm;right:10mm;',
'    bottom:8mm;display:flex;justify-content:space-between;gap:8mm;',
'    font-size:9px;opacity:.75}',
'  @page{size:auto;margin:8mm}',
'  html,body{background:#fff!important;height:100%!important;',
'    margin:0!important;padding:0!important;overflow:hidden!important}',
'  body{display:flex!important;flex-direction:column!important}',
'  .map-container{',
'    flex:1 1 auto!important;min-height:0!important;width:100%!important;',
'    max-height:100%!important}',
'  #map,.maplibregl-map,.maplibregl-canvas-container{',
'    height:100%!important;width:100%!important;max-height:100%!important}',
'  .maplibregl-canvas{width:100%!important;height:100%!important;',
'    object-fit:contain}',
'  body>*{break-inside:avoid;page-break-inside:avoid}',
'  body{page-break-after:avoid}',
'}'
].join('');
doc.head.appendChild(style);
}
function printView(doc) {
var map = window.__GRIDATLAS_V9_MAP__;
var canvas = map && map.getCanvas && map.getCanvas();
if (!canvas) return;
var capture = function () {
var url;
try { url = canvas.toDataURL('image/png'); } catch (_) { return; }
if (looksBlank(canvas)) return;
var old = doc.getElementById('gridatlas-print-furniture');
if (old) old.remove();
var furniture = buildPrintFurniture(doc);
var image = doc.createElement('img');
image.className = 'gpf-map'; image.alt = 'Current Grid Atlas map'; image.src = url;
furniture.appendChild(image);
var style = doc.getElementById('gridatlas-print-css');
if (!style) { style = doc.createElement('style'); style.id = 'gridatlas-print-css'; doc.head.appendChild(style); }
style.textContent = '#gridatlas-print-furniture{display:none}' +
'@media print{@page{size:auto;margin:8mm}html,body{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important;background:white!important}' +
'body>*:not(#gridatlas-print-furniture){display:none!important}' +
'#gridatlas-print-furniture{display:block!important;position:fixed;inset:0;box-sizing:border-box;padding:4mm;background:white;color:#101c22;font:11px/1.4 system-ui}' +
'.gpf-head{font-size:12px;letter-spacing:2px}.gpf-brand{font-weight:bold;margin-right:10px}.gpf-title{font-size:18px;margin-top:3mm}' +
'.gpf-map{position:absolute;left:4mm;top:22mm;width:calc(100% - 8mm);height:calc(100% - 42mm);object-fit:contain}' +
'.gpf-foot{position:absolute;left:4mm;right:4mm;bottom:3mm;display:flex;gap:12px;justify-content:space-between;font-size:9px}.gpf-stamp{white-space:nowrap}}';
var clean = function () { furniture.remove(); window.removeEventListener('afterprint', clean); };
window.addEventListener('afterprint', clean);
image.decode().then(function () { window.print(); }).catch(clean);
window.setTimeout(clean, 300000);
};
map.once('render', capture); map.triggerRepaint();
}
function looksBlank(canvas) {
try {
var probe = document.createElement('canvas');
probe.width = 40; probe.height = 40;
var context = probe.getContext('2d');
context.drawImage(canvas, 0, 0, 40, 40);
var data = context.getImageData(0, 0, 40, 40).data;
for (var i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
return true;
} catch (_) {
return false;
}
}
function saveImage(doc, button) {
var map = window.__GRIDATLAS_V9_MAP__;
if (!map || !map.getCanvas) {
map = (window.map && window.map.getCanvas) ? window.map : null;
}
var canvas = doc.querySelector('.maplibregl-canvas')
|| (map && map.getCanvas ? map.getCanvas() : null);
var say = function (text) { button.textContent = text; };
if (!canvas) { say('⊘ No map canvas to save — use Print'); return; }
var grab = function () {
var url;
try { url = canvas.toDataURL('image/png'); } catch (_) { url = null; }
if (!url || looksBlank(canvas)) {
say('⊘ The map could not be captured — use Print instead');
return;
}
var link = doc.createElement('a');
link.href = url;
link.download = 'gridatlas-' + exportStamp().replace(/[^0-9]/g, '').slice(0, 12) + '.png';
doc.body.appendChild(link);
link.click();
doc.body.removeChild(link);
say('✓ Image saved');
window.setTimeout(function () { say('⤓ Save an image of this view'); }, 4000);
};
if (map && map.once && map.triggerRepaint) {
map.once('render', grab);
map.triggerRepaint();
} else {
grab();
}
}
function appendExport(panel, doc) {
if (!panel || panel.querySelector('[data-gm-export]')) return 0;
appendGroup(panel, 'Export this view');
var print = doc.createElement('button');
print.setAttribute('data-gm-export', '1');
print.setAttribute('type', 'button');
print.textContent = '⎙ Print · or save as PDF';
print.addEventListener('click', function () { printView(doc); });
panel.appendChild(print);
var image = doc.createElement('button');
image.setAttribute('data-gm-export', '1');
image.setAttribute('type', 'button');
image.textContent = '⤓ Save an image of this view';
image.addEventListener('click', function () { saveImage(doc, image); });
panel.appendChild(image);
return 2;
}
function appendEstateLinks(panel) {
if (!panel || panel.querySelector('[data-gm-estate]')) return 0;
appendGroup(panel, 'Estate');
var added = 0;
ESTATE_LINKS.forEach(function (item) {
var a = document.createElement('a');
a.setAttribute('data-gm-estate', '1');
a.setAttribute('role', 'button');
a.href = item.href;
a.target = '_blank';
a.rel = 'noopener';
a.textContent = item.text;
panel.appendChild(a);
added += 1;
});
return added;
}
function layerCheckbox(kind) {
var proxy = document.createElement('input');
proxy.type = kind;
var box = document.createElement('span');
box.className = 'gm-layer-box';
box.setAttribute('aria-hidden', 'true');
return { proxy: proxy, box: box };
}
function buildLayerControls(found) {
var lastGroup = '';
found.controls.forEach(function (original) {
var key = layerKey(original);
var group = layerGroup(original);
if (group !== lastGroup) {
appendGroup(gridBody, group);
lastGroup = group;
}
var label = document.createElement('label');
label.className = 'gm-layer';
label.setAttribute('data-gridatlas-layer-key', key);
var built = layerCheckbox('checkbox');
var proxy = built.proxy;
proxy.setAttribute('data-gridatlas-layer-proxy', key);
var name = document.createElement('span');
name.className = 'gm-layer-name';
label.appendChild(proxy);
label.appendChild(built.box);
label.appendChild(name);
gridBody.appendChild(label);
layerTargets[key] = original;
layerProxies[key] = proxy;
proxy.addEventListener('change', function () {
if (!!original.checked !== !!proxy.checked && typeof original.click === 'function') {
forwardingLayerChoice = true;
try { original.click(); }
finally { forwardingLayerChoice = false; }
}
syncLayer(key);
});
syncLayer(key);
});
var basemaps = array(found.host.querySelectorAll('input[type="radio"][name="bm"]'));
if (basemaps.length) appendGroup(gridBody, 'Basemap');
basemaps.forEach(function (original) {
var label = document.createElement('label');
label.className = 'gm-layer';
var built = layerCheckbox('radio');
var proxy = built.proxy;
proxy.name = 'gridatlas-menu-basemap';
proxy.value = original.value;
proxy.checked = !!original.checked;
var name = document.createElement('span');
name.className = 'gm-layer-name';
name.textContent = cleanText(original.closest('label').textContent) || original.value;
proxy.addEventListener('change', function () {
if (proxy.checked && !original.checked && typeof original.click === 'function') original.click();
closeAll();
});
label.appendChild(proxy);
label.appendChild(built.box);
label.appendChild(name);
gridBody.appendChild(label);
});
}
function move(panel, node, label) {
if (!node || !panel || (bar && bar.contains(node))) return false;
if (label && node.setAttribute) node.setAttribute('aria-label', label);
panel.appendChild(node);
if (node.removeAttribute) node.removeAttribute('hidden');
state.controls_moved += 1;
return true;
}
function trayRoute(node) {
var text = cleanText(node && node.textContent).toLowerCase();
if (/\bclear\b|\bscope\b/.test(text)) return 'Scope';
if (/\bgrid\b|\bsubs\b/.test(text)) return 'Grid';
return '';
}
function chipStaysOnMap(node) {
var text = cleanText(node && node.textContent).toLowerCase();
if (!/\bgrid\b|\bsubs\b/.test(text)) return false;
var coarse = false;
try {
coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
} catch (error) {
coarse = false;
}
var width = Number(window.innerWidth);
var narrow = isFinite(width) && width > 0 && width <= 700;
return coarse || narrow;
}
function adoptLate(doc) {
if (!bar) return;
move(panels.View, doc.getElementById('gridatlas-gb-conditions'));
move(panels.About, doc.getElementById('gridatlas-version-ledger'));
move(panels.View, doc.getElementById('btn-fullscreen-exit'), 'Exit full screen');
var curtain = doc.getElementById('fs-curtain-tab');
if (curtain && !bar.contains(curtain)) {
curtain.setAttribute('role', 'button');
curtain.setAttribute('tabindex', '0');
curtain.setAttribute('aria-label', 'Open the fullscreen layer curtain');
move(panels.Grid, curtain);
}
var tray = doc.getElementById('gridatlas-mobile-tray');
if (tray) {
array(tray.querySelectorAll('button')).forEach(function (button) {
if (chipStaysOnMap(button)) return;
var route = trayRoute(button);
if (route) move(panels[route], button);
else button.hidden = true;
});
}
move(panels.Scope, doc.getElementById('btn-gridpoint'));
var disclaimer = doc.querySelector('.disclaimer-box');
var shoutout = doc.querySelector('.podcast-shoutout');
move(panels.About, disclaimer);
move(panels.About, shoutout);
state.estate_links = appendEstateLinks(panels.About);
appendEngineModules(panels.File);
state.export_controls = appendExport(panels.File, doc);
state.studies = appendStudies(panels.View);
var attrib = doc.querySelector('.custom-map-attrib');
if (attrib) {
if (!bar || !bar.contains(attrib)) move(panels.About, attrib);
else if (panels.About.lastElementChild !== attrib) panels.About.appendChild(attrib);
}
var dashToggle = doc.getElementById('gridatlas-dash-toggle');
if (dashToggle) dashToggle.hidden = false;
var stack = doc.querySelector('.map-controls');
if (stack) {
var leftovers = array(stack.querySelectorAll('button,input,select,textarea,a'))
.filter(function (node) { return !node.hidden; });
if (leftovers.length === 0) stack.setAttribute('data-gridatlas-menu-emptied', '1');
}
MENUS.forEach(function (name) {
state.panel_counts[name] = panels[name] ? panels[name].children.length : 0;
});
}
function install(doc) {
if (state.installed || doc.getElementById(BAR_ID)) return true;
var ready = required(doc);
state.engine_layer_controls = ready.found.engine.length;
state.pipeline_layer_controls = ready.found.pipeline.length;
state.layer_controls = ready.found.controls.length;
if (ready.missing.length) {
state.waiting_for = ready.missing.slice();
return false;
}
installStyle(doc);
bar = buildBar(doc);
buildLayerControls(ready.found);
if (ready.nodes.search) ready.nodes.search.setAttribute("data-testcode-search", "persistent");
move(panels.File, ready.nodes.exportButton);
move(panels.Edit, ready.nodes.statusButton);
move(panels.View, ready.nodes.fullscreenButton);
move(panels.Scope, ready.nodes.radiusButton);
move(panels.Scope, ready.nodes.radiusAreaButton);
move(panels.Scope, ready.nodes.zoneButton);
move(panels.Scope, ready.nodes.measureButton);
move(brandSlot, ready.nodes.header);
move(gridHead, doc.querySelector('.scada-brand'));
move(gridHead, doc.querySelector('.status-legend'));
ready.nodes.host.insertBefore(bar, ready.nodes.host.firstChild);
doc.documentElement.classList.add('gridatlas-menu-hosted');
syncAttribClearance(doc);
if (typeof ResizeObserver === 'function') {
var barResize = new ResizeObserver(function () {
syncAttribClearance(doc);
if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
});
barResize.observe(bar);
state.attrib_clearance_source = 'ResizeObserver';
} else if (doc.defaultView && typeof doc.defaultView.addEventListener === 'function') {
doc.defaultView.addEventListener('resize', function () {
syncAttribClearance(doc);
if (openPanelRefs) clampPanel(doc, openPanelRefs.menu, openPanelRefs.panel);
});
state.attrib_clearance_source = 'resize-listener';
}
doc.addEventListener('click', function (event) {
if (!bar.contains(event.target)) {
if (!forwardingLayerChoice) closeAll();
}
else if (event.target && /^(BUTTON|INPUT)$/.test(event.target.tagName || '')) {
if (event.target.type !== 'text'
&& !event.target.classList.contains('gm-title')
&& !event.target.hasAttribute('data-gridatlas-layer-proxy')) {
window.setTimeout ? window.setTimeout(closeAll, 0) : closeAll();
}
}
});
doc.addEventListener('change', function (event) {
var key = layerKey(event.target);
if (key && layerProxies[key]) syncLayer(key);
});
state.listeners = 2;
adoptLate(doc);
closeAll();
state.installed = true;
state.waiting_for = [];
state.failure = null;
state.one_identity_surface = true;
state.mobile_sheet_hit_target_guard = true;
state.layer_status_mirrored = true;
state.layer_menu_stays_open = true;
if (typeof MutationObserver === 'function') {
observer = new MutationObserver(function () {
adoptLate(doc);
syncAll();
});
observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
}
return true;
}
state.install = function () { return install(document); };
state.closeAll = closeAll;
function loudFailure(doc) {
if (state.installed || doc.getElementById(FAILURE_ID)) return;
var found = inventory(doc);
state.failure = 'menu not installed: expected 60 engine + 3 Pipeline News layer controls; found '
+ found.engine.length + ' + ' + found.pipeline.length;
if (window.console && typeof window.console.error === 'function') {
window.console.error('[GRIDATLAS MENU] ' + state.failure);
}
var alert = doc.createElement('div');
alert.id = FAILURE_ID;
alert.setAttribute('role', 'alert');
alert.textContent = state.failure + '. Original controls remain available.';
alert.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:10030;'
+ 'padding:8px;background:#280b0b;color:#ffd0d0;border:1px solid #b44;'
+ 'font:11px/1.4 monospace';
(doc.body || doc.documentElement).appendChild(alert);
}
function start() {
if (!document.documentElement || typeof document.createElement !== 'function') {
state.failure = 'menu not installed: full document unavailable';
return;
}
var probe = document.createElement('div');
if (!probe || typeof probe.setAttribute !== 'function' || !probe.classList) {
state.failure = 'menu not installed: full DOM element API unavailable';
return;
}
if (install(document)) return;
if (typeof window.setInterval !== 'function'
|| typeof window.clearInterval !== 'function') return;
timer = window.setInterval(function () {
state.tries += 1;
if (install(document)) {
window.clearInterval(timer);
timer = null;
} else if (state.tries >= MAX_TRIES) {
window.clearInterval(timer);
timer = null;
loudFailure(document);
}
}, 250);
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
start();
}
}());
;(() => {
const style=document.createElement('style');style.textContent=`
 .search-bar-wrapper{display:flex!important;position:absolute!important;top:64px!important;left:12px!important;right:12px!important;width:auto!important;max-width:520px!important;z-index:1100!important;margin:0!important;transform:none!important}
 .search-bar-wrapper input{min-height:48px!important;font-size:16px!important;width:100%!important;box-sizing:border-box}
 .testcode-identity{position:fixed;right:12px;bottom:64px;z-index:2000;background:#08161fee;color:#aaf6ff;padding:8px;border:1px solid #36616a;font:12px monospace;text-decoration:none}
 @media print{.testcode-identity,.search-bar-wrapper{display:none!important}}
 `;document.head.append(style);
const link=document.createElement('a');link.className='testcode-identity';link.href='/testcode/202609051906/';link.textContent='Test Code · 202609051906';document.body.append(link);
})();
(function arrivalTidy() {
if (typeof document === 'undefined' || typeof window === 'undefined') return;
if (typeof MutationObserver !== 'function') return;
var ref = '';
try {
ref = String(new URLSearchParams(window.location.search).get('repd_ref') || '').trim();
} catch (_) { return; }
if (!ref) return;
var typed = false;
var done = false;
function tidy() {
if (done) return true;
var state = document.body && document.body.dataset
? document.body.dataset.gridatlasRepdDeepLink : '';
if (state !== 'resolved') return state === 'failed';
var results = document.getElementById('search-results');
var input = document.getElementById('search-input');
if (!results || !input) return false;
if (!typed) {
results.style.display = 'none';
if (input.value === ref) input.value = '';
}
done = true;
return true;
}
function retire() { typed = true; }
function watch() {
var input = document.getElementById('search-input');
if (input) {
input.addEventListener('focus', retire, { once: true });
input.addEventListener('input', retire, { once: true });
}
if (tidy()) return;
var observer = new MutationObserver(function () {
if (tidy()) observer.disconnect();
});
observer.observe(document.body, {
attributes: true, attributeFilter: ['data-gridatlas-repd-deep-link']
});
window.__GRIDATLAS_ARRIVAL_TIDY__ = {
installed: true,
repd_ref: ref,
get dismissed() { return done; },
get retired_by_reader() { return typed; }
};
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', watch, { once: true });
} else {
watch();
}
}());
(() => {
'use strict';
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.pipelineNewsLayers) return;
const geodesy = NS.geodesy;
if (!geodesy) {
throw new Error('pipeline-news-layers requires the geodesy module');
}
const GENERATION = '202609030048';
const RADIUS_KM = 25;
const GROUP_TITLE = 'PIPELINE NEWS (REPD)';
const REGISTER_SOURCE = 'src-repd';
const REGISTER_PRIMER = 'biomass';
const SPINE_TECHS = new Set(['solar', 'solar_roof', 'bess', 'wind']);
const TECH_COLOUR = {
solar: '#ffff00', solar_roof: '#ffcc00', bess: '#ffae00', wind: '#00ffff',
biomass: '#39ff14', hydro: '#00aaff', hydrogen: '#ffffff', tidal: '#00bfff',
act: '#ff6600', geothermal: '#ff3300', flywheel: '#ff69b4', caes: '#88aaff',
other: '#888888'
};
const CONTROLS = [
{
id: 'same',
label: 'Same technology',
colour: '#5fbdc2',
keep: (row, selection) => row.tech === selection.tech
},
{
id: 'wider',
label: 'Wider fleet',
colour: '#39ff14',
keep: (row) => !SPINE_TECHS.has(row.tech)
},
{
id: 'all',
label: 'All pipeline',
colour: '#d8b64a',
keep: () => true
}
];
const state = {
schema: 'gridatlas.pipeline-news-layers.v1',
generation: GENERATION,
installed: false,
register_rows: 0,
register_url: null,
radius_km: RADIUS_KM,
selection: null,
counts: {},
active: [],
failures: []
};
window.__GRIDATLAS_PIPELINE_LAYERS__ = state;
function note(message) {
const text = String(message && message.message ? message.message : message);
if (!state.failures.includes(text)) state.failures.push(text);
}
let register = null;
function readRegisterSource(map) {
try {
const source = map.getSource(REGISTER_SOURCE);
const features = source && source._data && source._data.features;
if (!Array.isArray(features) || !features.length) return null;
return features.map((feature) => {
const properties = feature.properties || {};
const coordinates = (feature.geometry || {}).coordinates || [];
return {
name: properties.name || '',
operator: properties.operator || '',
tech: properties.tech || 'other',
raw: properties.raw_tech || '',
status: properties.status || '',
mw: Number(properties.capacity) || 0,
lon: Number(coordinates[0]),
lat: Number(coordinates[1])
};
}).filter((row) => Number.isFinite(row.lon) && Number.isFinite(row.lat));
} catch (error) {
note('register: ' + String(error && error.message || error));
return null;
}
}
function primeRegister() {
const box = document.querySelector(
'#scada-ui-container input[type=checkbox][data-layer-id="' + REGISTER_PRIMER + '"]');
if (!box) { note('register: no ' + REGISTER_PRIMER + ' control to prime with'); return false; }
if (!box.checked) box.click();
state.primed_with = REGISTER_PRIMER;
return true;
}
async function loadRegister(map) {
if (register) return register;
register = readRegisterSource(map);
if (register) { state.register_rows = register.length; return register; }
if (!primeRegister()) throw new Error('register unavailable');
for (let attempt = 0; attempt < 40; attempt += 1) {
await new Promise((resolve) => setTimeout(resolve, 250));
register = readRegisterSource(map);
if (register) { state.register_rows = register.length; return register; }
}
note('register: ' + REGISTER_SOURCE + ' did not hydrate within 10 s');
throw new Error('register unavailable');
}
function readSelection(map) {
try {
const source = map.getSource('gridatlas-project-pin');
const features = source && source._data && source._data.features;
if (!features || !features.length) return null;
const [lon, lat] = features[0].geometry.coordinates || [];
if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
const links = window.__GRIDATLAS_NEON_LINKS__ || {};
const name = (features[0].properties || {}).name
|| (links.project_pin || {}).name || '';
return { lon, lat, name, tech: (links.last_selection || {}).tech || '' };
} catch (error) {
note('selection: ' + String(error && error.message || error));
return null;
}
}
function near(rows, selection) {
const found = [];
for (const row of rows) {
const km = geodesy.distanceKm(selection.lon, selection.lat, row.lon, row.lat);
if (km > RADIUS_KM) continue;
if (km < 0.0005 && row.name === selection.name) continue;
found.push({ ...row, km });
}
found.sort((a, b) => a.km - b.km);
return found;
}
function collection(rows) {
return {
type: 'FeatureCollection',
features: rows.map((row) => ({
type: 'Feature',
geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
properties: {
name: row.name, operator: row.operator, tech: row.tech,
raw_tech: row.raw, status: row.status, mw: row.mw,
km: Number(row.km.toFixed(3)),
colour: TECH_COLOUR[row.tech] || TECH_COLOUR.other
}
}))
};
}
function setSourceData(map, id, data) {
try {
const source = map.getSource(id);
if (!source || typeof source.setData !== 'function') {
note('source missing, nothing drawn: ' + id);
return false;
}
source.setData(data);
return true;
} catch (error) {
note('source ' + id + ': ' + String(error && error.message || error));
return false;
}
}
function ensureLayers(map, control) {
const sourceId = 'pn-src-' + control.id;
const ringId = 'l-pn-' + control.id + '-ring';
const dotId = 'l-pn-' + control.id;
if (map.getSource(sourceId)) return { sourceId, ringId, dotId };
try {
map.addSource(sourceId, { type: 'geojson', data: collection([]) });
} catch (error) {
note('addSource ' + sourceId + ': ' + String(error && error.message || error));
return { sourceId, ringId, dotId };
}
map.addLayer({
id: ringId, type: 'circle', source: sourceId,
paint: {
'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 8, 16, 13],
'circle-color': 'rgba(0,0,0,0)',
'circle-stroke-color': control.colour,
'circle-stroke-width': 1.4,
'circle-stroke-opacity': 0.9
}
});
map.addLayer({
id: dotId, type: 'circle', source: sourceId,
paint: {
'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.8, 12, 3.4, 16, 5.5],
'circle-color': ['coalesce', ['get', 'colour'], '#888888'],
'circle-opacity': 0.95
}
});
map.on('click', dotId, (event) => {
const properties = (event.features && event.features[0] || {}).properties || {};
try {
new window.maplibregl.Popup({ closeButton: true })
.setLngLat(event.lngLat)
.setHTML(
'<div style="font-family:monospace;background:#000;padding:6px;max-width:260px">'
+ '<b style="color:#5fbdc2;font-size:12px">' + escapeHtml(properties.name || 'Project') + '</b><br>'
+ '<span style="color:#888">' + escapeHtml(properties.raw_tech || properties.tech || '') + '</span><br>'
+ '<span style="color:#ffae00">' + escapeHtml(String(properties.mw || 0)) + ' MW</span> · '
+ '<span style="color:#aaa">' + escapeHtml(properties.status || '') + '</span><br>'
+ '<span style="color:#555;font-size:10px">' + escapeHtml(String(properties.km)) + ' km from the selected project. '
+ 'Proximity only — not a connection, a circuit or a queue position.</span></div>')
.addTo(map);
} catch (error) {
note('popup: ' + String(error && error.message || error));
}
});
map.on('mouseenter', dotId, () => { map.getCanvas().style.cursor = 'pointer'; });
map.on('mouseleave', dotId, () => { map.getCanvas().style.cursor = ''; });
return { sourceId, ringId, dotId };
}
function escapeHtml(value) {
return String(value == null ? '' : value)
.replace(/[&<>"]/g, (character) => ({
'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[character]));
}
function setVisibility(map, control, visible) {
for (const id of ['l-pn-' + control.id + '-ring', 'l-pn-' + control.id]) {
if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
}
}
function labelFor(control, count, selection) {
if (!selection) return control.label + ' [SELECT A PROJECT]';
if (count === null || count === undefined) return control.label + ' [WAIT]';
return control.label + ' [' + count.toLocaleString('en-GB') + ' within ' + RADIUS_KM + ' km]';
}
function paintLabels(selection) {
for (const control of CONTROLS) {
const text = labelFor(control, state.counts[control.id], selection);
for (const span of document.querySelectorAll('[data-pn-label="' + control.id + '"]')) {
span.textContent = text;
}
}
}
async function refresh(map, control) {
const selection = state.selection;
if (!selection) return;
const rows = await loadRegister(map);
const found = near(rows.filter((row) => control.keep(row, selection)), selection);
state.counts[control.id] = found.length;
const { sourceId } = ensureLayers(map, control);
setSourceData(map, sourceId, collection(found));
paintLabels(selection);
}
function buildGroup(container, isFullscreen) {
if (container.querySelector('[data-pn-group]')) return;
const group = document.createElement('div');
group.className = 'key-group';
group.setAttribute('data-pn-group', '1');
const title = document.createElement('div');
title.className = 'key-title';
title.textContent = GROUP_TITLE;
group.appendChild(title);
for (const control of CONTROLS) {
const label = document.createElement('label');
label.className = 'key-item';
const input = document.createElement('input');
input.type = 'checkbox';
input.setAttribute('data-pn-layer', control.id);
input.dataset.pnLayer = control.id;
const span = document.createElement('span');
span.setAttribute('data-pn-label', control.id);
span.style.color = control.colour;
span.textContent = labelFor(control, state.counts[control.id], state.selection);
label.appendChild(input);
label.appendChild(document.createTextNode(' '));
label.appendChild(span);
group.appendChild(label);
}
container.appendChild(group);
state[isFullscreen ? 'installed_fullscreen' : 'installed_main'] = true;
}
function bind(map, container) {
container.addEventListener('change', (event) => {
const target = event.target;
if (!target || target.type !== 'checkbox' || !target.dataset.pnLayer) return;
const control = CONTROLS.find((candidate) => candidate.id === target.dataset.pnLayer);
if (!control) return;
for (const twin of document.querySelectorAll(
'input[data-pn-layer="' + control.id + '"]')) {
twin.checked = target.checked;
}
state.active = CONTROLS
.filter((candidate) => document.querySelector(
'input[data-pn-layer="' + candidate.id + '"]:checked'))
.map((candidate) => candidate.id);
if (!target.checked) {
setVisibility(map, control, false);
return;
}
if (!state.selection) {
paintLabels(null);
target.checked = false;
return;
}
ensureLayers(map, control);
setVisibility(map, control, true);
refresh(map, control).catch((error) => {
note('refresh: ' + String(error && error.message || error));
paintLabels(state.selection);
});
});
}
function install() {
const map = window.__GRIDATLAS_V9_MAP__;
const container = document.getElementById('scada-ui-container');
if (!map || typeof map.addSource !== 'function') return false;
if (!container || !container.querySelector('.key-group')) return false;
buildGroup(container, false);
bind(map, container);
const curtain = document.getElementById('fs-curtain-keys');
if (curtain) { buildGroup(curtain, true); bind(map, curtain); }
let lastKey = '';
if (typeof setInterval !== 'function') return true;
setInterval(() => {
const selection = readSelection(map);
const key = selection ? [selection.lon, selection.lat, selection.tech].join('|') : '';
if (key === lastKey) return;
lastKey = key;
state.selection = selection;
state.counts = {};
if (!selection) {
for (const control of CONTROLS) setVisibility(map, control, false);
paintLabels(null);
return;
}
paintLabels(selection);
for (const control of CONTROLS) {
if (!document.querySelector('input[data-pn-layer="' + control.id + '"]:checked')) continue;
refresh(map, control).catch((error) => note('refresh: '
+ String(error && error.message || error)));
}
}, 1000);
state.installed = true;
return true;
}
if (typeof setInterval === 'function') {
const started = Date.now();
const boot = setInterval(() => {
let done = false;
try { done = install(); } catch (error) { note('install: ' + String(error && error.message || error)); }
if (done || Date.now() - started > 120000) clearInterval(boot);
}, 400);
}
NS.pipelineNewsLayers = Object.freeze({
schema: 'gridatlas.module.pipeline-news-layers.v1',
generation: GENERATION,
RADIUS_KM,
CONTROLS: CONTROLS.map((control) => control.id),
install,
state
});
})();
(() => {
'use strict';
const NS = (window.__GRIDATLAS_MODULES__ = window.__GRIDATLAS_MODULES__ || {});
if (NS.sldStyles) throw new Error('sld-styles module registered twice');
NS.sldStyles = Object.freeze({
schema: 'gridatlas.module.sld-styles.v1',
neonBlock(BLOCK_CLASS) {
return `
.${BLOCK_CLASS}{margin-top:7px;padding-top:6px;border-top:1px solid #123;font-family:monospace}
.${BLOCK_CLASS} .neon-hd{display:flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.06em;
  color:#5fbdc2;font-weight:bold;text-transform:uppercase}
.${BLOCK_CLASS} .neon-beta{font-size:8px;letter-spacing:.06em;padding:1px 4px;border-radius:2px;
  background:#3a2f12;color:#e0b050;border:1px solid #6a5320;text-transform:uppercase}
.${BLOCK_CLASS} ol{list-style:none;margin:5px 0 0;padding:0}
.${BLOCK_CLASS} li{display:flex;align-items:baseline;gap:6px;padding:2px 0}
.${BLOCK_CLASS} .neon-km{color:#5fbdc2;font-weight:bold;font-variant-numeric:tabular-nums;
  min-width:54px;text-shadow:0 0 6px rgba(95,189,194,.35)}
.${BLOCK_CLASS} .neon-name{color:#9fb3ba;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap;flex:1;max-width:150px}
.${BLOCK_CLASS} .neon-kv{color:#ffae00;font-size:9px;white-space:nowrap;cursor:help}
.${BLOCK_CLASS} .neon-kvnote{margin-top:6px;font-size:10px;line-height:1.45}
.${BLOCK_CLASS} .neon-kvnote b{color:#ffae00;font-weight:normal}
.${BLOCK_CLASS} .neon-pin{display:block;width:100%;margin-top:7px;padding:5px 6px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#8b9aa1;
  font:inherit;font-size:10px;letter-spacing:.05em;cursor:pointer;text-transform:uppercase}
.${BLOCK_CLASS} .neon-pin:hover{border-color:#5fbdc2;color:#bfe9ee}
.${BLOCK_CLASS} .neon-pin[aria-pressed="false"]{color:#5f7a80;border-color:#1d3238}
.${BLOCK_CLASS} .neon-layout{display:block;width:100%;margin-top:7px;padding:5px 6px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#5fbdc2;
  font:inherit;font-size:10px;letter-spacing:.05em;cursor:pointer;text-transform:uppercase}
.${BLOCK_CLASS} .neon-layout:hover{border-color:#5fbdc2;color:#bfe9ee;background:#0d2429}
/* The measurement and its qualifiers, as one element. A hairline rule and
   six pixels of padding: nothing here colours or grades the number. */
.${BLOCK_CLASS} .neon-answer{margin:0 0 8px;padding:6px 0 8px;
  border-bottom:1px solid #123}
.${BLOCK_CLASS} .neon-answer > .neon-caveat:first-child{margin-top:0}
/* The card sits over the map and used to be immovable, with only MapLibre's
   own hairline close cross. It gets a bar: grab it to move the card out of the
   way, and two controls big enough to hit without aiming. */
/* Measured on the live map: the card was 563px tall inside a 319px map and
   hung 403px below it, so the caveat and the layout button could not be
   reached at all. The content is now bounded to the map and scrolls, and the
   bar stays put at the top of that scroll so the controls never leave. */
.maplibregl-popup-content{max-height:var(--gridatlas-card-max, 60vh) !important;
  overflow-y:auto !important;overflow-x:hidden;overscroll-behavior:contain}
.gridatlas-card-bar{position:sticky;top:-6px;z-index:2;flex:0 0 auto;
  display:flex;align-items:center;gap:6px;margin:-6px -6px 6px;
  padding:5px 6px;background:#0a1a1d;border-bottom:1px solid #1d3238;
  border-radius:3px 3px 0 0;cursor:grab;user-select:none;touch-action:none;font-family:monospace}
.gridatlas-card-bar:active{cursor:grabbing}
.gridatlas-card-bar .grip{color:#3f6f75;letter-spacing:2px;font-size:11px}
.gridatlas-card-bar .label{color:#8b9aa1;font-size:10px;max-width:190px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.maplibregl-popup.gridatlas-min .gridatlas-card-bar .label{color:#5fbdc2;font-weight:bold;max-width:230px}
.gridatlas-card-bar .spacer{flex:1}
.gridatlas-card-bar button{background:#050a0d;border:1px solid #2f6f75;color:#5fbdc2;
  font:inherit;font-size:14px;line-height:1;min-width:44px;height:44px;border-radius:3px;
  cursor:pointer;padding:0 6px}
.gridatlas-card-bar button:hover{color:#bfe9ee;border-color:#5fbdc2;background:#0d2429}
.gridatlas-card-bar button.close:hover{color:#ff8f8f;border-color:#ff5d5d}
.maplibregl-popup.gridatlas-free{position:fixed !important;transform:none !important;
  left:var(--gx) !important;top:var(--gy) !important;z-index:12}
.maplibregl-popup.gridatlas-free .maplibregl-popup-tip{display:none !important}
.maplibregl-popup.gridatlas-min .maplibregl-popup-content > *:not(.gridatlas-card-bar){display:none !important}
.maplibregl-popup.gridatlas-min .maplibregl-popup-content{padding:6px !important;
  border:1px solid #2f6f75;border-radius:4px;box-shadow:0 0 14px rgba(95,189,194,.25)}
.maplibregl-popup.gridatlas-min .gridatlas-card-bar{margin:0;border-bottom:0;
  border-radius:3px;background:#08171a}
.maplibregl-popup.gridatlas-min .gridatlas-card-bar button.min{border-color:#5fbdc2;color:#bfe9ee}
.${BLOCK_CLASS} .neon-caveat{margin-top:6px;color:#68797f;font-size:9px;line-height:1.5}
.${BLOCK_CLASS} .neon-caveat b{color:#8b9aa1;font-weight:bold}
/* The immutable shell predates phone-landscape use. These are composition
   overrides, not a mutation of the attested shell: the left control stack can
   scroll inside a short map, and search results cannot extend below it. */
@media (max-height:600px){
  .map-controls{max-height:min(70%,calc(100dvh - 100px));overflow-y:auto;
    overscroll-behavior:contain;scrollbar-width:thin}
  .search-results{max-height:calc(100dvh - 140px) !important}
}
@media (pointer:coarse){
  .map-ctrl-btn,.search-btn{min-height:44px}
  .search-input{min-height:44px;box-sizing:border-box}
  .${BLOCK_CLASS} .neon-pin,.${BLOCK_CLASS} .neon-layout{min-height:44px}
}
/* ── THE CARD IS A DOCKED SHEET ON A PHONE ───────────────────────────────
   Measured on a verified iPhone-class device (393x852 at dpr 3,
   pointer:coarse, hover:none, 5 touch points, document.hidden false): the
   anchored card opened at y=426, 819px tall, so its bottom edge was 393px
   BELOW the screen and the end of it was unreachable at every scroll
   position. Its left edge sat at x=-89 at 390px wide. Anchoring is the wrong
   idea on a phone - a 340px box hung off a marker in a 393px viewport has
   nowhere to go - so on a coarse pointer or a narrow window the card docks
   to the bottom edge, full width, and nothing has to be dragged.
   No rule below reads technology: three buckets light no layer at all. */
html.gridatlas-sheet-open .maplibregl-popup.gridatlas-sheet{
  position:fixed !important;left:0 !important;right:0 !important;
  top:auto !important;bottom:0 !important;transform:none !important;
  width:100vw !important;max-width:100vw !important;
  margin:0 !important;padding:0 !important;z-index:400 !important}
.maplibregl-popup.gridatlas-sheet .maplibregl-popup-tip{display:none !important}
.maplibregl-popup.gridatlas-sheet .maplibregl-popup-content{
  max-height:var(--gridatlas-sheet-h,56dvh) !important;
  width:100% !important;max-width:100% !important;
  border-radius:12px 12px 0 0;box-sizing:border-box;
  border-top:1px solid #2f6f75;box-shadow:0 -8px 24px rgba(0,0,0,.55);
  padding-bottom:calc(8px + env(safe-area-inset-bottom,0px)) !important}
.maplibregl-popup.gridatlas-sheet.gridatlas-min .maplibregl-popup-content{
  max-height:none !important}
/* MapLibre's own hairline cross is 20x18 and now sits inside a full-width
   sheet whose bar already carries a 44px close. Two closes, one of them
   unhittable, is worse than one. */
.maplibregl-popup.gridatlas-sheet .maplibregl-popup-close-button{display:none !important}
/* WHEN A CONTROL AND THE ANSWER WANT THE SAME PIXELS, THE ANSWER WINS.
   Four bars printed over the card's text on every load: the tray with the
   GB PRICES and VERSIONS bars (all inside .map-controls at y 698-822), HIDE
   LAYERS at y 796 on z-index 9999, and the credit strip at y 827. None is
   deleted and none goes UNDER the sheet, which would make it unreachable:
   they are lifted clear, still on the map and still 44px. The offset reads
   the same var the sheet is sized from, so the two cannot disagree. */
html.gridatlas-sheet-open .map-controls{
  bottom:calc(var(--gridatlas-sheet-h,56dvh) + 12px) !important;
  max-height:calc(100dvh - var(--gridatlas-sheet-h,56dvh) - 120px) !important;
  overflow-y:auto;overscroll-behavior:contain}
html.gridatlas-sheet-open #gridatlas-dash-toggle{
  bottom:calc(var(--gridatlas-sheet-h,56dvh) + 12px) !important}
/* Not an attribution: the OSM and CARTO credit is .custom-map-attrib at the
   top of the map and does not move. This is a shout-out that was printing
   across the card's sentences. Hidden only while a sheet is open. */
html.gridatlas-sheet-open .podcast-shoutout{display:none !important}`;
},
bootStatus(STATUS_ID) {
return `
#${STATUS_ID}{position:absolute;left:50%;top:14px;transform:translateX(-50%);
  z-index:5;max-width:min(92vw,420px);padding:7px 11px;border-radius:4px;
  background:rgba(6,18,21,.93);border:1px solid #21454b;color:#9fb3ba;
  font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;
  text-align:center;pointer-events:auto}
#${STATUS_ID}[data-kind="failed"]{border-color:#7a4a4a;color:#d0a9a9}
#${STATUS_ID} button{display:block;margin:7px auto 0;padding:4px 12px;
  background:#0a1a1d;border:1px solid #2f6f75;border-radius:3px;color:#bfe9ee;
  font:inherit;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}
#${STATUS_ID} button:hover{border-color:#5fbdc2}
@media (prefers-reduced-motion:no-preference){
  #${STATUS_ID}[data-kind="waiting"]{animation:ga-status-pulse 2.4s ease-in-out infinite}
}
@keyframes ga-status-pulse{0%,100%{opacity:.72}50%{opacity:1}}`;
},
versionLedger(LEDGER_ID) {
return `
#${LEDGER_ID}{margin-top:6px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#${LEDGER_ID} > button{display:block;width:100%;padding:6px 8px;background:#0a1a1d;
  border:1px solid #2f6f75;border-radius:3px;color:#8fb3b8;font:inherit;
  letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-align:left}
#${LEDGER_ID} > button:hover{border-color:#5fbdc2;color:#bfe9ee}
#${LEDGER_ID} .vl-body{display:none;margin-top:5px;padding:8px;border:1px solid #1d3238;
  border-radius:3px;background:rgba(6,18,21,.94);max-width:min(88vw,300px);
  max-height:min(56vh,380px);overflow:auto;overscroll-behavior:contain}
#${LEDGER_ID}[data-open="1"] .vl-body{display:block}
#${LEDGER_ID} .vl-row{padding:4px 0;border-bottom:1px solid #142226}
#${LEDGER_ID} .vl-head{display:flex;justify-content:space-between;gap:8px}
#${LEDGER_ID} .vl-ver{color:#bfe9ee;font-weight:bold}
#${LEDGER_ID} .vl-status{margin-left:5px;color:#ff9b73;font-size:9px;font-weight:bold}
#${LEDGER_ID} .vl-when{color:#5f7a80;font-size:10px}
#${LEDGER_ID} .vl-scope{color:#9fb3ba;font-size:10px;line-height:1.4;margin-top:1px}
#${LEDGER_ID} .vl-reason{color:#df9b83;font-size:9px;line-height:1.35;margin-top:2px}
#${LEDGER_ID} .vl-note{margin:7px 0 0;color:#6f8288;font-size:10px;line-height:1.45}`;
},
mobileTray(TRAY_ID) {
return `
#${TRAY_ID}{display:flex;gap:4px;font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace}
#${TRAY_ID} button{min-height:44px;padding:6px 10px;background:#0a1a1d;
  border:1px solid #2f6f75;border-radius:3px;color:#8fb3b8;font:inherit;
  letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
#${TRAY_ID} button[aria-pressed="true"]{border-color:#5fbdc2;color:#bfe9ee;
  background:rgba(0,255,255,0.08)}
#${TRAY_ID} button[disabled]{opacity:.45;cursor:default}
.map-controls.gm-tools-collapsed > .map-ctrl-btn{display:none}`;
},
gbConditions(GB_ID) {
return `
#${GB_ID}{margin-top:6px;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
#${GB_ID} > button{display:block;width:100%;padding:6px 8px;background:#0a1a1d;
  border:1px solid #2f6f75;border-radius:3px;color:#8fb3b8;font:inherit;
  letter-spacing:.06em;text-transform:uppercase;cursor:pointer;text-align:left}
#${GB_ID} > button:hover{border-color:#5fbdc2;color:#bfe9ee}
#${GB_ID} .gb-body{display:none;margin-top:5px;padding:8px;border:1px solid #1d3238;
  border-radius:3px;background:rgba(6,18,21,.94);max-width:min(88vw,260px);
  max-height:min(52vh,340px);overflow:auto;overscroll-behavior:contain}
#${GB_ID}[data-open="1"] .gb-body{display:block}
#${GB_ID} .gb-row{display:flex;justify-content:space-between;gap:8px;
  padding:2px 0;border-bottom:1px solid #142226}
#${GB_ID} .gb-k{color:#7d8f95}
#${GB_ID} .gb-v{color:#bfe9ee;font-weight:bold}
#${GB_ID} .gb-v em{color:#5f7a80;font-style:normal;font-weight:normal;font-size:10px}
#${GB_ID} .gb-note{margin:7px 0 0;color:#6f8288;font-size:10px;line-height:1.45}
#${GB_ID} .gb-note.gb-point{color:#9fb3ba;border-top:1px solid #142226;padding-top:6px}
#${GB_ID} .gb-note.gb-point b{color:#d8a76a}
#${GB_ID} .gb-more{display:block;margin-top:7px;color:#5fbdc2;font-size:10px;
  text-decoration:none;letter-spacing:.04em}
#${GB_ID} .gb-more:hover{text-decoration:underline}`;
},
sldPanel(PANEL_ID) {
return `
/* Top RIGHT, below the search box. The Atlas keeps its own tool buttons down
   the left edge -- EXPORT CSV, RADIUS SEARCH, ZONE DRAW, MEASURE -- and a
   panel on that side covers them, and the search bar occupies 72-96px inside
   the map container on the right, so the panel clears it at 112px. Both offsets
   were measured on the live map: no headless test catches a collision with a
   component the panel knows nothing about. */
#${PANEL_ID}{position:absolute;right:14px;top:112px;bottom:14px;z-index:11;width:310px;
  max-width:calc(100% - 28px);box-sizing:border-box;overflow:auto;font:11px/1.5 'Courier New',monospace;
  color:#cfe9ee;background:rgba(2,8,11,.93);border:1px solid #0b5f63;border-radius:5px;
  padding:11px 12px;box-shadow:0 0 22px rgba(0,255,255,.14);backdrop-filter:blur(3px);display:none}
#${PANEL_ID}[data-open="true"]{display:block}
#${PANEL_ID} h4{margin:0 0 2px;font-size:10px;letter-spacing:.09em;color:#5fbdc2;text-transform:uppercase;
  display:flex;align-items:center;gap:7px}
#${PANEL_ID} .sld-beta{font-size:8px;padding:1px 4px;border-radius:2px;background:#3a2f12;
  color:#e0b050;border:1px solid #6a5320}
#${PANEL_ID} .sld-site{color:#fff;font-size:12px;font-weight:bold;margin:2px 0 8px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${PANEL_ID} h4.sld-drag{cursor:grab;user-select:none;touch-action:none}
#${PANEL_ID} h4.sld-drag:active{cursor:grabbing}
#${PANEL_ID} .sld-min{margin-left:auto}
#${PANEL_ID} .sld-min,#${PANEL_ID} .sld-close{cursor:pointer;background:#050a0d;
  border:1px solid #2f6f75;color:#5fbdc2;font:inherit;font-size:12px;line-height:1;
  min-width:44px;height:44px;border-radius:3px;padding:0 5px}
#${PANEL_ID} .sld-min:hover{color:#bfe9ee;border-color:#5fbdc2}
#${PANEL_ID} .sld-close:hover{color:#ff8f8f;border-color:#ff5d5d}
#${PANEL_ID}[data-min="true"] > *:not(h4){display:none}
#${PANEL_ID}[data-min="true"]{width:auto;padding:7px 9px;
  box-shadow:0 0 14px rgba(95,189,194,.25)}
#${PANEL_ID}[data-min="true"] h4{margin:0}
#${PANEL_ID}[data-min="true"] .sld-min{border-color:#5fbdc2;color:#bfe9ee}
#${PANEL_ID} .sld-to{color:#8b9aa1;font-size:9.5px;margin:-6px 0 8px}
#${PANEL_ID} .sld-target{margin:0 0 9px;padding:7px 8px;border:1px solid #1d3238;
  border-radius:3px;background:#050a0d}
#${PANEL_ID} .sld-target-row{display:flex;justify-content:space-between;align-items:baseline}
#${PANEL_ID} .sld-target-row b{color:#e0b050;font-variant-numeric:tabular-nums}
#${PANEL_ID} .sld-basis{display:flex;align-items:center;gap:6px;margin-top:5px}
#${PANEL_ID} .sld-basis span{color:#8b9aa1;font-size:10px;white-space:nowrap}
#${PANEL_ID} .sld-basis select{flex:1}
#${PANEL_ID} .sld-danger{margin-top:6px;color:#ff5d5d;font-size:9px;line-height:1.5;
  border-left:2px solid #ff5d5d;padding-left:6px}
#${PANEL_ID} .sld-fitted{margin-top:6px;color:#8b9aa1;font-size:9px;line-height:1.5}
#${PANEL_ID} .sld-fitted b{color:#6fb582}
#${PANEL_ID} .sld-fitted b.sld-off{color:#ff5d5d}
#${PANEL_ID} .sld-ratio-note{margin-top:6px;color:#d9b45f;font-size:9px;line-height:1.5;
  border-left:2px solid #8b6c28;padding-left:6px}
#${PANEL_ID} .sld-tabs{display:flex;gap:5px;margin-bottom:8px}
#${PANEL_ID} .sld-tabs button{flex:1;background:#050a0d;border:1px solid #1d3238;color:#7f939a;
  font:inherit;font-size:9px;padding:4px;cursor:pointer;border-radius:3px;text-transform:uppercase}
#${PANEL_ID} .sld-tabs button[data-on="true"]{color:#5fbdc2;border-color:#5fbdc2}
#${PANEL_ID} .sld-grid{display:grid;grid-template-columns:1fr 62px;gap:3px 7px;align-items:center}
#${PANEL_ID} label{color:#8b9aa1;font-size:10px}
#${PANEL_ID} input,#${PANEL_ID} select{width:100%;background:#050a0d;border:1px solid #1d3238;
  color:#d8dee6;font:inherit;font-size:10px;padding:2px 4px;border-radius:2px}
#${PANEL_ID} input:focus,#${PANEL_ID} select:focus{outline:1px solid #5fbdc2}
#${PANEL_ID} .sld-out{margin-top:9px;padding-top:8px;border-top:1px solid #10262b;
  display:grid;grid-template-columns:1fr auto;gap:2px 8px}
#${PANEL_ID} .sld-out b{color:#e0b050;font-variant-numeric:tabular-nums}
#${PANEL_ID} .sld-out .lit{color:#5fbdc2}
#${PANEL_ID} .sld-warn{margin-top:7px;color:#d9963c;font-size:9px;line-height:1.45}
#${PANEL_ID} .sld-caveat{margin-top:7px;padding-top:7px;border-top:1px solid #10262b;
  color:#68797f;font-size:9px;line-height:1.5}
#${PANEL_ID} .sld-caveat b{color:#8b9aa1}
#${PANEL_ID} .sld-hint{margin-top:6px;color:#5f7a80;font-size:9px;line-height:1.45}
#${PANEL_ID} .sld-finance{margin-top:9px;border-top:1px solid #214047;padding-top:7px}
#${PANEL_ID} .sld-finance summary{min-height:32px;display:flex;align-items:center;cursor:pointer;
  color:#d9b45f;font-weight:bold;letter-spacing:.05em;user-select:none}
#${PANEL_ID} .sld-fin-grid{display:grid;grid-template-columns:1fr 76px;gap:3px 7px;align-items:center}
#${PANEL_ID} .sld-fin-section{grid-column:1/-1;margin-top:7px;padding-top:5px;
  border-top:1px solid #10262b;color:#5fbdc2;font-size:9px;text-transform:uppercase}
#${PANEL_ID} .sld-fin-grid input[type="checkbox"]{width:24px;justify-self:end}
#${PANEL_ID} .sld-fin-out{margin:8px 0;padding:7px;background:#050a0d;border:1px solid #1d3238;
  display:grid;grid-template-columns:1fr auto;gap:2px 8px}
#${PANEL_ID} .sld-fin-out b{color:#d9b45f;font-variant-numeric:tabular-nums;text-align:right}
#${PANEL_ID} .sld-fin-note{margin:6px 0;color:#8b9aa1;font-size:9px;line-height:1.5}
@media (max-width:700px){#${PANEL_ID}{width:auto;left:8px;right:8px;top:96px;bottom:8px}}
@media (pointer:coarse){
  #${PANEL_ID} .sld-tabs button,#${PANEL_ID} input,#${PANEL_ID} select,
  #${PANEL_ID} .sld-finance summary{min-height:44px}
}`;
},
fullscreenLayers() {
return `.gridatlas-fs-layers{position:absolute !important;left:0;right:0;bottom:0;
      max-height:42vh;overflow:auto;z-index:9;background:rgba(2,8,11,.94);
      border-top:1px solid #0b5f63;backdrop-filter:blur(3px)}`;
}
});
})();
(() => {
'use strict';
const GENERATION = '202609012045';
const PINS = (window.__GRIDATLAS_MODULES__ || {}).pinnedProducts || null;
const PRODUCT_ID = 'connection-points.v3';
const PRODUCT = PINS ? PINS.url(PRODUCT_ID) : null;
const REQUIRED_SCHEMA = 'data-grid-gb.connection-points.v3';
const QUOTED_METRIC = 'three_phase_rms_break_current_ka';
const QUOTED_METRIC_LABEL = 'three-phase RMS break current';
const DEG = Math.PI / 180;
const state = {
schema: 'gridatlas.substation-intelligence.v2',
generation: GENERATION,
product: PRODUCT,
loaded: false,
points: 0,
located: 0,
product_schema: null,
quoted_metric: QUOTED_METRIC,
failures: []
};
window.__GRIDATLAS_NETWORK__ = state;
const GEODESY = (window.__GRIDATLAS_MODULES__ || {}).geodesy;
if (!GEODESY) throw new Error("substation-intelligence requires the geodesy module");
const distanceKm = GEODESY.distanceKm;
const NOISE = /\b(SUBSTATION|SUB STATION|SUBSTN|GRID|SUPPLY|POINT|GSP|NATIONAL|POWER|STATION|WIND|FARM|WINDFARM|OFFSHORE|ONSHORE|EXTENSION|400KV|275KV|132KV|66KV|33KV|11KV|NGET|SSE|SP|SHE)\b/g;
function normalise(name) {
return String(name || '').toUpperCase()
.replace(/[^A-Z0-9 ]/g, ' ').replace(NOISE, ' ')
.split(/\s+/).filter(Boolean).join(' ');
}
const byName = new Map();
const located = [];
const published = [];
const ready = (async () => {
try {
if (!PRODUCT) throw new Error('the pinned-products module is not composed, '
+ 'so this cartridge has no pinned ref to read and will not guess one');
const response = await fetch(PRODUCT, { cache: 'no-cache' });
if (!response.ok) throw new Error('HTTP ' + response.status);
const text = await response.text();
const seal = await PINS.verify(PRODUCT_ID, text);
state.product_pin = seal;
if (seal.state === 'MISMATCH') {
state.failures.push(seal.detail
+ '; refusing to answer from bytes this composition has not seen');
return false;
}
const product = JSON.parse(text);
state.product_schema = product?.schema || null;
if (product?.schema !== REQUIRED_SCHEMA) {
state.failures.push('schema is ' + String(product?.schema)
+ ', this cartridge answers only ' + REQUIRED_SCHEMA);
return false;
}
for (const point of product.connection_points || []) {
const key = normalise(point.name);
if (key && !byName.has(key)) byName.set(key, point);
published.push(point);
if (point.location) located.push(point);
}
state.points = (product.connection_points || []).length;
state.located = located.length;
state.counts = product.counts || null;
state.join = product.join || null;
state.source = product.source || null;
state.loaded = true;
return true;
} catch (error) {
state.failures.push('network product: ' + String(error?.message || error));
return false;
}
})();
state.ready = ready;
state.byName = (name) => state.loaded
? (byName.get(normalise(name)) || null) : null;
state.location_join_is_unverified = true;
state.nearest = (lon, lat, options) => {
if (!state.loaded) return null;
const minimumKv = options?.minimumKv ?? 0;
const limit = options?.limit ?? 1;
const found = [];
for (const point of located) {
if (Math.max(...point.voltages_kv) < minimumKv) continue;
found.push({ point, km: distanceKm(lon, lat, point.location.lon, point.location.lat) });
}
found.sort((a, b) => a.km - b.km);
return limit === 1 ? (found[0] || null) : found.slice(0, limit);
};
state.coverage = (minimumKv) => {
if (!state.loaded) return null;
const floor = Number(minimumKv) || 0;
const eligible = (point) => Array.isArray(point.voltages_kv)
&& point.voltages_kv.length
&& Math.max(...point.voltages_kv) >= floor;
const inBand = published.filter(eligible);
const seen = located.filter(eligible);
return {
minimum_kv: floor,
published: inBand.length,
located: seen.length,
unlocated: inBand.length - seen.length,
basis: 'counted from the connection-points payload this session fetched'
};
};
state.summarise = (name, options) => {
const point = state.byName(name);
if (!point) return null;
const connectionKv = options && Number(options.connectionKv);
const units = (options && options.units) || null;
const unitCount = (field) => {
if (!units) return null;
const value = Number(units[field]);
return Number.isFinite(value) ? value : null;
};
const transformerUnits = unitCount('transformers');
const circuitUnits = unitCount('circuits');
const parts = [];
if (circuitUnits !== null) {
parts.push(circuitUnits + (circuitUnits === 1 ? ' circuit' : ' circuits'));
} else if (point.circuits) {
parts.push(point.circuits + (point.circuits === 1 ? ' circuit' : ' circuits'));
}
if (transformerUnits !== null) {
parts.push(transformerUnits
+ (transformerUnits === 1 ? ' transformer' : ' transformers'));
} else if (point.transformers) {
parts.push(point.transformers + ' transformer winding connections at the site '
+ '(a transformer whose windings are both here is published at each of them, '
+ 'so this is not a count of machines)');
}
const rating = point.circuit_winter_rating_mva;
if (rating) {
parts.push('circuit winter ratings across the site '
+ rating.min.toLocaleString('en-GB')
+ '\u2013' + rating.max.toLocaleString('en-GB') + ' MVA');
}
const byVoltage = point.fault_current_by_voltage || null;
let peak = point.fault_current?.peak || null;
let faultScope = 'site';
let faultKv = null;
if (Number.isFinite(connectionKv) && byVoltage) {
const key = Object.keys(byVoltage)
.find(k => Math.abs(Number(k) - connectionKv) < 0.5);
if (key && byVoltage[key]?.peak) {
peak = byVoltage[key].peak;
faultScope = 'bus';
faultKv = Number(key);
}
}
const metric = peak?.metrics?.[QUOTED_METRIC];
if (metric) {
parts.push(QUOTED_METRIC_LABEL + ' ' + metric.min.toFixed(1) + '\u2013'
+ metric.max.toFixed(1) + ' ' + metric.unit
+ (faultScope === 'bus'
? ' at the ' + faultKv + ' kV busbars'
: ' across every busbar at this site')
+ ' over ' + peak.scenarios + ' peak-demand rows'
+ (peak.locations?.length ? ' at ' + peak.locations.length
+ (peak.locations.length === 1 ? ' bus' : ' buses') : '')
+ (peak.winters?.length
? ' (' + peak.winters[0] + ' to ' + peak.winters[peak.winters.length - 1] + ')'
: ''));
}
if (point.reactive_compensation?.units) {
parts.push(point.reactive_compensation.units + ' reactive compensation units');
}
if (point.planned_changes) {
const years = point.planned_change_years || [];
parts.push(point.planned_changes + ' changes published for '
+ (years.length ? years[0] + '\u2013' + years[years.length - 1] : 'later years'));
}
if (!parts.length) return null;
const voltages = point.voltages_kv || [];
const siteWide = voltages.length > 1;
const busLocations = point.fault_current?.peak?.locations || [];
return {
site_code: point.site_code,
transmission_owner: point.transmission_owner,
voltages_kv: voltages,
site_wide: siteWide,
bus_locations: busLocations,
fault_scope: faultScope,
fault_kv: faultKv,
scope_label: faultScope === 'bus'
? ('Fault current is quoted at the ' + faultKv + ' kV busbars, the '
+ 'voltage this connection is made at. Circuit counts, ratings, '
+ 'transformers and planned changes remain site-wide across the '
+ voltages.slice().sort((a, b) => b - a).join('/') + ' kV buses here')
: (siteWide
? ('Site-wide published envelope across the '
+ voltages.slice().sort((a, b) => b - a).join('/') + ' kV buses at this site, '
+ 'not a value for any one bus')
: ('Published for this site, which carries one voltage: '
+ (voltages[0] || '?') + ' kV')),
sentence: parts.join(' \u00b7 '),
metric_named: QUOTED_METRIC_LABEL,
metrics_not_interchangeable: 'Appendix D publishes eight current '
+ 'metrics and they are not interchangeable; this is one published '
+ 'breaker-duty metric, and switchgear carries several relevant '
+ 'ratings besides it.',
attribution: 'NESO Electricity Ten Year Statement 2025, appendices B and D, '
+ 'via Ventusltd/data-grid-gb',
not_an_assessment: 'Published parameters. Not a statement about whether '
+ 'any project can connect here.'
};
};
})();
;(() => {
document.documentElement.classList.add('testcode-arrival');
const style=document.createElement('style');style.textContent=`
 @media screen {
 .testcode-arrival #gridatlas-menu-bar{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;min-height:54px!important;box-sizing:border-box;z-index:5000!important}
 .testcode-arrival .maplibregl-popup-content p{font-size:12px!important;line-height:1.5!important}
 html.testcode-arrival, .testcode-arrival body{height:100%;overflow:hidden}
 .testcode-arrival .dashboard{height:100dvh!important;min-height:0!important;padding:0!important;gap:0!important}
 .testcode-arrival .map-container,.testcode-arrival #map-container{position:fixed!important;inset:54px 0 0!important;width:100%!important;height:auto!important;min-height:0!important;border:0!important;border-radius:0!important}
 .testcode-arrival #map{position:absolute!important;inset:0!important;width:100%!important;height:100%!important}
 .testcode-arrival .search-bar-wrapper{position:fixed!important;top:64px!important;left:16px!important;right:auto!important;width:340px!important;max-width:calc(100vw - 32px)!important;display:flex!important;gap:6px!important;z-index:3100!important}
 .testcode-arrival .search-bar-wrapper>div{min-width:0!important;flex:1!important;width:auto!important}
 .testcode-arrival .search-bar-wrapper input{min-width:0!important;width:100%!important;height:48px!important;font:16px system-ui!important}
 .testcode-arrival #search-results{left:0!important;right:0!important;width:100%!important;min-width:0!important;box-sizing:border-box;white-space:normal}
 .testcode-arrival .maplibregl-popup{position:fixed!important;left:16px!important;top:124px!important;right:auto!important;bottom:72px!important;width:340px!important;max-width:340px!important;transform:none!important;z-index:2100!important;display:flex!important}
 .testcode-arrival .maplibregl-popup-content{width:100%!important;max-height:100%!important;overflow:auto!important;box-sizing:border-box;font-size:13px!important}
 .testcode-arrival .maplibregl-popup-tip{display:none!important}
 .testcode-arrival .maplibregl-popup.gridatlas-min{bottom:auto!important;height:auto!important;max-height:64px!important}
 .testcode-arrival .scada-wrapper{position:fixed!important;right:12px!important;top:124px!important;bottom:72px!important;width:min(420px,calc(100vw - 24px))!important;max-height:calc(100dvh - 196px)!important;overflow:auto!important;z-index:4000!important;background:#08151cf5!important;display:block!important}
 .testcode-arrival .scada-wrapper[data-gridatlas-collapsed="1"]{display:none!important}
 .testcode-arrival #testcode-fit{position:fixed;right:12px;top:64px;min-height:44px;padding:8px 12px;color:#bdfaff;background:#08151cf2;border:1px solid #37656b;z-index:3200;font:14px system-ui;cursor:pointer}
 .testcode-arrival .testcode-identity{font-size:10px;bottom:16px;left:16px;right:auto}
 @media(max-width:700px){
 .testcode-arrival .search-bar-wrapper{left:12px!important;width:calc(100vw - 24px)!important;max-width:none!important}
 .testcode-arrival .maplibregl-popup{left:12px!important;right:12px!important;top:auto!important;bottom:70px!important;width:auto!important;max-width:none!important;height:40dvh!important;max-height:40dvh!important}
 .testcode-arrival #testcode-fit{top:120px;min-height:44px}
 .testcode-arrival .maplibregl-popup.gridatlas-min{top:auto!important;bottom:70px!important;height:auto!important}
 .testcode-arrival .testcode-identity{bottom:8px;font-size:9px}
 }
 }
 `;document.head.append(style);
})();
