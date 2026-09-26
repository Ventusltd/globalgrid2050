// Date and time for the Terrain shadow layer: a date field and a time-of-day slider (UTC) under the Layers panel,
// shown only while the layer is on. Each change works out the sun at the site centre (sun.mjs) and hands the layer
// its grid bearing (true bearing less the grid convergence) and elevation.
import { timeState, applyTime, timeView, sunAt, gridConvergence } from './sun.mjs';
import { bngToWgs84 } from './bng.mjs';

// The moment to start from: now, or today's solar noon when the sun is down (a shadow at night shows nothing).
export function startState(lat, lon, nowMs = Date.now()) {
  const now = timeState(nowMs, 15);
  return sunAt(lat, lon, now).up ? now : applyTime(now, { type: 'solarNoon', lon });
}

// { azimuth, elevation, status } the shade layer takes for one moment at one place.
export function gridSun(lat, lon, state) {
  const s = sunAt(lat, lon, state);
  return { azimuth: s.azimuth - gridConvergence(lat, lon), elevation: s.elevation, status: s.status };
}

// host: element to hold the control. layer: the shade layer object. site: { centre_e, centre_n }.
// Returns { element, show(v), state() } or null when there is no layer or site.
export function mountSunControl(host, { layer, site, nowMs } = {}) {
  if (!host || !layer || typeof layer.setSun !== 'function' || !site) return null;
  const { lat, lon } = bngToWgs84(site.centre_e, site.centre_n);
  const doc = host.ownerDocument || document;
  let state = startState(lat, lon, nowMs);
  const box = doc.createElement('fieldset');
  box.className = 'sun-time';
  box.hidden = true;
  box.innerHTML = '<legend>Sun for the terrain shadow</legend>' +
    '<label>Date <input type="date" data-sun="date"></label>' +
    '<label>Time (UTC) <input type="range" min="0" max="1439" step="15" data-sun="minute"></label>' +
    '<p class="note" aria-live="polite" data-sun="status"></p>';
  const date = box.querySelector('[data-sun="date"]'), minute = box.querySelector('[data-sun="minute"]');
  const status = box.querySelector('[data-sun="status"]');
  const apply = () => {
    const v = timeView(state), s = gridSun(lat, lon, state);
    date.value = v.date; minute.value = String(v.minuteOfDay);
    status.textContent = s.status;
    layer.setSun(s);
  };
  date.addEventListener('change', () => {
    const [y, m, d] = date.value.split('-').map(Number);
    try { state = applyTime(state, { type: 'date', year: y, month: m, day: d }); } catch { /* keep the last good date */ }
    apply();
  });
  minute.addEventListener('input', () => { state = applyTime(state, { type: 'minuteOfDay', minute: Number(minute.value) }); apply(); });
  host.appendChild(box);
  apply();
  return { element: box, show(v) { box.hidden = !v; }, state: () => state };
}
