// cmd-mount.mjs: the command line's only part that loads with the world (just after the first frame): a "Type a command"
// button in the Design panel and the "/" key. The bar and its engines (cmd-ui.mjs and what it imports) load the first time either is used,
// or when a design with a typed script is opened: the script is the design, so opening it replays it.
// Saved designs carry the script as one item: { id: 'script-1', kind: 'script', params: { lines: [...] }, points_bng: [] }.

// The typed lines that rebuild what the forms made: the plant (its boundary, limits and capacity) and the solar block.
const LAYOUT_WORD = { south: 'south', 'east-west': 'eastwest', tracker: 'tracker' };
export function formLines(world) {
  const out = [], r = world.plant?.result?.(), b = world.plant?.boundary?.(), s = world.block?.state?.();
  if (r && b?.length >= 3) {
    out.push('boundary ' + b.map(([e, n]) => `${Math.round(e)} ${Math.round(n)}`).join(', '));
    const P = r.params || {};
    if (Number.isFinite(P.slopeLimitPct)) out.push(`avoid slope ${P.slopeLimitPct}%`);
    if (Number.isFinite(P.fenceSetbackM)) out.push(`setback fence ${P.fenceSetbackM}`);
    out.push(`fill ${r.asked.mw}mw ${LAYOUT_WORD[r.layout] || 'south'}`);
  }
  if (s?.placed && s.anchor && s.params) out.push(`block ${s.params.stations * 10}mva poc ${s.params.pocKv} at ${Math.round(s.anchor[0])} ${Math.round(s.anchor[1])}`);
  return out;
}
const typing = t => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t?.isContentEditable;

// deps: { api (substrate extension api, with hooks.items and hooks.open), world (window.world), project (project-ui), ohl }
export function mountCommandLine({ api, world, project = null, ohl = null, doc = document }) {
  let ui = null, loading = null, kept = null;
  const button = doc.createElement('button');
  button.type = 'button'; button.id = 'cmd-toggle'; button.textContent = 'Type a command';
  button.title = 'Command line: type a design command (press / on a keyboard)';
  button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', 'cmd');
  // In the Design panel, not the dash (the dash keeps its five views; "/" opens the bar on a keyboard).
  const design = doc.getElementById('design');
  if (design) { const row = doc.createElement('div'); row.className = 'row'; row.append(button); design.prepend(row); }
  const changed = () => api.hooks.design.forEach(f => f()); // the design file (and the copy kept in this browser) takes the new script
  const load = () => (loading ||= import('./cmd-ui.mjs')
    .then(m => m.createCommandLine({ api, world, ohl, doc, onChange: changed, toggle: button }))
    .then(u => (ui = u))
    .catch(e => { loading = null; console.warn('command line: ' + e.message); throw e; }));
  button.addEventListener('click', () => load().then(u => u.toggle()).catch(() => {}));
  doc.addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    e.preventDefault();
    load().then(u => u.open()).catch(() => {});
  });
  api.hooks.items?.add(() => {
    // Nothing typed: the plant and block made with the forms are saved as the lines that rebuild them (piles follow).
    const typed = ui ? ui.script() : kept, lines = typed && typed.length ? typed : formLines(world);
    return lines && lines.length ? [{ id: 'script-1', kind: 'script', params: { lines: lines.slice() }, points_bng: [] }] : [];
  });
  const opened = d => {
    const it = (d?.items || []).find(i => i.kind === 'script' && Array.isArray(i.params?.lines));
    if (!it) return;
    kept = it.params.lines.filter(s => typeof s === 'string').slice(0, 500);
    load().then(u => u.replay(kept)).catch(() => {});
  };
  api.hooks.open?.add(opened);
  // The As-built X-ray switch (xray-ui.mjs) sits in the Layers panel; the command line types it too (xray on).
  import('./xray-ui.mjs').then(m => { api.xray = m.mountXray({ api, world, doc }); }).catch(e => console.warn('x-ray: ' + e.message));
  if (project?.opened?.()) opened(project.opened());
  return { load, ui: () => ui, xray: () => api.xray?.debug() ?? null, batches: () => api.batches().map(b => `${b.key}@${b.version}`) }; // batches: what the last frame drew (tests)
}
