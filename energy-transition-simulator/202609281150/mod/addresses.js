// addresses: type a UK postcode, a National Grid reference, an easting/northing pair or a lat, lon into the find box
// ("go SW1A 1AA", "go TQ 30624 78388", "go 530624 178388", "go 51.5, -0.12") and fly to the right spot.
//
// ONE conversion: every grid position (grid reference, E/N, and a postcode's published grid reference) becomes
// latitude and longitude through world/ostn15.mjs (OSTN15, the OS definitive transformation, about 0.1 m) where its
// block is held (England and Wales); elsewhere the Helmert answer from world/bng.mjs is used and the label says so.
// The typed grammar follows the site world's links.mjs parseAddress (latlon, en, gridref = the square's centre,
// postcode), which lives in another repo; its kinds were checked to agree on every test input (round-1 note).
//
// Postcodes: the open postcodes.io API (ONS Postcode Directory), at most one request per second, each answer cached
// for the page (and in this browser when storage allows). We land on the published grid reference (eastings,
// northings, 1 m) through OSTN15 and report the gap to the lat/lon postcodes.io publishes. A postcode centroid is a
// point inside the postcode's delivery points, not a building: labelled "published centroid".
//
// Provenance in every label: gridref / E,N / lat,lon = typed (exact); postcode = published centroid (ONSPD).
// Plain script: attaches to window.SIM; intercepts the find box (#fg-in) for these kinds only, before find-go.
(function () {
  'use strict';
  const here = document.currentScript && document.currentScript.src ? document.currentScript.src : location.href;
  const base = new URL('../', here);
  const API = 'https://api.postcodes.io/postcodes/';
  const CREDIT_PC = 'Postcode: postcodes.io (ONS Postcode Directory; contains OS data © Crown copyright and database right, Royal Mail data © Royal Mail, OGL v3).';

  // ---- grammar (after links.mjs parseAddress) ----
  const LATLON = /^(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i;
  const EN = /^(\d{4,6}(?:\.\d+)?)\s*[,\s]\s*(\d{4,7}(?:\.\d+)?)$/;
  const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  const GRIDREF = /^[A-HJ-Z]{2}\s*[\d\s]*$/i;
  const onGrid = (e, n) => Number.isFinite(e) && Number.isFinite(n) && e >= 0 && e < 700000 && n >= 0 && n < 1300000;

  let BNG = null, OSTN = null;
  const ready = Promise.all([
    import(new URL('world/bng.mjs', base).href).then(m => { BNG = m; }),
    import(new URL('world/ostn15.mjs', base).href).then(m => { OSTN = m.createOstn15(); })
  ]);

  // Pure after `ready`: text -> { kind, e?, n?, lat?, lon?, query?, digits? } or null (not an address: find-go keeps it).
  function classify(raw) {
    const t = String(raw ?? '').trim().replace(/^go\s+/i, '').replace(/\s+/g, ' ');
    if (!t) return null;
    const ll = LATLON.exec(t);
    if (ll) {
      let lat = +ll[1], lon = +ll[3];
      if (ll[2] && /s/i.test(ll[2])) lat = -Math.abs(lat);
      if (ll[4] && /w/i.test(ll[4])) lon = -Math.abs(lon);
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { kind: 'latlon', lat, lon };
    }
    const en = EN.exec(t);
    if (en && onGrid(+en[1], +en[2])) return { kind: 'en', e: +en[1], n: +en[2] };
    if (GRIDREF.test(t)) {
      try {
        const g = BNG.parseGridRef(t), digits = t.replace(/\D/g, '').length, half = digits ? 10 ** (5 - digits / 2) / 2 : 50000;
        return { kind: 'gridref', e: g.e + half, n: g.n + half, digits, text: t.toUpperCase() };
      } catch (e) { /* not a grid reference after all */ }
    }
    if (POSTCODE.test(t)) return { kind: 'postcode', query: t.toUpperCase().replace(/^(\S+?)\s*(\d[A-Z]{2})$/, '$1 $2') };
    return null;
  }

  // National Grid -> lat/lon, through OSTN15 when its block is held (loaded here, hash-checked), else Helmert.
  async function gridToLatLon(e, n) {
    await OSTN.needBng(e, n);
    return OSTN.toLatLon(e, n);  // { lat, lon, ostn15 }
  }

  // ---- postcodes.io: one request per second at most, cached ----
  const cache = new Map(); let nextSlot = 0;
  const store = { get(k) { try { return JSON.parse(localStorage.getItem('pc:' + k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('pc:' + k, JSON.stringify(v)); } catch (e) { /* no storage: page cache only */ } } };
  async function lookupPostcode(pc) {
    const key = pc.replace(/\s/g, '');
    if (cache.has(key)) return cache.get(key);
    const kept = store.get(key); if (kept) { cache.set(key, kept); return kept; }
    const wait = Math.max(0, nextSlot - Date.now()); nextSlot = Date.now() + wait + 1000;
    if (wait) await new Promise(r => setTimeout(r, wait));
    const res = await fetch(API + encodeURIComponent(key));
    if (res.status === 404) { const miss = { missing: true }; cache.set(key, miss); return miss; }
    if (!res.ok) throw new Error('postcodes.io HTTP ' + res.status);
    const r = (await res.json()).result;
    const v = { postcode: r.postcode, e: r.eastings, n: r.northings, lat: r.latitude, lon: r.longitude, country: r.country };
    cache.set(key, v); store.set(key, v);
    return v;
  }

  // metres between two lat/lon (local flat earth; fine at these distances)
  const metres = (a, b) => { const k = Math.cos((a.lat + b.lat) * Math.PI / 360); return Math.hypot((a.lat - b.lat) * 111320, (a.lon - b.lon) * 111320 * k); };

  // Marker: a 6 m ring and a 30 m ring at ground, and a 40 m mast, around the landing point.
  function marker(lon, lat) {
    const L = [], ring = (r, n) => { for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n, b = 2 * Math.PI * (i + 1) / n;
      L.push([r * Math.cos(a), r * Math.sin(a), 0.5, r * Math.cos(b), r * Math.sin(b), 0.5]); } };
    L.push([0, 0, 0, 0, 0, 40], [-8, 0, 0.5, 8, 0, 0.5], [0, -8, 0.5, 0, 8, 0.5]); ring(6, 24); ring(30, 48);
    return { lon, lat, lines: L, find: true, address: true };
  }
  function land(S, lat, lon, text, zoom) {
    S.removeWhere(b => b.find);
    const b = marker(lon, lat), PF = S.PF || (window.__pf && window.__pf.PF);
    if (PF) { const an = PF.placeKey(lat, lon), off = PF.toLocal(an, lat, lon, 0);
      b.lines = b.lines.map(([a, c, d, e, f, g]) => [a + off.x, c + off.y, d, e + off.x, f + off.y, g]); b.anchor = an; b.buf = PF.wireBuffer(an, b.lines); }
    S.addBlock(b); S.repaint();
    S.map.flyTo({ center: [lon, lat], zoom, pitch: 50, bearing: S.map.getBearing(), curve: 1.6, speed: 1.2, essential: true });
    S.info(text);
    last = { lat, lon, text };
  }
  let last = null;
  const ref10 = (e, n) => { try { return BNG.gridRef(e, n, 10); } catch (x) { return '—'; } };
  const conv = o => o.ostn15 ? 'OSTN15' : 'Helmert (±5 m, no OSTN15 block here)';

  // text -> '' when landed, a message when not, or null when it is not an address (find-go should take it).
  async function go(S, raw) {
    await ready;
    const a = classify(raw); if (!a) return null;
    if (a.kind === 'latlon') {
      await OSTN.need(a.lat, a.lon); const g = OSTN.toBng(a.lat, a.lon);
      const bng = onGrid(g.e, g.n) && a.lat > 49 && a.lat < 61.5 ? ` · BNG ${ref10(g.e, g.n)} (${conv(g)})` : ' · outside the National Grid';
      land(S, a.lat, a.lon, `${a.lat.toFixed(6)}, ${a.lon.toFixed(6)} · typed (exact, WGS84)${bng}.`, 17);
      return '';
    }
    if (a.kind === 'en' || a.kind === 'gridref') {
      const p = await gridToLatLon(a.e, a.n);
      const what = a.kind === 'en' ? `E ${a.e} N ${a.n} · typed (exact)` : `${a.text} · typed grid reference; centre of its ${a.digits ? 10 ** (5 - a.digits / 2) : 100000} m square (E ${a.e} N ${a.n})`;
      land(S, p.lat, p.lon, `${what} · ${p.lat.toFixed(7)}, ${p.lon.toFixed(7)} by ${conv(p)}.`, a.digits && a.digits <= 4 ? 13 : 17);
      return '';
    }
    // postcode
    const r = await lookupPostcode(a.query);
    if (r.missing) return `${a.query}: not a live postcode on postcodes.io.`;
    const p = await gridToLatLon(r.e, r.n), gap = metres(p, { lat: r.lat, lon: r.lon });
    land(S, p.lat, p.lon, `${r.postcode} · published centroid (ONSPD grid ref E ${r.e} N ${r.n}, 1 m) · ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} by ${conv(p)}`
      + ` · ${gap.toFixed(1)} m from the lat/lon postcodes.io publishes · a centroid, not a building. ${CREDIT_PC}`, 17);
    return '';
  }

  (function wait(n) {
    if (!(window.SIM && window.SIM.map)) { if (n < 400) setTimeout(() => wait(n + 1), 50); return; }
    const S = window.SIM;
    // Take the find box's Enter for addresses only; everything else carries on to find-go untouched.
    // Decided synchronously (capture phase, before find-go's own listener): until the converters load, find-go keeps it.
    addEventListener('keydown', async e => {
      const inp = e.target; if (!inp || inp.id !== 'fg-in' || e.key !== 'Enter' || !inp.value.trim()) return;
      if (!BNG || !OSTN || !classify(inp.value)) return;
      e.stopImmediatePropagation(); e.preventDefault();
      const msg = document.getElementById('fg-msg'); if (msg) msg.textContent = '...';
      let t; try { t = await go(S, inp.value); } catch (err) { t = 'Could not resolve: ' + err.message; }
      if (msg) msg.textContent = t || ''; inp.blur();
    }, true);
    (function hint(k) { const i = document.getElementById('fg-in'); if (i) i.placeholder = 'go SW1A 1AA · go TQ 30 80 · go solar'; else if (k < 100) setTimeout(() => hint(k + 1), 100); })(0);
    S.addresses = { go: t => go(S, t), classify: t => ready.then(() => classify(t)), gridToLatLon: (e, n) => ready.then(() => gridToLatLon(e, n)), last: () => last };
    const q = new URLSearchParams(location.search).get('addr'); if (q) go(S, q);
  })(0);
})();
