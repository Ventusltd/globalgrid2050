import {widerGeoJSON} from './202609060340-wider-geojson.mjs';
import {sortWiderRows} from './202609060338-wider-order.mjs';
import {filterWiderRows} from './202609060337-wider-filter.mjs';
import { buildAtlasV9DeepLink } from "./202609040044-atlas-pointer-deep-link.mjs";

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
  generation: "202609040044",
  source_rows: 1104,
  display_identities: 1101,
  map_actions: 1091,
  duplicate_identities_removed: 3,
  additive_only: true,
  control_in_product_technology_row: "select",
  deep_linkable: true,
  /* Every figure this cut puts on a surface the spine owns goes through the
     one function the spine hands over at mount -- the counter, the three
     gauge numbers, the three gauge arcs, and what EXPORT FILTERED CSV does.
     Writing any of them here again is the defect this replaced. */
  drives_summary_seam: true,
  /* Registers on the spine's release seam and clears itself when the
     spine repaints, so the control never names a cut the table has
     stopped showing. app.mjs invariants this at mount. */
  releases_on_spine_repaint: true,
  /* Paging does not go through apply(), so the seam above cannot see it. While
     a wider cut holds the table this cartridge takes the shared pager and stops
     the spine's own handler from repainting underneath it. */
  owns_the_pager_while_showing: true,
  export_policy: "declines",
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

const PAGE = 50;

const esc = (value) => String(value == null ? "" : value)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function repdRecords(row) {
  const records = Array.isArray(row.repd_records) ? row.repd_records : [row];
  const seen = new Set();
  return records.filter((record) => {
    const ref = String(record?.ref ?? "").trim();
    if (!ref || seen.has(ref)) return false;
    seen.add(ref);
    return true;
  });
}

export function mapLinksForRow(row) {
  return repdRecords(row).flatMap((record) => {
    const href = buildAtlasV9DeepLink({ ...row, ref: record.ref });
    return href ? [{ href, ref: String(record.ref) }] : [];
  });
}

function mapActions(row) {
  const actions = mapLinksForRow(row);
  if (!actions.length) {
    return '<span class="action-disabled" title="No exact REPD reference is available; no MAP identity is guessed">NO MAP</span>';
  }
  return actions.map(({ href, ref }) => `<a class="action-link" target="_blank" rel="noopener" href="${esc(href)}">MAP${actions.length > 1 ? ` ${esc(ref)}` : ""} &nearr;</a>`).join(" ");
}

const displayRefs = (row) => repdRecords(row).map(({ ref }) => String(ref)).join(" / ");
const displayStatuses = (row) => {
  const statuses = Array.isArray(row.repd_records)
    ? [...new Set(row.repd_records.map(({ status }) => status).filter(Boolean))]
    : [row.s];
  return statuses.join(" / ");
};

const num = (value) => value.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/* ── WHAT THIS CUT COULD HONESTLY PUT IN THE PRODUCT'S CSV ─────────────────

   A payload row here is ten short keys: name, operator, technology family,
   the REPD's own type, status, capacity, a lon/lat pair, REPD ref, county and
   postcode. The spine's export is fifty columns of official REPD and
   GlobalGrid fields, and forty of them -- the GlobalGrid identifiers, the
   identity verdicts, the planning authority and reference, the eight REPD
   dates, the relationship arrays, the coordinate provenance and every source
   digest -- exist only as joins onto the spine's payload, which this file
   deliberately does not read.

   Nine of the ten keys have a column here; postcode has none, because the
   product's CSV does not carry one. That is ten of fifty, and a file with
   forty blank columns under a GlobalGrid header is not a smaller truth, it is
   the same wrong number in a spreadsheet with better formatting. So this cut
   declines, and says exactly which ten it could have filled and what the
   other forty are.

   The names below are the spine's own column names. The refusal is built
   against the column list the spine passes in at the moment of the click, so
   it counts what the CSV actually has rather than what was true when this was
   written, and a column added to the export changes this message with no edit
   here. */
const EXPORT_COLUMN_SOURCES = Object.freeze({
  "Site Name": (row) => row.n,
  "REPD Ref": (row) => displayRefs(row),
  "Technology": (row) => row.t,
  "Official REPD Technology": (row) => row.rt,
  "Official REPD Capacity": (row) => row.c,
  "Official REPD Status": (row) => row.s,
  "Operator or Applicant": (row) => row.o,
  "County": (row) => row.cty,
  "Longitude": (row) => (Array.isArray(row.ll) ? row.ll[0] : undefined),
  "Latitude": (row) => (Array.isArray(row.ll) ? row.ll[1] : undefined),
});

const carried = (value) => value !== null && value !== undefined && value !== "";

/* A column counts as fillable only if EVERY row on screen has it. REPD ref
   and county are absent from 13 of this cut's 1,104 rows and postcode from
   473, so "this cut carries county" is true of the payload and can be false
   of the twenty rows a reader is looking at. The refusal is about the rows on
   screen, so it is measured on them. */
function declineExport(request, technology, shown) {
  const columns = Array.isArray(request && request.columns) ? request.columns : [];
  const fillable = columns.filter((column) => {
    const read = EXPORT_COLUMN_SOURCES[column];
    return typeof read === "function" && shown.every((row) => carried(read(row)));
  });
  const missing = columns.filter((column) => !fillable.includes(column));
  const gaps = Object.keys(EXPORT_COLUMN_SOURCES)
    .filter((column) => columns.includes(column) && !fillable.includes(column));
  return {
    declined: `EXPORT DECLINED · ${String(technology).toUpperCase()} is a wider-fleet `
      + `cut, not this product's own. It can fill ${fillable.length} of this CSV's `
      + `${columns.length} columns: ${fillable.join(", ")}.`
      + (gaps.length
        ? ` It cannot fill ${gaps.join(", ")} either — this cut carries `
          + `${gaps.length === 1 ? "that field" : "those fields"} for some of these `
          + `rows and not all of them.`
        : "")
      + ` The other ${missing.length} — the GlobalGrid project and development IDs, `
      + `identity status and confidence, planning authority and application reference, `
      + `the REPD record-updated date and the seven planning milestone dates, region, `
      + `country, derived lifecycle, the related-REPD and relationship columns, `
      + `easting, northing and the coordinate provenance, the source digests and the `
      + `news signal — are joins onto the spine's payload, which this cut does not `
      + `read. A file carrying them blank would still leave here looking official, so `
      + `no file was written. Switch to SOLAR, BATTERY, ONSHORE or OFFSHORE to export `
      + `this product's own cut.`,
    missing,
  };
}

export async function mountWiderFleet({ host, payloadAsset, presentSummary, onSpineRepaint, metricActions = () => "", metricLookup = () => undefined }) {
  /* The seam is handed in, and its absence is fatal rather than silent: a
     mount that could not reach it would paint a table under the previous
     technology's counter, which is the defect this generation exists to end.
     app.mjs invariants the contract fields that promise this call, so the two
     halves cannot drift apart unnoticed. */
  if (typeof presentSummary !== "function") {
    throw new Error("wider fleet: the spine did not hand over its summary seam");
  }
  /* Fatal for the same reason, and not optional: a mount that could
     not be told the spine had repainted would go on naming a cut that
     had left the table, which is the defect this generation exists to
     end. A missing input fails here; it does not skip. */
  if (typeof onSpineRepaint !== "function") {
    throw new Error("wider fleet: the spine did not hand over its release seam");
  }
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

  let localQuery=(new URL(location.href).searchParams.get('wider_q')||'').slice(0,120);
  const localFilter=document.createElement('input');localFilter.type='search';localFilter.id='widerLocalFilter';localFilter.maxLength=120;
  localFilter.placeholder='Name, operator, postcode or REPD ref';localFilter.setAttribute('aria-label','Filter selected wider-fleet technology');
  localFilter.style.cssText='box-sizing:border-box;min-height:44px;width:100%;max-width:480px;background:#05090d;color:#dbeafe;border:1px solid #37516b;padding:8px;font:12px monospace';
  localFilter.value=localQuery;localFilter.disabled=true;group.append(localFilter);
  localFilter.addEventListener('input',()=>{if(!active)return;localQuery=localFilter.value;page=0;renderWider();writeDeepLink(active);});

  const orderControl=document.createElement('select');orderControl.id='widerOrder';orderControl.setAttribute('aria-label','Order selected wider-fleet technology');
  orderControl.style.cssText=localFilter.style.cssText;orderControl.disabled=true;
  for(const [value,label] of [['capacity_desc','Capacity: largest first'],['name_asc','Site name: A to Z'],['grid_asc','Shortest listed GRID distance'],['sub_asc','Shortest listed SUB distance']]){const option=document.createElement('option');option.value=value;option.textContent=label;orderControl.append(option);}
  const requestedOrder=new URL(location.href).searchParams.get('wider_sort');if([...orderControl.options].some(option=>option.value===requestedOrder))orderControl.value=requestedOrder;
  group.append(orderControl);orderControl.addEventListener('change',()=>{if(!active)return;page=0;renderWider();writeDeepLink(active);});

  const geoExport=document.createElement('button');geoExport.type='button';geoExport.id='widerGeoJSON';geoExport.textContent='SAVE WIDER-FLEET GEOJSON';
  geoExport.style.cssText=localFilter.style.cssText+';cursor:pointer';geoExport.disabled=true;group.append(geoExport);
  geoExport.addEventListener('click',()=>{
    if(!active)return;
    try {
      const data=widerGeoJSON(visible(),metricLookup,{release:'202609060340',technology:active,query:localQuery,order:orderControl.value,payload:{path:payloadAsset.url,sha256:payloadAsset.sha256}});
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/geo+json'}));
      const link=document.createElement('a');link.href=url;link.download='wider-fleet-202609060340.geojson';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      document.getElementById('exportMeta').textContent=data.features.length+' filtered wider-fleet site groups exported; exact REPD memberships retained.';
    }catch(error){document.getElementById('exportMeta').textContent='Wider-fleet export failed: '+error.message;}
  });

  let active = null;
  let page = 0;
  /* The spine tab the reader was on when they reached into the control, so
     that returning to its first entry hands the product back where they left
     it instead of to ALL TECH. */
  let returnTab = null;

  const visible = () => sortWiderRows(filterWiderRows(active ? rows.filter((row) => row.rt === active) : [],localQuery),orderControl.value,metricLookup);

  function clearWider() {
    geoExport.disabled=true;
    orderControl.disabled=true;orderControl.value='capacity_desc';
    localFilter.disabled=true;localQuery='';localFilter.value='';
    const cleanUrl=new URL(location.href);cleanUrl.searchParams.delete('wider_q');cleanUrl.searchParams.delete('wider_sort');history.replaceState(null,'',cleanUrl);
    select.value = "";
    select.classList.remove("is-chosen");
    active = null;
    returnTab = null;
    if (host) { host.hidden = true; host.innerHTML = ""; }
    /* Hand the surfaces back. This restores nothing and repaints nothing:
       it drops the export provider and clears the export strip, and the
       spine's own apply() paints the product's figures, as it always did. */
    presentSummary(null);
  }

  function renderWider() {
    const shown = visible();
    let megawatts = 0;
    let largest = 0;
    for (const row of shown) {
      megawatts += row.c;
      if (row.c > largest) largest = row.c;
    }

    /* ONE CALL, EVERY SURFACE A SUMMARY DRIVES.

       This block used to write #v1/#v2/#v3 by hand, and only those. The three
       gauge ARCS are painted by the spine's updateChart against the canvases
       g1/g2/g3, which nothing here could reach, so the ring went on showing
       the previous technology's proportion with this technology's number
       printed inside it -- verified by comparing toDataURL across a switch,
       identical byte for byte. The record counter above the table was never
       written at all, and EXPORT FILTERED CSV went on believing it held the
       spine's rows.

       Handing the figures to the spine's seam instead makes those four
       surfaces one decision. The arcs are drawn against the spine's own
       register totals, exactly as they are for its own four tabs, so the ring
       and the number inside it are now the same measurement.

       `total` is this cut's own 1,101 display identities, not the spine's 7,680: there is
       no flywheel in the spine's register, and "1 of 7,680 records" would
       have been a new wrong number. The export provider declines and says
       what it cannot fill; it is a function so that it is answered against
       the rows on screen at the moment of the click, not at render time. */
    presentSummary({
      count: shown.length,
      total: rows.length,
      capacity: Number(megawatts.toFixed(2)),
      largest,
      exportProvider: (request) => declineExport(request, active, shown),
    });

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

    tableBody.innerHTML = shown.slice(page * PAGE, page * PAGE + PAGE).map((row) => `<tr class="wider-fleet-row">
      <td class="site">${esc(row.n)}<div class="project-meta">${esc(row.rt)}</div><div class="mobile-extra">${esc(row.o || "")}</div></td>
      <td class="hide-mobile">${esc(row.cty || "—")}</td>
      <td class="hide-mobile town-cell">&mdash;</td>
      <td class="hide-mobile reference-cell">${esc(row.pc || "—")}</td>
      <td class="hide-mobile">${esc(row.o || "—")}</td>
      <td><span class="badge" style="background:${FAMILY_COLOUR[row.t] || "#888"};color:#04080a">${esc(row.rt)}</span></td>
      <td>${esc(displayStatuses(row))}</td>
      <td class="mw">${num(row.c)} MW</td>
      <td class="hide-mobile reference-cell repd-ref">${esc(displayRefs(row) || "—")}</td>
      <td class="hide-mobile reference-cell globalgrid-ref">${displayRefs(row) ? repdRecords(row).map(({ ref }) => "GG2050-REPD-" + esc(ref)).join(" / ") : "&mdash;"}</td>
      <td class="hide-mobile reference-cell repd-updated">&mdash;</td>
      <td><span class="signal none">&mdash;</span><div class="signal-note">no news binding on this tab</div></td>
      <td><div class="project-actions">${mapActions(row)} ${metricActions(row)}</div></td>
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
    if(type && orderControl.value!=='capacity_desc')url.searchParams.set('wider_sort',orderControl.value);else url.searchParams.delete('wider_sort');
    if(type && localQuery)url.searchParams.set('wider_q',localQuery);else url.searchParams.delete('wider_q');
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
    localFilter.disabled=false;orderControl.disabled=false;geoExport.disabled=false;
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

  /* Every OTHER spine control — the sort select, the twelve sort
     headings, the county select, the five status tabs, the search box,
     the two size handles and their boxes, CLEAR FILTERS — repaints the
     table through the spine's apply(), which now says so. Letting go
     here means the control and the table can no longer disagree, and it
     is one registration rather than a list of ids that a control added
     tomorrow would not be on.

     Guarded on `active` so that a repaint while the product already has
     its own table costs nothing: clearWider() calls presentSummary(null),
     and doing that on every apply() would clear the export strip the
     spine had just set. */
  onSpineRepaint(() => {
    if (!active) return;
    clearWider();
    page = 0;
  });

  if (windowControls) {
    windowControls.addEventListener("click", (event) => {
      if (!active) return;                    // the spine owns its own paging
      const button = event.target.closest("button");
      if (!button || !button.dataset.window) return;
      /* The spine binds its OWN click handler to this same panel, and it moves
         windowStart and calls renderTable() directly rather than going through
         apply(). Listening in the capture phase was never enough on its own:
         both handlers ran, this one paged the wider cut and the spine's then
         repainted its own rows over the top. Measured live on 202609050200
         with LANDFILL GAS showing "1-50 of 275", one press of NEXT gave
         "101-200 of 7,680" project rows under a control still reading
         LANDFILL GAS.

         Stopping propagation here is what makes "the spine owns its own
         paging" true in both directions: the spine keeps the panel while the
         product holds the table, and the cut keeps it while the cut does.
         windowStart is left where it was and apply() zeroes it when the reader
         returns to the product, so nothing is left half-paged. */
      event.stopPropagation();
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
    controlsAdded: 4,
    optionsAdded: options.length,
    /* Stated to app.mjs so a change of mind about the CSV cannot be a
       silent one: it invariants this value at mount. */
    exportPolicy: "declines",
    deepLinked,
    types: types.length,
    projects: rows.length,
    gigawatts: Number((rows.reduce((total, row) => total + row.c, 0) / 1000).toFixed(2)),
  };
}

