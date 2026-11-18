# V9.27 research-priority snapshot

Ranking reference time `2026-11-16T17:48:52Z`, using the existing
`automation.news.build_prospecting_priority.build_artifacts` and its default
1,000-record research-ranking cap. No optional evidence or DC input was supplied.
All 7,775 official identities, 3,604 solar records and the exact ordered V9.24
Solar-1000 remain in the manifest's source inventory. Ranking membership is a
separate subset; an unranked project is not assigned zero potential or inactivity.

Priority JSON and the completion manifest use compact UTF-8 JSON (sorted keys,
`separators=(',', ':')`, `ensure_ascii=False`, final LF) to stay inside the existing
release size budget. The CSV is byte-identical to the shared exporter. After
compacting priority JSON, its manifest size/SHA256 receipt is recomputed; all
semantic values and source/inventory receipts remain unchanged. The loader pins
the exact compact manifest SHA256:
`4cb13bcdc332730f1c88804b1a1cadae76b75d1c9ada4dd4f6d1c7252f86de27`.

The bundled adapter, binding and view modules are exact copies from
`automation/news/prospecting-ui/`. Source-bound validation precedes display.
Rows expose a compact research-priority link; details explain the components,
source record date, capacity basis and original record. No official field, table
order, MAP href or official CSV is changed. Missing/invalid data shows unavailable.
Unranked rows show outside this research subset. Momentum, current financing and
grid access remain unknown, and all article associations remain provisional.

Reproduction and actual candidate browser/failure checks are in
`automation/news/acquisition/browser/prospecting-priority.spec.mjs`. This frozen
snapshot is not a live collection timestamp, a trend measurement, investment
recommendation or verification of a newly occurring event.
