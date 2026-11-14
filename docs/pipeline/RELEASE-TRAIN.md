# Pipeline News release train

Pipeline News (the UK renewables pipeline page) is published as dated version folders under
`uk_renewables_pipeline/<UTC stamp>/`. A published folder is never edited. A new version is a copy of the
newest one with one visible step added, its own runner pinned to the parent's git tree hash, and a
`CHANGES.md` that states what changed and any known fault. Old versions stay published and are listed,
newest first, at `uk_renewables_pipeline/versions.html` (machine-readable: `versions.json`).

## Making a version

    python3 automation/pipeline_release/new_version.py create <UTC stamp> V9.NN "<short title>"
    # edit the new folder
    python3 automation/pipeline_release/new_version.py finalize <UTC stamp> "<what it added>" \
        [--feature id:file:marker] [--fault "<known fault>"]
    python3 automation/pipeline_release/verify.py --browser --write

`create` copies the parent, relabels the page and writes `tests/run_v9_NN.sh`. `finalize` lists every
changed, new and removed file in that runner and records the version and its tree hash in
`automation/pipeline_release/registry.json`. `verify.py --write` regenerates `versions.json` and
`versions.html`.

## What is checked (workflow "Verify Pipeline News versions", on every pull request touching the page)

For every version from `202611132345` onward:

1. the folder's tree hash is the one pinned when it was published (no published folder has changed);
2. the folder's own runner passes (parent tree, file-by-file parity with the parent, spine rebuild,
   the page's own loader, every MAP href);
3. MAP contract for every row: the link carries the row's own REPD Ref ID and technology, and the row's
   own coordinates when the register publishes a valid point;
4. Grid Engine deep-link contract for every row (see below);
5. against the parent: every row's MAP link is identical, character for character; the data hashes are
   identical unless the version declares a data change; every feature of every earlier version is present;
6. in headless Chrome at desktop and phone widths: the page completes with 7,775 records, no uncaught
   errors, no failed same-origin requests, no sideways overflow on the phone.

A verdict is a test result. It is not an engineering acceptance and it does not move the homepage.

## The MAP link, GridAtlas and the Ventus Grid Engine

The MAP link on every row is the product's main feature and is not altered by this train. It opens
GridAtlas (`https://ventusltd.github.io/gridatlas/atlas/`) on the project by REPD Ref ID, with the
technology and, where the register publishes a valid point, the latitude, longitude and zoom.

The Ventus Grid Engine (`https://github.com/Ventusltd/ventus-grid-engine`) is the engine behind that
link, not a separate destination. The repository holds the engine's mathematics (distance, area, nearest
node search, network topology, rating envelope, corridor estimate) and the deep-link contract
(`deeplink/contract.js`, `deeplink/receivers.json`). The contract names GridAtlas as the canonical
receiver, the one that carries the engine, and names the older V8 overlay as retired. The engine's own
published page (`https://ventusltd.github.io/ventus-grid-engine/`) is an index of experiments and an
engine map; it takes no project, site or substation parameter. A project is therefore opened "in the
Grid Engine" by the MAP link itself, and there is no second link.

`automation/pipeline_release/grid_engine_contract.json` is a copy of the contract's parameter names,
technology vocabulary and receivers at a named commit of that repository;
`check_deeplinks.mjs` holds every row's MAP link to it.

Distances shown by the engine and by this page are straight-line screening figures. They do not say
that a project can or cannot connect.

## GridAtlas data state (rows new or changed in the October register)

GridAtlas keeps the active register only (Operational, Under Construction, Awaiting Construction,
Application Submitted). It held the July 2026 register until 14 November 2026, when its October 2026
generation (202611132345) was released; against that register 5,331 of the 5,334 active rows resolve and
the remaining 3 lie outside the area GridAtlas compiles. A MAP link always opens
the map on the point the link carries; the project's identity card opens only when GridAtlas holds a
record with the same REPD Ref ID.

`automation/pipeline_release/gridatlas_resolve.py` measures this for every row of a version against a
GridAtlas browser registry file and lists the active rows that are not held. The current measurement is
`automation/pipeline_release/gridatlas_state.json`; it is copied into `versions.json` (`map_link_state`)
and into the version folder (`gridatlas/map_link_state.json`), where the page uses it to mark only those
rows, below the row's actions, without touching the link.

To confirm a new GridAtlas register closes the gap:

    python3 automation/pipeline_release/gridatlas_resolve.py uk_renewables_pipeline/<newest id> \
        <path or https URL of data/repd_browser_registry_<generation>.json> --require-active

or run the workflow "Verify Pipeline News versions" by hand with `gridatlas_registry_url` set. Rows whose
status is outside the four active ones are never expected to resolve, so "all active rows resolve" is the
test, not "all 7,775".

## Size

From V9.15 a version does not copy the three fixture folders the page never reads, and CI holds each
version folder to 17 MB. Earlier folders are unchanged.
