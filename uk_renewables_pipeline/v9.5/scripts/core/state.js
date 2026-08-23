export const state = {
  all: [],
  filtered: [],
  canonicalModel: null,
  tech: "All",
  status: "All",
  county: "All",
  search: "",
  charts: { solar: null, bess: null, projects: null, largest: null },
  newsItems: [],
  newsMode: "ALL",
  newsQuery: "",
};

export const COLORS = Object.freeze({
  Solar: "#ffff00",
  "Battery Storage": "#ffae00",
});

export const DATA_SOURCES = Object.freeze({
  newsPages: "../../dist/major_project_news_v5.json",
  newsGitHub: "https://raw.githubusercontent.com/Ventusltd/globalgrid2050/main/dist/major_project_news_v5.json",
});
