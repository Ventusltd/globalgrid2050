# Proof 3: show new code. A pulse through time, a flash on what is new, a line where it begins

Press `n`, or type `/` then `show new code`, or `new 48h`.

Keys are issued in time order, so whatever is new is always ONE contiguous band at the rim, and the boundary between old and new is a single circle. The pulse travels outward from the centre, which on this wafer is forward through time. The new band flashes. The camera dives to the first new line and a dashed line marks the boundary, with NEW CODE written on the outward side.

"New" is counted back from the newest commit, not from the wall clock, so the page gives the same answer tomorrow.

## The page tests itself: open it with ?selftest=new

| test | result |
|---|---|
| T1 what is new is one band beyond everything older | PASS |
| T2 the boundary key resolves to the first line of a new commit | PASS |
| T3 the flash is amber on the new band: pixel read back as 255,199,107 | PASS |
| T3 no light falls on the silent centre: pixel read back as 11,14,21 | PASS |

Measured by that run: the last 24 hours hold **171 commits and 1,731,552,064 lines**, beginning at key 51,521,788,947, which is particle-physics-drawing-engine / c69bb3595407. `python tools/key.py 51521788947` prints that line.

## What the tests did not catch, and eyes did

The first version labelled the boundary "older on the left, newer on the right". At that key's bearing outward points left, so the label was false while all four tests passed. The words are now placed along the real radius. A test checks what it was told to check; somebody still has to look.

Provided as is, without warranty of any kind; a chart, not a design.
