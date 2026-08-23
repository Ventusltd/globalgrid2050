# GlobalGrid2050 UK Renewables Pipeline V9.6

V9.6 is a separate application copied from the validated V9.5.1 release. V9.5.1 remains frozen at commit `8b2432be75f224562fc1c416dbcc3319e31a47a8`, subtree `6288b9d8196adce57207b549c555c9bcee42587a`, listing SHA-256 `b6197b79601daab1ee3b1d33fb9356c6c56ec02c69f51be73298be34095d5fe8`.

## Scope

V9.6 changes only project filtering and mobile presentation:

- optional inclusive minimum and maximum filters use the official REPD `capacity_mw` value;
- a blank minimum or maximum leaves that side of the range unbounded;
- filter state is shareable through `min_mw` and `max_mw` URL parameters;
- all 7,680 qualifying records remain loaded, searched, sorted, measured and exported;
- desktop continues to render every matching project;
- mobile renders 50 matching project cards at a time and can progressively reveal the rest;
- all 133 headlines remain loaded and filterable; mobile renders 20 matching headlines at a time;
- mobile gains a compact menu, project/news jump links, 44 px touch targets, a three-number analytics summary and a prominent REPD-updated sort control;
- the mobile project table becomes cards and must not require horizontal scrolling.

Progressive rendering changes only the number of DOM nodes. It never changes the canonical project universe, filtered result count, gauges, CSV contents, news matching or official REPD facts.

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

The browser gate checks 360, 390, 430 and 768 px mobile layouts, internal table width, touch targets, progressive rendering, capacity ranges, URL state, date sorting, CSV completeness, all 133/45 headline counts and Beacon Fen's exact binding.
