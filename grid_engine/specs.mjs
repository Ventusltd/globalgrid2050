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
    },
    {
        stamp: '202609060211',
        slug: 'diversity',
        title: 'Diversity Workbench',
        sub: 'The peak of the sum, never the sum of the peaks',
        feature: 'After Diversity Maximum Demand for a group of like loads, coincidence measured from a group peak rather than assumed, and the average across a delivery window kept separate from the peak inside it.',
        engineModule: 'diversified-demand.js',
        engineCommit: '9a92211',
        schema: 'ventus-grid-engine.diversified-demand.v1',
        checks: 26,
        panels: [
            {
                heading: '1 · AFTER DIVERSITY MAXIMUM DEMAND',
                lede: `A hundred homes with 7 kW chargers do not present 700 kW to the transformer,
                   because they do not all charge at once. The figure that sizes the plant is the peak
                   of the <em>sum</em>. The coincidence factor is required here and never defaulted:
                   assume it too low and the transformer overheats, too high and a viable connection is
                   refused. It belongs to a group of <em>this</em> size — one quoted for a thousand
                   units will badly under-size ten. Where your network operator publishes a factor for
                   the load class, use theirs.`,
                controls: [
                    { id: 'n', type: 'number', label: 'Number of units', value: '100', min: 1, max: 50000000, step: 1 },
                    { id: 'perkw', type: 'number', label: 'Rating of each unit (kW)', value: '7', min: 0.1, max: 5000, step: 0.1 },
                    { id: 'coin', type: 'range', label: 'Coincidence factor', value: '0.30', min: 0.02, max: 1.00, step: 0.01 }
                ],
                outId: 'out-admd'
            },
            {
                heading: '2 · THE HONEST DIRECTION — MEASURE IT',
                lede: `Where a group peak has actually been measured, derive the coincidence factor
                   from it instead of assuming one. This is the same arithmetic run backwards, and it
                   is always the better evidence.`,
                controls: [
                    { id: 'meas', type: 'number', label: 'Measured group peak (kW)', value: '210', min: 0.1, max: 100000000, step: 0.1 }
                ],
                outId: 'out-implied'
            },
            {
                heading: '3 · ONE POPULATION, THREE DIFFERENT NUMBERS',
                lede: `The confusion that sizes networks wrongly. Ten million vehicles taking
                   2,500 kWh a year is 25 TWh. Across the whole year that averages 2.85 GW. Squeezed
                   into an eight-hour nightly window it averages 8.56 GW. Left unmanaged at 20%
                   coincidence they draw 14 GW. Same vehicles, a factor of five apart — and only one
                   of those numbers sizes a transformer.`,
                controls: [
                    { id: 'fleet', type: 'number', label: 'Population size', value: '10000000', min: 1, max: 100000000, step: 1 },
                    { id: 'perkwh', type: 'number', label: 'Annual energy each (kWh)', value: '2500', min: 1, max: 100000, step: 1 },
                    { id: 'window', type: 'range', label: 'Delivery window (hours per day)', value: '8', min: 1, max: 24, step: 1 }
                ],
                tableId: 'three-table',
                tableHead: [{ label: 'Quantity' }, { label: 'Value', right: true }, { label: 'What it sizes', right: true }],
                note: `Only the third row sizes plant. The first two are energy questions. Quoting an
                   average across a window as though it were a peak is how a flexibility assumption
                   gets smuggled into a network study.`
            }
        ],
        script: `
function bind() { ['n','perkw','coin','meas','fleet','perkwh','window'].forEach(id => el(id).addEventListener('input', render)); }

function render() {
  el('coin-val').textContent = num('coin').toFixed(2);
  el('window-val').textContent = num('window').toFixed(0);

  try { fig('out-admd', E.diversifiedDemandKw({ unitCount: Math.round(num('n')), perUnitKw: num('perkw'), coincidenceFactor: num('coin') }), 1); }
  catch (err) { refuse('out-admd', err.message); }

  try { fig('out-implied', E.impliedCoincidence({ unitCount: Math.round(num('n')), perUnitKw: num('perkw'), measuredGroupPeakKw: num('meas') }), 3); }
  catch (err) { refuse('out-implied', err.message); }

  const tb = document.querySelector('#three-table tbody');
  try {
    const fleet = Math.round(num('fleet')), each = num('perkwh'), win = num('window');
    const en = E.populationEnergyTwh({ unitCount: fleet, perUnitKwhPerYear: each });
    const annualGw = en.value / 8.76;
    const winGw = E.averageOverWindowGw({ annualTwh: en.value, windowHoursPerDay: win }).value;
    const admdGw = E.diversifiedDemandKw({ unitCount: fleet, perUnitKw: num('perkw'), coincidenceFactor: num('coin') }).value / 1e6;
    tb.innerHTML = [
      ['Annual energy', en.value.toFixed(2) + ' TWh', 'generation, not plant'],
      ['Average across the year', annualGw.toFixed(2) + ' GW', 'nothing — no network sees this'],
      ['Average across a ' + win + '-hour window', winGw.toFixed(2) + ' GW', 'an average, not a peak'],
      ['Unrestricted simultaneous draw', (fleet * num('perkw') / 1e6).toFixed(2) + ' GW', 'the worst case'],
      ['After diversity (factor ' + num('coin').toFixed(2) + ')', admdGw.toFixed(2) + ' GW', 'THIS sizes the plant']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n" style="color:' +
      (/THIS/.test(r[2]) ? '#00ff88' : '#8e98a5') + '">' + r[2] + '</td></tr>').join('');
  } catch (err) { tb.innerHTML = '<tr><td colspan="3" style="color:#ffae00">' + err.message + '</td></tr>'; }
}`
    },
    {
        stamp: '202609060212',
        slug: 'connection-cap',
        title: 'Connection Cap Workbench',
        sub: 'Sizing a battery against an agreed capacity — power from the peak, store from the area',
        feature: 'A demand profile against a stated connection cap: peak excess, energy above the cap, and the battery power and installed energy that keep the site inside it after round-trip efficiency and depth of discharge.',
        engineModule: 'connection-capacity.js',
        engineCommit: '9a92211',
        schema: 'ventus-grid-engine.connection-capacity.v1',
        checks: 39,
        panels: [
            {
                heading: '1 · THE PROFILE AGAINST THE CAP',
                lede: `Enter the site demand as half-hourly values in kW, separated by commas. The cap
                   is your agreed import capacity — a commercial parameter from your connection
                   agreement, not a physical property of the network, which is why it is typed in and
                   never inferred. A site that exceeds its cap by 12 kW for six minutes needs a
                   completely different asset from one that exceeds it by 12 kW for four hours, and
                   that is why this takes a shape rather than a peak.`,
                controls: [
                    { id: 'profile', type: 'text', label: 'Half-hourly demand (kW, comma separated)', value: '20, 28, 42, 38, 36, 30, 24, 20' },
                    { id: 'cap', type: 'number', label: 'Agreed import capacity (kW)', value: '30', min: 1, max: 1000000, step: 1 }
                ],
                outId: 'out-exceed'
            },
            {
                heading: '2 · THE BATTERY THAT HOLDS YOU INSIDE IT',
                lede: `Power comes from the worst interval. Energy comes from the area above the cap.
                   Round-trip efficiency and depth of discharge are then applied — and both only ever
                   make the asset bigger, never smaller. Sizing the usable energy without dividing by
                   efficiency under-sizes the pack you actually have to buy.`,
                controls: [
                    { id: 'rte', type: 'range', label: 'Round-trip efficiency', value: '0.88', min: 0.60, max: 0.98, step: 0.01 },
                    { id: 'dod', type: 'range', label: 'Depth of discharge', value: '0.90', min: 0.50, max: 1.00, step: 0.01 }
                ],
                outId: 'out-battery',
                tableId: 'batt-table',
                tableHead: [{ label: 'Measure' }, { label: 'Value', right: true }, { label: 'Set by', right: true }],
                note: `This sizes the simple physical duty — discharge exactly the excess — which is
                   the correct basis for sizing. It is not an optimised revenue dispatch: stacking
                   frequency response or arbitrage on top is a different problem with commercial
                   inputs this engine does not have.`
            }
        ],
        script: `
function bind() { ['profile','cap','rte','dod'].forEach(id => el(id).addEventListener('input', render)); }
function parseProfile(raw) { return raw.split(',').map(s => s.trim()).filter(Boolean).map(Number); }

function render() {
  el('rte-val').textContent = num('rte').toFixed(2);
  el('dod-val').textContent = num('dod').toFixed(2);
  const profileKw = parseProfile(el('profile').value);
  const capKw = num('cap');
  const tb = document.querySelector('#batt-table tbody');

  let ex;
  try {
    ex = E.exceedance({ profileKw, capKw, intervalHours: 0.5 });
    el('out-exceed').innerHTML =
      '<div class="figure"><span class="q">exceedance above cap</span>' +
      '<span class="n' + (ex.withinCap ? '' : ' over') + '">' +
        (ex.withinCap ? 'WITHIN CAP' : ex.peakExcessKw.toFixed(1) + ' kW over') +
      '</span></div><p class="basis">' + ex.basis + '</p>';
  } catch (err) { refuse('out-exceed', err.message); tb.innerHTML = ''; return; }

  try {
    const b = E.batteryForPeakShaving({ profileKw, capKw, intervalHours: 0.5,
      roundTripEfficiency: num('rte'), depthOfDischarge: num('dod') });
    el('out-battery').innerHTML =
      '<div class="figure"><span class="q">battery required</span>' +
      '<span class="n">' + b.powerKw.toFixed(1) + '</span><span class="u">kW / ' +
      b.installedEnergyKwh.toFixed(1) + ' kWh</span></div><p class="basis">' + b.basis + '</p>';
    tb.innerHTML = [
      ['Site peak', ex.peakKw.toFixed(1) + ' kW', 'the profile'],
      ['Agreed cap', capKw.toFixed(1) + ' kW', 'your connection agreement'],
      ['Peak excess', ex.peakExcessKw.toFixed(1) + ' kW', 'sizes the POWER'],
      ['Energy above cap', ex.energyAboveCapKwh.toFixed(2) + ' kWh', 'sizes the STORE'],
      ['Intervals over', ex.intervalsAboveCap + ' of ' + ex.intervalCount, (ex.fractionOfTimeAboveCap * 100).toFixed(1) + '% of the time'],
      ['Site load factor', (ex.siteLoadFactor * 100).toFixed(1) + '%', 'shape of the demand'],
      ['Usable energy needed', b.usableEnergyKwh.toFixed(2) + ' kWh', 'area above the cap'],
      ['Energy to be stored', b.chargeEnergyRequiredKwh.toFixed(2) + ' kWh', 'after round-trip losses'],
      ['Installed energy', b.installedEnergyKwh.toFixed(2) + ' kWh', 'after depth of discharge'],
      ['Asset duration', b.durationHours.toFixed(2) + ' h', 'energy over power']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n" style="color:' +
      (/POWER|STORE/.test(r[2]) ? '#00ffff' : '#8e98a5') + '">' + r[2] + '</td></tr>').join('');
  } catch (err) { refuse('out-battery', err.message); tb.innerHTML = ''; }
}`
    },
    {
        stamp: '202609060213',
        slug: 'route-obstacles',
        title: 'Route Obstacles Workbench',
        sub: 'What gets in the way — and when a road factor describes a road that is not there',
        feature: 'Declared crossings for a cable route: which obstacles cannot be open-cut, what each trenchless crossing costs in length once setbacks are counted, and a refusal to apply a highway-corridor factor to a route across open water.',
        engineModule: 'route-obstacles.js',
        engineCommit: '9a92211',
        schema: 'ventus-grid-engine.route-obstacles.v1',
        checks: 44,
        panels: [
            {
                heading: '1 · THE ROUTE, AND WHAT IT CROSSES',
                lede: `The straight line is the first pass and stays exactly as it is. What this adds
                   is the crossings. Enter them as <code>type</code> or <code>type x count</code>,
                   separated by commas — for example <code>motorway, railway x2, minor_road x3</code>.
                   Known types: motorway, trunk_road, minor_road, railway, navigable_river, canal,
                   watercourse, open_water, protected_habitat.`,
                controls: [
                    { id: 'skm', type: 'number', label: 'Straight-line distance (km)', value: '10', min: 0.1, max: 2000, step: 0.01 },
                    { id: 'cross', type: 'text', label: 'Declared crossings', value: 'motorway, railway x2, minor_road x3' },
                    { id: 'cf', type: 'range', label: 'Corridor factor', value: '1.245', min: 1.00, max: 2.00, step: 0.005 }
                ],
                outId: 'out-route'
            },
            {
                heading: '2 · THE CROSSING SCHEDULE',
                lede: `You do not open-cut a live motorway or a running railway. Those are trenchless
                   crossings, with launch and reception pits set back beyond the asset boundary — so
                   the bore is always longer than the obstacle is wide, and for anything narrow the
                   setback is the dominant term. A 30 m motorway with 15 m setbacks is a 60 m span,
                   not a 30 m drill.`,
                controls: [
                    { id: 'width', type: 'number', label: 'Obstacle width (m)', value: '30', min: 0.5, max: 2000, step: 0.5 },
                    { id: 'setback', type: 'number', label: 'Setback each side (m)', value: '15', min: 0.5, max: 500, step: 0.5 },
                    { id: 'depth', type: 'number', label: 'Bore depth (m, 0 for none)', value: '0', min: 0, max: 100, step: 0.5 }
                ],
                tableId: 'cross-table',
                tableHead: [{ label: 'Crossing' }, { label: 'Method', right: true }, { label: 'Why', right: false }],
                note: `Widths, setbacks and cover are the asset owner's requirements and differ between
                   owners — Network Rail and a highways authority do not publish the same numbers — so
                   they are inputs here and never constants. A crossing declared without a width is
                   counted and named, not silently costed at zero.`
            },
            {
                heading: '3 · THE IRISH SEA TEST',
                lede: `Add <code>open_water</code> to the crossings above and the estimate becomes
                   <em>null</em>, not a number. This is the check a scalar corridor function cannot
                   make: <code>forCable()</code> receives one kilometre and never sees the
                   coordinates, so South Antrim to the Western HVDC converter — 142.21 km, almost all
                   of it sea — was printed as a 177.05 km highway corridor. A road route that does not
                   exist, stated with the confidence of a calibrated number. The straight line is kept
                   either way, because it is a real measurement.`,
                controls: [],
                outId: 'out-sea'
            }
        ],
        script: `
function bind() { ['skm','cross','cf','width','setback','depth'].forEach(id => el(id).addEventListener('input', render)); }

function parseCrossings(raw, widthM, setbackM, depthM) {
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(tok => {
    const m = tok.match(/^([a-z_]+)(?:\\s*[x*]\\s*(\\d+))?$/i);
    if (!m) throw new Error('cannot read crossing "' + tok + '" — use type or type x count');
    const c = { type: m[1].toLowerCase(), count: m[2] ? parseInt(m[2], 10) : 1 };
    if (widthM > 0 && setbackM > 0) { c.widthM = widthM; c.setbackM = setbackM; if (depthM > 0) c.depthM = depthM; }
    return c;
  });
}

function render() {
  el('cf-val').textContent = num('cf').toFixed(3);
  const tb = document.querySelector('#cross-table tbody');
  let crossings;
  try { crossings = parseCrossings(el('cross').value, num('width'), num('setback'), num('depth')); }
  catch (err) { refuse('out-route', err.message); tb.innerHTML = ''; return; }

  try {
    const r = E.routeEstimate({ straightLineKm: num('skm'), crossings, corridorFactor: num('cf') });
    el('out-route').innerHTML = r.value === null
      ? '<div class="figure"><span class="q">route estimate</span><span class="n over">NO ESTIMATE</span></div>'
        + '<p class="basis">' + r.basis + '</p>'
      : '<div class="figure"><span class="q">route estimate</span><span class="n">' +
        r.value.toFixed(2) + '</span><span class="u">km</span></div><p class="basis">' + r.basis + '</p>';

    tb.innerHTML = r.schedule.items.map(i =>
      '<tr><td>' + i.label + (i.count > 1 ? ' x' + i.count : '') + '</td>' +
      '<td class="n" style="color:' + (i.trenchless ? '#ffae00' : '#00ff88') + '">' + i.method + '</td>' +
      '<td style="font-size:10px">' + i.why + '</td></tr>').join('')
      || '<tr><td colspan="3">No crossings declared.</td></tr>';

    const sea = E.routeEstimate({ straightLineKm: num('skm'),
      crossings: crossings.concat([{ type: 'open_water' }]), corridorFactor: num('cf') });
    el('out-sea').innerHTML =
      '<div class="figure"><span class="q">the same route, with open water added</span>' +
      '<span class="n over">' + (sea.value === null ? 'NO ESTIMATE' : sea.value.toFixed(2)) + '</span></div>' +
      '<p class="basis">' + sea.basis + '</p>';
  } catch (err) { refuse('out-route', err.message); tb.innerHTML = ''; }
}`
    },
    {
        stamp: '202609060217',
        slug: 'solar-bess-export',
        title: 'Solar and BESS Export Workbench',
        sub: 'What a constrained connection costs an array — and what the battery recovers',
        feature: 'Generation against an export cap: the energy clipped, the fraction of the array\'s output lost, and the net position at the connection point when site load and generation are taken together against separate import and export caps.',
        engineModule: 'connection-capacity.js',
        engineCommit: '9a92211',
        schema: 'ventus-grid-engine.connection-capacity.v1',
        checks: 39,
        panels: [
            {
                heading: '1 · WHAT THE EXPORT CAP CLIPS',
                lede: `Oversizing DC behind a smaller AC connection is a normal design choice and
                   often a good one — but only once the loss is known rather than assumed away. Enter
                   the generation profile in kW, hour by hour, and the export capacity from your
                   connection agreement. Everything above the cap is energy the array would have made
                   and cannot deliver.`,
                controls: [
                    { id: 'gen', type: 'text', label: 'Hourly generation (kW, comma separated)', value: '0, 2, 6, 11, 14, 15, 14, 11, 6, 2, 0' },
                    { id: 'ecap', type: 'number', label: 'Agreed export capacity (kW)', value: '10', min: 1, max: 1000000, step: 1 }
                ],
                outId: 'out-clip'
            },
            {
                heading: '2 · THE NET POSITION AT THE CONNECTION',
                lede: `A site with both load and generation presents the <em>net</em> at the meter.
                   Import and export caps are separate commercial parameters and are frequently
                   different numbers, so they are checked separately here — netting them into a single
                   figure hides a breach in whichever direction you were not looking.`,
                controls: [
                    { id: 'load', type: 'text', label: 'Hourly site load (kW, comma separated)', value: '4, 4, 5, 6, 6, 6, 6, 5, 5, 4, 4' },
                    { id: 'icap', type: 'number', label: 'Agreed import capacity (kW)', value: '8', min: 1, max: 1000000, step: 1 }
                ],
                outId: 'out-net',
                tableId: 'net-table',
                tableHead: [{ label: 'Measure' }, { label: 'Value', right: true }, { label: 'Against cap', right: true }],
                note: `The load and generation profiles must describe the same period at the same
                   resolution. If they do not, the engine refuses rather than silently padding one of
                   them — a padded profile produces a confident answer about a period that was never
                   measured.`
            }
        ],
        script: `
function bind() { ['gen','ecap','load','icap'].forEach(id => el(id).addEventListener('input', render)); }
function parse(raw) { return raw.split(',').map(s => s.trim()).filter(Boolean).map(Number); }

function render() {
  const generationKw = parse(el('gen').value);
  const loadKw = parse(el('load').value);
  const tb = document.querySelector('#net-table tbody');

  try {
    const c = E.clippedEnergy({ generationKw, exportCapKw: num('ecap'), intervalHours: 1 });
    el('out-clip').innerHTML =
      '<div class="figure"><span class="q">energy clipped</span><span class="n' +
      (c.clippedKwh > 0 ? ' over' : '') + '">' + c.clippedKwh.toFixed(1) +
      '</span><span class="u">kWh · ' + (c.clippedFraction * 100).toFixed(2) + '% of potential</span></div>' +
      '<p class="basis">' + c.basis + '</p>';
  } catch (err) { refuse('out-clip', err.message); }

  try {
    const n = E.netAtConnection({ loadKw, generationKw,
      importCapKw: num('icap'), exportCapKw: num('ecap'), intervalHours: 1 });
    el('out-net').innerHTML =
      '<div class="figure"><span class="q">net position</span><span class="n' +
      (n.withinBothCaps ? '' : ' over') + '">' +
      (n.withinBothCaps ? 'WITHIN BOTH CAPS' : 'CAP BREACHED') + '</span></div>' +
      '<p class="basis">' + n.basis + '</p>';
    tb.innerHTML = [
      ['Peak import', n.peakImportKw.toFixed(1) + ' kW', n.importBreaches ? n.importBreaches + ' breach(es)' : 'within ' + n.importCapKw + ' kW'],
      ['Peak export', n.peakExportKw.toFixed(1) + ' kW', n.exportBreaches ? n.exportBreaches + ' breach(es)' : 'within ' + n.exportCapKw + ' kW'],
      ['Energy imported', n.importKwh.toFixed(1) + ' kWh', 'bought'],
      ['Energy exported', n.exportKwh.toFixed(1) + ' kWh', 'sold or spilled']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n" style="color:' +
      (/breach/.test(r[2]) ? '#ff5c5c' : '#8e98a5') + '">' + r[2] + '</td></tr>').join('');
  } catch (err) { refuse('out-net', err.message); tb.innerHTML = ''; }
}`
    },
    {
        stamp: '202609060218',
        slug: 'substation-growth',
        title: 'Substation Growth Workbench',
        sub: 'A NESO pathway applied to one substation, against its firm capacity',
        feature: 'National pathway growth taken down to a single site: today\'s demand grown by a stated multiple, converted to MVA at a stated power factor, and assessed against the substation\'s N-1 firm capacity rather than its nameplate.',
        engineModule: ['electrification-demand.js', 'firm-capacity.js'],
        engineCommit: '9a92211',
        schema: ['ventus-grid-engine.electrification-demand.v1', 'ventus-grid-engine.firm-capacity.v1'],
        checks: 56,
        panels: [
            {
                heading: '1 · THE NATIONAL PATHWAYS, AND WHY THEY DO NOT DIVIDE',
                lede: `NESO's three 2050 pathways published in FES 2025 Table 2. The load factor
                   column is measured from the published peak, not assumed. Read the third row before
                   using any of this: Hydrogen Evolution carries the <em>largest</em> annual demand and
                   a <em>lower</em> peak than Electric Engagement. There is no single national
                   multiplier, and there is no defensible rule that every site receives the same
                   percentage uplift. What follows is a stress test on one site, not a forecast for it.`,
                controls: [],
                tableId: 'path-table',
                tableHead: [{ label: 'FES 2025 pathway' }, { label: 'Annual', right: true },
                    { label: 'Average', right: true }, { label: 'Published peak', right: true }, { label: 'Load factor', right: true }]
            },
            {
                heading: '2 · THIS SUBSTATION, TODAY',
                lede: `The bank as built, and the demand it carries now. Firm capacity is what remains
                   with the largest unit out — it is the number that decides connections, and it is
                   invisible if you look only at the total.`,
                controls: [
                    { id: 'units', type: 'text', label: 'Transformer ratings (MVA, comma separated)', value: '30, 30' },
                    { id: 'mwnow', type: 'number', label: 'Present peak demand (MW)', value: '24', min: 0.1, max: 100000, step: 0.1 },
                    { id: 'pf', type: 'range', label: 'Power factor', value: '0.95', min: 0.70, max: 1.00, step: 0.01 }
                ],
                outId: 'out-today'
            },
            {
                heading: '3 · THE SAME SITE, GROWN',
                lede: `Apply a growth multiple and see where it lands. The multiple is yours to state
                   — a national pathway cannot tell you what happens behind one grid supply point,
                   because growth does not distribute evenly and the local answer depends on what
                   connects here.`,
                controls: [
                    { id: 'growth', type: 'range', label: 'Growth multiple on present demand', value: '1.75', min: 1.00, max: 4.00, step: 0.05 }
                ],
                outId: 'out-grown',
                tableId: 'grow-table',
                tableHead: [{ label: 'Measure' }, { label: 'Today', right: true }, { label: 'Grown', right: true }],
                note: `Passing this arithmetic is not ER P2/7 compliance, and exceeding it is not a
                   refusal: a real study counts transfer capacity from adjacent sites and permitted
                   interruption by group demand. What it does show is the moment a site stops being
                   N-1 secure, which is normally long before its nameplate looks stressed.`
            }
        ],
        script: `
const PATHWAYS = [
  { name: 'Holistic Transition', twh: 705, peak: 120 },
  { name: 'Electric Engagement', twh: 785, peak: 144 },
  { name: 'Hydrogen Evolution',  twh: 797, peak: 122 }
];

function bind() { ['units','mwnow','pf','growth'].forEach(id => el(id).addEventListener('input', render)); }
function parseUnits(raw) { return raw.split(',').map(s => s.trim()).filter(Boolean).map(Number); }

function render() {
  el('pf-val').textContent = num('pf').toFixed(2);
  el('growth-val').textContent = num('growth').toFixed(2) + 'x';

  document.querySelector('#path-table tbody').innerHTML = PATHWAYS.map(p => {
    const avg = E.averagePowerGw({ annualTwh: p.twh });
    const lf = E.loadFactorFromPeak({ averageGw: avg.value, peakGw: p.peak });
    return '<tr><td>' + p.name + '</td><td class="n">' + p.twh + ' TWh</td><td class="n">' +
      avg.value.toFixed(1) + ' GW</td><td class="n">' + p.peak + ' GW</td>' +
      '<td class="n" style="color:#00ffff">' + lf.value.toFixed(3) + '</td></tr>';
  }).join('');

  const tb = document.querySelector('#grow-table tbody');
  try {
    const units = parseUnits(el('units').value);
    const firm = E.firmCapacityMva({ units });
    const now = E.apparentPowerMva({ mw: num('mwnow'), powerFactor: num('pf') });
    const grown = E.apparentPowerMva({ mw: num('mwnow') * num('growth'), powerFactor: num('pf') });
    const a0 = E.assessAgainstFirm({ units, demandMva: now.value });
    const a1 = E.assessAgainstFirm({ units, demandMva: grown.value });

    el('out-today').innerHTML =
      '<div class="figure"><span class="q">today</span><span class="n' + (a0.withinFirm ? '' : ' over') + '">' +
      (a0.withinFirm ? 'WITHIN FIRM' : a0.withinInstalled ? 'BEYOND FIRM' : 'BEYOND INSTALLED') +
      '</span></div><p class="basis">' + a0.basis + '</p>';
    el('out-grown').innerHTML =
      '<div class="figure"><span class="q">at ' + num('growth').toFixed(2) + 'x</span><span class="n' +
      (a1.withinFirm ? '' : ' over') + '">' +
      (a1.withinFirm ? 'WITHIN FIRM' : a1.withinInstalled ? 'BEYOND FIRM' : 'BEYOND INSTALLED') +
      '</span></div><p class="basis">' + a1.basis + '</p>';

    tb.innerHTML = [
      ['Demand', now.value.toFixed(2) + ' MVA', grown.value.toFixed(2) + ' MVA'],
      ['Utilisation of installed', (a0.utilisationOfInstalled * 100).toFixed(1) + '%', (a1.utilisationOfInstalled * 100).toFixed(1) + '%'],
      ['Utilisation of firm', (a0.utilisationOfFirm * 100).toFixed(1) + '%', (a1.utilisationOfFirm * 100).toFixed(1) + '%'],
      ['Shortfall against firm', a0.shortfallMva.toFixed(2) + ' MVA', a1.shortfallMva.toFixed(2) + ' MVA'],
      ['N-1 secure', a0.withinFirm ? 'yes' : 'NO', a1.withinFirm ? 'yes' : 'NO']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n" style="color:' +
      (/NO|^[1-9]\\d*\\.\\d+ MVA$/.test(r[2]) && r[2] !== '0.00 MVA' ? '#ff5c5c' : '#8e98a5') + '">' + r[2] + '</td></tr>').join('');
  } catch (err) { refuse('out-today', err.message); tb.innerHTML = ''; }
}`
    },
    {
        stamp: '202609060236',
        slug: 'published-fault-level',
        title: 'Published Fault Level Workbench',
        sub: 'A figure may be carried only if it is published, dated and named by exact metric',
        feature: 'The estate\'s fault-level contract, made operable: paste a record and see exactly why it is accepted or refused. Opens refused, because the transmission product genuinely lacks a study basis today.',
        engineModule: 'published-fault-level.js',
        engineCommit: '7d40365',
        schema: 'ventus-grid-engine.published-fault-level.v1',
        checks: 41,
        panels: [
            {
                heading: '1 · THE RECORD',
                lede: `A fault level is not one number. Make against break, three-phase against
                   single-phase, and a DC offset set by X/R — NESO's ETYS Appendix D publishes
                   <em>eight</em> separately named currents for one busbar, and collapsing them into
                   a generic "fault level" is the error this contract exists to prevent. Edit the
                   record below and watch it be accepted or refused. <strong>It opens refused on
                   purpose:</strong> the study basis is empty, because the estate's pinned ETYS
                   artefact genuinely records no basis today. That is a real open item, not a
                   contrived demonstration.`,
                controls: [
                    { id: 'rec', type: 'text', label: 'Study basis (fill this to see the record accepted)', value: '' }
                ],
                outId: 'out-record'
            },
            {
                heading: '2 · QUOTING ONE NAMED METRIC',
                lede: `Once a record is accepted, a figure may be quoted — but only one named metric
                   at a time, with its unit, site, busbar, voltage, publisher, basis and date attached.
                   Nothing here will ever print the bare words "fault level".`,
                controls: [
                    { id: 'metric', type: 'text', label: 'Metric name', value: 'three_phase_rms_break_current_ka' }
                ],
                outId: 'out-quote',
                tableId: 'metric-table',
                tableHead: [{ label: 'Metric ETYS publishes' }, { label: 'Unit', right: true }],
                note: `The eight ETYS metric names are listed above exactly as data-grid-gb
                   normalises them. A generic name — <code>fault_level</code>, <code>scl</code>,
                   <code>maximum_fault_level</code> — is refused outright, because a reader cannot
                   tell which current it is and the wrong one against the wrong switchgear rating is
                   how a screening tool becomes a false connection assessment.`
            }
        ],
        script: `
// The real pinned artefact: NESO ETYS 2025 Appendix D peak-demand workbook, with
// the byte count and SHA-256 recorded in data-grid-gb chatgpt/sources.json, and
// the publication date verified against NESO's documents page on 2026-09-06.
// study_basis is deliberately EMPTY: the estate does not record one, so the page
// opens refused rather than inventing a plausible string.
const BASE = {
  provenance: {
    publisher: 'NESO',
    publication: 'ETYS 2025 Appendix D — peak demand fault current scenarios',
    source_url: 'https://www.neso.energy/document/383951/download',
    sha256: 'ad8b54fa0b0562c34295514c150f33913a92fc756ff140e0154d53c181363440',
    published_date: '2026-06-30',
    study_basis: ''
  },
  site: { name: 'EXAMPLE 400 kV substation', voltage_kv: 400, busbar: 'A' },
  metrics: {
    three_phase_rms_break_current_ka: { min: 31.2, max: 34.8 },
    three_phase_initial_peak_current_ka: { min: 78.4, max: 88.1 }
  }
};

function bind() { ['rec','metric'].forEach(id => el(id).addEventListener('input', render)); }

function render() {
  const input = JSON.parse(JSON.stringify(BASE));
  input.provenance.study_basis = el('rec').value.trim();

  // record() returns { ok, record, refused }. quote() takes the INNER record,
  // not the envelope -- passing the envelope returns null, silently, which is
  // exactly what the first version of this page did.
  const r = E.record(input);
  const ok = r && r.ok === true && r.record;
  el('out-record').innerHTML =
    '<div class="figure"><span class="q">record()</span><span class="n' + (ok ? '' : ' over') + '">' +
    (ok ? 'ACCEPTED' : 'REFUSED') + '</span></div>' +
    '<p class="basis">' + (ok
      ? 'Every required field is present: publisher, publication, source URL, SHA-256, an ISO date, a study basis, a named site and voltage, and metrics named by exact metric. ' + (E.CAVEAT || '')
      : 'Refused: <b>' + ((r && r.refused) || 'unknown reason') + '</b>. ' +
        'This is the contract working. A figure without its basis is not a measurement, it is a rumour.') +
    '</p>';

  const tb = document.querySelector('#metric-table tbody');
  tb.innerHTML = E.ETYS_METRICS.map(n => {
    const m = E.METRIC_LABELS[n];
    return '<tr><td style="font-size:10px">' + n + '<div style="color:#7f8996">' +
      (m ? m.label : '') + '</div></td><td class="n">' + (m ? m.unit : '?') + '</td></tr>';
  }).join('');

  if (!ok) {
    el('out-quote').innerHTML = '<p class="basis" style="border:0;padding:0;margin:0">' +
      'No quotation: the record was refused, so there is nothing here that may be printed.</p>';
    return;
  }
  try {
    const name = el('metric').value.trim();
    const q = E.quote(r.record, name);
    el('out-quote').innerHTML = q === null || q === undefined
      ? '<div class="figure"><span class="q">quote()</span><span class="n over">NOT QUOTED</span></div>' +
        '<p class="basis">The engine will not quote <b>' + name + '</b> from this record. Either the ' +
        'record does not carry that metric, or the name is a generic one the contract refuses. ' +
        'Try one of the exact names in the table below.</p>'
      : '<div class="figure"><span class="q">quote()</span><span class="n" style="font-size:14px;line-height:1.4">' +
        (typeof q === 'string' ? q : JSON.stringify(q)) + '</span></div>' +
        '<p class="basis">' + (E.NO_HEADROOM || '') + '</p>';
  } catch (err) {
    el('out-quote').innerHTML = '<p class="basis" style="color:#ffae00;border:0;padding:0;margin:0">' +
      'Engine refused this metric: ' + err.message + '</p>';
  }
}`
    },
    {
        stamp: '202609060237',
        slug: 'corridor-estimate',
        title: 'Corridor Estimate Workbench',
        sub: 'The straight-line first pass, and the one multiplier that is allowed to touch it',
        feature: 'The calibrated straight-line-to-corridor factor for cable circuits, with the calibration sample, the error distribution, and the minimum separation below which it refuses to answer at all.',
        engineModule: 'corridor-estimate.js',
        engineCommit: '7d40365',
        schema: 'gridatlas.module.corridor-estimate.v1',
        checks: 15,
        panels: [
            {
                heading: '1 · STRAIGHT LINE TO CORRIDOR',
                lede: `A straight line is not a route. Buried cable circuits follow the highway
                   network, and across 95 published GB transmission cable circuits that detour
                   measures a factor of <strong>1.245</strong>. This is the estate's first pass and it
                   stays exactly as it is — everything else built tonight is additive to it.`,
                controls: [
                    { id: 'km', type: 'number', label: 'Straight-line distance (km)', value: '10', min: 0, max: 2000, step: 0.01 }
                ],
                outId: 'out-corridor'
            },
            {
                heading: '2 · WHERE IT REFUSES, AND WHY THAT MATTERS MORE',
                lede: `Below about a kilometre the factor is not measuring route detour at all — it is
                   measuring the distance between two site centroids, and the median error rises to
                   52.5%. So it returns <em>null</em>, not zero and not a small number. A tool that
                   answers everything cannot be trusted on anything.`,
                controls: [],
                tableId: 'basis-table',
                tableHead: [{ label: 'Calibration' }, { label: 'Value', right: true }],
                note: `The factor is calibrated on cable, which follows roads. Overhead line crosses
                   open country and measures 1.13 — published here only so a reader can see why the
                   cable factor is the wrong model for an overhead question. There is deliberately no
                   forOverhead().`
            }
        ],
        script: `
function bind() { el('km').addEventListener('input', render); }

function render() {
  const km = num('km');
  // forCable returns { km, factor, straight_km, withheld }. Below the minimum
  // separation it returns an OBJECT whose km is null and whose withheld says
  // why; only a zero distance returns null outright. Calling toFixed on that
  // null is what left this page showing a stale figure.
  const r = E.forCable(km);
  const value = r && r.km;
  el('out-corridor').innerHTML = (value === null || value === undefined)
    ? '<div class="figure"><span class="q">corridor estimate</span><span class="n over">NO ESTIMATE</span></div>' +
      '<p class="basis">' + ((r && r.withheld) || 'No distance given, so there is nothing to estimate.') + '</p>'
    : '<div class="figure"><span class="q">corridor estimate</span><span class="n">' +
      value.toFixed(2) + '</span><span class="u">km</span></div><p class="basis">' +
      'A straight line of ' + r.straight_km + ' km, multiplied by the calibrated cable factor of ' +
      r.factor + '. ' + E.CAVEAT + '</p>';

  const b = E.BASIS;
  document.querySelector('#basis-table tbody').innerHTML = [
    ['Cable factor', E.CABLE_FACTOR],
    ['Overhead factor (not applied here)', E.OHL_FACTOR],
    ['Circuits in the sample', b.circuits],
    ['Distinct site pairs', b.distinct_site_pairs],
    ['Median absolute error', b.median_absolute_error_pct + '%'],
    ['Within 15%', b.within_15_pct + '%'],
    ['Minimum separation', b.minimum_separation_km + ' km']
  ].map(r2 => '<tr><td>' + r2[0] + '</td><td class="n">' + r2[1] + '</td></tr>').join('') +
    '<tr><td colspan="2" style="font-size:10px;color:#7f8996">' + b.sample_note + '</td></tr>';
}`
    },
    {
        stamp: '202609060238',
        slug: 'site-geometry',
        title: 'Site Geometry Workbench',
        sub: 'Distance, bearing, area and perimeter on the one geodesy the estate agrees on',
        feature: 'Great-circle distance and bearing between two points, and polygon area, perimeter and circle-cap area for a site boundary — computed by the same geodesy every map in the estate uses.',
        engineModule: ['v9-geodesy.js', 'geo-area.js'],
        engineCommit: '7d40365',
        schema: ['gridatlas.module.geodesy.v1', null],
        checks: 23,
        panels: [
            {
                heading: '1 · TWO POINTS',
                lede: `Great-circle distance and initial bearing, in (longitude, latitude) order — the
                   order the estate standardised on after mixing it up cost a day. The radius is
                   6378.137 km, the equatorial figure the Atlas uses; the estate also carries a UK
                   figure and a mean figure, and which one is correct depends on the question.`,
                controls: [
                    { id: 'lon1', type: 'number', label: 'From longitude', value: '-1.4', min: -180, max: 180, step: 0.0001 },
                    { id: 'lat1', type: 'number', label: 'From latitude', value: '52.5', min: -90, max: 90, step: 0.0001 },
                    { id: 'lon2', type: 'number', label: 'To longitude', value: '-0.9', min: -180, max: 180, step: 0.0001 },
                    { id: 'lat2', type: 'number', label: 'To latitude', value: '53.1', min: -90, max: 90, step: 0.0001 }
                ],
                outId: 'out-distance'
            },
            {
                heading: '2 · A SITE BOUNDARY',
                lede: `Paste a closed boundary as <code>lon,lat</code> pairs separated by semicolons.
                   Area and perimeter are computed on the sphere, not on a flat projection — at UK
                   latitudes a planar approximation of a large site is wrong by enough to matter to a
                   land agreement.`,
                controls: [
                    { id: 'poly', type: 'text', label: 'Boundary (lon,lat; lon,lat; …)', value: '-1.40,52.50; -1.39,52.50; -1.39,52.51; -1.40,52.51' }
                ],
                outId: 'out-area',
                tableId: 'geo-table',
                tableHead: [{ label: 'Measure' }, { label: 'Value', right: true }],
                note: `A circle-cap area is given alongside for comparison: it is the area within a
                   radius on the sphere, which is what a "within X km" search actually covers and is
                   noticeably larger than πr² once the radius is big.`
            }
        ],
        script: `
function bind() { ['lon1','lat1','lon2','lat2','poly'].forEach(id => el(id).addEventListener('input', render)); }
function parsePoly(raw) {
  return raw.split(';').map(s => s.trim()).filter(Boolean).map(pair => {
    const [a, b] = pair.split(',').map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('cannot read point "' + pair + '"');
    return [a, b];
  });
}

function render() {
  try {
    const km = E.distanceKm(num('lon1'), num('lat1'), num('lon2'), num('lat2'));
    const brg = E.initialBearingDeg(num('lon1'), num('lat1'), num('lon2'), num('lat2'));
    el('out-distance').innerHTML =
      '<div class="figure"><span class="q">great-circle distance</span><span class="n">' +
      km.toFixed(3) + '</span><span class="u">km · bearing ' + brg.toFixed(1) + '°</span></div>' +
      '<p class="basis">Computed on a sphere of radius ' + E.EARTH_RADIUS_KM +
      ' km in (longitude, latitude) order. A straight line between two points is a measurement; ' +
      'it is not a route and it is not a cable length.</p>';
  } catch (err) { refuse('out-distance', err.message); }

  const tb = document.querySelector('#geo-table tbody');
  try {
    const pts = parsePoly(el('poly').value);
    if (pts.length < 3) throw new Error('a boundary needs at least three points');
    // polygonAreaKm2 and circleCapAreaKm2 return a whole set of units, not a
    // bare number: { areaKm2, areaM2, areaHa, areaAc, areaMi2, perimKm,
    // pitches }. Reading them as numbers threw, and the page said so rather
    // than showing a stale figure.
    const area = E.polygonAreaKm2(pts);
    const perimKm = E.polylinePerimeterKm(pts, true);
    const cap1 = E.circleCapAreaKm2(1);
    const cap50 = E.circleCapAreaKm2(50);
    el('out-area').innerHTML =
      '<div class="figure"><span class="q">site area</span><span class="n">' +
      area.areaHa.toFixed(2) + '</span><span class="u">hectares · ' +
      area.areaAc.toFixed(1) + ' acres · ' + area.areaKm2.toFixed(5) + ' km²</span></div>' +
      '<p class="basis">Spherical area of a closed boundary of ' + pts.length + ' points, on a ' +
      'sphere rather than a flat projection. At UK latitudes a planar approximation of a large ' +
      'site is wrong by enough to matter to a land agreement.</p>';
    tb.innerHTML = [
      ['Boundary points', pts.length],
      ['Area', area.areaKm2.toFixed(6) + ' km²'],
      ['Area', area.areaHa.toFixed(3) + ' ha'],
      ['Area', area.areaAc.toFixed(2) + ' acres'],
      ['Area, in football pitches', area.pitches.toFixed(1)],
      ['Perimeter (closed)', perimKm.toFixed(4) + ' km'],
      ['Within 1 km — spherical cap', cap1.areaKm2.toFixed(5) + ' km²'],
      ['Within 1 km — flat πr², for comparison', Math.PI.toFixed(5) + ' km²'],
      ['Within 50 km — spherical cap', cap50.areaKm2.toFixed(2) + ' km²'],
      ['Within 50 km — flat πr², for comparison', (Math.PI * 2500).toFixed(2) + ' km²'],
      ['Difference at 50 km', ((Math.PI * 2500 - cap50.areaKm2) / cap50.areaKm2 * 100).toFixed(3) + '%']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>').join('');
  } catch (err) { refuse('out-area', err.message); tb.innerHTML = ''; }
}`
    },
    {
        stamp: '202609060305',
        slug: 'interconnectors',
        title: 'Interconnector Workbench',
        sub: 'An edge between two systems, priced — in text, and deliberately never drawn',
        feature: 'The GB interconnector fleet as text against electricity prices: which way a link flows at a stated spread, the energy it moves, the gross congestion rent, and the 10.3 GW that is observable separated from the 7.65 GW that is still a plan.',
        engineModule: 'interconnector-economics.js',
        engineCommit: 'a3a5e23',
        schema: 'ventus-grid-engine.interconnector-economics.v1',
        checks: 38,
        panels: [
            {
                heading: '1 · WHICH WAY, AND WHAT IT IS WORTH',
                lede: `An interconnector generates nothing. It moves what the exporting system's plant
                   produced, from wherever energy is cheaper to wherever it is dearer — so the
                   direction follows the price spread and nothing else. Set both prices. They travel
                   back with the answer, because a direction quoted without the prices that produced
                   it is an opinion.`,
                controls: [
                    { id: 'gbp', type: 'number', label: 'GB price (£/MWh)', value: '92', min: -500, max: 5000, step: 0.5 },
                    { id: 'nbp', type: 'number', label: 'Neighbour price (£/MWh)', value: '58', min: -500, max: 5000, step: 0.5 },
                    { id: 'cap', type: 'number', label: 'Link capacity (GW)', value: '1.4', min: 0.01, max: 10, step: 0.01 },
                    { id: 'util', type: 'range', label: 'Utilisation', value: '0.55', min: 0.05, max: 1.00, step: 0.01 },
                    { id: 'hrs', type: 'number', label: 'Hours', value: '8760', min: 1, max: 8784, step: 1 }
                ],
                outId: 'out-flow'
            },
            {
                heading: '2 · THE ENERGY AND THE RENT',
                lede: `Congestion rent is the energy moved multiplied by the price difference it is
                   moved across. It is the <strong>gross</strong> value of the arbitrage — before
                   losses, before outages, before operating cost and before any cap-and-floor
                   arrangement. It is not profit and nothing here calls it profit.`,
                controls: [],
                outId: 'out-rent',
                tableId: 'rent-table',
                tableHead: [{ label: 'Measure' }, { label: 'Value', right: true }]
            },
            {
                heading: '3 · THE FLEET, AND WHAT IS ACTUALLY OBSERVABLE',
                lede: `Sixteen links. Ten carry a BMRS code, so their flow appears in published data
                   and can be checked. Six have no code because they are not built — their capacity is
                   a plan. Adding the two numbers together is the easiest way to overstate the fleet,
                   so they are kept apart here.`,
                controls: [],
                outId: 'out-fleet',
                tableId: 'fleet-table',
                tableHead: [
                    { label: 'Link' }, { label: 'Country' }, { label: 'GW', right: true }, { label: 'Flow data', right: true }
                ],
                note: `<strong>No map.</strong> Subsea cable routes are licensed — TeleGeography is the
                   usual source and it is not ours to redraw — and neither NESO nor National Grid
                   publishes a route the estate could carry instead. So the estate does not draw these
                   cables, and the engine holds no coordinates at all; its proof asserts that no export
                   carries one. That is a licensing position stated where a reader will look, not a
                   missing feature for somebody to fill in later from a screenshot.`
            }
        ],
        script: `
// reference/interconnector_cables.csv in data-interconnectors, carried as text.
const FLEET = [
  { bmrsCode:'INTFR',   country:'France',           name:'IFA',                      capacityGw:2.0, status:'operational' },
  { bmrsCode:'INTIFA2', country:'France',           name:'IFA2',                     capacityGw:1.0, status:'operational' },
  { bmrsCode:'INTELEC', country:'France',           name:'ElecLink',                 capacityGw:1.0, status:'operational' },
  { bmrsCode:'INTNED',  country:'Netherlands',      name:'BritNed',                  capacityGw:1.0, status:'operational' },
  { bmrsCode:'INTNEM',  country:'Belgium',          name:'Nemo Link',                capacityGw:1.0, status:'operational' },
  { bmrsCode:'INTNSL',  country:'Norway',           name:'North Sea Link',           capacityGw:1.4, status:'operational' },
  { bmrsCode:'INTVKL',  country:'Denmark',          name:'Viking Link',              capacityGw:1.4, status:'operational' },
  { bmrsCode:'INTEW',   country:'Ireland',          name:'East West Interconnector', capacityGw:0.5, status:'operational' },
  { bmrsCode:'INTGRNL', country:'Ireland',          name:'Greenlink',                capacityGw:0.5, status:'operational' },
  { bmrsCode:'INTIRL',  country:'Northern Ireland', name:'Moyle',                    capacityGw:0.5, status:'operational' },
  { bmrsCode:'',        country:'Germany',          name:'NeuConnect',               capacityGw:1.4, status:'future' },
  { bmrsCode:'',        country:'Germany',          name:'Tarchon Energy',           capacityGw:1.4, status:'future' },
  { bmrsCode:'',        country:'Netherlands',      name:'LionLink',                 capacityGw:2.0, status:'future' },
  { bmrsCode:'',        country:'Belgium',          name:'Nautilus',                 capacityGw:1.4, status:'future' },
  { bmrsCode:'',        country:'Ireland',          name:'MaresConnect',             capacityGw:0.75, status:'future' },
  { bmrsCode:'',        country:'Northern Ireland', name:'LirIC',                    capacityGw:0.7, status:'future' }
];

function bind() { ['gbp','nbp','cap','util','hrs'].forEach(id => el(id).addEventListener('input', render)); }

function render() {
  el('util-val').textContent = num('util').toFixed(2);
  let dir = null;
  try {
    dir = E.flowDirection({ gbPriceGbpPerMwh: num('gbp'), neighbourPriceGbpPerMwh: num('nbp') });
    el('out-flow').innerHTML =
      '<div class="figure"><span class="q">commercial flow direction</span><span class="n" style="font-size:19px">' +
      dir.direction.toUpperCase() + '</span><span class="u">spread £' + dir.spreadGbpPerMwh.toFixed(2) + '/MWh</span></div>' +
      '<p class="basis">' + dir.basis + '</p>';
  } catch (err) { refuse('out-flow', err.message); }

  const rt = document.querySelector('#rent-table tbody');
  try {
    const energy = E.energyTransferredGwh({ capacityGw: num('cap'), hours: num('hrs'), utilisation: num('util') });
    if (!dir || dir.spreadGbpPerMwh === 0) {
      el('out-rent').innerHTML = '<p class="basis" style="border:0;padding:0;margin:0">' +
        'No spread, so no arbitrage value. The link may still flow for system reasons this engine does not model.</p>';
      rt.innerHTML = '<tr><td>Energy moved</td><td class="n">' + energy.value.toFixed(1) + ' GWh</td></tr>';
    } else {
      const rent = E.congestionRentGbp({ capacityGw: num('cap'), hours: num('hrs'),
        utilisation: num('util'), spreadGbpPerMwh: dir.spreadGbpPerMwh });
      el('out-rent').innerHTML =
        '<div class="figure"><span class="q">gross congestion rent</span><span class="n">£' +
        (rent.value/1e6).toFixed(2) + 'm</span></div><p class="basis">' + rent.basis + '</p>';
      const share = E.shareOfDemand({ transferGw: num('cap') * num('util'), gbDemandGw: 34.2 });
      rt.innerHTML = [
        ['Energy moved', energy.value.toLocaleString('en-GB',{maximumFractionDigits:0}) + ' GWh'],
        ['Spread', '£' + dir.spreadGbpPerMwh.toFixed(2) + '/MWh'],
        ['Gross rent', '£' + rent.value.toLocaleString('en-GB',{maximumFractionDigits:0})],
        ['Average transfer', (num('cap') * num('util')).toFixed(2) + ' GW'],
        ['Share of a 34.2 GW mean demand', share.percent.toFixed(1) + '%']
      ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>').join('');
    }
  } catch (err) { refuse('out-rent', err.message); rt.innerHTML = ''; }

  try {
    const f = E.fleetCapacity({ links: FLEET });
    el('out-fleet').innerHTML =
      '<div class="figure"><span class="q">fleet capacity</span><span class="n">' +
      f.value.toFixed(2) + '</span><span class="u">GW · ' + f.observableGw.toFixed(2) +
      ' observable, ' + f.unobservableGw.toFixed(2) + ' planned</span></div>' +
      '<p class="basis">' + f.basis + '</p>';
    document.querySelector('#fleet-table tbody').innerHTML = FLEET.map(l =>
      '<tr><td>' + l.name + '</td><td>' + l.country + '</td><td class="n">' + l.capacityGw.toFixed(2) +
      '</td><td class="n" style="color:' + (l.bmrsCode ? '#00ff88' : '#8e98a5') + '">' +
      (l.bmrsCode ? l.bmrsCode : 'no code yet') + '</td></tr>').join('');
  } catch (err) { refuse('out-fleet', err.message); }
}`
    },
    {
        stamp: '202609060309',
        slug: 'power-factor',
        title: 'Power Factor Workbench',
        sub: 'Capacity released without building anything',
        feature: 'Reactive power, apparent power, and the correction that moves a site from one power factor to another — with the connection capacity that releases, and the agreed capacity it may let you fit inside.',
        engineModule: 'power-factor.js',
        engineCommit: 'd1b459c',
        schema: 'ventus-grid-engine.power-factor.v1',
        checks: 33,
        panels: [
            {
                heading: '1 · THE LOAD AS THE PLANT SEES IT',
                lede: `A load does not present kilowatts to a transformer, it presents kilovolt-amperes.
                   Reactive power does no work, but it is carried by the same conductors and occupies
                   the same rating as the real power beside it. That is why a site can be well inside
                   its kW and outside its agreed capacity.`,
                controls: [
                    { id: 'kw', type: 'number', label: 'Real power (kW)', value: '1000', min: 1, max: 500000, step: 1 },
                    { id: 'pf0', type: 'range', label: 'Present power factor', value: '0.85', min: 0.50, max: 1.00, step: 0.01 }
                ],
                outId: 'out-now'
            },
            {
                heading: '2 · THE CORRECTION, AND WHAT IT GIVES BACK',
                lede: `Correction supplies the reactive power locally instead of drawing it across the
                   network. The site consumes exactly the same energy afterwards and occupies less of
                   its connection. <strong>Do not aim at unity:</strong> the last few percent costs
                   disproportionately, and a fixed bank sized for full load will over-correct at part
                   load — at which point the site can be charged for exporting reactive power instead.`,
                controls: [
                    { id: 'pf1', type: 'range', label: 'Target power factor', value: '0.98', min: 0.60, max: 1.00, step: 0.01 }
                ],
                outId: 'out-correction',
                tableId: 'pf-table',
                tableHead: [{ label: 'Measure' }, { label: 'Before', right: true }, { label: 'After', right: true }]
            },
            {
                heading: '3 · AGAINST YOUR AGREED CAPACITY',
                lede: `The figure in your connection agreement, which is commercial and is yours to
                   type in — nothing here infers it. Watch what happens to the same load at the two
                   power factors above.`,
                controls: [
                    { id: 'agreed', type: 'number', label: 'Agreed capacity (kVA)', value: '1100', min: 1, max: 500000, step: 1 }
                ],
                outId: 'out-agreed',
                note: `A ratio of two numbers you supplied. It is not a connection assessment: the
                   binding constraint may be the upstream circuit, the fault level at the busbar, or a
                   position in a queue, none of which appear in this arithmetic.`
            }
        ],
        script: `
function bind() { ['kw','pf0','pf1','agreed'].forEach(id => el(id).addEventListener('input', render)); }

function render() {
  el('pf0-val').textContent = num('pf0').toFixed(2);
  el('pf1-val').textContent = num('pf1').toFixed(2);
  const kw = num('kw'), pf0 = num('pf0'), pf1 = num('pf1');

  try {
    const s = E.apparentPowerKva({ kw, powerFactor: pf0 });
    const q = E.reactivePowerKvar({ kw, powerFactor: pf0 });
    el('out-now').innerHTML =
      '<div class="figure"><span class="q">as the plant sees it</span><span class="n">' +
      s.value.toFixed(1) + '</span><span class="u">kVA · ' + q.value.toFixed(1) + ' kVAr reactive</span></div>' +
      '<p class="basis">' + q.basis + '</p>';
  } catch (err) { refuse('out-now', err.message); }

  const tb = document.querySelector('#pf-table tbody');
  try {
    const c = E.correctionKvar({ kw, fromPowerFactor: pf0, toPowerFactor: pf1 });
    el('out-correction').innerHTML =
      '<div class="figure"><span class="q">correction required</span><span class="n">' +
      c.value.toFixed(1) + '</span><span class="u">kVAr · releases ' + c.capacityReleasedKva.toFixed(1) +
      ' kVA (' + c.capacityReleasedPercent.toFixed(1) + '%)</span></div>' +
      '<p class="basis">' + c.basis + '</p>';
    tb.innerHTML = [
      ['Power factor', pf0.toFixed(2), pf1.toFixed(2)],
      ['Real power', kw.toFixed(0) + ' kW', kw.toFixed(0) + ' kW'],
      ['Reactive power', c.reactiveBeforeKvar.toFixed(1) + ' kVAr', c.reactiveAfterKvar.toFixed(1) + ' kVAr'],
      ['Apparent power', c.apparentBeforeKva.toFixed(1) + ' kVA', c.apparentAfterKva.toFixed(1) + ' kVA']
    ].map(r => '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td><td class="n" style="color:#00ff88">' + r[2] + '</td></tr>').join('');
  } catch (err) {
    refuse('out-correction', err.message);
    tb.innerHTML = '';
  }

  try {
    const before = E.againstAgreedCapacity({ kw, powerFactor: pf0, agreedKva: num('agreed') });
    let after = null;
    try { after = E.againstAgreedCapacity({ kw, powerFactor: pf1, agreedKva: num('agreed') }); } catch (e) {}
    el('out-agreed').innerHTML =
      '<div class="figure"><span class="q">at ' + pf0.toFixed(2) + '</span><span class="n' +
      (before.exceeds ? ' over' : '') + '">' + before.percent.toFixed(1) + '%</span>' +
      (after ? '<span class="u">→ at ' + pf1.toFixed(2) + ': ' + after.percent.toFixed(1) + '%' +
        (before.exceeds && !after.exceeds ? ' — now inside it' : '') + '</span>' : '') +
      '</div><p class="basis">' + before.basis + '</p>';
  } catch (err) { refuse('out-agreed', err.message); }
}`
    }
];
