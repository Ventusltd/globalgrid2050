# ChatGPT Agent 8 — Pipeline News V9.22 controlled release and rollback record

**Date:** 15 November 2026 UTC. **Lead:** ChatGPT Agent 8, appointed sole publication owner by the user via Agent 7 signed handover. **Status:** *candidate release branch; not yet released*. This is a living gate and rollback file; future status claims must cite an exact commit and GitHub Action run.

## Source chain and boundaries

- Last published GlobalGrid2050 main: `dd0fcceb08e71d6c40b77d18e4e5eff493529d45`.
- Agent 7 donor: `5f0cadd2f8c0a9b5f44ec46fbf582ff27210b8d1` [PR #115](https://github.com/Ventusltd/globalgrid2050/pull/115); do not edit or merge donor.
- Agent 8 exclusive source: `release/agent8-v922-20261115` cut **directly from this tested donor**. The only deliberately updated V9.22 UI string is the archived V9.21 navigation status, not the source REPD dataset or the news producer.
- Candidate directory: `uk_renewables_pipeline/202611151300/`. Historical immutable V9.21 `202611141017`; V9.20 `202611140306`. Do not delete or rewrite these or their original Git trees. Source-specific Git tree V9.21 `0c56d3a81d7e3abaec164ab689b0f4c8a38e7129`; V9.20 `365d7df093368c39c3878daacf65449ba32e7267`.
- Exact REPD source: October 2026 (Q3) DESNZ frozen snapshot; **7,775** solar, battery, onshore/offshore wind project identity refs, **7,749** with location, **26** missing, 16 GB interconnectors separately, never counted as REPD. The official REPD ID, project status and update date are never inferred from RSS news.
- Source producer: 22 blob paths copied by Agent 7 from Agent 1b `f9f98bb66e30fe58f6a9e463f0222866459b5c8e` PR112. No separate Agent 1b promotion is necessary; re-run checks on Agent8 head.

## Existing baseline evidence — not a release approval for Agent8's changed SHA

At Agent7 source exact `5f0cadd2...`:
- [Strict 43730177590](https://github.com/Ventusltd/globalgrid2050/actions/runs/43730177590): 187/187 pass, inherited Agent4 11/11 pass, negative legacy 'verified news' label rejected.
- [Integrated 43730177627](https://github.com/Ventusltd/globalgrid2050/actions/runs/43730177627): successful; 15 index, 22 combiner, 13 gate, 175 ordinary acid pass and 12 XPASS.
- [Staging 43730177668](https://github.com/Ventusltd/globalgrid2050/actions/runs/43730177668): 6/6 job successes, Chromium 390/1440, CSV exact REPD export, old public V9.21/V9.20 bytes, three real GridAtlas MAP→composer→nearest outputs per viewport in one run. Manifest [artifact 14167803618](https://github.com/Ventusltd/globalgrid2050/actions/runs/43730177668/artifacts/14167803618) covers 237 V9.22 **source** files, **not public served bytes**.
- [Earlier genuine mobile defect 43728582863](https://github.com/Ventusltd/globalgrid2050/actions/runs/43728582863): 390px first card restore after true MAP click hides Botley West solar REPD12588 result even though engine computed it. BESS 12453 and onshore wind 14535 pass, desktop all three pass. A later 390 3/3 success is not proof the intermittent UI race was fixed. Separate [GridAtlas issue #87](https://github.com/Ventusltd/gridatlas/issues/87); do not fake successful universal navigation.
- Candidate article evidence: 66 RSS headings / three **POSSIBLE** REPD matches only in one dated feed snapshot (15793 Green Hill, 12588 Botley West, 2527 Inch Cape), with original article receipt/reuse right/individual signed proof not yet demonstrated. No new project-news items may be displayed or counted as independently **verified**. Candidate links are ordinary headlines and "Possible match", no article bodies or false official status changes. Do not import 258 unverified data-centre registry records.

**New Agent8 branch tests:** PENDING; do not borrow the prior exact-head SUCCESS statuses without re-running the matching source SHA.

## Authoritative homepage / discovered discrepancy

The dedicated **Ventusltd/globalgrid2050-homepage** is sole authority for `data/homepage.json`, full release list and `index.html` fallback. At owner commit `7ea8598f3bbe10b0cad8a5225da736c6f42bb8c7` its JSON and HTML already correctly list **V9.21** as operative, and a real browser link on `https://globalgrid2050.com/` resolves to V9.21. However the **imported fallback files in GlobalGrid2050 main** `index.html` and `homepage-shell/data/homepage.json` still exhibit September `202609082224` operative, despite `catalogue/homepage-owner.json` claiming the newer owner commit. This is a **hash-pinned import/build consistency problem**, not a new government-data issue.

To promote V9.22, **do not edit generated GlobalGrid2050 homepage HTML directly**. First publish and read back immutable V9.22 bytes; then use a fresh homepage-owner branch, `scripts/releases.py promote pipeline-news 202611151300`, regenerate `index.html` via `scripts/build_homepage_fallback.py`, fix stale hard-coded `202611140306` operative CI assertion in `.github/workflows/validate-homepage-release.yml`, and review full historic releases/promotion chain. Merge owner PR only on green checks. Pin all **seven** exact original owner bundle SHA256 hashes plus owner commit in GlobalGrid2050 `catalogue/homepage-owner.json`, run `scripts/import_homepage_owner.py` as documented and verify **actual served** static and JSON pointers and all old links. `scripts/import_homepage_owner.py` owns generated main files. Preserve numbered snapshots and hash-ledger for rollback.

## Release gates — expected separate evidence and pass conditions

1. [ ] **Exact source and immutable history:** Agent8 release source HEAD and diff from Agent7 donor; exact unchanged V9.20+V9.21 Git trees. No unrelated files touched.
2. [ ] **Strict/producer/event/rights-negative CI** on Agent8 current SHA. Tests mandatory, no skipped or xfailed strict. Correct source statuses including healthy-empty, failed, partial, stale and saved.
3. [ ] **V9.22 presentation and identity:** 7,775 CSV REPD refs, browser click and tests at 390/393/1440 when available, no false verified labels, 44px MAP hitbox and correct deep-link identities. WebKit and physical iOS may remain unverified if not executed; disclose.
4. [ ] **Real GridAtlas runtime:** actual source click to https://ventusltd.github.io/gridatlas/atlas/ and nearest screening for tested solar/BESS/wind on both desktop and mobile. Disclose prior intermittent minimisation and limits, or hold if current mobile run fails.
5. [ ] **Publisher rights:** only candidate/headline-link state for unsourced associations; no false “verified” status, never import unlicensed DC register rows.
6. [ ] **Public source site:** after eligible merge, GitHub Pages deployment completed; retrieve V9.22 HTTPS index, live reader JS, source manifests, CSV and asset bytes, record actual SHA256 source=served. A rendered web title/HTTP 200 alone is not exact-byte acceptance.
7. [ ] **Homepage owner:** source catalogue and HTML fallback consistent, promotion source refs pinned to immutable GlobalGrid2050 SHA, seven file hashes exact. Main importer output matches owner bundle; current homepage link resolves V9.22. Do **not** market as operative prematurely.
8. [ ] **Rollback and audit:** previous homepage owner SHA, GlobalGrid2050 main SHA and pinned pointer captured; V9.21 and V9.20 URLs still serve their original hashes; dry-run documented reversible owner-pointer change; all checks and risks posted to [Neural Link issue #30](https://github.com/Ventusltd/neural-link-between-agents/issues/30).

### Hard stop

A new current-source test failure, missing/mismatched source bytes, REPD identity loss, unpublished or mismatched public bytes, unverified news presented as confirmed, absent real MAP result on tested paths, or broken rollback => **HOLD** and report. Do not suppress CI, invent rights, or rewrite historical published versions to get a green check. Source-only candidate stage is useful even when public publication remains blocked.

## Permanent recovery

Latest state is maintained in the Agent8 dedicated Neural Link [PR38](https://github.com/Ventusltd/neural-link-between-agents/pull/38), and all signed agent communications use [issue #30](https://github.com/Ventusltd/neural-link-between-agents/issues/30). This 15 Nov owner handover supersedes old read-only Agent8 role; former agents are not publication owners or required future task participants. Their evidence remains independently checkable.

Signed **ChatGPT Agent 8**, V9.22 release owner. No claims of actual public deployment in this first document.
