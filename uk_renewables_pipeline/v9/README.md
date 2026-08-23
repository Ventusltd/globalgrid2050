# GlobalGrid2050 UK Solar + Storage Daily V9

## Current release

V9.0 is an interim, wholesale copy of the validated V8.1 product with three bounded additions:

1. Export the current filtered project rows as UTF-8 CSV.
2. Display the official REPD `Record Last Updated` date.
3. Open Atlas V8 from each project using canonical identity and coordinates.

Public path: `/uk_renewables_pipeline/v9/`
V8 fallback: `/uk_renewables_pipeline/v8/`

The canonical universe remains unchanged: 766 REPD records across 718 developments, comprising 384 solar records above 49 MWp and 382 BESS records above 99 MW. Wind remains excluded. The inherited 125-story V5 newspaper remains explicitly legacy/unverified.

## Permanent engineering memory

Conversational AI memory is not a dependable engineering record. V9 therefore records prior work as immutable Git evidence.

`contracts/legacy-integrity.v9.json` pins:

- V1–V6 by exact Git blob and SHA-256.
- V7 and V8 by exact Git tree.
- The baseline commit from which V9 was created.

The V9 validation gate must fail if any pinned V1–V8 object changes. These historical versions are read-only integrity markers and rollback references. This is how V9 permanently preserves what happened before it, independently of a new chat, context truncation or model replacement.

## Filtered CSV contract

- The export contains the current filtered rows only.
- No matching projects produces a header-only CSV.
- Filename: `globalgrid2050_uk_renewables_pipeline_v9_0_YYYY-MM-DD.csv`.
- UTF-8 BOM is retained for Excel compatibility.
- Canonical identity, official status/capacity, official REPD update date, relationships, coordinates, provenance, legacy-news warning and Atlas URL are included.
- Spreadsheet-formula injection remains neutralised.

The export button is present in the project-filter area so it remains accessible on mobile when the sidebar is hidden.

## REPD date contract

`repd_record_updated` is an official REPD field. The table displays it as `dd/mm/yyyy`; the CSV retains the canonical ISO date. Missing dates display `not supplied by REPD`. V9 must never replace a missing date with the current date or a news date.

## Atlas link: exact canonical focus

Each project link opens:

`https://globalgrid2050.com/repd_grid_atlasv8/`

V9 supplies `repd_ref`, project name, technology, capacity, latitude, longitude and zoom as URL parameters. Atlas V8 resolves the REPD Ref against V9's canonical same-origin GeoJSON, displays a highlighted point, activates the relevant technology layer, flies to the exact coordinate and opens the existing project popup. The REPD Ref is the identity anchor; names and coordinates are display and fallback context only.

The Atlas change is a backward-compatible deep-link bridge: visits without a `repd_ref` behave as before. It does not infer grid connection from proximity and does not fuzzy-match project identity.

## North Star

- Official REPD facts remain separate from news, grid and market assertions.
- Solar MWp and BESS MW are never combined.
- No wind.
- Same-origin validated project data; no browser-side government download.
- One canonical REPD Ref and GlobalGrid project ID per displayed record.
- Missing official values remain missing.
- Atlas proximity or coordinates never prove a grid connection.
- V1–V8 remain immutable.

## Validation

Run:

```bash
bash uk_renewables_pipeline/v9/tests/run_v9_0.sh
```

The gate validates V8.1 first, verifies every legacy integrity marker, validates the 766-record canonical spine, checks the 13-column table, tests official dates and Atlas URLs, and proves filtered and zero-result CSV behaviour.
