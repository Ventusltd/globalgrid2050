/* Nearest data centre, in the PROJECT RECORD of each row.
 *
 * Reads convergence/nearest_datacentre.json (one row per REPD Ref ID, from the REPD and
 * data-centre convergence build) and convergence/datacentres.json (the 226 sites of the UK
 * data-centre register, with the register's own id, point precision, MW fields and source
 * entries). Each row's PROJECT RECORD gains one entry: the nearest register site, the
 * straight-line distance, the register's id, MW fields and source, the count of register
 * sites within 10, 25 and 50 km, and a link that opens GridAtlas at the register point.
 *
 * What this is not. It is screening context: a straight-line distance between two published
 * points, not a grid connection, capacity or relationship. The register point of some sites
 * is a settlement-level approximation; those are labelled and their distance is rounded.
 * The GridAtlas link opens the map at a location; it does not open a data-centre record.
 * A data centre is never given a REPD Ref ID. The row's MAP link is not read or changed.
 * If the files cannot be read the entry says so instead of showing nothing.
 */
(function () {
  'use strict';
  var ATLAS = 'https://ventusltd.github.io/gridatlas/atlas/';
  var byRef = null, noPoint = null, sites = null, failed = false;

  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function el(tag, text) { var n = document.createElement(tag); if (text != null) n.textContent = text; return n; }
  function mw(v) { return Number(v).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + ' MW'; }

  function siteMw(s) {
    var parts = [];
    if (s.it_load_mw != null) parts.push('IT load ' + mw(s.it_load_mw) + ' (demand)');
    if (s.grid_connection_mw != null) parts.push('grid connection ' + mw(s.grid_connection_mw) + ' (as stated by the source)');
    if (s.unclassified_mw != null) parts.push(mw(s.unclassified_mw) + ' (' + (s.unclassified_mw_label || 'unlabelled in the register') + ')');
    return parts.length ? parts.join(', ') : 'MW not stated in the register';
  }

  function siteSource(s) {
    var seen = {}, out = [];
    (s.sources || []).forEach(function (x) {
      var t = (x.dataset || 'source not named') + ', ' + (x.licence || 'licence not recorded') + ' (licence status ' + (x.licence_status || 'not recorded') + ')';
      if (!seen[t]) { seen[t] = true; out.push(t); }
    });
    return out.length ? 'register source: ' + out.join('; ') : 'register source not carried';
  }

  function entry(ref) {
    var box = el('div');
    box.setAttribute('data-feature', 'nearest-datacentres');
    box.appendChild(el('b', 'NEAREST DATA CENTRE · STRAIGHT LINE'));
    var span = el('span');
    box.appendChild(span);
    if (failed) {
      box.setAttribute('data-state', 'unavailable');
      span.textContent = 'Data-centre context could not be loaded; nothing is shown for this project.';
      return box;
    }
    var row = byRef[ref];
    var site = row ? sites[row[1]] : null;
    if (!row || !site || !/^dcuk-[0-9a-f]{16}$/.test(row[1])) {
      box.setAttribute('data-state', 'not-measured');
      span.textContent = noPoint[ref] ? 'Not measured: the convergence build holds no usable point for this REPD record.' : 'Not measured for this record.';
      return box;
    }
    var exact = site.precision === 'exact_site';
    box.setAttribute('data-state', exact ? 'exact-site' : 'approximate');
    box.setAttribute('data-dc-id', row[1]);
    var km = exact ? Number(row[4]).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + ' km'
      : 'about ' + Math.round(Number(row[4])).toLocaleString('en-GB') + ' km (the register point for this site is a ' + String(site.precision).replace(/_/g, ' ') + '-level approximation, not the site itself)';
    span.appendChild(document.createTextNode(
      row[2] + ' · ' + String(row[3]).replace(/_/g, ' ') + ' · ' + km + ' · register id ' + row[1] +
      ' · ' + siteMw(site) + ' · register sites within 10 / 25 / 50 km: ' + row[5] + ' / ' + row[6] + ' / ' + row[7] +
      ' · ' + siteSource(site) + ' · '));
    if (site.proximity_reliable && site.lat != null && site.lon != null) {
      var a = el('a', exact ? 'OPEN THIS LOCATION IN GRIDATLAS ↗' : 'OPEN THE APPROXIMATE LOCATION IN GRIDATLAS ↗');
      a.className = 'dc-site-link';
      a.target = '_blank';
      a.rel = 'noopener';
      a.href = ATLAS + '?latitude=' + encodeURIComponent(site.lat) + '&longitude=' + encodeURIComponent(site.lon) + '&zoom=' + (exact ? 13 : 11) + '&project=' + encodeURIComponent(row[2]);
      span.appendChild(a);
      span.appendChild(document.createTextNode(' (map position only: the link does not open a data-centre record; data centres are in the Offtakers layer there) · '));
    }
    var all = el('a', 'ALL DATA CENTRES');
    all.href = '../datacentres/';
    span.appendChild(all);
    span.appendChild(document.createTextNode(' · screening distance between published points, not a grid connection · © OpenStreetMap contributors (ODbL 1.0); contains public sector information (OGL v3.0); licence status unverified at source'));
    return box;
  }

  function annotate() {
    if (!byRef && !failed) return;
    var rows = document.querySelectorAll('#tbody tr[id^="repd-"]:not([data-technology="interconnector"])');
    Array.prototype.forEach.call(rows, function (tr) {
      var grid = tr.querySelector('details.project-record .record-grid');
      if (!grid || grid.querySelector('[data-feature="nearest-datacentres"]')) return;
      grid.appendChild(entry(tr.id.slice(5)));
    });
  }

  function watch() {
    annotate();
    var body = document.getElementById('tbody');
    if (body && typeof MutationObserver === 'function') new MutationObserver(annotate).observe(body, { childList: true, subtree: true });
  }

  function start() {
    if (typeof fetch !== 'function') return;
    Promise.all([getJson('convergence/nearest_datacentre.json'), getJson('convergence/datacentres.json')]).then(function (docs) {
      var near = docs[0], dc = docs[1];
      if (near.schema !== 'globalgrid2050.convergence.pipelinenews-datacentre-context.v1' || near.columns[0] !== 'repd_ref' || near.columns[1] !== 'nearest_dc_id' ||
          near.columns[4] !== 'nearest_dc_km' || near.columns[7] !== 'dcs_within_50km' || dc.schema !== 'globalgrid2050.pipeline-news.datacentre-sites.v1') throw new Error('schema');
      var map = {}, none = {}, s = {};
      near.rows.forEach(function (r) { map[String(r[0])] = r; });
      (near.no_coordinates || []).forEach(function (r) { none[String(r)] = true; });
      dc.sites.forEach(function (x) { s[x.id] = x; });
      byRef = map; noPoint = none; sites = s;
    }).catch(function () { failed = true; }).then(watch);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
