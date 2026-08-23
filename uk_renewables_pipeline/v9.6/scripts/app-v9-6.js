import { initialiseGaugesV9_2 } from "./plugins/gauges-v9-2.js";
import { bindNewspaperV9_6, loadNewsV9_6 } from "./plugins/newspaper-v9-6.js";
import {
  bindProjectControlsV9_6,
  loadProjectsV9_6,
  refreshProjectsV9_6,
} from "./plugins/projects-v9-6.js";
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
      bindNewspaperV9_6(refreshProjectsV9_6);
      loadNewsV9_6();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControlsV9_6();
      loadProjectsV9_6();
    },
  },
]);
