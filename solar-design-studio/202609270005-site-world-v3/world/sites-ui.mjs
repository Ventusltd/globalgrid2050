// Site selector for the world viewer. Reads web/world/data/sites.json (written by tools/stage-sites.mjs):
//   { schema: 'world.sites.v1', sites: [ { name, centre_e, centre_n, relief_m, tiles, sha256, ... } ] }
// Pure logic (parseSites, siteLabel, createSiteChooser) plus one small DOM helper (mountSiteSelect) that
// takes the document as an argument, so everything runs under node:test without a browser.
// Site names are neutral ids (letters, digits, - and _); anything else is dropped, never shown.

export const SCHEMA = 'world.sites.v1';
const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const HEX64 = /^[0-9a-f]{64}$/i;
const SAFE_PATH = p => typeof p === 'string' && /^[\w./-]+\.json$/.test(p) && !p.includes('..') && !p.startsWith('/');

// Validates a sites.json object. Returns { sites, rejected } with sites sorted by name; bad entries are
// listed in rejected with the reason, never passed on.
export function parseSites(json) {
  const rejected = [];
  if (!json || json.schema !== SCHEMA || !Array.isArray(json.sites)) return { sites: [], rejected: [{ name: null, why: 'not a world.sites.v1 file' }] };
  const seen = new Set(), sites = [];
  for (const s of json.sites) {
    const name = s?.name;
    const why = !NAME.test(name ?? '') ? 'name is not a neutral id'
      : seen.has(name) ? 'duplicate name'
      : !Number.isFinite(s.centre_e) || !Number.isFinite(s.centre_n) ? 'no centre'
      : !SAFE_PATH(s.tiles) ? 'unsafe tiles path'
      : !HEX64.test(s.sha256 ?? '') ? 'no valid sha256'
      : null;
    if (why) { rejected.push({ name: typeof name === 'string' ? name : null, why }); continue; }
    seen.add(name);
    sites.push(Object.freeze({
      name, centre_e: s.centre_e, centre_n: s.centre_n,
      relief_m: Number.isFinite(s.relief_m) ? s.relief_m : null,
      tiles: s.tiles, sha256: s.sha256.toLowerCase(),
      tile_count: Number.isInteger(s.tile_count) ? s.tile_count : null
    }));
  }
  sites.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  return { sites, rejected };
}

// "open-land-01" -> "Open land 01"; the relief is added when known: "Open land 01 (40 m relief)".
export function siteLabel(site, { relief = true } = {}) {
  const words = site.name.replace(/[-_]+/g, ' ').trim();
  const base = words.charAt(0).toUpperCase() + words.slice(1);
  return relief && Number.isFinite(site.relief_m) ? `${base} (${Math.round(site.relief_m)} m relief)` : base;
}

// Selection state. choose(name) calls onChoose(site) only for a known site that is not already current;
// it returns the chosen site, or null when nothing changed.
export function createSiteChooser(sites, { current = null, onChoose = () => {} } = {}) {
  const byName = new Map(sites.map(s => [s.name, s]));
  let cur = byName.has(current) ? current : null;
  return {
    get current() { return cur ? byName.get(cur) : null; },
    options: () => sites.map(s => ({ value: s.name, label: siteLabel(s), selected: s.name === cur })),
    choose(name) {
      const site = byName.get(name);
      if (!site || name === cur) return null;
      cur = name;
      onChoose(site);
      return site;
    }
  };
}

// Builds <label class="site-select">Site <select>...</select></label> into parent and wires it to the chooser.
// With no current site a disabled "Choose a site" placeholder is shown first. Returns the <select>.
export function mountSiteSelect(doc, parent, chooser) {
  const label = doc.createElement('label');
  label.className = 'site-select';
  label.appendChild(doc.createTextNode('Site '));
  const select = doc.createElement('select');
  select.setAttribute('aria-label', 'Site');
  const opts = chooser.options();
  if (!opts.some(o => o.selected)) {
    const ph = doc.createElement('option');
    ph.value = ''; ph.textContent = opts.length ? 'Choose a site' : 'No sites staged';
    ph.disabled = true; ph.selected = true;
    select.appendChild(ph);
  }
  for (const o of opts) {
    const el = doc.createElement('option');
    el.value = o.value; el.textContent = o.label; el.selected = o.selected;
    select.appendChild(el);
  }
  select.disabled = opts.length === 0;
  select.addEventListener('change', () => chooser.choose(select.value));
  label.appendChild(select);
  parent.appendChild(label);
  return select;
}
