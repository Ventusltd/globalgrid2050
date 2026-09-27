// The breadcrumb bar and the phone chip strip, as data and as markup; the keys that move between levels; and what the
// browser history should do on each move. Pure: imports only nav-path.mjs, no DOM (the caller sets innerHTML and
// listens for clicks on [data-hash]).

import { crumbs, up, toHash, levelOf, samePath, fromHash, clean } from './nav-path.mjs';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SHORT = { plant: 'Plant', block: 'B', row: 'R', table: 'T', string: 'S' };

// { chips: [{ level, label, hash, current }], up: { hash } | null, scrollTo } for the path.
// phone: short labels ('B12') so five chips fit a 360 px strip; the strip scrolls sideways to the current (last) chip.
export function chipStrip(path, { phone = false } = {}) {
  const list = crumbs(path);
  const chips = list.map((c, i) => ({
    level: c.level, hash: c.hash, current: i === list.length - 1,
    label: phone && c.level !== 'plant' ? SHORT[c.level] + c.label.split(' ')[1] : c.label
  }));
  const p = clean(path);
  return { chips, up: levelOf(p) === 'plant' ? null : { hash: toHash(up(p)) }, scrollTo: chips.length - 1 };
}

// Markup for the strip. Desktop: 'Plant > Block 12 > Row 7' as buttons. Phone: 44 px chips and a big Up button first.
// Every button carries data-hash; the current place is aria-current and not a button (nothing to fly to).
export function chipHtml(strip, { phone = false } = {}) {
  const parts = strip.chips.map(c => (c.current
    ? `<span class="nav-chip nav-here" aria-current="location">${esc(c.label)}</span>`
    : `<button type="button" class="nav-chip" data-hash="${esc(c.hash)}">${esc(c.label)}</button>`));
  const upBtn = phone && strip.up ? `<button type="button" class="nav-up" data-hash="${esc(strip.up.hash)}" aria-label="Up one level">Up</button>` : '';
  const sep = phone ? '' : '<span class="nav-sep" aria-hidden="true"> &gt; </span>';
  return `<nav class="nav-crumbs${phone ? ' nav-phone' : ''}" aria-label="Where you are">${upBtn}${parts.join(sep)}</nav>`;
}

// Desktop keys: Escape or Backspace goes up one level; 1-5 go to that level of the current path (1 is the plant).
// Returns the new path, or null when the key is not ours (or would not move). Typing in a box is the caller's to skip.
export function keyMove(key, path) {
  const p = clean(path);
  if (key === 'Escape' || key === 'Backspace') return levelOf(p) === 'plant' ? null : up(p);
  if (/^[1-5]$/.test(key)) {
    const c = crumbs(p)[Number(key) - 1];
    return c && !samePath(c.path, p) ? c.path : null;
  }
  return null;
}

// History: going down a level pushes (so a phone's back gesture goes up); going up, or across at the same level, replaces
// (so back never bounces between sibling blocks); the same place does nothing.
// Returns { op: 'push' | 'replace' | 'none', hash }.
export function historyStep(from, to) {
  const a = clean(from), b = clean(to), hash = toHash(b);
  if (samePath(a, b)) return { op: 'none', hash };
  const depth = p => crumbs(p).length;
  const below = depth(b) > depth(a) && crumbs(b).some(c => samePath(c.path, a));
  return { op: below ? 'push' : 'replace', hash };
}

// On popstate or a pasted link: the path the hash names (the caller normalises it against the layout before flying).
export const pathFromLocation = hash => fromHash(hash);
