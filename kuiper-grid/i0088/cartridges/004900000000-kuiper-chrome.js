'use strict';
// kuiper-chrome.js - a cartridge of the Kuiper shell: HOW THE PAGE IS DRESSED. What sits over the disc,
// and how much of it. The shell is never edited, so the dressing lives here, where it can be changed.
//
// THE MINIMAL FACE, FINISHED. 0044 took the box out of the top left corner and the long row of key hints
// out of the foot. Vikram, 20 September 04:05: "ALL CLUTTER TEXT AND BUTTON GONE, USE POP UP FOR
// EVERYTHING". The applications and the list of tests moved into the pop-up in the part beside this one;
// what is left on the face, and goes here, is:
//
//   1. THE ROW OF VIEW BUTTONS in the foot (new code, random line, find, whole view). Every one of them is
//      in the pop-up now, under THE VIEW, so the row is a second copy of four controls. It is hidden and
//      marked as hidden, rather than removed, because the shell attached its own listener to that element
//      and a page that removed it would take the keyboard shortcuts with it.
//   2. THE STATE BOX IN THE TOP RIGHT CORNER, which read "ISOLATED - TESTS - 2 pieces of work lit - 9,938
//      dark - 19 Sep 2026 to 19 Sep 2026" over the picture at all times. It is not deleted: it is the only
//      place the page has to REFUSE in, and a refusal must always be seen. So it is silent while it is
//      saying what is on the screen, and it comes back the moment it has something to refuse. Its words are
//      untouched, so the page's own checks still read them.
//
// What stays: the disc, one empty bar, and ONE small grey note at the very bottom - "provided as is,
// without warranty of any kind; a chart, not a design". That line is never lost, at any width, because it
// is the only claim the page makes, and every answer card repeats it.
// Nothing here invents a look: the same colours, the same font, the same black sky, fewer words.
(function(){
  const css = document.createElement('style');
  css.textContent = `
  #top{display:none !important}
  #foot .long{display:none !important}
  #keys{display:none !important}
  #foot .short{display:block;margin-top:7px;font-size:10px;letter-spacing:.02em;line-height:1.4;color:var(--dim)}
  @media (max-width:640px){
    #foot{padding:6px 10px}
    #foot .short{margin-top:5px;font-size:9.5px;line-height:1.35}
  }`;
  document.head.appendChild(css);
  // THE WORDS GO, NOT ONLY THEIR PIXELS. A sentence set to display:none is still read back by anything
  // that asks the page what it says, so the two lines nobody asked for are taken out of the page. The
  // one word in #big stays: it is the page's name, and the checks ask the box for it.
  for (const sel of ['#use', '#foot .long']) {
    const el = document.querySelector(sel); if (el && el.remove) el.remove(); }
  // the row of view buttons is kept in the page for the shell's own listener, and hidden from eyes and
  // from anything that reads the page aloud, because every one of those four is in the pop-up
  const keys = document.getElementById('keys');
  if (keys) keys.setAttribute('aria-hidden', 'true');
  // THE CORNER IS SILENT UNTIL IT HAS SOMETHING TO REFUSE. The shell writes into #hud both what is on the
  // screen (which the picture already says) and, rarely, why it will not draw (which nothing else says).
  // Only the second kind is shown. The text itself is never changed.
  const hudEl = document.getElementById('hud');
  if (hudEl) {
    const REFUSAL = /REFUSED|CONTEXT LOST|not available|did not load|will not invent|Nothing on screen/i;
    const judge = () => { const said = hudEl.textContent || '';
      hudEl.style.visibility = REFUSAL.test(said) ? 'visible' : 'hidden'; };
    judge();
    try { new MutationObserver(judge).observe(hudEl, { childList:true, characterData:true, subtree:true }); } catch (_) {}
  }
  // the foot is a little shorter now, so the disc is re-fitted into what is left rather than left as it was
  if (typeof layout === 'function') layout();
  if (typeof atHome !== 'undefined' && atHome && typeof homeCamera === 'function' && typeof SPACE !== 'undefined' && SPACE) {
    const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; tween = null; }
  if (typeof dirty !== 'undefined') dirty = true;
})();
