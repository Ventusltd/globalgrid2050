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

## V7.1–V7.9 refinement sequence

| Release | Refinement | Non-negotiable exit gate |
|---|---|---|
| V7.1 | Modular V5 parity: extract the live MVP shell, newspaper, gauges, filters, table and export into small modules | Visible behaviour and inherited 125-story/10,784-feature baseline remain reproducible |
| V7.2 | Canonical UK project foundation: reconciled REPD, exact thresholds, identity, lifecycle and canonical GeoJSON | Q2 fixture produces 384 solar + 382 BESS = 766 records across 718 developments |
| V7.3 | Trusted article/event/assertion engine and labelled matcher evaluation | Zero known-negative leakage; every accepted assertion has explicit identity and event evidence |
| V7.4 | UK market analytics: consent, CfD, finance, EPC/NTP, construction, commissioning, operation and ownership | External events never overwrite official REPD facts |
| V7.5 | Grid Watch: NESO, National Grid and DNO confirmed events plus separately labelled context | Proximity never becomes a claimed connection or confirmed impact |
| V7.6 | Separate sub-49 MW C&I solar, C&I BESS and EV-charging identity lanes | No ordinary small solar farm is called C&I and no REPD Ref is fabricated |
| V7.7 | Complete product: project/development pages, timelines, map, evidence drawers, analytics, search, filters and feeds | Desktop, mobile, export and referential-integrity gates pass |
| V7.8 | Worldwide replication kit: country-pack specification, blank template, localisation and a second-country proof | A second country can be added without changing core identity or UI contracts |
| V7.9 | Bulletproof operations: pinned dependencies, checkpointed collection, health gates, atomic publication and recovery | A failed or blind refresh leaves the last validated public edition unchanged |

Delivery remains grouped into the four build steps below: Step 1 covers V7.1–V7.2; Step 2 is V7.3; Step 3 covers V7.4–V7.8; Step 4 is V7.9.

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
- Failure leaves the public manifest and last validated assets byte-for-byte unchanged.
- The release report records fixture hashes, source hashes, counts by technology/status, development count, missing-field coverage, geometry coverage and all sentinel outcomes.

## Four-step build

### Step 1 — V5 product base + V6 canonical project foundation

Use V5 as the visual and interaction base, but modularise it inside the V7 folder. Replace its legacy data dependency with a V6-derived canonical ingestion spine.

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

Replace V5 headline binding and V6's incomplete event layer with auditable article, event and project-event records.

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

Add the specialist disciplines without mixing their evidence classes.

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

Replace competing writers with one staged and deterministic V7 publication path.

Deliverables:

- Pinned dependencies and GitHub Actions revisions.
- One V7 concurrency group and one authorised writer.
- Read-only collection/build/test followed by minimal publication.
- Checkpointed discovery with bounded per-source timeouts.
- Crawl-health gate; a blind or degraded crawl cannot advance the public edition.
- Content-addressed release assets and an atomic manifest pointer.
- Pages deploys the exact validated commit/artefact, not an arbitrary later `main` state.
- Deterministic rebuild, referential-integrity, negative-corpus, mobile and failure-recovery tests.
- V1–V6 hash verification before every publication.
- V4/V5/V6 schedules retired only when V7 production proof is complete; historical pages and assets remain.
- Final production verification of counts, identity, search, filters, map, mobile, events and same-origin delivery.
- V7 navigation exposed only after the production proof passes.

Exit gate: V7 is live, reproducible, observable and capable of retaining the last validated edition through source or crawler failures.

## Folder architecture

```text
uk_renewables_pipeline/v7/
├── README.md
├── index.html
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
├── fixtures/             # Positive, negative and boundary evaluation cases
├── tests/                # Unit, contract, integrity and browser tests
├── data/                 # Generated same-origin release assets
└── workflows/            # V7 workflow sources copied to .github only at Step 4
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
- A wholesale V5 MVP is live at `https://globalgrid2050.com/uk_renewables_pipeline/v7/`.
- The MVP changes only V7 labels, folder-relative paths, version navigation and export naming; its data and newspaper behaviour remain V5.
- The root directory lists the renewables dashboards in ascending order from V1 to V7.
- MVP publication commits: `d9c0a9a` (V7 page) and `68af380` (ordered root link).
- Production proof: deployed HTML matches the committed V7 file; the two inherited assets expose 125 V5 stories and 10,784 legacy REPD GeoJSON features.
- Known V5 identity, foreign-story, technology, stale-GeoJSON and reproducibility weaknesses therefore remain present by design until refinement.
- The modular platform decision, V7.1–V7.9 sequence and North Star anti-hallucination/anti-truncation gate are documented above and are mandatory for future work.
- Step 1's canonical V6-derived project foundation and its exit gate are not yet complete.
