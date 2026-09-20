'use strict';
// kuiper-chrome.js - a cartridge of the Kuiper shell: HOW THE PAGE IS DRESSED. What sits over the disc,
// and how much of it. The shell is never edited, so the dressing lives here, where it can be changed.
//
// THE MINIMAL FACE. A title in the corner of a picture of the work cheapens the picture: the box in the
// top left (the word KUIPER, and "Tap a dot. Press an app.") is gone at every width, and the long row of
// key hints in the foot is gone with it, along with the question mark that was there to unfold it.
// What stays under the disc is the row of applications, the four commands, and ONE small grey note at the
// very bottom, a watermark rather than a paragraph: "provided as is, without warranty of any kind; a
// chart, not a design". That line is never lost, at any width, because it is the only claim the page makes.
// ON A PHONE the seven applications are back on the screen themselves, with no chip to press first: the
// box in the corner paid for the room they take.
// Nothing here invents a look: the same colours, the same font, the same black sky, fewer words.
(function(){
  const css = document.createElement('style');
  css.textContent = `
  #top{display:none !important}
  #foot .long{display:none !important}
  #keys button.q{display:none !important}
  #foot .short{display:block;margin-top:7px;font-size:10px;letter-spacing:.02em;line-height:1.4;color:var(--dim)}
  @media (max-width:640px){
    #foot{padding:6px 10px}
    #apps{gap:5px;margin-bottom:5px}
    #apps button{padding:6px 7px;font-size:10px;letter-spacing:.03em}
    #keys{flex-wrap:nowrap;gap:4px;margin-bottom:0}
    #keys button{padding:7px 6px;font-size:10px;letter-spacing:.02em;white-space:nowrap}
    #foot .short{margin-top:5px;font-size:9.5px;line-height:1.35}
  }`;
  document.head.appendChild(css);
  // THE WORDS GO, NOT ONLY THEIR PIXELS. A sentence set to display:none is still read back by anything
  // that asks the page what it says, so the two lines nobody asked for are taken out of the page. The
  // one word in #big stays: it is the page's name, and the checks ask the box for it.
  for (const sel of ['#use', '#foot .long', '#keys button.q']) {
    const el = document.querySelector(sel); if (el && el.remove) el.remove(); }
  // the foot is a little shorter now, so the disc is re-fitted into what is left rather than left as it was
  if (typeof layout === 'function') layout();
  if (typeof atHome !== 'undefined' && atHome && typeof homeCamera === 'function' && typeof SPACE !== 'undefined' && SPACE) {
    const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; tween = null; }
  if (typeof dirty !== 'undefined') dirty = true;
})();
