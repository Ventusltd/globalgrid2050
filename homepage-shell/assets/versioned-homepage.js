(function () {
  'use strict';
  const configUrl = new URL('../data/homepage.json', document.currentScript.src);
  const mount = document.getElementById('nests');
  const search = document.getElementById('homepageSearch');
  const status = document.getElementById('searchStatus');
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
  function link(label, url, className) {
    const a = node('a', label, className);
    a.href = safeUrl(url);
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
    const target = operative ? release.url : release.archive_url || release.url;
    const recordLabel = !operative && release.archive_kind === 'manifest' ? ' · Release record' : '';
    row.append(link(release.label + recordLabel, target, 'release-link'));
    if (release.published_at) {
      const time = node('time', release.published_at);
      time.dateTime = release.published_at;
      row.append(time);
    }
    row.append(node('span', target, 'release-url'));
    if (operative && release.archive_url) row.append(link(release.archive_kind === 'manifest' ? 'Release record' : 'Archived copy', release.archive_url));
    return row;
  }
  function developmentStrip(items) {
    if (!items.length) return;
    const strip = node('section', undefined, 'development-strip');
    strip.setAttribute('aria-label', 'GlobalGrid2050 apps and build status');
    const label = node('span', 'GLOBALGRID2050', 'development-label');
    const viewport = node('div', undefined, 'development-viewport');
    const track = node('div', undefined, 'development-track');
    const group = node('div', undefined, 'development-group');
    items.forEach(item => group.append(link(item.label + ' · ' + item.status, item.url)));
    track.append(group);
    const clone = group.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a').forEach(a => a.tabIndex = -1);
    // Keep the visible repeat clickable without moving focus into hidden content.
    clone.addEventListener('pointerdown', event => event.preventDefault());
    track.append(clone);
    viewport.append(track);
    const pause = node('button', 'Pause', 'ticker-pause');
    pause.type = 'button';
    pause.setAttribute('aria-label', 'Pause development ticker');
    pause.setAttribute('aria-pressed', 'false');
    pause.addEventListener('click', () => {
      const paused = strip.classList.toggle('is-paused');
      pause.textContent = paused ? 'Resume' : 'Pause';
      pause.setAttribute('aria-label', paused ? 'Resume development ticker' : 'Pause development ticker');
      pause.setAttribute('aria-pressed', String(paused));
    });
    strip.append(label, viewport, pause);
    document.querySelector('header').after(strip);
  }
  function render(data) {
    const byId = validate(data);
    const records = [];
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
      if (other.length) other.forEach(release => history.append(releaseRow(release, false)));
      else history.append(node('p', 'No earlier versions listed.'));
      inside.append(history);
      const record = { entity, details, history, children: [] };
      records.push(record);
      for (const child of data.entities.filter(candidate => candidate.parent_id === entity.id)) {
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
    document.getElementById('archiveLink').href = safeUrl(data.view.archive_url);
    const development = (data.development || []).slice(0, 3);
    const highlights = node('section', undefined, 'build-highlights');
    highlights.setAttribute('aria-labelledby', 'buildHeading');
    const heading = node('h2', 'In build');
    heading.id = 'buildHeading';
    const cards = node('div', undefined, 'build-list');
    const buildRecords = development.map(item => {
      const card = node('article', undefined, 'build-card');
      const title = node('h3');
      title.append(link(item.label + ' ↗', item.url));
      card.append(node('span', item.status, 'build-state'), title);
      if (item.description) card.append(node('p', item.description));
      if (item.evidence_summary) card.append(node('p', item.evidence_summary, 'build-evidence'));
      cards.append(card);
      return {card, text:[item.label, item.status, item.description, item.evidence_summary, item.url].join(' ').toLocaleLowerCase()};
    });
    highlights.append(heading, cards);
    highlights.hidden = !buildRecords.length;
    mount.before(highlights);
    const available = data.view.items.slice(0, 8).map(item => {
      const entity = byId.get(item.entity_id);
      return {label:entity.title,status:'Available',url:entity.releases.find(release=>release.id===entity.operative_release_id).url};
    });
    developmentStrip([...available, ...development]);
    document.getElementById('searchControls').hidden = false;
    let saved = null;
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      if (query && !saved) saved = new Map(Array.from(mount.querySelectorAll('details'), detail => [detail, detail.open]));
      const matches = new Map();
      for (const record of records.slice().reverse()) {
        const ownMatch = [record.entity.title, record.entity.subtitle, record.entity.description, ...record.entity.releases.map(release => [release.label, release.url, release.status, release.source_ref].join(' '))].join(' ').toLocaleLowerCase().includes(query);
        const match = ownMatch || record.children.some(id => matches.get(id));
        matches.set(record.entity.id, match);
        record.details.hidden = !match;
        if (query) {
          record.details.open = match;
          record.history.open = record.entity.releases.some(release => release.id !== record.entity.operative_release_id && [release.label, release.url, release.status, release.source_ref].join(' ').toLocaleLowerCase().includes(query));
        }
      }
      if (!query && saved) {
        saved.forEach((open, detail) => { detail.open = open; });
        saved = null;
      }
      buildRecords.forEach(record => {record.card.hidden = Boolean(query) && !record.text.includes(query);});
      const builds = buildRecords.filter(record=>!record.card.hidden).length;
      highlights.hidden = builds === 0;
      const count = [...matches.values()].filter(Boolean).length;
      status.textContent = query ? count || builds ? count + ' matching tools and variants; ' + builds + ' builds.' : 'No matching tools, versions or builds.' : '';
    });
  }
  fetch(configUrl).then(response => {
    if (!response.ok) throw new Error('Catalogue unavailable');
    return response.json();
  }).then(render).catch(error => {
    status.textContent = 'Version details are unavailable. The main links below remain available.';
    console.error('Homepage catalogue:', error);
  });
}());


