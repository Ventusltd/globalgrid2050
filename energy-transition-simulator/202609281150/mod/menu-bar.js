// mod/menu-bar.js - one menu bar instead of a toolbar: File, Edit, View, Scope, Grid, About, with Walk, Drone and
// Map at the right end. Plain script; load it LAST in mod/index.json (menu-style.js first).
// Nothing is cloned: every existing button, input and readout is MOVED (appendChild) into its menu, so its handler,
// its .on state and the label text the mods write ("Pylons (37)", "to 275 kV") keep working on the same element.
// Late buttons (SIM.addButton, or anything a mod appends to #bar) are routed by label; a label that matches nothing
// lands under Scope > More with a console note, so no control is ever lost.
// Menu idiom from GridAtlas menu-bar.js (six titles, closed at rest, one panel open at a time, Escape and an outside
// click close, arrow keys move across titles); colours from the site-world release tokens (menu-style.js).
// Test hook: SIM.menu = { controls(), open(name), close(), openName(), titles }.
(function () {
  'use strict';
  const TITLES = ['File', 'Edit', 'View', 'Scope', 'Grid', 'About'];
  // The routing table: [menu, key, how to find it]. `id` = element id in the page; `re` = label at the moment it
  // arrives; `sel` = a CSS selector. The 22 controls of 28 Sept are marked core: true.
  const TABLE = [
    ['File', 'here', { id: 'here', core: true, label: 'Build block here' }],
    ['File', 'connect', { re: /^Connect here/, core: true }],
    ['File', 'design-box', { id: 'design-box', box: true }],
    ['File', 'clear-design', { make: 'Clear design' }],
    ['File', 'export', { make: 'Export view as image (not built yet)', disabled: true }],
    ['Edit', 'kv', { re: /^to \d+ kV$/, core: true }],
    ['Edit', 'mw', { re: /^\d+ MW$/, core: true }],
    ['Edit', 'route', { re: /^(Road route|Straight)$/, core: true }],
    ['Edit', 'sub-input', { sel: 'input[placeholder^="go substation"]', core: true }],
    ['Edit', 'fg', { id: 'fg', box: true }],
    ['View', 'walk-item', { make: 'Walk (1)', proxy: 'walk' }],
    ['View', 'drone-item', { make: 'Drone (2)', proxy: 'drone' }],
    ['View', 'map-item', { make: 'Map (3)', proxy: 'map2d' }],
    ['View', 'fps', { id: 'walk-fps', core: true, label: 'First person' }],
    ['View', 'tilt', { id: 'tilt', core: true }],
    ['View', 'north', { make: 'Reset north' }],
    ['View', 'zin', { make: 'Zoom in' }],
    ['View', 'zout', { make: 'Zoom out' }],
    ['View', 'spd', { id: 'spd', box: true }],
    ['Scope', 'sat', { id: 'sat', core: true }],
    ['Scope', 'dark', { id: 'dark', core: true }],
    ['Scope', 'wire', { id: 'wire', core: true }],
    ['Scope', 'survey', { id: 'survey', core: true, label: 'Survey grid' }],
    ['Scope', 'lidar', { re: /^LiDAR/, core: true }],
    ['Scope', 'rows', { id: 'rows', core: true }],
    ['Scope', 'detect', { id: 'detect', core: true }],
    ['Scope', 'gpu-rows', { re: /^GPU rows/, core: true }],
    ['Scope', 'scanner-rows', { re: /^Scanner rows/ }],
    ['Scope', 'farm-assess', { re: /^Assess land/ }],
    ['Scope', 'stream', { re: /stream/i }],
    ['Scope', 'procedural', { re: /procedural|generate/i }],
    ['Scope', 'more', { more: true }],
    ['Grid', 'pylons', { id: 'pylons', core: true }],
    ['Grid', 'pylons-real', { re: /^Pylons \((mapped|real)/, core: true }],
    ['Grid', 'substations', { re: /^Substations/, core: true }],
    ['Grid', 'g400', { make: '400 kV lines', kv: '400' }],
    ['Grid', 'g275', { make: '275 kV lines', kv: '275' }],
    ['Grid', 'g132', { make: '132 kV lines', kv: '132' }],
    ['Grid', 'trench', { re: /^Trench/ }],
    ['Grid', 'completion', { re: /complet/i }],
    ['Grid', 'pf-readout', { id: 'pf-readout', box: true }],
    ['Grid', 'coords-hud', { id: 'coords-hud', box: true }],
    ['About', 'controls', { make: 'Controls and keys' }],
    ['About', 'credits', { make: 'Credits' }],
    ['About', 'modules', { make: 'Modules loaded' }]
  ];
  const VIEWS = ['walk', 'drone', 'map2d'];

  function wait(n) { if (window.SIM && window.SIM.map && document.getElementById('bar')) init(); else if (n < 400) setTimeout(() => wait(n + 1), 50); }
  wait(0);

  function init() {
    if (document.getElementById('sim-menu')) return;
    const SIM = window.SIM, map = SIM.map, bar = document.getElementById('bar');
    const css = document.createElement('style'); css.id = 'menu-bar-style';
    css.textContent = `
#sim-menu { position: fixed; top: 0; left: 0; right: 0; height: var(--btn, 30px); z-index: 20; display: flex; align-items: stretch;
  background: var(--panel); border-bottom: 1px solid var(--edge); font: 12px system-ui, sans-serif; }
#sim-menu .gm-titles { display: flex; align-items: stretch; }
#sim-menu .gm-title { background: transparent; border: 0; border-bottom: 1px solid transparent; border-radius: 0; color: var(--dim);
  padding: 0 9px; min-height: 0; height: 100%; }
#sim-menu .gm-title:hover, #sim-menu .gm-title[aria-expanded="true"] { color: #fff; border-bottom-color: var(--line); background: transparent; }
#sim-menu .gm-views { margin-left: auto; display: flex; align-items: stretch; }
#sim-menu .gm-views button { border: 0; border-bottom: 1px solid transparent; border-radius: 0; background: transparent; min-height: 0; height: 100%; padding: 0 9px; }
#sim-menu .gm-views button.on { color: #fff; border-bottom-color: var(--line); }
.gm-panel { position: fixed; top: calc(var(--btn, 30px) + 2px); min-width: 220px; width: max-content; max-width: min(340px, calc(100vw - 16px));
  max-height: calc(100vh - 90px); overflow: auto; z-index: 21; background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 6px; box-sizing: border-box; }
.gm-panel[hidden] { display: none; }
.gm-panel h2 { margin: 6px 6px 4px; }
.gm-panel button { display: block; width: 100%; text-align: left; background: transparent; border: 1px solid transparent; min-height: 28px; padding: 4px 8px 4px 22px; position: relative; }
.gm-panel button:hover { color: var(--text); border-color: var(--edge); }
.gm-panel button.on, .gm-panel button[aria-pressed="true"] { color: #fff; border-color: transparent; }
.gm-panel button.on::before, .gm-panel button[aria-pressed="true"]::before { content: '\\2713'; position: absolute; left: 7px; color: var(--line); }
.gm-panel button[disabled] { opacity: .45; cursor: default; }
.gm-panel input { display: block; width: 100%; margin: 4px 0; }
.gm-panel #fg, .gm-panel #design-box, .gm-panel #pf-readout, .gm-panel #coords-hud, .gm-panel #spd {
  display: block !important; position: static !important; inset: auto !important; max-width: none !important; width: auto !important;
  background: transparent !important; border: 0 !important; padding: 4px 8px !important; margin: 0 !important; color: var(--text) !important;
  font: 11px/1.45 ui-monospace, Consolas, monospace !important; pointer-events: auto !important; box-shadow: none !important; }
.gm-panel #fg { align-items: stretch !important; }
.gm-panel .gm-sep { border-top: 1px solid var(--edge); margin: 6px 4px; }
.gm-panel .gm-note { color: var(--dim); padding: 4px 8px; white-space: pre-wrap; font-size: 11px; }
#where { position: fixed; left: 10px; bottom: calc(var(--foot, 20px) + 8px); z-index: 5; color: var(--dim); pointer-events: none;
  font: 12px system-ui, sans-serif; font-variant-numeric: tabular-nums; text-shadow: 0 0 3px #000, 0 0 1px #000; white-space: nowrap; max-width: calc(100vw - 110px); overflow: hidden; text-overflow: ellipsis; }
#attribution { position: fixed; left: 0; right: 0; bottom: 0; height: var(--foot, 20px); z-index: 5; box-sizing: border-box; padding: 3px 10px 4px;
  font-size: 10px; line-height: 13px; color: var(--dim); background: rgba(10, 10, 10, .72); pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#sim-note { position: fixed; left: 10px; bottom: calc(var(--foot, 20px) + 28px); z-index: 5; max-width: min(560px, calc(100vw - 110px)); color: var(--text);
  font: 12px/1.45 system-ui, sans-serif; text-shadow: 0 0 3px #000, 0 0 1px #000; pointer-events: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
#sim-note[hidden] { display: none; }
#help-toggle { position: fixed; right: 10px; bottom: calc(var(--foot, 20px) + 6px); z-index: 6; min-height: 28px; padding: 0 10px; }
#help { right: 10px; bottom: calc(var(--foot, 20px) + 40px); width: min(340px, calc(100vw - 36px)); z-index: 21; }
#help #info { display: block !important; position: static !important; background: transparent !important; padding: 0 !important; color: var(--text) !important; font: 12px/1.45 system-ui, sans-serif !important; }
@media (max-width: 480px) {
  #sim-menu .gm-title { padding: 0 6px; font-size: 11px; }
  #sim-menu .gm-views button { padding: 0 6px; font-size: 11px; }
}`;
    document.head.appendChild(css);

    // ---- the bar, the six titles and panels ----
    const nav = document.createElement('nav'); nav.id = 'sim-menu'; nav.setAttribute('aria-label', 'Menu');
    const titlesEl = document.createElement('div'); titlesEl.className = 'gm-titles'; titlesEl.setAttribute('role', 'menubar');
    const views = document.createElement('span'); views.className = 'gm-views';
    nav.append(titlesEl, views); document.body.appendChild(nav);
    const menus = {};
    let hoverAt = -1e9;
    for (const t of TITLES) {
      const b = document.createElement('button'); b.className = 'gm-title'; b.textContent = t; b.dataset.menu = t;
      b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('role', 'menuitem');
      const p = document.createElement('div'); p.className = 'gm-panel'; p.hidden = true; p.dataset.menu = t; p.setAttribute('role', 'menu');
      titlesEl.appendChild(b); document.body.appendChild(p); menus[t] = { title: b, panel: p };
      // A hover that opened this menu a moment ago must not be undone by the click that follows it.
      b.addEventListener('click', e => { e.stopPropagation(); if (openName() === t && performance.now() - hoverAt > 400) close(); else open(t); });
      b.addEventListener('mouseenter', () => { if (openName() && openName() !== t) { open(t); hoverAt = performance.now(); } });
      b.addEventListener('keydown', e => {
        const i = TITLES.indexOf(t);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = TITLES[(i + (e.key === 'ArrowRight' ? 1 : TITLES.length - 1)) % TITLES.length]; menus[n].title.focus(); if (openName()) open(n); }
        if (e.key === 'ArrowDown') { e.preventDefault(); open(t); }
      });
    }
    // One slot per table row, in table order, so a late control still lands in its place.
    const slots = {}, found = {};
    let lastMenu = '';
    for (const [m, key, spec] of TABLE) {
      const p = menus[m].panel;
      if (spec.box && lastMenu === m) { const s = document.createElement('div'); s.className = 'gm-sep'; p.appendChild(s); }
      const s = document.createElement('div'); s.className = 'gm-slot'; s.dataset.key = key; p.appendChild(s); slots[key] = s; lastMenu = m;
      if (spec.more) { const h = document.createElement('h2'); h.textContent = 'More'; h.hidden = true; s.appendChild(h); }
    }

    // ---- help panel and the Controls chip (bottom right) ----
    const help = document.createElement('div'); help.id = 'help'; help.className = 'panel gm-panel'; help.hidden = true; help.dataset.menu = 'Help';
    help.innerHTML = '<h2>Controls</h2>'; document.body.appendChild(help);
    const info = document.getElementById('info'); if (info) help.appendChild(info);
    const hb = document.createElement('button'); hb.id = 'help-toggle'; hb.textContent = 'Controls'; hb.setAttribute('aria-expanded', 'false');
    hb.addEventListener('click', e => { e.stopPropagation(); openName() === 'Help' ? close() : open('Help'); });
    document.body.appendChild(hb);
    // SIM.info(t) still writes into #info; the newest message also shows for 8 s as one dim note above #where.
    const note = document.createElement('div'); note.id = 'sim-note'; note.hidden = true; document.body.appendChild(note);
    let noteT = 0;
    if (info) new MutationObserver(() => { note.textContent = info.textContent; note.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { note.hidden = true; }, 8000); })
      .observe(info, { childList: true, characterData: true, subtree: true });

    // ---- open / close: one panel at a time ----
    function openName() { for (const t of TITLES) if (!menus[t].panel.hidden) return t; return help.hidden ? '' : 'Help'; }
    function close() {
      for (const t of TITLES) { menus[t].panel.hidden = true; menus[t].title.setAttribute('aria-expanded', 'false'); }
      help.hidden = true; hb.setAttribute('aria-expanded', 'false');
    }
    function open(t) {
      close();
      if (t === 'Help') { help.hidden = false; hb.setAttribute('aria-expanded', 'true'); return; }
      const { title, panel } = menus[t]; panel.hidden = false; title.setAttribute('aria-expanded', 'true');
      const r = title.getBoundingClientRect(), w = panel.offsetWidth;
      panel.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
      if (t === 'About') refreshAbout();
    }
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && openName()) { close(); e.stopPropagation(); } }, true);
    document.addEventListener('pointerdown', e => {
      if (!openName()) return;
      if (e.target.closest && (e.target.closest('.gm-panel') || e.target.closest('#sim-menu') || e.target.closest('#help-toggle'))) return;
      close();
    }, true);

    // ---- routing: move each control to its slot ----
    const labelOf = el => (el.textContent || '').trim();
    function entryFor(el) {
      for (const [m, key, spec] of TABLE) {
        if (found[key] || spec.make || spec.more) continue;
        if (spec.id && el.id === spec.id) return [m, key, spec];
      }
      for (const [m, key, spec] of TABLE) {
        if (found[key] || spec.make || spec.more || spec.id) continue;
        if (spec.sel && el.matches && el.matches(spec.sel)) return [m, key, spec];
        if (spec.re && el.tagName === 'BUTTON' && spec.re.test(labelOf(el))) return [m, key, spec];
      }
      return null;
    }
    function place(el) {
      if (!el || el.nodeType !== 1 || el.closest('.gm-panel') || el.closest('#sim-menu')) return;
      if (VIEWS.includes(el.id)) { views.appendChild(el); return; }
      if (el.id === 'spd' && !slots.spd.firstChild) { slots.spd.appendChild(el); found.spd = el; return; }
      const hit = entryFor(el);
      if (hit) {
        const [, key, spec] = hit; found[key] = el; slots[key].appendChild(el);
        if (spec.label && el.tagName === 'BUTTON' && !el.dataset.menuLabel) { el.dataset.menuLabel = spec.label; if (labelOf(el) === defaultLabel(el)) el.textContent = spec.label; }
        return;
      }
      if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
        slots.more.firstChild.hidden = false; slots.more.appendChild(el);
        console.warn('[menu-bar] no menu for "' + (labelOf(el) || el.placeholder || el.id) + '": placed under Scope > More');
      }
    }
    // Only static labels are renamed (so "Pylons (37)" and "Loading rows..." still show as the mods write them).
    const defaultLabel = el => ({ here: 'Build here', survey: 'Survey', 'walk-fps': 'FPS' })[el.id] || labelOf(el);
    for (const el of Array.from(bar.children)) place(el);
    for (const id of ['fg', 'design-box', 'pf-readout', 'coords-hud']) { const el = document.getElementById(id); if (el) place(el); }
    // Anything appended later to #bar or the body (walk-fps inserts after #map2d; find-go and plant append boxes).
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (m.target === bar || ['fg', 'design-box', 'pf-readout', 'coords-hud'].includes(n.id) || (VIEWS.includes(n.id)))) place(n); })
      .observe(bar, { childList: true });
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && ['fg', 'design-box', 'coords-hud'].includes(n.id)) place(n); })
      .observe(document.body, { childList: true });
    // SIM.addButton: same button, same #bar append (so the observer above routes it), returned to the mod as before.
    const add = SIM.addButton;
    if (add && !add.__menu) { SIM.addButton = function (label, fn) { const b = add.call(SIM, label, fn); place(b); return b; }; SIM.addButton.__menu = true; }

    // ---- the menu's own items ----
    const item = (key, label, fn, disabled) => { const b = document.createElement('button'); b.textContent = label; b.dataset.key = key; if (disabled) b.disabled = true; else b.addEventListener('click', fn); slots[key].appendChild(b); found[key] = b; return b; };
    const click = id => { const el = document.getElementById(id); if (el) el.click(); };
    for (const [, key, spec] of TABLE) {
      if (!spec.make) continue;
      if (spec.proxy) item(key, spec.make, () => { click(spec.proxy); close(); });
      else if (spec.kv) { const b = item(key, spec.make, () => { const on = !b.classList.contains('on'); b.classList.toggle('on', on); setKv(spec.kv, on); }); b.classList.add('on'); }
      else if (spec.disabled) item(key, spec.make, null, true);
    }
    const setKv = (kv, on) => { if (map.getLayer('g' + kv)) map.setLayoutProperty('g' + kv, 'visibility', on ? 'visible' : 'none'); };
    map.on('style.load', () => setTimeout(() => { for (const kv of ['400', '275', '132']) { const b = found['g' + kv]; if (b && !b.classList.contains('on')) setKv(kv, false); } }, 50));
    slots['clear-design'].appendChild(Object.assign(document.createElement('button'), { textContent: 'Clear design', onclick: () => {
      const i = document.getElementById('design-cmd'); if (!i) return; i.value = 'clear';
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } }));
    found['clear-design'] = slots['clear-design'].firstChild;
    item('north', 'Reset north', () => map.easeTo({ bearing: 0, duration: 600 }));
    item('zin', 'Zoom in', () => map.zoomIn());
    item('zout', 'Zoom out', () => map.zoomOut());
    item('controls', 'Controls and keys', () => open('Help'));
    const credits = document.createElement('div'); credits.className = 'gm-note'; slots.credits.appendChild(credits);
    const mods = document.createElement('div'); mods.className = 'gm-note'; slots.modules.appendChild(mods);
    item('credits', 'Credits', () => { credits.textContent = creditText().join('\n'); });
    item('modules', 'Modules loaded', () => {
      fetch('mod/index.json').then(r => r.json()).then(l => { mods.textContent = l.join(', '); }).catch(() => { mods.textContent = 'mod/index.json not readable'; });
    });
    // Move the note under its button.
    slots.credits.appendChild(credits); slots.modules.appendChild(mods);
    function refreshAbout() { credits.textContent = ''; mods.textContent = ''; }

    // ---- #where: one line, grid reference first ----
    const where = document.createElement('div'); where.id = 'where'; document.body.appendChild(where);
    const PF = () => SIM.PF || (window.__pf && window.__pf.PF);
    function gridRef(e, n) {
      const e1 = Math.floor(e / 1e5), n1 = Math.floor(n / 1e5);
      if (e1 < 0 || e1 > 6 || n1 < 0 || n1 > 12) return '';
      let l1 = (19 - n1) - (19 - n1) % 5 + Math.floor((e1 + 10) / 5), l2 = (19 - n1) * 5 % 25 + e1 % 5;
      if (l1 > 7) l1++; if (l2 > 7) l2++;
      const pad = v => String(Math.floor((v % 1e5) / 10)).padStart(4, '0');
      return String.fromCharCode(65 + l1, 65 + l2) + ' ' + pad(e) + ' ' + pad(n);
    }
    let pending = false;
    function writeWhere() {
      pending = false;
      const c = map.getCenter(), pf = PF(); let ref = '';
      if (pf && c.lat > 49 && c.lat < 61.5 && c.lng > -9 && c.lng < 2.5) { try { const t = pf.toBng(c.lat, c.lng); ref = gridRef(t.e, t.n); } catch (e) { ref = ''; } }
      const h = map.queryTerrainElevation ? map.queryTerrainElevation([c.lng, c.lat]) : null;
      const parts = [ref, c.lat.toFixed(6) + ', ' + c.lng.toFixed(6), Number.isFinite(h) && h !== null ? Math.round(h) + ' m' : '', 'heading ' + Math.round((map.getBearing() + 360) % 360) + '°'];
      where.textContent = parts.filter(Boolean).join(' · ');
    }
    const soon = () => { if (!pending) { pending = true; requestAnimationFrame(writeWhere); } };
    map.on('move', soon); map.on('idle', soon); soon();

    // ---- attribution strip: the credits of what is on screen ----
    const strip = document.createElement('div'); strip.id = 'attribution'; document.body.appendChild(strip);
    function creditText() {
      const out = [], st = map.getStyle ? map.getStyle() : null;
      if (st && st.sources) for (const k of Object.keys(st.sources)) { const a = st.sources[k].attribution; if (a) out.push(String(a).replace(/<[^>]*>/g, '').trim()); }
      out.push('Grid lines and substations: GridAtlas');
      return Array.from(new Set(out.filter(Boolean)));
    }
    const writeStrip = () => { strip.textContent = creditText().join(' · '); };
    map.on('style.load', () => setTimeout(writeStrip, 100)); map.on('sourcedata', e => { if (e.sourceDataType === 'metadata') writeStrip(); });
    writeStrip();

    SIM.menu = {
      titles: TITLES.slice(), open, close, openName,
      // The 22 controls of 28 Sept: 19 in the six menus, plus Walk, Drone and Map at the bar's right end.
      controls: () => TABLE.filter(r => r[2].core).map(([m, key]) => {
        const el = found[key]; return { key, menu: m, found: !!el, inMenu: !!(el && menus[m].panel.contains(el)), label: el ? (labelOf(el) || el.placeholder || '') : '' };
      }).concat(VIEWS.map(id => { const el = document.getElementById(id); return { key: id, menu: 'View', found: !!el, inMenu: !!(el && views.contains(el)), label: el ? labelOf(el) : '' }; })),
      element: key => found[key] || (VIEWS.includes(key) ? document.getElementById(key) : null)
    };
  }
})();
