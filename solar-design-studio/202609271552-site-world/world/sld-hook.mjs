// sld-hook.mjs: the thin, typed hook for the single-line diagram: world.sld.show(), world.sld.station(id),
// world.sld.follow(panelId), next(), back(), play(), pause(), close(), state(), readout(nodeId), source(kA), rules({ cableM, ... }),
// network().
// Nothing heavy loads until the first call, the first press of Single-line diagram or Follow (Design > Plant), or the
// first tap on a module of a placed solar block; then sld-mount.mjs is imported once.

// deps: { api (substrate), design (its blockApi and plantApi), doc }
export function sldHook({ api, design, doc = document }) {
  let mounted = null;
  const load = () => (mounted ||= import('./sld-mount.mjs').then(m => m.mountSld({ api, block: design.blockApi, plant: design.plantApi, doc })));
  const call = name => async (...a) => (await load())[name](...a);
  // Buttons in the Design panel (design-sections.mjs puts them in): Single-line diagram and Follow a module.
  doc.addEventListener('click', e => {
    const id = e.target?.closest?.('#block-sld, #plant-sld, #block-follow')?.id;
    if (!id) return;
    (id === 'block-follow' ? call('follow')() : call('show')()).catch(err => console.warn('single-line diagram: ' + err.message));
  });
  // A tap (not a drag) on the ground: when the solar block is placed and no design tool is in hand, a module starts Follow.
  let down = null;
  api.canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  api.canvas.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    if (!design.blockApi?.state?.()?.placed || api.design().tool) return;
    load().then(m => m.tap(e.clientX, e.clientY)).catch(() => {});
  });
  return Object.freeze(Object.fromEntries(['show', 'hide', 'station', 'follow', 'next', 'back', 'play', 'pause', 'close', 'state', 'readout', 'source', 'rules',
    'network', 'summary'].map(k => [k, call(k)])));
}
