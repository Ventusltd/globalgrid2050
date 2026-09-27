// Postcode search through postcodes.io (code MIT; Great Britain postcode data under the OS OpenData licence,
// wording checked on https://postcodes.io/docs/licences, 26 Sept 2026). The service sends
// Access-Control-Allow-Origin: *, and answers with national-grid eastings and northings as well as latitude
// and longitude, so the world is placed from the service's own grid figures.
// Northern Ireland postcodes (BT...) are left out: their data is licensed for non-commercial use only, and
// there is no EA LiDAR there anyway.
// The pure parts are at the top; createPostcodeLookup adds a polite client: one request at a time, at least
// minGapMs apart, a newer query replaces one still waiting, and answers are kept (least recently used out).

export const POSTCODES_API = 'https://api.postcodes.io/postcodes';

// Kept identical to data/attribution.json sources["postcodes-io"].line (tests/postcodes.test.mjs checks).
export const POSTCODES_CREDIT = Object.freeze({
  id: 'postcodes-io',
  text: 'Postcodes via postcodes.io. Contains Ordnance Survey data © Crown copyright and database right 2025. ' +
    'Contains Royal Mail data © Royal Mail copyright and database right 2025. ' +
    'Contains National Statistics data © Crown copyright and database right 2025. ' +
    'Contains NRS data © Crown copyright and database right 2025.',
  link: 'https://postcodes.io/docs/licences'
});

export const normalisePostcode = text => String(text ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

// A whole postcode, or the start of one: an outward code ("HR2", "SW1A") with or without part of the inward.
const SHAPE = /^[A-Z]{1,2}\d[A-Z\d]?(?: ?\d[A-Z]{0,2})?$/;
export function looksLikePostcode(text) {
  const q = normalisePostcode(text);
  return SHAPE.test(q) && !q.startsWith('BT');
}

// postcodes.io results -> Find rows. Rows without a place, or in Northern Ireland, are left out.
export function toPostcodeRows(results) {
  return (Array.isArray(results) ? results : [])
    .filter(r => r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude) && !String(r.postcode).startsWith('BT'))
    .map(r => {
      const where = [r.parish && !/unparished/i.test(r.parish) ? r.parish : null, r.admin_district].filter(Boolean).join(', ');
      const choice = { lat: r.latitude, lon: r.longitude, label: r.postcode };
      if (Number.isFinite(r.eastings) && Number.isFinite(r.northings)) Object.assign(choice, { e: r.eastings, n: r.northings });
      return { key: `pc-${r.postcode}`, source: POSTCODES_CREDIT.id, title: r.postcode,
        detail: ['Postcode', where, r.country].filter(Boolean).join(' · '), choice };
    });
}

// fetchImpl, clock and sleep are injectable for tests. lookup(text) -> Promise of rows, or null when a newer
// query replaced this one before it was sent. Non-postcode text resolves to [] with no request.
export function createPostcodeLookup({ fetchImpl, limit = 6, minGapMs = 250, cacheSize = 60,
  clock = () => Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const get = fetchImpl || ((u, o) => fetch(u, o));
  const cache = new Map(), stats = { requests: 0, cached: 0, skipped: 0 };
  let chain = Promise.resolve(), last = -Infinity, latest = 0;
  const remember = (q, rows) => {
    cache.delete(q); cache.set(q, rows);
    while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
  };
  function lookup(text) {
    const q = normalisePostcode(text);
    if (!looksLikePostcode(q)) return Promise.resolve([]);
    if (cache.has(q)) { stats.cached++; const rows = cache.get(q); remember(q, rows); return Promise.resolve(rows); }
    const id = ++latest;
    const run = chain.then(async () => {
      if (id !== latest) { stats.skipped++; return null; }
      const wait = last + minGapMs - clock();
      if (wait > 0) await sleep(wait);
      if (id !== latest) { stats.skipped++; return null; }
      last = clock(); stats.requests++;
      const res = await get(`${POSTCODES_API}?q=${encodeURIComponent(q)}&limit=${limit}`, { mode: 'cors' });
      if (!res.ok) throw Error(`postcodes.io HTTP ${res.status}`);
      const rows = toPostcodeRows((await res.json())?.result);
      remember(q, rows);
      return rows;
    });
    chain = run.catch(() => {});
    return run;
  }
  lookup.stats = stats;
  return lookup;
}
