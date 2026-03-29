<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>GlobalGrid2050 | Ventus Core</title>
    <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; font-family: 'Courier New', monospace; color: white; overflow: hidden; }
        .dashboard { display: flex; flex-direction: column; height: 100vh; height: 100dvh; width: 100vw; padding: 4px; gap: 4px; box-sizing: border-box; }
        #fatal-banner { display: none; position: fixed; top: 0; left: 0; width: 100%; background: #ff0000; color: #fff; text-align: center; padding: 10px; font-weight: bold; z-index: 9999; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
        .hud-header { background: #0a0a0a; border: 1px solid #333; border-radius: 6px; padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .hud-val { font-size: 16px; font-weight: bold; color: #00ffff; text-shadow: 0 0 5px #00ffff; }
        .ventus-brand { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; }
        .ventus-main { font-family: -apple-system, sans-serif; font-size: 17px; font-weight: 800; color: #fff; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 2px; }
        .ventus-sub  { font-family: -apple-system, sans-serif; font-size: 6.5px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
        .map-container { position: relative; flex-grow: 1; min-height: 0; border: 1px solid #222; border-radius: 6px; overflow: hidden; background: #0b0e14; }
        #map { width: 100%; height: 100%; }
        #fx-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
        #fps-display { position: absolute; top: 6px; right: 8px; z-index: 20; font-family: 'Courier New', monospace; font-size: 8px; color: #555; pointer-events: none; text-shadow: 1px 1px 2px #000; }
        .podcast-shoutout { position: absolute; bottom: 6px; right: 8px; font-family: -apple-system, sans-serif; font-size: 8px; color: #fff; opacity: 0.5; text-align: right; text-transform: uppercase; letter-spacing: 1px; pointer-events: none; z-index: 10; text-shadow: 1px 1px 2px #000; }
        .scada-wrapper { background: #050505; border: 1px solid #444; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; flex-shrink: 0; max-height: 36vh; }
        .scada-keys { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; overflow-y: auto; padding-bottom: 5px; }
        .key-group { border-left: 2px solid #333; padding-left: 10px; margin-bottom: 4px; }
        .key-title { font-size: 10px; color: #66ccff; text-transform: uppercase; margin-bottom: 6px; font-weight: bold; }
        .key-item { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 8px; cursor: pointer; }
        input[type="checkbox"], input[type="radio"] { transform: scale(1.3); margin-right: 4px; accent-color: #00ffff; }
        .maplibregl-popup-content { background: #000; color: #00ffff; border: 1px solid #444; font-family: monospace; font-size: 12px; padding: 8px; }
        .quantum-footnote { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: justify; font-size: 9px; line-height: 1.4; color: #fff; opacity: 0.5; margin-top: 10px; padding-top: 8px; border-top: 1px solid #222; user-select: none; pointer-events: none; flex-shrink: 0; }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js"></script>
</head>
<body>

<div id="fatal-banner">CRITICAL ERROR: SYSTEM DEPENDENCIES FAILED TO LOAD</div>

<div class="dashboard">
    <div class="hud-header">
        <div><small style="color:#888">SYSTEM TIME</small><br><span class="hud-val" id="clock">--:--:--</span></div>
        <div class="ventus-brand">
            <div class="ventus-main">Ventus</div>
            <div class="ventus-sub">Cables &amp; Connectivity&reg;</div>
        </div>
        <div style="text-align:right"><small style="color:#888">2050 TARGET</small><br><span class="hud-val" id="days" style="color:#ff9d00">-- DAYS</span></div>
    </div>

    <div class="map-container">
        <div id="map"></div>
        <canvas id="fx-canvas"></canvas>
        <div id="fps-display">-- FPS</div>
        <div class="podcast-shoutout">In support of The Future of Solar Photovoltaics podcast<br>&amp; all participants to date</div>
    </div>

    <div class="scada-wrapper">
        <div class="scada-keys">
            <div class="key-group">
                <div class="key-title">Topology (GeoJSON)</div>
                <label class="key-item"><input type="checkbox" id="check-400"> <span id="lbl-400" style="color:#0054ff">400kV [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-275"> <span id="lbl-275" style="color:#ff0000">275kV [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-220"> <span id="lbl-220" style="color:#ff9900">220kV [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-132"> <span id="lbl-132" style="color:#00cc00">132kV [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-66">  <span id="lbl-66"  style="color:#b200ff">66kV [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-subs"><span id="lbl-subs" style="color:#fff">Subs [WAIT]</span></label>
            </div>
            <div class="key-group">
                <div class="key-title">Assets (GeoJSON)</div>
                <label class="key-item"><input type="checkbox" id="check-nuc"> <span id="lbl-nuc"  style="color:#39ff14">Nuclear [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-gas"> <span id="lbl-gas"  style="color:#ff4500">Gas [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-ind"> <span id="lbl-ind"  style="color:#ff6600">Industry [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-dc">  <span id="lbl-dc"   style="color:#00ffff">Data Centres [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-air"> <span id="lbl-air"  style="color:#ff00ff">Airports [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-rail"><span id="lbl-rail" style="color:#ffd700">Railways [WAIT]</span></label>
            </div>
            <div class="key-group">
                <div class="key-title">REPD (CSV Parser Active)</div>
                <label class="key-item"><input type="checkbox" id="check-solar"><span id="lbl-solar" style="color:#ffff00">Solar PV [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-wind"> <span id="lbl-wind"  style="color:#00ffff">Wind Farm [WAIT]</span></label>
                <label class="key-item"><input type="checkbox" id="check-bess"> <span id="lbl-bess"  style="color:#ffae00">BESS Storage [WAIT]</span></label>
            </div>
            <div class="key-group">
                <div class="key-title">Basemap</div>
                <label class="key-item"><input type="radio" name="bm" id="btn-dark" checked> Dark</label>
                <label class="key-item"><input type="radio" name="bm" id="btn-sat"> Satellite</label>
            </div>
        </div>
        <div class="quantum-footnote">
            Quantum computing harnesses superposition and entanglement to process multi-variable problems exponentially faster than classical binary systems. For global energy grids, this enables the solving of hyper-complex optimization, routing, and load-balancing equations in seconds, paving the way for a perfectly efficient, net-zero architecture.
        </div>
    </div>
</div>

<script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
<script>
'use strict';

if (typeof maplibregl === 'undefined' || typeof Papa === 'undefined') {
    document.getElementById('fatal-banner').style.display = 'block';
    throw new Error('CRITICAL: Core scripts failed to load.');
}
const mapContainer = document.getElementById('map');
if (!mapContainer) {
    const b = document.getElementById('fatal-banner');
    b.innerText = 'CRITICAL: #map DOM node missing.';
    b.style.display = 'block';
    throw new Error('CRITICAL: #map DOM node missing.');
}

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SAT_TILE_URL  = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

setInterval(() => {
    const now = new Date();
    document.getElementById('clock').innerText = now.toLocaleTimeString('en-GB');
    document.getElementById('days').innerText  = Math.floor((new Date('2050-01-01') - now) / 86400000) + ' DAYS';
}, 1000);

function updateDataState(id, state) {
    const el = document.getElementById('lbl-' + id);
    if (!el) return;
    const base = el.innerText.split('[')[0].trim();
    el.innerText    = base + ' [' + state + ']';
    el.style.opacity = state === 'FAIL' ? '0.5' : '1';
}

const map = new maplibregl.Map({
    container: 'map',
    style: MAP_STYLE_URL,
    center: [-3.5, 54.0],
    zoom: 4.2,
    attributionControl: false
});

let interacting = false;
map.on('movestart',  () => { interacting = true;  });
map.on('moveend',    () => { interacting = false; });
map.on('zoomstart',  () => { interacting = true;  });
map.on('zoomend',    () => { interacting = false; });

const canvas = document.getElementById('fx-canvas');
const ctx    = canvas.getContext('2d');
const fpsEl  = document.getElementById('fps-display');

// AUDIT FIX 1: High DPI (Retina) Canvas Rendering
let lastW = 0, lastH = 0;
const dpr = window.devicePixelRatio || 1;
new ResizeObserver(entries => {
    for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width !== lastW || height !== lastH) {
            lastW = width; 
            lastH = height;
            canvas.width  = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.resetTransform();
            ctx.scale(dpr, dpr);
            map.resize();
        }
    }
}).observe(mapContainer);

let targetMs  = 16.7;
const FB_MS   = 33.3;
let lastFrame = 0;
let frameCount = 0;
let ambientDivisor   = 1;
let lightningDivisor = 1;

const frameSamples = new Float32Array(60);
let sampleIdx = 0, sampleFull = false;

let fxPaused = false;
document.addEventListener('visibilitychange', () => { fxPaused = document.hidden; });

let lastFpsTime = performance.now();

let lightning         = null;
let lightningAlpha    = 0;
let lightningFlash    = 0;
let nextLightningIn   = 4000 + Math.random() * 6000;
let lastLightningTime = performance.now();

// AUDIT FIX 2: Prevent Garbage Collection (GC) Memory Leaks in recursion
// Replaced `.concat()` array spreading with reference passing.
function buildBolt(x1, y1, x2, y2, roughness, depth, out) {
    if (depth === 0) {
        out.push([x1, y1]);
        return;
    }
    const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * roughness;
    const my = (y1 + y2) / 2 + (Math.random() - 0.5) * roughness;
    buildBolt(x1, y1, mx, my, roughness * 0.6, depth - 1, out);
    buildBolt(mx, my, x2, y2, roughness * 0.6, depth - 1, out);
}

const TURBINES = [
    { xPct: 0.05, yPct: 0.72, speed: 0.6, scale: 0.9,  phase: 0   },
    { xPct: 0.13, yPct: 0.78, speed: 0.5, scale: 1.0,  phase: 1.1 },
    { xPct: 0.21, yPct: 0.73, speed: 0.7, scale: 0.85, phase: 2.2 }
];

function drawSun(w, h, t) {
    const cx = w * 0.08 + 30, cy = 36, r = 18;
    const pulse = 1 + 0.07 * Math.sin(t * 2);
    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 3.5 * pulse);
    glow.addColorStop(0, 'rgba(255,200,0,0.25)');
    glow.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.5 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = glow; ctx.fill();
    for (let i = 0; i < 12; i++) {
        const angle  = (i / 12) * Math.PI * 2 + t * 0.3;
        const innerR = r * 1.4 * pulse;
        const outerR = r * (2.2 + 0.3 * Math.sin(t * 3 + i)) * pulse;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.strokeStyle = 'rgba(255,210,50,' + (0.5 + 0.3 * Math.sin(t * 2 + i)) + ')';
        ctx.lineWidth = 2; ctx.stroke();
    }
    const core = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * pulse);
    core.addColorStop(0, '#fffbe0'); core.addColorStop(0.4, '#ffd700'); core.addColorStop(1, '#ff8c00');
    ctx.beginPath(); ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2); ctx.fillStyle = core; ctx.fill();
}

function drawTurbine(cx, cy, bladeAngle, scale) {
    const h = 55 * scale, tw = 4 * scale;
    ctx.beginPath();
    ctx.moveTo(cx - tw / 2, cy); ctx.lineTo(cx + tw / 2, cy);
    ctx.lineTo(cx + tw * 0.3, cy - h); ctx.lineTo(cx - tw * 0.3, cy - h);
    ctx.fillStyle = 'rgba(180,200,220,0.55)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - h, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220,235,255,0.8)'; ctx.fill();
    for (let i = 0; i < 3; i++) {
        const angle = bladeAngle + (i * Math.PI * 2) / 3;
        const bLen  = 26 * scale;
        const tipX  = cx + Math.cos(angle) * bLen;
        const tipY  = cy - h + Math.sin(angle) * bLen;
        const px    = Math.cos(angle + Math.PI / 2) * 3 * scale;
        const py    = Math.sin(angle + Math.PI / 2) * 3 * scale;
        ctx.beginPath();
        ctx.moveTo(cx + px, cy - h + py);
        ctx.quadraticCurveTo(cx + Math.cos(angle) * bLen * 0.6 + px * 2, cy - h + Math.sin(angle) * bLen * 0.6 + py * 2, tipX, tipY);
        ctx.quadraticCurveTo(cx + Math.cos(angle) * bLen * 0.6 - px, cy - h + Math.sin(angle) * bLen * 0.6 - py, cx - px, cy - h - py);
        ctx.fillStyle = 'rgba(200,220,240,0.7)'; ctx.fill();
    }
}

const DOVE = { x: 0, y: 0, active: false, speed: 0, wingPhase: 0, nextIn: 8000 + Math.random() * 10000 };
let lastDoveTime = performance.now();

function spawnDove(w, h) {
    DOVE.x = w + 40; DOVE.y = h * 0.2 + Math.random() * h * 0.35;
    DOVE.speed = 0.6 + Math.random() * 0.4; DOVE.wingPhase = 0; DOVE.active = true;
}

function renderBird(w, h, now) {
    if (!DOVE.active) {
        if (now - lastDoveTime > DOVE.nextIn) spawnDove(w, h);
        return;
    }
    DOVE.x -= DOVE.speed * 1.4; DOVE.wingPhase += 0.13;
    DOVE.y += Math.sin(DOVE.wingPhase * 0.7) * 0.4;
    if (DOVE.x < -60) {
        DOVE.active = false; lastDoveTime = now; DOVE.nextIn = 10000 + Math.random() * 12000;
        return;
    }
    const cx = DOVE.x, cy = DOVE.y, sc = 1.1;
    const wUp = Math.sin(DOVE.wingPhase * 3.5) * 10 * sc;
    ctx.save(); ctx.scale(-1, 1); ctx.translate(-cx * 2, 0);
    ctx.beginPath(); ctx.ellipse(cx, cy, 14 * sc, 7 * sc, -0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230,230,230,0.92)'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 12 * sc, cy + 1); ctx.lineTo(cx + 22 * sc, cy - 4 * sc);
    ctx.lineTo(cx + 23 * sc, cy + 1); ctx.lineTo(cx + 22 * sc, cy + 5 * sc);
    ctx.fillStyle = 'rgba(210,210,215,0.88)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 11 * sc, cy - 3 * sc, 5.5 * sc, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(235,235,240,0.95)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 13 * sc, cy - 4.5 * sc, 1.2 * sc, 0, Math.PI * 2);
    ctx.fillStyle = '#222'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 16 * sc, cy - 3 * sc); ctx.lineTo(cx - 20 * sc, cy - 2 * sc); ctx.lineTo(cx - 16 * sc, cy - 1 * sc);
    ctx.fillStyle = '#c8a060'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + 4 * sc, cy - 14 * sc + wUp, cx - 6 * sc, cy - 20 * sc + wUp);
    ctx.quadraticCurveTo(cx - 14 * sc, cy - 10 * sc + wUp * 0.5, cx, cy + 2);
    ctx.fillStyle = 'rgba(220,220,225,0.9)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + 6 * sc, cy + 10 * sc - wUp * 0.6, cx - 4 * sc, cy + 17 * sc - wUp * 0.4);
    ctx.quadraticCurveTo(cx - 12 * sc, cy + 10 * sc, cx, cy + 2);
    ctx.fillStyle = 'rgba(200,200,205,0.75)'; ctx.fill();
    const footX = cx + 4 * sc, footY = cy + 7 * sc;
    ctx.beginPath(); ctx.moveTo(cx + 2 * sc, cy + 6 * sc); ctx.lineTo(footX, footY + 5 * sc);
    ctx.strokeStyle = 'rgba(180,140,80,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.translate(footX, footY + 7 * sc); ctx.rotate(0.4);
    ctx.beginPath(); ctx.roundRect(-5, -2, 10, 4, 1.5); ctx.fillStyle = '#f5e8c0'; ctx.fill();
    ctx.strokeStyle = 'rgba(160,120,60,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-5, 0, 1.5, 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#e8d090'; ctx.fill();
    ctx.beginPath(); ctx.ellipse( 5, 0, 1.5, 2, 0, 0, Math.PI * 2); ctx.fillStyle = '#e8d090'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 2);
    ctx.strokeStyle = 'rgba(180,60,60,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore(); ctx.restore();
}

let t = 0;

function fxLoop(now) {
    requestAnimationFrame(fxLoop);
    if (fxPaused) return;
    const elapsed = now - lastFrame;
    if (elapsed < targetMs) return;
    lastFrame = now;
    frameCount++;
    frameSamples[sampleIdx] = elapsed;
    sampleIdx = (sampleIdx + 1) % 60;
    if (sampleIdx === 0) sampleFull = true;
    const sCount = sampleFull ? 60 : sampleIdx;
    let avgMs = 0;
    for (let i = 0; i < sCount; i++) avgMs += frameSamples[i];
    avgMs /= sCount;
    if (avgMs > 20) {
        targetMs = FB_MS; ambientDivisor = 2; lightningDivisor = 3;
    } else {
        targetMs = 16.7; ambientDivisor = 1; lightningDivisor = 1;
    }
    if (now - lastFpsTime >= 250) {
        fpsEl.textContent = Math.round(1000 / (avgMs || 16.7)) + ' FPS';
        lastFpsTime = now;
    }
    t = now * 0.001;
    
    // Utilize logical CSS dimensions for layout algorithms, not raw canvas buffer width
    const w = lastW, h = lastH;
    ctx.clearRect(0, 0, w, h);
    
    renderBird(w, h, now);
    if (!interacting) {
        if (frameCount % ambientDivisor === 0) {
            drawSun(w, h, t);
            for (let i = 0; i < TURBINES.length; i++) {
                const tb = TURBINES[i];
                drawTurbine(tb.xPct * w, tb.yPct * h, t * tb.speed + tb.phase, tb.scale);
            }
        }
        if (frameCount % lightningDivisor === 0) {
            if (!lightning && now - lastLightningTime > nextLightningIn) {
                const x1 = w * 0.3 + Math.random() * w * 0.4;
                const x2 = x1 + (Math.random() - 0.5) * 120;
                const y2 = h * 0.5 + Math.random() * h * 0.3;
                
                const pts = [];
                buildBolt(x1, 0, x2, y2, 80, 5, pts);
                pts.push([x2, y2]);
                lightning = pts;
                
                lightningAlpha = 1.0; lightningFlash = 1.0;
            }
            if (lightning) {
                if (lightningFlash > 0.1) {
                    ctx.fillStyle = 'rgba(200,220,255,' + (lightningFlash * 0.14) + ')';
                    ctx.fillRect(0, 0, w, h);
                    lightningFlash *= 0.75;
                } else { lightningFlash = 0; }
                ctx.beginPath(); ctx.moveTo(lightning[0][0], lightning[0][1]);
                for (let i = 1; i < lightning.length; i++) ctx.lineTo(lightning[i][0], lightning[i][1]);
                ctx.strokeStyle = 'rgba(180,200,255,' + (lightningAlpha * 0.4) + ')';
                ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(lightning[0][0], lightning[0][1]);
                for (let i = 1; i < lightning.length; i++) ctx.lineTo(lightning[i][0], lightning[i][1]);
                ctx.strokeStyle = 'rgba(255,255,255,' + lightningAlpha + ')';
                ctx.lineWidth = 1.5; ctx.stroke();
                lightningAlpha -= 0.045;
                if (lightningAlpha <= 0) {
                    lightning = null; nextLightningIn = 4000 + Math.random() * 7000; lastLightningTime = now;
                }
            }
        }
    }
}
requestAnimationFrame(fxLoop);

// AUDIT FIX 4: Spherical coordinate correction for grid topology snapping
function snapLines(features, subs) {
    if (!subs || !subs.length) return features;
    const tol = 0.05;
    const rad = Math.PI / 180;
    features.forEach(f => {
        const c = f.geometry && f.geometry.coordinates;
        if (!c || c.length < 2) return;
        [0, c.length - 1].forEach(i => {
            let best = c[i], min = Infinity;
            const latCos = Math.cos(c[i][1] * rad);
            subs.forEach(s => {
                const sc = s.geometry.coordinates;
                const dx = (c[i][0] - sc[0]) * latCos;
                const dy = (c[i][1] - sc[1]);
                const d  = (dx * dx) + (dy * dy);
                if (d < min && d < tol * tol) { min = d; best = sc; }
            });
            c[i] = best;
        });
    });
    return features;
}

// AUDIT FIX 3: Network Resilience against hanging threads
async function fetchWithTimeout(url, ms = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

map.on('load', async () => {

    async function fetchAndSet(url, sourceId, uiId, snapSubs = null) {
        try {
            const res      = await fetchWithTimeout(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data     = await res.json();
            const features = Array.isArray(data.features) ? data.features : [];
            if (features.length === 0) { updateDataState(uiId, 'EMPTY'); return []; }
            const payload  = snapSubs
                ? { type: 'FeatureCollection', features: snapLines(features, snapSubs) }
                : { type: 'FeatureCollection', features };
            map.getSource(sourceId).setData(payload);
            updateDataState(uiId, 'OK');
            return features;
        } catch (e) {
            console.error('[LOAD FAILED]', url, e.message);
            updateDataState(uiId, 'FAIL');
            return [];
        }
    }

    async function fetchCSVToGeoJSON(url, sourceId, uiId) {
        try {
            const res = await fetchWithTimeout(url);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const csvText = await res.text();
            Papa.parse(csvText, {
                header: true, skipEmptyLines: true, dynamicTyping: true,
                complete(results) {
                    const features = [];
                    results.data.forEach(row => {
                        const lat = row.Lat || row.lat || row.Latitude || row.latitude || row.Y || row.y;
                        const lon = row.Lon || row.lon || row.Longitude || row.longitude || row.X || row.x;
                        if (lat && lon && isFinite(lat) && isFinite(lon)) {
                            features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [+lon, +lat] }, properties: row });
                        }
                    });
                    if (features.length === 0) { updateDataState(uiId, 'EMPTY'); return; }
                    if (map.getSource(sourceId)) map.getSource(sourceId).setData({ type: 'FeatureCollection', features });
                    updateDataState(uiId, 'OK');
                },
                error(err) {
                    console.error('[CSV PARSE FAILED]', url, err.message);
                    updateDataState(uiId, 'FAIL');
                }
            });
        } catch (e) {
            console.error('[CSV LOAD FAILED]', url, e.message);
            updateDataState(uiId, 'FAIL');
        }
    }

    map.addSource('sat-s', { type: 'raster', tiles: [SAT_TILE_URL], tileSize: 256 });
    ['subs','400','275','220','132','66','power','ind','dc','air','rail','solar','wind','bess']
        .forEach(s => map.addSource('src-' + s, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }));

    map.addLayer({ id: 'l-sat', type: 'raster', source: 'sat-s', layout: { visibility: 'none' } });
    const addLine = (id, col, w) => map.addLayer({ id: 'l-' + id, type: 'line', source: 'src-' + id, layout: { visibility: 'none' }, paint: { 'line-color': col, 'line-width': w } });
    addLine('400','#0054ff',2.5); addLine('275','#ff0000',2); addLine('220','#ff9900',1.8); addLine('132','#00cc00',1.5); addLine('66','#b200ff',1.2);
    const addPoint = (id, src, col, filter) => {
        const cfg = { id: 'l-' + id, type: 'circle', source: 'src-' + src, layout: { visibility: 'none' }, paint: { 'circle-color': col, 'circle-radius': 4.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#000' } };
        if (filter) cfg.filter = filter;
        map.addLayer(cfg);
    };
    addPoint('subs',  'subs',  '#ffffff');
    addPoint('nuc',   'power', '#39ff14', ['==', ['get','source'], 'nuclear']);
    addPoint('gas',   'power', '#ff4500', ['!=', ['get','source'], 'nuclear']);
    addPoint('ind',   'ind',   '#ff6600');
    addPoint('dc',    'dc',    '#00ffff');
    addPoint('air',   'air',   '#ff00ff');
    addPoint('rail',  'rail',  '#ffd700');
    addPoint('solar', 'solar', '#ffff00');
    addPoint('wind',  'wind',  '#00ffff');
    addPoint('bess',  'bess',  '#ffae00');

    const subsData = await fetchAndSet('/grid_substations.geojson', 'src-subs', 'subs');
    fetchAndSet('/grid_400kv.geojson',  'src-400',  '400', subsData);
    fetchAndSet('/grid_275kv.geojson',  'src-275',  '275', subsData);
    fetchAndSet('/grid_220kv.geojson',  'src-220',  '220', subsData);
    fetchAndSet('/grid_132kv.geojson',  'src-132',  '132', subsData);
    fetchAndSet('/grid_66kv.geojson',   'src-66',   '66',  subsData);
    
    // AUDIT FIX 5: Decoupled Logic parsing. Wait for Power Data, then parse Truthfully.
    fetchAndSet('/power_plants.geojson', 'src-power', 'nuc').then(features => {
        if (!features || features.length === 0) {
            updateDataState('gas', 'FAIL');
            return;
        }
        const hasGas = features.some(f => f.properties && f.properties.source && String(f.properties.source).toLowerCase() !== 'nuclear');
        updateDataState('gas', hasGas ? 'OK' : 'EMPTY');
    });

    fetchAndSet('/industrial_offtakers.geojson', 'src-ind',  'ind');
    fetchAndSet('/datacentres.geojson',           'src-dc',   'dc');
    fetchAndSet('/airports.geojson',              'src-air',  'air');
    fetchAndSet('/railways.geojson',              'src-rail', 'rail');
    fetchCSVToGeoJSON('/repd-solar-operational.csv', 'src-solar', 'solar');
    fetchCSVToGeoJSON('/repd-grid-batteries.csv',    'src-bess',  'bess');
    fetchCSVToGeoJSON('/repd.csv',                   'src-wind',  'wind');

    ['400','275','220','132','66','subs','nuc','gas','ind','dc','air','rail','solar','wind','bess'].forEach(id => {
        const el = document.getElementById('check-' + id);
        if (el) el.addEventListener('change', e => map.setLayoutProperty('l-' + id, 'visibility', e.target.checked ? 'visible' : 'none'));
    });
    document.getElementById('btn-sat').onchange  = () => map.setLayoutProperty('l-sat', 'visibility', 'visible');
    document.getElementById('btn-dark').onchange = () => map.setLayoutProperty('l-sat', 'visibility', 'none');

    ['l-400','l-275','l-subs','l-nuc','l-gas','l-ind','l-dc','l-solar','l-wind','l-bess'].forEach(layer => {
        map.on('click', layer, e => {
            const p    = e.features[0].properties;
            const name = p.name || p.SiteName || p['Site Name'] || 'Unnamed Asset';
            const info = p.operator || p.capacity || p['Installed Capacity (MWelec)'] || p.voltage || 'Data Node';
            new maplibregl.Popup({ maxWidth: '250px' })
                .setLngLat(e.lngLat)
                .setHTML('<div style="font-family:monospace;color:#000"><b>' + name + '</b><br><span style="color:#444">' + info + '</span></div>')
                .addTo(map);
        });
    });

    const compassEl = document.createElement('div');
    compassEl.style.pointerEvents = 'none';
    compassEl.style.opacity = '0.85';
    compassEl.innerHTML = '<svg width="140" height="140" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="#0a0a0a" stroke="#0a0a0a" stroke-width="0.5"><circle cx="50" cy="50" r="32" fill="none" stroke-width="1.5"/><circle cx="50" cy="50" r="26" fill="none" stroke-width="0.5"/><polygon points="50,18 54,46 82,50 54,54 50,82 46,54 18,50 46,46" transform="rotate(45 50 50)"/><polygon points="50,2 57,43 98,50 57,57 50,98 43,57 2,50 43,43"/><circle cx="50" cy="50" r="4" fill="#050505"/><circle cx="50" cy="50" r="1.5" fill="#fff" opacity="0.3"/></g></svg>';
    new maplibregl.Marker({ element: compassEl, anchor: 'center' })
        .setLngLat([2.8, 55.2])
        .addTo(map);
});
</script>
</body>
</html>
