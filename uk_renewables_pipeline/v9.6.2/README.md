# GlobalGrid2050 UK Renewables Pipeline V9.6.2

## Status

Live validated release dated 24 August 2026. V9.6.1 is the frozen working parent.
V9.6 remains discontinued.

## One-feature scope

V9.6.2 adds regional newspaper views without changing the canonical UK project
registry, project filters, gauges, table, CSV, Atlas links or mobile table repair.

The newspaper buttons are:

- `ALL`: the complete inherited 133-headline discovery edition;
- `UK`: the 45 canonical REPD `PRIMARY_MATCH` stories formerly labelled
  `RELEVANT`;
- `INTERNATIONAL`: explicitly non-UK solar and battery stories;
- `US`: the US subset of INTERNATIONAL;
- `EUROPE`: the European subset of INTERNATIONAL;
- the inherited technology and event views.

## Regional algorithm

UK remains the authoritative algorithm: a story must have one canonical REPD
project, valid REPD Ref, `GG2050-REPD-<ref>`, `PRIMARY_MATCH` role and signal
eligibility. Renaming the button does not weaken this gate.

International classification is deliberately separate and cannot create an
REPD project signal. A story qualifies only when its headline contains:

1. explicit solar/PV or battery/BESS/storage context;
2. explicit non-UK geography classified as US, EUROPE or INTERNATIONAL_OTHER;
3. no canonical UK match, explicit UK geography or distinctive inherited UK
   project-name evidence.

The first committed snapshot contains 19 international stories: 4 US, 9 Europe
and 6 other regions. Ambiguous company-name geography is rejected. The
`Canadian Solar` patent headline is therefore not treated as Canadian news.
The Kintore battery story remains excluded from INTERNATIONAL because Kintore
is recognised as its UK project identity even though the headline mentions a
Chinese supplier.

Regional stories are public discovery intelligence only. They have no claimed
US or European government project ID, no fabricated canonical identity and no
effect on official REPD facts.

## Frozen parent

- release: `V9.6.1`;
- commit: `55c822ba8fa046fb89bd7e896d9ade7c23c14043`;
- subtree: `6fc655fd5f1e80e0e2c390dce62a38bdea69a20e`;
- path: `../v9.6.1/`.

The parent retains 7,680 projects, 356,474.09 MW, 133 ALL headlines, 45 UK
canonical matches, the Beacon Fen REPD 13599 contract and the contained
horizontal mobile project table.

## Validation

Run:

```bash
bash uk_renewables_pipeline/v9.6.2/tests/run_v9_6_2.sh
```

Enable the browser proof with:

```bash
V9_BROWSER_SMOKE=1 bash uk_renewables_pipeline/v9.6.2/tests/run_v9_6_2.sh
```

The gate reruns the frozen V9.6.1 suite, checks the regional corpus and hostile
negatives, confirms UK signals remain canonical, exercises every new tab, and
rechecks mobile table containment.
