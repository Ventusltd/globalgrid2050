// cmd-run.mjs: the page's engine for the typed session (cmd-model.mjs). Every command reaches the world through the same
// calls the forms use: world.plant.run(params), world.plant.openLand(params), world.block.place(params), world.setLayer,
// world.flyTo, and world.piles.auto() where this build has it. It also says what each layout kept clear: overhead line
// zones (the zones layer, HSE GS6), watercourses (the water layer and its setback), gradients (the slope limit) and the
// ground (the site's ground file, BGS Geology 625k). Illustrative throughout: nothing here is a design for any site.

import { summarize } from './cmd-model.mjs';
import { soilEffect } from './cmd-derive.mjs';
import { distToGeometry } from './clash.mjs';
import { formatNumber, fmtPct } from './measure-format.mjs';
import { parseGroundFile, at as groundAt } from './layers/ground.mjs';
import { makeApi } from './layers.mjs';

const ENDS = { 'gis-bay': 'a bay at the substation', 'dno-sub': 'the network operator substation', tower: 'the tee into the line', none: 'an assumed landing' };
const LAYER = { pylons: 'grid', water: 'water', slope: 'slope', soil: 'ground' };
const n0 = v => formatNumber(v, 0); // the one formatter (measure-format.mjs)

// deps: { world (window.world), api (the substrate's extension api), ohl ({ layer } from ohl-ui.mjs), doc }
export function createEngine({ world, api, ohl, doc = document }) {
  let ours = null, soil = null, ohlSeen = null, earth = null;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const status = id => doc.getElementById(id)?.textContent || '';
  const here = () => { const s = world.state(), o = world.origin(); return { e: o.e + s.pos[0], n: o.n + s.pos[1] }; };

  // Overhead line zones as a test in national-grid metres; null when the grid layer has drawn none.
  function ohlTest() {
    const L = ohl?.layer;
    if (!L) return null;
    L.refresh?.(world.groundVersion?.());
    const spans = L.spans?.() || [], o = world.origin();
    ohlSeen = spans.length;
    if (!spans.length) return null;
    const boxes = spans.map(s => {
      const xs = s.quad.pts.map(p => p[0]), ys = s.quad.pts.map(p => p[1]), r = s.zoneReach;
      return [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r];
    });
    return (e, n) => {
      const x = e - o.e, y = n - o.n;
      for (let i = 0; i < spans.length; i++) {
        const b = boxes[i];
        if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
        if (distToGeometry(spans[i].quad, x, y) <= spans[i].zoneReach) return true;
      }
      return false;
    };
  }
  async function soilModel() {
    if (soil) return soil;
    try {
      const base = new URL('./world/', location.href).href, m = await (await fetch(base + 'manifest.json', { cache: 'no-cache' })).json();
      const cfg = (m.layers || []).find(l => l.id === 'ground')?.config;
      soil = cfg?.path ? parseGroundFile(await makeApi(base).fetchJSON(cfg.path, cfg.sha256)) : { none: true };
    } catch { soil = { none: true }; }
    return soil;
  }
  const soilAt = async (e, n) => { const m = await soilModel(); return soilEffect(m.none ? null : groundAt(m, e, n)); };
  soilModel();

  return {
    async layout(input) {
      const s = await world.plant.run(input);
      if (!s) throw Error(status('plant-status') || 'the layout did not run');
      return summarize(world.plant.result());
    },
    async openLand(input) {
      const b = await world.plant.openLand({ ...input, at: here() });
      ours = b ? b.map(p => p.slice()) : null;
      return ours;
    },
    drawnBoundary() { const b = world.plant.boundary?.(); return b && !same(b, ours) ? b.map(p => p.slice()) : null; },
    async setBoundary(pts) { ours = pts.map(p => p.slice()); await world.plant.setBoundary(pts.map(([e, n]) => ({ e, n }))); },
    clearPlant() { ours = null; world.plant.clear?.(); },
    avoid(st) { const t = st.avoidOhl ? ohlTest() : null; return t ? [{ id: 'ohl', test: t }] : []; },
    // What the layout kept clear, in words.
    constraints(lay, st) {
      const k = lay.skipped, bits = [`slope over ${st.slope} %: ${n0(k.slope)}`, `watercourses (${st.water} m setback): ${n0(k.water)}`];
      bits.push(!st.avoidOhl ? 'overhead line zones: not avoided (avoid pylons on)' : ohlSeen ? `overhead line zones: ${n0(k.ohl || 0)}`
        : 'overhead line zones: none drawn here (show pylons to load them)');
      if (k.hollow) bits.push(`hollows: ${n0(k.hollow)}`);
      const out = [`Kept clear (${world.plant.result()?.table?.tracker ? 'tracker rows' : 'table positions'}): ${bits.join(' · ')}.`];
      const wn = lay.notes.find(x => /No mapped water/.test(x));
      if (wn) out.push(wn);
      out.push(...lay.notes.filter(x => /tracker rows left out|row gaps stretched/.test(x)));
      if (lay.crossReview) out.push(`${n0(lay.crossReview)} tracker rows kept at 7 to 10 % across the row: for the tracker maker's review (flagged on the HUD).`);
      const r = world.plant.result(), c = r ? r.frame.en(r.compound.u, r.compound.v) : null;
      if (c) out.push(soilLine(c));
      return out;
    },
    async block({ stations, pocKv, at, trench, frame = false, modulesPerString, tempMinC }) {
      const pos = at || (() => { const h = here(); return { e: h.e - 16, n: h.n + 12 }; })();
      const c = await world.block.place({ stations, pocKv, at: pos, trench, modulesPerString, tempMinC });
      if (!c) throw Error(status('block-status') || 'the block was not placed');
      const f = frame ? world.block.bounds?.() : null;
      if (f) world.flyTo(f.e, f.n, { height: f.height });      // frame the new block so the X-ray has something in view
      return { at: pos, text: `Block: ${c.stations} station${c.stations > 1 ? 's' : ''} on ${c.rings} ring${c.rings > 1 ? 's' : ''}, ${n0(c.tables)} tables, `
        + `${n0(c.inverters)} inverters, ${n0(c.blockKwp)} kWp per station block, ${c.pocKv} kV connection.` };
    },
    clearBlock() { world.block.clear?.(); },
    // string N / temp min T: the solar block is rebuilt with the new string length (or its check redone for the new cold);
    // the reply says the cold string voltage and its headroom in the block's own module class. Null when no block is placed.
    async strings({ mps, tempMinC }) {
      if (!world.block?.strings || !world.block.built?.()) return null;
      const d = await world.block.strings({ modulesPerString: mps ?? undefined, tempMinC });
      if (!d) return null;
      return `Solar block: ${d.mps} modules in series, ${n0(d.stringV)} V cold (the stricter of ${d.tempMinC} °C and Voc × 1.15: ${d.rule}; highest bin) `
        + `against ${d.systemV} V: `
        + (d.ok ? `${Math.floor(d.headroomV)} V headroom${d.borderline ? ' (borderline)' : ''}` : `OVER by ${Math.ceil(-d.headroomV)} V; at most ${d.most} in series`)
        + '. Illustrative — early design, no warranty; confirm with a qualified engineer.';
    },
    trenchRows: () => world.block.trenchRows?.() ?? null,
    async xray(on) { if (!api.xray) throw Error('the X-ray is still loading; try again in a moment'); return api.xray.set(on); },
    async piles(lay) {
      if (typeof world.piles?.auto !== 'function') return 'Piles: automatic piling is not in this build; nothing placed.';
      const r = await world.piles.auto();
      return pilesText(r, lay);
    },
    async show({ layer, on, limit }) {
      const id = LAYER[layer];
      world.setLayer(id, on);
      if (layer === 'slope' && Number.isFinite(limit)) api.live().find(l => l.id === 'slope')?.layer?.setLimit?.(limit);
      if (!on) return `${layer} hidden.`;
      if (layer === 'soil') { const h = here(); return `Ground layer shown. ${await soilAt(h.e, h.n)}`; }
      if (layer === 'slope') return `Slope shown${Number.isFinite(limit) ? ` where it is over ${limit} %` : ''} (hachures point downhill).`;
      if (layer === 'pylons') return 'Grid shown, with the overhead line zones (HSE GS6; tower heights and sag assumed).';
      return 'Watercourses shown (OS Open Rivers).';
    },
    // follow [next|back|play|pause|close]: world.sld.follow() from a module of the solar block (placed first if need be) to the grid landing.
    async follow({ step }) {
      if (!world.sld) throw Error('Follow is not in this build');
      const f = step ? await world.sld[step]() : await world.sld.follow();
      if (step === 'close') return 'Follow closed.';
      if (!f) return 'Follow: nothing to follow yet: type follow to start from the first module.';
      return `Follow the power from module ${f.panel}: stop ${f.stop + 1} of ${f.stops}, ${f.title}; cable drop so far ${fmtPct(f.cumDropPct)}`
        + ` (DC ${fmtPct(f.dcDropPct)} + AC ${fmtPct(f.acDropPct)}); ${fmtPct(f.totalDropPct)} by the end of the path;`
        + ` it ends at ${ENDS[f.ends] || 'the grid landing'}.${step ? '' : ' Type follow next, follow play or follow close.'}`;
    },
    async sld({ on }) {
      if (!world.sld) throw Error('the single-line diagram is not in this build');
      if (!on) { await world.sld.hide(); return 'Single-line diagram hidden.'; }
      await world.sld.show();
      const s = await world.sld.summary();
      return s ? `Single-line diagram: ${s.stations} stations, ${s.inverters} inverters, ${s.feeders} feeders, ${s.gridTransformers} grid transformer${s.gridTransformers === 1 ? '' : 's'};`
        + ` landing: ${s.ruleText || s.rule || 'by rule'}${s.ok ? '' : ' (check failed: see the diagram)'}.` : 'Single-line diagram shown.';
    },
    // go <place>: the words go to Find, which lists the matches; choosing one flies there.
    async find({ place }) {
      const t = doc.getElementById('find-toggle');
      if (t && t.getAttribute('aria-expanded') !== 'true') t.click();
      const q = doc.querySelector('#find input[type="search"]');
      if (!q) throw Error('Find is not open here');
      q.value = place; q.dispatchEvent(new Event('input', { bubbles: true }));
      return `Find: looking up "${place}". Choose a match in the Find panel to fly there.`;
    },
    // earthing / earth / soil rho / bonding: the earthing cartridge (earth-mount.mjs), loaded the first time one is typed.
    async earthing(arg) {
      earth ||= import('./earth-mount.mjs').then(m => m.mountEarth({ api, world, doc })).catch(e => { earth = null; throw e; });
      return (await earth).command(arg);
    },
    // hud on|off|rules: the check HUD (hud-ui.mjs); rules opens the file picker for a private rules file on this machine.
    async hud({ on, rules }) {
      const h = globalThis.worldHud;
      if (!h) throw Error('the check HUD is not loaded yet');
      if (rules) { h.pickRules(); return 'Choose a private rules file on this machine; it is read here and never sent anywhere.'; }
      h.set(on);
      const n = h.lines().length;
      return on ? `Check HUD on: ${n} failed check${n === 1 ? '' : 's'} shown${n ? '' : ' (place the solar block to check it)'}.` : 'Check HUD off.';
    },
    async go(arg, lay) {
      if (Number.isFinite(arg.e)) { world.flyTo(arg.e, arg.n, { height: 120 }); return `Flying to E ${n0(arg.e)} N ${n0(arg.n)}.`; }
      const r = world.plant.result(), f = world.block?.bounds?.();
      // go block: the placed solar block (also go block N when no plant is laid out), framed whole.
      if (!arg.compound && (arg.block == null || !r) && f) {
        world.flyTo(f.e, f.n, { height: f.height });
        return `Flying to the solar block: ${n0(f.w)} m × ${n0(f.h)} m, seen from ${n0(f.height)} m up. Type xray on to see the trenches.`;
      }
      if (arg.block === null) throw Error('no solar block placed yet: type block 10mva first');
      if (!r) throw Error('no plant laid out yet: type plant 50mw first, or block 10mva for a solar block');
      const T = r.table, en = (u, v) => r.frame.en(u, v);
      if (arg.compound) { const [e, n] = en(r.compound.u, r.compound.v); world.flyTo(e, n, { height: 120 }); return `Flying to the compound, E ${n0(e)} N ${n0(n)}.`; }
      const k = arg.block - 1, st = r.stations[k];
      if (!st) throw Error(`there are ${r.stations.length} blocks; you typed block ${arg.block}`);
      if (!arg.table) { const [e, n] = en(st.u, st.v); world.flyTo(e, n, { height: 90 }); return `Flying to block ${arg.block} (${st.id}, ${st.mva} MVA, ${st.tables} tables).`; }
      if (!(arg.table >= 1 && arg.table <= st.tables)) throw Error(`block ${arg.block} has tables 1 to ${st.tables}; you typed ${arg.table}`);
      const q = (r.stations.slice(0, k).reduce((s, x) => s + x.tables, 0) + arg.table - 1) * 6;
      const [e, n] = en(r.tables[q] + T.lenU / 2, r.tables[q + 1] + T.depth / 2);
      world.flyTo(e, n, { height: 35 });
      return `Flying to block ${arg.block} table ${arg.table} of ${st.tables}, E ${n0(e)} N ${n0(n)}${lay ? '' : ''}.`;
    }
  };
  function soilLine([e, n]) {
    if (!soil) return 'Soil type from BGS 1:625k: still loading; type show soil to read it.';
    return soil.none ? soilEffect(null) : soilEffect(groundAt(soil, e, n));
  }
}

// The reply to "piles auto": world.piles.auto() gives { plant, block } pile summaries (plant-piles.mjs, block-build.mjs).
export function pilesText(r, lay) {
  const p = r?.plant, b = r?.block;
  if (!p && !b) return lay ? 'Piles: no tables to pile yet.' : 'Piles: no plant laid out yet: type plant 50mw first.';
  const out = [];
  if (p) {
    const flags = (p.revealHigh || 0) + (p.revealLow || 0), warn = (p.revealWarn || 0) + (p.revealFail || 0);
    const how = p.system === 'tracker' ? ' along the tracker tubes' : p.posts === 1 ? ', one post per table' : ', front and rear posts';
    out.push(`Piles placed automatically: ${n0(p.piles)} (${n0(p.perMWp)} per MWp)${how}`
      + `, ${n0(p.totalPileLengthM)} m of pile; ${n0(p.proofTests)} proof tests.`);
    const bits = [];
    if (flags) bits.push(`${n0(flags)} outside the reveal band`);
    if (warn) bits.push(`${n0(warn)} standing high above their design height`);
    if (p.gradingTables) bits.push(`${n0(p.gradingTables)} tables need grading`);
    if (p.cannotFollow) bits.push(`${n0(p.cannotFollow)} tracker rows cannot follow the ground`);
    out.push(bits.length ? `Flagged: ${bits.join(' · ')} (see the Plant readout).` : 'No piles flagged.');
  }
  if (b && Number.isFinite(b.count ?? b.piles)) out.push(`Solar block: ${n0(b.count ?? b.piles)} piles.`);
  return out.join(' ');
}
