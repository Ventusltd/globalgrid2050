// earth-mount.mjs: the earthing cartridge. Loaded the first time an earthing command is typed (cmd-run.mjs), never on the
// first frame. It holds the typed earthing settings, runs the study of the placed solar block (earth-study.mjs) when the
// block or a setting changes, draws the earthing layer (earth-draw.mjs) while it is shown, fills a small Earthing panel,
// gives the check HUD its failed earthing checks (hud-ui.mjs reads worldEarth.checks()), and answers the single-line
// diagram's earth symbols (S1.EARTH, SUB.EARTH). Still, it draws nothing new: its batches keep their version (0 fps).
// Every readout ends with the footer: illustrative, early design, no warranty; confirm with a qualified engineer.

import { toLocal } from './origin.mjs';
import { earthStudy, earthRows, EARTH_DEFAULTS, DC_WORDS } from './earth-study.mjs';
import { earthGroups } from './earth-draw.mjs';
import { SYMBOL_COLOURS } from './sld-symbols.mjs';
import { ELEC_FOOTER, fmtQ } from './sld-rules.mjs';

const CSS = `#earth-panel { right: 8px; top: 56px; width: min(420px, calc(100vw - 16px)); max-height: calc(100vh - 140px); overflow: auto; z-index: 5; }
#earth-panel[hidden] { display: none; } #earth-panel header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
#earth-panel h2 { margin: 0; font-size: 12px; font-weight: 600; color: var(--text, #cfe9ff); }
#earth-panel h3 { margin: 8px 0 2px; font-size: 11px; color: #d8d89a; font-weight: 600; }
#earth-panel dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 0; font-variant-numeric: tabular-nums; font-size: 11px; }
#earth-panel dt { color: var(--text, #cfe9ff); } #earth-panel dd { margin: 0; color: var(--dim, #6f8ea6); }
#earth-panel .foot { margin: 8px 0 0; color: var(--dim, #6f8ea6); font-size: 11px; }
#earth-panel button { background: var(--panel, #111); color: var(--text, #cfe9ff); border: 1px solid var(--edge, #1c2c3a); border-radius: 4px;
  min-height: var(--btn, 30px); padding: 0 9px; cursor: pointer; }
@media (pointer: coarse) { #earth-panel { left: 8px; right: 8px; width: auto; top: auto; bottom: calc(var(--foot, 20px) + 8px); max-height: 45vh; }
  body:has(#sld-panel:not([hidden])) #earth-panel { display: none; } } /* one panel at a time on a phone */
@media print { #earth-panel { display: none !important; } }`;

// deps: { api (substrate extension api), world (window.world), doc }
export function mountEarth({ api, world, doc = document }) {
  const S = { settings: { ...EARTH_DEFAULTS }, on: false, study: null, key: '', groups: null, v: 0, busy: null, error: '' };
  if (!doc.getElementById('earth-style')) { const s = doc.createElement('style'); s.id = 'earth-style'; s.textContent = CSS; doc.head.append(s); }
  const panel = doc.createElement('section');
  panel.id = 'earth-panel'; panel.className = 'panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Earthing');
  panel.innerHTML = `<header><h2>Earthing</h2><button type="button" id="earth-close">Close</button></header><div id="earth-rows" aria-live="polite"></div>
    <p class="foot">${ELEC_FOOTER}</p>`;
  doc.body.append(panel);
  panel.querySelector('#earth-close').addEventListener('click', () => { panel.hidden = true; });
  const groundAt = (e, n) => { const [x, y] = toLocal(api.origin(), e, n); return api.heightAt(x, y); };

  // ---- the study: the placed block, its single-line network, the typed settings ----
  async function study() {
    const b = world.block?.built?.();
    if (!b) throw Error('place the solar block first (block 10mva), then type earthing show');
    const key = `${b.version}|${JSON.stringify(S.settings)}`;
    if (key === S.key && S.study) return S.study;
    const net = world.sld?.graph ? await world.sld.graph().catch(() => null) : null;
    S.study = earthStudy({ block: b, net, settings: S.settings });
    S.key = key; S.groups = null; S.v++;
    try { globalThis.worldHud?.refresh?.(); } catch { /* the HUD may not be loaded */ }
    render(); api.invalidate({ ground: false });
    return S.study;
  }
  const run = () => (S.busy ||= study().finally(() => { S.busy = null; }));

  function render(which = null) {
    if (!S.study) return;
    const { sections } = earthRows(S.study, which), box = panel.querySelector('#earth-rows');
    box.replaceChildren(...sections.flatMap(sec => {
      const h = doc.createElement('h3'), dl = doc.createElement('dl'); h.textContent = sec.title;
      for (const [k, v] of sec.rows) { const dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
      return [h, dl];
    }));
  }

  // ---- drawing: only while shown; the same arrays and versions every frame when nothing changes ----
  const o3 = base => [base[0] - api.origin().e, base[1] - api.origin().n, base[2]];
  function batches() {
    if (!S.on || !S.study) return [];
    const b = world.block?.built?.();
    if (b && !S.key.startsWith(`${b.version}|`)) { run().catch(e => { S.error = e.message; }); return []; } // the block moved: study again
    if (!S.groups) {
      const inv = (b?.built?.station?.inverters || []).map(i => [i.point[0], i.point[1]]);
      S.groups = earthGroups(S.study, { block: b, groundAt, inverters: inv });
    }
    return ['earth', 'open'].map(k => { const G = S.groups[k]; return G.base && G.v.length >= 6
      ? { key: `earth-${k}`, version: `${S.v}`, positions: G.v, color: SYMBOL_COLOURS[k], origin: o3(G.base) } : null; }).filter(Boolean);
  }
  api.hooks.batches?.add(batches);

  // ---- typed commands (cmd-grammar.mjs: act 'earthing') ----
  const SET = { grid: 'mesh', ring: 'ringDepth', target: 'earthTarget', rho: 'rho', split: 'split' };
  async function command({ what, on = true, value = null, value2 = null }) {
    const s = S.settings;
    if (what === 'show' || what === 'hide') {
      S.on = what === 'show' && on !== false;
      if (!S.on) { panel.hidden = true; api.invalidate({ ground: false }); world.sld?.refresh?.().catch?.(() => {}); return 'Earthing hidden.'; }
    } else if (what === 'survey') return `No soil survey staged here: using ${fmtQ(s.rho, 'Ω·m', 2)} (${s.rhoTyped ? 'typed' : 'assumed'}). ${ELEC_FOOTER}`;
    else if (what === 'rods') { if (value != null) s.rods = value; if (value2 != null) s.rodLength = value2; }
    else if (what === 'bonding') s.bonding = value;
    else if (what === 'dc') s.dcSystem = value;
    else if (SET[what] && value != null) { s[SET[what]] = value; if (what === 'rho') s.rhoTyped = true; }
    if (!world.block?.built?.() && !S.on) return `${what === 'rho' ? `Soil resistivity ${fmtQ(s.rho, 'Ω·m', 2)}` : `Earthing ${what}`} set;`
      + ` place the solar block (block 10mva) and type earthing show to see it. ${ELEC_FOOTER}`;
    const t = await run();
    if (S.on) { panel.hidden = false; render(); world.sld?.refresh?.().catch?.(() => {}); }
    api.invalidate({ ground: false });
    return echo(what, t);
  }
  function echo(what, t) {
    const s = t.settings, u = t.substation.worst, fails = t.checks.filter(c => c.failed).length, w = t.worstStation;
    const soil = `ρ ${fmtQ(s.rho, 'Ω·m', 2)} ${s.rhoTyped ? 'typed' : 'assumed'}`;
    const line = {
      show: `Earthing shown: ${t.stations.length} station rings with ${s.rods} rods, the array bonding mesh, 1 substation grid, ${t.cables.length} cable screen runs (${soil}).`,
      grid: `Earth grid ${fmtQ(t.substation.geo.Lx, 'm', 3)} × ${fmtQ(t.substation.geo.Ly, 'm', 3)}, ${fmtQ(t.substation.geo.D, 'm', 2)} mesh, ${s.ringDepth} m deep:`
        + ` ${fmtQ(u.Rg, 'Ω', 2)}, EPR ${fmtQ(u.GPR, 'V', 2)} (${soil}).`,
      ring: `Station rings at ${s.ringDepth} m: ${t.stations.map(x => `${x.id} ${fmtQ(x.R, 'Ω', 2)}`).join(', ')}.`,
      rods: `${s.rods} rods × ${s.rodLength} m per station: worst station ${w.id} ${fmtQ(w.R, 'Ω', 2)} with its array mesh.`,
      target: `Earth target ${s.earthTarget} Ω (a typed setting, not a standard's limit).`,
      rho: `Soil resistivity ${fmtQ(s.rho, 'Ω·m', 2)}, typed (not surveyed). Substation grid ${fmtQ(u.Rg, 'Ω', 2)}; worst station ${fmtQ(w.R, 'Ω', 2)}.`,
      split: `Split factor ${s.split} (share of the HV earth-fault current returning through the grid): EPR ${fmtQ(u.GPR, 'V', 2)}.`,
      dc: `DC array: ${DC_WORDS[s.dcSystem]}.${s.dcSystem === 'earthed' ? ' Red in the check HUD until the inverter maker confirms isolation and approves it.' : ''}`,
      bonding: `Screen bonding ${s.bonding}: ${t.cables.map(c => `${c.id} ${c.study.choice}`).slice(0, 6).join(', ')}${t.cables.length > 6 ? ', …' : ''}.`
    }[what] || 'Earthing updated.';
    return `${line} ${fails ? `${fails} earthing check${fails === 1 ? '' : 's'} failed (red in the check HUD).` : 'No earthing check failed.'} ${ELEC_FOOTER}`;
  }

  // ---- the single-line diagram's earth symbols: S1.EARTH ... and SUB.EARTH ----
  function rowsFor(nodeId) {
    if (!S.study) return [];
    const id = String(nodeId).replace(/\.EARTH$/, ''), which = id === 'SUB' ? 'substation' : id;
    const { sections } = earthRows(S.study, which);
    return [...sections.flatMap(sec => sec.rows), ['Note', ELEC_FOOTER]];
  }

  const api_ = {
    command, rowsFor, on: () => S.on, refresh: () => run(),
    checks: () => (!S.study ? [] : S.on ? S.study.checks : S.study.checks.filter(c => c.id === 'dc-system' && c.failed)), version: () => `${S.v}:${S.on}`, // a pole earthed stays red
    state: () => ({ on: S.on, settings: { ...S.settings }, ready: !!S.study, panel: !panel.hidden, counts: S.groups?.counts || null,
      failed: S.study ? S.study.checks.filter(c => c.failed).map(c => c.id) : [], footer: ELEC_FOOTER })
  };
  globalThis.worldEarth = api_;
  return api_;
}
