import { loadCanonicalProjectsV9_1 } from "./canonical-projects-v9-1.js";

const RELEASE_URL = "contracts/release.v9.2.json";

function invariant(condition, message) {
  if (!condition) throw new Error(`V9.2 canonical projects: ${message}`);
}

async function fetchRelease() {
  const response = await fetch(RELEASE_URL, { cache: "no-store" });
  invariant(response.ok, `${RELEASE_URL} returned HTTP ${response.status}`);
  invariant(new URL(response.url).origin === window.location.origin, `${RELEASE_URL} redirected cross-origin`);
  return response.json();
}

export async function loadCanonicalProjectsV9_2() {
  const [release, model] = await Promise.all([fetchRelease(), loadCanonicalProjectsV9_1()]);
  invariant(release.release === "9.2", "release contract mismatch");
  invariant(release.data_parent?.release === "9.1", "data-parent release mismatch");
  invariant(model.contract.release === "9.1", "canonical data contract mismatch");
  invariant(model.projects.length === release.expected.project_count, "project count mismatch");
  invariant(model.metadata.capacity_mw === release.expected.capacity_mw, "capacity mismatch");
  invariant(model.metadata.largest_mw === release.expected.largest_mw, "largest project mismatch");
  return Object.freeze({
    release: Object.freeze(release),
    dataContract: model.contract,
    metadata: Object.freeze({ ...model.metadata, ui_release: "9.2" }),
    projects: model.projects,
  });
}
