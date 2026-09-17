// Quantum Twin — primary key to actual code flights. The pilot on top of the Line Wafer.
// Two twins: the permanent key (chronological, never reused) and the actual line it stands for (repo, commit, path, line).
// This file drives the wafer through its own controls (line number · connect to… · FLY) and adds a command box,
// a narration card, qubit/measure (the Quantum Twin Star's own model and generator), apps, entanglement and engine calls.
// It runs in two modes: on the website (static files, engine imported live from ventus-grid-engine's published modules)
// and in CPU WORLD (a local server adds read-from-git and the runner swarm). No model, no colour beyond the wafer's own.
const $ = id => document.getElementById(id);
const here = (() => { const m = document.querySelector('meta[name="wafer-data"]'); return m ? new URL(m.content, location.href).href : new URL('.', location.href).href; })();
const ENGINE_WEB = 'https://ventusltd.github.io/ventus-grid-engine/engine/';
let labels = null, apps = null, keysDb = null, qubit = null, entangle = null, serverMode = false; const born = { count: 0, seed: '2026-09-14' };
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
#say{position:fixed;left:50%;top:12vh;transform:translateX(-50%);width:min(72ch,84vw);max-height:70vh;min-width:280px;min-height:64px;background:#0e121bf2;border:1px solid #1b2030;border-radius:8px;padding:0;font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#cfe3f2;display:none;z-index:20;white-space:pre-wrap;resize:both;overflow:hidden;display:none;flex-direction:column}
#say.open{display:flex} #say.max{left:12px;top:12px;right:12px;bottom:60px;transform:none;width:auto;max-height:none;height:auto}
#say.min{height:auto!important;max-height:none;resize:none;width:min(48ch,84vw)} #say.min #saybody{display:none}
#saybar{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid #1b2030;background:#11151f;cursor:move;user-select:none;font-size:11px;color:#8b93a7;letter-spacing:.06em;text-transform:uppercase}
#saybar span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #saybar button{font:12px ui-monospace,Menlo,Consolas,monospace;background:#0e121b;color:#cfe3f2;border:1px solid #1b2030;border-radius:4px;width:24px;height:22px;cursor:pointer;padding:0}
#saybar button:hover{border-color:#5ec8f2} #saybody{padding:.8rem 1.1rem;overflow:auto;flex:1}
#saybody b{color:#5ec8f2} #say i{color:#f2b05e;font-style:normal} #say a{color:#5ec8f2} #saybody pre{max-height:38vh;overflow:auto;background:#11151f;border:1px solid #1b2030;border-radius:4px;padding:6px 8px;margin:6px 0;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre}
#saybody pre em{color:#5b6377;font-style:normal} #saybody pre u{display:block;text-decoration:none;color:#5b6377;font-size:11px;padding-left:4.2em;margin:0 0 2px}
#saybody pre .hit u{color:#8b93a7}
#saybody pre .hit{display:inline-block;width:100%;background:#1b2030;color:#f2b05e}
#saybody a.dev{float:right;font-size:11px;color:#5b6377}
#say code{display:block;background:#11151f;border:1px solid #1b2030;border-radius:4px;padding:2px 6px;color:#cfe3f2;margin:4px 0}
#eg{position:fixed;right:12px;bottom:58px;background:#0e121bf2;border:1px solid #1b2030;border-radius:8px;padding:.5rem .7rem;display:flex;flex-direction:column;gap:4px;max-width:46vw;z-index:20}
#eg label{font:11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8b93a7}
#eg select{font:12px ui-monospace,Menlo,Consolas,monospace;background:#11151f;color:#cfe3f2;border:1px solid #1b2030;border-radius:6px;padding:.45rem .7rem}
#plog{position:fixed;left:12px;bottom:58px;max-height:30vh;overflow:hidden;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#8b93a7;white-space:pre;pointer-events:none;z-index:19}
#beam{bottom:58px !important}
#core button{pointer-events:auto;min-height:44px;min-width:44px;padding:.55rem .9rem;font:13px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.04em;background:#0e121bf2;color:#cfe3f2;border:1px solid #5ec8f2;border-radius:8px;cursor:pointer;touch-action:manipulation}
#core button:hover,#core button:focus-visible{background:#11151f;border-color:#f2b05e;outline:none} #core button small{display:block;color:#8b93a7;font-size:10px;letter-spacing:.06em;text-transform:uppercase}
@media (max-width:640px){#earth{position:fixed;inset:0;z-index:30;display:none;flex-direction:column;background:#0b0e15}
#earth.open{display:flex}
#earthbar{display:flex;align-items:center;gap:10px;padding:6px 12px;background:#11151f;border-bottom:1px solid #1b2030;font:12px ui-monospace,Menlo,Consolas,monospace;color:#cfe3f2}
#earthbar b{color:#f2b05e;letter-spacing:.08em} #earthbar span{flex:1;color:#8b93a7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#earthbar button,#earthbar a{font:12px ui-monospace,Menlo,Consolas,monospace;background:#0e121b;color:#5ec8f2;border:1px solid #1b2030;border-radius:6px;padding:.4rem .8rem;cursor:pointer;text-decoration:none}
#earthframe{flex:1;border:0;width:100%;background:#000}
`; document.head.appendChild(css);
document.body.insertAdjacentHTML('beforeend', `
<div id="say"></div><div id="plog"></div>
<div id="eg"><label>examples: pick one, it lands in the box, press Enter</label><select id="egs">
<option value="">— choose an example sentence —</option>
<option value="block 39885">Go to the most-copied line in the estate (39885)</option>
<option value="twin 39885">The code behind block 39885, in the card</option>
<option value="state 39885">State of block 39885: HOME or AWAY, from its callers</option>
<option value="measure 39885">Measure block 39885: one recorded draw, HOME or AWAY</option>
<option value="connect 39885 1217">Connect two lines with the beam</option>
<option value="app gridatlas">Go to GridAtlas</option>
<option value="land gridatlas">Land on GridAtlas: the live app, inside this page</option>
<option value="land pipelinenews">Land on Pipeline News</option>
<option value="space">Back to space: the wafer</option>
<option value="apps">List every app on the wafer</option>
<option value="run voltage-drop.voltageDropVolts {&quot;currentA&quot;:120,&quot;lengthM&quot;:250,&quot;resistanceOhmPerKm&quot;:0.32,&quot;powerFactor&quot;:0.95,&quot;phases&quot;:&quot;three&quot;}">Engine: voltage drop, 120 A over 250 m, 0.32 Ω/km, pf 0.95</option>
<option value="entangle">Check: how many blocks are found at their recorded line</option>
<option value="help">Help</option></select></div>
<form id="pilot"><input id="pin" autocomplete="off" autofocus placeholder="type a sentence or a command: block 39885 · twin 39885 · state 39885 · measure 39885 · app gridatlas · run voltage-drop… · help"></form>`);

const EARTH_HTML = '<div id="earth"><div id="earthbar"><b>EARTH</b><span id="earthname"></span><a id="earthtab" target="_blank">open in its own tab</a><button id="earthback">back to space</button></div><iframe id="earthframe" title="the live app"></iframe></div>';
const lines = []; const log = s => { lines.push(s); if (lines.length > 12) lines.shift(); $('plog').textContent = lines.join('\n'); };
// the card is a small window: minimise, maximise, resize (drag the corner), close; any new answer reopens it
const sayEl = $('say'); sayEl.innerHTML = '<div id="saybar"><span id="saytitle">card</span><button id="saymin" title="minimise">–</button><button id="saymax" title="maximise">▢</button><button id="sayclose" title="close">×</button></div><div id="saybody"></div>';
let lastCard = '';
const say = html => { if (!html) { sayEl.classList.remove('open'); return; } lastCard = html; $('saybody').innerHTML = html; const t = $('saybody').querySelector('b'); $('saytitle').textContent = t ? t.textContent : 'card'; sayEl.classList.remove('min'); sayEl.classList.add('open'); };
$('saymin').onclick = e => { e.stopPropagation(); sayEl.classList.toggle('min'); }; $('saymax').onclick = e => { e.stopPropagation(); sayEl.classList.remove('min'); sayEl.classList.toggle('max'); }; $('sayclose').onclick = e => { e.stopPropagation(); sayEl.classList.remove('open', 'max', 'min'); };
$('saybar').ondblclick = () => sayEl.classList.toggle('min');
(() => { let d = null; $('saybar').addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON' || sayEl.classList.contains('max')) return; const r = sayEl.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; sayEl.style.transform = 'none'; sayEl.style.left = r.left + 'px'; sayEl.style.top = r.top + 'px'; $('saybar').setPointerCapture(e.pointerId); });
  $('saybar').addEventListener('pointermove', e => { if (!d) return; sayEl.style.left = Math.max(0, e.clientX - d.x) + 'px'; sayEl.style.top = Math.max(0, e.clientY - d.y) + 'px'; }); $('saybar').addEventListener('pointerup', () => { d = null; }); $('saybar').addEventListener('pointercancel', () => { d = null; }); })();
window.__card = () => ({ open: sayEl.classList.contains('open'), min: sayEl.classList.contains('min'), max: sayEl.classList.contains('max'), w: sayEl.offsetWidth, h: sayEl.offsetHeight, title: $('saytitle').textContent });
const esc = s => String(s).replace(/</g, '&lt;');
const fly = (a, b) => { $('a').value = String(a); $('b').value = b ? String(b) : ''; $('beam').requestSubmit(); };
const gh = t => `https://github.com/${t.repo}/blob/${t.commit}/${t.path}#L${t.line}`;
const signal = o => { if (serverMode) fetch('/signal', { method: 'POST', body: JSON.stringify(o) }).catch(() => {}); try { const L = JSON.parse(localStorage.getItem('qt-signals') || '[]'); L.push({ ...o, t: new Date().toISOString() }); localStorage.setItem('qt-signals', JSON.stringify(L.slice(-500))); } catch {} };


// ---------- plain English: engine calls get a label; every line in the code view gets a note (same rules as pipeline/describe.py) ----------
const PLAIN = {
  'voltage-drop.voltageDropVolts': a => `voltage drop for ${a.currentA} A over ${a.lengthM} m at ${a.resistanceOhmPerKm} Ω/km${a.reactanceOhmPerKm ? ' (reactance ' + a.reactanceOhmPerKm + ')' : ''}, power factor ${a.powerFactor}, ${a.phases || 'three'}-phase`,
  'voltage-drop.dropPercent': a => `${a.dropVolts} V drop as a share of ${a.nominalVolts} V`, 'voltage-drop.lossesWatts': a => `heat lost in the cable: ${a.currentA} A over ${a.lengthM} m at ${a.resistanceOhmPerKm} Ω/km`,
  'diversified-demand.diversifiedDemandKw': a => `demand of ${a.unitCount} units at ${a.perUnitKw} kW each, coincidence ${a.coincidenceFactor}`,
  'current-from-power.currentA': a => `current for ${a.apparentPowerVa} VA at ${a.voltageV} V, ${a.phases || 'three'}-phase`, 'firm-capacity.apparentPowerMva': a => `apparent power for ${a.mw} MW at power factor ${a.powerFactor}`,
  'power-factor.reactivePowerKvar': a => `reactive power for ${a.kw} kW at power factor ${a.powerFactor}`,
};
const plainLabel = (mod, fn, args) => { const f = PLAIN[`${mod}.${fn}`]; try { return f ? f(args) : `${mod.replace(/-/g, ' ')}: ${fn.replace(/([A-Z])/g, ' $1').toLowerCase()}`; } catch { return `${mod}.${fn}`; } };
const DESCRIBE_RULES = [
  [/^\s*$/, 'blank line'], [/^\s*\/\//, 'a comment'], [/^\s*\/\*|^\s*\*/, 'a comment block'],
  [/^\s*(import|export)\b/, 'brings code in or out of this file'], [/^\s*(?:async\s+)?function\s+(\w+)/, 'defines the function $1'],
  [/^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?[^=]*=>/, 'defines the function $1'], [/^\s*(?:const|let|var)\s+(\w+)\s*=/, 'sets $1'],
  [/\.addEventListener\(\s*['"](\w+)/, 'listens for a $1 on the page'], [/^\s*return\b/, 'hands a result back'], [/^\s*if\b/, 'decides: only when the condition holds'],
  [/^\s*(?:else|\} else)/, 'otherwise'], [/^\s*for\b|^\s*while\b/, 'repeats for each item'], [/^\s*try\b/, 'tries, ready to catch a failure'], [/^\s*catch\b|\} catch/, 'handles a failure'],
  [/\.(?:querySelector|getElementById)\(/, 'finds a part of the page'], [/\.innerHTML\s*=|\.textContent\s*=/, 'writes text onto the page'], [/\bfetch\(/, 'asks a server for data'],
  [/\bclassList\./, 'changes how a part of the page looks'], [/\bconsole\./, 'writes to the developer console'], [/\bthrow\b/, 'stops with an error'],
  [/^\s*\}\s*\)?;?\s*$|^\s*\]\s*;?\s*$/, 'closes a block'], [/^\s*(\w+)\s*\(.*\)\s*;?\s*$/, 'calls $1'], [/\bawait\b/, 'waits for a result'], [/=/, 'sets a value'],
];
const describeLine = line => { for (const [re, note] of DESCRIBE_RULES) { const m = line.match(re); if (m) return note.replace(/\$(\d)/g, (_, i) => m[+i] || ''); } return 'a line of code'; };
window.__describe = describeLine;

const cmds = {
  help(){ say(`<b>commands</b>\nblock &lt;key&gt; · twin &lt;key&gt; · read &lt;key&gt; · state &lt;key&gt; · measure &lt;key&gt; [seed] · connect &lt;a&gt; &lt;b&gt; · land &lt;app&gt; · space · app &lt;name&gt; · apps · engine · run &lt;module&gt;.&lt;fn&gt; {…} · entangle · reset\nor a sentence: "fly to 39885", "show me gridatlas", "voltage drop for 120 A over 250 m at 0.32 ohm pf 0.95"\n\nEach dot has a permanent key and stands for one real line of code. Moving dots never changes keys.`); },
  block(k){ k = parseInt(k, 10); if (!Number.isFinite(k)) return log('block <key>'); fly(k); say(`<b>block ${k}</b>\nthe beam is on line ${k}; the panel on the left shows what it is.\n<i>next:</i> twin ${k}`); log(`block ${k}`); },
  fly(k){ return cmds.block(k); }, goto(k){ return cmds.block(k); },
  async twin(k){ k = parseInt(k, 10); const t = twinOf(k); if (!t) return log(`twin ${k}: this block has no recorded line`); fly(k); return cmds.showCode(k, t, 'twin'); },
  async read(k){ k = parseInt(k, 10); const t = twinOf(k); if (!t) return log(`read ${k}: this block has no recorded line`); fly(k); return cmds.showCode(k, t, 'read'); },
  // the code itself, in the card, scrollable, the line highlighted; the source link is a fallback for developers
  async showCode(k, t, verb){ const raw = `https://raw.githubusercontent.com/${t.repo}/${t.commit}/${t.path}`; let lines = null;
    try { const r = await fetch(raw); if (r.ok) lines = (await r.text()).split(/\r?\n/); } catch {}
    if (!lines && serverMode) { try { const r = await (await fetch('/line?key=' + k)).json(); if (!r.error) lines = [...r.before, r.text, ...r.after].map(x => x ?? ''); } catch {} }
    const head = `<b>${verb} ${k}</b> — ${esc(t.repo.split('/').pop())} · ${esc(t.path.split('/').pop())} · line ${t.line}`;
    if (!lines) { say(`${head}
could not load the file here.
<a target="_blank" href="${gh(t)}">source, for developers</a>`); return log(`${verb} ${k}: file not loaded; source link shown`); }
    const from = Math.max(1, t.line - 20), to = Math.min(lines.length, t.line + 20); const rows = [];
    for (let n = from; n <= to; n++) rows.push(`<span class="${n === t.line ? 'hit' : ''}"><em>${String(n).padStart(5)}</em> ${esc(lines[n - 1] ?? '')}<u>${esc(describeLine(lines[n - 1] ?? ''))}</u></span>`);
    say(`${head}
<pre id="code">${rows.join('\n')}</pre><i>next:</i> state ${k}   <a class="dev" target="_blank" href="${gh(t)}">source, for developers</a>`);
    const hit = document.querySelector('#code .hit'); if (hit) hit.scrollIntoView({ block: 'center' }); log(`${verb} ${k}: ${t.path.split('/').pop()} line ${t.line}: ${(lines[t.line - 1] || '').trim().slice(0, 60)}`); },
  state(k){ k = parseInt(k, 10); const a = atomOf(k); if (!a) return log(`state ${k}: this block has no family record`); const n = a.K + a.L + a.M; const pAway = n ? a.M / n : 0; const theta = 2 * Math.asin(Math.sqrt(pAway)); fly(k);
    say(`<b>state ${k}</b> — block family #${esc(a.fid)} ${esc(a.name && a.name !== '(anonymous)' ? a.name : 'unnamed')} (${a.source === 'electron.json' ? 'from the published data' : 'estimated from where its copies sit'})\ncallers: K ${a.K} same directory · L ${a.L} same repository · M ${a.M} other repositories\nHOME P = ${(1 - pAway).toFixed(3)} · AWAY P = ${pAway.toFixed(3)} (AWAY = M ÷ (K+L+M), the share of callers in another repository)\nhomes: ${esc((a.homes || []).join(', '))}\n<i>next:</i> measure ${k}`); log(`state ${k}: P(away)=${pAway.toFixed(3)} K${a.K} L${a.L} M${a.M}`); },
  qubit(k){ return cmds.state(k); },
  measure(rest){ const [ks, seedArg] = (rest || '').split(/\s+/); const k = parseInt(ks, 10); const a = atomOf(k); if (!a) return log(`measure ${ks}: this block has no family record`); if (seedArg) born.seed = seedArg;
    const n = a.K + a.L + a.M; const pAway = n ? a.M / n : 0; const r = mulberry32(hash32(`${born.seed}|${a.fid}|${born.count}`))(); born.count++; const away = r < pAway; const outcome = away ? 'AWAY' : 'HOME';
    const audit = `Draw ${born.count + 1}: seed "${born.seed}" · state #${a.fid} · r=${r.toFixed(6)} ${away ? '<' : '≥'} P(away)=${pAway.toFixed(3)} → ${outcome}`;
    say(`<b>measure ${k}</b> — result: <b>${outcome}</b>\n${esc(audit)}\nThe same seed, block and count always give the same result. Type <i>state ${k}</i> to see the probabilities again.`); log(audit);
    signal({ kind: 'born', key: k, family: a.fid, seed: born.seed, count: born.count, r, p_away: pAway, outcome: away ? 'AWAY' : 'HOME', shells: { K: a.K, L: a.L, M: a.M } }); },
  connect(ab){ const [a, b] = (ab || '').split(/\s+/).map(x => parseInt(x, 10)); if (!Number.isFinite(a) || !Number.isFinite(b)) return log('connect <a> <b>'); fly(a, b); say(`<b>connect ${a} → ${b}</b>\nthe beam joins two keys; both twins are real lines.`); log(`connect ${a} ${b}`); },
  apps(){ if (!apps) return log('apps not loaded'); const list = apps.apps.filter(a => a.app); say(`<b>${list.length} apps</b> (${esc(apps.rule)})\n` + list.map((a, i) => { const L = labels && labels.labels[a.name]; return `${i + 1}. ${a.name} — ${L ? labels.kinds[L.kind] + ': ' + L.what : ''} · ${a.keys.toLocaleString()} blocks`; }).join('\n') + `\n<i>next:</i> app &lt;name&gt;`); log(`${list.length} apps`); },
  app(name){ if (!apps) return log('apps not loaded'); const list = apps.apps.filter(a => a.app); const a = list.find(x => x.name === (name || '').toLowerCase()) || list.find(x => x.name.includes((name || '').toLowerCase())); if (!a) return log(`no app "${name}"`);
    const [k0, k1] = apps.first[a.repo]; fly(k0, k1); const url = a.name === 'globalgrid2050' ? 'https://globalgrid2050.com/' : `https://ventusltd.github.io/${a.name}/`;
    say(`<b>app ${esc(a.name)}</b> — ${(() => { const L = labels && labels.labels[a.name]; return L ? esc(labels.kinds[L.kind] + '. ' + L.what) : ''; })()}\n${a.keys.toLocaleString()} blocks in ${a.families} gates · index ${esc(a.index || '?')}\nthe beam spans its first and middle lines (${k0} → ${k1}).\n<a target="_blank" href="${url}">open ${esc(a.name)} — see the code in action</a>  ·  <a target="_blank" href="https://github.com/${esc(a.repo)}">source</a>`); log(`app ${a.name}`); },
  async engine(){ const mods = ['voltage-drop', 'diversified-demand', 'current-from-power', 'firm-capacity', 'power-factor', 'connection-capacity']; const out = []; for (const m of mods) { try { const mod = await import(ENGINE_WEB + m + '.js'); out.push(`${m}: ${Object.keys(mod).filter(k => typeof mod[k] === 'function').join(', ')}`); } catch (e) { out.push(`${m}: (not reachable: ${e.message})`); } }
    say(`<b>engine</b> — ventus-grid-engine, imported live from its published modules\n${esc(out.join('\n'))}\n<i>next:</i> run voltage-drop.voltageDropVolts {…}`); log('engine listed'); },
  async run(rest){ const m = /^([a-z0-9-]+)\.([A-Za-z0-9_]+)\s*(\{[\s\S]*\})?$/.exec((rest || '').trim()); if (!m) return log('run <module>.<fn> {…}'); let args = {}; try { args = m[3] ? JSON.parse(m[3]) : {}; } catch { return log('run: arguments are not valid JSON'); }
    let result, err, us = 0; try { const mod = await import(ENGINE_WEB + m[1] + '.js'); if (typeof mod[m[2]] !== 'function') throw new Error(`no function ${m[2]} in ${m[1]}; has ${Object.keys(mod).filter(k => typeof mod[k] === 'function').join(', ')}`); const t0 = performance.now(); result = mod[m[2]](args); us = (performance.now() - t0) * 1000; } catch (e) { err = e.message; }
    if (err) { say(`<b>engine ${esc(m[1])}.${esc(m[2])}</b>\n<code>refused: ${esc(err)}</code>`); return log(`run refused: ${err}`); }
    const big = (result?.unit && /^(kW|kVA)$/.test(result.unit) && result.value > 100) || (result?.unit && /^(MW|MVA)$/.test(result.unit) && result.value > 0.1) || Object.entries(args).some(([k, v]) => (/mw|mva/i.test(k) && v * 1000 > 100) || (/kw|kva/i.test(k) && v > 100));
    say(`<b>${esc(plainLabel(m[1], m[2], args))}</b>\nengine ${esc(m[1])}.${esc(m[2])} · ${us.toFixed(0)} µs · imported from ventusltd.github.io/ventus-grid-engine\nin <code>${esc(JSON.stringify(args))}</code>out <code>${esc(JSON.stringify(result, null, 1))}</code>${big ? '<i>above 100 kW: a chartered electrical engineer must sign any real design.</i>\n' : ''}This page shows figures; it is not the engineer.`); log(`${plainLabel(m[1], m[2], args)} → ${JSON.stringify(result).slice(0, 80)}`); signal({ kind: 'engine', module: m[1], fn: m[2], args, result }); },
  entangle(){ if (!entangle) return log('entangle not loaded'); say(`<b>entangle</b> (${esc(entangle.generated_utc)})\n${entangle.resolved.toLocaleString()} of ${entangle.keys.toLocaleString()} blocks reach their twin line (${(entangle.rate * 100).toFixed(2)} %) · ${entangle.broken.toLocaleString()} broken\nmeasured by fetching every twin from its commit and hashing the line (pipeline/entangle.py)\n${esc(JSON.stringify(entangle.reasons))}`); log(`entangle ${(entangle.rate * 100).toFixed(2)} %`); },
  reset(){ $('a').value = ''; $('b').value = ''; $('panel').hidden = true; say(''); log('reset'); }, home(){ return cmds.reset(); },
  die(w){ return log('die: available in CPU WORLD (needs route-gridatlas.json)'); }, light(w){ return cmds.app('gridatlas'); },
};
async function run(line){ const [c, ...rest] = line.trim().split(/\s+/); const w = (c || '').toLowerCase(); const fn = Object.hasOwn(cmds, w) ? cmds[w] : null;
  if (!fn) { const p = plan(line, { appNames: apps ? apps.apps.filter(a => a.app).map(a => a.name) : [], dies: DIES }); log(`> ${line}`); log(`  plan: ${p.commands.length ? p.commands.join(' → ') : '(none)'} — ${p.because}`); if (p.commands.length) log(`  you could have typed: ${p.commands.join('   then   ')}`);
    for (const c2 of p.commands) { const [w2, ...r2] = c2.split(/\s+/); if (Object.hasOwn(cmds, w2)) { try { await cmds[w2](r2.join(' ')); } catch (e) { log('error: ' + e.message); } } } signal({ kind: 'pilot', sentence: line, plan: p.commands }); return; }
  log(`> ${line}`); try { await fn(rest.join(' ')); } catch (e) { log('error: ' + e.message); } }
$('pilot').onsubmit = e => { e.preventDefault(); const v = $('pin').value; $('pin').value = ''; if (v.trim()) run(v); };
$('egs').onchange = e => { if (e.target.value) { if (e.target.value === $('pin').dataset.last && lastCard && !sayEl.classList.contains('open')) { say(lastCard); log('card reopened'); } else { $('pin').value = e.target.value; $('pin').dataset.last = e.target.value; log('example loaded — press Enter to run it'); $('pin').focus(); } } e.target.selectedIndex = 0; };
addEventListener('keydown', e => { const t = e.target.tagName; if (t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA' || t === 'BUTTON') return; if (e.key.length === 1) $('pin').focus(); });

// ---------- space <-> earth: the live apps, by name, inside the page ----------
const EARTH = { gridatlas: 'https://ventusltd.github.io/gridatlas/atlas/', pipelinenews: 'https://ventusltd.github.io/pipelinenews/', globalgrid2050: 'https://globalgrid2050.com/', 'grid-dictionary': 'https://ventusltd.github.io/grid-dictionary/', spiders: 'https://ventusltd.github.io/spiders/', 'star-solar-star': 'https://ventusltd.github.io/star-solar-star/', 'code-generator': 'https://ventusltd.github.io/code-generator/', testcode: 'https://ventusltd.github.io/testcode/', 'galaxies-wafers': 'https://ventusltd.github.io/galaxies-wafers/', 'ventus-grid-engine': 'https://ventusltd.github.io/ventus-grid-engine/', stars: 'https://ventusltd.github.io/stars/', 'spider sandbox': 'https://ventusltd.github.io/ventus-grid-engine/?graph=engine-graph', 'periodic table': 'https://globalgrid2050.com/testcode/202609151447/', 'systems': 'https://globalgrid2050.com/testcode/202609151447/' };
document.body.insertAdjacentHTML('beforeend', EARTH_HTML);
const earthUrl = name => EARTH[name] || (apps && apps.apps.find(a => a.app && a.name === name) ? `https://ventusltd.github.io/${name}/` : null);
cmds.land = function(name){ name = (name || '').toLowerCase().trim(); const key = Object.keys(EARTH).find(k => k === name) || Object.keys(EARTH).find(k => k.includes(name)) || (apps ? (apps.apps.find(a => a.app && a.name.includes(name)) || {}).name : null);
  const url = key ? earthUrl(key) : null; if (!url) return log(`land <app>: ${Object.keys(EARTH).join(', ')}`);
  $('earthname').textContent = `${key} · ${url}`; $('earthtab').href = url; $('earthframe').src = url; $('earth').classList.add('open'); say(''); log(`landed on ${key} — type space to come back`); };
cmds.visit = cmds.land; cmds.go = cmds.land; cmds.open = cmds.land;
cmds.space = function(){ $('earth').classList.remove('open'); $('earthframe').src = 'about:blank'; log('back in space: the wafer'); };
$('earthback').onclick = () => cmds.space();
document.body.insertAdjacentHTML('beforeend', '<div id="hud" style="position:fixed;right:12px;top:44px;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#8b93a7;pointer-events:none;z-index:19"></div>');
const W = () => window.__wafer; const fmtN = n => n.toLocaleString('en-GB');
const hud = s => { const st = W() && W().state(); if (!st) return; $('hud').textContent = `showing ${fmtN(st.scopeN)} of ${fmtN(st.n)} lines${s ? ' · ' + s : ''}`; };
let scopeName = 'all';
const repoOf = name => { if (!apps) return null; const a = apps.apps.find(x => x.name === name) || apps.apps.find(x => x.name.includes(name)); return a ? a.repo : null; };
// a scope is a set with a rule: all · an app (apps.json keys per repo) · module <path> · gate <family#> · line <key>
function scopeKeys(spec){ const s = (spec || 'all').trim(); const [kind, ...r] = s.split(/\s+/); const arg = r.join(' ');
  if (!s || s === 'all' || s === 'estate') return { name: 'all', keys: null };
  if (kind === 'line' || kind === 'key') { const k = parseInt(arg, 10); return Number.isFinite(k) ? { name: `line ${k}`, keys: [k] } : null; }
  if (kind === 'gate' || kind === 'family') { if (!keysDb) return null; const fid = parseInt(arg, 10); const ks = []; for (let i = 0; i < keysDb.keys.length; i++) if (keysDb.family[i] === fid) ks.push(keysDb.keys[i]); return ks.length ? { name: `gate ${fid}`, keys: ks } : null; }
  if (kind === 'module' || kind === 'file' || kind === 'die') { if (!keysDb) return null; const ks = []; for (let i = 0; i < keysDb.keys.length; i++) if (keysDb.places[keysDb.place[i]][2].includes(arg)) ks.push(keysDb.keys[i]); return ks.length ? { name: `module ${arg}`, keys: ks } : null; }
  const repo = repoOf(s.toLowerCase()); const ks = repo && apps.keys ? apps.keys[repo] : null; return ks ? { name: repo.split('/').pop(), keys: ks } : null; }
const scopeFail = spec => { log(`scope ${spec}: not a scope — try all, an app name (apps), module <path>, gate <family#>, line <key>`); };
cmds.scope = function(spec){ if (!W()) return log('the wafer is not ready'); const sc = scopeKeys(spec); if (!sc) return scopeFail(spec); const r = W().scope(sc.keys); scopeName = sc.name; hud(sc.name);
  log(`scope ${sc.name}: showing ${fmtN(r.shown)} of ${fmtN(r.of)} lines${r.missing ? ` · ${fmtN(r.missing)} keys not numbered here` : ''}`); return r; };
cmds.gravity = async function(spec){ if (!W()) return log('the wafer is not ready'); const sc = scopeKeys(spec); if (!sc) return scopeFail(spec); scopeName = sc.name; const k = W().kepler();
  log(`gravity ${sc.name}: Kepler r(θ) = p/(1 + e·cos θ), e = ${k.e}, p = ${k.p.toFixed(1)}, the wafer's centre at the focus, points in key order`); const r = await W().gravity(sc.keys); hud(sc.name + ' · kepler'); log(`gravity ${sc.name}: ${fmtN(r.shown)} lines in orbit${r.missing ? ` · ${fmtN(r.missing)} keys not numbered here` : ''}`); return r; };
cmds.orbit = cmds.gravity; cmds.isolate = cmds.gravity;
cmds.release = async function(){ if (!W()) return log('the wafer is not ready'); const r = await W().release(); scopeName = 'all'; hud(); log(`release: showing ${fmtN(r.shown)} of ${fmtN(r.of)} lines, back on the wafer law`); return r; };
// LOGO: the same dust, the same blend; the target is the wordmark rasterised once, deterministically, off screen (sampled only, never shown)
const LOGO = { lines: ['VENTUS — CABLES AND CONNECTIVITY', 'GLOBALGRID2050'], font: 'bold 120px ui-monospace', step: 2, lineGap: 150, fill: 1.6 };
let logoRaster = null;
function rasterLogo(){ if (logoRaster) return logoRaster; const c = document.createElement('canvas'); const g = c.getContext('2d'); g.font = LOGO.font;
  const w = Math.ceil(Math.max(...LOGO.lines.map(t => g.measureText(t).width))) + 40, h = LOGO.lineGap * LOGO.lines.length + 40; c.width = w; c.height = h; g.font = LOGO.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
  LOGO.lines.forEach((t, i) => g.fillText(t, w / 2, 20 + LOGO.lineGap * (i + 0.5))); const px = g.getImageData(0, 0, w, h).data; const on = new Uint8Array(w * h); const samples = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (px[(y * w + x) * 4 + 3] > 127) { on[y * w + x] = 1; if (x % LOGO.step === 0 && y % LOGO.step === 0) samples.push(x, y); } }
  const st = W().state(); const s = LOGO.fill * Math.sqrt(st.max) / w; /* wafer units per canvas px: the text spans 1.6·R inside the wafer */
  const G = W().kepler().coreOut; /* the two lines part around the core: line 1 lifted by 0.10·R, line 2 lowered by it; the pupil stays empty */
  const toWafer = (x, y) => [(x - w / 2) * s, (h / 2 - y) * s + (y < h / 2 ? G : -G)]; const toCanvas = (X, Y) => [X / s + w / 2, h / 2 - (Y > 0 ? Y - G : Y + G) / s];
  return (logoRaster = { w, h, on, samples, n: samples.length / 2, s, toWafer, toCanvas }); }
function logoTargets(m){ const L = rasterLogo(); const t = new Float32Array(m * 2); const S = L.n;
  for (let j = 0; j < m; j++) { let q, dx = 0, dy = 0; if (m <= S) q = Math.floor(j * S / m); else { q = j % S; const c = Math.floor(j / S); dx = ((c * 7) % LOGO.step) / LOGO.step - 0.5; dy = ((c * 3) % LOGO.step) / LOGO.step - 0.5; } /* cycle with a tiny deterministic offset */
    const [X, Y] = L.toWafer(L.samples[2 * q] + dx, L.samples[2 * q + 1] + dy); t[2 * j] = X; t[2 * j + 1] = Y; } return t; }
cmds.logo = async function(spec){ if (!W()) return log('the wafer is not ready'); const sc = scopeKeys(spec || scopeName); if (!sc) return scopeFail(spec); const r = W().scope(sc.keys); scopeName = sc.name; const L = rasterLogo();
  log(`logo ${sc.name}: ${fmtN(r.shown)} lines → "${LOGO.lines.join(' / ')}" (${fmtN(L.n)} glyph samples, ${LOGO.font}, grid ${LOGO.step} px)`); await W().blend(logoTargets(r.shown)); hud(sc.name + ' · logo'); log(`logo ${sc.name}: assembled`); return r; };
cmds.wordmark = cmds.logo;
// test instrument: share of in-scope points within tolPx (screen px) of a glyph pixel
window.__logoCheck = (tolPx = 3) => { const L = rasterLogo(); const st = W().state(); const rad = Math.max(1, Math.ceil(tolPx / (st.view.zoom * L.s))); const P = W().positions(); let hit = 0;
  for (const [, X, Y] of P) { const [cx, cy] = L.toCanvas(X, Y); let ok = false; for (let y = Math.round(cy) - rad; y <= Math.round(cy) + rad && !ok; y++) for (let x = Math.round(cx) - rad; x <= Math.round(cx) + rad; x++) if (x >= 0 && y >= 0 && x < L.w && y < L.h && L.on[y * L.w + x]) { ok = true; break; } if (ok) hit++; }
  return { n: P.length, hit, share: P.length ? hit / P.length : 0, radiusCanvasPx: rad, samples: L.n }; };
window.__scopeKeys = spec => { const sc = scopeKeys(spec); return sc ? { name: sc.name, count: sc.keys ? sc.keys.length : null } : null; };
setTimeout(() => hud(), 1500);

// an app is a scope with gravity: app <name> and land <name> pull that app's lines in under Kepler; space releases them to the wafer law
{ const _app = cmds.app, _land = cmds.land, _space = cmds.space;
  cmds.app = async function(name){ const r = _app.call(cmds, name); if (W() && name && scopeKeys(name)) await cmds.gravity(name); return r; };
  cmds.land = async function(name){ if (W() && name && scopeKeys(name)) await cmds.gravity(name); return _land.call(cmds, name); };
  cmds.space = function(){ const r = _space.call(cmds); if (W()) cmds.release(); return r; }; }

window.__earth = () => ({ open: $('earth').classList.contains('open'), name: $('earthname').textContent, src: $('earthframe').src });


// the particles do the work: when the wafer's own panel opens for a line, add one plain link to the app that line belongs to
const APP_OF_REPO = { gridatlas: 'gridatlas', pipelinenews: 'pipelinenews', globalgrid2050: 'globalgrid2050', 'ventus-grid-engine': 'spider sandbox', elements: 'periodic table', 'grid-dictionary': 'grid-dictionary', spiders: 'spiders', 'star-solar-star': 'star-solar-star', 'code-generator': 'code-generator', testcode: 'testcode', 'galaxies-wafers': 'galaxies-wafers', stars: 'stars' };
const panelLink = () => { const body = $('panelbody'); if (!body || body.querySelector('.landlink')) return; const m = (body.innerText || '').match(/Line\s+([\d,]+)/); if (!m) return; const key = +m[1].replace(/,/g, ''); const t = twinOf(key); if (!t) return;
  const repo = t.repo.split('/')[1]; const app = APP_OF_REPO[repo]; if (!app) return; const url = EARTH[app] || `https://ventusltd.github.io/${repo}/`;
  body.insertAdjacentHTML('beforeend', `<p class="landlink" style="margin:.6rem 0 0"><a href="${url}" style="color:#5ec8f2">land on ${app} — this line's app</a> <span style="color:#8b93a7">· or type: land ${app}</span></p>`);
  body.querySelector('.landlink a').addEventListener('click', e => { e.preventDefault(); run('land ' + app); }); };
new MutationObserver(panelLink).observe($('panelbody'), { childList: true, subtree: true });
window.__pilot = run;
(async () => {
  serverMode = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && await fetch('/gpu', { cache: 'no-store' }).then(r => r.ok).catch(() => false);
  if (serverMode) (async function poll(){ try { const { lines: L } = await (await fetch('/pilot/next')).json(); for (const l of L) { log(`[powershell] ${l}`); await run(l); } } catch {} setTimeout(poll, 500); })();
  const j = async f => fetch(here + f).then(r => r.ok ? r.json() : null).catch(() => null);
  [keysDb, qubit, apps, entangle, labels] = await Promise.all([j('keys.json'), j('qubit.json'), j('apps.json'), j('entangle.json'), j('labels.json')]);
  log(`Quantum Twin — primary key to actual code. ${keysDb ? keysDb.count.toLocaleString() : '?'} blocks with a recorded line; ${qubit ? Object.keys(qubit.atoms).length.toLocaleString() : '?'} block families.`);
  log('Type a sentence or a command. Every answer shows the command it became. Try: block 39885');
  const start = document.querySelector('meta[name="wafer-start"]')?.content; if (start) { await new Promise(r => setTimeout(r, 1500)); const m = /^(land|visit|go|open)\s+(\S+)/.exec(start); if (m) { await run('app ' + m[2]); log(`This page stops here. To enter ${m[2]}, type: land ${m[2]} — space brings you back to the wafer.`); } else await run(start); sayEl.classList.add('min'); /* the wafer is the main event: the card starts folded to its title bar */ }
})();
