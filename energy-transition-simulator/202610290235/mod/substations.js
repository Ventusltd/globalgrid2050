// Substations as 3D wireframe compounds, in real coordinates (plain script; attaches to window.SIM).
// Points: GridAtlas grid_substations (atlas-v9). Fences: OpenStreetMap substation footprints (ODbL), pre-matched
// to the GridAtlas points by feature index in mod/substations-footprints.odbl.json. Where no footprint exists the
// fence is DASHED and sized by voltage: an estimate. Plinths are estimates (count from voltage and area).
// Labels show the voltage only, drawn as wire strokes standing over the compound. No names are ever read or shown.
// Command: type "go substation 132" (or "go sub 400", "go sub") to fly to the nearest one with that voltage.
(function () {
  'use strict';
  var GA = 'https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson';
  var ATLAS = '202608300453-atlas-v9';
  var here = (document.currentScript && document.currentScript.src) || location.href;
  var FP_URL = new URL('substations-footprints.odbl.json', here).href;
  var CREDIT = 'Substations: mapped positions (GridAtlas points). Fences: OpenStreetMap footprints, © OpenStreetMap contributors (ODbL); a dashed fence and all plinths are estimates.';
  var RADIUS = 2500, MAX = 60, MINZ = 12.5;

  // ---- WGS84 local east/north metres around a reference (same ellipsoid as place-frame.mjs) ----
  var A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), D = Math.PI / 180;
  function ecef(lat, lon) { var s = Math.sin(lat * D), c = Math.cos(lat * D), N = A / Math.sqrt(1 - E2 * s * s);
    return [N * c * Math.cos(lon * D), N * c * Math.sin(lon * D), N * (1 - E2) * s]; }
  function PFm() { return window.__pf && window.__pf.PF; }
  function localFn(lat0, lon0) {
    var PF = PFm();
    if (PF) { var an = PF.placeKey(lat0, lon0), o = PF.toLocal(an, lat0, lon0, 0);   // the overlay's own tangent plane
      return function (lat, lon) { var q = PF.toLocal(an, lat, lon, 0); return [q.x - o.x, q.y - o.y]; }; }
    var o = ecef(lat0, lon0), sl = Math.sin(lat0 * D), cl = Math.cos(lat0 * D), so = Math.sin(lon0 * D), co = Math.cos(lon0 * D);
    return function (lat, lon) { var g = ecef(lat, lon), d = [g[0] - o[0], g[1] - o[1], g[2] - o[2]];
      return [-so * d[0] + co * d[1], -sl * co * d[0] - sl * so * d[1] + cl * d[2]]; };
  }

  // ---- data ----
  var pts = null, fps = null, loading = null;
  function kvList(v) { return String(v || '').split(/[;:,]/).map(function (s) { return Math.round(Number(s) / 1000); })
    .filter(function (k) { return k >= 1; }).sort(function (a, b) { return b - a; }); }
  function load() {
    if (loading) return loading;
    loading = Promise.all([
      fetch(GA).then(function (r) { return r.json(); }),
      fetch(FP_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      pts = res[0].features.map(function (f, i) { var c = f.geometry.coordinates;
        return { i: i, lon: c[0], lat: c[1], kv: kvList(f.properties && f.properties.voltage) }; });   // voltage only
      fps = {};
      if (res[1] && res[1].f && (!res[1].atlas || res[1].atlas === ATLAS)) res[1].f.forEach(function (r) { fps[r[0]] = { how: r[1], ring: r[2] }; });
    });
    return loading;
  }

  // ---- geometry helpers (all metres, z up) ----
  function seg(L, a, b, za, zb) { L.push([a[0], a[1], za, b[0], b[1], zb === undefined ? za : zb]); }
  function box(L, cx, cy, ux, uy, hw, hd, h) {        // oriented box: centre, axis u, half width/depth, height
    var vx = -uy, vy = ux, P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (p) { return [cx + p[0] * ux + p[1] * vx, cy + p[0] * uy + p[1] * vy]; });
    for (var i = 0; i < 4; i++) { var a = P[i], b = P[(i + 1) % 4]; seg(L, a, b, 0); seg(L, a, b, h); seg(L, a, a, 0, h); }
  }
  function fence(L, ring, dashed) {                    // posts every ~8 m, bottom rail, 2.4 m top wire
    for (var i = 0; i + 1 < ring.length; i++) {
      var a = ring[i], b = ring[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), n = Math.max(1, Math.round(len / 8));
      for (var k = 0; k < n; k++) {
        var p = [a[0] + dx * k / n, a[1] + dy * k / n], q = [a[0] + dx * (k + 1) / n, a[1] + dy * (k + 1) / n];
        seg(L, p, p, 0, 2.4);
        if (dashed) { var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; seg(L, p, m, 2.4); seg(L, p, m, 0.1); }
        else { seg(L, p, q, 2.4); seg(L, p, q, 0.1); seg(L, p, q, 1.2); }
      }
    }
  }
  function frameOf(ring) {                             // centroid and the principal (longest-edge) axis
    var cx = 0, cy = 0, n = ring.length - 1; for (var i = 0; i < n; i++) { cx += ring[i][0]; cy += ring[i][1]; } cx /= n; cy /= n;
    var best = 0, ux = 1, uy = 0;
    for (i = 0; i < n; i++) { var dx = ring[i + 1][0] - ring[i][0], dy = ring[i + 1][1] - ring[i][1], l = Math.hypot(dx, dy); if (l > best) { best = l; ux = dx / l; uy = dy / l; } }
    var w = 0, d = 0; for (i = 0; i < n; i++) { var x = ring[i][0] - cx, y = ring[i][1] - cy; w = Math.max(w, Math.abs(x * ux + y * uy)); d = Math.max(d, Math.abs(-x * uy + y * ux)); }
    var area = 0; for (i = 0; i < n; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return { cx: cx, cy: cy, ux: ux, uy: uy, hw: w, hd: d, area: Math.abs(area) / 2 };
  }
  // Put a { lon, lat, lines } block on the overlay's 100 m place lattice and pack its buffer once (as connect-here does).
  function place(b) {
    var PF = PFm(); if (!PF) return b;
    var an = PF.placeKey(b.lat, b.lon), o = PF.toLocal(an, b.lat, b.lon, 0);
    var L = b.lines.map(function (l) { return [l[0] + o.x, l[1] + o.y, l[2], l[3] + o.x, l[4] + o.y, l[5]]; });
    b.anchor = an; b.lines = L; b.buf = PF.wireBuffer(an, L); return b;
  }
  var EST_HALF = function (kv) { return kv >= 275 ? 90 : kv >= 132 ? 40 : kv >= 66 ? 25 : 15; };

  // ---- stroke font for the voltage label: 0-9, k, V, / on a 1 x 2 cell ----
  var G = {
    '0': [[0,0,1,0],[1,0,1,2],[1,2,0,2],[0,2,0,0],[0,0,1,2]], '1': [[0.5,0,0.5,2],[0.2,1.7,0.5,2],[0.2,0,0.8,0]],
    '2': [[1,0,0,0],[0,0,0,1],[0,1,1,1],[1,1,1,2],[1,2,0,2]], '3': [[0,0,1,0],[1,0,1,2],[1,2,0,2],[0.2,1,1,1]],
    '4': [[0,2,0,1],[0,1,1,1],[1,2,1,0]], '5': [[1,2,0,2],[0,2,0,1],[0,1,1,1],[1,1,1,0],[1,0,0,0]],
    '6': [[1,2,0,2],[0,2,0,0],[0,0,1,0],[1,0,1,1],[1,1,0,1]], '7': [[0,2,1,2],[1,2,0.3,0]],
    '8': [[0,0,1,0],[1,0,1,2],[1,2,0,2],[0,2,0,0],[0,1,1,1]], '9': [[0,0,1,0],[1,0,1,2],[1,2,0,2],[0,2,0,1],[0,1,1,1]],
    'k': [[0,0,0,2],[0,0.5,0.8,1.2],[0.3,0.8,0.9,0]], 'V': [[0,2,0.5,0],[0.5,0,1,2]], '/': [[0,0,1,2]], ' ': []
  };
  function label(L, text, cx, cy, z0, size, bearing) {  // vertical text facing the camera bearing at build time
    var b = bearing * D, rx = Math.cos(b), ry = -Math.sin(b), adv = size * 1.5, x0 = -adv * text.length / 2;
    for (var c = 0; c < text.length; c++) (G[text[c]] || []).forEach(function (s) {
      var ax = x0 + c * adv + s[0] * size, bx = x0 + c * adv + s[2] * size;
      L.push([cx + ax * rx, cy + ax * ry, z0 + s[1] * size, cx + bx * rx, cy + bx * ry, z0 + s[3] * size]); });
  }
  function kvText(kv) { return kv.length ? kv.slice(0, 2).join('/') + ' kV' : ''; }

  // ---- one compound = one block (built once); its label = a second small block, rebuilt only when bearing swings ----
  function compound(s) {
    var loc = localFn(s.lat, s.lon), fp = fps[s.i], top = s.kv[0] || 33, ring, dashed = false;
    if (fp) ring = fp.ring.map(function (p) { return loc(p[1], p[0]); });
    else { var h = EST_HALF(top); ring = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]]; dashed = true; }
    var L = [], f = frameOf(ring);
    fence(L, ring, dashed);
    // plinths (estimate): count from voltage and area, laid on a row along the compound's long axis, 60% inset
    var n = Math.max(1, Math.min(8, Math.round(f.area / (top >= 275 ? 9000 : top >= 132 ? 3500 : 1500)))),
        pw = Math.min(6, f.hw * 0.6 / n + 1), pd = Math.min(4, f.hd * 0.35), ph = top >= 275 ? 5 : top >= 132 ? 4 : 2.5;
    for (var k = 0; k < n; k++) {
      var t = n === 1 ? 0 : (k / (n - 1) - 0.5) * 1.2 * f.hw;
      box(L, f.cx + t * f.ux, f.cy + t * f.uy, f.ux, f.uy, pw, pd, ph);
      var gx = f.cx + t * f.ux - f.uy * pd * 2.2, gy = f.cy + t * f.uy + f.ux * pd * 2.2;       // busbar gantry leg pair
      seg(L, [gx, gy], [gx, gy], 0, ph * 2); seg(L, [gx, gy], [f.cx + t * f.ux, f.cy + t * f.uy], ph * 2, ph);
    }
    if (n > 1) seg(L, [f.cx - 0.6 * f.hw * f.ux - f.uy * pd * 2.2, f.cy - 0.6 * f.hw * f.uy + f.ux * pd * 2.2],
                      [f.cx + 0.6 * f.hw * f.ux - f.uy * pd * 2.2, f.cy + 0.6 * f.hw * f.uy + f.ux * pd * 2.2], ph * 2);   // busbar
    return place({ lon: s.lon, lat: s.lat, lines: L, substation: s.i, est: dashed, top: Math.max(f.hw, f.hd), f: f });
  }
  function labelBlock(s, c, bearing) {
    var L = [], t = kvText(s.kv), size = Math.max(2.5, Math.min(7, 1.6 * c.top / (1.5 * t.length))); // text no wider than the compound
    label(L, t, c.f.cx, c.f.cy, Math.max(9, Math.min(20, c.top * 0.25)), size, bearing);
    return place({ lon: s.lon, lat: s.lat, lines: L, substationLabel: s.i });
  }

  var on = false, built = {}, lastC = null, lastB = null;
  function dist(a, b) { var x = (b.lon - a.lon) * 111320 * Math.cos(a.lat * D), y = (b.lat - a.lat) * 110574; return Math.hypot(x, y); }
  function nearby(c, r, want) {
    return pts.filter(function (s) { return (!want || s.kv.indexOf(want) >= 0); })
      .map(function (s) { return { s: s, d: dist(c, s) }; }).filter(function (o) { return o.d < r; })
      .sort(function (a, b) { return a.d - b.d; });
  }
  function refresh(force) {
    var map = SIM.map;
    if (!on || !pts || map.getZoom() < MINZ) { if (Object.keys(built).length) { SIM.removeWhere(function (b) { return b.substation !== undefined || b.substationLabel !== undefined; }); built = {}; SIM.repaint(); } return; }
    var cc = map.getCenter(), c = { lon: cc.lng, lat: cc.lat }, br = map.getBearing();
    var moved = !lastC || dist(lastC, c) > RADIUS / 3, turned = lastB === null || Math.abs(((br - lastB + 540) % 360) - 180) > 30;
    if (!force && !moved && !turned) return;
    var keep = {}; nearby(c, RADIUS, 0).slice(0, MAX).forEach(function (o) { keep[o.s.i] = o.s; });
    SIM.removeWhere(function (b) { return (b.substation !== undefined && !keep[b.substation]) || (b.substationLabel !== undefined && (turned || !keep[b.substationLabel])); });
    var nb = {}; for (var i in keep) {
      var s = keep[i], cb = built[i] || compound(s);
      if (!built[i]) SIM.addBlock(cb);
      nb[i] = cb; if (turned || !built[i]) SIM.addBlock(labelBlock(s, cb, br));
    }
    built = nb; lastC = c; if (turned) lastB = br; SIM.repaint();
  }

  // ---- "go substation 132": fly to the nearest, then circle it once (the animation) ----
  function go(kv) {
    return load().then(function () {
      var map = SIM.map, cc = map.getCenter(), c = { lon: cc.lng, lat: cc.lat };
      var best = nearby(c, 1e7, kv || 0)[0];
      if (!best) { SIM.info('No substation with ' + kv + ' kV in the GridAtlas points.'); return null; }
      on = true; syncBtn(); var s = best.s, fp = fps[s.i];
      SIM.info('Nearest ' + (kv ? kv + ' kV ' : '') + 'substation: ' + (best.d / 1000).toFixed(1) + ' km, ' + kvText(s.kv) + ', ' +
        s.lat.toFixed(5) + ', ' + s.lon.toFixed(5) + (fp ? '. Fence from mapped footprint.' : '. Fence dashed: size estimated.') + ' ' + CREDIT);
      map.flyTo({ center: [s.lon, s.lat], zoom: 17.2, pitch: 62, bearing: map.getBearing(), speed: 1.6, curve: 1.4 });
      map.once('moveend', function () { refresh(true);
        var b0 = map.getBearing(); map.rotateTo(b0 + 120, { duration: 6000, easing: function (t) { return t; } }); });
      return { lat: s.lat, lon: s.lon, kv: s.kv, km: +(best.d / 1000).toFixed(2), footprint: fp ? fp.how : 'estimate' };
    });
  }
  function command(text) {
    var m = /^\s*go\s+sub(?:station)?s?\s*(\d+)?\s*(?:kv)?\s*$/i.exec(text || ''); if (!m) return null;
    return go(m[1] ? Number(m[1]) : 0);
  }

  // ---- UI: a Substations toggle in the bar and a small command box (type, Enter) ----
  var btn = null;
  function syncBtn() { if (btn) btn.classList.toggle('on', on); }
  function ui() {
    var bar = document.getElementById('bar');
    var toggle = function () { on = !on; syncBtn(); if (on) { SIM.info(CREDIT); load().then(function () { refresh(true); }); } else refresh(true); };
    if (SIM.addButton) btn = SIM.addButton('Substations', toggle); else { btn = document.createElement('button'); btn.textContent = 'Substations'; btn.onclick = toggle; if (bar) bar.appendChild(btn); }
    var inp = document.createElement('input'); inp.placeholder = 'go substation 132'; inp.setAttribute('aria-label', 'Substation command');
    inp.style.cssText = 'font:14px monospace;padding:10px;border-radius:6px;border:1px solid #456;background:#0b1220;color:#dfe;min-height:44px;width:12em;box-sizing:border-box';
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { if (!command(inp.value)) SIM.info('Try: go substation 132'); inp.blur(); } });
    inp.addEventListener('keyup', function (e) { e.stopPropagation(); });
    (bar || document.body).appendChild(inp);
  }

  // Exact check: each compound sits at its GridAtlas point (===), and says whether its fence is a mapped footprint.
  function check() {
    var exact = 0, bad = [], mapped = 0, est = 0;
    for (var i in built) { var b = built[i], s = pts[b.substation];
      if (s && b.lon === s.lon && b.lat === s.lat) exact++; else bad.push(b.substation);
      if (b.est) est++; else mapped++; }
    return { live: Object.keys(built).length, exact: exact, bad: bad, footprint: mapped, estimated: est, credit: CREDIT };
  }

  function start() {
    ui();
    SIM.map.on('moveend', function () { if (on) refresh(false); });
    window.SUBS = { go: go, command: command, show: function (v) { on = v !== false; syncBtn(); return load().then(function () { refresh(true); }); },
      count: function () { return Object.keys(built).length; }, credit: CREDIT, check: check };
  }
  (function wait() { if (window.SIM && SIM.map) start(); else setTimeout(wait, 100); })();
})();
