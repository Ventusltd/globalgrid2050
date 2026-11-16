# V9.28 Data Centre — isolated UK-first UI (Agent 2)

**Status:** component-only draft. No release, merge, new collector, homepage or GridAtlas change.
**Owner scope:** only automation/news/datacentre-ui/**.
**Integration producer:** Agent 1 / ROOT. The official V9.28 edition HTML, its global CSS and the homepage remain ROOT-owned.

## Recovery and evidence grain

Recovery base: v9.28-codex-integration at d90a2dda1f6426f4d10c525bced640ddb5b8faab.
The earlier agent2/v928-ukfirst-datacentre-ui-20261116 branch still resolved to
65bcc01e0d7e4dc073e759345727e53cf7a95752; this new branch does not overwrite it.
The separately claimed data handoff 4154862feeec6dbfa06d3b35285ff05532df9375
did not resolve as a commit when queried, but its DATA files are present in the
V9.28 integration branch. The existing 12-record 202611161747 release remains immutable.

Read-only source inputs:
- uk_renewables_pipeline/202611161757/global-datacentres/projects.json:
  100 source-indexed Wikidata leads, 22 countries, **54 GB**, 61 unknown points.
  All 100 have current operating status not_assessed and three null capacity metrics.
  Original 12 IDs present in 100. This is NOT 100 verified operating sites.
- official-projects.json: 3 distinct official-source records — two GB planning
  decision publications (PINS 3337981, 3346061) and one US tax qualification
  record. Current lifecycle UNKNOWN; not additional validated facilities.
- project-groups.json: 6 investigated entity records: 3 PROVISIONAL listed
  group associations, 3 UNLINKED. None provides verified legal ownership or
  a measured grid connection.
- selection-audit.json: 138 source candidates, 100 selected, **38 quarantined**
  with preserved original IDs, exclusion reasons and source revision links.
- Previous 202611161747/global-datacentres/projects.json: 12 original
  semantic source identities; no automatic claim that they are a separate
  cohort to add to 100.

The existing UK register/convergence pages and data-centres-gb producer are
different lineages with independent licence/identity restrictions. This
component does NOT join those rows, identify REPD projects, estimate MW, or
infer operational readiness. Government planning decisions are dated
**events**, not current operational declarations. Source-indexed Wikidata
facts are CC0 structured facts, not third-party content/accuracy validation.

## Files and contract

- model.js — strict five-input contract, retained original identifiers,
  source URL/revision/retrieval evidence, capacity nulls, geographic abstention,
  quarantine provenance and distinct evidence-grain validation. Deterministic
  UK-first/global filtering and spreadsheet-safe CSV.
- view.js — one host-mount component with UK-first table plus switchable
  Global Leads / Official Source Records / Group Associations / Quarantine
  within the host's Data Centre tab. It NEVER creates another outer page panel.
  Five files must be supplied with exact SHA-256 of **served UTF-8 bytes**;
  corrupt, stale or absent bytes fail closed and clear previous rows.
  Every source is an outbound original HTTPS link; text is inserted with
  textContent only. No untrusted HTML rendering or scraping.
- styles.css — scoped ggdc-* dark/monospace cyan/yellow, horizontal
  overflow within table at 375px, without touching global CSS.
- tests/model.test.cjs / tests/view.test.cjs — offline Node tests against
  the real V9.28 files, baseline and negative evidence/control fixtures.
- tests/harness.html / tests/browser_smoke.py — optional actual Chromium
  tests at 375, 768 and 1440 width, including search, CSV, official and
  quarantined categories and fail-closed integrity tampering.

## Exact minimal integration hook for Agent 1

In the **ROOT-owned** Data Centre tab, add a single stable element
with id datacentreHost. The ROOT owner chooses the final placement, preserving
one Headlines block and one Pipeline Analytics block, with Data Centre as an
internal tab. Include this component's local CSS and load model.js before
view.js. Do not auto-initialise it in the main document. Call mount once when
the tab is activated, or when the host is ready:

    const dcFolder = '/uk_renewables_pipeline/202611161757/global-datacentres/';
    const files = {
      projects: dcFolder + 'projects.json',
      official: dcFolder + 'official-projects.json',
      groups: dcFolder + 'project-groups.json',
      audit: dcFolder + 'selection-audit.json',
      baseline: '/uk_renewables_pipeline/202611161747/global-datacentres/projects.json'
    };
    // Generate the five hex SHA256 values from the exact version-controlled
    // bytes at these paths (not their Git blob SHAs or source-facts SHA).
    const hashPins = {
      projects: '<SHA256 of projects.json>',
      official: '<SHA256 of official-projects.json>',
      groups: '<SHA256 of project-groups.json>',
      audit: '<SHA256 of selection-audit.json>',
      baseline: '<SHA256 of original 12 projects.json>'
    };
    const result = await window.GGDataCentreUI.mount(
      document.getElementById('datacentreHost'),
      {urls: files, sha256: hashPins});
    if (result.error) console.error('Data Centre fail closed:', result.error);

These placeholders are deliberately NOT fake digest values. Generate using
sha256sum on the exact checkout, store pins in the ROOT-owned host or edition
manifest, and verify served bytes on the final site. Do not use unpinned
remote mutable URLs or stale branch names in production. Component mount
does not alter unrelated REPD or GridAtlas links.

## Run tests and acceptance

    node --test automation/news/datacentre-ui/tests/*.test.cjs
    python automation/news/datacentre-ui/tests/browser_smoke.py

For browser smoke, install Python Playwright and provision local Chromium.
All test HTTP traffic is localhost, except the component never clicks
external source links. Browser expectations: 54 GB default rows, 100 global,
3 official, 6 group, 38 quarantined; mobile overflow confined to scroll
region; no false verified/operational labels; search and 54-row CSV; failed
hash clears rows and exposes an unavailable state. Any failed test is NO-GO.

## Root integration constraints and known blockers

1. This component is not integrated into formal V9.28 HTML; ROOT owns that edit.
2. Exact-head GitHub CI / served browser evidence is not conferred by V8
   in-memory unit checks or historical green workflows. Run local Node and
   Playwright tests on this branch, and re-run once ROOT cherry-picks it.
3. There is deliberately no direct feed from older UK OSM/register candidates:
   their licensing is not fully accepted and those identities cannot be
   treated as verified sites.
4. 100 source entities ≠ 100 operating facilities; original twelve are a
   subset, three documents and six group observations are different grains.
5. Agent 1 alone handles acceptance, merging or publication. No changes
   outside this folder are needed for this handoff.
