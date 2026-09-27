// Help: the "How to use" part of the Controls panel (world.html #help). The words are in the page; this module
// makes the basis lines quote the same wording the readouts and the bill of quantities use (BASIS), so the help
// can never promise a different ground, accuracy or datum from the numbers it describes, and opens the
// How to use fold where the screen has room for it beside the controls (closed on phones: one tap opens it).
// Mouse and touch wording is chosen in CSS (pointer: fine / coarse), so nothing here depends on the device.

import { BASIS } from './boq-assumptions.mjs';

export const ROOMY = '(min-width: 700px)';

export function fillBasis(doc = document) {
  const set = (id, text) => { const el = doc.getElementById(id); if (el && text) el.textContent = text; };
  set('help-ground', BASIS.ground);
  set('help-datum', BASIS.datum);
}

export function mountHelp(doc = document, win = globalThis) {
  fillBasis(doc);
  const how = doc.getElementById('help-how');
  if (how && typeof win.matchMedia === 'function' && win.matchMedia(ROOMY).matches) how.open = true;
}

if (typeof document !== 'undefined') mountHelp(document, window);
