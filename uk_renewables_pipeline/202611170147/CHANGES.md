# V9.30 - Data Centre addresses and UK location screening

Parent V9.29 `202611162354`, immutable tree `f99d8951703436caf5c1041fb00821a59971e362`.

The existing Data Centre table now gains optional, exact-ID location actions. All 39 reported address statements across 38 records are available through compact disclosures, including foreign addresses and records with unknown geometry. Thirty-four explicitly GB records have source or approximate postcode locations and a Screen link into the existing GridAtlas coordinate receiver. Foreign locations keep their original MAP action without a GB grid-screening link. One footnote explains the screening limit; one collapsed disclosure retains source revisions, input GeoJSON and geometry-specific terms/credits.

The unchanged producer files are cached at the full PR140 source SHA `83e7c36d08ef98f3665f7f35b8637405391dc4be`. The edition's local manifest and host loader pin runtime SHA-256/bytes and data-grid-gb source `b33190f2a95a2046e108c2ba465c6a9195759892`. Oversized, changed or unavailable input withholds the overlay and preserves the original table. The loader starts only once that table is ready. No scheduler, collector or GridAtlas code changes.

Data remains at its existing owner: 100 source IDs, 39 reported points plus 25 approximate postcode centroids, 36 null locations and 38 address records. These are reported locations, not independently verified facilities or available grid connections. Unknown capacity/status stays unknown. Official REPD rows, Solar-1000, original DC source/export data, full CSV and MAP links remain byte-identical to V9.29. All older edition folders are unchanged.

Acceptance: dedicated native, direct-donor/source identity, all-row and real-browser host suite under `automation/v930_preview/`, formal Linux edition rebuild and complete historical version checks. Publication still requires exact-source CI, actual public bytes/browser and owner-pin/rollback verification; native-handset certification remains unavailable.
