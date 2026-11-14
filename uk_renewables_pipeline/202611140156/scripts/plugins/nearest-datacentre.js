/* Nearest data centre, in the PROJECT RECORD of each row.
 *
 * Reads convergence/nearest_datacentre.json (one row per REPD Ref ID, from the REPD and
 * data-centre convergence build) and convergence/datacentres.json (the 226 register sites).
 * When a row's PROJECT RECORD is present it gains one entry: the nearest register site with
 * its straight-line distance, the register's own id and MW fields, the count of register
 * sites within 10, 25 and 50 km, and a link that opens GridAtlas on that site, where the
 * Offtakers layer lists the substations, REPD projects and power stations around it.
 *
 * This is screening context: a straight-line distance between two published points. It is
 * not a grid connection and says nothing about capacity. The row's MAP link is not read,
 * moved or changed. If either file cannot be read, nothing is added.
 */
(function () {
  'use strict';
  var ATLAS = 'https://ventusltd.github.io/gridatlas/atlas/';
  var byRef = null, noPoint = null, sites = null;

  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function el(tag, text) { var n = document.createElement(tag); if (text != null) n.textContent = text; return n; }
  function mw(v) { return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + ' MW'; }

  function siteMw(s) {
    var parts = [];
    if (s.it_load_mw != null) parts.push('IT load ' + mw(s.it_load_mw));
    if (s.grid_connection_mw != null) parts.push('grid connection ' + mw(s.grid_connection_mw));
    if (s.unclassified_mw != null) parts.push(mw(s.unclassified_mw) + ' (' + (s.unclassified_mw_label || 'unlabelled in the register') + ')');
    return parts.length ? parts.join(', ') : 'MW not stated in the register';
  }

  function entry(ref) {
    var box = el('div');
    box.setAttribute('data-feature', 'nearest-datacentres');
    box.appendChild(el('b', 'NEAREST DATA CENTRE · STRAIGHT LINE'));
    var span = el('span');
    var row = byRef[ref];
    if (!row) {
      span.textContent = noPoint[ref] ? 'Not measured: this REPD record has no usable map point.' : 'Not measured for this record.';
      box.appendChild(span);
      return box;
    }
    var site = sites[row[1]] || {};
    span.appendChild(document.createTextNode(
      row[2] + ' · ' + row[3] + ' · ' + Number(row[4]).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + ' km · register id ' + row[1] +
      ' · ' + siteMw(site) + ' · register sites within 10 / 25 / 50 km: ' + row[5] + ' / ' + row[6] + ' / ' + row[7] + ' · '));
    if (site.proximity_reliable && site.lat != null && site.lon != null) {
      var a = el('a', 'OPEN THIS SITE IN GRIDATLAS ↗');
      a.className = 'dc-site-link';
      a.target = '_blank';
      a.rel = 'noopener';
      a.href = ATLAS + '?latitude=' + encodeURIComponent(site.lat) + '&longitude=' + encodeURIComponent(site.lon) + '&zoom=13&project=' + encodeURIComponent(row[2]);
      span.appendChild(a);
      span.appendChild(document.createTextNode(' (switch on Offtakers there for nearby substations, REPD projects and power stations) · '));
    }
    var all = el('a', 'ALL DATA CENTRES');
    all.href = '../datacentres/';
    span.appendChild(all);
    span.appendChild(document.createTextNode(' · screening distance between published points, not a grid connection'));
    box.appendChild(span);
    return box;
  }

  function annotate() {
    if (!byRef) return;
    var rows = document.querySelectorAll('#tbody tr[id^="repd-"]:not([data-technology="interconnector"])');
    Array.prototype.forEach.call(rows, function (tr) {
      var grid = tr.querySelector('details.project-record .record-grid');
      if (!grid || grid.querySelector('[data-feature="nearest-datacentres"]')) return;
      grid.appendChild(entry(tr.id.slice(5)));
    });
  }

  function start() {
    if (typeof fetch !== 'function') return;
    Promise.all([getJson('convergence/nearest_datacentre.json'), getJson('convergence/datacentres.json')]).then(function (docs) {
      var near = docs[0], dc = docs[1];
      if (near.schema !== 'globalgrid2050.convergence.pipelinenews-datacentre-context.v1' || near.columns[0] !== 'repd_ref' || near.columns[4] !== 'nearest_dc_km' || near.columns[7] !== 'dcs_within_50km') return;
      if (dc.schema !== 'globalgrid2050.pipeline-news.datacentre-sites.v1') return;
      var map = {}, none = {}, s = {};
      near.rows.forEach(function (r) { map[String(r[0])] = r; });
      (near.no_coordinates || []).forEach(function (r) { none[String(r)] = true; });
      dc.sites.forEach(function (x) { s[x.id] = x; });
      byRef = map; noPoint = none; sites = s;
      annotate();
      var body = document.getElementById('tbody');
      if (body && typeof MutationObserver === 'function') new MutationObserver(annotate).observe(body, { childList: true, subtree: true });
    }, function () { /* files unreadable: add nothing */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
