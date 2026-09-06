# V7 immutable reference fixtures

These files freeze the validated V5 product baseline and V6 canonical engineering baseline used by the North Star gate. They are copied byte-for-byte from the named `dist/` assets and must never be refreshed in place.

- `v5/repd_master.json`: legacy V1–V5 GeoJSON baseline.
- `v5/major_project_news_v5.json`: inherited 125-story V5 newspaper baseline.
- `v6/project_identity_v6.json`: reconciled Q2 2026 identity spine.
- `v6/major_projects_v6.json`: validated V6 serving snapshot.

The live V7.1 page continues to read the existing `../../dist/` paths. These fixtures are validation evidence only. A future source refresh may change runtime assets, but it cannot silently rewrite historical expectations. New baselines require a separately approved version and new fixture paths.
