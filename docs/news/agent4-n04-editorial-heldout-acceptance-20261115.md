# Agent 4 — N04 editorial edge-case acceptance (15 November 2026)

Scope: **exclusive Agent 4 draft PR #110**, documentation-only, no publisher data, producer, release or pointer changes. This is a new falsifiable review matrix for the next immutable solar-only successor, not a claim that a live page or Playwright run passed.

Pinned producer review: PR #112 HEAD `6c5dabba12008832d1149b5d1c1ebe843328f8b4`. Hosted strict 186/186 and editorial 11/11 PASS: [43668073587](https://github.com/Ventusltd/globalgrid2050/actions/runs/43668073587). Integrated index 15/15, combiner 21/21, gate 13/13 PASS: [43668073836](https://github.com/Ventusltd/globalgrid2050/actions/runs/43668073836). These receipts cover code tests, **not** original article bytes, licences or rendered candidate.

## Held-out release-facing cases (all UNVERIFIED on a served successor)

| Case | Adversarial input | Expected safe behaviour |
| --- | --- | --- |
| E12 | Foston and Bypass genuinely named in original solar article | Two distinct REPD bindings independently evidenced; never infer either from title alone |
| E13 | North Ray mentioned only as unrelated background | No North Ray verified card, even if name token appears in summary |
| E14 | Article date tomorrow, fetched today | No fresh verified headline; flag future date; crawl timestamp must not repair it |
| E15 | One response URL mentions two solar projects, only one has an independently evidenced Ref | Only supported Ref eligible; second Ref remains unverified, no copied receipt masquerading as identity proof |
| E16 | Reviewed-only URL is assigned to wrong single Ref | Fail closed even without a shared-link duplicate; R07 wrong-project negative |
| E17 | Same normalized headline on different dates describes two distinct decisions | Do not collapse the events solely by title; preserve original decision identifiers and event dates |
| E18 | Archive article is recrawled today | Historical/archive remains historical; no freshness reset |
| E19 | Planning search result has matching project name but no official decision | Discovery/review queue only, not official-decision headline |
| E20 | Solar story has publisher date but unknown event date | Display publisher date and explicit event date unknown; do not substitute fetched date |
| E21 | Data-centre story includes incidental solar reference | Exclude from solar-only headline, JSON, CSV, search and MAP payload until separately licensed and in-scope |
| E22 | A card says “connection” but only an indicative map proximity exists | Label map as geographic exploration; never imply capacity, approval or a grid offer |
| E23 | No source passes rights, bytes and Ref-binding checks | Show honest zero-headline state; retain separate searchable REPD catalogue and independently checked export |

## 390px / 1440px visual acceptance, not yet executed

On actual served candidate, use Playwright at 390×844 and 1440×900: assert no horizontal document overflow; keyboard skip-link visible on focus; each disclosure accessible via keyboard; evidence source, event date, publication date and last-fetched timestamps distinguishable; empty state readable without fake event; MAP action visible and hit-testable (not clipped by sticky CSV/action columns); real clicked REPD Ref and coordinates arrive at GridAtlas and engine produces a visible nearest/measurement result or an explicit constrained/failed state. Popup URL alone is **insufficient**. Collect screenshot, JS errors, destination evidence and served SHA per viewport. A map result is not a grid connection offer.

## Current acceptance

- Producer exact-head CI: **PASS** for stated strict/editorial/grouped suites.
- E12–E23 on independently served release: **UNVERIFIED**; do not count this matrix as executed tests.
- Preview #110: **static noindex design only**, not release or browser acceptance.
- Original source response bytes, per-(Ref,URL) identity, rights, immutable release, browser/MAP/CSV, served-byte SHA and rollback: **HOLD**.
- Agent 2 identity/rights signoff and Agent 3 real browser acceptance remain separate independent duties. Agent A must supply rights-eligible immutable candidate before acceptance can start.
