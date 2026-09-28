// lidar-onsite: onsite LiDAR survey as the wireframe ground mesh, on real coordinates.
// Data: EA LiDAR 1 m DTM read ONLY from local caches (E:\lidar-cache etc., via the local mirror), baked by
// mod/lidar-onsite/bake.py into mod/lidar-onsite/<area>.json. Never calls the EA WCS.
// Coordinates: every mesh node is a British National Grid point (E, N) on the 1 m lattice, turned into WGS84 with
// OSTN15 (place-frame fromBng) and then into the block's local metres around its place key. Heights are the
// LiDAR heights relative to the LiDAR height at the anchor, so the mesh sits on the map terrain at the anchor.
// One block per cached 1 km tile, its GPU buffer built once (PF.wireBuffer), never per frame.
(function () {
  const R = 1000, NEAR = 3000, NOD = -32768;
  let on = false, areas = null, loaded = {}, btn = null, lastKey = '';
  const PF = () => window.__pf && window.__pf.PF;
  function wait(f) { if (window.SIM && PF()) f(); else setTimeout(() => wait(f), 200); }
  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Int16Array(u.buffer); };
  async function area(E, N) {
    if (!areas) areas = await fetch('mod/lidar-onsite/index.json').then(r => r.ok ? r.json() : []).catch(() => []);
    const a = areas.find(a => Math.hypot(a.E - E, a.N - N) < a.search - R);
    if (!a) return null;
    if (!loaded[a.name]) loaded[a.name] = await fetch('mod/lidar-onsite/' + a.name + '.json').then(r => r.json());
    return loaded[a.name];
  }
  // Distance from (E, N) to a patch rectangle, metres.
  const dist = (p, E, N) => Math.hypot(Math.max(p.e0 - E, 0, E - (p.e0 + (p.w - 1) * p.step)), Math.max(p.n0 - N, 0, N - (p.n0 + (p.h - 1) * p.step)));
  function mesh(p) {
    if (p.block) return p.block;
    const P = PF(), q = b64(p.cm), s = p.step, ec = p.e0 + (p.w - 1) * s / 2, nc = p.n0 + (p.h - 1) * s / 2;
    const g = P.fromBng(ec, nc), anchor = P.placeKey(g.lat, g.lon); p.engine = g.engine;
    // Real coordinates: node (E, N) -> WGS84 by OSTN15 -> local metres around the anchor. Exact at 3 control
    // nodes, affine between them (the OSTN15 shift varies by millimetres across 1 km).
    const o = P.bngToWire(anchor, p.e0, p.n0), ex = P.bngToWire(anchor, p.e0 + 1000, p.n0), ny = P.bngToWire(anchor, p.e0, p.n0 + 1000);
    const ax = (ex.x - o.x) / 1000, ay = (ex.y - o.y) / 1000, bx = (ny.x - o.x) / 1000, by = (ny.y - o.y) / 1000;
    const H = (i, j) => q[j * p.w + i];
    // Reference height: the LiDAR sample nearest the anchor (so the anchor's map-terrain height lines up with it).
    const aE = P.wireToBng(anchor, 0, 0); let best = 1e18, ref = 0;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { const v = H(i, j); if (v === NOD) continue;
      const d = (p.e0 + i * s - aE.e) ** 2 + (p.n0 + j * s - aE.n) ** 2; if (d < best) { best = d; ref = v; } }
    const L = [], X = (i, j) => { const de = i * s, dn = j * s; return [o.x + ax * de + bx * dn, o.y + ay * de + by * dn, (H(i, j) - ref) / 100]; };
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      if (H(i, j) === NOD) continue; const a = X(i, j);
      if (i + 1 < p.w && H(i + 1, j) !== NOD) { const b = X(i + 1, j); L.push([a[0], a[1], a[2], b[0], b[1], b[2]]); }
      if (j + 1 < p.h && H(i, j + 1) !== NOD) { const b = X(i, j + 1); L.push([a[0], a[1], a[2], b[0], b[1], b[2]]); }
    }
    p.block = { lon: anchor.lon, lat: anchor.lat, anchor, lines: L, buf: P.wireBuffer(anchor, L), lidar: true, tile: p.tile };
    return p.block;
  }
  async function refresh(force) {
    const S = window.SIM, P = PF();
    if (!on) { S.removeWhere(b => b.lidar); lastKey = ''; return; }
    const c = S.map.getCenter(), g = P.toBng(c.lat, c.lng), key = Math.round(g.e / 100) + ',' + Math.round(g.n / 100);
    if (key === lastKey && !force) return; lastKey = key;
    const a = await area(g.e, g.n);
    S.removeWhere(b => b.lidar);
    if (!a) { S.info('No LiDAR cached here (no baked local-cache area covers this point). Heights: none drawn.'); return; }
    const within = a.patches.filter(p => dist(p, g.e, g.n) <= R);
    const near = a.patches.filter(p => dist(p, g.e, g.n) <= NEAR).sort((x, y) => dist(x, g.e, g.n) - dist(y, g.e, g.n));
    for (const p of near) S.addBlock(mesh(p));
    const eng = near.length && near[0].engine !== 'OSTN15' ? 'Helmert (estimate, about 1-3 m)' : 'OSTN15';
    const cr = a.credit + '. Mesh every ' + a.step + ' m on the national grid, placed by ' + eng + '.';
    if (within.length) {
      const km2 = within.reduce((s, p) => s + p.valid, 0) / 1e6;
      S.info(`Onsite LiDAR: ${within.length} cached 1 km tile(s) within 1 km, ${km2.toFixed(2)} km² of measured ground. ${cr}`);
    } else if (near.length) {
      const p = near[0], d = dist(p, g.e, g.n), pe = p.e0 + p.w * p.step / 2 - g.e, pn = p.n0 + p.h * p.step / 2 - g.n;
      const dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(pe, pn) * 180 / Math.PI + 360) % 360) / 45) % 8];
      S.info(`No LiDAR cached here (none within 1 km). Nearest cached patches drawn: ${near.length}, the closest ${(d / 1000).toFixed(1)} km ${dir}. Unmeasured ground is not drawn. ${cr}`);
    } else S.info('No LiDAR cached here (none within 3 km). ' + a.credit);
  }
  wait(() => {
    const S = window.SIM;
    btn = S.addButton ? S.addButton('LiDAR onsite', () => { on = !on; btn.classList.toggle('on', on); refresh(true); }) : null;
    S.map.on('moveend', () => refresh(false));
    window.__lidarOnsite = { enable() { on = true; if (btn) btn.classList.add('on'); return refresh(true); }, count: () => S.blocks.filter(b => b.lidar).length,
      segs: () => S.blocks.filter(b => b.lidar).reduce((s, b) => s + b.lines.length, 0) };
  });
})();
