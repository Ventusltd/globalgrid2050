export const state = {
  all: [],
  filtered: [],
  tech: "All",
  status: "All",
  county: "All",
  search: "",
  charts: { capacity: null, projects: null, largest: null },
  newsItems: [],
  newsMode: "ALL",
  newsQuery: "",
};

export const COLORS = Object.freeze({
  Solar: "#ffff00",
  "Battery Storage": "#ffae00",
  "Onshore Wind": "#00ffff",
  "Offshore Wind": "#0066ff",
});

export const DATA_SOURCES = Object.freeze({
  repd: "../../dist/repd_master.json",
  newsPages: "../../dist/major_project_news_v5.json",
  newsGitHub: "https://raw.githubusercontent.com/Ventusltd/globalgrid2050/main/dist/major_project_news_v5.json",
});
