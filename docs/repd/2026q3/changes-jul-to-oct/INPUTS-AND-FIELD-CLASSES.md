# July -> October change report: inputs, reproduction and field-change classes

This report replaces the earlier version, which used the derived `dist/project_identity_v6.json`
(20 of 53 columns) as the July side because the original July files could not then be found.

## Inputs (both full official 53-column layout, both produced by `automation/repd/clean.py`)

| | July 2026 (Q2) | October 2026 (Q3) |
|---|---|---|
| Official CSV | REPD_Publication_Q2_2026.csv, 5,087,389 bytes, sha256 84c1b5f958a934d8b4b86ec88f50bdcf43830ded7ff2efc27bffca0c98695035 | REPD_Publication_Q3_2026.csv, sha256 48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862 |
| Official XLSX | REPD_Publication_Q2_2026.xlsx, 5,185,558 bytes, sha256 624a0a9712c58a7a93716e51f2bf054eec8b1af7170f6f9516cc10cd248e2657 | REPD_Publication_Q3_2026.xlsx, sha256 87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea |
| Cleaned CSV compared | REPD_Q2_2026_cleaned.csv, sha256 52e2c81ceb7f62bb6175e26bf8a1e081f14dc94a83fcfb5fa925160a5369601b | repd-2026q3.csv, sha256 d937ae16ad07f43caaaa25b4cee56399e1e9b9bb2ae5ecb7bc88cf9bc092e4b9 |

July originals: globalgrid2050 branch `repd/2026-07-verified-archive-20261113` @ d015479f,
`evidence/repd-2026-q2-original/official-sources/` (UK Government Web Archive captures of 3 Nov 2026).

Reproduce:

    python -m automation.repd.clean --csv REPD_Publication_Q2_2026.csv --xlsx REPD_Publication_Q2_2026.xlsx \
        --out OUT --output-name REPD_Q2_2026_cleaned.csv --as-of 2026-08-03 \
        --expected-csv-sha256 84c1b5f9...5035 --expected-xlsx-sha256 624a0a97...2657
    python -m automation.repd.diff --previous OUT/REPD_Q2_2026_cleaned.csv --new repd-2026q3.csv \
        --out docs/repd/2026q3/changes-jul-to-oct --previous-label "July 2026 (Q2)" --new-label "October 2026 (Q3)"

July cleaning: 1,435 cells changed, all logged, 0 unexplained. That covers 1 month-first date (ref 20519,
Planning Permission Refused 4/17/2026), 16 "NA" Operational dates blanked, 55 Offshore Wind Round numbers
restored from Excel dates, 564 embedded line breaks, and 671 edge control characters. There are no duplicate refs.

The earlier version compared against `Q3_CANONICAL_STAGED.csv` (9b1f87eb). That file keeps the Excel-date
form of Offshore Wind Round ("03/01/1900"), so comparing it with a clean.py July file would report 55
artificial changes. This version compares two clean.py outputs. Headline figures are unchanged:
+319 / -9 / 14,648 retained, and 373 status changes.

## Field-change classes on retained records (independent check)

`diff.py` counts a field as changed when it differs after whitespace collapse. An independent comparison
(raw official CSVs, and the two cleaned CSVs) agrees with diff.py on every column. It also classifies
the changes:

- Operator (or Applicant): 530 changed. 493 of these only replace " / " with " & " between joint operators
  (October house style); 37 are real operator changes.
- Address: 521 changed. All 521 are line-break and spacing removal (for example "Road\n, Town" became
  "Road, Town"). No retained record has a substantive address change.
- Coordinates: 28 records moved. 9 batteries had X and Y swapped in July and are corrected in October
  (over 500 km each); 5 more moved over 100 km and 2 moved 10 to 100 km.
- Solar Site Area: 3,474 differ only in number form; 19 are real changes.
- Every other count in the table is a real value change (blank to value, value to blank, or a new value).

Blank capacity is unknown, never zero.
