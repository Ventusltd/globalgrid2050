// Wires the plan inset (plan-inset.mjs) to the world: it is redrawn after each drawn frame, and only when
// what it shows has changed. Layers may offer plan() -> { boundary?, tiles?, items? } in local metres.
// Tools that are not layers add items with setItems(key, items), points in national-grid metres [[e, n], ...],
// so they survive every move of the origin. The finished design (trenches and cables) is shown too.
// A tap on the plan flies there with the substrate's own flyTo.
import { createPlanInset } from './plan-inset.mjs';
import { toLocal } from './origin.mjs';

export function mountPlan(api, doc = document) {
  const extra = new Map(); // key -> items in national-grid metres
  const inset = createPlanInset(doc, { onFly: (x, y) => api.flyTo(x, y) });
  let cacheKey = '', cached = [], designVersion = 0;
  api.hooks.design.add(() => { designVersion++; });
  const local = (o, it) => ({ kind: it.kind, closed: !!it.closed, points: it.points.map(([e, n]) => toLocal(o, e, n)) });
  function drawn() {
    const o = api.origin(), key = `${o.id}:${designVersion}:${extra.size}`;
    if (key !== cacheKey) {
      const d = api.design(), line = kind => t => ({ kind, points: t.path.map(p => [p.e, p.n]) });
      const bng = [...d.trenches.map(line('trench')), ...d.cables.map(line('cable')), ...[...extra.values()].flat()];
      cached = bng.map(it => local(o, it));
      cacheKey = key;
    }
    return cached;
  }
  function update() {
    const parts = api.live().map(l => (typeof l.layer.plan === 'function' ? api.guarded(l, () => l.layer.plan(), null) : null))
      .filter(Boolean);
    const s = api.state();
    inset.set({
      viewer: { x: s.pos[0], y: s.pos[1], yaw: s.yaw },
      boundary: parts.find(p => Array.isArray(p.boundary) && p.boundary.length > 2)?.boundary || null,
      tiles: parts.flatMap(p => p.tiles || []),
      items: [...parts.flatMap(p => p.items || []), ...drawn()]
    });
  }
  api.hooks.after.add(update);
  return Object.freeze({
    collapsed: () => inset.collapsed(), setCollapsed: on => inset.setCollapsed(on), redraws: () => inset.redraws(),
    // items: [{ kind, closed?, points: [[e, n], ...] }] in national-grid metres; an empty list removes the key.
    setItems(key, items) {
      if (items && items.length) extra.set(key, items); else extra.delete(key);
      designVersion++; update();
    }
  });
}
