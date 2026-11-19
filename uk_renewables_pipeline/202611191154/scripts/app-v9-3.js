import { initialiseGaugesV9_2 } from "./plugins/gauges-v9-2.js";
import { bindNewspaperV9_2, loadNewsV9_2 } from "./plugins/newspaper-v9-2.js";
import {
  bindProjectControlsV9_3,
  loadProjectsV9_3,
  refreshProjectsV9_3,
} from "./plugins/projects-v9-3.js";
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
      bindNewspaperV9_2(refreshProjectsV9_3);
      loadNewsV9_2();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControlsV9_3();
      loadProjectsV9_3();
    },
  },
]);
