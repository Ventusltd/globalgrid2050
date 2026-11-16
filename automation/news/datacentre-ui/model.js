/* GlobalGrid2050 V9.28: isolated, no-network Data Centre model. No identity joins. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GGDataCentreModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PROJECTS = 'globalgrid2050.global-datacentres.projects.v1';
  const OFFICIAL = 'globalgrid2050.dc-official-projects.v1';
  const GROUPS = 'globalgrid2050.dc-group-links.v1';
  const KEYS = ['it_load_mw', 'site_demand_mw', 'grid_connection_mw'];
  const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const validText = x => typeof x === 'string' && x.trim().length > 0;
  const isUK = x => x && (x.country?.code === 'GB' || x.country?.code === 'UK' || x.country_code === 'GB');
  function safeUrl(x) {
    if (typeof x !== 'string') return null;
    try {
      const u = new URL(x);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
    } catch (_) { return null; }
  }
  function requireValid(ok, why) { if (!ok) throw new Error('Data Centre input rejected: ' + why); }
  function distinct(records, field) {
    const keys = records.map(x => x[field]);
    requireValid(keys.every(validText), 'missing identifier');
    requireValid(new Set(keys).size === keys.length, 'duplicate identifier');
  }
  function validateProjects(data) {
    requireValid(isObject(data) && data.schema === PROJECTS && data.scope === 'global', 'projects schema');
    requireValid(Array.isArray(data.records) && data.records.length > 0 && data.record_count === data.records.length, 'projects count');
    distinct(data.records, 'id');
    const countries = new Set();
    data.records.forEach(p => {
      requireValid(/^DC-WD-Q[1-9]\d*$/.test(p.id) && validText(p.name), 'project identity');
      requireValid(p.record_type === 'data_centre' && p.verification_status === 'SOURCE_INDEXED', 'unverified project classification');
      requireValid(p.operating_status === 'not_assessed', 'unsupported current operating status');
      requireValid(isObject(p.country) && validText(p.country.name) && /^Q[1-9]\d*$/.test(p.country.wikidata_id), 'country');
      countries.add(p.country.wikidata_id);
      requireValid(p.operator === null || typeof p.operator === 'string', 'operator');
      requireValid(isObject(p.source) && safeUrl(p.source.url) && safeUrl(p.source.revision_url) &&
        safeUrl(p.source.licence_url) && p.source.licence === 'CC0-1.0' &&
        /^\d{4}-\d{2}-\d{2}T/.test(p.source.retrieved_at || ''), 'source / rights / time');
      requireValid(isObject(p.capacity) && isObject(p.capacity_sources), 'capacity');
      KEYS.forEach(k => {
        const value = p.capacity[k], src = p.capacity_sources[k];
        requireValid(value === null || (Number.isFinite(value) && value >= 0 && safeUrl(src)), 'unsourced or invalid MW');
      });
      const pt = p.location;
      requireValid(pt === null || (isObject(pt) && Number.isFinite(pt.latitude) && Math.abs(pt.latitude) <= 90 &&
        Number.isFinite(pt.longitude) && Math.abs(pt.longitude) <= 180 &&
        Number.isFinite(pt.precision_degrees) && pt.precision_degrees > 0), 'location');
    });
    requireValid(data.country_count === countries.size, 'country count');
    return data;
  }
  function validateAudit(audit, projects) {
    requireValid(isObject(audit) && /^globalgrid2050\./.test(audit.schema || ''), 'audit schema');
    requireValid(Array.isArray(audit.quarantined) && audit.quarantined_count === audit.quarantined.length, 'quarantine count');
    requireValid(audit.selected_count === projects.record_count &&
      audit.candidate_count === audit.selected_count + audit.quarantined_count, 'candidate arithmetic');
    distinct(audit.quarantined, 'id');
    const selected = new Set(projects.records.map(x => x.id));
    audit.quarantined.forEach(x => {
      requireValid(!selected.has(x.id) && validText(x.name) && validText(x.reason) &&
        safeUrl(x.source_revision_url), 'quarantine reason / source');
    });
    return audit;
  }
  function validateOfficial(data) {
    requireValid(isObject(data) && data.schema === OFFICIAL && Array.isArray(data.projects), 'official schema');
    distinct(data.projects, 'project_id');
    data.projects.forEach(x => {
      requireValid(validText(x.name) && (x.entity_scope === 'planning_case' || x.entity_scope === 'tax_qualification_record') &&
        x.current_lifecycle === 'UNKNOWN' && x.review_status === 'PROVISIONAL' &&
        isObject(x.source_document) && safeUrl(x.source_document.url) &&
        isObject(x.record_event) && validText(x.record_event.kind) && /^\d{4}-\d{2}-\d{2}$/.test(x.record_event.date || '') &&
        x.capacity_mw === null, 'official source record is not a verified facility');
    });
    return data;
  }
  function validateGroups(data) {
    requireValid(isObject(data) && data.schema === GROUPS && Array.isArray(data.records) &&
      data.record_count === data.records.length, 'group schema / count');
    distinct(data.records, 'project_id');
    let provisional = 0, unlinked = 0;
    data.records.forEach(x => {
      requireValid(x.status === 'PROVISIONAL' || x.status === 'UNLINKED', 'group certainty');
      requireValid(x.legal_ownership_verified === false && x.current_operating_status === 'not_assessed' &&
        safeUrl(x.source_revision_url) && Array.isArray(x.receipts), 'group rights / status / provenance');
      x.receipts.forEach(r => requireValid(safeUrl(r.final_url) && validText(r.publisher) &&
        validText(r.retrieved_at), 'group source receipt'));
      if (x.status === 'PROVISIONAL') provisional++; else unlinked++;
    });
    requireValid(data.provisional_count === provisional && data.unlinked_count === unlinked, 'group count');
    return data;
  }
  function validateBundle(bundle) {
    requireValid(isObject(bundle), 'missing bundle');
    const projects = validateProjects(bundle.projects);
    validateOfficial(bundle.official);
    validateGroups(bundle.groups);
    validateAudit(bundle.audit, projects);
    const baseline = validateProjects(bundle.baseline);
    const byId = new Map(projects.records.map(x => [x.id, x]));
    // Compare semantics, not JSON key order; retrieval times are intentionally newer.
    function canonical(x) {
      if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
      if (x !== null && typeof x === 'object') return '{' +
        Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
      return JSON.stringify(x);
    }
    const sameFields = ['name','record_type','country','operator','operating_status',
      'verification_status','location','capacity','capacity_sources','field_sources'];
    baseline.records.forEach(x => {
      const newer = byId.get(x.id);
      requireValid(!!newer, 'original baseline identity lost: ' + x.id);
      sameFields.forEach(k => requireValid(canonical(x[k]) === canonical(newer[k]),
        'original baseline semantic field changed: ' + x.id + '/' + k));
      ['publisher','url','revision_url','revision','licence','licence_url'].forEach(k =>
        requireValid(x.source[k] === newer.source[k],
          'original baseline source changed: ' + x.id + '/' + k));
    });
    requireValid(baseline.record_count <= projects.record_count, 'baseline larger than expansion');
    return bundle;
  }
  function selectRows(records, {scope = 'uk', query = '', country = ''} = {}) {
    const q = String(query).trim().toLocaleLowerCase();
    return records.filter(x => (scope !== 'uk' || isUK(x)) &&
      (!country || x.country.wikidata_id === country) &&
      (!q || [x.name, x.id, x.operator || '', x.country.name].join(' ').toLocaleLowerCase().includes(q)))
      .slice().sort((a,b) => Number(isUK(b)) - Number(isUK(a)) ||
        a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'));
  }
  function mapUrl(x) {
    if (!x.location) return null;
    const p = x.location, z = p.precision_degrees > 0.01 ? 8 : 14;
    return 'https://www.openstreetmap.org/?mlat=' + p.latitude + '&mlon=' + p.longitude +
      '#map=' + z + '/' + p.latitude + '/' + p.longitude;
  }
  const mw = x => x === null || x === undefined ? 'Not reported' : String(x) + ' MW';
  function csv(rows) {
    const fields = [
      ['Source entity ID', x => x.id], ['Name', x => x.name],
      ['Country', x => x.country.name], ['Classification', x => 'Source-indexed lead'],
      ['Current operation', x => 'Not assessed'], ['IT load MW', x => x.capacity.it_load_mw],
      ['Site demand MW', x => x.capacity.site_demand_mw], ['Grid connection MW', x => x.capacity.grid_connection_mw],
      ['Wikidata revision', x => x.source.revision_url], ['Retrieved UTC', x => x.source.retrieved_at],
      ['IT load source', x => x.capacity_sources.it_load_mw], ['Site demand source', x => x.capacity_sources.site_demand_mw],
      ['Grid connection source', x => x.capacity_sources.grid_connection_mw]
    ];
    function cell(v) {
      let s = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@\t\r\n]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return [fields.map(x => cell(x[0])).join(',')].concat(rows.map(r => fields.map(x => cell(x[1](r))).join(','))).join('\r\n') + '\r\n';
  }
  function summary(bundle) {
    const records = bundle.projects.records;
    return {leads: records.length, uk_leads: records.filter(isUK).length,
      countries: bundle.projects.country_count, quarantined: bundle.audit.quarantined_count,
      baseline: bundle.baseline.record_count, official_source_records: bundle.official.projects.length,
      groups_provisional: bundle.groups.provisional_count, groups_unlinked: bundle.groups.unlinked_count,
      verified_facilities: 0};
  }
  return {validateProjects, validateAudit, validateOfficial, validateGroups, validateBundle,
    selectRows, isUK, safeUrl, mapUrl, mw, csv, summary};
});
