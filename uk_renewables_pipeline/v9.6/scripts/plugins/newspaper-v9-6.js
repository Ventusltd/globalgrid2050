import { state } from "../core/state.js";
import { escapeHtml, isFinanceEvent, normaliseProject } from "../core/utils.js";

const NEWS_SOURCES = Object.freeze([
  ["Pages", "../../dist/major_project_news_v9_5_1.json"],
  ["GitHub main", "https://raw.githubusercontent.com/Ventusltd/globalgrid2050/main/dist/major_project_news_v9_5_1.json"],
]);

let refreshProjects = () => {};
let newsIndex = new Map();
let visibleLimit = 20;
const MOBILE_NEWS_BATCH = 20;

function isMobileView() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
}

function canonicalItem(item) {
  return item
    && item.role === "PRIMARY_MATCH"
    && item.eligible_for_news_signal === true
    && String(item.repd_ref || "")
    && item.gg_project_id === `GG2050-REPD-${item.repd_ref}`;
}

function indexNewsItems(items) {
  newsIndex = new Map();
  for (const item of items.filter(canonicalItem)) {
    const key = String(item.repd_ref);
    const previous = newsIndex.get(key);
    const candidateDate = Date.parse(String(item.published || "")) || 0;
    const previousDate = previous ? Date.parse(String(previous.published || "")) || 0 : 0;
    if (!previous || Number(item.confidence || 0) > Number(previous.confidence || 0)
      || (Number(item.confidence || 0) === Number(previous.confidence || 0) && candidateDate > previousDate)) {
      newsIndex.set(key, item);
    }
  }
}

function signalLabel(item) {
  const event = String(item.event || "PROJECT UPDATE").toUpperCase();
  if (event === "CONSENT") return { label: "APPROVED*", cls: "approved" };
  if (event === "OPERATIONAL") return { label: "OPERATIONAL*", cls: "operational" };
  if (event === "CONSTRUCTION") return { label: "CONSTRUCTION*", cls: "construction" };
  if (["FINANCIAL CLOSE", "ACQUISITION"].includes(event)) {
    return { label: event === "ACQUISITION" ? "M&A*" : "FINANCED*", cls: "finance" };
  }
  return { label: `${event}*`.slice(0, 22), cls: "" };
}

export function signalForProjectV9_6(project) {
  const item = newsIndex.get(String(project.repd_ref));
  if (!item) return { label: "—", cls: "none", note: "no exact canonical PRIMARY_MATCH" };
  return {
    ...signalLabel(item),
    note: `canonical PRIMARY_MATCH ${Number(item.confidence || 0)}% · unverified event · ${item.published || "date unavailable"}`,
  };
}

function itemTechnology(item) {
  return String(item.canonical_technology || item.technology || "").toUpperCase();
}

function newsMatches(item) {
  const event = String(item.event || "").toUpperCase();
  const technology = itemTechnology(item);
  if (state.newsMode === "RELEVANT" && item.canonical_relevant !== true) return false;
  if (state.newsMode === "SOLAR" && technology !== "SOLAR") return false;
  if (state.newsMode === "BESS" && technology !== "BESS") return false;
  if (state.newsMode === "CONSENT" && event !== "CONSENT") return false;
  if (state.newsMode === "CONSTRUCTION" && event !== "CONSTRUCTION") return false;
  if (state.newsMode === "OPERATIONAL" && event !== "OPERATIONAL") return false;
  if (state.newsMode === "FINANCE" && !isFinanceEvent(event)) return false;
  if (state.newsQuery) {
    const haystack = normaliseProject([
      item.headline, item.canonical_project, item.project, item.operator, item.county,
      item.source, item.event, item.repd_ref, item.gg_project_id,
    ].join(" "));
    const tokens = normaliseProject(state.newsQuery).split(" ").filter(Boolean);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
}

export function drawNewsV9_6({ resetVisible = false } = {}) {
  const stories = document.getElementById("stories");
  const rows = state.newsItems.filter(newsMatches);
  if (resetVisible) visibleLimit = MOBILE_NEWS_BATCH;
  if (!rows.length) {
    stories.innerHTML = '<div class="news-empty">No headlines match this newspaper filter.</div>';
    const renderMeta = document.getElementById("newsRenderMeta");
    if (renderMeta) renderMeta.textContent = "0 matching headlines · all loaded";
    const loadMore = document.getElementById("loadMoreNews");
    if (loadMore) loadMore.hidden = true;
    return;
  }
  const visible = isMobileView() ? rows.slice(0, visibleLimit) : rows;
  stories.innerHTML = visible.map((item) => {
    const technology = itemTechnology(item);
    const articleClass = technology === "BESS" ? "bess" : "solar";
    const project = item.canonical_project || item.project || "";
    const capacity = Number(item.canonical_capacity_mw ?? item.capacity_mw ?? 0);
    const quality = item.canonical_relevant === true
      ? `<span class="news-quality relevant">RELEVANT ${Number(item.confidence || 0)}%</span> · PRIMARY_MATCH · REPD ${escapeHtml(item.repd_ref)}`
      : '<span class="news-quality unverified">DISCOVERY ONLY</span> · no project signal';
    return `<a class="story ${articleClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml(technology)} · ${escapeHtml(item.event || "PROJECT UPDATE")} · ${escapeHtml(item.published || "")}</div><h3>${escapeHtml(item.headline || project)}</h3><p><span class="project">${escapeHtml(project)}${capacity ? ` · ${capacity.toLocaleString("en-GB")} MW` : ""}</span>${item.operator ? ` · ${escapeHtml(item.operator)}` : ""}${item.county ? ` · ${escapeHtml(item.county)}` : ""}</p><span class="source">${escapeHtml(item.source || "Source")} · ${quality} · algorithmic and unverified</span></a>`;
  }).join("");
  const renderMeta = document.getElementById("newsRenderMeta");
  if (renderMeta) {
    renderMeta.textContent = isMobileView()
      ? `${visible.length} shown · ${rows.length} matching · all ${state.newsItems.length} loaded`
      : `All ${rows.length} matching headlines shown`;
  }
  const loadMore = document.getElementById("loadMoreNews");
  if (loadMore) loadMore.hidden = !isMobileView() || visible.length >= rows.length;
}

function validPayload(payload) {
  return payload
    && payload.schema === "globalgrid2050.major-project-news.v9.5.1"
    && payload.release === "9.5.1"
    && Array.isArray(payload.all_items)
    && Array.isArray(payload.canonical_items)
    && payload.all_headline_count === payload.all_items.length
    && payload.relevant_headline_count === payload.canonical_items.length
    && payload.v9_4_baseline_headline_count === 125
    && payload.all_items.every((item) => typeof item.canonical_relevant === "boolean")
    && payload.canonical_items.every(canonicalItem)
    && payload.beacon_fen_contract?.repd_ref === "13599"
    && payload.beacon_fen_contract?.official_capacity_mw === 400;
}

function payloadTime(payload) {
  const timestamp = Date.parse(String(payload?.updated || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function fetchPayload(label, url) {
  const target = new URL(url, window.location.href);
  target.searchParams.set("v", Date.now());
  const response = await fetch(target, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} ${response.status}`);
  const data = await response.json();
  if (!validPayload(data)) throw new Error(`${label} invalid V9.5.1 payload`);
  return { label, data };
}

function renderNews(payload, label) {
  state.newsItems = payload.all_items;
  indexNewsItems(payload.canonical_items);
  document.getElementById("newsMeta").textContent = `${payload.relevant_headline_count} relevant / ${payload.all_headline_count} headlines · ${payload.v9_4_baseline_headline_count} V9.4 baseline retained · ${String(payload.updated || "").slice(0, 10)} · ${label}`;
  drawNewsV9_6({ resetVisible: true });
  if (state.all.length) refreshProjects();
}

export async function loadNewsV9_6() {
  const settled = await Promise.allSettled(NEWS_SOURCES.map(([label, url]) => fetchPayload(label, url)));
  const good = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!good.length) {
    document.getElementById("stories").innerHTML = '<div class="news-empty">V9.6 newspaper unavailable. REPD analytics below remain live.</div>';
    document.getElementById("newsMeta").textContent = "newspaper unavailable";
    return;
  }
  good.sort((left, right) => payloadTime(right.data) - payloadTime(left.data)
    || right.data.all_items.length - left.data.all_items.length);
  renderNews(good[0].data, good[0].label);
}

export function bindNewspaperV9_6(onNewsLoaded) {
  refreshProjects = onNewsLoaded;
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.newsMode = button.dataset.news;
      drawNewsV9_6({ resetVisible: true });
    };
  });
  document.getElementById("newsSearch").oninput = (event) => {
    state.newsQuery = event.target.value.trim();
    drawNewsV9_6({ resetVisible: true });
  };
  document.getElementById("loadMoreNews").onclick = () => {
    visibleLimit += MOBILE_NEWS_BATCH;
    drawNewsV9_6();
  };
  const mobileMedia = window.matchMedia("(max-width: 768px)");
  const handleMobileChange = () => {
    visibleLimit = MOBILE_NEWS_BATCH;
    drawNewsV9_6();
  };
  if (typeof mobileMedia.addEventListener === "function") mobileMedia.addEventListener("change", handleMobileChange);
  else mobileMedia.addListener(handleMobileChange);
}
