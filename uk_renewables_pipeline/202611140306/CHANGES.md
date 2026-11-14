# 202611140306 (V9.20, release candidate without data-centre register content)

Parent: `202611140247` (V9.19), tree `894a17ed530219b45c1edbc526e545648add7eca`.

The register, every data byte under `data/` and the MAP link of every row are the parent's (all 7,775
hrefs identical). This version is the parent with one thing switched off, on purpose:

1. **No content from the UK data-centre register.** The register's 258 source entries all record their
   licence status as unverified, and promotion of a page carrying register-derived content is held until
   that is resolved. Removed from this version: `scripts/plugins/nearest-datacentre.js` and its script tag,
   the `convergence/` folder (nearest-site context and the 226 sites), the DATA CENTRES line under STATUS
   DISCIPLINE, the data-centre attribution line (nothing here now needs it) and the nav link to the
   data-centres page. In the data-centre headlines panel, the register-site line under a headline (site
   name and nearby REPD figures) is no longer drawn.
2. **Kept.** The data-centre capex and politics headlines panel (headlines and links from public feeds
   only; items the feed marks as pinned are labelled PINNED rather than dated), the register-changes
   list, the GridAtlas data state on the three rows it concerns, the pinned Chart.js, the list of all
   versions, the REPD source and licence line, CSV export.
3. **Nothing is lost.** The version with the data-centre context, 202611140247 (V9.19, and V9.18 before it),
   stays published and listed as the held candidate.
4. **Tests.** The parent's data-centre probes are withdrawn by declaration and replaced by probes that
   require the opposite: no nearest-data-centre entry and no register id anywhere on the page or in the
   project record of REPD 10772.
5. **Labels and runner.** V9.20 release-candidate labels; `tests/run_v9_20.sh` + `tests/check_v9_20.mjs`.
