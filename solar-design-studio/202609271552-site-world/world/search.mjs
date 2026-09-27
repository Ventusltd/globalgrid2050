// Project search over web/world/data/projects.json. Pure: no imports, no DOM.
// Rules follow GridAtlas: space-separated terms must all match (AND), a term
// may hold '/'-separated alternatives (OR), matching is substring over name,
// postcode, county and ref. Scores: exact postcode +10000, exact ref +9000,
// exact name +2000, name prefix +500, any other match +200.
// Typed "lat, lon" returns { kind: 'coords', lat, lon }; British grid
// references are parsed elsewhere.

export const SCORE = { postcode: 10000, ref: 9000, name: 2000, prefix: 500, other: 200 };

const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

const norm = (s) => (s == null ? '' : String(s).toLowerCase().replace(/\s+/g, ' ').trim());
const compact = (s) => norm(s).replace(/ /g, '');

export function parseCoords(text) {
  const m = COORDS.exec(String(text ?? ''));
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // Two bare integers ("12 400") are more likely a name or number than a point.
  if (!m[1].includes('.') && !m[2].includes('.')) return null;
  return { kind: 'coords', lat, lon };
}

// Split the query into terms, each a list of alternatives.
export function parseQuery(text) {
  return norm(text)
    .split(' ')
    .map((t) => t.split('/').map((a) => a.trim()).filter(Boolean))
    .filter((alts) => alts.length > 0);
}

// Turn the index into objects with pre-normalised search text, once per index.
const PREPARED = new WeakMap();
const DEFAULT_FIELDS = ['repd_ref', 'name', 'postcode', 'county', 'technology', 'status', 'capacity_mw', 'lat', 'lon'];

function prepare(index) {
  if (PREPARED.has(index)) return PREPARED.get(index);
  const fields = index.fields ?? DEFAULT_FIELDS;
  const rows = (index.records ?? []).map((r) => {
    const rec = Array.isArray(r) ? Object.fromEntries(fields.map((f, i) => [f, r[i]])) : r;
    return {
      rec,
      name: norm(rec.name),
      postcode: norm(rec.postcode),
      postcodeC: compact(rec.postcode),
      county: norm(rec.county),
      ref: norm(rec.repd_ref),
    };
  });
  PREPARED.set(index, rows);
  return rows;
}

function altMatches(row, alt) {
  const c = alt.replace(/ /g, '');
  return row.name.includes(alt) || row.county.includes(alt) || row.ref.includes(alt) ||
    row.postcode.includes(alt) || (c.length > 0 && row.postcodeC.includes(c));
}

function score(row, whole) {
  let s = 0;
  for (const q of whole) {
    const qc = q.replace(/ /g, '');
    if (row.postcodeC && row.postcodeC === qc) s += SCORE.postcode;
    if (row.ref && row.ref === q) s += SCORE.ref;
    if (row.name && row.name === q) s += SCORE.name;
    else if (row.name && row.name.startsWith(q)) s += SCORE.prefix;
  }
  return s > 0 ? s : SCORE.other;
}

export function search(index, query, limit = 12) {
  const coords = parseCoords(query);
  if (coords) return coords;
  const terms = parseQuery(query);
  if (terms.length === 0 || !index) return { kind: 'projects', total: 0, results: [] };
  // Whole-query forms for the exact and prefix bonuses: the full text, or each
  // alternative when the query is a single term.
  const whole = terms.length === 1 ? terms[0] : [norm(query)];
  const hits = [];
  for (const row of prepare(index)) {
    if (!terms.every((alts) => alts.some((a) => altMatches(row, a)))) continue;
    hits.push({ ...row.rec, score: score(row, whole) });
  }
  hits.sort((a, b) =>
    b.score - a.score ||
    (b.capacity_mw ?? -1) - (a.capacity_mw ?? -1) ||
    String(a.name ?? '').localeCompare(String(b.name ?? '')) ||
    String(a.repd_ref ?? '').localeCompare(String(b.repd_ref ?? '')));
  return { kind: 'projects', total: hits.length, results: hits.slice(0, Math.max(0, limit)) };
}

export default search;
