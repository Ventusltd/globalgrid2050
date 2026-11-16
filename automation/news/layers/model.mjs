export function assetRows(payload, kind) {
  if (payload?.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw Error('Invalid source collection');
  const seen = new Set();
  return payload.features.map(feature => {
    const p = feature.properties || {};
    const rawId = feature.id ?? p.id;
    if (rawId === undefined || rawId === null || String(rawId).length > 160) throw Error('Missing source identity');
    const id = `${kind}:${rawId}`;
    if (seen.has(id)) throw Error('Duplicate source identity'); seen.add(id);
    const c = feature.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
    const located = Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number' && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
    return {id, sourceId: String(rawId), name: typeof p.name === 'string' && p.name.trim() ? p.name : null,
      operator: typeof p.operator === 'string' ? p.operator : null,
      category: p.class_label || p.type || null, voltage: p.voltage ?? null,
      coordinates: located ? [c[0], c[1]] : null, properties: p};
  });
}
export function selectRows(rows, query = '') {
  const q = String(query).trim().toLocaleLowerCase('en-GB');
  return rows.filter(row => !q || [row.name, row.operator, row.sourceId, row.category, row.voltage].some(value => String(value ?? '').toLocaleLowerCase('en-GB').includes(q)));
}
export function voltageLabel(value) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  const parts = String(value).split(';');
  if (!parts.every(x => /^\d+(\.\d+)?$/.test(x.trim()) && Number(x) > 0)) return String(value);
  return parts.map(x => (Number(x) / 1000).toLocaleString('en-GB', {maximumFractionDigits: 3})).join(' / ') + ' kV';
}
export function locationLink(row) {
  if (!row.coordinates) return null;
  // Location-only contract, never an invented REPD ID or asserted connection.
  const url = new URL('https://ventusltd.github.io/gridatlas/atlas/');
  url.search = new URLSearchParams({longitude: String(row.coordinates[0]), latitude: String(row.coordinates[1]), zoom: '12',
    project: row.name || row.sourceId, technology: row.id.startsWith('substation:') ? 'substation' : 'offtaker'});
  return url.href;
}
export function latestHeadlines(items, limit = 10) {
  if (!Array.isArray(items)) return [];
  const unique = new Map();
  for (const item of items) {
    if (typeof item?.title !== 'string' || !item.title.trim() || item.title.length > 1000) continue;
    let u; try { u = new URL(item.link); } catch { continue; }
    if (u.protocol !== 'https:' || u.username || u.password) continue;
    const stamp = Date.parse(item.date || item.first_seen || '');
    if (!Number.isFinite(stamp)) continue;
    const row = {title: item.title, link: u.href, source: String(item.source || 'Publisher not supplied'), date: item.date || item.first_seen, stamp};
    if (!unique.has(row.link) || unique.get(row.link).stamp < stamp) unique.set(row.link, row);
  }
  return [...unique.values()].sort((a,b) => b.stamp - a.stamp || a.link.localeCompare(b.link)).slice(0, limit);
}
