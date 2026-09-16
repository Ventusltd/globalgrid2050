// Pilot by typing anything, with no model: plain words are matched to commands by rules the page can show you.
// plan(sentence, ctx) → { commands: [...], because: '...' }   ctx = { appNames: [...], dies: [...] }
function plan(sentence, ctx) {
  const t = sentence.replace(/Ω/g, ' ohm').toLowerCase(); const out = [];
  const num = re => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
  const appNames = (ctx && ctx.appNames) || []; const DIES = (ctx && ctx.dies) || [];
  const appHit = appNames.find(n => t.includes(n)) || (t.includes('atlas') ? 'gridatlas' : null);
  const dieHit = t.includes('substation') ? 'substation' : t.includes('sld') ? 'sld-sandbox' : /\bsearch\b/.test(t) ? 'search' : /(bridge|parquet)/.test(t) ? 'bridge' : DIES.find(d => t.includes(d.split('-')[0])) || null;
  const wantArrange = /(arrange|re-?arrange|layout|lay out|as a cpu|floorplan|floor plan|\brings?\b|\bgrid\b|sector|by app)/.test(t);

  const earthNames = ['spider sandbox', 'periodic table', 'gridatlas', 'pipelinenews', 'pipeline news', 'globalgrid2050', 'grid-dictionary', 'spiders', 'star-solar-star', 'code-generator', 'testcode', 'galaxies-wafers', 'ventus-grid-engine', 'stars'];
  if (/\b(back to space|to space|space)\b/.test(t) && !/\bland\b/.test(t)) return { commands: ['space'], because: 'back to the wafer' };
  if (/\b(land|land on|take me to|go down to|visit|open|show me the app)\b/.test(t)) { const e = earthNames.find(n => t.includes(n)); if (e) return { commands: [`land ${e.replace('pipeline news', 'pipelinenews')}`], because: 'down to the live app' }; }
  if (/\bplasma\b/.test(t)) out.push('plasma');
  if (/\b(lightning|strike)\b/.test(t)) out.push(`lightning ${appHit || 'gridatlas'}`);

  if (/(voltage drop|volt drop|vdrop)/.test(t)) {
    const A = num(/(\d+(?:\.\d+)?)\s*(?:amps?\b|a\b)/), L = num(/(\d+(?:\.\d+)?)\s*(?:metres?|meters?|m\b)/), R = num(/(\d+(?:\.\d+)?)\s*(?:ohms?|Ω)/);
    let pf = num(/(?:pf|power factor)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/) ?? num(/(\d+(?:\.\d+)?)\s*%\s*(?:pf|power factor)/); if (pf != null) pf = pf / 100; if (pf == null) pf = num(/(?:pf|power factor)\s*(?:of\s*)?(\d?\.?\d+)/) ?? num(/(\d?\.?\d+)\s*(?:pf|power factor)/);
    const X = num(/(?:reactance|x)\s*(?:of\s*)?(\d+(?:\.\d+)?)/);
    const ph = /single/.test(t) ? 'single' : 'three';
    const missing = [A == null && 'current in A', L == null && 'length in m', R == null && 'resistance in ohm/km', pf == null && 'power factor'].filter(Boolean);
    if (missing.length) return { commands: [], because: `voltage drop needs: ${missing.join(', ')} (say e.g. 120 A, 250 m, 0.32 ohm/km, pf 0.95)` };
    out.push(`run voltage-drop.voltageDropVolts ${JSON.stringify(X != null ? { currentA: A, lengthM: L, resistanceOhmPerKm: R, reactanceOhmPerKm: X, powerFactor: pf, phases: ph } : { currentA: A, lengthM: L, resistanceOhmPerKm: R, powerFactor: pf, phases: ph })}`);
  } else if (/(diversif|houses|dwellings|units)/.test(t) && /\bk(w|va)\b/.test(t)) {
    const n = num(/(\d+)\s*(?:houses|dwellings|units)/), kw = num(/(\d+(?:\.\d+)?)\s*k(?:w|va)\b/), cf = num(/(?:coincidence|diversity)\s*(?:factor\s*)?(?:of\s*)?(\d?\.\d+)/);
    if (n == null || kw == null || cf == null) return { commands: [], because: 'diversified demand needs: number of houses, kW each, coincidence factor' };
    out.push(`run diversified-demand.diversifiedDemandKw ${JSON.stringify({ unitCount: n, perUnitKw: kw, coincidenceFactor: cf })}`);
  }

  if (/(entangle|\btwin|coupl)/.test(t)) out.push('entangle');
  const key = num(/(?:read|block|key|fly to|go to|twin|state|qubit|measure)\s+(\d{1,7})\b/) ?? (/(voltage|amp|metre|meter|ohm|houses|kw|kva)/.test(t) ? null : num(/\b(\d{2,7})\b/));
  if (/(\bread\b|show me the code|the real line)/.test(t) && key != null) out.push(`read ${key}`);
  else if (/(fly to|go to|\bblock\b|\bkey\b)/.test(t) && key != null) out.push(`block ${key}`);
  if (/\b(seed|grow)\b/.test(t)) out.push(`seed ${sentence.replace(/^.*?\b(seed|grow)\b\s*/i, '') || sentence}`);
  if (/\b(twin)\b/.test(t) && key != null) out.push(`twin ${key}`); if (/\b(qubit)\b/.test(t) && key != null) out.push(`qubit ${key}`); if (/\b(measure)\b/.test(t) && key != null) out.push(`measure ${key}`);
  if (/(versions|history|\bclock\b|over time)/.test(t)) out.push(/\b(run|play|all)\b/.test(t) ? 'clock run' : 'versions');
  if (/\b(explode|blow)\b/.test(t)) out.push('explode');
  if (/\b(implode|come back)\b/.test(t)) out.push('implode');
  if (/\bhome\b/.test(t)) out.push('home');
  if (/(engine|calculations?|modules?)/.test(t) && /\b(list|show|what)\b/.test(t)) out.push('engine');
  if (/\b(apps|applications)\b/.test(t) && /\b(list|show|what|which)\b/.test(t)) out.push('apps');
  if (dieHit && !out.some(c => c.startsWith('lightning'))) out.push(`die ${dieHit}`);
  else if (appHit && !out.some(c => /^(lightning|plasma)/.test(c))) out.push(appHit === 'gridatlas' && /\batlas\b/.test(t) && !t.includes('gridatlas') ? 'light atlas' : `app ${appHit}`);
  if (wantArrange) out.push(`arrange ${/(floorplan|floor plan|cpu)/.test(t) ? 'floorplan' : /\brings?\b/.test(t) ? 'rings' : /\bgrid\b/.test(t) ? 'grid' : /(app|sector)/.test(t) ? 'apps' : 'time'}`);
  if (/(\breset\b|start again|\bclear\b)/.test(t)) out.push('reset');

  if (!out.length) return { commands: [], because: 'no command matched; try words like: atlas, app <name>, plasma, lightning, arrange floorplan, voltage drop 120 A 250 m 0.32 ohm pf 0.95, read <key>, entangle' };
  return { commands: [...new Set(out)], because: 'matched by words and numbers in your sentence' };
}
if (typeof module !== 'undefined') module.exports = { plan };
