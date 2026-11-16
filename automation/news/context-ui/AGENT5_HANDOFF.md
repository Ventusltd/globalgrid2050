# Agent 5 — bounded Context Intelligence integration note

Status: isolated component hardening, **not merged or deployed**. Review against the original composer / FIGURES pins in `pins.json`. The V9.24 appearance and homepage pointer remain owned by the ROOT integrator.

## Existing source-led coverage (no source refetch)

The original producer fixture, as evaluated at `2026-11-16T18:00:00Z`, contains exactly **14 context rows**: eight UK policy commitments, two grid/data-centre contexts and four solar/storage procurement contexts. **Three** typed numerical claims survive; **zero** canonical project links are established. These are producer fixture counts, not newly collected or independently verified evidence. The consumer still takes an externally accepted SHA-256 pin; checking the hash proves exact export identity only.

- **Policy**: The 28 October 2026 UK Data Centre Covenant, a written Parliamentary answer published 13 November 2026, and the ongoing COP31 conference page reviewed 16 November 2026. Seven Covenant evaluations remain UNKNOWN and one REPORTED_PROGRESS, with legal compliance NOT_ASSESSED. The written answer and live COP31 page lack source-byte hashes/retrieval evidence; an agenda or landing page cannot prove a final conference decision.
- **Grid**: UK government's 13 January 2025 AI Opportunities Action Plan response and a 1 November 2024 FERC order. The 480 MW figure represents *proposed co-located load in a rejected amendment*; it is neither an energised load nor an available grid connection. The UK growth-zone proposal has no eligible numerical demand claim. Context does not prove connection capacity.
- **Solar/storage**: a Google/NV Energy procurement presentation dated 22 September 2021, Google's UK release dated 16 September 2025, and an SMA Livingston supplier case study without a known publication day. The **350 MW** is historical forecast solar procurement, not current generation; **280 MW** is an upper-bound storage procurement **power** figure, not 280 MWh or an onsite allocation. Portfolio arrangements never establish an individual REPD site relationship.

Publisher date, retrieval, review, source-figure as-of and composition clock are separate. The original publisher documents have **not** been independently retrieved or verified by Agent 5. Native hash-null/unknown and all five composer limitations remain intact. Receipt metadata cannot authenticate source truth or rights.

## Host integration for V9.28 and later

The component exposes `renderContext(host, exportBytes, { expectedSha256, figures })` and supports **one** explicitly opted-in host within either an existing News tab (`data-news-context-host`) **or** an existing Pipeline tab (`data-pipeline-context-host`). This is a small nested disclosure, not a third top-level block. ROOT owns the actual host insertion, accepted-manifest pin and independent served-browser sign-off. The component **does not** crosswalk, infer or auto-link any row to a named REPD project. Show context as contextual information only, even when the page displays an REPD project nearby.

The underlying `context.css` inherits host colours and monospace font; no new public ranking, score, hero, summary panel, title block or release metadata is introduced. Existing native HTML `details` supports keyboard disclosure. Existing external FIGURES remains injected and hash-pinned rather than copied.

## Hardened failure modes and review gate

The additional consumer check rejects conflicting copies of one document, policy links inconsistent with the authoritative source catalogue, internal Grid/Solar source-record disagreement, forged numeric provenance, missing family/count/limitation metadata, post-assessment source clocks, impossible calendar dates and fabricated REPD association. It never upgrades an unknown to zero, a proposal to delivery or a source receipt to independent verification. Negative tests were added to `adapter.test.mjs`. They **require actual Node/Chrome reruns** before integration; previous worker's 30 Node and three-width Chrome receipts remain historical, not proof of this newer branch.

Reviewer commands, after checking out the exact branch with the producer dependency closure and pinned TestCode renderer:

```sh
FIGURES_UI_DIR=/path/to/TestCode/sandbox/filings-ui node --test automation/news/context-ui/adapter.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CONTEXT_UI_ARTIFACTS=/path/to/new-artifacts node automation/news/context-ui/browser.mjs
```

The ROOT integrator additionally owns V9.24 same-shell comparison at 390/393/1440 pixels and real public readback. Do not merge into a release, change the operative homepage or claim a verified REPD project match until those checks and project-specific evidence gates are accepted.
