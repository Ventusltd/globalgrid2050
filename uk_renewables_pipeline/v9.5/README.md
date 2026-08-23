# GlobalGrid2050 UK Renewables Pipeline V9.5

## Current release

V9.5 is a separate app copied from frozen V9.4. It replaces directional legacy project-name news binding with audited canonical `repd_ref` `PRIMARY_MATCH` binding, while retaining the clickable `REPD UPDATED` sort and every V9.4 project feature.

The default page loads all 7,680 qualifying solar, battery, onshore-wind and offshore-wind records at 1 MW and above. Technology, status, county and search controls filter that complete universe; they never redefine or truncate the pipeline.

V9.5 changes the news intelligence layer only. It does not rebuild the V9.1 data spine or change search, CSV, official identity, capacity, dates or Atlas algorithms.

- V9.4 frozen app: `../v9.4/`, commit `d598d9b6b89be4daeb904fafae52dd18ba35d1c1`, subtree `dfcd9b457854fc07d4af3df5797f29e2e3d12426`.

- V9.3.1 frozen app: `../v9/`, commit `9e0c51281fc816691a75e4255483a0851122481e`, subtree `64f318b1dced6c202c5ff3517ef120828fdd2064`.

- V9.3 frozen checkpoint: commit `eee4cf7d854bf44235c249d337c2aad3916bcdc0`.

- V9.2 frozen checkpoint: commit `77085a5dc8a8ce42cd4de7dad927eaf9aaf785ee`, tree `3807968dbf5c73e4499c6de9157464e3185dd241`.
- V9.1 frozen checkpoint: commit `59f74e319fbaad62abdb995107dba5759d7f3ca2`, tree `e9dc244b74d9c983e4557a23bd2b745c1daeb105`.
- V9.0 frozen baseline: commit `50a6df6c4bd54ff4c113aaf0df4f230b7c9544d2`, tree `60b72b3665e6b65a397541b221c4bca75aa402c9`.
- Earlier V1–V8 integrity markers remain pinned by `contracts/legacy-integrity.v9.json`.

See `docs/releases/9.5.md`, `contracts/release.v9.5.json`, `contracts/release.v9.4.json` and `contracts/release.v9.1.json`.

## Retained V9.4 interface contract

The runtime stylesheet order is deliberate:

1. `styles/v7.css` — exact V5-derived visual shell.
2. `styles/mobile.css` — the proven V7.1 mobile overflow correction.
3. `styles/v9-3.css` — the frozen V9.3.1 additive controls and bounded tablet-header correction.
4. `styles/v9-4.css` — only the clickable REPD Updated header presentation.

V9.5 does not load `styles/v8.css` or `styles/v9-2.css`.

The visible contract is:

- exactly three primary gauges;
- the filtered-capacity gauge and filtered results summary use the original V2/V5/V7.1 whole-MW display with no decimal places;
- three gauge columns above 768 px;
- one gauge column at and below 768 px;
- the normal desktop header remains a row from 921 px upwards;
- from 769 to 920 px, only the header stacks and the status text wraps so the release label cannot be clipped beside the 250 px sidebar;
- at and below 768 px, the proven V7.1 mobile header and wrapping behaviour remains unchanged;
- an eleven-column desktop project table, adding REPD Ref, GlobalGrid Ref and REPD Updated;
- mobile retains the same three facts beneath the site name;
- sort controls preserve the canonical capacity order by default and optionally order official REPD update dates newest or oldest;
- missing official update dates remain `not supplied by REPD` and sort after dated records;
- first header click selects newest first (`▼`); second selects oldest first (`▲`);
- the clickable header, retained sort selector, `aria-sort` state and shareable URL remain synchronised;
- no forced 1,500 px or 1,850 px table width;
- contained-layout checks at 769, 800, 900 and 920 px, plus mobile checks at 390, 430, 440 and 768 px.

The 769–920 px rule is not a redesign. It changes no gauge count, project, filter, news, CSV or Atlas decision.

### Whole-MW presentation

V2, V5 and the proven V7.1 release displayed filtered capacity with `maximumFractionDigits: 0`. V9.5 retains the V9.4 presentation on desktop and mobile:

- canonical `356,474.09 MW` displays as `356,474` in the primary gauge and results summary;
- offshore-wind `80,535.4 MW` displays as `80,535`;
- the underlying canonical value is not rounded or rewritten;
- exact capacity remains in the V9.1 data partitions, project table, filtered CSV, Atlas URL and manifests.

The presentation adapter is `scripts/plugins/capacity-presentation-v9-3.js`. It observes only the capacity text outputs and cannot change the canonical model or filtering decisions.

V9 features remain inside the familiar layout. REPD Ref, GlobalGrid project ID and official record-update date are explicit desktop columns and appear beneath the site name on mobile. Planning, lifecycle, relationship and geometry fields remain available through the expandable project record. Atlas, news and copy-ID actions remain in the final column.

## Complete pipeline

The canonical universe remains unchanged:

- 7,680 official REPD records;
- 356,474.09 MW exact record-based capacity;
- 4,100 MW largest single record;
- 3,563 solar records;
- 1,609 BESS records;
- 2,399 onshore-wind records;
- 109 offshore-wind records;
- 7,652 valid map geometries;
- 28 missing geometries retained in search and CSV.

V9.5 reuses the V9.1 project partitions and validates their counts, capacity, identities, technologies and geometry coverage before exposing them.

## Search, filters and engagement

V9.5 retains V9.4's normalised multi-token AND search across project name, operator, REPD Ref, GlobalGrid IDs, planning references, geography, status, dates and relationship references.

It retains:

- optional shareable URL filter state;
- results count and filtered-capacity summary;
- clear filters;
- copy project ID;
- expandable canonical project record;
- explicit `NO MAP` for missing geometry.

No URL parameters means the complete 7,680-record universe. V9.5 retains the V9.4 filter and date-sort contract unchanged.

## Filtered CSV contract

- The export contains the current filtered rows only.
- A zero-result filter produces the CSV header only.
- Filename: `globalgrid2050_uk_renewables_pipeline_v9_5_YYYY-MM-DD.csv`.
- UTF-8 BOM is retained for Excel compatibility.
- Canonical identity, exact official status/capacity, official update date, relationships, coordinates, provenance, canonical news-match note and Atlas URL are included.
- Spreadsheet-formula injection remains neutralised.

## REPD date and Atlas contracts

`repd_record_updated` remains an official REPD field. The table displays it as `dd/mm/yyyy`; CSV retains the canonical ISO date. The sort control uses only that canonical field. Missing dates remain missing, display as `not supplied by REPD`, sort after dated records in both directions and are never replaced with the current date or a news date.

Valid geometries create exact Atlas V8 links containing the canonical REPD Ref, project name, technology, exact capacity, latitude, longitude and zoom. The Atlas bridge resolves exact identity before flying to the point and opening the popup. Records without geometry remain searchable and exportable and display `NO MAP`; V9.5 never invents coordinates or identity.

## News discipline

V9.5 consumes only the canonical V6 feed's `PRIMARY_MATCH` articles and indexes them by exact `repd_ref`; project-name lookup is not used. Related-development records never drive a project news signal, and capacity is corroboration only.

The Claude-informed matcher uses segmented public name stems, development-scoped duplicate counts, strong/weak confidence floors of 52/68, narrow official-source technology inference, single-token descriptor adjacency and foreign-location collision guards. The focused gate currently accepts 12/13 positives (92.3%) and rejects 9/9 hostile negatives. Pair-rejection reasons and bounded rejected-article samples remain published in telemetry.

No headline score may overwrite an official REPD identity, status, capacity or date. Event labels remain algorithmic and unverified.

## Validation and publication proof

Run:

```bash
bash uk_renewables_pipeline/v9.5/tests/run_v9_5.sh
```

The gate:

- confirms the frozen V9.4 app subtree;
- verifies V1–V8 integrity markers;
- rebuilds the V9.1 data spine and rejects any committed-byte difference;
- checks every V9 JavaScript file;
- validates the unchanged 7,680-record universe and all retained V9.4 features;
- proves canonical REPD Ref news binding, focused recall/hostile-negative gates, the date-sort interaction and the retained responsive layout.

Browser validation:

```bash
cd uk_renewables_pipeline/v9.5
V9_BROWSER_SMOKE=1 bash tests/run_v9_5.sh
```

The read-only workflow `.github/workflows/v9-5-validate.yml` runs the same gate against exact committed bytes. `.github/workflows/deploy-pages.yml` deploys the exact SHA and then runs the same Playwright browser proof against `https://globalgrid2050.com/uk_renewables_pipeline/v9.5/`.
