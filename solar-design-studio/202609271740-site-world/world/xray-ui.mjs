// xray-ui.mjs: the As-built X-ray switch, in the Layers panel and typed ("xray on", "xray off"). It is small and loads just
// after the first frame (cmd-mount.mjs); the drawing (xray.mjs) and the section catalogue load the first time it is
// switched on. While on, every frame goes through xrayFilter (substrate hooks.filter): the ground drawn faint, the
// buried works bright. Nothing asks for frames on its own: a still view stays at 0 fps.
//
// What it draws: the solar block's trenches as sized by rating (world.block.works()) and every trench drawn in Design.

const $el = (doc, tag, props = {}) => Object.assign(doc.createElement(tag), props);

// deps: { api (substrate extension api: hooks.filter, heightAt, origin(), state(), design(), gate), world (window.world) }
export function mountXray({ api, world, doc = document, host = doc.getElementById('layers-slot') }) {
  let on = false, mod = null, sections = null, cache = { key: '', batches: [], text: '' };
  const box = $el(doc, 'fieldset', { className: 'sun-time xray-box' });
  box.append($el(doc, 'legend', { textContent: 'As built' }));
  const btn = $el(doc, 'button', { type: 'button', id: 'xray-toggle', textContent: 'X-ray: buried trenches, ducts and cables',
    title: 'See through the ground: trenches, ducts, cables, draw pits and joint bays after backfill (type xray on)' });
  btn.setAttribute('aria-pressed', 'false');
  const note = $el(doc, 'p', { className: 'note' }); note.setAttribute('aria-live', 'polite');
  box.append(btn, note);
  host?.appendChild(box);

  // The runs to draw, in local metres: the block's sized trenches and the Design trenches, with pits and joint bays.
  function works() {
    const o = api.origin(), L = p => [p.e - o.e, p.n - o.n], runs = [], pits = [], joints = [], drawn = api.design()?.trenches || [];
    const b = world.block?.works?.();
    if (b) {
      for (const t of b.items) runs.push({ path: t.path.map(L), section: t.section, cableOdMm: t.cableOdMm });
      for (const p of b.pits) pits.push({ at: L(p.at) });
      for (const j of b.joints) joints.push({ at: L(j.at), w: j.widthM });
    }
    for (const t of drawn) {
      const s = sections?.find(x => x.id === t.section);
      if (s && Array.isArray(t.path)) runs.push({ path: t.path.map(L), section: s, cableOdMm: null });
    }
    return { runs, pits, joints, totals: b?.totals ?? null, faults: b?.faults ?? [], key: `${o.id}:${b?.version ?? 'none'}:${drawn.length}` };
  }
  function extra(pos) {
    const w = works(), cell = `${Math.round(pos[0] / 200)},${Math.round(pos[1] / 200)}`, key = `${w.key}:${cell}`;
    if (key !== cache.key) {
      const base = [Math.round(pos[0] / 100) * 100, Math.round(pos[1] / 100) * 100, Math.round(api.heightAt(pos[0], pos[1]))];
      const lines = mod.buriedLines(w.runs, { groundAt: api.heightAt, eye: pos, pits: w.pits, joints: w.joints, base });
      cache = { key, batches: mod.xrayBatches(lines, { base, version: key }), text: mod.xraySummary(w.runs, w.pits, w.joints, w.totals), faults: w.faults };
      if (on) showNote();          // the note follows every re-size (split, soil, cover), not only xray on
    }
    return cache.batches;
  }
  function showNote() {
    note.replaceChildren(cache.text, ...(cache.faults || []).map(f => $el(doc, 'span', { className: 'fault', textContent: ` ${f}` })));
  }
  api.hooks.filter?.add((batches, ctx) => (on && mod ? mod.xrayFilter(batches, extra(ctx.pos)) : batches));

  async function set(v) {
    v = !!v;
    if (v && !mod) {
      mod = await import('./xray.mjs');
      try { sections = (await (await fetch(new URL('./world/data/trench-sections.json', location.href), { cache: 'no-cache' })).json()).sections; }
      catch { sections = []; }
    }
    on = v; cache.key = '';
    btn.setAttribute('aria-pressed', String(on));
    api.gate.invalidate();
    if (!on) { note.textContent = ''; return 'X-ray off: the ground is drawn as before.'; }
    extra(api.state().pos);
    showNote();
    const faults = (cache.faults || []).map(f => `\n${f}`).join('');
    return `${cache.text} Illustrative — early design, no warranty; confirm with a qualified engineer. Not an as-built survey.${faults}`;
  }
  btn.addEventListener('click', () => { set(!on).catch(e => { note.textContent = 'X-ray: ' + e.message; }); });
  return { set, on: () => on, debug: () => ({ on, key: cache.key, batches: cache.batches.map(b => ({ key: b.key, vertices: b.positions.length / 3 })) }) };
}
