// Quantum Twin — primary key to actual code flights. The pilot on top of the Line Wafer.
// Two twins: the permanent key (chronological, never reused) and the actual line it stands for (repo, commit, path, line).
// This file drives the wafer through its own controls (line number · connect to… · FLY) and adds a command box,
// a narration card, qubit/measure (the Quantum Twin Star's own model and generator), apps, entanglement and engine calls.
// It runs in two modes: on the website (static files, engine imported live from ventus-grid-engine's published modules)
// and in CPU WORLD (a local server adds read-from-git and the runner swarm). No model, no colour beyond the wafer's own.
const $ = id => document.getElementById(id);
const here = new URL('.', location.href).href;
const ENGINE_WEB = 'https://ventusltd.github.io/ventus-grid-engine/engine/';
let apps = null, keysDb = null, qubit = null, entangle = null, serverMode = false; const born = { count: 0, seed: '2026-09-14' };
const DIES = ['sld-sandbox', 'substation-intelligence', 'place-global-search', 'streaming-parquet-bridge'];

// The Quantum Twin Star's own generator (testcode/202609142202/quantum.js), copied exactly so a measurement here reproduces one there.
function hash32(str){ let h = 0x811c9dc5 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function atomOf(k){ if (!keysDb || !qubit) return null; const i = keysDb.keys.indexOf(k); if (i < 0) return null; const fid = String(keysDb.family[i]); const a = qubit.atoms[fid]; return a ? { fid, i, ...a } : null; }
function twinOf(k){ if (!keysDb) return null; const i = keysDb.keys.indexOf(k); if (i < 0) return null; const pl = keysDb.places[keysDb.place[i]]; return { repo: pl[0], commit: pl[1], path: pl[2], line: keysDb.line[i] }; }

const css = document.createElement('style'); css.textContent = `
#pilot{position:fixed;left:0;right:0;bottom:0;display:flex;gap:8px;padding:8px 12px;background:#0e121bf2;border-top:1px solid #1b2030;z-index:20}
#pilot input{flex:1;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#11151f;color:#cfe3f2;border:1px solid #1b2030;border-radius:6px;padding:.6rem .9rem}
#pilot input:focus{outline:1px solid #5ec8f2}
#say{position:fixed;left:50%;top:12vh;transform:translateX(-50%);max-width:min(64ch,84vw);background:#0e121bf2;border:1px solid #1b2030;border-radius:8px;padding:.8rem 1.1rem;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#cfe3f2;display:none;z-index:20;white-space:pre-wrap}
#say b{color:#5ec8f2} #say i{color:#f2b05e;font-style:normal} #say a{color:#5ec8f2} #say code{display:block;background:#11151f;border:1px solid #1b2030;border-radius:4px;padding:2px 6px;color:#cfe3f2;margin:4px 0}
#eg{position:fixed;right:12px;bottom:58px;background:#0e121bf2;border:1px solid #1b2030;border-radius:8px;padding:.5rem .7rem;display:flex;flex-direction:column;gap:4px;max-width:46vw;z-index:20}
#eg label{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8b93a7}
#eg select{font:12px ui-monospace,Menlo,Consolas,monospace;background:#11151f;color:#cfe3f2;border:1px solid #1b2030;border-radius:6px;padding:.45rem .7rem}
#plog{position:fixed;left:12px;bottom:58px;max-height:30vh;overflow:hidden;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#8b93a7;white-space:pre;pointer-events:none;z-index:19}
#beam{bottom:58px !important}
`; document.head.appendChild(css);
document.body.insertAdjacentHTML('beforeend', `
<div id="say"></div><div id="plog"></div>
<div id="eg"><label>examples: pick one, it lands in the box, press Enter</label><select id="egs">
<option value="">— choose an example sentence —</option>
<option value="block 39885">Fly to the most-copied line in the estate (39885)</option>
<option value="twin 39885">The twin of block 39885: repo, commit, path, line</option>
<option value="qubit 39885">Qubit: block 39885 as a two-state atom (HOME / AWAY)</option>
<option value="measure 39885">Measure block 39885: one seeded draw, a Born audit</option>
<option value="connect 39885 1217">Connect two lines with the beam</option>
<option value="app gridatlas">Fly into GridAtlas</option>
<option value="apps">List every app on the wafer</option>
<option value="run voltage-drop.voltageDropVolts {&quot;currentA&quot;:120,&quot;lengthM&quot;:250,&quot;resistanceOhmPerKm&quot;:0.32,&quot;powerFactor&quot;:0.95,&quot;phases&quot;:&quot;three&quot;}">Engine: voltage drop, 120 A over 250 m, 0.32 Ω/km, pf 0.95</option>
<option value="entangle">Entanglement: how many blocks reach their real line</option>
<option value="help">Help</option></select></div>
<form id="pilot"><input id="pin" autocomplete="off" autofocus placeholder="type a sentence or a command: block 39885 · twin 39885 · qubit 39885 · measure 39885 · app gridatlas · run voltage-drop… · help"></form>`);

const lines = []; const log = s => { lines.push(s); if (lines.length > 12) lines.shift(); $('plog').textContent = lines.join('\n'); };
const say = html => { const el = $('say'); if (!html) { el.style.display = 'none'; return; } el.innerHTML = html; el.style.display = 'block'; };
const esc = s => String(s).replace(/</g, '&lt;');
const fly = (a, b) => { $('a').value = String(a); $('b').value = b ? String(b) : ''; $('beam').requestSubmit(); };
const gh = t => `https://github.com/${t.repo}/blob/${t.commit}/${t.path}#L${t.line}`;
const signal = o => { if (serverMode) fetch('/signal', { method: 'POST', body: JSON.stringify(o) }).catch(() => {}); try { const L = JSON.parse(localStorage.getItem('qt-signals') || '[]'); L.push({ ...o, t: new Date().toISOString() }); localStorage.setItem('qt-signals', JSON.stringify(L.slice(-500))); } catch {} };

const cmds = {
  help(){ say(`<b>commands</b>\nblock &lt;key&gt; · twin &lt;key&gt; · read &lt;key&gt; · qubit &lt;key&gt; · measure &lt;key&gt; [seed] · connect &lt;a&gt; &lt;b&gt; · app &lt;name&gt; · apps · engine · run &lt;module&gt;.&lt;fn&gt; {…} · entangle · reset\nor a sentence: "fly to 39885", "show me gridatlas", "voltage drop for 120 A over 250 m at 0.32 ohm pf 0.95"\n\nTwo twins: the permanent key, and the actual line it stands for. Arrangements move keys; they never change them.`); },
  block(k){ k = parseInt(k, 10); if (!Number.isFinite(k)) return log('block <key>'); fly(k); say(`<b>block ${k}</b>\nthe beam is on line ${k}; the wafer's own panel shows its families.\n<i>next:</i> twin ${k}`); log(`block ${k}`); },
  fly(k){ return cmds.block(k); }, goto(k){ return cmds.block(k); },
  twin(k){ k = parseInt(k, 10); const t = twinOf(k); if (!t) return log(`twin ${k}: not a family-carried block`); fly(k);
    say(`<b>twin ${k}</b> — the actual code this key stands for\n${esc(t.repo)} @ ${esc(String(t.commit).slice(0, 10))}\n${esc(t.path)} line ${t.line}\n<a target="_blank" href="${gh(t)}">call the twin on GitHub</a>\n<i>next:</i> qubit ${k}`); log(`twin ${k}: ${t.path.split('/').pop()}:${t.line}`); },
  async read(k){ k = parseInt(k, 10); const t = twinOf(k); if (!t) return log(`read ${k}: no twin`); fly(k);
    if (!serverMode) { say(`<b>read ${k}</b>\nOn the website the line is read on GitHub: <a target="_blank" href="${gh(t)}">${esc(t.path)} line ${t.line}</a>\n(in CPU WORLD it is read from the local clone)`); return log(`read ${k}: link`); }
    const r = await (await fetch('/line?key=' + k)).json(); if (r.error) { say(`<b>read ${k}</b>\n<code>${esc(r.error)}</code>`); return log(`read ${k}: ${r.error}`); }
    say(`<b>read ${k}</b> — ${esc(r.repo)} @ ${esc(String(r.commit).slice(0, 10))}\n${esc(r.path)} line ${r.line}\n${esc(r.before.join('\n'))}\n<code>${esc(r.text)}</code>${esc(r.after.join('\n'))}\n<a target="_blank" href="${gh(t)}">call the twin on GitHub</a>`); log(`read ${k}: ${(r.text || '').trim().slice(0, 60)}`); },
  qubit(k){ k = parseInt(k, 10); const a = atomOf(k); if (!a) return log(`qubit ${k}: no atom`); const n = a.K + a.L + a.M; const pAway = n ? a.M / n : 0; const theta = 2 * Math.asin(Math.sqrt(pAway)); fly(k);
    say(`<b>qubit ${k}</b> — atom #${esc(a.fid)} ${esc(a.name || '')} (${esc(a.source)}${a.source !== 'electron.json' ? ' — counts copies by place, not callers; treat as an estimate' : ''})\nshells K${a.K} L${a.L} M${a.M} · sin²(θ/2) = M/(K+L+M) = ${pAway.toFixed(3)} · θ = ${(theta * 180 / Math.PI).toFixed(1)}°\n|0⟩ HOME P = ${(1 - pAway).toFixed(3)} · |1⟩ AWAY P = ${pAway.toFixed(3)} — the chance the next caller sits in another repository${a.class ? ` · class ${esc(a.class)} · spin ${esc(a.spin)} · valence ${a.valence}` : ''}\nhomes: ${esc((a.homes || []).join(', '))}\n<i>next:</i> measure ${k}`); log(`qubit ${k}: P(away)=${pAway.toFixed(3)} K${a.K} L${a.L} M${a.M}`); },
  measure(rest){ const [ks, seedArg] = (rest || '').split(/\s+/); const k = parseInt(ks, 10); const a = atomOf(k); if (!a) return log(`measure ${ks}: no atom`); if (seedArg) born.seed = seedArg;
    const n = a.K + a.L + a.M; const pAway = n ? a.M / n : 0; const r = mulberry32(hash32(`${born.seed}|${a.fid}|${born.count}`))(); born.count++; const away = r < pAway; const outcome = away ? '|1⟩ AWAY' : '|0⟩ HOME';
    const audit = `Born audit #${born.count + 1}: seed "${born.seed}" · state #${a.fid} · r=${r.toFixed(6)} ${away ? '<' : '≥'} P(away)=${pAway.toFixed(3)} → ${outcome}`;
    say(`<b>measure ${k}</b> — collapsed to <b>${outcome}</b>\n${esc(audit)}\nafter the collapse the state IS the pole; a repeat reproduces it with certainty. Type <i>qubit ${k}</i> to re-prepare the data state.`); log(audit);
    signal({ kind: 'born', key: k, family: a.fid, seed: born.seed, count: born.count, r, p_away: pAway, outcome: away ? 'AWAY' : 'HOME', shells: { K: a.K, L: a.L, M: a.M } }); },
  connect(ab){ const [a, b] = (ab || '').split(/\s+/).map(x => parseInt(x, 10)); if (!Number.isFinite(a) || !Number.isFinite(b)) return log('connect <a> <b>'); fly(a, b); say(`<b>connect ${a} → ${b}</b>\nthe beam joins two keys; both twins are real lines.`); log(`connect ${a} ${b}`); },
  apps(){ if (!apps) return log('apps not loaded'); const list = apps.apps.filter(a => a.app); say(`<b>${list.length} apps</b> (${esc(apps.rule)})\n` + list.map((a, i) => `${i + 1}. ${a.name}: ${a.keys.toLocaleString()} blocks · ${a.families} gates`).join('\n') + `\n<i>next:</i> app &lt;name&gt;`); log(`${list.length} apps`); },
  app(name){ if (!apps) return log('apps not loaded'); const list = apps.apps.filter(a => a.app); const a = list.find(x => x.name === (name || '').toLowerCase()) || list.find(x => x.name.includes((name || '').toLowerCase())); if (!a) return log(`no app "${name}"`);
    const [k0, k1] = apps.first[a.repo]; fly(k0, k1); const url = a.name === 'globalgrid2050' ? 'https://globalgrid2050.com/' : `https://ventusltd.github.io/${a.name}/`;
    say(`<b>app ${esc(a.name)}</b> — ${a.keys.toLocaleString()} blocks in ${a.families} gates · index ${esc(a.index || '?')}\nthe beam spans its first and middle lines (${k0} → ${k1}).\n<a target="_blank" href="${url}">open ${esc(a.name)} — see the code in action</a>  ·  <a target="_blank" href="https://github.com/${esc(a.repo)}">source</a>`); log(`app ${a.name}`); },
  async engine(){ const mods = ['voltage-drop', 'diversified-demand', 'current-from-power', 'firm-capacity', 'power-factor', 'connection-capacity']; const out = []; for (const m of mods) { try { const mod = await import(ENGINE_WEB + m + '.js'); out.push(`${m}: ${Object.keys(mod).filter(k => typeof mod[k] === 'function').join(', ')}`); } catch (e) { out.push(`${m}: (not reachable: ${e.message})`); } }
    say(`<b>engine</b> — ventus-grid-engine, imported live from its published modules\n${esc(out.join('\n'))}\n<i>next:</i> run voltage-drop.voltageDropVolts {…}`); log('engine listed'); },
  async run(rest){ const m = /^([a-z0-9-]+)\.([A-Za-z0-9_]+)\s*(\{[\s\S]*\})?$/.exec((rest || '').trim()); if (!m) return log('run <module>.<fn> {…}'); let args = {}; try { args = m[3] ? JSON.parse(m[3]) : {}; } catch { return log('run: arguments are not valid JSON'); }
    let result, err, us = 0; try { const mod = await import(ENGINE_WEB + m[1] + '.js'); if (typeof mod[m[2]] !== 'function') throw new Error(`no function ${m[2]} in ${m[1]}; has ${Object.keys(mod).filter(k => typeof mod[k] === 'function').join(', ')}`); const t0 = performance.now(); result = mod[m[2]](args); us = (performance.now() - t0) * 1000; } catch (e) { err = e.message; }
    if (err) { say(`<b>engine ${esc(m[1])}.${esc(m[2])}</b>\n<code>refused: ${esc(err)}</code>`); return log(`run refused: ${err}`); }
    const big = (result?.unit && /^(kW|kVA)$/.test(result.unit) && result.value > 100) || (result?.unit && /^(MW|MVA)$/.test(result.unit) && result.value > 0.1) || Object.entries(args).some(([k, v]) => (/mw|mva/i.test(k) && v * 1000 > 100) || (/kw|kva/i.test(k) && v > 100));
    say(`<b>engine ${esc(m[1])}.${esc(m[2])}</b> · ${us.toFixed(0)} µs · imported from ventusltd.github.io/ventus-grid-engine\nin <code>${esc(JSON.stringify(args))}</code>out <code>${esc(JSON.stringify(result, null, 1))}</code>${big ? '<i>above 100 kW: a chartered electrical engineer must sign any real design.</i>\n' : ''}This page charts the truth; it is not the engineer.`); log(`run ${m[1]}.${m[2]} → ${JSON.stringify(result).slice(0, 80)}`); signal({ kind: 'engine', module: m[1], fn: m[2], args, result }); },
  entangle(){ if (!entangle) return log('entangle not loaded'); say(`<b>entangle</b> (${esc(entangle.generated_utc)})\n${entangle.resolved.toLocaleString()} of ${entangle.keys.toLocaleString()} blocks reach their twin line (${(entangle.rate * 100).toFixed(2)} %) · ${entangle.broken.toLocaleString()} broken\nmeasured by fetching every twin from its commit and hashing the line (pipeline/entangle.py)\n${esc(JSON.stringify(entangle.reasons))}`); log(`entangle ${(entangle.rate * 100).toFixed(2)} %`); },
  reset(){ $('a').value = ''; $('b').value = ''; $('panel').hidden = true; say(''); log('reset'); }, home(){ return cmds.reset(); },
  die(w){ return log('die: available in CPU WORLD (needs route-gridatlas.json)'); }, light(w){ return cmds.app('gridatlas'); },
};
async function run(line){ const [c, ...rest] = line.trim().split(/\s+/); const w = (c || '').toLowerCase(); const fn = Object.hasOwn(cmds, w) ? cmds[w] : null;
  if (!fn) { const p = plan(line, { appNames: apps ? apps.apps.filter(a => a.app).map(a => a.name) : [], dies: DIES }); log(`> ${line}`); log(`  plan: ${p.commands.length ? p.commands.join(' → ') : '(none)'} — ${p.because}`); if (p.commands.length) log(`  you could have typed: ${p.commands.join('   then   ')}`);
    for (const c2 of p.commands) { const [w2, ...r2] = c2.split(/\s+/); if (Object.hasOwn(cmds, w2)) { try { await cmds[w2](r2.join(' ')); } catch (e) { log('error: ' + e.message); } } } signal({ kind: 'pilot', sentence: line, plan: p.commands }); return; }
  log(`> ${line}`); try { await fn(rest.join(' ')); } catch (e) { log('error: ' + e.message); } }
$('pilot').onsubmit = e => { e.preventDefault(); const v = $('pin').value; $('pin').value = ''; if (v.trim()) run(v); };
$('egs').onchange = e => { if (e.target.value) { $('pin').value = e.target.value; log('example loaded — press Enter to run it'); $('pin').focus(); } e.target.selectedIndex = 0; };
addEventListener('keydown', e => { const t = e.target.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'BUTTON') return; if (e.key.length === 1) $('pin').focus(); });
window.__pilot = run;
(async () => {
  serverMode = await fetch('/gpu', { cache: 'no-store' }).then(r => r.ok).catch(() => false);
  if (serverMode) (async function poll(){ try { const { lines: L } = await (await fetch('/pilot/next')).json(); for (const l of L) { log(`[powershell] ${l}`); await run(l); } } catch {} setTimeout(poll, 500); })();
  const j = async f => fetch(here + f).then(r => r.ok ? r.json() : null).catch(() => null);
  [keysDb, qubit, apps, entangle] = await Promise.all([j('keys.json'), j('qubit.json'), j('apps.json'), j('entangle.json')]);
  log(`Quantum Twin — primary key to actual code flights. ${keysDb ? keysDb.count.toLocaleString() : '?'} family-carried blocks, each coupled to a real line; ${qubit ? Object.keys(qubit.atoms).length.toLocaleString() : '?'} atoms.`);
  log('Type a sentence or a command. Every answer shows the command it became. Try: block 39885');
})();
