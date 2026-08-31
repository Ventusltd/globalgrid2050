/**
 * PipelineNews grid-proximity cartridge.
 * Generation 202608311530. DRAFT - deployment: not-authorised.
 *
 * ADDITIVE ONLY. Adds a tabbed panel inside its own host div. It does not
 * modify, re-render, restyle or re-order any existing part of the application.
 * If it fails to load, the core product is unchanged.
 *
 * What it adds, all of it ported from work that already exists in the estate:
 *
 *   RADIUS      Geodesic radius search around any centre, using the same
 *               haversine and the same Earth radius as the GridAtlas radius
 *               tool (ventus-corev8engine.js) and the GIS SLD sandbox
 *               (atlasHaversineKm). A distance read here equals the distance
 *               read there.
 *
 *   SORT        The project table sorted by capacity, town, county, postcode
 *               region, circuit distance or substation distance. Click a
 *               heading; click again to reverse.
 *
 *   CONNECT     For every project, the line to the nearest point on the
 *               nearest circuit and the line to the nearest substation, the
 *               same nearestPointOnLine idea the sandbox uses for cable
 *               routes. Exports as GeoJSON that the Atlas and the sandbox
 *               both already read.
 *
 *   METHOD      What the numbers are, and what they are not.
 *
 * PUBLIC WORDING: caveats are read from the payload's `caveat` block. Nothing
 * about accuracy is hardcoded here. To change wording, edit build_payload.py
 * and regenerate.
 *
 * It uses only classes already in the frozen stylesheet (.card, .btn,
 * .filters, .gauges, .meta, .section-title) so it inherits the design freeze.
 */

export const GRID_PROXIMITY_CARTRIDGE_CONTRACT = Object.freeze({
  schema: "pipelinenews.grid-proximity-cartridge.v1",
  generation: "202608311530",
  deployment: "not-authorised",
  activation: "dynamic-import-on-user-open; payload-fetch-on-first-tab-selection",
  additive_only: true,
  mutates_existing_dom: false,
  project_bindings: 0,
  eligible_for_news_signal: false,
  asserts_no_personal_data: true,
  derived_values_are_inferred: true,
  corroboration_adapters_built: false,
  one_signal_policy: "WITHHOLD",
  tabs: Object.freeze(["RADIUS", "SORT", "CONNECT", "METHOD"]),
});

/* ---- geodesy -------------------------------------------------------------
   Byte-for-byte the same formula and constant as ventus-corev8engine.js
   haversine() and gis-sld-v5-drawing.js atlasHaversineKm(). Do not "improve"
   this to 6371.0088 - that is what made the old circuit_km read 0.112% short
   and disagree with every other Ventus tool.                               */
const R_ATLAS = 6378.137;
const DEG = Math.PI / 180;

function atlasHaversineKm(lon1, lat1, lon2, lat2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return R_ATLAS * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/* A cheap bounding box in degrees, so a radius query does not measure every
   project. Latitude is the tighter bound; longitude widens with latitude. */
function boundingBox(lon, lat, km) {
  const dLat = km / (R_ATLAS * DEG);
  const cos = Math.max(Math.cos(lat * DEG), 1e-6);
  return { dLat, dLon: dLat / cos };
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const km = (v) => (!Number.isFinite(v) ? "n/a" : v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(2)} km`);
const mw = (v) => (!Number.isFinite(v) ? "n/a" : v >= 100 ? v.toFixed(0) : v.toFixed(1));

export function mountGridProximity({ host, payloadAsset }) {
  let payloadRequests = 0;
  let data = null;
  let active = "RADIUS";

  const root = document.createElement("div");
  root.className = "card";
  host.appendChild(root);

  const tabs = document.createElement("div");
  tabs.className = "filters";
  tabs.setAttribute("role", "tablist");
  const body = document.createElement("div");
  const note = document.createElement("p");
  note.className = "meta";

  root.append(tabs, note, body);

  GRID_PROXIMITY_CARTRIDGE_CONTRACT.tabs.forEach((code) => {
    const b = document.createElement("button");
    b.className = "btn";
    b.type = "button";
    b.textContent = code;
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => select(code));
    tabs.appendChild(b);
  });

  function markTabs() {
    Array.from(tabs.children).forEach((b) => {
      const on = b.textContent === active;
      b.setAttribute("aria-selected", String(on));
      b.style.fontWeight = on ? "bold" : "";
    });
  }

  async function ensurePayload() {
    if (data) return data;
    note.textContent = "LOAD · requesting the derived proximity index";
    payloadRequests += 1;
    const response = await fetch(payloadAsset.url);
    if (!response.ok) throw new Error(`payload ${response.status}`);
    data = await response.json();
    if (data.schema !== "pipelinenews.v9.grid-proximity.v1") {
      throw new Error("unexpected payload schema");
    }
    note.textContent = `${data.record_count} projects · ${data.network.segments.toLocaleString()} circuit segments · `
      + `${data.network.substations.toLocaleString()} substations · ${data.network.voltages_kv.join("/")} kV`;
    return data;
  }

  async function select(code) {
    active = code;
    markTabs();
    body.textContent = "";
    try {
      const d = await ensurePayload();
      if (code === "RADIUS") renderRadius(d);
      else if (code === "SORT") renderSort(d);
      else if (code === "CONNECT") renderConnect(d);
      else renderMethod(d);
    } catch (error) {
      console.error("grid proximity", error);
      note.textContent = "FAIL · grid proximity unavailable; core product unchanged";
    }
  }

  /* ---- RADIUS ---------------------------------------------------------- */
  function renderRadius(d) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="section-title">PROJECTS WITHIN A RADIUS</p>
      <p class="meta">Centre on any project by name or REPD reference, or type a coordinate as
        <code>lat, lon</code>. Distances are ${esc(d.earth_model.formula)} on
        R = ${d.earth_model.radius_km} km, the same figure the Atlas radius tool uses.</p>
      <div class="filters">
        <input id="gpCentre" type="text" placeholder="Project name, REPD ref, or lat, lon" style="min-width:18rem">
        <input id="gpRadius" type="number" value="10" min="0.1" max="500" step="0.5" style="width:6rem">
        <span class="meta">km</span>
        <button class="btn" id="gpGo" type="button">SEARCH</button>
      </div>
      <div id="gpOut"></div>`;
    body.appendChild(wrap);

    const run = () => {
      const out = wrap.querySelector("#gpOut");
      const raw = wrap.querySelector("#gpCentre").value.trim();
      const radius = Math.max(0.1, Math.min(500, Number(wrap.querySelector("#gpRadius").value) || 10));
      if (!raw) { out.innerHTML = `<p class="meta">Enter a centre to search from.</p>`; return; }

      let centre = null;
      let label = "";
      const coord = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (coord) {
        centre = [Number(coord[2]), Number(coord[1])];
        label = `${centre[1].toFixed(5)}, ${centre[0].toFixed(5)}`;
      } else {
        const needle = raw.toLowerCase();
        const hit = d.rows.find((r) => r.ref === raw)
          || d.rows.find((r) => (r.name || "").toLowerCase().includes(needle));
        if (!hit) { out.innerHTML = `<p class="meta">No project matches that. Try a REPD reference, or <code>lat, lon</code>.</p>`; return; }
        centre = hit.at;
        label = `${hit.name} (REPD ${hit.ref})`;
      }

      const box = boundingBox(centre[0], centre[1], radius);
      const found = [];
      for (const r of d.rows) {
        if (Math.abs(r.at[1] - centre[1]) > box.dLat) continue;
        if (Math.abs(r.at[0] - centre[0]) > box.dLon) continue;
        const dist = atlasHaversineKm(centre[0], centre[1], r.at[0], r.at[1]);
        if (dist <= radius) found.push({ r, dist });
      }
      found.sort((a, b) => a.dist - b.dist);

      const totalMw = found.reduce((s, f) => s + (f.r.mw || 0), 0);
      out.innerHTML = `
        <div class="gauges">
          <div><strong>${found.length}</strong><span>projects within ${radius} km</span></div>
          <div><strong>${mw(totalMw)}</strong><span>MW in the circle</span></div>
          <div><strong>${esc(label)}</strong><span>centre</span></div>
        </div>
        ${table(found.map((f) => ({ ...f.r, _d: f.dist })), [
          ["_d", "DISTANCE", (r) => km(r._d)],
          ["name", "PROJECT", (r) => esc(r.name)],
          ["mw", "MW", (r) => mw(r.mw)],
          ["tech", "TECH", (r) => esc(r.tech)],
          ["town", "TOWN", (r) => esc(r.town)],
          ["circuit", "CIRCUIT", (r) => (r.circuit ? `${km(r.circuit.km)} · ${r.circuit.kv} kV` : "n/a")],
        ])}`;
    };

    wrap.querySelector("#gpGo").addEventListener("click", run);
    wrap.querySelector("#gpCentre").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  }

  /* ---- SORT ------------------------------------------------------------ */
  function renderSort(d) {
    let key = "mw";
    let dir = -1;
    const wrap = document.createElement("div");
    body.appendChild(wrap);

    const columns = [
      ["name", "PROJECT", (r) => esc(r.name)],
      ["mw", "MW", (r) => mw(r.mw)],
      ["tech", "TECH", (r) => esc(r.tech)],
      ["town", "TOWN", (r) => esc(r.town)],
      ["county", "COUNTY", (r) => esc(r.county)],
      ["region", "REGION", (r) => esc(r.region)],
      ["_ckm", "CIRCUIT", (r) => (r.circuit ? km(r.circuit.km) : "n/a")],
      ["_ckv", "kV", (r) => (r.circuit ? r.circuit.kv : "n/a")],
      ["_skm", "SUBSTATION", (r) => (r.substation ? km(r.substation.km) : "n/a")],
    ];

    const value = (r, k) => (
      k === "_ckm" ? (r.circuit ? r.circuit.km : Infinity)
        : k === "_ckv" ? (r.circuit ? r.circuit.kv : -1)
          : k === "_skm" ? (r.substation ? r.substation.km : Infinity)
            : r[k]);

    function draw() {
      const rows = d.rows.slice().sort((a, b) => {
        const x = value(a, key);
        const y = value(b, key);
        if (typeof x === "string" || typeof y === "string") {
          return String(x || "").localeCompare(String(y || "")) * dir;
        }
        return ((x ?? Infinity) - (y ?? Infinity)) * dir;
      });
      wrap.innerHTML = `
        <p class="section-title">EVERY PROJECT, SORTED</p>
        <p class="meta">Click a heading to sort. Click it again to reverse. Sorting by town or county
          clusters a region together; sorting by circuit distance puts the best-connected first.</p>
        ${table(rows.slice(0, 400), columns, key, dir)}
        <p class="meta">Showing the first 400 of ${d.record_count}. Narrow with the RADIUS tab.</p>`;
      wrap.querySelectorAll("th[data-k]").forEach((th) => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
          const k = th.dataset.k;
          if (k === key) dir = -dir; else { key = k; dir = (k === "name" || k === "town" || k === "county" || k === "region" || k === "tech") ? 1 : -1; }
          draw();
        });
      });
    }
    draw();
  }

  /* ---- CONNECT --------------------------------------------------------- */
  function renderConnect(d) {
    const wrap = document.createElement("div");
    const closest = d.rows
      .filter((r) => r.substation && r.circuit)
      .slice()
      .sort((a, b) => a.substation.km - b.substation.km)
      .slice(0, 60);
    wrap.innerHTML = `
      <p class="section-title">AUTO-DRAWN CONNECTIONS</p>
      <p class="meta">For every project the panel holds two indicative lines: the site to the
        nearest point on the nearest circuit, and the site to the nearest mapped substation.
        The circuit point is a true perpendicular onto the line, not the nearest drawn vertex.
        ${esc(d.caveat.substation)}</p>
      <div class="filters">
        <button class="btn" id="gpGeo" type="button">EXPORT ALL AS GEOJSON</button>
        <span class="meta">Opens in the Atlas and the GIS SLD sandbox</span>
      </div>
      ${table(closest, [
        ["name", "PROJECT", (r) => esc(r.name)],
        ["mw", "MW", (r) => mw(r.mw)],
        ["_sub", "NEAREST SUBSTATION", (r) => esc(r.substation.name || "unnamed")],
        ["_skv", "kV", (r) => (r.substation.kv.length ? r.substation.kv.join("/") : "n/a")],
        ["_skm", "TO SUBSTATION", (r) => km(r.substation.km)],
        ["_ckm", "TO CIRCUIT", (r) => `${km(r.circuit.km)} · ${r.circuit.kv} kV`],
      ])}
      <p class="meta">The 60 projects closest to a mapped substation. Every one of the
        ${d.record_count} rows carries the same two lines in the export.</p>`;
    body.appendChild(wrap);

    wrap.querySelector("#gpGeo").addEventListener("click", () => {
      const features = [];
      for (const r of d.rows) {
        if (r.circuit) {
          features.push(lineFeature(r.at, r.circuit.foot, {
            type: "indicative_circuit_connection",
            repd_ref: r.ref, project: r.name, mw: r.mw,
            circuit_kv: r.circuit.kv, circuit_name: r.circuit.line || null,
            length_km: r.circuit.km,
            measurement_method: "atlas_haversine_6378_137_km",
            basis: "perpendicular to the nearest mapped circuit segment",
          }));
        }
        if (r.substation) {
          features.push(lineFeature(r.at, r.substation.at, {
            type: "indicative_substation_connection",
            repd_ref: r.ref, project: r.name, mw: r.mw,
            substation: r.substation.name || null,
            substation_kv: r.substation.kv,
            length_km: r.substation.km,
            measurement_method: "atlas_haversine_6378_137_km",
            basis: "straight line to the nearest mapped substation point",
          }));
        }
      }
      const blob = new Blob([JSON.stringify({
        type: "FeatureCollection",
        properties: {
          generation: d.generation,
          note: "Indicative screening geometry. Not a cable route, wayleave or connection offer.",
          caveat: d.caveat,
          provenance: d.provenance,
        },
        features,
      })], { type: "application/geo+json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${d.generation}-indicative-connections.geojson`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  }

  function lineFeature(from, to, properties) {
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [from, to] },
      properties,
    };
  }

  /* ---- METHOD ---------------------------------------------------------- */
  function renderMethod(d) {
    const e = d.earth_model;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="section-title">HOW THESE DISTANCES ARE MEASURED</p>
      <p class="meta"><strong>Formula.</strong> ${esc(e.formula)} on a sphere of
        R = ${e.radius_km} km. ${esc(e.radius_source)}. The same constant is used by
        ${e.matches.map((m) => `<code>${esc(m)}</code>`).join(" and ")}, so a distance measured
        here equals the same distance measured there.</p>
      <p class="meta"><strong>To a circuit.</strong> ${esc(d.network.measure)}, across
        ${d.network.segments.toLocaleString()} segments of
        ${esc(d.network.voltages_kv.join("/"))} kV line. The site is projected onto the segment on a
        local tangent plane built from the WGS84 radii of curvature at its own latitude
        (${esc(e.segment_projection)}), so the foot of the perpendicular is correct rather than
        snapped to the nearest drawn vertex.</p>
      <p class="meta"><strong>To a substation.</strong> Straight line to the nearest of
        ${d.network.substations.toLocaleString()} mapped substation points.</p>
      <p class="meta"><strong>Straight line.</strong> ${esc(d.caveat.straight_line)}</p>
      <p class="meta"><strong>Substations.</strong> ${esc(d.caveat.substation)}</p>
      <p class="meta"><strong>Coverage.</strong> ${esc(d.caveat.coverage)}</p>
      <p class="meta"><strong>Precision.</strong> ${esc(d.caveat.precision)}</p>
      <p class="meta"><strong>What changed.</strong> The earlier
        <code>circuit_km</code> measured to the nearest point of a decimated sample of
        400/275/132 kV vertices on a ${e.differs_from.project_intelligence_circuit_km} km sphere,
        which reads ${e.differs_from.reads_short_by_pct}% short and could only overstate the
        distance to the conductor. This figure measures to the line itself, includes 220 and
        66 kV, and uses the Atlas radius.</p>
      <p class="meta"><strong>Provenance.</strong> ${esc(d.provenance.spine)}. ${esc(d.provenance.network)}.</p>`;
    body.appendChild(wrap);
  }

  /* ---- shared table ---------------------------------------------------- */
  function table(rows, columns, sortKey, sortDir) {
    const head = columns.map(([k, label]) => {
      const mark = k === sortKey ? (sortDir === 1 ? " ▲" : " ▼") : "";
      return `<th data-k="${esc(k)}" scope="col">${esc(label)}${mark}</th>`;
    }).join("");
    const cells = rows.map((r) => `<tr>${columns.map(([, , render]) => `<td>${render(r)}</td>`).join("")}</tr>`).join("");
    return `<div style="overflow-x:auto"><table><thead><tr>${head}</tr></thead><tbody>${cells}</tbody></table></div>`;
  }

  markTabs();
  note.textContent = "WAIT · four tabs · choose one to request the derived proximity index";

  return { payloadRequests, projectBindings: 0 };
}
