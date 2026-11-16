/* GlobalGrid2050 Data Centre component. Host-owned tab slot; never edits the page frame. */
(function (root, factory) {
  const model = (typeof module === 'object' && module.exports)
    ? require('./model.js') : root.GGDataCentreModel;
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GGDataCentreUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (model) {
  'use strict';
  const NAMES = ['projects', 'official', 'groups', 'audit', 'baseline'];
  const LABELS = {
    uk: 'UK leads', global: 'Global leads', official: 'Official source records',
    groups: 'Group associations', quarantine: 'Quarantined candidates'
  };
  function el(tag, className, value) {
    const n = document.createElement(tag);
    if (className) n.className = 'ggdc-' + className;
    if (value !== undefined && value !== null) n.textContent = String(value);
    return n;
  }
  function source(label, address) {
    const safe = model.safeUrl(address);
    if (!safe) return el('span', 'muted', 'Source unavailable');
    const a = el('a', 'source', label);
    a.href = safe;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }
  function cell(row, value) {
    const td = el('td');
    if (value && typeof value === 'object' && value.nodeType) td.appendChild(value);
    else td.textContent = value === null || value === undefined ? 'Not reported' : String(value);
    row.appendChild(td);
    return td;
  }
  function table(columns, records, cells) {
    const scroll = el('div', 'scroll');
    scroll.setAttribute('tabindex', '0');
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Data Centre records, horizontally scrollable');
    const t = el('table', 'table'), head = el('thead'), tr = el('tr');
    columns.forEach(c => { const th = el('th', null, c); th.scope = 'col'; tr.appendChild(th); });
    head.appendChild(tr); t.appendChild(head);
    const body = el('tbody');
    records.forEach(x => {
      const r = el('tr'); cells(r,x); body.appendChild(r);
    });
    t.appendChild(body); scroll.appendChild(t);
    return scroll;
  }
  function leadRows(records) {
    return table(['Site / source entity', 'Country', 'Current operation',
      'IT load', 'Site demand', 'Grid connection', 'Evidence'], records, (r,x) => {
      const identity = el('div', 'identity', x.name);
      identity.appendChild(el('small', 'id', x.id));
      cell(r, identity);
      cell(r, x.country.name);
      cell(r, 'Not assessed');
      cell(r, model.mw(x.capacity.it_load_mw));
      cell(r, model.mw(x.capacity.site_demand_mw));
      cell(r, model.mw(x.capacity.grid_connection_mw));
      const evidence = el('div', 'evidence');
      evidence.appendChild(source('Source revision', x.source.revision_url));
      evidence.appendChild(el('small', 'stamp', 'Retrieved ' + x.source.retrieved_at));
      if (model.mapUrl(x)) evidence.appendChild(source(
        x.location.precision_degrees > 0.01 ? 'Approximate map' : 'Map', model.mapUrl(x)));
      else evidence.appendChild(el('small', 'muted', 'No mapped coordinates'));
      cell(r, evidence);
    });
  }
  function officialRows(records) {
    return table(['Document / project name', 'Source grain', 'Document event',
      'Current lifecycle', 'Published evidence'], records, (r,x) => {
      const ident = el('div', 'identity', x.name);
      ident.appendChild(el('small', 'id', x.project_id));
      cell(r, ident);
      cell(r, x.entity_scope === 'planning_case' ? 'Planning case' : 'Tax qualification record');
      cell(r, x.record_event.kind + ' · ' + x.record_event.date);
      cell(r, 'UNKNOWN — document event is not current operation');
      cell(r, source('Official document', x.source_document.url));
    });
  }
  function groupRows(records) {
    return table(['Source entity', 'Relationship finding', 'Listed group evidence',
      'Current operation', 'Provenance'], records, (r,x) => {
      const ident = el('div', 'identity', x.name);
      ident.appendChild(el('small', 'id', x.project_id));
      cell(r, ident);
      cell(r, x.status === 'PROVISIONAL' ? 'PROVISIONAL association; legal ownership unverified' :
        'UNLINKED — no supported association');
      cell(r, x.listed_parent?.legal_name || 'No supported listed-parent link');
      cell(r, 'Not assessed');
      const proof = el('div', 'evidence');
      proof.appendChild(source('Original entity', x.source_revision_url));
      x.receipts.forEach(p => proof.appendChild(source(p.publisher + ' receipt', p.final_url)));
      if (x.unknown_reasons?.length) proof.appendChild(el('small','muted',x.unknown_reasons.join('; ')));
      cell(r, proof);
    });
  }
  function quarantineRows(records) {
    return table(['Candidate', 'Reason held back', 'Source revision'], records, (r,x) => {
      const ident = el('div', 'identity', x.name);
      ident.appendChild(el('small', 'id', x.id));
      cell(r, ident); cell(r, x.reason);
      cell(r, source('Original source revision', x.source_revision_url));
    });
  }
  function render(host, bundle) {
    model.validateBundle(bundle);
    const counts = model.summary(bundle);
    host.replaceChildren();
    const section = el('section', 'component');
    section.setAttribute('aria-label', 'Data Centre intelligence');
    section.appendChild(el('h3', 'title', 'DATA CENTRES'));
    section.appendChild(el('p', 'intro',
      counts.leads + ' source-indexed leads (' + counts.uk_leads + ' UK), ' + counts.countries +
      ' countries; ' + counts.quarantined + ' quarantined; original ' + counts.baseline +
      ' identities preserved. NOT a verified operating-facility census.'));
    section.appendChild(el('p', 'muted',
      'Current operation is not assessed. IT load, site demand and grid connection are different measurements. Unknown MW remains unknown. Official documents, group links and quarantined candidates are separate record types.'));
    const toolbar = el('div', 'toolbar');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Data Centre evidence category');
    const nav = {};
    const filters = {kind: 'uk', query: '', country: ''};
    Object.entries(LABELS).forEach(([id,label]) => {
      const button = el('button', 'tab', label + ' (' +
        ({uk:counts.uk_leads,global:counts.leads,official:counts.official_source_records,
          groups:counts.groups_provisional+counts.groups_unlinked,quarantine:counts.quarantined}[id]) + ')');
      button.type = 'button';
      button.dataset.kind = id;
      button.addEventListener('click', () => { filters.kind = id; update(); });
      nav[id] = button; toolbar.appendChild(button);
    });
    section.appendChild(toolbar);
    const controls = el('div', 'filters');
    const searchLabel = el('label', null, 'Search');
    const input = el('input'); input.type = 'search'; input.placeholder = 'Name, source ID or operator';
    input.setAttribute('aria-label', 'Search Data Centre records');
    input.addEventListener('input', () => { filters.query = input.value; update(); });
    searchLabel.appendChild(input); controls.appendChild(searchLabel);
    const countryLabel = el('label', null, 'Country');
    const select = el('select'); select.setAttribute('aria-label', 'Country');
    const all = el('option', null, 'All countries'); all.value = ''; select.appendChild(all);
    const countries = new Map(bundle.projects.records.map(r => [r.country.wikidata_id,r.country.name]));
    [...countries].sort((a,b) => a[1].localeCompare(b[1])).forEach(([id,name]) => {
      const o = el('option', null, name); o.value = id; select.appendChild(o);
    });
    select.addEventListener('change', () => { filters.country = select.value; update(); });
    countryLabel.appendChild(select); controls.appendChild(countryLabel);
    const exportButton = el('button', 'download', 'Export displayed leads (CSV)');
    exportButton.type = 'button';
    exportButton.addEventListener('click', () => {
      if (filters.kind !== 'uk' && filters.kind !== 'global') return;
      const data = model.csv(model.selectRows(bundle.projects.records, filters));
      const url = URL.createObjectURL(new Blob([data], {type:'text/csv;charset=utf-8'}));
      try {
        const link = el('a'); link.href = url; link.download = 'globalgrid2050-data-centres-' + filters.kind + '.csv';
        link.click();
      } finally { URL.revokeObjectURL(url); }
    });
    controls.appendChild(exportButton); section.appendChild(controls);
    const status = el('p', 'status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    section.appendChild(status);
    const results = el('div', 'results'); section.appendChild(results);
    section.appendChild(el('p','muted',
      'Wikidata structured facts: CC0. Original source revisions linked per row. Other document rights not inferred. No identity-based join to REPD or grid connection claim.'));
    host.appendChild(section);
    function update() {
      Object.keys(nav).forEach(x => nav[x].setAttribute('aria-pressed', String(filters.kind === x)));
      const leads = filters.kind === 'uk' || filters.kind === 'global';
      countryLabel.hidden = !leads || filters.kind === 'uk';
      exportButton.hidden = !leads;
      if (!leads) select.value = '';
      results.replaceChildren();
      let rows, builder;
      if (leads) {
        rows = model.selectRows(bundle.projects.records,
          {scope:filters.kind === 'uk' ? 'uk':'global',query:filters.query,country:filters.kind === 'global' ? filters.country:''});
        builder = leadRows;
      } else {
        const list = filters.kind === 'official' ? bundle.official.projects :
          filters.kind === 'groups' ? bundle.groups.records : bundle.audit.quarantined;
        const s = filters.query.toLocaleLowerCase().trim();
        rows = list.filter(x => !s || [x.name,x.id||x.project_id,x.reason||'',x.entity_scope||''].join(' ').toLocaleLowerCase().includes(s));
        builder = filters.kind === 'official' ? officialRows : filters.kind === 'groups' ? groupRows : quarantineRows;
      }
      status.textContent = rows.length + ' ' + LABELS[filters.kind].toLowerCase() + ' displayed';
      if (rows.length) results.appendChild(builder(rows));
      else results.appendChild(el('p', 'empty','No matching records in this category.'));
    }
    update();
    return {counts, update, section};
  }
  async function load(inputs, transport = fetch, digest = null) {
    if (!inputs || !inputs.urls || !inputs.sha256) throw new Error('Five pinned Data Centre inputs required');
    const sha = digest || (async text => {
      if (!globalThis.crypto?.subtle) throw new Error('SHA-256 verifier unavailable');
      const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      return Array.from(new Uint8Array(hash),b => b.toString(16).padStart(2,'0')).join('');
    });
    const objects = await Promise.all(NAMES.map(async name => {
      const url = inputs.urls[name], expected = inputs.sha256[name];
      if (typeof url !== 'string' || !url.trim() || /^(?:javascript|data|blob):/i.test(url) ||
          !/^[a-f0-9]{64}$/i.test(expected || '')) throw new Error('Unpinned or unsafe Data Centre source: ' + name);
      const response = await transport(url, {cache:'no-store'});
      if (!response || !response.ok) throw new Error('Data Centre source unavailable: ' + name);
      const body = await response.text();
      if ((await sha(body)).toLowerCase() !== expected.toLowerCase()) throw new Error('Data Centre source hash differs: ' + name);
      return [name,JSON.parse(body)];
    }));
    return model.validateBundle(Object.fromEntries(objects));
  }
  async function mount(host, inputs, transport, digest) {
    if (!host || typeof host.replaceChildren !== 'function') throw new Error('Host element required');
    host.replaceChildren(el('p','status','Loading source-pinned Data Centre intelligence…'));
    try { const bundle = await load(inputs, transport, digest); return render(host, bundle); }
    catch (err) {
      host.replaceChildren(el('p','error','Data Centre records unavailable — source or integrity check failed. No partial data displayed.'));
      return {error: err.message};
    }
  }
  return {load, mount, render, LABELS};
});
