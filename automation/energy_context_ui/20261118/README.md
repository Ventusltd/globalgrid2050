# Energy and AI news context

Additive Pipeline module for the third overnight successor. It is not yet attached to a published edition. Existing historical sources, collector and main news renderer are unchanged.

## Inputs and evidence

`policy.json` is the bounded offline distillation of the official HM Treasury Data Centre Covenant, published 28 October 2026. It contains five paraphrased themes and two typed policy quantities. The 6 GW value is the government's estimate of national AI data-centre capacity required by 2030, not installed or available capacity. PUE 1.3 is a policy design expectation for new facilities, not a measured project performance. Source SHA and exact DOM/paragraph-text hashes accompany every quantity.

The Python producer is `automation/news/filings/policy_context.py`; it reuses the existing bounded government-document HTML parser. It performs no fetching, scheduling, project matching or authority transition. Government-authored facts only; no image or third-party material. `review.json` must record two distinct independent review roles and evidence URLs before facts display. A structurally valid receipt is not reviewer authentication. Changed policy bytes require a fresh pin and review. Pending/changed/unavailable facts leave the official source link available and do not break news or Grid.

## Shared entry and return contract

After the module loads:

```js
window.pipelineEnergyContext.selectOrigin({
  origin_type: 'repd', // or datacentre / substation
  origin_id: 'repd:2470', // bare digits are also admitted for older callers
  technology: 'solar'
});
```

Alternatively dispatch `pipeline-journey-origin` with the same `detail`. This selects topic context, not an assertion that any headline belongs to the selected asset. `possible_match` records never create exact asset associations or Journey origins.

`window.pipelineEnergyContext.newsUrl(origin)` constructs a complete HTTPS return link to the current immutable Pipeline edition with bounded `news_topic`, `news_origin_type`, `news_origin_id` query parameters. This complete URL is not the forward metadata accepted by Atlas; use the base-only contract below. `requestedContext(search)` admits return parameters. No unsupported Journey URL is generated here; the entry adapter remains owned by the preceding Pipeline/Atlas work.

For the accepted Atlas2 forward contract, use `window.pipelineEnergyContext.newsBase()` or pure `newsContextBase(base)` as the optional `news_context_url` value. Only an exact HTTPS immutable `globalgrid2050.com/uk_renewables_pipeline/<12 digits>/` base (optional `index.html`) is accepted, with no query, fragment, userinfo or explicit port. Atlas constructs its own allowlisted return topic/origin parameters. Preceding editions without this context module must not attach the metadata.

The module connects through `pipelineJourneyEntry.setNewsContextUrl()` immediately or on `pipeline-journey-ready` if the entry module arrives later. It adds no second click interceptor or URL consumer. Only the existing explicit `pipeline-journey-origin` event stores bounded news filter state in this page's history entry; a full Back-style reload restores that user selection before applying an incoming topic. No query, storage or route is changed by merely loading the module.

The NEWS and Grid panels reuse the existing sole news search/filter controls. Saved feeds without priority topics fall back to their existing category or text search. Context headline lists retain original publisher links, text and publisher/first-collected clocks. Duplicate context links are bounded without mutating the original feed. No new collector or external API is enabled.

## Validation

- `python -m pytest -q automation/news/tests/test_policy_context.py`
- `node --test automation/energy_context_ui/20261118/contracts.test.mjs`
- `node automation/energy_context_ui/20261118/browser.test.mjs`

Browser setup uses installed Playwright; optionally set `PLAYWRIGHT_IMPORT`, `PN_CONTEXT_EDITION` and `PN_CONTEXT_OUTPUT`. The default inherited V9.41 test is a saved-feed integration replay with external requests blocked. It is not public acceptance or physical-device proof. Final successor needs its own HTML stylesheet/module inclusion, SRI/feature pins, hosted gates, native Journey entry/return testing and actual public readback.

`prepare_preview.py --source-ref <40hex> --edition <12digits> --output <new external directory>` creates a disposable, SRI-wired integrated preview from exact Git archive bytes and copies this module into it. It reserves no version and changes no source edition. Set `PN_CONTEXT_ROOT` to that output and `PN_CONTEXT_INTEGRATED=true` for actual-HTML integration checks. Existing approved Sea Link producer output is reused for official planning context and native navigation to detailed facts; this creates no selected-asset association or new extraction.

Optional `--journey-ref <40hex>` copies an exact sender prototype solely for asynchronous fixture loading. `PN_CONTEXT_CANONICAL_REPLAY=true` plus `PN_CONTEXT_ASYNC_ENTRY=true` enables a clearly labelled intercepted canonical-origin fixture, needed to test the strict production-host opt-in. It remains saved-input replay with `public_acceptance=false`, not served-site proof. The fixture checks no auto-navigation, unchanged original MAP hrefs, late entry readiness, explicit-origin context and full-reload filter retention. Production public acceptance must run without that interception.

Context topic rules require original headline words or technology, rather than a broad discovery category alone. Actual saved-feed regressions exclude four generic AI stock/IPO headlines while retaining explicit data-centre, pylon/power-cable/transmission and battery/BESS/LDES items. Those are bounded relevance examples, not independent verification of article claims or project/geographic associations.

An optional new-edition-only `getViewAdapter` getter (50 bytes in `scripts/plugins/live-news.js`) enables explicit infrastructure context in the main headline list through its existing single `attachView` path. The wrapper keeps original entry objects and source clocks, and leaves the default complete list untouched. A visible context status and keyboard-accessible reset restore all original headlines; existing search, source filters and Show More remain available. `prepare_preview.py --news-hook` installs this getter only in the disposable preview. Together with the SRI loader tags, measured edition overhead is 355 bytes; shared context assets stay outside the edition. No inherited edition is changed.
