/* Live headlines for the news block.
 *
 * Reads the headlines file a scheduled workflow refreshes several times a day
 * (schema globalgrid2050.news.pipeline-headlines.v1, on the data branch pipeline-news-data),
 * and draws one plain list: date, category, source, the headline as a link, and, where the
 * file gives one, a "Possible match" chip naming a REPD project. An exact-input priority
 * sidecar controls current live order; unavailable/stale ranks fall back to date order.
 *
 * The label is based on collection time and explicit source health, never a claim
 * that an article or underlying project event is new. Valid empty feeds are healthy.
 * Partial collection and saved snapshots are labelled separately.
 *
 * If the live file cannot be read, the copy saved in this folder when the page was built
 * (news/pipeline_headlines.snapshot.json) is shown instead and labelled as a saved copy. If
 * that holds no headlines either, the block says live headlines are not available.
 *
 * A possible match is a name coincidence offered for review. It is never written into the
 * project table. Titles are drawn
 * as text, never as HTML. The MAP link and the project table are not touched.
 */
(function () {
  'use strict';
  var LIVE = 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/dist/pipeline_headlines.json';
  var SNAPSHOT = 'news/pipeline_headlines.snapshot.json';
  var PRIORITY = LIVE.replace(/\.json$/, '.rank.json');
  var SCHEMA = 'globalgrid2050.news.pipeline-headlines.v1';
  var PRIORITY_SCHEMA = 'globalgrid2050.news.headline-priority.v1';
  var PROFILE_SHA256 = '06250f2435088a522d8d25676f31f813165a430df1e19f602bd8baae03961c05';
  var priorities = new WeakMap();
  var MAX_BYTES = 2000000;
  var STALE_MS = 36 * 3600 * 1000;
  var PAGE = 12;
  var CATEGORY = { planning_decision: 'PLANNING DECISION', consent: 'CONSENTED', refusal: 'REFUSED', dco: 'DCO', finance: 'FINANCE',
    construction: 'CONSTRUCTION', energisation: 'ENERGISED', grid: 'GRID', policy: 'POLICY', datacentre: 'DATA CENTRES', other: '' };
  var TECHNOLOGY = { solar: 'SOLAR', wind: 'WIND', offshore_wind: 'OFFSHORE WIND', battery: 'BATTERY', hydro: 'HYDRO', tidal: 'TIDAL' };

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function stamp(iso, withTime) {
    var d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    var day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    if (!withTime) return day;
    return day + ' ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2) + ' UTC';
  }

  /* The label, as a pure function of the file's date, its status and the clock. */
  function label(generatedAt, status, nowMs, source, counts) {
    var when = Date.parse(generatedAt);
    if (source === 'none' || isNaN(when)) return { state: 'unavailable', text: 'Live headlines are not available at the moment.' };
    if (source === 'snapshot') return { state: 'snapshot', text: 'Live source unavailable. Showing a saved snapshot collected ' + stamp(generatedAt, true) + '; its articles may be older.' };
    if (status === 'failed') return { state: 'failed', text: 'Source collection failed at ' + stamp(generatedAt, true) + '. Any displayed headlines were retained from earlier collections.' };
    if (when - nowMs > 300000) return {state:'future',text:'Feed timestamp is ahead of this browser clock. Collection time needs review: ' + stamp(generatedAt, true) + '.'};
    var overdue = nowMs - when > STALE_MS;
    if (status === 'partial') {
      var ok = counts && Number.isInteger(counts.feeds_ok) ? counts.feeds_ok : null;
      var bad = counts && Number.isInteger(counts.feeds_failed) ? counts.feeds_failed : null;
      var coverage = ok !== null && bad !== null ? ' (' + ok + ' sources succeeded, ' + bad + ' failed)' : '';
      return { state: overdue ? 'overdue-partial' : 'partial',
        text: 'Partial source collection' + coverage + '. Feed checked ' + stamp(generatedAt, true)
          + (overdue ? '; refresh is overdue.' : '. Displaying available headlines.') };
    }
    if (overdue) return { state: 'overdue', text: 'Feed last checked ' + stamp(generatedAt, true) + '; refresh is overdue. Article dates may be older.' };
    return { state: 'live', text: 'Feed checked ' + stamp(generatedAt, true) + '. Article dates are shown separately.' };
  }

  function valid(doc) {
    return !!(doc && doc.schema === SCHEMA && Array.isArray(doc.items)
      && doc.items.length <= 200 && doc.items.every(function (item) { return item && typeof item === 'object'
        && typeof item.title === 'string' && item.title.length > 0 && item.title.length <= 300
        && typeof item.link === 'string' && typeof item.source === 'string'; })
      && typeof doc.generated_at === 'string' && !isNaN(Date.parse(doc.generated_at))
      && ['ok', 'partial', 'failed'].indexOf(doc.status) !== -1);
  }

  function getBytes(url, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (bytes) { if (bytes.byteLength > MAX_BYTES) throw new Error('oversize'); return bytes; })
      .then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function decode(bytes) { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  function keys(value, expected) {
    return value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join('|') === expected.slice().sort().join('|');
  }
  function safeLink(value) {
    try {
      if (typeof value !== 'string' || /[\\\s\u0000-\u001f\u007f]/.test(value)) return '';
      var url = new URL(value), host = url.hostname;
      if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443'
        || !/^[a-z0-9.-]+$/.test(host) || host.indexOf('.') < 0 || /(?:^|\.)\d+$/.test(host)
        || /\.(?:local|localhost|internal)$/.test(host)) return '';
      return url.href;
    } catch (_) { return ''; }
  }
  function current(doc, source, nowMs) {
    var age = nowMs - Date.parse(doc.generated_at);
    return source === 'live' && doc.status !== 'failed' && age >= -300000 && age <= STALE_MS;
  }
  async function validatePriority(doc, bytes, sidecar) {
    priorities.delete(doc);
    if (!valid(doc) || !bytes || bytes.byteLength > MAX_BYTES || !globalThis.crypto || !crypto.subtle
      || JSON.stringify(decode(bytes)) !== JSON.stringify(doc)) return false;
    var envelope = ['schema','input_sha256','input_bytes','input_generated_at','input_count','as_of','profile_id','profile_sha256','entries'];
    if (!keys(sidecar, envelope) || sidecar.schema !== PRIORITY_SCHEMA
      || sidecar.profile_id !== 'uk-transition-global-context.v1' || sidecar.profile_sha256 !== PROFILE_SHA256
      || sidecar.input_generated_at !== doc.generated_at || sidecar.as_of !== doc.generated_at
      || sidecar.input_count !== doc.items.length || sidecar.input_bytes !== bytes.byteLength
      || !Array.isArray(sidecar.entries) || sidecar.entries.length !== doc.items.length || doc.items.length > 200
      || !/^[a-f0-9]{64}$/.test(sidecar.input_sha256)) return false;
    var hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
    if (hash !== sidecar.input_sha256) return false;
    var originals = new Map(), seen = new Set(), output = [];
    for (var original of doc.items) {
      if (!safeLink(original.link) || originals.has(original.link)) return false;
      originals.set(original.link, original);
    }
    var fields = ['link','source','title','rank','source_kind','role','topics','freshness_state','uk_context','score','requires_primary_followup','subscription_notice'];
    for (var i = 0; i < sidecar.entries.length; i++) {
      var entry = sidecar.entries[i], item = originals.get(entry && entry.link);
      if (!keys(entry, fields) || !item || seen.has(entry.link) || entry.rank !== i + 1
        || entry.source !== item.source || entry.title !== item.title || !Number.isFinite(entry.score)
        || ['government','regulator','institution','listed_parent','reporting','discovery'].indexOf(entry.source_kind) < 0
        || ['primary_context','discovery_lead','attributed_reporting'].indexOf(entry.role) < 0
        || ['current','unknown','future','stale'].indexOf(entry.freshness_state) < 0
        || typeof entry.uk_context !== 'boolean' || typeof entry.requires_primary_followup !== 'boolean'
        || typeof entry.subscription_notice !== 'boolean' || !Array.isArray(entry.topics)
        || entry.topics.length > 6 || new Set(entry.topics).size !== entry.topics.length
        || entry.topics.some(function (t) { return ['solar','storage','grid','datacentre','wind','renewables'].indexOf(t) < 0; })) return false;
      seen.add(entry.link);
      output.push({item:item, priority:JSON.parse(JSON.stringify(entry))});
    }
    priorities.set(doc, output);
    return true;
  }

  function when(item) { return Date.parse(item.date || item.first_seen || '') || 0; }

  function row(item, priority) {
    var box = el('div', 'ln-item');
    var articleDate = stamp(item.date, false);
    var collectedDate = stamp(item.first_seen, false);
    var dateLabel = articleDate ? 'PUBLISHER DATE ' + articleDate.toUpperCase()
      : (collectedDate ? 'FIRST COLLECTED ' + collectedDate.toUpperCase() : 'ARTICLE DATE UNKNOWN');
    var meta = [dateLabel, CATEGORY[item.category] || '', TECHNOLOGY[item.technology] || '', String(item.source || '')];
    box.appendChild(el('span', 'ln-meta', meta.filter(Boolean).join(' · ')));
    var a = el('a', 'ln-title', String(item.title || ''));
    var safe = safeLink(item.link);
    if (safe) a.href = safe;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    box.appendChild(a);
    if (priority) {
      var sourceLabel = {government:'Government source',regulator:'Regulator source',institution:'Institutional source',listed_parent:'Issuer source',reporting:'Attributed reporting',discovery:'Research lead'}[priority.source_kind];
      var reasons = ['Priority ' + priority.rank, sourceLabel];
      if (priority.topics.length) reasons.push(priority.topics.join(' / ').replace('datacentre','data centres'));
      if (priority.uk_context) reasons.push('UK context');
      if (priority.freshness_state === 'unknown') reasons.push('Publisher date unknown');
      if (priority.freshness_state === 'stale') reasons.push('Older context');
      if (priority.freshness_state === 'future') reasons.push('Future date: review');
      if (priority.subscription_notice) reasons.push('May require subscription');
      box.appendChild(el('span', 'ln-priority', reasons.join(' · ')));
    }
    var m = item.possible_match;
    if (m && /^\d+$/.test(String(m.repd_ref || '')) && m.site_name) {
      var chip = el('span', 'ln-match', 'Possible match: ' + m.site_name + ' (REPD ' + m.repd_ref + ')');
      chip.title = 'Unverified name coincidence; not a confirmed link to a project event; inspect the original publisher.';
      box.appendChild(chip);
    }
    return box;
  }

  function render(doc, source, nowMs) {
    var status = document.getElementById('newsStatus');
    var list = document.getElementById('liveNews');
    if (!status || !list) return;
    var ok = valid(doc);
    var l = label(ok ? doc.generated_at : '', ok ? doc.status : '', nowMs == null ? Date.now() : nowMs,
      ok ? source : 'none', ok ? doc.counts : null);
    status.textContent = l.text;
    status.setAttribute('data-state', l.state);
    status.setAttribute('data-order', 'none');
    list.textContent = '';
    var archive = document.getElementById('newsArchive');
    window.pipelineHeadlineDocument = ok ? doc : null;
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('pipeline-feed-loaded', { detail: ok ? doc : null }));
    if (!ok) { if (archive) archive.open = true; return; }
    if (doc.items.length === 0) {
      list.appendChild(el('p', 'ln-empty', 'No headlines currently meet the feed criteria.'));
      if (doc.scope) list.appendChild(el('p', 'ln-scope', String(doc.scope)));
      return;
    }
    // Exact-input priority only for a current live collection; preserve every credited item.
    var ranked = current(doc, source, nowMs == null ? Date.now() : nowMs) ? priorities.get(doc) : null;
    var items = ranked || doc.items.map(function (it, i) { return {item:it, index:i}; })
      .sort(function (a, b) { return when(b.item) - when(a.item) || a.index - b.index; });
    status.setAttribute('data-order', ranked ? 'priority' : 'date');
    status.textContent += ranked ? ' Research priority considers topic, source type, publication date and publisher variety; it is not project verification.'
      : ' Priority unavailable for this collection; showing date order.';
    var shown = 0;
    var more = el('button', 'ln-more', '');
    more.type = 'button';
    function draw() {
      items.slice(shown, shown + PAGE).forEach(function (entry) { list.insertBefore(row(entry.item, entry.priority), more.parentNode === list ? more : null); });
      shown = Math.min(shown + PAGE, items.length);
      if (shown < items.length) { more.textContent = 'SHOW MORE HEADLINES (' + (items.length - shown) + ')'; if (more.parentNode !== list) list.appendChild(more); }
      else if (more.parentNode === list) list.removeChild(more);
    }
    more.addEventListener('click', draw);
    draw();
    if (doc.scope) list.appendChild(el('p', 'ln-scope', String(doc.scope)));
  }

  function start() {
    window.pipelineHeadlinePriorityState = 'not-requested';
    if (typeof fetch !== 'function') { render(null, 'none'); return; }
    getBytes(LIVE, 6000).then(function (bytes) {
      var doc = decode(bytes);
      if (!valid(doc)) throw new Error('invalid');
      render(doc, 'live');
      window.pipelineHeadlinePriorityState = 'pending';
      // A ranking failure is not a headline-fetch failure and never selects the saved snapshot.
      return getBytes(PRIORITY, 4000).then(function (rankBytes) { return validatePriority(doc, bytes, decode(rankBytes)); })
        .then(function (accepted) {
          if (accepted && window.pipelineHeadlineDocument === doc) render(doc, 'live');
          window.pipelineHeadlinePriorityState = accepted ? 'accepted' : 'rejected';
        })
        .catch(function () { window.pipelineHeadlinePriorityState = 'unavailable'; });
    })
      .catch(function () {
        return getBytes(SNAPSHOT, 6000).then(function (bytes) { var doc = decode(bytes); render(valid(doc) ? doc : null, valid(doc) ? 'snapshot' : 'none'); });
      })
      .catch(function () { render(null, 'none'); });
  }

  // For the release checks: the label rule and the renderer, callable with a document of the same schema.
  window.pipelineHeadlines = { label: label, render: render, valid: valid, schema: SCHEMA, validatePriority: validatePriority, prioritySchema: PRIORITY_SCHEMA };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
