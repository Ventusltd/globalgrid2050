// Extensions mounted after the first frame, each in its own chunk: a failure in one is a console line, never a broken page.
// buggy-mount.mjs (E, a chip, "buggy on"), hud-ui.mjs (failed checks), senses-mount.mjs (jump, binoculars),
// table-solids.mjs (the plant's tables as solids: land on them when jumping), packs-mount.mjs (layer packs, world.pack.v1).
// Each mount sets its window.* handle for tests and the console, as the substrate did before this file.
const ONE = (path, name, handle, mount) => import(path).then(m => mount(m)).then(v => { window[handle] = v; }).catch(e => console.warn(`${name}: ${e.message}`));

/** mountExtensions({ api }): starts every extension's load; returns the promises (tests may wait on them). */
export function mountExtensions({ api }) {
  return [
    ONE('./buggy-mount.mjs', 'buggy', 'worldBuggy', m => m.mountBuggy({ api })),
    ONE('./hud-ui.mjs', 'check HUD', 'worldHud', m => m.mountHud({ api, world: window.world })),
    ONE('./senses-mount.mjs', 'jump, binoculars', 'worldSenses', m => m.mountSenses({ api, world: window.world })),
    ONE('./table-solids.mjs', 'table solids', 'worldTableSolids', m => m.mountTableSolids({ api, plant: window.world.plant })),
    ONE('./packs-mount.mjs', 'packs', 'worldPacks', m => m.mountPacks({ api })),
  ];
}
