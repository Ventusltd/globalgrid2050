/* V9.23: candidate-only Machine Read Notes. No original article is republished. */
(function () {
  'use strict';
  var notes = new Map();
  var dialog;
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function originalLink(raw) {
    try { var u = new URL(String(raw)); return u.protocol === 'https:' ? u.href : null; }
    catch (_) { return null; }
  }
  function headlineSummaryV923(item) {
    var kind = {
      refusal: 'REFUSAL REPORTED',
      consent: 'CONSENT REPORTED',
      planning_decision: 'PLANNING DECISION REPORTED',
      construction: 'CONSTRUCTION REPORTED',
      finance: 'FINANCING REPORTED',
      grid: 'GRID UPDATE REPORTED',
      energisation: 'ENERGISATION REPORTED',
      dco: 'DCO UPDATE REPORTED',
      datacentre: 'DATA CENTRE UPDATE REPORTED'
    }[item.category] || 'PROJECT HEADLINE';
    var d = new Date(item.published);
    var date = Number.isNaN(d.getTime()) ? 'DATE UNKNOWN' :
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
    return kind + ' · ' + date;
  }
  function shortHeadlineV923(item) {
    // First ten source-title words only, never publisher article text.
    var raw = String(item.title || '').replace(/\s+/g, ' ').trim();
    if (!raw) return 'Headline details available at original source';
    var words = raw.split(' ');
    return words.slice(0, 10).join(' ') + (words.length > 10 ? '…' : '');
  }
  function latestTime(item) {
    var t = Date.parse(item.published || item.observed || '');
    return Number.isFinite(t) ? t : 0;
  }
  function load(doc) {
    notes.clear();
    if (doc && Array.isArray(doc.items)) doc.items.forEach(function (item) {
      var match = item.possible_match;
      if (!match || !/^\d+$/.test(String(match.repd_ref || ''))) return;
      if (item.category === 'policy' || /\b(politics|political|election campaign)\b/i.test(String(item.title || ''))) return;
      var uri = originalLink(item.link);
      if (!uri) return;
      var id = String(match.repd_ref);
      if (!notes.has(id)) notes.set(id, []);
      notes.get(id).push({
        title: String(item.title || ''), publisher: String(item.source || 'Publisher not stated'),
        url: uri, category: String(item.category || 'other'),
        published: String(item.date || ''), observed: String(item.first_seen || '')
      });
    });
    // The first line is useful before any click: short event and publisher date.
    // Never turn an algorithmic name association into an official REPD decision.
    notes.forEach(function (events) { events.sort(function (a, b) {
      return latestTime(b) - latestTime(a) || a.title.localeCompare(b.title);
    }); });
    updateVisibleNotes();
    window.dispatchEvent(new Event('machine-notes-updated'));
  }
  function updateVisibleNotes() {
    document.querySelectorAll('.machine-note-button').forEach(function (b) {
      var items = notes.get(String(b.dataset.noteRef)) || [];
      if (items.length) {
        b.replaceChildren(
          el('span', 'machine-note-kind', 'POSSIBLE · ' + headlineSummaryV923(items[0])),
          el('span', 'machine-note-headline', shortHeadlineV923(items[0]))
        );
      } else {
        b.textContent = 'NO MATCHED HEADLINE';
      }
      b.setAttribute('aria-label', items.length
        ? 'Possible, unverified project headline: ' + headlineSummaryV923(items[0])
          + '. ' + shortHeadlineV923(items[0]) + '. Open evidence brief'
        : 'No matched project headline. Open evidence state');
      b.title = items.length ? 'POSSIBLE MATCH · ' + items[0].publisher + ' · verify at original source'
        : 'No independently evidenced project headline';
      b.dataset.noteCandidate = items.length ? 'possible' : 'none';
    });
  }
  function panel() {
    if (dialog) return dialog;
    dialog = el('dialog', 'machine-note-dialog');
    dialog.setAttribute('aria-labelledby', 'machineNoteTitle');
    var close = el('button', 'machine-note-close', 'CLOSE');
    close.type = 'button';
    close.addEventListener('click', function () { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); });
    var title = el('h2', null, 'Machine-originated Pipeline Intelligence Brief');
    title.id = 'machineNoteTitle';
    dialog.append(close, title);
    var body = el('div', 'machine-note-body');
    body.id = 'machineNoteBody';
    dialog.appendChild(body);
    document.body.appendChild(dialog);
    return dialog;
  }
  function open(button) {
    var dlg = panel(), body = document.getElementById('machineNoteBody');
    body.replaceChildren();
    var ref = String(button.dataset.noteRef || '');
    var events = notes.get(ref) || [];
    body.appendChild(el('p', 'machine-note-stamp', events.length ?
      'CANDIDATE — NOT INDEPENDENTLY VERIFIED' : 'INSUFFICIENT EVIDENCE'));
    body.appendChild(el('p', null, 'REPD ' + ref + ' · ' + String(button.dataset.noteName || 'Project')));
    body.appendChild(el('p', null, 'OFFICIAL SOURCE STATUS · ' + String(button.dataset.noteStatus || 'Unknown')));
    if (!events.length) {
      body.appendChild(el('p', null, 'No adequate matched headline evidence is currently available. The official source remains unchanged.'));
    } else {
      body.appendChild(el('p', null, 'Machine assessment: a headline may relate to this named project. This is an unverified screening lead, not a new official status or an independently accepted project decision. Check the source and exact REPD binding before relying on it.'));
      events.slice(0, 5).forEach(function (event) {
        var entry = el('section', 'machine-note-source');
        entry.appendChild(el('p', null, event.publisher + ' · PUBLISHED ' + (event.published || 'not independently established') +
          ' · FIRST OBSERVED ' + (event.observed || 'unknown')));
        var a = el('a', null, event.title || 'Publisher headline');
        a.href = event.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        entry.appendChild(a); body.appendChild(entry);
      });
      body.appendChild(el('p', null, 'Evidence receipt, owner independence, rights and exact REPD identity association: NOT VERIFIED.'));
    }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.querySelector('.machine-note-close').focus();
  }
  window.pipelineMachineNotes = { has: function (ref) { return notes.has(String(ref)); } };
  window.addEventListener('pipeline-feed-loaded', function (ev) { load(ev.detail); });
  window.addEventListener('pipeline-projects-rendered', updateVisibleNotes);
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('.machine-note-button') : null;
    if (b) open(b);
  });
  if (window.pipelineHeadlineDocument) load(window.pipelineHeadlineDocument);
})();
