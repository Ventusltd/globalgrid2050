# GlobalGrid2050 UK Renewables Pipeline V9.6.1

## Scope lock

V9.6.1 is a separate application copied from the validated V9.5.1 release. It
changes the mobile projects viewport only. V9.6 is discontinued and none of its
capacity-range, replacement JavaScript, card-layout or forced-width work is
inherited.

Frozen parent:

- release: `V9.5.1`;
- commit: `8b2432be75f224562fc1c416dbcc3319e31a47a8`;
- subtree: `6288b9d8196adce57207b549c555c9bcee42587a`;
- tree-listing SHA-256: `b6197b79601daab1ee3b1d33fb9356c6c56ec02c69f51be73298be34095d5fe8`;
- frozen app: `../v9.5.1/`.

The V9.5.1 runtime remains intact. `scripts/app-v9-5-1.js`, the complete
canonical data tree, all news logic, project logic, filters, sorting, CSV,
Atlas links and failure behaviour are byte-identical to the frozen parent.

## The only interface change

`styles/v9-6-1.css` applies at 768 px and below. It keeps `.tablewrap` as the
horizontal touch-scroll container and restores the existing `.hide-mobile`
project cells as table cells. The inherited 1,280 px table minimum is unchanged.

There is no mobile card conversion, row remapping, load-more control, body-level
horizontal scroll, new project filter, forced 1,500/1,850 px width, or desktop
layout change.

The accepted V9.5.1 layout remains:

- three gauges above 768 px and one gauge column at or below 768 px;
- three newspaper columns on wide desktop, two on compact desktop and one on
  mobile;
- the established V1/V5/V7.1 sidebar, masthead, filters and typography;
- the complete eleven-column project table;
- the V9.5.1 header containment rules at compact desktop widths;
- all 7,680 qualifying records loaded by default.

## Immutable content and behaviour

- Canonical projects: 7,680 records and 356,474.09 MW exact capacity.
- Displayed whole-MW capacity: 356,474 MW.
- Geometry: 7,652 valid map points and 28 retained missing geometries.
- Newspaper: 133 `ALL` headlines and 45 canonical `RELEVANT` headlines.
- Beacon Fen consent: Low Carbon Limited solar REPD `13599`, official 400 MW.
- Related Beacon Fen BESS REPD `13600` cannot inherit the solar signal.
- Search, technology/status/county filters, REPD date sorting, filtered CSV,
  canonical IDs and Atlas resolution are unchanged.

The V9.5.1 release contract remains the runtime contract. V9.6.1 adds
`contracts/release.v9.6.1.json` as an outer presentation and lineage contract;
it does not alter canonical facts.

## Validation

Run:

```bash
bash uk_renewables_pipeline/v9.6.1/tests/run_v9_6_1.sh
```

Browser validation is included by default in CI and can be enabled locally:

```bash
V9_BROWSER_SMOKE=1 bash uk_renewables_pipeline/v9.6.1/tests/run_v9_6_1.sh
```

The gate proves:

- the frozen V9.5.1 subtree and all legacy integrity markers remain intact;
- V9.6.1 data, scripts and fixtures are byte-identical to V9.5.1;
- no V9.6 capacity input, filter module, project module or app entry point is
  present or loaded;
- the full inherited V9.5.1 functional/browser suite still passes;
- at 390, 430, 440 and 768 px the document remains contained while the complete
  eleven-column table scrolls horizontally inside `.tablewrap`;
- at 769 through 1,440 px the V9.5.1 desktop layout and rendered project/news
  content remain unchanged.

V9.6 remains in repository history for deliberate diagnostics only. Its
automatic validation and production live proof are retired in favour of
V9.6.1.
