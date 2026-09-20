'use strict';
// kuiper-tests.js - a cartridge of the Kuiper shell. Cut from the whole page with no change of behaviour;
// replaced, when it is, by a newer file the pointer names and the composer checks by its hash.
function finishSelftest(c, n, lines){
  let maxOld = 0; for (let i = 0; i < newFrom; i++) maxOld = Math.max(maxOld, commits[i].k1);
  const a = address(c.k0), nb = selftest.newBandPixel || [0,0,0], pp = selftest.pupilPixel || [0,0,0];
  const T = { T1_new_is_one_band_beyond_everything_older: c.k0 >= maxOld,
              T2_boundary_key_resolves_to_a_new_commit: !!(a && !a.silent && a.i >= newFrom && a.m === 0),
              T3_flash_is_amber_on_the_new_band: nb[0] > 150 && nb[0] > nb[2] + 40,
              T3_no_flash_on_the_silent_centre: pp[0] < 40 && pp[1] < 40,
              new_commits: n, new_lines: lines, boundary_key: c.k0, newBandPixel: nb, pupilPixel: pp };
  T.PASS = T.T1_new_is_one_band_beyond_everything_older && T.T2_boundary_key_resolves_to_a_new_commit && T.T3_flash_is_amber_on_the_new_band && T.T3_no_flash_on_the_silent_centre;
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}
async function pathSelftest(name){
  const r = await lightPath(name, true);
  if (r.error) { window.__selftest = { PASS:false, asked_for:name, error:r.error }; document.title = 'selftest FAIL'; return; }
  let raised = 0; for (let i = 0; i < pathFlags.length; i++) if (pathFlags[i] > 0.5) raised++;
  const T = { page:r.row.path, repository:r.row.repo, use:r.row.use,
    commits_lit_by_the_page:r.idx.length, commits_counted_by_where_py:r.row.on_wafer, commits_git_knows:r.row.in_git,
    shas_the_wafer_does_not_hold:r.missing, keys_where_tool_and_page_disagree:r.disagreed, flags_raised_in_the_texture:raised,
    first_key:r.row.k0, last_key:r.row.k1,
    T1_the_page_lit_what_where_py_counted: r.idx.length === r.row.on_wafer && r.idx.length === r.want,
    T2_every_sha_the_tool_named_is_on_this_wafer: r.missing.length === 0,
    T3_tool_and_page_give_every_commit_the_same_keys: r.disagreed.length === 0,
    T4_the_light_was_actually_raised: raised === r.idx.length && r.idx.length > 0 };
  // the picture: the widest of its commits, at a zoom that makes it three pixels of radius
  let best = -1, bestW = 0;
  for (const i of r.idx) { const w = Math.sqrt(commits[i].k1) - Math.sqrt(commits[i].k0); if (w > bestW) { bestW = w; best = i; } }
  const zWant = 3/Math.max(bestW, 1e-12), z = Math.min(zWant, POINTS_FROM*0.9), wpx = bestW*z;
  T.widest_commit_px_at_the_zoom_used = +wpx.toFixed(3);
  if (best >= 0 && wpx >= 1) {
    const mid = (Math.sqrt(commits[best].k0) + Math.sqrt(commits[best].k1))/2, p = keyPlace(mid*mid);
    tween = null; cx = p[0]; cy = p[1]; zoom = z; dirty = true; draw();
    const px = new Uint8Array(4); gl.readPixels(Math.round(cv.width/2), Math.round(cv.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    T.pixel_at_the_middle_of_its_widest_commit = [px[0], px[1], px[2]];
    T.T5_that_pixel_carries_the_paths_light = px[0] > 120 && px[2] > 100 && px[0] > px[1] + 40 && px[2] > px[1] + 30;
  } else { T.T5_that_pixel_carries_the_paths_light = null; T.why_no_pixel_was_read = 'every commit of this page is finer than one pixel at any zoom the field is drawn at'; }
  T.PASS = T.T1_the_page_lit_what_where_py_counted && T.T2_every_sha_the_tool_named_is_on_this_wafer
        && T.T3_tool_and_page_give_every_commit_the_same_keys && T.T4_the_light_was_actually_raised
        && T.T5_that_pixel_carries_the_paths_light !== false;
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}

// THE CARD, TESTED. A key in the middle of a carried file is tapped by the page itself; the line the
// card shows must be the line that file holds at that number, the marked line must be that one and no
// other, and the panel must be on the screen. A key with no card must say so and show no code at all.
// A RECTANGLE IS NOT A SIGHTING. The link's box was inside the window and the sheet's own overflow
// was hiding it, so the check passed and the photograph showed no link. Ask what is actually at the
// point, which is the question a thumb asks.
const inWindow = r => !!r && r.width > 4 && r.height > 4 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5
                && r.left >= -0.5 && r.right <= innerWidth + 0.5;
const on = el => { if (!el) return false; const r = el.getBoundingClientRect(); if (!inWindow(r)) return false;
  const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return !!hit && (hit === el || el.contains(hit) || hit.contains(el)); };

// EVERY CONTROL AFTER EVERY OTHER CONTROL. The black screen that reached a visitor was two presses
// long, and every check this page had pressed one. Each press is run to its END (every animation
// driven past its finish), then the picture is asked whether anything is lit and the state line is
// asked whether it says what is shown.
async function buttonsSelftest(){
  await asmReady;
  const T = { viewport:[innerWidth, innerHeight] }, R = Math.sqrt(SPACE);
  const controls = Array.from(document.querySelectorAll('#apps button, #keys button')).filter(b => b.getAttribute('data-k') !== '/');
  T.controls = controls.map(b => b.textContent);
  const settle = async () => { for (let i = 0; i < 60; i++) {
      if (isoAnim) isoAnim.t0 = performance.now() - 60000; if (bodyAnim) bodyAnim.t0 = performance.now() - 60000;
      if (anim) anim.t0 = performance.now() - 60000; if (tween) tween.t0 = performance.now() - 60000;
      frameOnce(); await new Promise(r => setTimeout(r, 5));
      if (!isoAnim && !bodyAnim && !anim && !tween) break; } draw(); };
  // EVERY PIXEL OF THE PICTURE, READ ONCE. Lit means plainly brighter than the dimmed record, which is
  // about a tenth of full and sums to under sixty.
  const litPixels = () => { draw(); const w = cv.width, h = cv.height, buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf); let lit = 0;
    for (let q = 0; q < buf.length; q += 4) if (buf[q] + buf[q+1] + buf[q+2] > 150) lit++;
    return { lit, of:w * h }; };
  const bad = []; let pairs = 0;
  for (const a of controls) for (const b of controls) {
    dispatchEvent(new KeyboardEvent('keydown', { key:'Backspace' })); await settle(); unisolate(true); anim = null; home(); tween = null; draw();
    a.click(); await settle(); b.click(); await settle(); pairs++;
    const p = litPixels(), says = hud.textContent.indexOf('ISOLATED') >= 0;
    if (p.lit < 60) bad.push([a.textContent, b.textContent, 'the screen is blank: ' + p.lit + ' of ' + p.of + ' samples lit']);
    if (says !== !!iso) bad.push([a.textContent, b.textContent, 'the state line says ' + (says ? 'ISOLATED' : 'nothing') + ' and the picture is ' + (iso ? 'isolated' : 'not')]);
    if (iso && b.getAttribute('data-app') === null && b.getAttribute('data-k') !== null) bad.push([a.textContent, b.textContent, 'still isolated after a control that is not an application']); }
  T.pairs_pressed = pairs; T.what_went_wrong = bad.slice(0, 12); T.how_many_went_wrong = bad.length;
  T.T1_every_control_after_every_other_never_blanks_the_screen = pairs >= 16 && !bad.some(x => /blank/.test(x[2]));
  T.T2_the_state_line_always_says_what_is_shown = !bad.some(x => /state line|still isolated/.test(x[2]));
  T.PASS = T.T1_every_control_after_every_other_never_blanks_the_screen && T.T2_the_state_line_always_says_what_is_shown;
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}
// P1, TESTED: "isolate every app with the faraday pulse and then be able to visit those apps".
async function isolateSelftest(){
  await asmReady;
  const T = { viewport:[innerWidth, innerHeight], programs:programs.length }, R = Math.sqrt(SPACE);
  const onScreen = el => { if (!el) return false; const r = el.getBoundingClientRect();
    if (!(r.width > 4 && r.height > 4 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5)) return false;
    const h = document.elementFromPoint(Math.round(r.left + r.width/2), Math.round(r.top + r.height/2)); return !!h && (h === el || el.contains(h) || h.contains(el)); };
  // one button for every program, all of them on the screen with nothing to scroll or type
  const btns = Array.from(document.querySelectorAll('#apps button'));
  T.buttons = btns.map(b => b.textContent);
  // ON A PHONE THE ROW IS BEHIND ONE CHIP, so the disc has the screen: the chip is on the screen, one tap
  // opens the row, and then every button is. On a desktop they are simply all there.
  { const chip = document.getElementById('appschip');
    if (narrow() && chip) { T.the_chip_is_on_the_screen = onScreen(chip); T.buttons_hidden_until_asked_for = !btns.some(onScreen);
      chip.click(); await new Promise(r => setTimeout(r, 80)); }
    T.T1_a_button_for_every_application_all_on_the_screen = programs.length > 0 && btns.length === programs.length && btns.every(onScreen)
      && (!narrow() || !chip || (T.the_chip_is_on_the_screen && T.buttons_hidden_until_asked_for));
    if (narrow() && chip) { chip.click(); await new Promise(r => setTimeout(r, 80)); } }
  // a brightness census of the picture: how much of the disc is lit, along eight spokes
  const census = () => { draw(); const px = new Uint8Array(4); let bright = 0, green = 0, seen = 0;
    const x0 = (0 - cx)*zoom + cv.width/2, y0 = cv.height/2 + cy*zoom, Rp = R*zoom;
    for (let a = 0; a < 8; a++) for (let t = 0.06; t < 0.98; t += 0.004) {
      const x = Math.round(x0 + Math.cos(a*0.785)*Rp*t), y = Math.round(y0 + Math.sin(a*0.785)*Rp*t);
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) continue;
      gl.readPixels(x, cv.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); seen++;
      if (px[1] > 215 && px[2] >= px[1] - 12 && px[0] > px[1] * 0.6) green++; else if (px[0] + px[1] + px[2] > 240) bright++; }
    return { seen, bright, green }; };
  unisolate(true); closeCard(); { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; tween = null; }
  const before = census();
  // every program, by the numbers
  const per = [], wrong = [];
  for (const pr of programs) { const st = isolateNow(pr.name); draw(); await new Promise(r => setTimeout(r, 30));
    const want = (appWork[pr.select.app] || []).filter(sha => bySha.get(sha) !== undefined).length;
    const tile = card.querySelector('a.cc-tile'), count = card.querySelector('.cc-count');
    const row = { program:pr.name, lit:st && st.lit, dark:st && st.dark, git_named:want, tile:tile && tile.href };
    per.push(row);
    if (!st || st.lit !== want || st.lit + st.dark !== commits.length || st.lit === 0) wrong.push([pr.name, 'count']);
    if (!tile || tile.href !== pr.end.tile || !onScreen(tile)) wrong.push([pr.name, 'tile']);
    if (!count || count.textContent.indexOf(fmt(st.lit)) < 0 || count.textContent.indexOf(fmt(st.dark)) < 0) wrong.push([pr.name, 'numbers not shown']);
    if (hud.textContent.indexOf('ISOLATED') < 0 || hud.textContent.indexOf(fmt(st.dark) + ' dark') < 0) wrong.push([pr.name, 'readout']); }
  T.every_program = per; T.what_was_wrong = wrong;
  T.T2_the_work_lit_is_exactly_the_work_git_named_and_lit_plus_dark_is_the_whole = programs.length > 0 && !wrong.some(w => w[1] === 'count');
  T.T3_every_tile_opens_its_application_and_is_on_the_screen = !wrong.some(w => w[1] === 'tile');
  T.T4_the_numbers_are_shown_on_the_tile_and_in_the_readout = !wrong.some(w => w[1] === 'numbers not shown' || w[1] === 'readout');
  // the picture: with the biggest application isolated the rest really is dark
  const big = programs.slice().sort((a, b) => (appWork[b.select.app] || []).length - (appWork[a.select.app] || []).length)[0];
  isolateNow(big.name); card.style.display = 'none'; if (body) body.shown = false; glowOff = true; const after = census(); glowOff = false;
  T.the_picture = { before, after, isolated:big.name };
  T.T5_what_is_not_the_application_goes_dark_in_the_picture = before.bright > 50 && after.bright < before.bright * 0.15;
  // the front: with it half way out, inside has switched and outside has not (the sparks at the work, not gathered)
  if (body) body.shown = false; iso.front = R * 0.5; draw();
  const ring = (t0, t1) => { const px = new Uint8Array(4); let b = 0, k = 0; const x0 = (0 - cx)*zoom + cv.width/2, y0 = cv.height/2 + cy*zoom, Rp = R*zoom;
    for (let a = 0; a < 8; a++) for (let t = t0; t < t1; t += 0.004) { const x = Math.round(x0 + Math.cos(a*0.785)*Rp*t), y = Math.round(y0 + Math.sin(a*0.785)*Rp*t);
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) continue; gl.readPixels(x, cv.height - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); k++;
      if (px[0] + px[1] + px[2] > 240 && !(px[1] > 140 && px[1] > px[0] + 50)) b++; } return k ? b / k : 0; };
  const inside = ring(0.10, 0.45), outside = ring(0.55, 0.95);
  T.bright_share_inside_and_outside_the_front = [+inside.toFixed(3), +outside.toFixed(3)];
  T.T6_each_dot_switches_when_the_front_reaches_it = outside > 0.05 && inside < outside * 0.3;
  // GROW AND GLOW: with the program's glow the lit work covers many times the pixels it covered as
  // pin points, measured in the picture itself by switching the glow off and on again.
  isolateNow(programs[0].name); card.style.display = 'none'; if (body) body.shown = false;
  glowOff = true; const pins = census(); glowOff = false; const glow = census();
  T.lit_pixels_as_pin_points_and_with_the_glow = [pins.green, glow.green]; T.sparks = iso.sparks;
  // NOTHING IS DRAWN ADDITIVELY ANY MORE: switching the old glow off and on changes nothing in the picture
  T.T11_nothing_is_drawn_additively = glow.green === pins.green;
  // the glow arrives WITH the front: half way out there is glow inside and none outside
  iso.front = Math.sqrt(commits[iso.idx[0]].k0) * 0.97; const notYet = census(); iso.front = 1e30;
  T.glow_before_the_front_reaches_the_work = notYet.green;
  T.T12_before_the_front_reaches_the_work_none_of_it_is_lit = notYet.green === 0;
  // ON A PHONE THE CARD MUST NOT HIDE THE SHOW: a short tile, the middle of the disc above it
  isolateNow(programs[0].name); tween = null; layout(); { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; } draw();
  { const cr = card.getBoundingClientRect(), yMid = cv.height/2 + cy*zoom, Rp = R*zoom;
    const tile = card.querySelector('a.cc-tile'), open = tile && tile.querySelector('.cc-tile-open');
    T.card_top_and_disc = { card_top:Math.round(cr.top), disc_middle:Math.round(yMid), disc_radius:Math.round(Rp), card_height:Math.round(cr.height) };
    T.T13_the_tile_is_short_and_the_disc_stays_in_view = !narrow() || (cr.top >= yMid + Rp - 1 && Rp >= 70 && cr.height <= innerHeight * 0.30 && onScreen(open));
    T.T14_the_numbers_and_the_brand_are_lower_in_the_same_card = !!card.querySelector('.cc-count') && !!card.querySelector('.scada-brand')
      && card.querySelector('.scada-brand-sub').textContent === 'Cables & Connectivity\u00ae'; }
  // THE BODY. A smaller Kuiper of the application's own work, under the black sky rule, then its name.
  { const st = isolateNow(programs[0].name); card.style.display = 'none';
    // A MISSING MODULE MUST FAIL, NOT FALL BACK QUIETLY: without it there is no body at all.
    T.T14b_the_shared_gathering_module_was_read = !!ASM && !!body; T.states = body ? body.states.map(x => x.shape) : null;
    // ONE DOT FOR EVERY PIECE OF WORK, IN ORDER OF KEY, so the oldest work is the middle
    let ordered = !!body; if (body) for (let j = 1; j < st.idx.length; j++) if (commits[st.idx[j]].k0 < commits[st.idx[j-1]].k0) ordered = false;
    T.T15_one_dot_for_every_piece_of_work_in_order_of_key = !!body && body.n === st.lit && ordered;
    // every dot ends exactly where the SHARED module says, in every state
    let off = 0; if (body) for (const x of body.states) { const unit = ASM.targets(x.shape, body.n), Rw = R * x.frac;
      for (let q = 0; q < unit.length; q++) if (Math.abs(x.to[q] - unit[q] * Rw) > Rw * 1e-5) off++; }
    // a screen too small to resolve the name keeps the small Kuiper alone: one state there, two where the name can be read
    T.T16_every_dot_ends_exactly_where_the_shared_module_says = !!body && off === 0 && body.states.length >= (narrow() ? 1 : 2);
    // oldest in the middle, newest at the rim: the first dot is nearer the middle than the last
    const c0 = body && body.states[0].to; T.T17_it_is_a_smaller_kuiper_oldest_in_the_middle = !!c0
      && Math.hypot(c0[0], c0[1]) < Math.hypot(c0[c0.length - 2], c0[c0.length - 1]) * 0.25
      && Math.hypot(c0[c0.length - 2], c0[c0.length - 1]) <= R * body.states[0].frac * 1.0001;
    // THE BLACK SKY RULE, in every state and for EVERY application: no two centres closer than three
    // dot radii, the radius being what is drawn at this zoom. And a planted too tight body must FAIL.
    tween = null; { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; }
    const sky = [], broke = [];
    for (const pr of programs) { isolateNow(pr.name); card.style.display = 'none'; if (!body) { broke.push([pr.name, 'no body']); continue; }
      body.states.forEach((x, k) => { bodyJump(k); const rWorld = bodyDotPx() / zoom, v = blackSky(body.pos, rWorld);
        sky.push([pr.name, x.shape.slice(0, 12), body.n, +(v.gap * zoom).toFixed(2), +bodyDotPx().toFixed(2), +x.frac.toFixed(2)]);
        if (!v.ok && !x.unresolved) broke.push([pr.name, x.shape, 'centres closer than three radii']);
        if (bodyDotPx() < DOT_MIN_PX * 0.999 && !x.unresolved) broke.push([pr.name, x.shape, 'a dot under a pixel, not said to be unresolved']); }); }
    T.app_shape_dots_gap_px_dot_px_body_share = sky; T.black_sky_faults = broke;
    T.T18_the_black_sky_rule_holds_for_every_application_in_every_state = sky.length > 0 && broke.length === 0;
    const tight = new Float32Array(200); for (let q = 0; q < 200; q++) tight[q] = (q % 7) * 0.5;      // centres half a unit apart
    T.T19_a_planted_too_tight_body_is_failed_by_the_same_rule = blackSky(tight, 1).ok === false && blackSky(new Float32Array([0,0, 10,0, 0,10]), 1).ok === true;
    // IN THE PICTURE: the body is a population, not a patch. Lit share inside it is well under the
    // point where a field turns to mush (about 63 per cent), there is black between, and no white.
    isolateNow(programs[0].name); card.style.display = 'none'; bodyJump(0); draw();
    { const px = new Uint8Array(4), x0 = (0 - cx)*zoom + cv.width/2, y0 = cv.height/2 + cy*zoom, Rp = R*zoom*body.states[0].frac; let lit = 0, white = 0, k = 0;
      for (let yy = -Rp; yy <= Rp; yy += 2) for (let xx = -Rp; xx <= Rp; xx += 2) { if (xx*xx + yy*yy > Rp*Rp) continue;
        gl.readPixels(Math.round(x0 + xx), cv.height - 1 - Math.round(y0 + yy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); k++;
        if (px[1] > 215 && px[2] >= px[1] - 12) lit++; if (px[0] > 250 && px[1] > 250 && px[2] > 250) white++; }
      T.inside_the_body = { samples:k, lit_share:+(lit / k).toFixed(3), white_pixels:white };
      T.T20_the_body_is_a_population_not_a_patch = k > 50 && lit > 0 && lit / k < 0.45 && white === 0; }
    // a tap on a dot of the body opens that piece of work
    { const j = Math.floor(body.n / 2), x = (body.pos[2*j] - cx) * zoom + innerWidth / 2, y = innerHeight / 2 - (body.pos[2*j+1] - cy) * zoom;
      const ev = (t, px2, py2) => cv.dispatchEvent(new PointerEvent(t, { pointerId:31, clientX:px2, clientY:py2, bubbles:true, pointerType:'touch' }));
      ev('pointerdown', x, y); ev('pointerup', x, y); await new Promise(r => setTimeout(r, 150));
      const want = commits[iso.idx[j]];
      T.T21_a_tap_on_a_dot_of_the_body_opens_that_piece_of_work = card.style.display !== 'none' && card.textContent.indexOf(day(want.unix)) >= 0; } }
  // THE RULE, ASKED OF WHAT IS ACTUALLY DRAWN, ON A SCREEN LIKE A VISITOR'S. A real screen has a pixel
  // ratio of 1.5 or 2 and a headless one has 1, which is how a blob reached a reviewer past every
  // photograph. The diameter below is the very number handed to the GPU, in the canvas's own pixels.
  { const realRatio = window.devicePixelRatio;
    try { Object.defineProperty(window, 'devicePixelRatio', { value:2, configurable:true }); } catch (e) {}
    const perCss = cv.width / innerWidth, tooBig = [];
    for (const pr of programs) { isolateNow(pr.name); card.style.display = 'none'; tween = null; { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; }
      if (!body) continue;
      const ask = (label) => { const gapPx = closestPair(body.pos) * zoom * perCss, d = bodyDrawnDiameter();
        if (d / 2 * 3 > gapPx * 1.0001 && d > 1.0001) tooBig.push([pr.name, label, 'drawn radius ' + (d / 2).toFixed(2) + ' px, gap ' + gapPx.toFixed(2) + ' px']); };
      body.states.forEach((x, k) => { bodyJump(k); ask(x.shape.slice(0, 10)); });
      // in flight: from the rim to the small Kuiper, and from the small Kuiper to the name
      const legs = [[body.from, body.states[0].to, 'rim to cluster']]; if (body.states.length > 1) legs.push([body.states[0].to, body.states[1].to, 'cluster to name']);
      for (const [a0, b0, what] of legs) for (const t of [0.25, 0.5, 0.75]) { ASM.step(a0, b0, t, body.pos); bodyTo(body.pos); body.shown = true; ask(what + ' at ' + t); } }
    try { Object.defineProperty(window, 'devicePixelRatio', { value:realRatio, configurable:true }); } catch (e) {}
    T.dots_drawn_wider_than_a_third_of_their_gap = tooBig.slice(0, 10); T.how_many = tooBig.length;
    T.T27_no_dot_is_ever_drawn_wider_than_a_third_of_its_gap_at_rest_or_in_flight = programs.length > 0 && tooBig.length === 0; }
  // ONE PALETTE: what is lit is the pulse's own white and ice blue, never the saturated green. Asked of the
  // picture: inside a gathered body the lit pixels are blue-white (blue at least as strong as green, red not
  // far behind), and none is the old green.
  { isolateNow(programs[0].name); card.style.display = 'none'; tween = null; { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; } bodyJump(0); draw();
    const w = cv.width, h2 = cv.height, buf = new Uint8Array(w * h2 * 4); gl.readPixels(0, 0, w, h2, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let ice = 0, green = 0; for (let q = 0; q < buf.length; q += 4) { const r0 = buf[q], g0 = buf[q+1], b0 = buf[q+2];
      if (g0 > 215 && b0 >= g0 - 12 && r0 > g0 * 0.6) ice++; else if (g0 > 150 && g0 > b0 + 60 && g0 > r0 + 60) green++; }
    T.lit_pixels_ice_blue_and_old_green = [ice, green];
    T.T28_what_is_lit_is_the_pulses_white_and_ice_blue_not_green = ice > 50 && green === 0;
    const o = document.getElementById('o');
    T.T29_the_month_labels_are_put_away_while_work_is_gathered = !!o && o.style.visibility === 'hidden';
    unisolate(true); T.T30_and_come_back_when_it_is_over = !!o && o.style.visibility !== 'hidden'; }
  // A NAME ONLY WHEN IT CAN BE READ: every application that spells its name has a dot for every square of it
  { const thin = [];
    for (const pr of programs) { isolateNow(pr.name); card.style.display = 'none'; if (!body) continue;
      const named = body.states.find(x => x.shape.indexOf('text:') === 0); if (!named) continue;
      const ink = ASM.raster(named.shape.slice(5)).on.reduce((t, v) => t + v, 0); if (body.n < ink) thin.push([pr.name, body.n, ink]); }
    T.names_spelt_with_too_few_dots = thin;
    T.which_applications_spell_their_name = programs.filter(pr => { isolateNow(pr.name); card.style.display = 'none'; return body && body.states.some(x => x.shape.indexOf('text:') === 0); }).map(pr => pr.name);
    T.T31_a_name_is_spelt_only_when_there_are_enough_pieces_to_read_it = thin.length === 0; }
  // THE END STATE ON THE SCREEN THE PERSON IS HOLDING. A phone showed the tile and an empty centre: the
  // work gathered, flew, and was gone. At the end of every program the dots are inside the disc, and
  // they are IN THE PICTURE, not only in the arithmetic.
  { const empty = [];
    for (const pr of programs) { isolateNow(pr.name); layout(); tween = null; { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; } draw();
      if (!body || !body.shown) { empty.push([pr.name, 'no body']); continue; }
      let far = 0; for (let q = 0; q < body.pos.length; q += 2) if (Math.hypot(body.pos[q], body.pos[q+1]) > R * 1.0001) far++;
      const w = cv.width, h2 = cv.height, buf = new Uint8Array(w * h2 * 4); gl.readPixels(0, 0, w, h2, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const x0 = (0 - cx)*zoom + w/2, y0 = h2/2 + cy*zoom, Rp = R*zoom*body.states[body.k].frac + 3; let lit = 0;
      for (let yy = Math.max(0, Math.floor(y0 - Rp)); yy < Math.min(h2, y0 + Rp); yy++) for (let xx = Math.max(0, Math.floor(x0 - Rp)); xx < Math.min(w, x0 + Rp); xx++) {
        const q = ((h2 - 1 - yy) * w + xx) * 4; if (buf[q+1] > 215 && buf[q+2] >= buf[q+1] - 12) lit++; }
      if (far || lit < body.n) empty.push([pr.name, body.states[body.k].shape, 'dots outside the disc: ' + far + ', lit pixels in the body: ' + lit + ' for ' + body.n + ' dots']); }
    T.end_states_that_showed_nothing = empty;
    T.T23_at_the_end_of_every_program_the_work_is_in_the_picture = programs.length > 0 && empty.length === 0; }
  // every tile has its one plain sentence
  { const silent = programs.filter(pr => { const ap = apps.find(x => x.app === pr.select.app); return !ap || !(whatItDoes[ap.live] || '').length; }).map(pr => pr.name);
    T.tiles_without_a_sentence = silent; T.T24_every_tile_has_its_one_plain_sentence = silent.length === 0; }
  // the row holds applications a person acts in, in the order given, and nothing else
  T.the_row = Array.from(document.querySelectorAll('#apps button')).map(x => x.textContent);
  T.T25_the_row_is_the_seven_applications_in_order = T.the_row.join('|') === 'GRIDATLAS|PIPELINE NEWS|CABLES|REAL SYSTEMS|SPIDER SANDBOX|GRID ENGINE|PERIODIC TABLE';
  // the top box says KUIPER and one short line; the warranty line is on the screen; the hints are folded
  { const topText = document.getElementById('top').textContent.replace(/\s+/g, ' ').trim(), lg = document.querySelector('#foot .long'), sh = document.querySelector('#foot .short');
    T.the_top_box_says = topText;
    T.T26_the_top_box_is_kuiper_and_one_short_line = /^Kuiper/i.test(topText) && topText.length < 40 && !/pieces of work|20\d\d/.test(topText)
      && (!lg || lg.getClientRects().length === 0) && !!sh && sh.getClientRects().length > 0 && /without warranty of any kind/.test(sh.textContent); }
  // pressing a button runs the program to its end; whole view puts everything back
  btns[0].click(); await new Promise(r => setTimeout(r, 60));
  T.T7_a_press_starts_the_front_at_the_origin = !!iso && !!isoAnim && iso.front < R * 0.2;
  if (isoAnim) isoAnim.t0 = performance.now() - isoAnim.ms - 5;
  for (let i = 0; i < 40 && isoAnim; i++) { frameOnce(); await new Promise(r => setTimeout(r, 50)); }
  T.after_the_front_the_work_is_gathering = !!bodyAnim && bodyAnim.k === 0 && card.style.display !== 'none' && !!card.querySelector('a.cc-tile');
  const seen = [];
  for (let i = 0; i < 80 && bodyAnim; i++) { seen.push(bodyAnim.k + bodyAnim.phase); bodyAnim.t0 = performance.now() - 60000; frameOnce(); await new Promise(r => setTimeout(r, 20)); }
  T.the_show_went = seen.filter((v, i) => v !== seen[i - 1]);
  T.T8_and_ends_with_the_tile_open = !isoAnim && !bodyAnim && !!iso && iso.front > R && T.after_the_front_the_work_is_gathering
    && T.the_show_went.join(',') === body.states.map((x, k) => k + 'move,' + k + 'hold').join(',') && !!body && body.k === body.states.length - 1
    && card.style.display !== 'none' && !!card.querySelector('a.cc-tile');
  dispatchEvent(new KeyboardEvent('keydown', { key:'Backspace' })); await new Promise(r => setTimeout(r, 60));
  T.T22_whole_view_sends_the_work_home_first = !!bodyAnim && bodyAnim.home === true && !!iso;
  for (let i = 0; i < 40 && bodyAnim; i++) { bodyAnim.t0 = performance.now() - 60000; frameOnce(); await new Promise(r => setTimeout(r, 20)); }
  draw();
  T.T9_whole_view_puts_everything_back = iso === null && !document.querySelector('#apps button.on') && hud.textContent.indexOf('ISOLATED') < 0;
  // the link: built by the contract, read back by the contract, and it names a program
  const href = buildLink({ isolate:'gridatlas' });
  T.the_link = href;
  T.T10_a_link_arrives_already_isolated = parseLink(href).isolate === 'gridatlas' && !!programs.find(p => p.name === 'gridatlas');
  T.PASS = Object.keys(T).filter(k => /^T\d+_/.test(k)).every(k => T[k] === true);
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}
async function cardSelftest(){
  codeOpen = true;                       // the engineer's questions first, asked with the code opened
  const T = { cards_carried: cards.length };
  if (!cards.length) { T.PASS = false; T.error = 'no file carries its keys on this page';
    window.__selftest = T; document.title = 'selftest FAIL'; return; }
  const c = cards[0], j = Math.floor(c.lines / 2), k = c.k0 + j;
  T.file = c.path; T.line_asked_for = j + 1; T.key = k;
  show(address(k));
  for (let i = 0; i < 60 && !cardShown; i++) await new Promise(r => setTimeout(r, 100));
  const d = cardShown && cardShown.data;
  T.T1_the_card_opened_for_that_key = !!cardShown && cardShown.line === j;
  T.T2_the_line_shown_is_the_line_that_file_holds = !!d && typeof d.text[j] === 'string';
  const html = card.innerHTML;
  const want = d ? d.text[j] : null;
  const esc1 = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  T.T3_that_exact_text_is_on_the_screen = !!want && (want.trim() === '' || card.textContent.indexOf(want) >= 0);
  // THE MARKED ROW IS THE ONE THE KEY ASKED FOR, and the text in it is that file's line. Marking the
  // wrong row is the one failure a reader could not catch: the code would be real and the answer wrong.
  { const w = cardShown && cardShown.window, pre = w && w.node;
    const lh = pre ? parseFloat(getComputedStyle(pre).lineHeight) || 16 : 16;
    const pad = pre ? parseFloat(getComputedStyle(pre).paddingTop) || 0 : 0;
    if (w) w.place();
    T.marked_line = w ? w.at : null;
    T.T4_it_is_the_marked_line = !!w && w.at === j + 1
      && Math.abs(parseFloat(w.bar.style.top) - (pad + (w.at - w.first) * lh)) < 0.6
      && pre.textContent.split('\n')[w.at - w.first] === String(w.at).padStart(6) + '  ' + String(want); }
  const r = card.getBoundingClientRect();
  T.T5_the_card_is_on_the_screen = r.width > 40 && r.height > 20 && r.left >= -0.5 && r.right <= innerWidth + 0.5;
  // and a key that no file carries must say so, and show no code
  // A DOT WHOSE FILE IS NOT CARRIED HERE SHOWS THE CODE ITS PIECE OF WORK CHANGED, read from the public
  // repository at that exact commit. Asked of a piece of work the table names, with the code opened.
  const table = await workTable();
  T.the_table_of_changed_code_was_read = !!table; T.pieces_of_work_in_it = table ? Object.keys(table).length : 0;
  const wc = table && commits.find(q => table[q.sha] && !cardFor(q.k0) && repos[q.repo].pub);
  const far = wc ? wc.k0 : cards.reduce((m, x) => Math.max(m, x.k0 + x.lines), 0) + 1000;
  show(address(far));
  for (let i = 0; i < 120 && !(cardShown && cardShown.work) && !/FAIL|EMPTY/.test((card.querySelector('.cc-tag') || {}).textContent || ''); i++) await new Promise(r => setTimeout(r, 100));
  { const w = cardShown && cardShown.work ? cardShown : null, row = wc && table[wc.sha];
    T.a_piece_of_work_shows = w ? [w.path, 'line ' + w.line, (w.lines[w.line - 1] || '').slice(0, 60)] : (card.querySelector('.cc-tagline') || {}).textContent;
    T.T6_a_dot_with_no_carried_file_shows_the_code_its_work_changed = !!w && !!row && w.path === row[2][0] && w.line === Math.min(Math.max(1, row[2][1]), w.lines.length)
      && w.window.node.textContent.split('\n')[w.line - w.from] === String(w.line).padStart(6) + '  ' + w.lines[w.line - 1]
      && /This piece of work changed [\d,]+ files?\. Showing /.test(card.textContent) && (card.querySelector('.cc-tag') || {}).textContent === 'OK'; }
  // AND IT SAYS THE THREE THINGS A PERSON ASKED. Almost every tap a stranger makes lands here, so
  // this is the card that matters most: what the work was, the day it was done, one link to it.
  const seenText = card.textContent.replace(/\s+/g, ' ');
  T.the_plain_card = seenText.slice(0, 160);
  const lnk = card.querySelector('a[href*="github.com/"]');
  const chip = card.querySelector('.cc-tag');
  T.the_state_it_shows = chip ? chip.getAttribute('data-s') : null;
  T.T11_it_says_the_work_the_day_and_where_to_see_it =
       /(?<!\d)\d{1,2} [A-Z][a-z]{2} \d{4}(?!\d)/.test(seenText)
    && T.the_state_it_shows === 'OK'
    && (seenText.indexOf('not public') >= 0 ? !lnk
        : !!lnk && /\/commit\/[0-9a-f]{7,40}$/.test(lnk.getAttribute('href')) && on(lnk));
  // NO ARITHMETIC AND NO INSTRUCTIONS ANYWHERE ON THE PAGE, not in a card and not in the markup a
  // reader can read. The words are listed once so they cannot come back by accident.
  // WRITTEN IN PIECES ON PURPOSE. Spelled out, the list of forbidden words IS three forbidden words
  // in the page, and the check fails on itself. It did, on its first run.
  const BANNED = ['pyth' + 'on ', 'key' + '.py', 'ever ' + 'issued'];
  const whole = document.documentElement.outerHTML.toLowerCase();
  T.banned_words_found = BANNED.filter(w => whole.indexOf(w) >= 0 || seenText.toLowerCase().indexOf(w) >= 0);
  T.T12_no_arithmetic_and_no_command_anywhere_on_the_page = T.banned_words_found.length === 0;
  // THE LINK AND THE LINES BELOW IT, MEASURED. The 0012 review found the card cut off after the
  // marked line on a phone: the ten lines below and the link to GitHub were behind the button bar.
  // Being in the markup is not being on the screen, so this asks the layout where they really are.
  show(address(k));
  for (let i = 0; i < 60 && !cardShown; i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 120));
  const lk = card.querySelector('a[href*="#L"]');
  T.T7_the_github_link_is_on_the_screen = on(lk);
  T.link_rect = lk ? [lk.getBoundingClientRect().left, lk.getBoundingClientRect().top,
                      lk.getBoundingClientRect().right, lk.getBoundingClientRect().bottom].map(Math.round) : null;
  { const w = cardShown && cardShown.window, pre = w && w.node;
    const lh = pre ? parseFloat(getComputedStyle(pre).lineHeight) || 16 : 16;
    if (w) w.scrollToTarget();
    const below = w ? w.last - w.at : 0;
    const roomBelow = pre ? Math.floor((pre.scrollTop + pre.clientHeight - ((w.at - w.first + 1) * lh)) / lh) : 0;
    T.lines_below_the_marked_line = below; T.lines_below_it_on_the_screen = Math.min(below, roomBelow);
    T.T8_ten_lines_below_are_there_and_five_are_on_the_screen = below >= CONTEXT && roomBelow >= 5 && on(pre);
    // A LONG LINE MAY RUN PAST THE EDGE ONLY IF THE WINDOW CAN BE SCROLLED TO IT. The wafer's window
    // keeps code as code, unwrapped; what would be a fault is a line cut off with no way to reach it.
    const ox = pre ? getComputedStyle(pre).overflowX : '';
    T.T9_no_code_line_runs_off_the_right_edge = !!pre && (pre.scrollWidth <= pre.clientWidth + 1 || ox === 'auto' || ox === 'scroll');
    const chip2 = card.querySelector('.cc-tag');
    T.the_state_of_a_carried_line = chip2 ? chip2.getAttribute('data-s') : null;
    T.T21_the_state_chip_says_OK_and_only_one_thing = !!chip2 && T.the_state_of_a_carried_line === 'OK'
      && card.querySelectorAll('.cc-tag').length === 1; }
  const bdy = card.querySelector('.cc-body');
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom].map(Math.round); };
  T.sheet_rects = { card:box(card), body:box(bdy), window:box(card.querySelector('.cc-code')) };
  T.header = (card.querySelector('.cc-dl') || card).textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
  T.T10_the_header_says_what_day_the_work_was_done = /(?<!\d)\d{1,2} [A-Z][a-z]{2} \d{4}(?!\d)/.test(T.header);
  // A TAP IN A DARK GAP MUST LEAD SOMEWHERE. A key between two pieces of work is a real place on
  // this picture and a reader lands on one often; it named the next piece of work and then left them
  // holding a sentence with nothing to press.
  let silent = null;
  for (const c of commits) { const g = address(c.k1); if (g && g.silent && g.next) { silent = c.k1; break; } }
  T.a_key_in_a_gap = silent;
  if (silent !== null) {
    show(address(silent));
    await new Promise(r => setTimeout(r, 120));
    const way = card.querySelector('a[data-key]');
    T.the_gap_card = card.textContent.replace(/\s+/g, ' ').slice(0, 120);
    T.T13_a_gap_leads_to_the_next_work = !!way && on(way);
    if (way) { way.click(); await new Promise(r => setTimeout(r, 250));
      T.after_following_it = card.textContent.replace(/\s+/g, ' ').slice(0, 90);
      T.T13_a_gap_leads_to_the_next_work = /(?<!\d)\d{1,2} [A-Z][a-z]{2} \d{4}(?!\d)/.test(card.textContent) && !!card.querySelector('.cc-tag'); }
  } else { T.T13_a_gap_leads_to_the_next_work = true; T.a_key_in_a_gap = 'this wafer has no gaps'; }
  // AND NO PANEL IS DRAWN FOR WORDS THAT ARE NOT THERE.
  litRepo = -1; litK = [-1, -1]; litCi = null; target = null; card.style.display = 'none'; draw();
  await new Promise(r => setTimeout(r, 60));
  { const hr = hud.getBoundingClientRect();
    T.readout_when_nothing_is_highlighted = [hud.textContent.trim().length, Math.round(hr.width), Math.round(hr.height)];
    T.T14_an_empty_readout_draws_no_box = hud.textContent.trim().length > 0 || hr.width < 1 || hr.height < 1; }
  // THE LINK CONTRACT, PROVED ON ITSELF AND AGAINST THE PUBLISHED TABLE. Parsing a link this page
  // built must give back exactly what it was asked for; and the address this page builds must be
  // the address the tools build, character for character, or the two have quietly drifted apart.
  try {
    const ct = await fetch('cosmos/link-contract.json').then(r => r.json());
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const wrong = [];
    for (const ex of ct.examples) {
      const built = buildLink(ex.asked);
      const want = {}; for (const k of Object.keys(LINK.params)) {
        const v = ex.asked[k]; want[k] = (v === undefined || v === null || v === '') ? null : v; }
      if (built !== ex.built) wrong.push({ asked:ex.asked, this_page:built, the_table:ex.built });
      else if (!same(parseLink(built), want)) wrong.push({ asked:ex.asked, came_back:parseLink(built) });
    }
    T.examples_checked = ct.examples.length;
    T.links_that_disagree = wrong;
    T.T15_a_link_this_page_built_parses_back_to_what_it_asked_for = ct.examples.length > 0 && wrong.length === 0;
  } catch (e) {
    // A TEST THAT CANNOT RUN MUST FAIL, NOT GO QUIET.
    T.T15_a_link_this_page_built_parses_back_to_what_it_asked_for = false;
    T.links_that_disagree = 'the published table could not be read: ' + (e && e.message || e);
  }
  // AND NOBODY TYPES AN ADDRESS. One function makes them; a hand written one is how the two halves
  // of a link stop agreeing without anybody noticing.
  try {
    // THE PAGE IS SEVERAL FILES NOW, and under the composer the address bar is not where they live
    const parts = [new URL('index.html', document.baseURI).href].concat(Array.from(document.querySelectorAll('script[src]')).map(x => x.src));
    const src = (await Promise.all(parts.map(u => fetch(u).then(r => r.text())))).join('\n');
    const typed = [];
    for (const k of Object.keys(LINK.params)) {
      const needle = '?' + k + '=';
      let at = -1;
      while ((at = src.indexOf(needle, at + 1)) >= 0) {
        // A SENTENCE THAT MENTIONS AN ADDRESS IS NOT AN ADDRESS. A typed one begins a string, so
        // the character before the question mark is a quote. This sentence may not show you an
        // example, because an example would be the very thing it is looking for, and this check
        // failed on its own explanation the first time it ran.
        const before = at > 0 ? src[at - 1] : ' ';
        if (before === '"' || before === "'" || before === '`') typed.push(src.slice(Math.max(0, at - 30), at + 14));
      }
    }
    T.addresses_typed_by_hand = typed;
    T.T16_no_address_is_typed_by_hand_in_this_page = typed.length === 0;
  } catch (e) {
    T.T16_no_address_is_typed_by_hand_in_this_page = false;
    T.addresses_typed_by_hand = 'the page could not read its own source: ' + (e && e.message || e);
  }
  // ARRIVING BY A LINK. The view flies, an arrow is shot from the centre of the record to the work
  // the address names, and only then does the card open. The arrow must END ON THE DOT the card
  // describes: an arrow that points near the answer is worse than none, because it is believed.
  { const ka = c.k0 + Math.floor(c.lines / 3);
    home(); card.style.display = 'none'; target = null; arrow = null; arrowTip = null; draw();
    arriveAt(ka);
    // THE CLOCK IS NOT WHAT IS BEING CHECKED. Under a headless time budget this page gets about seven
    // animation frames in eight seconds, so waiting for the flight to finish measures the browser's
    // throttle. Put the camera where the flight was going, tell the arrow its time is up, draw once.
    for (let i = 0; i < 60 && !arrow; i++) await new Promise(r => setTimeout(r, 100));
    if (tween) { cx = tween.x1; cy = tween.y1; zoom = tween.z1; tween = null; }
    if (arrow) arrow.t0 = performance.now() - ARROW_MS;
    draw();
    const p = keyPlace(ka);
    const wx = (p[0] - cx) * zoom + ov.width / 2, wy = ov.height / 2 - (p[1] - cy) * zoom;
    T.arrow_tip = arrowTip ? [Math.round(arrowTip.x), Math.round(arrowTip.y)] : null;
    T.arrow_still_flying = !!arrow;
    T.camera = [Math.round(cx), Math.round(cy), +zoom.toFixed(3)];
    T.draws_seen = drawCount;
    T.the_dot_it_should_end_on = [Math.round(wx), Math.round(wy)];
    T.T17_the_arrow_ends_on_the_dot = !!arrowTip && arrowTip.done
      && Math.hypot(arrowTip.x - wx, arrowTip.y - wy) < 2;
    // and it is shot from the centre of the record, not from wherever the camera happened to be
    // IT COMES ALONG THE LINE FROM THE BEGINNING OF THE RECORD. After the camera flies, that point
    // is far off the screen, so what can be checked is not where the drawing starts but that the
    // drawing lies on the line: the direction is the meaning.
    { const c0x = (0 - cx) * zoom + ov.width / 2, c0y = ov.height / 2 + cy * zoom;
      const ux = wx - c0x, uy = wy - c0y, vx = (arrowTip ? arrowTip.x0 : 0) - c0x, vy = (arrowTip ? arrowTip.y0 : 0) - c0y;
      const cross = Math.abs(ux * vy - uy * vx) / Math.max(1, Math.hypot(ux, uy));
      T.arrow_starts_at = arrowTip ? [Math.round(arrowTip.x0), Math.round(arrowTip.y0)] : null;
      T.the_centre_of_the_record_is_at = [Math.round(c0x), Math.round(c0y)];
      T.how_far_the_arrow_is_off_that_line_px = arrowTip ? +cross.toFixed(2) : null;
      T.T18_it_is_shot_from_the_centre_of_the_record = !!arrowTip && cross < 2
        && arrowTip.x0 >= -1 && arrowTip.x0 <= ov.width + 1 && arrowTip.y0 >= -1 && arrowTip.y0 <= ov.height + 1; }
    for (let i = 0; i < 40 && card.style.display === 'none'; i++) await new Promise(r => setTimeout(r, 100));
    T.T19_and_then_the_card_opens = card.style.display !== 'none'
      && card.textContent.replace(/\s+/g, ' ').length > 20;
    T.the_card_after_arriving = card.textContent.replace(/\s+/g, ' ').slice(0, 90); }
  // AN ADDRESS THIS PAGE CANNOT ANSWER MUST SAY SO. The note claimed it already did; building such
  // a link was refused, but ARRIVING with one said nothing at all, which is the half a reader meets.
  { const A = window.__arrival || { said:[], shown:null };
    T.what_the_address_asked_for_that_this_page_cannot_answer = A.said;
    T.what_the_page_said_about_it = A.shown ? A.shown.replace(/\s+/g, ' ').slice(0, 150) : null;
    const said_it = A.said.length === 0 || (!!A.shown && A.said.every(x => A.shown.indexOf(x) >= 0));
    // and the sentences themselves, on addresses chosen here rather than on whatever this one was
    const one = complaints('https://x/?colour=red'), two = complaints('https://x/?key=abc'),
          none = complaints('https://x/?key=12&path=a');
    T.T20_an_address_it_cannot_answer_is_answered_in_words =
         said_it && one.length === 1 && one[0].indexOf('colour') >= 0
      && two.length === 1 && two[0].indexOf('whole number') >= 0 && none.length === 0; }
  // WHAT A LINE LEADS TO. The photographed line must say CABLES and open it; every carried file must
  // be given the application its folder proves and no other; a repository that is one application
  // must be proved by the repository alone; and where nothing is proved there must be no door at all.
  { codeOpen = false;                    // the door is met before the code is ever opened
    const withApp = cards.find(x => (appFor(x.owner, x.repo, x.path) || {}).app) || c;
    const noApp = cards.find(x => !(appFor(x.owner, x.repo, x.path) || {}).app);
    if (noApp) { show(address(noApp.k0 + 3)); await new Promise(r => setTimeout(r, 200));
      const r0 = card.querySelector('.cc-app');
      T.a_carried_file_no_application_claims = [noApp.path, r0 ? r0.textContent.slice(0, 40) : null];
      T.T26_a_carried_file_no_application_claims_gets_no_door = !!r0 && r0.tagName !== 'A' && !r0.querySelector('a:not(.cc-home):not(.cc-gh)'); }
    else T.T26_a_carried_file_no_application_claims_gets_no_door = true;
    show(address(withApp.k0 + Math.floor(withApp.lines / 2))); await new Promise(r => setTimeout(r, 200));
    const row = card.querySelector('.cc-app'), door = row && (row.tagName === 'A' ? row : row.querySelector('a:not(.cc-home):not(.cc-gh)'));
    T.the_app_row = row ? row.textContent.replace(/\s+/g, ' ') : null;
    const want_app = (appFor(withApp.owner, withApp.repo, withApp.path) || {}).app || null;
    T.T22_the_card_says_which_application_and_opens_it = !!row && !!want_app
      && row.getAttribute('data-app') === want_app.app && !!door && on(door)
      && door.href === (withApp.page && withApp.page.address !== want_app.live ? withApp.page.address : want_app.live);
    const wrong = [];
    for (const x of cards) { const f = appFor(x.owner, x.repo, x.path), got = f && f.app ? f.app.app : null;
      const byHand = apps.filter(a => a.repo === (x.owner + '/' + x.repo).toLowerCase()
        && a.prefixes.some(p => x.path === p || x.path.indexOf(p + '/') === 0)).map(a => a.app);
      if ((got || null) !== (byHand[0] || null) && !(byHand.length > 1 && byHand.indexOf(got) >= 0)) wrong.push([x.path, got, byHand]); }
    T.carried_files_and_their_applications = cards.map(x => [x.path.split('/').pop(), ((appFor(x.owner, x.repo, x.path) || {}).app || {}).app || 'none']);
    T.T23_every_carried_file_gets_the_application_its_folder_proves = apps.length > 0 && wrong.length === 0;
    // TWO WORKINGS OF ONE RULE MUST AGREE. The tool that carries a file works out its application by
    // folder and writes it down; this page works it out again for itself. File by file, and in the
    // number of lines that end up with a door, the two must come to the same answer.
    const differ = [], tally = { page:{}, tool:{} };
    for (const x of cards) { const pg = ((appFor(x.owner, x.repo, x.path) || {}).app || {}).app || '';
      if (pg !== x.toolApp) differ.push([x.path, 'page: ' + (pg || 'none'), 'tool: ' + (x.toolApp || 'none')]);
      if (pg) tally.page[pg] = (tally.page[pg] || 0) + x.lines;
      if (x.toolApp) tally.tool[x.toolApp] = (tally.tool[x.toolApp] || 0) + x.lines; }
    T.lines_with_a_door_by_application = tally; T.files_where_the_two_workings_differ = differ;
    T.T27_the_page_and_the_tool_agree_on_every_file_and_every_count = cards.length > 0 && differ.length === 0
      && JSON.stringify(tally.page) === JSON.stringify(tally.tool);
    // AND THE TWO EXAMPLES THE ORDER NAMES, asked for by name.
    const named = async (path, button, live) => { const x = cards.find(q => q.path === path);
      if (!x) return [false, 'the file ' + path + ' is not carried'];
      show(address(x.k0 + Math.floor(x.lines / 2))); await new Promise(r => setTimeout(r, 200));
      const rw = card.querySelector('.cc-app'), dr = rw && (rw.tagName === 'A' ? rw : null), pre = card.querySelector('details.cc-q');
      const above = !!dr && !!pre && dr.getBoundingClientRect().bottom <= pre.getBoundingClientRect().top + 0.5;
      return [!!rw && rw.textContent.indexOf(button) >= 0 && !!dr && dr.href === live && on(dr) && above,
              rw ? rw.textContent : null]; };
    const ca = await named('solar-bess-topology-v5/cable-geometry-visualiser-v5.html', 'CABLES',
      'https://globalgrid2050.com/solar-bess-topology-v5/cable-geometry-visualiser-v5.html');
    const ga = await named('atlas/index.html', 'GRIDATLAS', 'https://ventusltd.github.io/gridatlas/atlas/');
    T.the_cables_line_says = ca[1]; T.the_gridatlas_line_says = ga[1];
    T.T28_the_cables_line_opens_cables_above_the_code_without_scrolling = ca[0];
    T.T29_a_gridatlas_line_opens_gridatlas_above_the_code_without_scrolling = ga[0];
    // a line whose file is NOT known, in a repository that holds several applications: no door
    const other = commits.find(q => { const rp = repos[q.repo]; return rp.pub && !cardFor(q.k0)
      && (appFor(rp.owner, rp.name, null) || {}).unproved; });
    if (other) { show(address(other.k0)); await new Promise(r => setTimeout(r, 150));
      const r2 = card.querySelector('.cc-app');
      T.an_unproved_line_says = r2 ? r2.textContent.slice(0, 90) : null;
      // a page its files prove is a door; what must NOT appear is an application nobody proved
      T.T24_where_nothing_is_proved_there_is_no_door = !!r2 && (r2.classList.contains('cc-page')
        ? r2.getAttribute('data-app') === '' && !r2.querySelector('.cc-tile-part')
        : r2.tagName !== 'A' && !r2.querySelector('a:not(.cc-home):not(.cc-gh)')); }
    else T.T24_where_nothing_is_proved_there_is_no_door = true;
    // and a repository that IS one application is proved by the repository alone
    const wholeApp = apps.find(a => !a.prefixes.length);
    const oneOf = wholeApp && commits.find(q => { const rp = repos[q.repo];
      return rp.pub && (rp.owner + '/' + rp.name).toLowerCase() === wholeApp.repo; });
    if (oneOf) { show(address(oneOf.k0)); await new Promise(r => setTimeout(r, 150));
      const r3 = card.querySelector('.cc-app'), d3 = r3 && r3.tagName === 'A' ? r3 : null;
      T.a_whole_repository_application_says = r3 ? r3.textContent.slice(0, 70) : null;
      T.T25_a_repository_that_is_one_application_is_proved_by_the_repository = !!d3 && d3.href === wholeApp.live; }
    else T.T25_a_repository_that_is_one_application_is_proved_by_the_repository = true; }
  // THE CARD AS THE PERSON WHO SIGNS FIRST MEETS IT: the code closed. The application is the first
  // and biggest thing and the whole of it is the door; the brand block is GridAtlas's own; one plain
  // line says what was done and when; and above the closed code there is not one word a banker would
  // not use.
  { codeOpen = false;
    const x = cards.find(q => { const ap = (appFor(q.owner, q.repo, q.path) || {}).app; return ap && q.page && q.page.address === ap.live; })
           || cards.find(q => (appFor(q.owner, q.repo, q.path) || {}).app) || c;
    show(address(x.k0 + Math.floor(x.lines / 2))); await new Promise(r => setTimeout(r, 250));
    const tile = card.querySelector('a.cc-tile'), det = card.querySelector('details.cc-q');
    const name = tile && tile.querySelector('.cc-tile-name'), open = tile && tile.querySelector('.cc-tile-open');
    const first = Array.from(card.children).filter(k => !k.classList.contains('cc-x'))[0];
    const biggest = name ? parseFloat(getComputedStyle(name).fontSize) : 0;
    let others = 0; for (const e of card.querySelectorAll('*')) if (e !== name && !e.contains(name) && e.getClientRects().length && e.textContent.trim())
      others = Math.max(others, parseFloat(getComputedStyle(e).fontSize) || 0);
    T.the_tile_says = tile ? tile.textContent.replace(/\s+/g, ' ').slice(0, 140) : null;
    // the tile is the first thing in the head, and the head is the first thing in the card
    T.T30_the_application_is_the_first_and_biggest_thing_and_the_whole_tile_opens_it = !!tile && (first === tile || (first.classList.contains('cc-head') && first.firstElementChild === tile))
      && on(tile) && on(open) && biggest > others && /^OPEN /.test(open.textContent)
      && tile.href === ((appFor(x.owner, x.repo, x.path) || {}).app || {}).live;
    T.T31_the_application_says_what_it_does_for_a_project = !!tile && !!tile.querySelector('.cc-tile-what')
      && tile.querySelector('.cc-tile-what').textContent.length > 20;
    const b = card.querySelector('.scada-brand');
    T.T32_the_brand_block_is_gridatlas_own = !!b && b.querySelector('.scada-brand-main').textContent === 'Ventus'
      && b.querySelector('.scada-brand-sub').textContent === 'Cables & Connectivity\u00ae' && on(b);
    T.T33_the_code_is_closed_until_asked_for = !!det && det.open === false && !on(card.querySelector('.cc-code'))
      && det.querySelector('summary').textContent === 'See the code behind this';
    // every word above the closed code, as a reader sees it
    let above = ''; for (const k of card.children) { if (k === det) break; above += ' ' + k.textContent; }
    T.words_above_the_code = above.replace(/\s+/g, ' ').trim().slice(0, 200);
    T.coder_words_above_the_code = ['commit', 'key', 'repository', 'path', 'line ', 'piece of work'].filter(w => above.toLowerCase().indexOf(w) >= 0);
    T.T34_no_word_above_the_code_that_a_banker_would_not_use = T.coder_words_above_the_code.length === 0
      && /(?<!\d)\d{1,2} [A-Z][a-z]{2} \d{4}(?!\d)/.test(above);
    det.open = true; await new Promise(r => setTimeout(r, 200));
    T.T35_one_tap_opens_the_code_with_the_line_marked = on(card.querySelector('.cc-code'))
      && !!cardShown && !!cardShown.window && Math.abs(parseFloat(cardShown.window.bar.style.top) || -1) >= 0; }
  // NO CARD IS A DEAD END, AND NO LINK IS A SENTENCE. With an application: its tile, and GitHub as one
  // word. Without one: the site itself, and GitHub as one word. Never a link that reads like a paragraph.
  { codeOpen = false;
    const noApp = commits.find(q => { const rp = repos[q.repo]; return rp.pub && !appFor(rp.owner, rp.name, null) && !pageOfWork[q.sha]; });
    if (noApp) { show(address(noApp.k0)); await new Promise(r => setTimeout(r, 150));
      const hm = card.querySelector('.cc-links a.cc-home');
      T.a_card_with_no_application_offers = Array.from(card.querySelectorAll('.cc-links a')).map(x => x.textContent);
      const wantDoor = frontOfWork[noApp.sha] || 'https://www.globalgrid2050.com/';
      T.T36_a_card_with_nothing_else_offers_the_site = !!hm && hm.href === wantDoor && on(hm)
        && card.textContent.indexOf('This work has no page of its own yet.') >= 0; }
    else T.T36_a_card_with_nothing_else_offers_the_site = true;
    const longest = Array.from(card.querySelectorAll('a:not(.cc-tile)')).reduce((m, x) => Math.max(m, x.textContent.trim().split(/\s+/).length), 0);
    T.T37_no_link_reads_like_a_sentence = longest <= 3;
    // and the drawing engine's work leads to the London Underground, the example that was missed
    const ug = apps.find(q => q.app === 'underground'), uc = ug && commits.find(q => { const rp = repos[q.repo];
      return (rp.owner + '/' + rp.name).toLowerCase() === ug.repo; });
    if (uc) { show(address(uc.k0)); await new Promise(r => setTimeout(r, 150));
      const t2 = card.querySelector('a.cc-tile');
      T.the_drawing_engine_leads_to = t2 ? t2.textContent.slice(0, 60) : null;
      T.T38_the_drawing_engine_leads_to_the_london_underground = !!t2 && t2.href === ug.live && on(t2); }
    else T.T38_the_drawing_engine_leads_to_the_london_underground = false; }
  // THE NEAREST PAGE. A program opens the page of its own folder, named by that page's own title; a
  // page that still stands opens ITSELF and not its application's front door; GitHub is one grey word
  // at the very bottom of the fold; and the honest count of where the whole record lands is kept.
  { codeOpen = false;
    const prog = cards.find(q => q.path === 'cable_geometry/app.js');
    if (prog) { show(address(prog.k0 + 609)); await new Promise(r => setTimeout(r, 200));
      const t = card.querySelector('a.cc-tile'), nm = t && t.querySelector('.cc-tile-name'), pt = t && t.querySelector('.cc-tile-part');
      T.a_program_leads_to = t ? [t.href, nm && nm.textContent, pt && pt.textContent] : null;
      T.T39_a_program_opens_the_page_of_its_own_folder_by_its_title = !!t && t.href === 'https://globalgrid2050.com/cable_geometry/'
        && !!nm && nm.textContent === prog.page.title && nm.textContent.length > 3 && !!pt && pt.textContent === 'part of CABLES'
        && t.querySelector('.cc-tile-open').textContent === 'OPEN THIS PAGE' && on(t); }
    else T.T39_a_program_opens_the_page_of_its_own_folder_by_its_title = false;
    // a piece of work whose code is NOT carried still lands on a page, by the agreement of its files
    const plain = commits.find(q => pageOfWork[q.sha] && !cardFor(q.k0) && repos[q.repo].pub);
    if (plain) { show(address(plain.k0)); await new Promise(r => setTimeout(r, 150));
      const t = card.querySelector('a.cc-tile');
      T.an_uncarried_piece_of_work_leads_to = t ? t.href : null;
      T.T40_work_whose_code_is_not_carried_still_lands_on_a_page = !!t && t.href === pageOfWork[plain.sha].address && on(t); }
    else T.T40_work_whose_code_is_not_carried_still_lands_on_a_page = false;
    // GitHub, humble
    const det = card.querySelector('details.cc-q'); let outside = '';
    for (const k of card.children) if (k !== det) outside += ' ' + k.textContent;
    const last = det && det.lastElementChild, sa = last && last.querySelector('a');
    T.T41_github_is_one_grey_word_at_the_bottom_of_the_fold = !/github/i.test(outside) && !!last
      && last.classList.contains('cc-source') && !!sa && sa.textContent === 'source' && /github\.com/.test(sa.href);
    // where the whole record lands, counted here and not claimed
    const lands = { a_page_of_its_own:0, an_application:0, a_front_door:0, not_public:0 };
    for (const q of commits) { const rp = repos[q.repo];
      if (!rp.pub) lands.not_public++; else if (pageOfWork[q.sha]) lands.a_page_of_its_own++;
      else if ((appFor(rp.owner, rp.name, null) || {}).app) lands.an_application++; else lands.a_front_door++; }
    T.where_the_whole_record_lands = lands;
    // THE PARTS MUST MAKE THE WHOLE, AND A PAGE OF ONE'S OWN IS NEVER THE TOP OF A SITE. The last
    // version's note said three quarters; the true figure is about a fifth, because a walk that ends
    // at the top of a site had been counted as finding a page.
    const tops = Object.keys(pageById).map(i => pageById[i].address).filter(u => /^https?:\/\/[^/]+\/?$/.test(u)
      || /^https?:\/\/ventusltd\.github\.io\/[^/]+\/?$/.test(u) || Object.keys(frontOfWork).some(k => frontOfWork[k] === u));
    T.pages_of_their_own_that_are_really_a_site_top = tops.slice(0, 5);
    T.T42_the_parts_make_the_whole_and_no_own_page_is_a_site_top = tops.length === 0 && lands.a_page_of_its_own > 0
      && lands.a_page_of_its_own + lands.an_application + lands.a_front_door + lands.not_public === commits.length; }
  // THE HEADER IS THE HEADER. With the code OPEN, the application tile is still at the top of the card and can
  // still be pressed, the code window begins BELOW it, and the marked line is in view. Asked at this size.
  { codeOpen = true; const x = cards.find(q => (appFor(q.owner, q.repo, q.path) || {}).app) || c;
    show(address(x.k0 + Math.floor(x.lines / 2)));
    for (let i = 0; i < 60 && !(cardShown && cardShown.window); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 250));
    const tile = card.querySelector('a.cc-tile'), pre = card.querySelector('.cc-code'), op = tile && tile.querySelector('.cc-tile-open');
    const tr = tile && tile.getBoundingClientRect(), pr = pre && pre.getBoundingClientRect(), cr = card.getBoundingClientRect();
    T.with_the_code_open = { card:[Math.round(cr.top), Math.round(cr.bottom)], tile:tr && [Math.round(tr.top), Math.round(tr.bottom)], code:pr && [Math.round(pr.top), Math.round(pr.bottom)] };
    const w = cardShown && cardShown.window, lh = pre ? parseFloat(getComputedStyle(pre).lineHeight) || 16 : 16;
    const markY = pre && w ? pr.top + (w.at - w.first) * lh - pre.scrollTop : -1;
    T.T33_with_the_code_open_the_application_tile_is_still_there_to_press = !!tile && on(op) && tr.top >= cr.top - 1;
    T.T34_the_code_begins_below_the_head_and_the_marked_line_is_in_view = !!pre && pr.top >= tr.bottom - 1 && pr.bottom <= cr.bottom + 1
      && markY >= pr.top - 1 && markY <= pr.bottom - lh + 2; }
  // HOW MUCH OF THE RECORD NOW SHOWS REAL CODE, MEASURED AND NOT CLAIMED: 200 taps chosen by a fixed seed,
  // uniform over every line ever written, as RANDOM LINE chooses; a tap shows code when its file is carried
  // here or its piece of work changed code the table names. And RANDOM LINE itself must show code, or say why.
  { let seed = 20260920; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; let yes = 0, carried = 0, notPublic = 0;
    for (let i = 0; i < 200; i++) { const j = Math.floor(rnd() * N), cc = commits[findBy('cum', j)], k = cc.k0 + (j - cc.cum);
      if (!repos[cc.repo].pub) { notPublic++; continue; } if (cardFor(k)) { carried++; yes++; } else if (table && table[cc.sha]) yes++; }
    T.of_200_seeded_taps = { show_code:yes, of_which_carried_here:carried, not_public:notPublic };
    T.T32_most_taps_show_real_code = yes >= 120; }
  T.sample_line = want === null ? null : String(want).slice(0, 80);
  T.PASS = T.T1_the_card_opened_for_that_key && T.T2_the_line_shown_is_the_line_that_file_holds
        && T.T3_that_exact_text_is_on_the_screen && T.T4_it_is_the_marked_line
        && T.T5_the_card_is_on_the_screen && T.T6_a_dot_with_no_carried_file_shows_the_code_its_work_changed && T.T32_most_taps_show_real_code
        && T.T33_with_the_code_open_the_application_tile_is_still_there_to_press && T.T34_the_code_begins_below_the_head_and_the_marked_line_is_in_view
        && T.T7_the_github_link_is_on_the_screen && T.T8_ten_lines_below_are_there_and_five_are_on_the_screen
        && T.T9_no_code_line_runs_off_the_right_edge && T.T10_the_header_says_what_day_the_work_was_done
        && T.T11_it_says_the_work_the_day_and_where_to_see_it
        && T.T12_no_arithmetic_and_no_command_anywhere_on_the_page
        && T.T13_a_gap_leads_to_the_next_work && T.T14_an_empty_readout_draws_no_box
        && T.T15_a_link_this_page_built_parses_back_to_what_it_asked_for
        && T.T16_no_address_is_typed_by_hand_in_this_page
        && T.T17_the_arrow_ends_on_the_dot && T.T18_it_is_shot_from_the_centre_of_the_record
        && T.T19_and_then_the_card_opens && T.T20_an_address_it_cannot_answer_is_answered_in_words
        && T.T21_the_state_chip_says_OK_and_only_one_thing
        && T.T22_the_card_says_which_application_and_opens_it
        && T.T23_every_carried_file_gets_the_application_its_folder_proves
        && T.T24_where_nothing_is_proved_there_is_no_door
        && T.T25_a_repository_that_is_one_application_is_proved_by_the_repository
        && T.T26_a_carried_file_no_application_claims_gets_no_door
        && T.T27_the_page_and_the_tool_agree_on_every_file_and_every_count
        && T.T28_the_cables_line_opens_cables_above_the_code_without_scrolling
        && T.T29_a_gridatlas_line_opens_gridatlas_above_the_code_without_scrolling
        && T.T30_the_application_is_the_first_and_biggest_thing_and_the_whole_tile_opens_it
        && T.T31_the_application_says_what_it_does_for_a_project && T.T32_the_brand_block_is_gridatlas_own
        && T.T33_the_code_is_closed_until_asked_for && T.T34_no_word_above_the_code_that_a_banker_would_not_use
        && T.T35_one_tap_opens_the_code_with_the_line_marked
        && T.T36_a_card_with_nothing_else_offers_the_site && T.T37_no_link_reads_like_a_sentence
        && T.T38_the_drawing_engine_leads_to_the_london_underground
        && T.T39_a_program_opens_the_page_of_its_own_folder_by_its_title
        && T.T40_work_whose_code_is_not_carried_still_lands_on_a_page
        && T.T41_github_is_one_grey_word_at_the_bottom_of_the_fold
        && T.T42_the_parts_make_the_whole_and_no_own_page_is_a_site_top;
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}

// LIGHT A REPOSITORY, TESTED. ?selftest=repo:<name>, or repo:* for the largest one. Two questions.
// ONE, the picture: walking outward from the centre, a pixel is green if and only if the key at
// that pixel's centre belongs to that repository. A pixel whose radial span straddles a change of
// owner is excluded and counted separately, because at this zoom one pixel covers hundreds of
// millions of addresses and the shader and this loop need not agree on which side of the line it
// falls. Every other pixel must agree exactly.
// TWO, the number: the repository's line total added up through the running totals, which is the
// arithmetic the shading itself is made of, must equal the direct sum of its commits, and both
// must equal what cosmos/repos.tsv declared before any of this was drawn. Three sources, one
// number, or the test fails.
function repoSelftest(name){
  const rp = (name === '*') ? repos.reduce((a, b) => b.lines > a.lines ? b : a)
                            : repos.find(x => x.name.toLowerCase() === name.toLowerCase());
  if (!rp) { window.__selftest = { PASS:false, asked_for:name, error:'no repository of that name is on this wafer' };
    document.title = 'selftest FAIL'; return; }
  let byRunning = 0, directly = 0, n = 0;
  for (const c of commits) if (c.repo === rp.i) { byRunning += issuedBelow(c.k1) - issuedBelow(c.k0); directly += c.lines; n++; }
  litRepo = rp.i; litK = [-1,-1]; litCi = null; newFrom = -1; flash = 0; pulse = -1; target = null; card.style.display = 'none';
  tween = null; { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; } draw();
  const W = cv.width, H = cv.height, Rpx = Math.sqrt(SPACE)*zoom;
  const col0 = Math.round(W/2 - cx*zoom), row0 = Math.round(H/2 - cy*zoom);   // the wafer's own centre, in GL pixels
  const span = Math.max(4, Math.floor(Rpx) - 1);
  const strip = (x, y, w, h) => { const b = new Uint8Array(w*h*4); gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const east = strip(col0, row0, span, 1), north = strip(col0, row0, 1, span);
  let lit = 0, dark = 0, wrong = 0, straddled = 0; const wrongAt = [];
  function check(buf, i, wx, wy, hx, hy, where){
    const own = ownerAt(Math.hypot(wx, wy));
    if (ownerAt(Math.hypot(wx-hx, wy-hy)) !== own || ownerAt(Math.hypot(wx+hx, wy+hy)) !== own) { straddled++; return; }
    const r0 = buf[i*4], g0 = buf[i*4+1], b0 = buf[i*4+2];
    const green = g0 > 120 && g0 > r0 + 40 && g0 > b0 + 30;
    if (green === (own === rp.i)) { green ? lit++ : dark++; }
    else { wrong++; if (wrongAt.length < 8) wrongAt.push({ strip:where, pixel_from_centre:i,
      key_belongs_to: own === -1 ? 'silence' : (own === -2 ? 'beyond the rim' : repos[own].name),
      drawn: green ? 'green' : 'not green', rgb:[r0, g0, b0] }); }
  }
  const hudWhenLit = hud.textContent;                 // what the page told the reader while it was lit
  const wy0 = cy + (row0 + 0.5 - H/2)/zoom, wx0 = cx + (col0 + 0.5 - W/2)/zoom, h = 0.5/zoom;
  for (let i = 0; i < span; i++) check(east, i, cx + (col0 + i + 0.5 - W/2)/zoom, wy0, h, 0, 'east');
  for (let i = 0; i < span; i++) check(north, i, wx0, cy + (row0 + i + 0.5 - H/2)/zoom, 0, h, 'north');
  { const hm = homeCamera(); cx = hm.x; cy = hm.y; zoom = hm.z; litRepo = -1; dirty = true; draw(); }
  const wpx = widestRunPx(rp.i, Rpx/Math.sqrt(SPACE));
  const tooSmall = wpx < 1;
  const said = /FINER THAN ONE PIXEL/.test(hudWhenLit);
  const T = { repository: rp.name, commits: n, viewport:[W, H], wafer_radius_px: Math.round(Rpx), pixels_walked: 2*span,
    // A pixel is green if and only if the key at its centre belongs to this repository. Nothing
    // else is asserted: a repository under a pixel wide lights nothing, and the second test is
    // that the page says that out loud instead of showing an empty wafer and letting it pass.
    T1_no_pixel_disagrees_with_the_keys: wrong === 0,
    T2_it_lights_pixels_or_the_page_says_it_is_too_small: lit > 0 || (tooSmall && said),
    widest_unbroken_run_px_at_this_zoom: +wpx.toFixed(4), finer_than_one_pixel: tooSmall, the_page_said_so: said,
    pixels: { green_and_owned_by_it: lit, not_green_and_not_owned_by_it: dark, disagreed: wrong, straddled_a_boundary_and_excluded: straddled },
    first_disagreements: wrongAt,
    T3_running_totals_equal_the_direct_sum: byRunning === directly,
    T4_and_equal_what_the_belt_declared: directly === rp.lines,
    lines_by_running_totals: byRunning, lines_added_directly: directly, lines_declared_by_the_belt: rp.lines };
  T.PASS = T.T1_no_pixel_disagrees_with_the_keys && T.T2_it_lights_pixels_or_the_page_says_it_is_too_small
        && T.T3_running_totals_equal_the_direct_sum && T.T4_and_equal_what_the_belt_declared;
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}
// THE PHONE TEST, run by the page on itself with ?selftest=phone at whatever size the window is.
// It states that size, so the verdict is about a real viewport and not about a claim. Three
// mechanical questions: does any permanent panel cover the wafer, does the card fit on the screen,
// and do a drag and a two finger pinch actually move the camera when the events are dispatched.
function phoneSelftest(){
  tween = null; { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; } draw();
  const W = innerWidth, H = innerHeight, Rpx = Math.sqrt(SPACE)*zoom;
  const scx = (0 - cx)*zoom + W/2, scy = H/2 + cy*zoom;          // where the wafer's centre really is on screen
  const panels = []; let worst = 1e9;
  for (const id of ['top','hud','foot']) { const r = document.getElementById(id).getBoundingClientRect();
    const qx = Math.max(r.left, Math.min(scx, r.right)), qy = Math.max(r.top, Math.min(scy, r.bottom));
    const clear = Math.hypot(qx - scx, qy - scy) - Rpx;          // nearest point of the panel, less the rim radius
    panels.push({ panel:id, rect:[r.left, r.top, r.right, r.bottom].map(Math.round), clear_of_the_rim_px:Math.round(clear) });
    worst = Math.min(worst, clear); }
  const onScreen = scx - Rpx >= -0.5 && scx + Rpx <= W + 0.5 && scy - Rpx >= -0.5 && scy + Rpx <= H + 0.5;
  show(address(Math.floor(N/2))); layout();
  const cr = card.getBoundingClientRect();
  const cardFits = cr.left >= -0.5 && cr.top >= -0.5 && cr.right <= W + 0.5 && cr.bottom <= H + 0.5 && cr.width > 40 && cr.height > 20;
  const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId:id, clientX:x, clientY:y, bubbles:true, pointerType:'touch' }));
  const z0 = zoom, cx0 = cx;                                     // one finger: the world must follow it
  ev('pointerdown', 11, Math.round(W*0.5), Math.round(H*0.5)); ev('pointermove', 11, Math.round(W*0.5) + 60, Math.round(H*0.5));
  const dragged = cx0 - cx; ev('pointerup', 11, Math.round(W*0.5) + 60, Math.round(H*0.5));
  const zA = zoom;                                               // two fingers: the distance between them must set the zoom
  ev('pointerdown', 21, Math.round(W*0.35), Math.round(H*0.5)); ev('pointerdown', 22, Math.round(W*0.65), Math.round(H*0.5));
  const spread = Math.round(W*0.65) - Math.round(W*0.35);
  ev('pointermove', 22, Math.round(W*0.35) + 2*spread, Math.round(H*0.5));
  const zB = zoom; ev('pointerup', 21, 0, 0); ev('pointerup', 22, 0, 0);
  // put the wafer back the way it was found: the test's own light is not part of the record
  { const h = homeCamera(); cx = h.x; cy = h.y; zoom = h.z; atHome = true; litRepo = -1; target = null;
    card.style.display = 'none'; dirty = true; draw(); }
  // THE PUBLIC FACE, CHECKED ON THE FACE ITSELF. Functions, use cases and disclaimers: what a person
  // can do here, what it is for, and what it is not. The placement law, the angle and the unresolved
  // pixels are engineering notes and belong in the repository, not in front of a reader.
  // PRESENT IS NOT THE SAME AS VISIBLE. textContent returns words that are set to display:none as
  // happily as words on the screen, so every check passed while a phone showed no disclaimer at all.
  // Ask the layout instead: a node with no client rectangles is not in front of anybody.
  const seen = el => { if (!el) return ''; let out = '';
    const walk = n => { if (n.nodeType === 3) { const r = document.createRange(); r.selectNodeContents(n);
        if (r.getClientRects().length) out += ' ' + n.nodeValue; return; }
      if (n.nodeType !== 1 || !n.getClientRects().length) return;
      for (const c of n.childNodes) walk(c); };
    walk(el); return out.replace(/\s+/g, ' ').trim().toLowerCase(); };
  const faceSeen = seen(document.getElementById('foot')) + ' ' + seen(document.getElementById('top'));
  // NOTHING MAY RUN OFF THE RIGHT EDGE. A box whose content is wider than the box itself is a box
  // with words hidden in it, which is how a cut disclaimer looks to everyone except a test.
  const overflows = [];
  for (const id of ['top','hud','foot','card']) { const el = document.getElementById(id);
    if (el && el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
      overflows.push({ panel:id, content_px:el.scrollWidth, box_px:el.clientWidth }); }
  const face = (document.getElementById('foot').textContent + ' ' + document.getElementById('top').textContent).toLowerCase();
  const T = { viewport:[W, H], narrow_layout:narrow(), wafer_centre_on_screen:[Math.round(scx), Math.round(scy)], wafer_radius_px:Math.round(Rpx),
    T7_the_face_carries_the_disclaimer: face.indexOf('without warranty of any kind') >= 0,
    T9_the_disclaimer_is_actually_on_the_screen: faceSeen.indexOf('without warranty of any kind') >= 0,
    T10_nothing_is_cut_off_at_the_right_edge: overflows.length === 0, panels_that_overflow: overflows,
    visible_face_words: faceSeen.length,
    T8_the_face_explains_no_machinery: !/golden|one law|√|sqrt|unresolved pixel/.test(face),
    T1_no_permanent_panel_covers_the_wafer: worst >= 0, panels,
    T2_the_whole_wafer_is_on_the_screen: onScreen,
    T3_the_card_fits: cardFits, card_rect:[cr.left, cr.top, cr.right, cr.bottom].map(Math.round),
    T4_one_finger_drags: Math.abs(dragged - 60/z0) < 1e-6, dragged_world_units:+dragged.toFixed(6), expected_world_units:+(60/z0).toFixed(6),
    T5_two_fingers_pinch: zB > zA*1.8 && zB <= ZMAX + 1e-9, zoom_before_pinch:+zA.toFixed(6), zoom_after_pinch:+zB.toFixed(6) };
  T.PASS = T.T1_no_permanent_panel_covers_the_wafer && T.T2_the_whole_wafer_is_on_the_screen && T.T3_the_card_fits
        && T.T4_one_finger_drags && T.T5_two_fingers_pinch;
  T.PASS = T.PASS && T.T7_the_face_carries_the_disclaimer && T.T8_the_face_explains_no_machinery
        && T.T9_the_disclaimer_is_actually_on_the_screen && T.T10_nothing_is_cut_off_at_the_right_edge;
  window.__selftest = T; document.title = 'selftest ' + (T.PASS ? 'PASS' : 'FAIL');
}
// LIGHT A PERIOD. "2026-07" or "2026-07-14". Time order makes it one band, so the count is a
// difference of two running totals and the light is one annulus.
function lightTime(y, m, d){
  endIsolate();
  const t0 = Date.UTC(y, m ? m-1 : 0, d || 1)/1000, t1 = d ? t0 + 86400 : Date.UTC(m ? y : y+1, m ? m : 0, 1)/1000;
  const i0 = (commits[0].unix >= t0) ? 0 : findBy('unix', t0 - 1) + 1, i1 = (commits[0].unix >= t1) ? 0 : findBy('unix', t1 - 1) + 1;
  const label = y + (m ? '-' + String(m).padStart(2,'0') : '') + (d ? '-' + String(d).padStart(2,'0') : '');
  litRepo = -1; newFrom = -1; flash = 0; target = null; card.style.display = 'block';
  if (i1 <= i0) { litK = [-1,-1]; litCi = null; card.classList.remove('sheet'), card.innerHTML = label + '\nsilence: no commit carries that date'; home(); dirty = true; return null; }
  const last = commits[i1-1], lines = last.cum + last.lines - commits[i0].cum, rs = new Set(); for (let i = i0; i < i1; i++) rs.add(commits[i].repo);
  litK = [Math.sqrt(commits[i0].k0), Math.sqrt(last.k1)]; litCi = [i0, i1];
  card.classList.remove('sheet'), card.innerHTML = 'ENERGISED · ' + label + '\n<b>' + fmt(lines) + '</b> lines in <b>' + fmt(i1 - i0) + '</b> commits across ' + rs.size + ' repositories'
    + '\nkeys ' + fmt(commits[i0].k0) + ' to ' + fmt(last.k1) + ' · one band, because keys run in time order';
  home(); dirty = true; return { i0, i1, lines };
}
// TOUCH. Every pointer that is down is held in one map, so one finger drags and two pinch, and a
// mouse is just a pointer with one finger. The pinch keeps the world point between the fingers
// under the fingers, which is the same rule the wheel already obeys, so zooming in on a phone and
// on a desktop land on the same key.
const ZMAX = 60;
let drag = null, moved = 0, pinch = null;
const pts = new Map();
function pinchNow(){ const v = [...pts.values()], a = v[0], b = v[1];
  return { d:Math.hypot(a.x-b.x, a.y-b.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2 }; }
cv.addEventListener('pointerdown', e => {
  pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (pts.size === 2) { const s = pinchNow(), w = toWorld(s.mx, s.my); pinch = { d0:s.d, z0:zoom, wx:w[0], wy:w[1] }; drag = null; moved = 99; }
  else if (pts.size === 1) { drag = [e.clientX, e.clientY]; moved = 0; }
});
addEventListener('pointermove', e => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (pinch && pts.size >= 2) { const s = pinchNow(); if (pinch.d0 > 1) {
      zoom = Math.max(1e-4, Math.min(ZMAX, pinch.z0 * s.d / pinch.d0));
      cx = pinch.wx - (s.mx - innerWidth/2)/zoom; cy = pinch.wy + (s.my - innerHeight/2)/zoom;
      atHome = false; tween = null; dirty = true; } return; }
  if (!drag) return; moved += Math.abs(e.clientX-drag[0]) + Math.abs(e.clientY-drag[1]);
  cx -= (e.clientX-drag[0])/zoom; cy += (e.clientY-drag[1])/zoom; drag = [e.clientX, e.clientY];
  atHome = false; tween = null; dirty = true; });
function pointerGone(e){ pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) drag = null; }
