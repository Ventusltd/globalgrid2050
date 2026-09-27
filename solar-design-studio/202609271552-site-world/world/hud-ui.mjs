// hud-ui.mjs: the check HUD. Small monospace red text over the view, top-left under the plan, a thin red rule, low
// opacity: one line per failed design check (hud-checks.mjs), each with a tiny "i" that opens its working (inputs, the
// standard cited by number, "illustrative, assumptions editable"). Owner's instruction, 27 Sept; no copied graphics.
// Public checks come from the placed solar block. Private (ER-based) checks appear ONLY after a rules file is loaded
// locally: the file picker ("hud rules"), or ?rules= naming a file on this machine's own local server (loopback only).
// Nothing private is ever fetched from the public server. Off in print. "hud on|off" in the command line.
// Loaded just after the first frame; it reads the design only when it changes (no frames of its own: 0 fps when still).

import { publicChecks, parsePrivateRules, evaluatePrivate, hudLines } from './hud-checks.mjs';

const CSS = `#check-hud { position: fixed; left: 10px; top: 246px; max-width: min(520px, calc(100vw - 20px)); z-index: 4; pointer-events: none;
  font: 10px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 0.04em; color: #ff3b30; opacity: 0.78;
  border-top: 1px solid rgba(255, 59, 48, 0.7); padding-top: 3px; text-shadow: 0 0 2px rgba(0, 0, 0, 0.9); }
#check-hud[hidden] { display: none; }
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
  const S = { on: true, key: '', pub: [], priv: null, rules: null, open: new Set(), cat: null, checks: null, loading: null, note: '' };
  if (!doc.getElementById('check-hud-style')) { const s = doc.createElement('style'); s.id = 'check-hud-style'; s.textContent = CSS; doc.head.append(s); }
  const box = doc.createElement('section'); box.id = 'check-hud'; box.hidden = true; box.setAttribute('aria-label', 'Design checks');
  doc.body.append(box);
  const pick = Object.assign(doc.createElement('input'), { type: 'file', accept: '.json,application/json', hidden: true, id: 'check-hud-rules' });
  doc.body.append(pick);
  pick.addEventListener('change', async () => { const f = pick.files?.[0]; pick.value = ''; if (f) await loadRulesText(await f.text(), f.name); });

  // The inputs the public checks read, fetched once (the module catalogue and the staged cable schedule).
  const inputs = () => (S.loading ||= Promise.all([
    fetchImpl('./world/data/modules.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null),
    Promise.all([import('./cable-checks.mjs'), import('./cable-checks-ui.mjs')]).then(async ([C, U]) => {
      const k = C.parseChecks(await U.loadStaged()), choice = C.defaultChoice(k); return { ac: C.acChecks(k, choice), choice };
    }).catch(() => null)
  ]).then(([cat, checks]) => { S.cat = cat; S.checks = checks; }));

  function facts() {
    const b = world.block?.built?.()?.built, inv = b?.summary?.inventory;
    if (!b) return null;
    const cls = S.cat?.classes?.find(c => c.id === (world.module?.debug?.()?.class || 'A')) || S.cat?.classes?.[0];
    const t = b.trenches?.find(x => x.stage === 'ac'), p = world.block?.built?.()?.params || {};
    return { mps: inv?.modulesPerString, tempMinC: p.tempMinC, strings: inv?.totalStrings, connectedStrings: inv?.connectedStrings, spareStrings: inv?.spareStrings,
      cls, cat: S.cat, ac: S.checks?.ac, choice: S.checks?.choice, acTrenchWidthM: t?.section?.trench_width_m,
      // named facts a private rules file may test (spec-rules.v1 value / subject / metric keys)
      named: { modules_per_string: inv?.modulesPerString, inverterKVA: inv?.inverterKVA, strings_unconnected: inv?.spareStrings,
        ac_loading_pct: S.checks?.ac?.summary?.loading_pct?.max, lv_drop_pct: S.checks?.ac?.summary?.vd_pct?.max } };
  }
  function render() {
    const lines = S.on ? hudLines(S.pub, S.priv || []) : [];
    box.hidden = !lines.length && !S.note;
    const kids = lines.map(c => {
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
    }).flat();
    if (S.note) { const n = doc.createElement('div'); n.textContent = S.note; kids.push(n); }
    box.replaceChildren(...kids);
  }
  async function refresh(force = false) {
    const B = world.block?.built?.(), bv = `${B?.version ?? -1}:${B?.params?.tempMinC ?? ''}`, key = `${bv}|${S.rules ? S.rules.label : ''}|${S.on}`;
    if (!force && key === S.key) return;
    S.key = key;
    const f0 = facts();
    if (f0) await inputs();
    const f = facts();
    S.pub = f ? publicChecks(f) : [];
    S.priv = S.rules && f ? evaluatePrivate(S.rules, { ...(f.named || {}) }) : null;
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
    state: () => ({ on: S.on, shown: !box.hidden, rules: S.rules ? S.rules.checks.length : 0, note: S.note })
  };
}
