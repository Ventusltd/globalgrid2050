// Project tools, placed under the dash's essentials: the design file (Save, Open, Share, Print), Tour and
// Construction phases in the Design panel; Test sites in the Find panel.
// It wires existing cartridges to the world through the substrate's extension api; it draws nothing itself.
//   design-store.mjs   the design as a world.design.v1 document in national-grid metres; kept in this browser
//   tour.mjs           record a walk or flight, play it back, save it; Open reads tour files too
//   print.mjs          the plan sheet (A3 or A4) with the current view and the exact credit
//   phases*.mjs        the construction sequence of the drawn trenches and cables, as a step slider with order checks
//   sites-ui.mjs       the staged sites (data/sites.json, local only); choosing one reloads the page with ?site=<name>
import { SCHEMA, exportFile, importText, makeShareLink, readShareLink, autosave, loadAutosave } from './design-store.mjs';
import { createRecorder, exportTour, importTour, createPlayer, fileRefusal } from './tour.mjs';
import { buildSheet, captureView, openSheet } from './print.mjs';
import { createTimeline, validatePlan } from './phases.mjs';
import { itemsFromStore } from './phases-design.mjs';
import { createPhaseSlider } from './phases-slider.mjs';
import { parseSites, createSiteChooser, mountSiteSelect } from './sites-ui.mjs';

const SITES_URL = './world/data/sites.json';
const WORKS = ['road', 'pad', 'fence', 'piles', 'hdd']; // earthworks kinds (design-earthworks.mjs), kept with the design

export { siteFromUrl } from './sites-ui.mjs'; // kept here for callers of the old place

function save(doc, name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type })), a = doc.createElement('a');
  a.href = url; a.download = name; doc.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 30000);
}
const plain = o => JSON.parse(JSON.stringify(o)); // drops undefined, so params stay plain JSON

export function mountProject(api, doc = document) {
  const $ = id => doc.getElementById(id);
  const note = msg => { $('project-note').textContent = msg; };
  const s0 = api.site(), o0 = api.origin();
  const site = s0 ? { name: s0.name, origin_e: s0.centre_e, origin_n: s0.centre_n } : { name: 'untitled', origin_e: o0.e, origin_n: o0.n };
  let generation = 0;

  // ---- design file ------------------------------------------------------------------------------------
  const pts = path => path.map(p => [p.e, p.n]);
  function toDoc() {
    const d = api.design();
    const items = [
      ...d.trenches.map((t, i) => ({ id: `trench-${i + 1}`, kind: 'trench', params: plain({ section: t.section }), points_bng: pts(t.path) })),
      ...d.cables.map((c, i) => ({ id: `cable-${i + 1}`, kind: 'cable', params: plain({ section: c.section, cable: c.cable }), points_bng: pts(c.path) })),
      ...(d.works || []).map((w, i) => ({ id: `${w.kind}-${i + 1}`, kind: w.kind, params: plain({ option: w.option, ...(w.cable ? { cable: w.cable } : {}) }), points_bng: pts(w.path) }))
    ];
    return { schema: SCHEMA, generation, site: { ...site }, items };
  }
  // quiet: a design that only arrived (a shared link) is shown but not yet kept over the one in this browser.
  let quiet = false;
  function fromDoc(d, { keep = true } = {}) {
    const path = it => it.points_bng.map(([e, n]) => ({ e, n }));
    const of = kind => d.items.filter(i => i.kind === kind);
    generation = Math.max(generation, d.generation);
    const works = d.items.filter(i => WORKS.includes(i.kind)).map(i => ({ kind: i.kind, option: i.params?.option, ...(i.params?.cable ? { cable: i.params.cable } : {}), path: path(i) }));
    api.replaceDesign({
      trenches: of('trench').map(i => ({ path: path(i), section: i.params.section })),
      cables: of('cable').map(i => ({ path: path(i), section: i.params.section, cable: i.params.cable })),
      works
    });
    quiet = !keep;
    api.hooks.design.forEach(f => f());
    return of('trench').length + of('cable').length + works.length;
  }
  // The drone flies to a design that arrived from a link or a file, framing all its points (phone review 4).
  function flyToDesign(d) {
    const pts = d.items.flatMap(i => i.points_bng || []);
    if (!pts.length || typeof api.flyTo !== 'function') return;
    const es = pts.map(p => p[0]), ns = pts.map(p => p[1]);
    const e = (Math.min(...es) + Math.max(...es)) / 2, n = (Math.min(...ns) + Math.max(...ns)) / 2;
    const span = Math.max(Math.max(...es) - Math.min(...es), Math.max(...ns) - Math.min(...ns));
    const o = api.origin(), p = api.state().pos;
    if (Math.hypot(o.e + p[0] - e, o.n + p[1] - n) < 30 && span < 60) return; // already there
    api.flyTo(e - o.e, n - o.n, { height: Math.min(1500, Math.max(80, span * 1.2)) });
  }
  // Every change is kept in this browser, per site; a shared link or a file replaces it only when asked.
  api.hooks.design.add(() => {
    generation++;
    if (quiet) quiet = false; else { autosave(toDoc()); hideChoice(); }
    if (!$('design').hidden && $('phases-fold').open) refreshPhases();
  });
  // A shared link that arrives while a design is kept here: both stay; the viewer chooses which to show.
  const choice = doc.createElement('div');
  choice.className = 'row'; choice.id = 'share-choice'; choice.hidden = true;
  $('project-note').after(choice);
  function hideChoice() { choice.hidden = true; choice.replaceChildren(); }
  // The choice sits in the Design panel's Share tab (design-tabs.mjs): show that tab, whether or not the tabs are wired yet.
  function shareTab() {
    for (const t of doc.querySelectorAll('#design [role="tab"]')) {
      const on = t.dataset.tab === 'share', p = $(t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (p) p.hidden = !on;
    }
    $('design-tab-share-btn')?.click(); // once the tabs are wired, they keep their own record in step
  }
  function offerChoice(shared, mine) {
    const b = (id, label, fn) => { const e = doc.createElement('button'); e.type = 'button'; e.id = id; e.textContent = label; e.addEventListener('click', fn); return e; };
    choice.replaceChildren(
      b('share-open', 'Open shared design', () => {
        hideChoice();
        note(`Opened the shared design: ${fromDoc(shared, { keep: false })} items. Your own is kept until you change this one.`);
        flyToDesign(shared);
      }),
      b('share-keep', 'Keep mine', () => { hideChoice(); note(`Kept your design: ${fromDoc(mine, { keep: false })} items.`); }));
    choice.hidden = false;
    shareTab();
  }

  $('project-save').addEventListener('click', async () => {
    try { const f = await exportFile(toDoc()); save(doc, f.filename, f.text); note(`Saved ${f.filename}.`); }
    catch (e) { note('Could not save: ' + e.message); }
  });
  $('project-open').addEventListener('click', () => $('project-file').click());
  $('project-file').addEventListener('change', async () => {
    const file = $('project-file').files?.[0];
    $('project-file').value = '';
    if (!file) return;
    const refused = fileRefusal(file.size); // before reading: an over-size file is never loaded into memory
    if (refused) { note(`File refused: ${refused}.`); return; }
    const text = await file.text();
    if (text.includes('"world.tour.v1"')) {
      try { setTour(await importTour(text)); note(`Opened tour "${tour.name || file.name}". Press Play.`); }
      catch (e) { note('Tour refused: ' + e.message); }
      return;
    }
    const r = await importText(text);
    note(r.ok ? `Opened ${file.name}: ${fromDoc(r.doc)} items.` : 'File refused: ' + r.errors.join('; '));
    if (r.ok) flyToDesign(r.doc);
  });
  $('project-share').addEventListener('click', async () => {
    const r = await makeShareLink(toDoc());
    if (!r.ok) { note(r.errors.join('; ')); return; }
    const url = location.href.split('#')[0] + r.fragment, box = $('project-link');
    try { await navigator.clipboard.writeText(url); box.hidden = true; note(`Share link copied (${url.length} characters).`); }
    catch { box.value = url; box.hidden = false; box.select(); note('Copy the link above to share this design.'); }
  });

  // ---- print --------------------------------------------------------------------------------------------
  $('project-print').addEventListener('click', () => {
    const attribution = api.attribution();
    if (!attribution) { note('Print needs the data credits, which did not load.'); return; }
    const image = captureView(api.canvas, api.redraw); // redraw and read in the same task, or the copy is blank
    const s = api.state(), g = api.heightAt(s.pos[0], s.pos[1]);
    openSheet(paper => buildSheet({
      paper, batches: api.batches(), attribution, viewImage: image, fade: api.FADE_M,
      camera: { pos: s.pos, yaw: s.yaw, pitch: s.pitch, fov: api.FOV, label: api.VIEWS[s.view].label, eyeHeight: s.pos[2] - g,
        aspect: api.canvas.height / api.canvas.width },
      origin: api.origin(), site: { name: site.name }, generation: api.generation(), layerIds: api.live().map(l => l.id)
    }));
  });

  // ---- tour ---------------------------------------------------------------------------------------------
  let recorder = null, t0 = 0, tour = null, player = null;
  const caption = $('tour-caption');
  const press = (id, on, label) => { $(id).setAttribute('aria-pressed', String(on)); $(id).textContent = label; };
  function setTour(t) {
    player?.pause(); player = null; tour = t;
    $('tour-play').disabled = $('tour-save').disabled = false;
    press('tour-play', false, 'Play');
  }
  api.hooks.before.add(now => {
    if (recorder) recorder.sample((now - t0) / 1000, api.origin(), api.state());
    if (player?.playing) {
      // Any movement takes the camera back; the substrate's gate carries on at the walking rate (review A, 3).
      if (api.moving()) { player.pause(); press('tour-play', false, 'Play'); api.resumeGate?.(); }
      else player.frame(now);
    }
  });
  $('tour-record').addEventListener('click', () => {
    if (!recorder) {
      player?.pause();
      recorder = createRecorder({ kind: api.state().view === 'aerial' ? 'drone' : 'walk', name: `${site.name} tour` });
      t0 = performance.now(); recorder.sample(0, api.origin(), api.state());
      press('tour-record', true, 'Stop');
      note('Recording: walk or fly, then press Stop.');
      return;
    }
    recorder.sample((performance.now() - t0) / 1000, api.origin(), api.state());
    try { setTour(recorder.stop()); note(`Tour recorded: ${tour.keyframes.length} keyframes. Play it or save it.`); }
    catch (e) { note('Nothing kept: ' + e.message + '. Move while recording.'); }
    recorder = null;
    press('tour-record', false, 'Record');
  });
  $('tour-play').addEventListener('click', () => {
    if (!tour) return;
    if (player?.playing) { player.pause(); press('tour-play', false, 'Play'); return; }
    if (!player) {
      api.setView(tour.kind === 'drone' ? 'aerial' : 'standing');
      player = createPlayer(tour, {
        gate: api.gate, getOrigin: api.origin, apply: pose => api.setPose(pose),
        onCaption: text => { caption.textContent = text; caption.hidden = !text; },
        onEnd: () => press('tour-play', false, 'Play')
      });
    }
    player.play();
    press('tour-play', true, 'Pause');
  });
  $('tour-save').addEventListener('click', async () => {
    if (!tour) return;
    try { save(doc, `${site.name}-tour.json`, await exportTour(tour)); note('Tour saved.'); } catch (e) { note('Could not save the tour: ' + e.message); }
  });

  // ---- construction phases ------------------------------------------------------------------------------
  function refreshPhases() {
    const box = $('phases-box'), check = $('phases-check');
    box.replaceChildren();
    let items, v;
    try { items = itemsFromStore(toDoc()); if (items.length) { createPhaseSlider(box, createTimeline(items)); v = validatePlan(items); } }
    catch (e) { check.textContent = 'Construction phases not shown: ' + e.message; return; }
    if (!items.length) { check.textContent = 'Draw a trench or cable in Design to sequence its construction.'; return; }
    const skipped = v.warnings.filter(w => w.code === 'BAD_REF').map(w => w.message).join(' ');
    check.textContent = (v.ok ? `Order checks: no problems across ${items.length} items.`
      : `Order checks: ${v.errors.map(e => e.message).join(' ')}`) + (skipped ? ` Skipped: ${skipped}` : '');
  }
  $('phases-fold').addEventListener('toggle', () => { if ($('phases-fold').open) refreshPhases(); });

  // ---- site ---------------------------------------------------------------------------------------------
  (async () => {
    let sites = [];
    try { const r = await fetch(SITES_URL, { cache: 'no-cache' }); if (r.ok) sites = parseSites(await r.json()).sites; } catch { /* none staged */ }
    if (!sites.length) return; // the Site section stays hidden where no sites are staged
    const chooser = createSiteChooser(sites, {
      current: s0?.name ?? null,
      onChoose: s => { const u = new URL(location.href); u.searchParams.set('site', s.name); u.hash = ''; location.assign(u.href); }
    });
    const select = mountSiteSelect(doc, $('site-box'), chooser);
    $('site-section').hidden = false;
    // Find can fly far from the site: then no site is current and the picker works again (phone review 5).
    let away = false;
    api.hooks.after.add(() => {
      if (away || !chooser.current) return;
      const o = api.origin(), p = api.state().pos, c = chooser.current;
      if (Math.hypot(o.e + p[0] - c.centre_e, o.n + p[1] - c.centre_n) > 3000) { away = true; chooser.leave(); select.value = ''; }
    });
  })();

  // ---- start: a shared link never overwrites the copy kept in this browser without asking -----------------
  const ready = (async () => {
    const kept = await loadAutosave(site), mine = kept.ok && kept.doc.items.length ? kept.doc : null;
    if (/(^#|&)design=/.test(location.hash)) {
      const r = await readShareLink(location.hash);
      if (!r.ok) { note('Shared link refused: ' + r.errors.join('; ')); if (mine) fromDoc(mine, { keep: false }); return; }
      const same = mine && JSON.stringify(mine.items) === JSON.stringify(r.doc.items);
      if (!mine || same) { note(`Opened the shared design: ${fromDoc(r.doc)} items.`); flyToDesign(r.doc); return; }
      note(`This link carries a design (${r.doc.items.length} items); yours (${fromDoc(mine, { keep: false })} items) is shown and kept.`);
      offerChoice(r.doc, mine);
      return;
    }
    if (mine) note(`Restored the design kept in this browser: ${fromDoc(mine, { keep: false })} items.`);
  })();

  return Object.freeze({ ready, toDoc, tour: () => tour, playing: () => !!player?.playing, recording: () => !!recorder });
}
