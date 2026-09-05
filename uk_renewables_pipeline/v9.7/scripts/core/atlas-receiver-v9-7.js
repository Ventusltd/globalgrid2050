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
 * WHERE THE ROUTE COMES FROM.
 * ventus-grid-engine/deeplink/receivers.json names the canonical route, the
 * retired ones, and why. This module carries a compiled copy of that document
 * and fetches the published one to verify it. The compiled copy is not a second
 * opinion: testcode/drivers/link-targets.mjs reads both and fails offline if
 * they disagree, so the engine still retires a receiver once, in the place that
 * knows, and this file cannot drift away from it unnoticed. See the long note
 * on COMPILED_CONTRACT below for why the earlier no-copy design had to change.
 *
 * WHAT HAPPENS WHEN THE PUBLISHED DOCUMENT CANNOT BE READ.
 * The compiled contract stands and the links keep working. There is still no
 * fallback to a RETIRED route — that is what shipped a dead button for weeks,
 * and a live contract naming this route retired withdraws the links on the
 * spot. The difference is between falling back to a route the engine has
 * disowned, which must never happen, and standing on the engine's own last
 * published answer while a handshake is slow, which is the only sane thing to
 * do on a phone.
 *
 * ORDER NO LONGER MATTERS, AND THAT IS THE POINT.
 * The previous design made the first table paint wait on a cross-origin fetch,
 * because callers are synchronous — a table row renders one link at a time — so
 * the route had to be known before the first render. Measured 2026-09-05: no row
 * of 7,680 could appear until a request to ventusltd.github.io completed, on a
 * page whose <tbody> starts empty. buildAtlasDeepLinkV9_7() now answers from
 * module import, before any network exists, and verifyAtlasReceiverV9_7() runs
 * beside the payload with nothing waiting on it.
 */

const RECEIVERS_URL = "https://ventusltd.github.io/ventus-grid-engine/deeplink/receivers.json";
const RECEIVERS_SCHEMA = "ventus.grid-engine.deeplink-receivers.v1";

/* The parameters the deep-link contract names, in its own order. `project` and
 * `capacity_mw` are deliberately NOT sent: the contract's PARAMS does not carry
 * them, and the canonical receiver resolves the project's identity, name,
 * capacity, postcode and status from the REPD reference on its own — verified
 * live on REPD 8162 and on REPD 13429, which has no REPD coordinate at all. */
const CONTRACT_PARAMS = Object.freeze(["repd_ref", "technology", "latitude", "longitude", "zoom"]);

/* How long a stalled socket may hold the verification open. Nothing waits on
 * it any more, so this is only about not leaking a request for ever; iOS
 * Safari's own ceiling is of the order of 60-75 s, which is not a bound. */
const VERIFY_TIMEOUT_MS = 5000;

/* ── THE COMPILED-IN CONTRACT, AND WHY IT IS NOT THE OLD MISTAKE ────────────
 *
 * The version of this module shipped at 202609050353 held no route at all and
 * built no link until a cross-origin fetch to ventusltd.github.io resolved.
 * Measured 2026-09-05 that fetch sat inside the same Promise.all that gates the
 * first table paint, so not one of 7,680 rows could appear until a request to a
 * SECOND ORIGIN completed — a full DNS + TCP + TLS handshake before the first
 * row, on a cold mobile radio, on a page with an empty <tbody> and no
 * placeholder. 59 ms on a wired link, which is why it was invisible on desktop.
 * And it had no fallback: had that request failed, every row would have
 * rendered NO MAP plus an explanatory paragraph. 7,680 dead cells.
 *
 * WHAT MAKES A DEFAULT SAFE THIS TIME. The original defect was seven copies of
 * a route in seven plugins, none of which the engine could correct. This is one
 * copy, in one module, of the engine's own published document — and it is
 * PINNED to that document by a gate that reads both:
 *
 *     testcode/drivers/link-targets.mjs
 *       "the compiled-in receiver contract matches the engine's published one"
 *
 * If ventus-grid-engine/deeplink/receivers.json ever names a different
 * canonical route, or retires this one, that driver goes red offline, in the
 * estate's own instrument, before anything ships. A hard-coded route the estate
 * cannot notice drifting is the fault; a hard-coded route the estate checks
 * every run is a cache. The difference is the gate, and the gate exists.
 *
 * AND THE LIVE DOCUMENT STILL WINS. verifyAtlasReceiverV9_7() fetches it after
 * the table has painted. If it names a different canonical route, that route
 * replaces this one and the MAP cells re-render. If it names THIS route as
 * retired, the links are withdrawn and the cells say so — the engine keeps the
 * power to retire a receiver once, in the place that knows. What it no longer
 * has is the power to leave the page with no links at all because a handshake
 * was slow. */
const COMPILED_CONTRACT = Object.freeze({
  schema: RECEIVERS_SCHEMA,
  canonical: Object.freeze({
    id: "gridatlas-v9",
    route: "https://ventusltd.github.io/gridatlas/atlas/",
    carries_engine: true,
  }),
  retired: Object.freeze([Object.freeze({
    id: "repd-grid-atlas-v8",
    route: "https://globalgrid2050.com/repd_grid_atlasv8/",
    carries_engine: false,
  })]),
  compiled_from: "ventus-grid-engine/deeplink/receivers.json",
  compiled_utc: "202609051100",
});

let canonicalRoute = "";
let retiredRoutes = [];
let failureReason = "the deep-link contract has not been read yet";
/* WHY a prime failed, not just that it did. "unusable" means the document could
   not be understood - a schema this build does not know, or a contract that
   contradicts itself. "withdrawn" means a document this build DID understand
   instructed it that there is no receiver to link to. Only the second is the
   engine exercising its power to retire a receiver; the first is a document
   this page is in no position to act on, and acting on it is how a schema bump
   in a file on another origin silently stripped every MAP link from the page. */
let failureKind = "unusable";
let pending = null;
let verification = null;

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
    failureKind = "unusable";
    return "";
  }
  const route = document_.canonical && document_.canonical.route;
  if (!route) {
    failureReason = "the deep-link contract names no canonical receiver";
    failureKind = "withdrawn";
    return "";
  }
  if (document_.canonical.carries_engine !== true) {
    failureReason = "the deep-link contract's canonical receiver does not claim to carry the engine";
    failureKind = "withdrawn";
    return "";
  }
  retiredRoutes = (Array.isArray(document_.retired) ? document_.retired : [])
    .map((entry) => stripTrailingSlash(entry && entry.route))
    .filter(Boolean);
  if (isRetiredReceiverV9_7(route)) {
    // The contract contradicting itself must fail loudly, not resolve itself.
    retiredRoutes = [];
    failureReason = "the deep-link contract names its own canonical receiver as retired";
    failureKind = "unusable";
    return "";
  }
  canonicalRoute = route;
  failureKind = "";
  return canonicalRoute;
}

/* The receiver is known at import, from the compiled-in contract above, before
 * any network exists. Every branch of primeAtlasReceiverV9_7() still applies to
 * it — a compiled contract that failed its own schema or named its canonical
 * route as retired would leave canonicalRoute empty here exactly as a fetched
 * one would, and the drift gate would already have gone red. */
primeAtlasReceiverV9_7(COMPILED_CONTRACT);

/* VERIFICATION, NOT PRECONDITION. Nothing awaits this before painting. It is
 * fired beside the project payload, resolves whenever it resolves, and reports
 * whether the page's links have to change. `changed` is the only reason to
 * re-render, and on a correct estate it is always false — the compiled contract
 * is pinned to the published one by a gate, so a re-render is the signal that
 * something drifted, not a routine cost every reader pays.
 *
 * It cannot make things worse: a failure, a timeout, a malformed document or a
 * schema bump all leave the compiled-in route standing and record why. The one
 * thing it CAN do is withdraw the links, and only on the engine's explicit
 * instruction — a document this build understood that names no usable canonical
 * receiver.
 *
 * That paragraph was false when it was written. Until 2026-09-05 every prime
 * failure took the same branch, so a schema this build did not recognise was
 * treated as an instruction and stripped the links, returning verified:true.
 * The difference is now carried by failureKind, and `withdrawn` reports it
 * separately from `verified` so a caller cannot read "the document was read"
 * as "the links are correct". */
export async function verifyAtlasReceiverV9_7() {
  if (verification) return verification;
  const before = canonicalRoute;
  verification = (async () => {
    try {
      /* `cache: "no-store"` was here. It discarded the response and refused the
         HTTP cache, so every load made a fresh cross-origin round trip for a
         document the server itself publishes as cacheable for ten minutes
         (Cache-Control: max-age=600, Access-Control-Allow-Origin: *).
         AbortSignal.timeout bounds a stalled socket, which nothing did. */
      const response = await fetch(RECEIVERS_URL, {
        mode: "cors",
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const live = await response.json();
      const route = primeAtlasReceiverV9_7(live);
      if (!route) {
        const reason = atlasReceiverFailureV9_7();
        if (failureKind === "unusable") {
          /* The document arrived but this build cannot read it — an unknown
             schema, or a contract that names its own canonical route retired.
             That is not an instruction, it is a document we are in no position
             to act on, and the comment above has always said so. Measured on
             2026-09-05: it did the opposite. A schema bump on a file hosted on
             a SECOND ORIGIN removed every MAP link from this page and reported
             verified:true while doing it. Stand on the compiled contract, which
             is pinned to the published one by a gate, and say why. */
          primeAtlasReceiverV9_7(COMPILED_CONTRACT);
          return { route: canonicalRoute, changed: false, verified: false, withdrawn: false, reason };
        }
        /* A document this build DID understand, instructing that there is no
           receiver to link to. This is the engine retiring a receiver once, in
           the place that knows, and it is the whole reason the contract is read
           at all. verified:true says the document was read and honoured; it is
           `withdrawn` that says the links are gone, so the two are no longer
           conflated in one flag. */
        return { route: "", changed: before !== "", verified: true, withdrawn: true, reason };
      }
      return { route, changed: route !== before, verified: true, withdrawn: false, reason: "" };
    } catch (error) {
      /* Keep the compiled-in contract. It is pinned to the published one by
         testcode/drivers/link-targets.mjs, so standing on it is standing on the
         last verified reading of the engine's own document, not on a guess. */
      primeAtlasReceiverV9_7(COMPILED_CONTRACT);
      return {
        route: canonicalRoute,
        changed: false,
        verified: false,
        withdrawn: false,
        reason: `the deep-link contract at ${RECEIVERS_URL} could not be read (${(error && error.message) || error}); the compiled-in contract of ${COMPILED_CONTRACT.compiled_utc} still applies`,
      };
    }
  })();
  return verification;
}

/* Kept so nothing that imported the old name breaks, and so a caller that only
 * wants the route still gets one. It no longer gates anything: the route is
 * already there when this is called. */
export async function loadAtlasReceiverV9_7() {
  if (!pending) pending = verifyAtlasReceiverV9_7().then((result) => result.route);
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
