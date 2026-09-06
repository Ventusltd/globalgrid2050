/* build.mjs — emits a Grid Engine workbench as a self-contained immutable page.
 *
 * WHY A GENERATOR AND NOT THIRTY HAND-WRITTEN PAGES.
 * Each published workbench is immutable: it is never edited once it exists, so
 * an improvement becomes the next timestamp. Hand-writing each one guarantees
 * that a fix to the shell — a touch target, a dark-mode colour, an overflow
 * rule — reaches only the page that happened to be open at the time, and the
 * thirty pages drift apart. Holding the generator instead means the shell is
 * one thing, each iteration is a small declarative delta, and any past page can
 * be re-emitted byte-for-byte from its spec if it ever needs to be audited.
 *
 * WHAT THE GENERATOR DOES NOT DO.
 * It does not compute anything and it does not embed the mathematics. Every
 * emitted page imports its engine module from ventus-grid-engine at RUNTIME, so
 * a figure on a published page is the figure the engine's proofs are run
 * against. If the engine cannot be reached the page shows no numbers rather
 * than falling back to a copy — a fallback copy is exactly how a view drifts
 * from the module it claims to use, silently, while still looking right.
 *
 * Run:  node grid_engine/build.mjs            (emit any spec not yet published)
 *       node grid_engine/build.mjs --check    (verify published pages match)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SPECS } from './specs.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE_BASE = 'https://ventusltd.github.io/ventus-grid-engine/engine/';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* The shell. One place, so a fix reaches every page emitted after it, and no
   page emitted before it changes — which is the point of immutability. */
function shell({ spec, body, script }) {
    return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title)} — Ventus Grid Engine</title>
<style>
:root{--bg:#000;--panel:#0b0e14;--line:#2f343d;--soft:#222;--text:#fff;
  --muted:#a6adbb;--accent:#00ffff;--ok:#00ff88;--warn:#ffae00;--no:#ff5c5c}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Courier New',ui-monospace,monospace}
html,body{background:var(--bg);color:var(--text)}
body{font-size:14px;line-height:1.55;padding:0 0 48px}
.wrap{max-width:960px;margin:0 auto;padding:0 14px}
header{border-bottom:1px solid var(--soft);padding:18px 0 14px;margin-bottom:16px}
h1{font-size:17px;letter-spacing:2px;color:var(--accent)}
.sub{color:var(--muted);font-size:11px;margin-top:6px}
.stamp{color:#7f8996;font-size:10px;margin-top:8px;overflow-wrap:anywhere}
.status{border:1px solid var(--line);background:var(--panel);padding:9px 11px;
  margin-bottom:16px;font-size:11px}
.status.live{border-color:#167d4d;color:var(--ok)}
.status.dead{border-color:#7d1616;color:var(--no)}
section{border:1px solid var(--soft);background:var(--panel);margin-bottom:16px}
h2{font-size:12px;letter-spacing:1.4px;color:var(--accent);padding:11px 13px;
  border-bottom:1px solid var(--soft)}
.body{padding:13px}
.lede{color:var(--muted);font-size:11.5px;line-height:1.65;margin-bottom:13px}
label{display:block;color:var(--muted);font-size:10px;letter-spacing:.6px;
  text-transform:uppercase;margin:0 0 5px}
.field{margin-bottom:13px}
input[type=number],input[type=text]{width:100%;background:#000;border:1px solid var(--line);
  color:var(--text);padding:11px 10px;font-size:16px;font-weight:700}
input:focus{outline:none;border-color:var(--accent)}
input[type=range]{width:100%;accent-color:var(--accent);height:32px}
.rangerow{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.rangeval{color:var(--accent);font-weight:700;font-size:15px;white-space:nowrap}
.out{border:1px solid var(--line);background:#06080b;padding:11px;margin-top:11px}
.figure{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.figure .n{font-size:26px;font-weight:700;color:var(--ok);line-height:1.1}
.figure .n.over{color:var(--no)}
.figure .u{font-size:12px;color:var(--muted)}
.figure .q{font-size:10px;color:#7f8996;text-transform:uppercase;letter-spacing:.8px;
  flex:1 0 100%;margin-bottom:3px}
.basis{color:#8e98a5;font-size:10.5px;line-height:1.65;margin-top:9px;
  border-top:1px dashed #252a31;padding-top:8px}
.scroller{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:11px}
th{color:var(--accent);text-align:left;padding:7px 6px;border-bottom:1px solid var(--line);
  font-size:10px;letter-spacing:.5px}
td{padding:7px 6px;border-bottom:1px solid #1a1e25;color:var(--muted)}
td.n{color:var(--text);font-weight:700;text-align:right;white-space:nowrap}
.refuse{border:1px solid #5c2020;background:#120708}
.refuse h2{color:#ff8f8f;border-bottom-color:#5c2020}
.refuse dt{color:#ff8f8f;font-size:11px;font-weight:700;margin-top:11px}
.refuse dt:first-child{margin-top:0}
.refuse dd{color:#c9a9a9;font-size:10.5px;line-height:1.65;margin-top:3px}
footer{color:#69727d;font-size:10.5px;line-height:1.9;padding-top:14px;
  border-top:1px solid var(--soft);margin-top:20px}
/* Touch targets. Measured at 393px on 2026-09-06: footer links were 11.3px
   tall, below the 24px WCAG 2.2 minimum. Inline links keep their flow but are
   given real height through padding and line-height. */
footer a,.basis a{color:#66ccff;display:inline-block;padding:5px 2px;line-height:1.5}
.nav{margin-top:14px;font-size:11px}
.nav a{color:#66ccff;display:inline-block;padding:8px 10px 8px 0}
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>${esc(spec.title.toUpperCase())}</h1>
  <p class="sub">${esc(spec.sub)}</p>
  <p class="stamp">Generation ${esc(spec.stamp)} · engine ${esc(spec.engineModule)} at ${esc(spec.engineCommit)}</p>
</header>
<div class="status" id="engine-status">Loading the engine module…</div>
${body}
<section class="refuse">
  <h2>WHAT THIS WORKBENCH WILL NOT COMPUTE</h2>
  <div class="body">
    <p class="lede" style="color:#c9a9a9">These are not features missing from a later
      version. The engine proof asserts that no function of these names exists, so
      their absence is a tested property rather than an oversight.</p>
    <dl id="refusals"></dl>
  </div>
</section>
<footer>
  <p>Every figure above is computed by
     <a href="${ENGINE_BASE}${esc(spec.engineModule)}">${esc(spec.engineModule)}</a>
     in the Ventus Grid Engine, imported at runtime and proven by ${spec.checks} checks.
     This page holds no copy of the mathematics: if the engine cannot be reached it
     shows no numbers rather than a stale answer.</p>
  <p class="nav">
     <a href="../">All workbenches</a>
     <a href="/papers/202609060203-electrification/">Electrification paper</a>
     <a href="/papers/202609060045-published-fault-level/">Fault-level paper</a>
     <a href="/">GlobalGrid2050</a></p>
  <p style="margin-top:6px">Scenario arithmetic is not evidence of connection headroom.
     A national load factor cannot establish utilisation at any particular transformer.</p>
</footer>
</div>
<script type="module">
const ENGINE = '${ENGINE_BASE}${spec.engineModule}';
const statusEl = document.getElementById('engine-status');
let E = null;

const el = id => document.getElementById(id);
const num = id => Number(el(id).value);

function fig(target, r, decimals = 1, over = false) {
  el(target).innerHTML =
    '<div class="figure">' +
      '<span class="q">' + r.quantity.replace(/_/g, ' ') + '</span>' +
      '<span class="n' + (over ? ' over' : '') + '">' +
        r.value.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
      '</span><span class="u">' + r.unit + '</span></div>' +
    '<p class="basis">' + r.basis + '</p>';
}

function refuse(target, message) {
  el(target).innerHTML = '<p class="basis" style="color:#ffae00;border:0;padding:0;margin:0">'
    + 'Engine refused this input: ' + message + '</p>';
}

${script}

try {
  E = await import(ENGINE);
  if (E.schema !== '${spec.schema}') throw new Error('unexpected schema ' + E.schema);
  statusEl.className = 'status live';
  statusEl.textContent = 'ENGINE LIVE — ' + E.schema +
    ' · every figure below is computed by the engine module, not by this page.';
  el('refusals').innerHTML = Object.entries(E.NOT_COMPUTED).map(([k, v]) =>
    '<dt>' + k.replace(/([A-Z])/g, ' $1').toUpperCase() + '</dt><dd>' + v + '</dd>').join('');
  bind();
  render();
} catch (err) {
  statusEl.className = 'status dead';
  statusEl.textContent = 'ENGINE UNREACHABLE — ' + err.message +
    '. Nothing on this page is computed; there is deliberately no local copy to fall back to.';
  document.querySelectorAll('.out').forEach(o => {
    o.innerHTML = '<p class="basis" style="color:#ff8f8f;border:0;padding:0;margin:0">'
      + 'No figure: the engine did not load.</p>'; });
}
</script>
</body>
</html>
`;
}

function panelHtml(p) {
    const controls = p.controls.map(c => {
        if (c.type === 'range') {
            return `    <div class="field">
      <div class="rangerow"><label for="${c.id}">${esc(c.label)}</label>
        <span class="rangeval" id="${c.id}-val">${c.value}</span></div>
      <input type="range" id="${c.id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}">
    </div>`;
        }
        return `    <div class="field">
      <label for="${c.id}">${esc(c.label)}</label>
      <input type="${c.type}" id="${c.id}" value="${esc(c.value)}"${c.min !== undefined ? ` min="${c.min}"` : ''}${c.max !== undefined ? ` max="${c.max}"` : ''}${c.step !== undefined ? ` step="${c.step}"` : ''} inputmode="${c.type === 'number' ? 'decimal' : 'text'}">
    </div>`;
    }).join('\n');
    return `<section>
  <h2>${esc(p.heading)}</h2>
  <div class="body">
    <p class="lede">${p.lede}</p>
${controls}
    ${p.outId ? `<div class="out" id="${p.outId}"></div>` : ''}
    ${p.tableId ? `<div class="scroller"><table id="${p.tableId}"><thead><tr>${p.tableHead.map(h => `<th${h.right ? ' style="text-align:right"' : ''}>${esc(h.label)}</th>`).join('')}</tr></thead><tbody></tbody></table></div>` : ''}
    ${p.note ? `<p class="basis">${p.note}</p>` : ''}
  </div>
</section>`;
}

function emit(spec) {
    const body = spec.panels.map(panelHtml).join('\n');
    const html = shell({ spec, body, script: spec.script });
    const dir = join(here, `${spec.stamp}-${spec.slug}`);
    const file = join(dir, 'index.html');
    if (existsSync(file)) return { spec, written: false, file };
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, html, 'utf8');
    return { spec, written: true, file };
}

const check = process.argv.includes('--check');
const ledgerPath = join(here, 'iterations.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));

let wrote = 0;
for (const spec of SPECS) {
    const r = emit(spec);
    if (r.written) {
        wrote += 1;
        console.log(`emitted ${spec.stamp}-${spec.slug}/index.html`);
    }
    if (!ledger.iterations.some(i => i.stamp === spec.stamp)) {
        ledger.iterations.push({
            stamp: spec.stamp,
            path: `${spec.stamp}-${spec.slug}/`,
            title: spec.title,
            feature: spec.feature,
            engine: `engine/${spec.engineModule}`,
            engineCommit: spec.engineCommit,
            checks: spec.checks
        });
    }
}
if (!check) {
    writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}
console.log(`${wrote} page(s) emitted; ledger holds ${ledger.iterations.length} iteration(s)`);
