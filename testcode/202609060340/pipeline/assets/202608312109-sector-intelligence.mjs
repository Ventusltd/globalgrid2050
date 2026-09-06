// This module is a new cartridge over the immutable 202608272130 payload.
// The two identities must not be collapsed into one constant.
const GENERATION = "202608312109";
const PAYLOAD_GENERATION = "202608272130";
const PAYLOAD_SCHEMA = "pipelinenews.sector-intelligence-browser.v3";
const USAGE_CONTEXT = "NON_COMMERCIAL_OPEN_SOURCE";
const TOPICS = Object.freeze([
  Object.freeze({ code: "DATA_CENTRES", label: "DATA CENTRES", rank: 1 }),
  Object.freeze({ code: "INVERTER_SECURITY_POLICY", label: "INVERTERS · SECURITY", rank: 2 }),
  Object.freeze({ code: "ENERGY_SECURITY_HORMUZ", label: "STRAIT OF HORMUZ", rank: 3 }),
  Object.freeze({ code: "ENERGY_SECURITY_UKRAINE", label: "UKRAINE", rank: 4 }),
  Object.freeze({ code: "GREAT_GRID_UPGRADE", label: "GREAT GRID UPGRADE", rank: 5 }),
  Object.freeze({ code: "WORLDWIDE_PV", label: "WORLDWIDE PV", rank: 6 }),
  Object.freeze({ code: "MV_HV_COMPONENTS", label: "MV/HV COMPONENTS", rank: 7 }),
]);
// Which topics may be shown.
//
// The collector was asked for seven subjects and returned a generic GOV.UK feed
// for six of them. Counted on the shipped payload, 51 items:
//
//   DATA_CENTRES              9 of 9 on topic
//   GREAT_GRID_UPGRADE        1 of 6   (five are retail sales, waste sites, FOI)
//   INVERTER_SECURITY_POLICY  2 of 12  (a cleared fly-tip, firing times, Syria)
//   MV_HV_COMPONENTS          0 of 6
//   WORLDWIDE_PV              0 of 6
//   ENERGY_SECURITY_HORMUZ    0 of 6
//   ENERGY_SECURITY_UKRAINE   0 of 6
//
// "Biometrics and Surveillance Camera Commissioner FOI responses 2026" and
// "The economic benefits of touring and impact of EU exit" each appear under
// FIVE different topics, which is the collector falling back to the same feed
// every time it found nothing.
//
// That is not a filter problem. Six of these topics have no intelligence in
// them, and an item-level filter would leave six near-empty sections still
// claiming to cover a subject. Only the topic that works is shown, and the page
// says the others are withheld and why. The rows stay in the payload so the
// collector can be fixed and the topics restored without another release here.
//
// The two geopolitical topics would not return even if they were populated.
// This page is for engineering and business; a named flashpoint is neither, it
// dates badly, and it carries a keyword profile that has nothing to do with
// whether a substation has headroom.
const SHOWN_TOPICS = Object.freeze(new Set(["DATA_CENTRES"]));
const NEVER_SHOWN_TOPICS = Object.freeze(new Set([
  "ENERGY_SECURITY_HORMUZ",
  "ENERGY_SECURITY_UKRAINE",
]));

function topicIsShown(code) {
  return SHOWN_TOPICS.has(code) && !NEVER_SHOWN_TOPICS.has(code);
}

const EXPECTED_FIELDS = Object.freeze([
  "topic_code", "topic_display_rank", "intelligence_item_id", "item_kind", "title", "summary", "canonical_url",
  "source_published_at", "observed_at", "staleness_state", "status", "evidence_class", "source_id",
  "source_licence_id", "source_terms_url", "redistribution_rights", "attribution", "owner_repository",
  "owner_generation", "owner_record_id", "generic_article_id", "value_min", "value_max", "unit", "binding_label",
  "project_binding_count", "eligible_for_news_signal",
]);
const FORBIDDEN_FIELDS = Object.freeze([
  "repd_ref", "gg_project_id", "project", "technology", "capacity_mw", "operator", "county", "related_context_repd_ref",
]);

export const SECTOR_INTELLIGENCE_CARTRIDGE_CONTRACT = Object.freeze({
  schema: "pipelinenews.sector-intelligence-cartridge.v3",
  generation: GENERATION,
  usage_context: USAGE_CONTEXT,
  usage_context_establishes_upstream_rights: false,
  activation: "dynamic-import-on-user-open; payload-fetch-on-first-topic-selection",
  topics: TOPICS,
  payload_schema: PAYLOAD_SCHEMA,
  startup_module_requests: 0,
  startup_payload_requests: 0,
  maximum_payload_requests: 1,
  maximum_rows_per_topic: 24,
  generic_news_rows_mutated: false,
  project_bindings: 0,
  eligible_for_news_signal: false,
  atman_runtime_dependency: false,
  deployment: "not-authorised",
});

const mounted = new WeakMap();

function element(tag, attributes = {}, text = null) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (name === "class") node.className = value;
    else node.setAttribute(name, String(value));
  }
  if (text !== null) node.textContent = String(text);
  return node;
}

function installStyles() {
  if (document.querySelector(`style[data-sector-generation="${GENERATION}"]`)) return;
  const style = document.createElement("style");
  style.dataset.sectorGeneration = GENERATION;
  style.textContent = `
    .sector-shell{border:1px solid #3e4650;background:#0d1117;color:#f0f4f8;margin:12px 0;padding:12px;min-width:0}
    .sector-head{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:flex-start}
    .sector-head h2{color:#00ffff;font:700 17px/1.2 monospace;margin:0}
    .sector-head p{color:#b9c2cb;font:11px/1.45 monospace;margin:5px 0 0;max-width:900px}
    .sector-tabs{display:flex;gap:6px;overflow-x:auto;overscroll-behavior:contain;padding:12px 0}
    .sector-tabs button{background:#171d24;border:1px solid #65717c;color:#fff;cursor:pointer;flex:none;font:700 10px/1.2 monospace;min-height:44px;padding:8px 12px}
    .sector-tabs button[aria-selected="true"]{background:#00343b;border-color:#00ffff;color:#00ffff}
    .sector-list{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));min-width:0}
    .sector-card{background:#141a20;border:1px solid #343f49;min-width:0;padding:10px}
    .sector-card>a{align-items:center;color:#ffeb3b;display:inline-flex;font:700 12px/1.4 monospace;min-height:44px;overflow-wrap:anywhere;text-decoration:none}
    .sector-card>a:focus-visible,.sector-card>a:hover{text-decoration:underline}
    .sector-card p{color:#b8c0c8;font:10px/1.45 monospace;margin:6px 0;overflow-wrap:anywhere}
    .sector-card .sector-binding{border:1px solid #56616d;color:#00ff88;display:inline-block;font-weight:700;padding:4px 7px}
    .sector-message{border:1px dashed #52606d;color:#adb7c2;font:11px/1.45 monospace;padding:18px}
    @media (max-width:768px),((orientation:landscape) and (max-height:500px)){
      .sector-shell{padding:8px}.sector-list{grid-template-columns:1fr}.sector-card>a{min-height:44px}
    }
  `;
  document.head.appendChild(style);
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function validateAsset(asset) {
  if (!asset || typeof asset !== "object") throw new Error("sector payload asset is missing");
  if (!/^data\/202608272130-sector-intelligence\.json$/u.test(asset.url)) throw new Error("sector payload URL changed");
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) throw new Error("sector payload byte count is invalid");
  if (!/^[a-f0-9]{64}$/u.test(asset.sha256)) throw new Error("sector payload digest is invalid");
}

function decodePayload(payload) {
  if (payload.schema !== PAYLOAD_SCHEMA || payload.generation !== PAYLOAD_GENERATION) throw new Error("sector payload identity mismatch");
  if (payload.usage_context !== USAGE_CONTEXT || payload.usage_context_establishes_upstream_rights !== false) {
    throw new Error("sector usage/right separation mismatch");
  }
  if (payload.derived_only_from_landed_parquet_duckdb_readback !== true) throw new Error("sector payload lacks landed-Parquet lineage");
  if (payload.project_bindings !== 0 || payload.eligible_for_news_signal !== false || payload.generic_news_rows_mutated !== false) {
    throw new Error("sector payload crossed the generic-news or project-binding boundary");
  }
  if (JSON.stringify(payload.fields) !== JSON.stringify(EXPECTED_FIELDS)) throw new Error("sector payload field contract changed");
  for (const field of FORBIDDEN_FIELDS) if (payload.fields.includes(field)) throw new Error(`query identity field entered sector payload: ${field}`);
  if (!Array.isArray(payload.rows)) throw new Error("sector payload rows are missing");
  const rows = payload.rows.map((values) => {
    if (!Array.isArray(values) || values.length !== EXPECTED_FIELDS.length) throw new Error("sector payload row width changed");
    const row = Object.fromEntries(EXPECTED_FIELDS.map((field, index) => [field, values[index]]));
    if (!/^GG2050-SECTOR-ITEM-[A-F0-9]{20}$/u.test(row.intelligence_item_id)) throw new Error("sector item identity changed");
    if (row.project_binding_count !== 0 || row.eligible_for_news_signal !== false) throw new Error("sector item attempted a project signal");
    if (!TOPICS.some(({ code, rank }) => code === row.topic_code && rank === row.topic_display_rank)) throw new Error("sector topic changed");
    for (const field of ["source_licence_id", "source_terms_url", "redistribution_rights", "attribution"]) {
      if (!row[field]) throw new Error(`source-specific rights field is empty: ${field}`);
    }
    const expectedLabel = row.generic_article_id
      ? "SECTOR CONTEXT ONLY — QUERY PROJECT IDENTITY REMOVED"
      : "SECTOR CONTEXT ONLY — NOT A PROJECT BINDING";
    if (row.binding_label !== expectedLabel) throw new Error("sector context label changed");
    return Object.freeze(row);
  });
  if (new Set(rows.map(({ intelligence_item_id, topic_code }) => `${intelligence_item_id}\u001f${topic_code}`)).size !== rows.length) {
    throw new Error("sector browser key collision");
  }
  for (const topic of TOPICS.filter(({ code }) => topicIsShown(code))) {
    if (rows.filter(({ topic_code }) => topic_code === topic.code).length > payload.maximum_rows_per_topic) {
      throw new Error("sector browser topic row limit exceeded");
    }
  }
  return Object.freeze(rows);
}

async function loadPayload(asset) {
  validateAsset(asset);
  const response = await fetch(asset.url, { cache: "force-cache", credentials: "same-origin" });
  if (!response.ok) throw new Error(`sector payload request failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes) throw new Error("sector payload byte count mismatch");
  if (await sha256Hex(bytes) !== asset.sha256) throw new Error("sector payload digest mismatch");
  return decodePayload(JSON.parse(new TextDecoder().decode(bytes)));
}

function renderRows(container, rows) {
  container.replaceChildren();
  if (!rows.length) {
    container.appendChild(element("div", { class: "sector-message" }, "No retained source metadata is available for this topic."));
    return;
  }
  for (const row of rows) {
    const card = element("article", { class: "sector-card", "data-sector-item-id": row.intelligence_item_id });
    const title = element("a", { href: row.canonical_url, target: "_blank", rel: "noopener noreferrer" }, row.title);
    const rights = element("p");
    const terms = element("a", { href: row.source_terms_url, target: "_blank", rel: "noopener noreferrer" }, row.source_licence_id);
    rights.append(document.createTextNode(`${row.attribution} · ${row.redistribution_rights} · `), terms);
    card.append(title);
    if (row.summary) card.appendChild(element("p", {}, row.summary));
    if (row.item_kind === "CONTEXT_METRIC") {
      const range = row.value_min === row.value_max ? `${row.value_min}` : `${row.value_min}–${row.value_max}`;
      card.appendChild(element("p", {}, `PINNED OWNER CONTEXT METRIC · ${range} ${row.unit}`));
    }
    card.append(
      rights,
      element("p", {}, `${row.evidence_class} · ${String(row.source_published_at || row.observed_at).slice(0, 10)} · ${row.staleness_state}`),
      element("p", { class: "sector-binding" }, row.binding_label),
    );
    container.appendChild(card);
  }
}

export function mountSectorIntelligence({ host, payloadAsset }) {
  if (!(host instanceof HTMLElement)) throw new Error("sector intelligence host is missing");
  if (mounted.has(host)) return mounted.get(host);
  validateAsset(payloadAsset);
  installStyles();
  const shell = element("section", { class: "sector-shell", "aria-label": "Sector intelligence" });
  const header = element("div", { class: "sector-head" });
  const heading = element("div");
  heading.append(
    element("h2", {}, "SOURCE-AND-EVIDENCE SECTOR INTELLIGENCE"),
    element("p", {}, "Ventus Ltd application context: non-commercial open source. Upstream rights remain source-specific and are shown on every item."),
    element("p", {}, "Sector context is separate from the filtered news edition and cannot create or alter REPD project identity."),
  );
  const status = element("p", { "data-sector-status": "WAIT" }, "WAIT · choose one topic; no payload has been requested.");
  header.append(heading, status);
  const tabs = element("div", { class: "sector-tabs", role: "tablist", "aria-label": "Sector topics" });
  const list = element("div", { class: "sector-list", role: "tabpanel" });
  list.appendChild(element("div", { class: "sector-message" }, "Choose a topic to load one compact DuckDB/Parquet-derived cartridge."));
  const buttons = new Map();
  let payloadPromise = null;
  let payloadRequests = 0;
  async function select(topic) {
    for (const [code, button] of buttons) button.setAttribute("aria-selected", String(code === topic));
    status.dataset.sectorStatus = "LOAD";
    status.textContent = `LOAD · ${topic}`;
    list.replaceChildren(element("div", { class: "sector-message" }, "Loading bounded sector metadata…"));
    try {
      if (!payloadPromise) {
        payloadRequests += 1;
        if (payloadRequests > 1) throw new Error("sector payload request budget exceeded");
        payloadPromise = loadPayload(payloadAsset);
      }
      const allRows = await payloadPromise;
      const rows = allRows.filter((row) => row.topic_code === topic);
      renderRows(list, rows);
      status.dataset.sectorStatus = rows.length ? "OK" : "EMPTY";
      status.textContent = `${rows.length ? "OK" : "EMPTY"} · ${rows.length} rows · landed ZSTD Parquet readback`;
    } catch (error) {
      status.dataset.sectorStatus = "FAIL";
      status.textContent = "FAIL · sector topic unavailable; core newspaper and project register are unchanged.";
      list.replaceChildren(element("div", { class: "sector-message" }, "Sector intelligence failed closed."));
      throw error;
    }
  }
  // Only the topics that carry real content get a tab. The rest stay in the
  // payload and out of the interface.
  for (const topic of TOPICS.filter(({ code }) => topicIsShown(code))) {
    const button = element("button", { type: "button", role: "tab", "aria-selected": "false", "data-sector-topic": topic.code }, topic.label);
    button.addEventListener("click", () => select(topic.code).catch((error) => console.error("sector intelligence", error)));
    buttons.set(topic.code, button);
    tabs.appendChild(button);
  }
  const withheld = TOPICS.filter(({ code }) => !topicIsShown(code));
  if (withheld.length) {
    shell.append(element("div", { class: "sector-message" },
      `${withheld.length} topics withheld: the upstream collector returned a generic `
      + `government feed rather than results on those subjects, so they carried no `
      + `sector intelligence. Their rows remain in the payload.`));
  }
  shell.append(header, tabs, list);
  host.replaceChildren(shell);
  host.hidden = false;
  host.dataset.sectorIntelligenceState = "ready";
  const result = Object.freeze({ shell, tabs, list, status, buttons, select, get payloadRequests() { return payloadRequests; } });
  mounted.set(host, result);
  return result;
}
