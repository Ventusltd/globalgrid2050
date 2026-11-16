# Evidence analytical adapter

Provenance inspected before implementation:

- [Data Grid Atlas compiler, pinned 8bf88da9](https://github.com/Ventusltd/data-gridatlas/blob/8bf88da9e210ce9f61dc0398869d3369f3fa2445/compiler/202608291015-build-v8-transplant.py): explicit DuckDB schemas, one thread, sorted ZSTD Parquet, readback and artifact SHA256 receipts.
- [Immutable artifact verifier/runbook, same pin](https://github.com/Ventusltd/data-gridatlas/blob/8bf88da9e210ce9f61dc0398869d3369f3fa2445/runbooks/202608291507-data-gridatlas-automation.md): file closure, schema, count and hash verification; fail closed on immutable conflicts.
- [Existing Furnace, pinned b5f15716](https://github.com/Ventusltd/worlds-/blob/b5f15716486c3ff509c56914fbee06f2e6aec2d8/src/furnace.py): independent comparison and explicit coverage. That implementation certifies a numerical GPU sweep. This adapter applies full-row comparison to all exported records; it neither imports that sweep nor claims GPU or independent factual verification.

SQLite remains the operational store. This CPU-only adapter derives analytical
`projects.parquet` and `evidence.parquet` from an already validated snapshot,
with no article bodies and no inferred project events or VERIFIED claims.
Unknown coordinates remain NULL; project IDs remain VARCHAR REPD identities.
Evidence rows represent project/article associations, so one article can appear
under several projects. No-match projects remain present in the projects table.
Source rights receipts and the source snapshot hash remain in the manifest.

Integrated dependency: `duckdb==1.3.2`; no PyArrow, SQLite extension or CUDA
required. The original adapter was developed with 1.5.5; the complete dedicated
suite also passes in an isolated 1.3.2 environment. The CI producer owns the
dependency pin and orchestration changes. Immutable manifest receipts retain
their actual DuckDB runtime version; changing runtimes does not authorize
overwriting an existing analytical generation.

```python
receipt = export_analytics(payload, staging_directory,
                           expected_project_ids=seed_ids)
validate_analytics(staging_directory / receipt["directory"], payload,
                   expected_project_ids=seed_ids)
```

Call before copying staged operational state or advancing an accepted pointer.
An exception must abort that operation. This module never edits SQLite,
`latest.json`, existing JSON/CSV/GeoJSON snapshots or release pointers.
It creates a timestamped `analytics_YYYYmmddTHHMMSSZ` directory with two Parquet
files and `manifest.json`; its returned paths are relative to the supplied root.
Complete temporary output is validated before directory rename. Existing output
is validated and reused only for the identical source snapshot; it is never
overwritten. Concurrent creation fails closed. The caller must serialize its
own wider multi-file publication (the adapter does not provide that transaction).

Validation covers the exact two table schemas, every value in every row,
project membership/counts, associations and per-project counts through SQL,
Parquet hashes/byte sizes/compression, exact file closure and source digest.
It uses in-memory DuckDB and publishes no `.duckdb` database. A successful
receipt proves serialization consistency, not publisher rights beyond supplied
accepted receipts, independent evidence verification or engineering acceptance.
