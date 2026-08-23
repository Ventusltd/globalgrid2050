# GlobalGrid2050 UK Solar + Storage Daily V7

## Purpose

V7 will be the continuously updated UK market-intelligence dashboard for:

- Solar projects above **49 MWp**.
- Battery projects above **99 MW**.
- Grid, CfD, financial close, construction commencement, commissioning and commercial-operation events affecting those projects.
- Confirmed project-specific grid events and clearly separated NESO, National Grid and DNO context.
- A separate evidence-based lane for sub-49 MW C&I solar and EV charging.
- No wind coverage in V7.

V7 combines the **product direction of V5** with the **data and identity discipline of V6**. It does not blindly extend either version.

## Working rules

1. Work directly on `main`; do not create branches or pull requests.
2. Preserve V1–V6 byte-for-byte as historical versions.
3. Keep all V7-owned application code, documentation, fixtures and generated assets beneath `uk_renewables_pipeline/v7/`.
4. Prefer a wholesale V5 product copy where it saves time, then replace unsafe data and matching with V6-derived components.
5. Keep `index.html` thin. Data, identity, news, grid, CfD, C&I/EV, interface and release logic remain separate modules and short discipline documents.
6. Target roughly 30 seconds per document or bounded action. Stop and checkpoint between actions. Hard limit: 500 seconds for any individual operation.
7. Do not expose an unfinished V7 link. Build and test the complete release candidate before adding navigation or deploying it.
8. Commit coherent checkpoints to `main`; do not commit broken generated assets.
9. Never allow a failed refresh to replace the last validated public edition.
10. A local pass is not publication proof. Success requires a fresh checkout of the exact committed SHA, matching byte lengths and SHA-256 values, and the complete gate rerun against those committed bytes.
11. Generated outputs use temporary files, flush and `fsync`, parse/hash verification and atomic replacement. Never transport release blobs through logs, command output or an unbounded base64 text bridge.
12. Validation and failure reporting are read-only. A failed gate must never commit a diagnostic, rebase validated output onto a changed base, or move a public manifest.

## Measured V1–V6 synthesis

| Version | Preserve | Do not inherit |
|---|---|---|
| V1 | Reliable searchable table, gauges, filtering and CSV export | Broad mixed-technology universe, legacy GeoJSON and no canonical news identity |
| V2 | First explicit market-news concept | Iframe architecture and hand-written static stories |
| V3 | Standalone interface and simpler delivery | Manual news and the same legacy project spine |
| V4 | First automated newspaper | Loose matching, fabricated IDs and weak auditability |
| V5 | Best newspaper density, filters and utility-scale product direction | Foreign/wrong-technology leakage, non-canonical bindings and unreproducible current artefact |
| V6 | CSV/XLSX reconciliation, canonical REPD/GG identity, same-origin delivery, retention and telemetry | Solar >1 MW scope, BESS >100 MW boundary, missing geometry, inactive-record continuity errors and hard-coded Q2 refresh |

### Starting evidence

- V5 is the closest product model but its 125 stories lack canonical REPD and GlobalGrid identity.
- V6 is the correct engineering foundation but only one of its current eight headlines belongs to the desired utility-scale universe.
- V6 can attach a current story to a refused, abandoned or expired historical REPD record when a name is reused.
- The Q2 2026 acceptance fixture is **384 solar + 382 BESS = 766 official records across 718 developments**.
- V5/V6's `>100 MW` battery rule omits **113** records that satisfy the requested `>99 MW` rule.
- V6 has no coordinates. The legacy GeoJSON is Q1 data without canonical REPD IDs and cannot be safely joined by name.
- Solar MWp and BESS MW are different measures and must never be presented as one combined capacity gauge.

### Workflow and publication failures already observed

- On 23 August 2026, V4 and V5 were scheduled concurrently under independent concurrency groups. V4 run `32621259973` rewrote historical V4 assets and advanced `main` to `d3ba2a1`; this proved the historical versions were not operationally immutable.
- V5 run `32621092076` found one headline for 559 eligible projects and correctly failed its five-headline floor. Its fresh-only crawler has no last-known-good retention, while a successful run could overwrite the 125-story asset consumed by live V7.1.
- V6 run `32621379438` reconciled 14,657 REPD records and retained eight canonically bound stories, but failed only because it asserted obsolete V6 homepage wording after V7 became live. Its failure handler then wrongly committed `d8aa08f` to `main`.
- V7 North Star run `32609396308` passed V7.1 parity, modules, browser and 203 North Star checks, then rejected three corrupt V7.2 artefacts at invalid UTF-8 byte `393216`. The local 26/26 result did not describe commit `5dee339`.
- The V7.2 corruption was caused by routing large publication blobs through a clipped text-output bridge, not by the Python writer or the 500-second build limit.
- V4, V5 and V6 automatic `schedule`, `push` and `issues` triggers are therefore retired immediately. They remain manual-only historical diagnostics. V7 North Star stays read-only; V7.9 may introduce the sole scheduled writer only after production proof.

## Modular platform decision

V7 source code will be modular so the UK product can grow without becoming another single-file dashboard and so other countries can reuse the platform without inheriting UK assumptions.

The production site will still publish compact, deterministic, same-origin assets. Modularity belongs in the source and test architecture; it must not create hundreds of fragile runtime requests.

The reusable layers are:

- `core/`: country-neutral Project, Development, Article, Event, ProjectEventAssertion, GridContext and SourceHealth contracts.
- `country-packs/gb/`: REPD, UK lifecycle, planning, CfD, NESO, National Grid and DNO mappings.
- `adapters/`: one bounded source collector per official register, market source or news source.
- `plugins/`: Projects, Newspaper, Market Analytics, Grid Watch, CfD and C&I/EV features.
- `ui/`: reusable tables, maps, filters, timelines, gauges and evidence panels.
- `data/`: country, technology and period-partitioned validated publication assets.
- `tests/`: shared contract tests plus country-specific fixtures.
- `docs/`: short contributor, country-pack, source-provenance and release notes.

A future country pack must define authoritative sources, lifecycle terminology, thresholds, grid organisations, market mechanisms, coordinate systems, units, currency, language, timezone, evidence rules and data licensing without editing the country-neutral core.

## MVP truth and one-feature version discipline

V7.0 was the initial live MVP: a wholesale V5 product copy with only V7 labels, corrected folder paths, navigation and export naming. V7.1 is the current live release and modularises that baseline without changing its data or decisions.

The inherited V5 NEWS SIGNAL is part of the MVP. It works for some projects and fails for others. It must remain visibly external and unverified, must never overwrite REPD status, and must not be silently repaired during V7.1 or V7.2. Its discovery, identity and event behaviour is refined only in V7.3 under the labelled North Star corpus.

Development proceeds as one training or build session at a time:

1. One approved feature theme per minor release.
2. A training-only session may improve the README, fixtures or scope but must not change application behaviour.
3. A build session implements only the feature named for that release; unrelated repairs wait for the next release.
4. Each completed feature advances the visible version exactly once: V7.1, V7.2, V7.3 through V7.9.
5. After V7.9, the next product generation is V8.0; do not create V7.10 or silently add extra V7 scope.
6. Every release receives a direct `main` commit, version manifest, short release record, pre/post North Star evidence and production verification.
7. The stable public address remains `/uk_renewables_pipeline/v7/` throughout V7.x; the visible badge and manifest identify the exact minor release.
8. The four build steps below are roadmap groupings only. They do not authorise bundling several minor releases into one build.

## V7.1–V7.9 exact refinement sequence

### V7.1 — Modular V5 parity

Extract the live V5-derived MVP into small modules without changing visible behaviour, data, matching or NEWS SIGNAL decisions.

- Thin `index.html`.
- Separate styles, shell, newspaper, gauges, filters, table and export.
- Stable plugin contract and version manifest.
- Executable North Star preflight and postflight gate.
- One-command validation.
- Exact visual and functional parity with the current live MVP.
- No project-data, threshold, news-matching or event refinements.

Exit gate: the modular version reproduces the current 125-story newspaper, 10,784-feature legacy source and project interface, and the pre/post North Star results are identical.

### V7.2 — Canonical UK project foundation

Replace the legacy V5 project dependency with the strongest V6 engineering without changing the inherited V5 NEWS SIGNAL engine.

- Reconciled REPD CSV/XLSX ingestion.
- Solar `>49 MWp` and BESS `>99 MW`.
- Expected Q2 fixture: 384 solar, 382 BESS and 766 records across 718 developments.
- No wind.
- Stable REPD, GlobalGrid project and development IDs.
- Canonical JSON and GeoJSON from one record spine.
- Every qualifying record remains in canonical JSON even when geometry is absent or invalid. Each record carries `geometry_status`; longitude and latitude are nullable, while GeoJSON contains only valid geometries.
- Canonical-record and valid-geometry counts are asserted independently.
- Active, disputed and historical lifecycle views.
- Separate solar MWp and BESS MW analytics.
- V5 NEWS SIGNAL remains external legacy intelligence and cannot alter canonical facts.

Exit gate: every displayed utility project has canonical identity and provenance while the separately labelled legacy NEWS SIGNAL remains behaviourally unchanged; a fresh checkout of the exact committed SHA reproduces every file hash, count and validation result.

### V7.3 — Trusted newspaper and event engine

Replace the inherited V5 NEWS SIGNAL bindings only after V7.1 and V7.2 are proven.

- Separate articles, material events and project-event assertions.
- Planning-reference and NSIP-reference anchors.
- Current-versus-historical application resolution.
- Inactive-record protection.
- Technology, positive UK-location and ambiguity gates.
- Duplicate coverage clustered into one event.
- Evidence phrase and deterministic rejection reason stored.
- V5/V6 positive and negative evaluation corpus.
- Beacon Fen development-level and component-level tests.

Exit gate: zero known foreign, offshore-wind, healthcare, common-name or inactive-record leakage, with every accepted assertion supported by explicit identity and event evidence.

### V7.4 — UK market analytics

Create one commercial market-intelligence layer from the trusted V7.3 event model.

- Consent and refusal.
- CfD allocation and contract status.
- Financial close and investment.
- EPC award and notice to proceed.
- Construction commencement.
- Energisation and commissioning.
- Commercial operation.
- Acquisition and ownership changes.
- Development and regional market summaries.

Exit gate: every market milestone is independently evidenced and never overwrites REPD facts.

### V7.5 — Grid Watch

Add project-specific and system-level grid intelligence as a separate feature.

- NESO, National Grid and DNO adapters.
- Grid offers, agreements, delays and queue changes.
- Reinforcement, constraint, curtailment and outage events.
- Explicit project/substation relationships.
- Regional context shown separately from confirmed impact.
- OSM infrastructure retained as contextual geography only.
- Proximity never presented as a confirmed connection.

Exit gate: every confirmed project-grid signal contains explicit relationship evidence.

### V7.6 — C&I solar and EV charging

Create a separate distributed-energy market without widening the utility-project scope.

- Sub-49 MW rooftop and behind-the-meter solar.
- Commercial and industrial BESS.
- Depot and fleet charging.
- Forecourts and charging hubs.
- Physical-site identities based on organisation, address and planning evidence.
- Separate GlobalGrid C&I and EV identifiers.
- No fabricated REPD references.
- Ordinary small solar farms excluded from the C&I lane.

Exit gate: every C&I/EV asset has evidence for its classification and physical identity.

### V7.7 — Complete analytics product

Turn the proven modules into the intended UK market tool.

- Utility, Market Events, Grid Watch, C&I/EV and Archive views.
- Project and development pages.
- Event timelines.
- Canonical interactive map.
- Evidence drawers.
- Market totals and regional trends.
- Search, filters and exports.
- Public machine-readable feeds.
- Mobile and accessibility completion.

Exit gate: the UK market can be explored without conflating records, developments, events or context.

### V7.8 — Worldwide replication kit

Make the platform reusable without claiming portability until it is proven.

- Country-pack specification.
- Blank country template.
- Adapter interface and example fixtures.
- Localisation, currencies, units and timezone support.
- Technology and lifecycle mapping.
- Contributor and AI-agent instructions.
- Source licensing and provenance checklist.
- Schema compatibility tests.
- Example second-country implementation.

Exit gate: another country can be added without editing the core identity or interface engines.

### V7.9 — Bulletproof operations

Complete production automation and resilience as the final V7 feature.

- Pinned dependencies and Actions revisions.
- One validated writer on `main`.
- One repository-wide publication concurrency group; base-SHA drift aborts rather than rebases validated output.
- Checkpointed source collection.
- Source-health and freshness reporting.
- Deterministic builds.
- Content-addressed releases.
- Atomic Pages publication.
- Last-known-good retention.
- Binary-safe publication, exact-commit clean-checkout validation and atomic manifest promotion.
- Failure evidence stored in Actions summaries/artefacts, never committed to `main`.
- Failure simulations and shadow runs.
- V1–V7 immutability and regression gates.
- V4/V5/V6 automatic writers remain retired; only V7 may receive a production schedule after proof.

Exit gate: source failure, crawler failure or a new REPD edition cannot corrupt or silently empty the public product.

## North Star anti-hallucination and anti-truncation gate

This gate is mandatory before every V7.x publication. It exists so a shortened chat, truncated file, changed workflow or future AI agent cannot silently forget the product universe, positive UK evidence or known failure cases.

### Truth hierarchy

1. Official source record and provenance.
2. Canonical record identity and evidence-backed development relationship.
3. Independently evidenced article-to-project or article-to-development relationship.
4. Material-event classification supported by an explicit phrase and subject.
5. Publisher, capacity, name similarity and geographic proximity are corroboration only; none can create identity.

An REPD Ref proves which row was selected. It does not prove that a new article concerns the same current application. Refused, abandoned, withdrawn or expired records require explicit continuity or reapplication evidence.

### Frozen universe sentinels

| Layer | Frozen fixture expectation | Purpose |
|---|---|---|
| V1/V5 legacy master | 10,784 GeoJSON features; SHA-256 `ca5da437ddb832f7e4e8d84bba1f2f6d40df6285089a43156452fdda7eebe0fe` | Detect loss or substitution of the shared legacy source |
| V1/V5 displayed project layer | 5,210 records at ≥1 MW: 2,667 solar, 1,271 BESS and 1,272 wind | Preserve the measured historical behaviour; not the V7 scope |
| V5 raw utility filter | 321 solar >49 MW and 239 BESS >100 MW before V5 deduplication | Explain the legacy threshold projection |
| V5 eligible-news universe | 559 deduplicated projects; 125 stories over 366 days; news SHA-256 `0268087daab2a69bddff4167b2e38d5c89ff70bf36a6c4495ae8becca8c7bd87` | Detect headline or candidate-corpus truncation |
| V6 identity registry | 14,657 raw records and unique populated REPD Ref IDs; SHA-256 `d614084c05c0380862cf2d9da58309c43cdb128d6917458db4dc53717062ea95` | Preserve the canonical Q2 record spine |
| V6 serving universe | 3,445 solar >1 MW + 269 BESS >100 MW = 3,714 records; project SHA-256 `ad04f772189868b27e8ba6c2330350794786735d854d01a3c3698cd7422760a7` | Detect V6 project-snapshot truncation |
| V7 Q2 acceptance fixture | 384 solar >49 MWp + 382 BESS >99 MW = 766 records across 718 developments | Enforce the requested V7 utility scope |
| V7 capacity fixtures | 34,073.49 solar MWp and 106,338.18 BESS MW | Prevent combined or silently changed capacity gauges |

The frozen hashes are regression fixtures, not permanent expectations for a later official REPD edition. A new edition must retain the old fixture for tests, generate a complete Ref/status/capacity diff and account for every added, revised or removed record before promotion.

### Canonical UK positive sentinels

These V5-era stories test discovery, identity and event classification separately. Being present in V5 does not force publication.

| Sentinel | Required canonical result |
|---|---|
| Beacon Fen generic development-consent announcement | Resolve to development `GG2050-DEV-E13842D4D80DEC`; do not arbitrarily choose solar REPD 13599 or BESS REPD 13600 |
| Beacon Fen 400 MW solar permit report | Resolve to solar REPD 13599, planning reference `EN010151`; BESS REPD 13600 remains contextual |
| Dean Moor solar development-consent announcement | Resolve to solar REPD 14550 and development `GG2050-DEV-DF8A23D9E62EA8`, planning reference `EN010155` |
| Stonestreet Green Solar consent announcement | Resolve to solar REPD 10085 and development `GG2050-DEV-BAF7E2396D59FC`, planning reference `EN010135` |
| Cleve Hill 373 MW operation report | Resolve to solar REPD 6502, not co-located BESS REPD 7856; both retain development `GG2050-DEV-2ADB0F2D626ABD` |
| West Burton C 500 MW BESS financial-close report | Resolve to BESS REPD 11928, planning reference `22/01713/FUL` |
| Hams Hall 350 MW article report | Resolve to BESS REPD 9427 while preserving official REPD capacity 400 MW separately from the article value |
| Tween Bridge planning-application report | Resolve to solar REPD 12926 and development `GG2050-DEV-81C5A835AFC865`; BESS REPD 19574 remains contextual unless explicitly asserted |
| Green Hill public-consultation report | Resolve the development `GG2050-DEV-36DE7073A7E4D2` but do not manufacture a construction, finance or operation milestone |
| Coalburn 1 operational report | Resolve to BESS REPD 11034; an external operational claim must not overwrite the official Under Construction status |
| Coalburn II 1,000 MWh land/acquisition report | Resolve to Coalburn II REPD 12206 or reject pending evidence; never bind to Kingston International Business Park or Carlisle Road |

Every required record above must exist with the expected technology, planning reference, development relationship and official capacity/status fields. Missing sentinels fail the build even when aggregate counts still look correct.

### Mandatory negative sentinels

- Australian storage reporting cannot bind to Stonestreet Green.
- A US or emerging-markets investment fund cannot bind to Cleve Hill.
- Greek solar or German BESS reporting cannot bind to Tween Bridge.
- Avonmouth fires, crime or industrial incidents cannot bind to the Avonmouth solar record.
- Witney High Street roadworks cannot bind to High Street Solar Farm.
- Offshore wind, healthcare, care-home, foreign-project, generic-capacity and common-word stories must not create UK solar/BESS identity.
- A generic Beacon Fen development headline must not be forced into one co-located technology record merely to satisfy one-primary-per-article accounting.

### Gate accounting

- Discovery recall, project/development identity and event classification are scored and tested independently.
- `configured = completed + failed + skipped` for every source/query plan.
- `candidates = accepted + rejected + ambiguous + duplicates` after explicitly documented stage transitions.
- Every accepted project assertion has exactly one current primary record; a development-level event is allowed where the evidence does not select a component.
- Every rejected or ambiguous item has a bounded reason.
- A changed fixture hash, missing sentinel, unexplained count difference, referential-integrity error or unhealthy mandatory source fails publication.
- Every JSON and GeoJSON artefact is valid UTF-8, fully parseable and identical in byte length and SHA-256 to the validated manifest entry.
- `git fsck` is insufficient publication evidence: the exact remote commit must be fetched into a clean checkout and semantically validated.
- Failure leaves the public manifest and last validated assets byte-for-byte unchanged.
- The release report records fixture hashes, source hashes, counts by technology/status, development count, missing-field coverage, geometry coverage and all sentinel outcomes.

### Executable beginning-and-end build contract

The README is the governing human scope. V7.1 must add a machine-readable mirror and validator beneath the V7 folder; later releases must use them without weakening the README contract.

Required V7.1 implementation:

- `contracts/north-star.v1.json`: frozen counts, hashes, canonical sentinels, negative sentinels, thresholds and release rules.
- `fixtures/`: immutable byte-for-byte V5 and V6 reference assets used only by the gate, never as rotating workflow outputs.
- `tests/validate_north_star.py`: one validator with explicit `pre` and `post` phases.
- `data/build_manifest.json`: current minor version, governing README blob/hash, North Star contract hash, input hashes, output hashes and gate result.
- One local command and one GitHub workflow step call the same validator; there is no separate weaker workflow validator.

Every build begins by:

1. Reading this README and resolving the current V7 minor version.
2. Verifying that the machine contract fingerprints this governing README revision.
3. Verifying frozen V1/V5/V6 fixture hashes and historical file hashes while observing current runtime paths separately.
4. Verifying baseline universe counts and every required canonical sentinel.
5. Recording a preflight report before any source or application file changes.

Every build ends by:

1. Running the identical fixture, universe, identity and negative-sentinel gates.
2. Comparing the preflight and postflight reports and accounting for every intended difference.
3. Proving that unrelated versions and features did not change.
4. Writing the release manifest and short release record for exactly one minor version.
5. Fetching the exact committed SHA into a clean checkout, matching output sizes and hashes, and rerunning the complete gate.
6. Refusing publication or manifest promotion if the README, machine contract, committed output, Actions result or live deployment disagrees.

Application and workflow code must read thresholds, version and scope identifiers from the validated contract/manifest. It must not maintain hidden duplicate constants that can drift away from this README.

Threshold and hash semantics are explicit. On the legacy V5 GeoJSON spine, BESS `>99 MW` produces 328 records and BESS `>100 MW` produces 239: a difference of 89. On the reconciled V6/Q2 identity spine, the corresponding counts are 382 and 269: a difference of 113. The V6 snapshot file SHA-256 is `ad04f772…`; `48281b1d…` is separately the canonical `projects` array SHA-256. These values are never interchangeable.

## Four-step build

These are macro roadmap groupings only. Each named V7.x refinement above is trained, built, validated, committed and published separately.

### Step 1 — V5 product base + V6 canonical project foundation

First complete V7.1 modular parity. Only after its exit gate passes, complete V7.2 canonical project data as a separate version and build.

Deliverables:

- V7 shell, newspaper layout, filters, search, gauges, table and export based on V5 behaviour.
- Thin `index.html` with separate CSS and JavaScript modules.
- Latest-edition REPD source discovery with reconciled CSV and XLSX inputs.
- Stable REPD Ref, GlobalGrid project ID and evidence-backed development ID.
- Exact exclusive thresholds: solar `>49 MWp`; BESS `>99 MW`.
- Separate active, disputed and historical lifecycle views.
- Canonical project JSON and GeoJSON generated from the same record array.
- Coordinates remain optional; missing geometry cannot delete an official record.
- Q2 fixture gates: 384 solar, 382 BESS, 766 records and 718 developments.
- Immutable V1–V6 hash test.

Exit gate: the V7 project dashboard works locally from same-origin assets, produces the exact Q2 fixture and contains no news-derived facts.

### Step 2 — Material-event intelligence

Complete only V7.3: replace V5 headline binding and V6's incomplete event layer with auditable article, event and project-event records.

Deliverables:

- Separate schemas for source articles, material events and project-event assertions.
- Planning/consent, CfD, financial close, EPC/NTP, construction commencement, grid, energisation, commissioning, commercial operation and ownership events.
- Direct source URL, evidence phrase, publication date, effective date, first seen, identity anchors and source hash.
- Planning reference and NSIP reference as strongest project anchors.
- Administrative-separator-safe project stems and development-scoped ambiguity handling.
- No identity from capacity or publisher reputation.
- Current stories cannot bind to refused, abandoned, withdrawn or expired records without explicit continuity/reapplication evidence.
- Duplicate articles collapse into one material event with corroborating links.
- Official REPD facts and article-reported facts remain separate.
- Labelled evaluation using V5/V6 stories plus Avonmouth, Witney High Street, offshore wind, healthcare, foreign-place, common-word, inactive-record and co-located-development fixtures.
- Zero known-negative leakage; recall measured separately and never improved by lowering precision gates blindly.

Exit gate: every published event has a defensible current-project identity, explicit evidence and deterministic rejection reason.

### Step 3 — Grid, CfD, C&I/EV and complete interface

Complete V7.4, V7.5, V7.6, V7.7 and V7.8 sequentially as five separate feature releases. Do not mix their evidence classes or combine their builds.

Deliverables:

- Official CfD fields and separately reconciled official allocation/contract sources.
- Confirmed project grid events from explicit site, connection, substation or queue evidence.
- NESO/National Grid/DNO regional context shown separately from confirmed project impact.
- OSM grid layers labelled as contextual only; proximity never implies capacity or connection.
- Project timeline, development relationships, canonical map and event evidence drawer.
- Utility, Grid Watch, C&I/EV and Archive views.
- C&I classification based on physical-site/rooftop/behind-the-meter evidence, not capacity alone.
- EV identities from separately approved charger, depot, fleet, forecourt and hub sources; never fabricate REPD references.
- Desktop and mobile search, filters, table, map, export and evidence views.
- Visible REPD edition, last successful crawl, last attempted crawl and adapter health.

Exit gate: the complete local product fulfils the market purpose and keeps official facts, confirmed events and contextual intelligence visibly distinct.

### Step 4 — Reliability, main-branch publication and production proof

Complete only V7.9: replace competing writers with one staged and deterministic V7 publication path.

Deliverables:

- Pinned dependencies and GitHub Actions revisions.
- One V7 concurrency group and one authorised writer.
- Read-only collection/build/test followed by minimal publication.
- Checkpointed discovery with bounded per-source timeouts.
- Crawl-health gate; a blind or degraded crawl cannot advance the public edition.
- Content-addressed release assets and an atomic manifest pointer.
- Binary-safe asset transport; logs and command-output bridges never carry release blobs.
- Pages deploys the exact validated commit/artefact, not an arbitrary later `main` state.
- Deterministic rebuild, referential-integrity, negative-corpus, mobile and failure-recovery tests.
- V1–V6 hash verification before every publication.
- V4/V5/V6 automatic triggers are already retired and remain manual-only; historical pages and assets remain.
- Final production verification of counts, identity, search, filters, map, mobile, events and same-origin delivery.
- The live V7.1 MVP remains exposed; later data/news modules and the scheduled V7 writer are promoted only after their own production gates pass.

Exit gate: V7 is live, reproducible, observable and capable of retaining the last validated edition through source or crawler failures.

## Folder architecture

```text
uk_renewables_pipeline/v7/
├── README.md
├── index.html
├── contracts/            # Machine-readable North Star and plugin contracts
├── docs/                 # Short discipline and decision records
├── styles/               # Tokens, layout and components
├── scripts/
│   ├── core/             # Plugin host, validation and shared utilities
│   ├── config/           # Versioned scope and source contracts
│   ├── country-packs/    # GB implementation and future country templates
│   ├── adapters/         # Bounded official, market and news collectors
│   ├── data/             # REPD ingestion and canonical identity
│   ├── events/           # Discovery, matching, event extraction and retention
│   ├── grid/             # Grid context and confirmed-impact logic
│   ├── cfd/              # CfD source reconciliation
│   ├── ci_ev/            # Separate C&I and EV identity lanes
│   └── plugins/          # User-facing feature modules
├── fixtures/             # Immutable V5/V6 baselines plus evaluation cases
├── tests/                # Unit, contract, integrity and browser tests
├── data/                 # Generated same-origin release assets
└── workflows/            # Future publication workflows; the read-only validator launcher lives in .github
```

## Reload protocol

For a new chat:

1. Read this README first.
2. Inspect `git log -- uk_renewables_pipeline/v7/` and `git status`.
3. Identify the latest completed build step and its exit-gate evidence.
4. Continue the next unfinished item; do not restart or redesign completed work without evidence.
5. Keep work on `main`, in this folder, with short checkpointed actions.

## Current state

- Build plan approved for a four-step implementation structure.
- Branches are prohibited.
- V7 must use V5 as the product base and V6 as the canonical engineering refinement.
- V7.1 is live at `https://globalgrid2050.com/uk_renewables_pipeline/v7/`; mobile repair build `458ec52` and production proof `3e9c023` are deployed.
- V7.1 changes the shell and source organisation only; its project data, newspaper feed, matching decisions and NEWS SIGNAL behaviour remain V5.
- The root directory lists the renewables dashboards in ascending order from V1 to V7.
- MVP publication commits: `d9c0a9a` (V7 page) and `68af380` (ordered root link).
- Production proof: deployed HTML and CSS match the committed V7.1 hashes; the two inherited assets expose 125 V5 stories and 10,784 legacy REPD GeoJSON features.
- Known V5 identity, foreign-story, technology, stale-GeoJSON and reproducibility weaknesses therefore remain present by design until refinement.
- The modular platform decision, V7.1–V7.9 sequence and North Star anti-hallucination/anti-truncation gate are documented above and are mandatory for future work.
- V7.0 deliberately retains V5 NEWS SIGNAL behaviour: useful matches and known failures remain external legacy intelligence until the single-feature V7.3 replacement.
- Every future build must execute the North Star at both preflight and postflight; V7.1 is responsible for creating the shared machine-readable contract and validator.
- Each V7.1–V7.9 release implements one feature theme only; after V7.9 development moves to V8.0.
- V7.1 modular release is complete: the thin shell, exact V5 base stylesheet, bounded V6-derived mobile header override, shared core, gauges/newspaper/projects plugins, plugin manifest, North Star contract and validation suite are present.
- V7.1 fixture-hardened preflight passes 180 checks and postflight passes 211 checks. Dataset/interface parity and ES-module contract tests pass with 5,210 displayed legacy projects and 125 inherited V5 headlines.
- V7.1 has not changed the legacy project floor, wind visibility, V5 news feed or inherited NEWS SIGNAL decisions; those remain explicitly deferred to V7.2 and V7.3.
- GitHub V7 North Star run `32606186065` passed; Pages run `32606186068` deployed the current proof state successfully.
- Live browser proof: 5,210 rows, 125 headlines, gauges `262,397 / 5,210 / 4,100`, solar filter 2,667 rows, BESS news 56, finance news 34 and Berwick Bank search one exact row.
- The mobile gate is mandatory and rejects horizontal document overflow or escaped key panels at 390, 430, 440 and 768 px; this layout correction does not alter project or news decisions.
- iPhone-user-agent delivery is byte-identical to the committed HTML and the exact V5 stylesheet retains its 1,200 px and 768 px responsive breakpoints.
- Step 1's canonical V6-derived project foundation and its exit gate are not yet complete.
- Original V7.2 commit `5dee339` remains rejected because three artefacts were corrupt at byte `393216`; it is retained as incident evidence, never as a release baseline.
- Subsequent legacy commits `d3ba2a1` and `d8aa08f` proved that V4–V6 writers could move `main` independently of V7. Their automatic triggers are now retired before any V7.2 repair or promotion.
- The repaired V7.2 data-only spine contains 766 records across 718 developments: 384 solar and 382 BESS, with 766 valid geometries and zero missing among this edition. Atomic replacement and synthetic missing/invalid-geometry tests protect future editions.
- V7.2 remains data-only and not live. V7.1 remains the last-known-good public release until a separately approved project-plugin promotion passes its own exact-remote-commit and production gates.
