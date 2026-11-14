# REPD quarterly release: runbook

How to take one quarterly DESNZ Renewable Energy Planning Database (REPD) publication into this estate.
A person or an agent can follow it step by step. Each rule names the file and line it comes from: `path:line` is in this repository,
`gridatlas:`, `neural-link-between-agents:` and `pipelinenews:` prefix other repositories. "Note NN" refers to the estate survey of
13 November 2026; where it is cited, the repository file and line it rests on are given too.
The design and the reasons are in [AUTOMATION.md](AUTOMATION.md).

Worked example in this document: the October 2026 publication (data quarter Q3 2026), published 13 November 2026.

| Name | Value for October 2026 | Where it comes from |
|---|---|---|
| Release id, used as the file-name suffix | `2026q3` | build brief naming rule; `automation/repd/config.py` (`release_id_for`) |
| Release descriptor | `automation/repd/releases/2026q3.json` | `automation/repd/config.py` (`RELEASES_DIR`) |
| Pipeline News release folder | `uk_renewables_pipeline/202611132345/` | 12-digit UTC stamp, the rule in `scripts/build_homepage_catalogue.py:42` |
| Parent Pipeline News release | `202609082224` (operative). Use `202610290230` only if the owner has accepted it | `homepage-shell/data/homepage.json:171`; `uk_renewables_pipeline/202610290230/CHANGES.md:100-101` |
| Baseline commit (the restore point) | `origin/main` when you start. On 13 November 2026: `73cbdec10bbd3fe2f8313b60b1acc2d22d31b517` | `docs/repd/2026-10-q3-ingestion.md:13-15` |
| Official CSV | `.../media/6af42ff0a4004bdbe54e54a5/REPD_Publication_Q3_2026.csv`, 5,219,160 bytes, sha256 `48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862` | `docs/repd/2026-10-q3-ingestion.md:29`; `scripts/repd_q3_2026_ingest.py:25` |
| Official XLSX | `.../media/6af42ffdb83b3cae0d0a21c9/REPD_Publication_Q3_2026.xlsx`, 5,378,656 bytes, sha256 `87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea` | `docs/repd/2026-10-q3-ingestion.md:30`; `scripts/repd_q3_2026_ingest.py:26` |
| Source shape | 14,968 rows, 14,967 unique Ref IDs, 53 columns. Ref 7679 appears twice, identical, on source rows 7112 and 7113 | `docs/repd/2026-10-q3-ingestion.md:31` |
| October originals and reviewed candidate in Git | branch `repd/2026-10-reviewed-evidence-bc8e6e13361a`, folder `evidence/repd-2026-q3/` (candidate sha256 `9b1f87eb...1343`) | note 25 sections 2-3 |
| July (previous release) originals in Git | branch `repd/2026-07-verified-archive-20261113` (`d015479f71`), folder `evidence/repd-2026-q2-original/`: CSV 5,087,389 bytes `84c1b5f9...5035`, XLSX 5,185,558 bytes `624a0a97...2657`, recovered from UK Government Web Archive captures of 3 November 2026 | that folder's `SHA256SUMS` and `SOURCES.txt`; pins `scripts/repd_sources_v6.py:39-40` |

Shell variables used below:

```sh
REL=2026q3
STAMP=202611132345
PARENT=202609082224
OUT=/tmp/repd-$REL          # every generated file goes here, outside the repository
BASE=$(git rev-parse origin/main)
```

## 0. The five rules this runbook exists to keep

1. **Additive only.** A new quarter adds files under new names and a new release folder. It changes no existing data
   file. "Never replace a failed historical release in place" (`AGENTS.md:9`). Fixtures "must never be refreshed in place.
   New baselines require a separately approved version and new fixture paths"
   (`uk_renewables_pipeline/202609082224/fixtures/README.md:3,10`). `atlas/releases/` in GridAtlas is immutable
   (`gridatlas:AGENTS.md:12`).
2. **Stage and diff, never accept on hard-coded counts.** "A newly discovered REPD quarter is staged and diffed rather
   than accepted through hard-coded counts or silently skipped" (`uk_renewables_pipeline/v7/docs/07-workflows.md:5`).
3. **Nothing scheduled, nothing pushed to main, nothing deployed by automation.** "Do not reactivate old monolith
   schedules" (`AGENTS.md:7`). "No scheduled collectors were enabled by this migration" (`AGENTS.md:45`). Automation ends at
   a draft pull request. The owner alone merges (`gridatlas:docs/RELEASE.md:54-55`).
4. **Missing stays missing.** Missing site, fuel, MW or coordinates stay unknown, never zero or invented
   (`neural-link-between-agents:PROTOCOL.md:41`). Blank capacity is unknown, not 0 MW.
5. **A green workflow is not acceptance.** Never "call a successful workflow engineering acceptance" (`AGENTS.md:9`).
   Promote only after owner validation and browser checks (`AGENTS.md:35-37`). Agents never record acceptance
   (`gridatlas:docs/RELEASE.md:49-53`).

## 1. Who approves what

| Decision | Who | Rule |
|---|---|---|
| Run any step below in a scratch worktree, write to `$OUT`, open or update a **draft** PR | An agent or a person | `AGENTS.md:5` (isolated worktrees, stage only owned paths) |
| Accept the cleaning decisions: month-first date corrections, which copy of a duplicated row is kept, `NA` handling, Offshore Wind Round cells, known wrong coordinates (AUTOMATION.md section 5.7) | Owner | `docs/repd/2026-10-q3-ingestion.md:43,45` |
| Accept the Pipeline News `expected` totals after the first spine run | Owner reviews the printed figures | the builder refuses any other figures by design (`uk_renewables_pipeline/202609082224/scripts/data/build_v9_1_spine.py:121-122` raises "V9.1 acceptance mismatch" on any other figures) |
| Add a line to `.github/large-files-allowlist.txt` (append only) | Owner, with a reason in the PR | `.github/large-files-allowlist.txt:4-5` ("Do not add new entries without a reason in the PR") |
| Add a path to `deploy-pages.yml` push paths | Owner | `WORKFLOW_REGISTRY.md:45`; `.github/workflows/deploy-pages.yml:11-130` |
| Merge any PR in globalgrid2050 | Owner, in person. Never on a "standing chat authorisation" relayed by an agent | `AGENTS.md:35`; `gridatlas:docs/RELEASE.md:54-55`; NL-012 restates "Neither agent merges to main or deploys in globalgrid2050; the owner does" (`neural-link-between-agents` issue 12, comment 6867544650; note 37 section 7) |
| Merge while the public-language `gate` check is still queued | Owner. It needs a self-hosted runner that has been offline since 29 October 2026; the owner chose to merge anyway in NL-007 | note 37 section 7; note 04 section 7 |
| Accept a GridAtlas generation (`ACCEPT G` comment or `accepted:G` label) | Owner only. Agents never write it | `gridatlas:docs/RELEASE.md:40,49-53` |
| Move the homepage "Open Pipeline News" pointer | Owner, in `Ventusltd/globalgrid2050-homepage`, after browser checks | `AGENTS.md:15-18,35-37` |
| Independent review before a task is closed | A second agent or person, reported on the link | `neural-link-between-agents:PROTOCOL.md:45` |
| A "GO" for deployment relayed by another agent | Not valid. Only the owner's own words count | `neural-link-between-agents:FIXES/NL-012/LOG.md:72-74` |

## 2. Paths that must stay byte-identical

A new quarter must not change any byte of these. The build must prove it (section 4, Gate G9) before a PR is opened.

### 2.1 Single files (sha256 and git blob at `73cbdec1`)

| Path | sha256 | git blob | Who pins it |
|---|---|---|---|
| `repd.csv` | `fdb6aec50647a4de88f63d33679b93cb2147417eddc43f3f31cbf12792a38aae` | `01fe17ae9531d3504490a1418a68350262b06f86` | `gridatlas:atlas/coordinate-systems.json:11-25`; `scripts/repd_q3_staging_verify.py:17`; note 16 section 4 |
| `repd-grid-batteries.csv` | `c64678bc15c6b3d4b5107bd613d50cdadf4cb36619ddd3eebabb741096b59410` | `2d4142c7bb97bbd4be1c67698731730d2e25c672` | `scripts/repd_q3_staging_verify.py:18` |
| `repd-solar-operational.csv` | `3d97447a726158a2dad75b589f2737f12eed166b3873c94510e988e5be241e08` | `5d8bab7f640eb943dcf66b2631ad6bcde1f52122` | `scripts/repd_q3_staging_verify.py:19` |
| `repd-solar-operational-over-4mw.csv` | `0f7ecd787c2fb0420a1934a597f4672ae177586e9f16264e331caa3b9317b380` | `31e840cfe206cfb53d9ed2c043e00bdd69080a82` | `scripts/repd_q3_staging_verify.py:20` |
| `dist/repd_master.json` | `ca5da437ddb832f7e4e8d84bba1f2f6d40df6285089a43156452fdda7eebe0fe` | `e221065a7b144a9e4b691cf282e23a68c5661e45` | `.github/workflows/major_project_news_v6.yml:80-91`; `uk_renewables_pipeline/202609082224/contracts/north-star.v1.json:84-89`; read live by atlas v3-v8 and dashboards V1-V5 (notes 05, 14, 15) |
| `dist/manifest_v4.json` | `9c83f953f36c42326de5bf3844f594a2ab06b8707ef7be16971991fdd51b9659` | `ffc6b7c83b51597b9e3374007c64b610de2a09c4` | `.github/workflows/major_project_news_v6.yml:80-91` |
| `dist/manifest_v6.json` | `c75af73e3cb717fed0fc91618a020bf29720bb420d82708fad9e96e1a195ce28` | `dbaf471f262d3b6557e7f327269b663eeddc432c` | `scripts/validate_v6_manifest_provenance.py:43-63`; `scripts/repd_q3_staging_verify.py:22` |
| `dist/repd_source_reconciliation_v6.json` | `28715150d3f0365946a213b404c333d4300e537fee760aefab728eabf603447a` | `35835b6b46aa1f996fedac8c7bf3044a3d423814` | `scripts/repd_q3_staging_verify.py:23` |
| `dist/project_identity_v6.json` | `d614084c05c0380862cf2d9da58309c43cdb128d6917458db4dc53717062ea95` | `b4e58735a93a3b498eda24ad0e0a9e2930b4c540` | `contracts/release.v9.1.json:13` in every release folder; 18 fixture copies (note 06) |
| `dist/major_projects_v6.json` | `ad04f772189868b27e8ba6c2330350794786735d854d01a3c3698cd7422760a7` | `0b602f4c644cf80e9eec3056abb77eefb24b7bd2` | `north-star.v1.json:84-89,108-109`; read live by `dashboard_v6_live.html:27-28` |
| `dist/major_project_news_v6.json` | `40cd71f34bf0bf4664206cb6836c435f3a898e2c1026f27b5ee5e7f178970d0a` | `1f008ec655e3b38f2ad688d1a0ef428f19b168cb` | input to `scripts/build_news_feed_v9_5_1.py:21-23` |
| `dist/project_news_links_v6.json` | `8003e5af7da7110fdfd79220d279144566a18c86e0da29f216fb1b511b4572df` | `6474603c7e3df60d455b41dda976ff7343bdaf64` | V6 validators (note 13) |
| `dist/project_identity_v6_integrity.json` | `c18345810d26507a22af1af65d2e3669d8019edf1ce8af3affb8bfdadc9316a4` | `7d301d3f8ed7f062fba5e2d60167f15870b19f82` | V6 scope validator (note 13) |
| `dist/renewables_v6_integrity.json` | `480171ffe5e72f1a0b7ec2dde9f4daf66f86f217466030022a97cf52431b3663` | `11b43be32f65349ffa317b79de21904cef66502e` | historical evidence (note 13) |
| `dist/major_project_news_v9_5_1.json` | `cea104c3e9cfc07971680afdf5f64073e1d4825b63bfaf4e969266df8386ebbd` | `7a7aa7b60eaca60ca0cdf2591b23df112d9f55da` | the only dist file the operative page fetches (`scripts/plugins/newspaper-v9-5-1.js:5-6`); byte gate `uk_renewables_pipeline/v9.5.1/tests/run_v9_5_1.sh:16-17`; `v9.7/tests/check_v9_7.mjs:58` |
| `dist/major_project_news_v5.json` | `0268087daab2a69bddff4167b2e38d5c89ff70bf36a6c4495ae8becca8c7bd87` | `37f5f3ff4d517f2939f7a6fce44a6263a1207fb8` | `north-star.v1.json:84-89`; `build_news_feed_v9_5_1.py:126` |
| `dist/major_projects_v5.json`, `dist/major_project_news_v4.json`, `dist/major_projects_v4.json`, `dist/renewables_v6_failure.txt` | `0343b891...0b03dd4`, `15959a41...5136b7`, `bf368f65...89f4a0ac`, `64bb3033...6505d5` | `d73d4c8d`, `c395970c`, `243e2c87`, `f75fd53c` | historical outputs (note 13) |
| `uk_renewables_pipeline/dashboard.html` | `341da90d9c4de1ad2535ad82622bea14cdaaea7524e57f2cf69714f9b2ec879a` | `e2d99e37d6388d3f498a79696773238ad689574b` | `scripts/validate_renewables_v6_scope.py:27-33`; `major_project_news_v6.yml:87` |
| `uk_renewables_pipeline/dashboard_v2_2026-08-22.html` | `4b43797175c02680f23d459ccc8971f6356af5864696915f5a6aab923d8ba738` | `cb953a67332d3d29355945fb58a513e30c681013` | same |
| `uk_renewables_pipeline/dashboard_v3_2026-08-22.html` | `04136550fdd4aa82f0c4c09747efa36886ce699bff4825726f66eb52493f275c` | `7dea2b4b6451e504bbf5d55724ccb5992cb81261` | unprotected by any gate today (note 05 section 8); keep it anyway |
| `uk_renewables_pipeline/dashboard_v3_live_2026-08-22.html` | `23a6e4d23927538c1f2d98bec097aee2b5ff5940ae6bffa60cdd9e7e695c8f13` | `911921e7aa254f0bfdecc122d975cc0e3af130c7` | `validate_renewables_v6_scope.py:27-33` |
| `uk_renewables_pipeline/dashboard_v4_live.html` | `94b126a89ca5bf125b785900fc57a713adfd0fe9074510a76b34c05c1af00c51` | `f356b37b1c6202150f3a5bb404a57ee329212f70` | same |
| `uk_renewables_pipeline/dashboard_v5_live.html` | `af7045b3fd09435bcbc2dc5e6f63654c34ec1ee202c908eb156a93c1ae9f5bfc` | `ac33daf67dba8951527b06761ab587003a19f60e` | same |
| `uk_renewables_pipeline/dashboard_v6_live.html` | `2cdb541622a8c0a587af30c1ef600b1c77dc8e151a3c412bc444ec9ba1cc636d` | `c2ada7161cc412f8aca7adff538994d2e0bcda21` | `v7/contracts/north-star.v1.json` `historical_files` (ends :82) |
| `catalogue/homepage-owner.json` | `dc04ae2ddcf6bcec17f88b9e82884468459768e2aa0c7dfdf86b4a3aaa0b5563` | `904a039fed46b397bf7f5edcb65ec2d7694b28df` | changes only in the homepage promotion of step 10 (`AGENTS.md:21-24,35-36`) |
| `catalogue/homepage-catalogue.json` | `b6a14c52ba120249ac844be5b45505b9d0ce3ee043b65ca290b7c5a6497a0b93` | `1a09c84bd0fa2d40abd555cb14650110fd57c397` | do not regenerate during a data release (step 8.9) |
| `homepage_versions/homepage_v127.html` | `1733e3d97c48e3ee28bab82c02e2fdde72c883a143b49353dd5b4eba027585af` | `36e2d18aaa794bedb5b98fe0ed1a37ed0c2a532a` | `AGENTS.md:42-44` |
| `homepage-before-four-nests-20260925.html` | `f1f8b58e86fd469c5b30b34aa4425caa41b72d08ed4e3bf225b9a35281405471` | `0e6ffa49fb5cbb19696cc3225b3d464bebc7daad` | `AGENTS.md:42-44` |
| `.github/large-files-allowlist.txt` | `91526b11a4620f149dc674ddeb274a4f74b5123d720984b29348709481799e34` | `cea655d7d0a332509ba11567a6655a00074cde8a` | append only, owner approval (section 1) |
| `scripts/build_news_feed_v9_5_1.py`, `scripts/major_project_news_v6.py` | `0cbdd7bd...cafac15`, `77d2d139...b123e8c` | | editing either re-runs the V9.5.1 gate (`.github/workflows/v9-5-1-validate.yml:7-16`) |

### 2.2 Whole folders (git tree id at `73cbdec1`, from `git rev-parse HEAD:<path>`)

| Path | Tree | Who pins it |
|---|---|---|
| `uk_renewables_pipeline/v7` | `9ad8cfe9cdf26948ed3ad3898822977f9198006a` | `v9/contracts/legacy-integrity.v9.json`; `v8/tests/run_v8_1.sh:6-12` |
| `uk_renewables_pipeline/v8` | `b319b66d78bee2f5c4a6171fd4df3768a2fb94f6` | `legacy-integrity.v9.json` |
| `uk_renewables_pipeline/v9` | `a32ffa54543f090eb08211941b50b049580c3c55` | `v9.4/tests/run_v9_4.sh:8` |
| `uk_renewables_pipeline/v9/data/v9.1` | `2920f78bf4a0c0cec68aba830d8fe93c8ee1b944` (manifest sha256 `67976a1b...e06c`) | `v9.4/tests/run_v9_4.sh:12` |
| `uk_renewables_pipeline/v9.4`, `v9.5`, `v9.5.1` | `ae91e24c...`, `c4024d08...`, `20b8f6fa97390f2f9897ca23031d3fdc1dd203e7` | `v9.5.1/tests/run_v9_5_1.sh:8-9`; `v9.6.1/tests/run_v9_6_1.sh:9` |
| `uk_renewables_pipeline/v9.6`, `v9.6.1`, `v9.6.2`, `v9.7` | `6e591533...`, `530856b5...`, `68e44cd061736bab1ce2f8e7bf8302aa290a131f`, `26ce21dfb38e4e9589d765bc73c8b4a941e5d7f5` | `v9.6.2/tests/run_v9_6_2.sh:9`; `v9.7/tests/run_v9_7.sh:9` |
| `uk_renewables_pipeline/202609051156`, `202609061004`, `202609061149`, `202609061329`, `202609071221`, `202609081016` | `22474b72...`, `41283e49...`, `c7ce34ae...`, `42f0ebde...`, `36e30da9...`, `f9fd82e0dd9f05807a2a544e4600ebf3ced55439` | runners in later folders, e.g. `202609082224/tests/run_v9_10.sh:70`; catalogue barcodes (note 02 section 6) |
| `uk_renewables_pipeline/202609082224` (operative) | `6247a0c3c00e8e88324d9ea55b22d67dbbb1be90` | `202610290230/tests/run_v9_11.sh:11`; homepage pointer |
| `uk_renewables_pipeline/202610290230` (candidate) | `a5fc89b9ed6fee666d51ed9528771dbd182370a8` | not yet pinned; immutable by `AGENTS.md:9` |
| `pipelinenews_intelligence` (34 releases) | `e89a30b616d11f5ef840d7583d0d4838dec28737` | `release-manifest.json` `immutable_after_publication`; 3,563 deep links from `testcode/202609150502/data/uk-solar.json` (note 12) |
| `testcode` | `68c481e82e9ee6c263eea58aa1c3478f16e56da5` | `scripts/oracle/oracle.json:3-9` (oracle `202609051531`); publication manifests (notes 17-19) |
| `homepage_versions` | `30c2dbaf25941539a9813480dbd72074b5d976ea` | `homepage_versions/README.md:46` ("Never overwrite an old version") |
| `repd_grid_atlasv3` ... `repd_grid_atlasv8`, `202608300453-atlas-v9`, `restore_points` | `f78bf70e`, `d2b19dbc`, `db206fe6`, `f9d54b61`, `cd9eef4b`, `9e5489f5`, `9586485d`, `0e6d272c` | historical builds (notes 14, 15) |
| GridAtlas `atlas/releases` | `4b2293e4be9aa63605bd51f0153cc430be095a76` at gridatlas `41729af` | `gridatlas:AGENTS.md:12` |

Also unchanged: every `contracts/*` and `fixtures/*` copy inside every release folder above (they are inside the pinned trees),
and the root Jekyll pages that read the four root CSVs (note 16 section 2) unless the owner approves repointing them (step 6.4).

## 3. Before you start

```sh
git fetch origin
git worktree add --detach ../gg-repd-$REL origin/main && cd ../gg-repd-$REL     # AGENTS.md:5
git status --short --branch                                                      # must print only the branch line
BASE=$(git rev-parse HEAD)
mkdir -p "$OUT" && git ls-tree -r --full-tree "$BASE" > "$OUT/base.tree"         # blob-level manifest of every tracked file
git ls-files -z | xargs -0 sha256sum > "$OUT/base.sha256"                        # byte-level manifest of the checkout
```

- Use a full clone for steps 8 and 10. The release runners need history (`git rev-parse HEAD:<tree>`, pinned commits);
  a shallow clone fails them (notes 06 section 7, 08 section 7).
- Keep the raw downloads and all generated files in `$OUT`. Never inside the repository (`docs/repd/2026-10-q3-ingestion.md:54`).
  That document calls `.repd-staging/` ignored, but `.gitignore` on the ingestion branch has no entry for it (note 25 section 8), so a
  `git add -A` would stage generated data.
- A cancelled or superseded CI run is not a pass, and a green job can still have done nothing: the evidence-publish job once exited
  success without updating a branch that already existed (`neural-link-between-agents` issue 12, comments 6865722605 and 6866821016;
  note 37 section 7). Read the job's output, not only its status.
- Python 3.11, pandas 2.x, openpyxl 3.1 (`.github/workflows/repd-2026-q3-ingestion.yml:37-39`). Node 22 and Playwright for
  the release runners and browser smoke tests (note 07 section 5).

## 4. Gates

Each gate fails closed: the step stops with a message and writes nothing outside `$OUT`.

| Gate | Checked in step | Passes when | Source of the rule |
|---|---|---|---|
| G1 Source identity | 2 | Both files downloaded without a redirect. Their sha256 does not equal any other release's pinned hash. If the descriptor pins a hash, it matches | GOV.UK replaced-asset redirects (AUTOMATION.md section 5.5); `scripts/repd_sources_v6.py:270-276` |
| G2 Structure | 4 | 53 columns in the official order. Every record complete; last record complete; file ends with a newline. Ref IDs numeric and unique after identical duplicates are collapsed. A conflicting duplicate fails | `scripts/repd_sources_v6.py:193-196`; `neural-link-between-agents:FIXES/NL-012/review-b967360d/REVIEW.md:54-59` |
| G3 Row floor | 4 | Unique refs at least the previous release's unique refs, measured from the baseline file, not a constant | `REVIEW.md:40` (M5); NL-012 `LOG.md:56` (F4) |
| G4 Dates | 3, 4 | The general date rule reports 0 failures over every date column it discovers. Output is strict `dd/mm/yyyy` | `REVIEW.md:73-83` |
| G5 CSV against XLSX | 3, 4 | Same ref set. Every column compared, not 15 of 53. Every difference is classed and counted | `REVIEW.md:38` (M3), `:41` (M6) |
| G6 Coordinates | 4 | Both blank or both numeric. No tab or line break left in a coordinate cell. Out-of-region points listed for review | AUTOMATION.md section 5.7 |
| G7 Vocabulary | 4 | Every Technology Type is in the spine and integration maps. New status values are listed for review | `build_v9_1_spine.py:16-21`; `pipelinenews-gridatlas-20260906:build.py:66-73` |
| G8 Diff reviewed | 5 | The change report exists and a person has read it | `uk_renewables_pipeline/v7/docs/07-workflows.md:5` |
| G9 No truncation | 6, 7, 8, before the PR | No tracked file was modified, deleted or renamed except the approved appends (section 6) | `AGENTS.md:9`; NL-012 `LOG.md:6,24,34` |
| G10 Size | before the PR | Every added or modified file is 5 MiB or less, or matches an allowlist line the owner approved | `.github/workflows/pr-file-size-guard.yml:25,50,97` |
| G11 Release acceptance | 8 | The spine builds with the reviewed `expected` block. The release runner passes. The browser smoke test passes | `202609082224/tests/run_v9_10.sh:58-65`; `AGENTS.md:35` |
| G12 Owner acceptance | 8, 9, 10 | The owner has said so, in their own words | section 1 |

G9 command (run in the worktree after the build files are staged or committed):

```sh
git diff --name-status --diff-filter=MDRT "$BASE" HEAD      # must print nothing, or only the approved appends of section 6
git ls-tree -r --full-tree HEAD > "$OUT/head.tree"
comm -23 <(sort "$OUT/base.tree") <(sort "$OUT/head.tree")  # every base entry must still exist unchanged: prints nothing
sha256sum --quiet -c "$OUT/base.sha256"                     # checkout bytes: prints nothing, exit 0
```

`git diff ... --diff-filter=MDRT` is the same added/modified/deleted test the NL-012 reviews used ("added=10, modified=0, deleted=0",
`neural-link-between-agents:FIXES/NL-012/LOG.md:64-65`). Line counts are not record counts; do not use `wc -l` as a truncation check
(`repd.csv` has 15,182 lines and 13,995 records; note 16 section 2).

G10 command (the same arithmetic as the PR guard):

```sh
git diff --name-only -z --diff-filter=AM "$BASE" HEAD | xargs -0 -I{} sh -c 's=$(git cat-file -s "HEAD:{}"); [ "$s" -gt 5242880 ] && echo "OVER 5 MiB: {} $s"' ; true
```

Any line printed needs an approved allowlist line or a different home for the file (release asset, per `docs/REPO-HYGIENE.md:131`).

## 5. The procedure

The `automation/repd/` commands take a descriptor and an explicit `--out` directory. Run `python -m automation.repd.<module> --help`
for the exact flags of the integrated version. Where a step has an existing repository command, it is given too. "Branch
script" means a script on `repd/2026-10-ingestion-20261113` (draft PR #56), which is October-only.

### Step 1. Detect the new publication

- **Command (automation):** `python -m automation.repd.run --detect-only --out "$OUT"` (or `python -m automation.repd.detect --out "$OUT"`). It reads the GOV.UK
  publication page and content API and writes `detect_report.json` and `detected_<id>.json` under `$OUT`; copy the reviewed file to
  `automation/repd/releases/$REL.json` yourself.
- **Command (by hand):** open https://www.gov.uk/government/publications/renewable-energy-planning-database-quarterly-extract,
  note the "Last updated" date and the CSV and Excel attachment URLs. Or
  `curl -sS https://www.gov.uk/api/content/government/publications/renewable-energy-planning-database-quarterly-extract -o "$OUT/page.json"`
  and read the attachment URLs from it.
- **Adds:** one descriptor file (`release_id`, `label`, `quarter`, `csv_url`, `xlsx_url`, `page_last_updated`, `previous_release_id`,
  `baseline_path`, `expected`). See AUTOMATION.md section 2.
- **Do not use** `scripts/repd_updater.py` to detect. It takes the first REPD CSV link on the page (`scripts/repd_updater.py:124-142`)
  and then rewrites `dist/repd_master.json` and `dist/manifest_v4.json` (`:333,:350`). Do not dispatch `repd_sync.yml`
  (`.github/workflows/repd_sync.yml:25,33-34`).
- **Check:** the file name in each URL names the same quarter as the descriptor (`REPD_Publication_Q3_2026`). Release month to quarter:
  January = Q4 of the previous year, April = Q1, July = Q2, October = Q3 (`automation/repd/config.py`, `RELEASE_MONTH_TO_QUARTER`).
- **Exit:** the descriptor validates.

### Step 2. Fetch and hash

- **Command (automation):** `python -m automation.repd.fetch --descriptor automation/repd/releases/$REL.json --out "$OUT"`.
- **Command (by hand):**
  ```sh
  mkdir -p "$OUT/raw"
  curl -sS --fail --max-redirs 0 -o "$OUT/raw/REPD_Publication_Q3_2026.csv"  "<csv_url>"
  curl -sS --fail --max-redirs 0 -o "$OUT/raw/REPD_Publication_Q3_2026.xlsx" "<xlsx_url>"
  ( cd "$OUT/raw" && sha256sum * && wc -c * )
  ```
  `--max-redirs 0` makes a replaced attachment fail instead of silently returning another quarter's bytes (AUTOMATION.md section 5.5).
- **Command (branch script, October only):** `REPD_Q3_OUTPUT="$OUT" python scripts/repd_q3_2026_ingest.py` (fetch, clean and reconcile in one;
  `scripts/repd_q3_2026_ingest.py:23,311-373`). Needs network to gov.uk.
- **Adds:** `$OUT/raw/*` and their sha256 and byte counts, copied into the descriptor's `expected` block. Raw files never go on the
  candidate branch or on `main`.
- **Archive the originals at once.** GOV.UK keeps only the latest release and redirects the old URLs, so the July originals had to be
  recovered from the Web Archive (note 37 section 6). Put the verified CSV and XLSX on an immutable evidence branch named after the candidate
  head, `repd/<yyyy-mm>-reviewed-evidence-<head12>`. A retry must find identical bytes on an existing branch or fail
  (`neural-link-between-agents` issue 12, comment 6866821016). The branch workflow that does this today:
  `.github/workflows/repd-2026-q3-ingestion.yml` job 2 (same-repository pull requests only; note 25 section 5).
- **Gate:** G1. Old July URLs now serve October bytes; label bytes by their content and hash, never by the URL they came from
  (`neural-link-between-agents:FIXES/NL-012/LOG.md:51-54`). urllib follows the redirect without saying so (issue 12, comment 6865653147).

### Step 3. Clean

- **Command (automation):** `python -m automation.repd.run --label $REL --out "$OUT" --repo-root . --stop-after clean` (add `--offline --csv <csv> --xlsx <xlsx>` without network). The module alone takes files, not a descriptor: `python -m automation.repd.clean --csv <csv> --xlsx <xlsx> --out "$OUT/clean"`.
- **Command (branch script, October only):** the same `scripts/repd_q3_2026_ingest.py` run as step 2. It writes `$OUT/Q3_CANONICAL_STAGED.csv` and
  `$OUT/Q3_RECONCILIATION.json` (`:357,:373`). It has a ref allow-list that rejects any other quarter (`REVIEW.md:35`, H2) and leaves 8 of
  16 date columns unchecked (`REVIEW.md:34`, H1).
- **Command (date rule alone):** `python3 -I repd_date_rule.py <csv> <xlsx> --out "$OUT/date_rule" --as-of <publication date>`
  (`neural-link-between-agents:FIXES/NL-012/review-b967360d/repd_date_rule.py`).
- **What cleaning does** (each item is counted in the machine-readable cleaning log):
  1. Decode the CSV as cp1252 when it is not UTF-8 (`scripts/repd_sources_v6.py:163`). Normalise header whitespace
     (`:113-141`); the October header has a double space in `Planning Permission  Granted` and a trailing space on
     `Are they re-applying (Old REPD Ref) `.
  2. Dates: a typed Excel date wins. CSV text must equal it as day-first, or as month-first only when that cell's own Excel number
     format is month-first (custom code `m/d/yyyy`; built-in format 14 is the locale short date and does not count). Output `dd/mm/yyyy`
     (`REVIEW.md:73-88`).
  3. An exact duplicate row is kept once and reported. Conflicting duplicates fail (`REVIEW.md:58-59`; `docs/repd/2026-10-q3-ingestion.md:31`).
  4. Blank-equivalent text (`NA`, `N/A`, whitespace only) becomes blank and is counted per column (`REVIEW.md:37,79`). Read Excel with NA
     parsing off, or real `NA` planning references are lost (`REVIEW.md:36`, refs 9873 and 11989).
  5. Capacity comes from Excel precision; CSV must agree within 0.0050001 MW (`scripts/repd_sources_v6.py:41,238-250`). Text that is not a
     number is reported, not turned into blank (`REVIEW.md:42`). Blank capacity stays blank: unknown, not zero.
  6. Strip tabs, non-breaking spaces and line breaks from coordinate cells and report each cell (AUTOMATION.md section 5.7).
  7. Write with `lineterminator="\n"` so the hash is the same on every runner (`REVIEW.md:46`, L4).
- **Adds:** `$OUT/clean/repd-$REL.canonical.csv` (name per the integrated module), cleaning log JSON, date provenance CSV.
- **Gates:** G4, G5.

### Step 4. Validate

- **Command (automation):** `python -m automation.repd.run --label $REL --out "$OUT" --repo-root . --stop-after validate`. The module alone: `python -m automation.repd.validate check --csv <csv> --xlsx <xlsx> --baseline <baseline json> --json "$OUT/validate.json"`.
- **Command (branch script, October only):** `REPD_Q3_OUTPUT="$OUT" python scripts/repd_q3_staging_verify.py`. Its checks are pinned to the October
  file (53 columns, 14,968, 14,967, ref 7679, last ref 21493, seven blob ids) and are `assert` statements that `python -O` removes
  (`REVIEW.md:41,52`).
- **Gates:** G2, G3, G6, G7. Exit non-zero on any failure.

### Step 5. Diff against the previous release

- **Command (automation):** `python -m automation.repd.run --label $REL --out "$OUT" --repo-root . --stop-after diff`. The module alone: `python -m automation.repd.diff --previous <previous csv or project_identity_v6.json> --new <cleaned csv> --out "$OUT/diff"`. Writes a markdown and a JSON change
  report: refs added, removed, retained; status, technology, capacity, coordinate and name changes; blank-rate changes per column.
- **Baseline:** the previous release's original files, cleaned the same way, named in the descriptor (`baseline_path`). For October:
  the July originals on `repd/2026-07-verified-archive-20261113` (the table at the top). Extract and check them:
  ```sh
  mkdir -p "$OUT/q2"
  git fetch origin repd/2026-07-verified-archive-20261113
  for f in REPD_Publication_Q2_2026.csv REPD_Publication_Q2_2026.xlsx; do
    git cat-file blob "d015479f71:evidence/repd-2026-q2-original/official-sources/$f" > "$OUT/q2/$f"
  done
  git cat-file blob d015479f71:evidence/repd-2026-q2-original/SHA256SUMS > "$OUT/q2/SHA256SUMS"
  ( cd "$OUT/q2" && sha256sum -c SHA256SUMS )     # both lines must say OK
  ```
  `docs/repd/2026-10-q3-ingestion.md:34,42` still says the July bytes are unavailable; that was written before the archive branch existed
  (note 25 section 8). If no original exists for a previous release, `dist/project_identity_v6.json` holds all 14,657 July records with 20 of
  the 53 columns (note 13). Never present a comparison against `repd.csv` (January 2026) as a July comparison (`LOG.md:38-40`).
- **Command (branch script, exact raw delta):**
  `python scripts/repd_q2_q3_verified_delta.py --q2-csv "$OUT/q2/REPD_Publication_Q2_2026.csv" --q2-xlsx "$OUT/q2/REPD_Publication_Q2_2026.xlsx" --q3-csv "$OUT/raw/REPD_Publication_Q3_2026.csv" --q3-xlsx "$OUT/raw/REPD_Publication_Q3_2026.xlsx" --out "$OUT/delta"`
  (on `repd/2026-10-ingestion-20261113` at `6e58f2802f`; the four hashes are pinned at `:19-24`, arguments at `:83-86`).
- **Adds:** `$OUT/diff/diff.md`, `$OUT/diff/diff.json`.
- **Gate:** G8. A person reads it before step 6.

### Step 6. Root-format datasets under new names

- **Command (automation):** `python -m automation.repd.run --label $REL --out "$OUT" --repo-root . --stop-after build_root` (the module alone: `python -m automation.repd.build_root <cleaned csv> --out "$OUT/root" --descriptor automation/repd/releases/$REL.json`), then copy the
  outputs into the worktree under their new names.
- **No existing generator.** The four root CSVs were committed by hand (note 16 sections 1, 5).
- **Adds (October names):** `repd-2026q3.csv`, `repd-grid-batteries-2026q3.csv`, `repd-solar-operational-2026q3.csv`,
  `repd-solar-operational-over-4mw-2026q3.csv`, and only if the owner wants the map-feature form, `dist/repd_master_2026q3.json` and
  `dist/manifest_v4_2026q3.json`.
  1. Filters that reproduce the January subsets exactly (note 16 section 3): batteries = `Technology Type == Battery` and short status in
     {Awaiting Construction, Application Submitted, Operational, Under Construction, Appeal Lodged, No Application Required};
     solar operational = Solar Photovoltaics, status `Operational` after trimming, capacity > 1 MW; over 4 MW = the same with capacity > 4 MW.
     Blank capacity never passes a `> N MW` filter.
  2. Write with a real CSV writer, never line by line. The January battery subset is broken by a line-based tool (note 16 section 8).
  3. Write UTF-8 without a BOM. The browser pages decode CSV as UTF-8, so the January cp1252 `repd.csv` shows U+FFFD in 201 records
     (note 16 section 3).
  4. The pages keep reading the old files. Repointing the seven `csvUrl` lines (note 16 section 4) is an owner decision, made in the same
     PR or later.
- **Size:** `repd-2026q3.csv` is about 5.19 MB, under the 5 MiB guard by about 50 KB. A `repd_master_2026q3.json` built by the current
  `scripts/repd_updater.py` schema is about 7.2 MB and fails the guard without an allowlist line (`.github/workflows/pr-file-size-guard.yml:50`).
- **Deploy:** root CSVs and new `dist/*.json` names are not on the deploy allow-list (`.github/workflows/deploy-pages.yml:11-130`). They are
  served only after the next deploy.
- **Must not touch:** the four root CSVs, `dist/repd_master.json`, `dist/manifest_v4.json` (section 2.1).
- **Gates:** G9, G10.

### Step 7. V6-format candidates under new names

- **Command (automation):** `python -m automation.repd.run --label $REL --out "$OUT" --repo-root . --stop-after build_v6` (the module alone also needs `--input-root <repository root>`). It reuses
  `build_registry()` and `build_public_snapshot()` from `scripts/build_project_identity_v6.py:268,453` with the release's counts from the descriptor.
- **No unmodified existing command accepts October.** `scripts/repd_sources_v6.py:31-40` pins the July URLs, counts and hashes, `:193-196`
  raises on the duplicate ref, and `:406-409` fetches over the network only. Never run the V6 chain in the worktree you will commit from:
  `scripts/build_project_identity_v6.py:26-27,567` writes `dist/project_identity_v6.json` before its count check, and
  `scripts/repd_sources_v6.py:412-419` writes `dist/repd_source_reconciliation_v6.json` on every run.
- **Adds:** `dist/project_identity_2026q3.json` (about 20 MB, so it needs an allowlist line; today's lines cover only `v6` names,
  `.github/large-files-allowlist.txt:9-10,16`), `dist/major_projects_2026q3.json` (solar > 1 MW, battery > 100 MW, both exclusive;
  `build_project_identity_v6.py:453-465`), and the release's manifest and reconciliation report under `2026q3` names.
- **Check:** IDs `GG2050-REPD-<ref>` unique; `projects_sha256` recomputed with sorted keys, compact separators and `ensure_ascii=False`
  (note 05 section 3). `gg_development_id` is not stable between releases; never join on it.
- **Must not touch:** every `dist/*_v6*.json`, `dist/major_project_news_*.json`, `dashboard_v6_live.html` (section 2.1).
- **Gates:** G9, G10.

### Step 8. Successor Pipeline News release folder

Every command runs in the new folder only. Steps 8.1-8.8 follow note 11 section 6.

1. Copy the parent: `cp -a uk_renewables_pipeline/$PARENT uk_renewables_pipeline/$STAMP`.
2. Remove the parent's own runner and check, which assert the parent's identity
   (pattern: `uk_renewables_pipeline/202610290230/tests/run_v9_11.sh:21-26`):
   `rm uk_renewables_pipeline/$STAMP/tests/run_v9_10.sh uk_renewables_pipeline/$STAMP/tests/check_v9_10.mjs`.
3. Put the new fixtures at new paths: `uk_renewables_pipeline/$STAMP/fixtures/$REL/project_identity_$REL.json` (a copy of step 7's identity file)
   and `uk_renewables_pipeline/$STAMP/fixtures/$REL/repd_coordinates_$REL.json` (`fixtures/README.md:10`).
4. Coordinate fixture. Write `uk_renewables_pipeline/$STAMP/contracts/project-spine.$REL.json` as a copy of `contracts/project-spine.v7.2.json`
   with `identity_fixture` and `coordinate_fixture` pointing at step 8.3 and `source_workbook_sha256` set to the official XLSX sha256, then:
   ```sh
   python3 uk_renewables_pipeline/$STAMP/scripts/data/build_v7_2_spine.py \
     --contract uk_renewables_pipeline/$STAMP/contracts/project-spine.$REL.json \
     --repd-xlsx "$OUT/raw/REPD_Publication_Q3_2026.xlsx"
   ```
   It requires sheet `REPD`, the six columns at `build_v7_2_spine.py:150`, and a Ref ID set equal to the identity fixture's (`:169-178`).
   Only the coordinate fixture output is wanted. The v7.2 product part of `main()` may fail on v7 thresholds; that is expected (note 11, step 4).
   Never run this script with its default contract: it writes into `uk_renewables_pipeline/v7/` (`build_v7_2_spine.py:15-16,194`).
5. Edit `uk_renewables_pipeline/$STAMP/contracts/release.v9.1.json`: dataset name (`:11`), `identity_fixture` and `coordinate_fixture` paths and their sha256
   (`:12-15`), `workbook_sha256` (`:16`). Leave `expected` (`:25-33`) as it is for the first run.
6. Fix the output path, one line in the new copy only:
   `uk_renewables_pipeline/$STAMP/scripts/data/build_v9_1_spine.py:12` from `V9 = ROOT / "uk_renewables_pipeline/v9"` to
   `V9 = Path(__file__).resolve().parents[2]`. Without it the builder reads and overwrites `uk_renewables_pipeline/v9/data/v9.1`
   (`build_v9_1_spine.py:11-14`).
7. Build: `python3 uk_renewables_pipeline/$STAMP/scripts/data/build_v9_1_spine.py`. The first run stops with
   `V9.1 acceptance mismatch: {...}` and prints the actual totals. The owner reviews them; then paste them into `expected` and run again
   (note 11 step 5). Paste the same totals into `contracts/release.v9.5.1.json:48-58`, which the browser loader checks at runtime
   (`scripts/data/canonical-projects-v9-5-1.js:50-54`).
8. Identity text: `index.html` title (`:6`), brand (`:26`), nav (`:29`), heading and counts (`:66-67`), identity lines (`:70-71`); the
   failure message in `scripts/plugins/projects-v9-8.js:516`. Write a new `tests/run_<version>.sh` that pins the parent tree
   (`git rev-parse HEAD:uk_renewables_pipeline/$PARENT`) and names every changed file, in the pattern of `202610290230/tests/run_v9_11.sh:9-56`.
9. Do not run `scripts/build_homepage_catalogue.py`. It makes the newest servable stamped folder "current" with no override
   (`scripts/build_homepage_catalogue.py:214-233`; note 02 section 7).
10. Validate: `bash uk_renewables_pipeline/$STAMP/tests/run_<version>.sh`; `node uk_renewables_pipeline/$STAMP/tests/check_map_contract_all_rows.mjs`;
    `V9_BROWSER_SMOKE=1 bash uk_renewables_pipeline/$STAMP/tests/run_<version>.sh` for the Playwright smoke test (note 07 section 5).

- **Command (automation):** `python -m automation.repd.run --label $REL --out "$OUT" --repo-root . --stop-after build_news --news-review-expected` (the module alone needs nine more arguments; see `--help`. Without `--news-review-expected` run.py passes `--accept-expected` and new contract figures are accepted without the owner review section 1 requires) performs 8.1-8.7
  into `$OUT` with the output path redirected.
- **News:** the new folder keeps reading `dist/major_project_news_v9_5_1.json`, unchanged. Its payload check needs Beacon Fen (ref 13599)
  at 400 MW (`scripts/plugins/newspaper-v9-5-1.js:101-110`). News items carry July statuses; the page does not cross-check them.
- **Size:** the identity fixture copy (about 20 MB) is not covered by `uk_renewables_pipeline/*/fixtures/v6/project_identity_v6.json`
  (`.github/large-files-allowlist.txt:9-10`). The smallest owner-approved line: `uk_renewables_pipeline/*/fixtures/*/project_identity_*.json` (note 04 section 6).
- **Deploy:** `uk_renewables_pipeline/**` is on the deploy allow-list (`.github/workflows/deploy-pages.yml:71`). When the owner merges with a
  human or PAT push, the folder goes live at its own URL, unlinked. A `GITHUB_TOKEN` push deploys nothing (`deploy-pages.yml:5-6`).
- **Must not touch:** `$PARENT`, `202610290230`, `v9/data/v9.1` and every tree in section 2.2.
- **Gates:** G9, G10, G11, G12.

### Step 9. GridAtlas generation, in the gridatlas repository

GridAtlas does not read REPD live. Its search lane reads a hash-pinned Parquet compiled from the July CSV; three cartridges hold the
dataset URL, hashes, generation and closure counts as literals (`gridatlas:atlas/cartridges/202609071213-place-global-search-v9-5.js:14-17,132-141`;
`atlas/modules/202610291043-uk-lightning-overlay.js:216,221`; `atlas/modules/202610312138-uk-offtakers-overlay.js:128,133`).

1. Read `STATE.md` and `atlas/current.json` first (`gridatlas:AGENTS.md:5-7`).
2. Compile: copy `compiler/202608290716-compile-atlas-v9.py` to `compiler/<D>-compile-atlas-v9.py` (D = a `date -u` stamp). Its pins are
   generation `:15` and the July source URL, sha256 and bytes `:16-18`; it refuses any other input (`:199-200`).
   - Feed it the cleaned CSV, not the raw file: the raw October file has ref 7679 twice and the compiler raises on a duplicate (`:99-101`).
   - The compiler opens its input as cp1252 (`:90`). The staged candidate is UTF-8 with a BOM, which compiles but writes mojibake into 36
     records. Strip the BOM and re-encode to cp1252 first (note 36 section 6).
   - The input is then derived, not the official bytes, so the compiler's "official REPD input identity" claim no longer holds byte for byte.
     Record both hashes; the owner decides (note 36 section 6).
   - A blank coordinate becomes 0, 0 (`:103-104`), the placeholder the receiver refuses to fly to. Missing geometry must mean no MAP link,
     never 0, 0 (note 37 section 6).
   - The row guard is 10,000 to 12,000 (`:205-206`) with golden case ref 16135 (`:208-211`).
   Compile twice and compare (`:193-196` for the arguments):
   ```sh
   for r in a b; do python3 -I compiler/<D>-compile-atlas-v9.py --source <cleaned cp1252 csv> --v8 <v8 oracle json> --output build-$r/data; done
   (cd build-a && sha256sum data/*) | diff - <(cd build-b && sha256sum data/*)
   ```
3. Re-cut the search cartridge (`atlas/cartridges/202609071213-place-global-search-v9-5.js:14-17,137-140`) and rebuild both overlays after changing
   the URLs and hashes in their sources (note 36 section 6, step 4):
   ```sh
   node tools/offtakers/build.mjs --gen <G> --out atlas/modules/<G>-uk-offtakers-overlay.js
   node tools/lightning/build.mjs --gen <G> --variant layers --out atlas/modules/<G>-uk-lightning-overlay.js
   ```
   No committed tool assembles a generation that changes the search cartridge and both overlays; the composition manifest and
   `atlas/v/<G>/` are assembled by hand today (note 36 section 7). Gates:
   ```sh
   node tools/scope/loop.mjs lint
   node tools/scope/loop.mjs state --stdout | diff - STATE.md
   node tools/scope/verify-compose.mjs
   node tools/proofs/run-current.mjs
   node tools/ci/pr-gate.mjs --base origin/main
   ```
   Then steps 2-5 of the delivery flow (`gridatlas:docs/RELEASE.md:36-45`). Step 1 there (`make-generation.mjs`) cuts lightning-source
   generations and does not apply to a data refresh:
   ```sh
   node tools/release/release-status.mjs
   node tools/release/publish-preview.mjs --generation <G> --allow <path> [--allow <path> ...]   # 2 preview; one --allow per non-standard path (data files, compiler, allowlist, cartridge, modules, proofs)
   node tools/release/acceptance.mjs --generation <G>                                           # 3 reads the owner's ACCEPT <G>
   node tools/release/release-accepted.mjs --generation <G>                                     # 4 release commit on a branch
   node tools/release/check-live.mjs --generation <G> --wait                                    # 5 live bytes, after the owner merges
   ```
   Add `--push` to steps 2 and 4 only with the owner's authorisation (`gridatlas:AGENTS.md:18`). Every PR is a draft; the release PR is merged
   with rebase, never squash (`docs/RELEASE.md:54-55,211`). Rehearse with `--rehearsal` first; rehearsals refuse `--push` (`:69-71`).
4. The large registry needs an allowlist entry in gridatlas (`gridatlas:.github/large-files-allowlist.txt:5-6`).
5. Order: GridAtlas should go live before Pipeline News moves to the new quarter. Otherwise new refs reach a receiver that reports them
   `NOT_IN_ACTIVE_REGISTER` (`place-global-search-v9-5.js:728-744`; note 36 section 7). The owner chooses the order.

- **Must not touch:** `atlas/releases/**` (`gridatlas:AGENTS.md:12`); the workflow budget (`docs/RELEASE.md:56-58,316-324`).
- **Gate:** G12 (`ACCEPT G` by the owner, `docs/RELEASE.md:40`).

### Step 10. Homepage pointer, in globalgrid2050-homepage

Needed only when the new Pipeline News folder is to replace `202609082224` as the front-page link. A data update by itself needs no homepage
change (note 20 section 6).

1. Owner repository `Ventusltd/globalgrid2050-homepage`: in `data/homepage.json`, add the release to entity `pipeline-news`, set
   `operative_release_id`, keep `202609082224` as a labelled older release (`homepage_versions/README.md:19-22`), validate and promote with
   its `scripts/releases.py` (`AGENTS.md:15-18`). Browser check. Owner merges.
2. This repository: create the next numbered restore point `homepage_versions/homepage_v<N+1>.html` with its metrics file and README section,
   measured before editing (`homepage_versions/README.md:5-17,46`; `AGENTS.md:9`). Run `.github/workflows/homepage-restore-point-check.yml`
   or record why not (`homepage_versions/README.md:52-58`).
3. Edit `catalogue/homepage-owner.json`: the new owner `commit` and the changed sha256 values (`AGENTS.md:21-24`). Do not edit `index.html`
   or `homepage-shell/` (`AGENTS.md:23-24`).
4. After the owner merges, `deploy-pages.yml` runs `scripts/import_homepage_owner.py` (`.github/workflows/deploy-pages.yml:169-170`). Verify
   exact served bytes of `https://globalgrid2050.com/` and `/homepage-shell/data/homepage.json` (`AGENTS.md:35-36`).

- **Gate:** G12. "Homepage pointer changes do not promote the underlying applications" (`AGENTS.md:36-37`): the release must already be accepted.

## 6. The draft pull request

- One branch per release, e.g. `repd/$REL-candidate`. Commit only owned paths (`AGENTS.md:5`).
- Allowed modifications of existing files, each needing the owner's approval in the PR description:
  `.github/large-files-allowlist.txt` (append only) and `.github/workflows/deploy-pages.yml` (append a path). Everything else is an addition.
  The homepage pin of step 10 goes in its own PR.
- Put in the PR body: the descriptor, both source sha256 values, the gate table with results, the cleaning-decision list for the owner,
  the G9 output (empty), the G10 output, and what was not verified.
- Open it as a draft with the REST API (GraphQL is refused in some sandboxes; `gridatlas:docs/RELEASE.md:27-30,208`):
  ```sh
  git push -u origin repd/$REL-candidate
  gh api -X POST repos/Ventusltd/globalgrid2050/pulls -f head=repd/$REL-candidate -f base=main -F draft=true \
    -f title="REPD $REL candidate (additive)" -F body=@"$OUT/pr-body.md"
  ```
- Checks that run: `size-guard` (required in practice). The public-language `gate` needs a self-hosted runner and never completes; do not
  wait on it (note 04 section 7). Nothing is required by branch protection; `main` is unprotected (note 04 section 1).
- The automation workflow `.github/workflows/repd-release-candidate.yml` is `workflow_dispatch` only and ends at this draft PR.

## 7. Rollback

Roll back in the reverse order of release: homepage pointer first, then Pipeline News and GridAtlas, then data. A release folder that the
homepage still points at must not be removed first, or the front-page link breaks.

### 7.1 Not merged yet

Close the draft PR and delete the branch. Nothing on `main` changed.

```sh
gh api -X PATCH repos/Ventusltd/globalgrid2050/pulls/<N> -f state=closed
git push origin --delete repd/$REL-candidate
```

### 7.2 Revert the data commit

Because the release is additive, its revert deletes only files the release added.

```sh
git fetch origin
git worktree add --detach ../gg-rollback origin/main && cd ../gg-rollback
git switch -c rollback/repd-$REL
git revert --no-edit <data-commit-sha>              # a single-parent commit (rebase merge)
# git revert --no-edit -m 1 <merge-commit-sha>      # if the PR was merged with a merge commit
git diff --name-status --diff-filter=MRT HEAD~1 HEAD # must print nothing: the revert only deletes (D) added paths
git diff --exit-code <data-commit-sha>^ HEAD -- uk_renewables_pipeline/$PARENT dist/repd_master.json repd.csv   # exit 0
```

Publish the revert as a draft PR (section 6 command, title `Revert REPD $REL`). The owner merges. Deletions under `uk_renewables_pipeline/**`
deploy on a human or PAT push; deletions of root CSVs or new `dist/*.json` names do not trigger a deploy
(`.github/workflows/deploy-pages.yml:11-130`). The owner then dispatches the deploy:
`gh api -X POST repos/Ventusltd/globalgrid2050/actions/workflows/deploy-pages.yml/dispatches -f ref=main`.

### 7.3 Restore one file from the baseline by blob id

Use this if a protected file in section 2.1 was changed by mistake. Example, `dist/repd_master.json`:

```sh
git cat-file -t e221065a7b144a9e4b691cf282e23a68c5661e45                                  # prints: blob
git cat-file blob e221065a7b144a9e4b691cf282e23a68c5661e45 > dist/repd_master.json
git hash-object dist/repd_master.json                                                     # prints e221065a7b144a9e4b691cf282e23a68c5661e45
sha256sum dist/repd_master.json                                                           # prints ca5da437ddb832f7e4e8d84bba1f2f6d40df6285089a43156452fdda7eebe0fe
```

The equivalent by commit: `git restore --source=73cbdec10bbd3fe2f8313b60b1acc2d22d31b517 --staged --worktree -- dist/repd_master.json`.
For a whole folder: `git restore --source=73cbdec10bbd3fe2f8313b60b1acc2d22d31b517 --staged --worktree -- uk_renewables_pipeline/202609082224`
then `git rev-parse HEAD:uk_renewables_pipeline/202609082224` after committing must print `6247a0c3c00e8e88324d9ea55b22d67dbbb1be90`.
Commit on a `rollback/` branch and open a draft PR.

### 7.4 Verify with the hash manifest

After any rollback, prove that every baseline entry is back:

```sh
git ls-tree -r --full-tree HEAD > /tmp/after.tree
comm -23 <(sort "$OUT/base.tree") <(sort /tmp/after.tree)   # prints nothing
sha256sum --quiet -c "$OUT/base.sha256"                     # prints nothing, exit 0
```

If `$OUT/base.tree` is lost, rebuild it from the baseline commit: `git ls-tree -r --full-tree 73cbdec10bbd3fe2f8313b60b1acc2d22d31b517`.
For the files in section 2.1, `sha256sum` must print the pinned values.

### 7.5 GridAtlas

`node tools/release/rollback-generation.mjs --release-commit <sha of the release commit on main> --reason "what is wrong, who decided"`,
from a fresh worktree of `origin/main` (`gridatlas:docs/RELEASE.md:285-289`). It reverts the pointer and `STATE.md` byte-exact and runs the
gates. Published like a release; the owner merges.

### 7.6 Homepage pointer

In the homepage repository, promote the previous release back with its `scripts/releases.py` (the GridAtlas form is
`python scripts/releases.py promote gridatlas <previous id> --reason "..."`, `gridatlas:docs/RELEASE.md:45`; the `pipeline-news` form is
UNVERIFIED here). Then revert the `catalogue/homepage-owner.json` pin commit in this repository (section 7.2 commands), let it deploy,
and verify served bytes (`AGENTS.md:35-36`).

## 8. Known blockers at the time of writing (13 November 2026)

- gov.uk is unreachable from some agent sandboxes. Fetch in CI or supply the bytes by hand; the hash is the acceptance test.
- The July URLs serve October bytes (`neural-link-between-agents:FIXES/NL-012/LOG.md:51-54`). The July originals exist only on the evidence
  branch `repd/2026-07-verified-archive-20261113`, not on `main`. Evidence branches are the durable copy; Actions artifacts expire after
  about 90 days (note 25 section 7).
- The branch scripts are October-only: hard-coded URLs, counts, the 25-ref date list and branch names (note 25 section 6). The general date
  rule patch (`neural-link-between-agents:FIXES/NL-012/review-b967360d/proposed.patch`) removes the ref list (`REVIEW.md:143-157`).
- Owner decisions open for October: the 25 month-first date corrections, the duplicate ref 7679, 16 `NA` cells in Operational, 55 Offshore Wind
  Round cells stored as dates, refs 18561 and 18562 plotted in the wrong region, the parent folder (`202609082224` or `202610290230`), the
  allowlist lines, and the GridAtlas/Pipeline News order.
