// cable-checks-ui.mjs: the Cable checks fold under Design > Plant > Solar block. Loads the staged cable schedule (the
// manifest pins its SHA-256: manifest.site.cables), lets the assumptions be changed, and shows voltage drop and
// loading per circuit as numbers (cable-checks.mjs). Loaded the first time the fold opens; nothing is drawn in 3D.
// Wording: an illustrative check with editable assumptions. A loading over 100 % reads "above 100% at these
// assumptions", in the same colour as every other number: no verdict words, no warning colour (tests/cable-checks.test.mjs).

import { makeApi } from './layers.mjs';
import { CHECK_LABEL, AXES, AXIS_WORDS, valueWords, loadingWords, parseChecks, defaultChoice, acChecks, dcChecks, tableRow } from './cable-checks.mjs';
import { formatNumber } from './measure-format.mjs';

const STYLE = `#cables-box .cc-note { color: var(--dim); margin: 4px 0; }
#cables-box label { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
#cables-box select, #cables-box input { max-width: 48%; }
#cables-box dd { color: var(--text); font-variant-numeric: tabular-nums; }
#cables-box .cc-table { overflow-x: auto; max-height: 260px; overflow-y: auto; margin: 4px 0 8px; }
#cables-box table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
#cables-box th, #cables-box td { padding: 1px 6px; text-align: right; white-space: nowrap; color: var(--text); }
#cables-box th:first-child, #cables-box td:first-child { text-align: left; }
#cables-box th { color: var(--dim); font-weight: normal; position: sticky; top: 0; background: var(--panel); }`;

// The staged file through the manifest's hash: { doc } or throws with a plain reason.
export async function loadStaged({ manifestUrl = './world/manifest.json', fetchImpl } = {}) {
  const base = new URL(manifestUrl, location.href), res = await (fetchImpl || fetch)(base.href, { cache: 'no-cache' });
  if (!res.ok) throw Error(`manifest HTTP ${res.status}`);
  const pin = (await res.json()).site?.cables;
  if (!pin?.path || !pin?.sha256) throw Error('no cable schedule is staged for this site (tools/stage-cable-schedule.mjs)');
  return makeApi(new URL('./', base).href, { fetchImpl }).fetchJSON(pin.path, pin.sha256);
}

// deps: { doc, box, load() -> Promise<staged json> }. Returns { choice(), set(k, v), ac(), dc() } once loaded.
export async function mountCableChecks({ doc, box, load = () => loadStaged() }) {
  if (!box) return null;
  if (!doc.getElementById('cables-style')) { const s = doc.createElement('style'); s.id = 'cables-style'; s.textContent = STYLE; doc.head.append(s); }
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(doc.createElement(tag), props); e.append(...kids); return e; };
  const note = t => el('p', { className: 'cc-note', textContent: t });
  box.replaceChildren(note('Reading the staged cable schedule…'));
  let checks;
  try { checks = parseChecks(await load()); } catch (e) { box.replaceChildren(note(`${CHECK_LABEL} No schedule to check here: ${e.message}.`)); return null; }

  const n = (x, d) => (Number.isFinite(x) ? formatNumber(x, d) : '–');
  const choice = defaultChoice(checks);
  const form = el('div', { className: 'cc-form' }), ac = el('dl'), acTable = el('div', { className: 'cc-table' });
  const dc = el('dl'), dcTable = el('div', { className: 'cc-table' }), invSel = el('select', { id: 'cables-inverter' });
  // Editable assumptions: every axis the GPU sweep rated, and the power factor for the voltage drop.
  if (checks.cases) {
    for (const k of AXES) {
      const sel = el('select', { id: `cables-${k}` });
      for (const v of checks.cases.axes[k]) sel.append(el('option', { value: String(v), textContent: valueWords(v), selected: v === choice[k] }));
      sel.addEventListener('change', () => { choice[k] = checks.cases.axes[k].find(v => String(v) === sel.value); render(); });
      form.append(el('label', {}, AXIS_WORDS[k] + ' ', sel));
    }
  } else form.append(note('The rated sweep is not staged: AC loading is not worked out; voltage drop uses the assumed cable.'));
  const pf = el('input', { id: 'cables-pf', type: 'number', min: '0.8', max: '1', step: '0.01', value: String(choice.pf) });
  pf.addEventListener('change', () => { choice.pf = Math.min(1, Math.max(0.8, Number(pf.value) || 1)); pf.value = String(choice.pf); render(); });
  form.append(el('label', {}, 'Power factor (voltage drop) ', pf));
  const inverters = [...new Set(checks.dc.map(c => c.inverter))];
  for (const i of inverters) invSel.append(el('option', { value: String(i), textContent: `Inverter ${i}` }));
  invSel.addEventListener('change', () => render());

  const table = (heads, rows) => el('table', {}, el('thead', {}, el('tr', {}, ...heads.map(h => el('th', { textContent: h })))),
    el('tbody', {}, ...rows.map(r => el('tr', {}, ...r.map((v, i) => el('td', { textContent: i && typeof v === 'number' ? n(v, [1, 2, 2, 1][i - 1]) : v ?? '–' }))))));
  const HEADS = ['Circuit', 'Length m', 'Drop V', 'Drop %', 'Loading %'];
  const dl = (target, rows) => target.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
  const range = s => (s ? `${n(s.min, 2)} to ${n(s.max, 2)} % (median ${n(s.median, 2)} %)` : '–');
  const loadLine = s => (s?.loading_pct ? `${n(s.loading_pct.max, 1)} % at most · ${loadingWords(s.loading_pct.max)}` +
    (s.above100 ? ` (${s.above100} of ${s.count})` : '') : loadingWords(NaN));
  let last = null;
  function render() {
    const A = acChecks(checks, choice), D = dcChecks(checks), inv = Number(invSel.value) || inverters[0];
    dl(ac, [['AC phase cables', `${A.summary.count} · ${n(choice.size, 0)} mm² ${valueWords(choice.mat)}, ${n(checks.assumed.ac.volts, 0)} V`],
      ['Rating, this case', Number.isFinite(A.rating_A) ? `${n(A.rating_A, 1)} A per cable (GPU-rated sweep, assumed data)` : 'not in the rated sweep'],
      ['Loading', loadLine(A.summary)], ['Voltage drop', range(A.summary.vd_pct) + ' of line volts'],
      ...(Number.isFinite(A.width_m) ? [['Trench width, this case', `${n(A.width_m, 2)} m`]] : [])]);
    acTable.replaceChildren(table(HEADS, A.circuits.map(tableRow)));
    dl(dc, [['DC string cables', `${D.summary.count} · ${n(checks.assumed.dc.area_mm2, 0)} mm² copper, as scheduled (assumed rating ` +
      `${n(checks.assumed.dc.base_duct_A, 0)} A in duct, grouping factors as scheduled)`],
      ['Loading', loadLine(D.summary)], ['Voltage drop', range(D.summary.vd_pct) + ` of the string's ${n(checks.assumed.string_vmp_V, 0)} V`],
      ['Per string', range(D.summary.strings) + ' (both conductors)']]);
    dcTable.replaceChildren(table(HEADS, D.circuits.filter(c => c.inverter === inv).map(tableRow)));
    last = { ac: A, dc: D };
  }
  const why = `Grouping factors cited as ${checks.standards[0] || 'IEC 60364-5-52 Annex B Tables B.52.18 and B.52.19'}; rating method of the form of ` +
    `${checks.standards.slice(1, 4).join(', ') || 'IEC 60287-1-1, IEC 60287-2-1, IEC 60853-2'}; conductor resistance of the kind listed in ` +
    `${checks.standards[4] || 'IEC 60228 Tables 2 and 3'}. Table numbers to be checked against the editions held.`;
  box.replaceChildren(note(`${CHECK_LABEL} ${checks.illustrative.replace(CHECK_LABEL, '').trim()}`), form, ac, acTable,
    dc, el('label', {}, 'DC circuits shown ', invSel), dcTable, note(checks.lengths), note(why),
    note('Sources: ' + checks.sources.map(s => `${s.file} ${String(s.sha256).slice(0, 12)}`).join(' · ')));
  render();
  return { choice: () => ({ ...choice }), set(k, v) { choice[k] = v; render(); }, ac: () => last.ac, dc: () => last.dc };
}
