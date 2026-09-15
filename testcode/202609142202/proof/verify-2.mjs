// verify-2.mjs — independent GPU runner, round 2. Reads only; writes proof/verify-2.json and two screenshots.
// run from anywhere:  node C:/Users/vikra/Documents/GitHub/globalgrid2050/testcode/202609142202/proof/verify-2.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/vikra/Desktop/Claude-Sandbox-MSI/bench/node_modules/puppeteer-core');

const ROOT = 'C:/Users/vikra/Documents/GitHub/globalgrid2050';
const DIR = ROOT + '/testcode/202609142202';
const PORT = 8871;
const URL = `http://127.0.0.1:${PORT}/testcode/202609142202/index.html`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const R = { started_utc: new Date().toISOString(), port: PORT, url: URL };
const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- ground truth from disk ----
const linesBuf = fs.readFileSync(DIR + '/data/lines.bin');
R.lines_bin_bytes = linesBuf.byteLength; R.lines_bin_entries = linesBuf.byteLength / 4;
const keys = new Uint32Array(linesBuf.buffer, linesBuf.byteOffset, linesBuf.byteLength / 4);
const keySet = new Set(keys);
const families = JSON.parse(fs.readFileSync(DIR + '/data/families.json', 'utf8'));
const electron = JSON.parse(fs.readFileSync(DIR + '/data/electron.json', 'utf8'));
const atomNames = new Set(electron.atoms.map(a => a.name));
R.family_80299 = families.find(f => f.n === 80299) || null;
R.atom_named_haversine_exists = atomNames.has('haversine');
log('lines.bin', R.lines_bin_bytes, 'bytes =', R.lines_bin_entries, 'uint32 entries; distinct', keySet.size);

// ---- nvidia-smi sampler ----
const smi = () => { try { const s = execFileSync('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used', '--format=csv,noheader,nounits'], { encoding: 'utf8' }).trim().split(',').map(x => +x.trim()); return { util: s[0], mem: s[1], t: Date.now() }; } catch (e) { return { err: e.message, t: Date.now() }; } };
const stats = arr => { const u = arr.map(x => x.util), m = arr.map(x => x.mem); const mean = a => a.reduce((s, v) => s + v, 0) / a.length; return { n: arr.length, util_mean: +mean(u).toFixed(1), util_min: Math.min(...u), util_max: Math.max(...u), mem_mean_MiB: +mean(m).toFixed(0), mem_min_MiB: Math.min(...m), mem_max_MiB: Math.max(...m), samples: arr.map(x => `${x.util}%/${x.mem}MiB`) }; };
const idle = []; log('sampling nvidia-smi idle for 6 s (no server, no browser)…'); for (let i = 0; i < 6; i++) { idle.push(smi()); await sleep(1000); }
R.gpu_idle = stats(idle); log('idle', JSON.stringify(R.gpu_idle));

// ---- static server ----
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
const serverLog = fs.createWriteStream(DIR + '/proof/verify-2-server.log'); server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
await sleep(1500);

const live = []; let sampling = true; const sampler = (async () => { while (sampling) { live.push(smi()); await sleep(1000); } })();

let browser;
try {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--no-first-run', '--no-default-browser-check'] });
  R.chrome_version = await browser.version();

  async function openPage(w, h, tag) {
    const page = await browser.newPage(); await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const con = []; const errs = []; const external = []; const failed = [];
    page.on('console', m => con.push({ type: m.type(), text: m.text().slice(0, 300) }));
    page.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 300)));
    page.on('requestfailed', r => failed.push(r.url() + ' ' + (r.failure() && r.failure().errorText)));
    page.on('request', r => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${PORT}/`)) external.push(u); });
    const t0 = Date.now(); await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__qts && window.__qts.S && window.__qts.S.seaDrawn > 0, { timeout: 60000 });
    const readyMs = Date.now() - t0;
    return { page, con, errs, external, failed, readyMs, tag };
  }
  const hudText = p => p.evaluate(() => document.querySelector('#hud').innerText);
  const hudLines = p => p.evaluate(() => Array.from(document.querySelectorAll('#hud div')).map(d => d.textContent));
  const born = async p => (await hudLines(p)).find(l => l.startsWith('Born audit:')) || null;
  const stateLine = async p => (await hudLines(p)).find(l => l.startsWith('state:')) || null;
  const measureFps = p => p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = t => { n++; if (t - t0 < 3000) requestAnimationFrame(f); else res({ frames: n, ms: +(t - t0).toFixed(1), fps: +((n - 1) * 1000 / (t - t0)).toFixed(1) }); }; requestAnimationFrame(f); }));

  // =================== DESKTOP 1440x900 ===================
  const D = await openPage(1440, 900, 'desktop'); const page = D.page; R.desktop = { readyMs: D.readyMs };
  log('desktop page ready in', D.readyMs, 'ms');
  // (1) renderer, read in the page context from a fresh webgl2 context and from the page's own S.renderer
  R.desktop.renderer_fresh_context = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); if (!gl) return 'no webgl2'; const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'ext missing: ' + gl.getParameter(gl.RENDERER); });
  R.desktop.renderer_page_S = await page.evaluate(() => window.__qts.S.renderer);
  log('renderer (fresh ctx):', R.desktop.renderer_fresh_context); log('renderer (S.renderer):', R.desktop.renderer_page_S);
  // (2) console during 8 s after ready
  await sleep(8000);
  R.desktop.console_8s = { all: D.con.length, errors: D.con.filter(c => c.type === 'error'), warnings: D.con.filter(c => c.type === 'warning' || c.type === 'warn'), pageerrors: D.errs.slice(), requestfailed: D.failed.slice(), external_requests: D.external.slice(), other: D.con.filter(c => !['error', 'warning', 'warn'].includes(c.type)).slice(0, 20) };
  log('console 8 s:', JSON.stringify({ all: D.con.length, errors: R.desktop.console_8s.errors.length, warnings: R.desktop.console_8s.warnings.length, pageerrors: D.errs.length, requestfailed: D.failed.length, external: D.external.length }));
  // (3) HUD point count vs lines.bin
  const hud = await hudText(page); const m = /on GPU: ([\d,]+) line entries/.exec(hud);
  R.desktop.hud_on_gpu_text = m ? m[0] : null; R.desktop.hud_point_count = m ? +m[1].replace(/,/g, '') : null;
  R.desktop.S_seaDrawn = await page.evaluate(() => window.__qts.S.seaDrawn); R.desktop.S_seaBytes = await page.evaluate(() => window.__qts.S.seaBytes); R.desktop.D_N = await page.evaluate(() => window.__qts.D.N);
  R.desktop.hud_count_equals_lines_bin = R.desktop.hud_point_count === R.lines_bin_entries && R.desktop.S_seaDrawn === R.lines_bin_entries;
  R.desktop.hud_fps_line = (await hudLines(page)).find(l => l.startsWith('fps')) || null;
  log('HUD count', R.desktop.hud_point_count, 'S.seaDrawn', R.desktop.S_seaDrawn, 'VBO bytes', R.desktop.S_seaBytes, 'lines.bin/4', R.lines_bin_entries, '→', R.desktop.hud_count_equals_lines_bin);
  // (4) fps over 3 s via rAF
  R.desktop.fps_3s = await measureFps(page); log('fps 1440:', JSON.stringify(R.desktop.fps_3s));
  // (5) scrollWidth
  R.desktop.scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth); R.desktop.innerWidth = await page.evaluate(() => innerWidth); log('scrollWidth 1440:', R.desktop.scrollWidth);

  // (8) Bloch drag on the default focus atom (before any measurement)
  const focus0 = await page.evaluate(() => { const S = window.__qts.S; return { atom: S.atom ? { n: S.atom.n, name: S.atom.name, shells: S.atom.shells } : null, theta: S.theta, phi: S.phi, dataTheta: S.dataTheta }; });
  const hb = await page.$eval('#sphereHandle', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const hx = hb.x + hb.w / 2, hy = hb.y + hb.h / 2;
  const topAt = (x, y) => page.evaluate((x, y) => { const e = document.elementFromPoint(x, y); return e ? e.id || e.className || e.tagName : null; }, x, y);
  R.desktop.bloch = { focus_before: focus0, handle_rect: hb, element_at_handle_centre: await topAt(hx, hy) };
  await page.mouse.move(hx, hy); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(hx + 4 * i, hy - 3 * i); await sleep(20); }
  const mid = await page.evaluate(() => { const S = window.__qts.S; const th = S.hand ? S.hand.theta : S.theta, ph = S.hand ? S.hand.phi : S.phi; const a2 = Math.cos(th / 2) ** 2, b2 = Math.sin(th / 2) ** 2; return { hand: !!S.hand, theta: th, phi: ph, theta_deg: th * 180 / Math.PI, phi_deg: ph * 180 / Math.PI, alpha2: a2, beta2: b2, sum: a2 + b2 }; });
  const stateMid = await stateLine(page);
  await page.mouse.up(); await sleep(150);
  const after = await page.evaluate(() => { const S = window.__qts.S; return { hand: !!S.hand, relaxing: !!S.relaxFrom, theta: S.theta, phi: S.phi }; });
  R.desktop.bloch.during_drag = mid; R.desktop.bloch.state_line_during_drag = stateMid; R.desktop.bloch.after_release = after;
  R.desktop.bloch.theta_changed = Math.abs(mid.theta - focus0.theta) > 1e-6; R.desktop.bloch.phi_changed = Math.abs(mid.phi - focus0.phi) > 1e-6; R.desktop.bloch.norm_1000 = mid.sum.toFixed(3) === '1.000';
  R.desktop.bloch.pass = R.desktop.bloch.theta_changed && R.desktop.bloch.phi_changed && R.desktop.bloch.norm_1000 && mid.hand;
  log('bloch: before θ', focus0.theta.toFixed(4), 'φ', focus0.phi.toFixed(4), '→ during drag θ', mid.theta.toFixed(4), 'φ', mid.phi.toFixed(4), '|α|²+|β|²=', mid.sum.toFixed(6), 'hand', mid.hand, 'pass', R.desktop.bloch.pass);
  await sleep(2200); // let the hand state relax back to the data θ before the click test

  // (6) click a visible point in the principal star; find one whose family has a shipped atom so a Born measurement is possible
  const geo = await page.evaluate(() => { const { G, DPR } = window.__qts; const r = document.querySelector('#gl').getBoundingClientRect(); return { cx: r.x + G.c0[0] / DPR, cy: r.y + G.c0[1] / DPR, R: G.R / DPR, rin: 0.5, canvas: { x: r.x, y: r.y, w: r.width, h: r.height } }; });
  const bornBefore = await born(page); const tries = [];
  let hit = null;
  outer: for (let k = 0; k < 120; k++) {
    const ang = (k * 2.399963) % (2 * Math.PI); const rad = geo.R * (0.55 + 0.42 * ((k * 0.618034) % 1));
    const x = Math.round(geo.cx + Math.cos(ang) * rad), y = Math.round(geo.cy + Math.sin(ang) * rad);
    if (x < geo.canvas.x + 2 || x > geo.canvas.x + geo.canvas.w - 2 || y < geo.canvas.y + 2 || y > geo.canvas.y + geo.canvas.h - 2) continue;
    if ((await topAt(x, y)) !== 'gl') continue; // do not click through the HUD or the sphere handle
    await page.mouse.click(x, y); await sleep(120);
    const st = await page.evaluate(() => { const S = window.__qts.S, Dd = window.__qts.D; return { msg: S.msg, famIdx: S.famIdx, key: S.key, fam: S.famIdx >= 0 ? { n: Dd.families[S.famIdx].n, name: Dd.families[S.famIdx].name, lineOffset: Dd.families[S.famIdx].lineOffset, lineCount: Dd.families[S.famIdx].lineCount } : null, atom: S.atom ? { n: S.atom.n, name: S.atom.name } : null }; });
    const isHit = /^(twin star: )?#\d+ · family #/.test(st.msg || '');
    tries.push({ x, y, hit: isHit, msg: (st.msg || '').slice(0, 120), atom: st.atom });
    if (isHit && !hit) hit = { x, y, ...st };
    if (isHit && st.atom) { hit = { x, y, ...st }; break outer; }
  }
  R.desktop.click = { tries: tries.length, hits: tries.filter(t => t.hit).length, first_hit_with_atom: hit && hit.atom ? { x: hit.x, y: hit.y } : null, picked: hit ? { msg: hit.msg, famIdx: hit.famIdx, key: hit.key, fam: hit.fam, atom: hit.atom } : null, born_before: bornBefore, tries_log: tries.slice(0, 30) };
  if (hit) {
    // key from the pick exists in lines.bin at the family's own range
    const inRange = keys.subarray(hit.fam.lineOffset, hit.fam.lineOffset + hit.fam.lineCount).includes(hit.key);
    R.desktop.click.picked_key_in_lines_bin = keySet.has(hit.key); R.desktop.click.picked_key_in_family_range = inRange;
    // lines panel
    const panel = await page.evaluate(() => { const b = document.querySelector('#lines'); return { hidden: b.hidden, head: (b.querySelector('.u-h') || {}).textContent || null, keys: Array.from(b.querySelectorAll('.u-key')).map(s => +s.textContent) }; });
    const fileKeys = Array.from(keys.subarray(hit.fam.lineOffset, hit.fam.lineOffset + hit.fam.lineCount));
    const shown = panel.keys; const allExist = shown.every(k => keySet.has(k)); const exactPrefix = shown.length > 0 && shown.every((k, i) => fileKeys[i] === k);
    R.desktop.click.lines_panel = { hidden: panel.hidden, head: panel.head, shown_count: shown.length, family_lineCount_on_disk: fileKeys.length, first_keys: shown.slice(0, 12), all_shown_keys_exist_in_lines_bin: allExist, shown_keys_equal_family_range_prefix: exactPrefix };
    // the click itself: did the Born audit change (steer vs measure)?
    const bornAfterClick = await born(page); R.desktop.click.born_after_click = bornAfterClick; R.desktop.click.click_alone_measured = bornAfterClick !== bornBefore;
    // then the measure button (Born rule on the focused atom, if the family has one)
    if (hit.atom) {
      const b0 = await born(page); await page.click('#measure'); await sleep(300); const b1 = await born(page); const st = await stateLine(page);
      const rec = await page.evaluate(() => Array.from(document.querySelectorAll('#record button')).map(b => b.textContent));
      const S2 = await page.evaluate(() => { const S = window.__qts.S; return { outcome: S.outcome, theta: S.theta, measuredTheta: S.measuredTheta, twinNote: S.twinNote, measurements: S.measurements.length }; });
      R.desktop.click.measure = { born_before: b0, born_after: b1, changed: b0 !== b1, is_measurement: /^Born audit: measured #\d+/.test(b1 || ''), state_line: st, record_chips: rec, S: S2 };
      log('measure after click:', b1);
    }
    log('click:', JSON.stringify({ tries: tries.length, picked: R.desktop.click.picked && R.desktop.click.picked.msg, keyInBin: R.desktop.click.picked_key_in_lines_bin, inRange, panel: R.desktop.click.lines_panel && { shown: R.desktop.click.lines_panel.shown_count, allExist, exactPrefix } }));
  } else log('click: no point hit in', tries.length, 'tries');
  R.desktop.click.pass = !!(hit && hit.atom && R.desktop.click.measure && R.desktop.click.measure.is_measurement && R.desktop.click.lines_panel.all_shown_keys_exist_in_lines_bin && R.desktop.click.lines_panel.shown_count > 0);

  // (7) search #80299
  const bornS0 = await born(page);
  await page.click('#search', { clickCount: 3 }); await page.keyboard.type('#80299'); await page.keyboard.press('Enter'); await sleep(250);
  const s1 = await page.evaluate(() => { const S = window.__qts.S, Dd = window.__qts.D; return { msg: S.msg, famIdx: S.famIdx, fam: S.famIdx >= 0 ? { n: Dd.families[S.famIdx].n, name: Dd.families[S.famIdx].name, lineCount: Dd.families[S.famIdx].lineCount } : null, atom: S.atom ? { n: S.atom.n, name: S.atom.name } : null, famJoinNote: S.famJoinNote, outcome: S.outcome }; });
  const st1 = await stateLine(page); const born1 = await born(page);
  await page.keyboard.press('Enter'); await sleep(250);
  const s2 = await page.evaluate(() => { const S = window.__qts.S; return { msg: S.msg, outcome: S.outcome, collapse: !!S.collapse, measurements: S.measurements.length }; });
  const born2 = await born(page); const st2 = await stateLine(page);
  await page.click('#measure'); await sleep(250); const s3 = await page.evaluate(() => { const S = window.__qts.S; return { msg: S.msg, outcome: S.outcome, measurements: S.measurements.length }; }); const born3 = await born(page);
  const panel80299 = await page.evaluate(() => { const b = document.querySelector('#lines'); return { hidden: b.hidden, head: (b.querySelector('.u-h') || {}).textContent || null, keys: Array.from(b.querySelectorAll('.u-key')).map(s => +s.textContent) }; });
  const f80299 = R.family_80299; const fileKeys80299 = f80299 ? Array.from(keys.subarray(f80299.lineOffset, f80299.lineOffset + f80299.lineCount)) : [];
  R.desktop.search_80299 = { born_before: bornS0, after_first_enter: { S: s1, state_line: st1, born: born1 }, after_second_enter: { S: s2, state_line: st2, born: born2 }, after_measure_button: { S: s3, born: born3 }, lines_panel: { ...panel80299, keys_on_disk: fileKeys80299, match: JSON.stringify(panel80299.keys) === JSON.stringify(fileKeys80299) }, steered_to_haversine: !!(s1.fam && s1.fam.n === 80299 && s1.fam.name === 'haversine'), haversine_born_measured: (born2 !== bornS0 && /measured #\d+ haversine/.test(born2 || '')) || (born3 !== bornS0 && /measured #\d+ haversine/.test(born3 || '')), any_measurement_happened: s3.measurements > (R.desktop.click.measure ? 1 : 0) };
  log('search #80299: first Enter →', s1.msg); log('  atom:', JSON.stringify(s1.atom), 'famJoinNote:', s1.famJoinNote); log('  second Enter →', s2.msg); log('  measure button →', s3.msg); log('  Born audit after:', born3);

  // (10) screenshot 1440
  await page.screenshot({ path: DIR + '/proof/verify-2-1440.png' }); log('wrote verify-2-1440.png');
  R.desktop.console_total = { all: D.con.length, errors: D.con.filter(c => c.type === 'error').map(c => c.text), warnings: D.con.filter(c => c.type === 'warning' || c.type === 'warn').map(c => c.text), pageerrors: D.errs, external_requests_total: D.external };
  await page.close();

  // =================== PHONE 430x900 ===================
  const P = await openPage(430, 900, 'phone'); const pp = P.page; R.phone = { readyMs: P.readyMs };
  log('phone page ready in', P.readyMs, 'ms');
  R.phone.renderer_page_S = await pp.evaluate(() => window.__qts.S.renderer);
  await sleep(8000);
  R.phone.console_8s = { all: P.con.length, errors: P.con.filter(c => c.type === 'error'), warnings: P.con.filter(c => c.type === 'warning' || c.type === 'warn'), pageerrors: P.errs.slice(), requestfailed: P.failed.slice(), external_requests: P.external.slice() };
  const hudP = await hudText(pp); const mp = /on GPU: ([\d,]+) line entries/.exec(hudP);
  R.phone.hud_point_count = mp ? +mp[1].replace(/,/g, '') : null; R.phone.S_seaDrawn = await pp.evaluate(() => window.__qts.S.seaDrawn); R.phone.phoneMode = await pp.evaluate(() => window.__qts.S.phoneMode || null);
  R.phone.hud_count_equals_lines_bin = R.phone.hud_point_count === R.lines_bin_entries && R.phone.S_seaDrawn === R.lines_bin_entries;
  R.phone.fps_3s = await measureFps(pp); log('fps 430:', JSON.stringify(R.phone.fps_3s));
  R.phone.scrollWidth = await pp.evaluate(() => document.documentElement.scrollWidth); R.phone.innerWidth = await pp.evaluate(() => innerWidth); R.phone.bodyScrollWidth = await pp.evaluate(() => document.body.scrollWidth); log('scrollWidth 430:', R.phone.scrollWidth);
  R.phone.hud_position = await pp.evaluate(() => getComputedStyle(document.querySelector('#hud')).position);
  R.phone.widest_elements = await pp.evaluate(() => Array.from(document.querySelectorAll('body *')).map(e => ({ id: e.id || e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''), right: Math.round(e.getBoundingClientRect().right) })).filter(e => e.right > 430).slice(0, 10));
  await pp.screenshot({ path: DIR + '/proof/verify-2-430.png' }); log('wrote verify-2-430.png');
  R.phone.console_total = { all: P.con.length, errors: P.con.filter(c => c.type === 'error').map(c => c.text), warnings: P.con.filter(c => c.type === 'warning' || c.type === 'warn').map(c => c.text), pageerrors: P.errs };
  await pp.close();
} catch (e) { R.fatal = String(e && e.stack || e); log('FATAL', R.fatal); }
finally {
  sampling = false; await sampler; if (browser) await browser.close().catch(() => {});
  server.kill(); try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) {}
  await sleep(800);
  let listening = ''; try { listening = execFileSync('netstat', ['-ano'], { encoding: 'utf8' }).split('\n').filter(l => l.includes(`:${PORT} `) && l.includes('LISTENING')).join('\n').trim(); } catch (e) {}
  R.server_stopped = listening === ''; R.server_listen_after_stop = listening;
}
R.gpu_live = stats(live); log('live', JSON.stringify({ ...R.gpu_live, samples: undefined }));
R.gpu_live_first_10 = R.gpu_live.samples.slice(0, 10);

// ---- verdict ----
const rend = (R.desktop && R.desktop.renderer_fresh_context) || '';
R.criteria = {
  c1_renderer_names_gpu: /NVIDIA|GeForce|Radeon|Intel\(R\)|Arc/.test(rend) && !/SwiftShader|llvmpipe|Software/i.test(rend),
  c2_no_console_errors: !!(R.desktop && R.desktop.console_8s.errors.length === 0 && R.desktop.console_8s.pageerrors.length === 0 && R.phone && R.phone.console_8s.errors.length === 0 && R.phone.console_8s.pageerrors.length === 0),
  c3_hud_count_matches_lines_bin: !!(R.desktop && R.desktop.hud_count_equals_lines_bin),
  c5_scrollWidth_430: !!(R.phone && R.phone.scrollWidth === 430),
  c6_click_then_measurement: !!(R.desktop && R.desktop.click && R.desktop.click.pass),
  c7_haversine_80299_born_measured: !!(R.desktop && R.desktop.search_80299 && R.desktop.search_80299.haversine_born_measured),
  c7_haversine_80299_steered: !!(R.desktop && R.desktop.search_80299 && R.desktop.search_80299.steered_to_haversine),
  c8_bloch_drag: !!(R.desktop && R.desktop.bloch && R.desktop.bloch.pass),
};
R.pass_strict = Object.entries(R.criteria).filter(([k]) => !k.endsWith('_steered')).every(([, v]) => v);
R.finished_utc = new Date().toISOString();
fs.writeFileSync(DIR + '/proof/verify-2.json', JSON.stringify(R, null, 2));
log('criteria', JSON.stringify(R.criteria)); log('PASS (strict wording):', R.pass_strict); log('wrote proof/verify-2.json');
