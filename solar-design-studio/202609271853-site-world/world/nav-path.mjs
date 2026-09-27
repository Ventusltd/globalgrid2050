// Where the viewer is in the plant: Plant > Block > Row > Table > String.
// Pure: no imports, no DOM. A path is { b, r, t, s }: whole numbers counted from 1, or null below the level reached.
// Rows are counted within their block, tables within their row, strings within their table.
// A table typed without a row ("go block 12 table 3") is counted across the whole block; normalise() finds its row.
//
// counts (from the layout, supplied by the caller): { blocks: n, rows(b), tables(b, r), strings(b, r, t) } -> whole numbers.

export const LEVELS = ['plant', 'block', 'row', 'table', 'string'];
const KEYS = ['b', 'r', 't', 's'];
const NAMES = { b: 'Block', r: 'Row', t: 'Table', s: 'String' };
export const PLANT = Object.freeze({ b: null, r: null, t: null, s: null });

const whole = v => Number.isInteger(v) && v >= 1;
const lower = k => NAMES[k].toLowerCase();

// Cuts a path at its first missing number, so a string never hangs under a missing table.
export function clean(p = {}) {
  const out = { ...PLANT };
  for (const k of KEYS) { if (!whole(p[k])) break; out[k] = p[k]; }
  return out;
}

// 'plant' | 'block' | 'row' | 'table' | 'string'
export const levelOf = p => LEVELS[KEYS.filter(k => clean(p)[k] != null).length];

// One level up; the plant stays the plant.
export function up(p) {
  const c = clean(p), last = [...KEYS].reverse().find(k => c[k] != null);
  return last ? { ...c, [last]: null } : { ...PLANT };
}

export const samePath = (a, b) => { const x = clean(a), y = clean(b); return KEYS.every(k => x[k] === y[k]); };

// '#b12/r7/t3/s14'; the plant is '#'.
export function toHash(p) {
  const c = clean(p);
  return '#' + KEYS.filter(k => c[k] != null).map(k => k + c[k]).join('/');
}

// Reads '#b12/r7/t3/s14', 'b12/r7', or '#b12/t30' (a block-wide table, row not yet known).
// Anything else is the plant: a bad link lands on the whole view, never on an error page.
export function fromHash(hash) {
  const text = String(hash ?? '').trim().replace(/^#/, '').toLowerCase();
  const out = { b: null, r: null, t: null, s: null };
  if (!text) return out;
  let last = -1;
  for (const part of text.split('/').filter(Boolean)) {
    const m = /^([brts])(\d{1,6})$/.exec(part), i = m ? KEYS.indexOf(m[1]) : -1;
    if (!m || i <= last || Number(m[2]) < 1) return { ...PLANT };
    out[m[1]] = Number(m[2]); last = i;
  }
  if (out.b == null) return { ...PLANT };
  if (out.r == null && out.t != null) return { ...out, blockTable: true };
  return clean(out);
}

// Breadcrumbs: [{ level, label, path, hash }] from the plant down to where the viewer is; each is a place to fly back to.
export function crumbs(p) {
  const c = clean(p), acc = { ...PLANT }, out = [{ level: 'plant', label: 'Plant', path: { ...PLANT }, hash: '#' }];
  KEYS.forEach((k, i) => {
    if (c[k] == null) return;
    acc[k] = c[k];
    out.push({ level: LEVELS[i + 1], label: `${NAMES[k]} ${c[k]}`, path: { ...acc }, hash: toHash(acc) });
  });
  return out;
}

// 'Plant > Block 12 > Row 7 > Table 3 > String 14'
export const crumbText = p => crumbs(p).map(x => x.label).join(' > ');

const range = (where, what, n) => (n > 0 ? `${where}${what} ${n === 1 ? 'is' : 'are'} 1-${n}.` : `${where}there are no ${what.toLowerCase()} yet.`);

// Checks a path against the layout and fills in the row of a block-wide table.
// Returns { ok: true, path } or { ok: false, message, path } with path the deepest valid part (fly there and say why).
export function normalise(p, counts) {
  if (!counts) return { ok: false, message: 'No plant is laid out yet: type plant 50 to lay one out.', path: { ...PLANT } };
  const out = { ...PLANT };
  if (p.b == null) return { ok: true, path: out };
  if (!whole(p.b) || p.b > counts.blocks) return { ok: false, message: range('', 'Blocks', counts.blocks), path: out };
  out.b = p.b;
  let r = p.r, t = p.t;
  if (r == null && t != null) { // a block-wide table number: walk the rows to find it
    const rows = counts.rows(p.b);
    let left = t, total = 0;
    for (let i = 1; i <= rows; i++) {
      const n = counts.tables(p.b, i); total += n;
      if (r == null && whole(left) && left <= n) { r = i; t = left; } else if (r == null) left -= n;
    }
    if (r == null) return { ok: false, message: range(`Block ${p.b}: `, 'Tables', total), path: { ...out } };
  }
  if (r == null) return { ok: true, path: out };
  const rows = counts.rows(out.b);
  if (!whole(r) || r > rows) return { ok: false, message: range(`Block ${out.b}: `, 'Rows', rows), path: { ...out } };
  out.r = r;
  if (t == null) return { ok: true, path: out };
  const tables = counts.tables(out.b, r);
  if (!whole(t) || t > tables) return { ok: false, message: range(`Block ${out.b} row ${r}: `, 'Tables', tables), path: { ...out } };
  out.t = t;
  if (p.s == null) return { ok: true, path: out };
  const strings = counts.strings(out.b, r, t);
  if (!whole(p.s) || p.s > strings) return { ok: false, message: range(`Table ${t}: `, 'Strings', strings), path: { ...out } };
  out.s = p.s;
  return { ok: true, path: out };
}

// ---- typed navigation ----
// Navigation needs 'go' first, a compact 'b12 ...', or a '#b12/...' link, so it never takes the design commands
// 'string 28' (modules in series) or 'block 10mva' (block size). parseNav returns null when the line is not navigation
// (so Find can try it as a place). Forms:
//   go block 12 table 3 · go b12 r7 t3 s14 · b12 r7 t3 s14 · b12/r7/t3/s14 · #b12/r7 · go row 7 · go string 14 · up · plant
// Result: { kind: 'up' } | { kind: 'plant' } | { kind: 'go', path, relative } | { kind: 'error', message }
const WORD = { b: 'b', blk: 'b', block: 'b', r: 'r', row: 'r', t: 't', tbl: 't', table: 't', s: 's', str: 's', string: 's' };

export function parseNav(line) {
  const text = String(line ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;
  if (/^(go )?up$/.test(text)) return { kind: 'up' };
  if (/^(go )?(plant|top|home|whole plant)$/.test(text)) return { kind: 'plant' };
  const link = /^#?(b\d+(?:\/[rts]\d+)*)$/.exec(text);
  if (link) {
    const path = fromHash(link[1]);
    return path.b ? { kind: 'go', path, relative: false } : { kind: 'error', message: 'That link does not read as a place, such as #b12/r7/t3/s14.' };
  }
  const go = /^(?:go to|goto|fly to|fly|go) (.*)$/.exec(text);
  const body = go ? go[1] : /^b\d/.test(text) ? text : null;
  if (body == null) return null;
  const words = body.replace(/([a-z])(\d)/g, '$1 $2').replace(/[,/]/g, ' ').split(' ').filter(Boolean);
  const p = {};
  for (let i = 0; i < words.length; i++) {
    const k = WORD[words[i]];
    if (!k) return null; // not a level word: a place name for Find (go compound, go <town>), not ours
    const n = words[i + 1];
    if (!/^\d{1,6}$/.test(n ?? '')) return { kind: 'error', message: `${lower(k)} needs a number, such as go ${lower(k)} 3` };
    if (p[k] != null) return { kind: 'error', message: `${lower(k)} is typed twice` };
    p[k] = Number(n); i++;
  }
  if (!Object.keys(p).length) return null;
  const path = { b: p.b ?? null, r: p.r ?? null, t: p.t ?? null, s: p.s ?? null };
  if (path.b != null && path.r == null && path.t != null) path.blockTable = true;
  if (path.t == null && path.s != null && (path.b != null || path.r != null)) return { kind: 'error', message: 'a string sits on a table: type go block 12 table 3 string 14' };
  if (path.b != null && path.r == null && path.t == null && path.s != null) return { kind: 'error', message: 'a string sits on a table: type go block 12 table 3 string 14' };
  return { kind: 'go', path, relative: path.b == null };
}

// A relative go ('go row 7', 'go table 3', 'go string 14') keeps the levels above the first one typed from the current path.
// 'go table 3' in a block with no row chosen counts the table across the block.
export function resolve(cmd, current = PLANT) {
  if (!cmd) return null;
  const c = clean(current);
  if (cmd.kind === 'up') return { ok: true, path: up(c) };
  if (cmd.kind === 'plant') return { ok: true, path: { ...PLANT } };
  if (cmd.kind === 'error') return { ok: false, message: cmd.message, path: c };
  const p = cmd.path;
  if (!cmd.relative) return { ok: true, path: { b: p.b, r: p.r, t: p.t, s: p.s } };
  const first = KEYS.findIndex(k => p[k] != null), out = { ...PLANT };
  KEYS.forEach((k, i) => { out[k] = i < first ? c[k] : p[k]; });
  if (KEYS[first] === 't' && c.b != null && c.r == null) return { ok: true, path: out }; // block-wide table
  const need = KEYS.slice(0, first).find(k => out[k] == null);
  if (need) return { ok: false, message: `Go to a ${lower(need)} first, or type the whole place, such as go block 12 table 3.`, path: c };
  return { ok: true, path: out };
}

// The existing command grammar's go (cmd-grammar.mjs arg { block, table }) as a path; its table is block-wide.
export const fromGoArg = arg => (arg && whole(arg.block) ? { b: arg.block, r: null, t: whole(arg.table) ? arg.table : null, s: null } : null);

// parse + resolve + normalise: { ok, path, message? }, or null when the line is not navigation.
export function navigate(line, current, counts) {
  const cmd = parseNav(line);
  if (!cmd) return null;
  const r = resolve(cmd, current);
  return r.ok ? normalise(r.path, counts) : r;
}
