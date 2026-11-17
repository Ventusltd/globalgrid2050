/* GridAtlas data state, shown only on the rows it concerns.
 *
 * The MAP link of every row is untouched: this script never reads, wraps, moves or
 * re-points it. It adds one plain line of text BELOW the row's actions for the rows
 * listed in gridatlas/map_link_state.json: projects whose REPD status is active and
 * whose REPD Ref ID is not in the register GridAtlas holds, each with its reason. On
 * those rows the MAP link still opens the map on the project's own point and measures
 * from it; what does not open there is the project's identity card.
 *
 * The list was measured against one named GridAtlas data generation. Before showing
 * anything the script reads GridAtlas's published composition; if GridAtlas has moved
 * to a different generation of its project search, the measurement no longer applies
 * and nothing is shown. If neither file can be read, nothing is shown.
 */
(function () {
  'use strict';
  var STATE_URL = 'gridatlas/map_link_state.json';
  var COMPOSITION_URL = 'https://ventusltd.github.io/gridatlas/atlas/current.json';
  var refs = null;
  var fallback = 'GRIDATLAS: MAP OPENS ON THE PROJECT POINT · NO PROJECT CARD THERE';

  function getJson(url) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch(url, { cache: 'no-cache', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error(r.status); return r.json(); },
        function (e) { clearTimeout(timer); throw e; });
  }

  function annotate() {
    if (!refs) return;
    var rows = document.querySelectorAll('#tbody tr[id^="repd-"]');
    Array.prototype.forEach.call(rows, function (tr) {
      var text = refs[tr.id.slice(5)];
      if (!text || tr.querySelector('.ga-state')) return;
      var actions = tr.querySelector('.project-actions');
      if (!actions || !actions.parentNode) return;
      var note = document.createElement('div');
      note.className = 'map-note ga-state';
      note.setAttribute('data-feature', 'gridatlas-state');
      note.textContent = text;
      actions.parentNode.appendChild(note);
    });
  }

  function summary(state, checkedLive) {
    var host = document.getElementById('gaStateSummary');
    if (!host) return;
    var b = document.createElement('b');
    b.textContent = 'GRIDATLAS DATA: ';
    host.appendChild(b);
    host.appendChild(document.createTextNode(
      'GridAtlas holds the ' + state.gridatlas_register.dataset + ' register. Of ' + state.active_rows.toLocaleString('en-GB') +
      ' projects here with an active REPD status, ' + state.active_resolved.toLocaleString('en-GB') + ' open with their project card there and ' +
      state.active_not_resolved + ' do not: their MAP link opens the map on the project point only, and each is marked in its row with the reason. ' +
      'Projects with any other status are outside the register GridAtlas keeps. Measured ' + state.measured_at.slice(0, 10) +
      (checkedLive ? '; GridAtlas data generation confirmed when this page loaded.' : '.')));
    host.hidden = false;
  }

  function start() {
    if (typeof fetch !== 'function') return;
    getJson(STATE_URL).then(function (state) {
      if (!state || state.schema !== 'globalgrid2050.pipeline-news.gridatlas-map-link-state.v1') return;
      return getJson(COMPOSITION_URL).then(function (composition) {
        var search = (composition.cartridges || []).filter(function (c) { return c.id === state.gridatlas_project_search.cartridge; })[0];
        return !!search && String(search.generation) === String(state.gridatlas_project_search.generation);
      }).then(function (stillApplies) {
        if (!stillApplies) return;
        refs = {};
        state.active_not_resolved_refs.forEach(function (r) { refs[String(r.repd_ref)] = r.page_note || fallback; });
        summary(state, true);
        annotate();
        var body = document.getElementById('tbody');
        if (body && typeof MutationObserver === 'function') new MutationObserver(annotate).observe(body, { childList: true, subtree: true });
      }, function () { /* GridAtlas composition unreadable: state unknown, show nothing */ });
    }, function () { /* no state file: show nothing */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
