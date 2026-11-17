const el = (doc, tag, text, className) => { const n = doc.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
export function mountLayerControls(root, {registry, renderers, initial = 'substations'}) {
  if (!root.id || !/^[A-Za-z][\w-]*$/.test(root.id)) throw Error('A unique named layer host is required');
  const doc = root.ownerDocument;
  root.classList.add('pn-layers'); root.replaceChildren();
  const top = el(doc, 'div', undefined, 'pn-groups'); top.setAttribute('role', 'tablist'); top.setAttribute('aria-label', 'Intelligence categories');
  const sub = el(doc, 'div', undefined, 'pn-subtabs'); sub.setAttribute('role', 'tablist'); sub.setAttribute('aria-label', 'Grid views');
  const panel = el(doc, 'div', undefined, 'pn-panel'); panel.id = root.id + '-panel'; panel.setAttribute('role', 'tabpanel');
  root.append(top, sub, panel);
  const groups = [...new Set(registry.layers.map(x => x.group))];
  const buttons = new Map(); let epoch = 0; let active = null; let cleanup = () => {}; let disposed = false;
  const groupButtons = new Map();
  function tab(button, chosen) { button.setAttribute('aria-selected', String(chosen)); button.tabIndex = chosen ? 0 : -1; }
  function keyboard(container) {
    container.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']; if (!keys.includes(event.key)) return;
      const list = [...container.querySelectorAll('[role="tab"]')].filter(b => !b.hidden);
      if (!list.length) return;
      const i = list.indexOf(doc.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length-1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      event.preventDefault(); list[next].focus(); list[next].click();
    });
  }
  async function activate(id) {
    if (disposed) return;
    const layer = registry.layers.find(x => x.id === id); if (!layer) throw Error('Unknown layer');
    const turn = ++epoch; active = id; cleanup(); cleanup = () => {};
    panel.replaceChildren(el(doc, 'p', 'Loading…')); panel.dataset.state = 'loading';
    for (const [group, button] of groupButtons) tab(button, group === layer.group);
    for (const [key, button] of buttons) { button.hidden = registry.layers.find(x => x.id === key).group !== layer.group; tab(button, key === id); }
    sub.hidden = registry.layers.filter(x => x.group === layer.group).length < 2;
    panel.setAttribute('aria-labelledby', sub.hidden ? groupButtons.get(layer.group).id : buttons.get(id).id);
    const stage = el(doc, 'div');
    try {
      const renderer = Object.hasOwn(renderers, layer.renderer) ? renderers[layer.renderer] : null;
      if (typeof renderer !== 'function') throw Error('Renderer unavailable');
      const data = await registry.load(id);
      if (turn !== epoch || disposed) return;
      const destroy = await renderer(stage, {data, layer});
      if (turn !== epoch || disposed) { if (typeof destroy === 'function') destroy(); return; }
      cleanup = typeof destroy === 'function' ? destroy : () => {};
      panel.replaceChildren(stage); panel.dataset.state = 'available';
    } catch {
      if (turn !== epoch || disposed) return;
      panel.replaceChildren(el(doc, 'p', `${layer.label} unavailable. Other views remain usable.`)); panel.dataset.state = 'unavailable';
    }
  }
  for (const group of groups) {
    const button = el(doc, 'button', group); button.type = 'button'; button.id = root.id + '-group-' + group.toLowerCase().replace(/[^a-z0-9]/g, '-');
    button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id); button.addEventListener('click', () => { void activate(registry.layers.find(x => x.group === group).id); });
    groupButtons.set(group, button); top.append(button);
  }
  for (const layer of registry.layers) {
    const button = el(doc, 'button', layer.label); button.type = 'button'; button.id = root.id + '-view-' + layer.id;
    button.dataset.layerId = layer.id; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => { void activate(layer.id); }); buttons.set(layer.id, button); sub.append(button);
  }
  keyboard(top); keyboard(sub); void activate(initial);
  return {activate, get active() { return active; }, destroy() { disposed = true; ++epoch; cleanup(); registry.clear(); root.replaceChildren(); }};
}
