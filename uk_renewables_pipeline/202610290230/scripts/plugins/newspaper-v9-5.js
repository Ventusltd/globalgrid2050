import { state } from "../core/state.js";
import { escapeHtml, isFinanceEvent, normaliseProject } from "../core/utils.js";

const NEWS_SOURCES = Object.freeze([
  ["Pages", "../../dist/major_project_news_v6.json"],
  ["GitHub main", "https://raw.githubusercontent.com/Ventusltd/globalgrid2050/main/dist/major_project_news_v6.json"],
]);

let refreshProjects = () => {};
let newsIndex = new Map();

function canonicalItem(item) {
  return item
    && item.role === "PRIMARY_MATCH"
    && item.eligible_for_news_signal === true
    && String(item.repd_ref || "")
    && String(item.gg_project_id || "");
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

export function signalForProjectV9_5(project) {
  const item = newsIndex.get(String(project.repd_ref));
  if (!item) {
    const note = ["solar", "bess"].includes(project.technology)
      ? "no canonical PRIMARY_MATCH in current V9.5 feed"
      : "canonical V9.5 feed does not yet cover wind";
    return { label: "—", cls: "none", note };
  }
  return {
    ...signalLabel(item),
    note: `canonical PRIMARY_MATCH ${Number(item.confidence || 0)}% · unverified event · ${item.published || "date unavailable"}`,
  };
}

function newsMatches(item) {
  const event = String(item.event || "").toUpperCase();
  const technology = String(item.technology || "").toUpperCase();
  if (state.newsMode === "SOLAR" && technology !== "SOLAR") return false;
  if (state.newsMode === "BESS" && technology !== "BESS") return false;
  if (state.newsMode === "CONSENT" && event !== "CONSENT") return false;
  if (state.newsMode === "CONSTRUCTION" && event !== "CONSTRUCTION") return false;
  if (state.newsMode === "OPERATIONAL" && event !== "OPERATIONAL") return false;
  if (state.newsMode === "FINANCE" && !isFinanceEvent(event)) return false;
  if (state.newsQuery) {
    const haystack = normaliseProject([
      item.headline, item.project, item.operator, item.county, item.source,
      item.event, item.repd_ref, item.gg_project_id,
    ].join(" "));
    const tokens = normaliseProject(state.newsQuery).split(" ").filter(Boolean);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
}

export function drawNewsV9_5() {
  const stories = document.getElementById("stories");
  const rows = state.newsItems.filter(newsMatches);
  if (!rows.length) {
    stories.innerHTML = '<div class="news-empty">No canonical headlines match this newspaper filter.</div>';
    return;
  }
  stories.innerHTML = rows.map((item) => {
    const articleClass = String(item.technology || "").toLowerCase() === "bess" ? "bess" : "solar";
    const capacity = Number(item.capacity_mw || 0);
    return `<a class="story ${articleClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml((item.technology || "").toUpperCase())} · ${escapeHtml(item.event || "PROJECT UPDATE")} · ${escapeHtml(item.published || "")}</div><h3>${escapeHtml(item.headline || item.project)}</h3><p><span class="project">${escapeHtml(item.project || "")}${capacity ? ` · ${capacity.toLocaleString("en-GB")} MW` : ""}</span>${item.operator ? ` · ${escapeHtml(item.operator)}` : ""}${item.county ? ` · ${escapeHtml(item.county)}` : ""}</p><span class="source">${escapeHtml(item.source || "Source")} · PRIMARY_MATCH ${Number(item.confidence || 0)}% · REPD ${escapeHtml(item.repd_ref)} · algorithmic and unverified</span></a>`;
  }).join("");
}

function renderNews(payload, label) {
  state.newsItems = payload.items.filter(canonicalItem);
  indexNewsItems(state.newsItems);
  document.getElementById("newsMeta").textContent = `${state.newsItems.length} canonical PRIMARY_MATCH headlines · ${String(payload.updated || "").slice(0, 10)} · ${label}`;
  drawNewsV9_5();
  if (state.all.length) refreshProjects();
}

function validPayload(payload) {
  return payload
    && payload.schema === "globalgrid2050.major-project-news.v6"
    && Array.isArray(payload.items)
    && payload.items.every(canonicalItem)
    && Number(payload.headline_count) === payload.items.length;
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
  if (!validPayload(data)) throw new Error(`${label} invalid canonical payload`);
  return { label, data };
}

export async function loadNewsV9_5() {
  const settled = await Promise.allSettled(NEWS_SOURCES.map(([label, url]) => fetchPayload(label, url)));
  const good = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!good.length) {
    document.getElementById("stories").innerHTML = '<div class="news-empty">Canonical newspaper feed unavailable. REPD analytics below remain live.</div>';
    document.getElementById("newsMeta").textContent = "canonical feed unavailable";
    return;
  }
  good.sort((left, right) => payloadTime(right.data) - payloadTime(left.data)
    || right.data.items.length - left.data.items.length);
  renderNews(good[0].data, good[0].label);
}

export function bindNewspaperV9_5(onNewsLoaded) {
  refreshProjects = onNewsLoaded;
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.newsMode = button.dataset.news;
      drawNewsV9_5();
    };
  });
  document.getElementById("newsSearch").oninput = (event) => {
    state.newsQuery = event.target.value.trim();
    drawNewsV9_5();
  };
}
