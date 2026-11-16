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
        url: uri, published: String(item.date || ''), observed: String(item.first_seen || '')
      });
    });
    document.querySelectorAll('.machine-note-button').forEach(function (b) {
      b.textContent = notes.has(String(b.dataset.noteRef)) ? 'READ BRIEF' : 'NO EVIDENCE';
    });
    window.dispatchEvent(new Event('machine-notes-updated'));
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
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('.machine-note-button') : null;
    if (b) open(b);
  });
  if (window.pipelineHeadlineDocument) load(window.pipelineHeadlineDocument);
})();
