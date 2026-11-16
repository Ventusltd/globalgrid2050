# V9.27 research-priority export and inline consumer

The existing producer and prototype are reused. This successor component adds a
source-bound export and a row-binding adapter; it does not edit any formal
release tree or enable a collector. Root integration owns the eventual V9.27
version and its release checks.

## Generate a deterministic review bundle

```sh
python -m automation.news.build_prospecting_priority \
  --as-of 2026-11-16T17:40:00Z --out-dir tmp/prospecting-review
```

`priority.json` retains the existing triage-v1 contract. `priority.csv` contains
the same ranked IDs and sourced record remarks; spreadsheet formula prefixes
are escaped. `manifest.json` records both exact file hashes, profile/input
receipts, all 7,775 official IDs and the unchanged ordered Solar-1000 IDs.
The capped research ranking is a separate subset, not a replacement selection.
Optional `--datacentres FILE --datacentres-sha256 SHA` and equivalent evidence
arguments reuse the producer's existing strict admission rules. Missing inputs
remain unknown; invalid supplied inputs fail before output creation. Ranked
remarks describe supplied records, never newly occurring events or grid access.

The explicit as-of time is a computation reference, not a source update. Use the
same inputs/as-of for byte-identical output. A new output directory is required;
existing directories and pointers are never replaced. The manifest is written
last as the completion receipt. An interrupted incomplete directory must not be
published. Root must validate the complete bundle and pin its manifest SHA256
before copying it into a new release or using an existing data-owner workflow.
No additional scheduler is introduced. No DuckDB conversion is needed for this
small JSON-to-CSV projection; existing typed data owners remain unchanged.

## Bind to an existing project record

`parsePriorityBundle(priorityBytes, manifestBytes, trustedManifestSHA256)` checks
raw hashes, schema/counts, inventory membership/order, profile/clock and input
receipt identity, then reuses `validateTriage`. The trusted digest must come from
the release's pinned configuration, not from the downloaded manifest itself.

Call `attachProjectPriority(host, qualifiedProjectId, bundle)` inside an existing
row. REPD rows use their existing `id="repd-123"`; a DC container must expose its
actual `data-project-id="DC-WD-Q…"`. The adapter refuses host/record mismatch,
replaces only its own prior detail, and leaves source facts/actions untouched.
Use `null` after a failed load to clear old priority and show unavailable.
Unranked official IDs show **Outside this research-priority subset**, not zero
priority or inactive. Copy/link scoped `inline.css` with the new consumer; do not
apply the standalone prototype's global stylesheet to the production dashboard.

Additional checks:

```sh
python -m pytest automation/news/tests/test_prospecting_export.py automation/news/tests/test_prospecting.py -q
node --test automation/news/prospecting-ui/tests/adapter.test.mjs automation/news/prospecting-ui/tests/bundle.test.mjs
node automation/news/prospecting-ui/tests/register-browser.mjs
```

The register browser check consumes `tmp/prospecting-v927/` by default (set
`PRIORITY_REVIEW_DIR` to another generated bundle). It uses installed Chrome at
375/768/1440 widths against the existing 7,775-record page, dynamically attaches
the new component without editing it, confirms exact project association,
idempotence, unranked/unavailable handling, existing MAP hrefs and 7,775-row CSV.
External requests are deliberately blocked, so this proves local integration,
not source availability, live deployment or native Android behavior.

Measured component checkpoint (16 November 2026): 97 Python tests and 41 Node
tests passed. Installed Chrome 157.0.8103.51 passed the genuine register flow at
all three widths, including unchanged 7,775-row CSV and MAP hrefs; screenshots
were inspected. The real-data bundle at the example as-of contains 1,000 ranked
records and all 7,775 inventory IDs. Its JSON is 2,692,615 bytes, CSV 515,464 bytes
and manifest 166,385 bytes. Manifest SHA256:
`87004c2fc2ffdb2d34a519110a2c1595708f14b88a358b019f71c8cd48ab6876`.
This receipt uses no optional evidence/DC input; a separate test validates the
actual 12-site DC input and its distinct inventory. No new real article match,
momentum or accepted financial claim is implied. These artifacts are generated
locally, not committed as a published dataset. Final release composition still
requires its own CI/browser/public readback.

The following describes the retained standalone prototype.

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
