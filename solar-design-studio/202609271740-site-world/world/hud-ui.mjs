// hud-ui.mjs: the check HUD. Small monospace red text over the view, top-left under the plan, a thin red rule, low
// opacity: one line per failed design check (hud-checks.mjs), each with a tiny "i" that opens its working (inputs, the
// standard cited by number, "illustrative, assumptions editable"). Owner's instruction, 27 Sept; no copied graphics.
// Public checks come from the placed solar block. Private (ER-based) checks appear ONLY after a rules file is loaded
// locally: the file picker ("hud rules"), or ?rules= naming a file on this machine's own local server (loopback only).
// Nothing private is ever fetched from the public server. Off in print. "hud on|off" in the command line.
// Loaded just after the first frame; it reads the design only when it changes (no frames of its own: 0 fps when still).

import { publicChecks, parsePrivateRules, evaluatePrivate, hudLines, plantFacts, plantStringFacts, HUD_TITLE, QUALIFIED } from './hud-checks.mjs';

const CSS = `#check-hud { position: fixed; left: 10px; top: 246px; max-width: min(520px, calc(100vw - 20px)); z-index: 4; pointer-events: none;
  font: 10px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 0.04em; color: #ff3b30; opacity: 0.78;
  border-top: 1px solid rgba(255, 59, 48, 0.7); padding-top: 3px; text-shadow: 0 0 2px rgba(0, 0, 0, 0.9); }
#check-hud[hidden] { display: none; }
#check-hud { overflow-y: auto; } #check-hud .t, #check-hud .q { color: #d0d4d8; opacity: 0.85; margin-bottom: 2px; }
#check-hud.compact .l, #check-hud.compact .a, #check-hud.compact .w, #check-hud.compact .q { display: none; }
#check-hud .more { pointer-events: auto; font: inherit; color: #d0d4d8; background: none; border: 1px solid rgba(208, 212, 216, 0.5); border-radius: 3px; padding: 0 4px; cursor: pointer; }
#check-hud .l { display: flex; gap: 6px; align-items: baseline; }
#check-hud button { pointer-events: auto; font: inherit; color: inherit; background: none; border: 1px solid rgba(255, 59, 48, 0.6);
  border-radius: 50%; width: 13px; height: 13px; line-height: 10px; padding: 0; cursor: pointer; font-size: 8px; font-style: italic; }
#check-hud .ok { color: #d0d4d8; }
#check-hud .ok button { border-color: rgba(208, 212, 216, 0.6); }
#check-hud .a { margin: 0 0 2px 10px; max-width: 480px; }
#check-hud .w { pointer-events: auto; margin: 2px 0 4px 10px; color: #ff8a80; white-space: pre-wrap; max-height: 40vh; overflow: auto; }
@media print { #check-hud { display: none !important; } }`;

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;

// deps: { api (substrate), world (window.world), doc, fetchImpl }
export function mountHud({ api, world, doc = document, fetchImpl = (u, o) => fetch(u, o) }) {
  const S = { on: true, key: '', pub: [], priv: null, rules: null, open: new Set(), cat: null, loading: null, note: '', drops: null, dropsKey: null,
    cramped: false, compact: false };
  if (!doc.getElementById('check-hud-style')) { const s = doc.createElement('style'); s.id = 'check-hud-style'; s.textContent = CSS; doc.head.append(s); }
  const box = doc.createElement('section'); box.id = 'check-hud'; box.hidden = true; box.setAttribute('aria-label', 'Design checks');
  doc.body.append(box);
  const pick = Object.assign(doc.createElement('input'), { type: 'file', accept: '.json,application/json', hidden: true, id: 'check-hud-rules' });
  doc.body.append(pick);
  pick.addEventListener('change', async () => { const f = pick.files?.[0]; pick.value = ''; if (f) await loadRulesText(await f.text(), f.name); });

  // The inputs the public checks read, fetched once (the module catalogue and the staged cable schedule).
  // The module catalogue, fetched once; the block's drops (hud-drops.mjs, the Follow method) worked out once per block version.
  const inputs = () => (S.loading ||= fetchImpl('./world/data/modules.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null)
    .then(cat => { S.cat = cat; }));
  async function dropsFor(B) {
    if (!B) return null;
    if (S.dropsKey !== B.version) { S.dropsKey = B.version; S.drops = null; try { S.drops = (await import('./hud-drops.mjs')).blockDrops(B.built, B.anchor); } catch { S.drops = null; } }
    return S.drops;
  }

  function facts() {
    const r = world.plant?.result?.(), b = world.block?.built?.()?.built, inv = b?.summary?.inventory, plant = plantFacts(r);
    const plantString = plantStringFacts(r, S.cat);   // the plant's own string line: shown with or without a block
    if (!b) return plant ? { plant, plantString } : null;
    const cls = S.cat?.classes?.find(c => c.id === (world.module?.debug?.()?.class || 'A')) || S.cat?.classes?.[0];
    const p = world.block?.built?.()?.params || {}, tp = b.trenchPlan, acPct = tp?.summary?.ac ? tp.summary.ac.worst * 100 : undefined;
    return { plant, plantString, mps: inv?.modulesPerString, tempMinC: p.tempMinC, strings: inv?.totalStrings, connectedStrings: inv?.connectedStrings,
      spareStrings: inv?.spareStrings, cls, cat: S.cat, drops: S.drops,
      // The AC cables and the collector trench as BUILT: the rated trench plan (trench-plan.mjs), its own soil and load.
      plan: tp ? { summary: tp.summary, env: tp.env } : null, trenchFaults: tp?.faults || [],
      // named facts a private rules file may test (spec-rules.v1 value / subject / metric keys)
      named: { modules_per_string: inv?.modulesPerString, inverterKVA: inv?.inverterKVA, strings_unconnected: inv?.spareStrings,
        ac_loading_pct: acPct, lv_drop_pct: S.drops?.ac?.pct, acGroupedLoadingPct: acPct, lvDropPctWorst: S.drops?.ac?.pct,
        dc_drop_pct: S.drops?.dc?.pct, $design: { summary: b.summary } } };
  }
  function render() {
    const lines = S.on ? hudLines(S.pub, S.priv || []) : [];
    box.hidden = !lines.length && !S.note;
    const red = lines.filter(c => c.failed).length, top = doc.createElement('div'), more = doc.createElement('button');
    top.className = 't'; top.textContent = `${HUD_TITLE} · ${red} red, ${lines.length - red} shown `;
    more.type = 'button'; more.className = 'more';
    more.addEventListener('click', () => { S.compact = !S.compact; placeBox(); });
    top.append(more);
    const kids = [top, ...lines.map(c => {
      const row = doc.createElement('div'), txt = doc.createElement('span'), i = doc.createElement('button');
      row.className = c.failed ? 'l' : 'l ok'; txt.textContent = c.line; i.type = 'button'; i.textContent = 'i';
      i.setAttribute('aria-label', `Working for ${c.id}`); i.setAttribute('aria-expanded', String(S.open.has(c.id)));
      i.addEventListener('click', () => { S.open.has(c.id) ? S.open.delete(c.id) : S.open.add(c.id); render(); });
      row.append(txt, i);
      const head = [row];
      if (c.advice) { const a = doc.createElement('div'); a.className = c.failed ? 'a' : 'a ok'; a.textContent = c.advice; head.push(a); }
      if (!S.open.has(c.id)) return head;
      const w = doc.createElement('div'); w.className = 'w';
      w.textContent = [...c.working.inputs.map(([k, v]) => `${k}: ${v ?? '–'}`), `Standard: ${c.working.standard}`, c.working.note].join('\n');
      return [...head, w];
    }).flat()];
    const q = doc.createElement('div'); q.className = 'q'; q.textContent = QUALIFIED; kids.push(q);
    if (S.note) { const n = doc.createElement('div'); n.textContent = S.note; kids.push(n); }
    box.replaceChildren(...kids);
    placeBox();
  }
  // The HUD never sits under an open panel (the command line, Design, Follow, earthing, module detail): it narrows to the
  // room left of a panel, stops above one below it, and where too little room is left it folds to its title line (show
  // opens it). Worked out when the HUD or a panel changes, never per frame.
  const PANELS = '#cmd, #design, #layers, #sld-follow, #sld-panel, #earth-panel, #module-panel';
  function placeBox() {
    const W = globalThis.innerWidth || 1024, H = globalThis.innerHeight || 768, left = 10, top = Math.min(246, Math.max(60, H * 0.3));
    let maxW = Math.min(520, W - 20), maxH = H - top - 8;
    for (const el of doc.querySelectorAll(PANELS)) {
      if (el.hidden || !el.getClientRects?.().length) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.bottom <= top || r.top >= top + maxH) continue;
      if (r.left >= left + 170) maxW = Math.min(maxW, r.left - left - 8);      // a panel to the right: stop short of it
      else if (r.top > top) maxH = Math.min(maxH, r.top - top - 8);            // a panel below across the left: stop above it
      else maxH = 0;                                                            // a panel over the HUD's corner
    }
    const cramped = maxW < 170 || maxH < 60;
    if (cramped !== S.cramped) { S.cramped = cramped; S.compact = cramped; }
    box.classList.toggle('compact', !!S.compact);
    box.style.top = `${Math.round(top)}px`;
    box.style.maxWidth = `${Math.max(160, Math.round(maxW))}px`;
    box.style.maxHeight = S.compact ? '' : `${Math.max(60, Math.round(maxH))}px`;
    const b = box.querySelector('.more'); if (b) { b.hidden = !S.cramped; b.textContent = S.compact ? 'show' : 'hide'; }
  }
  let placing = 0;
  const replace = () => { if (!placing && !box.hidden) placing = requestAnimationFrame(() => { placing = 0; placeBox(); }); };
  globalThis.addEventListener?.('resize', replace);
  for (const ev of ['click', 'keyup', 'transitionend']) doc.addEventListener?.(ev, replace, true);
  async function refresh(force = false) {
    const B = world.block?.built?.(), bv = `${B?.version ?? -1}:${B?.params?.tempMinC ?? ''}:${world.plant?.version?.() ?? 0}`;
    const key = `${bv}|${S.rules ? S.rules.label : ''}|${S.on}|${globalThis.worldEarth?.version?.() ?? ''}`;
    if (!force && key === S.key) return;
    S.key = key;
    await inputs();                                           // the module catalogue (the block's and the plant's string lines)
    await dropsFor(world.block?.built?.());
    const f = facts();
    S.pub = f ? [...publicChecks(f), ...(globalThis.worldEarth?.checks?.() || [])] : []; // earthing: earth-mount.mjs, once typed
    const sv = S.pub.find(c => c.id === 'string-voc');   // the live cold string Voc, so a private string-voltage test follows "string N"
    S.priv = S.rules && f ? evaluatePrivate(S.rules, { ...(f.named || {}), string_voc_cold_v: sv?.stringV }) : null;
    render();
  }
  async function loadRulesText(text, name = 'rules') {
    try { S.rules = parsePrivateRules(JSON.parse(text)); S.note = ''; } catch (e) { S.rules = null; S.note = `RULES REFUSED: ${e.message}`; }
    await refresh(true);
    return S.rules ? S.rules.checks.length : 0;
  }
  // ?rules=<url>: only on this machine (the page and the file both on a loopback host), never from the public server.
  async function rulesFromQuery(loc = location) {
    const q = new URLSearchParams(loc.search).get('rules');
    if (!q) return 0;
    let u;
    try { u = new URL(q, loc.href); } catch { u = null; }
    if (!u || !LOOPBACK.test(loc.hostname) || !LOOPBACK.test(u.hostname)) { S.note = 'RULES NOT LOADED: ?rules= works only for a file on this machine'; render(); return 0; }
    try { return await loadRulesText(await (await fetchImpl(u.href, { cache: 'no-store' })).text(), u.pathname); } catch { S.note = 'RULES NOT LOADED'; render(); return 0; }
  }
  api.hooks.after.add(() => { refresh(); });
  api.hooks.design?.add(() => { refresh(); });
  rulesFromQuery();
  return {
    set(on) { S.on = !!on; refresh(true); return S.on; },
    pickRules() { pick.click(); },
    loadRulesText, rulesFromQuery, refresh: () => refresh(true),
    lines: () => (S.on ? hudLines(S.pub, S.priv || []).map(c => ({ id: c.id, line: c.line, private: !!c.private, failed: !!c.failed,
      ...(c.advice ? { advice: c.advice } : {}) })) : []),
    state: () => ({ on: S.on, shown: !box.hidden, rules: S.rules ? S.rules.checks.length : 0, note: S.note, compact: !!S.compact, title: HUD_TITLE })
  };
}
