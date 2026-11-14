/* Data centres: capex and politics. A self-contained panel for the Pipeline News page.
 *
 * Reads datacentre_news.json (schema globalgrid2050.news.datacentre-capex-politics.v1), written daily by
 * .github/workflows/datacentre-news.yml to the branch datacentre-news-data, with the same file under the site's
 * own /dist/ as a fallback. If neither loads, or the file is not the expected schema, nothing is shown: the
 * panel is never inserted and the rest of the page is untouched. Headlines and links only; no article text.
 * The panel adds one section after the newspaper and changes no other element, so it can be dropped into any
 * release folder by adding one <script defer> tag.
 */
(function () {
  'use strict';
  var SOURCES = [
    'https://raw.githubusercontent.com/Ventusltd/globalgrid2050/datacentre-news-data/dist/datacentre_news.json',
    '../../dist/datacentre_news.json'
  ];
  var SCHEMA = 'globalgrid2050.news.datacentre-capex-politics.v1';
  var PER_LANE = 8;
  var LANES = [['capex', 'CAPEX · INVESTMENT'], ['politics', 'POLITICS · POLICY']];

  function fetchJson(url) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);
    return fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        if (!d || d.schema !== SCHEMA || !Array.isArray(d.items)) throw new Error('schema');
        return d;
      }, function (e) { clearTimeout(timer); throw e; });
  }

  function firstAvailable(i) {
    if (i >= SOURCES.length) return Promise.reject(new Error('no source'));
    return fetchJson(SOURCES[i]).catch(function () { return firstAvailable(i + 1); });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function day(iso) {
    if (!iso) return 'DATE NOT GIVEN';
    var d = new Date(iso);
    if (isNaN(d)) return 'DATE NOT GIVEN';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
  }

  function mw(v) { return Math.round(v).toLocaleString('en-GB'); }

  function siteLine(s) {
    var t = 'REGISTER: ' + (s.name || s.id);
    var r = s.repd_nearby;
    if (r) {
      t += ' · REPD ≤' + r.radius_km + ' KM: ' + r.projects + ' PROJECTS, ' + mw(r.mw_stated) + ' MW STATED';
      if (r.projects_mw_unknown) t += ' (+' + r.projects_mw_unknown + ' WITH MW UNKNOWN)';
    } else {
      t += ' · NO RELIABLE POINT FOR REPD CONTEXT';
    }
    return t;
  }

  function story(item) {
    var a = el('a', 'dcn-item');
    if (/^https:\/\//.test(item.link)) a.href = item.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(el('span', 'dcn-kicker', (item.source || '') + ' · ' + day(item.date)));
    a.appendChild(el('span', 'dcn-title', item.title || ''));
    (item.sites || []).slice(0, 2).forEach(function (s) { a.appendChild(el('span', 'dcn-site', siteLine(s))); });
    if ((item.site_matches || 0) > 2) a.appendChild(el('span', 'dcn-site', '+' + (item.site_matches - 2) + ' MORE REGISTER SITES'));
    return a;
  }

  function style() {
    var css = '.dc-news .dcn-cols{display:grid;grid-template-columns:1fr 1fr}' +
      '.dcn-col{border-right:1px solid #252a31;min-width:0}.dcn-col:last-child{border-right:0}' +
      '.dcn-col h3{font-size:11px;letter-spacing:1px;padding:10px 14px;border-bottom:1px solid #252a31;color:var(--accent,#0ff)}' +
      '.dcn-col[data-lane=capex] h3{color:var(--solar,#ff0)}' +
      '.dcn-item{display:block;padding:12px 14px;border-bottom:1px solid #1b1f25;text-decoration:none;background:#07090c}' +
      '.dcn-item:hover{background:#0b0f14}.dcn-kicker{display:block;color:#7f8996;font-size:10px;font-weight:bold}' +
      '.dcn-title{display:block;color:#fff;font-size:14px;line-height:1.3;margin:5px 0 3px}' +
      '.dcn-site{display:block;color:var(--ok,#0f8);font-size:9px;font-weight:bold;margin-top:3px}' +
      '.dcn-empty{padding:14px;color:var(--muted,#a6adbb);font-size:11px}' +
      '.dc-news .news-tools{position:static}.dc-news .dcn-tabs{display:none}' +
      '@media(max-width:768px){.dc-news .dcn-tabs{display:flex}.dc-news .dcn-cols{grid-template-columns:1fr}' +
      '.dcn-col{border-right:0}.dc-news[data-tab=capex] .dcn-col[data-lane=politics],' +
      '.dc-news[data-tab=politics] .dcn-col[data-lane=capex]{display:none}.dcn-title{font-size:13px}}';
    var s = el('style');
    s.id = 'dcn-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function render(d) {
    var anchor = document.querySelector('section.newspaper') || document.querySelector('.meta');
    if (!anchor || document.getElementById('dcNews')) return;
    style();
    var sec = el('section', 'newspaper dc-news');
    sec.id = 'dcNews';
    sec.setAttribute('data-tab', 'capex');
    sec.setAttribute('aria-label', 'Data centres: capex and politics');
    var head = el('div', 'masthead');
    var h2 = el('h2', null, 'DATA CENTRES: ');
    h2.appendChild(el('span', null, 'CAPEX AND POLITICS'));
    head.appendChild(h2);
    var strap = el('div', 'strap');
    var c = d.counts || {};
    strap.appendChild(el('span', null, 'Headlines and links from public feeds · sites named in a headline are joined to the UK data-centre register · REPD figures are straight-line context, not connections'));
    strap.appendChild(el('span', null, 'UPDATED ' + day(d.generated_at) + ' · ' + (c.items || d.items.length) + ' HEADLINES · ' + (c.feeds_ok != null ? c.feeds_ok + ' FEEDS OK' : '')));
    head.appendChild(strap);
    sec.appendChild(head);

    var tabs = el('div', 'news-tools dcn-tabs');
    LANES.forEach(function (l, i) {
      var b = el('button', i === 0 ? 'active' : '', l[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        sec.setAttribute('data-tab', l[0]);
        Array.prototype.forEach.call(tabs.children, function (x) { x.classList.toggle('active', x === b); });
      });
      tabs.appendChild(b);
    });
    sec.appendChild(tabs);

    var cols = el('div', 'dcn-cols');
    LANES.forEach(function (l) {
      var col = el('div', 'dcn-col');
      col.setAttribute('data-lane', l[0]);
      col.appendChild(el('h3', null, l[1]));
      var list = d.items.filter(function (it) { return (it.lanes || []).indexOf(l[0]) >= 0; }).slice(0, PER_LANE);
      if (!list.length) col.appendChild(el('div', 'dcn-empty', 'No headlines in this lane yet.'));
      list.forEach(function (it) { col.appendChild(story(it)); });
      cols.appendChild(col);
    });
    sec.appendChild(cols);
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  }

  function start() {
    if (typeof fetch !== 'function') return;
    firstAvailable(0).then(function (d) { if (d.items.length) render(d); }, function () { /* quiet: no panel */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
