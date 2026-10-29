// coords-readout: an always-visible coordinate HUD in the morning engine's style (small monospace, grey on black,
// red for the rule line). It reads the map centre (where Walk and Drone stand) and shows:
//   BNG   the 10-figure National Grid reference, from the world's own bng.mjs, corrected by OSTN15 where the
//         block is loaded (about 0.1 m), else the Helmert answer, flagged as an estimate (about 3.5 m);
//   WGS84 latitude and longitude;
//   ASL   height above sea level of the ground under the centre, read from the open terrain tiles (Terrarium,
//         heights to mean sea level, a 30 m class model: an estimate, labelled so);
//   HDG   the compass heading of the view, and the tilt;
//   the ground line: "Ground: satellite + open terrain", or in survey mode "LiDAR 1 m (cached)" only when a cached
//   LiDAR tile is reported for this place (SIM.lidarAt(lat, lon) true); otherwise it says LiDAR is not cached here.
// Light: no WebGL, no blocks; one DOM panel updated at most once per animation frame; one terrain tile fetched per
// 600 m square (z15) and kept. Plain script: attaches to window.SIM (waits for it).
(function () {
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const base = new URL('../', here);
  const TERRAIN = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const TZ = 15;

  function start(SIM) {
    const map = SIM.map;
    let BNG = null, OSTN = null;
    import(new URL('world/bng.mjs', base).href).then(m => { BNG = m; kick(); }).catch(() => {});
    import(new URL('world/ostn15.mjs', base).href).then(m => { OSTN = m.createOstn15(); kick(); }).catch(() => {});

    // ---- panel ----
    const css = document.createElement('style');
    css.textContent = `#coords-hud{position:absolute;left:8px;z-index:3;pointer-events:none;max-width:calc(100vw - 32px);
  font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.04em;color:#d0d4d8;
  background:rgba(0,0,0,.72);border:1px solid rgba(208,212,216,.25);border-radius:4px;padding:6px 9px;white-space:pre}
#coords-hud b{color:#fff;font-weight:600}#coords-hud .k{color:#8a9096}#coords-hud .r{color:#ff3b30;opacity:.85}
#coords-hud .s{color:#8a9096;font-size:9.5px}`;
    document.head.appendChild(css);
    const hud = document.createElement('div');
    hud.id = 'coords-hud';
    document.body.appendChild(hud);
    const bar = document.getElementById('bar');
    const place = () => { hud.style.top = ((bar ? bar.getBoundingClientRect().bottom : 8) + 6) + 'px'; };
    place(); addEventListener('resize', place);
    if (bar && window.ResizeObserver) new ResizeObserver(place).observe(bar); // other modules add buttons later

    // ---- terrain height: own tile sampler, independent of style changes and exaggeration ----
    const tiles = new Map();
    function tileFor(lat, lon) {
      const n = 2 ** TZ, x = (lon + 180) / 360 * n, s = Math.sin(lat * Math.PI / 180);
      const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
      return { tx: Math.floor(x), ty: Math.floor(y), px: (x % 1) * 256, py: (y % 1) * 256 };
    }
    function loadTile(tx, ty) {
      const key = tx + '/' + ty;
      if (tiles.has(key)) return tiles.get(key);
      const rec = { data: null, failed: false };
      tiles.set(key, rec);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 256;
          const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
          rec.data = g.getImageData(0, 0, 256, 256).data;
        } catch (e) { rec.failed = true; }
        kick();
      };
      img.onerror = () => { rec.failed = true; kick(); };
      img.src = TERRAIN.replace('{z}', TZ).replace('{x}', tx).replace('{y}', ty);
      return rec;
    }
    function heightAt(lat, lon) {
      const t = tileFor(lat, lon), rec = loadTile(t.tx, t.ty);
      if (rec.data) { // bilinear inside the tile
        const d = rec.data, x = Math.min(254.999, Math.max(0, t.px - 0.5)), y = Math.min(254.999, Math.max(0, t.py - 0.5));
        const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
        const h = (c, r) => { const k = 4 * (r * 256 + c); return d[k] * 256 + d[k + 1] + d[k + 2] / 256 - 32768; };
        return { h: (1 - fx) * (1 - fy) * h(i, j) + fx * (1 - fy) * h(i + 1, j) + (1 - fx) * fy * h(i, j + 1) + fx * fy * h(i + 1, j + 1), src: 'tile' };
      }
      const q = map.queryTerrainElevation && map.getTerrain && map.getTerrain() ? map.queryTerrainElevation([lon, lat]) : null;
      if (q != null && Number.isFinite(q)) return { h: q / ((map.getTerrain() || {}).exaggeration || 1), src: 'map' };
      return { h: null, src: rec.failed ? 'failed' : 'loading' };
    }

    // ---- survey state: read from the page, never assumed ----
    const surveyOn = () => (typeof SIM.survey === 'function' ? !!SIM.survey() : !!document.querySelector('#survey.on'));
    const lidarCached = (lat, lon) => (typeof SIM.lidarAt === 'function' ? !!SIM.lidarAt(lat, lon) : false);

    const inGB = (lat, lon) => lat > 49 && lat < 61.5 && lon > -9 && lon < 2.5;
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    let lastBlock = '';

    function render() {
      const c = map.getCenter(), lat = c.lat, lon = c.lng;
      const rows = [];
      // BNG
      if (!inGB(lat, lon)) rows.push(`<span class="k">BNG  </span>outside GB: no National Grid`);
      else if (!BNG) rows.push(`<span class="k">BNG  </span>loading converter…`);
      else {
        const bk = Math.floor(lat) + '_' + Math.floor(lon);
        if (OSTN && bk !== lastBlock) { lastBlock = bk; OSTN.need(lat, lon).then(kick); }
        const t = OSTN ? OSTN.toBng(lat, lon) : Object.assign(BNG.wgs84ToBng(lat, lon), { ostn15: false });
        let ref = '—';
        try { ref = BNG.gridRef(t.e, t.n, 10); } catch (e) { /* off grid */ }
        rows.push(`<span class="k">BNG  </span><b>${esc(ref)}</b>  <span class="s">E ${t.e.toFixed(1)}  N ${t.n.toFixed(1)}</span>`);
        rows.push(`<span class="s">     ${t.ostn15 ? 'OSTN15 (OS definitive, ~0.1 m)' : 'Helmert estimate (~3.5 m), OSTN15 not loaded'}</span>`);
      }
      // WGS84
      const ns = lat >= 0 ? 'N' : 'S', ew = lon >= 0 ? 'E' : 'W';
      rows.push(`<span class="k">WGS84 </span>${Math.abs(lat).toFixed(6)}° ${ns}  ${Math.abs(lon).toFixed(6)}° ${ew}`);
      // Height
      const h = heightAt(lat, lon);
      rows.push(`<span class="k">ASL  </span>${h.h == null ? (h.src === 'failed' ? 'terrain unavailable' : 'reading terrain…') : `≈ ${h.h.toFixed(1)} m`}  <span class="s">${h.h == null ? '' : 'estimate, open terrain model'}</span>`);
      // Heading
      const hd = (map.getBearing() % 360 + 360) % 360;
      const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(hd / 45) % 8];
      rows.push(`<span class="k">HDG  </span>${String(Math.round(hd)).padStart(3, '0')}° ${pts}  <span class="s">tilt ${Math.round(map.getPitch())}°  z${map.getZoom().toFixed(1)}</span>`);
      // Ground line
      const sv = surveyOn();
      const gl = sv ? (lidarCached(lat, lon) ? 'LiDAR 1 m (cached)' : 'Survey grid 10 m · LiDAR 1 m not cached here') : 'Ground: satellite + open terrain';
      rows.push(`<span class="r">${esc(gl)}</span>`);
      rows.push(`<span class="s">Grid: OS National Grid, OSTN15</span>`, `<span class="s">Terrain: AWS Terrain Tiles (open)</span>`);
      hud.innerHTML = rows.join('\n');
    }

    let queued = false;
    function kick() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(); }); }
    map.on('move', kick); map.on('styledata', kick); map.on('load', kick);
    document.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#bar')) { setTimeout(place, 0); setTimeout(kick, 50); } });
    SIM.coordsReadout = { render: kick, heightAt };
    kick();
  }

  (function wait(n) {
    if (window.SIM && window.SIM.map) start(window.SIM);
    else if (n < 400) setTimeout(() => wait(n + 1), 50);
  })(0);
})();
