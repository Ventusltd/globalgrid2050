/**
 * WIDER FLEET — the REPD technology types the pipeline spine does not carry.
 *
 * The DESNZ Renewable Energy Planning Database carries 24 technology types.
 * The spine admits four of them — Solar Photovoltaics, Battery, Wind Onshore,
 * Wind Offshore — as its four tabs. This cartridge gives the remaining twenty
 * the same treatment: one tab each, under the REPD's own name, nothing merged
 * and nothing renamed.
 *
 * It is additive only. It reads no spine data, writes into its own host node,
 * binds no project, and emits no news signal. The solar/wind/BESS product is
 * untouched by construction: this module never looks at it.
 *
 * The tabs are derived from the payload at mount time and are never listed in
 * source. A hand-kept technology list is exactly what left `wind_onshore` in
 * Pipeline News and absent from the engine's layer ids; the register is the
 * only authority here, so a new REPD type appears on its own tab without an
 * edit to this file.
 */

export const WIDER_FLEET_CONTRACT = Object.freeze({
  schema: "pipelinenews.wider-fleet-cartridge.v1",
  generation: "202609021945",
  additive_only: true,
  mutates_existing_dom: false,
  project_bindings: 0,
  eligible_for_news_signal: false,
});

/* Engine layer colours, so a technology reads the same here as it does on the
   Atlas. Keyed by the family the REPD updater already assigns, so every REPD
   type inherits its family's colour without a second classification. */
const FAMILY_COLOUR = Object.freeze({
  biomass: "#39ff14",
  hydro: "#00aaff",
  hydrogen: "#ffffff",
  tidal: "#00bfff",
  act: "#ff6600",
  caes: "#88aaff",
  geothermal: "#ff3300",
  flywheel: "#ff69b4",
  other: "#888888",
});

const ATLAS = "https://ventusltd.github.io/gridatlas/atlas/";
const PAGE = 50;

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
  }[character]));
}

function num(value) {
  return value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

export async function mountWiderFleet({ host, payloadAsset }) {
  if (!host) throw new Error("wider fleet: no host node");
  if (!payloadAsset?.url) throw new Error("wider fleet: no payload asset");

  let payloadRequests = 0;
  const response = await fetch(payloadAsset.url, { cache: "force-cache" });
  payloadRequests += 1;
  if (!response.ok) {
    throw new Error(`wider fleet: payload ${response.status}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("wider fleet: payload carries no rows");
  }

  let technology = "all";
  let status = "All";
  let page = 0;

  /* The REPD's own type names, ordered by how much of the register each one
     is — the same shape as the spine's ALL TECH / SOLAR / BATTERY / ONSHORE /
     OFFSHORE row, with the twenty types it does not carry. */
  const counts = new Map();
  for (const row of rows) counts.set(row.rt, (counts.get(row.rt) || 0) + 1);
  const types = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));

  host.innerHTML = `
    <div class="gauges" data-wider-gauges></div>
    <div class="filters" data-wider-tech>
      <button class="btn active" data-technology="all" aria-pressed="true">ALL WIDER</button>
      ${types.map((type) => `<button class="btn" data-technology="${esc(type)}" aria-pressed="false">${esc(type.toUpperCase())}</button>`).join("")}
    </div>
    <div class="filters" data-wider-status>
      <button class="btn active" data-official-status="All" aria-pressed="true">ALL STATUS</button>
      <button class="btn" data-official-status="operational" aria-pressed="false">OPERATIONAL</button>
      <button class="btn" data-official-status="under construction" aria-pressed="false">CONSTRUCTING</button>
      <button class="btn" data-official-status="awaiting construction" aria-pressed="false">AWAITING</button>
      <button class="btn" data-official-status="application submitted" aria-pressed="false">SUBMITTED</button>
    </div>
    <div class="meta"><span>Capacity and status are the REPD's own fields, carried unchanged. County, town, postcode and the GlobalGrid reference are spine joins: this cartridge does not read the spine, so they are shown as &mdash; rather than guessed.</span></div>
    <div class="tablewrap">
      <table>
        <thead><tr>
          <th>SITE NAME</th>
          <th class="hide-mobile">COUNTY</th>
          <th class="hide-mobile">TOWN</th>
          <th class="hide-mobile">POSTCODE</th>
          <th class="hide-mobile">OPERATOR</th>
          <th>TECHNOLOGY</th>
          <th>OFFICIAL REPD STATUS</th>
          <th class="sortable-heading">OFFICIAL CAPACITY &#9660;</th>
          <th class="hide-mobile">REPD REF</th>
          <th class="hide-mobile">GLOBALGRID REF</th>
          <th>ACTIONS</th>
        </tr></thead>
        <tbody data-wider-rows></tbody>
      </table>
    </div>
    <div class="project-window-controls" data-wider-window>
      <button type="button" data-window="previous" disabled>PREVIOUS ${PAGE}</button>
      <span data-window-range>&mdash;</span>
      <button type="button" data-window="next">NEXT ${PAGE}</button>
    </div>`;

  const gaugesNode = host.querySelector("[data-wider-gauges]");
  const rowsNode = host.querySelector("[data-wider-rows]");
  const windowNode = host.querySelector("[data-wider-window]");

  const filtered = () => rows.filter((row) =>
    (technology === "all" || row.rt === technology)
    && (status === "All" || row.s === status));

  function render() {
    const visible = filtered();
    let megawatts = 0;
    let largest = 0;
    const shown = new Set();
    for (const row of visible) {
      megawatts += row.c;
      if (row.c > largest) largest = row.c;
      shown.add(row.rt);
    }

    gaugesNode.innerHTML = [
      ["FILTERED CAPACITY (MW)", num(Number(megawatts.toFixed(2)))],
      ["FILTERED PROJECTS", `${num(visible.length)} · ${shown.size} REPD TYPES`],
      ["LARGEST SINGLE SITE (MW)", num(largest)],
    ].map(([label, value]) =>
      `<div class="card"><h3>${label}</h3><div class="chart">${value}</div></div>`).join("");

    const last = Math.max(0, Math.ceil(visible.length / PAGE) - 1);
    if (page > last) page = last;

    rowsNode.innerHTML = visible.slice(page * PAGE, page * PAGE + PAGE).map((row) => `<tr>
      <td class="site">${esc(row.n)}<div class="project-meta">${esc(row.rt)}</div></td>
      <td class="hide-mobile">&mdash;</td>
      <td class="hide-mobile town-cell">&mdash;</td>
      <td class="hide-mobile reference-cell">&mdash;</td>
      <td class="hide-mobile">${esc(row.o || "—")}</td>
      <td><span class="badge" style="background:${FAMILY_COLOUR[row.t] || "#888"};color:#04080a">${esc(row.rt)}</span></td>
      <td>${esc(row.s)}</td>
      <td class="mw">${num(row.c)} MW</td>
      <td class="hide-mobile reference-cell repd-ref">&mdash;</td>
      <td class="hide-mobile reference-cell globalgrid-ref">&mdash;</td>
      <td><a class="btn" target="_blank" rel="noopener" href="${ATLAS}?project=${encodeURIComponent(row.n)}&technology=${encodeURIComponent(row.t)}&capacity_mw=${row.c}&latitude=${row.ll[1]}&longitude=${row.ll[0]}&zoom=12">MAP ↗</a></td>
    </tr>`).join("");

    windowNode.querySelector("[data-window-range]").textContent = visible.length
      ? `${page * PAGE + 1}–${Math.min(visible.length, page * PAGE + PAGE)} of ${num(visible.length)}`
      : "0 of 0";
    windowNode.querySelector('[data-window="previous"]').disabled = page <= 0;
    windowNode.querySelector('[data-window="next"]').disabled = page >= last;
  }

  function wire(selector, dataKey, apply) {
    host.querySelector(selector).addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      for (const other of event.currentTarget.querySelectorAll("button")) {
        other.classList.remove("active");
        other.setAttribute("aria-pressed", "false");
      }
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      apply(button.dataset[dataKey]);
      page = 0;
      render();
    });
  }

  wire("[data-wider-tech]", "technology", (value) => { technology = value; });
  wire("[data-wider-status]", "officialStatus", (value) => { status = value; });
  windowNode.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    page += button.dataset.window === "next" ? 1 : -1;
    render();
  });

  render();

  return {
    payloadRequests,
    projectBindings: 0,
    types: types.length,
    projects: rows.length,
    gigawatts: Number((rows.reduce((total, row) => total + row.c, 0) / 1000).toFixed(2)),
  };
}
