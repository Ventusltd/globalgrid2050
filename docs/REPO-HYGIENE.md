# Repository hygiene: large data and snapshots

Status: guidance, added 2026-09-29. Nothing in this document deletes or moves
existing content. Everything already tracked stays where it is; the aim is to
stop the repository growing the same way again.

## Where the size comes from

At the time of writing the checked-out tree is about 5.5 GB across roughly
47,000 files, and 147 tracked files are over 5 MB. The `.git` directory alone
is over 300 MB. Three patterns account for most of it:

1. **Bulk geodata at the repository root**: `uk_primary_roads.geojson` (78 MB),
   `uk_trunk_roads.geojson` (66 MB), `uk_mainline_railways.geojson` (54 MB).
2. **Monthly Elexon archives**: `data/generation/archive/<year>/*.csv`, 12 to
   19 MB each, one per month since 2021, plus the 21 MB rolling
   `elexon_generation_sources_half_hourly.csv` and its yearly copy.
3. **Frozen snapshot folders that copy whole applications**, each carrying its
   own copy of the same fixtures. The 20 MB `project_identity_v6.json` exists
   17 times under `uk_renewables_pipeline/*/fixtures/v6/`, and the 8 MB
   `202608311610-grid-proximity.json` exists in every
   `pipelinenews_intelligence/<stamp>/` and `testcode/<stamp>/` folder. Git
   deduplicates identical blobs, so these cost little in `.git`, but every
   clone, checkout, Pages build and grep pays for them in full.

A 20 MB fixture was also committed and reverted within 76 minutes; a revert
does not remove the blob from history, so that data is still downloaded by
every full clone.

## What the size guard does

`.github/workflows/pr-file-size-guard.yml` fails a pull request that adds or
modifies any file over 5 MB, unless the path matches an entry in
`.github/large-files-allowlist.txt`. The allowlist was seeded with every file
that was already over the limit, so no current content fails the check.

The guard runs on `pull_request` only. Pushes straight to `main` (the
scheduled Elexon, REPD, price and frequency bots) are not checked, so nothing
that works today stops working. If a bot starts opening pull requests, add its
output paths to the allowlist with a comment, or better, move the output out
of the repository as described below.

The older `repo_size_guard.yml` / `scripts/gridbot_repo_size_guard.py` are
manual-dispatch only and remain unchanged.

## Publishing a snapshot as a release or tag instead of a folder copy

A frozen copy of an app or a dataset is a *version*, and Git already has a
mechanism for versions. Copying `repd_grid_atlasv7/` to `repd_grid_atlasv8/`,
or `uk_renewables_pipeline/v9.6.1/` to `v9.6.2/`, keeps every old version
checked out forever and multiplies fixture files.

The replacement pattern:

1. **Tag the commit** that represents the frozen state. Tags are immutable
   pointers and cost nothing:

       git tag -a uk-renewables-pipeline/v9.7 -m "Pipeline v9.7 as published 2026-09-08"
       git push origin uk-renewables-pipeline/v9.7

   Anyone can later run `git checkout uk-renewables-pipeline/v9.7` or browse
   `https://github.com/Ventusltd/globalgrid2050/tree/uk-renewables-pipeline/v9.7`.

2. **Attach the bulky artefacts to a GitHub Release** on that tag rather than
   committing them. Release assets can be up to 2 GB each and are served from
   a CDN, not from the Git pack:

       gh release create uk-renewables-pipeline/v9.7 \
         --title "Pipeline v9.7" \
         --notes "Frozen 2026-09-08. Fixtures attached." \
         fixtures/project_identity_v6.json.gz

   A workflow or a page can then fetch the asset by its stable URL:
   `https://github.com/Ventusltd/globalgrid2050/releases/download/uk-renewables-pipeline/v9.7/project_identity_v6.json.gz`.
   The `stars` repository already does exactly this for its SQLite database
   (`gh release upload modular-star ... --clobber`).

3. **Keep one live folder per app**, not one per version. The current app
   lives at its canonical path; the history of that path *is* the version
   history. `atlas/current.json` in gridatlas is the model: a single mutable
   pointer plus immutable, hashed cartridges.

4. **Reference, do not copy, shared fixtures.** If a snapshot must remain
   browsable as a folder, keep code in the folder and point at one shared copy
   of any fixture over a few megabytes (a relative path, a release asset URL
   or a `data/` location) rather than duplicating it.

5. **Large geodata belongs outside `main`.** Road, rail and generation
   datasets that change on a schedule should be produced by the workflow and
   uploaded as a release asset (one release per dataset, `--clobber` to
   refresh) or a workflow artifact, or stored in Git LFS. Pages can fetch
   release assets directly; nothing needs the file to be in the Git tree.

## `.gitattributes` and `.gitignore` suggestions

The `.gitignore` additions below were applied in this change; they matched no
tracked file at the time. The LFS lines are present in `.gitattributes` but
commented out, because enabling Git LFS on already-tracked files rewrites
history and needs the LFS quota to be confirmed first.

If Git LFS is adopted, uncomment in `.gitattributes`:

    # Bulk datasets: store in Git LFS so clones do not download every version.
    *.geojson filter=lfs diff=lfs merge=lfs -text
    data/generation/archive/**/*.csv filter=lfs diff=lfs merge=lfs -text
    **/fixtures/**/*.json filter=lfs diff=lfs merge=lfs -text
    *.parquet filter=lfs diff=lfs merge=lfs -text
    *.sqlite filter=lfs diff=lfs merge=lfs -text

Then migrate only new commits (`git lfs track` + commit) or, with agreement,
run `git lfs migrate import --include="*.geojson"` on a fresh branch and
review the result before it goes anywhere near `main`.

`.gitignore` additions (applied): output that should be produced by workflows
and published as assets rather than committed:

    # Bulk download outputs: publish as release assets, never commit.
    *.geojson.gz
    *.csv.gz
    *.sqlite
    *.sqlite.gz
    *.mbtiles
    *.pmtiles
    # Scratch copies of snapshot folders.
    *_backup/
    *-backup/
    *.orig

## Checklist for a pull request that touches data

- Is the file over 5 MB? Publish it as a release asset and reference the URL.
- Is it a copy of something that already exists elsewhere in the tree? Point
  at the existing copy.
- Is it a frozen version of an app? Tag the commit instead of copying the
  folder.
- Does a bot regenerate it every run? Have the bot upload it to a release or
  artifact, and commit only a small pointer file (source commit, row count,
  asset URL).
