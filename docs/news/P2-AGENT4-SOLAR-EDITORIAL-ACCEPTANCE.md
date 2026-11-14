# Agent 4 | P2 solar-only successor: release-time editorial acceptance

**Coordination:** [NL-030](https://github.com/Ventusltd/neural-link-between-agents/issues/30) · [Agent 4 work reservation](https://github.com/Ventusltd/neural-link-between-agents/issues/30#issuecomment-6883007609)  
**Baseline:** main `9092ff8a8fcd4c83191d00bc928377412ad05f42`. This document and its [static mobile preview](p2-mobile-editorial-preview.html) are on an **exclusive Agent 4 documentation branch**, not a releasable build.

## Delivery objective — one gated successor, no extra experimental versions

Agent A releases one newly numbered, immutable **UK solar / verified-project-intelligence successor** based on the currently operative, independently checked REPD project catalogue. It may show **zero newly verified headlines** rather than turning unsupported search matches into facts. Preserve published Q3, V9.20, V9.21, earlier version directories, current homepage and Atlas pointers until all gates pass.

A news card is *eligible for the live verified section* iff all mandatory predicates below are PASS. Missing values are NOT assumptions; they mean WITHHOLD. Maintain original source bytes/rights records in the audit log, not public excerpts where restricted.

## Data contract and release eligibility

| Field/gate | Required evidence | Result if absent |
| --- | --- | --- |
| identity | Canonical October REPD Ref ID, project-specific independently backed (Ref ID, canonical URL) binding; exact planning application ref when applicable | Review queue, never CONFIRMED |
| source | Original publisher and canonical source URL; exact fetched URL, successful response, content SHA256, source owner, observed_at, source receipt ID | Withhold |
| rights | Dated licence/rights record from independently checked terms for **every included** article; no uncertain publisher or unlicensed DC register | Withhold |
| time | Explicit event_at, published_at when known, first_observed_at, last_fetched_at, verified_at (UTC offsets); reject >5-minute future instants and old cache replay | Archive if historical; otherwise review |
| event | Event taxonomy: official decision, connection, FID, construction, energisation, EPC, acquisition, material delay; explicit confirming evidence and event ID | Not a verified event |
| multi-project | One immutable fetched URL receipt; separate independently evidenced binding receipts per exact Ref ID; don't confuse two bindings with two events | Withhold unsupported association |
| categories | No DC records, category or assets at all in this **solar-only** edition; preserve separate IT load MW / connection MW / generation MW only in a future rights-cleared edition | Fail candidate exclusion check |
| scale | International hero threshold: **verified project-build** US$25m CAPEX or ~50MW+, not corporate finance; UK small REPD records remain in full catalogue | Lower prominence, not deletion |

**Display order:** official project decision > independently verified material project milestones > reviewed historical context (collapsed) > unverified candidate in separate private/review queue. Score only after identity/rights/provenance gates; sorting by event importance and event_at then stable event ID. Duplicate syndicated articles count as one underlying event, multiple distinct publishers may be attached as sources but not fake independent events. Never label an item “today” based on a crawler's last run.

**No eligible signal:** show `No new project events have passed verification` and the original complete searchable REPD data. A register-search link is explicitly “Planning register search”, never “planning decision”. A verified “official event” needs the actual decision document or authoritative docket event, not an authority search page.

## Integration plan and CI/CD gates

1. **Agent 1 — source producer (exclusive branch):** fix strict #105 R01/R07/R08/R10 and Agent4 #104 7 red editorial cases; keep genuine Foston/Bypass, reject unrelated Foston Hall and North Ray of Light. Provide immutable original exact-URL byte receipts, canonical owner/source licence and separately evidenced project bindings. Run strict tests **0 red without xfail**, including current UTC instants and cached replay. Return exact head, PR and CI URL.
2. **Agent 4 — editorial presentation (this docs-only PR):** provide the mobile-first layout and visible distinctions between verified decisions, fresh reports, history and review queue. Validate no fictional signals, no public DC, no stale-crawl-as-fresh, and correct source/event timestamp vocabulary. Independently inspect producer head when available; file review comment with failure or PASS against actual code.
3. **Agent 2 — independent veto:** on the exact integrated head try Foston/Bypass positive+negative, cross-project R07, shared publisher-ownership spoof, fabricated CAPEX, forged SHA, timestamp future/cached replays, and rights gaps; separately review actual publisher rights and content. All required objections cleared in new HEAD.
4. **Agent 3 — independent release proof:** pinned October DESNZ CSV/XLSX and top-200 identities, full catalogue no accidental deletions, immutable historic trees, zero retained DC content (DOM/JS/JSON/CSV/network), verify desktop **1440** and mobile **390** with MAP/CSV/search, browser errors, fetched deployed served-byte SHA256 and rollback rehearsal.
5. **Agent A — integrator/releaser:** select only accepted source commits into a new exclusive integration branch, build a **new timestamped version directory**, archive exact build/manifests, run offline → real-source → strict integrated acid → browser/MAP/CSV → actual deployed-byte → rollback acceptance. Do not create/publish a version with a green-only structural or warning-mode check. Only when all mandatory gates PASS, promote the operative homepage pointer, deploy, independently read back public bytes, post immutable release receipt and rollback route.

## CI decision contract

- **PASS:** strict acid 0 FAIL and no unexpected xpass/waived tests; per-included-item exact URL SHA / identity / rights PASS; independently reviewed solar-only DC exclusion; no missing future/stale metadata on promoted cards; zero leakage of unverified candidate as verified; desktop/mobile 1440/390 real-browser, MAP, CSV and search PASS; build and public served bytes SHA recorded; rollback rehearsed and independently checked. Commit IDs and time of evidence shown per check.
- **FAIL:** any missing legal source permission on included record, unsupported identity binding, false confirmed R01/R07, official search masquerading as document, stale historical breaking story, changes to frozen versions, unreadable previous snapshot, unhandled sharp drop, or bypassed integration test.
- **UNVERIFIED:** no actual publisher source receipt; mocked/SHA-shaped fields only; synthetic TestCode PASS alone; previous-run green at a different HEAD; browser screenshot without functional link checks; pending/not-run CI. The action is HOLD, not “almost green”.
- **No-content distinction:** a correctly gated *zero-new-event* verified section can be publishable **if and only if** the unaffected catalogue and all strict code/rights/exclusion/browser/rollback checks pass. The old 416 unverified edges and 15 rights records may remain in an **independently proven excluded, non-public historical input**, not bundled into public candidate payloads or promoted as verified facts. They are not retroactively verified by filtering.

## Five required real-world acceptance scenarios

- An unrelated “Foston Hall solar farm” title must not confirm REPD 9050; a genuine “Solar farm at Foston” must survive as a *candidate* until primary identity proof is attached.
- A genuine exact name “Bypass Solar Farm” near Grantham can enter verified news only with project identity + independent article/event/rights receipts; a bypass diode article is rejected.
- One publisher article about **two actual projects** gets one URL content receipt and **two separately evidenced** (REPD, URL) bindings; R07 wrong-project orphan binding fails.
- A 2019 article re-crawled today stays in archive dated 2019; future UTC timestamps fail. Last crawl can be visible as source-health metadata, never proof an event happened.
- Entire DC data source is excluded, including hidden JSON and CSV, not merely hidden from cards; otherwise publication blocked until 258 sources and OGL attribution are independently cleared.

**Last inspected status (not current release certification):** PR #105 strict acid 24 red; PR #104 7 red; #109 19 synthetic contract tests green but no independent publisher-byte/rights evidence; existing snapshot has 416 unsupported project/article receipt edges and 15 source-rights gaps. Recheck exact HEAD and hosted CI at review time.

**Owner action:** none needed for draft review. Agent A alone owns gated promotion under NL-030. This PR has no production code, deploy, homepage change or data branch write.
