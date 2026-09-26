import { DATA_SOURCES, state } from "../core/state.js";
import { escapeHtml, isFinanceEvent, normaliseProject } from "../core/utils.js";

let refreshProjects = () => {};

export function signalForProject(name) {
  const normalised = normaliseProject(name);
  const hit = state.newsItems.find((item) => normaliseProject(item.project) === normalised);
  if (!hit) return { label: "—", cls: "none", note: "no matched headline" };

  const event = String(hit.event || "PROJECT UPDATE").toUpperCase();
  if (event === "CONSENT") return { label: "APPROVED*", cls: "approved", note: `headline ${hit.published || ""}` };
  if (event === "OPERATIONAL") return { label: "OPERATIONAL*", cls: "operational", note: `headline ${hit.published || ""}` };
  if (event === "CONSTRUCTION") return { label: "CONSTRUCTION*", cls: "construction", note: `headline ${hit.published || ""}` };
  if (["FINANCIAL CLOSE", "ACQUISITION"].includes(event)) {
    return {
      label: event === "ACQUISITION" ? "M&A*" : "FINANCED*",
      cls: "finance",
      note: `headline ${hit.published || ""}`,
    };
  }
  return { label: `${event}*`.slice(0, 22), cls: "", note: `headline ${hit.published || ""}` };
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
    const haystack = [item.headline, item.project, item.operator, item.county, item.source, item.event]
      .join(" ")
      .toUpperCase();
    if (!haystack.includes(state.newsQuery)) return false;
  }
  return true;
}

export function drawNews() {
  const stories = document.getElementById("stories");
  const rows = state.newsItems.filter(newsMatches);
  if (!rows.length) {
    stories.innerHTML = '<div class="news-empty">No headlines match this newspaper filter.</div>';
    return;
  }

  stories.innerHTML = rows.map((item) => {
    const articleClass = item.technology === "bess" ? "bess" : "solar";
    const capacity = Number(item.capacity_mw || 0);
    const confidence = Number(item.confidence || 0);
    return `<a class="story ${articleClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml((item.technology || "").toUpperCase())} · ${escapeHtml(item.event || "PROJECT UPDATE")} · ${escapeHtml(item.published || "")}</div><h3>${escapeHtml(item.headline || item.project)}</h3><p><span class="project">${escapeHtml(item.project || "")}${capacity ? ` · ${capacity.toLocaleString()} MW` : ""}</span>${item.operator ? ` · ${escapeHtml(item.operator)}` : ""}${item.county ? ` · ${escapeHtml(item.county)}` : ""}</p><span class="source">${escapeHtml(item.source || "Source")}${confidence ? ` · match ${confidence}%` : ""}</span></a>`;
  }).join("");
}

function renderNews(payload) {
  state.newsItems = Array.isArray(payload.items) ? payload.items : [];
  const eligible = payload.eligible_projects == null
    ? "REPD universe pending first refresh"
    : `${Number(payload.eligible_projects).toLocaleString()} eligible projects`;
  document.getElementById("newsMeta").textContent = `${state.newsItems.length} headlines · ${eligible} · ${String(payload.updated || "").slice(0, 10)}`;
  drawNews();
  if (state.all.length) refreshProjects();
}

function validPayload(payload) {
  return payload
    && Array.isArray(payload.items)
    && Number.isFinite(Number(payload.headline_count ?? payload.items.length));
}

function payloadTime(payload) {
  const timestamp = Date.parse(String(payload && payload.updated || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

async function fetchPayload(label, url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} ${response.status}`);
  const data = await response.json();
  if (!validPayload(data)) throw new Error(`${label} invalid payload`);
  return { label, data };
}

export async function loadNews() {
  const stamp = Date.now();
  const sources = [
    ["Pages", `${DATA_SOURCES.newsPages}?v=${stamp}`],
    ["GitHub main", `${DATA_SOURCES.newsGitHub}?v=${stamp}`],
  ];
  const settled = await Promise.allSettled(sources.map(([label, url]) => fetchPayload(label, url)));
  const good = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!good.length) {
    document.getElementById("stories").innerHTML = '<div class="news-empty">Daily newspaper feed unavailable. REPD analytics below remain live.</div>';
    document.getElementById("newsMeta").textContent = "feed unavailable";
    return;
  }

  good.sort((left, right) => payloadTime(right.data) - payloadTime(left.data)
    || ((right.data.items || []).length - (left.data.items || []).length));
  const best = good[0];
  renderNews(best.data);
  document.getElementById("newsMeta").textContent += ` · ${best.label}`;
}

export function bindNewspaper(onNewsLoaded) {
  refreshProjects = onNewsLoaded;
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.newsMode = button.dataset.news;
      drawNews();
    };
  });
  document.getElementById("newsSearch").oninput = (event) => {
    state.newsQuery = event.target.value.trim().toUpperCase();
    drawNews();
  };
}
