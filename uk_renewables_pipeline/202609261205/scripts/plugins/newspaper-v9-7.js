import { state } from "../core/state.js";
import { escapeHtml, normaliseProject } from "../core/utils.js";
import { bindNewspaperV9_5_1, drawNewsV9_5_1, loadNewsV9_5_1 } from "./newspaper-v9-5-1.js";

const REGIONAL_MODES = new Set(["INTERNATIONAL", "US", "EUROPE"]);
const PRIORITY_NEWS_URL = "https://raw.githubusercontent.com/Ventusltd/pipelinenews/main/discovery/products/bbc-rss.json";
let regionalItems = [];
let regionalManifest = null;
let priorityNews = { count: 0, checkedAt: "", status: "unavailable" };

function priorityPayloadValid(payload) {
  return payload
    && payload.schema === "pipelinenews.priority-solar-news.v1"
    && Array.isArray(payload.items)
    && payload.items.every((item) =>
      item && item.topic === "solar"
      && [1, 2, 3].includes(Number(item.source_priority))
      && item.eligible_for_project_signal === false
      && ["ABOVE_1MW", "UNKNOWN_RETAIN_FOR_MATCH"].includes(item.capacity_gate)
      && /^https:\/\//.test(String(item.url || "")));
}

function normalisePriorityItem(item) {
  return {
    ...item,
    priority_uk: true,
    source: item.publisher,
    technology: "SOLAR",
    event: "SOURCE DISCOVERY",
    published: String(item.source_published_at || "").slice(0, 10),
    capacity_mw: item.capacity_mw_max,
    canonical_relevant: false,
    eligible_for_news_signal: false,
    role: "DISCOVERY_ONLY",
  };
}

async function loadPriorityNews() {
  const target = new URL(PRIORITY_NEWS_URL);
  target.searchParams.set("v", Date.now());
  const response = await fetch(target, { cache: "no-store" });
  if (!response.ok) throw new Error(`priority news HTTP ${response.status}`);
  const payload = await response.json();
  if (!priorityPayloadValid(payload)) throw new Error("priority news payload failed contract");

  const byUrl = new Map();
  for (const item of payload.items) byUrl.set(item.url, normalisePriorityItem(item));
  for (const item of state.newsItems) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  state.newsItems = [...byUrl.values()].sort((a, b) => {
    const date = (Date.parse(String(b.published || "")) || 0) - (Date.parse(String(a.published || "")) || 0);
    if (date) return date;
    return Number(a.source_priority || 99) - Number(b.source_priority || 99);
  });
  priorityNews = {
    count: payload.items.length,
    checkedAt: String(payload.checked_at || "").slice(0, 19).replace("T", " "),
    status: String(payload.status || "unknown"),
  };
}

function queryMatches(item) {
  if (!state.newsQuery) return true;
  const haystack = normaliseProject([
    item.headline, item.source, item.technology, item.country, item.region,
  ].join(" "));
  return normaliseProject(state.newsQuery).split(" ").filter(Boolean)
    .every((token) => haystack.includes(token));
}

function regionalRows() {
  return regionalItems.filter((item) => {
    if (!queryMatches(item)) return false;
    if (state.newsMode === "US") return item.region === "US";
    if (state.newsMode === "EUROPE") return item.region === "EUROPE";
    return true;
  });
}

function drawRegional() {
  const stories = document.getElementById("stories");
  const rows = regionalRows();
  if (!rows.length) {
    stories.innerHTML = '<div class="news-empty">No build-verified regional solar or battery headlines match this filter.</div>';
    return;
  }
  stories.innerHTML = rows.map((item) => {
    const articleClass = item.technology.includes("BESS") ? "bess" : "solar";
    const region = item.region === "INTERNATIONAL_OTHER" ? "INTERNATIONAL" : item.region;
    return `<a class="story ${articleClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml(item.technology)} · REGIONAL DISCOVERY · ${escapeHtml(item.published)}</div><h3>${escapeHtml(item.headline)}</h3><p><span class="project">${escapeHtml(region)} · ${escapeHtml(item.country)}</span>${item.source ? ` · ${escapeHtml(item.source)}` : ""}</p><span class="source"><span class="news-quality relevant">${escapeHtml(region)}</span> · build-verified ${escapeHtml(item.classifier_version)} · published decision ledger · no REPD project signal</span></a>`;
  }).join("");
}

export function drawNewsV9_7() {
  if (REGIONAL_MODES.has(state.newsMode)) {
    drawRegional();
    return;
  }
  if (state.newsMode === "UK") {
    state.newsMode = "RELEVANT";
    drawNewsV9_5_1();
    state.newsMode = "UK";
    return;
  }
  drawNewsV9_5_1();
}

async function fetchCommitted(path) {
  const url = new URL(path, import.meta.url);
  url.searchParams.set("v", "9.7");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}

export async function loadNewsV9_7() {
  await loadNewsV9_5_1();
  let priorityError = null;
  try {
    await loadPriorityNews();
  } catch (error) {
    priorityError = error;
    console.error("Priority UK news unavailable", error);
  }
  try {
    const [regional, manifest] = await Promise.all([
      fetchCommitted("../../data/v9.7/regional_news.json"),
      fetchCommitted("../../data/v9.7/regional_manifest.json"),
    ]);
    if (regional.schema !== "globalgrid2050.regional-news.v9.7"
      || regional.release !== "9.7" || !Array.isArray(regional.articles)
      || !regional.articles.every((item) => item.project_signal_eligible === false)) {
      throw new Error("invalid committed regional artifact");
    }
    regionalItems = regional.articles;
    regionalManifest = manifest;
    const counts = regionalManifest.telemetry.by_region;
    const canonicalUk = state.newsItems.filter((item) => item.canonical_relevant === true).length;
    const prioritySuffix = priorityError
      ? "priority feed unavailable; frozen news retained"
      : `${priorityNews.count} priority UK source items · checked ${priorityNews.checkedAt || "unknown"} · ${priorityNews.status}`;
    document.getElementById("newsMeta").textContent = `${canonicalUk} canonical UK · ${regionalItems.length} international (${counts.US} US · ${counts.EUROPE} Europe · ${counts.INTERNATIONAL_OTHER} other) · ${state.newsItems.length} headlines · ${prioritySuffix}`;
  } catch (error) {
    regionalItems = [];
    const prioritySuffix = priorityError
      ? "priority feed unavailable"
      : `${priorityNews.count} priority UK source items · checked ${priorityNews.checkedAt || "unknown"} · ${priorityNews.status}`;
    document.getElementById("newsMeta").textContent = `${state.newsItems.length} headlines · ${prioritySuffix} · regional ledger unavailable`;
    console.error("V9.7 regional artifact unavailable", error);
  }
  drawNewsV9_7();
}

export function bindNewspaperV9_7(onNewsLoaded) {
  bindNewspaperV9_5_1(onNewsLoaded);
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.newsMode = button.dataset.news;
      drawNewsV9_7();
    };
  });
  document.getElementById("newsSearch").oninput = (event) => {
    state.newsQuery = event.target.value.trim();
    drawNewsV9_7();
  };
}
