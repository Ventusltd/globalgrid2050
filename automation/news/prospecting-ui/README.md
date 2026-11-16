# V9.26 inline research priority prototype

This additive, local-only consumer belongs to `v9.26-ui-prospecting`. It does not
modify V9.25, any historical release, the official 7,775 records, Solar-1000,
source configuration, browser harness or operative pointers. The matching
producer owns `automation/news/prospecting.py` and `PROSPECTING.md` separately.
Contract: `globalgrid2050.prospecting.research-triage.v1`.

## Intended integration

Keep **News first**, then the existing **Pipeline** with UK projects / Global
data centres tabs. Attach `renderPriority(row, asOf)` or `attachPriority(host,
row, asOf)` inside an existing project record/detail, using qualified IDs
(`REPD-…` versus `DC-WD-Q…`). A compact summary expands to rank components,
source dates, source links and known/unknown figures. Do not add another
standalone evidence or research box. Rank ordering belongs to a clearly labelled
research view of the returned subset; it must not replace canonical rows,
official CSV exports, map links or the immutable Solar-1000 selection.

`index.html` is an isolated review shell with a local JSON file input. It displays
no invented live news, shipped research dataset or automated funding claims.
It retains News before the single tabbed Pipeline to demonstrate placement.
The full release's existing records and workflows require integration/browser
checks once a formal successor release tree exists.

## Consumer contract

`parseArtifact(bytes, expectedSHA256?)` applies a 16 MiB bound, strict UTF-8,
optional exact-byte SHA256 and semantic validation before returning a projected
view model. Release integration must supply a trusted pinned digest; a manually
selected local file is only a review, not source-authenticity approval.
`validateTriage(payload)` checks qualified IDs, official counts, policy,
consecutive ranks, score-component arithmetic/order, source clocks, unknown
momentum, typed capacities and provisional article/access receipts. Unknown
optional input coverage stays unknown. Unsupported schema, policy, state or
figure additions fail closed pending adapter review.

The current producer cannot establish independent momentum, current financing,
available grid capacity or eligible listed-parent identity. The UI states those
limits. Zero heat points are never displayed as zero activity. REPD installed MW
is distinct from IT load, site demand and grid connection MW; null remains
unknown. Record date, retrieval date and ranking `as_of` are labelled separately.
No paywalled/unknown-access article is accepted. Corporate enrichment remains
disabled without reviewed listed-parent identity and membership; no SME/person
fields are projected. Article display uses bounded titles/links only.

Rendering uses DOM `textContent`, approved HTTPS links and `noopener noreferrer`.
An invalid newly selected artifact clears the review rather than leaving stale
rankings under a successful status. This does not affect an official register.

## Local checks

```sh
node --test automation/news/prospecting-ui/tests/adapter.test.mjs
npm ci --prefix automation/news/acquisition/browser
node automation/news/prospecting-ui/tests/browser.mjs
```

The standalone browser check uses **installed Google Chrome** with a disposable
headless profile, an ephemeral localhost port and the existing pinned Playwright
dependency. It does not edit that harness's config/server. Chrome must already
be installed. It checks widths 375, 390, 393, 768 and 1440; these are desktop
browser viewport checks, not physical Android tests. Screenshots are written to
ignored `tmp/prospecting-ui-browser` (override with `PRIORITY_SCREENSHOTS`).
The test fixtures are explicitly synthetic and never used as production data.
Set `PRIORITY_REVIEW_ARTIFACT` to a separately generated artifact to additionally
read it through the real file input and inspect its returned rows at all five
widths; no copy of that artifact is committed by this prototype.

For a manual review, serve this directory with an ordinary static server and
select a separately generated producer artifact. No network acquisition occurs
in this consumer. No publication is performed by these commands.

Initial compatibility readback used prospecting producer commit
`7b45a05f1677c72c563ed114b96e05899d741c26`: 200 official-record priorities and
a separately filtered 100-site DC artifact from the proposed successor data.
Both passed the consumer and the five-width installed Chrome file-input flow.
The optional evidence input was absent; this is not a live news or corporate
filings validation. Those review artifacts and screenshots remain uncommitted.
