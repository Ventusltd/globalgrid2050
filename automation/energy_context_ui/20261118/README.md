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
  origin_id: '2470',
  technology: 'solar'
});
```

Alternatively dispatch `pipeline-journey-origin` with the same `detail`. This selects topic context, not an assertion that any headline belongs to the selected asset. `possible_match` records never create exact asset associations or Journey origins.

`window.pipelineEnergyContext.newsUrl(origin)` returns an HTTPS link to the current immutable Pipeline edition with bounded `news_topic`, `news_origin_type`, `news_origin_id` query parameters. A GridAtlas consumer may use that exact published URL for a “News context” return action. `requestedContext(search)` admits those parameters. No unsupported Journey URL is generated here; the entry adapter remains owned by the preceding Pipeline/Atlas work.

The NEWS and Grid panels reuse the existing sole news search/filter controls. Saved feeds without priority topics fall back to their existing category or text search. Context headline lists retain original publisher links, text and publisher/first-collected clocks. Duplicate context links are bounded without mutating the original feed. No new collector or external API is enabled.

## Validation

- `python -m pytest -q automation/news/tests/test_policy_context.py`
- `node --test automation/energy_context_ui/20261118/contracts.test.mjs`
- `node automation/energy_context_ui/20261118/browser.test.mjs`

Browser setup uses installed Playwright; optionally set `PLAYWRIGHT_IMPORT`, `PN_CONTEXT_EDITION` and `PN_CONTEXT_OUTPUT`. The default inherited V9.41 test is a saved-feed integration replay with external requests blocked. It is not public acceptance or physical-device proof. Final successor needs its own HTML stylesheet/module inclusion, SRI/feature pins, hosted gates, native Journey entry/return testing and actual public readback.
