# GlobalGrid2050 app-repo split and data-pipeline architecture

Status: active migration doctrine
Owner: Ventus Ltd
Created UTC: 2026-06-13
Scope: GlobalGrid2050 repo split, app migration, data-pipeline redesign, repository-size governance

## Decision

GlobalGrid2050 is moving away from a monorepo pattern.

The main `globalgrid2050` repository becomes the portal and governance repository. New and existing apps should live in their own repositories. Raw or high-frequency data must not live inside normal app repositories.

## Target repository roles

| Repository | Role | Data rule |
|---|---|---|
| `globalgrid2050` | portal, homepage, doctrine, redirects, shared docs | no raw bulk |
| `globalgrid2050-generation-history` | UK generation history app | compact confirmed facts only |
| `globalgrid2050-uk-energy-tracking` | UK energy tracking shell and public dashboard modules | compact app facts only |
| `globalgrid2050-uk-renewables-pipeline` | REPD / renewables pipeline app | clean project facts, not raw GIS bulk |
| `globalgrid2050-estimators` | estimator tools | code plus small reference tables |
| external cold archive / releases / object storage | raw regeneration evidence and very large study assets | outside app repos |

## Data-pipeline rule

Python runs in GitHub Actions as a compiler.

```text
raw source input -> temporary runner workspace -> validation -> compact confirmed facts -> audit report -> commit small app facts only
```

Raw source inputs are temporary by default. This includes Elexon/BMRS raw pulls, PVLive raw pulls, temporary Carbon Intensity downloads, raw GIS basemaps and one-off research exports.

## Data tiers

| Tier | Use | Storage |
|---|---|---|
| Live / hot | now view, provisional operational pulse | fetched on demand or tiny rolling cache |
| Recent / warm | short-range engineering view | small rolling 30-minute or daily slices |
| Confirmed fact | public history, strategic charts, audit-safe facts | compact JSON in app repo |
| Cold archive | rare regeneration, deep offline study, raw evidence | outside normal Git app repos |

## Generation History source contract

FUELINST is live/recent and provisional. FUELHH is the historic confirmed source for non-solar generation facts. Solar must keep a provenance label because embedded distribution solar is not captured by transmission-only generation outturn.

The browser must follow this loading ladder:

```text
Now -> live/provisional small fetch
Days to 30 days -> recent 30-minute slice
Months to 2 years -> daily confirmed fact JSON
Multi-year -> monthly/seasonal/annual confirmed MWh JSON
Cold study -> regenerate externally or from Actions artifact, not default browser load
```

No browser route should load decade-scale half-hourly or five-minute telemetry.

## Repo-size rules

1. No raw telemetry commits to app repos.
2. No generated raw archives in Git history.
3. Warn on changed files above 5 MB.
4. Fail on changed files above 25 MB unless explicitly approved.
5. Never intentionally approach the GitHub 100 MB hard block.
6. Heavy basemaps, raw CSV archives and Parquet research stores belong outside normal app repos.
7. Deleting at HEAD does not remove old Git history; history cleanup is a later controlled maintenance task after app migration is stable.

## Migration order

1. Stop new bulk commits through guardrails.
2. Run repo split inventory and classify large folders.
3. Bootstrap app repositories with shared contracts and size guards.
4. Migrate one app at a time, starting with Generation History.
5. Keep redirects or portal links in `globalgrid2050`.
6. Verify live pages.
7. Remove moved app folders from the main repo at HEAD.
8. Rewrite history only if size remains a real operational problem after migration.

## First app to split

Generation History should move first because it has the highest overlap between app code, historic energy facts and raw-data governance.

Initial app repo target:

```text
globalgrid2050-generation-history
```

Initial migrated content should include app HTML/Markdown, JavaScript controllers/renderers, CSS dependencies or references, compact confirmed JSON facts, and relevant audit/method documentation.

It should exclude raw FUELHH half-hourly shards, raw API pulls, full GIS basemaps, obsolete clone folders, and large research exports.

## Human approval loop

The existing GridBot model remains active:

```text
AI prepares small workflow/script/docs
Vikram manually triggers audit
Audit report is reviewed
Vikram manually triggers apply if approved
Live route is verified
```

GridBot authentication is execution authority only. Vikram remains the deployment authority.
