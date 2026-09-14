/* GLOBALGRID2050 universe core — shared by the ten local versions.
 * Reads live data (all served with Access-Control-Allow-Origin: *):
 *   stars/blocks/blocks.json     207 named blocks, 12 categories
 *   stars/blocks/families.json   block or unnamed group -> family numbers (757 groups, 10,811 families)
 *   stars/code/index.json        counts
 *   stars/code/f/<n/500>.json    family records (lines[], uses[], used_by[], places[])
 *   stars/code/names.json        name -> family numbers
 *   raw.githubusercontent.com    the text of a family's lines at its pinned commit
 * A version supplies the picture; this file supplies data, the journey trail, the family panel and search.
 */
const STARS = 'https://ventusltd.github.io/stars/';
const U = { blocks: null, cats: [], groups: null, index: null, names: null, famToGroup: new Map(), buckets: new Map(), texts: new Map(), trail: [] };
const REL = { contains: '#8b93a7', 'depends on': '#ffd54a', uses: '#00e5ff', 'used by': '#ff7ab6', 'shared line': '#39d353' };

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'html') e.innerHTML = v; else if (v != null) e.setAttribute(k, v); }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
async function getJSON(url) {
  const r = await fetch(url, { cache: 'default' });
  if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
  return r.json();
}
function fail(where, err) {
  const box = $(where) || document.body;
  box.prepend(el('div', { class: 'u-fail' }, `Could not load live data: ${err.message}. Check the internet connection and reload.`));
}

/* ---- data ---- */
async function loadUniverse() {
  const [b, groups, index, names] = await Promise.all([getJSON(STARS + 'blocks/blocks.json'), getJSON(STARS + 'blocks/families.json'), getJSON(STARS + 'code/index.json'), getJSON(STARS + 'code/names.json')]);
  U.blocks = b.blocks; U.cats = b.categories; U.groups = groups; U.index = index; U.names = names;
  U.bySym = new Map(U.blocks.map(x => [x.symbol, x]));
  // a family can belong to more than one group: famToGroup keeps the first named block (or first group) for the trail,
  // and famGroups keeps every membership (Codex review, 2026-09-14: plural membership must be shown)
  U.famGroups = new Map();
  for (const [g, fams] of Object.entries(groups)) for (const n of fams) { if (!U.famGroups.has(n)) U.famGroups.set(n, []); U.famGroups.get(n).push(g); }
  for (const [n, gs] of U.famGroups) U.famToGroup.set(n, gs.find(g => U.bySym.has(g)) || gs[0]);
  U.catOf = new Map(U.cats.map(c => [c.id, c]));
  U.unnamed = Object.keys(groups).filter(g => !U.bySym.has(g));
  return U;
}
const catColour = id => (U.catOf.get(id) || {}).colour || '#8b93a7';
const catTitle = id => (U.catOf.get(id) || {}).title || id;
function blockLabel(sym) { const b = U.bySym.get(sym); return b ? `${sym} · ${b.title}` : `Group ${sym} (not yet named)`; }
function blockFamilies(sym) { return U.groups[sym] || []; }
function blockDeps(sym) { const b = U.bySym.get(sym); return b ? (b.depends_on || []).map(d => d.symbol || d).filter(s => U.bySym.has(s) || U.groups[s]) : []; }
function blockUsers(sym) { const b = U.bySym.get(sym); return b ? (b.used_by || []).filter(s => U.bySym.has(s) || U.groups[s]) : []; }
function countsLine() { return `${U.blocks.length} named blocks · ${U.unnamed.length} unnamed groups · ${U.index.families.toLocaleString('en-GB')} function families · ${U.index.lines.toLocaleString('en-GB')} unique numbered lines`; }

async function family(n) {
  const b = Math.floor(n / (U.index.bucket_size || 500));
  if (!U.buckets.has(b)) U.buckets.set(b, getJSON(`${STARS}code/f/${b}.json`));
  const bucket = await U.buckets.get(b);
  return bucket[String(n)] || null;
}
async function familyLines(rec) {
  const p = (rec.places || [])[0];
  if (!p) return rec.lines.map(k => ({ key: k, text: '(source not yet known: no place recorded)' }));
  const id = `${p.repo}@${p.commit}:${p.path}`;
  if (!U.texts.has(id)) U.texts.set(id, fetch(`https://raw.githubusercontent.com/${p.repo}/${p.commit}/${p.path.split('/').map(encodeURIComponent).join('/')}`).then(r => { if (!r.ok) throw new Error(`GitHub returned HTTP ${r.status}`); return r.text(); }).then(t => t.split('\n')));
  const all = await U.texts.get(id);
  const src = all.slice(p.first - 1, p.last);
  return rec.lines.map((k, i) => ({ key: k, text: src[i] ?? '' }));
}
function familyLinks(rec, n) {
  const p = (rec.places || [])[0];
  return {
    page: `${STARS}code.html?family=${n}`,
    gh: p ? `https://github.com/${p.repo}/blob/${p.commit}/${p.path}#L${p.first}-L${p.last}` : null,
    live: (rec.places || []).map(x => x.live).find(Boolean) || null,
  };
}
const famName = rec => (rec && rec.names && rec.names[0]) || '(name not yet known)';


/* ---- paging: a list is never cut; it shows a page and a "show N more" control, so the last item is always reachable ---- */
function pageList(host, items, render, step = 60, label = 'more') {
  let shown = 0; const more = el('button', { class: 'u-chip u-more' });
  const fill = () => { const next = items.slice(shown, shown + step); next.forEach(it => host.insertBefore(render(it), more)); shown += next.length; if (shown >= items.length) more.remove(); else more.textContent = `show ${Math.min(step, items.length - shown)} ${label} (${items.length - shown} left)`; };
  host.append(more); more.addEventListener('click', fill); fill();
  return host;
}


/* ---- deep links: every family and block has an address, and browser Back walks the journey ---- */
function setAddress(kind, id) { const h = `#${kind}=${encodeURIComponent(id)}`; if (location.hash !== h) history.pushState({ kind, id }, '', h); }
function readAddress() { const m = location.hash.match(/^#(family|block)=(.+)$/); return m ? { kind: m[1], id: m[1] === 'family' ? Number(decodeURIComponent(m[2])) : decodeURIComponent(m[2]) } : null; }
addEventListener('popstate', () => { const a = readAddress(); if (a && window.goTo) { U.trail = U.trail.filter(s => !(s.kind === a.kind && s.id === a.id)); window.goTo(a.kind, a.id); } else if (!a && window.goHome) { U.trail = []; renderTrail(); window.goHome(); } });
function openAddress() { const a = readAddress(); if (a && window.goTo) { window.goTo(a.kind, a.id); return true; } return false; }

/* ---- journey trail: every version shows where the reader has been ---- */
function trailPush(kind, id, label) {
  const last = U.trail[U.trail.length - 1];
  if (last && last.kind === kind && last.id === id) return;
  U.trail.push({ kind, id, label }); renderTrail(); if (kind === 'family' || kind === 'block') setAddress(kind, id);
}
function renderTrail() {
  const t = $('#trail'); if (!t) return;
  t.innerHTML = '';
  t.append(el('a', { href: '#', on: { click: e => { e.preventDefault(); U.trail = []; renderTrail(); window.goHome && window.goHome(); } } }, 'GLOBALGRID2050'));
  U.trail.forEach((s, i) => {
    t.append(' › ', el('a', { href: '#', on: { click: e => { e.preventDefault(); U.trail = U.trail.slice(0, i + 1); renderTrail(); window.goTo && window.goTo(s.kind, s.id); } } }, s.label));
  });
}

/* ---- the shared family panel: numbered lines and every arrow out ---- */
async function showFamilyPanel(n, host, onFamily, onBlock) {
  host.innerHTML = '<div class="u-muted">Loading family #' + n + '…</div>';
  let rec;
  try { rec = await family(n); } catch (e) { host.innerHTML = ''; host.append(el('div', { class: 'u-fail' }, `Could not load family #${n}: ${e.message}`)); return; }
  if (!rec) { host.innerHTML = `<div class="u-fail">Family #${n} is not in the published records.</div>`; return; }
  trailPush('family', n, `#${n} ${famName(rec)}`);
  const g = U.famToGroup.get(n); const L = familyLinks(rec, n);
  host.innerHTML = '';
  host.append(
    el('div', { class: 'u-h' }, `#${n} ${famName(rec)}`),
    el('div', { class: 'u-muted' }, `${rec.kind || 'code'} · ${rec.lines.length} numbered lines · in ${rec.repos.length} repositories · ${rec.standalone ? 'self-contained' : 'needs context'}`),
    el('div', { class: 'u-links' },
      ...((U.famGroups.get(n) || (g ? [g] : [])).map(gg => el('button', { class: 'u-chip', style: `border-color:${REL.contains}`, on: { click: () => onBlock(gg) } }, `◂ contained in ${blockLabel(gg)}`))),
      el('a', { class: 'u-chip', href: L.page, target: '_blank', rel: 'noopener' }, 'Function page ↗'),
      L.gh ? el('a', { class: 'u-chip', href: L.gh, target: '_blank', rel: 'noopener' }, 'File at commit ↗') : null,
      L.live ? el('a', { class: 'u-chip live', href: L.live, target: '_blank', rel: 'noopener' }, 'Live page ↗') : null),
  );
  const rel = (title, list, colour) => {
    if (!list.length) return;
    host.append(el('div', { class: 'u-sub', style: `color:${colour}` }, `${title} (${list.length})`));
    host.append(pageList(el('div', { class: 'u-links' }), list, u => el('button', { class: 'u-chip', style: `border-color:${colour}`, on: { click: () => onFamily(u.family) } }, `#${u.family} ${u.name || ''}`), 40, 'families'));
  };
  rel('→ uses', rec.uses || [], REL.uses);
  rel('← used by', rec.used_by || [], REL['used by']);
  host.append(el('div', { class: 'u-sub' }, 'Numbered lines (permanent keys)'));
  const pre = el('div', { class: 'u-code' }, 'Fetching the code at its pinned commit…'); host.append(pre);
  try {
    const rows = await familyLines(rec);
    pre.innerHTML = rows.map(r => `<div class="u-line"><span class="u-key">${r.key}</span> │ ${esc(r.text)}</div>`).join('');
  } catch (e) { pre.textContent = `The code could not be fetched (${e.message}); the line keys are ${rec.lines.join(', ')}.`; }
  // shared lines: other families in already-loaded buckets that carry the same line numbers
  const keys = new Set(rec.lines); const shared = new Map();
  for (const p of U.buckets.values()) { const bucket = await p.catch(() => ({})); for (const [m, r] of Object.entries(bucket)) { if (+m === n) continue; const hit = (r.lines || []).filter(k => keys.has(k)).length; if (hit) shared.set(+m, { family: +m, name: `${famName(r)} (${hit} shared)` }); } }
  rel('≡ shares numbered lines with (loaded records only)', [...shared.values()], REL['shared line']);
  return rec;
}

/* ---- search: a function name jumps to its family ---- */
function mountSearch(host, onFamily) {
  const input = el('input', { class: 'u-search', placeholder: 'Search a function name…', 'aria-label': 'Search a function name' });
  const hits = el('div', { class: 'u-hits' });
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase(); hits.innerHTML = '';
    if (q.length < 2) return;
    const found = Object.keys(U.names).filter(k => k.toLowerCase().includes(q)).sort((a, b) => a.length - b.length).slice(0, 12);
    for (const k of found) for (const n of U.names[k].slice(0, 3)) hits.append(el('button', { class: 'u-chip', on: { click: () => { hits.innerHTML = ''; input.value = ''; onFamily(n); } } }, `#${n} ${k}`));
    if (!found.length) hits.append(el('span', { class: 'u-muted' }, 'No function name contains that text.'));
  });
  host.append(input, hits);
}

function legend(host) {
  host.append(el('div', { class: 'u-legend' }, Object.entries(REL).map(([k, c]) => el('span', {}, el('i', { style: `background:${c}` }), k))));
}
function footer(id) {
  document.body.append(el('footer', { class: 'u-foot' }, `${id} · built ${window.BUILT || ''} UTC · live data: ${STARS}blocks/, ${STARS}code/, raw.githubusercontent.com · GLOBALGRID2050`));
}

/* ---- shared look ---- */
document.head.append(el('style', { html: `
:root{color-scheme:dark}
body{margin:0;padding:12px 16px 40px;background:#0b0d12;color:#d8dee9;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace}
a{color:#00e5ff} h1{font-size:20px;margin:0;letter-spacing:.06em} .u-count{color:#7da0c8;font-size:12px;margin:2px 0 8px}
#trail{font-size:12px;margin:6px 0 10px;color:#8b93a7;overflow-wrap:anywhere} #trail a{color:#9fd8ff;text-decoration:none}
.u-fail{border:1px solid #ff5c5c;color:#ffb3b3;padding:8px 10px;border-radius:8px;margin:8px 0}
.u-muted{color:#8b93a7;font-size:12px} .u-h{font-size:16px;color:#eef2fb;margin:4px 0} .u-sub{margin:12px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.u-links{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.u-chip{background:#12151c;border:1px solid #385464;color:#eef2fb;padding:5px 9px;border-radius:14px;font:inherit;font-size:12px;cursor:pointer;text-decoration:none}
.u-chip:hover{border-color:#00e5ff} .u-chip.live{border-color:#39d353}
.u-code{background:#07090d;border:1px solid #1f2633;border-radius:8px;padding:8px;overflow:auto;max-height:55vh;font-size:12px}
.u-line{white-space:pre} .u-key{color:#ffd54a}
.u-search{width:100%;box-sizing:border-box;background:#12151c;border:1px solid #385464;color:#eef2fb;padding:8px 10px;border-radius:8px;font:inherit}
.u-hits{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.u-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#8b93a7;margin:6px 0} .u-legend i{display:inline-block;width:14px;height:3px;margin-right:4px;vertical-align:middle}
.u-foot{margin-top:24px;color:#566079;font-size:11px;overflow-wrap:anywhere}
.u-panel{border:1px solid #2a3140;border-radius:10px;padding:10px;background:#0f1218;margin:10px 0}
` }));
