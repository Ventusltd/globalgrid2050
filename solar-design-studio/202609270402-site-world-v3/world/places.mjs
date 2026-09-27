// Town and village search through postcodes.io /places, which serves OS Open Names (Open Government Licence v3.0;
// the service's code is MIT). CORS is open (Access-Control-Allow-Origin: *) and no key is needed. Each place comes with
// national-grid eastings and northings as well as latitude and longitude, so the world is placed from OS's own figures.
// Only populated places are kept: City, Town, Village, Hamlet, Suburban Area. No Nominatim, no other geocoder.
// The pure parts are at the top; createPlaceLookup is the same polite client as postcodes.mjs: one request at a time,
// at least minGapMs apart, a newer query replaces one still waiting, answers are kept (least recently used out).

import { looksLikePostcode } from './postcodes.mjs';

export const PLACES_API = 'https://api.postcodes.io/places';

// Kept identical to data/attribution.json sources["os-open-names"].line with {year} filled (tests/places.test.mjs checks).
export const PLACES_CREDIT = Object.freeze({
  id: 'os-open-names',
  text: 'Contains OS data © Crown copyright and database right 2026.',
  link: 'https://www.ordnancesurvey.co.uk/customers/public-sector/public-sector-licensing/copyright-acknowledgments'
});

// Settlement types in rank order, and the word shown for each.
export const PLACE_TYPES = Object.freeze({ City: 'City', Town: 'Town', Village: 'Village', Hamlet: 'Hamlet', 'Suburban Area': 'Suburb' });
const TYPE_RANK = Object.keys(PLACE_TYPES);

// Scores on the scale of search.mjs SCORE (exact project name 2000, name prefix 500): an exact settlement name goes
// above every project name match, a settlement that starts with the text sits just above projects that do, and one
// that only holds the text further in ("Even Swindon") sits between project prefixes and other project matches.
export const PLACE_SCORE = Object.freeze({ exact: 3000, prefix: 550, other: 300 });

// Lower case, accents and punctuation off, spaces single: "Bishop's Stortford" and "bishops stortford" are one name.
export const foldName = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Worth asking for places: two letters or more, and not a postcode or a number.
export function looksLikePlace(text) {
  const q = foldName(text);
  return q.length >= 2 && /[a-z]/.test(q) && !looksLikePostcode(text);
}

// "Sir Ddinbych - Denbighshire" -> "Denbighshire": the English form closes the bilingual Welsh names.
const english = s => (s && s.includes(' - ') ? s.split(' - ').pop() : s || '').trim();

// Where a place is, for the detail line: county or unitary authority, else district, else region; never its own name.
export function whereOf(r) {
  for (const w of [r.county_unitary, r.district_borough, r.region, r.country].map(english)) {
    if (w && foldName(w) !== foldName(r.name_1)) return w;
  }
  return '';
}

// postcodes.io /places results -> Find rows, best first. Rows that are not settlements or have no point are left out.
// Order: exact name (either language), then names that start with the text, then the rest; within each,
// City > Town > Village > Hamlet > Suburb, then name, then south to north.
export function toPlaceRows(results, query) {
  const q = foldName(query);
  return (Array.isArray(results) ? results : [])
    .filter(r => r && PLACE_TYPES[r.local_type] && Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && r.name_1)
    .map(r => {
      const names = [r.name_1, r.name_2].filter(Boolean).map(foldName);
      const score = names.includes(q) ? PLACE_SCORE.exact : names.some(n => n.startsWith(q)) ? PLACE_SCORE.prefix : PLACE_SCORE.other;
      const title = r.name_2 && foldName(r.name_2) === q && foldName(r.name_1) !== q ? `${r.name_2} (${r.name_1})` : r.name_1;
      const choice = { lat: r.latitude, lon: r.longitude, label: r.name_1 };
      if (Number.isFinite(r.eastings) && Number.isFinite(r.northings)) Object.assign(choice, { e: r.eastings, n: r.northings });
      return { key: `place-${r.code ?? `${r.name_1}-${r.latitude}-${r.longitude}`}`, source: PLACES_CREDIT.id, title,
        detail: [PLACE_TYPES[r.local_type], whereOf(r)].filter(Boolean).join(' · '),
        score, rank: TYPE_RANK.indexOf(r.local_type), choice };
    })
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.title.localeCompare(b.title, 'en') || a.choice.lat - b.choice.lat)
    .map(({ rank, ...row }) => row);
}

// fetchImpl, clock and sleep are injectable for tests. lookup(text) -> Promise of rows, or null when a newer query
// replaced this one before it was sent. Text that is not worth asking about resolves to [] with no request.
export function createPlaceLookup({ fetchImpl, limit = 30, minGapMs = 300, cacheSize = 60,
  clock = () => Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const get = fetchImpl || ((u, o) => fetch(u, o));
  const cache = new Map(), stats = { requests: 0, cached: 0, skipped: 0 };
  let chain = Promise.resolve(), last = -Infinity, latest = 0;
  const remember = (q, rows) => {
    cache.delete(q); cache.set(q, rows);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
  };
  function lookup(text) {
    const q = foldName(text);
    if (!looksLikePlace(text)) return Promise.resolve([]);
    if (cache.has(q)) { stats.cached++; const rows = cache.get(q); remember(q, rows); return Promise.resolve(rows); }
    const id = ++latest;
    const run = chain.then(async () => {
      if (id !== latest) { stats.skipped++; return null; }
      const wait = last + minGapMs - clock();
      if (wait > 0) await sleep(wait);
      if (id !== latest) { stats.skipped++; return null; }
      last = clock(); stats.requests++;
      const res = await get(`${PLACES_API}?q=${encodeURIComponent(String(text).trim())}&limit=${limit}`, { mode: 'cors' });
      if (!res.ok) throw Error(`postcodes.io HTTP ${res.status}`);
      const rows = toPlaceRows((await res.json())?.result, text);
      remember(q, rows);
      return rows;
    });
    chain = run.catch(() => {});
    return run;
  }
  lookup.stats = stats;
  return lookup;
}
