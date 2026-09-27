// First showing: the first step, offered once (a small card that opens Find; dismissed for good with × or by using
// Find), and the place just found: a card with its grid reference and the nearest substation, and a pin on the ground.
// A REPD project is named on the card by its reference only; project names stay in the Find results the user asked for.
import { gridRef } from './bng.mjs';
import { toLocal } from './origin.mjs';
import { distanceLabel } from './labels.mjs';

const START_KEY = 'world.start.dismissed';
export const PHONE = '(max-width: 700px), (pointer: coarse)';
export const SUBSTATION_REACH_M = 5000; // further than this, the grid data here is not the grid near the place

// The words for the place card: "REPD 1234" for a project, else the label the search gave (postcode, coordinates).
export const placeLabel = choice => (choice?.ref != null && choice.ref !== '' ? `REPD ${choice.ref}` : String(choice?.label ?? ''));

// The nearest substation line from { label, d, national? } (or null) and the nearest pylon, in plain words. A substation
// from the national index is the true nearest, so its distance is always given.
export function substationLine(sub, tower) {
  if (sub && (sub.national || sub.d <= SUBSTATION_REACH_M)) return `Nearest ${sub.label}: ${distanceLabel(sub.d)}`;
  const none = `No substation within ${SUBSTATION_REACH_M / 1000} km in the grid data loaded`;
  return tower ? `${none} · nearest ${tower.label} ${distanceLabel(tower.d)}` : none;
}

// The pin at (x, y, z) local: a 40 m mast with a diamond on the ground, so it can be seen from the drone.
export function pinBatch(x, y, z, version) {
  const r = 6, h = 40;
  const v = [0, 0, 0, 0, 0, h, -r, 0, 0, 0, r, 0, 0, r, 0, r, 0, 0, r, 0, 0, 0, -r, 0, 0, -r, 0, -r, 0, 0,
    0, 0, h, -3, 0, h - 6, 0, 0, h, 3, 0, h - 6];
  return { key: 'place-pin', version, positions: new Float32Array(v), color: [1, 0.45, 0.85, 1], origin: [x, y, z] };
}

// deps: { doc, canvas, redraw(), origin(), heightAt(x, y), groundVersion(), assets() -> [{ kind, label, e, n }],
//   nearest?(e, n) -> Promise<substation | null> (the national index), openFind() }.
export function mountFirstShowing({ doc = document, canvas, redraw, origin, heightAt, groundVersion, assets = () => [], nearest = null, openFind }) {
  const $ = id => doc.getElementById(id);
  let place = null; // { label, e, n } national-grid metres
  const remembered = () => { try { return localStorage.getItem(START_KEY) === '1'; } catch { return false; } };
  function dismissStart() {
    if ($('start')) $('start').hidden = true;
    try { localStorage.setItem(START_KEY, '1'); } catch { /* private window: it just shows again next time */ }
  }
  // On a phone the card would sit over the view: there Find starts closed and opens only from the Find button.
  const phone = () => { try { return !!globalThis.matchMedia?.(PHONE).matches; } catch { return false; } };
  if ($('start')) $('start').hidden = remembered() || phone();
  $('start-close')?.addEventListener('click', () => { dismissStart(); canvas?.focus(); });
  // The card steps aside once the view is used: a press on the ground or a movement key (user test: it never went).
  const aside = () => { if ($('start') && !$('start').hidden) dismissStart(); };
  canvas?.addEventListener('pointerdown', aside, { once: true });
  doc.addEventListener('keydown', e => { if (/^(Arrow|Key[WASD]$)/.test(e.code || '')) aside(); });
  $('start-go')?.addEventListener('click', () => openFind?.());
  $('place-close')?.addEventListener('click', () => { $('place').hidden = true; place = null; redraw(); canvas?.focus(); });

  // Nearest substation and pylon in the grid data loaded here; the national index answers for the substation when it can.
  async function gridLine(e, n) {
    const all = assets(), near = kind => all.filter(a => a.kind === kind)
      .map(a => ({ ...a, d: Math.hypot(a.e - e, a.n - n) })).sort((a, b) => a.d - b.d)[0] || null;
    let sub = near('substation');
    if (nearest) {
      try {
        const a = await nearest(e, n);
        if (a) sub = { ...a, national: true, d: Math.hypot(a.e - e, a.n - n),
          label: a.label || (a.kv ? `${a.kv} kV substation` : a.tier ? `${a.tier} substation` : 'substation') };
      } catch { /* local data only */ }
    }
    if (!sub && !all.length) return 'Grid data not loaded for this area';
    return substationLine(sub, near('tower'));
  }

  // Names the place just found, pins it, and says what is known there. note: the arrival note (terrain), or ''.
  function showPlace(choice, e, n, note = '') {
    place = { label: placeLabel(choice), e, n };
    $('place-name').textContent = place.label;
    let ref = '';
    try { ref = gridRef(e, n, 8); } catch { /* off the national grid */ }
    $('place-grid').textContent = ref;
    const mine = place;
    gridLine(e, n).then(t => { if (place === mine) $('place-grid').textContent = ref ? `${ref} · ${t}` : t; });
    $('place-terrain').textContent = note;
    $('place').hidden = false;
    redraw();
  }

  return {
    dismissStart, showPlace,
    place: () => (place ? { ...place } : null),
    batches() {
      if (!place) return [];
      const o = origin(), [x, y] = toLocal(o, place.e, place.n);
      return [pinBatch(x, y, heightAt(x, y), `${o.id}:${groundVersion()}:${place.e}:${place.n}`)];
    }
  };
}
