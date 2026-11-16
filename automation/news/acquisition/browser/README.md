# V9.25 browser smoke

From this directory run `npm ci`, `npx playwright install chromium`, then `npm test`.
The suite serves the repository locally and checks the V9.25 candidate at 375,
390, 393, 768, and 1440 pixels. It covers provisional counts, escaped article text, search,
the existing GridAtlas link contract, the full 7,775-record CSV download, and
missing or corrupt evidence without blocking the official register. Negative
cases include empty/failed source receipts, unknown rights, probe-only results,
missing source references, invalid dates and mismatched research scope. A recent
export of an old acquisition remains labelled overdue after seven days.

The interface has one News block followed by one Pipeline block. Evidence lives
inside the UK table's project-record details; there is no separate Solar-1000
list. Tests also exercise keyboard and pointer switching between UK projects
and Global data centres while preserving UK technology filters and totals.
The global tab tests use the committed sourced 12-site sample, covering country
search, provenance links, unknown capacities, unavailable coordinates and an
explicitly approximate map point. They also simulate a failed data request.

Evidence and accepted-rights receipts are generated in memory and explicitly
use **TEST FIXTURE ONLY** titles and `example.org/test-only-*` URLs. The synthetic
receipt tests the accepted state; it is not an actual rights decision.
No fixture is written to the release or data branch. External network calls are
intercepted for deterministic tests. These checks do not establish live article
availability, GridAtlas computation, source rights, or publication eligibility;
those remain separate release gates.
