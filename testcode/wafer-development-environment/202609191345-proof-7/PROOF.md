# Proof 7: light a repository, tested; and the standard's own limits on the conductor

Two halves, one rule. The wafer's light must fall exactly where the keys are, and the conductor's
drawing must obey the numbers the standard actually gives. Both are now checked by the page itself.

## The wafer: `?selftest=repo:<name>`

Clicking a repository has lit it since proof 1. Nothing tested that the light was in the right
places, or that the number in the HUD came from the same arithmetic as the picture.

The page now computes `issuedBelow(k)` in JavaScript: the running total to the start of the commit
that owns key `k`, plus however far into that commit `k` lies. That is the same expression the
fragment shader evaluates for every pixel to decide its shade. The test walks outward from the
wafer's centre, east and north, one pixel at a time, and for each pixel asks which repository owns
the key at that pixel's centre. A pixel must be green if and only if the answer is this
repository. A pixel whose radial span straddles a change of owner is excluded and counted
separately, because one pixel here covers hundreds of millions of addresses and the two need not
agree on which side of a line it falls.

The line total is then taken three ways that must give one number: through the running totals, by
adding the repository's commits directly, and from `cosmos/repos.tsv` as the belt declared it
before anything was drawn.

Measured, at 1251 x 1188, wafer radius 376 px, 748 pixels walked each time:

| repository | disagreed | green | not green | straddled | lines, three ways |
|---|---|---|---|---|---|
| globalgrid2050 (5,054 commits) | 0 | 269 | 324 | 155 | 35,561,117,636 = 35,561,117,636 = 35,561,117,636 |
| cosmic (9 commits) | 0 | 0 | 593 | 155 | 240,311 = 240,311 = 240,311 |
| Kuiper-belt | 0 | 0 | 593 | 155 | 536,667 = 536,667 = 536,667 |

All three PASS.

### What failed, twice, and what it taught

**cosmic lit nothing, and the first test called that a failure.** It was right to. 240,311 lines on
a 37,929,255,811 line wafer is one part in 158,000: its widest unbroken run is 0.0001 of a pixel
across, so no pixel centre can fall inside it and there is nothing to light. That is a fact about
the wafer, not a fault in the drawing. The answer was not to loosen the test but to make the page
say it: when the lit repository's widest unbroken run is under one pixel, the HUD now states
`FINER THAN ONE PIXEL at this zoom` with the figure, and the test requires either lit pixels or
that sentence on the screen.

**The first version of that sentence was false.** It was written from the widest single commit and
said that nothing could be lit. But globalgrid2050's widest single commit is 0.13 px and 269
pixels of it are green, because its commits are packed so tightly that pixel centres keep landing
inside them. The measure had to be the widest **unbroken run** of that repository's keys, which for
globalgrid2050 is 1.6293 px and for cosmic is 0.0001 px. A test passing while the words on screen
lie is the failure this estate keeps meeting; this time it was caught before publishing.

## The conductor: IEC 60228:2004 (ed. 3.0), cited value by value

The section's title block carried `CANDIDATE` against every number it had not checked. Three of
those are now keyed against the standard itself, one value at a time, each with the table it came
from. No table and no column of a table is reproduced: the standard is licensed for private use,
and a column is disclosure.

| case | what the standard asks | what is drawn | source |
|---|---|---|---|
| 6 mm², class 5, tinned | maximum wire diameter 0.31 mm | 0.30 mm, within | Table 3 |
| 6 mm², class 5, tinned | maximum resistance 3.39 Ω/km at 20 °C, metal coated | stated | Table 3 |
| 6 mm², class 6 | maximum wire diameter 0.21 mm | 0.20 mm, within | Table 4 |
| 6 mm², class 6 | maximum resistance 3.30 Ω/km at 20 °C, plain | stated | Table 4 |
| 400 mm², class 2, aluminium | minimum 61 wires circular, 53 circular compacted | 61 drawn, at the minimum | Table 2 |
| 400 mm², class 2, aluminium | maximum resistance 0.0778 Ω/km at 20 °C | stated | Table 2 |

The last line is the one worth reading twice. The hexagonal numbers 1, 7, 19, 37, 61, 91 are not a
convention: they are what the standard asks of a **circular** conductor. Compaction frees a
conductor from that minimum, and the standard asks only 53 for the same 400 mm² compacted. So the
compaction circle already drawn on this section is not only smaller metal, it is a different rule.

The drawing now checks itself against these limits, every time it draws:

| test | al400 | cu6c5 | cu6c6 |
|---|---|---|---|
| every wire is at or under the table maximum | no maximum in Table 2 for class 2 | 0.30 ≤ 0.31 PASS | 0.20 ≤ 0.21 PASS |
| the wire count is at or over the table minimum | 61 ≥ 61 PASS | not applicable | not applicable |
| 61 wires drawn, layers 6, 12, 18, 24, metal area equals nominal | PASS | PASS | PASS |
| reserved title block rows equal the rows written | 16 and 16 | 13 and 13 | 13 and 13 |

All three cases PASS, at 1251 px and at 390 px.

`?selftest=new` was run again on the changed page: PASS. `tools/ci_check.py`: PASS on all four
checks, 161 tracked files scanned against the private digests, 0 matches.

## What this does not claim

The resistance values are stated, not yet used: nothing on the page is sized from them. That is
the next proof. The class 5 and class 6 wire arrangements remain an idealisation, because bunched
wires have no fixed positions, and the drawing says so. The compaction fill of 0.90 is still
CANDIDATE and is still drawn in amber, because no key has been found for it.

Provided as is, without warranty of any kind; a chart, not a design.
