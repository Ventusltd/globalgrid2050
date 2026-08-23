import { initialiseGaugesV9_1 } from "./plugins/gauges-v9-1.js";
import { bindNewspaper, loadNews } from "./plugins/newspaper.js";
import {
  bindProjectControlsV9_1,
  loadProjectsV9_1,
  refreshProjectsV9_1,
} from "./plugins/projects-v9-1.js";
import { startPlugins } from "./core/plugin-host.js";

startPlugins([
  {
    id: "gauges",
    start: initialiseGaugesV9_1,
  },
  {
    id: "newspaper",
    dependsOn: ["gauges"],
    start() {
      bindNewspaper(refreshProjectsV9_1);
      loadNews();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControlsV9_1();
      loadProjectsV9_1();
    },
  },
]);
