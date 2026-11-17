# GlobalGrid2050 Pipeline News V9.30

Edition `202611170147`, parent V9.29 `202611162354`. Exactly two principal blocks and the existing six category tabs. Official REPD data, ordered Solar-1000, full CSV and all original MAP links remain unchanged.

The Data Centres tab adds reported address disclosures and optional UK location screening from the existing data owner. Thirty-eight source records have 39 address statements, 64 have locations and 36 retain unknown geometry. Twenty-five locations are approximate GB postcode centroids; 34 GB records receive Screen links. Foreign source locations retain original MAP actions without a UK grid-screening link. Source statements do not independently verify facility identity. Screening does not assess a connection or available grid capacity.

The edition contract pins a separate, byte-identical runtime cartridge and immutable GeoJSON. Source revisions, per-geometry licences and attribution remain available in the tab. On missing, oversized or changed input, the original Data Centre table remains usable and the optional overlay is withheld.

Validation: `bash tests/run_v9_30.sh`; independent host acceptance under `automation/v930_preview/`. Source/publication acceptance is recorded separately before the homepage pointer changes.
