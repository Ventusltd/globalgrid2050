// Layer packs in the world (contract world.pack.v1; pack-loader.mjs). The manifest pins each installed pack by its
// entry's SHA-256 (tools/world-manifest.mjs from web/packs/pins.json); the pin is the trust. A pack is listed in the
// Layers panel under "Packs" and fetched only when it is switched on, one of its commands is typed or its key is pressed.
// Each drawn frame: fixed steps (at most 8), then its lines, solids and HUD lines. It asks for frames only while a pack
// says it is active, so a still world stays at 0 fps. Mounted after the first frame (extensions.mjs).

import { createPackHost } from './pack-loader.mjs';
import { makeApi } from './layers.mjs';
import { COMMANDS } from './cmd-grammar.mjs';

const WORLD_VERBS = ['build', 'buggy']; // typed words the world's extensions answer (build-mount.mjs, buggy-mount.mjs)
// Keys: the world keeps every plain key (Space jumps, letters walk, fly and open panels) and Shift with its movement letters
// (Shift is the slow walk); a pack's other Shift keys are its own. A pack's plain-key binding is still there by typing.
export const packKeyAllowed = k => /^Shift\+[a-z0-9]$/.test(k) && !/^Shift\+[wasdqe]$/.test(k);
const typing = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable;

/** The frame context a pack sees: local metres, a look direction, the world's ground. */
export function packCtx(state, heightAt, groundVersion) {
  const { yaw = 0, pitch = 0 } = state, c = Math.cos(pitch);
  return { pos: [...state.pos], dir: [Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch)], heightAt, groundVersion };
}

/** The key name a pack binds ("Shift+n", "KeyB", "x") for a keyboard event. */
export const keyName = e => (e.shiftKey && e.key && e.key.length === 1 ? `Shift+${e.key.toLowerCase()}` : e.code || String(e.key || '').toLowerCase());

// deps: { api (the substrate's extension api), world (window.world), doc, manifestUrl, fetchImpl }
export async function mountPacks({ api, world = globalThis.window?.world, doc = document, manifestUrl = new URL('./manifest.json', import.meta.url).href,
  fetchImpl } = {}) {
  const get = fetchImpl || ((u, o) => fetch(u, o));
  const manifest = await (await get(manifestUrl, { cache: 'no-cache' })).json();
  const pins = Array.isArray(manifest.packs) ? manifest.packs : [];
  const base = new URL('./', manifestUrl).href;
  const layerApi = makeApi(base, { invalidate: o => api.invalidate(o), origin: () => ({ id: 0, ...api.origin() }), fetchImpl });
  const log = [];
  const host = createPackHost({ api: layerApi, base, reserved: [...COMMANDS.map(c => c.verb), ...WORLD_VERBS], fetchImpl,
    onError: t => { log.push(t); if (log.length > 50) log.shift(); console.warn('pack: ' + t); } });
  for (const pin of pins) await host.add(pin).catch(e => log.push(`pin ${pin.id}: ${e.message}`));

  let out = { lines: [], solids: [], hud: [] }, last = null, asked = false, pose = '', originKey = '';
  const kick = () => { // frames while a pack is active (a playing sun), then back to the walk's own rate: 0 fps when still
    const on = host.active();
    if (on && !asked) { asked = true; api.gate.setMoving(true, 30); } else if (!on && asked) { asked = false; api.resumeGate(); }
    api.gate.invalidate();
  };
  api.hooks.before.add(now => {
    const ctx = packCtx(api.state(), api.heightAt, world?.groundVersion?.() ?? 0), o = api.origin();
    const ok = `${o.e},${o.n}`;
    if (ok !== originKey) { originKey = ok; host.bus.emit('world/origin', { e: o.e, n: o.n, id: 0 }); }
    const pk = ctx.pos.map(v => v.toFixed(2)).join(',');
    if (pk !== pose) { pose = pk; host.bus.emit('world/pose', { pos: ctx.pos, dir: ctx.dir }); }
    host.step(last == null ? 0 : Math.min(0.25, (now - last) / 1000), ctx); last = asked ? now : null;
    out = host.frame(ctx);
    showHud(out.hud);
    if (asked !== host.active()) queueMicrotask(kick);
  });
  api.hooks.batches.add(() => out.lines);
  (api.hooks.solids ||= new Set()).add(() => out.solids);
  // Typed commands: a verb a pack offers goes to the pack (a lazy pack loads first); anything else is not ours.
  (api.hooks.commands ||= new Set()).add(line => {
    const verb = String(line).trim().split(/\s+/)[0]?.toLowerCase();
    if (!host.help().some(c => c.verb === verb)) return null;
    return host.command(line).then(r => { render(); kick(); return { ...r, line }; });
  });
  const bound = () => new Set(host.panel().flatMap(p => host.get(p.id)?.pack?.provides.keys?.map(k => k.key) || []));
  doc.addEventListener('keydown', e => {
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = keyName(e);
    if (!packKeyAllowed(k) || !bound().has(k)) return;
    e.preventDefault();
    host.key(k).then(() => { render(); kick(); });
  });

  // HUD: a small quiet box, only while a pack that is on has something to say (illustrative packs say so).
  const hud = doc.createElement('div');
  hud.id = 'pack-hud'; hud.hidden = true; hud.setAttribute('aria-live', 'polite');
  hud.style.cssText = 'position:fixed;left:8px;bottom:64px;max-width:min(360px,calc(100vw - 16px));padding:4px 8px;border-radius:4px;'
    + 'background:rgba(10,10,10,0.72);color:#cfe9ff;font:11px/1.45 system-ui,sans-serif;pointer-events:none;white-space:pre-line;z-index:3';
  doc.body.appendChild(hud);
  let hudText = '';
  function showHud(lines) {
    const t = lines.map(h => h.text).join('\n');
    if (t === hudText) return;
    hudText = t; hud.textContent = t; hud.hidden = !t;
  }

  // The Layers panel: a "Packs" group in the same switches as the world's layers, kept after each redraw of the panel.
  const group = doc.createElement('fieldset');
  group.id = 'lp-packs';
  function render() {
    const lg = doc.createElement('legend'); lg.textContent = 'Packs';
    const rows = host.panel().map(p => {
      const row = doc.createElement('div'), b = doc.createElement('button'), name = doc.createElement('span'), tr = doc.createElement('span');
      row.className = 'row'; b.type = 'button'; b.setAttribute('role', 'switch'); b.dataset.pack = p.id;
      b.setAttribute('aria-checked', String(p.on)); if (/^refused|^failed/.test(p.status)) b.setAttribute('aria-disabled', 'true');
      name.textContent = p.label + (p.illustrative ? ', illustrative' : ''); tr.className = 'track';
      b.append(name, tr);
      b.addEventListener('click', () => { if (b.getAttribute('aria-disabled') !== 'true') host.toggle(p.id, !p.on).then(() => { render(); kick(); }); });
      const st = doc.createElement('p'); st.className = 'status'; st.textContent = p.status;
      row.append(b, st);
      return row;
    });
    group.replaceChildren(lg, ...rows);
    attach();
  }
  const panelRoot = () => doc.querySelector('#layers .lp') || doc.querySelector('.lp');
  function attach() { const r = panelRoot(); if (r && group.parentNode !== r) r.appendChild(group); }
  const watch = () => { const r = panelRoot(); if (!r) return false; new MutationObserver(attach).observe(r, { childList: true }); attach(); return true; };
  if (!watch()) { const t = setInterval(() => { if (watch()) clearInterval(t); }, 500); setTimeout(() => clearInterval(t), 30000); }
  render();

  return { host, panel: () => host.panel(), hud: () => hudText, log: () => log.slice(), frame: () => ({ lines: out.lines.length, solids: out.solids.length }) };
}
