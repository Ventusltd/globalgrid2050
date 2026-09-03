/**
 * WIDER FLEET — the REPD technology types the spine does not carry, as tabs
 * in the product's own technology row.
 *
 * The DESNZ Renewable Energy Planning Database carries 24 technology types.
 * The spine admits four — Solar Photovoltaics, Battery, Wind Onshore, Wind
 * Offshore — and those four are its four tabs. This adds the other twenty to
 * the SAME row, as more tabs, under the REPD's own names. Vikram, on the
 * first attempt, which hid them behind a button in a panel of their own:
 * "I dont see the options for other tech they are not on the UI like solar,
 * BEss onshroe and offshore wind". They are on the UI now.
 *
 * HOW THIS STAYS ADDITIVE
 * -----------------------
 * The spine binds its technology handler once, at boot:
 *
 *     document.querySelectorAll("#tech .btn").forEach(...)
 *
 * to the buttons present at that moment. Tabs appended afterwards therefore
 * carry NO spine listener, and the spine's `technology` variable is never set
 * to a value its TECHNOLOGIES whitelist would reject. The four original tabs
 * keep their own handler, their own payload and their own render path,
 * untouched and unwrapped.
 *
 * When a wider tab is chosen this renders its own rows into the product's
 * table. When a spine tab is chosen the spine's own apply() runs and repaints
 * from its own data, so going back is the spine restoring itself rather than
 * this cartridge putting anything back.
 *
 * It reads no spine payload, binds no project and emits no news signal.
 */

export const WIDER_FLEET_CONTRACT = Object.freeze({
  schema: "pipelinenews.wider-fleet-cartridge.v2",
  generation: "202609030009",
  additive_only: true,
  tabs_in_product_technology_row: true,
  reads_spine_payload: false,
  project_bindings: 0,
  eligible_for_news_signal: false,
});

/* Engine layer colours, so a technology reads the same here as on the Atlas.
   Keyed by the family the REPD updater already assigns — no second table. */
const FAMILY_COLOUR = Object.freeze({
  biomass: "#39ff14", hydro: "#00aaff", hydrogen: "#ffffff", tidal: "#00bfff",
  act: "#ff6600", caes: "#88aaff", geothermal: "#ff3300", flywheel: "#ff69b4",
  other: "#888888",
});

const ATLAS = "https://ventusltd.github.io/gridatlas/atlas/";
const PAGE = 50;

const esc = (value) => String(value == null ? "" : value)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
/* The Atlas resolves an arrival by REPD ref and nothing else
   (identity_rule: EXACT_REPD_REF_ONLY). Without one it reports status ABSENT
   and its place-search cartridge returns before its own flyTo, so the card
   opens and the measurement runs while the camera stays on the default UK
   view -- which reads as "the map cannot find it". Watched live for Rainham
   Phase II on 2026-09-02. A row that genuinely has no resolved ref still
   links without one: the card and the measurement work, only the camera
   does not move, and that is better than sending a guessed identity. */
function atlasLink(row) {
  const query = new URLSearchParams();
  if (row.ref) query.set("repd_ref", row.ref);
  query.set("project", row.n);
  query.set("technology", row.t);
  query.set("capacity_mw", String(row.c));
  query.set("latitude", String(row.ll[1]));
  query.set("longitude", String(row.ll[0]));
  query.set("zoom", "12");
  return `${ATLAS}?${query.toString()}`;
}

const num = (value) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

export async function mountWiderFleet({ host, payloadAsset }) {
  const techRow = document.getElementById("tech");
  const tableBody = document.querySelector(".tablewrap tbody");
  const windowControls = document.getElementById("projectWindowControls");
  if (!techRow || !tableBody) throw new Error("wider fleet: product controls not found");
  if (!payloadAsset?.url) throw new Error("wider fleet: no payload asset");

  let payloadRequests = 0;
  const response = await fetch(payloadAsset.url, { cache: "force-cache" });
  payloadRequests += 1;
  if (!response.ok) throw new Error(`wider fleet: payload ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("wider fleet: payload carries no rows");
  }

  /* The REPD's own type names, ordered by how much of the register each is.
     Derived from the payload, never listed in source: a hand-kept technology
     list is exactly what left wind_onshore in this product and absent from
     the engine's layer ids. A new REPD type gets a tab with no edit here. */
  const counts = new Map();
  for (const row of rows) counts.set(row.rt, (counts.get(row.rt) || 0) + 1);
  const types = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));

  /* The spine's own tabs, captured before anything is appended, so "restore
     the product" never depends on knowing what they are. */
  const spineTabs = [...techRow.querySelectorAll(".btn")];

  const appended = types.map((type) => {
    const button = document.createElement("button");
    button.className = "btn";
    button.type = "button";
    // NOT data-technology: that attribute is the spine's, and a value outside
    // its whitelist reaching its filter would empty the product's own table.
    button.dataset.widerTechnology = type;
    button.setAttribute("aria-pressed", "false");
    button.textContent = type.toUpperCase();
    techRow.appendChild(button);
    return button;
  });

  let active = null;
  let page = 0;

  const visible = () => (active ? rows.filter((row) => row.rt === active) : []);

  function clearWider() {
    for (const button of appended) {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    }
    active = null;
    if (host) { host.hidden = true; host.innerHTML = ""; }
  }

  function renderWider() {
    const shown = visible();
    let megawatts = 0;
    let largest = 0;
    for (const row of shown) {
      megawatts += row.c;
      if (row.c > largest) largest = row.c;
    }

    /* Set the product's own gauge values in place. Rewriting .gauges innerHTML
       destroyed #v1/#v2/#v3 and the chart canvases the spine holds references
       to, and the numbers then stayed on the wider tab's figures after
       switching back to SOLAR -- caught on a click-through before publishing.
       Writing the values leaves every node the spine owns intact, so its own
       updateGauges() restores them on the next spine tab without this
       cartridge putting anything back. The charts stay the spine's. */
    const v1 = document.getElementById("v1");
    const v2 = document.getElementById("v2");
    const v3 = document.getElementById("v3");
    if (v1) v1.textContent = num(Number(megawatts.toFixed(2)));
    if (v2) v2.textContent = num(shown.length);
    if (v3) v3.textContent = num(largest);

    if (host) {
      host.hidden = false;
      host.innerHTML = `<span>${esc(active)} &middot; ${num(shown.length)} projects &middot; `
        + `${(megawatts / 1000).toFixed(2)} GW &middot; a REPD technology type outside this `
        + `product's four. Capacity and status are the register's own fields. County, town, `
        + `postcode, REPD ref and the GlobalGrid reference are spine joins: this tab does not `
        + `read the spine, so they are withheld rather than guessed.</span>`;
    }

    const last = Math.max(0, Math.ceil(shown.length / PAGE) - 1);
    if (page > last) page = last;

    tableBody.innerHTML = shown.slice(page * PAGE, page * PAGE + PAGE).map((row) => `<tr>
      <td class="site">${esc(row.n)}<div class="project-meta">${esc(row.rt)}</div><div class="mobile-extra">${esc(row.o || "")}</div></td>
      <td class="hide-mobile">${esc(row.cty || "—")}</td>
      <td class="hide-mobile town-cell">&mdash;</td>
      <td class="hide-mobile reference-cell">${esc(row.pc || "—")}</td>
      <td class="hide-mobile">${esc(row.o || "—")}</td>
      <td><span class="badge" style="background:${FAMILY_COLOUR[row.t] || "#888"};color:#04080a">${esc(row.rt)}</span></td>
      <td>${esc(row.s)}</td>
      <td class="mw">${num(row.c)} MW</td>
      <td class="hide-mobile reference-cell repd-ref">${esc(row.ref || "—")}</td>
      <td class="hide-mobile reference-cell globalgrid-ref">${row.ref ? "GG2050-REPD-" + esc(row.ref) : "&mdash;"}</td>
      <td class="hide-mobile reference-cell repd-updated">&mdash;</td>
      <td><span class="signal none">&mdash;</span><div class="signal-note">no news binding on this tab</div></td>
      <td><div class="project-actions"><a class="action-link" target="_blank" rel="noopener" href="${atlasLink(row)}">MAP ↗</a></div></td>
    </tr>`).join("");

    if (windowControls) {
      const range = windowControls.querySelector("[data-window-range]");
      const previous = windowControls.querySelector('[data-window="previous"]');
      const next = windowControls.querySelector('[data-window="next"]');
      if (range) {
        range.textContent = shown.length
          ? `${page * PAGE + 1}–${Math.min(shown.length, page * PAGE + PAGE)} of ${num(shown.length)}`
          : "0 of 0";
      }
      if (previous) previous.disabled = page <= 0;
      if (next) next.disabled = page >= last;
    }
  }

  for (const button of appended) {
    button.addEventListener("click", () => {
      // Drop the spine's active mark. Its own state is untouched: the next
      // click on one of its tabs runs its handler and repaints from its data.
      for (const tab of spineTabs) {
        tab.classList.remove("active");
        tab.setAttribute("aria-pressed", "false");
      }
      for (const other of appended) {
        other.classList.remove("active");
        other.setAttribute("aria-pressed", "false");
      }
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      active = button.dataset.widerTechnology;
      page = 0;
      renderWider();
    });
  }

  /* A second listener on the spine's own tabs. It only lets go: the spine's
     original handler still runs and repaints the product from the product's
     own data, which is what restores it. */
  for (const tab of spineTabs) {
    tab.addEventListener("click", () => { clearWider(); page = 0; });
  }

  if (windowControls) {
    windowControls.addEventListener("click", (event) => {
      if (!active) return;                    // the spine owns its own paging
      const button = event.target.closest("button");
      if (!button || !button.dataset.window) return;
      page += button.dataset.window === "next" ? 1 : -1;
      renderWider();
    }, true);
  }

  return {
    payloadRequests,
    projectBindings: 0,
    tabsAdded: appended.length,
    types: types.length,
    projects: rows.length,
    gigawatts: Number((rows.reduce((total, row) => total + row.c, 0) / 1000).toFixed(2)),
  };
}
