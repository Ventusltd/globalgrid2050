# 202611140128 (V9.14)

Parent: `202611140058` (V9.13), tree `18f870e1548d1c0f8d9a9c53078f97471e4e68bf`.

The register, every data byte and every existing runtime script are the parent's. The MAP link of every
row is the parent's, character for character (checked for all 7,775 rows). What changes:

1. **Data centres: capex and politics panel.** New file `scripts/plugins/datacentre-news.js`, loaded by one
   added `<script defer>` line in `index.html`. It adds one section below the newspaper with two columns
   (capex and investment; politics and policy) of headlines and links from the daily public-feed file
   `dist/datacentre_news.json` on the branch `datacentre-news-data`. Headlines and links only; no article
   text. Where a headline names a site in the UK data-centre register, the register entry and the count of
   REPD projects within 10 km are shown as straight-line context, not a connection. If the file cannot
   be read the panel is not drawn and the rest of the page is unchanged.
2. **Navigation.** Links to the list of all versions with their automated verdicts (`../versions.html`)
   and to the existing data-centres page (`../datacentres/`).
3. **Labels.** Title, brand, nav, h1 and meta line name V9.14 and this build.
4. **Runner.** `tests/run_v9_14.sh` + `tests/check_v9_14.mjs` replace the parent's pair.

Known limits: the panel shows nothing until the daily feed has headlines in a lane; the feed held 5
headlines when this build was made. The Chart.js CDN script remains unpinned, as inherited.
