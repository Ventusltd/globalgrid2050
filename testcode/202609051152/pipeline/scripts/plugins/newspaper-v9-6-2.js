import { state } from "../core/state.js";
import { escapeHtml, normaliseProject } from "../core/utils.js";
import { classifyInternationalV9_6_2, regionalCountsV9_6_2 } from "../core/news-regions-v9-6-2.js";
import { bindNewspaperV9_5_1, drawNewsV9_5_1, loadNewsV9_5_1 } from "./newspaper-v9-5-1.js";

const REGIONAL_MODES = new Set(["INTERNATIONAL", "US", "EUROPE"]);

function queryMatches(item) {
  if (!state.newsQuery) return true;
  const haystack = normaliseProject([
    item.headline, item.project, item.operator, item.source, item.event,
  ].join(" "));
  return normaliseProject(state.newsQuery).split(" ").filter(Boolean)
    .every((token) => haystack.includes(token));
}

function regionalRows() {
  return state.newsItems.flatMap((item) => {
    const classification = classifyInternationalV9_6_2(item);
    if (!classification || !queryMatches(item)) return [];
    if (state.newsMode === "US" && classification.region !== "US") return [];
    if (state.newsMode === "EUROPE" && classification.region !== "EUROPE") return [];
    return [{ item, classification }];
  });
}

function drawRegional() {
  const stories = document.getElementById("stories");
  const rows = regionalRows();
  if (!rows.length) {
    stories.innerHTML = '<div class="news-empty">No location-verified international solar or battery headlines match this filter.</div>';
    return;
  }
  stories.innerHTML = rows.map(({ item, classification }) => {
    const articleClass = classification.technology.includes("BESS") ? "bess" : "solar";
    const region = classification.region === "INTERNATIONAL_OTHER" ? "INTERNATIONAL" : classification.region;
    return `<a class="story ${articleClass}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><div class="kicker">${escapeHtml(classification.technology)} · ${escapeHtml(item.event || "PROJECT UPDATE")} · ${escapeHtml(item.published || "")}</div><h3>${escapeHtml(item.headline || "International solar and storage update")}</h3><p><span class="project">${escapeHtml(region)}</span>${item.source ? ` · ${escapeHtml(item.source)}` : ""}</p><span class="source"><span class="news-quality relevant">${escapeHtml(region)}</span> · ${escapeHtml(classification.evidence)} · regional discovery only · no REPD project signal</span></a>`;
  }).join("");
}

export function drawNewsV9_6_2() {
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

export async function loadNewsV9_6_2() {
  await loadNewsV9_5_1();
  const counts = regionalCountsV9_6_2(state.newsItems);
  const uk = state.newsItems.filter((item) => item.canonical_relevant === true).length;
  document.getElementById("newsMeta").textContent = `${uk} UK · ${counts.international} international (${counts.us} US · ${counts.europe} Europe · ${counts.other} other) · ${state.newsItems.length} headlines · Pages`;
  drawNewsV9_6_2();
}

export function bindNewspaperV9_6_2(onNewsLoaded) {
  bindNewspaperV9_5_1(onNewsLoaded);
  document.querySelectorAll("#newsTools button").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll("#newsTools button").forEach((candidate) => candidate.classList.remove("active"));
      button.classList.add("active");
      state.newsMode = button.dataset.news;
      drawNewsV9_6_2();
    };
  });
  document.getElementById("newsSearch").oninput = (event) => {
    state.newsQuery = event.target.value.trim();
    drawNewsV9_6_2();
  };
}
