// connect-here: from the map centre, find the nearest GridAtlas substation point at a chosen voltage, draw a
// wireframe cable route to it in real coordinates (straight, or snapped to roads via the public OSRM router on
// OpenStreetMap data), and show the route length and an ILLUSTRATIVE voltage drop.
// Plain script. Attaches to window.SIM { map, blocks, addBlock, removeWhere, repaint, info, addButton? }
// and uses the page's place frame (window.__pf.PF or SIM.PF) so every vertex goes through the same WGS84 ->
// tangent-plane -> Mercator path as the rest of the wireframe.
//
// Coordinates: the route is cut into chunks of at most 150 m of path. Each chunk is its own block, anchored on
// the 100 m place lattice at the chunk start, its vertices in tangent-plane metres (PF.toLocal) and packed once
// into a Float32 buffer (PF.wireBuffer). So the cable follows the terrain chunk by chunk and never loses float
// precision, however long the route. The travelling pulse is one small block whose anchor moves; its buffer is
// never rebuilt.
//
// Voltage drop: the formula of the isolated star-join code (electrical.mjs, equations V10-R-001 R = R'.L.k and
// V10-V-001 dV = I.R), applied per phase with k = sqrt(3) for a balanced three-phase line-to-line drop.
// Resistive only (reactance ignored). Conductor data are typical round figures, NOT a design.
(function () {
  'use strict';
  const GA = 'https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/data/grid_substations.geojson';
  const OSRM = 'https://router.project-osrm.org/route/v1/driving/';
  // Illustrative conductor per voltage: R' (ohm/km, AC at 90 C, rounded) and a buried rating (A) per circuit.
  const CABLE = {
    33: { name: '3 x 1c 630 mm2 Al XLPE', r: 0.064, amp: 590 },
    132: { name: '3 x 1c 1000 mm2 Al XLPE', r: 0.039, amp: 900 },
    275: { name: '3 x 1c 2000 mm2 Cu XLPE', r: 0.013, amp: 1500 },
    400: { name: '3 x 1c 2500 mm2 Cu XLPE', r: 0.011, amp: 1800 },
  };
  const KV = [33, 132, 275, 400], MW = [10, 20, 50, 100, 200], PF_COS = 0.95, CHUNK = 150;
  const q = new URLSearchParams(location.search);
  const st = { kv: KV.includes(+q.get('ckv')) ? +q.get('ckv') : 132, mw: +q.get('cmw') > 0 ? +q.get('cmw') : 50,
    road: q.get('croad') !== '0', subs: null, pulse: null, raf: 0, busy: false, last: null };

  const ready = () => window.SIM && (window.SIM.PF || (window.__pf && window.__pf.PF)) && window.SIM.map;
  (function wait(n) { if (ready()) init(); else if (n < 400) setTimeout(() => wait(n + 1), 50); })(0);

  function init() {
    const SIM = window.SIM, PF = SIM.PF || window.__pf.PF, map = SIM.map;
    const btn = (label, fn) => {
      if (SIM.addButton) return SIM.addButton(label, fn);
      const b = document.createElement('button'); b.textContent = label; b.onclick = fn;
      (document.getElementById('bar') || document.body).appendChild(b); return b;
    };
    const go = btn('Connect here', () => run());
    const kvB = btn(`to ${st.kv} kV`, () => { st.kv = KV[(KV.indexOf(st.kv) + 1) % KV.length]; kvB.textContent = `to ${st.kv} kV`; if (st.last) run(); });
    const mwB = btn(`${st.mw} MW`, () => { st.mw = MW[(MW.indexOf(st.mw) + 1) % MW.length] || 50; mwB.textContent = `${st.mw} MW`; if (st.last) run(st.last); });
    const rdB = btn(st.road ? 'Road route' : 'Straight', () => { st.road = !st.road; rdB.textContent = st.road ? 'Road route' : 'Straight'; if (st.last) run(st.last); });

    // ---- geometry helpers (all through the page's place frame) ----
    const R_MEAN = 6371008.8, rad = d => d * Math.PI / 180;
    function hav(a, b) { // [lon, lat] great-circle metres, used only to rank candidates
      const dl = rad(b[1] - a[1]), dn = rad(b[0] - a[0]);
      const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dn / 2) ** 2;
      return 2 * R_MEAN * Math.asin(Math.sqrt(h));
    }
    function segLen(a, b) { const an = PF.placeKey(a[1], a[0]), p = PF.toLocal(an, a[1], a[0]), r = PF.toLocal(an, b[1], b[0]); return Math.hypot(r.x - p.x, r.y - p.y); }
    // Densify so no step exceeds 50 m (a straight route is a geodesic-ish line of real points, not two ends).
    function densify(path) {
      const out = [path[0]];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i], n = Math.ceil(segLen(a, b) / 50);
        for (let k = 1; k <= n; k++) {
          if (n > 1 && k < n) { const t = k / n, an = PF.placeKey(a[1], a[0]), p = PF.toLocal(an, a[1], a[0]), r = PF.toLocal(an, b[1], b[0]);
            const g = PF.fromLocal(an, p.x + (r.x - p.x) * t, p.y + (r.y - p.y) * t); out.push([g.lon, g.lat]); }
          else out.push(b);
        }
      }
      return out;
    }
    // Cut a lon/lat path into chunk blocks; returns { blocks, length, marks } (marks: [lon,lat] each 1 km).
    function chunk(path) {
      const out = []; let i = 0, total = 0, nextMark = 1000; const marks = [];
      while (i < path.length - 1) {
        const an = PF.placeKey(path[i][1], path[i][0]), L = []; let run = 0, prev = PF.toLocal(an, path[i][1], path[i][0]);
        while (i < path.length - 1 && run < CHUNK) {
          const b = path[i + 1], p = PF.toLocal(an, b[1], b[0]), d = Math.hypot(p.x - prev.x, p.y - prev.y);
          for (const o of [-1.2, 0, 1.2]) { // three phases, 1.2 m apart across the route, 1.5 m above ground
            const ux = d ? -(p.y - prev.y) / d * o : 0, uy = d ? (p.x - prev.x) / d * o : 0;
            L.push([prev.x + ux, prev.y + uy, 1.5, p.x + ux, p.y + uy, 1.5]);
          }
          if (total + run + d >= nextMark) { L.push([p.x, p.y, 0, p.x, p.y, 8], [p.x - 2, p.y, 8, p.x + 2, p.y, 8]); marks.push(b); nextMark += 1000; }
          run += d; prev = p; i++;
        }
        L.push([prev.x, prev.y, 0, prev.x, prev.y, 3]); // route marker post at each chunk end
        total += run;
        out.push({ lon: an.lon, lat: an.lat, anchor: an, lines: L, buf: PF.wireBuffer(an, L), connect: true });
      }
      return { blocks: out, length: total, marks };
    }
    function boxBlock(lon, lat, s, h, extra) { // a wireframe compound (substation) or a mast at the start
      const an = PF.placeKey(lat, lon), c = PF.toLocal(an, lat, lon), L = [], p = [[-s, -s], [s, -s], [s, s], [-s, s]];
      for (let k = 0; k < 4; k++) { const a = p[k], b = p[(k + 1) % 4];
        L.push([c.x + a[0], c.y + a[1], 0, c.x + b[0], c.y + b[1], 0], [c.x + a[0], c.y + a[1], h, c.x + b[0], c.y + b[1], h], [c.x + a[0], c.y + a[1], 0, c.x + a[0], c.y + a[1], h]); }
      if (extra) extra(L, c);
      return { lon: an.lon, lat: an.lat, anchor: an, lines: L, buf: PF.wireBuffer(an, L), connect: true };
    }
    function pulseBlock(lon, lat) { // a small diamond; its buffer is built once and its anchor is moved
      const an = PF.placeKey(lat, lon), s = 6, h = 4, L = [[-s, 0, h, 0, -s, h], [0, -s, h, s, 0, h], [s, 0, h, 0, s, h], [0, s, h, -s, 0, h],
        [-s, 0, h, 0, 0, h + 8], [s, 0, h, 0, 0, h + 8], [0, -s, h, 0, 0, h + 8], [0, s, h, 0, 0, h + 8]];
      return { lon: an.lon, lat: an.lat, anchor: { ...an }, lines: L, buf: PF.wireBuffer(an, L), connect: true, pulse: true };
    }

    async function subs() {
      if (st.subs) return st.subs;
      const j = await (await fetch(GA)).json();
      st.subs = j.features.filter(f => f.geometry && f.geometry.type === 'Point').map(f => ({
        c: f.geometry.coordinates, kv: String(f.properties.voltage || '').split(';').map(v => Math.round(+v / 1000)).filter(v => v > 0) }));
      return st.subs;
    }
    async function roadPath(a, b) {
      try {
        const r = await fetch(`${OSRM}${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(8000) });
        const j = await r.json(); const g = j.routes && j.routes[0] && j.routes[0].geometry.coordinates;
        return g && g.length > 1 ? [a, ...g, b] : null; // straight stubs from the site to the road and road to the point
      } catch (e) { return null; }
    }

    async function run(from) {
      if (st.busy) return; st.busy = true; go.textContent = 'Connecting...';
      try {
        const c = map.getCenter(), here = from || [c.lng, c.lat]; st.last = here;
        const all = await subs(); let best = null, bd = Infinity;
        for (const s of all) if (s.kv.includes(st.kv)) { const d = hav(here, s.c); if (d < bd) { bd = d; best = s; } }
        if (!best) { SIM.info(`No ${st.kv} kV substation point in the GridAtlas data.`); return; }
        const straight = densify([here, best.c]); let path = straight, how = 'straight line';
        if (st.road) { const rp = await roadPath(here, best.c); if (rp) { path = densify(rp); how = 'road route (OSRM, OpenStreetMap)'; } else how = 'straight line (road router unavailable)'; }
        clear();
        const ch = chunk(path), straightLen = chunk(straight).length;
        const mast = boxBlock(here[0], here[1], 3, 40, (L, c) => L.push([c.x, c.y, 40, c.x, c.y, 55]));
        const sub = boxBlock(best.c[0], best.c[1], 30, 10, (L, c) => { for (let x = -20; x <= 20; x += 10) L.push([c.x + x, c.y - 30, 10, c.x + x, c.y + 30, 10]); L.push([c.x, c.y, 10, c.x, c.y, 25]); });
        SIM.addBlock(mast); SIM.addBlock(sub);
        // Animate: lay the chunks one by one from the site to the substation, then run a pulse along the cable.
        const km = ch.length / 1000, e = elec(ch.length);
        SIM.info(`Laying ${km.toFixed(2)} km route...`);
        fit(path);
        let k = 0; const per = Math.max(1, Math.ceil(ch.blocks.length / 90));
        await new Promise(done => { (function lay() { for (let n = 0; n < per && k < ch.blocks.length; n++) SIM.addBlock(ch.blocks[k++]); if (k < ch.blocks.length) requestAnimationFrame(lay); else done(); })(); });
        startPulse(path);
        SIM.info(`Connect here (ESTIMATE, not a design): nearest ${st.kv} kV substation point ${(straightLen / 1000).toFixed(2)} km straight; ` +
          `cable by ${how}: ${km.toFixed(2)} km. At ${st.mw} MW, pf ${PF_COS}: ${e.I.toFixed(0)} A, ${e.n} circuit(s) of ${CABLE[st.kv].name} (R' ${CABLE[st.kv].r} ohm/km, assumed) ` +
          `-> drop about ${(e.dV / 1000).toFixed(2)} kV (${e.pct.toFixed(2)} %), loss about ${(e.loss / 1e6).toFixed(2)} MW. Resistive only, reactance ignored. ` +
          `Data: GridAtlas substation points${st.road ? '; route © OpenStreetMap contributors via OSRM' : ''}.`);
        window.__connect = { here, sub: best.c, kv: st.kv, mw: st.mw, how, straight_m: straightLen, route_m: ch.length, blocks: ch.blocks.length + 2, marks: ch.marks.length, ...e };
      } catch (err) { SIM.info('Connect here failed: ' + err.message); }
      finally { st.busy = false; go.textContent = 'Connect here'; }
    }
    // dV (line-to-line) = I . R, R = R' . L . sqrt(3) / n (n parallel circuits); loss = 3 I^2 R' L / n.
    function elec(len) {
      const cab = CABLE[st.kv], V = st.kv * 1000, I = st.mw * 1e6 / (Math.sqrt(3) * V * PF_COS);
      const n = Math.max(1, Math.ceil(I / cab.amp)), Rph = cab.r * len / 1000 / n;
      const dV = I * Rph * Math.sqrt(3);
      return { I, n, dV, pct: 100 * dV / V, loss: 3 * I * I * Rph };
    }
    function fit(path) {
      let w = 180, s = 90, e = -180, nn = -90; for (const [x, y] of path) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); nn = Math.max(nn, y); }
      const H = map.getContainer().clientHeight, W = map.getContainer().clientWidth;
      map.fitBounds([[w, s], [e, nn]], { padding: { top: Math.round(H * 0.3), bottom: Math.round(H * 0.2), left: Math.round(W * 0.1), right: Math.round(W * 0.1) }, pitch: 45, duration: 1200, maxZoom: 16 });
    }
    function clear() { cancelAnimationFrame(st.raf); st.pulse = null; SIM.removeWhere(b => b.connect); }
    function startPulse(path) {
      // Cumulative distances along the path, then move one prebuilt block's anchor along it for 15 s.
      const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + segLen(path[i - 1], path[i]));
      const total = cum[cum.length - 1], p = pulseBlock(path[0][0], path[0][1]); st.pulse = p; SIM.addBlock(p);
      const speed = Math.max(300, total / 6), t0 = performance.now();
      (function step(t) {
        if (st.pulse !== p) return;
        const s = ((t - t0) / 1000 * speed) % total; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
        const f = (s - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]), a = path[i - 1], b = path[i];
        p.anchor = { ...p.anchor, lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f };
        SIM.repaint();
        if (t - t0 < 15000) st.raf = requestAnimationFrame(step);
        else { p.anchor = { ...p.anchor, lon: path[path.length - 1][0], lat: path[path.length - 1][1] }; SIM.repaint(); }
      })(t0);
    }
    window.__connectRun = run;
    if (q.get('connect') === '1') setTimeout(() => run(), 1500);
  }
})();
