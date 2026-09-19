# Proof 2: the future lands on the rim and moves nothing

Keys are issued in the order time issued the commits, with a frozen constant for silence. So a commit made later must land beyond the rim and leave every earlier address where it was. Tested on real data, and able to fail:

- the estate as measured and committed at 11:59 London time (Ventusltd/cosmic d672e69): 9,848 commits
- the estate now: 9,868 commits
- present in both: **9,848. Kept their exact address: 9,848. Moved: 0.**
- arrived since: 20 commits carrying 243,858 lines; the rim moved outward by 5,777,058 keys to hold them

It would fail if anything with an old timestamp arrived late: a fetch bringing in older history, a rebase, a wrong clock. `python tools/permanence.py d672e69` repeats it.

## What the dark centre is, measured

| out to | date reached | lines issued by then | silence |
|---|---|---|---|
| 10% of the radius | 2025-06-25 | 42,645 | 100.0% |
| 25% | 2025-08-26 | 59,557 | 100.0% |
| 35% | 2026-04-01 | 16,628,441 | 99.7% |
| 50% | 2026-06-09 | 3,226,409,308 | 75.8% |

From the first commit in May 2025 until April 2026 the whole estate issued under 17 million lines. The other 37.9 billion were written in the five months since. Nothing drew that hole; the commit dates did.

Why it is circular: a line's distance from the centre is the square root of its key and nothing in the rule names a direction, so everything issued before any moment lies inside one circle. The square root gives every line the same area.

Provided as is, without warranty of any kind; a chart, not a design.
