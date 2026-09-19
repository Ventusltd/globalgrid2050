# Proof 4: light a period. A month is one band, and the page proves it on itself

Type `/` then `2026-07`, or a day such as `2026-08-14`.

Keys run in the order time issued them, so any period is ONE contiguous band of keys, its line count is the difference of two running totals (law L23), and lighting it is lighting one annulus. The wafer now carries a time graticule, a labelled ring at each month boundary, because on this wafer radius IS time. It has no spokes, because angle means nothing here and a lattice line must mean something.

Colours follow the SCADA palette shared with GridAtlas (PALETTE.md): x-ray grey is the record, cyan is the instrument, green is energised, amber is new, magenta is selected.

## The page tests itself: open it with ?selftest=2026-07

| test | result |
|---|---|
| T1 lines by running total equal lines added one commit at a time: 838,447,910 = 838,447,910 | PASS |
| T2 scanning across the band, work is green and silence is dark: 14 green, 2 dark, 0 other | PASS |

July 2026: **838,447,910 lines in 952 commits across 33 repositories.**

## The test failed first, correctly, for the wrong reason

Version one sampled a single pixel at the middle of July and read back 9,12,19: background. The render was right and the test was wrong. That pixel was a night, a silent ring inside the lit month, which is exactly what should be dark. The test now scans the whole band and demands green where there is work and dark where there is silence.

Provided as is, without warranty of any kind; a chart, not a design.
