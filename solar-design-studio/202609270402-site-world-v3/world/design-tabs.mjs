// design-tabs.mjs: the Design panel's four sections as tabs, so a phone shows one short panel at a time.
//   Build    trench, cable, road, pad, piles, fence, drilled crossing (and their options, route to substation, phases)
//   Measure  drum schedule, bill of quantities, level profile
//   Plant    plant layout, solar block, specification and ground condition, the ground under a route
//   Share    save, open, share, print (the File row), tour
// Markup in world.html (#design [role=tab] / [role=tabpanel]). A tab's own modules load the first time it opens
// (onFirstOpen), never before. Arrow keys move between tabs, as the ARIA tabs pattern asks. No other imports.

export const TABS = Object.freeze(['build', 'measure', 'plant', 'share']);

// doc: the page. onFirstOpen: { [tab]: () => void } run once, the first time that tab is shown.
export function mountDesignTabs(doc, { onFirstOpen = {}, onChange = () => {} } = {}) {
  const tabs = [...doc.querySelectorAll('#design [role="tab"][data-tab]')];
  if (!tabs.length) return { show: () => false, current: () => null };
  const opened = new Set();
  let current = tabs.find(t => t.getAttribute('aria-selected') === 'true')?.dataset.tab || TABS[0];
  function show(name, { focus = false } = {}) {
    const tab = tabs.find(t => t.dataset.tab === name);
    if (!tab) return false;
    for (const t of tabs) {
      const on = t === tab, panel = doc.getElementById(t.getAttribute('aria-controls'));
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
    const changed = current !== name;
    current = name;
    if (!opened.has(name)) { opened.add(name); try { onFirstOpen[name]?.(); } catch (e) { console.warn(`Design ${name}: ${e.message}`); } }
    if (changed) onChange(name);
    return true;
  }
  for (const t of tabs) {
    t.addEventListener('click', () => show(t.dataset.tab));
    t.addEventListener('keydown', e => {
      const i = tabs.indexOf(t), step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); show(tabs[e.key === 'Home' ? 0 : tabs.length - 1].dataset.tab, { focus: true }); }
      else if (step) { e.preventDefault(); show(tabs[(i + step + tabs.length) % tabs.length].dataset.tab, { focus: true }); }
    });
  }
  show(current);
  return { show, current: () => current };
}
