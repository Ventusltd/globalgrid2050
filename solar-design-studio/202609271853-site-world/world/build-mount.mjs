// build-mount.mjs: the only part of build mode that loads with the world (just after the first frame, from cmd-mount.mjs).
// It adds a Place row (Table, Inverter) to Design > Build, answers "build ..." lines in the command line, saves what was
// built in the design file as its typed lines ({ kind: 'build', params: { lines } }) and replays them on open, and reads
// ?build=1 (with lat/lon or e/n, the link GridAtlas can send) to fly there and start placing. Everything else
// (build-ui.mjs and the rules, geometry and piles it imports) loads the first time any of these is used.

import { parseWorldUrl } from './links.mjs';

// deps: { api (substrate extension api), world (window.world), ohl, doc }
export function mountBuild({ api, world, ohl = null, doc = document, loc = globalThis.location }) {
  let ui = null, loading = null, kept = null;
  const tab = doc.getElementById('design-tab-build'), row = doc.createElement('div');
  row.className = 'row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Place');
  row.innerHTML = '<button type="button" data-place="table" aria-pressed="false" title="Place a solar table on the grid over the ground">Place table</button>'
    + '<button type="button" data-place="inverter" aria-pressed="false" title="Place a string inverter; strings wire themselves">Place inverter</button>';
  tab?.prepend(row);
  const load = () => (loading ||= import('./build-ui.mjs')
    .then(m => (ui = m.createBuild({ api, world, ohl, doc, row })))
    .catch(e => { loading = null; console.warn('build mode: ' + e.message); throw e; }));
  for (const b of row.querySelectorAll('[data-place]')) {
    b.addEventListener('click', () => load().then(u => u.setTool(b.getAttribute('aria-pressed') === 'true' ? null : b.dataset.place)).catch(() => {}));
  }
  // A Design drawing tool chosen puts Place down (one tool at a time).
  for (const b of doc.querySelectorAll('#design [data-tool]')) b.addEventListener('click', () => { if (ui && b.getAttribute('aria-pressed') === 'true') ui.setTool(null); });

  // The command line asks this first: "build ..." lines, and "piles auto" once something is built.
  (api.hooks.commands ||= new Set()).add(async line => {
    const s = String(line).trim().toLowerCase();
    if (/^(build|place)\b/.test(s)) return (await load()).exec(line);
    if (/^piles?\s+auto\b/.test(s) && ui && ui.script().some(l => / at /.test(l))) return ui.pilesAuto();
    return null;
  });
  api.hooks.items?.add(() => {
    const lines = ui ? ui.script() : kept;
    return lines && lines.length ? [{ id: 'build-1', kind: 'build', params: { lines: lines.slice() }, points_bng: [] }] : [];
  });
  api.hooks.open?.add(d => {
    const it = (d?.items || []).find(i => i.kind === 'build' && Array.isArray(i.params?.lines));
    kept = it ? it.params.lines.filter(s => typeof s === 'string').slice(0, 5000) : null;
    if (kept || ui) load().then(u => u.replay(kept || [])).catch(() => {});
  });
  // ?build=1: the door from the national map. Fly to the place the link names (if any), open Design, start placing tables.
  const q = new URLSearchParams(loc?.search || '');
  if (q.has('build')) {
    const at = parseWorldUrl(q);
    if (at) world.flyTo?.(at.e, at.n, { pitch: -60 * Math.PI / 180, back: 60 });
    const dt = doc.getElementById('design-toggle');
    if (dt && dt.getAttribute('aria-expanded') !== 'true') dt.click();
    load().then(u => u.setTool('table')).catch(() => {});
  }
  return { load, ui: () => ui, row };
}
