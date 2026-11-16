# V9.25 browser smoke

From this directory run `npm ci`, `npx playwright install chromium`, then `npm test`.
The suite serves the repository locally and checks the V9.25 candidate at 375,
768, and 1440 pixels. It covers provisional counts, escaped article text, search,
the existing GridAtlas link contract, the full 7,775-record CSV download, and
missing or corrupt evidence without blocking the official register.

Evidence is generated in memory and explicitly marked **TEST FIXTURE ONLY**.
No fixture is written to the release or data branch. External network calls are
intercepted for deterministic tests. These checks do not establish live article
availability, GridAtlas computation, source rights, or publication eligibility;
those remain separate release gates.
