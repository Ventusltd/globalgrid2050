// cmd-ui.mjs: the command line over the world. One input: type a command and press Enter; the world changes and the line
// under it says what changed. Up and Down recall earlier commands (the last 50 kept in this browser), Tab takes the first
// suggestion, Escape closes. On a phone the same bar sits along the bottom with suggestion chips above it.
// Loaded the first time the bar is opened (cmd-mount.mjs), never before the first frame.

import { createSession } from './cmd-model.mjs';
import { createEngine } from './cmd-run.mjs';
import { createAnim } from './cmd-anim.mjs';
import { search } from './cmd-grammar.mjs';
import { tmInverse } from './bng.mjs';

const KEEP = 'world.cmd.history', MAX = 50;
const CHIPS = ['plant 50mw south', 'pitch 7', 'tilt 20', 'trench depth 1.1', 'cable 400 al', 'wiring leapfrog', 'piles auto', 'show pylons', 'earthing show', 'undo', 'help'];
const CSS = `
#cmd { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--foot) + 8px); width: min(620px, calc(100vw - 16px));
  box-sizing: border-box; background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 6px; display: grid; gap: 6px; z-index: 3; }
#cmd[hidden] { display: none; }
#cmd canvas { width: 100%; height: 150px; display: block; border-bottom: 1px solid var(--edge); }
#cmd canvas[hidden] { display: none; }
#cmd-log { max-height: 128px; overflow: auto; margin: 0; font: 12px/1.45 ui-monospace, Consolas, monospace; color: var(--dim); white-space: pre-wrap; }
#cmd-log:empty { display: none; }
#cmd-log .in { color: var(--text); } #cmd-log .out { color: var(--line); } #cmd-log .no { color: #ff8a7a; }
#cmd-chips { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; }
#cmd-chips button { flex: none; background: none; color: var(--dim); border: 1px solid var(--edge); border-radius: 12px; padding: 2px 9px; cursor: pointer;
  font: 11px system-ui, sans-serif; min-height: 24px; white-space: nowrap; }
#cmd-chips button:hover { color: var(--text); border-color: var(--line); }
#cmd .bar { display: flex; gap: 6px; align-items: center; }
#cmd .bar span { color: var(--line); font: 14px ui-monospace, Consolas, monospace; }
#cmd-input { flex: 1; min-width: 0; min-height: var(--btn); box-sizing: border-box; background: #111; color: var(--text); border: 1px solid var(--edge);
  border-radius: 4px; padding: 0 8px; font: 13px ui-monospace, Consolas, monospace; }
#cmd-input:focus { outline: none; border-color: var(--line); }
#cmd .bar button { background: var(--panel); color: var(--dim); border: 1px solid var(--edge); border-radius: 4px; min-height: var(--btn); padding: 0 10px; cursor: pointer; }
@media (pointer: coarse) {
  #cmd { left: 8px; right: 8px; width: auto; transform: none; } #cmd canvas { height: 120px; } #cmd-log { max-height: 84px; }
  body[data-cmd] #pad, body[data-cmd] #lift, body[data-cmd] #help-toggle { display: none !important; }
  #cmd-input { font-size: 16px; } /* 16 px or more: a phone does not zoom the page when the bar takes focus */
}`;

const readKept = () => { try { const v = JSON.parse(localStorage.getItem(KEEP) || '[]'); return Array.isArray(v) ? v.filter(s => typeof s === 'string') : []; } catch { return []; } };
const writeKept = h => { try { localStorage.setItem(KEEP, JSON.stringify(h.slice(-MAX))); } catch { /* private window: history is kept for this visit only */ } };

// deps: { api, world, ohl, doc, onChange() the script changed (the design is saved with it), toggle: the dash button }
export async function createCommandLine({ api, world, ohl, doc = document, onChange = () => {}, toggle = null }) {
  const data = f => fetch(new URL(`./world/data/${f}`, location.href), { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [catalogue, sections, modules] = await Promise.all([data('cables.json'), data('trench-sections.json').then(j => j?.sections || []), data('modules.json')]);
  // The plant's module is the selected class (Module detail), the one the solar block uses: one string-voltage answer.
  const moduleClass = () => { const id = world.module?.debug?.()?.class || 'A', c = modules?.classes?.find(x => x.id === id);
    return c ? { wp: c.electrical.nominal_W, voc: Math.max(...c.electrical.bins.map(b => b.voc)), coeffPctPerK: c.temp_coeff.voc } : null; };
  const o = world.origin(), latDeg = o.e || o.n ? tmInverse(o.e, o.n).lat * 180 / Math.PI : 51.8;
  const session = createSession({ engine: createEngine({ world, api, ohl, doc }), env: { latDeg, catalogue, sections, moduleClass } });

  const style = doc.createElement('style'); style.textContent = CSS; doc.head.appendChild(style);
  const box = doc.createElement('section');
  box.id = 'cmd'; box.hidden = true; box.setAttribute('aria-label', 'Command line');
  box.innerHTML = '<canvas id="cmd-anim" hidden aria-hidden="true"></canvas><pre id="cmd-log" aria-live="polite"></pre><div id="cmd-chips" role="list"></div>'
    + '<div class="bar"><span aria-hidden="true">›</span><input id="cmd-input" type="text" enterkeyhint="go" autocapitalize="off" autocomplete="off" '
    + 'spellcheck="false" inputmode="text" aria-label="Command" placeholder="Type a command, e.g. plant 50mw south, then Enter">'
    + '<button type="button" id="cmd-run">Run</button><button type="button" id="cmd-close" aria-label="Close the command line">×</button></div>';
  doc.body.appendChild(box);
  const $ = id => doc.getElementById(id), input = $('cmd-input'), log = $('cmd-log'), chips = $('cmd-chips'), canvas = $('cmd-anim');
  const anim = createAnim(canvas);
  const hist = readKept();
  let at = hist.length, busy = false, lastDone = null;

  function say(line, text, ok) {
    const a = doc.createElement('span'), b = doc.createElement('span');
    a.className = 'in'; a.textContent = `› ${line}\n`; b.className = ok ? 'out' : 'no'; b.textContent = `${text}\n`;
    log.append(a, b);
    while (log.childNodes.length > 60) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function drawChips() {
    const q = input.value.trim(), list = q ? search(q, 6).map(c => c.usage.split('  ·  ')[0]) : CHIPS;
    chips.replaceChildren(...list.map(s => {
      const b = doc.createElement('button'); b.type = 'button'; b.textContent = s; b.setAttribute('role', 'listitem');
      b.addEventListener('click', () => { input.value = s; drawChips(); input.focus(); if (!q) run(s); });
      return b;
    }));
  }
  // Lines typed while one is still running wait their turn, in order (the bar stays open for typing: a phone keyboard is
  // never closed under the thumb by a disabled input), each resolved when it has run.
  const waiting = [];
  const next = () => { if (!busy && waiting.length) { const w = waiting.shift(); run(w.line, true).then(w.done); } };
  async function run(text, queued = false) {
    const line = String(text ?? input.value).trim();
    if (!line) return null;
    if (!queued) { if (hist[hist.length - 1] !== line) { hist.push(line); writeKept(hist); } at = hist.length; if (text == null || input.value.trim() === line) input.value = ''; }
    if (busy) { const p = new Promise(done => waiting.push({ line, done })); say(line, `queued (${waiting.length} waiting): runs when the line before it is done`, true); return p; }
    busy = true;
    let r;
    try { r = await session.exec(line); } catch (e) { r = { ok: false, text: e.message, line }; }
    finally { busy = false; }
    say(line, r.text, r.ok);
    if (r.ok && r.anim) { canvas.hidden = false; anim.play(r.anim, r.before, r.d); }
    if (r.ok && !r.quiet) onChange();
    lastDone = { line, ok: r.ok, text: r.text, anim: r.anim || null };
    drawChips();
    if (!box.hidden && doc.activeElement !== input) input.focus();
    setTimeout(next);
    return r;
  }
  // Keys typed in the bar stay in the bar: the walk keys (W, A, S, D, F, Q, Space) never reach the world.
  for (const ev of ['keydown', 'keyup', 'keypress']) box.addEventListener(ev, e => { if (e.key !== 'Escape') e.stopPropagation(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowUp' && at > 0) { e.preventDefault(); input.value = hist[--at]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(hist.length, at + 1); input.value = hist[at] || ''; }
    else if (e.key === 'Tab' && input.value.trim()) { const s = search(input.value.trim(), 1)[0]; if (s) { e.preventDefault(); input.value = s.usage.split('  ·  ')[0]; } }
    else return;
    drawChips();
  });
  input.addEventListener('input', drawChips);
  $('cmd-run').addEventListener('click', () => run());
  $('cmd-close').addEventListener('click', () => close());
  // A phone keyboard covers the bottom of the screen: the bar rides above it.
  const vv = globalThis.visualViewport;
  const lift = () => { if (!vv || box.hidden) return; const k = Math.max(0, innerHeight - vv.height - vv.offsetTop); box.style.bottom = k ? `${k + 4}px` : ''; };
  vv?.addEventListener('resize', lift);
  // --cmd-top: how far the bar's top edge sits above the bottom of the screen, so cards along the bottom (Follow) sit above it.
  const mark = () => { const t = box.hidden ? 0 : Math.max(0, innerHeight - box.getBoundingClientRect().top); doc.documentElement.style.setProperty('--cmd-top', `${Math.round(t)}px`); };
  if (globalThis.ResizeObserver) new ResizeObserver(mark).observe(box);
  vv?.addEventListener('resize', mark);

  function open() {
    const dt = doc.getElementById('design-toggle'); // the bar takes the Design panel's place (its button lives there)
    if (dt?.getAttribute('aria-expanded') === 'true') dt.click();
    box.hidden = false; doc.body.dataset.cmd = '1'; toggle?.setAttribute('aria-expanded', 'true');
    drawChips(); input.focus(); lift(); mark();
  }
  function close() {
    box.hidden = true; delete doc.body.dataset.cmd; toggle?.setAttribute('aria-expanded', 'false');
    anim.stop(); canvas.hidden = true; input.blur(); (doc.getElementById('view') || doc.body).focus?.(); mark();
  }
  // Opening a design with a script replays it: the plant, block and trench choices come back from the typed lines.
  async function replay(lines) {
    if (!Array.isArray(lines) || !lines.length) return [];
    busy = true;
    let out = [];
    try { out = await session.replay(lines); } finally { busy = false; setTimeout(next); }
    const bad = out.filter(r => !r.ok);
    say(`replay ${lines.length} lines`, bad.length ? `${bad.length} line(s) refused: ${bad.map(r => r.text).join(' | ')}` : `Rebuilt from the typed script. ${out.at(-1)?.text || ''}`, !bad.length);
    return out;
  }
  return { open, close, toggle: () => (box.hidden ? open() : close()), run, replay, script: session.script, session,
    debug: () => ({ open: !box.hidden, busy, waiting: waiting.map(w => w.line), last: lastDone, animating: anim.running(), anim: anim.kind(), script: session.script(), history: session.history() }) };
}
