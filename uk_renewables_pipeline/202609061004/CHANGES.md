# 202609061004 — the table stops freezing the page

Identical to `202609051156` in every byte except
`scripts/plugins/projects-v9-5-1.js`. Same data, same fixtures, same contracts,
same interface. One change, and it is a render change.

## What was wrong, measured rather than assumed

The unfiltered view is **7,680 rows at 42 elements each — 323,802 DOM elements
built from 13.7 MB of markup**, assigned to `tbody.innerHTML` in one synchronous
statement. Measured in Chrome on a desktop on 2026-09-06, that single assignment
blocks the main thread for **3.6 to 4.4 seconds**, three times over. An iPhone is
several times slower again. Nothing responds to a tap during it, because there is
no thread left to respond with. That is the freeze.

## What was NOT wrong

The fetch. It was measured before it was blamed:

| Concurrency | All 16 partitions | First partition |
|---|---|---|
| 16 | 526 ms | 86 ms |
| 8 | 458 ms | 79 ms |
| 4 | 571 ms | 80 ms |
| 1 | 1,442 ms | 81 ms |

The first partition lands in about 80 ms whatever the concurrency, and 9.16 MB
of JSON parses in **19 milliseconds in total**. Neither the network nor the parser
is the problem, and changing them would have been motion without improvement.

## The change

The first 100 rows are painted immediately. The remaining 7,580 are appended 300
at a time, one chunk per animation frame, so the main thread is never held for
more than a chunk.

Nothing is hidden and nothing is paginated. `all` and `filtered` are untouched,
so the record counts, the capacity totals, the search and the CSV export continue
to see every one of the 7,680 records from the first moment — which is the trap a
pagination that slices the data rather than the view walks straight into.

Two details that are not optional:

- **A render in flight is cancelled by the next one.** Without that, changing a
  filter mid-render appends rows from the previous result on top of the new one.
  Verified: zero duplicate rows after a search and a clear.
- **A background tab still finishes.** `requestAnimationFrame` does not fire in a
  hidden tab, so the scheduler falls back to a timeout when the document is not
  visible. Otherwise a reader who opened this in a second tab would come back to
  a table holding its first hundred rows.

## Measured after

| | 202609051156 | 202609061004 |
|---|---|---|
| Blocking assignment | 3,605–4,378 ms | **46 ms** |
| Elements at first paint | 323,802 | **5,428** |
| Rows at first paint | 7,680 | **100** |
| Records the counts see | 7,680 | 7,680 |
| Records search and CSV see | 7,680 | 7,680 |
| Duplicate rows after a filter change | — | 0 |

The full table still arrives; it simply stops arriving all at once.
