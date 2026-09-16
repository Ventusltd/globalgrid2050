/* THE FIRST VERB.
 *
 * Until now the wafer could be looked at and, since 202609160207, read. Both are
 * things you do TO it. This is the first thing you can do WITH it.
 *
 * WHY SELECTING AND NAMING IS NOT A SMALL FEATURE. A function family in this
 * estate is, in the numbered database's own terms, exactly this:
 *
 *     { name, kind, lines[] }
 *
 * A name, and a set of permanent line keys. Nothing else. So gathering some
 * lines and giving them a name is not a note stuck on top of the code — it is
 * the same shape as the thing the estate already calls a function. Someone who
 * cannot write a line of JavaScript can still say THESE LINES, TOGETHER, ARE A
 * THING, AND IT IS CALLED THIS. That sentence is the whole of the mission: an
 * idea expressed by a person who cannot code, in a form a machine already
 * understands, because the keys are the machine's own vocabulary.
 *
 * WHY THE URL IS THE DOCUMENT. A set is written into the address bar and nowhere
 * else — ?name=...&set=k,k,k. There is no account, no database, no save button
 * and nothing stored in this browser. That is not a simplification, it is the
 * point: the address IS the artefact, so it can be pasted to a person, pasted to
 * an AI, put in a commit message or read back a year later, and it will resolve
 * to the same lines, because a key is permanent and its position is a pure
 * function of itself. A human clicks pixels; a model writes numbers; the URL
 * they produce is identical. That is what "the UI and the code as the same
 * language" has to mean if it means anything.
 *
 * WHAT IS DELIBERATELY NOT CLAIMED. A named set is NOT a function family. It has
 * not been observed in any repository, nothing checked that these lines sit
 * together in any file, and the estate has not issued it a number. It is a
 * proposal made by whoever made it. The card says so, because a set that looked
 * like a family would be a lie of exactly the kind this codebase keeps catching:
 * a claim that describes only what it looked at.
 */

import { fmt, esc, place } from './lib.mjs';

const MAX_SET = 200;          /* a set beyond this is not a thought, it is a file */

export const SET = { name: '', keys: [] };

const $ = id => document.getElementById(id);

/* ── the URL is the document ─────────────────────────────────────────────── */

/* Keys are written in the order they were gathered, because order is the one
   thing about a set its maker chose. It is never sorted behind their back. */
export function readURL() {
  const p = new URLSearchParams(location.search);
  const raw = p.get('set');
  if (!raw) return false;
  const keys = [];
  for (const part of raw.split(',')) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0 && !keys.includes(n)) keys.push(n);
    if (keys.length >= MAX_SET) break;
  }
  SET.keys = keys;
  SET.name = (p.get('name') || '').slice(0, 80);
  return keys.length > 0;
}

export function writeURL() {
  const p = new URLSearchParams(location.search);
  if (SET.keys.length) { p.set('set', SET.keys.join(',')); if (SET.name) p.set('name', SET.name); else p.delete('name'); }
  else { p.delete('set'); p.delete('name'); }
  const q = p.toString();
  history.replaceState(null, '', q ? location.pathname + '?' + q : location.pathname);
}

export const shareURL = () => location.href;

/* ── the set ─────────────────────────────────────────────────────────────── */

export function has(key) { return SET.keys.includes(key); }

export function toggle(key) {
  const i = SET.keys.indexOf(key);
  if (i >= 0) SET.keys.splice(i, 1);
  else if (SET.keys.length < MAX_SET) SET.keys.push(key);
  else return false;
  writeURL();
  return true;
}

export function clear() { SET.keys = []; SET.name = ''; writeURL(); }

/* ── drawing the set on the wafer ────────────────────────────────────────────
   A selected line is ringed where it sits. Positions come from the placement
   law, not from anything stored, so a set pasted from a URL lights up in the
   right places before a single byte of its text has been fetched. */
export function drawSet(ctx, view) {
  if (!SET.keys.length) return;
  const z = view.zoom, ox = view.w / 2 - view.x * z, oy = view.h / 2 + view.y * z;
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#ffd166';
  ctx.fillStyle = 'rgba(255,209,102,0.14)';
  ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i < SET.keys.length; i++) {
    const [wx, wy] = place(SET.keys[i]);
    const x = wx * z + ox, y = oy - wy * z;
    if (x < -30 || y < -30 || x > view.w + 30 || y > view.h + 30) continue;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.2832); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(String(i + 1), x, y - 11);
    ctx.fillStyle = 'rgba(255,209,102,0.14)';
  }
  ctx.restore();
}

/* ── the card ────────────────────────────────────────────────────────────── */

export function mountCard() {
  const el = document.createElement('section');
  el.id = 'setcard';
  el.hidden = true;
  el.innerHTML =
    `<div class="sethead">
       <input id="setname" type="text" placeholder="name this set…" maxlength="80" aria-label="a name for this set of lines">
       <button id="setclear" type="button" title="empty the set">clear</button>
     </div>
     <div id="setlines"></div>
     <div class="setfoot">
       <button id="setcopy" type="button">copy the link to this set</button>
       <p id="setnote" class="dim"></p>
     </div>`;
  document.body.appendChild(el);

  $('setname').addEventListener('input', e => { SET.name = e.target.value.slice(0, 80); writeURL(); paintNote(); });
  $('setclear').addEventListener('click', () => { clear(); render(); });
  $('setcopy').addEventListener('click', async () => {
    const btn = $('setcopy');
    try { await navigator.clipboard.writeText(shareURL()); btn.textContent = 'link copied — paste it to a person or a model'; }
    catch { btn.textContent = 'copy failed — the link is in the address bar'; }
    setTimeout(() => { btn.textContent = 'copy the link to this set'; }, 2600);
  });
  return el;
}

function paintNote() {
  const n = SET.keys.length;
  setText($('setnote'),
    !n ? '' :
    `${fmt(n)} line${n === 1 ? '' : 's'}${SET.name ? ` named “${SET.name}”` : ', unnamed'}. ` +
    `This set is a proposal, not a function family: nothing has checked that these lines sit together in any file, ` +
    `and the estate has issued it no number. It lives only in the address bar — no account, nothing stored here.`);
}

const setText = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };

/* The set, with each line's code read one at a time. `getText` is the wafer's
   reader, passed in so this file fetches nothing itself. */
export async function render(getText) {
  const card = $('setcard');
  if (!card) return;
  card.hidden = SET.keys.length === 0;
  if (!SET.keys.length) { $('setlines').replaceChildren(); paintNote(); return; }
  if ($('setname').value !== SET.name) $('setname').value = SET.name;
  paintNote();

  const host = $('setlines');
  host.innerHTML = '<ol class="setlist">' + SET.keys.map((k, i) =>
    `<li data-key="${k}"><span class="setn">${i + 1}</span>` +
    `<button type="button" class="setgo" data-key="${k}"><span class="n">${fmt(k)}</span>` +
    `<code data-code="${k}">reading…</code></button>` +
    `<button type="button" class="setdrop" data-key="${k}" aria-label="remove line ${k} from the set">×</button></li>`
  ).join('') + '</ol>';

  if (!getText) return;
  for (const k of SET.keys.slice()) {
    const cell = host.querySelector(`code[data-code="${k}"]`);
    if (!cell) continue;
    const got = await getText(k);
    if (!cell.isConnected) continue;
    if (got.text === null) { cell.className = 'refuse'; cell.textContent = got.why; }
    else cell.textContent = got.text === '' ? '(an empty line)' : got.text;
  }
}
