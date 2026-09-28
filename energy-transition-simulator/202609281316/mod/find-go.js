// find-go: a typed find box. "go solar", "go bess", "go repd <ref>", "go substation <kV>", "go <lat>,<lon>".
// Flies there on an eased arc and drops one light wireframe marker (one block, built once) at the real coordinates.
// Data: DESNZ REPD Q2 2026 via the GridAtlas index (refs only, no names); substations from GridAtlas (names never shown).
// Place names: GridAtlas publishes no search endpoint we can reach, so place names are not searched (REPD + substations only).
(function () {
  'use strict';
  const GA = 'https://ventusltd.github.io/gridatlas/atlas/releases/202608300453-atlas-v9/data';
  const REPD_URLS = ['mod/find-go.data.json', 'world/data/repd-solar-bess.json'];
  const HA_PER_MW = 1.6;               // footprint estimate for ground solar (label as estimate)
  let repd = null, subs = null, lastRef = null, seen = [];

  function whenSim(cb) { if (window.SIM && window.SIM.map) return cb(window.SIM); setTimeout(() => whenSim(cb), 100); }

  async function loadRepd() {
    if (repd) return repd;
    for (const u of REPD_URLS) {
      try {
        const r = await fetch(u); if (!r.ok) continue; const d = await r.json();
        const f = d.fields, ix = k => f.indexOf(k);
        repd = { meta: d, rows: d.records.map(x => ({ ref: x[ix('ref')], tech: d.tech[x[ix('tech')]], cls: d.class[x[ix('class')]],
          status: d.repd_status[x[ix('repd_status')]], mw: x[ix('mw10')] / 10, lat: x[ix('lat5')] / 1e5, lon: x[ix('lon5')] / 1e5,
          year: x[ix('build_year')] })) };
        return repd;
      } catch (e) { /* try next */ }
    }
    throw new Error('REPD index not reachable');
  }
  async function loadSubs() {
    if (subs) return subs;
    const r = await fetch(`${GA}/grid_substations.geojson`); const j = await r.json();
    subs = j.features.filter(f => f.geometry && f.geometry.type === 'Point').map((f, i) => ({ i, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
      kv: String((f.properties || {}).voltage || '').split(';').map(v => Math.round(Number(v) / 1000)).filter(v => v > 0) }));
    return subs;
  }
  const dist = (a, b) => { const k = Math.cos((a.lat + b.lat) * Math.PI / 360); return Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * k); };

  // Marker: a mast, a 40 m ring, and (solar with MW) a footprint circle at the estimate. Metres around lon/lat.
  function marker(lon, lat, h, rFoot) {
    const L = [], ring = (r, z, n) => { for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, b = 2 * Math.PI * (i + 1) / n;
      L.push([r * Math.cos(a), r * Math.sin(a), z, r * Math.cos(b), r * Math.sin(b), z]); } };
    L.push([0, 0, 0, 0, 0, h]); ring(40, 0.5, 32); ring(12, h, 12);
    for (let i = 0; i < 4; i++) { const a = Math.PI * i / 2; L.push([0, 0, h, 12 * Math.cos(a), 12 * Math.sin(a), h]); }
    if (rFoot) ring(rFoot, 0.5, 96);
    return { lon, lat, lines: L, find: true };
  }
  const zoomFor = r => r > 1000 ? 13.6 : r > 400 ? 14.6 : r > 150 ? 15.6 : 16.5;
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function go(S, lon, lat, rFoot, text) {
    S.removeWhere(b => b.find);
    const b = marker(lon, lat, rFoot > 1000 ? 180 : 80, rFoot), PF = S.PF || (window.__pf && window.__pf.PF);
    if (PF) {   // place on the overlay's lattice once (anchor + anchor-relative buffer); never rebuilt per frame
      const an = PF.placeKey(lat, lon), off = PF.toLocal(an, lat, lon, 0);
      b.lines = b.lines.map(([a, c, d, e, f, g]) => [a + off.x, c + off.y, d, e + off.x, f + off.y, g]);
      b.anchor = an; b.buf = PF.wireBuffer(an, b.lines);
    }
    S.addBlock(b);
    S.repaint();
    S.map.flyTo({ center: [lon, lat], zoom: zoomFor(rFoot || 60), pitch: 55, bearing: S.map.getBearing(), curve: 1.6, speed: 0.9, easing: ease, essential: true });
    S.info(text);
  }
  const credit = 'Source: DESNZ REPD Q2 2026 via GridAtlas; position as published.';
  function goRepd(S, p) {
    const r = p.tech === 'solar' && p.mw ? Math.sqrt(p.mw * HA_PER_MW * 1e4 / Math.PI) : 0;
    lastRef = p.ref; seen.push(p.ref); if (seen.length > 50) seen.shift();
    go(S, p.lon, p.lat, r, `REPD ${p.ref} · ${p.tech.replace('_', ' ')} · ${p.status} · ${p.mw.toFixed(1)} MW${p.year ? ' · built ' + p.year : ''} · ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}. `
      + (r ? `Ring = footprint estimate (${HA_PER_MW} ha/MW, radius ${Math.round(r)} m), not the real boundary. ` : '') + credit);
  }

  async function run(S, raw) {
    const s = raw.trim().toLowerCase().replace(/^go\s+/, '');
    const here = { lat: S.map.getCenter().lat, lon: S.map.getCenter().lng };
    let m;
    if ((m = s.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/))) {
      const lat = +m[1], lon = +m[2]; if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return 'Not a lat, lon.';
      go(S, lon, lat, 0, `${lat.toFixed(5)}, ${lon.toFixed(5)} (typed coordinates, WGS84).`); return '';
    }
    if ((m = s.match(/^(?:repd\s*)?(\d+)$/))) {
      const R = await loadRepd(), p = R.rows.find(x => x.ref === +m[1]);
      if (!p) return `REPD ${m[1]} is not in the solar and storage index.`; goRepd(S, p); return '';
    }
    if ((m = s.match(/^(solar|bess|battery|storage)(?:\s+(\d+(?:\.\d+)?)\s*(?:mw)?)?$/))) {
      const tech = m[1] === 'solar' ? 'solar' : 'bess', min = m[2] ? +m[2] : 0, R = await loadRepd();
      let best = null, bd = Infinity;
      for (const p of R.rows) { if (p.tech !== tech || p.mw < min || seen.includes(p.ref)) continue; const d = dist(here, p); if (d < bd) { bd = d; best = p; } }
      if (!best) { seen = []; return `No more ${tech}${min ? ' of ' + min + ' MW+' : ''}; press again to start over.`; }
      goRepd(S, best); return '';
    }
    if ((m = s.match(/^(?:substation|sub|ss)(?:\s+(\d+))?\s*(?:kv)?$/))) {
      const kv = m[1] ? +m[1] : 0, L = await loadSubs(); let best = null, bd = Infinity;
      for (const p of L) { if (kv && !p.kv.includes(kv)) continue; if (seen.includes('s' + p.i)) continue; const d = dist(here, p); if (d < bd) { bd = d; best = p; } }
      if (!best) { seen = []; return `No ${kv ? kv + ' kV ' : ''}substation left; press again to start over.`; }
      seen.push('s' + best.i);
      go(S, best.lon, best.lat, 0, `Substation${best.kv.length ? ' ' + best.kv.join('/') + ' kV' : ''} · ${(bd / 1000).toFixed(1)} km from where you were · ${best.lat.toFixed(5)}, ${best.lon.toFixed(5)}. Source: GridAtlas (OpenStreetMap contributors, ODbL).`);
      return '';
    }
    return 'Place names: GridAtlas search not reachable. Try: go solar, go solar 50, go bess, go repd 6502, go substation 400, go 51.34,0.91';
  }

  whenSim(S => {
    const css = document.createElement('style');
    css.textContent = '#fg{position:absolute;right:50px;top:8px;z-index:4;display:flex;flex-direction:column;align-items:flex-end;gap:4px;max-width:calc(100vw - 66px)}'
      + '#fg input{font:15px monospace;width:min(260px,calc(100vw - 66px));min-height:40px;box-sizing:border-box;padding:8px 10px;border-radius:6px;border:1px solid #456;background:#0b1220;color:#dfe}'
      + '@media (max-width:600px){#fg{top:auto;right:8px;bottom:172px}#fg input{width:min(220px,calc(100vw - 16px))}}'
      + '#fg input::placeholder{color:#8aa}#fg div{font:12px sans-serif;color:#fdd;background:rgba(0,0,0,.7);padding:4px 8px;border-radius:6px;max-width:260px}#fg div:empty{display:none}';
    document.head.appendChild(css);
    const box = document.createElement('div'); box.id = 'fg';
    box.innerHTML = '<input id="fg-in" type="text" autocomplete="off" spellcheck="false" placeholder="go repd 6502 · go solar · go bess" aria-label="Find"><div id="fg-msg"></div>';
    document.body.appendChild(box);
    const inp = box.querySelector('input'), msg = box.querySelector('#fg-msg');
    inp.addEventListener('keydown', async e => {
      e.stopPropagation();
      if (e.key === 'Escape') { inp.blur(); return; }
      if (e.key !== 'Enter' || !inp.value.trim()) return;
      msg.textContent = '...';
      try { msg.textContent = await run(S, inp.value); } catch (err) { msg.textContent = 'Could not load data: ' + err.message; }
      inp.blur();
    });
    addEventListener('keydown', e => { if (e.key === '/' && document.activeElement !== inp) { e.preventDefault(); inp.focus(); inp.select(); } });
    window.findGo = t => run(S, t);   // test hook
    const q = new URLSearchParams(location.search).get('go'); if (q) run(S, q).then(t => { msg.textContent = t; });
  });
})();
