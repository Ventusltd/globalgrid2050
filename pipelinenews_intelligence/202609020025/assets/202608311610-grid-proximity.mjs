/**
 * PipelineNews grid-proximity cartridge.
 * Generation 202608311610. DRAFT - deployment: not-authorised.
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
 *   TARGET      A scope that locks onto a site and draws straight to the
 *               nearest substation, with every voltage in reach shown in the
 *               colour the REPD atlas grid model has always used for it.
 *               Range rings are geodesic. It is a picture of the same
 *               arithmetic the other tabs print as numbers.
 *
 *   METHOD      What the numbers are, and what they are not.
 *
 * PUBLIC WORDING: caveats are read from the payload's `caveat` block. Nothing
 * about accuracy is hardcoded here. To change wording, edit build_payload.py
 * and regenerate.
 *
 * It uses classes already in the frozen stylesheet (.card, .btn, .filters,
 * .gauges, .meta, .section-title) so it inherits the design freeze. The scope
 * adds its own styles, every selector scoped under #gridProximityHost, so
 * nothing outside the cartridge's own host is restyled.
 */

export const GRID_PROXIMITY_CARTRIDGE_CONTRACT = Object.freeze({
  schema: "pipelinenews.grid-proximity-cartridge.v1",
  generation: "202608311610",
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
  tabs: Object.freeze(["RADIUS", "SORT", "CONNECT", "TARGET", "METHOD"]),
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
/* Grid probable is deliberately quiet: a plain word and a rank, no traffic
   lights and no banner. The working is one click away for whoever wants it. */
/* BAND_RANK is gone with the grading it ordered. Nothing sorts by verdict. */
const mw = (v) => (!Number.isFinite(v) ? "n/a" : v >= 100 ? v.toFixed(0) : v.toFixed(1));

export function mountGridProximity({ host, payloadAsset }) {
  let payloadRequests = 0;
  let data = null;
  let active = "RADIUS";
  let pendingTarget = null;

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
      else if (code === "TARGET") renderTarget(d, pendingTarget);
      else renderMethod(d);
      pendingTarget = null;
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
      ["_tkm", "TRANSMISSION", (r) => (r.circuit_transmission ? `${km(r.circuit_transmission.km)} · ${r.circuit_transmission.kv}` : "n/a")],
      ["_skm", "SUBSTATION", (r) => (r.substation ? km(r.substation.km) : "n/a")],
      // Was the band -- "strong", "remote" -- as the whole cell. A distance is
      // a measurement and a band is a verdict on somebody's scheme, so the
      // cell now shows the measurement and the working stays one click away.
      ["_gp", "GRID", (r) => `<button class="gp-lock" type="button" data-why="${esc(r.ref)}"
        title="show the working">${r.circuit ? km(r.circuit.km) : "n/a"}</button>`],
    ];

    const value = (r, k) => (
      k === "_tkm" ? (r.circuit_transmission ? r.circuit_transmission.km : Infinity)
        : k === "_gp" ? (r.circuit ? r.circuit.km : Infinity)
        : k === "_ckm" ? (r.circuit ? r.circuit.km : Infinity)
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
          clusters a region together; sorting by mapped circuit distance orders the measurements shortest first.</p>
        <div id="gpWhy"></div>
        ${table(rows.slice(0, 400), columns, key, dir)}
        <p class="meta">Showing the first 400 of ${d.record_count}. Narrow with the RADIUS tab.</p>`;
      injectScopeStyle();
      wrap.querySelectorAll("button[data-why]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = d.rows.find((x) => x.ref === btn.dataset.why);
          const rule = d.grid_probable_rule;
          const box = wrap.querySelector("#gpWhy");
          box.innerHTML = `<div class="gp-readout"><h4>${esc(r.name)}</h4>
            <dl><dt>NEAREST CIRCUIT</dt><dd>${km(r.circuit.km)} · ${r.circuit.kv} kV</dd>
            <dt>NEAREST SUBSTATION</dt><dd>${km(r.substation.km)}</dd>
            <dt>CAPACITY</dt><dd>${mw(r.mw)} MW</dd></dl>
            <p class="meta" style="margin:10px 0 0;font-size:11px;color:#4d7a5f">${esc(rule.purpose)}</p>
            <p class="meta" style="margin:6px 0 0;font-size:11px;color:#4d7a5f"><strong>Not modelled:</strong>
              ${rule.not_modelled.map(esc).join("; ")}.</p></div>`;
        });
      });
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
        ["_lock", "", (r) => `<button class="gp-lock" type="button" data-ref="${esc(r.ref)}">LOCK</button>`],
      ])}
      <p class="meta">The 60 projects closest to a mapped substation. Every one of the
        ${d.record_count} rows carries the same two lines in the export.</p>`;
    body.appendChild(wrap);

    injectScopeStyle();
    wrap.querySelectorAll("button.gp-lock").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingTarget = d.rows.find((r) => r.ref === btn.dataset.ref) || null;
        select("TARGET");
      });
    });

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


  /* ---- TARGET ----------------------------------------------------------
     A targeting scope. The point is that the maths is legible as a picture:
     range rings you can count, a bearing you can see, and every voltage in
     reach drawn in the colour the estate has always used for it.

     Voltage colours are the ones already established in the REPD atlas grid
     model, so a 66 kV line is the same purple here as it is on the map.      */
  const KV_COLOUR = { 400: "#0054ff", 275: "#ff0000", 220: "#ff9900", 132: "#00cc00", 66: "#b200ff" };
  const SCOPE_STYLE_ID = "gp-scope-style";

  function injectScopeStyle() {
    if (document.getElementById(SCOPE_STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = SCOPE_STYLE_ID;
    /* Every selector is scoped under the cartridge host, so nothing outside
       it is restyled and the additive-only boundary holds. */
    s.textContent = `
      #gridProximityHost .gp-scope-wrap { display:grid; grid-template-columns:minmax(280px,1fr) minmax(220px,320px);
        gap:18px; align-items:start; margin-top:10px; }
      @media (max-width:720px){ #gridProximityHost .gp-scope-wrap { grid-template-columns:1fr; } }
      #gridProximityHost .gp-scope { position:relative; background:#04070a; border:1px solid #1d2c22;
        border-radius:2px; overflow:hidden; }
      #gridProximityHost .gp-scope canvas { display:block; width:100%; height:auto; }
      #gridProximityHost .gp-readout { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:12px;
        line-height:1.5; color:#8fe3b0; background:#04070a; border:1px solid #1d2c22; padding:12px 14px; }
      #gridProximityHost .gp-readout h4 { margin:0 0 8px; font-size:11px; letter-spacing:.18em;
        color:#39ff88; font-weight:600; text-transform:uppercase; }
      #gridProximityHost .gp-readout dl { display:grid; grid-template-columns:auto 1fr; gap:3px 12px; margin:0; }
      #gridProximityHost .gp-readout dt { color:#4d7a5f; letter-spacing:.06em; }
      #gridProximityHost .gp-readout dd { margin:0; color:#d6ffe6; font-variant-numeric:tabular-nums; text-align:right; }
      #gridProximityHost .gp-kv { display:flex; flex-wrap:wrap; gap:5px; margin-top:10px; }
      #gridProximityHost .gp-kv span { font-family:ui-monospace,monospace; font-size:10.5px; padding:2px 6px;
        border:1px solid currentColor; border-radius:2px; }
      #gridProximityHost .gp-lock { font-family:ui-monospace,monospace; font-size:10.5px; padding:3px 8px;
        border:1px solid #39ff88; background:transparent; color:#39ff88; cursor:pointer; border-radius:2px; }
      #gridProximityHost .gp-lock:hover { background:#0d2a19; }
      #gridProximityHost .gp-lock:focus-visible { outline:2px solid #39ff88; outline-offset:2px; }
      @media (prefers-reduced-motion:reduce){ #gridProximityHost .gp-scope canvas { opacity:1; } }`;
    document.head.appendChild(s);
  }

  let scopeFrame = null;

  /** Draw one frame of the scope. `t` runs 0 to 1 during acquisition. */
  function paintScope(canvas, row, t) {
    // No 2D context means no picture, but the readout beside it still has to
    // work. A missing canvas must degrade, never take the panel down.
    const ctx = canvas && canvas.getContext && canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width; const H = canvas.height;
    const cx = W / 2; const cy = H / 2;
    const pad = 26;
    const R = Math.min(W, H) / 2 - pad;

    // Range the scope covers: the furthest thing worth showing, rounded up.
    const far = Math.max(
      row.substation ? row.substation.km : 0,
      ...(row.substations_nearby || []).map((s) => s.km),
      row.circuit ? row.circuit.km : 0,
    );
    const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    const span = nice.find((n) => n >= far * 1.15) || Math.ceil(far * 1.15);
    const toXY = (lon, lat) => {
      const { kx, ky } = { kx: Math.cos(row.at[1] * Math.PI / 180) * 111.32, ky: 110.574 };
      const dx = (lon - row.at[0]) * kx;
      const dy = (lat - row.at[1]) * ky;
      return [cx + (dx / span) * R, cy - (dy / span) * R];
    };

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#04070a";
    ctx.fillRect(0, 0, W, H);

    // range rings
    ctx.strokeStyle = "#12331f";
    ctx.fillStyle = "#2f6a45";
    ctx.font = "10px ui-monospace,monospace";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
      const rr = (R * i) / 4;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      const label = (span * i) / 4;
      ctx.fillText(`${label < 1 ? `${Math.round(label * 1000)}m` : `${label}km`}`, cx + 3, cy - rr - 3);
    }
    ctx.beginPath();
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.stroke();
    ctx.fillStyle = "#2f6a45";
    ctx.fillText("N", cx - 4, cy - R - 8);

    // sweep, once, during acquisition
    if (t < 1) {
      const a = -Math.PI / 2 + t * Math.PI * 2;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, "rgba(57,255,136,0.22)");
      g.addColorStop(1, "rgba(57,255,136,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a - 0.5, a); ctx.closePath(); ctx.fill();
    }

    // one vector per voltage in reach, in the estate's own colours
    const entries = Object.entries(row.circuit_by_kv || {})
      .map(([kv, v]) => ({ kv: Number(kv), ...v }))
      .filter((v) => v.km <= span)
      .sort((a, b) => b.kv - a.kv);
    for (const v of entries) {
      const [x, y] = toXY(v.foot[0], v.foot[1]);
      ctx.strokeStyle = KV_COLOUR[v.kv] || "#666";
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, t * 1.6);
      ctx.lineWidth = v.kv >= 275 ? 2 : 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = KV_COLOUR[v.kv] || "#666";
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // substation blips
    const subs = [row.substation, ...(row.substations_nearby || [])].filter(Boolean);
    subs.forEach((s, i) => {
      if (s.km > span) return;
      const [x, y] = toXY(s.at[0], s.at[1]);
      const primary = i === 0;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.strokeStyle = primary ? "#39ff88" : "#2f6a45";
      ctx.fillStyle = primary ? "#39ff88" : "#1c4630";
      ctx.beginPath(); ctx.arc(x, y, primary ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // lock-on bracket around the nearest substation, closing as t -> 1
    if (row.substation && row.substation.km <= span) {
      const [x, y] = toXY(row.substation.at[0], row.substation.at[1]);
      const grow = 26 - 14 * Math.min(1, t);
      ctx.strokeStyle = t >= 1 ? "#39ff88" : "#8fe3b0";
      ctx.lineWidth = 1.5;
      const arm = 7;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const px = x + sx * grow; const py = y + sy * grow;
        ctx.beginPath();
        ctx.moveTo(px, py - sy * arm); ctx.lineTo(px, py); ctx.lineTo(px - sx * arm, py);
        ctx.stroke();
      });
      if (t >= 1) {
        ctx.fillStyle = "#39ff88";
        ctx.font = "bold 10px ui-monospace,monospace";
        ctx.fillText("LOCK", x + grow + 4, y - grow - 2);
      }
    }

    // the site itself
    ctx.strokeStyle = "#d6ffe6"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 9);
    ctx.stroke();
  }

  function bearingDeg(lon1, lat1, lon2, lat2) {
    const D = Math.PI / 180;
    const p1 = lat1 * D; const p2 = lat2 * D; const dl = (lon2 - lon1) * D;
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(y, x) / D + 360) % 360;
  }
  const compass = (deg) => ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16];

  function acquire(row, canvas, readout) {
    // Animate where the host can; otherwise draw the settled state at once.
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
    const caf = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {};
    if (scopeFrame) caf(scopeFrame);
    const reduced = !raf
      || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const DURATION = reduced ? 0 : 900;
    const start = performance.now();
    const sub = row.substation;
    const brg = sub ? bearingDeg(row.at[0], row.at[1], sub.at[0], sub.at[1]) : 0;

    const step = (now) => {
      const t = DURATION === 0 ? 1 : Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - t) ** 3;
      paintScope(canvas, row, eased);
      if (readout) {
        readout.innerHTML = `
          <h4>${t >= 1 ? "In range" : "Measuring…"}</h4>
          <dl>
            <dt>SITE</dt><dd>${esc((row.name || "").slice(0, 26))}</dd>
            <dt>CAPACITY</dt><dd>${mw(row.mw)} MW</dd>
            <dt>SUBSTATION</dt><dd>${esc((sub && (sub.name || "unnamed")) || "none").slice(0, 22)}</dd>
            <dt>RANGE</dt><dd>${sub ? km(sub.km * eased) : "n/a"}</dd>
            <dt>BEARING</dt><dd>${sub ? `${(brg * eased).toFixed(0).padStart(3, "0")}° ${compass(brg)}` : "n/a"}</dd>
            <dt>SUB kV</dt><dd>${sub && sub.kv.length ? sub.kv.join(" / ") : "unknown"}</dd>
            <dt>CIRCUIT</dt><dd>${row.circuit ? `${km(row.circuit.km * eased)} · ${row.circuit.kv} kV` : "n/a"}</dd>
            <dt>TRANSMISSION</dt><dd>${row.circuit_transmission ? `${km(row.circuit_transmission.km * eased)} · ${row.circuit_transmission.kv} kV` : "n/a"}</dd>
            <dt>DISTRIBUTION</dt><dd>${row.circuit_distribution ? `${km(row.circuit_distribution.km * eased)} · ${row.circuit_distribution.kv} kV` : "n/a"}</dd>
            <dt>NEAREST CIRCUIT</dt><dd>${row.circuit ? km(row.circuit.km) + " · " + row.circuit.kv + " kV" : "n/a"}</dd>
          </dl>
          <div class="gp-kv">${Object.entries(row.circuit_by_kv || {})
            .map(([kv, v]) => ({ kv: Number(kv), km: v.km }))
            .sort((a, b) => b.kv - a.kv)
            .map((v) => `<span style="color:${KV_COLOUR[v.kv]}">${v.kv} kV · ${km(v.km)}</span>`).join("")}</div>
          <p class="meta" style="margin:10px 0 0;font-size:11px;color:#4d7a5f">Straight line to mapped geometry.
            A screen, not a route. Detailed design belongs in ETAP or DIgSILENT with a chartered engineer.</p>`;
      }
      if (t < 1 && raf) scopeFrame = raf(step);
    };
    if (raf && DURATION > 0) scopeFrame = raf(step);
    else step(performance.now());
  }

  function renderTarget(d, preselect) {
    injectScopeStyle();
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <p class="section-title">DRAW STRAIGHT TO NEAREST SUBSTATION <span class="meta">· beta</span></p>
      <p class="meta" style="font-size:11px;color:#4d7a5f">Working model under trial. Screening geometry
        only; nothing here is a connection design.</p>
      <p class="meta">Pick a project and the scope plots what is actually within reach: every
        substation nearby, and the nearest circuit at each voltage in the colour the atlas has
        always used for it. Range rings are geodesic.</p>
      <div class="filters">
        <input id="gpTargetPick" type="text" placeholder="Project name or REPD ref" style="min-width:18rem">
        <button class="btn" id="gpTargetGo" type="button">ACQUIRE</button>
      </div>
      <div class="gp-scope-wrap">
        <div class="gp-scope"><canvas id="gpScope" width="620" height="620"></canvas></div>
        <div class="gp-readout" id="gpReadout"><h4>Standing by</h4>
          <p style="margin:0;color:#4d7a5f">Name a project, or press LOCK beside one in CONNECT.</p></div>
      </div>`;
    body.appendChild(wrap);
    const canvas = wrap.querySelector("#gpScope");
    const readout = wrap.querySelector("#gpReadout");
    const go = () => {
      const raw = wrap.querySelector("#gpTargetPick").value.trim();
      const needle = raw.toLowerCase();
      const hit = d.rows.find((r) => r.ref === raw)
        || d.rows.find((r) => (r.name || "").toLowerCase().includes(needle));
      if (!hit) { readout.innerHTML = `<h4>No target</h4><p style="margin:0;color:#4d7a5f">No project matches that.</p>`; return; }
      acquire(hit, canvas, readout);
    };
    wrap.querySelector("#gpTargetGo").addEventListener("click", go);
    wrap.querySelector("#gpTargetPick").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    if (preselect) {
      wrap.querySelector("#gpTargetPick").value = preselect.name;
      acquire(preselect, canvas, readout);
    }
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
  note.textContent = "beta · working model · pick a tab";

  return { payloadRequests, projectBindings: 0 };
}
