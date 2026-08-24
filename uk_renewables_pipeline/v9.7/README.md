# GlobalGrid2050 UK Renewables Pipeline V9.7

## Status

Candidate dated 24 August 2026. V9.6.2 remains the live validated release and
the exact frozen parent. V9.6 remains discontinued.

## One-feature scope

V9.7 replaces browser-only regional regex classification with a deterministic
build-time regional-news pipeline. It publishes three separate committed
artifacts: sanitized accepted articles, a decision ledger covering every input
headline, and a manifest containing source health and content hashes.

The project application is unchanged: 7,680 records, 356,474.09 MW, project
filters, gauges, table, CSV, Atlas links and the repaired horizontal mobile
table are inherited byte-for-byte. UK news remains the 45 canonical REPD
`PRIMARY_MATCH` stories. Regional stories can never create a project signal.

## Regional evidence contract

An international article is accepted only when its headline has explicit solar
or battery technology, utility-scale project or market context, explicit
case-safe non-UK geography, and no canonical or inherited UK-project veto.
Default is abstention. Lowercase `us`, company names, ambiguous technology and
unknown geography do not establish a region.

The first snapshot deliberately migrates the committed V9.5.1 discovery corpus
through the new adapter contract. It preserves the reviewed 19 regional items
(4 US, 9 Europe and 6 other) while stripping the unrelated inherited UK project,
operator, county and REPD metadata from the regional UI artifact. Future source
adapters must land immutable snapshots and pass the same ledger gate.

## Build and validation

```bash
npm --prefix uk_renewables_pipeline/v9.7 run build:regional
bash uk_renewables_pipeline/v9.7/tests/run_v9_7.sh
```

Enable the browser and mobile proof with:

```bash
V9_BROWSER_SMOKE=1 bash uk_renewables_pipeline/v9.7/tests/run_v9_7.sh
```

Promotion is separate: the candidate must pass exact committed-byte, hostile
negative, full browser, deployed-asset and mobile-width gates before `LIVE` is
written anywhere.
