// One observation per exact register identity; grouped sites never borrow a distance.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function widerMetricActions(row, index, label = 'GRID') {
  if (!['GRID', 'SUB'].includes(label)) throw Error('Unknown metric');
  const refs = [...new Set((Array.isArray(row.repd_records) ? row.repd_records : [row])
    .map(record => String(record?.ref ?? '').trim()).filter(ref => /^\d+$/.test(ref)))];
  if (!refs.length) return `<span class="action-metric" title="No exact REPD identity; no distance is guessed">${label} unavailable</span>`;
  return refs.map(ref => {
    const hit = index?.[ref];
    const valid = typeof hit?.k === 'number' && Number.isFinite(hit.k) && hit.k >= 0;
    const explanation = !index ? 'Distance source unavailable in this session.' : !valid
      ? 'No published distance for this exact identity in the loaded source. This does not establish that infrastructure is absent.'
      : `${label === 'GRID' ? 'Nearest mapped circuit' : 'Nearest mapped substation at 33 kV or above'}: ${hit.k.toFixed(2)} km. ${label === 'SUB' && hit.n ? hit.n + '. ' : ''}Straight-line observation, not a cable route, connection offer or headroom. Published mapped coverage is incomplete.`;
    return `<span class="action-metric" data-repd-metric="${esc(ref)}" title="REPD ${esc(ref)}: ${esc(explanation)}">${label} ${refs.length > 1 ? esc(ref) + ' ' : ''}${valid ? `<b>${hit.k.toFixed(2)}</b><span class="unit">km</span>` : 'unavailable'}</span>`;
  }).join(' ');
}
