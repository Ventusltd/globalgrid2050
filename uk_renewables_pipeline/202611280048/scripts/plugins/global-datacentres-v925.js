/* Separate global data-centre sample. No REPD joins or inferred MW/status. */
(function (root) {
  'use strict';
  var SCHEMA = 'globalgrid2050.global-datacentres.projects.v1';
  var METRICS = {it_load_mw: 'IT load', site_demand_mw: 'Site demand', grid_connection_mw: 'Grid connection'};

  function https(value) {
    try { var u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
    catch (_) { return false; }
  }
  function validPoint(point) {
    return point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180 &&
      Number.isFinite(point.precision_degrees) && point.precision_degrees > 0;
  }
  function validate(data) {
    if (!data || data.schema !== SCHEMA || data.scope !== 'global' || !Array.isArray(data.records) ||
        !data.records.length || data.records.length !== data.record_count || typeof data.coverage !== 'string') throw new Error('Invalid global data-centre schema');
    var ids = new Set(), countries = new Set();
    data.records.forEach(function (p) {
      if (!p || !/^DC-WD-Q[1-9][0-9]*$/.test(p.id) || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() ||
          p.record_type !== 'data_centre' || p.verification_status !== 'SOURCE_INDEXED' || p.operating_status !== 'not_assessed' ||
          !p.country || !/^Q[1-9][0-9]*$/.test(p.country.wikidata_id) || typeof p.country.name !== 'string' ||
          !(p.operator === null || typeof p.operator === 'string') ||
          !(p.location === null || validPoint(p.location)) || !p.source || p.source.licence !== 'CC0-1.0' ||
          !https(p.source.url) || !https(p.source.revision_url) || !https(p.source.licence_url) ||
          !Number.isInteger(p.source.revision) || !/^\d{4}-\d{2}-\d{2}T/.test(p.source.retrieved_at)) throw new Error('Invalid sourced data-centre record');
      Object.keys(METRICS).forEach(function (key) {
        if (!p.capacity || !p.capacity_sources || !Object.prototype.hasOwnProperty.call(p.capacity, key)) throw new Error('Missing capacity metric');
        var value = p.capacity[key];
        if (!(value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && https(p.capacity_sources[key])))) throw new Error('Unsourced or invalid capacity metric');
      });
      ids.add(p.id); countries.add(p.country.wikidata_id);
    });
    if (countries.size !== data.country_count) throw new Error('Country count differs');
    return data;
  }
  function filter(records, query, country) {
    var text = String(query || '').trim().toLocaleLowerCase();
    return records.filter(function (p) {
      return (!country || p.country.wikidata_id === country) &&
        (!text || [p.name, p.id, p.operator || '', p.country.name].join(' ').toLocaleLowerCase().includes(text));
    });
  }
  function mapUrl(record) {
    if (!validPoint(record.location)) return null;
    var p = record.location, zoom = p.precision_degrees > 0.01 ? 8 : 14;
    return 'https://www.openstreetmap.org/?mlat=' + p.latitude + '&mlon=' + p.longitude + '#map=' + zoom + '/' + p.latitude + '/' + p.longitude;
  }
  function capacityLabels(record) {
    return Object.keys(METRICS).map(function (key) {
      return METRICS[key] + ': ' + (record.capacity[key] === null ? 'not reported' : record.capacity[key] + ' MW');
    });
  }
  function element(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function link(label, url) {
    var e = element('a', null, label);
    e.href = url; e.target = '_blank'; e.rel = 'noopener noreferrer'; return e;
  }
  function card(record) {
    var row = element('article', 'gdc-card'); row.dataset.dcId = record.id;
    row.appendChild(element('h3', null, record.name));
    row.appendChild(element('p', 'gdc-meta', record.country.name + ' · ' + record.id));
    row.appendChild(element('p', 'gdc-meta', 'Operator: ' + (record.operator || 'not reported')));
    row.appendChild(element('p', 'gdc-meta', 'Source-indexed · operating status not assessed'));
    var capacity = element('ul', 'gdc-capacity');
    capacityLabels(record).forEach(function (text) { capacity.appendChild(element('li', null, text)); });
    row.appendChild(capacity);
    var links = element('div', 'gdc-links');
    links.appendChild(link('Wikidata source revision', record.source.revision_url));
    var map = mapUrl(record);
    if (map) {
      links.appendChild(link(record.location.precision_degrees > 0.01 ? 'Map — approximate source point' : 'Map — sourced point', map));
      row.appendChild(element('p', 'gdc-meta', 'Coordinate precision in source: ' + record.location.precision_degrees + '°; not a surveyed accuracy claim.'));
    } else links.appendChild(element('span', 'gdc-meta', 'Map unavailable — coordinates not reported'));
    row.appendChild(links);
    row.appendChild(element('p', 'gdc-meta', 'Retrieved ' + record.source.retrieved_at.slice(0, 10) + ' · CC0 structured data'));
    return row;
  }
  function render(host, data) {
    host.replaceChildren();
    host.appendChild(element('h2', null, 'GLOBAL DATA CENTRES'));
    host.appendChild(element('p', 'gdc-summary', data.record_count + ' source-indexed sites in ' + data.country_count + ' countries. ' + data.coverage));
    var attribution = element('p', 'gdc-meta', 'Structured facts from ');
    attribution.appendChild(link('Wikidata · CC0', 'https://www.wikidata.org/wiki/Wikidata:Copyright'));
    attribution.appendChild(document.createTextNode('. IT load, total site demand and grid connection capacity are separate quantities. Unknown values remain unreported.'));
    host.appendChild(attribution);
    var tools = element('div', 'gdc-toolbar');
    var searchLabel = element('label', null, 'Search global data centres');
    var search = element('input'); search.type = 'search'; search.id = 'globalDcSearch'; search.setAttribute('aria-label', 'Search global data centres');
    searchLabel.appendChild(search); tools.appendChild(searchLabel);
    var countryLabel = element('label', null, 'Country');
    var country = element('select'); country.id = 'globalDcCountry'; country.setAttribute('aria-label', 'Country');
    var all = element('option', null, 'All countries'); all.value = ''; country.appendChild(all);
    var choices = new Map(data.records.map(function (p) { return [p.country.wikidata_id, p.country.name]; }));
    Array.from(choices).sort(function (a,b) { return a[1].localeCompare(b[1]); }).forEach(function (c) {
      var option = element('option', null, c[1]); option.value = c[0]; country.appendChild(option);
    });
    countryLabel.appendChild(country); tools.appendChild(countryLabel); host.appendChild(tools);
    var status = element('p', 'gdc-summary'); status.id = 'globalDcCount'; status.setAttribute('role', 'status'); host.appendChild(status);
    var list = element('div', 'gdc-list'); host.appendChild(list);
    function update() {
      var rows = filter(data.records, search.value, country.value); list.replaceChildren();
      status.textContent = rows.length + ' of ' + data.record_count + ' sites shown';
      if (!rows.length) list.appendChild(element('p', 'gdc-empty', 'No sites match these filters in this sample.'));
      rows.forEach(function (p) { list.appendChild(card(p)); });
    }
    search.addEventListener('input', update); country.addEventListener('change', update); update();
  }
  function init(host) {
    if (!host || host.dataset.globalDcStarted === 'true') return Promise.resolve();
    host.dataset.globalDcStarted = 'true'; host.textContent = 'Loading global data-centre sample…';
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 8000);
    return fetch('global-datacentres/projects.json', {signal: controller.signal})
      .then(function (response) { if (!response.ok) throw new Error('Source unavailable'); return response.json(); })
      .then(validate).then(function (data) { render(host, data); })
      .catch(function () { host.replaceChildren(element('p', 'gdc-error', 'Global data-centre sample unavailable. Try reloading this tab.')); })
      .finally(function () { clearTimeout(timer); });
  }
  var api = {validate: validate, filter: filter, mapUrl: mapUrl, capacityLabels: capacityLabels, init: init};
  root.GlobalDatacentres = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(document.getElementById('globalDatacentres')); });
    else init(document.getElementById('globalDatacentres'));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
