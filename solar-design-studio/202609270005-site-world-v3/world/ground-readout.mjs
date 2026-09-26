// Ground readout: words for what the ground layer (layers/ground.mjs) finds under the walker and along a finished
// trench or cable route. Pure functions build the text; mountGroundReadout writes it into the page. Nothing here
// is measured on site: every route readout ends with the desktop-study line. Thermal values are shown only where
// the file carries a sourced record with its status (measured, modelled, scenario/assumed); a thermal value is
// never inferred from a soil or rock type, and where there is none the readout says so.

import { formatLength, formatNumber } from './measure-format.mjs';

export const DESKTOP = 'Desktop study only — not a substitute for ground investigation';
export const NO_THERMAL = 'no sourced value here; not inferred from soil or rock type';
const STATUSES = ['measured', 'modelled', 'scenario', 'assumed'];

const srcName = (sources, key) => {
  const s = sources?.[key];
  return (s && (s.title || s.name || s.id)) || '';
};
const joinNames = items => [...new Set(items.map(a => a.label))].join(' / ');

// "Under your feet: <superficial> over <bedrock>" and its source. u: layer.underfoot(e, n) or null.
export function underfootText(u) {
  if (!u) return '';
  const sup = u.superficial == null ? 'superficial deposits not in this file'
    : u.superficial.length ? joinNames(u.superficial) : 'no superficial deposit mapped at this scale';
  const bed = u.bedrock == null ? 'bedrock not in this file' : u.bedrock.length ? joinNames(u.bedrock) : 'bedrock not mapped here';
  const names = [...new Set([u.superficial?.length ? srcName(u.sources, 'superficial') : '', srcName(u.sources, 'bedrock')].filter(Boolean))];
  return `Under your feet: ${sup} over ${bed}${names.length ? ` · ${names.join('; ')}` : ''}`;
}

// A borehole log may be linked only over https and when its source allows it: allow_links: true, or scans marked
// link_only (free to view from BGS; linked, never copied), or, when the source says nothing, a BGS page.
export function mayLink(source, url) {
  if (typeof url !== 'string') return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || source?.allow_links === false) return false;
  return source?.allow_links === true || source?.scans?.link_only === true || /(^|\.)bgs\.ac\.uk$/i.test(u.hostname);
}

const lengths = list => list.map(c => `${c.label} ${formatLength(c.length, 0)}`).join(' · ');

// Thermal lines from sourced records only. Conductivity W/(m K); resistivity is its reciprocal, K m/W.
export function thermalText(records) {
  if (!records || !records.length) return NO_THERMAL;
  const out = [];
  for (const t of records) {
    const status = String(t.status || '').toLowerCase();
    if (!STATUSES.includes(status) || !t.source) continue; // no status or no source: not shown
    const k = Number(t.conductivity);
    if (!(k > 0) || t.conductivity_unit !== 'W/(m K)') continue;
    const depth = Number.isFinite(t.conditions?.depth_top) && Number.isFinite(t.conditions?.depth_bottom)
      ? ` at ${formatNumber(t.conditions.depth_top, 2)}–${formatNumber(t.conditions.depth_bottom, 2)} m` : ' (depth not stated)';
    out.push(`${formatNumber(k, 2)} W/(m K), ρ ${formatNumber(1 / k, 2)} K m/W, ${status}${depth} · ${t.source}`);
  }
  return out.length ? out.join('; ') : NO_THERMAL;
}

// Rows [[label, text, links?]] for a finished route. r: layer.alongRoute(path) or null.
export function routeRows(r) {
  if (!r) return [];
  const rows = [];
  const listed = (label, list, key, none) => {
    if (list == null) rows.push([label, `${key} not in this file`]);
    else rows.push([label, list.length ? lengths(list) : none]);
  };
  listed('Superficial crossed', r.superficial, 'superficial deposits', 'none mapped at this scale');
  listed('Bedrock crossed', r.bedrock, 'bedrock', 'none mapped');
  if (r.boreholes == null) rows.push([`Boreholes within ${r.near} m`, 'borehole index not in this file']);
  else {
    const src = r.sources?.boreholes, links = [];
    for (const b of r.boreholes.slice(0, 8)) {
      const len = Number.isFinite(b.drilled_length_m) ? `, ${formatNumber(b.drilled_length_m, 1)} m drilled` : '';
      const name = ""; // BGS borehole names can name private properties; show the index reference only.
      links.push({ text: `${b.id || 'unnamed'}${name} (${formatLength(b.distance, 0)} away${len})`, href: mayLink(src, b.log_url) ? b.log_url : '' });
    }
    const more = r.boreholes.length > 8 ? ` +${r.boreholes.length - 8} more` : '';
    rows.push([`Boreholes within ${r.near} m`, r.boreholes.length ? `${r.boreholes.length}${more}` : 'none in the index', links]);
  }
  const flags = [];
  if (r.mining == null) flags.push('mining areas not in this file');
  else if (r.mining.length) flags.push(`crosses ${lengths(r.mining)}`);
  if (r.mine_entries == null) flags.push('mine entries not in this file');
  else if (r.mine_entries.length) {
    const n = r.mine_entries.length, first = r.mine_entries[0], type = first.type ? `, ${first.type}` : '';
    flags.push(`${n} mine entr${n === 1 ? 'y' : 'ies'} within ${r.near} m (nearest ${formatLength(first.distance, 0)}${type})`);
  }
  if (r.mining && !r.mining.length) flags.unshift('none mapped along the route (absence is not proof of no mining)');
  rows.push(['Mining', flags.join(' · '), null, !!(r.mining?.length || r.mine_entries?.length)]);
  rows.push(['Aquifer', r.aquifers == null ? 'aquifer designation not in this file' : r.aquifers.length ? lengths(r.aquifers) : 'none mapped']);
  if (r.spz == null) rows.push(['Source protection', 'source protection zones not in this file']);
  else rows.push(['Source protection', r.spz.length ? lengths(r.spz) : 'none along the route', null, r.spz.length > 0]);
  rows.push(['Thermal resistivity', thermalText(r.thermal)]);
  const used = ['superficial', 'bedrock', 'boreholes', 'mining', 'spz'].map(k => srcName(r.sources, k)).filter(Boolean);
  if (used.length) rows.push(['Sources', [...new Set(used)].join('; ')]);
  rows.push(['Note', DESKTOP]);
  return rows;
}

// Page wiring. deps: { doc, layer() -> the ground layer or null, on() -> bool, where: element for the walking line,
// box: element in the Design panel, finished() -> { key, path: [[e, n], ...] } | null, here() -> { e, n }, walking() }.
export function mountGroundReadout({ doc, layer, on, feet, box, finished, here, walking }) {
  let lastRoute = null, lastFeet = '';
  const el = (tag, cls, t) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (t != null) e.textContent = t; return e; };
  function update() {
    const g = on() ? layer() : null, ready = !!(g && g.ready?.());
    let line = '';
    if (ready && walking()) { const p = here(); line = underfootText(g.underfoot(p.e, p.n)); }
    if (line !== lastFeet) { feet.textContent = line; feet.hidden = !line; lastFeet = line; }
    const f = ready ? finished() : null, key = f ? `${f.key}` : '';
    if (key === lastRoute) return;
    lastRoute = key;
    box.replaceChildren();
    box.hidden = !f;
    if (!f) return;
    box.appendChild(el('h3', null, 'Ground along the last finished route'));
    const dl = el('dl');
    for (const [k, v, links, warn] of routeRows(g.alongRoute(f.path))) {
      const dd = el('dd', warn ? 'warn' : null, v);
      if (links?.length) {
        const ul = el('ul');
        for (const l of links) {
          const li = el('li');
          if (l.href) { const a = el('a', null, l.text); a.href = l.href; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); }
          else li.textContent = l.text;
          ul.appendChild(li);
        }
        dd.appendChild(ul);
      }
      dl.append(el('dt', null, k), dd);
    }
    box.appendChild(dl);
  }
  return { update, reset() { lastRoute = null; lastFeet = null; } };
}
