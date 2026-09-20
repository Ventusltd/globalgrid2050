'use strict';
// kuiper-card.js - a cartridge of the Kuiper shell. Cut from the whole page with no change of behaviour;
// replaced, when it is, by a newer file the pointer names and the composer checks by its hash.
// ------------------------------------------------------------------------------ the controls
function toWorld(px, py){ return [cx + (px - innerWidth/2)/zoom, cy - (py - innerHeight/2)/zoom]; }
// A KEY THAT LANDS IN A CARRIED FILE SHOWS THE CODE. Until every commit's file list is published a
// browser cannot work out which file a key belongs to, so the answer is worked out beforehand, one
// public file at a time, and the page simply looks it up. Where there is no card the page says what
// it knows and does not pretend otherwise.
function cardFor(k){ return cards.find(c => k >= c.k0 && k < c.k0 + c.lines) || null; }
function esc(t){ return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const CONTEXT = 10;
// THE ONE RULE THAT MAKES THE ADDRESS OF A LINE ON GITHUB, the same rule tools/cards.py writes
// down, so a change of commit ids can be answered by making every link again from the fields.
// The owner used to be written in here by hand: correct by luck, and wrong the first time a
// carried file came from anywhere else.
// ONE RULE, TWO SHAPES. A whole piece of work is a commit; a line is a path inside it. Nothing in
// this page types a GitHub address: every one of them comes out of here, from data, so when the
// commit ids change they can all be made again by rebuilding the data.
function gh(o){
  if (!o || !o.owner || !o.repo || !o.commit) return null;
  const base = 'https://github.com/' + o.owner + '/' + o.repo;
  if (!o.path) return base + '/commit/' + o.commit;
  return base + '/blob/' + o.commit + '/' + o.path + (o.line ? '#L' + o.line : '');
}
function ghLink(c, line){
  return gh({ owner:c.owner, repo:c.repo, commit:c.commit, path:c.path, line:line });
}
// ===== THE POP CARD =========================================================================
// The card this estate refined over many iterations, brought over rather than approximated again.
// Grid Atlas's popup look, a state chip with ONE writer, and a code window that is one <pre> with
// one text node: the numbers are part of the text, so copying the code copies what is on the
// screen, and the tapped line is marked by a bar placed from the line height.
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls;
  if (text != null) e.textContent = text; return e; }
function drow(dl, k, v){ dl.append(el('dt', null, k)); const d = el('dd', null, v); dl.append(d); return d; }
function linkTo(href, text){ const a = el('a', 'cc-link', text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }
let cardToken = 0, cardSource = null, PG = null, glowBuf = null, glowCount = 0, glowOff = false;
// THE ESTATE'S ONE GATHERING ANIMATION, used as it stands. If it cannot be read the sparks simply stay
// where the work is: the page is quieter, and nothing is pretended.
function show(a){
  cardShown = null;
  if (!a) { closeCard(); return; }
  if (a.silent) {
    const x = a.next, s = sheet('Nothing was recorded here', '');
    s.setTag('EMPTY', 'This point falls between two pieces of work, so no line of code has this address.');
    if (x) { const p = el('div', 'cc-row');
      const go = el('a', 'cc-link', 'Go to the next work: ' + repos[x.repo].name + ', ' + day(x.unix));
      // BESIDE THE ADDRESS BAR, NOT BESIDE THE SHELL. Under the composer the page's base is the shell's own
      // folder, and a bare ?key= would lead there instead of to the one address that never changes.
      go.href = location.pathname + buildLink({ key:x.k0 }); go.setAttribute('data-key', x.k0);
      p.append(go); s.body.append(p); }
    return;
  }
  const r = repos[a.c.repo], c = cardFor(a.k);
  litRepo = a.c.repo;
  const s = sheet('Line ' + fmt(a.k), c ? ' \u00b7 ' + c.path.split('/').pop() : ' \u00b7 ' + r.name);
  // THE ORDER OF THE CARD IS THE ORDER OF THE QUESTIONS A PERSON WHO SIGNS ASKS. What is this for,
  // and where do I open it; whose is it; what was done and when. How it is made comes last and
  // closed, one tap further in, for the engineer who is in the room but does not sign.
  { const found = r.pub ? appFor(r.owner, r.name, c ? c.path : null) : null;
    const det = el('details', 'cc-q'); det.append(el('summary', null, 'See the code behind this'));
    for (const kid of Array.from(card.children)) if (!kid.classList.contains('cc-x')) det.append(kid);
    let top;
    // WHERE TO PUT THE VISITOR. A carried file knows its own page; any other piece of work has the
    // page its files agreed on. Where that page is the application's own front door, the tile is the
    // application's, as before.
    const near = r.pub ? ((c && c.page) || pageOfWork[a.c.sha] || null) : null;
    const theApp = found && found.app ? found.app : null;
    if (near && !(theApp && theApp.live === near.address)) {
      top = el('a', 'cc-tile cc-app cc-page'); top.href = near.address; top.target = '_blank'; top.rel = 'noopener';
      top.setAttribute('data-app', theApp ? theApp.app : ''); top.setAttribute('data-page', near.address);
      if (theApp) top.append(el('div', 'cc-tile-part', 'part of ' + theApp.button));
      top.append(el('div', 'cc-tile-name', near.title || near.address.replace(/^https?:\/\//, '')));
      top.append(el('span', 'cc-tile-open', 'OPEN THIS PAGE'));
    } else if (found && found.app) {
      top = el('a', 'cc-tile cc-app'); top.href = found.app.live; top.target = '_blank'; top.rel = 'noopener';
      top.setAttribute('data-app', found.app.app);
      top.append(el('div', 'cc-tile-name', found.app.button));
      if (whatItDoes[found.app.live]) top.append(el('div', 'cc-tile-what', whatItDoes[found.app.live] + '.'));
      top.append(el('span', 'cc-tile-open', 'OPEN ' + found.app.button));
    } else {
      top = el('div', 'cc-notile cc-app');
      top.setAttribute('data-app', found && found.unproved ? '?' : '');
      top.append(el('div', null, 'This work has no page of its own yet.'));
    }
    // THE LINKS A CARD CARRIES, IN THE OPEN AND IN AS FEW WORDS AS THEY NEED: the application (above),
    // GitHub as one quiet word for those who know what it is, and the site itself whenever there is
    // nothing else to offer, so that no card is ever a dead end.
    const links = el('div', 'cc-row cc-links');
    { const gu = r.pub ? gh({ owner:r.owner, repo:r.name, commit:a.c.sha }) : null;
      if (!near && !(found && found.app)) {
        // the front door of the site this work is served from, where it has one; else the main site
        const door = (r.pub && frontOfWork[a.c.sha]) || 'https://www.globalgrid2050.com/';
        const hl = linkTo(door, door.replace(/^https?:\/\//, '').replace(/\/$/, ''));
        hl.classList.add('cc-home'); links.append(hl); }
      // GITHUB IS HUMBLE: one small grey word at the very bottom of the code fold, for those who know
      // what it is. Never a sentence, and never in the way of a visitor who does not.
      if (gu) { const src = el('div', 'cc-source'); const gl = linkTo(gu, 'source'); gl.classList.add('cc-gh');
        src.append(gl); det.append(src); cardSource = src; } }
    const brand = el('div', 'scada-brand'), inner = el('div');
    inner.append(el('div', 'scada-brand-main', 'Ventus'), el('div', 'scada-brand-sub', 'Cables & Connectivity\u00ae'));
    brand.append(inner);
    const plain = el('div', 'cc-plain', 'Engineering work in ' + r.name + ', done on ' + day(a.c.unix) + '.');
    card.append(top, links, brand, plain, det);
    det.open = codeOpen;
    // ASKED FOR MUST MEAN SEEN. With the tile, the brand and the plain line above it, the code opened
    // below the fold of the card on a phone. Opening it brings the window into view, then the line.
    det.addEventListener('toggle', () => { if (det.open && cardShown && cardShown.window) revealCode(); dirty = true; }); }
  const meta = el('dl', 'cc-dl');
  drow(meta, 'work', r.name + ' \u00b7 ' + day(a.c.unix));
  const u = r.pub ? gh({ owner:r.owner, repo:r.name, commit:a.c.sha }) : null;
  const d = drow(meta, 'history', '');
  if (u) { d.append(linkTo(u, 'source')); d.append(' \u00b7 commit ' + a.c.sha.slice(0, 7)); }
  else d.textContent = 'not public, so there is no link';
  s.body.append(meta);
  if (!c) {
    s.setTag('EMPTY', 'The code for this line is not carried on this site yet, so nothing around it can be shown.');
    return;
  }
  const j = a.k - c.k0;
  s.setTag('LOAD', 'reading the lines around it from this site\u2026');
  const put = data => {
    if (!s.live()) return;
    cardShown = { card:c, line:j, data, sheet:s };
    const short = c.commit.slice(0, 7), fileName = c.path.split('/').pop();
    // THE ARITHMETIC THIS CARD IS ABOUT TO RELY ON, CHECKED BEFORE IT IS RELIED ON. The pack was
    // built from git and every line proved against it when it was built; what can still go wrong
    // here is the pack and the list disagreeing about the length of the file, and then every number
    // below would be a guess.
    if (!c.here || data.lines !== c.lines || data.text.length !== c.lines || !(j >= 0 && j < c.lines)) {
      s.setTag('FAIL', !c.here
        ? 'This file is no longer in the repository, so its neighbours today would not be this line\u2019s neighbours. Nothing around it is shown.'
        : 'The record says this file has ' + fmt(c.lines) + ' lines and the text carried for it has '
          + fmt(data.text.length) + ', so the numbering cannot be trusted. Nothing around it is shown.');
      const h = el('div', 'cc-codehead');
      h.append(c.path + ' \u00b7 ' + c.repo + ' @ ' + short + ' \u00b7 line ' + fmt(j + 1) + ' \u00b7 ');
      h.append(linkTo(ghLink(c, j + 1), 'source'));
      s.body.append(h);
      dirty = true; return;
    }
    const from = Math.max(1, j + 1 - CONTEXT), to = Math.min(data.text.length, j + 1 + CONTEXT);
    const head = el('div', 'cc-codehead');
    head.append(c.path + ' \u00b7 ' + c.repo + ' @ ' + short + ' \u00b7 line ' + fmt(j + 1)
              + ' \u00b7 showing ' + fmt(from) + '\u2013' + fmt(to) + ' of ' + fmt(data.text.length) + ' \u00b7 ');
    head.append(linkTo(ghLink(c, j + 1), 'source'));
    s.body.append(head);
    s.body.append(el('div', 'cc-check',
      'These lines are carried on this site, read from ' + c.repo + ' at commit ' + short
      + ' when this page was built and checked line for line against it then \u00b7 '
      + fmt(j + 1 - from) + ' above, ' + fmt(to - j - 1) + ' below. Scroll inside the window to see them all;'
      + ' a long line scrolls sideways.'));
    const w = codeWindow(data.text, from, to, j + 1);
    s.body.append(w.node);
    cardShown.window = w;
    s.setTag('OK', 'the line and the lines around it, as the file stood that day');
    s.body.append(el('div', 'cc-disclaimer',
      'Provided as is, without warranty of any kind; a chart, not a design.'));
    if (cardSource && cardSource.parentNode) cardSource.parentNode.append(cardSource);
    requestAnimationFrame(() => { if (s.live()) revealCode(); });
    revealCode();
    dirty = true;
  };
  if (cardCache[c.file]) { put(cardCache[c.file]); return; }
  fetch('cosmos/cards/' + c.file).then(x => x.json()).then(dd => { cardCache[c.file] = dd; put(dd); })
    .catch(e => s.setTag('FAIL', 'the lines around this one could not be read from this site: ' + (e && e.message || e)));
}
function goKey(k){ endIsolate(); const p = keyPlace(k); target = { x:p[0], y:p[1] }; show(address(k)); flyTo(p[0], p[1], 14); }
// ARRIVING BY SOMEBODY ELSE'S LINK. The view flies, the arrow is shot, the card opens: three things
// in that order, because a card that appears over a picture of nine thousand pieces of work asks to
// be taken on trust, and an arrow from the middle of the record to one dot does not.
function arriveAt(k){
  endIsolate();
  const a = address(k);
  if (!a) return;
  const p = keyPlace(k);
  target = null; arrow = null; arrowTip = null; card.style.display = 'none';
  flyTo(p[0], p[1], Math.max(14, zoom));
  setTimeout(() => { arrow = { k, t0:performance.now() }; dirty = true; }, 920);
  setTimeout(() => { target = { x:p[0], y:p[1] }; show(a); dirty = true; }, 920 + ARROW_MS);
}
// SHOW NEW CODE. "New" is measured from the newest commit, not from the wall clock, so the same
// page gives the same answer tomorrow. Keys run in time order, so what is new is always one
// contiguous band at the rim: the boundary is a single circle, and that circle is drawn.
function showNew(hours){
  endIsolate();
  const last = commits[commits.length-1].unix, cut = last - hours*3600;
  newFrom = findBy('unix', cut - 1) + (commits[0].unix >= cut ? 0 : 1); if (newFrom >= commits.length) newFrom = commits.length - 1;
  litRepo = -1; target = null; card.style.display = 'none'; tween = null;
  const R = Math.sqrt(SPACE); cx = 0; cy = 0; zoom = (Math.min(cv.width, cv.height)/2) * 0.80 / R;
  anim_hours = hours; anim = { t0:performance.now(), hours, R }; dirty = true;
}
function stepAnim(){
  const t = (performance.now() - anim.t0) / 1000; dirty = true;
  if (t < 1.6) { const u = t/1.6; pulse = anim.R * (u*u*(3-2*u)); flash = 0; }
  else if (t < 2.5) { pulse = -1; flash = 1 - 0.45*((t-1.6)/0.9); if (selftest && selftest.wantPixels === undefined) selftest.wantPixels = true; }
  else { const c = commits[newFrom], n = commits.length - newFrom; let lines = 0; for (let i = newFrom; i < commits.length; i++) lines += commits[i].lines;
    flash = 0.35; anim = null; const p = keyPlace(c.k0); target = { x:p[0], y:p[1], boundary:true };
    card.style.display = 'block';
    { const r0 = repos[c.repo], u0 = r0.pub ? gh({ owner:r0.owner, repo:r0.name, commit:c.sha }) : null;
      card.classList.remove('sheet');
      card.innerHTML = 'NEW CODE · the last ' + anim_hours + ' hours of work, as a band at the rim'
        + '\n<b>' + fmt(n) + '</b> pieces of work, <b>' + fmt(lines) + '</b> lines added'
        + '\nbegins with <b>' + r0.name + '</b>, ' + day(c.unix)
        + (u0 ? '\n<a class="cc-gh" style="color:#666;font-size:10.5px" href="' + u0 + '" target="_blank" rel="noopener">GitHub</a>' : ''); }
    flyTo(p[0], p[1], 14);
    if (selftest) finishSelftest(c, n, lines); }
}
let anim_hours = 24;
// THE TESTS, run by the page on itself with ?selftest=new, so the verdict is not an opinion.
