import { DATA_SOURCES, state } from "../core/state.js";
import { escapeHtml, isFinanceEvent, normaliseProject } from "../core/utils.js";
import { assessNewsItemV9_2 } from "../core/news-relevance-v9-2.js";

let refreshProjects = () => {};
let newsIndex = new Map();

function newsKey(technology, project) {
  return `${String(technology || "").toLowerCase()}|${normaliseProject(project)}`;
}

function indexNewsItems(items) {
  newsIndex = new Map();
  for (const item of items) {
    const assessment = assessNewsItemV9_2(item);
    const candidate = Object.freeze({ item, assessment });
    const key = newsKey(item.technology, item.project);
    const previous = newsIndex.get(key);
    const candidateDate = Date.parse(String(item.published || "")) || 0;
    const previousDate = previous ? Date.parse(String(previous.item.published || "")) || 0 : 0;
    if (!previous || assessment.score > previous.assessment.score
      || (assessment.score === previous.assessment.score && candidateDate > previousDate)) {
      newsIndex.set(key, candidate);
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

export function signalForProjectV9_2(project) {
  const technology = project.technology === "solar" ? "solar" : project.technology === "bess" ? "bess" : "";
  if (!technology) return { label: "—", cls: "none", note: "legacy V5 feed did not cover wind" };
  const candidate = newsIndex.get(newsKey(technology, project.name));
  if (!candidate) return { label: "—", cls: "none", note: "no exact legacy project-name match" };
  if (!candidate.assessment.strong) {
    return {
      label: "—",
      cls: "none",
      note: `legacy headline rejected by V9.2 relevance gate (${candidate.assessment.score}%)`,
    };
  }
  const signal = signalLabel(candidate.item);
  return {
    ...signal,
    note: `algorithmic relevance ${candidate.assessment.score}% · unverified · ${candidate.item.published || "date unavailable"}`,
  };
}

function newsMatches(item) {
  const event = String(item.event || "").toUpperCase();
  const technology = String(item.technology || "").toUpperCase();
  const assessment = assessNewsItemV9_2(item);
  if (state.newsMode === "RELEVANT" && !assessment.strong) return false;
  if (state.newsMode === "SOLAR" && technology !== "SOLAR") return false;
  if (state.newsMode === "BESS" && technology !== "BESS") return false;
  if (state.newsMode === "CONSENT" && event !== "CONSENT") return false;
  if (state.newsMode === "CONSTRUCTION" && event !== "CONSTRUCTION") return false;
  if (state.newsMode === "OPERATIONAL" && event !== "OPERATIONAL") return false;
  if (state.newsMode === "FINANCE" && !isFinanceEvent(event)) return false;
  if (state.newsQuery) {
    const haystack = normaliseProject([
      item.headline,
      item.project,
      item.operator,
      item.county,
      item.source,
      item.event,
    ].join(" "));
    const tokens = normaliseProject(state.newsQuery).split(" ").filter(Boolean);
    if (!tokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
}

export function drawNewsV9_2() {
  const stories = document.getElementById("stories");
  const rows = state.newsItems.filter(newsMatches);
  if (!rows.length) {
    stories.innerHTML = '<div class="news-empty">No headlines match this newspaper filter.</div>';
    return;
  }

  stories.innerHTML = rows.map((item) => {
    const articleClass = String(item.technology || "").toLowerCase() === "bess" ? "bess" : "solar";
    const capacity = Number(item.capacity_mw || 0);
    const assessment = assessNewsItemV9_2(item);
    const qualityClass = assessment.strong ? "relevant" : "unverified";
    const qualityLabel = assessment.strong ? `RELEVANT ${assessment.score}%` : `UNVERIFIED ${assessment.score}%`;
    return `<a class="story ${articleClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml((item.technology || "").toUpperCase())} · ${escapeHtml(item.event || "PROJECT UPDATE")} · ${escapeHtml(item.published || "")}</div><h3>${escapeHtml(item.headline || item.project)}</h3><p><span class="project">${escapeHtml(item.project || "")}${capacity ? ` · ${capacity.toLocaleString("en-GB")} MW` : ""}</span>${item.operator ? ` · ${escapeHtml(item.operator)}` : ""}${item.county ? ` · ${escapeHtml(item.county)}` : ""}</p><span class="source">${escapeHtml(item.source || "Source")} · <span class="news-quality ${qualityClass}">${qualityLabel}</span> · algorithmic only</span></a>`;
  }).join("");
}

function renderNews(payload) {
  state.newsItems = Array.isArray(payload.items) ? payload.items : [];
  indexNewsItems(state.newsItems);
  const relevant = state.newsItems.filter((item) => assessNewsItemV9_2(item).strong).length;
  const eligible = payload.eligible_projects == null
    ? "REPD universe pending first refresh"
    : `${Number(payload.eligible_projects).toLocaleString("en-GB")} legacy-eligible projects`;
  document.getElementById("newsMeta").textContent = `${relevant} relevant / ${state.newsItems.length} legacy headlines · ${eligible} · ${String(payload.updated || "").slice(0, 10)}`;
  drawNewsV9_2();
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

export async function loadNewsV9_2() {
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

export function bindNewspaperV9_2(onNewsLoaded) {
  refreshProjects = onNewsLoaded;
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.newsMode = button.dataset.news;
      drawNewsV9_2();
    };
  });
  document.getElementById("newsSearch").oninput = (event) => {
    state.newsQuery = event.target.value.trim();
    drawNewsV9_2();
  };
}
