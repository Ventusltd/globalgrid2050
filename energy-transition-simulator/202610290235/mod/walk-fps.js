// walk-fps: first-person walk on the real terrain, inside the map's own camera.
// Eye 1.7 m above the terrain (map.queryTerrainElevation) at the walker's real lon/lat; mouse look with pointer
// lock; WASD (Shift to run) or the on-screen joystick on phones, drag to look on touch; smooth acceleration;
// the wireframe tables (satellite rows, mapped rows, built blocks) are solid: you stop at a table.
// Plain script: attaches to window.SIM { map, blocks, addBlock, removeWhere, repaint, info }. Toggle: "FPS" button or V.
// Limits (MapLibre 4): pitch tops out at 85 degrees, so the view can look to 5 degrees below the horizon, not above it.
(function () {
  'use strict';
  const EYE = 1.7, WALK = 1.4, RUN = 6, R = 0.35;           // m, m/s (1.4 m/s: a preferred adult walking pace), m body radius
  const PMIN = 55, PMAX = 85;                                // camera pitch range, degrees from straight down
  const A = 6378137, E2 = 0.00669437999014;                  // WGS84
  const mPerDeg = lat => { const s = Math.sin(lat * Math.PI / 180), w = 1 - E2 * s * s;
    return { y: A * (1 - E2) / Math.pow(w, 1.5) * Math.PI / 180, x: A / Math.sqrt(w) * Math.cos(lat * Math.PI / 180) * Math.PI / 180 }; };

  function start(SIM) {
    const map = SIM.map, canvas = map.getCanvas();
    let on = false, lon = 0, lat = 0, yaw = 0, pitch = 82, eyeZ = null, vx = 0, vy = 0, locked = false, saved = null;
    const keys = new Set(), joy = { x: 0, y: 0, id: null }, look = { id: null, x: 0, y: 0 };

    // ---- Solid tables: per block, horizontal wire segments above 0.5 m (table tops) in a 4 m spatial hash, built once.
    const solids = new WeakMap(), CELL = 4;
    function solidOf(b) {
      let s = solids.get(b); if (s && s.n === b.lines.length) return s;
      const h = new Map(), segs = [];
      if (b.sat || b.plant || b.built) for (const l of b.lines) {
        if (Math.abs(l[2] - l[5]) > 0.3 || l[2] < 0.5 || l[2] > 6) continue;      // only the table tops
        const k = segs.length; segs.push(l);
        const x0 = Math.floor((Math.min(l[0], l[3]) - R) / CELL), x1 = Math.floor((Math.max(l[0], l[3]) + R) / CELL);
        const y0 = Math.floor((Math.min(l[1], l[4]) - R) / CELL), y1 = Math.floor((Math.max(l[1], l[4]) + R) / CELL);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 400) continue;
        for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) { const key = i + ',' + j; (h.get(key) || h.set(key, []).get(key)).push(k); }
      }
      s = { h, segs, n: b.lines.length }; solids.set(b, s); return s;
    }
    const segDist = (px, py, l) => { const dx = l[3] - l[0], dy = l[4] - l[1], q = dx * dx + dy * dy;
      const t = q ? Math.max(0, Math.min(1, ((px - l[0]) * dx + (py - l[1]) * dy) / q)) : 0;
      return Math.hypot(px - l[0] - t * dx, py - l[1] - t * dy); };
    function blocked(la, lo) {
      for (const b of SIM.blocks) {
        if (!(b.sat || b.plant || b.built)) continue;
        const an = b.anchor || b, m = mPerDeg(an.lat), x = (lo - an.lon) * m.x, y = (la - an.lat) * m.y;
        if (Math.abs(x) > 5000 || Math.abs(y) > 5000) continue;
        const s = solidOf(b), c = s.h.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL)); if (!c) continue;
        for (const k of c) if (segDist(x, y, s.segs[k]) < R) return true;
      }
      return false;
    }

    // ---- Camera: MapLibre orbits a centre on the ground; put the centre ahead of the eye so the camera sits on it.
    // Absolute metres. MapLibre 4 returns queryTerrainElevation relative to the centre's elevation (transform.elevation),
    // so add that back; measured 27 Sept at the farm: camera altitude minus this ground = 1.70 m.
    const ground = (lo, la) => { const g = map.queryTerrainElevation ? map.queryTerrainElevation([lo, la]) : 0; return (g == null ? 0 : g) + (map.transform.elevation || 0); };
    function place() {
      const g = ground(lon, lat), want = g + EYE;
      eyeZ = eyeZ == null ? want : eyeZ + (want - eyeZ) * 0.25;                  // smooth the step over rough terrain
      const p = pitch * Math.PI / 180, b = yaw * Math.PI / 180, m = mPerDeg(lat);
      let d = EYE / Math.cos(p), cLo = lon, cLa = lat;
      for (let i = 0; i < 2; i++) {                                               // centre ground height differs from the eye's
        const ahead = d * Math.sin(p);
        cLa = lat + Math.cos(b) * ahead / m.y; cLo = lon + Math.sin(b) * ahead / m.x;
        d = Math.max(0.3, (eyeZ - ground(cLo, cLa)) / Math.cos(p));
      }
      const tr = map.transform, H = canvas.clientHeight || 600, c2c = tr.cameraToCenterDistance || 1.5 * H;
      const mpp = d / c2c, zoom = Math.log2(40075016.686 * Math.cos(cLa * Math.PI / 180) / (512 * mpp));
      map.jumpTo({ center: [cLo, cLa], zoom: Math.min(24, zoom), bearing: yaw, pitch });
    }

    let last = performance.now();
    function tick(t) {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (!on) return;
      const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joy.y;
      const r = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x;
      yaw += ((keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0)) * 90 * dt;
      const run = keys.has('shift') || Math.hypot(joy.x, joy.y) > 0.95, sp = run ? RUN : WALK, b = yaw * Math.PI / 180;
      const n = Math.hypot(f, r) > 1 ? Math.hypot(f, r) : 1;
      const tx = (f * Math.sin(b) + r * Math.cos(b)) / n * sp, ty = (f * Math.cos(b) - r * Math.sin(b)) / n * sp;
      const k = 1 - Math.exp(-dt * 8); vx += (tx - vx) * k; vy += (ty - vy) * k;  // east, north m/s, eased
      if (Math.abs(vx) + Math.abs(vy) > 0.01) {
        const m = mPerDeg(lat), dLo = vx * dt / m.x, dLa = vy * dt / m.y;
        if (!blocked(lat + dLa, lon + dLo)) { lat += dLa; lon += dLo; }
        else if (!blocked(lat, lon + dLo)) { lon += dLo; vy = 0; }                // slide along the table
        else if (!blocked(lat + dLa, lon)) { lat += dLa; vx = 0; }
        else { vx = vy = 0; stopped = t; }
      }
      place(); hud(t);
      requestAnimationFrame(tick);
    }
    let stopped = -1e9;
    const hudEl = document.createElement('div');
    hudEl.style.cssText = 'position:absolute;left:50%;top:50%;z-index:4;transform:translate(-50%,-50%);pointer-events:none;font:12px monospace;color:#dfe;text-align:center;display:none;text-shadow:0 0 3px #000';
    document.body.appendChild(hudEl);
    function hud(t) {
      const g = ground(lon, lat), sp = Math.hypot(vx, vy);
      hudEl.innerHTML = '<div style="font-size:18px;line-height:18px">+</div>' + (t - stopped < 800 ? '<div>table</div>' : '');
      SIM.info && SIM.info(`First-person walk. Eye ${EYE} m above terrain; ground ${g.toFixed(1)} m (open terrain tiles, an estimate). ` +
        `${lat.toFixed(6)}, ${lon.toFixed(6)} heading ${Math.round((yaw % 360 + 360) % 360)}°, ${sp.toFixed(1)} m/s. ` +
        `Click to look with the mouse (Esc frees it), W A S D to walk, Shift to run, V to leave. Tables are solid.`);
    }

    function enter() {
      if (on) return; on = true;
      const c = map.getCenter(); lon = c.lng; lat = c.lat; yaw = map.getBearing(); pitch = 82; eyeZ = null; vx = vy = 0;
      saved = { maxZoom: map.getMaxZoom(), dragPan: map.dragPan.isEnabled(), dragRotate: map.dragRotate.isEnabled(), scroll: map.scrollZoom.isEnabled(), kb: map.keyboard.isEnabled() };
      map.setMaxZoom(24); map.dragPan.disable(); map.dragRotate.disable(); map.scrollZoom.disable(); map.keyboard.disable(); map.touchZoomRotate.disable();
      hudEl.style.display = 'block'; btn.classList.add('on'); keys.clear();
      last = performance.now(); requestAnimationFrame(tick);
    }
    function leave() {
      if (!on) return; on = false; if (document.pointerLockElement) document.exitPointerLock();
      hudEl.style.display = 'none'; btn.classList.remove('on');
      if (saved) { if (saved.dragPan) map.dragPan.enable(); if (saved.dragRotate) map.dragRotate.enable(); if (saved.scroll) map.scrollZoom.enable(); if (saved.kb) map.keyboard.enable(); map.touchZoomRotate.enable(); }
      map.easeTo({ center: [lon, lat], zoom: 18.5, pitch: 70, duration: 700 });
      setTimeout(() => saved && map.setMaxZoom(saved.maxZoom), 750);
    }

    // Keys: while walking, take them before the page's own movement sees them (document, capture phase).
    const own = new Set(['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', '1', '2', '3']);
    document.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'v') { on ? leave() : enter(); e.stopPropagation(); return; }
      if (!on) return;
      if (k === 'escape') return;
      if (own.has(k)) { keys.add(k); e.stopPropagation(); e.preventDefault(); }
    }, true);
    document.addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys.delete(k); if (on && own.has(k)) e.stopPropagation(); }, true);
    addEventListener('blur', () => keys.clear());

    // Mouse look (pointer lock) on desktop.
    canvas.addEventListener('click', () => { if (on && !document.pointerLockElement && canvas.requestPointerLock) canvas.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; });
    document.addEventListener('mousemove', e => { if (!on || !locked) return;
      yaw += e.movementX * 0.15; pitch = Math.max(PMIN, Math.min(PMAX, pitch - e.movementY * 0.12)); });

    // Phones: the page's joystick drives the walk; a drag anywhere else on the map looks around.
    const joyEl = document.getElementById('joy'), knob = document.getElementById('knob');
    const joyAt = e => { const r = joyEl.getBoundingClientRect(), h = r.width / 2; let x = (e.clientX - r.left - h) / (h - 10), y = (e.clientY - r.top - h) / (h - 10);
      const d = Math.hypot(x, y); if (d > 1) { x /= d; y /= d; } joy.x = x; joy.y = y;
      if (knob) { knob.style.left = (40 + x * 40) + 'px'; knob.style.top = (40 + y * 40) + 'px'; } };
    if (joyEl) {
      joyEl.addEventListener('pointerdown', e => { if (!on) return; e.stopImmediatePropagation(); joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyAt(e); }, true);
      joyEl.addEventListener('pointermove', e => { if (!on) return; e.stopImmediatePropagation(); if (e.pointerId === joy.id) joyAt(e); }, true);
      const up = e => { if (!on) return; e.stopImmediatePropagation(); if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; if (knob) knob.style.left = knob.style.top = '40px'; };
      joyEl.addEventListener('pointerup', up, true); joyEl.addEventListener('pointercancel', up, true);
    }
    canvas.addEventListener('pointerdown', e => { if (!on || e.pointerType === 'mouse') return; look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; });
    canvas.addEventListener('pointermove', e => { if (!on || e.pointerId !== look.id) return;
      yaw -= (e.clientX - look.x) * 0.25; pitch = Math.max(PMIN, Math.min(PMAX, pitch + (e.clientY - look.y) * 0.2)); look.x = e.clientX; look.y = e.clientY; });
    const lookUp = e => { if (e.pointerId === look.id) look.id = null; };
    canvas.addEventListener('pointerup', lookUp); canvas.addEventListener('pointercancel', lookUp);

    // The button, beside the page's own Walk / Drone / Map.
    const btn = document.createElement('button'); btn.id = 'walk-fps'; btn.textContent = 'FPS';
    btn.title = 'First-person walk, eye at 1.7 m (V)'; btn.onclick = () => (on ? leave() : enter());
    const bar = document.getElementById('bar'), ref = document.getElementById('map2d');
    if (bar) bar.insertBefore(btn, ref ? ref.nextSibling : null); else { btn.style.cssText = 'position:absolute;left:8px;top:8px;z-index:5'; document.body.appendChild(btn); }

    window.walkFps = { enter, leave, state: () => ({ on, lon, lat, yaw, pitch, eyeZ, ground: ground(lon, lat) }),
      set: o => { if (o.lon != null) lon = o.lon; if (o.lat != null) lat = o.lat; if (o.yaw != null) yaw = o.yaw; if (o.pitch != null) pitch = o.pitch; },
      press: k => keys.add(k), release: k => keys.delete(k), blocked: (la, lo) => blocked(la, lo) };
  }

  (function wait() { if (window.SIM && window.SIM.map) start(window.SIM); else setTimeout(wait, 100); })();
})();
