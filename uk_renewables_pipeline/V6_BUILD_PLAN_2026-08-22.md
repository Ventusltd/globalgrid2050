# UK Solar + Storage Daily V6 — frozen build plan

Date: 2026-08-22
Status: PASS 1 / BUILD PLAN FROZEN

## Non-negotiable lineage
V1, V2, V3, V4 and V5 remain untouched. V6 is a new standalone application generated from the complete V5 source and may only add functionality. No iframe replacement, no truncation, no removal of gauges, filters, county selector, site/operator search, REPD table, CSV export, newspaper, newspaper filters/search, mobile behaviour, REPD STATUS or NEWS SIGNAL.

## Authoritative source spine
The authoritative external source is Department for Energy Security and Net Zero (DESNZ) Renewable Energy Planning Database (REPD), discovered from the GOV.UK quarterly publication page.

Pinned Q2 2026 reconciliation sources:
- CSV: https://assets.publishing.service.gov.uk/media/6a6cbdc00c36759b5ccaa305/REPD_Publication_Q2_2026.csv
- XLSX: https://assets.publishing.service.gov.uk/media/6a6cbdd2862aaf18d9c62b02/REPD_Publication_Q2_2026.xlsx
- GOV.UK page: https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract

Known Q2 2026 raw source gates from the supplied official workbook:
- 14,657 rows
- 14,657 unique official Ref IDs
- 3,445 raw solar records >1 MW
- 269 raw BESS records >100 MW

These raw counts validate the source. They are not automatically the serving/newspaper count because the existing V1–V5 serving spine deliberately retains viable/geocoded records only.

## Canonical identity model
REPD Ref ID is the authoritative external record identifier. GlobalGrid2050 adds a stable internal identity above it:
- REPD-bound project: GG2050-REPD-<Ref ID>
- physical/development grouping: GG2050-DEV-<stable development anchor>
- genuine non-REPD project: GG2050-UK-<stable public-anchor hash>

GlobalGrid-only records must never fabricate an REPD reference. Old Ref ID, explicit REPD cross-references, planning reference, planning authority and co-location relationships are retained as lineage/context.

One physical development may contain multiple REPD records. A solar record and a co-located BESS record remain separate official records even when they share one GG development ID.

## REPD ingestion hardening
1. Discover the current official CSV/XLSX from GOV.UK; Q2 URLs are a known fallback only.
2. Canonicalise column headers before schema checks: trim and collapse repeated whitespace and resolve aliases. This must handle source fields such as `Planning Permission  Granted` without silently dropping dates.
3. Ref ID is mandatory and unique for retained REPD master records.
4. Record Last Updated is authoritative when supplied, but missing official dates are represented as null/blank with explicit provenance — never invented. Actual Q2 coverage is high but not 100%, so publication must not require a fictitious date.
5. Capacity remains an REPD field. Missing/invalid capacity is unknown, not evidence of zero capacity. Unknown-capacity rows are excluded from threshold selection but must not be silently treated as genuine 0 MW projects in identity logic.
6. REPD status is copied only from REPD. News can never modify it.
7. Manifest must identify the official CSV, XLSX, GOV.UK page, edition, page update date and master sync timestamp.

## V6 newspaper universe
Serving/newspaper eligibility is recomputed from the transformed REPD master while preserving V1–V5 viability/geocoding discipline:
- solar / solar_roof: capacity >1 MW
- BESS: capacity >100 MW

Thresholds are strictly exclusive. Exactly 1 MW solar and exactly 100 MW BESS are not included in the V6 newspaper universe.

## News discovery
Six-month maximum horizon. Crawler target remains <=170 seconds, with the overall job allowed setup/validation headroom.

Priority sources:
- GOV.UK / DESNZ
- Planning Inspectorate
- BBC
- Solar Power Portal
- Energy-Storage.News
- PV Magazine
- developer/operator releases may be discovered as secondary sources

Discovery should favour source-first/broad searches, with batched project-name searches as a completeness backstop. Never issue one query per project.

## Project/article matching
A story may be attached only to an actual canonical project record. Capacity is corroboration only and can never establish identity by itself.

Strong identity anchors, in descending order:
1. exact official planning application / NSIP reference
2. exact project name where that name is unique enough
3. project name + operator/applicant
4. project name + county/planning authority
5. project name + REPD capacity
6. operator + location + capacity only as corroboration, never as a name-free acceptance rule

Generic/duplicate site names require corroboration. Exact name alone is not sufficient when the REPD name is reused across multiple projects.

## Geography and technology gates
V6 is a UK REPD newspaper. Explicit foreign geography is rejected before scoring unless the phrase is genuinely part of the official UK project identity and the story is independently anchored to the UK record.

Solar stories require solar/PV context; BESS stories require battery/BESS/storage context. An exact official government/planning-reference match may override missing generic technology wording.

## Article/development relationships
Every article gets a stable GG2050-NEWS ID and exactly one PRIMARY_MATCH project record. PRIMARY_MATCH alone can drive the table NEWS SIGNAL.

Other records within the same GG development may be exposed as RELATED_DEVELOPMENT links for context. RELATED_DEVELOPMENT must never confirm or alter the sibling record's REPD status or NEWS SIGNAL.

## UI requirements
V6 must visibly expose:
- GlobalGrid Project ID
- REPD Ref ID
- REPD Record Last Updated, or `not supplied by REPD`
- REPD STATUS
- NEWS SIGNAL with `*` / not-REPD-confirmed discipline
- official REPD source/edition metadata
- headline publication date, source and confidence

The newspaper remains large, scrollable and filterable/searchable. The REPD analytics below it remain fully functional. CSV export must preserve GlobalGrid ID, REPD Ref ID, REPD update date, REPD status and separate news signal.

## Quality / quantity / structural gates
V6 fails closed if any of the following occur:
- V1–V5 files are altered by the V6 build
- V6 is missing closing HTML, full JS tail, responsive/mobile rules, gauges, filters, searches, table or CSV export
- V6 becomes materially smaller/truncated versus V5 or wrapper-sized versus V2
- V6 contains an iframe
- current official REPD source/manifest provenance is missing or inconsistent
- Q2 source is active but the raw 14,657-row / unique-ref / 3,445 solar >1 / 269 BESS >100 reconciliation fails
- transformed REPD master contains duplicate/missing Ref IDs
- GlobalGrid project IDs collide or cease to map deterministically to REPD refs
- development/co-location relationships point to inconsistent development IDs
- V6 project JSON does not exactly equal the eligible serving-master recomputation
- a headline lacks a PRIMARY_MATCH, valid REPD ref, canonical GlobalGrid ID, UK/technology identity, source, URL, publication date or confidence floor
- a RELATED_DEVELOPMENT link is allowed to drive NEWS SIGNAL
- a foreign-location false positive leaks through

REPD Record Last Updated coverage is monitored as a percentage and may not be forced to 100% when the official source itself is blank. For the serving project universe, target >=99% coverage; every blank must remain explicit rather than invented.

## Three-pass execution
PASS 1: this plan; inspect current implementation and freeze scope.
PASS 2: harden REPD ingestion, build V6 from V5, expose canonical GlobalGrid/REPD identity in UI/CSV, run the V6 crawler and identity enrichment through the production workflow.
PASS 3: audit the generated V6 and artifacts against this frozen plan, V1–V5, official Q2 source quantities, GlobalGrid identity integrity and known false-positive classes. Merge/publish only if the gates pass; otherwise fail closed with a diagnostic and do not promote V6.
