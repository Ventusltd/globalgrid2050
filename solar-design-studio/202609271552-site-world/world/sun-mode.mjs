// Sun mode: one Sun toggle in the Layers panel (the dash keeps Walk, Drone, Find, Design, Layers). When on, a slim time bar along the bottom
// (date, time of day, play/pause at a chosen speed; opens at the current hour today, site time), the sun's
// direction for the shade layer, grid lines a little brighter on sunlit slopes and dimmer in shadow, and a
// readout where you stand: elevation, bearing, direct-sun hours today from the terrain horizon, first and
// last direct sun. When the site offers measured sun climate (manifest site.sun), typical monthly sunshine
// and horizon-shaded irradiation for the month are shown too, with the source credited in the footer.
// Until then the readout says "clear sky, terrain only". Nothing here calls a live API; every file is local
// and hash-checked. The page draws only while playing (up to PLAY_FPS) or when something changes.

import { solarPosition, sunDirection, gridConvergence, MIN_MS, MAX_MS } from './sun.mjs';
import { bngToWgs84 } from './bng.mjs';
import { SITE_ZONE, zoneParts, zonedToUtc, zoneDay, zoneLabel, horizonFunction, directSunDay, groundNormal, lightFactor,
  scaleColour, splitIntoPatches, LIGHT } from './sun-day.mjs';
import { readClimate, readCellIndex, readCellTile, tileFor, tileDistance, cellValue, climateLines } from './sun-climate.mjs';
import { makeApi } from './layers.mjs';

export const PLAY_FPS = 30;
export const SPEEDS = [{ minutes: 10, label: '10 min/s' }, { minutes: 60, label: '1 h/s' }, { minutes: 180, label: '3 h/s' }];
export const LIT_KEYS = ['ground-grid/minor', 'ground-grid/major'];
export const GEOMETRIC = 'Clear sky, terrain only';
export const CELL_NEAR_M = 96, CELL_KEEP = 4;
const HOUR_MS = 3600000, FOOT = 'var(--foot, 20px)', SUN_H = 'var(--sun-h, 0px)';

const CSS = `
#sun-row { margin: 0 0 8px; }
#sun-bar { position: fixed; left: 8px; right: 8px; bottom: calc(${FOOT} + 4px); box-sizing: border-box; background: var(--panel);
  border: 1px solid var(--edge); border-radius: 6px; padding: 4px 8px 6px; }
#sun-bar[hidden] { display: none; }
#sun-readout { margin: 0 0 4px; color: var(--dim); font-size: 11px; line-height: 15px; }
#sun-readout span { display: block; } #sun-readout .lead { color: var(--text); }
#sun-bar .sun-row { display: flex; gap: 6px; align-items: center; }
#sun-bar button, #sun-bar input[type="date"], #sun-bar select { min-height: var(--btn, 30px); background: #111; color: var(--text);
  border: 1px solid var(--edge); border-radius: 4px; font: inherit; box-sizing: border-box; }
#sun-play { min-width: var(--btn, 30px); cursor: pointer; }
#sun-play[aria-pressed="true"] { border-color: var(--line); }
#sun-hour { flex: 1 1 120px; min-width: 80px; height: var(--btn, 30px); margin: 0; accent-color: #9cdbff; }
#attribution .sun-credit[hidden] { display: none; }
body.sun-on #help-toggle { bottom: calc(${FOOT} + ${SUN_H} + 10px); }
body.sun-on #pad { bottom: calc(${FOOT} + ${SUN_H} + 16px); }
@media (max-width: 600px) { #sun-bar .sun-row { flex-wrap: wrap; } #sun-hour { flex-basis: 100%; order: -1; } }
@media (pointer: fine) {
  body.sun-on #where { bottom: calc(${FOOT} + ${SUN_H} + 12px); }
  body.sun-on #help { bottom: calc(${FOOT} + ${SUN_H} + 46px); max-height: calc(100vh - ${FOOT} - ${SUN_H} - 110px); }
  body.sun-on:has(#help:not([hidden])) #lift { right: calc(min(320px, 100vw - 20px) + 20px); } /* Up/Down beside Controls */
  body.sun-on #layers, body.sun-on #design { max-height: calc(100vh - var(--btn, 30px) - 64px - ${FOOT} - ${SUN_H}); } /* above the time bar */
}
@media (pointer: coarse) {
  #sun-bar button, #sun-bar input[type="date"], #sun-bar select { min-height: 44px; }
  #sun-play { min-width: 44px; } #sun-hour { height: 44px; }
  body.sun-on #lift, body.sun-on #layers:not([hidden]) ~ #lift, body.sun-on #design:not([hidden]) ~ #lift {
    bottom: calc(${FOOT} + ${SUN_H} + 64px); transform: none; }
  body.sun-on #help, body.sun-on #layers, body.sun-on #find.find-panel {
    max-height: calc(100vh - var(--btn, 44px) - 40px - ${FOOT} - 180px - ${SUN_H}); }
  body.sun-on #plan { bottom: calc(${FOOT} + ${SUN_H} + 180px); } /* the plan inset stays above the joypad */
  body.sun-on[data-panel="design"] #sun-bar { display: none; } /* the Design sheet takes the bottom of the screen */
}`;

const el = (tag, attrs = {}, text = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
};
const hours = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

// h: { pos(), heightAt(x, y), origin() -> { e, n }, site() -> manifest site, layer(id), base (URL of the world
//      folder), redraw(), onPlay(), onToggle?(on), setShade?(on) (the page switches the shadow layer), now?(), zone? }. Returns the hooks the substrate calls each frame.
export function attachSunMode(h) {
  const zone = h.zone || SITE_ZONE, clock = h.now || (() => Date.now());
  const api = makeApi(h.base || new URL('./world/', location.href).href, { invalidate: () => h.redraw() });
  let on = false, playing = false, speed = 60, utcMs = Math.floor(clock() / HOUR_MS) * HOUR_MS;
  let place = null, sunNow = null, sunKey = '';
  let dayKey = '', dayInfo = null, lastLines = [], lastHeight = -1;
  let climate = null, cells = null, dataState = 'idle', note = '';
  const cellTiles = new Map(), cellLoading = new Set(), splits = new Map(), factors = new Map();

  // ------------------------------------------------------------ DOM
  const style = el('style'); style.textContent = CSS; document.head.append(style);
  const toggle = el('button', { type: 'button', id: 'sun-toggle', 'aria-pressed': 'false', 'aria-label': 'Sun',
    'aria-controls': 'sun-bar', title: 'Sun: light, shade and time of day' }, '☀ Sun');
  const layers = document.getElementById('layers'), head = layers?.querySelector('.head'), sunRow = el('div', { class: 'row', id: 'sun-row' });
  sunRow.append(toggle);
  if (head) head.after(sunRow); else (layers || document.getElementById('help'))?.append(sunRow);
  const bar = el('section', { id: 'sun-bar', 'aria-label': 'Sun and time of day' });
  bar.hidden = true;
  const readout = el('p', { id: 'sun-readout' });
  const row = el('div', { class: 'sun-row' });
  const play = el('button', { type: 'button', id: 'sun-play', 'aria-pressed': 'false', 'aria-label': 'Play' }, '▶');
  const date = el('input', { type: 'date', id: 'sun-date', 'aria-label': 'Date', min: '1800-01-01', max: '2100-12-31' });
  const hour = el('input', { type: 'range', id: 'sun-hour', 'aria-label': 'Time of day', min: '0', max: '1439', step: '15' });
  const pace = el('select', { id: 'sun-speed', 'aria-label': 'Playing speed' });
  for (const s of SPEEDS) { const o = el('option', { value: String(s.minutes) }, s.label); if (s.minutes === speed) o.selected = true; pace.append(o); }
  row.append(play, date, hour, pace);
  bar.append(readout, row);
  document.body.append(bar);
  const credit = el('span', { class: 'sun-credit' });
  credit.hidden = true;
  document.getElementById('attribution')?.append(credit);

  // A pointer click hands the keys back to the world (Space flies up); a keyboard press keeps focus here.
  const back = e => { if (e.detail > 0) document.getElementById('view')?.focus(); };
  toggle.addEventListener('click', e => { setOn(!on); back(e); });
  play.addEventListener('click', e => { setPlaying(!playing); back(e); });
  pace.addEventListener('change', () => { speed = Number(pace.value) || 60; });
  date.addEventListener('change', () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.value);
    if (m) setTime(zonedToUtc(+m[1], +m[2], +m[3], zoneParts(utcMs, zone).minuteOfDay, zone));
  });
  hour.addEventListener('input', () => { const p = zoneParts(utcMs, zone); setTime(zonedToUtc(p.year, p.month, p.day, Number(hour.value), zone)); });

  // ------------------------------------------------------------ state
  function setOn(next) {
    on = !!next;
    toggle.setAttribute('aria-pressed', String(on));
    bar.hidden = !on;
    document.body.classList.toggle('sun-on', on);
    if (!on && playing) setPlaying(false);
    if (!on) cellTiles.clear();
    if (on && dataState === 'idle') loadData();
    enableShade(true);
    h.onToggle?.(on);
    credit.hidden = !(on && climate);
    refresh();
    h.redraw();
  }
  function setPlaying(next) {
    playing = !!next && on;
    play.setAttribute('aria-pressed', String(playing));
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    play.textContent = playing ? '❚❚' : '▶';
    h.onPlay?.(playing);
  }
  function setTime(ms) {
    utcMs = Math.min(MAX_MS, Math.max(MIN_MS, Math.round(ms)));
    refresh();
    h.redraw();
  }
  let shadeByUs = false; // Sun switched the terrain shadow on, so Sun switches it off again
  function enableShade(changed = false) {
    if (h.setShade) { // the page's Layers panel owns the shadow switch (it loads the layer on first use and credits it)
      if (!changed) return;
      if (on) { shadeByUs = !h.layer('shade')?.enabled; h.setShade(true); } else if (shadeByUs) { shadeByUs = false; h.setShade(false); }
      return;
    }
    const shade = h.layer('shade');
    if (shade && typeof shade.setEnabled === 'function' && shade.enabled !== on) shade.setEnabled(on);
  }

  // Place and sun: the viewer's latitude and longitude (to 250 m), then the sun for the current moment.
  function refresh() {
    const o = h.origin(), [x, y] = h.pos(), e = o.e + Math.round(x / 250) * 250, n = o.n + Math.round(y / 250) * 250;
    if (!place || place.e !== e || place.n !== n) {
      const g = bngToWgs84(e, n);
      place = { e, n, lat: g.lat, lon: g.lon, convergence: gridConvergence(g.lat, g.lon), key: `${e},${n}` };
    }
    const key = `${utcMs}@${place.key}`;
    if (key !== sunKey) {
      sunKey = key;
      const s = solarPosition(place.lat, place.lon, utcMs), azimuth = ((s.azimuth - place.convergence) % 360 + 360) % 360;
      sunNow = { azimuth, elevation: s.elevation, trueAzimuth: s.azimuth, direction: sunDirection({ azimuth, elevation: s.elevation }) };
    }
    syncInputs();
  }
  function syncInputs() {
    const l = zoneLabel(utcMs, zone);
    if (date.value !== l.date) date.value = l.date;
    const m = String(l.parts.minuteOfDay);
    if (hour.value !== m && document.activeElement !== hour) hour.value = m;
  }

  // ------------------------------------------------------------ measured sun climate (optional)
  function loadData() {
    const cfg = h.site()?.sun;
    if (!cfg) { dataState = 'none'; return; }
    dataState = 'loading';
    const jobs = [];
    if (cfg.climate?.path && cfg.climate?.sha256) {
      jobs.push(api.fetchJSON(cfg.climate.path, cfg.climate.sha256).then(j => {
        climate = readClimate(j);
        credit.textContent = ` · ${climate.short}`; // HadUK-Grid sunshine (OGL, with its DOI) and PVGIS irradiance, both credited
        credit.title = [climate.haduk && `${climate.haduk.credit} Licence: ${climate.haduk.licence}.`,
          `${climate.credit} ${climate.licence}.`].filter(Boolean).join(' ');
      }));
    }
    if (cfg.cells?.index && cfg.cells?.sha256) {
      jobs.push(api.fetchJSON(cfg.cells.index, cfg.cells.sha256).then(j => { cells = readCellIndex(j, cfg.cells.index); }));
    }
    Promise.allSettled(jobs).then(r => {
      const bad = r.filter(x => x.status === 'rejected').map(x => x.reason?.message || String(x.reason));
      note = bad.join('; ');
      dataState = 'ready';
      credit.hidden = !(on && climate);
      dayKey = '';
      h.redraw();
    });
  }
  // Sun-cell tiles (about 200 kB each) load only while Sun mode is on, only the tile under the viewer and those
  // within CELL_NEAR_M of it, and at most CELL_KEEP are kept; the farthest go first. Turning Sun off drops them.
  function cellHere(x, y, month) {
    if (!cells) return null;
    const o = h.origin(), e = o.e + x, n = o.n + y;
    for (const t of tilesNear(cells, e, n)) {
      if (cellTiles.has(t.key) || cellLoading.has(t.key) || cellLoading.size >= 2) continue;
      cellLoading.add(t.key);
      api.fetchVerified(t.path, t.sha256).then(b => { if (on) cellTiles.set(t.key, readCellTile(b)); })
        .catch(err => { note = `sun cell ${t.key}: ${err.message}`; cellTiles.set(t.key, null); })
        .finally(() => { cellLoading.delete(t.key); trimCells(e, n); dayKey = ''; h.redraw(); });
    }
    const t = tileFor(cells, e, n), tile = t && cellTiles.get(t.key);
    if (!tile) return null;
    const direct = cellValue(tile, cells, e, n, month, 'tmy_direct_kwh_m2');
    return direct === null ? null : { direct, sunshine: cellValue(tile, cells, e, n, month, 'sunshine_hours'),
      open: cells.base.tmy_direct_kwh_m2[month - 1] };
  }
  function tilesNear(index, e, n) {
    return index.tiles.map(t => ({ t, d: tileDistance(index, t, e, n) })).filter(x => x.d <= CELL_NEAR_M)
      .sort((a, b) => a.d - b.d).slice(0, CELL_KEEP).map(x => x.t);
  }
  function trimCells(e, n) {
    if (cellTiles.size <= CELL_KEEP) return;
    const far = cells.tiles.filter(t => cellTiles.has(t.key)).sort((a, b) => tileDistance(cells, b, e, n) - tileDistance(cells, a, e, n));
    for (const t of far.slice(0, cellTiles.size - CELL_KEEP)) cellTiles.delete(t.key);
  }

  // ------------------------------------------------------------ light cue on grid lines
  function factorFor(p, ctx, shade) {
    const id = `${p.ix},${p.iy}`;
    let f = factors.get(id);
    if (!f || f.gv !== ctx.groundVersion) {
      if (factors.size > 2000) factors.clear();
      f = { gv: ctx.groundVersion, normal: groundNormal(ctx.heightAt, p.cx, p.cy, LIGHT.patch / 2), sunKey: '', value: 1 };
      factors.set(id, f);
    }
    if (f.sunKey !== sunKey) {
      let known = 0, dark = 0;
      if (shade && sunNow.elevation > 0) {
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
          const a = shade.horizonAngle(p.cx + i * LIGHT.patch / 3, p.cy + j * LIGHT.patch / 3, sunNow.azimuth);
          if (Number.isFinite(a)) { known++; if (sunNow.elevation < a) dark++; }
        }
      }
      f.value = lightFactor(sunNow, f.normal, known ? dark / known : 0);
      f.sunKey = sunKey;
    }
    return f.value;
  }

  // ------------------------------------------------------------ readout
  function write(lines) {
    if (lines.length === lastLines.length && lines.every((l, i) => l === lastLines[i])) return;
    lastLines = lines;
    readout.replaceChildren(...lines.map((l, i) => el('span', i ? {} : { class: 'lead' }, l)));
    const px = bar.offsetHeight;
    if (px !== lastHeight) { lastHeight = px; document.documentElement.style.setProperty('--sun-h', px + 'px'); }
  }
  function update(ctx) {
    const [x, y] = ctx.pos, shade = h.layer('shade');
    const profile = typeof shade?.horizonProfile === 'function' ? shade.horizonProfile(x, y) : null;
    const day = zoneDay(utcMs, zone), label = zoneLabel(utcMs, zone);
    const key = `${Math.floor(x / 4)},${Math.floor(y / 4)}|${day.key}|${profile ? 'h' : '-'}|${place.key}`;
    if (key !== dayKey) {
      dayKey = key;
      dayInfo = directSunDay(place.lat, place.lon, day.start, day.end, horizonFunction(profile), { convergence: place.convergence });
      dayInfo.horizon = !profile ? 'none' : profile.some(v => !Number.isFinite(v)) ? 'partial' : 'full';
    }
    const s = sunNow, t = ms => zoneLabel(ms, zone).time;
    const lead = `${label.date} ${label.time} ${label.zone} · ` + (s.elevation > 0
      ? `sun ${s.elevation.toFixed(1)}° up, bearing ${Math.round(s.trueAzimuth)}° from true north`
      : 'sun below the horizon');
    const d = dayInfo;
    let here = d.first === null ? `Here today: no direct sun (${hours(d.daylightHours)} of daylight)`
      : `Here today: ${hours(d.directHours)} of direct sun, first ${t(d.first)}, last ${t(d.last)}`;
    if (d.horizon === 'none') here += ' · terrain horizon not loaded here';
    else if (d.horizon === 'partial') here += ' · horizon partly beyond the site';
    const month = label.parts.month, extra = climateLines(climate, month, cellHere(x, y, month));
    write([lead, here, ...(extra.length ? extra : [GEOMETRIC])]);
  }

  return {
    PLAY_FPS,
    on: () => on,
    playing: () => playing,
    // Moves the clock on by a frame's interval while playing.
    advance(intervalMs) {
      if (!playing) return;
      const next = utcMs + (Math.min(intervalMs, 100) / 1000) * speed * 60000;
      if (next >= MAX_MS) setPlaying(false);
      utcMs = Math.min(MAX_MS, next);
      refresh();
    },
    // The sun for the layers (grid azimuth, elevation), or undefined when Sun mode is off.
    sun: () => (on && sunNow ? { azimuth: sunNow.azimuth, elevation: sunNow.elevation } : undefined),
    // Splits the ground grid into patches and scales each patch's colour by its light factor.
    decorate(batches, ctx) {
      if (!on || !sunNow) return batches;
      const shade = typeof h.layer('shade')?.horizonAngle === 'function' ? h.layer('shade') : null, out = [];
      for (const b of batches) {
        if (!LIT_KEYS.includes(b.key) || !b.positions) { out.push(b); continue; }
        let sp = splits.get(b.key);
        if (!sp || sp.version !== b.version || sp.positions !== b.positions) {
          sp = { version: b.version, positions: b.positions, patches: splitIntoPatches(b) };
          splits.set(b.key, sp);
        }
        for (const p of sp.patches) out.push({ key: p.key, version: p.version, origin: p.origin, positions: p.positions,
          color: scaleColour(b.color, factorFor(p, ctx, shade)) });
      }
      return out;
    },
    afterDraw(ctx) {
      if (!on) return;
      enableShade();
      refresh();
      update(ctx);
    },
    setTime, setOn, setPlaying,
    debug: () => ({ on, playing, speed, utcMs, sun: sunNow, place, day: dayInfo, lines: [...lastLines], dataState, note,
      climate: !!climate, cells: !!cells, cellTiles: [...cellTiles.keys()], patches: [...splits.values()].reduce((n, s) => n + s.patches.length, 0),
      factors: [...factors.values()].map(f => f.value) })
  };
}
