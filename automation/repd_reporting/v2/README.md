# REPD Cockpit — standalone Spider-audited cross-filters (v2 candidate)

Status: **isolated code and tests only**. NOT added to V9.73, NOT published, NOT approved as a new PipelineNews release. Owner requested a separate ES module so analytics can evolve without damaging the cockpit. Source: `automation/repd_reporting/v2/cockpit-facets.mjs`.

## Design

One cross-filter selection `{technology,status,operator,region}` drives *every* report dimension, not separate full-register reports by default. For example SOLAR + Operational gives only operational solar operators; switching to REGION MW or STATUS MW preserves exactly the same selected set and counts. Selecting BATTERY, ONSHORE or OFFSHORE recomputes the same operator/status/region breakdown. ALL TECH means only the 7,775 source REPD records (October 2026 Q3). Unknown source values appear as `Not reported`; refused/withdrawn records are never excluded.

`buildCockpitReport(repdRecords,{dimension,filters,interconnectors})` supplies exact projects, unique REPD refs, separate unit totals, grouped results and the available filter facets. It **does not** change the live page, global state, dates, MAP/A4 links or source data. Preserve the user's existing bright-on-dark colour scheme, three gauges, ticker and swipe/expanded modes in the eventual integrator.

### Integration seam

- Live V9.73 `repd-reports.mjs` currently defaults to `state.all` and *only optionally* to `state.filtered`; it therefore does not follow a technology-button click by default. Integrate this module as a replacement data adapter **behind the existing V9.73 OPERATOR MW / STATUS MW / REGION MW buttons**, not a second set of duplicate report buttons.
- The original register's `projects-v9-8.js` private `technology` and `status` variables are not the exported `state.tech`/`state.status` fields. Read the existing `#tech [data-technology][aria-pressed=true]` and `#status [data-official-status][aria-pressed=true]` control state, or explicitly add a small audited public selection event in a *new immutable edition*. A page-level `pipeline-projects-rendered` event already exists. Do not silently use stale `state.tech`.
- Native table status buttons currently expose just All, Operational, Under Construction, Awaiting Construction and Application Submitted. The new cockpit must also offer **every unique official status** (including refused/withdrawn and unknown) sourced from `state.all`, without trying to force unavailable statuses through the old allowlist.
- Introduce independent operator and region facet selectors, plus explicit reset to All, and preserve filter selection when switching report dimensions. Optional 'current REPD table filters' must be a visible deliberate scope choice, not a hidden default. Status, region and operator filters combine by intersection; empty result is shown explicitly, not zeroed into an all-register report.
- Interconnectors use their **separate inventory** and do not join 7,775 REPD IDs or solar MWp. Grid is a distinct future source and displays `SOURCE_NOT_AVAILABLE` until its identity/capacity schema is verified. Missing inventory is not zero capacity.
- Do not claim measured generation from recorded MW or MWp. Monthly/quarterly operational cohorts and opt-in scenario modelling remain independent in donor PR #225, with review findings on Neural Link #83.

### Spider / Test Code discipline

The read-only `SPIDER-INPUTS.json` pins the exact file graph of published V9.73. `spider-audit.mjs` verifies Git blob identities of every dependency, tests that the existing controls/data hooks are still present, and includes two negative mutation checks. No migrations, repo duplication, remote network requests or production mutations occur.

Run offline from globalgrid2050 root:

```bash
node --check automation/repd_reporting/v2/cockpit-facets.mjs
node --test automation/repd_reporting/v2/tests/cockpit-facets.test.mjs
node automation/repd_reporting/v2/spider-audit.mjs
```

Only after offline checks pass may the independent integrator test production 7,775 records, full browser UI/REPD table parity, MAP/A4/PDF and GridAtlas VICINITY in Chromium/WebKit mobile and desktop, followed by public served SHA-256 and rollback verification. Per `Ventusltd/testcode` no gate can silently skip or label an unmounted candidate 'published'.

Coordination: [Neural Link #83](https://github.com/Ventusltd/neural-link-between-agents/issues/83). Other agent must ACK there, reserve a disjoint branch/file scope and report CI; no automatic agent invocation is implied.

## V9.74 candidate checkpoint — 23 November 2026

The immutable candidate is now physically committed at `uk_renewables_pipeline/202611231400/` (GitHub commit `6efacb4f3a2be20e9b930e08d416e4400d01dd40`). The built release preserves the complete V9.73 source: 342 inherited files, 338 byte-identical, zero missing, only `index.html`, `repd-reports.mjs`, `README.md` and `CHANGES.md` changed; the new browser proof and receipt are additive. Every original CSS/data file remains identical.

Candidate acceptance CI: [full production-browser and immutable checks](https://github.com/Ventusltd/globalgrid2050/actions/runs/45178663983) and [Spider offline gate](https://github.com/Ventusltd/globalgrid2050/actions/runs/45178663971), both success on the precursor that composed the exact committed candidate bytes. Scope handoff: [Neural Link #83](https://github.com/Ventusltd/neural-link-between-agents/issues/83#issuecomment-7101878245).

**Not published:** PR #229 is draft. No main-branch merge, homepage change, public served-byte proof, owner device check or formal release acceptance has occurred. The candidate commit itself was created by CI after its test steps; fresh exact-head verification is required before release.
