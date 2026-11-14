/* Register changes: what moved in the REPD between the July and October 2026 releases.
 *
 * Reads events/register_changes.json (the register-change events whose REPD Ref ID is in
 * this page's list). Adds (1) one section below the newspaper listing the highest-scored
 * changes, each with a button that searches the table for that REPD Ref ID, and (2) one
 * entry in the PROJECT RECORD of each row that has a change.
 *
 * These are register events, not news stories: every line is generated from REPD fields.
 * The row's MAP link is not read, moved or changed. If the file cannot be read, nothing
 * is added.
 */
(function () {
  'use strict';
  var SHOWN = 12;
  var byRef = null;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function day(iso) {
    var d = iso ? new Date(iso + 'T00:00:00Z') : null;
    return d && !isNaN(d) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase() : 'DATE NOT GIVEN';
  }
  function kind(t) { return String(t || '').replace(/_/g, ' '); }

  function showInTable(ref) {
    var input = document.getElementById('search');
    if (!input) return;
    input.value = ref;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    var table = document.querySelector('.tablewrap');
    if (table && table.scrollIntoView) table.scrollIntoView({ block: 'start' });
  }

  function style() {
    var s = el('style');
    s.textContent = '.reg-changes .rc-list{display:grid;grid-template-columns:1fr 1fr}' +
      '.rc-item{padding:12px 14px;border-bottom:1px solid #1b1f25;border-right:1px solid #1b1f25;background:#07090c;min-width:0}' +
      '.rc-kicker{display:block;color:#7f8996;font-size:10px;font-weight:bold}' +
      '.rc-title{display:block;color:#fff;font-size:13px;line-height:1.3;margin:5px 0 6px}' +
      '.rc-item button{font:inherit;font-size:10px;font-weight:bold;background:none;border:1px solid #39424e;color:var(--accent,#0ff);padding:4px 8px;cursor:pointer}' +
      '.rc-more{padding:12px 14px;color:var(--muted,#a6adbb);font-size:11px}' +
      '@media(max-width:768px){.reg-changes .rc-list{grid-template-columns:1fr}.rc-item{border-right:0}}';
    document.head.appendChild(s);
  }

  function section(doc) {
    var anchor = document.getElementById('dcNews') || document.querySelector('section.newspaper');
    if (!anchor || document.getElementById('regChanges')) return;
    style();
    var sec = el('section', 'newspaper reg-changes');
    sec.id = 'regChanges';
    sec.setAttribute('data-feature', 'project-events');
    sec.setAttribute('aria-label', 'Register changes');
    var head = el('div', 'masthead');
    var h2 = el('h2', null, 'REGISTER CHANGES: ');
    h2.appendChild(el('span', null, 'JULY TO OCTOBER 2026 REPD'));
    head.appendChild(h2);
    var strap = el('div', 'strap');
    strap.appendChild(el('span', null, 'Changes found by comparing two official REPD releases · register events, not news stories · a status change is dated by the register and can lag the decision'));
    strap.appendChild(el('span', null, doc.events_in_this_version + ' CHANGES ON ' + doc.projects_with_an_event + ' PROJECTS IN THIS LIST · HIGHEST SCORED FIRST'));
    head.appendChild(strap);
    sec.appendChild(head);
    var list = el('div', 'rc-list');
    doc.events.slice(0, SHOWN).forEach(function (e) {
      var item = el('div', 'rc-item');
      item.appendChild(el('span', 'rc-kicker', kind(e.type) + ' · ' + day(e.date) + ' · REPD ' + e.ref));
      item.appendChild(el('span', 'rc-title', e.headline));
      var b = el('button', null, 'SHOW IN TABLE');
      b.type = 'button';
      b.addEventListener('click', function () { showInTable(e.ref); });
      item.appendChild(b);
      list.appendChild(item);
    });
    sec.appendChild(list);
    sec.appendChild(el('div', 'rc-more', 'Every project with a change carries it in its PROJECT RECORD in the table below.'));
    anchor.parentNode.insertBefore(sec, anchor.nextSibling);
  }

  function annotate() {
    if (!byRef) return;
    var rows = document.querySelectorAll('#tbody tr[id^="repd-"]:not([data-technology="interconnector"])');
    Array.prototype.forEach.call(rows, function (tr) {
      var events = byRef[tr.id.slice(5)];
      var grid = tr.querySelector('details.project-record .record-grid');
      if (!events || !grid || grid.querySelector('[data-feature="register-change"]')) return;
      var box = el('div');
      box.setAttribute('data-feature', 'register-change');
      box.appendChild(el('b', null, 'REGISTER CHANGE · JULY TO OCTOBER 2026'));
      box.appendChild(el('span', null, events.map(function (e) { return kind(e.type) + ' (' + day(e.date) + '): ' + e.headline; }).join(' · ')));
      grid.appendChild(box);
    });
  }

  function start() {
    if (typeof fetch !== 'function') return;
    fetch('events/register_changes.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (doc) {
      if (doc.schema !== 'globalgrid2050.pipeline-news.register-changes.v1' || !Array.isArray(doc.events) || !doc.events.length) return;
      var map = {};
      doc.events.forEach(function (e) { (map[e.ref] = map[e.ref] || []).push(e); });
      byRef = map;
      // The data-centre panel, when present, is inserted asynchronously; wait briefly so this section sits below it.
      setTimeout(function () { section(doc); }, 1500);
      annotate();
      var body = document.getElementById('tbody');
      if (body && typeof MutationObserver === 'function') new MutationObserver(annotate).observe(body, { childList: true, subtree: true });
    }, function () { /* file unreadable: add nothing */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
