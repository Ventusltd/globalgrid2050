# 202611141017 (V9.21)

Parent: `202611140306` (V9.20), tree `365d7df093368c39c3878daacf65449ba32e7267`.

This version changes the news block only. The project table, its eleven columns (NEWS SIGNAL included),
the CSV export, the register, every data byte under `data/` and the MAP link of every row are the
parent's (all 7,775 hrefs identical, character for character).

1. **Headlines that update.** The news block now opens with one list of headlines read from a file that a
   scheduled workflow refreshes several times a day
   (`pipeline-news-data` branch, `dist/pipeline_headlines.json`, schema
   `globalgrid2050.news.pipeline-headlines.v1`). Each line is the date, a category (refused, consented,
   DCO, finance, construction, grid, policy and so on), the source and the headline as a link. Newest
   first: the page orders the list by date itself, so one article cannot stay on top.
   `scripts/plugins/live-news.js`, `styles/v9-21.css`.
2. **An honest age label, computed in the browser.** "Headlines updated <date and time>" when the file is
   fresh; "Stale since <date and time> ... refresh is overdue" when it is more than 36 hours old or its
   last refresh failed. The typed-in "133 HEADLINES · 45 UK · 19 INTERNATIONAL" and the words "audited
   snapshot" are gone.
3. **Fallback.** If the live file cannot be read, the copy saved in this folder
   (`news/pipeline_headlines.snapshot.json`) is shown and labelled as a saved copy. If that holds no
   headlines, the block says "Live headlines are not available at the moment." and opens the archive.
4. **Possible match.** Where the headlines file names a REPD project for a headline, the line carries a chip
   "Possible match: <site name> (REPD <ref>)". It is a name coincidence offered for review, never a
   confirmed link, and is not written into the table. Clicking it searches the table for that REPD Ref ID.
5. **The August headlines are an archive.** The 133 project headlines collected up to 21 August 2026 are
   behind one line, "ARCHIVE · ... NOT UPDATED", with their filters. In it, a headline that is not
   matched to a project no longer prints a REPD project, MW and county beneath it (88 cards did); matched
   cards say "POSSIBLE MATCH · REPD <ref> · matched by project name" instead of "RELEVANT nn% ·
   PRIMARY_MATCH"; the per-card "algorithmic and unverified" line is removed.
6. **Bug fix: MAP was cut off at 1440 px.** The table is wider than its box on a desktop, so the ACTIONS
   column sat past the right edge. It is now pinned to the right edge of the table's box at every width,
   as it already was on a phone. No column is added, removed, hidden or reordered.
7. **Tests.** Browser probes at 1440 and 390 px: label present; headline list drawn newest first from an
   out-of-order document, with the possible-match chip and with a title containing markup drawn as text;
   the stale rule; the page with the live file refused; table headers identical to the parent's; MAP
   button inside the viewport; no typed-in counts.
8. **Labels and runner.** V9.21 labels; `tests/run_v9_21.sh` + `tests/check_v9_21.mjs`.

Known limits, stated plainly:
- The headlines workflow and its fetcher arrive in a separate change. Until its first run the live file
  does not exist, the saved copy in this folder is empty, and the block says live headlines are not
  available. Nothing in this folder needs to change when the file appears.
- The NEWS SIGNAL column is unchanged: it still reads the August file and marks 29 of 7,775 rows.
- The data-centre headlines panel and the register-changes list are unchanged.
- At 1440 px the table is still wider than its box (unchanged). With ACTIONS pinned, the columns beside it
  (REPD UPDATED, NEWS SIGNAL) pass under it and are reached by scrolling the table sideways, as on a phone.

Open question for the owner (nothing was changed): on a phone the table shows County, Operator, REPD Ref,
GlobalGrid Ref and REPD Updated as sideways-scrolling columns, as asked for in September, although the
same values are printed under each site name. Whether to keep those five columns on a phone is his decision.
