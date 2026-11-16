/* Live headlines for the news block.
 *
 * Reads the headlines file a scheduled workflow refreshes several times a day
 * (schema globalgrid2050.news.pipeline-headlines.v1, on the data branch pipeline-news-data),
 * and draws one plain list: date, category, source, the headline as a link, and, where the
 * file gives one, a "Possible match" chip naming a REPD project. Newest first, always.
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
 * project table. Clicking the chip searches the table for that REPD Ref ID. Titles are drawn
 * as text, never as HTML. The MAP link and the project table are not touched.
 */
(function () {
  'use strict';
  var LIVE = 'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/pipeline-news-data/dist/pipeline_headlines.json';
  var SNAPSHOT = 'news/pipeline_headlines.snapshot.json';
  var SCHEMA = 'globalgrid2050.news.pipeline-headlines.v1';
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
      && typeof doc.generated_at === 'string' && !isNaN(Date.parse(doc.generated_at))
      && ['ok', 'partial', 'failed'].indexOf(doc.status) !== -1);
  }

  function getJson(url, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function when(item) { return Date.parse(item.date || item.first_seen || '') || 0; }

  function row(item) {
    var box = el('div', 'ln-item');
    var articleDate = stamp(item.date, false);
    var collectedDate = stamp(item.first_seen, false);
    var dateLabel = articleDate ? 'PUBLISHER DATE ' + articleDate.toUpperCase()
      : (collectedDate ? 'FIRST COLLECTED ' + collectedDate.toUpperCase() : 'ARTICLE DATE UNKNOWN');
    var meta = [dateLabel, CATEGORY[item.category] || '', TECHNOLOGY[item.technology] || '', String(item.source || '')];
    box.appendChild(el('span', 'ln-meta', meta.filter(Boolean).join(' · ')));
    var a = el('a', 'ln-title', String(item.title || ''));
    if (/^https:\/\//.test(String(item.link || ''))) a.href = item.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    box.appendChild(a);
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
    list.textContent = '';
    var archive = document.getElementById('newsArchive');
    window.pipelineHeadlineDocument = ok ? doc : null;
    window.dispatchEvent(new CustomEvent('pipeline-feed-loaded', { detail: ok ? doc : null }));
    if (!ok) { if (archive) archive.open = true; return; }
    if (doc.items.length === 0) {
      list.appendChild(el('p', 'ln-empty', 'No headlines currently meet the feed criteria.'));
      if (doc.scope) list.appendChild(el('p', 'ln-scope', String(doc.scope)));
      return;
    }
    // Newest first, whatever order the file arrived in; equal times keep the file's order.
    var items = doc.items.filter(function (it) {
      return it.category !== 'policy' && !/\b(politics|political|election campaign)\b/i.test(String(it.title || ''));
    }).map(function (it, i) { return [it, i]; })
      .sort(function (a, b) { return when(b[0]) - when(a[0]) || a[1] - b[1]; }).map(function (p) { return p[0]; });
    var shown = 0;
    var more = el('button', 'ln-more', '');
    more.type = 'button';
    function draw() {
      items.slice(shown, shown + PAGE).forEach(function (it) { list.insertBefore(row(it), more.parentNode === list ? more : null); });
      shown = Math.min(shown + PAGE, items.length);
      if (shown < items.length) { more.textContent = 'SHOW MORE HEADLINES (' + (items.length - shown) + ')'; if (more.parentNode !== list) list.appendChild(more); }
      else if (more.parentNode === list) list.removeChild(more);
    }
    more.addEventListener('click', draw);
    draw();
    if (doc.scope) list.appendChild(el('p', 'ln-scope', String(doc.scope)));
  }

  function start() {
    if (typeof fetch !== 'function') { render(null, 'none'); return; }
    getJson(LIVE, 6000).then(function (doc) { if (!valid(doc)) throw new Error('invalid'); render(doc, 'live'); })
      .catch(function () {
        return getJson(SNAPSHOT, 6000).then(function (doc) { render(valid(doc) ? doc : null, valid(doc) ? 'snapshot' : 'none'); });
      })
      .catch(function () { render(null, 'none'); });
  }

  // For the release checks: the label rule and the renderer, callable with a document of the same schema.
  window.pipelineHeadlines = { label: label, render: render, valid: valid, schema: SCHEMA };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
