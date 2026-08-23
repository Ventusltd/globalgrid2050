import { initialiseGauges } from "./plugins/gauges.js";
import { bindNewspaper, loadNews } from "./plugins/newspaper.js";
import {
  bindProjectControls,
  loadProjects,
  refreshCanonicalProjects,
} from "./plugins/projects.js";
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
      bindNewspaper(refreshCanonicalProjects);
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
