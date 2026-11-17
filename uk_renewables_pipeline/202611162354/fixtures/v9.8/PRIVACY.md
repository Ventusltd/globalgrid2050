# Derived endpoints fixture

V9.24 carried a workstation-specific `flow_data.source` value in the pinned
GridAtlas fixture. V9.25 replaces only that value with its public repository
reference. No endpoint, capacity, date or geometry changes. Historical V9.24
bytes are not edited.

`scripts/build/interconnectors-v9-8.mjs` verifies the sanitized local SHA256.
Its SOURCES metadata retains original upstream provenance (GridAtlas commit
`7910d92d0f44c5248695e8eaf02aa3c7db961eee`); it is not a claim that the transformed
fixture is byte-identical to that upstream blob. The builder never consumes
`flow_data.source`. Both generated interconnector data files remain byte-identical
to V9.24, checked by the inherited release tests.
