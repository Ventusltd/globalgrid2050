import { initialiseGauges } from "./plugins/gauges.js";
import { bindNewspaper, loadNews } from "./plugins/newspaper.js";
import { refreshProjectTable } from "./plugins/project-table.js";
import { bindProjectControls, loadProjects } from "./plugins/projects.js";
import { startPlugins } from "./core/plugin-host.js";

startPlugins([
  {
    id: "gauges",
    start: initialiseGauges,
  },
  {
    id: "newspaper",
    dependsOn: ["gauges"],
    start() {
      bindNewspaper(refreshProjectTable);
      loadNews();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControls();
      loadProjects();
    },
  },
]);
