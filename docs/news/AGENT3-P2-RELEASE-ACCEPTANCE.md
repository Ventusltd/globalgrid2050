# Pipeline News P2 — Agent 3 independent release acceptance

**Status: QA-only draft; PUBLICATION HOLD.** Canonical owner train: https://github.com/Ventusltd/neural-link-between-agents/issues/30 . All cross-agent communications and acknowledgements are posted there.

## Exclusive roles and boundaries

Agent 1 fixes production matching, freshness and evidence defects on its new isolated producer branch. Agent 4 challenges editorial false positives/negatives and presentation; Agent 2 independently challenges source/rights/identity and holds veto. Agent 3 provides independent original-source, immutability, actual browser/CSV/MAP, served-byte SHA and reversible-homepage evidence. Agent A owns the new immutable version, integration, publication and rollback. This QA-only branch does not change any product code, data, published releases, Pages workflow, navigation or operative pointer.

The September release 202609082224, October Q3 202611132345, operative V9.20 202611140306 and existing V9.21 candidate 202611141017 remain immutable. A genuinely changed successor requires a new dated folder and version. All unverified DC records and unsupported news must be excluded, not reclassified.

## Executable components

1. automation/pipeline_release/agent3_readonly_gate.py — checks protected Git tree SHA, pre-release V9.20 pointer, every candidate project partition SHA, 7,775 unique numeric REPD Ref IDs, explicit data-centre payload markers and absence of path traversal. It **never authorises release**.
2. automation/pipeline_release/test_agent3_readonly_gate.py — adversarial tests for tampering, duplicate Ref IDs, altered hashes, missing and unsafe partitions, DC leak, premature new release IDs and unchanged release refusal.
3. .github/workflows/agent3-p2-release-acceptance.yml — read-only PR QA, first negative fixtures, then independently pinned DESNZ CSV/XLSX and historic release-checker at exact TestCode SHA. Mandatory artifacts must exist. This workflow NEVER deploys.
4. automation/pipeline_release/agent3_browser_csv_map.mjs — real Playwright Chromium at 1440 by 900 and 390 by 844 pixels, waits for complete page, checks 7,775 records and no JS errors/overflow, actually downloads CSV in both viewports and checks 7,775 unique numeric REPD identities, actually clicks a MAP anchor and checks the new GridAtlas browser's matching Ref ID.
5. automation/pipeline_release/agent3_served_sha.py — downloads each delivered HTML/JS/CSS/JSON/CSV/GeoJSON asset from the staged/served HTTPS immutable release, cache-busts, rehashes real bytes and compares to exact accepted candidate-file SHA256. Successful Pages deployment alone is insufficient.
6. automation/pipeline_release/agent3_rollback_dryrun.py — imports the actual globalgrid2050-homepage scripts/releases.py, tests a candidate promotion and reversal to V9.20 **in memory** with preserved original history and append-only audit. It never mutates the owner file; a real post-deploy rollback is still UNVERIFIED until exercised.

## Pinned original evidence

Official October CSV SHA256: 48e76c49f33a1090e78108d1ea9bfe689b35963ea3be1bb4f6516d038a5ff862, 5,219,160 bytes, 14,968 raw rows, 14,967 unique Ref IDs, 53 fields, one byte-identical Ref 7679 duplicate. XLSX SHA256: 87811e249395a05b223db6855952334f425e66cc9a2106caea0e38fd9e5037ea.

Top-200 solar SHA256: 3a23c8495f00e613a8f0f81b2db5374a19ba89d832e913c6f821823def6b49a5.

Protected Git trees: September 6247a0c3c00e8e88324d9ea55b22d67dbbb1be90; Q3 0c7a4ed5ea369e4a4e71a45cfa6fe9c186fae773; V9.20 365d7df093368c39c3878daacf65449ba32e7267. Historic original DESNZ commit 213d1a79e876d80775f1be50caec94a8c449e09b, TestCode verifier dffac137cef300b734e9830e44e3cf11b9acb728.

Current pinned owner-homepage commit c7c1ed735a52e9fdb9e74db6331c5ad0e188a001 and operative V9.20. Recheck current owner main, public URLs and PR HEADs before each real release decision.

## Candidate acceptance commands

Use an **exact read-only integration SHA** supplied by Agent A, not moving main.

### C0 — Original sources and full candidate partitions

Run the QA workflow plus:

    python3 automation/pipeline_release/agent3_readonly_gate.py --repo . --candidate-id NEW_ID --out /tmp/agent3-c0.json

Require offline_integrity_status PASS and every protected historical SHA exact. This script remains HOLD even on PASS because publisher/legal and browser proof are separate.

### C1 — Producer, editorial and publisher evidence

Agent 1 must fix actual 24 strict ACID and seven Agent4 editorial failures with zero skipped, warning-only or xfailed mandatory cases. Agent 2 must independently verify publisher response bytes, rights/terms, canonical owner, event date, original exact URL and each (REPD Ref, URL) binding. One genuine article can cover two projects only with independently validated evidence for BOTH, while R07 wrong-project reuse fails. No producer-supplied independent_fetch flag alone can qualify. Unverified/old/planning-only sources never become new verified headlines; an honest zero-new-verified-headlines state is acceptable.

### C2 — Actual page, CSV and MAP acceptance

On the new candidate release only, run npm ci in its directory and install its pinned Playwright Chromium. Once its immutable HTTPS folder is staged and reachable but **before** homepage promotion, run:

    node automation/pipeline_release/agent3_browser_csv_map.mjs --release-dir uk_renewables_pipeline/NEW_ID --url https://globalgrid2050.com/uk_renewables_pipeline/NEW_ID/ --out /tmp/agent3-browser.json

Require both viewports PASS, two genuine CSV downloads with unique REPD identity counts, and clicked true GridAtlas popup Ref matches. No staged URL -> UNVERIFIED, never simulated PASS.

### C3 — Served public bytes

    python3 automation/pipeline_release/agent3_served_sha.py --release-dir uk_renewables_pipeline/NEW_ID --url https://globalgrid2050.com/uk_renewables_pipeline/NEW_ID/ --out /tmp/agent3-served.json

Require all_served_bytes_match true on accepted HTML, JS, CSS, JSON, CSV and GeoJSON. Repeat after homepage promotion. No cache-only or PR screenshot substitutes.

### C4 — Rehearse real owner-homepage promotion/rollback

Checkout the current pinned Ventusltd/globalgrid2050-homepage source read-only as homepage-owner. Run:

    python3 automation/pipeline_release/agent3_rollback_dryrun.py --homepage-repo homepage-owner --candidate-id NEW_ID --integration-sha EXACT_40_CHAR_SHA --out /tmp/agent3-rollback.json

Require status PASS, original source bytes untouched, prior release history intact and restored operative ID 202611140306. This is **only an offline rehearsal**; after actual release Agent A must prove publicly served bytes, real 1440/390/CSV/MAP and documented recovery using the numbered owner-homepage restore point, scripts/releases.py, pinned catalogue/homepage-owner.json and GitHub Pages.

## GO / NO-GO rules

All mandatory tests must run on the **same integration SHA**, with independently retrieved real publisher evidence, source-rights clearance for *every included* item, exact REPD identities, strict acid + editorial green, no DC content on any data/UI/CSV/MAP/headline surface, immutable old releases, real browser/CSV/MAP, staged and public SHA256 parity and defensible real rollback. An absent required receipt is UNVERIFIED; a failed mandatory check is FAIL; **either means HOLD**.

Agent 3's read-only script deliberately always reports release_authorised false. Only Agent A, after independent Agent 2/3/4 evidence and standing owner authorization, may use the actual homepage-owner release process. No live site or source branch changes are made by this QA PR.

## Baseline blockers at branch creation

Agent A #105 strict integrated suite 24 FAIL / 193 PASS; Agent4 #104 seven red editorial cases; 416 historical per-project article bindings and 15 publisher rights missing external verification; all 258 DC sources unverified and therefore excluded from any solar-only successor. Watchdog #109 19 synthetic tests passing is not real publisher/rights proof. Agent1 producer branch was created from #100 HEAD 20c9f21339e13ba48da3ac8810dd194b0545b8d1. Check fresh heads and live reports, do not infer no new progress.

**Release stage must remain HOLD until actual integrated candidate and all independent evidence exist.**
