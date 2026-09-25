(function () {
  'use strict';
  const configUrl = new URL('../data/homepage.json', document.currentScript.src);
  const activityUrl = new URL('../data/active-pages.json', document.currentScript.src);
  const presentationUrl = new URL('../data/presentation.json', document.currentScript.src);
  const typesUrl = new URL('../data/entity-types.json', document.currentScript.src);
  let entityTypes = {};
  const mount = document.getElementById('nests');
  const search = document.getElementById('homepageSearch');
  const status = document.getElementById('searchStatus');
  const catalogueBody = document.getElementById('catalogueRows');
  const searchText = new WeakMap();
  function matchesQuery(entity, query) {
    if (!searchText.has(entity)) { const meta = entityTypes[entity.id]; searchText.set(entity, [entity.id, entity.title, entity.subtitle, entity.description, meta.type, meta.purpose, ...meta.audience, ...meta.roles, ...entity.releases.map(release => [release.id, release.label, release.url, release.status, release.source_ref].join(' '))].join(' ').toLocaleLowerCase()); }
    return searchText.get(entity).includes(query);
  }
  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Catalogue unavailable');
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  function onDemand(details, populate) {
    let ready = false;
    const hydrate = () => {
      if (ready) return;
      populate();
      ready = true;
    };
    details.querySelector('summary').addEventListener('click', hydrate);
    details.addEventListener('toggle', () => { if (details.open) hydrate(); });
    return hydrate;
  }
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  function safeUrl(value) {
    if (typeof value !== 'string') throw new Error('Missing URL');
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe URL');
    return value;
  }
  function appUrl(value) {
    const url = new URL(safeUrl(value));
    if (/(^|\.)github\.com$/i.test(url.hostname) || /(^|\.)githubusercontent\.com$/i.test(url.hostname)) throw new Error('Expected an app URL');
    return value;
  }
  function link(label, url, className) {
    const a = node('a', label, className);
    a.href = appUrl(url);
    return a;
  }
  function validate(data) {
    if (data.schema_version !== 1 || !Array.isArray(data.entities) || !Array.isArray(data.view?.items)) throw new Error('Unsupported catalogue');
    const ids = new Set();
    for (const entity of data.entities) {
      if (typeof entity.id !== 'string' || ids.has(entity.id) || !entity.title || !Array.isArray(entity.releases)) throw new Error('Invalid entity');
      ids.add(entity.id);
      const releases = new Set();
      for (const release of entity.releases) {
        if (!release.id || releases.has(release.id) || !release.label || !['available', 'candidate'].includes(release.status)) throw new Error('Invalid release');
        releases.add(release.id);
        safeUrl(release.url);
        if (release.archive_url) safeUrl(release.archive_url);
        if (release.published_at != null && release.published_at !== '' && !Number.isFinite(Date.parse(release.published_at))) throw new Error('Invalid release date');
      }
      if (!entity.releases.some(release => release.id === entity.operative_release_id && release.status === 'available')) throw new Error('Missing operative release');
    }
    const byId = new Map(data.entities.map(entity => [entity.id, entity]));
    for (const entity of data.entities) {
      const seen = new Set([entity.id]);
      let parent = entity.parent_id;
      while (parent) {
        if (!byId.has(parent) || seen.has(parent)) throw new Error('Invalid parent');
        seen.add(parent);
        parent = byId.get(parent).parent_id;
      }
    }
    const pinned = new Set();
    for (const item of data.view.items) {
      if (!byId.has(item.entity_id) || pinned.has(item.entity_id) || byId.get(item.entity_id).parent_id) throw new Error('Invalid pinned entity');
      pinned.add(item.entity_id);
    }
    safeUrl(data.view.archive_url);
    if (data.development !== undefined && !Array.isArray(data.development)) throw new Error('Invalid development list');
    for (const item of data.development || []) {
      if (!item.label || item.status !== 'In development') throw new Error('Invalid development item');
      safeUrl(item.url);
    }
    return byId;
  }
  function releaseRow(release, operative) {
    const row = node('div', undefined, 'release');
    row.append(node('span', operative ? 'Operative' : release.status === 'candidate' ? 'Candidate' : 'Archived', 'release-state'));
    let target = release.url;
    if (!operative && release.archive_url && release.archive_kind !== 'manifest') {
      try { target = appUrl(release.archive_url); } catch (_) { /* Keep the app link. */ }
    }
    row.append(link(release.label, target, 'release-link'));
    return row;
  }
  function validatePresentation(config, byId) {
    if (!config || config.schema_version !== 1 || !Number.isInteger(config.page_size) || config.page_size < 1 || config.page_size > 100 || !Array.isArray(config.highlights) || config.highlights.length > 4) throw new Error('Invalid presentation settings');
    const seen = new Set();
    for (const item of config.highlights) {
      if (!byId.has(item.entity_id) || seen.has(item.entity_id) || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 40) throw new Error('Invalid highlight');
      seen.add(item.entity_id);
    }
  }
  function developmentStrip(items) {
    if (!items.length) return;
    const strip = node('section', undefined, 'development-strip');
    strip.setAttribute('aria-label', 'Explore our apps');
    const label = node('span', 'GLOBALGRID2050', 'development-label');
    const viewport = node('div', undefined, 'development-viewport');
    const track = node('div', undefined, 'development-track');
    const group = node('div', undefined, 'development-group');
    items.forEach(item => group.append(link(item.label, item.url)));
    track.append(group);
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a').forEach(a => a.tabIndex = -1);
    // Keep the visible repeat clickable without moving focus into hidden content.
    clone.addEventListener('pointerdown', event => event.preventDefault());
    track.append(clone);
    viewport.append(track);
    strip.append(label, viewport);
    document.getElementById('highlights').after(strip);
  }
  function validateTypes(metadata, byId) {
    const types = new Set(['engine', 'application', 'dataset', 'equipment', 'project', 'reference', 'drawing', 'catalogue']);
    if (!metadata || metadata.schema_version !== 1 || !metadata.records || typeof metadata.records !== 'object' || Array.isArray(metadata.records) || Object.keys(metadata.records).length !== byId.size) throw new Error('Invalid entity metadata');
    const bounded = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
    for (const [id, meta] of Object.entries(metadata.records)) {
      if (!byId.has(id) || !meta || !types.has(meta.type) || !bounded(meta.purpose, 1000) || !Array.isArray(meta.audience) || !meta.audience.length || meta.audience.length > 10 || !meta.audience.every(value => bounded(value, 100))) throw new Error('Invalid entity metadata record');
      if (!Array.isArray(meta.roles) || meta.roles.length > 10 || !meta.roles.every(value => bounded(value, 100)) || new Set(meta.roles).size !== meta.roles.length) throw new Error('Invalid entity roles');
      if (meta.capability_evidence !== undefined) {
        if (!meta.capability_evidence || !bounded(meta.capability_evidence.summary, 1000)) throw new Error('Invalid capability evidence');
        appUrl(meta.capability_evidence.url);
      }
    }
    return metadata.records;
  }
  function render(data, presentation, metadata) {
    const byId = validate(data);
    validatePresentation(presentation, byId);
    entityTypes = validateTypes(metadata, byId);
    const highlights = document.getElementById('highlightCards');
    highlights.replaceChildren();
    for (const item of presentation.highlights) {
      const entity = byId.get(item.entity_id);
      const release = entity.releases.find(release => release.id === entity.operative_release_id);
      const card = link('', release.url, 'highlight-card');
      card.dataset.entityId = entity.id;
      card.append(node('span', item.label, 'highlight-label'), node('strong', entity.title));
      if (entity.subtitle) card.append(node('span', entity.subtitle, 'highlight-description'));
      highlights.append(card);
    }
    document.getElementById('highlights').hidden = presentation.highlights.length === 0;
    const records = [];
    const childrenByParent = new Map();
    for (const entity of data.entities) {
      if (!childrenByParent.has(entity.parent_id)) childrenByParent.set(entity.parent_id, []);
      childrenByParent.get(entity.parent_id).push(entity);
    }
    function entityNode(entity, position, open) {
      const details = node('details', undefined, 'entity');
      details.id = entity.id;
      details.open = Boolean(open);
      const summary = node('summary');
      const title = node('span', entity.title, 'title');
      if (entity.subtitle) title.append(node('small', entity.subtitle));
      summary.append(node('span', position, 'number'), title);
      const inside = node('div', undefined, 'inside');
      if (entity.description) inside.append(node('p', entity.description));
      const operative = entity.releases.find(release => release.id === entity.operative_release_id);
      inside.append(link((entity.launch_label || 'Open ' + entity.title) + ' →', operative.url, 'launch'));
      inside.append(releaseRow(operative, true));
      const history = node('details', undefined, 'versions');
      const other = entity.releases.filter(release => release.id !== operative.id).sort((a, b) => (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0));
      history.append(node('summary', 'Versions (' + other.length + ')'));
      const hydrateHistory = onDemand(history, () => {
        if (other.length) other.forEach(release => history.append(releaseRow(release, false)));
        else history.append(node('p', 'No earlier versions listed.'));
      });
      inside.append(history);
      const record = { entity, details, history, hydrateHistory, children: [] };
      records.push(record);
      for (const child of childrenByParent.get(entity.id) || []) {
        const childNode = entityNode(child, '↳', false);
        record.children.push(child.id);
        inside.append(childNode);
      }
      details.append(summary, inside);
      return details;
    }
    const fragment = document.createDocumentFragment();
    data.view.items.forEach((item, index) => fragment.append(entityNode(byId.get(item.entity_id), String(index + 1).padStart(2, '0'), item.open)));
    mount.replaceChildren(fragment);
    let page = 0;
    let filtered = data.entities;
    function renderTable() {
      catalogueBody.replaceChildren();
      for (const entity of filtered.slice(page * presentation.page_size, (page + 1) * presentation.page_size)) {
      const operative = entity.releases.find(release => release.id === entity.operative_release_id);
      const row = node('tr');
      row.dataset.entityId = entity.id;
      const name = node('th');
      name.scope = 'row';
      name.append(link(entity.title, operative.url));
      name.append(node('small', entity.id, 'entity-key'));
      const versions = node('details', undefined, 'table-versions');
      versions.append(node('summary', operative.label));
      onDemand(versions, () => { for (const release of entity.releases) {
        const version = releaseRow(release, release.id === operative.id);
        version.append(node('small', release.id, 'entity-key'));
        versions.append(version);
      } });
      const versionCell = node('td');
      versionCell.append(versions);
      const meta = entityTypes[entity.id];
      const typeCell = node('td');
      const semantic = node('details', undefined, 'entity-type');
      semantic.append(node('summary', meta.type));
      onDemand(semantic, () => {
        semantic.append(node('p', 'Intended purpose: ' + meta.purpose), node('p', 'For: ' + meta.audience.join(', ')));
        if (meta.roles.length) semantic.append(node('p', 'Intended roles: ' + meta.roles.join(', ')));
        if (meta.capability_evidence) { semantic.append(node('p', 'Recorded evidence: ' + meta.capability_evidence.summary), link('View evidence', meta.capability_evidence.url)); }
      });
      typeCell.append(semantic);
      row.append(name, typeCell, node('td', entity.subtitle || byId.get(entity.parent_id)?.title || '\u2014'), versionCell);
      catalogueBody.append(row);
      }
      const count = filtered.length;
      document.getElementById('catalogueEmpty').hidden = count > 0;
      document.getElementById('cataloguePage').textContent = count ? (page * presentation.page_size + 1) + '\u2013' + Math.min((page + 1) * presentation.page_size, count) + ' of ' + count + ' apps' : '0 apps';
      document.getElementById('cataloguePrevious').disabled = page === 0;
      document.getElementById('catalogueNext').disabled = (page + 1) * presentation.page_size >= count;
    }
    document.getElementById('cataloguePagination').hidden = false;
    document.getElementById('cataloguePrevious').addEventListener('click', () => { if (page > 0) { page--; renderTable(); } });
    document.getElementById('catalogueNext').addEventListener('click', () => { if ((page + 1) * presentation.page_size < filtered.length) { page++; renderTable(); } });
    renderTable();
    document.getElementById('catalogue').hidden = false;
    document.getElementById('archiveLink').href = appUrl(data.view.archive_url);
    document.getElementById('searchControls').hidden = false;
    let saved = null;
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      if (query && !saved) saved = new Map(Array.from(mount.querySelectorAll('details'), detail => [detail, detail.open]));
      const matches = new Map();
      for (const record of records.slice().reverse()) {
        const ownMatch = matchesQuery(record.entity, query);
        const match = ownMatch || record.children.some(id => matches.get(id));
        matches.set(record.entity.id, match);
        record.details.hidden = !match;
        if (query) {
          record.details.open = match;
          record.history.open = record.entity.releases.some(release => release.id !== record.entity.operative_release_id && [release.label, release.url, release.status, release.source_ref].join(' ').toLocaleLowerCase().includes(query));
          if (record.history.open) record.hydrateHistory();
        }
      }
      if (!query && saved) {
        saved.forEach((open, detail) => { detail.open = open; });
        saved = null;
      }
      filtered = data.entities.filter(entity => matchesQuery(entity, query));
      page = 0;
      renderTable();
      const count = filtered.length;
      status.textContent = query ? count ? count + ' matching apps and versions.' : 'No matching tools or versions.' : '';
    });
  }
  Promise.all([configUrl, presentationUrl, typesUrl].map(fetchJson)).then(([data, presentation, metadata]) => {
    render(data, presentation, metadata);
    // Activity is optional: a missing feed must never hide the main collection.
    fetchJson(activityUrl).then(feed => {
      if (!Array.isArray(feed.items)) throw new Error('Invalid app list');
      for (const item of feed.items) {
        if (typeof item.label !== 'string' || !item.label.trim()) throw new Error('Missing app label');
        appUrl(item.url);
      }
      developmentStrip(feed.items);
    }).catch(() => { /* Keep the collection available without a ticker. */ });
  }).catch(error => {
    status.textContent = 'Version details are unavailable. The main links below remain available.';
    console.error('Homepage catalogue:', error);
  });
}());


