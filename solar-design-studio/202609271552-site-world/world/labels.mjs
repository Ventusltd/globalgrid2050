// Human words for what the page shows. Pure: no DOM, no imports.
// Trench sections and cables carry code ids in the data files (e.g. "33kv-1-dno"); people read these labels instead.

const COUNT = ['no', 'one', 'two', 'three', 'four'];
const circuits = n => `${COUNT[n] ?? n} circuit${n === 1 ? '' : 's'}`;

// The voltage in plain words, from the section's voltage_class.
function voltage(s) {
  const v = String(s.voltage_class || '');
  if (/DC string/i.test(v)) return '1.5 kV DC string';
  if (/^LV/i.test(v)) return 'LV';
  return v.replace(/\s*AC$/i, '').replace(/\s*\(.*\)$/, '').trim() || 'Trench';
}

// Where the section's dimensions come from, or how it is laid, in a few words.
function basis(s) {
  const id = String(s.id || '');
  if (/-dno/.test(id)) return /agricultural/.test(id) ? 'farmland (network operator spec)' : '(network operator spec)';
  if (/-owner/.test(id)) return `(owner rule, ${s.cover_to_top_m} m cover)`;
  if (/-agri/.test(id)) return 'farmland';
  if (/duct/i.test(s.formation || '')) return s.cover_to_top_m >= 1.2 ? `in ducts, ${s.cover_to_top_m} m cover` : 'in ducts';
  return '';
}

// "33 kV, one circuit (network operator spec)"
export function sectionLabel(s) {
  if (!s) return '';
  const b = basis(s);
  return `${voltage(s)}, ${circuits(Number(s.circuits) || 1)}${b ? (b.startsWith('(') ? ' ' : ', ') + b : ''}`;
}

const METAL = { al: 'aluminium', cu: 'copper' };
// "aluminium", "copper", or "conductor not stated"
export const conductorLabel = c => METAL[String(c || '').toLowerCase()] || 'conductor not stated';

// "33 kV aluminium 300 mm² · OD 51.5 mm", "132 kV 300 mm², conductor not stated · OD 72 mm"
export function cableLabel(c) {
  if (!c) return '';
  const metal = METAL[String(c.conductor || '').toLowerCase()];
  const armour = /armoured/.test(String(c.id || '')) ? ', armoured' : '';
  const core = metal ? `${c.voltage_kv} kV ${metal} ${c.csa_mm2} mm²` : `${c.voltage_kv} kV ${c.csa_mm2} mm², conductor not stated`;
  return `${core}${armour} · OD ${c.od_mm} mm`;
}

// "Tap" on a touch screen, "Click" with a mouse.
export const pressWord = coarse => (coarse ? 'Tap' : 'Click');

// Distance in words: "850 m", "1.2 km".
export const distanceLabel = m => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

const TOOL_WORD = { trench: 'Trench', cable: 'Cable', road: 'Road', pad: 'Pad', fence: 'Fence', piles: 'Pile row', hdd: 'Drilled crossing' };
// One line for the Design panel that says what to do next. view: 'choose' | 'draw' | 'result'; n: points drawn.
export function designHint(tool, view, n, press) {
  if (!tool) return view === 'result' ? 'Choose a design tool to draw again' : 'Choose a design tool';
  const p = press.toLowerCase();
  if (view === 'result' && !n) return `${TOOL_WORD[tool] || tool} finished. ${press} the ground to draw another.`;
  if (!n) return tool === 'pad' ? `${press} the pad centre or its corners, then Done` : `${press} two or more points on the ground, then Done`;
  return n === 1 && tool !== 'pad' ? `1 point · ${p} the next point` : `${n} point${n === 1 ? '' : 's'} · ${p} more, or Done`;
}

