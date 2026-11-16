# Served Pipeline release browser readback

`browser_release_readback.mjs` checks a selected V9.25-or-later release in real
Chrome at 375, 768 and 1440 pixels. It takes the publication origin and immutable
release ID explicitly. It never promotes a release or changes the served site.
The separate `automation/v924_public` byte/publication verifier remains unchanged.

Install the existing browser harness's pinned dependencies with `npm ci` in
`automation/news/acquisition/browser`. Use Node 24 and installed Google Chrome,
or set `CHROME_BIN` to a Chrome/Chromium executable. No new dependency manifest
or browser installation is introduced by this helper.

```sh
node automation/pipeline_release/browser_release_readback.mjs \
  --release 202611161630 --origin http://127.0.0.1:4173 \
  --source-commit f4d222844915438fba9323daba1808ce31c375a0 \
  --out /tmp/new-browser-receipt.json
```

For local checks, start the existing unmodified static server with
`node automation/news/acquisition/browser/server.mjs` in an exact source checkout.
For a published release, pass its actual HTTPS origin. HTTP is accepted only for
loopback. Origins cannot contain credentials, query strings or a path. The source
commit defaults to the current Git HEAD; an explicit full 40-character commit is
recommended for receipts. Missing Git objects fail without lazy fetch/replacements.
An existing output is never overwritten. Omit `--out` for JSON on stdout. Failure
returns nonzero with a sanitized error code; no successful receipt is produced.

The checks bind the served index and every loaded same-origin asset under the
selected release to exact Git bytes. The receipt records the source commit,
release Git tree, index SHA256, helper SHA256, browser version and per-width
loaded-asset hashes. It checks actual News-before-Pipeline DOM order, unique 7,775
official project identities, the unchanged V9.24 manifest SHA256 and exact ordered
first 1,000 of 3,604 solar projects. Actual search opens inline project details and
both inherited source links; the links remain explicitly unverified. A real CSV
download must contain every official ID exactly once. MAP must retain the safe
GridAtlas origin/path, solar project identity, new-tab target and `noopener`.

The global data-centre tab must display every record in that release's declared
dataset in order, its declared count, and working identity search/country filters.
The count is not hardcoded to the original 12-site sample. UK totals must survive
tab switching. The helper checks document overflow with UK rows, expanded details
and the global tab visible. It does not intercept requests or install response
fixtures. Fresh browser contexts disable service workers and retain no login state.

Unexpected HTTP errors, failed requests, console errors and page exceptions fail.
The one bounded exception is an actual HTTP404 at the fixed evidence `latest.json`
pointer, accompanied by the actual UI saying evidence is unavailable and no
validated snapshot exists. Only that request's matching browser404 console message
is allowed. A503, network failure, fake successful evidence label or unrelated404
still fails. This records the disabled/missing feed honestly; it is not a feed
availability, rights or independent verification claim.

Chrome's automatic `/favicon.ico`404 is reported separately as incidental only
when the document declares no icon. An explicitly declared missing icon, another
asset404 or a favicon503/error still fails. Optional sidecar errors are not covered
by the evidence exception: for example, the unprovisioned V9.26 news rank sidecar
currently produces a failing network observation, even if its UI falls back.

Receipt output contains hashes, counts, check names and versions, never local
filesystem paths, raw browser errors or private session details. Loopback origins
are reported as `loopback`. Raw page content and CSV bodies are not retained.
Public origins are recorded without credentials or queries. Download/profile files
are temporary browser resources disposed when its context closes.

```sh
node --test automation/pipeline_release/browser_release_readback.test.mjs
BROWSER_READBACK_NEGATIVES=1 node --test automation/pipeline_release/browser_release_readback.test.mjs
```

The opt-in tests use actual Chrome against a local counterexample server: changed
index bytes with the same release identity, then a changed loaded JavaScript asset
with the original index. Both must fail. The normal tests also challenge project
substitution/duplication, quoted CSV records, unsafe MAP links and overly broad
network-error exceptions. Counterexample responses exist only in this test server.

This is responsive desktop Chrome evidence, not native Android evidence. It checks
the MAP handoff contract, not GridAtlas computation. It checks loaded assets, not
every byte in the release tree; retain the separate full byte verifier. Network
and UI observations expire when the served composition changes. A pass is not
permission to publish and does not establish source rights or factual accuracy.
