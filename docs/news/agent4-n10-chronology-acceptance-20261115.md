# Agent 4 — N10 editorial acceptance / 10:00 GMT checkpoint (15 November 2026)

Status: STAGING ONLY — no verified public successor. This is an independently scoped review artifact on Agent4 PR #110, not a producer change, browser screenshot, source licence or release approval.

## Exact reviewed inputs
- Producer PR #112: `f9f98bb66e30fe58f6a9e463f0222866459b5c8e`; strict/editorial hosted workflow 43696216101 SUCCESS (186/186 strict, 11/11 editorial per producer and CI handoff); integrated workflow 43696216041 SUCCESS, index 15/15, combiner 22/22, gate 13/13 per producer report. CI outcome inspected, not locally re-executed.
- Agent4 mobile preview PR #110 previous HEAD `b9a3b89d9c8cd17a61f2022c74b84aa4071ede4d`; hosted PR file-size guard 43695932997 SUCCESS; public-language gate 43695932988 QUEUED at inspection.
- Agent4 editorial fixture PR #104 HEAD `e1a9f767c7a41a2a02c9745df273a373ff8ad1e8`.
- Agent3 independent acceptance PR #111 HEAD reported `258a4a90534fa61d76fbbabc11423b848496d2ce`. Agent3 owns its own independent verdict.

## N10 distinct review contract: event chronology must not be conflated with freshness
A duplicate title alone cannot merge separate dated events; latest producer regression addresses this at the clustering layer. The presentation must also retain **three distinct timestamps**: actual event date, original publication date and retrieval date. An old event re-retrieved today must remain archive; a future-dated or missing event date must not be marked fresh. A newer article about an old decision is not a new decision without new original event evidence. Two project refs sharing an article URL require separate original project-specific evidence, never one copied receipt.

### Held-out acceptance matrix (not asserted as executed)
| Case | Input / challenge | Required safe behaviour |
|---|---|---|
| Foston | Ambiguous name-only summary | Unverified queue; no verified project headline |
| Bypass | Generic bypass story with weak project binding | Exclude from verified project headline |
| North Ray | Name collision / unsupported attribution | Preserve ambiguity, no strong identity claim |
| R07 | Wrong project with copied article URL | Reject per-project binding, even if article receipt is valid |
| Future | Event timestamp after as-of time | Do not mark fresh; quarantine for review |
| Historical duplicate | Same headline, different real event years | Preserve two events; do not merge by title alone |
| Multi-project | Single article names two projects | Require two independently checked project bindings |
| Data centre | Non-solar Energy24/DC source | Exclude from solar-only JSON, UI, CSV and MAP |
| Archive | Old event, fresh crawl timestamp | Archive, not newly announced |
| Unknown | Event date missing | Unknown/needs review, never freshly verified |
| Empty verified stream | Zero rights-cleared verified items | Explicit empty state; no invented cards |
| MAP | Valid REPD coordinates, click from mobile/desktop | Hit-testable target and visible engine result; URL alone insufficient |

## Independent acceptance gates
- 390px and 1440px real-browser screenshots and interaction: UNVERIFIED.
- Article original response receipts, per-(REPD,URL) identity, publisher licences: UNVERIFIED.
- MAP destination open, identity card and nearest-grid computation: UNVERIFIED, separate outcomes.
- CSV, served-byte hash and rollback: UNVERIFIED.
- No source rights waiver; no production/homepage/GridAtlas/Q3/V9.20/V9.21/pointer writes.

**N10 decision:** Producer chronology CI progress acknowledged. Presentation and source acceptance remain HOLD; no staging preview is a published version. Request Agent2 semantic veto, Agent3 real browser/MAP/CSV/rights verification and Agent A integration only after all gates pass.
