# GlobalGrid2050 UK Renewables Pipeline V9.2

## Current release

V9.2 restores the proven V5 desktop and mobile interface contract while retaining V9.1's complete canonical Q2 REPD universe and new functions. The default page loads all 7,680 qualifying solar, battery, onshore-wind and offshore-wind records at 1 MW and above. User filters operate on that complete in-memory universe; they do not redefine or truncate the pipeline.

V9.2 is an interface and algorithm release. It does not rebuild or alter the V9.1 canonical data spine.

- V9.1 frozen checkpoint: commit `59f74e319fbaad62abdb995107dba5759d7f3ca2`, tree `e9dc244b74d9c983e4557a23bd2b745c1daeb105`.
- V9.0 frozen baseline: commit `50a6df6c4bd54ff4c113aaf0df4f230b7c9544d2`, tree `60b72b3665e6b65a397541b221c4bca75aa402c9`.
- Earlier V1–V8 integrity markers remain pinned by `contracts/legacy-integrity.v9.json`.

See `docs/releases/9.2.md`, `contracts/release.v9.2.json` and `contracts/release.v9.1.json`.

## V9.2 interface contract

The V5 stylesheet remains the visual shell. V9.2 deliberately removes the later runtime overrides that changed the agreed gauge and mobile behaviour:

- exactly three primary gauges;
- three gauge columns above the legacy 768 px mobile breakpoint;
- one gauge column at and below 768 px;
- the V5 header and mobile flow;
- an eight-column project table rather than the V9.1 13-column expansion;
- no forced 1,850 px table width.

V9 features are integrated inside the familiar table rather than forcing a new dashboard layout. REPD Ref, GlobalGrid project ID and official record-update date appear beneath the site name. Planning, lifecycle, relationship and geometry information is available through an expandable project record. Atlas, news and copy-ID actions remain available in the final column.

## Complete pipeline and filters

The canonical universe remains:

- 7,680 official REPD records;
- 356,474.09 MW record-based capacity;
- 4,100 MW largest single record;
- 3,563 solar records;
- 1,609 BESS records;
- 2,399 onshore-wind records;
- 109 offshore-wind records;
- 7,652 valid map geometries;
- 28 missing geometries retained in search and CSV.

With no URL parameters or button selections, all 7,680 records are displayed. Technology, status, county and search filters are optional user interactions. Search uses normalised multi-token AND matching across project name, operator, REPD Ref, GlobalGrid IDs, planning references, geography, status, dates and relationship references. Explicit filter state is reflected in shareable URL parameters; the default URL remains unfiltered.

## Filtered CSV contract

- The export contains the current filtered rows only.
- A zero-result filter produces the CSV header only.
- Filename: `globalgrid2050_uk_renewables_pipeline_v9_2_YYYY-MM-DD.csv`.
- UTF-8 BOM is retained for Excel compatibility.
- Canonical identity, official status/capacity, official update date, relationships, coordinates, provenance, legacy-news warning and Atlas URL are included.
- Spreadsheet-formula injection remains neutralised.

## REPD date and Atlas contracts

`repd_record_updated` remains an official REPD field. The table displays it as `dd/mm/yyyy`; CSV retains the canonical ISO date. Missing dates remain missing and are never replaced with the current date or a news date.

Valid geometries create exact Atlas V8 links containing the canonical REPD Ref, project name, technology, capacity, latitude, longitude and zoom. The Atlas bridge resolves exact identity before flying to the point and opening the popup. A record without geometry remains in the database, results and CSV but displays `NO MAP`; V9.2 never invents a coordinate or guessed identity.

## News discipline

The inherited V5 news feed remains explicitly legacy and unverified. V9.2 adds a deterministic relevance gate before a headline can appear as a project-row signal. The gate requires exact project-name and technology binding, then tests whether the headline contains sufficient project, operator, county or capacity evidence. Obvious generic-name and foreign-project false positives are rejected. A `RELEVANT` newspaper filter exposes the algorithmic shortlist, but no relevance score changes an official REPD fact or claims journalistic verification.

## Validation

Run:

```bash
bash uk_renewables_pipeline/v9/tests/run_v9_2.sh
```

The gate first runs V9.1 lineage/data validation, confirms the frozen V9.1 commit/tree, checks V9.2 JavaScript syntax, validates the unchanged 7,680-record canonical universe, proves the V5 interface contract, tests full-universe defaults, search/filter logic, zero-result CSV discipline, missing-geometry retention and the news relevance gate.

Browser smoke test:

```bash
cd uk_renewables_pipeline/v9
npm run validate:browser
```
