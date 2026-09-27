// Range for the wider-area roads and rail (layers/national.mjs): 2, 5 or 10 miles, under the Layers panel, shown only
// while that layer is on. The choice survives a reload (browser storage, when there is any). Phones start at 2 miles.
export const RANGES_MI = [2, 5, 10];
const KEY = 'world.national.range';

export function startMiles(store, coarse) {
  let v = NaN;
  try { v = Number(store?.getItem(KEY)); } catch { /* no storage */ }
  return RANGES_MI.includes(v) ? v : coarse ? 2 : 5;
}

// host: element to hold the control. layer(): the national layer once loaded (or null). onChange(miles) after a choice.
// Returns { element, show(v), miles(), apply() }: apply() hands the range to the layer (it loads after first switch-on).
export function mountRange(host, { layer = () => null, store = null, coarse = false, onChange = () => {} } = {}) {
  if (!host) return null;
  const doc = host.ownerDocument || document;
  let miles = startMiles(store, coarse);
  const box = doc.createElement('fieldset');
  box.className = 'sun-time national-range';
  box.hidden = true;
  box.innerHTML = '<legend>Roads and rail, wider area: range</legend><div class="row" role="group" aria-label="Range"></div>';
  const row = box.querySelector('.row');
  const buttons = RANGES_MI.map(mi => {
    const b = doc.createElement('button');
    b.type = 'button'; b.dataset.range = String(mi); b.textContent = `${mi} miles`;
    b.addEventListener('click', () => set(mi));
    row.appendChild(b);
    return b;
  });
  function apply() {
    const l = layer();
    if (l && typeof l.setRange === 'function' && typeof l.range === 'function' && Math.abs(l.range() - miles * 1609.344) > 1) l.setRange(miles);
  }
  function set(mi) {
    miles = mi;
    for (const b of buttons) b.setAttribute('aria-pressed', String(Number(b.dataset.range) === miles));
    try { store?.setItem(KEY, String(miles)); } catch { /* private window */ }
    apply(); onChange(miles);
  }
  for (const b of buttons) b.setAttribute('aria-pressed', String(Number(b.dataset.range) === miles));
  host.appendChild(box);
  return { element: box, show(v) { box.hidden = !v; if (v) apply(); }, miles: () => miles, apply, set };
}
