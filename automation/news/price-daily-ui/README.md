# Historical daily price cartridge

This optional Pipeline News view consumes the independently accepted daily
product in `Ventusltd/data-gb-electricity` PR2. It keeps the original V6 canvas
design: dark background, Courier, cyan available mean, gold high, red low,
GBP/MWh axis and cyan summary frame. There is no chart framework dependency.
The original V6 workspace and its graphs remain separate and unchanged. This
is a bounded publication cartridge, not a complete `gb-electricity-ui` port.

## Data and accuracy

`model.mjs` pins accepted data-owner merge
`cf48c8d6fdd9ab686c4af7261149d81a0129f7fc`. Its exact 3,616-byte index has
SHA-256 `3c3ad8e0d8169b4bc253dabbad2a7d35b64984f40accce1abd016e1ca15a1e8e`.
The index pins annual JSON products and the original source-file manifest.
Loads use an immutable allowlisted URL, bounded streaming, exact byte counts
and SHA-256 before parsing. Redirects, bad HTTP, malformed dates, wrong price
bases, invalid counts and inconsistent coverage reject the load. Annual files
are limited to 150 KB and the in-memory cache to three years. A requested
window contains at most 366 calendar dates and loads only its annual parts.
It never downloads browser Parquet or the full raw archive.

The default is the final 30 **source** dates, currently 2–31 October 2026. It
does not use today's date to imply freshness. Available windows are 30, 90,
365 days or a selected source year. The view uses source-declared GB settlement
dates and system-sell prices, with 46/48/50 expected periods. Negative values
stay negative, partial days get hollow markers, and missing or omitted dates
break every line. A missing value never becomes zero. An empty window draws
no invented baseline.

Visible counters show complete/partial/missing source days, observed and priced
periods against expectation, and stored-UTC disagreements in the selected
window and full snapshot. Complete source-day coverage does not certify UTC
alignment. The source's inherited clock differences and gaps are retained.
No intraday, market-index, realtime, forecasting, interpolation or project
revenue claim is made.

High and low describe the available reported observations. The window mean
is the **unweighted mean of available daily means**; it is labelled explicitly
and is not a period-weighted or volume-weighted market price. Partial days can
affect it. The source disclosure retains daily values, coverage and clock
counters with links to the pinned index, original file hashes and owner method.

## Integrate only in a new accepted edition

Load `styles.css` once and use the scoped host API after the Prices tab mounts:

```js
import {mountDailyPrices} from './price-daily-ui/view.mjs';
const prices = mountDailyPrices(host);
await prices.ready;
// On permanent destruction:
// prices.disconnect();
```

The release owner copies or pins the four runtime files together, preserving
their relative imports. Mounting twice on one host returns the same controller.
Source failure hides the previous graph, summary and rows and displays an
unavailable state; source links remain reviewable. A later request cannot
overwrite a newer selection. Disconnect stops observation and suppresses late
updates. Keep the original electricity workspace link independently usable.

This directory changes no frame, operative pointer, immutable edition,
collector, workflow or source history. New-edition integration, hosted checks,
public MIME/CORS/source hashes, rollback and homepage promotion belong to ROOT.

## Validation

```sh
node --test automation/news/price-daily-ui/tests/contracts.test.mjs
node automation/news/price-daily-ui/tests/browser.mjs /owner/derived/price-daily-browser /artifacts
node automation/news/price-daily-ui/tests/browser.mjs /owner/derived/price-daily-browser /live-artifacts live
```

The deterministic browser harness uses the exact accepted owner snapshot and
controlled transport for changed-byte, HTTP failure and delayed-request cases.
It inspects actual canvas paths for explicit and omitted gaps, missing-window
behaviour, negative prices, daily coverage, source links and cleanup at 390,
915 and 1440 CSS pixels. It also checks portrait–landscape–portrait. Live mode
uses real pinned HTTPS data without route interception and checks lazy loading
and phone rotation. Touch emulation does not establish native handset support.
