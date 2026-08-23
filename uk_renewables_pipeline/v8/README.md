# GlobalGrid2050 UK Solar + Storage Daily V8

## Current state

V8.1 is the one-hour minimum viable product. V7 remains the untouched public fallback.

- Visible release: **V8.1 MVP**.
- Public fallback: `/uk_renewables_pipeline/v7/`.
- Live address: `/uk_renewables_pipeline/v8/`.
- V8.1 baseline commit: `76bacf217ef5cadfd068e796aa2d493a34324cf1`.
- Frozen V7 source tree: `9ad8cfe9cdf26948ed3ad3898822977f9198006a`.
- V8.1 makes the repaired V7.2 canonical project spine visible without rebuilding the inherited newspaper.
- The original governing V7 plan is preserved at `docs/V7_LINEAGE.md`.

V8 must never overwrite or silently redirect V7. Rolling back means changing the directory link to V7; it must not require rebuilding old code.

## Product North Star

Build a continuously updated, evidence-led UK market intelligence product for:

- Solar projects above **49 MWp**.
- Battery projects above **99 MW**.
- Grid, CfD, FID, lender mandate, EPC/NTP, financial close, construction, energisation, commissioning and commercial-operation events.
- Confirmed project-specific NESO, National Grid and DNO evidence.
- A separate evidence-based lane for sub-49 MW C&I solar, commercial BESS and EV charging.
- No wind coverage in V8.

Solar MWp and BESS MW remain separate measures. News, finance and grid evidence never overwrite official REPD facts.

## Fast-track working rules

1. Work on `main`; do not create product branches or pull requests.
2. V1–V7 are immutable regression and rollback versions.
3. Keep V8-owned application code, contracts, tests, fixtures and data under `uk_renewables_pipeline/v8/`.
4. One feature theme advances one visible `8.x` version.
5. Every release has no more than four stages: contract, build, validate, publish/fresh-clone proof.
6. Aim for roughly 30 seconds per bounded operation. Stop before 500 seconds; checkpoint instead of allowing a hanging process.
7. Only the primary builder edits `main`. Parallel work is read-only research, fixture design or independent validation.
8. The last green public release remains available until its successor passes from the exact committed bytes.
9. Generated data uses temporary files, flush, `fsync`, parse/hash verification and atomic replacement.
10. Never transport release blobs through logs, command output or an unbounded base64 bridge.
11. A local pass is not publication proof. Fetch the resulting commit, verify byte lengths and SHA-256 values, and rerun all gates.
12. Failed retrieval or validation retains the last-known-good publication and records the failure separately.

## One-hour V8.1 MVP boundary

Included now:

- The validated Q2 2026 universe of **766 canonical REPD records across 718 developments**.
- **384 solar records above 49 MWp** and **382 BESS records above 99 MW**; no wind.
- Separate filtered gauges for **34,073.49 MWp solar** and **106,338.18 MW BESS**, plus record count and largest record.
- Canonical search by project, operator, REPD Ref, GlobalGrid project/development ID, planning reference, authority and location.
- Solar/BESS, official-status and county filters; an 11-column project table; filtered-only CSV export.
- A Chart.js outage hides the decorative arcs but leaves gauge values and the project interface operational.
- The inherited 125-story V5 newspaper, labelled **legacy/unverified**. Its signals cannot overwrite REPD facts.

Explicitly deferred to small daily releases in later chats:

- V8.2 trusted news matching and the anti-hallucination corpus.
- V8.3 capital, CfD and delivery milestones.
- V8.4 append-only TEC and later ECR grid transitions.
- V8.5 C&I solar, commercial BESS and EV charging.
- V8.6 project pages, maps, timelines, evidence UI and accessibility.
- V8.7 country-pack replication, V8.8 operations hardening and V8.9 integrated production proof.

This boundary is deliberate. A daily release may advance one feature theme only; unfinished work stays inert and cannot be presented as verified intelligence.

## Four release stages

### 1. Contract

- Freeze source, schema, threshold, identity, positive and negative fixtures.
- State deliberate differences from V7.
- Define the exit gate before changing behaviour.

### 2. Build

- Implement one plugin or bounded data capability.
- Keep collectors, normalisers, identity, event logic, presentation and publication separate.
- Keep browser assets deterministic and same-origin.

### 3. Validate

- Run unit, contract, anti-hallucination, mobile and regression gates.
- Parse every generated artifact from disk.
- Verify V7's pinned tree is unchanged.

### 4. Publish and prove

- Commit one coherent checkpoint to `main`.
- Fetch the exact remote commit into a clean checkout.
- Rerun the gates against committed bytes and inspect deployment status.
- Promote only after proof; otherwise V7 remains the fallback.

## V8.0–V8.9 fast-track sequence

### V8.0 — Safe working copy

Copy the repaired V7 tree into V8, change only the visible test identity and recovery controls, and prove V7 remains unchanged.

Exit gate: V7 passes all existing gates; V8 assets parse; inherited code/data match V7 except the documented V8 bootstrap files.

### V8.1 — Canonical utility projects

Wire the repaired canonical spine into the V8 project interface.

- Solar `>49 MWp`; BESS `>99 MW`; no wind.
- Q2 fixture: 384 solar + 382 BESS = 766 records across 718 developments.
- Stable REPD, GlobalGrid project and development identity.
- Canonical JSON and GeoJSON from one record spine.
- Every qualifying record remains in canonical JSON when geometry is absent or invalid; each record carries `geometry_status`.
- Separate solar MWp and BESS MW gauges.
- Preserve the inherited newspaper as visibly legacy until V8.2.

Exit gate: every displayed utility project has canonical identity and provenance.

### V8.2 — Trusted news and event engine

- Separate article, assertion and material-event records.
- One canonical PRIMARY_MATCH per published project assertion.
- Planning/NSIP anchors, technology and UK-location gates.
- Inactive-record, ambiguity, foreign-location and wrong-technology protection.
- Beacon Fen, Dean Moor, Cleve Hill, Tween Bridge, Green Hill and Coalburn positives.
- Avonmouth, Witney High Street, foreign, offshore-wind, healthcare and common-word negatives.
- Complete rejection and abstention telemetry.

Exit gate: zero known-negative leakage and every published assertion carries its evidence and canonical subject.

### V8.3 — Market milestones

- CfD, FID, lender mandate, EPC/NTP, financial close, investment, acquisition, construction, energisation and commissioning events.
- Store `occurred_at`, `published_at`, `first_seen_at`, evidence and source separately.
- Lead, confirmation and late indicators are evidence classifications, not a universal fixed chronology.

Exit gate: every milestone is independently evidenced and cannot alter REPD facts.

### V8.4 — Grid Watch

- Append-only TEC snapshots for every changed NESO Tuesday/Friday publication.
- Preserve native case-sensitive Project ID, Project Number, Stage, `MW Effective From`, Gate, Project Status and capacity fields.
- Generate added/removed, Gate, date, status, staging and capacity transitions.
- Add source-specific ECR adapters after TEC is proven.
- Cross-register links are evidence assertions, never name-only joins.
- Proximity is context and never proof of a grid connection.

Exit gate: every confirmed project-grid signal contains an explicit relationship and source-backed transition.

Raw TEC capture may begin before V8.4 interface work because historical source states cannot be reconstructed later. Capture remains inert and data-only until its identity and transition gates pass.

### V8.5 — C&I solar and EV charging

- Sub-49 MW rooftop and behind-the-meter solar.
- Commercial/industrial BESS, depots, fleets, forecourts and charging hubs.
- Physical-site identity based on organisation, address and planning evidence.
- Separate GlobalGrid C&I/EV IDs; never fabricate REPD references.

Exit gate: every asset has evidence for its classification and physical identity.

### V8.6 — Complete analytics interface

- Utility, Events, Grid Watch, C&I/EV and Archive views.
- Project/development pages, timelines, canonical map and evidence drawers.
- Search, filters, exports, public machine-readable feeds, mobile and accessibility completion.

Exit gate: users can explore records, developments, events and context without conflation.

### V8.7 — Worldwide country packs

- Country-neutral core plus a formal GB pack.
- Blank country template, adapter interface, localisation and source/licensing checklist.
- A second-country proof before portability is claimed.

Exit gate: another country can be added without editing core identity or interface engines.

### V8.8 — Bulletproof operations

- Pinned dependencies and Actions revisions.
- One validated writer on `main`.
- Source health, checkpointing, deterministic builds and last-known-good retention.
- Content-addressed, atomic publication and failure simulations.
- V1–V8 immutability gates.

Exit gate: source, crawler or edition failure cannot corrupt or silently empty the public product.

### V8.9 — Integrated production proof

- Run the complete system in shadow mode.
- Reconcile every plugin contract, count, relationship and publication asset.
- Complete desktop, mobile, accessibility, rollback and clean-checkout tests.
- Promote V8 only after the exact deployed bytes pass.

Exit gate: V8 is production-ready while V7 remains a working historical fallback.

## Evidence model

V8 keeps three independent evidence axes:

- **Planning:** REPD and authoritative planning records.
- **Grid:** TEC/ECR contracts and field-level changes.
- **Capital/delivery:** CfD and attributable finance, procurement and construction evidence.

Agreement across axes increases confidence. Divergence creates a review or risk flag; it never automatically declares a project live, dead or fraudulent.

## V8.0 allowed differences from V7

- `README.md` and the preserved `docs/V7_LINEAGE.md`.
- Visible V8 labels and V7 fallback link in `index.html`.
- V8 package identity and validation command.
- V8 fallback contract, baseline validator and V8.0 release note.
- Root-directory V8 test link.

All other inherited V8.0 files must initially remain byte-identical to V7.
