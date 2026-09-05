/* ── WHICH RECEIVER A MAP LINK IS BUILT AGAINST ──────────────────────────────
 *
 * On 2026-09-05 the MAP button in this app was measured pointing at the V8
 * overlay the engine now publishes as retired — a page that still serves, so
 * nothing 404'd and no link checker ever went red, but which carries zero
 * engine cartridges and no current.json. Measured the same day: that shell has
 * 0 cartridge references and 0 current.json references; the canonical shell has
 * 20 and 3. An arrival there is silently inert. Vikram hit it on Longfield
 * (REPD 8162) and reported "grid engine didnt compute or fire via map button".
 * It was never going to.
 *
 * Driven live for this change, same project, same parameters:
 *
 *   retired receiver    zero __GRIDATLAS_* globals, no module list, no nearest()
 *                       function, and the page never even names Longfield
 *   canonical receiver  14 engine modules including networkTopology,
 *                       electricalDistance, ratingEnvelope and corridorEstimate;
 *                       the arrival popup reads "Longfield solar 500 MW ...
 *                       CM3 3AS · Essex REPD 8162 · awaiting construction", and
 *                       the engine's own nearest() answers BRAINTREE at 9.44 km,
 *                       400/132 kV, NGET, 4 transformers, 4 circuits
 *
 * WHY THIS FILE HOLDS NO URL.
 * The route was hard-coded in the consumer, in seven files side by side, and
 * the engine published nothing for any of them to disagree with. It now does:
 * ventus-grid-engine/deeplink/receivers.json names the canonical route, the
 * retired ones, and why. This module reads that file. It does not restate the
 * answer, because a second copy is the fault being removed rather than a
 * safeguard against it — the whole defect was seven copies of a route that had
 * quietly stopped being true.
 *
 * WHAT HAPPENS WHEN IT CANNOT BE READ.
 * No fallback to a retired route, ever: that is what shipped a dead button for
 * weeks. The link is empty, the cell says which receiver could not be
 * established and why, and the reader is told rather than given a link that
 * looks right and computes nothing. Silence is the failure mode this whole
 * change exists to end.
 *
 * ORDER MATTERS AND IS ASSERTED. Callers are synchronous — a table row renders
 * one link at a time — so loadAtlasReceiverV9_7() must be awaited before the
 * first render. loadProjectsV9_5_1() awaits it beside the project payload.
 * Before that resolves, buildAtlasDeepLinkV9_7() returns "" and
 * atlasReceiverFailureV9_7() says so, rather than guessing.
 */

const RECEIVERS_URL = "https://ventusltd.github.io/ventus-grid-engine/deeplink/receivers.json";
const RECEIVERS_SCHEMA = "ventus.grid-engine.deeplink-receivers.v1";

/* The parameters the deep-link contract names, in its own order. `project` and
 * `capacity_mw` are deliberately NOT sent: the contract's PARAMS does not carry
 * them, and the canonical receiver resolves the project's identity, name,
 * capacity, postcode and status from the REPD reference on its own — verified
 * live on REPD 8162 and on REPD 13429, which has no REPD coordinate at all. */
const CONTRACT_PARAMS = Object.freeze(["repd_ref", "technology", "latitude", "longitude", "zoom"]);

let canonicalRoute = "";
let retiredRoutes = [];
let failureReason = "the deep-link contract has not been read yet";
let pending = null;

const stripTrailingSlash = (route) => String(route || "").replace(/\/+$/u, "");

export function isRetiredReceiverV9_7(route) {
  return retiredRoutes.includes(stripTrailingSlash(route));
}

export function atlasReceiverV9_7() {
  return canonicalRoute;
}

export function atlasReceiverFailureV9_7() {
  return canonicalRoute ? "" : failureReason;
}

/* Exposed so a test can drive every branch of this module without a network —
 * a check that can only run online is a check that quietly stops running. It
 * takes the contract DOCUMENT, never a bare route, so there is still no way to
 * name a receiver by hand and have this module believe it. */
export function primeAtlasReceiverV9_7(document_) {
  canonicalRoute = "";
  retiredRoutes = [];
  failureReason = "";
  pending = null;
  if (!document_ || document_.schema !== RECEIVERS_SCHEMA) {
    failureReason = `deep-link contract schema is ${document_ && document_.schema}, expected ${RECEIVERS_SCHEMA}`;
    return "";
  }
  const route = document_.canonical && document_.canonical.route;
  if (!route) {
    failureReason = "the deep-link contract names no canonical receiver";
    return "";
  }
  if (document_.canonical.carries_engine !== true) {
    failureReason = "the deep-link contract's canonical receiver does not claim to carry the engine";
    return "";
  }
  retiredRoutes = (Array.isArray(document_.retired) ? document_.retired : [])
    .map((entry) => stripTrailingSlash(entry && entry.route))
    .filter(Boolean);
  if (isRetiredReceiverV9_7(route)) {
    // The contract contradicting itself must fail loudly, not resolve itself.
    retiredRoutes = [];
    failureReason = "the deep-link contract names its own canonical receiver as retired";
    return "";
  }
  canonicalRoute = route;
  return canonicalRoute;
}

export async function loadAtlasReceiverV9_7() {
  if (canonicalRoute) return canonicalRoute;
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(RECEIVERS_URL, { mode: "cors", cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return primeAtlasReceiverV9_7(await response.json());
      } catch (error) {
        failureReason = `the deep-link contract at ${RECEIVERS_URL} could not be read (${error.message || error})`;
        canonicalRoute = "";
        pending = null;
        return "";
      }
    })();
  }
  return pending;
}

/* True when this record carries a REPD coordinate the map can centre on. The
 * 28 records that do not are still linkable: the receiver resolves them from
 * the REPD reference and centres on its own geometry, which was measured on
 * REPD 13429 (Ossian) — it arrives and names the project. They are labelled
 * rather than denied a button, because a button that silently does nothing is
 * exactly what hid this defect. */
export function atlasCentresOnRepdPointV9_7(project) {
  return Boolean(project) && project.geometry_status === "valid";
}

export function buildAtlasDeepLinkV9_7(project) {
  if (!canonicalRoute) return "";
  if (!project || project.repd_ref === undefined || project.repd_ref === null || project.repd_ref === "") return "";
  const values = {
    repd_ref: project.repd_ref,
    technology: project.technology,
  };
  if (atlasCentresOnRepdPointV9_7(project)) {
    values.latitude = project.latitude;
    values.longitude = project.longitude;
    values.zoom = "12";
  }
  const url = new URL(canonicalRoute);
  for (const key of CONTRACT_PARAMS) {
    const value = values[key];
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

/* What the cell says when there is no link. One sentence, in the row, because
 * a title attribute is unreachable on a phone and unreachable is how this hid. */
export function atlasUnavailableReasonV9_7(project) {
  if (!canonicalRoute) return `MAP unavailable: ${atlasReceiverFailureV9_7()}`;
  if (!project || project.repd_ref === undefined || project.repd_ref === null || project.repd_ref === "") {
    return "MAP unavailable: this record carries no REPD reference to resolve";
  }
  return "";
}
