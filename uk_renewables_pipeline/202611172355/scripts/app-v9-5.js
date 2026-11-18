import { initialiseGaugesV9_2 } from "./plugins/gauges-v9-2.js";
import { bindNewspaperV9_5, loadNewsV9_5 } from "./plugins/newspaper-v9-5.js";
import {
  bindProjectControlsV9_5,
  loadProjectsV9_5,
  refreshProjectsV9_5,
} from "./plugins/projects-v9-5.js";
import { startPlugins } from "./core/plugin-host.js";

startPlugins([
  {
    id: "gauges",
    start: initialiseGaugesV9_2,
  },
  {
    id: "newspaper",
    dependsOn: ["gauges"],
    start() {
      bindNewspaperV9_5(refreshProjectsV9_5);
      loadNewsV9_5();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControlsV9_5();
      loadProjectsV9_5();
    },
  },
]);
