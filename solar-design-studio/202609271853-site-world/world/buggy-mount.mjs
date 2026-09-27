// buggy-mount.mjs: Buggy mode's only part that loads with the world (just after the first frame): the E key, a small
// mount chip (not a dash button: the dash keeps its five), and the typed "buggy" commands. The driving itself
// (buggy-ui.mjs and buggy-physics.mjs) loads the first time any of them is used.
//   buggy on | off · buggy speed 15 (km/h, 1 to 25) · buggy grip 0.4 (0.1 to 1) · buggy ground grass|wet|gravel · buggy seat|chase

export const LIMITS = Object.freeze({ speed: { min: 1, max: 25, unit: 'km/h', label: 'top speed' },
  grip: { min: 0.1, max: 1, unit: '', label: 'grip (friction coefficient)' } });
const WORDS = ['on', 'off', 'seat', 'chase', 'grass', 'wet', 'gravel'];
const USAGE = 'buggy on|off · buggy speed 15 · buggy grip 0.4 · buggy ground grass|wet|gravel · buggy seat|chase';

// A typed line to a buggy command: null when the line is not about the buggy; { ok: false, why } refuses it in words,
// never clamps; { ok: true, act, value } otherwise.
export function parseBuggy(line) {
  const t = String(line ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (t[0] !== 'buggy') return null;
  const [, a, b, extra] = t, no = why => ({ ok: false, why: `${why} (${USAGE}). Nothing was changed.` });
  if (!a) return { ok: true, act: 'toggle' };
  if (extra !== undefined) return no(`buggy does not read "${extra}"`);
  if (a === 'speed' || a === 'grip') {
    const L = LIMITS[a], v = Number(String(b ?? '').replace(/km\/?h$/, ''));
    if (b === undefined || !Number.isFinite(v)) return no(`buggy ${a} needs a number`);
    if (v < L.min || v > L.max) return no(`${L.label} must be a number from ${L.min} to ${L.max}${L.unit ? ' ' + L.unit : ''}; you typed ${b}`);
    return { ok: true, act: a, value: v };
  }
  if (a === 'ground' && ['grass', 'wet', 'gravel'].includes(b)) return { ok: true, act: 'ground', value: b };
  if (b === undefined && WORDS.includes(a)) return ['grass', 'wet', 'gravel'].includes(a) ? { ok: true, act: 'ground', value: a } : { ok: true, act: a };
  return no(`buggy does not read "${b ?? a}"`);
}

const typing = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable;
const CSS = `#buggy-chip { position: fixed; left: 10px; bottom: calc(var(--foot) + 30px); min-height: 26px; padding: 0 9px; border-radius: 13px;
  background: var(--panel); color: var(--dim); border: 1px solid var(--edge); cursor: pointer; font: inherit; font-size: 11px; }
#buggy-chip[aria-pressed="true"] { color: #ffc773; border-color: #ffc773; }
body[data-panel="design"] #buggy-chip { display: none; }
@media (pointer: coarse) { #buggy-chip { left: 156px; bottom: calc(var(--foot) + 36px); min-height: 40px; padding: 0 12px; } } /* beside the joypad */`;

// deps: { api (the substrate's extension api: state, setDriver, hooks.commands), doc }
export function mountBuggy({ api, doc = document }) {
  let ui = null, loading = null;
  const style = doc.createElement('style'); style.textContent = CSS; doc.head.append(style);
  const chip = doc.createElement('button');
  chip.type = 'button'; chip.id = 'buggy-chip'; chip.textContent = 'Buggy'; chip.setAttribute('aria-pressed', 'false');
  chip.title = 'Get on the site buggy and drive the ground (E on a keyboard)';
  doc.body.append(chip);
  const load = () => (loading ||= import('./buggy-ui.mjs').then(m => (ui = m.createDriver({ api, doc, chip })))
    .catch(e => { loading = null; console.warn('buggy: ' + e.message); throw e; }));
  chip.addEventListener('click', () => { load().then(u => u.toggle()).catch(() => {}); (doc.getElementById('view') || doc.body).focus?.(); });
  doc.addEventListener('keydown', e => {
    if (e.code !== 'KeyE' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (api.state().view === 'aerial') return; // E flies the drone up
    load().then(u => u.toggle()).catch(() => {});
  });
  api.hooks.commands?.add(line => {
    const p = parseBuggy(line);
    if (!p) return null;
    if (!p.ok) return { ok: false, text: p.why, line, quiet: true };
    return load().then(u => ({ ok: true, text: u.command(p), line, quiet: true }));
  });
  return { load, ui: () => ui, debug: () => ui?.debug() ?? { mounted: false, loaded: false } };
}
