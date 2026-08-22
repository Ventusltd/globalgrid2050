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
- No production V7 link, workflow or deployment is authorised merely by this planning commit.
