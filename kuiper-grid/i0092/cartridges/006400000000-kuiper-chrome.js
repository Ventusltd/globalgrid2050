'use strict';
// kuiper-chrome.js - a cartridge of the Kuiper shell: HOW THE PAGE IS DRESSED. What sits over the disc,
// and how much of it. The shell is never edited, so the dressing lives here, where it can be changed.
//
// THE DRAWING FIRST. Vikram, 20 September, looking at his phone: "Can't even see the drawing!", then
// "The drawing should show first. All else should be in the pop up command selector and layout changes
// commands. Keep the view minimalist like the Kuiper, Wafer and Gridatlas", and "Module measurements in
// boxes in tools, not in the drawing". One question decides every line below: ON A 390 PIXEL PHONE, DOES
// THE PICTURE OF BOXES JOINED BY CABLES GET MORE OF THE SCREEN.
//
// WHAT IS ON THE FACE, and nothing else:
//   1. the drawing, edge to edge;
//   2. ONE scrollable row of short chips in the top left - never three rows of wrapped chips;
//   3. one thin RED line across the very top for a solar answer (the whole wording is in the pop-up);
//   4. ONE key line above the bar, with "more", instead of six pinned lines under the drawing;
//   5. one grey foot line, and one bar holding a plain name.
// Everything else - the examples picker, the presets, the declared inputs as number boxes, the answer
// and its figures, the applications, and the LAYOUT CHANGE COMMANDS - is in THE WAFER'S OWN WINDOW,
// which is the pop-up: a bottom sheet on a phone, the draggable window on a desk, CLOSED BY DEFAULT.
//
// NOTHING HERE IS A RIVAL COMPONENT. "You've killed the preset wafer lifted popup bar" was said once and
// is not going to be said again: #pilot, #pin, #eg, #egs, #presets and #say are the wafer's own parts,
// built by the programs cartridge, and this file only MOVES them, DRESSES them and HOOKS them. The
// examples picker is not rebuilt, it is carried into the sheet. The window is not replaced, it is
// restyled. The number boxes are not rebuilt, they are moved into groups, so every listener that was on
// them is still on them. Not one of the wafer's ids, classes or handlers is taken away.
//
// HOW IT HOOKS WITHOUT TOUCHING ANOTHER CARTRIDGE. Classic scripts share one global scope, so the parts
// the programs cartridge declares at the top level - sayOpen, sldShapes, fireLive, reFire, shapeBand,
// stringDrawing, stringNearView, stringWholeView - are reachable from here by name. Three are wrapped:
//   sayOpen       so a fired answer NEVER opens itself over the drawing; the answer chip pulses once.
//   shapeBand     so the band the drawing is laid into stops at the top of the sheet, not under it.
//   stringDrawing so the measurements come off the picture and live in the boxes and the answer.
// Each wrapper calls the original first and changes nothing it computes.
(function () {
  const PHONE = () => innerWidth <= 700;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, t) => { const e = document.createElement(tag); if (cls) e.className = cls; if (t !== undefined) e.textContent = t; return e; };
  const kick = () => { try { if (typeof dirty !== 'undefined') dirty = true; } catch (_) {} };
  const relayout = () => { try { if (typeof layout === 'function') layout(); } catch (_) {} kick(); };

  // ---- the look ---------------------------------------------------------------------------------
  const css = document.createElement('style');
  css.textContent = `
  /* what 0044 took off the face, still off it */
  #top{display:none !important}
  #foot .long{display:none !important}
  #keys{display:none !important}
  #foot .short{display:block;margin-top:6px;font-size:10px;letter-spacing:.02em;line-height:1.4;color:var(--dim)}
  html,body{overflow-x:hidden}

  /* THE CHIPS: ONE ROW, WHICH SCROLLS. Eight chips wrapped into three rows and took the top fifth of a
     phone screen away from the drawing. They are one line now, short names that carry the difference,
     and a finger drags along them. */
  #presets{top:24px !important;left:10px !important;flex-wrap:nowrap !important;overflow-x:auto;overflow-y:hidden;
    max-width:calc(100% - 20px) !important;padding-bottom:2px;scrollbar-width:none;-ms-overflow-style:none;
    -webkit-overflow-scrolling:touch;z-index:19}
  #presets::-webkit-scrollbar{display:none}
  #presets button{flex:0 0 auto;white-space:nowrap}
  #presets button.konly{border-color:#3b4760;color:#cfe3f2}
  #chipapps{display:none}
  #chipanswer{border-color:#5ec8f2 !important;color:#cfe3f2 !important}
  #chipanswer.pulse{animation:kpulse 1s ease-out 1}
  @keyframes kpulse{0%{box-shadow:0 0 0 0 #5ec8f2aa}70%{box-shadow:0 0 0 9px #5ec8f200}100%{box-shadow:0 0 0 0 #5ec8f200}}

  /* THE RED LINE IS ONE THIN LINE ACROSS THE TOP, not a paragraph pinned under the picture. It carries
     the short wording; the whole sentence is the first thing inside the pop-up. It is never hidden, at
     any zoom and under any window, because it is the only thing on this page that must always be read. */
  #sldnames span.danger{position:fixed;left:0 !important;right:0 !important;top:0 !important;
    width:auto !important;max-width:none !important;transform:none !important;visibility:visible !important;
    text-align:center !important;padding:2px 8px;font-size:9.5px !important;line-height:1.4;letter-spacing:0 !important;
    background:#160b0a;border-bottom:1px solid #4a2019;
    white-space:nowrap !important;overflow:hidden;text-overflow:ellipsis}

  /* THE KEY, COLLAPSED. The pinned lines under the drawing become one line above the bar with "more". */
  html.kquiet #sldnames span.pinned:not(.danger){display:none !important}
  html.knokey #sldnames span.pinned:not(.danger){display:none !important}
  #keyline{display:none;align-items:baseline;gap:8px;font:10.5px/1.4 ui-monospace,Menlo,Consolas,monospace;
    color:#8b93a7;padding:0 0 5px;border-bottom:1px solid #141a26;margin-bottom:5px}
  #keyline.on{display:flex}
  #keyline span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #keyline button{flex:none;background:none;border:0;color:#5ec8f2;font:inherit;text-decoration:underline;cursor:pointer;padding:2px 0}

  /* THE BAR */
  #pilot{margin-top:6px;padding-top:6px}

  /* THE POP-UP. On a phone it is a bottom sheet: it covers at most the lower 60 per cent, it sits ABOVE
     the bar so the bar can still be typed in, the drawing stays whole above it, and a tap outside shuts
     it. Collapsed it is the title bar alone, at the bottom, where it cannot cover the chips. */
  /* ONE SCROLLER, NOT TWO. The tools and the answer are one column that scrolls together: two boxes
     each with their own bar, fighting over the same height, showed the tools cut off at their heading
     and half the answer at once. The window itself scrolls now, the way a sheet does. */
  #say.open{overflow-y:auto !important;overflow-x:hidden}
  #say #kt{flex:0 0 auto;overflow:visible;max-height:none}
  #say #saybody{flex:0 0 auto;overflow:visible;min-height:0}
  #say #saybar{position:sticky;top:0;z-index:2}
  #kt{padding:.5rem .7rem;border-bottom:1px solid #1b2030;background:#0c1017}
  #say.min #kt{display:none}
  #kt #eg{margin:0 0 6px;border:0;background:none;padding:0}
  #kt #eg select{align-self:stretch;width:auto;max-width:none;min-height:34px}
  #kt details{border-top:1px solid #141a26;padding:4px 0 2px}
  #kt summary{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;
    color:#8b93a7;cursor:pointer;padding:3px 0;list-style:none}
  #kt summary::-webkit-details-marker{display:none}
  #kt summary::before{content:'+ ';color:#5ec8f2}
  #kt details[open] summary::before{content:'− ';color:#5ec8f2}
  #kt .krow{display:flex;flex-wrap:wrap;gap:5px;margin:3px 0 5px}
  #kt .klab{font:10px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;
    color:#5b6377;width:100%;margin:2px 0 0}
  #kt button{font:11px/1.6 ui-monospace,Menlo,Consolas,monospace;color:#8b93a7;background:#0b0e14;
    border:1px solid #232a3a;border-radius:4px;padding:3px 9px;cursor:pointer}
  #kt button:hover,#kt button:focus-visible{color:#e6e9f0;border-color:#4a5573;outline:none}
  #kt button.on{color:#eaf6ff;border-color:#5ec8f2}
  #kt p.kdim{margin:.2rem 0;font-size:11px;color:#5b6377;line-height:1.45}
  #kt .kkey p{margin:.25rem 0;font-size:11px;color:#8b93a7;line-height:1.45}

  /* the declared inputs, grouped, so twenty-eight boxes are not one wall */
  #saybody details.kbox{border-top:1px solid #141a26;padding:2px 0}
  #saybody details.kbox summary{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;
    text-transform:uppercase;color:#8b93a7;cursor:pointer;padding:4px 0;list-style:none}
  #saybody details.kbox summary::-webkit-details-marker{display:none}
  #saybody details.kbox summary::before{content:'+ ';color:#5ec8f2}
  #saybody details.kbox[open] summary::before{content:'− ';color:#5ec8f2}

  @media (max-width:700px){
    #foot{padding:6px 10px}
    #foot .short{margin-top:4px;font-size:9px;line-height:1.3}
    #presets{top:20px !important;gap:5px}
    #presets button{min-height:28px;padding:2px 8px;font-size:10.5px}
    #pilot input{min-height:42px}
    #sldnames span.danger{font-size:8px !important;padding:1px 6px}
    #say.open:not(.max){left:0 !important;right:0 !important;top:auto !important;
      bottom:var(--footh) !important;width:100% !important;min-width:0;
      max-height:56vh !important;height:auto !important;transform:none !important;
      border-radius:10px 10px 0 0;border-left:0;border-right:0;resize:none}
  }`;
  document.head.appendChild(css);

  // THE WORDS GO, NOT ONLY THEIR PIXELS. A sentence set to display:none is still read back by anything
  // that asks the page what it says, so the two lines nobody asked for are taken out of the page.
  for (const sel of ['#use', '#foot .long']) { const e = document.querySelector(sel); if (e && e.remove) e.remove(); }
  { const keys = $('keys'); if (keys) keys.setAttribute('aria-hidden', 'true'); }
  // THE CORNER IS SILENT UNTIL IT HAS SOMETHING TO REFUSE.
  { const hudEl = $('hud');
    if (hudEl) {
      const REFUSAL = /REFUSED|CONTEXT LOST|not available|did not load|will not invent|Nothing on screen/i;
      const judge = () => { const said = hudEl.textContent || '';
        hudEl.style.visibility = REFUSAL.test(said) ? 'visible' : 'hidden'; };
      judge();
      try { new MutationObserver(judge).observe(hudEl, { childList: true, characterData: true, subtree: true }); } catch (_) {}
    } }

  // ===============================================================================================
  // Everything below needs the wafer's own parts, which the programs cartridge builds on
  // DOMContentLoaded; its listener was registered first, so it has run by the time this one does.
  // ===============================================================================================
  function boot() {
    const sayEl = $('say'), body2 = $('saybody'), foot = $('foot'), pin = $('pin'), eg = $('eg'), chips = $('presets');
    if (!sayEl || !body2 || !pin) return;                        // nothing to dress: leave the page alone

    // NUMBERS ARE OFF THE PICTURE. "Module measurements in boxes in tools, not in the drawing." Every
    // figure is in the number boxes and in the answer; the picture carries what a wiring drawing is.
    let numbersOn = false, keyOn = true, haveAnswer = false;

    // ---- the pop-up is the wafer's window, and it is CLOSED unless somebody asked for it ---------
    const isOpen = () => sayEl.classList.contains('open');
    const shut = () => { sayEl.classList.remove('open', 'max', 'min'); applyKey(); relayout(); };
    const loosen = () => { sayEl.style.left = ''; sayEl.style.top = ''; sayEl.style.width = '';
      sayEl.style.maxHeight = ''; sayEl.style.transform = ''; };
    const openSheet = (title, toAnswer) => {
      if (title) { const t = $('saytitle'); if (t) t.textContent = title; }
      sayEl.classList.remove('min');
      if (PHONE()) loosen();                                     // the sheet's place is in the stylesheet
      sayEl.classList.add('open');
      applyKey(); relayout();
      try { if (window.__placeSay && !PHONE()) window.__placeSay(); } catch (_) {}
      // ASKED FOR THE ANSWER, SHOWN THE ANSWER. The tools are above it in the one scroll, so a reader
      // who tapped the answer chip is put at the answer and scrolls UP to the tools, not down past them.
      sayEl.scrollTop = toAnswer ? Math.max(0, (kt.offsetTop || 0) + (kt.offsetHeight || 0) - 4) : 0;
    };

    // ---- THE TOOLS: the picker, the layout change commands, the key, the applications ------------
    // They live BETWEEN the title bar and the body, because the body is written again on every answer
    // and a tool that an answer wipes is not a tool.
    const kt = el('div'); kt.id = 'kt';
    sayEl.insertBefore(kt, body2);
    if (eg) kt.append(eg);                                      // the wafer's own examples picker, carried, not rebuilt
    kt.append(el('p', 'kdim', 'Pick a preset above, or type a few plain words in the bar and press Enter.'));

    // WHAT A LAYOUT COMMAND IS: a change to the drawing that happens AT ONCE, in place, with the camera
    // where the reader left it - no flying home and gathering again for a different routing. Every one
    // is a first-class entry: a plain name, a button here, and it can be typed in the bar.
    const refire = (extra) => {
      try {
        if (typeof fireLive === 'undefined' || !fireLive || !fireLive.boxes) {
          const first = chips && chips.querySelector('button');   // nothing fired yet: fire the first preset
          if (!first) return false;
          first.click();
          setTimeout(() => { try { reFire(extra); } catch (_) {} }, 500);
          return true;
        }
        reFire(extra);
        return true;
      } catch (_) { return false; }
    };
    const camera = (fn) => { try { fn(); } catch (_) {} kick(); return true; };

    const COMMANDS = [
      ['wiring sequential', 'the wiring', 'sequential', () => refire({ routing: 'one-after-another' })],
      ['wiring u', 'the wiring', 'U', () => refire({ routing: 'serpentine', turn_alternate_rows: 1 })],
      ['wiring leapfrog', 'the wiring', 'leapfrog', () => refire({ routing: 'leapfrog', turn_every_second: 0 })],
      ['wiring turned', 'the wiring', 'turned', () => refire({ routing: 'leapfrog', turn_every_second: 1 })],
      ['table one high', 'the table', '1 high', () => refire({ modules_high: 1 })],
      ['table two high', 'the table', '2 high', () => refire({ modules_high: 2 })],
      ['table three high', 'the table', '3 high', () => refire({ modules_high: 3 })],
      ['table four high', 'the table', '4 high', () => refire({ modules_high: 4 })],
      ['portrait', 'the table', 'portrait', () => refire({ orientation: 'portrait' })],
      ['landscape', 'the table', 'landscape', () => refire({ orientation: 'landscape' })],
      ['back of modules', 'the view', 'back of modules', () => refire({ view: 'wiring' })],
      ['to scale', 'the view', 'to scale', () => refire({ view: 'scale' })],
      ['near end', 'the view', 'near end', () => camera(() => stringNearView())],
      ['whole string', 'the view', 'whole string', () => camera(() => stringWholeView())],
      ['numbers on', 'on the picture', 'numbers on', () => { numbersOn = true; applyMarks(); return true; }],
      ['numbers off', 'on the picture', 'numbers off', () => { numbersOn = false; applyMarks(); return true; }],
      ['key on', 'on the picture', 'key on', () => { keyOn = true; applyKey(); return true; }],
      ['key off', 'on the picture', 'key off', () => { keyOn = false; applyKey(); return true; }]
    ];

    const layoutBox = el('details'); layoutBox.open = true;
    layoutBox.append(el('summary', null, 'layout change commands'));
    let group = null;
    for (const [name, family, words, run] of COMMANDS) {
      if (!group || group.dataset.family !== family) {
        group = el('div', 'krow'); group.dataset.family = family;
        group.append(el('p', 'klab', family)); layoutBox.append(group);
      }
      const b = el('button', null, words); b.type = 'button'; b.title = name; b.dataset.cmd = name;
      b.addEventListener('click', e => { e.stopPropagation(); run(); markState(); });
      group.append(b);
    }
    kt.append(layoutBox);

    // THE KEY IN FULL, where there is room to read it. One line of it stays on the face.
    const keyBox = el('details'); keyBox.append(el('summary', null, 'the key'));
    const keyBody = el('div', 'kkey'); keyBox.append(keyBody); kt.append(keyBox);

    // THE APPLICATIONS, through the page's own chip, so there is one path to them and not two.
    { const row = el('div', 'krow');
      const b = el('button', null, 'the applications'); b.type = 'button';
      b.addEventListener('click', e => { e.stopPropagation(); const c = $('chipapps'); if (c) c.click(); openSheet(); });
      const h = el('button', null, 'help'); h.type = 'button';
      h.addEventListener('click', e => { e.stopPropagation(); pin.value = 'help';
        pin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); pin.value = ''; openSheet(); });
      row.append(b, h); kt.append(row); }

    function markState() {
      for (const b of kt.querySelectorAll('button[data-cmd]')) {
        const n = b.dataset.cmd;
        const on = (n === 'numbers on' && numbersOn) || (n === 'numbers off' && !numbersOn)
                || (n === 'key on' && keyOn) || (n === 'key off' && !keyOn);
        b.classList.toggle('on', !!on);
      }
    }

    // ---- THE CHIPS: one row, a few short names, and the answer ----------------------------------
    // The programs cartridge draws these, and draws them again when the published list lands, so they
    // are put back after each of its redraws. Nothing of its own is removed: the applications chip is
    // only taken off the face, and it is still the thing that opens the applications.
    const HOW_MANY = () => (PHONE() ? 5 : 8);
    let mine = null, answerChip = null;
    function fixChips() {
      if (!chips) return;
      const own = Array.from(chips.children).filter(b => b.id !== 'chipapps' && b !== mine && b !== answerChip);
      own.forEach((b, i) => { b.style.display = i < HOW_MANY() ? '' : 'none'; });
      if (!mine) { mine = el('button', 'konly', 'commands'); mine.type = 'button'; mine.id = 'chipmore';
        mine.title = 'every preset, every layout change and every input';
        mine.addEventListener('click', e => { e.stopPropagation(); openSheet(haveAnswer ? null : 'commands'); }); }
      if (!answerChip) { answerChip = el('button', 'konly', 'answer'); answerChip.type = 'button'; answerChip.id = 'chipanswer';
        answerChip.style.display = 'none';
        answerChip.addEventListener('click', e => { e.stopPropagation(); openSheet(null, true); }); }
      // only when they are not already the last two, or this would be a mutation that calls itself
      if (mine.parentNode !== chips || chips.lastElementChild !== answerChip) chips.append(mine, answerChip);
    }
    fixChips();
    try { new MutationObserver(fixChips).observe(chips, { childList: true }); } catch (_) {}

    // ---- THE BAR: a plain name, and the way into the pop-up --------------------------------------
    pin.placeholder = 'tap here for the commands';                // no JSON, no pre-typed sentence
    pin.addEventListener('focus', () => openSheet(haveAnswer ? null : 'commands'));
    // A LAYOUT COMMAND CAN BE TYPED. The bar's own Enter searches the published list, so this listener
    // is on the foot, in the capture phase, where it runs first and can keep the press for itself.
    if (foot) foot.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target !== pin) return;
      const q = String(pin.value || '').trim().toLowerCase();
      if (!q) return;
      const hit = COMMANDS.find(c => c[0] === q) || (q.length >= 4 ? COMMANDS.find(c => c[0].startsWith(q)) : null);
      if (!hit) return;
      e.stopPropagation(); e.preventDefault();
      pin.value = hit[0];
      hit[3](); markState();
    }, true);

    // A TAP OUTSIDE SHUTS THE SHEET. Inside it, on the chips and on the bar, nothing is shut.
    addEventListener('pointerdown', e => {
      if (!isOpen()) return;
      const t = e.target;
      if (sayEl.contains(t) || (chips && chips.contains(t)) || (foot && foot.contains(t))) return;
      shut();
    }, true);

    // ---- A FIRED ANSWER DOES NOT OPEN ITSELF OVER THE DRAWING -------------------------------------
    // The wafer's window is still the window and the answer is still written into it; what changes is
    // WHEN it is seen. On a phone an answer that opens itself is the drawing gone. The answer chip
    // pulses once instead, and one tap opens it. A reader who already has the pop-up open keeps it.
    try {
      if (typeof sayOpen === 'function') {
        const orig = sayOpen;
        sayOpen = function (title, nodes, beside) {
          const wasOpen = isOpen();
          orig(title, nodes, false);
          haveAnswer = true;
          groupBoxes();
          readKey();
          if (answerChip) { answerChip.style.display = '';
            answerChip.classList.remove('pulse'); void answerChip.offsetWidth; answerChip.classList.add('pulse'); }
          if (!wasOpen) { sayEl.classList.remove('open', 'max', 'min'); }
          else if (PHONE()) loosen();
          markState(); applyKey(); relayout();
        };
      }
    } catch (_) {}

    // THE DECLARED INPUTS IN COLLAPSIBLE GROUPS. The window builds a labelled box for every input the
    // command declares, which for a string is twenty-eight: one wall of boxes on a phone. The boxes are
    // not rebuilt - they are MOVED, so every listener the programs cartridge put on them is still on
    // them - into four groups, of which one is open.
    const GROUPS = [
      ['the table', ['mounting', 'orientation', 'modules_high', 'modules', 'routing', 'turn_alternate_rows', 'turn_every_second', 'jumpers', 'view']],
      ['the module, in metres', ['width_m', 'module_height_m', 'gap_m', 'gap_up_m', 'ridge_gap_m', 'tube_gap_m', 'box_spacing_m', 'cell_cols', 'cell_rows']],
      ['the cables', ['lead_plus_m', 'lead_minus_m', 'lead_mm2', 'cable_mm2', 'near_end_m', 'slack_m', 'home_separation_m']],
      ['the electrical figures', ['amps', 't_lead_c', 't_site_c', 'rating_c', 'module_vmp', 'module_voc']]
    ];
    function groupBoxes() {
      const wrap = body2.querySelector('.boxes');
      if (!wrap || wrap.dataset.kgrouped) return;
      const rows = Array.from(wrap.querySelectorAll('.boxrow'));
      if (!rows.length) return;
      const keyOfRow = r => { const f = r.querySelector('input,select'); const id = f ? (f.id || '') : '';
        const at = id.indexOf('-', 4); return at > 0 ? id.slice(at + 1) : ''; };
      const left = new Set(rows), made = [];
      for (const [name, keys] of GROUPS) {
        const want = rows.filter(r => keys.includes(keyOfRow(r)));
        if (!want.length) continue;
        const d = el('details', 'kbox'); d.append(el('summary', null, name));
        for (const r of want) { d.append(r); left.delete(r); }
        made.push(d);
      }
      if (left.size) { const d = el('details', 'kbox'); d.append(el('summary', null, 'the rest'));
        for (const r of left) d.append(r); made.push(d); }
      if (made.length) { made[0].open = true; wrap.prepend(...made); }
      wrap.dataset.kgrouped = '1';
    }

    // ---- THE KEY: one line on the face, all of it in the pop-up ----------------------------------
    // The programs cartridge pins the key under the drawing, which is right on a desk and is half a
    // phone screen on a phone. The lines are READ from its own layer - never rewritten here - the one
    // that carries the arithmetic stays on the face, and the rest are behind "more".
    const keyRow = el('div'); keyRow.id = 'keyline';
    const keyText = el('span'), keyMore = el('button', null, 'more'); keyMore.type = 'button';
    keyMore.addEventListener('click', e => { e.stopPropagation(); keyBox.open = true; openSheet('the key'); });
    keyRow.append(keyText, keyMore);
    if (foot) foot.prepend(keyRow);

    // THE KEY IS READ FROM THE DRAWING'S OWN WORDS, not off the screen: the drawing carries every pinned
    // line, long and short, whether or not this screen is showing it, so "more" can show the whole key
    // on a telephone that is only being shown one line of it.
    function pinnedWords() {
      try { if (typeof sldShapes !== 'undefined' && sldShapes && Array.isArray(sldShapes.words))
        return sldShapes.words.filter(w => w && w.pinned !== undefined && !w.danger)
          .slice().sort((a, b) => b.pinned - a.pinned); } catch (_) {}
      const layer = $('sldnames');
      return layer ? Array.from(layer.querySelectorAll('span.pinned')).filter(s => !s.classList.contains('danger'))
        .map(s => ({ text: (s.textContent || '').trim() })) : [];
    }
    function readKey() {
      const W = pinnedWords();
      const seen = new Set(), lines = [];
      for (const w of W) { const t = String(w.text || '').trim(); if (t && !seen.has(t)) { seen.add(t); lines.push(t); } }
      keyBody.replaceChildren(...(lines.length ? lines.map(t => el('p', null, t))
        : [el('p', null, 'The key appears with the drawing.')]));
      const one = W.find(w => /ohm/.test(String(w.small || w.text || ''))) || W[0];
      keyText.textContent = one ? String(one.small || one.text || '') : '';
      applyKey();
    }
    function applyKey() {
      const has = keyText.textContent !== '';
      const root = document.documentElement;
      root.classList.toggle('knokey', !keyOn);
      root.classList.toggle('kquiet', keyOn && PHONE());
      root.classList.toggle('ksheet', isOpen());
      keyRow.classList.toggle('on', has && keyOn && PHONE());
      relayout();
    }

    // ---- THE MEASUREMENTS COME OFF THE PICTURE ----------------------------------------------------
    // Every figure the drawing used to carry along its cables is in the number boxes and in the answer.
    // What stays on the picture is what a wiring drawing IS: the boxes, the cables, which is + and
    // which is -, and which module is which. "numbers on" puts them back for anybody who wants them.
    const keepMark = m => { const t = String((m && m.text) || '');
      return !/\d/.test(t) || /^M\d+$/.test(t) || /^INV/.test(t); };
    function filterDrawing(d) {
      if (!d || !d.marks) return d;
      if (!d.__marksAll) d.__marksAll = d.marks;
      d.marks = numbersOn ? d.__marksAll : d.__marksAll.filter(keepMark);
      return d;
    }
    function applyMarks() {
      try { if (typeof sldShapes !== 'undefined' && sldShapes) filterDrawing(sldShapes); } catch (_) {}
      hideWordy(); kick();
    }
    // the few loose words that carry a length go with the numbers; they are all in the answer
    function hideWordy() {
      const layer = $('sldnames'); if (!layer) return;
      for (const s of layer.querySelectorAll('span:not(.pinned)')) {
        const hide = !numbersOn && /\d/.test(s.textContent || '') && /\bm\b|\bV\b/.test(s.textContent || '');
        s.style.display = hide ? 'none' : '';
      }
    }
    try {
      if (typeof stringDrawing === 'function') {
        const origDraw = stringDrawing;
        window.stringDrawing = function (g) { return filterDrawing(origDraw(g)); };
      }
    } catch (_) {}

    // ---- THE BAND STOPS AT THE TOP OF THE SHEET ---------------------------------------------------
    // The programs cartridge measures the free part of the screen and lays the row into it. Its rule
    // for a window across the width is "go under it", which is right for a window at the top and would
    // put the whole drawing behind a sheet at the bottom. One line is added: a sheet takes the bottom.
    try {
      if (typeof shapeBand === 'function') {
        const origBand = shapeBand;
        window.shapeBand = function (reserve) {
          const b = origBand(reserve);
          if (isOpen() && PHONE()) { const r = sayEl.getBoundingClientRect();
            if (r.height > 8 && r.top > 80) b.bottom = Math.min(b.bottom, r.top - 8); }
          if (b.bottom - b.top < 120) b.top = Math.max(14, b.bottom - 120);
          return b;
        };
      }
    } catch (_) {}

    // THE KEY AND THE LOOSE WORDS ARE READ AFTER THE PAGE HAS DRAWN, which is when that layer exists.
    try { if (window.__wafer && window.__wafer.onDraw) window.__wafer.onDraw.add(function () {
      try { const layer = $('sldnames');
        if (layer && layer.childElementCount !== (layer.dataset.kseen | 0)) {
          layer.dataset.kseen = layer.childElementCount; readKey(); hideWordy(); }
      } catch (_) {}
    }); } catch (_) {}
    addEventListener('resize', () => { applyKey(); fixChips(); });
    addEventListener('orientationchange', () => { applyKey(); fixChips(); });

    markState(); applyKey(); relayout();
    // the foot is a different height now, so the disc is fitted into what is left, not left as it was
    try { if (typeof atHome !== 'undefined' && atHome && typeof homeCamera === 'function' && typeof SPACE !== 'undefined' && SPACE) {
      const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; tween = null; } } catch (_) {}
    kick();
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => { try { boot(); } catch (e) { console.error('the dressing did not go on: ' + (e && e.stack ? e.stack : e)); } });
  else { try { boot(); } catch (e) { console.error('the dressing did not go on: ' + (e && e.stack ? e.stack : e)); } }
})();
