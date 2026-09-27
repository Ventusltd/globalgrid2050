// build-ui.mjs: build mode on the page. Choose Table or Inverter; a ghost follows the pointer, snapped to the grid on the
// ground, outlined in green where it may go and red where it may not, and the bar under the view says why in plain words.
// A click (or tap) on a green ghost places it and writes its typed line; a tap on a red one only explains. Strings wire
// themselves (build-rules.mjs wire), "piles auto" piles what was built, and the check HUD shows the failed checks.
// Loaded the first time Place or a build line is used (build-mount.mjs). It draws nothing of its own: a frame is asked for
// only when the ghost's snapped cell or its verdict changes, or something is placed (0 fps when still).

import { rayFromScreen, pickGround } from './pick.mjs';
import { DEFAULTS, PIECES, snap, checkPlacement, wire, statusWords, buildChecks, typedOf, labelOf } from './build-rules.mjs';
import { sceneGroups, ghostGroup, builtPiles } from './build-geom.mjs';
import { parseBuild, settingLines } from './build-cmd.mjs';

const C = { tables: [0.62, 0.72, 0.86, 0.85], strings: [0.4, 0.62, 0.95, 0.8], loose: [1, 0.23, 0.19, 0.95], runs: [0.95, 0.8, 0.35, 0.8],
  inverters: [0.95, 0.97, 1, 1], ok: [0.35, 0.9, 0.5, 0.95], no: [1, 0.23, 0.19, 0.95], piles: [0.8, 0.8, 0.8, 0.9], flagged: [1, 0.55, 0.2, 1] };
const CSS = `#build-bar { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--foot, 28px) + 8px); width: min(620px, calc(100vw - 16px));
  box-sizing: border-box; background: var(--panel, #111); border: 1px solid var(--edge, #333); border-radius: 6px; padding: 6px 8px; z-index: 3;
  display: flex; gap: 8px; align-items: flex-start; font: 12px/1.45 system-ui, sans-serif; color: var(--text, #ddd); }
#build-bar[hidden], body[data-cmd] #build-bar { display: none; }
#build-bar p { margin: 0; flex: 1; } #build-bar .no { color: #ff8a7a; } #build-bar .ok { color: #8fe0a3; }
#build-bar button { flex: none; background: none; color: var(--dim, #aaa); border: 1px solid var(--edge, #333); border-radius: 4px; min-height: 28px; padding: 0 10px; cursor: pointer; }`;
const CLICK_PX = 6;

// deps: { api (substrate extension api), world (window.world), ohl ({ layer } from ohl-ui.mjs), doc, row (the Place row, or null) }
export function createBuild({ api, world, ohl = null, doc = document, row = null }) {
  const S = { tool: null, items: [], undo: [], P: { ...DEFAULTS }, ghost: null, ghostKey: '', v: 0, piles: null, cat: null, cls: null, next: 1,
    wired: null, say: '', sayOk: true };
  const canvas = api.canvas;
  if (!doc.getElementById('build-style')) { const s = doc.createElement('style'); s.id = 'build-style'; s.textContent = CSS; doc.head.append(s); }
  const bar = doc.createElement('section'); bar.id = 'build-bar'; bar.hidden = true; bar.setAttribute('aria-label', 'Place');
  bar.innerHTML = '<p id="build-say" role="status" aria-live="polite"></p><button type="button" id="build-undo">Undo</button><button type="button" id="build-done">Done</button>';
  doc.body.append(bar);
  const say = bar.querySelector('#build-say');
  bar.querySelector('#build-undo').addEventListener('click', () => exec('build undo'));
  bar.querySelector('#build-done').addEventListener('click', () => exec('build done'));

  // The module catalogue for the string voltage check (the HUD's own inputs), once.
  const catalogue = fetch(new URL('./world/data/modules.json', location.href), { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(c => { S.cat = c; S.cls = c?.classes?.find(k => k.id === (world.module?.debug?.()?.class || 'A')) || c?.classes?.[0] || null; changed(false); });

  // ---- the world, in national-grid metres ----
  const o = () => world.origin();
  const measured = (e, n) => world.measuredAt(e - o().e, n - o().n);
  const ground = (e, n) => api.heightAt(e - o().e, n - o().n);
  function zones() {
    if (!(world.layersOn?.() || []).includes('grid') || !ohl?.layer?.zonesEN) return { state: 'off', list: [] };
    const list = ohl.layer.zonesEN() || [];
    return { state: list.length ? 'on' : 'none', list };
  }
  const ctx = () => ({ measured, zones: zones(), items: S.items, P: S.P });

  // ---- what is drawn ----
  let cache = { v: -1, org: '', groups: null };
  const o3 = base => [base[0] - o().e, base[1] - o().n, base[2]];
  const batch = (key, G, color, version) => (G && G.count ? { key: 'build-' + key, version, positions: G.v, color, origin: o3(G.base) } : null);
  function batches() {
    const org = `${o().e},${o().n}`;
    if (cache.v !== S.v || cache.org !== org) cache = { v: S.v, org, groups: S.items.length ? sceneGroups(S.items, S.wired, S.P, ground) : null };
    const out = [];
    if (cache.groups) for (const k of ['tables', 'strings', 'loose', 'runs', 'inverters']) out.push(batch(k, cache.groups[k], C[k], `${S.v}`));
    if (S.piles) { out.push(batch('piles', S.piles.groups.ok, C.piles, `${S.v}p`), batch('piles-flagged', S.piles.groups.flagged, C.flagged, `${S.v}p`)); }
    if (S.tool && S.ghost) out.push(batch('ghost', S.ghost.G, S.ghost.check.ok ? C.ok : C.no, S.ghostKey));
    return out.filter(Boolean);
  }
  api.hooks.batches.add(batches);

  // ---- state changes ----
  function changed(redraw = true) {
    S.wired = wire(S.items, S.P); S.v++;
    S.checks = buildChecks(S.items, S.wired, S.P, { cat: S.cat, cls: S.cls });
    if (redraw) { api.hooks.design.forEach(f => f()); api.gate.invalidate(); }
    else window.worldHud?.refresh?.();
  }
  const snapshot = () => ({ items: S.items.map(i => ({ ...i })), P: { ...S.P }, next: S.next });
  const remember = () => { S.undo.push(snapshot()); if (S.undo.length > 200) S.undo.shift(); };
  function tell(text, ok = true) {
    S.say = text; S.sayOk = ok; say.textContent = text; say.className = ok ? 'ok' : 'no';
    bar.hidden = !S.tool && !text;
  }
  function setTool(kind) {
    S.tool = kind; S.ghost = null; S.ghostKey = '';
    for (const b of row?.querySelectorAll('[data-place]') || []) b.setAttribute('aria-pressed', String(b.dataset.place === kind));
    if (kind) { // one tool at a time: a Design drawing tool is put down
      for (const b of doc.querySelectorAll('#design [data-tool][aria-pressed="true"]')) b.click();
      tell(`${PIECES[kind]}: move over the ground to see where it may go, then click to place. Typed: build ${kind} at E N.`);
    } else { bar.hidden = true; }
    api.gate.invalidate();
  }

  // Place a piece at national-grid (e, n), snapped; refused in words where a rule says no.
  function place(kind, e, n) {
    const at = snap(kind, e, n, S.P), c = checkPlacement(kind, at, ctx());
    if (!c.ok) { showGhost(c); return { ok: false, text: `${PIECES[kind]} not placed. ${c.reasons.join(' ')}` }; }
    remember();
    const it = { id: `${kind}-${S.next++}`, kind, e: at.e, n: at.n };
    S.items.push(it); S.piles = null; changed();
    const w = S.wired.tables.find(t => t.id === it.id), label = labelOf(it, S.items);
    const wired = kind === 'table' ? (w?.inverter !== null && w
      ? ` Its ${w.strings} strings joined inverter ${w.inverter + 1} (${w.inputs} MPPT input${w.inputs === 1 ? '' : 's'}, home run ${Math.round(w.runM)} m).`
      : ` Its ${S.wired.T.strings} strings are not connected: ${S.wired.inverters.length ? 'no inverter has a free MPPT input. Place another inverter.' : 'place an inverter.'}`)
      : ` ${S.wired.inverters[S.wired.inverters.length - 1].strings} strings wired to it.`;
    return { ok: true, text: `${PIECES[kind]} ${label} placed${c.notes.length ? `: ${c.notes.join('; ')}` : ''}.${wired} Typed: ${typedOf(it)}. ${statusWords(S.items, S.wired, S.P)}` };
  }
  function showGhost(c) {
    const key = `${c.kind}:${c.at.e}:${c.at.n}:${c.ok}:${S.v}`;
    if (key === S.ghostKey) return;
    S.ghostKey = key; S.ghost = { check: c, G: ghostGroup(c, S.P, ground) };
    tell(c.ok ? `${PIECES[c.kind]} can go here${c.notes.length ? `: ${c.notes.join('; ')}` : ''}. Click to place.` : c.reasons.join(' '), c.ok);
    api.gate.invalidate();
  }
  function pointAt(x, y) {
    const s = world.state(), r = rayFromScreen(x, y, canvas.clientWidth, canvas.clientHeight, s.pos, s.yaw, s.pitch, api.FOV);
    const p = pickGround(r, api.heightAt, { maxDistance: 3000 });
    return p ? { e: p[0] + o().e, n: p[1] + o().n } : null;
  }

  // ---- pointer: hover shows the ghost (mouse), a click or tap places ----
  let press = null;
  const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointermove', e => {
    if (!S.tool || press || e.pointerType !== 'mouse') return;
    const p = pointAt(...local(e));
    if (p) showGhost(checkPlacement(S.tool, snap(S.tool, p.e, p.n, S.P), ctx()));
  });
  canvas.addEventListener('pointerdown', e => { if (S.tool) press = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    const p0 = press; press = null;
    if (!S.tool || !p0 || Math.hypot(e.clientX - p0.x, e.clientY - p0.y) > CLICK_PX) return;
    const p = pointAt(...local(e));
    if (!p) { tell('No ground under that point. Look down at the ground and try again.', false); return; }
    const at = snap(S.tool, p.e, p.n, S.P), c = checkPlacement(S.tool, at, ctx());
    // A tap on a phone first shows the ghost and why; a second tap on the same green ghost places it. A mouse places at once.
    const same = S.ghost && S.ghost.check.kind === S.tool && S.ghost.check.at.e === at.e && S.ghost.check.at.n === at.n;
    if (e.pointerType !== 'mouse' && !same) { showGhost(c); return; }
    const r = place(S.tool, p.e, p.n);
    tell(r.text, r.ok);
  });

  // ---- typed lines: every click has one ----
  function exec(line) {
    const q = parseBuild(line);
    if (!q) return null;
    if (!q.ok) { tell(q.why, false); return { ok: false, text: q.why, line }; }
    let r;
    if (q.act === 'status') r = { ok: true, text: statusWords(S.items, S.wired || wire(S.items, S.P), S.P), quiet: true };
    else if (q.act === 'done') { setTool(null); r = { ok: true, text: 'Place put down. ' + statusWords(S.items, S.wired || wire(S.items, S.P), S.P), quiet: true }; }
    else if (q.act === 'undo') {
      const u = S.undo.pop();
      if (!u) r = { ok: false, text: 'Nothing to undo in build.' };
      else { Object.assign(S, { items: u.items, P: u.P, next: u.next, piles: null }); S.ghostKey = ''; changed(); r = { ok: true, text: 'Undone. ' + statusWords(S.items, S.wired, S.P) }; }
    } else if (q.act === 'clear') {
      if (S.items.length) remember();
      S.items = []; S.piles = null; changed(); r = { ok: true, text: 'Build cleared (build undo brings it back).' };
    } else if (q.act === 'set') {
      remember(); const was = S.P[q.key]; S.P = { ...S.P, [q.key]: q.value }; S.piles = null; S.ghostKey = ''; changed();
      r = { ok: true, text: `${line.trim()}: ${was} → ${q.value}. ${statusWords(S.items, S.wired, S.P)}` };
    } else if (q.act === 'place') {
      if (!q.at) {
        const c = canvas, p = pointAt(c.clientWidth / 2, c.clientHeight / 2);
        if (!p) r = { ok: false, text: 'No ground at the centre of the view: look at the ground, or type build table at E N.' };
        else { if (S.tool !== q.kind) setTool(q.kind); r = place(q.kind, p.e, p.n); }
      } else r = place(q.kind, q.at.e, q.at.n);
    }
    tell(r.text, r.ok);
    return { ...r, line };
  }
  // "piles auto" piles what was built (the plant's engine and rules), then the plant and block as before.
  async function pilesAuto() {
    S.piles = builtPiles(S.items, S.P, measured); S.v++; api.gate.invalidate();
    const s = S.piles?.summary;
    if (!s) return null;
    const flags = s.revealHigh + s.revealLow, bits = [flags && `${flags} outside the reveal band`, s.gradingTables && `${s.gradingTables} tables need grading`,
      s.twistTables && `${s.twistTables} twisted over tolerance`, s.unmeasured && `${s.unmeasured} on ground not fully measured`].filter(Boolean);
    let text = `Built tables piled automatically: ${s.piles} piles, front and rear posts, ${Math.round(s.totalPileLengthM)} m of pile `
      + `(embedment provisional); ${s.proofTests} proof tests. ${bits.length ? 'Flagged (orange): ' + bits.join(' · ') + '.' : 'No piles flagged.'}`;
    if (world.plant?.result?.() || world.block?.built?.()) {
      try { const { pilesText } = await import('./cmd-run.mjs'); text += ' ' + pilesText(await world.piles.auto(), world.plant?.result?.()); } catch { /* the plant's piles stay as they were */ }
    }
    tell(text, true);
    return { ok: true, text, line: 'piles auto' };
  }

  // ---- the check HUD and the design file ----
  (api.hooks.checks ||= new Set()).add(() => ({ key: `build:${S.v}`, list: S.checks || [] }));
  const script = () => [...settingLines(S.P, DEFAULTS), ...S.items.map(typedOf)];
  function replay(lines) {
    Object.assign(S, { items: [], undo: [], P: { ...DEFAULTS }, piles: null, next: 1 });
    const out = lines.map(l => exec(l)).filter(Boolean);
    S.undo = []; changed();
    return out;
  }
  changed(false);
  // probe: the verdict a placement would get at national-grid (e, n), without placing (tests and the console).
  const probe = (kind, e, n) => { const c = checkPlacement(kind, snap(kind, e, n, S.P), ctx()); return { ok: c.ok, at: c.at, reasons: c.reasons, notes: c.notes }; };
  return { exec, pilesAuto, setTool, script, replay, catalogue, probe,
    debug: () => ({ tool: S.tool, items: S.items.map(i => ({ ...i })), P: { ...S.P }, say: S.say, ok: S.sayOk, ghost: S.ghost ? { ...S.ghost.check.at, ok: S.ghost.check.ok } : null,
      wired: S.wired && { strings: S.wired.strings, connected: S.wired.connected, unconnected: S.wired.unconnected, inverters: S.wired.inverters.map(v => ({ ...v })) },
      piles: S.piles?.summary ? { piles: S.piles.summary.piles, flagged: S.piles.groups.flagged.count / 2 } : null, checks: (S.checks || []).map(c => c.id), version: S.v, script: script() }) };
}
