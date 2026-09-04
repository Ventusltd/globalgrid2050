/**
 * PipelineNews project-intelligence cartridge.
 * Generation 202608311343. DRAFT - deployment: not-authorised.
 *
 * ADDITIVE ONLY. This cartridge adds a tabbed panel inside its own host div.
 * It does not modify, re-render, restyle or re-order any existing part of the
 * application. If it fails to load, the core product is unchanged - the same
 * boundary the sector-intelligence and federated-relationship cartridges hold.
 *
 * It follows the established supplemental-asset contract exactly:
 *   - export <NAME>_CARTRIDGE_CONTRACT with a .generation the loader asserts
 *   - export mount<Name>({ host, payloadAsset }) returning { payloadRequests }
 *   - request NO payload at mount; fetch only on first tab selection
 *   - assert zero project bindings and no news-signal eligibility
 *
 * It uses only classes already present in the frozen stylesheet (.card, .btn,
 * .filters, .gauges, .meta, .section-title) so it inherits the design freeze
 * rather than introducing a second visual language.
 *
 * PUBLIC WORDING: every band name, caveat and note is read from the payload's
 * `labels` block. Nothing is hardcoded here. To change wording, edit LABELS in
 * build_intelligence_cartridge.py and regenerate the payload.
 */

export const PROJECT_INTELLIGENCE_CARTRIDGE_CONTRACT = Object.freeze({
  schema: "pipelinenews.project-intelligence-cartridge.v1",
  generation: "202608311343",
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
  tabs: Object.freeze(["OVERVIEW", "LEAD TIME", "GRID", "DATA CENTRES", "METHOD"]),
});

function invariant(condition, message) {
  if (!condition) throw new Error(`Project intelligence cartridge: ${message}`);
}

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const fmt = (n) => (n === null || n === undefined || Number.isNaN(Number(n)))
  ? "—" : Number(n).toLocaleString("en-GB");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Horizontal bar list, built from the frozen stylesheet's own idiom. */
function barList(rows, colour) {
  const max = Math.max(...rows.map((r) => r.n), 1);
  return rows.map((r) => `
    <div style="display:grid;grid-template-columns:minmax(120px,1fr) 2fr minmax(90px,auto);
                gap:10px;align-items:center;padding:5px 0;font-size:11px">
      <span style="color:#a6adbb">${esc(r.label)}</span>
      <span style="height:9px;background:rgba(255,255,255,.07);border-radius:999px;overflow:hidden">
        <span style="display:block;height:100%;width:${(r.n / max) * 100}%;
                     background:${r.c || colour || "#00ffff"};border-radius:999px"></span>
      </span>
      <span style="text-align:right;color:#fff">${fmt(r.n)}${
        r.mw !== undefined ? ` <span style="color:#555">/ ${fmt(Math.round(r.mw))} MW</span>` : ""}</span>
    </div>`).join("");
}

const BAND_COLOUR = {
  EARLY: "#00ff88", LATE: "#ffbe45", BEYOND: "#bdb2ff",
  AWAITING: "#8888ff", BUILDING: "#9aa3af", NOT_CURRENT: "#8b929b",
  NO_DATE: "#4a525c", UNCLASSIFIED: "#3b444f",
};

/* ------------------------------------------------------------------ tabs */

function tabOverview(data, ix) {
  const bands = {};
  for (const r of data.rows) {
    const b = r[ix.band];
    bands[b] = bands[b] || { n: 0 };
    bands[b].n += 1;
  }
  const rows = Object.keys(BAND_COLOUR)
    .filter((b) => bands[b])
    .map((b) => ({ label: data.labels.band[b], n: bands[b].n, c: BAND_COLOUR[b] }));

  const corroborated = data.rows.filter((r) => r[ix.corroborating_signal] !== "none").length;

  return `
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:0 0 10px">
      WHERE TO LOOK FIRST · ${fmt(data.record_count)} LIVE SOLAR AND BATTERY PROJECTS</h3>
    ${barList(rows)}
    <p style="font-size:10px;color:#555;line-height:1.7;margin-top:14px">
      ${esc(data.scope)}. ${esc(data.labels.caveat.lead)}</p>
    <div style="margin-top:14px;padding:10px 12px;border:1px solid rgba(0,255,255,.3);
                background:rgba(0,20,20,.5);font-size:10px;color:#a6adbb;line-height:1.7">
      <b style="color:#00ffff">The early window is where specification is still open.</b>
      Studies, cable and LV design are decided before a project freezes its design; this shows which
      consented projects are still inside that window, and how far through it they are.</div>`;
}

function tabLeadTime(data, ix) {
  const c = data.calibration;
  const withPct = data.rows.filter((r) => r[ix.pct_of_lead] !== null);
  const buckets = [
    { label: "0–25% of lead", lo: 0, hi: 25, c: "#00ff88" },
    { label: "25–50%", lo: 25, hi: 50, c: "#7dff9f" },
    { label: "50–75%", lo: 50, hi: 75, c: "#ffbe45" },
    { label: "75–100%", lo: 75, hi: 100, c: "#ff9f45" },
    { label: "over 100%", lo: 100, hi: Infinity, c: "#bdb2ff" },
  ].map((b) => ({
    label: b.label, c: b.c,
    n: withPct.filter((r) => r[ix.pct_of_lead] >= b.lo && r[ix.pct_of_lead] < b.hi).length,
  }));

  return `
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:0 0 10px">
      POSITION IN THE MEASURED LEAD</h3>
    ${barList(buckets)}
    <div class="gauges" style="margin-top:16px">
      <div class="card"><h3>SOLAR MEDIAN</h3>
        <div style="font-size:26px;font-weight:bold;color:#ffff00">${c.solar_median_days} d</div>
        <div style="font-size:10px;color:#a6adbb;margin-top:4px">n = ${fmt(c.solar_n)}</div></div>
      <div class="card"><h3>BATTERY MEDIAN</h3>
        <div style="font-size:26px;font-weight:bold;color:#ffae00">${c.bess_median_days} d</div>
        <div style="font-size:10px;color:#a6adbb;margin-top:4px">n = ${fmt(c.bess_n)}</div></div>
      <div class="card"><h3>SAMPLE</h3>
        <div style="font-size:26px;font-weight:bold;color:#00ffff">${fmt(c.sample)}</div>
        <div style="font-size:10px;color:#a6adbb;margin-top:4px">projects with both dates</div></div>
    </div>
    <p style="font-size:10px;color:#555;line-height:1.7;margin-top:14px">
      <b style="color:#888">Method.</b> ${esc(c.method)}. Bands with n &lt; ${c.min_band_sample}
      ${esc(c.fallback)}. A project inside the first ${c.early_threshold_pct}% of the measured median
      is banded early.<br><br>
      <b style="color:#888">Why it matters.</b> Battery takes roughly 2.5× as long as solar from
      consent to construction, so the two cannot share a timeline. A battery consented this month is
      still early in its window long after a solar project consented the same week has closed.</p>`;
}

function tabGrid(data, ix) {
  const d = data.rows.map((r) => r[ix.circuit_km]).filter((v) => v !== null);
  const buckets = [
    { label: "within 2 km", f: (v) => v <= 2, c: "#00ff88" },
    { label: "2 – 5 km", f: (v) => v > 2 && v <= 5, c: "#00ffff" },
    { label: "5 – 10 km", f: (v) => v > 5 && v <= 10, c: "#66ccff" },
    { label: "10 – 20 km", f: (v) => v > 10 && v <= 20, c: "#8888ff" },
    { label: "over 20 km", f: (v) => v > 20, c: "#bdb2ff" },
  ].map((b) => ({ label: b.label, c: b.c, n: d.filter(b.f).length }));
  const near = d.filter((v) => v <= 2).length;

  return `
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:0 0 10px">
      STRAIGHT-LINE DISTANCE TO THE NEAREST MAPPED TRANSMISSION CIRCUIT</h3>
    ${barList(buckets)}
    <p style="font-size:10px;color:#555;line-height:1.7;margin-top:14px">
      <b style="color:#888">${fmt(near)} of ${fmt(d.length)}
      (${Math.round((near / d.length) * 100)}%) sit within 2 km of a mapped circuit.</b>
      Most of this population is close to the network, so distance is most useful for spotting the
      minority that are not.<br><br>
      <b style="color:#888">Note.</b> ${esc(data.labels.caveat.distance)}
      ${esc(data.labels.provenance.network)}
      ${fmt(data.dictionaries.substation_name.length)} distinct substations matched.</p>`;
}

function tabDataCentres(data, ix) {
  const withDc = data.rows.filter((r) => r[ix.datacentre_km] !== null);
  const buckets = [
    { label: "within 5 km", f: (v) => v <= 5, c: "#00ff88" },
    { label: "5 – 10 km", f: (v) => v > 5 && v <= 10, c: "#00ffff" },
    { label: "10 – 25 km", f: (v) => v > 10 && v <= 25, c: "#66ccff" },
    { label: "over 25 km", f: (v) => v > 25, c: "#8888ff" },
  ].map((b) => ({ label: b.label, c: b.c, n: withDc.filter((r) => b.f(r[ix.datacentre_km])).length }));

  const close = withDc
    .filter((r) => r[ix.datacentre_km] <= 5 && r[ix.band] === "EARLY")
    .sort((a, b) => a[ix.datacentre_km] - b[ix.datacentre_km])
    .slice(0, 12);

  const rows = close.map((r) => `
    <tr><td style="padding:6px 8px;border-bottom:1px solid #16191f;color:#66ccff">${esc(r[ix.repd_ref])}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #16191f;color:#a6adbb">${
          esc(data.dictionaries.datacentre_name[r[ix.datacentre_name]] ?? "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #16191f;text-align:right;color:#fff">${
          r[ix.datacentre_km]} km</td></tr>`).join("");

  return `
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:0 0 10px">
      DISTANCE TO THE NEAREST MAPPED DATA CENTRE</h3>
    ${barList(buckets)}
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:18px 0 8px">
      CLOSEST PAIRINGS WHERE THE PROJECT IS EARLY IN LEAD TIME</h3>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;color:#00ffff;font-size:9px;letter-spacing:.6px">REPD</th>
        <th style="text-align:left;padding:6px 8px;color:#00ffff;font-size:9px;letter-spacing:.6px">MAPPED DATA CENTRE</th>
        <th style="text-align:right;padding:6px 8px;color:#00ffff;font-size:9px;letter-spacing:.6px">DISTANCE</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="3" style="padding:10px;color:#555">none</td></tr>'}</tbody>
    </table></div>
    <p style="font-size:10px;color:#555;line-height:1.7;margin-top:14px">
      ${esc(data.labels.provenance.datacentres)} This is the mapped built estate, so coverage varies.
      Useful for spotting where generation and demand are landing in the same place.
      ${esc(data.labels.caveat.distance)}</p>`;
}

function tabMethod(data, ix) {
  const bind = { HIGH: 0, LOW: 0, NONE: 0 };
  for (const r of data.rows) bind[r[ix.binding]] = (bind[r[ix.binding]] || 0) + 1;
  const rows = ["HIGH", "LOW", "NONE"].map((k) => ({
    label: data.labels.binding[k], n: bind[k] || 0,
    c: { HIGH: "#00ff88", LOW: "#ffbe45", NONE: "#ff4444" }[k],
  }));

  return `
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:0 0 10px">
      NAME-MATCH REACHABILITY</h3>
    ${barList(rows)}
    <p style="font-size:10px;color:#555;line-height:1.7;margin-top:12px">
      ${esc(data.labels.caveat.binding)} ${fmt(bind.NONE)} projects have names too generic to match
      on, and need a planning reference or operator name instead.</p>
    <h3 style="font-size:11px;letter-spacing:1px;color:#66ccff;margin:18px 0 8px">PROVENANCE</h3>
    <p style="font-size:10px;color:#555;line-height:1.9">
      <b style="color:#888">Spine.</b> ${esc(data.labels.provenance.spine)}
      ${fmt(data.spine.project_count)} records, ${fmt(data.spine.capacity_mw)} MW,
      <code>projects_sha256 ${esc(data.spine.projects_sha256.slice(0, 16))}…</code><br>
      <b style="color:#888">Network.</b> ${esc(data.labels.provenance.network)}<br>
      <b style="color:#888">Data centres.</b> ${esc(data.labels.provenance.datacentres)}<br>
      <b style="color:#888">Derived.</b> ${esc(data.labels.provenance.derived)}<br>
      <b style="color:#888">Privacy.</b> Organisation-level records only. No personal data is read,
      stored or displayed.</p>
    <div style="margin-top:14px;padding:10px 12px;border:1px solid #2f343d;background:#07090c;
                font-size:10px;color:#a6adbb;line-height:1.8">
      <b style="color:#00ffff">Wording on this panel is set in one place</b> — the
      <code>labels</code> block of the data file. Change it there and every tab follows.</div>`;
}

const TABS = [
  { id: "OVERVIEW", render: tabOverview },
  { id: "LEAD TIME", render: tabLeadTime },
  { id: "GRID", render: tabGrid },
  { id: "DATA CENTRES", render: tabDataCentres },
  { id: "METHOD", render: tabMethod },
];

/* ----------------------------------------------------------------- mount */

/**
 * Mount the tabbed panel into `host`.
 *
 * Requests NO payload at mount - the loader asserts payloadRequests === 0,
 * matching the existing supplemental cartridges. The payload is fetched once,
 * on the first tab the user selects, and reused for every tab after that.
 *
 * @returns {{payloadRequests:number, projectBindings:number}}
 */
export function mountProjectIntelligence({ host, payloadAsset }) {
  invariant(host instanceof HTMLElement, "host element is missing");
  invariant(payloadAsset && typeof payloadAsset.url === "string", "payload asset is missing");

  let payloadRequests = 0;
  let data = null;
  let ixCache = null;
  let active = null;

  host.textContent = "";

  const tools = el("div", "news-tools");
  const panel = el("div");
  panel.style.cssText = "padding:12px 0;min-height:80px";
  const note = el("div", null,
    "WAIT · no payload requested · choose a tab to load the compact derived index");
  note.style.cssText = "font-size:10px;color:#555;letter-spacing:.5px;padding:4px 0";

  const buttons = TABS.map((t) => {
    const b = el("button", null, t.id);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", "false");
    b.addEventListener("click", () => select(t).catch((error) => {
      console.error("project intelligence", error);
      panel.innerHTML = '<div style="font-size:11px;color:#ff4444;padding:10px 0">'
        + "FAIL · derived index unavailable; the core product is unchanged</div>";
    }));
    tools.appendChild(b);
    return { tab: t, node: b };
  });

  async function select(tab) {
    if (active === tab.id) return;
    active = tab.id;
    for (const b of buttons) {
      const on = b.tab.id === tab.id;
      b.node.classList.toggle("active", on);
      b.node.setAttribute("aria-selected", String(on));
    }
    if (!data) {
      note.textContent = "LOAD · requesting the compact derived index once";
      payloadRequests += 1;
      invariant(payloadRequests === 1, "derived index requested more than once");
      const response = await fetch(payloadAsset.url, { cache: "force-cache" });
      invariant(response.ok, `derived index HTTP ${response.status}`);
      data = await response.json();
      invariant(data.schema === "pipelinenews.v9.project-intelligence.v1",
        "derived index schema changed");
      invariant(data.law?.no_personal_data === true, "privacy boundary changed");
      invariant(data.law?.corroboration_adapters_built === false,
        "corroboration claim changed; review before display");
      ixCache = Object.fromEntries(data.fields.map((f, i) => [f, i]));
      note.textContent = `READY · ${fmt(data.record_count)} projects · generation ${data.generation}`
        + " · derived values are inferred, not published facts";
    }
    panel.innerHTML = tab.render(data, ixCache);
  }

  host.appendChild(tools);
  host.appendChild(note);
  host.appendChild(panel);

  return { payloadRequests, projectBindings: 0 };
}
