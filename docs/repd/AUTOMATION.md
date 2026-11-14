# REPD release automation: design

What the quarterly REPD automation does, why it is shaped the way it is, what it leaves to people, and what the source files are
known to get wrong. The step-by-step procedure, gates, protected paths and rollback are in [RUNBOOK.md](RUNBOOK.md).

Each rule names the file and line it comes from. "Note NN" refers to the estate survey of 13 November 2026 that this design was
built from; its findings are restated here with the repository file and line they rest on. Paths without a repository prefix are in
`Ventusltd/globalgrid2050`.

## 1. Architecture

### 1.1 What a new quarter produces

A new REPD quarter is **additive**. It adds files under new names and one new Pipeline News release folder. It changes no existing data
file, release folder, fixture or restore point (`AGENTS.md:9`; `uk_renewables_pipeline/202609082224/fixtures/README.md:3,10`).
The existing files are pinned by hash in later releases, in gates and in other repositories (RUNBOOK.md section 2). Overwriting any of
them breaks those pins and silently changes what historical pages display.

```
GOV.UK publication page
        |  detect.py            descriptor: automation/repd/releases/<id>.json
        v
raw CSV + XLSX  (bytes, sha256)  fetch.py     -> --out/raw/          never committed
        |
        v  clean.py            canonical CSV + cleaning log + date provenance
        v  validate.py         gates G2-G7 (RUNBOOK.md section 4)
        v  diff.py             change report against the previous release (md + json)
        |
        +--> build_root.py     repd-<id>.csv and three subsets (+ optional dist/repd_master_<id>.json)
        +--> build_v6.py       dist/project_identity_<id>.json, dist/major_projects_<id>.json, manifest, reconciliation
        +--> build_news.py     uk_renewables_pipeline/<stamp>/  (copy of the parent, new fixtures, new spine)
        |
        v  run.py              no-truncation manifest check (G9), size check (G10), report
        v
draft pull request in globalgrid2050 (owner merges)

separately, by their own release processes:
  gridatlas repository           new compiled registry + re-cut cartridges + generation  (gridatlas:docs/RELEASE.md)
  globalgrid2050-homepage        operative_release_id for pipeline-news                  (AGENTS.md:15-18)
```

### 1.2 Where the code lives

| Path | Role |
|---|---|
| `automation/repd/config.py` | Release descriptor schema, load and validation |
| `automation/repd/detect.py`, `fetch.py` | Find the release, download, hash. Fetcher is injectable so tests run on local bytes |
| `automation/repd/clean.py`, `validate.py`, `diff.py` | Canonical CSV, gates, change report |
| `automation/repd/build_root.py`, `build_v6.py`, `build_news.py` | Candidates under new names. All output goes to `--out` |
| `automation/repd/run.py` | Orchestrator: detect, fetch, clean, validate, diff, build, report |
| `.github/workflows/repd-release-candidate.yml` | `workflow_dispatch` only. Runs `run.py` and opens or updates a draft PR. Never pushes `main`, never deploys |
| `docs/repd/RUNBOOK.md`, `docs/repd/AUTOMATION.md` | This documentation |

Reuse before rewrite. The automation calls the existing logic where it exists: `reconcile()` (`scripts/repd_sources_v6.py:255`),
`build_registry()` and `build_public_snapshot()` (`scripts/build_project_identity_v6.py:268,453`), `build_coordinate_fixture()`
(`uk_renewables_pipeline/202609082224/scripts/data/build_v7_2_spine.py:148-189`) and the V9.1 spine builder (`build_v9_1_spine.py`), with their
hard-coded July values replaced by descriptor values and their output paths redirected. The existing scripts themselves are not edited:
`scripts/major_project_news_v6.py` and `scripts/build_news_feed_v9_5_1.py` are in the V9.5.1 workflow's paths, so an edit re-runs a byte
gate (`.github/workflows/v9-5-1-validate.yml:7-16`).

### 1.3 Why it stops at a draft pull request

- "Do not reactivate old monolith schedules" (`AGENTS.md:7`). Every existing REPD workflow is `workflow_dispatch` only
  (`.github/workflows/repd_sync.yml:2-3`; `major_project_news_v6.yml:9-10`). The V4-V6 builders were "Retired from automatic execution on
  2026-08-23" (`major_project_news_v6.yml:3-4`).
- The old V6 workflow committed to `main` as a bot (`major_project_news_v6.yml:101-125`) and rewrote the generated `index.html`
  (`scripts/promote_renewables_v6_homepage.py:8-33`). Both now break repository rules (`AGENTS.md:21-24`).
- Promotion needs owner validation and browser checks (`AGENTS.md:35-37`). Agents never record acceptance and only the owner merges
  (`gridatlas:docs/RELEASE.md:49-55`). No automatic agent scheduling, push, merge or release is installed by the agent protocol
  (`neural-link-between-agents:PROTOCOL.md:47`).
- `main` has no branch protection and no required checks (note 04 section 1). The draft PR is therefore the only review gate.

## 2. The release descriptor

One JSON file per publication, `automation/repd/releases/<release_id>.json`, schema `globalgrid2050.repd-release-descriptor.v1`
(`automation/repd/config.py`). It replaces the July values hard-coded at `scripts/repd_sources_v6.py:31-40` and copied into
`scripts/validate_project_identity_v6.py:19-21`, `scripts/validate_renewables_v6_scope.py:35-40`, `scripts/major_project_news_v6.py:33-35`
and `scripts/repd_updater.py:24-25` (note 01 section 4).

| Field | Meaning | October 2026 |
|---|---|---|
| `release_id` | `<year>q<quarter>`, also the file-name suffix | `2026q3` |
| `label` | Release month as GOV.UK names it | `October 2026` |
| `quarter` | Data quarter. January = Q4 of the previous year, April = Q1, July = Q2, October = Q3 | `Q3 2026` |
| `csv_url`, `xlsx_url` | Attachment URLs from the publication page | `.../6af42ff0a4004bdbe54e54a5/REPD_Publication_Q3_2026.csv`, `.../6af42ffdb83b3cae0d0a21c9/REPD_Publication_Q3_2026.xlsx` (`scripts/repd_q3_2026_ingest.py:25-26`) |
| `page_last_updated`, `govuk_public_updated_at` | Dates from the page and content API | `2026-11-13` (`docs/repd/2026-10-q3-ingestion.md:5`) |
| `dataset_title` | Exact GOV.UK title | UNVERIFIED from the sandbox |
| `previous_release_id`, `baseline_path` | The release to diff against and the file that represents it | `2026q2`; the July originals on `repd/2026-07-verified-archive-20261113` (RUNBOOK.md step 5) |
| `expected.csv_sha256`, `xlsx_sha256`, `csv_bytes`, `xlsx_bytes` | Filled from the first verified download, then pinned | `48e76c49...a5ff862`, `87811e24...5037ea`, 5,219,160, 5,378,656 (`docs/repd/2026-10-q3-ingestion.md:29-30`) |
| `expected.csv_rows`, `unique_refs`, `duplicate_refs` | Source shape | 14,968, 14,967, `["7679"]` (`docs/repd/2026-10-q3-ingestion.md:31`) |
| `expected.solar_gt_1mw`, `bess_gt_100mw` | V6 population counts. Measured on the first run and reviewed, never typed in advance | left empty until reviewed |
| `provenance` | Who observed each value, when, from where | |

Rules:

1. **Counts are measured, then reviewed, then pinned.** A count is never typed in from a previous quarter. This is the stated design intent
   (`uk_renewables_pipeline/v7/docs/07-workflows.md:5`). The V9.1 spine builder already works this way: the first run fails and prints the
   actual totals, which a person reviews and pastes into the contract (note 11 section 6, step 5).
2. **Every descriptor's pinned hashes form a registry.** Bytes that hash to a known release are labelled as that release, whatever URL they
   came from (section 5.5).
3. **One source of truth.** Validators read counts from the descriptor or the release manifest, not from their own copies. Four copies of
   the same three July numbers made every V6 stage fail separately (note 01 section 8).

## 3. Automated versus manual

| Step | Automated | Manual | Why |
|---|---|---|---|
| Detect | Reads page and content API, drafts descriptor | Confirm the publication is real and final | GOV.UK replaces attachments and caches pages; one agent saw July as current while CI downloaded October the same evening (`neural-link-between-agents:FIXES/NL-012/LOG.md:17-19,41`). The only earlier detector, Content API plus per-row sha256 keyed by Ref ID, is archived and inert (`pipelinenews:archive/202608261547-pipelinenews/tooling/check-repd-source-v2.mjs`; note 28) |
| Fetch and hash | Download with no redirect, record bytes and sha256 | Supply bytes by hand where gov.uk is blocked | Some sandboxes cannot reach gov.uk (`LOG.md:16-17`) |
| Clean | All rules in section 5, every change counted | Owner accepts the cleaning decisions | Corrections to official data are decisions, not facts (`docs/repd/2026-10-q3-ingestion.md:43,45`) |
| Validate | Gates G2-G7 | none | Mechanical |
| Diff | Markdown and JSON report | A person reads it | "staged and diffed rather than accepted through hard-coded counts" (`v7/docs/07-workflows.md:5`) |
| Root datasets | Built under new names | Whether to repoint the root pages | Repointing changes live pages (note 16 section 6) |
| V6 candidates | Built under new names | Allowlist line for the 20 MB identity file | Size guard (`.github/workflows/pr-file-size-guard.yml:25`; `.github/large-files-allowlist.txt:4-5`) |
| Pipeline News folder | Copy, fixtures, contract paths and hashes, spine build into the new folder, byte-diff runner | `expected` totals; page text; browser check; parent choice | Acceptance numbers are deliberate (note 11 section 7); browser proof is required (`AGENTS.md:35`) |
| GridAtlas | none in this repository | All of it, in the gridatlas repository | Its own release flow, owner `ACCEPT`, workflow budget (`gridatlas:docs/RELEASE.md:36-58`) |
| Homepage | none | All of it, in the homepage repository | Owner repository and pinned bundle (`AGENTS.md:15-24`) |
| Merge, deploy, promote | never | Owner | Section 1.3 |

## 4. No truncation of previous work

Every component writes only to `--out` and is checked twice:

1. **Before and after hashes of what it must not change.** Each module takes the sha256 of every input and protected path before it runs
   and again after, and fails if any differs.
2. **Additive diff of the candidate branch.** `git diff --name-status --diff-filter=MDRT <base> HEAD` prints nothing except the two approved
   appends (`.github/large-files-allowlist.txt`, `.github/workflows/deploy-pages.yml`). Every line of `git ls-tree -r --full-tree <base>` must
   still be present in `HEAD` (RUNBOOK.md Gate G9).

A blob-level manifest is used, not line counts. Line counts differ from record counts in REPD (15,182 lines, 13,995 records in `repd.csv`;
note 16 section 2), so a `wc -l` check passes or fails for the wrong reason.

Gates must check what was written, not something nearby. `uk_renewables_pipeline/v9.5.1/tests/run_v9_5_1.sh:14` diffs its own `data/v9.1`,
which the builder never writes, because the builder writes to `uk_renewables_pipeline/v9` (`build_v9_1_spine.py:11-14`). That gate cannot fail
(note 07 section 8).

## 5. Known quirks of the REPD source files

Each quirk was seen in the October 2026 files unless marked otherwise. The cleaner handles each one and counts it.

### 5.1 Encoding and header text

- The official CSV is cp1252, not UTF-8 (`neural-link-between-agents:FIXES/NL-012/review-b967360d/REVIEW.md:54-56`). The existing reader tries
  `utf-8-sig`, then cp1252 (`scripts/repd_sources_v6.py:163`).
- Mixed line endings occur; pandas and `csv` agree cell for cell (`REVIEW.md:54-55`).
- The October header has `Planning Permission  Granted` (two spaces) and `Are they re-applying (Old REPD Ref) ` (trailing space). The existing
  reader normalises header whitespace (`scripts/repd_sources_v6.py:113-141`). A consumer matching the raw header text misses these columns.
- Browser pages fetch CSVs with no encoding option, so cp1252 bytes appear as U+FFFD; the January root subsets are double-encoded UTF-8
  (mojibake) (note 16 sections 3, 8). Write new root CSVs as UTF-8 without a BOM.

### 5.2 Month-first date cells

- 25 cells of `Planning Application Submitted` (refs 21419 to 21478) are true Excel dates with the custom number format `m/d/yyyy`. The CSV
  writes them month-first (`9/14/2026`). 24 change text when read correctly; ref 21435 (`09/09/2026`) reads the same either way
  (`REVIEW.md:20-22,101-103`; `neural-link-between-agents:FIXES/NL-012/LOG.md:81-83`).
- Five are valid but wrong when read day-first: 21424, 21438, 21456 (`09/11/2026`, meaning 11 September) and 21463, 21464 (`09/10/2026`,
  meaning 10 September) (`REVIEW.md:21-22`).
- The old parser accepts month-first text as a silent last resort (`scripts/repd_sources_v6.py:88`; `REVIEW.md:51`, L9).
- Almost every other date cell uses built-in format 14, which openpyxl reports as `mm-dd-yy` but which is the locale short date. It must not be
  read as month-first. Only the custom code unlocks the month-first reading (`REVIEW.md:85-88`).
- Rule: a typed Excel date wins; the CSV must agree with it under an allowed reading; anything else fails (`REVIEW.md:73-83`). The rule finds
  the 25 cells without being told any ref, column or count, and discovers 16 date columns, not 8 (`REVIEW.md:12-14,103`).
- pandas discards the number format, which is the evidence the rule needs; read the workbook with openpyxl for dates (`REVIEW.md:70-71`).

### 5.3 Duplicate rows

- Ref 7679 appears twice, identical in every cell, on source rows 7112 and 7113 (`docs/repd/2026-10-q3-ingestion.md:31`).
- It stops every existing consumer: `scripts/repd_sources_v6.py:193-196` raises on any duplicate Ref ID; the GridAtlas compiler raises on a
  duplicate (`gridatlas:compiler/202608290716-compile-atlas-v9.py:99-101`); the old rows-equals-unique-refs gate rejects 14,968 rows against
  14,967 refs (`scripts/repd_sources_v6.py:270-273`).
- Rule: an exact duplicate is kept once and reported; a conflicting duplicate fails (`REVIEW.md:58-59`). "Exactly identical" means identical
  before whitespace normalisation (`REVIEW.md:49`, L7).
- A file with a duplicate cannot serve as the next quarter's baseline unless it is de-duplicated first (`REVIEW.md:40`, M5).

### 5.4 `NA` text and blank-equivalents

- 16 `Operational` cells hold the text `NA` (`neural-link-between-agents:FIXES/NL-012/LOG.md:84`). Whitespace-only cells also occur in
  Operational, Judicial Review, Planning Permission Refused and Secretary of State - Refusal (`REVIEW.md:120-121`).
- `NA` in `Storage Co-location REPD Ref ID` is harmless to the identity builder, which extracts digits only (`scripts/build_project_identity_v6.py:79-86`).
- pandas reads Excel `NA` as missing by default; refs 9873 and 11989 have a real planning reference of `NA` in both files and were blanked in
  the staged candidate (`REVIEW.md:36`, M1).
- Rule: `NA`, `N/A` and whitespace become blank and are counted per column and token; Excel and CSV must agree (`REVIEW.md:79`).

### 5.5 Replaced-attachment redirects

- GOV.UK can replace an attachment; "a request to the original path redirects to the replacement"
  (https://docs.publishing.service.gov.uk/manual/assets.html). A replaced asset redirects to the latest in its chain
  (https://docs.publishing.service.gov.uk/repos/asset-manager/asset_state_machine_overview.html).
- On 13 November 2026 the July 2026 URLs returned bytes identical to the October files (`neural-link-between-agents:FIXES/NL-012/LOG.md:51-54`;
  `docs/repd/2026-10-q3-ingestion.md:34`). The redirect is a 301 and Python's urllib follows it silently (`neural-link-between-agents` issue 12,
  comments 6865653147 and 6867742985; note 37 section 6).
- The July originals were later recovered from UK Government Web Archive captures of 3 November 2026 and put on the evidence branch
  `repd/2026-07-verified-archive-20261113` (`evidence/repd-2026-q2-original/SOURCES.txt`; both hashes match `scripts/repd_sources_v6.py:39-40`).
  GOV.UK keeps only the latest release on the page, so this is the only route to a superseded quarter.
- The branch script downloads the old URLs and saves the result as `REPD_Publication_Q2_2026.*` even when the hash does not match
  (`REVIEW.md:47`, L5).
- Rule: fetch with no redirect following (`curl --max-redirs 0`); label bytes by hash against the descriptor registry, never by URL; keep the
  observed status, `Location` and hash in provenance; put each quarter's verified originals on an immutable evidence branch the same day.

### 5.6 Numbers stored as dates

- `Offshore Wind Round` has 55 cells whose Excel value is a round number (1, 2, 3, and 2.5 in four cells) stored with a date format. The CSV
  prints them as `01/01/1900`, `02/01/1900`, `03/01/1900` (refs 2470-2546, 14144, 20218; the 2.5 cells are 2504, 2526, 2533, 2539)
  (`REVIEW.md:114-118`).
- Rule: the date rule reports them and does not alter them. What the candidate should say is an owner decision.
- A column counts as a date column only if every non-blank Excel cell is a true date on or after 1 March 1900 (`REVIEW.md:75-76`), which keeps
  this column out.

### 5.7 Coordinates

- **Stray whitespace.** The raw October CSV has a tab, non-breaking space or line break in a coordinate cell for 111 records: 141 tab-prefixed
  cells (59 X, 82 Y), 9 non-breaking spaces, 8 line breaks; the same tab count as January (measured on the raw file, 13 Nov 2026). Python
  `float()` accepts a leading tab, so a gate based on parsing does not see it; JavaScript `parseFloat` also skips it. Strip and count.
- **Lost leading zeros.** The CSV lost a leading zero in X/Y for refs 9713, 11443, 11444, 11925, 21169, and in the planning reference of ref
  11250 (`REVIEW.md:38,58`). Take these columns from Excel.
- **Wrong points.** Refs 18561 and 18562 (Salters Lane, Sunderland) are plotted at 492983, 188837, in southern England; their sister refs 18563 and
  18564 were corrected this quarter (measured 13 Nov 2026). Flag; do not move. The data is the publisher's.
- **Blank coordinates.** 36 records have both X and Y blank; none was located before. The GridAtlas compiler turns blank into 0, 0
  (`gridatlas:compiler/202608290716-compile-atlas-v9.py:103-104`), a placeholder the receiver refuses to fly to. Blank must stay blank.
- **Bounds.** The GridAtlas compiler drops points outside longitude -9 to 2.5 (`compiler/...:108-109`); three Norfolk offshore refs sit east of it.
  The spine builder rejects easting outside 0-800 km or northing outside 0-1,400 km (`build_v7_2_spine.py:123-134`).
- **Northern Ireland** coordinates are given in British National Grid, not Irish Grid (measured on all 540 located NI records, 13 Nov 2026).
- Rule: both blank or both numeric; no whitespace left; out-of-region points listed for review.

### 5.8 Other text normalisation

- Whitespace is rewritten in every column by the existing reader (non-breaking space and tab to space, line breaks joined, runs collapsed,
  edges trimmed). The policy is defensible; the defect was not counting it (`REVIEW.md:39`, M4).
- The CSV rounds Turbine Capacity and Solar Site Area, and has `?` where Excel has a zero-width joiner in one address (`REVIEW.md:38`, M3).
  Compare every column, not 15 of 53.

### 5.9 Capacity precision and thresholds

- The CSV rounds capacity to 2 decimals; Excel holds full precision. July solar above 1 MW was 3,443 from the CSV and 3,445 from Excel, because
  refs 14452 (1.00035 MW) and 16093 (1.00204 MW) sit on the line (`uk_renewables_pipeline/V6_BUILD_PLAN_2026-08-22.md:18-23`). Excel precision is
  canonical (`scripts/repd_sources_v6.py:238-243`); CSV must agree within 0.0050001 MW (`:41`).
- Thresholds differ by product and are not interchangeable: V6 solar > 1 and battery > 100 MW, exclusive (`build_project_identity_v6.py:458-461`);
  the V9.1 spine >= 1.0 MW, inclusive, four technologies (`build_v9_1_spine.py:16-21,39-45`); V5 solar > 49 (`major_project_news_v5.py:13`);
  V7.2 solar > 49 and battery > 99 (`v7/contracts/project-spine.v7.2.json:23-25`).
- Blank capacity is unknown. The browser pages treat it as 0 MW (`parseFloat(...) || 0`, note 16 section 3); new files must not.

### 5.10 Dates in the future, chronology

- Some event dates are later than the publication date (ref 20029 Planning Permission Granted 15/12/2026; ref 20820 Planning Application
  Submitted 27/11/2026) and are the same in both files (`LOG.md:84`; `REVIEW.md:107-109`). Keep and flag.
- "Dated after Record Last Updated" is common and is not an invariant: 108 ordinary Planning Application Submitted dates this quarter
  (`REVIEW.md:45`, L3). Record it; do not gate on it.

### 5.11 Vocabulary

- One new status this quarter, `No Application Made` (ref 14992). The V6 lifecycle classifier matches the word "application" and labels it
  live pre-construction (`scripts/build_project_identity_v6.py:57-67`). Pipeline News status filters do not list it
  (`uk_renewables_pipeline/202609082224/scripts/plugins/projects-v9-8.js:49`). List new values for review.
- Technology names are matched exactly by the spine (`build_v9_1_spine.py:16-21`) and the integration build raises on an unmapped one
  (`pipelinenews-gridatlas-20260906:build.py:66-73`).
- Status text has trailing-space and case variants (`Operational `, `Planning permission granted`); exact-match filters miss them (note 16 section 8).

## 6. Where REPD data is consumed

A new quarter changes nothing below unless a row says so. "Live read" means a page fetches the file when it runs.

### 6.1 globalgrid2050: root files and pages

| Data | Read by | How | Pinned by | New quarter |
|---|---|---|---|---|
| `repd.csv` (January 2026, 13,995 records) | 7 root Jekyll pages and 3 grid-model pages (`repd-atlas.md:87`, `uk_offshore_wind_atlas.md:88`, `uk_onshore_wind_atlas.md:87`, `uk_solar_in-planning-1-50mw.md:126`, `repd_atlas_grid_model*.md`) | live read, PapaParse | `gridatlas:atlas/coordinate-systems.json:11-25`; `gridatlas:.github/workflows/offshore-coordinate-reconcile.yml:20,53-71` (yearly cron, 14 February, checks out globalgrid2050 main and reads it); `pipelinenews-gridatlas-20260906:sources.json:4`; `scripts/repd_q3_staging_verify.py:17` | keep; add `repd-<id>.csv` |
| `repd-grid-batteries.csv`, `repd-solar-operational.csv`, `repd-solar-operational-over-4mw.csv` | `uk_grid-batteries.md:58`, `repd-uk-operational-solar.md:87`, `uk_operating_large_solar_farms.md:87`, `repd_grid_atlasv4/index.html:4750-4752` | live read | `scripts/repd_q3_staging_verify.py:18-20` | keep; add `-<id>` versions |
| `dist/repd_master.json` (Q1 2026, 10,784 features, no Ref IDs) | atlas v3-v8 (`repd_grid_atlasv*/index.html`), dashboards V1, V3, V4, V5 (`uk_renewables_pipeline/dashboard.html:747`, `dashboard_v5_live.html:65`), V7 page (`v7/scripts/core/state.js:22-24`), GIS-SLD apps (`scripts/add_v7_gis_sld_large_asset_markers_and_search.py:72`), GridAtlas drawn-dot oracle (`gridatlas:atlas/cartridges/202609241251-streaming-parquet-bridge-v9-5.js:5-7`) | live read | `major_project_news_v6.yml:80-91`; `north-star.v1.json:84-89`; 18 fixture copies; `v7-north-star.yml` push trigger | keep. Overwriting it changes every page in this row at once |
| `dist/manifest_v4.json` | `scripts/repd_updater.py:165-182` | idempotency check | `major_project_news_v6.yml:80-91` | keep |

### 6.2 globalgrid2050: V6 and news outputs

| Data | Read by | Pinned by | New quarter |
|---|---|---|---|
| `dist/project_identity_v6.json` (July, 14,657 records) | spine builders through fixture copies in 18 release folders; enrich and validate scripts | `contracts/release.v9.1.json:13` in every release; `v7-north-star.yml:10-13` push trigger | keep; add `dist/project_identity_<id>.json` |
| `dist/major_projects_v6.json` (3,714 projects) | `dashboard_v6_live.html:27-28` (live read, fails closed on any other counts, `:30,:79`); V6 news crawler; `build_news_feed_v9_5_1.py` | `north-star.v1.json:108-109` | keep; add `dist/major_projects_<id>.json` |
| `dist/major_project_news_v9_5_1.json` | operative `202609082224` and `202610290230` (`scripts/plugins/newspaper-v9-5-1.js:5-6`, live read, Pages then raw GitHub `main`), and v9.5.1 to v9.7 pages | `v9.5.1/tests/run_v9_5_1.sh:16-17`; `v9.7/tests/check_v9_7.mjs:58`; `testcode/*/pipeline/data/v9.7/regional_manifest.json:112` (`input_sha256`) | keep. Rebuilding it changes every page that reads it |
| `dist/major_project_news_v5.json` | v7, v8, v9 pages (`v8/scripts/core/state.js:21-22`), `build_news_feed_v9_5_1.py:21-23` | `north-star.v1.json:84-89` | keep |
| `dist/major_project_news_v6.json`, `project_news_links_v6.json` | `build_news_feed_v9_5_1.py`, `dashboard_v6_live.html` | V9.5.1 byte gate | keep |

### 6.3 globalgrid2050: release folders

| Folder | REPD content | Pinned by | New quarter |
|---|---|---|---|
| `uk_renewables_pipeline/202609082224` (operative V9.10) | July spine, 7,680 records at >= 1 MW, `data/v9.1/` (16 parts), contracts | tree `6247a0c3...`; `202610290230/tests/run_v9_11.sh:11`; homepage pointer (`homepage-shell/data/homepage.json:171`) | copy to a new folder; never edit |
| `uk_renewables_pipeline/202610290230` (unaccepted V9.11) | identical data | immutable by `AGENTS.md:9` | possible parent if accepted |
| `uk_renewables_pipeline/v7` ... `v9.7`, dated folders `202609051156` ... `202609081016` | July fixtures and spines, 18-19 copies of each fixture | tree pins in later runners and `legacy-integrity.v9.json` (notes 06-10) | never edit |
| `pipelinenews_intelligence/*` (34 releases) | July spine partitions, precomputed grid proximity | `immutable_after_publication`; 3,563 deep links from `testcode/202609150502/data/uk-solar.json` (note 12) | never edit |
| `testcode/*` | 22 identity shards per Atlas candidate, 7,680 refs; oracle `202609051531` | publication manifests; `scripts/oracle/oracle.json:3-9` | never edit; `testcode-proof.yml` comments on issue 37 for any push there (note 19 section 7) |
| `repd_grid_atlasv3` ... `v8` | none of their own; read `dist/repd_master.json` | historical | never edit |

### 6.4 Other repositories

| Repository | What it holds | New quarter |
|---|---|---|
| `Ventusltd/gridatlas` | Search lane: Parquet compiled from the July CSV, 11,069 active rows, closure counts pinned in three cartridges (`atlas/cartridges/202609071213-place-global-search-v9-5.js:14-17,132-141`; `atlas/modules/202610291043-uk-lightning-overlay.js:216,221`; `atlas/modules/202610312138-uk-offtakers-overlay.js:128,133`). Compiler pins the July CSV and reads cp1252 (`compiler/202608290716-compile-atlas-v9.py:16-18,90,199-200`). No active workflow ingests REPD (note 36 section 1). Yearly cron `offshore-coordinate-reconcile.yml` reads `globalgrid2050/repd.csv`. Nearest substation is computed at arrival, not stored per ref | new dated compiler, re-cut cartridges, hand-assembled generation, owner `ACCEPT` (RUNBOOK.md step 9) |
| `data-gridatlas` | Drawn-dot Parquet partition built from `dist/repd_master.json` (`streaming-parquet-bridge-v9-5.js:90,108-112`) | separate owner decision; not on this machine |
| `Ventusltd/pipelinenews` | Its own Pages app; live release `202609040144-pipelinenews` (`releases/current-v4.json`, byte-identical to `state/live-set.json`). Generation `202608261927` names (`tools/intelligence/common.py:21-23,29`), compilers asserting 7,680 and 16/18 partitions (`index/202609010836-compile-index.mjs:174-175,189,322`), precomputed grid proximity and distance keyed by ref. `release_builder.py` only adds cartridges on a parent's spine; there is no REPD refresh path, and its default parent is the newest folder, not the live one (notes 26, 30) | a spine-replacing cartridge or a new root release, built with the live release named explicitly as parent; deployment owner-triggered (`DEPLOYMENT_POLICY.md:5,21`) |
| `pipelinenews-gridatlas-20260906` | Integration candidate reading `globalgrid2050/repd.csv` at a pinned commit; tests pin 13,995 rows (`tests/corpus.mjs:5`) | only if that candidate is to follow the new quarter |
| `Ventusltd/globalgrid2050-homepage` | URLs only: `pipeline-news` `operative_release_id` | only when the new release folder replaces the operative one (RUNBOOK.md step 10) |
| `ventus-grid-engine` | Deep-link receivers contract used by the MAP link (`202609082224/scripts/core/atlas-receiver-v9-7.js:51`) | none |

### 6.5 Publication

- `deploy-pages.yml` publishes the whole tree. It runs on a push to `main` only if a path matches its allow-list (`.github/workflows/deploy-pages.yml:11-130`).
  `uk_renewables_pipeline/**` and `pipelinenews_intelligence/**` are on it (`:71-72`); root CSVs and `.md` pages and new `dist/*.json` names are not.
- Pushes made with `GITHUB_TOKEN` start no push workflow, so a bot commit does not deploy (`deploy-pages.yml:5-6`).
- The post-deploy browser proof checks V9.7 and the wiring pages, not the operative Pipeline News page (note 04 section 4).
- `scripts/build_homepage_catalogue.py:214-218` picks the newest servable stamped folder as current, with no override. Do not run it in a data release.

## 7. Lessons from the October 2026 release

1. **Old URLs serve new bytes.** The July links returned October files. Every claim about "the July bytes" from those URLs was really about October
   (`LOG.md:51-54`). Label by hash; fetch without following redirects. The July originals had to be dug out of the Web Archive; put every
   quarter's originals on an evidence branch the day they are verified.
2. **Hard-coded counts reject every new quarter.** Every stage of the old chain refused October because of a July count or hash in its own copy
   (note 01 section 4). Counts belong in the descriptor, measured and reviewed.
3. **A general rule beats an allow-list.** The branch script fixed the 25 month-first cells by listing their refs; it would reject any other
   quarter and missed half the date columns. The general rule found the same 25 cells with no hints and gives a byte-identical candidate
   (`REVIEW.md:9-17,34-35`).
4. **One identical duplicate row stops everything.** Decide duplicate policy in the cleaner, once, and give every consumer the de-duplicated file.
5. **Builders write to fixed historical paths.** The V9.1 spine builder in every release copy writes into `uk_renewables_pipeline/v9`
   (`build_v9_1_spine.py:11-14`); the V7.2 builder defaults to `v7` (`build_v7_2_spine.py:15-16,194`). Always redirect, then prove nothing outside
   `--out` changed.
6. **Some scripts write before they check.** `build_project_identity_v6.py:567` writes the identity file into `dist/` before the snapshot count check.
   Run existing scripts only in scratch worktrees.
7. **Say what the baseline is.** A comparison against January `repd.csv` was at first reported as a July comparison (`LOG.md:38-43`). A local run
   with a stub fetcher produced a "July bytes changed" line that described the stub, not GOV.UK. Every diff report names its baseline file and hash.
8. **Records, not lines.** REPD has line breaks inside quoted fields. Count records with a CSV reader.
9. **Read Excel twice if needed.** pandas loses number formats and turns `NA` into missing; openpyxl keeps both (`REVIEW.md:70-71,36`).
10. **Size limits bite.** The guard is 5 MiB for added or modified files (`pr-file-size-guard.yml:25,50`). The October root CSV is about 50 KB under
    it; a full identity file is about 20 MB and a v6-schema `repd_master` about 7 MB. Plan allowlist lines or release assets before the PR.
11. **Merging is not deploying.** Root and new `dist/` paths are not on the deploy allow-list, and bot pushes do not deploy (section 6.5).
12. **Some checks never finish.** The public-language gate needs a self-hosted runner and is always cancelled; nothing waits on it (note 04 section 7).
13. **Authority comes from the owner, not from another agent.** An agent-relayed "GO" was not acted on (`LOG.md:72-74`). Decisions go on the link
    (`neural-link-between-agents:LINK-RULE.md:7-12`).
14. **Full history is needed.** Release runners pin trees and commits; shallow clones fail them (notes 06, 08).
15. **Development IDs are not stable between releases.** `gg_development_id` changed for some retained records October against July. Join on Ref ID.
16. **A green job is not proof of work.** The evidence-publish job once succeeded without updating a branch that already existed, and cancelled or
    superseded runs were at first read as passes (`neural-link-between-agents` issue 12, comments 6866821016 and 6865722605). Check outputs.
17. **Merges happen only on the owner's own action.** On 31 October several release and homepage PRs were merged on a relayed "standing chat
    authorisation", against `gridatlas:docs/RELEASE.md:54-55`. The finding stands open (note 37 section 7). Automation has no merge step.
18. **Encoding must match the reader.** The staged candidate is UTF-8 with a BOM; the GridAtlas compiler reads cp1252 and wrote mojibake into 36
    records until the input was re-encoded (note 36 section 6). Each consumer's expected encoding is part of its contract.
19. **Documents go stale within hours.** `docs/repd/2026-10-q3-ingestion.md:34,42` still says the July bytes are unavailable after the archive
    branch recovered them (note 25 section 8). Date every status statement and update it in the same change that changes the fact.
