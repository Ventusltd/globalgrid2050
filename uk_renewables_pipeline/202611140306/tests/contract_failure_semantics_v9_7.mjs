/* What the deep-link contract's FAILURE branches actually do to the reader's links.
 *
 * Written 2026-09-05 after an independent review measured this module doing the
 * opposite of what its own comment claimed. The comment said "a malformed
 * document or a schema bump all leave the compiled-in route standing". Measured:
 * a document with a schema this build did not recognise removed every MAP link
 * from the page and reported verified:true while doing it. One branch handled
 * every prime failure, so "I cannot read this" and "there is no receiver" were
 * the same thing to it.
 *
 * That distinction cannot be asserted by reading the source, which is how it
 * survived: the code and the comment were both present and disagreed. So this
 * drives the real exported function with a stubbed fetch and asserts the
 * OUTCOME - what route the reader is left with - for every branch.
 *
 * Each case re-imports the module under a fresh URL because the verification
 * promise is memoised for the life of the module; without that, case 2 would
 * silently receive case 1's answer and the file would pass by not running.
 *
 *   node uk_renewables_pipeline/v9.7/tests/contract_failure_semantics_v9_7.mjs
 */
const MOD = new URL("../scripts/core/atlas-receiver-v9-7.js", import.meta.url).href;
const SCHEMA = "ventus.grid-engine.deeplink-receivers.v1";
const COMPILED = "https://ventusltd.github.io/gridatlas/atlas/";
const STANDS = { route: COMPILED, verified: false, withdrawn: false };

const ok = (json) => Promise.resolve({ ok: true, json: async () => json });

const cases = [
  { name: "network failure keeps the compiled route",
    fetch: () => Promise.reject(new Error("network down")),
    expect: STANDS },

  { name: "unparseable body keeps the compiled route",
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("not json")) }),
    expect: STANDS },

  { name: "HTTP error keeps the compiled route",
    fetch: () => Promise.resolve({ ok: false, status: 503, json: async () => ({}) }),
    expect: STANDS },

  /* The regression. A schema this build does not know is not an instruction. */
  { name: "unknown schema keeps the compiled route and does NOT report verified",
    fetch: () => ok({ schema: "ventus.grid-engine.deeplink-receivers.v99", canonical: { route: "https://elsewhere/", carries_engine: true } }),
    expect: STANDS },

  /* A contract that contradicts itself is unusable, not an instruction either. */
  { name: "contract naming its own canonical route retired keeps the compiled route",
    fetch: () => ok({ schema: SCHEMA, canonical: { route: COMPILED, carries_engine: true }, retired: [{ route: COMPILED }] }),
    expect: STANDS },

  /* The one case that may take the links away, and it must say so in `withdrawn`
     rather than leaving a caller to infer it from an empty route. */
  { name: "a readable contract naming no canonical receiver withdraws the links",
    fetch: () => ok({ schema: SCHEMA, canonical: null }),
    expect: { route: "", verified: true, withdrawn: true } },

  { name: "a canonical receiver that does not carry the engine withdraws the links",
    fetch: () => ok({ schema: SCHEMA, canonical: { route: "https://elsewhere/", carries_engine: false } }),
    expect: { route: "", verified: true, withdrawn: true } },

  { name: "a readable contract naming a different receiver adopts it",
    fetch: () => ok({ schema: SCHEMA, canonical: { route: "https://ventusltd.github.io/gridatlas-next/atlas/", carries_engine: true }, retired: [] }),
    expect: { route: "https://ventusltd.github.io/gridatlas-next/atlas/", verified: true, withdrawn: false } },
];

let failed = 0;
for (const [i, testCase] of cases.entries()) {
  const module_ = await import(`${MOD}?case=${i}`);
  globalThis.fetch = testCase.fetch;
  const result = await module_.verifyAtlasReceiverV9_7();
  const got = { route: result.route, verified: result.verified, withdrawn: result.withdrawn };
  const pass = JSON.stringify(got) === JSON.stringify(testCase.expect);
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${testCase.name}`);
  if (!pass) {
    console.log(`      expected ${JSON.stringify(testCase.expect)}`);
    console.log(`      got      ${JSON.stringify(got)}`);
    console.log(`      reason   ${result.reason}`);
  }
}

console.log(`\n${cases.length - failed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
