# Independent Agent 5 acceptance and V9.28 integration QA

Date: 2026-11-16 UTC. Status: **CONDITIONAL / DO NOT INTEGRATE OR PUBLISH YET**.
This is an independent read-only reconstruction of the inherited component plus a narrow isolated QA correction. Original PR #128 and V9.24 / homepage / edition root were NOT changed.

## Exact identities and dependency closure

- Donor PR: https://github.com/Ventusltd/globalgrid2050/pull/128, draft, originally at `765e6d303d5021fc866ffb5422a5c9ce0df3fc20`.
- Donor base: `v9.29-third-context-ui` at `26896c1141b3686b3fb18baf05b545bb36fc8b26`.
- PR #128 compare: exactly five commits; exactly four files changed, all under `automation/news/context-ui/**` (adapter, adapter test, render, handoff).
- Independent QA branch: `qa/agent5-context-v928-acceptance-20261116`, forked at donor SHA (not editing PR #128).
- Relative to product `main` at `65bcc01e0d7e4dc073e759345727e53cf7a95752`, donor histories diverge: 14 commits ahead, 2 behind; GitHub compare displays 30 new files not on that main. **Do not cherry-pick the isolated adapter without its composer and producer closure; do not cherry-pick all 14 blindly either.**
- The dependency chain from common ancestor `fb4bd1baaa50c5102a791cf88b9ef23f3fc89a67` is: FIGURES contract `852aa322`; grid producer `e8f83559`; solar producer `8b1e9078`; historical inventory `2ba4b63e`; policy ledger `d3963117`; composer `ded3c2a8`; initial context UI `320a5c46`; styling `44e62ca1`; inherited component `26896c11`; five PR #128 increments ending `765e6d30`. These are *commit-lineage receipts*, not authorization to merge.
- Required producer modules: `automation/news/filings/contracts.py` (`validate_claim`); `policy_commitments/{__init__.py,ledger.py,sample_ledger.json}`; `dc_context/{grid.py,solar.py,grid-source-fixture.json,fixtures/solar-context.json}`; `build_transition_context.py`. Required component runtime: `context-ui/{adapter.mjs,render.mjs,context.css,pins.json}`. Test-only: `adapter.test.mjs,browser.mjs,test-support.mjs` and the producer's test files. Read `TRANSITION_CONTEXT.md` for the original producer hashes/semantics.
- External FIGURES: `Ventusltd/TestCode@sandbox/filings-ui` at `b460cb7f76172691b5ffb6d2a7f1a8e12057ba20`. The three exact external file bytes were retrieved through GitHub and independently SHA-256 checked against `pins.json`: `model.mjs` = `2e3f7b78313b1a3e67e1afb3749de90cf59d4de3fcb22fad5aa4dfdc1e92d504`; `render.mjs` = `fb7d974f9385c4a3a8628f10036de4e8175484b804fd535099bb4cb543b9e804`; `figures.css` = `8616989ec796c7f12442c8a3999e538f7f0d5ab4502f047d3071e9d682db0498`. All three MATCH. A reference SHA pin authenticates those code bytes, not the factual provenance of a source document.

## Source and figure inspection

Independent examination of committed producer *inputs* reconciles:
- 8 policy commitments from `policy_commitments/sample_ledger.json`; seven UNKNOWN + one reported Control Centre progress at the producer handoff. Policy evidence includes the 28-Oct-2026 Covenant (GOV.UK), 13-Nov-2026 written Parliamentary answer #41981 and an unbound COP31 agenda/landing page. The control-centre statement is reported work underway, not legal compliance or completion.
- 2 grid contexts, including the 480 MW requested co-located demand amendment rejected by FERC in 2024; **not** available connection capacity, UK power demand, energised load or delivery.
- 4 solar/storage contexts, including a 350 MW historical solar procurement arrangement and **up to 280 MW** battery-storage *power* from Google's presentation dated 22-Sep-2021; neither is an onsite installed amount, 280 MWh or current generation.
- Exactly 3 typed numerical claims across the Grid (1) and Solar (2) fixture families. Zero canonical REPD associations are produced by the composer and consumer requires `canonical_project_id === null`; project association remains UNKNOWN/UNLINKED rather than invented.
- Primary corroboration consulted: FERC https://www.ferc.gov/enforcement-legal/legal/court-cases/susquehanna-nuclear-llc-v-ferc and https://ferc.gov/news-events/news/commissioner-phillips-concurrence-statement-co-location-issues ; the original EPA-hosted Google slide https://www.epa.gov/system/files/documents/2021-10/gpp_webinar_092221_texier.pdf (PDF p. 12); official https://www.gov.uk/government/publications/data-centre-covenant and https://questions-statements.parliament.uk/written-questions/detail/2026-11-10/41981 .
- Some original document hashes or retrieval clocks remain null. Original historical source-byte receipts, rights/licences, and all 14 records' complete primary-document provenance were **not independently reauthenticated**. Retain the five original report limitations, source dates, unknowns, original receipt objects and all native records. Source hash or metadata alone is not factual or copyright clearance.
- Composer fixture hash claimed in `pins.json` is `de0d205186ae2a30914711e1b25bacefc325f7c02efb880e4d5d5a6c070a87c1`; regeneration and full-output hash comparison have **NOT** been independently executed in this QA session.

## Adversarial findings and isolated correction

**Demonstrated weakness:** donor `adapter.mjs` compared only the `published_date` year to the assessment year. A forged `2026-11-17` or `2026-12` publication passed the actual extracted donor guard for `as_of=2026-11-16T18:00:00Z`. The new isolated guard rejects dates whose earliest possible calendar day is after assessment (respecting source precision year/month/day). This check was independently executed by evaluating the exact source guard fragments; it is **NOT** a complete Node module replay.

Seven exact-guard cases, before -> after: 2026-11-13 ACCEPT/ACCEPT; 2026-11-16 ACCEPT/ACCEPT; 2026-11-17 ACCEPT/REJECT; 2026-12 ACCEPT/REJECT; 2027 REJECT/REJECT; 2026-02-30 REJECT/REJECT; 2026-10 ACCEPT/ACCEPT. The new branch adds two negative cases keeping embedded link/receipt/native source copies internally consistent so the future-date guard, rather than an unrelated inconsistency, must catch them.

Existing suite contains adversarial mutations for forged REPD association, cross-copy receipt conflicts, forged FIGURES provenance, missing source, after-assessment retrieval, impossible calendar dates, unsupported URLs, unknown quantities, flags and metadata. **Source reviewed only; these tests have not been re-executed in full here.** Four changed JavaScript files were independently V8 syntax-parsed with imports removed; all syntax checks passed. This is not equivalent to Node 24 module execution.

## Browser and presentation review

- Component `render.mjs` appends a *single nested native* `<details>` child under an explicitly opted-in `data-news-context-host` OR `data-pipeline-context-host`; it does not create a third global panel, score, priority ranking or homepage block. CSS is scoped under `.transition-context`, inherits host typography and colors, and overrides the external FIGURES card only within the disclosure. Native history, original receipts and five report limitations remain reachable as nested disclosures in source code.
- The QA branch extends the isolated browser harness from 375/768/1440 to **375/390/393/768/1440** pixels, with the 390/393 cases opting into an existing Pipeline test host; all widths preserve the News sentinel control. These are test design changes, **not measured browser results**.
- The inherited `VALIDATION.md` reports a historical 30 Node cases and Chrome 17 checks per width at 375/768/1440 on an earlier head. The newer donor #128 explicitly says its Node/Chrome suite was not independently run. Do not reinterpret old screenshots/hashes as exact-head QA.
- In this environment, the GitHub connection supplies individual file reads but no full executable checkout and the local runtime cannot resolve github.com. Full composer+Node suite and local Playwright/Chrome test at five widths were **NOT RUN**; no screenshots, performance metrics, no-overflow proof, keyboard interaction report, live hosted shell or public-byte acceptance can be claimed.
- The PR's current successful Actions on 2026-11-16 were general PR file-size guard `43949204407` and unrelated Solar Evidence job `43949204437`, **not** context Node/Chrome acceptance.

## Exact ROOT/Agent 1 integration and fail-closed fallback contract

1. Keep V9.24 operative and visually authoritative: one HEADLINES section, one REPD PIPELINE ANALYTICS tabbed section; no third top-level Context block, visible rank, algorithmic score or unapproved CSS. No homepage, edition, release or root metadata change is owned by this branch.
2. Root selects **one existing News or Pipeline tab element**, adds an opted-in nested host (attribute `data-news-context-host` or `data-pipeline-context-host`) without changing its top-level layout; loads *only* pinned `context.css` and FIGURES `figures.css` plus hash-verified FIGURES module objects.
3. Root supplies the actual `Uint8Array` producer export and `expectedSha256` **from an independently accepted manifest**, never derived from untrusted downloaded bytes; supplies `figures:{buildViewModel,renderFigures}`. Invoke `await renderContext(host, bytes, {expectedSha256, figures})`. Retain `root.contextReport` as full native evidence and present its source limitations.
4. Never select a named REPD record from this report, promote provisional rows into facts, infer site-specific MW/MWh or display a numerical relevance rank. Zero verified project links must remain zero even if the host is adjacent to a real REPD project card.
5. Absent source pin, unknown/modified bytes, invalid clocks, mismatched receipts or missing renderer must yield **unavailable**, with no stale contexts or figures. The root can omit the entire disclosure on failing acceptance; the rest of News/Pipeline, interactive controls and V9.24 layout must continue normally. No retry/promotion loop automatically accepts a changed digest.
6. Root needs exact-head Node 24+ + Python 3.12+ composer replay, all adversarial tests, pinned renderer SHA verification, actual Chrome/Playwright 375/390/393/768/1440 proof, existing-shell comparison at 390/393/1440, keyboard, overflow, links, neighboring listeners, latest-request wins, source-truth/rights review and served-byte readback **before** any integration acceptance.

Reproducible commands from a complete pinned checkout, not yet executed in this QA environment:

```sh
python -B -m automation.news.build_transition_context --policy automation/news/policy_commitments/sample_ledger.json --grid automation/news/dc_context/grid-source-fixture.json --solar automation/news/dc_context/fixtures/solar-context.json --as-of 2026-11-16T18:00:00Z > /tmp/context-proof.json
sha256sum /tmp/context-proof.json # expect de0d205186ae2a30914711e1b25bacefc325f7c02efb880e4d5d5a6c070a87c1
FIGURES_UI_DIR=/absolute/path/TestCode/sandbox/filings-ui node --test automation/news/context-ui/adapter.test.mjs
FIGURES_UI_DIR=/absolute/path/TestCode/sandbox/filings-ui PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs CONTEXT_UI_ARTIFACTS=/absolute/path/new-proof node automation/news/context-ui/browser.mjs
```

**Recommendation: CONDITIONAL.** Source identities and typed claims are plausible and bounded; the component can mount as a nested disclosure by contract, but **DO NOT MERGE, INTEGRATE, RELEASE OR PUBLISH** until complete exact-head tests, five-width browser evidence and ROOT V9.24/served integration sign-off. Current measured tokens/context: **UNKNOWN** (no trustworthy meter; no estimate).