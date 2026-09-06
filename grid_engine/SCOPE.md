# The thirty — scope for the night of 2026-09-06

One feature per iteration. Each iteration publishes an immutable timestamped
directory under `/grid_engine/`, and each is proven in the engine before it is
published. A step is not done until it is live and measured in a browser at
393 px.

**Audience:** developers, EPCs and heavy energy users who need to electrify, add
solar and add battery, and who need to know what a substation can actually take.

**Two rules that do not bend.** The straight-line computation stays the first
pass and is never altered — every route feature is additive and provably leaves
`corridor-estimate.js` unchanged. And nothing computes headroom, spare capacity
or connection availability: a published figure may be carried, dated and
attributed; a derived one may not.

## Status

| # | Step | Publishes | State |
|---|---|---|---|
| 1 | Electrification arithmetic — energy, average, peak at a stated load factor | `202609060148-electrification-workbench` | **live** |
| 2 | Firm capacity — N-1, installed against firm, MW to MVA | `202609060205-firm-capacity` | **live** |
| 3 | Diversity — ADMD, coincidence measured not assumed | `202609060211-diversity` | **live** |
| 4 | Connection cap — battery power from peak, store from area above the cap | `202609060212-connection-cap` | **live** |
| 5 | Route obstacles — motorway, railway, open water; the Irish Sea refusal | `202609060213-route-obstacles` | **live** |
| 6 | Trench or drill — the engine wired into `cable-trench-or-drill`, pinned by hash | `src/route-constraints/` there, 25 checks | **live** |
| 7 | Solar + BESS behind one connection — clipping and net position | `202609060217-solar-bess-export` | **live** |
| 8 | NESO pathway growth applied to a substation | `202609060218-substation-growth` | **live** |
| 9 | Published fault level — opens refused, because the data has no basis | `202609060236-published-fault-level` | **live** |
| 10 | Fault headroom, published — resume the interrupted National Grid thread, CI-scanned | workbench + data provenance | |
| 11 | Seasonal rating envelope — a view for `rating-envelope.js` | workbench | |
| 12 | Nearest substation — a view for `v9-nearest-search.js` | workbench | |
| 13 | Electrical distance — hop count over published topology | workbench | |
| 14 | Network topology — a view for `network-topology.js` | workbench | |
| 15 | Corridor estimate — the straight-line first pass, shown honestly | `202609060237-corridor-estimate` | **live** |
| 16 | Site area, perimeter and bearing on the shared geodesy | `202609060238-site-geometry` | **live** |
| 17 | Interconnectors against prices, as text, deliberately not drawn | `202609060305-interconnectors` | **live** |
| 18 | Power factor — capacity released without building anything | `202609060309-power-factor` | **live** |
| 19 | Transformer loading and losses | workbench | |
| 19b | Data centre connection — MVA, diversity and firm capacity together | workbench | |
| 20 | Voltage drop along a feeder, and losses kept separate | `202609060313-voltage-drop` | **live** |
| 21 | Storage duration and round-trip | workbench | |
| 22 | Heat pump cold snap — the winter coincidence case | workbench | |
| 23 | EV depot — fleet energy inside a charging window | workbench | |
| 24 | Data centre connection — MVA, load factor, annual energy | workbench | |
| 25 | Electrolyser — electricity in, hydrogen out | workbench | |
| 26 | Grid Atlas cartridge: NESO-aligned demand growth layer | cartridge | |
| 27 | Grid Atlas cartridge: firm capacity on the map | cartridge | |
| 28 | A cvaa vaccine for the workbench ladder | vaccine | |
| 29 | Pipeline News, next timestamp — the mobile MAP fix | release | |
| 30 | Handover: index, lane checkpoint, session log | log | |

## Why these, in this order

Steps 1–8 are the substation computation, because that is what decides whether
a project can connect and it is the question the audience actually asks. Steps
9–16 give a view to engine mathematics that already exists and has none — the
estate rule is that every tool needs a view that opens on a phone, and seven
modules currently fail it. Steps 17–25 are the ordinary distribution
calculations an EPC does on paper. Steps 26–27 put the results on the map where
the projects are. Steps 28–30 close the night.

## What each step must satisfy before it counts as done

1. The mathematics lives in `ventus-grid-engine`, with a proof, and the proof is
   made to fail before it is trusted.
2. `node verify.mjs` passes across the whole engine, not just the new module.
3. The page imports the module at runtime and holds no copy of the arithmetic.
   If the engine is unreachable the page shows no numbers.
4. Measured in Chrome at 393 px: no horizontal overflow, no offscreen elements,
   no interactive target below 24 px.
5. Published, and the served bytes compared against the committed blob — a 200
   is not evidence.
6. The refusals are on the page, not in a footnote.
