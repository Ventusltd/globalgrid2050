// gen2.mjs — generation 2 self-test. Serves the repo on 127.0.0.1:8875, drives headless Chrome (GPU flags), runs the round-2 checks,
// writes proof/gen2.json, proof/gen2.stdout.txt (via the caller's redirect), proof/gen2-server.log and three screenshots, then stops the server.
// run:  node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/gen2.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execSync, execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');
const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050';
const DIR = ROOT + '/testcode/202609142202';
const PORT = 8875;
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const R = { started_utc: new Date().toISOString(), port: PORT, url: URL };
const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- ground truth from disk ----
R.node_check = (() => { try { execFileSync('node', ['--check', DIR + '/quantum.js'], { stdio: 'pipe' }); return 'ok'; } catch (e) { return 'FAILED: ' + e.message; } })();
const prov = JSON.parse(fs.readFileSync(DIR + '/data/provenance.json', 'utf8'));
const linesBuf = fs.readFileSync(DIR + '/data/lines.bin'); const uniqBuf = fs.readFileSync(DIR + '/data/all-lines.bin'); const famBuf = fs.readFileSync(DIR + '/data/all-lines.family.bin');
const uniq = new Uint32Array(uniqBuf.buffer, uniqBuf.byteOffset, uniqBuf.length / 4);
let inFam = 0; for (const v of famBuf) inFam += v;
R.disk = { lines_bin_entries: linesBuf.length / 4, all_lines: uniq.length, in_a_family: inFam, outside: uniq.length - inFam, lines_md_generated_utc: prov.checks.lines_md_generated_utc };
const firstOutside = (() => { for (let i = 0; i < uniq.length; i++) if (!famBuf[i]) return uniq[i]; })();
const firstInside = (() => { for (let i = 0; i < uniq.length; i++) if (famBuf[i]) return uniq[i]; })();
const stamp = prov.checks.lines_md_generated_utc; const stampText = `${stamp.slice(0, 10)} ${stamp.slice(11, 16)} UTC`;
R.expected_count_line = `on GPU: ${uniq.length.toLocaleString('en-GB')} unique numbered lines (LINES.md ${stampText}) + ${(linesBuf.length / 4).toLocaleString('en-GB')} family-line entries · ${inFam.toLocaleString('en-GB')} unique lines sit inside a function family, ${(uniq.length - inFam).toLocaleString('en-GB')} do not`;
log('node --check:', R.node_check, '| disk:', JSON.stringify(R.disk));

// ---- static server ----
const serverLog = fs.openSync(DIR + '/proof/gen2-server.log', 'w');
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', serverLog, serverLog] });
await sleep(1500);

let browser;
try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check'] });
  R.chrome_version = await browser.version();
  async function openPage(w, h, dpr, mobile) {
    const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: !!mobile, hasTouch: !!mobile });
    const con = [], errs = [], external = [], failed = [];
    page.on('console', m => con.push({ type: m.type(), text: m.text().slice(0, 300) }));
    page.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 300)));
    page.on('requestfailed', r => failed.push(r.url() + ' ' + (r.failure() && r.failure().errorText)));
    page.on('request', r => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${PORT}/`)) external.push(u); });
    const t0 = Date.now(); await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__qts && window.__qts.S && window.__qts.S.seaDrawn > 0 && window.__qts.S.uniqDrawn > 0, { timeout: 60000 });
    return { page, con, errs, external, failed, readyMs: Date.now() - t0 };
  }
  const hudLines = p => p.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
  const hudFind = async (p, re) => (await hudLines(p)).find(l => re.test(l)) || null;
  const consoleSummary = P => ({ all: P.con.length, errors: P.con.filter(c => c.type === 'error'), warnings: P.con.filter(c => c.type === 'warning' || c.type === 'warn'), pageerrors: P.errs.slice(), requestfailed: P.failed.slice(), external_requests: P.external.slice() });
  const measureFps = p => p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = t => { n++; if (t - t0 < 3000) requestAnimationFrame(f); else res({ frames: n, ms: +(t - t0).toFixed(1), fps: +((n - 1) * 1000 / (t - t0)).toFixed(1) }); }; requestAnimationFrame(f); }));
  const state = p => p.evaluate(() => { const S = window.__qts.S; return { atom: S.atom ? { n: S.atom.n, name: S.atom.name, valence: S.atom.valence, tunnelling: S.atom.tunnelling } : null, famIdx: S.famIdx, key: S.key, lastQuery: S.lastQuery, measurements: S.measurements.length, outcome: S.outcome, msg: S.msg, hold: S.hold, seaDrawn: S.seaDrawn, uniqDrawn: S.uniqDrawn, seaBytes: S.seaBytes, uniqBytes: S.uniqBytes, lastDrawCalls: S.lastDrawCalls, contextLost: S.contextLost, phone: window.__qts.G.phone }; });
  const search = async (p, q) => { await p.evaluate(() => { const s = document.querySelector('#search'); s.value = ''; s.focus(); }); await p.type('#search', q); await p.keyboard.press('Enter'); await sleep(200); };
  const labelReport = p => p.evaluate(() => {
    const cv = document.querySelector('#gl').getBoundingClientRect();
    const boxes = Array.from(document.querySelectorAll('#labels .lb')).map(l => { const b = l.getBoundingClientRect(); return { text: l.textContent.slice(0, 40), l: b.left, t: b.top, r: b.right, b: b.bottom }; });
    const overlaps = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], c = boxes[j]; if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) overlaps.push([a.text, c.text]); }
    const outside = boxes.filter(b => b.l < cv.left - 2 || b.r > cv.right + 2 || b.t < cv.top - 2 || b.b > cv.bottom + 2).map(b => b.text);
    return { labels: boxes.length, overlaps, outside, canvas: { w: Math.round(cv.width), h: Math.round(cv.height) } };
  });

  // =================== DESKTOP 1440x1000 ===================
  {
    const P = await openPage(1440, 1000, 1, false); const page = P.page; const d = R.desktop = { readyMs: P.readyMs };
    d.renderer_page_S = await page.evaluate(() => window.__qts.S.renderer);
    d.renderer_fresh_context = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); if (!gl) return 'no webgl2'; const x = gl.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'ext missing: ' + gl.getParameter(gl.RENDERER); });
    await sleep(3000);
    const hl = await hudLines(page);
    d.hud_count_lines = hl.slice(1, 4); d.hud_count_line_matches_disk = hl[1] === R.expected_count_line;
    d.state_line = hl.find(l => l.startsWith('state:')); d.born_line = hl.find(l => l.startsWith('last measurement (Born audit):')); d.caveats_line = hl.find(l => l.startsWith('data caveats:'));
    d.count_div = await page.evaluate(() => document.querySelector('#count').textContent);
    d.fps_3s = await measureFps(page); d.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    d.state0 = await state(page); d.labels = await labelReport(page);
    log('desktop: renderer', d.renderer_page_S); log('HUD count line:', hl[1]); log('HUD line 2:', hl[2]); log('matches disk:', d.hud_count_line_matches_disk); log('fps 3 s:', JSON.stringify(d.fps_3s), 'scrollWidth', d.scrollWidth, 'draw calls', d.state0.lastDrawCalls, 'VBO', d.state0.seaBytes, '+', d.state0.uniqBytes); log('desktop labels:', JSON.stringify(d.labels));
    // wording checks: no bare TUNNEL outside the valence-gated sentence; P(away) on the state line; the pole prints no φ number after a collapse (checked later)
    d.wording = { state_has_P_away: /P\(away\)/.test(d.state_line), hud_lines_with_TUNNEL: hl.filter(l => /TUNNEL/.test(l)).map(l => l.slice(0, 160)), caveats_has_tunnelling_counts: /atoms with a tunnelling bond \(valence ≥ 1\): 106\/500 · valence 0: 394\/500/.test(d.caveats_line), caveats_has_theta_source: /θ from the shell counts recorded for this atom in electron\/atoms\.json \(star-maker @c5bf5f6, 2026-09-13\); this page does not recompute them/.test(d.caveats_line), labels_have_AWAY: d.labels ? await page.evaluate(() => Array.from(document.querySelectorAll('#labels .lb')).some(l => l.textContent === '|1> AWAY')) : null, labels_M_other_repos: await page.evaluate(() => Array.from(document.querySelectorAll('#labels .lb')).map(l => l.textContent).filter(t => /^M other repos$|^valence \d/.test(t))) };
    // ---- Enter after a no-match must not measure (adversarial review finding) ----
    const m0 = (await state(page)).measurements;
    await search(page, '#999999999'); const s1 = await state(page); await page.keyboard.press('Enter'); await sleep(300); const s2 = await state(page);
    d.enter_after_no_match = { msg_after_search: s1.msg, lastQuery_after_no_match: s1.lastQuery, measurements_before: m0, after_second_enter: s2.measurements, measured: s2.measurements !== m0, pass: s2.measurements === m0 && s1.lastQuery === '' };
    log('Enter after no-match:', JSON.stringify(d.enter_after_no_match));
    // ---- unique-line search: outside-family and inside-family lines ----
    await search(page, `line ${firstOutside}`); const so = await state(page); const lp = await page.evaluate(() => { const b = document.querySelector('#lines'); return b.hidden ? null : b.textContent.slice(0, 300); });
    await search(page, `#${firstInside}`); const sk = await state(page); // a bare number that is also a family key steers to the family and points at "line N"
    await search(page, `line ${firstInside}`); const si = await state(page);
    d.unique_line_key_clash = { n: firstInside, msg: sk.msg, family_won: sk.famIdx >= 0 && sk.key === 0, hint_present: /type "line \d+" for the line/.test(sk.msg || '') };
    d.unique_line_search = { outside: { n: firstOutside, key: so.key, famIdx: so.famIdx, msg: so.msg, lines_panel: lp, pass: so.key === firstOutside && so.famIdx === -1 && /outside every function family/.test(so.msg) }, inside: { n: firstInside, key: si.key, famIdx: si.famIdx, msg: si.msg, pass: si.key === firstInside && si.famIdx >= 0 && /inside a function family/.test(si.msg) } };
    log('unique-line search:', JSON.stringify(d.unique_line_search));
    // ---- click on a point steers only ----
    { const geo = await page.evaluate(() => { const { G, DPR } = window.__qts; const r = document.querySelector('#gl').getBoundingClientRect(); return { cx: r.x + G.c0[0] / DPR, cy: r.y + G.c0[1] / DPR, R: G.R / DPR, canvas: { x: r.x, y: r.y, w: r.width, h: r.height } }; });
      const topAt = (x, y) => page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? e.id || e.className || e.tagName : null; }, x, y);
      const bornBefore = await hudFind(page, /^last measurement/); let hit = null, tries = 0;
      for (let k = 0; k < 120 && !hit; k++) { const ang = (k * 2.399963) % (2 * Math.PI); const rad = geo.R * (0.72 + 0.26 * ((k * 0.618034) % 1)); const x = Math.round(geo.cx + Math.cos(ang) * rad), y = Math.round(geo.cy + Math.sin(ang) * rad); if ((await topAt(x, y)) !== 'gl') continue; tries++; await page.mouse.click(x, y); await sleep(120); const st = await state(page); if (/^(twin star: )?#\d+ · family #/.test(st.msg || '')) hit = { x, y, msg: st.msg.slice(0, 200), famIdx: st.famIdx, atom: st.atom }; }
      const bornAfter = await hudFind(page, /^last measurement/);
      d.click_steers_only = { tries, hit, born_before: bornBefore, born_after: bornAfter, click_alone_measured: bornBefore !== bornAfter, pass: !!hit && bornBefore === bornAfter }; log('click steers only:', JSON.stringify({ tries, hit: !!hit, measured: d.click_steers_only.click_alone_measured })); }
    // ---- measurable family by name, Enter again measures; Born prefix; φ at the pole ----
    await search(page, 'renderTable'); const sr = await state(page); await page.keyboard.press('Enter'); await sleep(400); const sr2 = await state(page); const hl2 = await hudLines(page);
    d.search_then_measure = { atom: sr.atom, famIdx: sr.famIdx, measurements_before: sr.measurements, after: sr2.measurements, outcome: sr2.outcome, born: hl2.find(l => l.startsWith('last measurement (Born audit):')), state: hl2.find(l => l.startsWith('state:')), pole_phi_hidden: /φ — \(global phase at the pole, not a state parameter\)/.test(hl2.find(l => l.startsWith('state:')) || ''), phi_wording: (/(φ frozen at the collapse|φ set by hand|φ precessing|φ still \(paired\))/.exec(hl2.find(l => l.startsWith('state:')) || '') || [])[0] || null, pass: sr2.measurements === sr.measurements + 1 };
    log('search renderTable + Enter:', JSON.stringify({ atom: sr.atom, measured: d.search_then_measure.pass, pole_phi_hidden: d.search_then_measure.pole_phi_hidden, phi: d.search_then_measure.phi_wording })); log('Born:', d.search_then_measure.born);
    // repeat on the collapsed state: certain derived from P
    await page.click('#measure'); await sleep(200); d.repeat_line = await hudFind(page, /^last measurement/);
    // ---- bare Enter guard: with #hold focused Enter must not measure; with body focused it must ----
    await page.click('#reprepare'); await sleep(100); const mA = (await state(page)).measurements;
    await page.focus('#hold'); await page.keyboard.press('Enter'); await sleep(200); const sB = await state(page);
    await page.focus('#hold'); await page.keyboard.press('Enter'); await sleep(100); // toggle hold back
    await page.evaluate(() => { document.activeElement && document.activeElement.blur(); }); await page.keyboard.press('Enter'); await sleep(300); const sC = await state(page);
    d.bare_enter = { with_hold_focused: { measurements_before: mA, after: sB.measurements, hold_toggled: sB.hold, measured: sB.measurements !== mA }, with_body_focused: { after: sC.measurements, measured: sC.measurements === sB.measurements + 1 }, pass: sB.measurements === mA && sC.measurements === sB.measurements + 1 };
    log('bare Enter:', JSON.stringify(d.bare_enter));
    // ---- SOUL tier wording (#766 via search) ----
    await page.click('#reprepare'); await sleep(100); await search(page, '#766'); d.soul_tier_line = await hudFind(page, /^twin tier:/);
    // ---- forged bucket (answered locally with ACAO): the record must not be used ----
    { await search(page, 'renderTable'); await sleep(100); d.external_requests_before_forged_test = P.external.length;
      const intercepted = []; await page.setRequestInterception(true);
      const handler = req => { const u = req.url(); if (u.startsWith('http://127.0.0.1')) return req.continue();
        if (/\/code\/f\/\d+\.json/.test(u)) { intercepted.push({ url: u, answered: 'locally with a forged bucket' }); const fam = window_fam; return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify({ [String(fam)]: { n: fam, names: ['renderTable'], lines: [1, 2, 3], repos: ['forged-a', 'forged-b', 'forged-c'], places: [{ repo: 'Ventusltd/globalgrid2050', commit: '1a382b71b99cdf3592f15024aabab244ba6fc31e', path: 'scripts/x.py', first: 1, last: 3 }] } }) }); }
        if (/raw\.githubusercontent\.com/.test(u)) { intercepted.push({ url: u, answered: 'locally with dummy text' }); return req.respond({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'text/plain', body: 'DUMMY 1\nDUMMY 2\nDUMMY 3' }); }
        intercepted.push({ url: u, answered: 'ABORTED' }); return req.abort(); };
      const window_fam = await page.evaluate(() => window.__qts.D.families[window.__qts.S.famIdx].n);
      page.on('request', handler);
      await page.click('#cable'); await sleep(100); await page.click('#measure'); await sleep(2500);
      const cableLine = await hudFind(page, /^cable/); const liveRec = await page.evaluate(() => window.__qts.S.liveRec);
      let lineText = null; const btn = await page.$('#lines button.u-chip'); if (btn) { await btn.click(); await sleep(2000); lineText = await page.evaluate(() => ({ note: (document.querySelector('#lines .u-code .u-muted') || {}).textContent || null, linesShown: document.querySelectorAll('#lines .u-line').length, anyDummy: Array.from(document.querySelectorAll('#lines .u-line')).some(l => /DUMMY/.test(l.textContent)) })); }
      d.forged_bucket = { family: window_fam, cable_line: cableLine, liveRec_null: liveRec === null, line_text: lineText, intercepted, raw_fetch_attempted: intercepted.some(i => /raw\.githubusercontent/.test(i.url)), pass: /record not used, nothing fetched further/.test(cableLine || '') && liveRec === null && !(lineText && lineText.anyDummy) && !intercepted.some(i => /raw\.githubusercontent/.test(i.url)) };
      await page.click('#cable'); await sleep(100); page.off('request', handler); await page.setRequestInterception(false);
      log('forged bucket:', JSON.stringify({ pass: d.forged_bucket.pass, cable: (cableLine || '').slice(0, 200), liveRec_null: d.forged_bucket.liveRec_null, lineText })); }
    // ---- context loss and restore ----
    { const e0 = P.errs.length + P.con.filter(c => c.type === 'error').length;
      const lost = await page.evaluate(async () => { const gl = window.__qts.gl; const ext = gl.getExtension('WEBGL_lose_context'); window.__loseExt = ext; ext.loseContext(); await new Promise(r => setTimeout(r, 1500)); const t = Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent); const S = window.__qts.S; return { isContextLost: gl.isContextLost(), S_contextLost: S.contextLost, seaDrawn: S.seaDrawn, uniqDrawn: S.uniqDrawn, lastDrawCalls: S.lastDrawCalls, hud_lost_line: t.find(x => /WebGL context lost/.test(x)) || null, hud_on_gpu_line_present: t.some(x => x.startsWith('on GPU')), hud_fps_line: t.find(x => x.startsWith('fps')) || null }; });
      const restored = await page.evaluate(async () => { window.__loseExt.restoreContext(); await new Promise(r => setTimeout(r, 2500)); const gl = window.__qts.gl; const { S, G, B } = window.__qts; gl.bindBuffer(gl.ARRAY_BUFFER, B.sea); const sz = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE); gl.bindBuffer(gl.ARRAY_BUFFER, B.uniq); const usz = gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE); const t = Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent); const px = new Uint8Array(4 * 64 * 64); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(Math.round(G.c0[0]) - 32, Math.round(G.H - G.c0[1]) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, px); let lit = 0; for (let i = 0; i < px.length; i += 4) if (Math.max(px[i], px[i + 1], px[i + 2]) > 40) lit++; return { isContextLost: gl.isContextLost(), S_contextLost: S.contextLost, seaDrawn: S.seaDrawn, uniqDrawn: S.uniqDrawn, seaBufferSize: sz, uniqBufferSize: usz, lastDrawCalls: S.lastDrawCalls, journeyN: B.journeyN, hud_on_gpu_line: t.find(x => x.startsWith('on GPU')) || null, litPixelsAroundSphere64x64: lit }; });
      restored.context_line = await hudFind(page, /^context:/);
      d.context_loss = { lost, restored, errors_during: P.errs.length + P.con.filter(c => c.type === 'error').length - e0, pass: lost.isContextLost && lost.S_contextLost && lost.seaDrawn === 0 && !!lost.hud_lost_line && !lost.hud_on_gpu_line_present && !restored.isContextLost && restored.seaDrawn === R.disk.lines_bin_entries && restored.uniqDrawn === R.disk.all_lines && restored.litPixelsAroundSphere64x64 > 0 && restored.hud_on_gpu_line === R.expected_count_line };
      log('context loss:', JSON.stringify({ pass: d.context_loss.pass, lost_line: lost.hud_lost_line, restored_lit: restored.litPixelsAroundSphere64x64, restored_line_ok: restored.hud_on_gpu_line === R.expected_count_line, context_line: restored.context_line, journeyN: restored.journeyN, errors: d.context_loss.errors_during })); }
    // ---- prove it: in-memory hashes of both binaries vs provenance ----
    await page.click('#prove'); await sleep(1500); d.prove_line = await hudFind(page, /^prove it:/); d.prove_both_match = /lines\.bin in memory\) \w+ vs provenance \w+ \(match\)[^]*all-lines\.bin in memory\) \w+ vs provenance \w+ \(match\)/.test(d.prove_line || '');
    // final console tally, screenshot
    d.console = consoleSummary(P); d.console_error_count = d.console.errors.length + d.console.pageerrors.length;
    await page.click('#reprepare'); await sleep(200); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: DIR + '/proof/gen2-1440.png' });
    log('desktop console:', JSON.stringify({ all: d.console.all, errors: d.console.errors.length, warnings: d.console.warnings.length, pageerrors: d.console.pageerrors.length, external: d.console.external_requests.length }));
    await page.close();
  }
  // =================== PHONE 430x900 (DPR 1, touch) then rotation to 900x430 ===================
  {
    const P = await openPage(430, 900, 1, true); const page = P.page; const d = R.phone = { readyMs: P.readyMs };
    await sleep(3000); const hl = await hudLines(page);
    d.hud_count_lines = hl.slice(1, 4); d.hud_count_line_matches_disk = hl[1] === R.expected_count_line;
    d.fps_3s = await measureFps(page); d.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth); d.bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    d.state0 = await state(page); d.hud_position = await page.evaluate(() => getComputedStyle(document.querySelector('#hud')).position);
    d.labels = await labelReport(page); d.geometry = await page.evaluate(() => { const { G, DPR } = window.__qts; return { c0css: G.c0.map(v => Math.round(v / DPR)), c1css: G.c1.map(v => Math.round(v / DPR)), Rcss: Math.round(G.R / DPR), sphereRcss: Math.round(G.sphereR / DPR), phone: G.phone }; });
    d.phone_hud_atom_line = hl.find(l => l.startsWith('atom:')) || null; d.phone_hud_bands_line = hl.find(l => l.startsWith('bands:')) || null;
    d.controls_in_width = await page.evaluate(() => Array.from(document.querySelectorAll('#bar button, #bar input, #legend button, #legend select')).every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 430.5; }));
    log('phone 430: count line ok', d.hud_count_line_matches_disk, 'fps', JSON.stringify(d.fps_3s), 'scrollWidth', d.scrollWidth, 'labels', JSON.stringify(d.labels), 'geometry', JSON.stringify(d.geometry));
    await page.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 4); }); await sleep(300);
    await page.screenshot({ path: DIR + '/proof/gen2-430.png' });
    d.console = consoleSummary(P); d.console_error_count = d.console.errors.length + d.console.pageerrors.length;
    // rotate
    await page.setViewport({ width: 900, height: 430, deviceScaleFactor: 1, isMobile: true, hasTouch: true }); await sleep(1500);
    const hr = await hudLines(page); const dl = R.landscape = {};
    dl.hud_count_lines = hr.slice(1, 4); dl.hud_count_line_matches_disk = hr[1] === R.expected_count_line;
    dl.state = await state(page); dl.hud_position = await page.evaluate(() => getComputedStyle(document.querySelector('#hud')).position);
    dl.geometry = await page.evaluate(() => { const { G, DPR } = window.__qts; const cv = document.querySelector('#gl').getBoundingClientRect(); return { canvasCss: { w: Math.round(cv.width), h: Math.round(cv.height) }, c0css: G.c0.map(v => Math.round(v / DPR)), c1css: G.c1.map(v => Math.round(v / DPR)), Rcss: Math.round(G.R / DPR), sphereRcss: Math.round(G.sphereR / DPR), phone: G.phone, phoneMediaNow: matchMedia('(max-width:430px)').matches }; });
    dl.labels = await labelReport(page); dl.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth); dl.fps_3s = await measureFps(page);
    dl.sphere_handle_inside_canvas = await page.evaluate(() => { const h = document.querySelector('#sphereHandle').getBoundingClientRect(), c = document.querySelector('#gl').getBoundingClientRect(); return h.top >= c.top - 1 && h.bottom <= c.bottom + 1 && h.left >= c.left - 1 && h.right <= c.right + 1; });
    dl.rotation_live = dl.geometry.phone === false && dl.state.phone === false && dl.hud_position === 'absolute' && dl.labels.outside.length === 0 && dl.sphere_handle_inside_canvas;
    log('rotated 900x430: live', dl.rotation_live, 'geometry', JSON.stringify(dl.geometry), 'labels', JSON.stringify(dl.labels), 'scrollWidth', dl.scrollWidth, 'fps', JSON.stringify(dl.fps_3s));
    await page.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); window.scrollTo(0, r.top + window.scrollY - 4); }); await sleep(300);
    await page.screenshot({ path: DIR + '/proof/gen2-900x430.png' });
    dl.console = consoleSummary(P); dl.console_error_count = dl.console.errors.length + dl.console.pageerrors.length;
    await page.close();
  }
} catch (e) { R.error = e.stack || String(e); log('ERROR', R.error); }
if (browser) await browser.close();
try { execSync(`taskkill /PID ${server.pid} /T /F`, { stdio: 'ignore' }); } catch (e) { R.server_kill_error = e.message; }
await sleep(800);
try { const ns = execSync('netstat -ano', { encoding: 'utf8' }); R.port_still_listening = ns.split('\n').some(l => l.includes(`127.0.0.1:${PORT}`) && l.includes('LISTENING')); } catch (e) { R.port_check_error = e.message; }
R.finished_utc = new Date().toISOString();
const passes = { node_check: R.node_check === 'ok', desktop_count_line: R.desktop && R.desktop.hud_count_line_matches_disk, desktop_no_console_errors: R.desktop && R.desktop.console_error_count === 0, enter_after_no_match: R.desktop && R.desktop.enter_after_no_match.pass, unique_line_search: R.desktop && R.desktop.unique_line_search.outside.pass && R.desktop.unique_line_search.inside.pass, click_steers_only: R.desktop && R.desktop.click_steers_only.pass, search_then_measure: R.desktop && R.desktop.search_then_measure.pass, pole_phi_hidden: R.desktop && R.desktop.search_then_measure.pole_phi_hidden, bare_enter_guard: R.desktop && R.desktop.bare_enter.pass, forged_bucket_not_used: R.desktop && R.desktop.forged_bucket.pass, context_loss: R.desktop && R.desktop.context_loss.pass, prove_both_match: R.desktop && R.desktop.prove_both_match, desktop_no_label_overlap: R.desktop && R.desktop.labels.overlaps.length === 0, phone_scrollWidth_430: R.phone && R.phone.scrollWidth === 430, phone_no_console_errors: R.phone && R.phone.console_error_count === 0, phone_no_label_overlap: R.phone && R.phone.labels.overlaps.length === 0 && R.phone.labels.outside.length === 0, rotation_live: R.landscape && R.landscape.rotation_live, landscape_no_console_errors: R.landscape && R.landscape.console_error_count === 0, server_stopped: R.port_still_listening === false };
R.passes = passes; R.pass = Object.values(passes).every(Boolean);
fs.writeFileSync(DIR + '/proof/gen2.json', JSON.stringify(R, null, 1));
log('PASSES', JSON.stringify(passes)); log('PASS', R.pass, 'port still listening:', R.port_still_listening);
process.exitCode = R.pass ? 0 : 1;   // the exit status follows the JSON pass flag so a CI caller cannot mistake a written report for a passed one
