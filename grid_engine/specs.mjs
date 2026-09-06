/* specs.mjs — one entry per workbench iteration.
 *
 * A spec is never edited once its page is published; a change becomes a new
 * entry with a new stamp. build.mjs refuses to overwrite an existing directory,
 * so that rule is enforced by the tool rather than by memory.
 */

export const SPECS = [
    {
        stamp: '202609060205',
        slug: 'firm-capacity',
        title: 'Firm Capacity Workbench',
        sub: 'What a substation carries when one unit is out — the N-1 question',
        feature: 'N-1 firm capacity for a transformer bank, apparent power from a stated power factor, and a demand assessed against firm rather than installed capacity. Exposes the gap where most connection refusals actually live.',
        engineModule: 'firm-capacity.js',
        engineCommit: '294dcc0',
        schema: 'ventus-grid-engine.firm-capacity.v1',
        checks: 28,
        panels: [
            {
                heading: '1 · THE BANK — INSTALLED AGAINST FIRM',
                lede: `A substation's nameplate is the sum of its transformers. Its <strong>firm</strong>
                   capacity is what remains when the largest single unit is unavailable, because a
                   network planned to N-1 must survive the loss of any one element without shedding
                   load. Enter the transformer ratings, in MVA, separated by commas. A single
                   transformer returns zero firm capacity — that is the correct answer, not an error.`,
                controls: [
                    { id: 'units', type: 'text', label: 'Transformer ratings (MVA, comma separated)', value: '30, 30' }
                ],
                outId: 'out-firm'
            },
            {
                heading: '2 · THE LOAD — MW TO MVA',
                lede: `Plant is limited by current, and current follows apparent power, not real power.
                   A 100 MW load at 0.95 power factor draws 105.3 MVA, and it is the 105.3 the
                   transformer has to carry. Sizing on MW alone under-counts by the reciprocal of the
                   power factor, every time.`,
                controls: [
                    { id: 'mw', type: 'number', label: 'Real power (MW)', value: '40', min: 0.1, max: 5000, step: 0.1 },
                    { id: 'pf', type: 'range', label: 'Power factor', value: '0.95', min: 0.70, max: 1.00, step: 0.01 }
                ],
                outId: 'out-mva'
            },
            {
                heading: '3 · THE N-1 ASSESSMENT',
                lede: `The question a planner actually asks: does this demand still sit inside firm
                   capacity, and by how much does it miss if not? The paper's worked substation grows
                   from 24 to 42 MVA on two 30 MVA units — a 75% increase that leaves installed
                   capacity looking comfortable at 70% while firm capacity is already 40% exceeded.
                   That gap is invisible if you look only at the total.`,
                controls: [],
                outId: 'out-assess',
                tableId: 'assess-table',
                tableHead: [
                    { label: 'Measure' }, { label: 'Value', right: true }, { label: 'Reading', right: true }
                ],
                note: `The demand assessed is the MVA figure from panel 2, against the bank in panel 1.
                   Passing this arithmetic is not ER P2/7 compliance: a real security study also counts
                   transfer capacity from adjacent sites and permits interruption by group demand, so a
                   site can pass this and fail that, or fail this and remain compliant.`
            }
        ],
        script: `
function bind() {
  ['units','mw','pf'].forEach(id => el(id).addEventListener('input', render));
}

function parseUnits(raw) {
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(Number);
}

function render() {
  el('pf-val').textContent = num('pf').toFixed(2);
  let firm, mva;

  try {
    firm = E.firmCapacityMva({ units: parseUnits(el('units').value) });
    fig('out-firm', firm, 1);
  } catch (err) { refuse('out-firm', err.message); firm = null; }

  try {
    mva = E.apparentPowerMva({ mw: num('mw'), powerFactor: num('pf') });
    fig('out-mva', mva, 2);
  } catch (err) { refuse('out-mva', err.message); mva = null; }

  const tb = document.querySelector('#assess-table tbody');
  if (!firm || !mva) { tb.innerHTML = ''; el('out-assess').innerHTML =
    '<p class="basis" style="border:0;padding:0;margin:0">Fix the inputs above to see the assessment.</p>'; return; }

  try {
    const a = E.assessAgainstFirm({ units: firm.from.units, demandMva: mva.value });
    el('out-assess').innerHTML =
      '<div class="figure"><span class="q">n-1 assessment</span>' +
      '<span class="n' + (a.withinFirm ? '' : ' over') + '">' +
        (a.withinFirm ? 'WITHIN FIRM' : a.withinInstalled ? 'BEYOND FIRM' : 'BEYOND INSTALLED') +
      '</span></div><p class="basis">' + a.basis + '</p>';
    tb.innerHTML = [
      ['Installed capacity', a.installedMva.toFixed(1) + ' MVA', 'sum of all units'],
      ['Firm capacity (N-1)', a.firmMva.toFixed(1) + ' MVA', 'largest unit out'],
      ['Demand', a.demandMva.toFixed(2) + ' MVA', 'from panel 2'],
      ['Utilisation of installed', (a.utilisationOfInstalled * 100).toFixed(1) + '%',
        a.utilisationOfInstalled > 1 ? 'over' : 'looks comfortable'],
      ['Utilisation of firm', (a.utilisationOfFirm * 100).toFixed(1) + '%',
        a.utilisationOfFirm > 1 ? 'EXCEEDED' : 'within'],
      ['Shortfall against firm', a.shortfallMva.toFixed(2) + ' MVA',
        a.shortfallMva > 0 ? 'must be resolved' : 'none']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n" style="color:' +
      (/EXCEEDED|over|must/.test(r[2]) ? '#ff5c5c' : '#8e98a5') + '">' + r[2] + '</td></tr>').join('');
  } catch (err) { refuse('out-assess', err.message); }
}`
    }
];
