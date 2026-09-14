/* Reuses the published code reader (core.js). This view changes navigation, not permanent identities. */
let viewSerial = 0, journeyDepth = 0;
const subject = $('#subject');
const row = (title, detail, act) => el('button', { class: 'row', on: { click: act } }, title, detail ? el('small', {}, detail) : null);
function paged(host, list, render, size = 24) {
  let page = 0;
  function draw() {
    host.replaceChildren();
    if (!list.length) { host.append(el('p', { class: 'empty' }, 'None recorded in the published data.')); return; }
    const start = page * size, stop = Math.min(start + size, list.length);
    const prev = el('button', { 'aria-label': 'Previous page', on: { click: () => { page--; draw(); } } }, '←'); prev.disabled = page === 0;
    const next = el('button', { 'aria-label': 'Next page', on: { click: () => { page++; draw(); } } }, '→'); next.disabled = stop === list.length;
    host.append(el('div', { class: 'pager' }, prev, el('span', { role: 'status' }, `${start + 1}–${stop} of ${list.length}`), next));
    const items = el('div'); host.append(items);
    list.slice(start, stop).forEach((item, i) => items.append(render(item, start + i)));
  }
  draw();
}
function box(title) { const wrapper = el('section', { class: 'box' }, el('h3', {}, title)); const content = el('div'); wrapper.append(content); return { wrapper, content }; }
function link(label, url) {
  try { if (!/^https?:$/.test(new URL(url).protocol)) return null; } catch { return null; }
  return el('a', { class: 'u-chip', href: url, target: '_blank', rel: 'noopener noreferrer' }, label + ' ↗');
}
function navigate(kind, id) { const hash = kind ? `#${kind}=${encodeURIComponent(id)}` : '#'; if (location.hash === hash) return renderRoute(); history.pushState({ journeyDepth: ++journeyDepth }, '', hash); renderRoute(); }
function route() { const p = new URLSearchParams(location.hash.slice(1)); if (p.has('family')) return ['family', p.get('family')]; if (p.has('block')) return ['block', p.get('block')]; return ['', '']; }
function groupsFor(n) { return Object.entries(U.groups).filter(([, ns]) => ns.includes(Number(n))).map(([sym]) => sym); }
function drawBlocks() {
  const q = $('#block-filter').value.toLowerCase(), cat = $('#category').value;
  const groups = Object.keys(U.groups).filter(sym => {
    const b = U.bySym.get(sym);
    return (!cat || (cat === '_unnamed' ? !b : b?.category === cat)) && `${sym} ${blockLabel(sym)}`.toLowerCase().includes(q);
  }).sort((a, b) => (U.bySym.get(a)?.number ?? 1e9) - (U.bySym.get(b)?.number ?? 1e9) || a.localeCompare(b));
  paged($('#blocks'), groups, sym => row(blockLabel(sym), `${blockFamilies(sym).length} families`, () => navigate('block', sym)), 12);
}
function relationList(title, items, type, go) {
  const b = box(`${title} · ${items.length}`);
  paged(b.content, items, item => row(item.label, type, () => go(item.id)), 16);
  return b.wrapper;
}
async function renderRoute() {
  const serial = ++viewSerial;
  const [kind, id] = route();
  $('#back').disabled = journeyDepth === 0;
  $('#trail').replaceChildren(el('a', { href: '#' }, 'GLOBALGRID2050'), kind ? ` › ${kind === 'family' ? '#' + id : blockLabel(id)}` : ' › All blocks');
  subject.replaceChildren(); subject.setAttribute('aria-busy', 'true');
  try {
    if (!kind) {
      subject.append(el('h2', { class: 'subject-title' }, 'Navigate the code'), el('p', {}, 'Choose a block or search a function. Follow its permanent keys to the relationships and the exact source at a commit.'), el('p', { class: 'relation-legend' }, 'Contains → families · Uses → dependencies · Used by → callers · Shared lines → matching permanent keys in loaded records'));
      const picks = ['Vn', 'Dt', 'Si', 'Cg'].filter(s => U.groups[s]);
      subject.append(el('div', { class: 'two' }, picks.map(s => row(blockLabel(s), `${blockFamilies(s).length} families`, () => navigate('block', s)))));
      return;
    }
    if (kind === 'block') {
      if (!Object.hasOwn(U.groups, id)) throw Error(`Block or group ${id} is not recorded.`);
      const b = U.bySym.get(id), families = blockFamilies(id);
      subject.append(el('div', { class: 'block-summary' }, el('h2', { class: 'subject-title' }, blockLabel(id)), el('p', {}, blockDesc(b) || 'This group has not yet been given a public block name.'), el('p', { class: 'u-muted' }, `${families.length} function families · all available below`)));
      if (b) subject.append(link('Block page', blockPage(id)));
      const deps = blockDeps(id), users = (b?.used_by || []).map(x => x.symbol || x).filter(s => Object.hasOwn(U.groups, s));
      const relations = el('div', { class: 'two' }, relationList('Depends on', deps.map(s => ({ id: s, label: blockLabel(s) })), 'depends on →', s => navigate('block', s)), relationList('Used by', users.map(s => ({ id: s, label: blockLabel(s) })), '← used by', s => navigate('block', s)));
      subject.append(relations);
      const f = box(`Contains · ${families.length} families`); subject.append(f.wrapper);
      paged(f.content, families, n => {
        const button = row('#' + n, 'Open numbered code and relationships', () => navigate('family', n));
        family(n).then(rec => { if (rec && button.isConnected) button.firstChild.textContent = `#${n} ${famName(rec)}`; }).catch(() => { if (button.isConnected) button.lastChild.textContent = 'Name could not load; open to retry.'; });
        return button;
      });
      return;
    }
    if (!/^\d+$/.test(id)) throw Error('The family key must be a non-negative integer.');
    const n = Number(id), rec = await family(n);
    if (serial !== viewSerial) return;
    if (!rec) throw Error(`Family #${n} is not in the published records.`);
    subject.append(el('h2', { class: 'subject-title' }, `#${n} ${famName(rec)}`), el('p', { class: 'u-muted' }, `${famKind(rec)} · ${rec.lines.length} permanent numbered lines · ${rec.standalone ? 'self-contained' : 'needs context'}`));
    const members = groupsFor(n);
    subject.append(el('div', { class: 'u-links' }, members.map(s => row('◂ Contained in ' + blockLabel(s), '', () => navigate('block', s)))));
    const links = familyLinks(rec, n); subject.append(el('div', { class: 'u-links' }, link('Function page', links.page), links.gh ? link('File at commit', links.gh) : null, links.live ? link('Recorded live page', links.live) : el('span', { class: 'u-muted' }, 'No live page recorded.')));
    subject.append(el('div', { class: 'two' }, relationList('Uses', (rec.uses || []).map(u => ({ id: u.family, label: `#${u.family} ${u.name || ''}` })), 'uses →', m => navigate('family', m)), relationList('Used by', (rec.used_by || []).map(u => ({ id: u.family, label: `#${u.family} ${u.name || ''}` })), '← used by', m => navigate('family', m))));
    const code = box('Numbered lines · permanent keys'); subject.append(code.wrapper);
    const p = rec.places?.[0];
    if (p) code.content.append(el('p', { class: 'source-meta' }, `${p.repo} / ${p.path} · commit ${p.commit} · source lines ${p.first}–${p.last}`));
    const pre = el('div', { class: 'u-code', tabindex: '0', 'aria-label': 'Numbered source code' }, 'Fetching the source at its pinned commit…'); code.content.append(pre);
    try {
      const rows = await familyLines(rec);
      if (serial !== viewSerial) return;
      pre.replaceChildren(...rows.map(r => el('div', { class: 'u-line' }, el('span', { class: 'u-key' }, String(r.key)), ' │ ' + r.text)));
    } catch (error) { pre.textContent = `Source unavailable: ${error.message}. Permanent keys: ${rec.lines.join(', ')}.`; }
    if (serial !== viewSerial) return;
    const keys = new Set(rec.lines), shared = new Map();
    let loaded = 0, failures = 0;
    for (const promise of U.buckets.values()) {
      let bucket; try { bucket = await promise; loaded++; } catch { failures++; continue; }
      if (serial !== viewSerial) return;
      for (const [m, r] of Object.entries(bucket)) if (+m !== n) { const hits = (r.lines || []).filter(k => keys.has(k)).length; if (hits) shared.set(+m, { id: +m, label: `#${m} ${famName(r)} · ${hits} shared keys` }); }
    }
    subject.append(relationList('Shared lines in loaded records', [...shared.values()], 'shares permanent keys', m => navigate('family', m)), el('p', { class: 'u-muted' }, `Searched ${loaded} loaded buckets; ${failures} unavailable. This is a partial search, not the whole code base.`));
  } catch (error) {
    if (serial !== viewSerial) return;
    subject.replaceChildren(el('div', { class: 'u-fail', role: 'alert' }, error.message), el('button', { on: { click: () => { U.buckets.clear(); U.texts.clear(); renderRoute(); } } }, 'Retry this view'));
  } finally { if (serial === viewSerial) subject.setAttribute('aria-busy', 'false'); }
}
$('#back').addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { journeyDepth = history.state?.journeyDepth || 0; renderRoute(); });
window.addEventListener('hashchange', () => { journeyDepth = history.state?.journeyDepth || 0; renderRoute(); });
$('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); $('#copy-status').textContent = 'Link copied'; } catch { $('#copy-status').textContent = 'Copy the address from the browser bar.'; } });
async function start() {
  try {
    await loadUniverse();
    $('#count').textContent = countsLine();
    for (const c of U.cats) $('#category').append(el('option', { value: c.id }, catName(c)));
    $('#category').append(el('option', { value: '_unnamed' }, 'Unnamed groups'));
    $('#block-filter').addEventListener('input', drawBlocks); $('#category').addEventListener('change', drawBlocks);
    mountSearch($('#search'), n => navigate('family', n)); drawBlocks(); renderRoute();
  } catch (e) { fail('#count', e); subject.replaceChildren(el('button', { on: { click: () => location.reload() } }, 'Reload live data')); }
}
start();
