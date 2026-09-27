// cmd-grammar-trench.mjs: the trench and cable words of the command line (trench, cable, load, xray), split out of
// cmd-grammar.mjs to keep each cartridge under 400 lines. Pure: parse() hands each verb here with its words and helpers.

// Typed settings for the block's trenches sized by rating (cmd-trench.mjs), checked like the grammar's KEYS.
export const TRENCH_KEYS_TYPED = Object.freeze({
  soil: { label: 'soil thermal resistivity', unit: 'K.m/W', min: 0.5, max: 3.5 },
  load: { label: 'load profile', choices: ['continuous', 'solar-day'] },
  splitDc: { label: 'DC trenches side by side', unit: '', min: 0, max: 6, int: true },
  splitBranch: { label: 'AC branch trenches side by side', unit: '', min: 0, max: 6, int: true },
  splitCollector: { label: 'collector trenches side by side', unit: '', min: 0, max: 6, int: true },
  splitMv: { label: '33 kV trenches side by side', unit: '', min: 0, max: 6, int: true },
  coverDc: { label: 'DC cover', unit: 'm', min: 0.3, max: 2 },
  coverLv: { label: 'LV AC cover', unit: 'm', min: 0.3, max: 2 },
  coverMv: { label: '33 kV cover', unit: 'm', min: 0.3, max: 2 },
  drumM: { label: 'cable drum length', unit: 'm', min: 100, max: 3000 },
  ring: { label: '33 kV ring rating case', choices: ['n-1', 'normal'] }
});
/** trench split <kind> N and trench cover <kind> N: the kind named and the setting it sets. */
export const SPLIT_KINDS = Object.freeze({ dc: 'splitDc', branch: 'splitBranch', collector: 'splitCollector', mv: 'splitMv' });
export const COVER_KINDS = Object.freeze({ dc: 'coverDc', lv: 'coverLv', ac: 'coverLv', mv: 'coverMv' });

export const TRENCH_COMMANDS = Object.freeze([
  { verb: 'trench', usage: 'trench depth 1.1  ·  trench width 0.6  ·  trench ac trefoil|flat  ·  trench design  ·  trench split collector 4'
    + '  ·  trench cover dc 0.91  ·  trench drum 800  ·  trench ring n-1|normal',
    words: 'cable trench cover containment sized rating width options side by side drum joint ring outage' },
  { verb: 'cable', usage: 'cable 400 al  ·  cable rate 400 al 28 circuits  ·  cable rate 400 al 28 circuits pitch 0.25',
    words: 'conductor size aluminium copper rating ampacity grouping current' },
  { verb: 'load', usage: 'load continuous  ·  load solar-day', words: 'load profile cyclic daily solar day rating loss factor' },
  { verb: 'xray', usage: 'xray on  ·  xray off', words: 'x-ray as built buried see through ground trenches ducts cables backfill' }
]);
export const TRENCH_VOCAB = Object.freeze({
  trench: ['depth', 'width', 'ac', 'trefoil', 'flat', 'design', 'split', 'cover', 'dc', 'lv', 'mv', 'branch', 'collector', 'drum', 'ring', 'n-1', 'normal'],
  cable: ['al', 'cu', 'rate', 'circuits', 'circuit', 'pitch', 'lv', 'mv', 'dc'], load: ['continuous', 'solar-day'], xray: ['on', 'off'] });

const isNum = t => t && typeof t === 'object' && Number.isFinite(t.n);

/** parseTrench(v, rest, out, { has, after, num, put, bad, guard }): fills out.set / out.act / out.arg, or pushes refusals on bad. */
export function parseTrench(v, rest, out, { has, after, num, put, bad, guard }) {
  if (v === 'trench') {
    if (has('design')) { out.act = 'trench-design'; return; }
    if (has('split')) {
      const k = Object.keys(SPLIT_KINDS).find(w => has(w));
      if (!k) bad.push(`trench split names the kind: trench split collector 4 (${Object.keys(SPLIT_KINDS).join(', ')}; 0 lets the rating choose)`);
      else num(rest.indexOf(k) + 1, SPLIT_KINDS[k]);
      out.act = 'trench-design'; return;
    }
    if (has('cover')) {
      const k = ['dc', 'lv', 'mv', 'ac'].find(w => has(w));
      if (!k) bad.push('trench cover names the kind: trench cover dc 0.91 (dc, lv or mv)');
      else num(rest.indexOf(k) + 1, COVER_KINDS[k], ['m']);
      out.act = 'trench-design'; return;
    }
    if (has('drum')) { num(after('drum'), 'drumM', ['m']); out.act = 'trench-design'; return; }
    if (has('ring')) {
      const w = rest.find(x => x === 'n-1' || x === 'normal');
      if (w) put('ring', w); else bad.push('trench ring is n-1 (rated with one ring end out) or normal');
      out.act = 'trench-design'; return;
    }
    if (after('depth') > 0) num(after('depth'), 'depth', ['m']);
    if (after('width') > 0) num(after('width'), 'width', ['m']);
    if (has('trefoil')) put('formation', 'trefoil');
    if (has('flat')) put('formation', 'flat');
    if (!Object.keys(out.set).length && !bad.length) bad.push('trench takes depth, width or a formation: trench depth 1.1, trench width 0.6, trench ac trefoil');
    return;
  }
  if (v === 'cable') {
    if (has('rate')) {
      const nums = rest.filter(isNum), ic = rest.indexOf('circuits') >= 0 ? rest.indexOf('circuits') : rest.indexOf('circuit'), ip = after('pitch');
      const size = nums[0], count = ic > 0 && isNum(rest[ic - 1]) ? rest[ic - 1].n : 1, pitch = ip > 0 && isNum(rest[ip]) ? rest[ip].n : null;
      const kind = has('mv') ? 'mv' : has('dc') ? 'dc' : 'lv';
      if (!size) bad.push('cable rate needs a size, such as cable rate 400 al 28 circuits');
      else if (kind !== 'dc' && guard('size', size.n)) bad.push(guard('size', size.n));
      if (!(count >= 1 && count <= 60 && Math.round(count) === count)) bad.push(`circuits must be a whole number from 1 to 60; you typed ${count}`);
      if (pitch !== null && !(pitch >= 0.05 && pitch <= 3)) bad.push(`pitch between circuits must be 0.05 to 3 m; you typed ${pitch}`);
      out.act = 'rate'; out.arg = { size: size?.n, metal: has('cu') ? 'cu' : 'al', circuits: count, pitchM: pitch, kind };
      return;
    }
    const n = rest.find(isNum);
    if (n) put('size', n.n); else bad.push('cable needs a size in mm², such as cable 400 al');
    put('metal', has('cu') ? 'cu' : 'al');
    return;
  }
  if (v === 'load') { const w = rest.find(x => x === 'continuous' || x === 'solar-day'); if (w) put('load', w); else bad.push('load is continuous or solar-day'); return; }
  if (v === 'xray') { out.act = 'xray'; out.arg = { on: !has('off') }; }
}
