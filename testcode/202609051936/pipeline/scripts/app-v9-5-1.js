import { initialiseGaugesV9_2 } from "./plugins/gauges-v9-2.js";
import { bindNewspaperV9_5_1, loadNewsV9_5_1 } from "./plugins/newspaper-v9-5-1.js";
import {
  bindProjectControlsV9_5_1,
  loadProjectsV9_5_1,
  refreshProjectsV9_5_1,
} from "./plugins/projects-v9-5-1.js";
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
      bindNewspaperV9_5_1(refreshProjectsV9_5_1);
      loadNewsV9_5_1();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControlsV9_5_1();
      loadProjectsV9_5_1();
    },
  },
]);
