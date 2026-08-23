# GlobalGrid2050 UK Renewables Pipeline V9.6

V9.6 is a separate application copied from the validated V9.5.1 release. V9.5.1 remains frozen at commit `8b2432be75f224562fc1c416dbcc3319e31a47a8`, subtree `6288b9d8196adce57207b549c555c9bcee42587a`, listing SHA-256 `b6197b79601daab1ee3b1d33fb9356c6c56ec02c69f51be73298be34095d5fe8`.

## Scope

V9.6 changes only project filtering and project-table overflow on mobile:

- optional inclusive minimum and maximum filters use the official REPD `capacity_mw` value;
- a blank minimum or maximum leaves that side of the range unbounded;
- filter state is shareable through `min_mw` and `max_mw` URL parameters;
- all 7,680 qualifying records remain loaded, searched, sorted, measured and exported;
- desktop and mobile render every matching project and headline;
- mobile retains the established V1/V8/V9 layout, gauges, newspaper, controls, typography and density;
- the complete 11-column projects table uses touch-enabled horizontal scrolling on mobile;
- no mobile card conversion, hidden project columns or compact gauge redesign is applied.

## Retained contracts

- Canonical project universe: 7,680 records, 356,474.09 MW, 7,652 valid geometries and 28 retained missing geometries.
- Newspaper: 133 `ALL`, 45 `RELEVANT`, exact-REPD project signals only.
- Beacon Fen: Low Carbon Limited solar REPD `13599`, official 400 MW; related BESS REPD `13600` cannot inherit the signal.
- Default project order: official capacity descending.
- REPD Updated sorting: newest then oldest, with missing dates last.
- V1–V9.5.1 remain immutable regression baselines.

## Validation

```bash
bash uk_renewables_pipeline/v9.6/tests/run_v9_6.sh
```

Browser validation:

```bash
V9_BROWSER_SMOKE=1 bash uk_renewables_pipeline/v9.6/tests/run_v9_6.sh
```

The browser gate checks 390, 430, 440 and 768 px mobile layouts, V1-style single-column gauges, full table headers/rows, horizontal project-table scrolling, capacity ranges, URL state, date sorting, CSV completeness, all 133/45 headline counts and Beacon Fen's exact binding.
