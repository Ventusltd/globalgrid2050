/* Optional, bounded DC location actions. Frame and original source records stay owned by their existing components. */
export const INPUT = Object.freeze({
  url: 'https://raw.githubusercontent.com/Ventusltd/data-grid-gb/b33190f2a95a2046e108c2ba465c6a9195759892/datacentres/locations/data/20261117T002200Z/datacentre-locations.geojson',
  sha256: '6f68e078d9b57057acdda679288730e638553f68df884dfd747c5049e56ea88e',
  bytes: 183561
});
const PRECISIONS = new Set(['WIKIDATA_REPORTED_POINT', 'POSTCODE_CENTROID_APPROXIMATE', 'UNKNOWN']);
const ATTACHMENTS = new WeakMap();
export const FOOTNOTE = 'UK screening coverage. Screening only; not a grid-capacity assessment.';
const requireValid = (ok, field) => { if (!ok) throw new Error('DC locations rejected: ' + field); };

function checkedPoint(feature) {
  const xy = feature?.geometry?.coordinates;
  requireValid(feature?.geometry?.type === 'Point' && Array.isArray(xy) && xy.length === 2 &&
    xy.every(Number.isFinite) && Math.abs(xy[0]) <= 180 && Math.abs(xy[1]) <= 90 &&
    (xy[0] !== 0 || xy[1] !== 0), 'point');
  return xy;
}

function revision(value, qid) {
  let u; try { u = new URL(value); } catch { throw new Error('DC locations rejected: source URL'); }
  requireValid(u.protocol === 'https:' && u.hostname === 'www.wikidata.org' && !u.username && !u.password &&
    !u.port && u.pathname === '/w/index.php' && u.searchParams.get('title') === qid &&
    u.searchParams.size === 2 && u.searchParams.getAll('title').length === 1 && u.searchParams.getAll('oldid').length === 1 &&
    /^[1-9]\d*$/.test(u.searchParams.get('oldid') || '') && !u.hash, 'source revision');
  return u.href;
}

export function indexLocations(document) {
  requireValid(document?.schema === 'data-grid-gb.dc-address-locations.v1' && document.type === 'FeatureCollection' &&
    Array.isArray(document.features) && document.features.length > 0 && document.features.length <= 1000, 'schema/count');
  const index = new Map(); let points = 0, approximate = 0, addresses = 0;
  for (const f of document.features) {
    const p = f.properties;
    requireValid(f.type === 'Feature' && p && /^DC-WD-Q[1-9]\d*$/.test(f.id) && f.id === p.id &&
      p.wikidata_id === f.id.slice(6) && !index.has(f.id), 'original source identity');
    requireValid(typeof p.name === 'string' && p.name.trim() && p.name.length <= 1000 &&
      p.grid_connection_assessed === false && p.facility_identity_review === 'NOT_INDEPENDENTLY_VERIFIED', 'scope');
    requireValid(PRECISIONS.has(p.location_precision) && Array.isArray(p.addresses) &&
      p.addresses.every(x => typeof x.text === 'string' && x.text.length <= 2000), 'precision/address');
    revision(p.source_revision_url, p.wikidata_id);
    if (p.addresses.length) addresses++;
    if (f.geometry !== null) {
      const xy = checkedPoint(f);
      requireValid(p.location_precision !== 'UNKNOWN' && typeof p.geometry_licence === 'string' &&
        Array.isArray(p.geometry_attribution) && p.geometry_attribution.length > 0, 'point/rights');
      points++;
      if (p.location_precision === 'POSTCODE_CENTROID_APPROXIMATE') {
        requireValid(p.country?.code === 'GB' && xy[0] >= -8.7 && xy[0] <= 2 && xy[1] >= 49.8 && xy[1] <= 61.2 &&
          p.geometry_licence.startsWith('OS OpenData') && p.geometry_licence_url === 'https://postcodes.io/docs/licences/', 'postcode geometry terms');
        approximate++;
      } else requireValid(p.geometry_licence === 'CC0-1.0' &&
        p.geometry_licence_url === 'https://www.wikidata.org/wiki/Wikidata:Copyright', 'Wikidata geometry terms');
    } else requireValid(p.location_precision === 'UNKNOWN', 'null geometry precision');
    index.set(f.id, f);
  }
  const c = document.counts;
  requireValid(c?.records === index.size && c.with_geometry === points && c.unknown_geometry === index.size - points &&
    c.postcode_centroids === approximate && c.with_address === addresses, 'observed counts');
  return index;
}

export function screenUrl(feature) {
  if (!feature?.geometry || feature.properties?.country?.code !== 'GB') return null;
  const [longitude, latitude] = checkedPoint(feature);
  requireValid(typeof feature.properties?.name === 'string' && feature.properties.name.trim(), 'source label');
  // Reconstruct from checked coordinates; never execute a producer-supplied action URL.
  return 'https://ventusltd.github.io/gridatlas/atlas/?' + new URLSearchParams({
    longitude: String(longitude), latitude: String(latitude), zoom: '12',
    project: feature.properties.name, technology: 'datacentre'}).toString();
}

export async function loadLocations(transport = fetch, pin = INPUT) {
  requireValid(pin && Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 2 * 1024 * 1024 &&
    /^[a-f0-9]{64}$/.test(pin.sha256 || '') && typeof pin.url === 'string' &&
    /^https:\/\/raw\.githubusercontent\.com\/Ventusltd\/data-grid-gb\/[a-f0-9]{40}\/datacentres\/locations\/data\/[A-Za-z0-9_-]+\/datacentre-locations\.geojson$/.test(pin.url), 'pinned source contract');
  const response = await transport(pin.url, {credentials: 'omit', referrerPolicy: 'no-referrer'});
  requireValid(response.ok, 'HTTP response');
  const reader = response.body?.getReader();
  requireValid(reader, 'bounded response stream');
  const chunks = []; let length = 0;
  while (true) {
    const {done, value} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > pin.bytes) { await reader.cancel(); throw new Error('DC locations rejected: byte limit'); }
    chunks.push(value);
  }
  requireValid(length === pin.bytes, 'source byte count');
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  requireValid(actual === pin.sha256, 'source digest');
  return indexLocations(JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)));
}

export function attachLocationActions(host, options = {}) {
  const {pin = INPUT, noteId = 'dc-screening-note'} = options;
  requireValid(host?.nodeType === 1 && /^[a-z][a-z0-9-]*$/.test(noteId), 'host/note ID');
  const key = JSON.stringify([pin.url, pin.sha256, pin.bytes, noteId]);
  const previous = ATTACHMENTS.get(host);
  if (previous) {
    requireValid(previous.key === key, 'host already has another source');
    return previous.promise;
  }
  const state = {key};
  state.promise = mount(host, options, state).catch(error => {
    if (ATTACHMENTS.get(host) === state) ATTACHMENTS.delete(host);
    throw error;
  });
  ATTACHMENTS.set(host, state);
  return state.promise;
}

async function mount(host, {transport = fetch, pin = INPUT, noteId = 'dc-screening-note'}, state) {
  const index = await loadLocations(transport, pin);
  let closed = false, queued = false;
  function refresh() {
    if (closed) return;
    let count = 0;
    for (const row of host.querySelectorAll('tbody tr')) {
      const id = row.querySelector('.ggdc-id')?.textContent?.trim(), feature = index.get(id);
      const screenable = feature?.geometry && feature.properties.country?.code === 'GB';
      const stale = [...row.querySelectorAll('.ggdc-screen-actions')].filter(n => !screenable || n.dataset.sourceId !== id);
      for (const n of stale) n.remove();
      if (stale.length) row.querySelectorAll('[data-dc-location-hidden]').forEach(n => {
        if (n.dataset.dcLocationHidden === noteId) { n.hidden = false; delete n.dataset.dcLocationHidden; }
      });
      if (!screenable || row.querySelector('.ggdc-screen-actions')) continue;
      const cell = row.lastElementChild;
      if (!cell) continue;
      const p = feature.properties, actions = document.createElement('div');
      actions.className = 'ggdc-screen-actions'; actions.dataset.sourceId = id;
      const link = document.createElement('a'); link.textContent = 'Screen¹';
      link.href = screenUrl(feature); link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.setAttribute('aria-describedby', noteId);
      link.title = p.location_precision === 'POSTCODE_CENTROID_APPROXIMATE'
        ? 'Approximate postcode location — open existing grid vicinity screening' : 'Source-reported location — open existing grid vicinity screening';
      actions.append(link);
      const source = document.createElement('a'); source.textContent = 'Location source';
      source.href = revision(p.source_revision_url, p.wikidata_id); source.target = '_blank'; source.rel = 'noopener noreferrer';
      actions.append(source);
      const location = document.createElement('small'); location.className = 'ggdc-screen-location';
      location.textContent = (p.location_precision === 'POSTCODE_CENTROID_APPROXIMATE' ? 'Approx. postcode: ' : 'Source point: ') +
        (p.location_source?.postcode || p.addresses[0]?.text || p.name);
      actions.append(location);
      for (const n of cell.querySelectorAll('.ggdc-muted')) if (n.textContent.trim() === 'No mapped coordinates') {
        n.hidden = true; n.dataset.dcLocationHidden = noteId;
      }
      cell.append(actions); count++;
    }
    if (!host.querySelector('#' + noteId) && host.querySelector('.ggdc-screen-actions')) {
      const note = document.createElement('small'); note.id = noteId; note.className = 'ggdc-screen-footnote';
      note.textContent = '¹ ' + FOOTNOTE; host.append(note);
    }
    const note = host.querySelector('#' + noteId);
    if (note) note.hidden = !host.querySelector('.ggdc-screen-actions');
    return count;
  }
  const observer = new MutationObserver(() => {
    if (queued || closed) return;
    queued = true;
    queueMicrotask(() => { queued = false; refresh(); });
  });
  refresh(); observer.observe(host, {childList: true, characterData: true, subtree: true});
  return {refresh, disconnect() {
    closed = true; observer.disconnect();
    host.querySelectorAll('.ggdc-screen-actions').forEach(n => n.remove());
    host.querySelector('#' + noteId)?.remove();
    host.querySelectorAll('[data-dc-location-hidden]').forEach(n => {
      if (n.dataset.dcLocationHidden === noteId) { n.hidden = false; delete n.dataset.dcLocationHidden; }
    });
    if (ATTACHMENTS.get(host) === state) ATTACHMENTS.delete(host);
  }, sourceIds: index.size};
}
