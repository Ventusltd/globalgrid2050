/* Sector Star — testcode/202609150125.
   Every number on this page is read from data/*.json at run time; none is typed into the HTML.
   No randomness: this file contains no Math.random and no other random source.
   URL keys are permanent: ?lens=map|sector|energy&district=<outcode>&sector=<SIC code>  */
'use strict';

var D = { sectors: null, geography: null, provenance: null };
var CATS = ['farmers', 'manufacturers', 'other_high_energy', 'rest'];
var LENSES = ['map', 'sector', 'energy'];
var el = function (id) { return document.getElementById(id); };
var nf = new Intl.NumberFormat('en-GB');
var n = function (v) { return v === null || v === undefined ? null : nf.format(Math.round(v)); };

function money(v) { return v === null || v === undefined ? null : '£' + nf.format(Math.round(v)); }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function withheld(reason) { return '<span class="withheld">withheld (' + esc(reason) + ')</span>'; }
function catName(id) { var c = (D.sectors.categories || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
function catColour(id) { return (D.sectors.category_colours || {})[id] || '#8b93a7'; }
/* the origin of the distance bands, named by the data, never typed into the page */
function originName() { var g = D.geography; return g.home_label || g.home_outcode || 'the origin'; }

/* ---- URL state (permanent keys only) ---- */
function q() { return new URLSearchParams(location.search); }
function setQ(k, v) {
  var p = q();
  if (v === null || v === undefined || v === '') p.delete(k); else p.set(k, v);
  history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
  render();
}
function lens() { var l = q().get('lens'); return LENSES.indexOf(l) >= 0 ? l : 'map'; }

/* ---- the count sentence: one string, built from the JSON ---- */
function countsLine() {
  var s = D.sectors, g = D.geography, p = D.provenance;
  var dates = (p.sources[1] && p.sources[1].months) || [];
  var built = (p.built_utc || '').slice(0, 16).replace('T', ' ');
  return nf.format(s.population) + ' qualifying companies · ' +
    nf.format(s.sections.length) + ' SIC sections · ' +
    nf.format(s.divisions.length) + ' divisions · ' +
    nf.format(s.groups.length) + ' groups · ' +
    nf.format(g.districts.length) + ' postcode districts · ' +
    nf.format(g.regions.length) + ' regions · ' +
    nf.format(s.categories.filter(function (c) { return c.id === 'farmers'; })[0].count) + ' farmers · ' +
    nf.format(s.categories.filter(function (c) { return c.id === 'manufacturers'; })[0].count) + ' manufacturers · ' +
    nf.format(s.categories.filter(function (c) { return c.id === 'other_high_energy'; })[0].count) + ' other high energy · ' +
    'accounts ' + (dates.length ? dates.length + ' monthly files' : 'not stated') +
    ', register ' + esc(p.sources[0].snapshot) + ' · data ' + built + ' UTC';
}

/* ---- map lens: outcode centroids on a plain equirectangular canvas ---- */
function drawMap() {
  var c = el('map'); if (!c) return;
  var W = c.clientWidth, H = Math.round(W * 1.15), dpr = window.devicePixelRatio || 1;
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  c.style.height = H + 'px';
  var x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  var pts = D.geography.districts.filter(function (d) { return d.lat !== null && d.lon !== null; });
  if (!pts.length) return;
  var la = pts.map(function (d) { return d.lat; }), lo = pts.map(function (d) { return d.lon; });
  var la0 = Math.min.apply(null, la), la1 = Math.max.apply(null, la);
  var lo0 = Math.min.apply(null, lo), lo1 = Math.max.apply(null, lo);
  var k = Math.cos((la0 + la1) / 2 * Math.PI / 180);
  var pad = 14;
  var sx = (W - 2 * pad) / ((lo1 - lo0) * k), sy = (H - 2 * pad) / (la1 - la0);
  var s = Math.min(sx, sy);
  var ox = pad + ((W - 2 * pad) - (lo1 - lo0) * k * s) / 2;
  var oy = pad + ((H - 2 * pad) - (la1 - la0) * s) / 2;
  var px = function (d) { return ox + (d.lon - lo0) * k * s; };
  var py = function (d) { return oy + (la1 - d.lat) * s; };
  var maxN = pts.reduce(function (a, d) { return Math.max(a, d.count); }, 1);
  window.__hit = [];
  pts.slice().sort(function (a, b) { return b.count - a.count; }).forEach(function (d) {
    var best = 'rest', bv = -1;
    CATS.forEach(function (cid) { var v = d.categories[cid]; if (v !== null && v > bv) { bv = v; best = cid; } });
    var r = Math.max(2.2, Math.sqrt(d.count / maxN) * 15);
    var X = px(d), Y = py(d);
    x.beginPath(); x.arc(X, Y, r, 0, Math.PI * 2);
    x.fillStyle = catColour(best); x.globalAlpha = 0.55; x.fill();
    x.globalAlpha = 1; x.lineWidth = 0.6; x.strokeStyle = catColour(best); x.stroke();
    window.__hit.push({ d: d, x: X, y: Y, r: Math.max(r, 11) });
  });
  var home = D.geography.home_centroid;
  if (home && home.lat !== null) {
    var hx = ox + (home.lon - lo0) * k * s, hy = oy + (la1 - home.lat) * s;
    x.globalAlpha = 1; x.strokeStyle = '#d8dee9'; x.lineWidth = 1;
    x.beginPath(); x.arc(hx, hy, 6, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(hx - 10, hy); x.lineTo(hx + 10, hy); x.moveTo(hx, hy - 10); x.lineTo(hx, hy + 10); x.stroke();
  }
  c.onclick = function (ev) {
    var b = c.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top, pick = null, pd = 1e9;
    window.__hit.forEach(function (h) {
      var dd = (h.x - mx) * (h.x - mx) + (h.y - my) * (h.y - my);
      if (dd <= h.r * h.r && dd < pd) { pd = dd; pick = h.d; }
    });
    if (pick) setQ('district', pick.outcode);
  };
}

function catRow(o) {
  return CATS.map(function (cid) {
    var v = o.categories[cid];
    return '<tr><td><span class="dot" style="background:' + catColour(cid) + '"></span> ' + esc(catName(cid)) +
      '</td><td class="n">' + (v === null ? withheld('n &lt; 5') : n(v)) + '</td></tr>';
  }).join('');
}

function districtCard(code) {
  var d = D.geography.districts.filter(function (x) { return x.outcode === code; })[0];
  if (!d) return '<div class="panel"><h2>District ' + esc(code) + '</h2><p class="k">Not published: ' +
    'either it is not in the qualifying population, or it holds fewer than 5 companies and is withheld.</p></div>';
  return '<div class="panel"><h2>Postcode district ' + esc(d.outcode) + '</h2>' +
    '<p class="k">' + esc(d.region || 'region not stated') + (d.county ? ' · ' + esc(d.county) : '') +
    (d.miles_from_origin === null || d.miles_from_origin === undefined ? '' : ' · ' + d.miles_from_origin + ' miles from ' + esc(originName()) + ' (straight line) · ' + esc(d.band)) + '</p>' +
    '<table><tr><th>companies</th><td class="n">' + n(d.count) + '</td></tr>' + catRow(d) +
    (d.folded_into_other ? '<tr><td class="withheld">folded into other (n &lt; 5)</td><td class="n">' + n(d.folded_into_other) + '</td></tr>' : '') +
    '<tr><th>median net worth</th><td class="n">' + (d.median_net_worth_gbp === null ? withheld('n &lt; 5') : money(d.median_net_worth_gbp)) + '</td></tr>' +
    '<tr><th>median cash</th><td class="n">' + (d.median_cash_gbp === null ? withheld('n &lt; 5') : money(d.median_cash_gbp)) + '</td></tr>' +
    '<tr><th>filing SECR energy</th><td class="n">' + (d.n_filing_energy ? n(d.n_filing_energy) : 'not filed') + '</td></tr>' +
    '</table><p><button onclick="setQ(\'district\',\'\')" style="min-height:44px">close</button></p></div>';
}

function mapLens() {
  var g = D.geography, dcode = q().get('district');
  var bands = g.distance_bands.map(function (b) {
    return '<tr><td>' + esc(b.band) + '</td><td class="n">' + n(b.count) + '</td>' +
      CATS.map(function (c) { return '<td class="n">' + (b.categories[c] === null ? '&lt;5' : n(b.categories[c])) + '</td>'; }).join('') + '</tr>';
  }).join('');
  var regions = g.regions.map(function (r) {
    return '<tr><td>' + esc(r.region) + '</td><td class="n">' + n(r.count) + '</td>' +
      CATS.map(function (c) { return '<td class="n">' + (r.categories[c] === null ? '&lt;5' : n(r.categories[c])) + '</td>'; }).join('') + '</tr>';
  }).join('');
  var top = g.districts.slice(0, 40).map(function (d) {
    return '<tr class="row" onclick="setQ(\'district\',\'' + esc(d.outcode) + '\')"><td>' + esc(d.outcode) + '</td>' +
      '<td>' + esc(d.region || '—') + '</td><td class="n">' + n(d.count) + '</td>' +
      '<td class="n">' + (d.categories.farmers === null ? '&lt;5' : n(d.categories.farmers)) + '</td>' +
      '<td class="n">' + (d.categories.manufacturers === null ? '&lt;5' : n(d.categories.manufacturers)) + '</td>' +
      '<td class="n">' + (d.categories.other_high_energy === null ? '&lt;5' : n(d.categories.other_high_energy)) + '</td></tr>';
  }).join('');
  return '<canvas id="map" aria-label="postcode district centroids sized by company count"></canvas>' +
    '<p class="k">Each disc is one postcode district, area proportional to its company count, coloured by its largest ' +
    'category. The cross is the origin, ' + esc(originName()) + '. Districts with fewer than 5 companies are not drawn: ' + n(g.districts_withheld_n_lt_5) +
    ' companies sit in those withheld districts' + (g.districts_removed && g.districts_removed.companies ? '; ' + n(g.districts_removed.companies) + ' sit in ' + n(g.districts_removed.districts) + ' district withdrawn from publication' : '') + '. Tap a disc for the district card.</p>' +
    (dcode ? districtCard(dcode) : '') +
    '<div class="panel"><h2>By straight-line distance from ' + esc(originName()) + '</h2><div class="wrap"><table>' +
    '<tr><th>band</th><th class="n">companies</th><th class="n">farm</th><th class="n">mfg</th><th class="n">high</th><th class="n">rest</th></tr>' +
    bands + '</table></div>' + (g.distance_bands_basis ? '<p class="k">' + esc(g.distance_bands_basis) + '</p>' : '') + '</div>' +
    '<div class="panel"><h2>By England region and Wales</h2><div class="wrap"><table>' +
    '<tr><th>region</th><th class="n">companies</th><th class="n">farm</th><th class="n">mfg</th><th class="n">high</th><th class="n">rest</th></tr>' +
    regions + '</table></div><p class="k">' + n(g.regions_withheld_n_lt_5) + ' companies sit in regions with fewer than 5 and are withheld.</p></div>' +
    '<div class="panel"><h2>Districts with the largest counts</h2><div class="wrap"><table>' +
    '<tr><th>district</th><th>region</th><th class="n">all</th><th class="n">farm</th><th class="n">mfg</th><th class="n">high</th></tr>' +
    top + '</table></div><p class="k">Counts only. No maximum and no top-N of any money figure is published anywhere on this page.</p></div>';
}

function sectorLens() {
  var s = D.sectors, code = q().get('sector');
  var max = s.divisions.reduce(function (a, d) { return Math.max(a, d.count); }, 1);
  var bars = s.divisions.map(function (d) {
    var w = (d.count / max * 100).toFixed(2);
    var med = d.net_worth_gbp && d.net_worth_gbp.median !== undefined ? money(d.net_worth_gbp.median) : withheld('n &lt; 5');
    return '<tr class="row" onclick="setQ(\'sector\',\'' + esc(d.code) + '\')"><td>' +
      '<b>' + esc(d.code) + '</b> ' + esc(d.name) +
      '<div class="bar" style="width:' + w + '%;background:' + catColour(d.category) + '"></div></td>' +
      '<td class="n">' + n(d.count) + '</td><td class="n">' + med + '</td></tr>';
  }).join('');
  var card = '';
  if (code) {
    var d = s.divisions.filter(function (x) { return x.code === code; })[0];
    if (d) {
      var gs = s.groups.filter(function (g) { return g.division === code; });
      card = '<div class="panel"><h2>' + esc(d.code) + ' ' + esc(d.name) + '</h2>' +
        '<p class="k">section ' + esc(d.section) + ' · ' + esc(catName(d.category)) + ' · ' +
        (d.share * 100).toFixed(2) + '% of the population</p><div class="wrap"><table>' +
        '<tr><th>companies</th><td class="n">' + n(d.count) + '</td></tr>' +
        ['profit_measure_gbp', 'net_worth_gbp', 'cash_gbp', 'wages_gbp', 'employees'].map(function (k) {
          var c = d[k]; if (!c) return '';
          var lbl = k.replace(/_gbp$/, '').replace(/_/g, ' ');
          var m = c.median === undefined ? withheld(c.withheld || 'n &lt; 5') : (k === 'employees' ? n(c.median) : money(c.median));
          var sum = c.sum === null || c.sum === undefined ? withheld(c.sum_withheld || 'n &lt; 10') : (k === 'employees' ? n(c.sum) : money(c.sum));
          return '<tr><th>median ' + esc(lbl) + '</th><td class="n">' + m + '</td></tr>' +
            '<tr><th>total ' + esc(lbl) + '</th><td class="n">' + sum + '</td></tr>';
        }).join('') +
        '<tr><th>filing SECR energy</th><td class="n">' + (d.secr.n_filing_energy || 'not filed') + '</td></tr>' +
        '</table></div><h2 style="margin-top:12px">Groups</h2><div class="wrap"><table>' +
        '<tr><th>group</th><th>classes</th><th class="n">companies</th></tr>' +
        gs.map(function (g) {
          return '<tr><td>' + esc(g.code) + '</td><td class="k">' +
            g.classes.slice(0, 6).map(function (c) { return esc(c.title || c.code) + ' (' + n(c.count) + ')'; }).join('; ') +
            (g.classes_withheld_n_lt_5 ? '; <span class="withheld">' + n(g.classes_withheld_n_lt_5) + ' in classes withheld (n &lt; 5)</span>' : '') +
            '</td><td class="n">' + n(g.count) + '</td></tr>';
        }).join('') + '</table></div>' +
        '<p><button onclick="setQ(\'sector\',\'\')" style="min-height:44px">close</button></p></div>';
    }
  }
  var cats = s.categories.map(function (c) {
    return '<tr><td><span class="dot" style="background:' + c.colour + '"></span> ' + esc(c.name) +
      '<div class="k">' + esc(c.rule) + '</div></td><td class="n">' + n(c.count) + '</td><td class="n">' +
      (c.share * 100).toFixed(1) + '%</td></tr>';
  }).join('');
  return '<div class="panel"><h2>Sector categories</h2><div class="wrap"><table>' +
    '<tr><th>category</th><th class="n">companies</th><th class="n">share</th></tr>' + cats + '</table></div></div>' +
    card +
    '<div class="panel"><h2>By SIC 2007 division</h2><div class="wrap"><table>' +
    '<tr><th>division</th><th class="n">companies</th><th class="n">median net worth</th></tr>' + bars + '</table></div>' +
    '<p class="k">' + n(s.divisions_withheld_or_unknown) + ' companies are in divisions with fewer than 5 or with no parsable SIC code and are withheld. Tap a division for its groups.</p></div>';
}

function energyLens() {
  var s = D.sectors;
  var rows = s.sections.map(function (x) {
    var e = x.secr;
    return '<tr><td>' + esc(x.code) + ' ' + esc(x.name) + '</td><td class="n">' + n(x.count) + '</td>' +
      '<td class="n">' + (e.n_filing_energy || 0) + '</td>' +
      '<td class="n">' + (e.energy_kwh.median === undefined ? withheld(e.energy_kwh.withheld || 'n &lt; 5') : n(e.energy_kwh.median)) + '</td>' +
      '<td class="n">' + (e.energy_kwh.sum === null || e.energy_kwh.sum === undefined ? withheld(e.energy_kwh.sum_withheld || 'not filed') : n(e.energy_kwh.sum)) + '</td></tr>';
  }).join('');
  var catrows = s.categories.map(function (c) {
    var e = c.secr;
    return '<tr><td><span class="dot" style="background:' + c.colour + '"></span> ' + esc(c.name) + '</td>' +
      '<td class="n">' + n(c.count) + '</td><td class="n">' + (e.n_filing_energy || 0) + '</td>' +
      '<td class="n">' + (e.energy_kwh.median === undefined ? withheld(e.energy_kwh.withheld || 'n &lt; 5') : n(e.energy_kwh.median)) + '</td>' +
      '<td class="n">' + (e.n_filing_co2 || 0) + '</td></tr>';
  }).join('');
  var total = s.sections.reduce(function (a, x) { return a + (x.secr.n_filing_energy || 0); }, 0);
  return '<div class="panel"><h2>Filed SECR energy — a filed subset, not the population</h2>' +
    '<p class="k">' + n(total) + ' of ' + n(s.population) + ' companies have a Streamlined Energy and Carbon ' +
    'Reporting energy figure in the filed accounts this build read. Overall median ' +
    (s.secr_overall_median_kwh === null ? 'not available' : n(s.secr_overall_median_kwh) + ' kWh') +
    '. Every figure below describes only the companies that filed one; it is not a population estimate, ' +
    'and it must not be scaled up.</p>' +
    '<div class="wrap"><table><tr><th>category</th><th class="n">companies</th><th class="n">filing kWh</th>' +
    '<th class="n">median kWh</th><th class="n">filing CO2</th></tr>' + catrows + '</table></div></div>' +
    '<div class="panel"><h2>By SIC 2007 section</h2><div class="wrap"><table>' +
    '<tr><th>section</th><th class="n">companies</th><th class="n">filing</th><th class="n">median kWh</th><th class="n">total kWh</th></tr>' +
    rows + '</table></div><p class="k">A total is published only where at least 10 companies filed and the largest ' +
    'single contributor is under half the sum; otherwise it says withheld.</p></div>' +
    '<div class="panel"><h2>Network regions</h2>' +
    (function () {
      var g = D.geography.grid_regions;
      if (!g || !g.dno || !g.dno.length) return '<p class="k">not available in this build</p>';
      return '<p class="k">' + esc(g.note) + '</p><div class="wrap"><table><tr><th>DNO / network region</th><th class="n">companies</th></tr>' +
        g.dno.map(function (r) { return '<tr><td>' + esc(r.dno) + '</td><td class="n">' + n(r.companies) + '</td></tr>'; }).join('') +
        '</table></div>';
    })() + '</div>';
}

function footer() {
  var p = D.provenance, s = D.sectors;
  var links = (p.links || []).map(function (l) {
    return '<div><b>' + esc(l.relation) + '</b> — <a href="' + esc(l.to) + '">' + esc(l.to) + '</a><br>' + esc(l.why) + '</div>';
  }).join('');
  return 'Sector Star · built ' + esc((p.built_utc || '').slice(0, 16).replace('T', ' ')) + ' UTC · ' +
    'sources: Companies House register snapshot ' + esc(p.sources[0].snapshot) + ' and ' +
    esc(String(p.sources[1].count_months)) + ' monthly accounts files; postcodes.io outcodes; UK SIC 2007.<br>' +
    'Qualifying rule: active England and Wales companies whose latest filed accounts show profit, ' +
    'balance sheet net worth or cash of £1,000,000 or more.<br>' +
    'Suppression: any group of fewer than 5 companies is withheld and folded into other; a sum is published only ' +
    'where at least 10 companies contribute and the largest single contributor is under 50% of it; no maximum and ' +
    'no top-N is ever published. Withheld cells this build: ' + n(p.suppression.tally.cells_withheld_n_lt_5) +
    '; withheld sums: ' + n(p.suppression.tally.sums_withheld_n_lt_10 + p.suppression.tally.sums_withheld_dominant_contributor + p.suppression.tally.sums_withheld_not_positive) + '.<br>' +
    'Energy: ' + n(p.counts.filing_secr_energy) + ' of ' + n(s.population) + ' companies filed a SECR energy figure, so every ' +
    'energy number here describes a filed subset, not the population, and must not be scaled up.<br>' +
    'No company name, registration number, address, full postcode or link appears in any file here. ' +
    'Data files: ' + p.outputs.map(function (o) { return esc(o.file) + ' ' + esc(o.sha256.slice(0, 12)); }).join(' · ') +
    '<div class="links"><b>links</b>' + links + '</div>';
}

function render() {
  var L = lens();
  el('tabs').innerHTML = LENSES.map(function (x) {
    return '<button role="tab" aria-selected="' + (x === L) + '" onclick="setQ(\'lens\',\'' + x + '\')">' + x + '</button>';
  }).join('');
  el('legend').innerHTML = (D.sectors.categories || []).map(function (c) {
    return '<span><i class="dot" style="background:' + c.colour + '"></i>' + esc(c.name) + '</span>';
  }).join('');
  el('counts').textContent = countsLine();
  el('view').innerHTML = L === 'sector' ? sectorLens() : L === 'energy' ? energyLens() : mapLens();
  el('foot').innerHTML = footer();
  if (L === 'map') drawMap();
}

function load(name) {
  return fetch('data/' + name + '.json', { cache: 'default' }).then(function (r) {
    if (!r.ok) throw new Error('data/' + name + '.json returned HTTP ' + r.status);
    return r.json();
  });
}

Promise.all([load('sectors'), load('geography'), load('provenance')]).then(function (r) {
  D.sectors = r[0]; D.geography = r[1]; D.provenance = r[2];
  window.SECTOR_STAR = D;
  render();
  var t = null;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (lens() === 'map') drawMap(); }, 150); });
}).catch(function (e) {
  el('counts').textContent = '';
  el('view').innerHTML = '<div class="fail">Could not load the data: ' + esc(e.message) + '. Check the connection and reload.</div>';
});
