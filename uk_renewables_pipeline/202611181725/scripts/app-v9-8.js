import { initialiseGaugesV9_2 } from "./plugins/gauges-v9-2.js";
import { bindNewspaperV9_7, loadNewsV9_7 } from "./plugins/newspaper-v9-7.js";
import {
  bindProjectControlsV9_8,
  loadProjectsV9_8,
  refreshProjectsV9_8,
} from "./plugins/projects-v9-8.js";
import { startPlugins } from "./core/plugin-host.js";

startPlugins([
  { id: "gauges", start: initialiseGaugesV9_2 },
  {
    id: "newspaper",
    dependsOn: ["gauges"],
    start() {
      bindNewspaperV9_7(refreshProjectsV9_8);
      loadNewsV9_7();
    },
  },
  {
    id: "projects",
    dependsOn: ["gauges", "newspaper"],
    start() {
      bindProjectControlsV9_8();
      loadProjectsV9_8();
    },
  },
]);
