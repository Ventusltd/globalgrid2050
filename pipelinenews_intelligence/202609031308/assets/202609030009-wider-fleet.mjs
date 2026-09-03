/**
 * WIDER FLEET — the REPD technology types the spine does not carry, behind ONE
 * labelled control in the product's own technology row.
 *
 * The DESNZ Renewable Energy Planning Database carries 24 technology types.
 * The spine admits four — Solar Photovoltaics, Battery, Wind Onshore, Wind
 * Offshore — and those four are its four tabs. Generation 202609030009 put the
 * other twenty into the SAME row as twenty more tabs. That answered Vikram's
 * first objection — "I dont see the options for other tech they are not on the
 * UI like solar, BEss onshroe and offshore wind" — and created the next one:
 * twenty-five controls in a single row.
 *
 * WHY ONE SELECT AND NOT TWENTY TABS
 * ----------------------------------
 * The twenty are not twenty comparable choices. Counted off this cut:
 *
 *   Landfill Gas 275 · Anaerobic Digestion 253 · Biomass (dedicated) 159
 *   EfW Incineration 122 · Small Hydro 108 · Hydrogen 60 · ACT 37
 *   Large Hydro 28 · Pumped Storage 15 · Tidal Stream 14 · Sewage Sludge 12
 *   Geothermal 5 · Shoreline Wave 4 · Liquid Air 2 · Biomass (co-firing) 2
 *   Hot Dry Rocks 2 · Compressed Air 2 · Fuel Cell (Hydrogen) 2
 *   Flywheels 1 · Unknown 1
 *
 * Nine of the twenty carry five rows or fewer; one carries one. A tab is a
 * promise that what is behind it deserves a permanent seat on the surface, and
 * a one-row tab spends a seat making that promise falsely. Twenty of them also
 * push the spine's own four off the first line on a phone, which is the exact
 * failure the twenty tabs were built to fix. One select states the same twenty,
 * carries each one's row count beside it so the tail is visibly a tail, and
 * costs one control.
 *
 * The spine's four stay tabs. They are four, they are the product, and the
 * architect did not ask for them to move.
 *
 * The names and the counts are both read from the payload at mount time and
 * are never listed in this file: a hand-kept technology list is exactly what
 * left wind_onshore in this product and absent from the engine's layer ids. A
 * new REPD type gets an option, with its own count, with no edit here.
 *
 * HOW THIS STAYS ADDITIVE
 * -----------------------
 * The spine binds its technology handler once, at boot:
 *
 *     document.querySelectorAll("#tech .btn").forEach(...)
 *
 * to the buttons present at that moment. What is appended afterwards is a
 * <label> and a <select>, neither of which carries the .btn class, so they are
 * outside that selector twice over and the spine's `technology` variable is
 * never set to a value its TECHNOLOGIES whitelist would reject. The four
 * original tabs keep their own handler, their own payload and their own render
 * path, untouched and unwrapped.
 *
 * When a wider technology is chosen this renders its own rows into the
 * product's table. When a spine tab is chosen the spine's own apply() runs and
 * repaints from its own data, so going back is the spine restoring itself
 * rather than this cartridge putting anything back. Returning to the select's
 * own first entry dispatches a click on the tab that was marked before the
 * reader left it — again the spine's handler, not a second render path.
 *
 * THE DEEP LINK, AND WHY IT IS OWED
 * ---------------------------------
 * A tab was at least in the DOM for a reader or a script to find. An option
 * inside a closed select is not, so a control this small owes the twenty an
 * address. ?technology= was never theirs: the spine's whitelist has five
 * members and silently coerces everything else to "all", so
 * ?technology=Landfill+Gas selected ALL TECH and said nothing about why.
 *
 * It is read here instead, matched case-insensitively against the payload's
 * own type names, after mount. The spine's hydrateFiltersFromUrl has already
 * run and already settled on "all" by then, so this is the later and winning
 * answer for a value the spine declined — and a value the spine ACCEPTED is
 * left entirely alone, which is why the five spine names are checked first.
 * Choosing a technology writes the name back with history.replaceState, so the
 * address bar is a link to the view a reader is actually looking at.
 *
 * It reads no spine payload, binds no project and emits no news signal.
 */

export const WIDER_FLEET_CONTRACT = Object.freeze({
  // v2 remains the export shape app.mjs and the registry both name; the
  // control this file draws changed, the contract's shape did not.
  schema: "pipelinenews.wider-fleet-cartridge.v2",
  generation: "202609030009",
  additive_only: true,
  control_in_product_technology_row: "select",
  deep_linkable: true,
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
     the engine's layer ids. A new REPD type gets an option, carrying its own
     count, with no edit here. */
  const counts = new Map();
  for (const row of rows) counts.set(row.rt, (counts.get(row.rt) || 0) + 1);
  const types = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));

  /* The spine's own tabs, captured before anything is appended, so "restore
     the product" never depends on knowing what they are. */
  const spineTabs = [...techRow.querySelectorAll(".btn")];

  /* One control, not twenty. A <select> gets a phone the platform's own
     picker — a scrollable, searchable, full-height list — instead of twenty
     wrapped buttons, and it costs the technology row one line at every width.
     The <label> is not decoration: a bare dropdown among five tabs is a
     control whose contents have to be guessed at before it is opened, which is
     the objection the twenty tabs were built to answer and must not be
     re-created. Neither node carries .btn, because the spine's
     `#tech .btn` selector must not find them. */
  const group = document.createElement("div");
  group.className = "wider-fleet-control";

  const label = document.createElement("label");
  label.className = "wider-fleet-label";
  label.htmlFor = "widerTechnology";
  label.textContent = "WIDER FLEET";

  const select = document.createElement("select");
  select.id = "widerTechnology";
  select.className = "wider-fleet-select";
  select.setAttribute("aria-label", `Wider fleet: ${types.length} more REPD `
    + `technology types outside this product's four, ${num(rows.length)} projects`);

  /* The first entry is the way back, not an empty state: choosing it returns
     the reader to the spine tab they were on. It is worded as what the control
     holds so that the closed control still says it. */
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = `+ ${types.length} MORE REPD TYPES `
    + `(${num(rows.length)} PROJECTS)`;
  select.appendChild(placeholder);

  /* Every option carries its own row count. Nine of the twenty hold five rows
     or fewer and one holds a single row; without the count a reader sees
     twenty equal choices and opens several near-empty ones to find that out.
     The number is the payload's own, taken from the same Map the option list
     is ordered by, so it cannot disagree with what the choice then shows.
     `Unknown` is an option like any other and is deliberately not hidden: it
     holds one row today, and a bucket nobody can see is a bucket that grows
     in silence the day REPD adds a type the mapper does not know. */
  const options = types.map((type) => {
    const option = document.createElement("option");
    // NOT data-technology: that attribute is the spine's, and a value outside
    // its whitelist reaching its filter would empty the product's own table.
    option.value = type;
    option.dataset.widerTechnology = type;
    option.dataset.widerRows = String(counts.get(type));
    option.textContent = `${type.toUpperCase()} · ${num(counts.get(type))}`;
    select.appendChild(option);
    return option;
  });

  group.append(label, select);
  techRow.appendChild(group);

  let active = null;
  let page = 0;
  /* The spine tab the reader was on when they reached into the control, so
     that returning to its first entry hands the product back where they left
     it instead of to ALL TECH. */
  let returnTab = null;

  const visible = () => (active ? rows.filter((row) => row.rt === active) : []);

  function clearWider() {
    select.value = "";
    select.classList.remove("is-chosen");
    active = null;
    returnTab = null;
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

  /* The five values the spine's own TECHNOLOGIES whitelist admits. Listed
     here for one purpose only — to recognise a technology parameter that
     BELONGS to the spine and leave it alone. This file never sets any of
     them and never reads the spine's payload. */
  const SPINE_TECHNOLOGIES = new Set(
    ["all", "solar", "bess", "wind_onshore", "wind_offshore"]);

  /* Write the chosen name back into the address bar. replaceState, not push:
     a filter change is not a navigation, and the spine's own syncFilterUrl
     uses replaceState for the same reason. A later spine interaction runs
     syncFilterUrl, which deletes `technology` and re-sets it from the spine's
     state — so a URL copied while a wider technology is showing is a link to
     that view, and a URL copied after going back to the product is a link to
     the product. */
  function writeDeepLink(type) {
    const url = new URL(location.href);
    if (type) url.searchParams.set("technology", type);
    else url.searchParams.delete("technology");
    history.replaceState(null, "", url);
  }

  function selectTechnology(type) {
    if (!returnTab) {
      returnTab = spineTabs.find((tab) => tab.classList.contains("active"))
        || spineTabs[0] || null;
    }
    // Drop the spine's active mark. Its own state is untouched: the next
    // click on one of its tabs runs its handler and repaints from its data.
    for (const tab of spineTabs) {
      tab.classList.remove("active");
      tab.setAttribute("aria-pressed", "false");
    }
    select.classList.add("is-chosen");
    active = type;
    page = 0;
    renderWider();
    writeDeepLink(type);
  }

  select.addEventListener("change", () => {
    const chosen = select.value;
    if (!chosen) {
      // Back to the product. Capture the tab BEFORE clearWider, which resets
      // returnTab, then dispatch a real click on it: the spine's own handler
      // and its own apply() repaint from the spine's own data. Nothing in this
      // file puts the product's rows back.
      const tab = returnTab || spineTabs[0] || null;
      clearWider();
      writeDeepLink(null);
      if (tab) tab.click();
      return;
    }
    selectTechnology(chosen);
  });

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

  /* ── the deep link, applied last ────────────────────────────────────────
     Order is the whole reason this works without touching the spine. boot()
     calls bindWiderFleet() and does NOT await it, so the spine's
     hydrateFiltersFromUrl() and apply() have both already run by the time this
     line is reached: the spine has read ?technology=, found a value its
     five-member whitelist does not admit, coerced it to "all", marked ALL TECH
     and painted the product. This is the later answer, and only for a value
     the spine declined — SPINE_TECHNOLOGIES is checked first so that a link to
     the spine's own four is never intercepted here.

     Matching is case-insensitive against the payload's own type names, so
     ?technology=landfill+gas and ?technology=Landfill%20Gas both arrive, and a
     technology REPD adds tomorrow is linkable the day it enters the cut with
     no list to update. An unrecognised value is left as the spine left it:
     ALL TECH, the product, no error. */
  let deepLinked = null;
  const requestedTechnology = new URLSearchParams(location.search).get("technology");
  if (requestedTechnology && !SPINE_TECHNOLOGIES.has(requestedTechnology)) {
    const wanted = requestedTechnology.trim().toLowerCase();
    const match = types.find((type) => type.toLowerCase() === wanted);
    if (match) {
      select.value = match;
      selectTechnology(match);
      deepLinked = match;
    }
  }

  return {
    payloadRequests,
    projectBindings: 0,
    controlsAdded: 1,
    optionsAdded: options.length,
    deepLinked,
    types: types.length,
    projects: rows.length,
    gigawatts: Number((rows.reduce((total, row) => total + row.c, 0) / 1000).toFixed(2)),
  };
}

