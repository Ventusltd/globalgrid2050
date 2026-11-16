# V9.28 independent preview acceptance

These local gates cover the ROOT-owned preview. They do not publish, merge,
enable source feeds or approve production. The default candidate is the
unpublished `uk_renewables_pipeline/202611161757` recovery tree; the comparison
baseline is frozen V9.24 (`202611161244`). Override `V928_CANDIDATE` for a new
isolated preview path and `V928_BASE_SHA` for the recorded product main base.

## Preserve data before browser acceptance

Run from the product repository root with Node 24:

```powershell
$env:V928_OUT = 'D:\githubfiles\.qa-artifacts\20261116-agent1\integrated'
node automation/v928_preview/invariants.mjs
```

The gate verifies hashes and record counts of every project/atlas partition;
all 7,775 complete canonical rows and their order against V9.24; 3,604 solar
records; the raw Solar-1000 selection/provenance/candidate bytes; its ordered
numeric first 1,000 IDs; provisional rights/verification states; every MAP
href against the original V9.24 receiver; and the existing
`tests/check_map_contract_all_rows.mjs`. It also checks changes against the
recorded base for unauthorized historical-edition or operative-homepage edits.
It imports established MAP functions rather than creating a new link builder.

## Exercise the integrated page

Install/provision Playwright in a separate tooling directory, then:

```powershell
$env:V928_PLAYWRIGHT = 'D:\githubfiles\.qa-tools\node\node_modules\playwright\index.mjs'
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:\githubfiles\.qa-tools\browsers'
node automation/v928_preview/browser.mjs
```

Without `V928_PLAYWRIGHT`, normal Node resolution must find the installed
`playwright` package. `V928_OUT` defaults to a temporary artifact directory.
The local server reads this checkout, including `dist/major_project_news_v9_5_1.json`,
the V9.24 baseline, the candidate, accepted adapter assets and their pinned
source inputs. Include these in a sparse checkout. External requests are
blocked and listed in the receipt; no live source is silently substituted.

The browser gates the following user-visible contracts at 390, 393 and 1440px:

- Exactly two direct `main > section` blocks, with first headings
  `GLOBALGRID2050 HEADLINES` and `REPD PIPELINE ANALYTICS`.
- Four principal tabs inside `#officialRegister`: `Solar`, `BESS`, `Grid`,
  `Data Centres`, using IDs `solarTab`, `bessTab`, `gridTab`, `datacentreTab`.
  Every tab has a visible controlled panel with its `aria-labelledby` updated
  when Solar/BESS share the existing canonical panel. Enter, ArrowRight,
  Home and End work through actual keyboard input.
- Solar shows 3,604 records; BESS shows battery rows. Existing
  `#clearFilters`, `#tbody`, `#search`, `#exportInline`, `#v2` controls remain.
  Clear filters exposes all 7,775 records, including retained wind records.
- REPD 8162 can be found through the actual search box, its rendered MAP href
  matches the original receiver, and it appears in the downloaded search CSV.
  The full candidate CSV is compared to the actual baseline browser download:
  every field and all 7,775 rows in the same order, using a quoted-field CSV
  parser. No duplicate exporter is constructed by this test.
- The withdrawn NEWS SIGNAL column and standalone Solar-1000/register-change
  panels are absent. Original HTTPS headline links, attribution, honest offline
  source state and hidden editorial ranking are checked.
- The frame uses a monospace font without document overflow. The Grid host
  declares a source/review/unavailable state. The Data Centre host
  `#datacentreHost` mounts 54 UK rows and retains unknown/unassessed status.
- A separate page receives altered Data Centre JSON bytes from the local
  server. The integrated host must become unavailable and expose no stale
  rows, while the canonical REPD table/search/export remain available.

Artifacts include `invariants.json`, `browser.json`, real downloaded CSVs and
viewport screenshots. Receipts record source HEAD and candidate HTML hash;
tests over uncommitted files remain working-tree evidence. Rerun on the
committed exact candidate before using the receipt as an exact-head claim.

## Limits

The suite checks actual local Chromium behavior and the existing link
contract. It does not certify the public GridAtlas receiver, real publisher
rights, authentic source content, model-derived research claims, physical
phone behavior, public served bytes, owner visual acceptance or production.
External Chart.js is blocked with other external requests: numeric gauge
values are checked, while chart rendering is not certified. Standalone
Data Centre/Context/News/Grid component tests are separate prior receipts and
are not redundantly reimplemented here.
