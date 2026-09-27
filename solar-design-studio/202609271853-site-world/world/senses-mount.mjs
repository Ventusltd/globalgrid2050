// senses-mount.mjs: the jump (Space in Walk) and the binoculars switch (B), mounted just after the first frame.
// The jump (jump.mjs) is small and loads with this; the binoculars (binoculars-mount.mjs and binoculars-lens.mjs) load
// the first time they are switched on: the B key, the icon in the corner of the view (mouse screens), the Binoculars
// button under Controls (every screen; on a phone the dash keeps its five buttons), or the command line.
// Phones jump with a double tap on the centre of the move pad. Nothing here draws unless something moves.

import { createJump } from './jump.mjs';

const typing = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || !!t?.isContentEditable;
const GLYPH = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">'
  + '<circle cx="6.5" cy="15" r="4"/><circle cx="17.5" cy="15" r="4"/><path d="M10.5 15h3M4 11l2-6h3l1 6M20 11l-2-6h-3l-1 6"/></svg>';
const CSS = `
  #bino-corner { position: fixed; right: 10px; top: calc(50% + 64px); width: 30px; /* under the drone's Up and Down, clear of the sun bar */
    height: 30px; padding: 0; display: grid;
    place-items: center; background: var(--panel); color: var(--dim); border: 1px solid var(--edge); border-radius: 4px; cursor: pointer; }
  #bino-corner[aria-pressed="true"] { color: #fff; border-color: var(--line); }
  @media (pointer: coarse) { #bino-corner { display: none; } }
  body[data-panel] #bino-corner { display: none; }`;
const PAD_TAP_MS = 350, PAD_CENTRE_PX = 20;

// deps: { api (the substrate's extension api), world (window.world), doc }
export function mountSenses({ api, world, doc = document }) {
  const legs = createJump();
  api.setLegs(legs);
  const walking = () => api.state().view === 'standing';
  const go = () => { api.resumeGate(); api.gate.invalidate(); };
  // When a jump comes to rest (landed, the eye settled) the loop goes back to still: 0 fps.
  let was = false;
  api.hooks.after.add(() => { const b = legs.busy(); if (was && !b) api.resumeGate(); was = b; });

  const jump = () => { if (!walking()) return false; legs.press(); go(); return true; };
  const land = () => legs.release();
  addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (typing(e.target) || e.target instanceof HTMLButtonElement) return;
    jump(); // in Drone, input.mjs already climbs on Space
  });
  addEventListener('keyup', e => { if (e.code === 'Space') land(); });
  addEventListener('blur', land);
  // Phones: a double tap on the centre of the move pad; holding the second tap jumps a little higher.
  const pad = doc.getElementById('pad');
  let lastTap = -Infinity;
  pad?.addEventListener('pointerdown', e => {
    const r = pad.getBoundingClientRect(), off = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    if (off > PAD_CENTRE_PX) { lastTap = -Infinity; return; }
    if (e.timeStamp - lastTap <= PAD_TAP_MS) { lastTap = -Infinity; jump(); } else lastTap = e.timeStamp;
  });
  for (const ev of ['pointerup', 'pointercancel']) pad?.addEventListener(ev, land);

  // ---- binoculars ----
  let bino = null, loading = null;
  const load = () => (loading ||= import('./binoculars-mount.mjs')
    .then(m => (bino = m.createBinoculars({ api, world, doc, onChange: mark })))
    .catch(e => { loading = null; console.warn('binoculars: ' + e.message); throw e; }));
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
  const corner = doc.createElement('button');
  corner.type = 'button'; corner.id = 'bino-corner'; corner.innerHTML = GLYPH;
  corner.title = 'Binoculars (B): 7× and 10×, with a rangefinder'; corner.setAttribute('aria-label', 'Binoculars'); corner.setAttribute('aria-pressed', 'false');
  doc.body.appendChild(corner);
  const inControls = doc.createElement('button');
  inControls.type = 'button'; inControls.id = 'bino-controls'; inControls.textContent = 'Binoculars'; inControls.setAttribute('aria-pressed', 'false');
  inControls.title = 'Narrow view at 7× or 10× (wheel or pinch to step), with a rangefinder in the middle';
  doc.getElementById('help-links')?.append(inControls);
  function mark() { const on = String(!!bino?.on()); corner.setAttribute('aria-pressed', on); inControls.setAttribute('aria-pressed', on); }
  const set = async on => { if (!on && !bino) return false; const b = bino || await load(); b.set(on); mark(); return b.on(); };
  const toggle = () => set(!bino?.on()).catch(() => {});
  corner.addEventListener('click', () => { toggle(); (doc.getElementById('view') || doc.body).focus?.(); });
  inControls.addEventListener('click', () => { toggle(); });
  addEventListener('keydown', e => {
    if (e.code !== 'KeyB' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    e.preventDefault(); toggle();
  });

  // The command line's hook (cmd-run.mjs): binoculars on|off, zoom 7|10, range.
  api.senses = {
    async binoculars({ on, zoom, range }) {
      if (range) return bino?.on() ? bino.rangeText() : (bino?.lastText() || 'Binoculars are off: type binoculars on, then range.');
      if (zoom) { await set(true); bino.zoom(zoom); return `Binoculars at ${bino.mag()}×. ${bino.rangeText()}`; }
      const now = await set(on);
      return now ? `Binoculars on at ${bino.mag()}× (B or the corner icon to put them down). ${bino.rangeText()}` : 'Binoculars off.';
    }
  };
  return { legs, binoculars: () => bino, set, jump, land, debug: () => ({ jump: legs.debug(), binoculars: bino?.debug() ?? null }) };
}
